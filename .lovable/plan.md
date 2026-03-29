## Plano: Squad de Agentes para Clonagem Digital Avançada

### Conceito

Reescrever a Edge Function `auto-clone` para usar uma **arquitetura de multi-agentes** (squad) onde cada agente tem um papel especializado no processo de clonagem digital, seguindo o manual avançado de "DNA Cognitivo". O processo será mais profundo, fazendo buscas exaustivas e análises em múltiplas camadas.

### Arquitetura do Squad de Agentes

```text
Usuário digita "Alan Nicolas"
         ↓
[AGENTE CONTROLADOR] — orquestra tudo, valida qualidade
         ↓
[AGENTE PESQUISADOR] — busca exaustiva (DuckDuckGo, Wikipedia, YouTube, múltiplas queries)
         ↓
[AGENTE ANALISTA] — gera relatório de DNA Cognitivo (DISC, Eneagrama, Soft Skills, padrões)
         ↓
[AGENTE VERIFICADOR] — avalia completude e qualidade do relatório
         ↓
[AGENTE PROMPTER] — gera o System Prompt final com as 12 camadas
         ↓
Clone pronto com prompt de alta qualidade
```

### Os 4+ Agentes


| Agente          | Papel                           | Detalhes                                                                                                                                                                                                                         |
| --------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pesquisador** | Busca exaustiva na web          | Múltiplas queries (nome+entrevista, nome+podcast, nome+filosofia, nome+frases, nome+opinião). Busca em DuckDuckGo, Wikipedia (pt+en), YouTube. Extrai conteúdo de todas URLs encontradas. Meta: 10-15 fontes.                    |
| **Analista**    | Gera relatório de DNA Cognitivo | Recebe todo o conteúdo extraído e produz: perfil DISC, Eneagrama, 10 Soft Skills, traços cognitivos, padrões de argumentação, filosofia, frases marcantes, vocabulário assinatura, heurísticas de decisão, metáforas preferidas. |
| **Verificador** | Avalia qualidade e completude   | Verifica se o relatório do Analista cobre todas as dimensões necessárias. Se faltar algo, solicita ao Pesquisador buscar mais ou ao Analista aprofundar. Pode iterar até 2x.                                                     |
| **Prompter**    | Gera o System Prompt final      | Usa o relatório validado + conteúdo bruto para gerar o prompt de 12 camadas com foco em Imprinting Cognitivo. Segue o manual completo (anti-hype, few-shot, traços cognitivos, formato 5 passos).                                |


### Diferenças vs Sistema Atual


| Aspecto   | Atual                                      | Novo                                                                      |
| --------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| Busca     | 2 queries DuckDuckGo + Wikipedia + YouTube | 6-8 queries especializadas, Wikipedia pt+en, YouTube com múltiplos termos |
| Análise   | Nenhuma (pula direto para prompt)          | Agente dedicado gera relatório DISC/Eneagrama/Soft Skills                 |
| Validação | Nenhuma                                    | Agente verificador com loop de iteração                                   |
| Prompt    | 1 chamada AI direta                        | Usa relatório estruturado como input, prompt mais rico                    |
| Tempo     | ~30-60s                                    | ~2-5 min (aceitável, mostra progresso detalhado)                          |


Os agentes continua em rodando ate atingir um perfeição se nessesario pode rodar 30 minutos ate chegar a 100% de mapeamento da pessoa 

&nbsp;

### Busca Avançada (Agente Pesquisador)

Queries que serão executadas automaticamente:

1. `"Nome" entrevista OR podcast`
2. `"Nome" filosofia OR visão OR pensamento`
3. `"Nome" frases OR citações OR quotes`
4. `"Nome" opinião OR análise OR artigo`
5. `"Nome" biografia OR história OR trajetória`
6. `"Nome" site:linkedin.com OR site:medium.com`
7. Wikipedia PT + Wikipedia EN
8. YouTube: `"Nome" entrevista`, `"Nome" palestra`

### Relatório de DNA Cognitivo (Output do Analista)

O Analista gera um JSON estruturado:

```json
{
  "identity": "...",
  "disc_profile": { "D": 8, "I": 7, "S": 3, "C": 5 },
  "enneagram": "7w8",
  "cognitive_traits": ["simplifica complexidade", "desafia premissas", ...],
  "decision_heuristics": ["sempre validar com caso de uso real", ...],
  "philosophy": "...",
  "signature_vocabulary": ["...", ...],
  "real_phrases": ["...", ...],
  "communication_style": { "formality": 4, "humor": 7, ... },
  "soft_skills": { "criatividade": 9, "comunicação": 8, ... },
  "argumentation_patterns": "...",
  "preferred_metaphors": ["...", ...],
  "anti_hype_triggers": ["...", ...]
}
```

### Progresso SSE (UI)

O frontend mostrará etapas mais detalhadas:

- "Agente Pesquisador buscando fontes..." (com contagem)
- "Extraindo conteúdo de 12 fontes..."
- "Agente Analista mapeando DNA Cognitivo..."
- "Agente Verificador validando completude..."
- "Agente Prompter gerando Sistema Operacional Cognitivo..."
- "Clone criado com sucesso!"

### Arquivos Afetados


| Arquivo                                  | Ação                                                          |
| ---------------------------------------- | ------------------------------------------------------------- |
| `supabase/functions/auto-clone/index.ts` | **Reescrever** — adicionar squad de agentes                   |
| `src/components/CreateBrainDialog.tsx`   | **Editar** — atualizar UI de progresso com etapas dos agentes |


### Detalhes Técnicos

- Usa os mesmos modelos `:free` do OpenRouter (custo zero)
- Cada agente é uma chamada AI com system prompt especializado
- O Verificador pode iterar até 2x (loop controlado)
- Busca expandida: ~8 queries em paralelo onde possível
- Tempo estimado: 2-5 minutos (progresso SSE mantém usuário informado)
- Contexto limitado a 120k chars para compatibilidade com modelos gratuitos