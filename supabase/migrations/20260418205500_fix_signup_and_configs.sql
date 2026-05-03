-- 1. Create the Config table for data backup and retrieval
CREATE TABLE IF NOT EXISTS public.user_configs (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{"enabled":false,"stake":0.35,"selectedSymbols":[],"minConfidence":0.8,"useRandomDigits":false}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policy for user_configs
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can manage their own config" ON public.user_configs;
    CREATE POLICY "Users can manage their own config" ON public.user_configs FOR ALL TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN 
    NULL; 
END $$;

-- 2. Repair the signup trigger
-- We ensure the insert handles the current profiles schema correctly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, subscription_status, timezone)
  VALUES (
    new.id, 
    new.email, 
    'user',
    'free',
    'Africa/Lagos'
  );

  -- Initialize cloud-sync config for the new user
  INSERT INTO public.user_configs (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
