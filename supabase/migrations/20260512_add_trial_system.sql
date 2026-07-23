-- Add trial tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_duration_days INTEGER DEFAULT 7;

-- Add default trial duration to system settings if not exists
INSERT INTO public.system_settings (key, value)
VALUES ('default_trial_duration', '7')
ON CONFLICT (key) DO NOTHING;
