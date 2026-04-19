-- Migration to add AI configuration settings to user profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT '{
  "active_provider": "system",
  "custom_openrouter_key": null,
  "local_ai_endpoint": "http://localhost:11434"
}'::jsonb;
