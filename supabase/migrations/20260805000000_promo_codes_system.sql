-- Migration: Promo Codes System & User Paid Status Tracking
-- Date: 2026-08-05

-- 1. Add has_ever_paid column to public.profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'has_ever_paid'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN has_ever_paid BOOLEAN NOT NULL DEFAULT false;
    END IF;
END$$;

-- Retroactively set has_ever_paid = true for users who currently have active subscriptions or approved payments
UPDATE public.profiles
SET has_ever_paid = true
WHERE subscription_status = 'active'
   OR id IN (SELECT DISTINCT user_id FROM public.payments WHERE status = 'approved')
   OR id IN (SELECT DISTINCT user_id FROM public.subscriptions WHERE status = 'active');

-- 2. Add discount tracking columns to public.payments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payments' 
        AND column_name = 'discount_code'
    ) THEN
        ALTER TABLE public.payments ADD COLUMN discount_code TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payments' 
        AND column_name = 'discount_amount'
    ) THEN
        ALTER TABLE public.payments ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0.00;
    END IF;
END$$;

-- 3. Create public.promo_codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_percent INT NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  scope TEXT NOT NULL DEFAULT 'trial_only', -- 'trial_only', 'paid_only', 'all', 'specific_user'
  specific_user_email TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INT,
  times_used INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Insert default PRO20 discount code if it does not exist
INSERT INTO public.promo_codes (code, discount_percent, scope, is_active)
VALUES ('PRO20', 20, 'trial_only', true)
ON CONFLICT (code) DO NOTHING;

-- RLS Policies for promo_codes
DROP POLICY IF EXISTS "Anyone authenticated can view active promo codes" ON public.promo_codes;
CREATE POLICY "Anyone authenticated can view active promo codes" 
ON public.promo_codes FOR SELECT 
TO authenticated 
USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage all promo codes" ON public.promo_codes;
CREATE POLICY "Admins can manage all promo codes" 
ON public.promo_codes FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'sub-admin')
  )
);

-- Enable Realtime for promo_codes table
ALTER PUBLICATION supabase_realtime ADD TABLE public.promo_codes;
