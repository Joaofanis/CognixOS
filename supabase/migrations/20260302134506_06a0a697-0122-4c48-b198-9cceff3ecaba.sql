-- Add columns for RAG optimization on brain_texts
ALTER TABLE public.brain_texts 
ADD COLUMN IF NOT EXISTS rag_summary text,
ADD COLUMN IF NOT EXISTS rag_keywords text[],
ADD COLUMN IF NOT EXISTS rag_processed boolean DEFAULT false;

-- Create index for faster RAG lookups
CREATE INDEX IF NOT EXISTS idx_brain_texts_rag_processed ON public.brain_texts(brain_id, rag_processed);