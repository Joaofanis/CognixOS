# 🧠 AI Second Brain & AIOS Factory

Uma plataforma open-source de última geração projetada para atuar não apenas como um "Segundo Cérebro", mas como um verdadeiro **Sistema Operacional de Inteligência Artificial (AIOS)**. O foco do projeto é a criação hiper-realista de **Clones Cognitivos** e a orquestração de **Esquadrões de Agentes** baseados em processos industriais de alta fidelidade.

![Demonstração UI](https://img.shields.io/badge/UI-Vite_React-blue?style=for-the-badge&logo=react)
![Backend](https://img.shields.io/badge/Backend-Supabase_Edge-3ECF8E?style=for-the-badge&logo=supabase)
![AI](https://img.shields.io/badge/AI_Engine-OpenRouter-black?style=for-the-badge)

---

## 📖 A História por Trás do Projeto

Vivemos em uma era de **explosão informacional**. O ser humano comum consome hoje mais dados em um dia do que um camponês da Idade Média em uma vida inteira. O problema não é mais a falta de informação, mas a **capacidade de processamento e síntese**.

O **AI Second Brain** nasceu da necessidade de delegar a "cognição de baixo nível" para máquinas, permitindo que o usuário foque na criatividade e na tomada de decisão estratégica. O projeto evoluiu de um simples repositório de notas para uma **Linha de Montagem de Mentes Sintéticas**, onde podemos clonar o estilo de pensamento de especialistas e fazê-los trabalhar em conjunto em um esquadrão coordenado.

## 🎯 O Motivo: Por que um AIOS?

Chats genéricos (como ChatGPT puro) sofrem de "alucinação criativa" e falta de rigor processual. O **AIOS (AI Operating System)** propõe uma arquitetura onde:
1.  **LLM é o CPU**: O modelo de linguagem apenas processa instruções.
2.  **Contexto é a RAM**: O RAG (Retrieval-Augmented Generation) fornece a memória de curto e longo prazo.
3.  **Skills são Programas**: Markdown e Playbooks rígidos definem *como* a IA deve agir, eliminando a aleatoriedade.

## 💡 A Ideia: O Protocolo OPME

O coração deste projeto é o **OPME (Objective Persona Master Execution)**. Quando você cria um clone, ele não é apenas um prompt de "aja como fulano". Ele passa por uma auditoria de agentes de elite antes de nascer:

-   **DNA Cognitivo**: Extração de padrões DISC, Eneagrama e heurísticas de decisão.
-   **Shadow Profiling**: Mapeamento de motivações ocultas e traços latentes.
-   **Análise Sintática**: Decodificação exata do ritmo e vocabulário da pessoa.
-   **Simulador Roleplay**: Testes de estresse antes da ativação final.

---

## 🌟 Principais Funcionalidades

### 1. Clonagem Cognitiva (Esquadrão de 7 Agentes) 🧬
O sistema ativa a função `auto-clone` que dispara agentes especializados:
-   🔍 **Pesquisador**: Varre Google, YouTube e Wikipedia.
-   🧬 **Analista**: Monta o perfil psicológico e técnico.
-   👁️ **Psicanalista**: Enxerga o que está "nas entrelinhas" (Shadow DNA).
-   ✍️ **Linguista**: Mapeia vícios de linguagem e pontuação.
-   🎭 **Estrategista**: Cria cenários de teste (*Few-Shot Prompts*).
-   🔎 **Verificador**: O "Quality Gate" que aprova ou reprova o relatório.
-   ⚡ **Prompter**: Unifica tudo no Sistema Operacional de 12 camadas.

### 2. Memória Episódica (Mem0-Style) 🧠
Um agente "fantasma" observa suas conversas e extrai fatos sobre você, armazenando-os em um banco de vetores (`pgvector`). O clone "lembra" de você meses depois, criando uma conexão real.

### 3. Engine de Extração Nativa 🌐
Integração via **Jina AI** e parsers de YouTube para ler qualquer site ou vídeo, mesmo com proteções anti-bot, convertendo tudo para Markdown puro.

---

## 🚀 Como Usar

1.  **Exploração**: Navegue pelos clones já existentes no Dashboard.
2.  **Criação**: Clique em "Novo Clone", insira o nome de uma personalidade ou especialista e URLs de referência (opcional).
3.  **Instrução**: Adicione "Skills" (Playbooks em Markdown) para dar superpoderes específicos ao seu clone.
4.  **Chat**: Converse em tempo real e veja o raciocínio dos agentes acontecendo no painel lateral.

---

## 🛠️ Ativação Local (Guia de Instalação)

### 1. Clonar e Instalar
```bash
git clone https://github.com/joaov/ai-companion-mind.git
cd ai-companion-mind
npm install
```

### 2. Configurar Supabase
1.  Crie um projeto no [Supabase](https://supabase.com).
2.  Instale o Supabase CLI: `npm install supabase --save-dev`.
3.  Vincule ao seu projeto: `npx supabase login` e `npx supabase link --project-ref seu_projeto_id`.
4.  Aplique as migrações de banco: `npx supabase db push`.

### 3. Configurar Segredos (Secrets)
As Edge Functions precisam de chaves de API. Rode:
```bash
npx supabase secrets set OPENROUTER_API_KEY="sua_chave"
```

### 4. Variáveis de Ambiente (`.env`)
Copie o arquivo de exemplo:
```bash
cp .env.example .env
```
Preencha o `.env` com suas credenciais do Supabase (URL e Anon Key).

### 5. Executar
```bash
# Rodar Frontend
npm run dev

# Rodar Funções Localmente (Opcional)
npx supabase functions serve
```

---

## 🏗️ Stack Tecnológica

-   **Frontend**: React + Vite + TypeScript + TailwindCSS + Shadcn/UI.
-   **Backend**: Supabase (Postgres + Edge Functions + Auth).
-   **Inteligência**: OpenRouter (Roteamento dinâmico para Gemini, Llama, Qwen).
-   **Extração**: Jina AI + Custom YouTube Parsers.

---

**Nota:** Este projeto é focado em **Engenharia de Prompt Industrial**. Aqui, o processo e a estrutura vêm antes da geração aleatória de texto. Bem-vindo à era do AIOS.
