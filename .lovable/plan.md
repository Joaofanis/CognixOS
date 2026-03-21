

## Plano: Sistema de Auto-Criação de Clones (Self-Building Clone)

### Conceito

Criar um fluxo onde o usuário fornece apenas o **nome da pessoa** (e opcionalmente URLs) e o sistema automaticamente:
1. Busca informações na internet
2. Extrai e processa o conteúdo
3. Gera o system prompt com as 12 camadas
4. Cria o clone pronto para conversar

Tudo usando **modelos gratuitos do OpenRouter** (que já estão configurados) + scraping básico sem APIs pagas.

### Arquitetura

```text
Usuário digita "Alan Nicolas"
         ↓
[Edge Function: auto-clone]
         ↓
    1. Busca web gratuita (Google via scraping HTML)
         ↓
    2. Extrai conteúdo das top URLs encontradas
         ↓
    3. Salva textos no brain_texts
         ↓
    4. Chama generate-prompt (já existente)
         ↓
    5. Retorna brain pronto com prompt gerado
```

### Custo: ZERO em APIs extras

- **Busca web**: Scraping do Google Search via fetch HTML (sem API paga)
- **Extração de conteúdo**: Já existe na função `import-url` (scraping HTML básico)
- **Geração de prompt**: Usa modelos `:free` do OpenRouter (já configurado)
- **YouTube**: Já suportado no `import-url` existente

### O que será criado

#### 1. Nova Edge Function: `auto-clone/index.ts`

Recebe `{ name, urls?: string[], brainName?: string }` e orquestra todo o fluxo:

- Se `urls` fornecidas → usa diretamente
- Se apenas `name` → faz scraping do Google para encontrar URLs relevantes (perfis, artigos, vídeos)
- Para cada URL encontrada, extrai conteúdo (reutiliza lógica do `import-url`)
- Cria o brain no banco
- Salva os textos extraídos como `brain_texts`
- Chama `generate-prompt` internamente para gerar o system prompt
- Retorna o brain_id criado

Resposta via SSE (streaming) para mostrar progresso em tempo real:
```json
{"step": "searching", "message": "Buscando informações sobre Alan Nicolas..."}
{"step": "found_urls", "urls": ["url1", "url2"]}
{"step": "extracting", "url": "url1", "progress": "1/5"}
{"step": "generating_prompt", "message": "Gerando personalidade..."}
{"step": "done", "brainId": "uuid"}
```

#### 2. Frontend: Botão "Auto-Criar Clone" no `CreateBrainDialog`

No Step 1 (Identidade), adicionar um botão "Criar Automaticamente" que:
- Pede apenas o nome da pessoa
- Opcionalmente aceita URLs adicionais
- Mostra progresso em tempo real (steps do SSE)
- Ao terminar, navega direto para o brain criado

#### 3. Busca Web Gratuita (dentro do auto-clone)

Scraping do Google Search sem API:
- `fetch("https://www.google.com/search?q=nome+pessoa")` com User-Agent de browser
- Extrai links dos resultados HTML via regex
- Filtra por domínios confiáveis (linkedin, twitter/x, youtube, medium, wikipedia, blogs)
- Limita a 5-8 URLs para não sobrecarregar

### Limitações honestas

- Scraping do Google pode ser bloqueado por rate limit (funciona para uso moderado)
- Sites com JavaScript pesado (SPAs) não serão extraídos completamente
- Twitter/X tem proteção anti-scraping forte, pode falhar
- Qualidade do clone depende da quantidade/qualidade do conteúdo público disponível

### Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/auto-clone/index.ts` | **Novo** — orquestrador principal |
| `src/components/CreateBrainDialog.tsx` | **Editar** — adicionar botão "Auto-Criar" e UI de progresso |
| `supabase/config.toml` | **Editar** — registrar nova função |

### Detalhes técnicos

A função `auto-clone` será self-contained (~300 linhas):
- Busca Google via fetch HTML + regex para extrair URLs
- Para cada URL, faz fetch + extração de texto (similar ao import-url mas simplificado)
- Usa o Supabase service role para criar brain + brain_texts
- Chama OpenRouter (modelos :free) para gerar o system prompt inline
- Streaming SSE para feedback em tempo real

