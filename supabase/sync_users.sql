-- SYNCHRONIZE MISSING USERS
-- This script finds users who signed up during the error period and adds them to the management list.

INSERT INTO public.profiles (id, email, role, subscription_status, timezone)
SELECT 
  id, 
  email, 
  'user', -- Default role
  'free', -- Default status
  'Africa/Lagos' -- Default timezone
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Also ensure they have a basic cloud-sync config
INSERT INTO public.user_configs (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_configs)
ON CONFLICT (user_id) DO NOTHING;
