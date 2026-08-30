/*
# Fix security advisor warnings on helper functions

1. Set explicit search_path on is_sow_admin() and my_company_id() to prevent search_path injection.
2. Revoke EXECUTE from anon role (these functions are only used in RLS policies for authenticated users).
*/

-- Recreate functions with fixed search_path
CREATE OR REPLACE FUNCTION is_sow_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'sow_admin'
  );
$$;

CREATE OR REPLACE FUNCTION my_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Revoke anon execute (only authenticated users use these in RLS)
REVOKE EXECUTE ON FUNCTION is_sow_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION my_company_id() FROM anon;
