

## Diagnóstico Completo: Fallback de Modelos nas Edge Functions

### Problema
Quando o primeiro modelo (gemini-2.5-flash-lite) retorna erro 403/429 (sobrecarga), algumas funções param imediatamente em vez de tentar o próximo modelo.

### Funções com Problema (SEM fallback de modelos)

| Função | Problema |
|--------|----------|
| **extract-quotes** | Usa modelo fixo `google/gemini-2.0-flash-001` (linha 114). Sem loop de fallback. |
| **process-rag** | Usa modelo fixo `google/gemini-2.0-flash-001` (linha 123). Sem loop de fallback. |

### Funções com Fallback mas com Delay Insuficiente

| Função | Status |
|--------|--------|
| **brain-chat** | OK - tem fallback com `if (401) break` |
| **general-chat** | OK - tem fallback com `if (401) break` |
| **summon-clone** | OK - tem fallback com `if (401) break`, mas sem log do modelo tentado |
| **generate-prompt** | OK - tem fallback com `if (401) break` |
| **generate-description** | OK - usa `continue` em erro (funciona) |
| **analyze-brain** | OK - tem fallback com `if (401) break` |
| **agent-squad (callAI)** | OK - usa `if (!resp.ok) continue` |

### Plano de Correção

1. **extract-quotes** - Adicionar loop de fallback com lista de modelos, igual às outras funções. Atualmente usa modelo fixo sem retry.

2. **process-rag** - Adicionar loop de fallback com lista de modelos. Atualmente usa modelo fixo sem retry.

3. **Aumentar delay entre retries** - Em todas as funções com fallback, aumentar de 500ms para 1000ms para dar mais tempo ao próximo modelo.

4. **Adicionar log consistente** - Em `summon-clone`, adicionar log de qual modelo está sendo tentado (como já existe em `brain-chat` e `generate-prompt`).

5. **Deploy** de todas as funções corrigidas.

### Detalhes Técnicos

Para `extract-quotes` e `process-rag`, o padrão será:
```typescript
const MODELS = [
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.0-flash-001",
  "meta-llama/llama-3.3-70b-instruct:free",
  "arcee-ai/trinity-large-preview:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
];

// Para cada texto, tentar modelos em sequência
for (const model of MODELS) {
  const aiResponse = await fetch(..., { model, ... });
  if (aiResponse.ok) { /* processar */ break; }
  console.error(`Model ${model} failed: ${aiResponse.status}`);
  if (aiResponse.status === 401) break;
  await new Promise(r => setTimeout(r, 1000));
}
```

