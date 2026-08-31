-- Usuários comuns sempre entram por convite/link com empresa definida.
-- A exceção controlada é o self-signup pendente, que aguarda atribuição.
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS can_manage_users boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_company_binding_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_company_binding_check CHECK (
  company_id IS NOT NULL
  OR (company_assignment_status = 'pending' AND registration_source = 'self_signup')
);

REVOKE ALL ON public.user_permissions FROM anon;
