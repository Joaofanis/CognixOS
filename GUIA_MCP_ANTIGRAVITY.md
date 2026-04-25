# 🔌 Guia Completo: MCP Gateway & Antigravity Kit (CognixOS 7.0)

Este guia cobre a nova arquitetura extensível E2E do CognixOS, permitindo que seus clones conectem-se a ferramentas externas e operem de forma durável usando o **Model Context Protocol (MCP)** e o **Antigravity Kit**.

---

## 1. O que é o Universal MCP Gateway?

O MCP (Model Context Protocol) é um padrão aberto que permite que IAs (como os clones do CognixOS) acessem com segurança fontes de dados e ferramentas externas. O **Universal MCP Gateway** do CognixOS facilita a conexão de *qualquer* servidor MCP aos seus agentes.

### Métodos de Registro

No **MCP Hub** (`/mcp-hub` na interface), você pode adicionar novos servidores usando três abordagens:

1. **Manual**: Preencha manualmente o nome, categoria, tipo de transporte (SSE, HTTP, Stdio, WebSocket) e URL do servidor MCP.
2. **Importação Rápida por URL**: Insira a URL de um manifesto MCP válido (JSON). O sistema irá descobrir automaticamente as ferramentas e parâmetros disponíveis.
3. **Upload de Arquivos**: Arraste e solte arquivos `SKILL.md` (conhecimento estático) ou `manifest.json` para carregar metadados e instruções.

### Como Vincular um MCP a um Clone

Não basta registrar um MCP; ele precisa ser ativado para um cérebro (clone) específico.

1. Navegue até a tela principal do seu Cérebro e acesse as **Configurações (Brain Settings)**.
2. Role até a seção **Integrações MCP (Ferramentas Externas)**.
3. Você verá o painel *Elite Specialist Squad*. Clique em **Vincular** no MCP que deseja disponibilizar para esse clone.
4. **NOVO NA V7.0 (Native StructOut):** O clone não precisa mais "adivinhar" tags XML no chat para disparar ações. A Edge Function mapeará diretamente suas ferramentas vinculadas para os parâmetros nativos B2B de `tools:` e `tool_choice: auto` em Strict Mode. Isso liquida as alucinações sintáticas.

---

## 2. O Antigravity Kit (Squad de Especialistas)

O Antigravity Kit transforma a plataforma, trazendo um "Esquadrão de Elite" de arquétipos de sistemas e conhecimentos diretos da comunidade.

Ele consiste em:
- **20 Agent Templates**: Perfis de especialistas (ex: Orchestrator, Security Auditor, Frontend Specialist).
- **Mais de 36 Skill Templates**: Módulos granulares de conhecimento e metodologias (ex: Next.js Best Practices, TDD Workflow).

### Usando Agent Templates (Personas)

Ao selecionar um template de agente nas configurações do clone:
- **Merge, não Overwrite**: O template selecionado não apaga o *System Prompt* personalizado que você definiu. Em vez disso, ele é **mesclado**. O clone mantém sua "voz" e características (o DNA clonado do usuário raiz), mas adquire o vocabulário, protocolos e objetivos específicos do arquétipo escolhido.
- **Auto-Skills**: Cada agente vem pré-configurado com habilidades (*skills*). Por ex., o *Frontend Specialist* já inclui compreensão sobre *React Patterns* e *Tailwind*.

### Usando Skills Personalizadas
- O sistema agora suporta **Skills de Usuário**. Você mesmo pode criar novos `SKILL.md` customizados e fazer o upload via MCP Hub, treinando os seus clones com metodologias privadas da sua empresa (BYOK - Bring Your Own Knowledge).

---

## 3. Segurança e Execução Local vs Nuvem

O Gateway é projetado para operar com total segurança (Sovereignty).

- **Isolamento de Secrets**: Credenciais de MCPs externos nunca são expostas na interface frontend (browser). O backend (Supabase Edge Functions) atua como um proxy seguro.
- **Transportes**: 
  - Para MCPs na Web, use **SSE** ou **HTTP**.
  - O CognixOS também prevê transporte **Stdio** para cenários onde a plataforma roda em ambiente desktop/local.
- **Roteamento Controlado**: Cada chamada de ferramenta feita pela IA é gravada e isolada por politicas de segurança em nível de linha (RLS). Nenhuma tabela MCP pode ser acessada por outro usuário.
- **Sandbox Executor (V7.0)**: Execuções potencialmente destrutivas operam via proxy em microVMs. Se o `sandbox-executor` intercepta comandos hostis (`rm -rf`, `drop table`), o loop E2E é trancado mudando o estado no DB para `suspended_hitl`. Um humano deve aprová-lo via Log Audits para destravar a *Agent Thread*.

---

## 4. Deploy: Como Popular o Antigravity Kit (via Script)

Se você acabou de fazer o deploy do CognixOS, o banco de dados estará vazio. Para carregar todos os 20 agentes e 36 skills no sistema, rode o Seed Script disponibilizado:

1. Certifique-se de que o diretório `.agent` do Antigravity Kit esteja na máquina (normalmente na raiz ou ao lado do repositório).
2. Execute o comando:

```bash
SUPABASE_URL=https://seu_projeto.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key \
node scripts/seed-antigravity-kit.mjs
```

3. Verifique o resultado abrindo o **Mcp Hub** e as configurações do seu Cérebro. Os novos arquétipos já estarão disponíveis no menu dropdown.
