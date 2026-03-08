

# Plano: Suporte a YouTube no import de URL

## Problema
A função `import-url` apenas faz fetch do HTML e extrai texto. YouTube retorna uma página JS-heavy com pouco conteúdo textual útil, e o conteúdo real está nas legendas/transcrição do vídeo. Não podemos usar Python em edge functions (Deno only).

## Solução
Detectar URLs do YouTube na edge function `import-url` e extrair as legendas automaticamente usando a API pública de legendas do YouTube (sem API key necessária).

### Como funciona a extração de legendas do YouTube (sem API key)
1. Detectar se a URL é do YouTube (youtube.com/watch, youtu.be, etc.)
2. Fazer fetch da página do vídeo com User-Agent de browser
3. Extrair o `ytInitialPlayerResponse` do HTML (contém metadata + URLs de legendas)
4. Do player response, pegar `captions.playerCaptionsTracklistRenderer.captionTracks`
5. Fazer fetch da URL da legenda (formato XML/srv3)
6. Parsear o XML para extrair o texto limpo
7. Salvar como `brain_text` com `source_type: "youtube"`

### Alterações

#### 1. `supabase/functions/import-url/index.ts`
- Adicionar função `isYouTubeUrl(url)` que detecta youtube.com/watch, youtu.be, youtube.com/shorts
- Adicionar função `extractVideoId(url)` para extrair o ID do vídeo
- Adicionar função `fetchYouTubeTranscript(videoId)`:
  - Faz fetch de `https://www.youtube.com/watch?v={id}` com User-Agent de browser real
  - Extrai `ytInitialPlayerResponse` via regex do HTML
  - Localiza as caption tracks (priorizando português, depois inglês, depois qualquer idioma)
  - Faz fetch da URL da legenda
  - Parseia o XML removendo tags e decodificando entidades HTML
  - Retorna `{ title, transcript }`
- No fluxo principal, antes do fetch genérico, verificar se é YouTube:
  - Se sim, chamar `fetchYouTubeTranscript` e salvar com `source_type: "youtube"`
  - Se não, seguir o fluxo HTML atual

#### 2. `src/lib/i18n.ts`
- Adicionar tradução `"feed.youtubeImport"` — "YouTube"

#### 3. `src/components/FeedTexts.tsx`
- Adicionar `"youtube"` ao `sourceTypeLabel` para exibir corretamente na lista de fontes

### Detalhes técnicos
- Nenhuma API key necessária — usa a API pública de legendas do YouTube
- Prioridade de idioma: pt → en → primeiro disponível
- Se não houver legendas disponíveis, retorna erro claro: "Este vídeo não possui legendas disponíveis"
- O título do vídeo é extraído do `playerResponse.videoDetails.title`
- Timeout de 15s mantido para o fetch do YouTube
- Sem dependências externas — tudo com fetch + regex + parsing XML manual

