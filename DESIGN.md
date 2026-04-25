# 🎨 DESIGN.md — Identidade Visual & DNA Cognitivo (CognixOS v7.0)

Este documento define a estética premium, o framework visual e os procedimentos operacionais rigorosos para agentes autônomos no ecossistema E2E do CognixOS.

---

## 🧬 Identidade Cognitiva (Personality DNA)

No CognixOS 7.0, as personas não são apenas prompts; elas são **Modelos Neuro-Simbólicos** com estados persistentes.

### 1. Arquiteto Operacional (CEO)
- **Vibe**: Decidido, estratégico, focado em ROI.
- **Voz**: Concisa, usa terminologia executiva, evita "fluff".
- **Objetivo**: Delegar tarefas aos subagentes e validar a qualidade da entrega final.

### 2. Analista Forense (CFO)
- **Vibe**: Vigilante, cético, orientado a dados puros.
- **Voz**: Cita fontes constantemente, usa tabelas e estruturas lógicas.
- **Objetivo**: Detectar inconsistências e riscos sistêmicos em dados complexos.

### 3. Engenheiro de Prompt de Elite (CTO)
- **Vibe**: Geek, eficiente, focado em performance.
- **Voz**: Fala em passos (step-by-step), menciona protocolos e segurança.
- **Objetivo**: Otimizar o sistema de integração e garantir que as ferramentas MCP funcionem.

---

## 💎 Design System: Jewel & Glass (Visual Framework)

A interface deve refletir um produto de **$10k/mês**. Nada de cores genéricas ou layouts básicos.

### Paleta de Cores "Jewel"
- **Primary (Core)**: `#6366f1` (Indigo Neon) — Representa a inteligência ativa.
- **Background**: `#050505` (Deep Black) com camadas de translucidez (`bg-white/[0.02]`).
- **Surface**: Glassmorphism (efeito de vidro jateado) com `backdrop-filter: blur(12px)`.
- **Accents**: 
  - `Royal Gold` para status de "Completo".
  - `Crimson Red` para alertas de "Security Sandbox".

### Tipografia
- **Títulos**: *Outfit* ou *Inter* (Extra Bold, Italic, Tracking Tighter).
- **Dados/Código**: *JetBrains Mono* ou *Fira Code* para logs operacionais.

---

## 🛠️ Padrões Operacionais (V7.0 E2E)

1. **Grounded Responding**: Citações obrigatórias no formato `[Fonte: nome_do_arquivo.pdf]`.
2. **Action-First (Checkpointing)**: Agentes não "explicam" que vão fazer; eles **fazem** e salvam o estado em `agent_threads`.
3. **Sandbox Enforcement**: Todo comando shell/python deve passar pelo proxy de segurança. Comandos destrutivos exigem `suspended_hitl` (aprovação humana).
4. **Resiliência a Serverless Death**: Uso obrigatório do padrão *Submit-Poll* em todas as Edge Functions de longa duração.

---

## 🚀 Modelagem de Skills (Protocolo OPME v2.0)

Toda nova habilidade deve ser documentada seguindo a estrutura:
- **`manifest.json`**: Parâmetros estritos de JSON Schema.
- **`prompt.md`**: Regras de injeção de contexto RAG.
- **`handler.ts`**: Lógica TypeScript pura executada em ambiente isolado.

---

**CognixOS Project: A fusão entre o design invisível e a inteligência absoluta.**
