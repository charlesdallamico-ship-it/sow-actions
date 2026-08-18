/*
# Revoke anon execute on remaining SECURITY DEFINER functions
*/
REVOKE EXECUTE ON FUNCTION enforce_active_company() FROM anon;
REVOKE EXECUTE ON FUNCTION next_fact_code(uuid) FROM anon;
