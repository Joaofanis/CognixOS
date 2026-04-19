# 🗄️ Guia de Implantação do Banco de Dados (Supabase)

Como o **CognixOS** foi migrado para um formato aberto, quem for clonar o repositório precisará replicar o banco de dados. Este guia foi criado para usuários no modo "Free Tier" (plano gratuito) recriarem toda a estrutura de tabelas, funções e IA perfeitamente.

A infraestrutura utiliza o **Supabase** (PostgreSQL) com a extensão `pgvector` e Edge Functions.

---

## 1. Configurando o Projeto no Supabase
1. Crie uma conta gratuita em [Supabase.com](https://supabase.com).
2. Clique em **"New Project"**, escolha um nome (ex: `cognixos-db`) e crie uma senha forte (guarde-a bem).
3. Espere o banco terminar de provisionar (pode levar cerca de 2 minutos).
4. Vá em **Project Settings -> API** e copie dois dados vitais:
   - `Project URL`
   - `Project API Keys (anon / public)`

Na pasta na raiz do código (onde você fez o git clone), crie um arquivo `.env` baseado no `.env.example` e cole as chaves:

```env
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_ANON_KEY=sua_chave_aqui
```

---

## 2. Replicando todas as Tabelas (Supabase CLI)
Você não precisará criar tabelas manualmente! Todas as configurações, Políticas de Segurança (RLS) e a ativação da IA (PgVector) já estão prontas nos arquivos de "migration" dentro da pasta `/supabase/migrations`.

1. Instale o **Supabase CLI** no seu sistema. (Se já usa o `npm` basta utilizar o `npx`).
   Se precisar logar no CLI rode:
   ```bash
   npx supabase login
   ```

2. Vincule seu código local ao projeto remoto que acabou de criar:
   ```bash
   npx supabase link --project-ref "SEU_REFERENCE_ID"
   ```
   *(O "Reference ID" é aquela parte de letras da URL do seu projeto Supabase: `https://[ESTE_CODIGO].supabase.co`)*

3. Aplique (empurre) a estrutura do banco de dados:
   ```bash
   npx supabase db push
   ```
   > ✅ **Pronto!** A estrutura OPME v2.0 foi replicada. Suas tabelas (`brains`, `brain_analysis`, `subagents`, etc) com vetores e políticas restritas já foram criadas.

---

## 3. Provisionando a Inteligência (Edge Functions)
A "mágica" das criações de clone acontece totalmente isolada nos servidores do backend através das **Edge Functions**. Como é um projeto *Open-Source*, você precisa usar a sua própria chave de IA (OpenRouter).

1. Crie uma conta no [OpenRouter](https://openrouter.ai/) e pegue uma API Key gratuita.
2. Injeta essa chave como um "Segredo" direto no servidor do Supabase (para que as Edge Functions possam usá-la com segurança, sem expor no frontend):
   ```bash
   npx supabase secrets set OPENROUTER_API_KEY="sk-or-v1-SuaChaveAqui"
   ```
   *(Substitua pela sua chave real).*

3. Suba (Deploy) as suas Edge Functions de Inteligência:
   ```bash
   npx supabase functions deploy
   ```
   Isso vai garantir as rotas principais:
   - `auto-clone` (Esteira de Produção de DNA OPME v2.0)
   - `analyze-brain` (Biometria Psicométrica / Mapeamento DISC)
   - `brain-chat` (O cérebro sintético falando e buscando vetores - RAG)

---

## 4. Avisos Importantes de Segurança (RLS)
O banco foi configurado com **Row Level Security (RLS)**. As regras dizem que **apenas o criador do 'brain' pode editá-lo ou ler seus dados originais**. Isso significa que a privacidade do código foi modelada para ser o núcleo do CognixOS, permitindo que vários usuários criem clones independentemente sob a mesma instância sem visualizarem as "mentes digitais" uns dos outros.

---

## 5. Resumo Rápido para Rodar Localmente (DEV)

```bash
# 1. Clonar
git clone https://github.com/SeuGitHub/CognixOS.git && cd CognixOS
npm install

# 2. Conectar BD
npx supabase login
npx supabase link --project-ref [ID]
npx supabase db push

# 3. Chave de IA e Deploy Functions
npx supabase secrets set OPENROUTER_API_KEY="sk-..."
npx supabase functions deploy

# 4. Rodar o OS
npm run dev
```

Estará rodando em **`http://localhost:8080`**. Faça o seu primeiro login e bem-vindo à era das Mentes Sintéticas!
