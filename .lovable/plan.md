

# Plano de Melhorias -- Segundo Cerebro

## Resumo

Apos analise completa do sistema, identifiquei melhorias organizadas em 3 categorias: **Funcionalidades Novas**, **Melhorias de UX** e **Melhorias Tecnicas/Resiliencia**.

---

## 1. Suporte a Upload de PDF e DOCX

**Problema atual:** Apenas arquivos `.txt` sao aceitos. O plano original preve `.pdf` e `.docx`.

**Solucao:** Criar uma Edge Function `parse-file` que recebe o arquivo via FormData, extrai o texto usando bibliotecas Deno, e retorna o conteudo para ser salvo em `brain_texts`.

**Arquivos afetados:**
- Novo: `supabase/functions/parse-file/index.ts`
- Editar: `src/components/FeedTexts.tsx` (aceitar .pdf/.docx, enviar para a edge function)

---

## 2. Truncamento de Contexto no Chat (brain-chat)

**Problema atual:** O `brain-chat` envia todos os textos sem limite de caracteres (apenas `limit(50)` por registros). Textos grandes podem exceder o contexto do modelo e causar erro 400.

**Solucao:** Aplicar o mesmo truncamento de 30.000 caracteres ja usado no `analyze-brain`.

**Arquivos afetados:**
- Editar: `supabase/functions/brain-chat/index.ts` (truncar `contextTexts` a 30k chars)

---

## 3. Analise de Personalidade para Todos os Tipos de Cerebro

**Problema atual:** A aba "Analise" so aparece para `person_clone`. Cerebros de conhecimento, filosofia e guia pratico nao tem nenhuma visualizacao analitica.

**Solucao:** Mostrar a aba "Analise" para todos os tipos, adaptando o prompt da Edge Function:
- **person_clone**: Tracos de personalidade + temas (atual)
- **knowledge_base**: Areas de conhecimento + temas principais
- **philosophy**: Principios filosoficos + temas
- **practical_guide**: Competencias praticas + temas

**Arquivos afetados:**
- Editar: `src/pages/BrainDetail.tsx` (remover condicao `isPersonClone` da aba Analise)
- Editar: `supabase/functions/analyze-brain/index.ts` (receber tipo do cerebro, adaptar prompt)
- Editar: `src/components/BrainAnalysis.tsx` (adaptar labels dos graficos por tipo)

---

## 4. Pagina de Perfil do Usuario

**Problema atual:** Nao existe pagina de perfil. O `display_name` e coletado no cadastro mas nunca exibido ou editavel.

**Solucao:** Criar uma pagina `/profile` com edicao de nome e avatar, usando a tabela `profiles` ja existente.

**Arquivos afetados:**
- Novo: `src/pages/Profile.tsx`
- Editar: `src/App.tsx` (adicionar rota)
- Editar: `src/pages/Dashboard.tsx` (link para perfil no header)

---

## 5. Busca por Conteudo nos Textos do Cerebro

**Problema atual:** Na aba "Fontes" nao ha como buscar dentro dos textos ja adicionados.

**Solucao:** Adicionar um campo de busca no topo da lista de textos em `FeedTexts.tsx` que filtra localmente pelo conteudo.

**Arquivos afetados:**
- Editar: `src/components/FeedTexts.tsx`

---

## 6. Contagem de Textos e Conversas no Card do Dashboard

**Problema atual:** Os cards do Dashboard mostram apenas nome, tipo e descricao. Nao ha indicacao de quanto conteudo o cerebro tem.

**Solucao:** Fazer um join ou query agregada para mostrar o numero de textos e conversas em cada card.

**Arquivos afetados:**
- Editar: `src/pages/Dashboard.tsx` (query com count, exibir badges)

---

## 7. Feedback Visual de Erro Mais Claro no Chat

**Problema atual:** Erros no chat aparecem como mensagens do assistente com emoji de aviso, sem botao de retry.

**Solucao:** Adicionar um botao "Tentar novamente" nas mensagens de erro, e estilizar visualmente diferente.

**Arquivos afetados:**
- Editar: `src/components/ChatInterface.tsx` (detectar mensagens de erro, renderizar botao retry)
- Editar: `src/hooks/useBrainChat.ts` (expor funcao de retry)

---

## 8. Link para Comparacao no Dashboard

**Problema atual:** A pagina `/compare` existe mas nao ha nenhum link na interface para acessa-la.

**Solucao:** Adicionar um botao "Comparar" no header do Dashboard que navega para `/compare`.

**Arquivos afetados:**
- Editar: `src/pages/Dashboard.tsx`

---

## Secao Tecnica -- Detalhes de Implementacao

### Parse de PDF (item 1)
A Edge Function usara `pdf-parse` (via esm.sh) para PDFs. Para DOCX, usara `mammoth` via esm.sh. O frontend enviara o arquivo via `FormData` e a funcao retornara `{ content: string }`.

### Truncamento no brain-chat (item 2)
```text
const MAX_CHARS = 30000;
let contextTexts = texts?.map(t => t.content).join("\n\n---\n\n") || "";
if (contextTexts.length > MAX_CHARS) {
  contextTexts = contextTexts.slice(0, MAX_CHARS) + "\n\n[...truncado]";
}
```

### Analise adaptativa por tipo (item 3)
O `analyze-brain` recebera o `brain.type` e ajustara o JSON schema solicitado:
- `person_clone`: `personality_traits` (radar) + `frequent_themes` (barras)
- `knowledge_base`: `knowledge_areas` (radar) + `frequent_themes` (barras)
- Outros tipos: `key_concepts` (radar) + `frequent_themes` (barras)

### Ordem de implementacao sugerida
1. Item 2 (truncamento -- correcao critica, rapida)
2. Item 8 (link comparacao -- rapido)
3. Item 5 (busca textos -- rapido)
4. Item 6 (contagens no dashboard)
5. Item 7 (retry no chat)
6. Item 3 (analise para todos os tipos)
7. Item 4 (pagina perfil)
8. Item 1 (upload PDF/DOCX -- mais complexo)

