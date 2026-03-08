-- Fix: restrict ai_health_logs to authenticated users only
DROP POLICY IF EXISTS "Users can view health logs" ON public.ai_health_logs;
CREATE POLICY "Authenticated users can view health logs"
  ON public.ai_health_logs
  FOR SELECT
  TO authenticated
  USING (true);