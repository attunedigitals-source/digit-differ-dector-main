-- DISASTER RECOVERY: EMERGENCY SIGNUP FIX
-- This script repairs the signup trigger to ensure new users can create accounts immediately.

-- 1. Redefine the function to be simple and robust
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
  
  -- Attempt to initialize user config as well
  INSERT INTO public.user_configs (user_id) 
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Last resort: ensure the user is at least created in auth
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-bind the trigger to the Auth system
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Ensure the profiles table is ready
DO $$ 
BEGIN
    ALTER TABLE public.profiles ALTER COLUMN timezone SET DEFAULT 'Africa/Lagos';
EXCEPTION WHEN OTHERS THEN 
    NULL; 
END $$;
