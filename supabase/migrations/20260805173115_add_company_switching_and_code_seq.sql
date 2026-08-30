/*
# Add company assignment support and code sequence

1. Add `active_company_id` column to profiles so SOW admins can track which company
   they are currently viewing/working on. This is separate from their own company_id
   (null for SOW admins) and used by the frontend to scope data.
2. Create a sequence for generating unique fact codes per company.
3. Add a SECURITY DEFINER function to create users with profiles (called from edge function).
4. Add a function to get the next fact code for a company.
*/

-- Add active_company_id to profiles for SOW admin company switching
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

-- Update the my_company_id() helper to consider active_company_id
CREATE OR REPLACE FUNCTION my_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT active_company_id FROM profiles WHERE user_id = auth.uid()),
    (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  );
$$;

-- Function to generate next fact code for a company
CREATE OR REPLACE FUNCTION next_fact_code(company_uuid uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 'FATO-' || lpad((count(*) + 1)::text, 4, '0')
  FROM facts
  WHERE company_id = company_uuid;
$$;

-- Revoke anon execute on new function
REVOKE EXECUTE ON FUNCTION next_fact_code(uuid) FROM anon;
