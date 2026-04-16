
DROP POLICY "Anyone authenticated can insert signals" ON public.matches_signals;
CREATE POLICY "Users can insert their own signals" ON public.matches_signals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY "Anyone authenticated can insert results" ON public.signal_results;
CREATE POLICY "Users can insert results" ON public.signal_results FOR INSERT TO authenticated WITH CHECK (true);
