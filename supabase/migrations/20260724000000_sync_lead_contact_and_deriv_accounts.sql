-- Persist lead contact details and connected Deriv accounts across leads, profiles, and Auth metadata.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS rstate TEXT,
  ADD COLUMN IF NOT EXISTS lead_source TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS deriv_accounts JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  rstate TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  name TEXT,
  source TEXT NOT NULL DEFAULT 'organic_direct',
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true,
  deriv_loginid TEXT,
  deriv_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leads_email_key UNIQUE (email)
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
CREATE POLICY "Admins can view all leads" ON public.leads FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'sub-admin')
);

DROP POLICY IF EXISTS "Anyone can create leads" ON public.leads;
CREATE POLICY "Anyone can create leads" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update leads by email" ON public.leads;
CREATE POLICY "Anyone can update leads by email" ON public.leads FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.sync_profile_from_auth_metadata()
RETURNS trigger AS $$
DECLARE
  meta jsonb := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.profiles (id, email, role, subscription_status, timezone, full_name, phone)
  VALUES (
    new.id,
    new.email,
    CASE WHEN new.email = 'amusco2@yahoo.com' THEN 'admin'::public.user_role ELSE 'user'::public.user_role END,
    'free',
    'Africa/Lagos',
    COALESCE(meta->>'full_name', meta->>'name', meta->>'display_name'),
    COALESCE(meta->>'phone', meta->>'phone_number')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = now();

  UPDATE public.leads
  SET user_id = COALESCE(user_id, new.id::text),
      name = COALESCE(name, meta->>'full_name', meta->>'name', meta->>'display_name'),
      phone = COALESCE(phone, meta->>'phone', meta->>'phone_number'),
      updated_at = now()
  WHERE lower(email) = lower(new.email);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_auth_metadata();

DROP TRIGGER IF EXISTS on_auth_user_updated_sync_profile ON auth.users;
CREATE TRIGGER on_auth_user_updated_sync_profile
  AFTER UPDATE OF raw_user_meta_data, email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_auth_metadata();

UPDATE public.profiles p
SET full_name = COALESCE(p.full_name, l.name),
    phone = COALESCE(p.phone, l.phone),
    user_id = COALESCE(p.user_id, l.user_id),
    rstate = COALESCE(p.rstate, l.rstate),
    lead_source = COALESCE(p.lead_source, l.source),
    whatsapp_opt_in = COALESCE(p.whatsapp_opt_in, l.whatsapp_opt_in),
    deriv_loginid = COALESCE(p.deriv_loginid, l.deriv_loginid),
    deriv_accounts = CASE
      WHEN p.deriv_accounts IS NULL OR p.deriv_accounts = '[]'::jsonb THEN COALESCE(l.deriv_accounts, '[]'::jsonb)
      ELSE p.deriv_accounts
    END,
    updated_at = now()
FROM public.leads l
WHERE lower(p.email) = lower(l.email);

UPDATE auth.users u
SET raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object(
    'full_name', COALESCE(p.full_name, l.name),
    'name', COALESCE(p.full_name, l.name),
    'display_name', COALESCE(p.full_name, l.name),
    'phone', COALESCE(p.phone, l.phone),
    'phone_number', COALESCE(p.phone, l.phone),
    'deriv_loginid', COALESCE(p.deriv_loginid, l.deriv_loginid),
    'deriv_accounts', COALESCE(p.deriv_accounts, l.deriv_accounts)
  ))
FROM public.profiles p
LEFT JOIN public.leads l ON lower(l.email) = lower(p.email)
WHERE u.id = p.id;
