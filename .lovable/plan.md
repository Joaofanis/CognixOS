

# Plano: Separar Chat e Configuração do Brain

## Problema atual

1. **Tabs sempre visíveis**: Ao abrir um brain para chat, as abas Fontes/Análise/Prompt aparecem junto com o Chat. O usuário quer que essas abas só apareçam quando acessar via botão "Configurar".
2. **Descrição cortada**: No `BrainChatPicker`, a descrição do brain usa `line-clamp-3` e fica truncada.

## Solução

### 1. `src/pages/BrainDetail.tsx` — Modo condicional baseado em `location.state.tab`

- Ler `location.state.tab` — se for `"settings"`, mostrar todas as abas (Fontes, Análise, Prompt) com tab padrão "texts"
- Se **não** for settings (acesso normal ao chat), **esconder a barra de tabs** e renderizar apenas o `ChatInterface` diretamente, sem wrapper de Tabs
- O botão "Configurar" no `BrainChatPicker` já passa `{ state: { tab: "settings" } }`, então isso funciona automaticamente
- Adicionar no header do modo settings um botão para voltar ao chat, e no modo chat um botão para ir às configurações (ícone de engrenagem no DropdownMenu)

### 2. `src/components/BrainChatPicker.tsx` — Descrição completa

- Remover `line-clamp-3` da descrição para mostrar o texto completo
- Manter scroll natural do Sheet para descrições longas

### 3. Adicionar opção "Configurações" no menu do header (modo chat)

- No DropdownMenu do header (MoreVertical), adicionar item "Fontes & Configuração" que navega para o mesmo brain com `state: { tab: "settings" }`

