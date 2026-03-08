

# Plano: Editar nome e apagar conversas

## Contexto
Atualmente, o `BrainChatPicker` (painel do Dashboard) não permite editar nomes nem apagar conversas. O `BrainDetail` (sidebar do chat) já tem delete mas não edit. Vamos adicionar ambas as funcionalidades nos dois lugares.

## Alterações

### 1. Adicionar traduções em `src/lib/i18n.ts`
- `"brainDetail.renameConversation"` — "Renomear"
- `"brainDetail.conversationRenamed"` — "Conversa renomeada."
- `"picker.deleteConversation"` — "Excluir conversa"

### 2. `src/components/BrainChatPicker.tsx` — Adicionar ações em cada conversa
- Importar `Trash2`, `Pencil`, `Check`, `X` e `useQueryClient`
- Em cada item de conversa, adicionar dois botões de ação (aparecem no hover / sempre visíveis no mobile):
  - **Editar nome**: Ao clicar, transforma o título em um `input` inline editável. Botões de confirmar (Check) e cancelar (X). No confirm, faz `supabase.from("conversations").update({ title }).eq("id", convId)` e invalida a query.
  - **Excluir**: Ao clicar, faz `supabase.from("conversations").delete().eq("id", convId)` e invalida a query. Toast de confirmação.
- Usar estado local `editingId` e `editingTitle` para controlar qual conversa está em modo de edição.

### 3. `src/pages/BrainDetail.tsx` — Adicionar edição de nome na sidebar
- No item de conversa na sidebar, adicionar botão de editar (ícone Pencil) ao lado do botão de excluir já existente.
- Mesma lógica: clique transforma em input inline, confirmar salva no Supabase e invalida queries.

### Detalhes técnicos
- Nenhuma mudança de banco de dados necessária — a RLS já permite UPDATE em conversations via `is_brain_owner`
- Usar `e.stopPropagation()` nos botões de ação para não navegar ao clicar
- Input de edição com `autoFocus`, `onKeyDown` para Enter (salvar) e Escape (cancelar)

