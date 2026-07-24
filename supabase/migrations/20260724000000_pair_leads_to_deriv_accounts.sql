-- Persist a deterministic link between registration details and Deriv OAuth callbacks.
-- The app sends oauth_states.rstate as the OAuth state value and consumes it when Deriv redirects back.

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  rstate TEXT,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  name TEXT,
  source TEXT DEFAULT 'organic_direct',
  whatsapp_opt_in BOOLEAN DEFAULT true,
  deriv_loginid TEXT,
  deriv_accounts TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  email TEXT NOT NULL UNIQUE,
  rstate TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS rstate TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'organic_direct';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT true;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deriv_loginid TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deriv_accounts TEXT[] DEFAULT '{}';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rstate TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deriv_loginid TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deriv_accounts TEXT[] DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS leads_email_unique_idx ON public.leads (email);
CREATE INDEX IF NOT EXISTS leads_deriv_loginid_idx ON public.leads (deriv_loginid);
CREATE INDEX IF NOT EXISTS leads_rstate_idx ON public.leads (rstate);
CREATE INDEX IF NOT EXISTS oauth_states_rstate_idx ON public.oauth_states (rstate);
