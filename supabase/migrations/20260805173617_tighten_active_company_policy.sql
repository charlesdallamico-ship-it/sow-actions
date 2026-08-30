/*
# Tighten profiles update policy for active_company_id

Prevent non-SOW-admin users from setting active_company_id to a company
they don't belong to. SOW admins can set it freely. Other users can only
set it to their own company_id or null.
*/

-- The existing update policy allows user_id = auth.uid() which is correct.
-- We add a CHECK constraint via a trigger to prevent misuse of active_company_id.
-- For non-SOW admins, active_company_id must equal company_id or be null.

CREATE OR REPLACE FUNCTION enforce_active_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active_company_id IS NOT NULL AND NEW.active_company_id != NEW.company_id THEN
    -- Only SOW admins can have active_company_id different from company_id
    IF NEW.role != 'sow_admin' THEN
      NEW.active_company_id := NEW.company_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_active_company ON profiles;
CREATE TRIGGER trg_enforce_active_company
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_active_company();

REVOKE EXECUTE ON FUNCTION enforce_active_company() FROM anon;
