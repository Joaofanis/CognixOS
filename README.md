# ![Brain Logo](https://img.icons8.com/nolan/128/brain.png)
# CognixOS — The Intelligence Operating System

[![Status: OPME v2.0 Active](https://img.shields.io/badge/Status-OPME_v2.0_Active-ffc300?style=for-the-badge)](https://github.com/Joaofanis/CognixOS)
[![Language: TypeScript](https://img.shields.io/badge/Language-TypeScript-007acc?style=for-the-badge)](https://www.typescriptlang.org/)
[![Engine: Multi-Agent Squad](https://img.shields.io/badge/Engine-Multi--Agent_Squad-7d00ff?style=for-the-badge)](https://github.com/Joaofanis/CognixOS)
# CognixOS - Autonomous Intelligence Operating System

> **Protocolo OPME v2.0:** A arquitetura neuro-simbólica definitiva para a criação de clones cognitivos de alta fidelidade.

![CognixOS Banner](https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=2000)

## 🧠 O que é o CognixOS?

O **CognixOS** (anteriormente Segundo Cérebro) é um Sistema Operacional de Inteligência desenhado para capturar, processar e emular a consciência digital de especialistas através do **Protocolo OPME v2.0** (Ontological Psychometric Mapping Engine).

Diferente de chatbots genéricos, o CognixOS utiliza uma esteira de produção industrial de dados para forjar **Clones Cognitivos** que mantêm não apenas o conhecimento, mas o estilo de escrita (Estilometria), o tom emocional (Análise de Sentimento) e a estrutura psicológica (DISC, MBTI, Eneagrama) do indivíduo mapeado.

## 🚀 Principais Tecnologias (Stack v5.0)

*   **Frontend:** React 18 + Vite + TailwindCSS + Shadcn/UI (Design Industrial Premium)
*   **Backend:** Supabase (PostgreSQL + PgVector + Edge Functions)
*   **IA Engine:** OpenRouter (Roteamento entre Gemini 2.0, Llama 3.3, Qwen e DeepSeek)
*   **Memória:** Mem0 (Longo Prazo) + RAG Determinístico (PGVector)
*   **Segurança:** Protocolo Fortaleça (Neural Shield contra Injeção de Prompt)

## 🛠 Arquitetura OPME v2.0 (Alan Nicolas DNA)

O coração do CognixOS é a sua esteira de processamento neuro-simbólico:

1.  **Ingestão Multi-Fonte:** Captura de dados via YouTube, Web, LinkedIn e Documentos.
2.  **Analisador Determinístico:** Cálculos matemáticos de TTR (Type-Token Ratio), densidade adverbial e padrões sintáticos.
3.  **Mapeamento Psicométrico:** Extração de perfis DISC, MBTI e Eneagrama com base em evidências textuais.
4.  **Sintetizador de DNA:** Orquestração de Agentes (Linguista, Psicanalista, Estrategista) para criar o System Prompt definitivo.

## 🔨 Como Rodar Localmente

1.  Clone o repositório:
    ```bash
    git clone https://github.com/Joaofanis/CognixOS.git
    ```
2.  Instale as dependências:
    ```bash
    npm install
    ```
3.  Configure as variáveis de ambiente (.env):
    ```env
    VITE_SUPABASE_URL=seu_url
    VITE_SUPABASE_ANON_KEY=sua_key
    ```
4.  Inicie o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```

---

<div align="center">
  <p><b>CognixOS: Onde o conhecimento encontra a imortalidade digital.</b></p>
</div>

### Fase 1: Ingestão de Alta Resolução 🛰️

Utilizamos a tecnologia **Jina AI (Reader Mode)** e parsers customizados para varrer a internet. O sistema pode ler sites complexos, transcrições de YouTube e artigos da Wikipedia, removendo anúncios e ruídos para entregar apenas o "ouro" informacional.

### Fase 2: Escaneamento Determinístico 🧬

Diferente de sistemas comuns, o CognixOS realiza um scan prévio via TypeScript:

* **Styleometry Analyzer**: Calcula o tamanho médio das frases, frequência de palavras, taxa de subordinação e padrões de pontuação.
* **Emotional Scrabbler**: Identifica arquétipos dominantes (Sábio, Criador, Fora-da-lei) através da frequência léxica de gatilhos emocionais.

### Fase 3: Paralelismo de Agentes (The Squad) 🕵️

Após o scan matemático, ativamos o esquadrão de IAs:

1. **Pesquisador**: Fatos e cronologia.
2. **Analista**: Perfil cognitivo e técnico.
3. **Psicanalista**: Shadow DNA e motivações latentes.
4. **Linguista**: Forja a "assinatura verbal" baseada na estilometria.
5. **Estrategista**: Cria cenários de teste (*Few-Shot scenarios*).
6. **Verificador**: Auditor de qualidade (Quality Gate).
7. **Prompter**: Sintetizador final do System Prompt.

---

## 🛡️ Segurança: Neural Shield Alpha

O CognixOS é construído com foco em segurança de dados e proteção contra manipulação:

* **Prompt Armor**: Proteção contra ataques de injeção de prompt e jailbreaks.
* **Neural Sandbox**: As execuções de busca e leitura são isoladas, prevenindo ataques SSRF (Server Side Request Forgery).
* **Data Sovereignty**: Todos os dados de "cérebro" são armazenados de forma privada em seu banco Supabase com políticas de RLS (Row Level Security) rigorosas.

---

## 🛠️ Ativação Local

### 1. Preparação do Ambiente

Este projeto utiliza **Bun** (ou NPM) e o ecossistema **Supabase**.

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/cognixos.git
cd cognixos

# Instale as dependências
npm install
```

### 2. Infraestrutura Backend e Banco de Dados (Supabase)

Para garantir que a segurança e os vetores de inteligência artificial (pgvector) funcionem corretamente, preparamos um guia passo a passo definitivo para você replicar o servidor.

👉 **[Acesse o Guia Completo de Implantação e Banco de Dados aqui!](./GUIA_SUPABASE.md)**

Isso inclui como:
- Subir a configuração completa das tabelas e as Políticas de Segurança.
- Adicionar chaves secretas (como o seu token LLM do OpenRouter).
- Iniciar a rede de "Edge Functions" Serverless da CognixOS.

```bash
npx supabase secrets set OPENROUTER_API_KEY="sua_chave"
```

### 3. Variáveis `.env`

Renomeie o `.env.example` para `.env` e preencha:

* `VITE_SUPABASE_URL`
* `VITE_SUPABASE_ANON_KEY`

### 4. Execução

```bash
npm run dev
```

---

## 🗺️ Roadmap CognixOS

* [x] OPME v2.0 Hybrid Engine
* [x] Multi-Provider Routing (Qwen, Llama, Gemini)
* [x] Neural Shield alpha
* [ ] Integração de Voz (Real-time Latency)
* [ ] Multi-modal Analysis (Análise de vídeos e imagens na ingestão)
* [ ] Cognix Marketplace (Compartilhamento seguro de Agents Skills)

---

## 📈 Potencial de Mercado

O CognixOS tem potencial para revolucionar setores como:

* **Educação**: Criação de clones digitais de professores com base em suas aulas reais.
* **Suporte Enterprise**: Esquadrões de agentes que seguem playbooks corporativos sem desvios de conduta.
* **Consultoria**: Automação de diagnósticos complexos usando esquadrões de especialistas sintéticos.

---

## 🏗️ Stack Tecnológica

* **Frontend**: React + Vite + Tailwind (Premium Design/Glassmorphism).
* **Engine**: Custom Agent-Squad Orchestrator (Multi-Provider Support).
* **Models**: Qwen 3.6 Plus, Llama 3.3 70B, Gemini 2.0 Flash Lite, MiniMax M2.5.
* **Retrieval**: Supabase `pgvector` + Jina AI (Web/YouTube Analysis).

---

© 2026 **CognixOS Project**. Built for the future of structured intelligence. Distributed under MIT License.

**Nota:** Este projeto é focado em **Engenharia de Prompt Industrial**. Aqui, o processo e a estrutura vêm antes da geração aleatória de texto. Bem-vindo à era do AIOS.
