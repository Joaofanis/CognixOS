

# Plano: Análise de Habilidades Detalhada + Comparação Completa

## Problemas Atuais
1. **Análise de habilidades genérica** — a IA retorna skills vagas como "comunicação", "liderança". Falta granularidade (ex: "persuasão", "venda consultiva", "fechamento de objeções").
2. **Comparação só mostra personality_traits** — ignora completamente `skills`, que é o dado mais útil para decidir "quem é melhor em X".
3. **Sem ranking/filtro** — não dá para buscar "qual clone é mais persuasivo" ou "melhor vendedor".

## Alterações

### 1. `supabase/functions/analyze-brain/index.ts` — Prompt de skills mais detalhado
- Mudar a instrução de skills para pedir **habilidades específicas e granulares** baseadas no conteúdo real, com nota justificada.
- Adicionar campo `skills_summary` (texto livre da IA explicando os pontos fortes e fracos do clone).
- Aumentar limite de skills de 8 para 12.
- Exemplo de prompt melhorado:
  ```
  "skills": avalie habilidades ESPECÍFICAS e GRANULARES encontradas nos textos. 
  NÃO use categorias genéricas como "comunicação". 
  Use nomes precisos como "persuasão emocional", "fechamento de vendas", 
  "storytelling de produto", "negociação de preço", "rapport com cliente".
  Dê nota 0-10 baseada em evidências reais dos textos.
  ```
- Adicionar novo campo `skills_evaluation` no JSON: texto livre com avaliação qualitativa da IA sobre cada habilidade.

### 2. Migração de banco — Adicionar coluna `skills_evaluation`
- Adicionar `skills_evaluation text` na tabela `brain_analysis` para guardar a avaliação textual da IA.

### 3. `src/components/BrainAnalysis.tsx` — Exibir avaliação textual
- Abaixo do gráfico de skills, mostrar a `skills_evaluation` como texto formatado em card escuro.
- Melhorar labels do gráfico radial para mostrar nomes completos das habilidades.

### 4. `src/pages/Compare.tsx` — Comparação completa com skills
- **Permitir comparar TODOS os tipos de brain**, não só `person_clone`.
- Adicionar **segundo radar chart** comparando `skills` de ambos os clones.
- Adicionar **tabela de comparação de skills** com barras lado a lado mostrando nota de cada clone.
- Adicionar seção "Maiores Diferenças em Habilidades" (igual ao diff de traits).
- Adicionar seção de **veredito da comparação**: texto resumindo quem é melhor em quê (gerado localmente a partir dos dados, sem chamada extra de IA).

### 5. `src/pages/Compare.tsx` — Filtro por habilidade
- Adicionar um campo de busca/filtro no topo: o usuário digita "vendas" e vê quais clones têm skills relacionadas a vendas e suas notas.
- Buscar todos os `brain_analysis` com skills e filtrar localmente.

## Arquivos afetados
- `supabase/functions/analyze-brain/index.ts` — prompt mais detalhado + salvar `skills_evaluation`
- `src/components/BrainAnalysis.tsx` — exibir avaliação textual das skills
- `src/pages/Compare.tsx` — radar de skills, tabela comparativa, filtro, todos os tipos de brain
- Migração SQL — adicionar `skills_evaluation text` em `brain_analysis`

## Detalhes técnicos

### Prompt de skills melhorado (analyze-brain)
```text
"skills": {
  Avalie habilidades ESPECÍFICAS e GRANULARES. 
  NÃO use categorias genéricas. Baseie-se no conteúdo real.
  Exemplos de granularidade: "persuasão emocional" (não "comunicação"), 
  "fechamento de objeções" (não "vendas"), "storytelling de caso" (não "narrativa").
  "<habilidade específica>": <0-10>,
  ...até 12 habilidades
},
"skills_evaluation": "<parágrafo avaliando qualitativamente os pontos fortes, 
fracos e diferenciais desta pessoa/conteúdo em relação às habilidades identificadas>"
```

### Compare — Dados de skills
```text
skillsA = analysisA?.skills || {}
skillsB = analysisB?.skills || {}
allSkills = union das keys
skillsRadarData = allSkills.map(s => ({ skill, A: skillsA[s], B: skillsB[s] }))
```

### Migração SQL
```sql
ALTER TABLE brain_analysis ADD COLUMN IF NOT EXISTS skills_evaluation text;
```

### Ordem de implementação
1. Migração SQL (skills_evaluation)
2. analyze-brain (prompt melhorado + salvar skills_evaluation)
3. BrainAnalysis (exibir avaliação)
4. Compare (radar de skills + tabela + filtro + todos os tipos)

