

# Plano: Página de Configurações

## Resumo

Criar uma nova página `/settings` com seções de acessibilidade, idioma, segurança e dados. O seletor de idioma do chat será movido para as configurações e persistido globalmente.

## Arquivos a criar/modificar

### 1. Criar contexto global de configurações — `src/hooks/useSettings.tsx`

Um contexto React que persiste no `localStorage`:
- **fontSize**: `"normal" | "large" | "xlarge"` — aplica classes CSS no `<html>`
- **highContrast**: boolean — ativa modo alto contraste
- **reducedMotion**: boolean — desativa animações
- **language**: `"pt-BR" | "en-US" | "es-ES"` — idioma global (usado no spellCheck do chat e em labels futuros)

O provider aplica as classes CSS no `document.documentElement` via `useEffect`.

### 2. Criar página de configurações — `src/pages/Settings.tsx`

Seções organizadas em cards:

**Acessibilidade:**
- Slider/botões para tamanho da fonte (Normal / Grande / Extra Grande)
- Toggle alto contraste
- Toggle reduzir animações

**Idioma:**
- Select com 3 opções: Portugues, English, Espanol
- Ao mudar, persiste no contexto global

**Segurança:**
- Botao "Alterar senha" — chama `supabase.auth.updateUser({ password })` com dialog de confirmacao
- Botao "Excluir conta" — dialog com confirmacao, chama `supabase.rpc` ou deleta dados + `signOut`

**Dados:**
- Botao "Limpar cache" — limpa `localStorage` (exceto auth) + invalida queries
- Info de armazenamento usado

**Sobre:**
- Versao do app, links uteis

### 3. Adicionar CSS responsivo para font sizes — `src/index.css`

```css
html.font-large { font-size: 18px; }
html.font-xlarge { font-size: 20px; }
```

Tailwind usa `rem`, entao aumentar o root font-size escala tudo proporcionalmente. Adicionar `max-width` ajustes para manter layout coeso em tamanhos maiores.

### 4. Modificar `src/components/ChatInterface.tsx`

- Remover o botao de toggle de idioma do chat
- Ler o idioma do contexto `useSettings()` para o atributo `lang` e `spellCheck` do textarea

### 5. Modificar `src/App.tsx`

- Importar `SettingsProvider` e envolver o app
- Adicionar rota `/settings` protegida

### 6. Adicionar link para Settings no Dashboard

- Adicionar icone de engrenagem (Settings) no header do Dashboard linkando para `/settings`

## Notas tecnicas

- O font-size scaling via `rem` garante que todos os componentes escalam sem quebrar layout
- A exclusao de conta deletara todos os brains, textos e perfil do usuario antes de chamar signOut
- O cache clearing preservara tokens de auth para nao deslogar o usuario

