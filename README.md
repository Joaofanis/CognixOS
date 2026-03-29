# 🧠 AI Second Brain & AIOS Factory

Uma plataforma open-source avançada projetada para atuar não apenas como um "Segundo Cérebro", mas como um verdadeiro **Sistema Operacional de Inteligência Artificial (AIOS)**. O foco do projeto é a criação hiper-realista de **Clones Cognitivos** e a orquestração de **Esquadrões de Subagentes** baseados em processos industriais rigorosos.

![Demonstração UI](https://img.shields.io/badge/UI-Vite_React-blue?style=for-the-badge&logo=react)
![Backend](https://img.shields.io/badge/Backend-Supabase_Edge-3ECF8E?style=for-the-badge&logo=supabase)
![AI](https://img.shields.io/badge/AI_Engine-OpenRouter-black?style=for-the-badge)

---

## 🌟 Principais Funcionalidades

### 1. Clonagem Cognitiva Avançada (O Esquadrão de 7 Agentes) 🧬

A plataforma vai muito além dos típicos RAGs (Retrieval-Augmented Generation). Para criar o "clone" de uma pessoa, o sistema ativa uma função severa (Edge Function `auto-clone`) que dispara **7 Subagentes de Elite** em paralelo/série:

- 🔍 **Pesquisador:** Varre o Google (via DuckDuckGo), YouTube e Wikipedia extraindo todo texto cru existente sobre a pessoa.
- 🧬 **Analista Cognitivo:** Monta o perfil de DISC, Eneagrama e Soft Skills da pessoa.
- 👁️ **Psicanalista (Shadow Profiler):** Mapeia motivações ocultas, vieses inconscientes e possíveis traços reativos sob pressão.
- ✍️ **Linguista:** Identifica vícios de digitação, pontuação, transições e regras gramaticais exatas usadas pela pessoa.
- 🎭 **Estrategista:** Forja simuladores Roleplay de alto estresse ("E se alguém te atacar? E se tiver que explicar para uma criança?") criando _Few-Shot Prompts_.
- 🔎 **Verificador:** Atua como um _Quality Gate_ dos 4 relatórios gerados.
- ⚡ **Prompter:** Unifica tudo em um megalomaníaco **Sistema Operacional Cognitivo (OPME)** de 12 camadas rigorosas.

### 2. Fábrica AIOS (Linha de Montagem de Agentes) 🏭

Fugindo da "alucinação generativa" dos chats soltos, o sistema incentiva a automação via **playbooks**:

- **Skills (Playbooks):** Roteiros rígidos (Markdown) blindando como o fluxo de trabalho deve ocorrer. (_Regra: Código / Processo > LLM_).
- **Subagentes de Tarefa Única:** A possibilidade de criar "operários" no sistema, definindo seu papel restrito e seu modelo ideal (você pode colocar um _Gemini Flash Lite_ descartável para leitura rápida, e um _Llama 70b_ como Arquiteto Final).
- **Modo Agente no Chat:** Onde um "Administrador" invisível pega seu prompt, seleciona as _Skills_ necessárias, convoca os _Subagentes_ ideais e faz eles iterarem entre si até gerar a resposta perfeita.

### 3. Memória Episódica Infinita (Mem0-Style) 🧠

Enquanto você conversa com um clone de forma fluida, há um Agente Background minúsculo observando suas frases em modo fantasma.
Ele extrai **Fatos** sobre você ou sobre o assunto discutido, vetoriza (usando o modelo `gte-small` no PostgreSQL/pgvector interno do Supabase) e armazena na sua `user_memories`. Nas próximas conversas meses depois, o clone tem o contexto injetado no próprio System Prompt antes de te responder.

### 4. Extração Web Nativa Absoluta 🌐

Integrado nativamente com a **API Jina Reader** e parsers de YouTube para conseguir bypass de anti-bots, e extrair _qualquer coisa_ da internet puramente em formato **Markdown**, o formato perfeito para consumo de LLMs.

---

## 🏗️ Stack Tecnológica

- **Frontend:** React + Vite + TypeScript. Layout extremamente moderno (Glassmorphism), totalmente responsivo e compatível com PWA (Instalável no Mobile e Desktop).
- **Interface UI:** Shadcn UI + TailwindCSS + Lucide Icons.
- **Backend & Autenticação:** Supabase (PostgreSQL, Supabase Auth, Storage para Avatares).
- **Functions:** Supabase Edge Functions usando Deno para todo o pesado (Web Scraping, Paralelismo de Agentes, Streaming SSE para respostas e raciocínios iterativos ao vivo).
- **LLM Routing:** OpenRouter (Suporta qualquer modelo: Gemini, Llama, Nemotron, Mistral, OpenAI, Anthropic, etc).

---

## 🚀 Como Executar Localmente

### Pré-requisitos

- Node.js instalado
- Uma conta no [Supabase](https://supabase.com) (Para banco e funções)
- Uma chave de API do [OpenRouter](https://openrouter.ai)

### Instalação

1. Cole o repositório na sua máquina:
   \`\`\`bash
   git clone https://github.com/SeuUsuario/ai-second-brain.git
   cd ai-second-brain
   \`\`\`

2. Instale as dependências:
   \`\`\`bash
   npm install
   \`\`\`

3. Configure as Variáveis de Ambiente locais (`.env`):
   \`\`\`env
   VITE_SUPABASE_URL=sua_url_supabase
   VITE_SUPABASE_ANON_KEY=sua_anon_key
   \`\`\`

4. Para rodar o Frontend local:
   \`\`\`bash
   npm run dev
   \`\`\`

_(Nota: Para as integrações de IA e as lógicas de Agentes funcionarem, você deve configurar o seu Supabase hospedando o banco de dados contendo o esquema do projeto, e realizar o deploy das Edge Functions localizadas em `/supabase/functions/`)._

---

**Nota sobre o Projeto:** Este repositório é fruto de uma profunda engenharia em Arquitetura baseada em Agentes (_Multi-Agent Systems_), priorizando o fluxo hiperestruturado (qualidade) acima do generativo aleatório. Desenvolvido para servir como uma verdadeira mente sintética portátil.
