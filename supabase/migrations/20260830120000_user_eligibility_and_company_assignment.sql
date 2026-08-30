-- Rastreia a origem e a elegibilidade de cada acesso.
-- A empresa só libera o usuário depois da confirmação do email e da atribuição explícita.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS registration_source text NOT NULL DEFAULT 'self_signup'
    CHECK (registration_source IN ('self_signup', 'signup_link', 'manual_invite', 'manual_assignment')),
  ADD COLUMN IF NOT EXISTS company_assignment_status text NOT NULL DEFAULT 'pending'
    CHECK (company_assignment_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by uuid;

UPDATE profiles
SET company_assignment_status = CASE WHEN company_id IS NULL THEN 'pending' ELSE 'approved' END,
    assigned_at = CASE WHEN company_id IS NULL THEN NULL ELSE COALESCE(assigned_at, created_at) END
WHERE company_assignment_status IS NULL
   OR (company_id IS NULL AND company_assignment_status = 'approved')
   OR (company_id IS NOT NULL AND company_assignment_status = 'pending');

ALTER TABLE profiles DISABLE TRIGGER USER;
UPDATE profiles p
SET email_confirmed_at = u.email_confirmed_at
FROM auth.users u
WHERE u.id = p.user_id AND p.email_confirmed_at IS NULL;
ALTER TABLE profiles ENABLE TRIGGER USER;

CREATE INDEX IF NOT EXISTS idx_profiles_assignment_status ON profiles(company_assignment_status);
CREATE INDEX IF NOT EXISTS idx_profiles_email_confirmed_at ON profiles(email_confirmed_at);

-- Leitura administrativa segura: auth.users só é consultável pelo backend, então a função
-- devolve o status real de confirmação junto com a empresa atualmente atribuída.
DROP FUNCTION IF EXISTS get_user_access_overview(uuid);
CREATE OR REPLACE FUNCTION get_user_access_overview(p_company_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid, user_id uuid, company_id uuid, company_name text,
  full_name text, email text, role text, department_id uuid, "position" text, phone text, active boolean,
  is_primary_admin boolean, email_confirmed_at timestamptz,
  registration_source text, company_assignment_status text,
  assigned_at timestamptz, assigned_by uuid, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
  v_company_id uuid;
BEGIN
  SELECT p.role, p.company_id INTO v_role, v_company_id
  FROM public.profiles p WHERE p.user_id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('sow_admin', 'company_admin') THEN
    RAISE EXCEPTION 'Sem permissão para consultar usuários.';
  END IF;
  IF v_role = 'company_admin' AND (p_company_id IS NULL OR p_company_id <> v_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta empresa.';
  END IF;

  RETURN QUERY
  SELECT p.id, p.user_id, p.company_id, c.name, p.full_name, p.email, p.role,
         p.department_id, p.position, p.phone, p.active, p.is_primary_admin, u.email_confirmed_at, p.registration_source,
         p.company_assignment_status, p.assigned_at, p.assigned_by, p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  LEFT JOIN public.companies c ON c.id = p.company_id
  WHERE (p_company_id IS NULL OR p.company_id = p_company_id)
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_user_access_overview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_access_overview(uuid) TO authenticated;

-- Único caminho para atribuição manual por um administrador SOW.
CREATE OR REPLACE FUNCTION assign_pending_user(
  p_profile_id uuid, p_company_id uuid, p_role text DEFAULT 'responsible'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_role text;
  v_user_id uuid;
  v_email_confirmed_at timestamptz;
  v_role text := CASE WHEN p_role IN ('company_admin','area_manager','responsible','viewer') THEN p_role ELSE 'responsible' END;
BEGIN
  SELECT role INTO v_actor_role FROM public.profiles WHERE user_id = auth.uid();
  IF v_actor_role <> 'sow_admin' THEN RAISE EXCEPTION 'Apenas administradores SOW podem fazer esta atribuição.'; END IF;
  SELECT user_id INTO v_user_id FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado.'; END IF;
  SELECT email_confirmed_at INTO v_email_confirmed_at FROM auth.users WHERE id = v_user_id;
  IF v_email_confirmed_at IS NULL THEN RAISE EXCEPTION 'O usuário precisa confirmar o email antes da atribuição.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND status IN ('active','trial')) THEN
    RAISE EXCEPTION 'Empresa inexistente, inativa ou suspensa.';
  END IF;

  UPDATE public.profiles
  SET company_id = p_company_id, role = v_role, active = true,
      email_confirmed_at = v_email_confirmed_at,
      registration_source = 'manual_assignment',
      company_assignment_status = 'approved', assigned_at = now(), assigned_by = auth.uid()
  WHERE id = p_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION assign_pending_user(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assign_pending_user(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION redeem_signup_link(p_token text, p_full_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_link signup_links%ROWTYPE; v_email text; v_confirmed_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT email, email_confirmed_at INTO v_email, v_confirmed_at FROM auth.users WHERE id = auth.uid();
  IF v_confirmed_at IS NULL THEN RAISE EXCEPTION 'Confirme o email antes de concluir o cadastro.'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'Este usuário já possui um perfil.'; END IF;
  SELECT * INTO v_link FROM signup_links WHERE token = p_token FOR UPDATE;
  IF NOT FOUND OR NOT v_link.active OR (v_link.expires_at IS NOT NULL AND v_link.expires_at < now()) OR (v_link.max_uses IS NOT NULL AND v_link.uses_count >= v_link.max_uses) THEN
    RAISE EXCEPTION 'Link inválido, expirado, desativado ou sem usos disponíveis.';
  END IF;
  INSERT INTO profiles (user_id, company_id, full_name, email, role, department_id, email_confirmed_at, registration_source, company_assignment_status, assigned_at)
  VALUES (auth.uid(), v_link.company_id, p_full_name, v_email, v_link.role, v_link.department_id, v_confirmed_at, 'signup_link', 'approved', now());
  UPDATE signup_links SET uses_count = uses_count + 1 WHERE id = v_link.id;
END; $$;
REVOKE ALL ON FUNCTION redeem_signup_link(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_signup_link(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION assign_pending_user(uuid, uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION get_user_access_overview(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION redeem_signup_link(text, text) FROM anon, PUBLIC;
