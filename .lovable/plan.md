

# Plano: Layout duas colunas (desktop) + espaçamento mobile

## Arquivo: `src/components/BrainChatPicker.tsx`

### Desktop — Duas colunas
- Aumentar `SheetContent` para `sm:max-w-2xl`
- Criar dois blocos de conteúdo separados: `infoContent` (info do brain + botões) e `chatListContent` (histórico de conversas)
- No desktop, renderizar ambos lado a lado com `flex flex-row` — esquerda ~40%, direita ~60% com divisor vertical entre eles
- Direita tem scroll independente

### Mobile — Ajuste de espaçamento no Drawer
- Manter layout em coluna única
- Reduzir padding do header de `px-5 pt-5` para `px-4 pt-3`
- Ícone do brain menor: `h-10 w-10` com ícone `h-5 w-5`
- Reduzir `mt-3` dos contadores e descrição para `mt-2`
- Botões de ação com `h-9` em vez de `h-11`, gap menor
- Conversas com `py-2` em vez de `py-2.5`, ícone `h-7 w-7`
- Empty state com `py-5` em vez de `py-8`
- Garantir `max-h-[80vh]` no Drawer para não sobrepor conteúdo

