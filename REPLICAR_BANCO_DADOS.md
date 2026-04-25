# Guia de Replicação Supabase - CognixOS (AIOS v7.0)

Este guia fornece as instruções atualizadas para replicar o banco de dados e as edge functions em um novo projeto Supabase, incluindo as novas tabelas de Execução Durável (State Machines) e Memória (v7.0).

## 1. Configuração do Banco de Dados (SQL)

Abra o **SQL Editor** no seu painel do Supabase e execute os comandos abaixo.

### 1.1 Extensões e Enums necessários
```sql
-- Habilitar extensões
create extension if not exists "uuid-ossp";
create extension if not exists "vector" with schema "extensions";

-- Criar tipos
create type public.brain_type as enum ('person_clone', 'knowledge_base', 'philosophy', 'practical_guide');
```

### 1.2 Tabelas Principais (Estrutura OPME v2.0)
```sql
-- Tabela de Perfis
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  ai_settings jsonb default '{}'::jsonb, -- Configurações de Soberania (BYOK/Ollama)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela de Cérebros (Brains)
create table public.brains (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type public.brain_type default 'person_clone',
  name text not null,
  description text,
  tags text[] default '{}',
  system_prompt text,
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela de Textos (Base de Conhecimento)
create table public.brain_texts (
  id uuid default gen_random_uuid() primary key,
  brain_id uuid references public.brains on delete cascade not null,
  content text not null,
  source_type text default 'paste',
  file_name text,
  category text,
  rag_processed boolean default false,
  rag_summary text,
  rag_keywords text[],
  created_at timestamptz default now()
);

-- Tabela de Análise (Coração do OPME v2.0)
create table public.brain_analysis (
  id uuid default gen_random_uuid() primary key,
  brain_id uuid references public.brains on delete cascade unique not null,
  personality_traits jsonb default '{}'::jsonb,
  big_five jsonb default '{}'::jsonb, -- OCEAN
  hexaco jsonb default '{}'::jsonb,   -- OPME v2.0 Forensic
  forensic_stylometry jsonb default '{}'::jsonb, -- N-Grams & Lexical
  identity_chronicle jsonb default '{}'::jsonb, -- ID-RAG
  fidelity_scores jsonb default '{}'::jsonb, -- Eval4Sim
  disc_profile jsonb default '{}'::jsonb,
  cognitive_dna jsonb default '{}'::jsonb,
  communication_style jsonb default '{}'::jsonb,
  voice_patterns jsonb default '{}'::jsonb,
  signature_phrases jsonb[] default '{}',
  mbti text,
  enneagram text,
  updated_at timestamptz default now()
);

-- Conversas e Mensagens
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  brain_id uuid references public.brains on delete cascade not null,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations on delete cascade not null,
  role text check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- ==========================================
-- NOVO NA V7.0: ESTRATIFICAÇÃO DE MEMÓRIA (MemGPT Style)
-- ==========================================

-- 1. Core Memory (RAM do Agente)
create table public.memories (
  id uuid default gen_random_uuid() primary key,
  brain_id uuid references public.brains(id) on delete cascade,
  category varchar(50), 
  content text not null,
  importance int default 1,
  created_at timestamptz default now(),
  expires_at timestamptz,
  access_count int default 0
);

-- 2. Recall Storage (HD de Conversas Brutas)
create table public.conversation_logs (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null, 
  role varchar(20), 
  content text,
  token_count int,
  metadata jsonb,
  created_at timestamptz default now()
);

-- 3. Checkpointing de Execução Durável (Grafo de LangGraph)
create table public.agent_threads (
  id uuid default gen_random_uuid() primary key,
  brain_id uuid references public.brains(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  status varchar(30) default 'pending', -- pending, running, suspended_hitl, completed, failed
  goal text not null,
  checkpoint_state jsonb default '{}'::jsonb,
  last_node varchar(50),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==========================================
-- NOVO NA V7.0: SQUADS & VIRTUAL OFFICE
-- ==========================================

-- 1. Squads (Missões do Escritório Virtual)
create table public.squads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  challenge text,
  status text default 'planning',
  final_report text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 2. Subagentes (Unidades de Execução da Fábrica)
create table public.subagents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  squad_id uuid references public.squads(id) on delete set null,
  name text not null,
  role text not null,
  cloned_from text,
  system_prompt text,
  preferred_model text default 'google/gemini-1.5-flash',
  is_autonomous boolean default true,
  task_output text,
  status text default 'idle',
  created_at timestamptz default now()
);

-- 3. Mensagens de Squad (Comunicação entre Agentes)
create table public.squad_messages (
  id uuid default gen_random_uuid() primary key,
  squad_id uuid references public.squads(id) on delete cascade not null,
  sender_id uuid references public.subagents(id) on delete set null,
  receiver_id uuid references public.subagents(id) on delete set null,
  content text not null,
  type text default 'task', -- task, report, discussion
  created_at timestamptz default now()
);
```

## 2. Configurações de Segurança (RLS)

Ative o RLS em todas as tabelas e crie políticas básicas para que usuários só acessem seus próprios dados.

```sql
alter table public.profiles enable row level security;
alter table public.brains enable row level security;
alter table public.brain_texts enable row level security;
alter table public.brain_analysis enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Exemplo de política para 'brains'
create policy "Users can manage their own brains"
on public.brains for all using (auth.uid() = user_id);
```

## 3. Configuração de Variáveis de Ambiente (Vault)

As Edge Functions (analyze-brain, auto-clone, etc.) precisam de uma API Key para funcionar.

1. Vá para **Project Settings** > **Edge Functions**.
2. Adicione os seguintes segredros:
   - `OPENROUTER_API_KEY`: Sua chave do OpenRouter (pode ser gratuita).

## 4. Deploy das Edge Functions

Usando o Supabase CLI no seu terminal local:

```bash
# Login no Supabase
supabase login

# Deploy das funções
supabase functions deploy auto-clone --no-verify-jwt
supabase functions deploy analyze-brain --no-verify-jwt
supabase functions deploy generate-description --no-verify-jwt
supabase functions deploy process-rag --no-verify-jwt
supabase functions deploy virtual-office --no-verify-jwt
supabase functions deploy agent-squad --no-verify-jwt
```

> [!IMPORTANT]
> O uso do `--no-verify-jwt` é recomendado se você estiver lidando com autenticação customizada via `Authorization` header dentro da função (como fazemos no CognixOS), evitando erros 401 prematuros causados pelo middleware do Supabase.

## 5. Notas Importantes para o Plano Free

- **Conexões**: O plano gratuito tem limites de conexões simultâneas ao Postgres. O uso de Edge Functions ajuda a mitigar isso via pooling automático.
- **Logs**: Os logs de funções ficam salvos por apenas 7 dias no plano gratuito.
- **Dormência**: Se o projeto não for acessado por 1 semana, o banco de dados entrará em "Pausa". Basta abrir o painel do Supabase para reativá-lo.
