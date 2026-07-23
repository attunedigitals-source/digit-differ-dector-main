
-- Create user_deriv_tokens table
CREATE TABLE public.user_deriv_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deriv_api_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_deriv_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own token" ON public.user_deriv_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own token" ON public.user_deriv_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own token" ON public.user_deriv_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own token" ON public.user_deriv_tokens FOR DELETE USING (auth.uid() = user_id);

-- Create matches_signals table
CREATE TABLE public.matches_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  danger_digit INT NOT NULL CHECK (danger_digit >= 0 AND danger_digit <= 9),
  confidence FLOAT NOT NULL,
  valid_until_tick INT NOT NULL,
  tick_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.matches_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view signals" ON public.matches_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone authenticated can insert signals" ON public.matches_signals FOR INSERT TO authenticated WITH CHECK (true);

-- Create signal_results table
CREATE TABLE public.signal_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id UUID REFERENCES public.matches_signals(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  danger_digit INT NOT NULL CHECK (danger_digit >= 0 AND danger_digit <= 9),
  actual_digit INT NOT NULL CHECK (actual_digit >= 0 AND actual_digit <= 9),
  win BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.signal_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view results" ON public.signal_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone authenticated can insert results" ON public.signal_results FOR INSERT TO authenticated WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_signals_symbol ON public.matches_signals(symbol);
CREATE INDEX idx_signals_created ON public.matches_signals(created_at DESC);
CREATE INDEX idx_results_symbol ON public.signal_results(symbol);
CREATE INDEX idx_results_signal ON public.signal_results(signal_id);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_deriv_tokens_updated_at
  BEFORE UPDATE ON public.user_deriv_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
