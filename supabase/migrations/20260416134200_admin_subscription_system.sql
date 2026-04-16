-- ENUMS
CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'sub-admin');
CREATE TYPE public.subscription_status AS ENUM ('free', 'pending', 'active', 'expired', 'suspended');
CREATE TYPE public.plan_type AS ENUM ('1_month', '6_months', '12_months');

-- PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'user',
  subscription_status public.subscription_status NOT NULL DEFAULT 'free',
  subscription_expiry TIMESTAMP WITH TIME ZONE,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  device_id TEXT,
  last_login_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SUBSCRIPTIONS TABLE
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_type public.plan_type NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- PAYMENTS TABLE
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  plan_type public.plan_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  payment_method TEXT,
  proof_url TEXT, -- For optional screenshot upload
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- TRADES TABLE (LOGGING)
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deriv_loginid TEXT NOT NULL,
  symbol TEXT NOT NULL,
  stake DECIMAL(10, 2) NOT NULL,
  barrier INT NOT NULL,
  result TEXT NOT NULL, -- won, lost, pending
  profit_loss DECIMAL(10, 2),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- EMAIL LOGS
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  type TEXT NOT NULL, -- upgrade_reminder, expiring_soon, deactivated
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  plan_info JSONB
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Helper Function for Admin Check (Prevents Recursion)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'sub-admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS POLICIES

-- Profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (
  public.check_is_admin()
);
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (
  public.check_is_admin()
);
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Subscriptions
CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions FOR ALL TO authenticated USING (
  public.check_is_admin()
);
CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Payments
CREATE POLICY "Admins can manage all payments" ON public.payments FOR ALL TO authenticated USING (
  public.check_is_admin()
);
CREATE POLICY "Users can manage their own payments" ON public.payments FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Trades
CREATE POLICY "Admins can view all trades" ON public.trades FOR SELECT TO authenticated USING (
  public.check_is_admin()
);
CREATE POLICY "Users can own trades" ON public.trades FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Email Logs
CREATE POLICY "Admins can view all email logs" ON public.email_logs FOR SELECT TO authenticated USING (
  public.check_is_admin()
);


-- FUNCTIONS & TRIGGERS

-- Updated at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.email = 'amusco2@yahoo.com' THEN 'admin'::public.user_role 
      ELSE 'user'::public.user_role 
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Populate existing users if any
DO $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  SELECT id, email, 
    CASE 
      WHEN email = 'amusco2@yahoo.com' THEN 'admin'::public.user_role 
      ELSE 'user'::public.user_role 
    END
  FROM auth.users
  ON CONFLICT (id) DO NOTHING;
END $$;
