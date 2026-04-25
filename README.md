# 🧠 CognixOS — Autonomous Agent OS (v7.0)

## 🛡️ The Autonomous Agent Paradigm

[![Deployment](https://img.shields.io/badge/Status-Production-brightgreen?logo=vercel)](https://cognix-os.vercel.app/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-blue?logo=supabase)](https://supabase.com/)
[![Protocol](https://img.shields.io/badge/Protocolo-OPME%20v7.0-blueviolet)](https://github.com/Joaofanis/CognixOS)
[![Sovereignty](https://img.shields.io/badge/Soberania-BYOK--Local-orange)](https://github.com/Joaofanis/CognixOS)
[![E2E](https://img.shields.io/badge/E2E-Durable%20Execution-green)](https://github.com/Joaofanis/CognixOS)

---

## 🌌 Visão Geral: De Chatbots a Execução Autônoma E2E

O **CognixOS 7.0** marca a transição definitiva de projetos acadêmicos para produtos B2B de classe mundial. O framework abandona as limitações críticas de LLMs (como Content Collapse, Serverless Death e Tool Hallucinations) adotando uma verdadeira arquitetura E2E (End-to-End). 

Nossos clones operam agora como **Agentes Assíncronos Duráveis**, dotados de paginação de memória e isolamento seguro de hardware para automações corporativas sensíveis.

---

## 🧬 Novos Pilares do Paradigma 7.0

### 1. Hierarquia de Memória Virtual (MemGPT Style)
O Gargalo do *Context Collapse* acabou. O agente gerencia proativamente sua janela de contexto escrevendo e puxando registros entre:
- **Core Memory** (`memories`): A RAM do agente (Identity, Facts, Preferences).
- **Recall Storage** (`conversation_logs`): O HD do agente, acessado remotamente por busca estruturada, dispensando empilhar 100 mensagens na API.

### 2. Strict Native Tool Calling
Fim do *Blind Tool Calling*. Não usamos mais _prompt injection_ (Tags Regex) suscetíveis à alucinações. 
- O CognixOS força os LLMs via **Strict Structured Outputs** diretamente no payload das APIs (OpenRouter, OpenAI). A falha no formato da ferramenta é bloqueada matematicamente pelo JSON Schema antes de quebrar a lógica.

### 3. Execução Durável (Durable Loop Machine)
O *Serverless Death* (Timeouts da Edge Function após 15s) foi mitigado pelo padrão **Submit-Poll**:
- A invocação do Agente abre uma Thread (`agent_threads`). 
- Um cron worker processa chamadas LLM e salva os **Checkpoints** de Raciocínio (LangGraph-style).
- O agente pode rodar por dias, adormecendo e acordando sem perder a cadeia de raciocínio.

### 4. Sandbox Executor e HITL (Segurança)
Para operações corporativas B2B sensíveis (ex: Deletar repositórios, disparar e-mails em massa), as intenções brutas cruzam o `sandbox-executor`.
- **E2E Isolation**: Envia chamadas bash/python para microVMs (Firecracker/gVisor).
- **HITL (Human-in-the-Loop)**: Se o agente tentar um comando restrito, o Sandbox suspende o loop no DB e solicita autorização manual (Suspend-and-Review).

### 6. Universal MCP Gateway & Omnichannel

Conecte **qualquer ferramenta externa** aos seus clones:
| Método | Como funciona |
| :--- | :--- |
| **Manual** | Formulário com nome, emoji, transporte (SSE/HTTP/WebSocket/Stdio) |
| **Ponte** | Native Whatsapp, MS Teams e Slack via webhooks gateway |

**Os templates MESCLAM com a personalidade existente** — seu clone mantém sua voz e identidade única, mas ganha os conhecimentos e protocolos do especialista selecionado.

### 4. Soberania de IA: BYOK & Local First

* **BYOK (Bring Your Own Key)**: Conecte sua própria API Key do OpenRouter diretamente no painel.
* **IA Local (Ollama)**: Execute modelos 100% offline em sua máquina com privacidade absoluta.

### 5. Sincronização Física de Dados

Utilizando a **File System Access API**, o CognixOS salva histórico de chat diretamente no sistema de arquivos do seu computador. Seus dados sob seu controle direto.

### 6. Telegram Bridge (Omnichannel)

Conecte seus clones ao mundo real via Telegram, enviando áudios e textos para processamento remoto.

---

## 🕵️ O Esquadrão de Clonagem (8-Core)

O processo de clonagem é executado por uma sequência determinística de 8 agentes especializados:

1. **Pesquisador**: Mineração de fatos e cronologia bruta.
2. **Analista**: Mapeamento de perfil técnico e domínios de conhecimento.
3. **Psicanalista**: Extração do *Shadow DNA* e motivações latentes.
4. **Linguista**: Decodificação de sintaxe, n-grams e cadência rítmica.
5. **Cronista**: Tecelagem da Crônica de Identidade (Grafo SNA).
6. **Estrategista**: Forjamento de cenários de teste de estresse psicológico.
7. **Verificador**: Auditoria de integridade analítica e lógica epistêmica.
8. **Prompter**: Arquiteto final do DNA Neural (System Prompt).

---

## 🏗️ Arquitetura V7.0

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vite + React)                  │
│  Setup Wizard │ Omni Dashboard │ Graph Visualizer │ Setup Hub   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                       │
│                                                                  │
│  [API Endpoint]      [Worker (pg_cron)]   [Security Proxy]       │
│  brain-chat ──────── autonomous-loop ──── sandbox-executor       │
│      │                    │                           │          │
│      ├─ Native StructOut  ├─ State Checkpointing      ├─ HITL    │
│      ├─ BYOK Routing      ├─ MemGPT Paging            ├─ E2E OS  │
│      └─ Squad Overlay     └─ Durable Loop             └─ Limits  │
│                                                                  │
│  channel-webhooks    seed-database        auto-clone            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                      SUPABASE (PostgreSQL)                       │
│                                                                  │
│  memories │ conversation_logs │ agent_threads │ brains           │
│  mcp_registry │ brain_mcp_links │ agent_templates               │
│  skill_templates │ profiles │ security_audit_logs                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Banco de Dados V7.0

### Tabelas Centrais de Orquestração

| Tabela | Função | Propósito |
| :--- | :--- | :--- |
| `memories` | RAM do Agente | Core context com TTL e importance scoring. |
| `conversation_logs` | HD do Agente | Recall bruto. Logs descartáveis que não afogam o context. |
| `agent_threads` | Checkpoints | Grafo de estado do agente (`pending`, `running`, `hitl`). |
| `brains` | Sistema Base | Cérebros (clones) com system prompt, tipo e template. |
| `mcp_registry` | Hub | Registro universal de servidores MCP por usuário. |
| `profiles` | Contas | Perfil do usuário com BYOK (Bring Your Own Key) vault. |

---

## 🛠️ Instalação e Ativação

### 1. Pré-requisitos

* **Node.js 18+** (Ambiente de execução)
* **Supabase CLI** (Para gerenciar o banco de dados e Edge Functions)
* **Ollama** (Opcional, para soberania local)

### 2. Setup Rápido

```bash
# Clone o ecossistema
git clone https://github.com/Joaofanis/CognixOS.git
cd CognixOS

# Instale as dependências
npm install

# Inicie o modo dev
npm run dev
```

### 3. Configuração do Backend

O CognixOS exige uma infraestrutura Supabase configurada com `pgvector` para a memória vetorial.

👉 **[Guia Completo de Implantação Supabase](./GUIA_SUPABASE.md)**

### 3. Soberania e Novas Funções

Aprenda a configurar a IA Local (Ollama), Sincronização Física, BYOK e Telegram:
👉 **[Guia de Configuração CognixOS](./GUIA_SOBERANIA_4.0.md)**

### 4. Setup Gráfico do Antigravity Kit (V6.0+)
Esqueça comandos no terminal. Acesse a rota visual de Setup no navegador para injetar o framework no DB:
Acesse: `/setup` no webapp.

---

## 🔌 Guia Rápido: MCP Hub

1. Acesse `/mcp-hub` no painel
2. Clique em **"Adicionar MCP"**
3. Escolha o método: **Manual**, **URL**, ou **Upload**
4. Após registrar, vá em **Brain Settings** → **Integrações MCP**
5. Clique em **"Vincular"** para conectar o MCP ao cérebro
6. Converse com o clone — ele agora conhece e pode invocar as ferramentas

---

## 🛡️ Segurança: Neural Shield Alpha

* **Lógica Epistêmica**: O agente sabe **o porquê** sabe, gerando auditorias de raciocínio justificadas.
* **Prompt Armor**: Proteção multicamada contra ataques de injeção de prompt e jailbreaks.
* **Data Sovereignty**: Políticas rigorosas de RLS (Row Level Security) em todas as tabelas.
* **MCP Sandbox**: Secrets de MCP armazenados com isolamento por usuário, nunca expostos ao frontend.
* **Audit Logging**: Toda invocação de ferramenta MCP é registrada em `security_audit_logs`.

---

## 📈 Potencial Disruptivo

O CognixOS é a ferramenta definitiva para:

* **Imortalidade Digital**: Preservação de legados intelectuais.
* **Educação Hiper-Personalizada**: Clones de professores reais que ensinam com sua metodologia exata.
* **Enterprise Sovereignty**: Agentes corporativos que seguem playbooks rígidos sem alucinações.
* **Dev Automation**: Clones que operam como squads de desenvolvimento com skills especializadas e ferramentas MCP reais.

---

## 📁 Estrutura do Projeto

```
CognixOS/
├── src/
│   ├── components/          # React components
│   │   ├── McpRegistryPanel.tsx   # MCP management UI
│   │   ├── BrainSettings.tsx      # Settings with MCP + Squad
│   │   └── ...
│   ├── pages/
│   │   ├── McpHub.tsx             # /mcp-hub route
│   │   ├── Dashboard.tsx          # Main dashboard
│   │   └── ...
│   └── hooks/                # Custom hooks
├── supabase/
│   └── functions/
│       ├── brain-chat/       # Main AI chat (RAG + MCP + Templates)
│       ├── mcp-gateway/      # Universal MCP proxy
│       ├── specialist-executor/  # Execution engine
│       └── ...
├── scripts/
│   └── seed-antigravity-kit.mjs  # Populate agent + skill templates
├── DESIGN.md                 # Cognitive DNA & visual identity
└── README.md                 # This file
```

---

© 2026 **CognixOS Project**. Onde o conhecimento encontra a imortalidade digital.
*Distributed under MIT License.*
