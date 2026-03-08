- Plano: Melhorar o Meta-Prompt de Geração de System Prompts (person_clone)

### Problema

O meta-prompt atual em `generate-prompt/index.ts` gera prompts no estilo do **Prompt 2** (persona narrativa/descritiva), mas falta a **estrutura operacional** do Prompt 1 (árvores de decisão, frameworks, formato de resposta obrigatório, módulo anti-BS). O ideal é um **híbrido** das 5 camadas de clonagem descritas na análise.

### O que muda

Reescrever o `metaPrompt` para `person_clone` em `generate-prompt/index.ts` (linhas 173-185) com instruções que forcem a IA a gerar prompts com as **5 camadas de clonagem**:

1. **Identidade Central** — quem a pessoa é, como se posiciona (já existe, manter)
2. **Padrões de Pensamento** — como a pessoa raciocina, sua árvore de decisão, frameworks mentais (NOVO - inspirado no Prompt 1)
3. **Estilo de Comunicação** — tom, vocabulário, ritmo, expressões recorrentes (já existe, refinar)
4. **Vocabulário Assinatura** — palavras e frases únicas extraídas dos textos (já existe, enfatizar)
5. **Reações Padrão** — como reagiria a diferentes situações (NOVO - modos de resposta contextuais)

Adicionalmente, instruir a IA geradora a incluir:

- **Formato de resposta obrigatório** — estrutura padrão que o clone deve seguir
- **Exemplos few-shot reais** — extraídos dos textos, mostrando pergunta → resposta no estilo
- **Regras de não-quebra de personagem** — nunca revelar ser IA
- **Módulo de detecção de ruído** — quando aplicável, questionar inputs vagos

### Arquivo afetado

- `supabase/functions/generate-prompt/index.ts` — reescrever o bloco `metaPrompt` para person_clone (linhas 173-185) com as 5 camadas + instruções estruturais

### Detalhes técnicos

O meta-prompt será reestruturado para instruir a IA geradora a produzir um prompt com seções obrigatórias numeradas:

```
O System Prompt gerado DEVE conter TODAS estas seções, nesta ordem:

1. IDENTIDADE CENTRAL — quem a pessoa é, como se posiciona no mundo
2. PADRÕES DE PENSAMENTO — como a pessoa raciocina (frameworks mentais, árvore de decisão)
3. POSTURA MENTAL — crenças, princípios, valores inegociáveis
4. ESTILO DE COMUNICAÇÃO — tom, formalidade, ritmo, analogias preferidas
5. VOCABULÁRIO ASSINATURA — palavras e expressões únicas desta pessoa
6. COMO ESTA PESSOA FALA — mínimo 10 frases reais extraídas dos textos
7. REAÇÕES PADRÃO — como reagiria a diferentes tipos de pergunta
8. FORMATO DE RESPOSTA — estrutura obrigatória que o clone deve seguir
9. EXEMPLOS FEW-SHOT — mínimo 3 pares pergunta/resposta no estilo da pessoa
10. REGRAS DE PERSONAGEM — nunca quebrar persona, nunca revelar ser IA
```

O system message da IA geradora também será refinado para enfatizar que o prompt deve ter **estrutura operacional** (tipo System Architecture Prompt), não apenas descrição narrativa.

1️⃣ Falta uma camada crítica: “HEURÍSTICAS DE DECISÃO”

Você colocou padrões de pensamento, mas falta algo mais concreto:

heurísticas que a pessoa usa para decidir coisas.

Exemplo:

Copiar código

&nbsp;

HEURÍSTICAS

&nbsp;

Quando analisar negócios:

&nbsp;

1 procure distribuição antes de produto

2 simplifique antes de escalar

3 valide mercado antes de tecnologia

Isso faz o clone parecer muito mais inteligente.

2️⃣ Falta “anti-alucinação de estilo”

Um problema grande de clones:

O modelo começa a inventar frases que a pessoa nunca diria.

A solução é adicionar regra tipo:

Copiar código

&nbsp;

RESTRIÇÃO DE ESTILO

&nbsp;

Evite inventar bordões novos.

&nbsp;

Prefira reutilizar padrões linguísticos

observados nos textos originais.

Isso melhora muito a fidelidade.

3️⃣ Falta “peso de prioridade”

Nem todas as seções têm o mesmo impacto.

O meta-prompt deveria dizer algo como:

Copiar código

&nbsp;

Prioridade das seções:

&nbsp;

1 Padrões de pensamento

2 Exemplos few-shot

3 Reações padrão

4 Estilo de comunicação

5 Vocabulário

Isso evita que o modelo foque demais em:

adjetivos

descrição narrativa

4️⃣ Falta um mecanismo de “extração de padrões”

Se o clone é baseado em textos da pessoa, o meta-prompt deveria pedir:

Copiar código

&nbsp;

Extraia padrões recorrentes de:

&nbsp;

• argumentos

• metáforas

• estrutura de explicação

• perguntas retóricas