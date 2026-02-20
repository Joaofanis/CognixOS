
-- Create brain type enum
CREATE TYPE public.brain_type AS ENUM ('person_clone', 'knowledge_base', 'philosophy', 'practical_guide');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Create brains table
CREATE TABLE public.brains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.brain_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brains" ON public.brains FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create brain_texts table
CREATE TABLE public.brain_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id UUID NOT NULL REFERENCES public.brains(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'paste', -- paste, file_upload
  file_name TEXT,
  category TEXT, -- auto-categorized by AI
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brain_texts ENABLE ROW LEVEL SECURITY;

-- Helper function to check brain ownership
CREATE OR REPLACE FUNCTION public.is_brain_owner(p_brain_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brains WHERE id = p_brain_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "Users manage own brain texts" ON public.brain_texts FOR ALL
  USING (public.is_brain_owner(brain_id))
  WITH CHECK (public.is_brain_owner(brain_id));

-- Create brain_analysis table
CREATE TABLE public.brain_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id UUID NOT NULL REFERENCES public.brains(id) ON DELETE CASCADE UNIQUE,
  personality_traits JSONB DEFAULT '{}', -- radar chart data
  frequent_themes JSONB DEFAULT '[]', -- bar chart data
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brain_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own brain analysis" ON public.brain_analysis FOR SELECT
  USING (public.is_brain_owner(brain_id));
CREATE POLICY "Users manage own brain analysis" ON public.brain_analysis FOR ALL
  USING (public.is_brain_owner(brain_id))
  WITH CHECK (public.is_brain_owner(brain_id));

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id UUID NOT NULL REFERENCES public.brains(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversations" ON public.conversations FOR ALL
  USING (public.is_brain_owner(brain_id))
  WITH CHECK (public.is_brain_owner(brain_id));

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check conversation ownership
CREATE OR REPLACE FUNCTION public.is_conversation_owner(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    JOIN public.brains b ON b.id = c.brain_id
    WHERE c.id = p_conversation_id AND b.user_id = auth.uid()
  );
$$;

CREATE POLICY "Users manage own messages" ON public.messages FOR ALL
  USING (public.is_conversation_owner(conversation_id))
  WITH CHECK (public.is_conversation_owner(conversation_id));

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_brains_updated_at BEFORE UPDATE ON public.brains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_brain_analysis_updated_at BEFORE UPDATE ON public.brain_analysis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for brain file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('brain-files', 'brain-files', false);

CREATE POLICY "Users can upload brain files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'brain-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own brain files" ON storage.objects FOR SELECT
  USING (bucket_id = 'brain-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own brain files" ON storage.objects FOR DELETE
  USING (bucket_id = 'brain-files' AND auth.uid()::text = (storage.foldername(name))[1]);
