# <p align="center"><img src="https://img.icons8.com/nolan/128/brain.png" width="100" /><br>CognixOS — The Intelligence Operating System</p>

<p align="center">
  <a href="#-visão-geral">Visão Geral</a> •
  <a href="#-arquitetura-opme-v20">Arquitetura</a> •
  <a href="#-estação-de-clonagem">Fábrica</a> •
  <a href="#-segurança-neural-shield">Segurança</a> •
  <a href="#-ativação-local">Instalação</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-OPME_v2.0_Active-ffc300?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Language-TypeScript-007acc?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Engine-Multi--Agent_Squad-7d00ff?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Cloud-Supabase_Edge-3ecf8e?style=for-the-badge" />
</p>

---

## 👁️ Visão Geral

O **CognixOS** não é apenas uma ferramenta de IA; é a primeira infraestrutura de **Industrial Cognitive Engineering**. Projetado para ir além do conceito de "Segundo Cérebro", o sistema opera como um **Sistema Operacional de Inteligência**, onde modelos de linguagem são processados como CPUs e o contexto é gerenciado como memória RAM dinâmica.

> "CognixOS é o elo perdido entre a inteligência generativa e a cognição estruturada."

### 🚀 O que nos diferencia?
*   **Fidelidade Neuro-Simbólica**: Combinamos análise matemática (Estilometria) com a capacidade criativa das LLMs.
*   **Lógica de Squad**: O sistema não "conversa" com você apenas; ele orquestra até 7 agentes especializados para pesquisar, analisar e validar cada pensamento.
*   **Determinismo**: Através de *Playbooks* e *Skills*, transformamos a IA imprevisível em um sistema auditável e orientado a processos.

---

## 🏗️ Arquitetura OPME v2.0 (The Internal Engine)

O protocolo **Objective Persona Master Execution (OPME)** é o coração do CognixOS. Quando um clone ou agente é criado, ele passa por uma esteira de produção em quatro fases críticas:

### Fase 1: Ingestão de Alta Resolução 🛰️
Utilizamos a tecnologia **Jina AI (Reader Mode)** e parsers customizados para varrer a internet. O sistema pode ler sites complexos, transcrições de YouTube e artigos da Wikipedia, removendo anúncios e ruídos para entregar apenas o "ouro" informacional.

### Fase 2: Escaneamento Determinístico 🧬
Diferente de sistemas comuns, o CognixOS realiza um scan prévio via TypeScript:
*   **Styleometry Analyzer**: Calcula o tamanho médio das frases, frequência de palavras, taxa de subordinação e padrões de pontuação.
*   **Emotional Scrabbler**: Identifica arquétipos dominantes (Sábio, Criador, Fora-da-lei) através da frequência léxica de gatilhos emocionais.

### Fase 3: Paralelismo de Agentes (The Squad) 🕵️
Após o scan matemático, ativamos o esquadrão de IAs:
1.  **Pesquisador**: Fatos e cronologia.
2.  **Analista**: Perfil cognitivo e técnico.
3.  **Psicanalista**: Shadow DNA e motivações latentes.
4.  **Linguista**: Forja a "assinatura verbal" baseada na estilometria.
5.  **Estrategista**: Cria cenários de teste (*Few-Shot scenarios*).
6.  **Verificador**: Auditor de qualidade (Quality Gate).
7.  **Prompter**: Sintetizador final do System Prompt.

---

## 🛡️ Segurança: Neural Shield Alpha

O CognixOS é construído com foco em segurança de dados e proteção contra manipulação:
*   **Prompt Armor**: Proteção contra ataques de injeção de prompt e jailbreaks.
*   **Neural Sandbox**: As execuções de busca e leitura são isoladas, prevenindo ataques SSRF (Server Side Request Forgery).
*   **Data Sovereignty**: Todos os dados de "cérebro" são armazenados de forma privada em seu banco Supabase com políticas de RLS (Row Level Security) rigorosas.

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

### 2. Infraestrutura Backend
1.  Crie um projeto no Supabase.
2.  Rode o comando `npx supabase db push` para subir as tabelas de pgvector e perfis.
3.  Configure os segredos das Edge Functions:
    ```bash
    npx supabase secrets set OPENROUTER_API_KEY="sua_chave"
    ```

### 3. Variáveis `.env`
Renomeie o `.env.example` para `.env` e preencha:
*   `VITE_SUPABASE_URL`
*   `VITE_SUPABASE_ANON_KEY`

---

## 🗺️ Roadmap CognixOS

*   [x] OPME v2.0 Hybrid Engine
*   [x] Multi-Provider Routing (Qwen, Llama, Gemini)
*   [x] Neural Shield alpha
*   [ ] Integração de Voz (Real-time Latency)
*   [ ] Multi-modal Analysis (Análise de vídeos e imagens na ingestão)
*   [ ] Cognix Marketplace (Compartilhamento seguro de Agents Skills)

---

## 📈 Potencial de Mercado

O CognixOS tem potencial para revolucionar setores como:
*   **Educação**: Criação de clones digitais de professores com base em suas aulas reais.
*   **Suporte Enterprise**: Esquadrões de agentes que seguem playbooks corporativos sem desvios de conduta.
*   **Consultoria**: Automação de diagnósticos complexos usando esquadrões de especialistas sintéticos.

---

© 2026 **CognixOS Project**. Built for the future of structured intelligence. Distributed under MIT License.

### 4. Execução
```bash
npm run dev
```

---

## 🏗️ Stack Tecnológica
*   **Frontend**: React + Vite + Tailwind (Premium Design/Glassmorphism).
*   **Engine**: Custom Agent-Squad Orchestrator (Multi-Provider Support).
*   **Models**: Qwen 3.6 Plus, Llama 3.3 70B, Gemini 2.0 Flash Lite, MiniMax M2.5.
*   **Retrieval**: Supabase `pgvector` + Jina AI (Web/YouTube Analysis).

---

© 2026 CognixOS Project. Built for the future of structured intelligence.


**Nota:** Este projeto é focado em **Engenharia de Prompt Industrial**. Aqui, o processo e a estrutura vêm antes da geração aleatória de texto. Bem-vindo à era do AIOS.
