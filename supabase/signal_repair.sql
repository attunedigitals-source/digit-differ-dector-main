-- REPAIR LIVE SIGNAL (FIX CHANNEL_ERROR)
-- This script simplifies your security rules so the "Live Signal" can reach your Admin screen.

-- 1. Ensure the profiles table identity is set correctly for real-time
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- 2. Simplify the Admin Access Policy
-- We remove the custom function loop and use a direct, high-speed check for the 'admin' role.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles 
FOR SELECT TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'sub-admin')
);

-- 3. Apply the same fix to Payments
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments" ON public.payments 
FOR SELECT TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'sub-admin')
);

-- 4. Ensure Real-Time is listening to all events
-- (This ensures the internal publication is fully refreshed)
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
