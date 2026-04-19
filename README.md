# ![Brain Logo](https://img.icons8.com/nolan/128/brain.png)
# 🧠 CognixOS - O Sistema Operacional de Inteligência (OPME v3.0)
## 🛡️ The Forensic Singularity Milestone

[![Vercel Deployment](https://img.shields.io/badge/Deployment-Vercel-black?logo=vercel)](https://cognix-os.vercel.app/)
[![Supabase Backend](https://img.shields.io/badge/Backend-Supabase-green?logo=supabase)](https://supabase.com/)
[![Intelligence Protocol](https://img.shields.io/badge/Protocolo-OPME%20v3.0-blue)](https://github.com/Joaofanis/CognixOS)
[![Fidelity](https://img.shields.io/badge/Fidelidade-92--95%25-brightgreen)](https://github.com/Joaofanis/CognixOS)

<div align="center">
  <p><b>A infraestrutura terminal para a criação, extração e execução de Mentes Sintéticas de alta fidelidade.</b></p>
</div>

---

## 🌌 Visão Geral: O Despertar da Cognição Estruturada

![CognixOS Banner](https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=2000)

O **CognixOS** é uma plataforma de clonagem cognitiva de alta fidelidade baseada no protocolo **OPME v3.0 (Forensic Singularity)**. Ele permite a síntese de "Mentes Digitais" — instâncias de IA que não apenas emulam a fala, mas ancoram sua lógica em uma **Crônica de Identidade** determinística, replicando o léxico mental, heurísticas e associações semânticas de indivíduos reais com até 95% de fidelidade.

## 🚀 Principais Tecnologias (Stack v5.0)

* **Stack Visual:** @xyflow/react (Cérebro Editável) + Recharts (Forense)
* **IA Engine:** OpenRouter (Orquestração entre Gemini 2.0 Flash, Llama 3.3, e DeepSeek)
* **Arquitetura de Memória:** **ID-RAG** (Ancoragem por Grafo de Identidade) + Mem0
* **Segurança:** Protocolo Fortaleça (Neural Shield Alpha - Anti-Injeção)

## 🛠 Arquitetura OPME v3.0 (Forensic Singularity)

O motor neuro-simbólico do CognixOS opera em 5 camadas de alta resolução:

* **DNA Cognitivo Multi-Fase**: Ingestão profunda via esquadrão de 8 agentes especialistas.
* **Identity Chronicle (SNA)**: Mapeamento de Redes Semânticas para reconstruir o léxico mental.
* **Cérebro Editável (EMG-RAG)**: Interface visual para curadoria humana e poda de conexões espúrias.
* **ID-RAG Cognitive Anchoring**: Injeção de axiomas biográficos que forçam a coerência do clone.
* **Stylometry Core**: Assinatura sintática baseada em N-Grams e riqueza lexical (Hapax Ratio).

## 🔨 Como Rodar Localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/Joaofanis/CognixOS.git
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente (.env):
   ```env
   VITE_SUPABASE_URL=seu_url
   VITE_SUPABASE_ANON_KEY=sua_key
   ```

4. Inicie o servidor de desenvolvimento:
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
4. **Linguista**: Decodifica a sintaxe (N-Grams e Cadência).
5. **Cronista**: Tece a **Crônica de Identidade** (Grafo SNA de crenças e valores).
6. **Estrategista**: Forja cenários de teste (*Few-Shot scenarios*).
7. **Verificador**: Auditor de integridade analítica.
8. **Prompter**: Arquiteto do System Prompt Final.

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
* [x] OPME v3.0 Forensic Singularity
* [x] Identity Chronicle Visual Editor
* [x] ID-RAG Cognitive Anchoring
* [ ] Integração de Voz (Real-time Latency)
* [ ] Multi-modal Analysis (Análise de vídeos e imagens na ingestão)
* [ ] Cognix Marketplace (Compartilhamento seguro de Agents Skills)

---

## 📈 Potencial de Mercado

O CognixOS tem potencial para revolucionar setores como:

- **Educação**: Criação de clones digitais de professores com base em suas aulas reais.
- **Suporte Enterprise**: Esquadrões de agentes que seguem playbooks corporativos sem desvios de conduta.
- **Consultoria**: Automação de diagnósticos complexos usando esquadrões de especialistas sintéticos.

---

## 🏗️ Stack Tecnológica

* **Frontend**: React + Vite + Tailwind (Premium Design/Glassmorphism).
* **Engine**: Custom Agent-Squad Orchestrator (Multi-Provider Support).
* **Models**: Qwen 3.6 Plus, Llama 3.3 70B, Gemini 2.0 Flash Lite, MiniMax M2.5.
* **Retrieval**: Supabase `pgvector` + Jina AI (Web/YouTube Analysis).

---

© 2026 **CognixOS Project**. Built for the future of structured intelligence. Distributed under MIT License.

**Nota:** Este projeto é focado em **Engenharia de Prompt Industrial**. Aqui, o processo e a estrutura vêm antes da geração aleatória de texto. Bem-vindo à era do AIOS.
