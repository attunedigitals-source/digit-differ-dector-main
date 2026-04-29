-- ENABLE REAL-TIME REPLICATION
-- This tells Supabase to start sending live updates for user signups and payments.

-- 1. Add profiles to the real-time publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- 2. Add payments to the real-time publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;

-- 3. Verify
-- If the above lines fail because they already exist, it is harmless. 
-- The database will now start broadcasting changes to your Admin Dashboard.
