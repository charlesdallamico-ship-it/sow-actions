-- Permite que um cadastro próprio pendente seja concluído pelo link da empresa.
-- Isso evita duplicidade no Auth e mantém a atribuição de empresa explícita.

CREATE OR REPLACE FUNCTION redeem_signup_link(p_token text, p_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_link signup_links%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_email text;
  v_confirmed_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT email, email_confirmed_at INTO v_email, v_confirmed_at FROM auth.users WHERE id = auth.uid();
  IF v_confirmed_at IS NULL THEN RAISE EXCEPTION 'Confirme o email antes de concluir o cadastro.'; END IF;

  SELECT * INTO v_link FROM signup_links WHERE token = p_token FOR UPDATE;
  IF NOT FOUND OR NOT v_link.active OR (v_link.expires_at IS NOT NULL AND v_link.expires_at < now())
     OR (v_link.max_uses IS NOT NULL AND v_link.uses_count >= v_link.max_uses) THEN
    RAISE EXCEPTION 'Link inválido, expirado, desativado ou sem usos disponíveis.';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF FOUND THEN
    IF v_profile.company_id IS NOT NULL OR v_profile.company_assignment_status <> 'pending' THEN
      RAISE EXCEPTION 'Este usuário já possui uma empresa atribuída.';
    END IF;
    UPDATE profiles
    SET company_id = v_link.company_id,
        full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
        email = v_email,
        role = v_link.role,
        department_id = v_link.department_id,
        email_confirmed_at = v_confirmed_at,
        registration_source = 'signup_link',
        company_assignment_status = 'approved',
        assigned_at = now()
    WHERE id = v_profile.id;
  ELSE
    INSERT INTO profiles (user_id, company_id, full_name, email, role, department_id,
      email_confirmed_at, registration_source, company_assignment_status, assigned_at)
    VALUES (auth.uid(), v_link.company_id, p_full_name, v_email, v_link.role, v_link.department_id,
      v_confirmed_at, 'signup_link', 'approved', now());
  END IF;

  UPDATE signup_links SET uses_count = uses_count + 1 WHERE id = v_link.id;
END;
$$;

REVOKE ALL ON FUNCTION redeem_signup_link(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION redeem_signup_link(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION redeem_signup_link(text, text) TO authenticated;
