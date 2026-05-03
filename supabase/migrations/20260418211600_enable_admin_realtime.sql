-- Enable real-time for profiles and payments
-- This allows the Admin dashboard to update instantly on signups or payments
BEGIN;
  DO $$ 
  BEGIN
    -- Add profiles to replication if not already there
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;

    -- Add payments to replication if not already there
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'payments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
    END IF;
  END $$;
COMMIT;
