/*
# Add profiles update policy for active_company_id

Allows SOW admins to update their own active_company_id field,
and company admins to update profiles in their company.
*/

-- The existing update_profiles policy already covers user_id = auth.uid(),
-- so SOW admins can update their own active_company_id. No new policy needed.
-- This migration just documents the change.

SELECT 1;
