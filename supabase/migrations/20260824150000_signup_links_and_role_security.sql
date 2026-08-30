-- ============================================================
-- Signup links (company_admin gera link de auto-cadastro com role definida)
-- + fecha brecha de auto-promoção de role/empresa em profiles
-- ============================================================

-- Helper: usuário atual é sow_admin OU é admin (company_admin/is_primary_admin) da empresa p_company_id
CREATE OR REPLACE FUNCTION is_company_admin_of(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT is_sow_admin() OR EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND company_id = p_company_id
      AND (role = 'company_admin' OR is_primary_admin = true)
  );
$$;
REVOKE EXECUTE ON FUNCTION is_company_admin_of(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION is_company_admin_of(uuid) TO authenticated;

-- ============ TABELA: signup_links ============
CREATE TABLE IF NOT EXISTS signup_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'responsible' CHECK (role IN ('company_admin','area_manager','responsible','viewer')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  label text,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_links_token ON signup_links(token);
CREATE INDEX IF NOT EXISTS idx_signup_links_company ON signup_links(company_id);

ALTER TABLE signup_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_signup_links" ON signup_links;
CREATE POLICY "select_signup_links" ON signup_links FOR SELECT
  TO authenticated USING (is_company_admin_of(company_id));

DROP POLICY IF EXISTS "insert_signup_links" ON signup_links;
CREATE POLICY "insert_signup_links" ON signup_links FOR INSERT
  TO authenticated WITH CHECK (is_company_admin_of(company_id));

DROP POLICY IF EXISTS "update_signup_links" ON signup_links;
CREATE POLICY "update_signup_links" ON signup_links FOR UPDATE
  TO authenticated USING (is_company_admin_of(company_id)) WITH CHECK (is_company_admin_of(company_id));

DROP POLICY IF EXISTS "delete_signup_links" ON signup_links;
CREATE POLICY "delete_signup_links" ON signup_links FOR DELETE
  TO authenticated USING (is_company_admin_of(company_id));

REVOKE ALL ON signup_links FROM anon;

-- ============ RPC: validar link (chamável sem login, só devolve o essencial) ============
CREATE OR REPLACE FUNCTION get_signup_link_info(p_token text)
RETURNS TABLE(company_name text, role text, department_name text, is_valid boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link signup_links%ROWTYPE;
BEGIN
  SELECT * INTO v_link FROM signup_links WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::text, false, 'Link inválido.'::text;
    RETURN;
  END IF;
  IF NOT v_link.active THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::text, false, 'Link desativado.'::text;
    RETURN;
  END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::text, false, 'Link expirado.'::text;
    RETURN;
  END IF;
  IF v_link.max_uses IS NOT NULL AND v_link.uses_count >= v_link.max_uses THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::text, false, 'Limite de cadastros deste link atingido.'::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.name, v_link.role, d.name, true, 'ok'::text
  FROM companies c
  LEFT JOIN departments d ON d.id = v_link.department_id
  WHERE c.id = v_link.company_id;
END;
$$;

REVOKE ALL ON FUNCTION get_signup_link_info(text) FROM public;
GRANT EXECUTE ON FUNCTION get_signup_link_info(text) TO anon, authenticated;

-- ============ RPC: resgatar link (usuário já autenticado via signUp, cria o profile) ============
CREATE OR REPLACE FUNCTION redeem_signup_link(p_token text, p_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link signup_links%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Este usuário já possui um perfil.';
  END IF;

  SELECT * INTO v_link FROM signup_links WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido.'; END IF;
  IF NOT v_link.active THEN RAISE EXCEPTION 'Link desativado.'; END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN RAISE EXCEPTION 'Link expirado.'; END IF;
  IF v_link.max_uses IS NOT NULL AND v_link.uses_count >= v_link.max_uses THEN RAISE EXCEPTION 'Limite de cadastros deste link atingido.'; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO profiles (user_id, company_id, full_name, email, role, department_id)
  VALUES (auth.uid(), v_link.company_id, p_full_name, v_email, v_link.role, v_link.department_id);

  UPDATE signup_links SET uses_count = uses_count + 1 WHERE id = v_link.id;
END;
$$;

REVOKE ALL ON FUNCTION redeem_signup_link(text, text) FROM public;
GRANT EXECUTE ON FUNCTION redeem_signup_link(text, text) TO authenticated;

-- ============================================================
-- Fecha a brecha: hoje QUALQUER usuário autenticado consegue se auto-inserir
-- ou se auto-atualizar em `profiles` com role='sow_admin' e/ou company_id
-- arbitrários, porque o WITH CHECK antigo aceitava user_id = auth.uid()
-- sem checar o valor de role/company_id.
-- ============================================================

DROP POLICY IF EXISTS "insert_profiles" ON profiles;
CREATE POLICY "insert_profiles" ON profiles FOR INSERT
  TO authenticated WITH CHECK (
    is_sow_admin()
    OR is_company_admin_of(company_id)
    OR (user_id = auth.uid() AND role = 'responsible' AND company_id IS NULL)
  );

-- UPDATE continua com a mesma visibilidade de antes (quem pode tocar na linha);
-- quem pode mudar role/company_id/is_primary_admin/active é decidido pelo trigger abaixo.
DROP POLICY IF EXISTS "update_profiles" ON profiles;
CREATE POLICY "update_profiles" ON profiles FOR UPDATE
  TO authenticated
  USING (is_sow_admin() OR company_id = my_company_id() OR user_id = auth.uid())
  WITH CHECK (is_sow_admin() OR company_id = my_company_id() OR user_id = auth.uid());

CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_sow_admin() THEN
    RETURN NEW;
  END IF;

  -- Admin da empresa (dona da linha antes do update) pode alterar, exceto promover a sow_admin
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND company_id = OLD.company_id
      AND (role = 'company_admin' OR is_primary_admin = true)
  ) THEN
    IF NEW.role = 'sow_admin' THEN
      RAISE EXCEPTION 'Apenas administradores SOW podem atribuir o papel sow_admin.';
    END IF;
    RETURN NEW;
  END IF;

  -- Auto-edição: pode mudar dados pessoais, nunca role/empresa/status/admin
  IF NEW.user_id = auth.uid() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.is_primary_admin IS DISTINCT FROM OLD.is_primary_admin
       OR NEW.active IS DISTINCT FROM OLD.active THEN
      RAISE EXCEPTION 'Você não tem permissão para alterar papel, empresa ou status da própria conta.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Sem permissão para atualizar este perfil.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_escalation();
