-- Migration to add Telegram integration fields to user profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_link_token UUID UNIQUE;
