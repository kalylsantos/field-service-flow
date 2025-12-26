-- Create a table for application secrets
CREATE TABLE IF NOT EXISTS public.app_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

-- Allow only authenticated users to read secrets
CREATE POLICY "Authenticated users can read app secrets"
ON public.app_secrets FOR SELECT
TO authenticated
USING (true);

-- Functions to manage secrets (for admin use)
CREATE OR REPLACE FUNCTION public.set_app_secret(secret_name TEXT, secret_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.app_secrets (name, value)
  VALUES (secret_name, secret_value)
  ON CONFLICT (name) DO UPDATE
  SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;
