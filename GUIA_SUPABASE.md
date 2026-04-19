# 🗄️ Guia de Implantação e Replicação (Supabase 4.0)

Este guia é o manual definitivo para clonar e replicar a infraestrutura do **CognixOS 4.0** em um novo projeto Supabase.

---

## 1. Preparação (Supabase Cloud)

1. Crie um projeto em [Supabase.com](https://supabase.com).
2. Vá em **Project Settings -> API** e obtenha sua `URL` e `anon key`.
3. Configure seu arquivo local `.env`:

   ```env
   VITE_SUPABASE_URL=seu_url_aqui
   VITE_SUPABASE_ANON_KEY=sua_chave_aqui
   ```

---

## 2. Replicação Automática do Banco (CLI)

O CognixOS 4.0 utiliza migrações estruturadas para garantir que o banco seja idêntico ao original.

1. **Login e Link**:

   ```bash
   npx supabase login
   npx supabase link --project-ref "SEU_REF_ID"
   ```

2. **Empurrar Estrutura (SNA Cognitivo + Soberania)**:

   ```bash
   npx supabase db push
   ```

   > 💡 Este comando cria automaticamente todas as tabelas (`brains`, `profiles`, `subagents`, `messages`) e ativa as extensões `pgvector` e `uuid-ossp`.

---

## 3. Configuração de Variáveis Sensíveis (Secrets)

Para que as funções de IA e Telegram funcionem, você precisa injetar suas chaves privadas no cofre (Vault) do Supabase:

```bash
# Necessário para IA Cloud (Gemini, Llama, etc)
npx supabase secrets set OPENROUTER_API_KEY="sk-or-v1-..."

# Necessário para a Ponte Telegram
npx supabase secrets set TELEGRAM_BOT_TOKEN="seu_token_do_botfather"
```

---

## 4. Deploy de Edge Functions (IA e Webhooks)

Suba o código das funções para o servidor:

```bash
npx supabase functions deploy auto-clone --no-verify-jwt
npx supabase functions deploy brain-chat --no-verify-jwt
npx supabase functions deploy analyze-brain --no-verify-jwt
npx supabase functions deploy telegram-webhook --no-verify-jwt
```

### 🛰️ Ativando o Webhook do Telegram

Após o deploy da função `telegram-webhook`, você deve registrar a URL no Telegram:

```bash
# Execute este comando (substituindo os valores)
curl "https://api.telegram.org/bot<SEU_TOKEN>/setWebhook?url=https://<SEU_PROJECT_ID>.functions.supabase.co/telegram-webhook"
```

---

## 5. Resumo da Estrutura 4.0

O banco replicado inclui as seguintes melhorias da versão 4.0:

1. **Tabela `profiles`**: Novos campos para persistência de tokens Telegram e configurações de Soberania (BYOK/Local).
2. **Segurança (RLS)**: Todas as tabelas possuem Políticas de Segurança de Nível de Linha ativas, garantindo que usuários nunca vejam clones ou configurações de terceiros.

---

**Pronto!** Seu backend está agora espelhado com o motor oficial do CognixOS 4.0.
