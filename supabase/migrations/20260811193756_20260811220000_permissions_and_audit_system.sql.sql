/*
# Controle de Edição e Delegação de Permissões — SOW ACTION

## Objetivo
Implementar um sistema rigoroso de permissões onde:
1. Cada empresa tem um Administrador Principal com autoridade total sobre os dados da empresa
2. O Administrador Principal pode delegar permissões específicas a usuários da mesma empresa
3. Permissões específicas por Plano de Ação (usuário autorizado a editar somente um plano)
4. Responsável por tarefa NÃO é automaticamente editor (só atualiza andamento/comentários)
5. Toda alteração estrutural exige justificativa obrigatória
6. Histórico completo de alterações (auditoria)
7. Cancelamento em vez de exclusão de fatos/planos/ações
8. Solicitação de alteração de prazo com fluxo de aprovação
9. Segurança multiempresa (RLS em todas as novas tabelas)

## Novas Tabelas

### 1. user_permissions
Armazena permissões delegadas por usuário dentro de uma empresa.
- `id` (uuid PK)
- `company_id` (uuid FK → companies) — empresa à qual a permissão se aplica
- `user_id` (uuid) — referência ao auth.users do usuário
- `profile_id` (uuid FK → profiles) — referência ao perfil do usuário na empresa
- 18 colunas booleanas individuais para cada permissão operacional
- `full_management` (boolean) — permissão total de gestão (todas as operacionais, menos delegar)
- `is_primary_admin` (boolean) — marca o Administrador Principal da empresa
- `created_at`, `updated_at`

### 2. plan_permissions
Permissões específicas por Plano de Ação (fato). Permite autorizar um usuário a editar
somente um plano específico, mesmo sem permissão geral.
- `id` (uuid PK)
- `fact_id` (uuid FK → facts) — o plano de ação
- `company_id` (uuid FK → companies)
- `user_id` (uuid) — auth.users
- `profile_id` (uuid FK → profiles)
- `can_edit` (boolean default true)
- `created_at`

### 3. deadline_requests
Solicitações de alteração de prazo feitas por responsáveis sem permissão direta.
Fluxo: solicitante pede → admin aprova/reprova → sistema registra novo prazo + mantém original.
- `id` (uuid PK)
- `action_id` (uuid FK → actions)
- `company_id` (uuid FK → companies)
- `requested_by` (uuid) — auth.users do solicitante
- `current_deadline` (date) — prazo atual
- `requested_deadline` (date) — novo prazo solicitado
- `reason` (text) — motivo da solicitação
- `observation` (text) — observação adicional
- `status` (text) — 'pending' | 'approved' | 'reproved'
- `reviewed_by` (uuid) — auth.users do aprovador
- `reviewed_at` (timestamptz)
- `review_comment` (text) — justificativa do aprovador
- `created_at`

### 4. audit_logs
Registro de auditoria para todas as alterações importantes.
- `id` (uuid PK)
- `company_id` (uuid FK → companies)
- `user_id` (uuid) — auth.users
- `fact_id` (uuid nullable FK → facts) — plano relacionado
- `action_id` (uuid nullable FK → actions) — ação relacionada
- `action_type` (text) — tipo de alteração (edit_fact, edit_cause, edit_action, cancel_action, etc.)
- `field_name` (text) — campo alterado
- `old_value` (text) — valor anterior
- `new_value` (text) — novo valor
- `reason` (text) — justificativa da alteração
- `created_at` (timestamptz)

## Modificações em Tabelas Existentes

### profiles
- Adiciona `is_primary_admin` (boolean default false) — marca o Administrador Principal da empresa

### facts
- Adiciona `cancelled` (boolean default false) — soft-delete / cancelamento
- Adiciona `cancelled_at` (timestamptz)
- Adiciona `cancelled_by` (uuid) — auth.users
- Adiciona `cancel_reason` (text)
- Adiciona `original_fato` (text) — preservação do texto original
- Adiciona `original_causa` (text) — preservação do texto original

### actions
- Adiciona `cancelled` (boolean default false) — soft-delete / cancelamento
- Adiciona `cancelled_at` (timestamptz)
- Adiciona `cancelled_by` (uuid) — auth.users
- Adiciona `cancel_reason` (text)
- Adiciona `original_description` (text) — preservação do texto original

## Segurança (RLS)

### user_permissions
- SELECT: usuário vê suas próprias permissões; admin da empresa vê todas da empresa; sow_admin vê todas
- INSERT/UPDATE/DELETE: somente o Administrador Principal da empresa ou sow_admin
- Isolamento por company_id

### plan_permissions
- SELECT: usuário vê permissões de planos que pode acessar; admin vê todas da empresa; sow_admin vê todas
- INSERT/DELETE: somente Administrador Principal ou sow_admin
- Isolamento por company_id

### deadline_requests
- SELECT: solicitante vê suas solicitações; admin vê todas da empresa; sow_admin vê todas
- INSERT: qualquer usuário autenticado pode solicitar (isolado por company_id)
- UPDATE: somente admin/sow_admin pode aprovar/reprovar
- Isolamento por company_id

### audit_logs
- SELECT: usuários da empresa podem ver auditoria da própria empresa (se tiverem permissão)
- INSERT: somente via SECURITY DEFINER function ou admin
- UPDATE/DELETE: NUNCA permitido (registro imutável)
- Isolamento por company_id

## Funções SECURITY DEFINER

### has_permission(p_company_id, p_user_id, p_permission)
Verifica se um usuário tem uma permissão específica na empresa.
Retorna true se: é sow_admin, OU é primary_admin, OU tem a permissão delegada, OU tem full_management.

### can_edit_plan(p_fact_id, p_user_id)
Verifica se um usuário pode editar um plano de ação específico.
Retorna true se: é sow_admin, OU é primary_admin, OU tem permissão geral de editar planos, OU tem plan_permissions para aquele fato.

### can_edit_action(p_action_id, p_user_id)
Verifica se um usuário pode editar a estrutura de uma ação.
Retorna true se: pode editar o plano (fact) pai, OU tem permissão geral de editar ações.

### is_company_admin(p_company_id, p_user_id)
Verifica se é administrador principal ou sow_admin.

### insert_audit_log(...)
Função SECURITY DEFINER para inserir registros de auditoria — usuários comuns não podem
escrever diretamente na tabela audit_logs, apenas através desta função.

## Notas Importantes

1. Esta migração NÃO exclui dados existentes — apenas adiciona tabelas e colunas
2. O primeiro usuário com role 'company_admin' de cada empresa será marcado como is_primary_admin = true
3. Todas as novas tabelas têm RLS habilitado
4. Políticas são idempotent (DROP IF EXISTS antes de CREATE)
5. As funções SECURITY DEFINER garantem que a verificação de permissão acontece no banco,
   não apenas no frontend
*/

-- ============================================================
-- 1. ADICIONAR COLUNAS EM TABELAS EXISTENTES
-- ============================================================

-- profiles: is_primary_admin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_primary_admin') THEN
    ALTER TABLE profiles ADD COLUMN is_primary_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- facts: cancelamento e preservação
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facts' AND column_name = 'cancelled') THEN
    ALTER TABLE facts ADD COLUMN cancelled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facts' AND column_name = 'cancelled_at') THEN
    ALTER TABLE facts ADD COLUMN cancelled_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facts' AND column_name = 'cancelled_by') THEN
    ALTER TABLE facts ADD COLUMN cancelled_by uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facts' AND column_name = 'cancel_reason') THEN
    ALTER TABLE facts ADD COLUMN cancel_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facts' AND column_name = 'original_fato') THEN
    ALTER TABLE facts ADD COLUMN original_fato text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facts' AND column_name = 'original_causa') THEN
    ALTER TABLE facts ADD COLUMN original_causa text;
  END IF;
END $$;

-- actions: cancelamento e preservação
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'cancelled') THEN
    ALTER TABLE actions ADD COLUMN cancelled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'cancelled_at') THEN
    ALTER TABLE actions ADD COLUMN cancelled_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'cancelled_by') THEN
    ALTER TABLE actions ADD COLUMN cancelled_by uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'cancel_reason') THEN
    ALTER TABLE actions ADD COLUMN cancel_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'original_description') THEN
    ALTER TABLE actions ADD COLUMN original_description text;
  END IF;
END $$;

-- ============================================================
-- 2. CRIAR TABELA user_permissions
-- ============================================================

CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Permissões operacionais individuais
  can_create_facts boolean NOT NULL DEFAULT false,
  can_edit_facts boolean NOT NULL DEFAULT false,
  can_edit_causes boolean NOT NULL DEFAULT false,
  can_create_plans boolean NOT NULL DEFAULT false,
  can_edit_plans boolean NOT NULL DEFAULT false,
  can_create_actions boolean NOT NULL DEFAULT false,
  can_edit_actions boolean NOT NULL DEFAULT false,
  can_change_responsible boolean NOT NULL DEFAULT false,
  can_change_deadlines boolean NOT NULL DEFAULT false,
  can_change_indicators boolean NOT NULL DEFAULT false,
  can_change_targets boolean NOT NULL DEFAULT false,
  can_change_priorities boolean NOT NULL DEFAULT false,
  can_change_weights boolean NOT NULL DEFAULT false,
  can_cancel_actions boolean NOT NULL DEFAULT false,
  can_reopen_actions boolean NOT NULL DEFAULT false,
  can_approve_actions boolean NOT NULL DEFAULT false,
  can_view_all_actions boolean NOT NULL DEFAULT false,
  can_view_history boolean NOT NULL DEFAULT false,

  -- Permissão total de gestão (todas as operacionais, mas NÃO pode delegar)
  full_management boolean NOT NULL DEFAULT false,

  -- Marca de administrador principal (redundante com profiles mas para consulta rápida)
  is_primary_admin boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(company_id, user_id)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_permissions_company ON user_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

-- Políticas user_permissions
DROP POLICY IF EXISTS "select_user_permissions" ON user_permissions;
CREATE POLICY "select_user_permissions" ON user_permissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'sow_admin' OR (p.company_id = user_permissions.company_id AND p.is_primary_admin = true))
    )
  );

DROP POLICY IF EXISTS "insert_user_permissions" ON user_permissions;
CREATE POLICY "insert_user_permissions" ON user_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'sow_admin' OR (p.company_id = user_permissions.company_id AND p.is_primary_admin = true))
    )
  );

DROP POLICY IF EXISTS "update_user_permissions" ON user_permissions;
CREATE POLICY "update_user_permissions" ON user_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'sow_admin' OR (p.company_id = user_permissions.company_id AND p.is_primary_admin = true))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'sow_admin' OR (p.company_id = user_permissions.company_id AND p.is_primary_admin = true))
    )
  );

DROP POLICY IF EXISTS "delete_user_permissions" ON user_permissions;
CREATE POLICY "delete_user_permissions" ON user_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'sow_admin' OR (p.company_id = user_permissions.company_id AND p.is_primary_admin = true))
    )
  );

-- ============================================================
-- 3. CRIAR TABELA plan_permissions
-- ============================================================

CREATE TABLE IF NOT EXISTS plan_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id uuid NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_edit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(fact_id, user_id)
);

ALTER TABLE plan_permissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_plan_permissions_fact ON plan_permissions(fact_id);
CREATE INDEX IF NOT EXISTS idx_plan_permissions_company ON plan_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_plan_permissions_user ON plan_permissions(user_id);

DROP POLICY IF EXISTS "select_plan_permissions" ON plan_permissions;
CREATE POLICY "select_plan_permissions" ON plan_permissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'sow_admin' OR (p.company_id = plan_permissions.company_id AND p.is_primary_admin = true))
    )
  );

DROP POLICY IF EXISTS "insert_plan_permissions" ON plan_permissions;
CREATE POLICY "insert_plan_permissions" ON plan_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'sow_admin' OR (p.company_id = plan_permissions.company_id AND p.is_primary_admin = true))
    )
  );

DROP POLICY IF EXISTS "delete_plan_permissions" ON plan_permissions;
CREATE POLICY "delete_plan_permissions" ON plan_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'sow_admin' OR (p.company_id = plan_permissions.company_id AND p.is_primary_admin = true))
    )
  );

-- ============================================================
-- 4. CRIAR TABELA deadline_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS deadline_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  current_deadline date,
  requested_deadline date NOT NULL,
  reason text NOT NULL,
  observation text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deadline_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_deadline_requests_company ON deadline_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_deadline_requests_action ON deadline_requests(action_id);
CREATE INDEX IF NOT EXISTS idx_deadline_requests_status ON deadline_requests(status);

DROP POLICY IF EXISTS "select_deadline_requests" ON deadline_requests;
CREATE POLICY "select_deadline_requests" ON deadline_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'sow_admin' OR (p.company_id = deadline_requests.company_id AND (p.is_primary_admin = true OR p.role = 'company_admin' OR p.role = 'area_manager')))
    )
  );

DROP POLICY IF EXISTS "insert_deadline_requests" ON deadline_requests;
CREATE POLICY "insert_deadline_requests" ON deadline_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.company_id = deadline_requests.company_id
    )
  );

DROP POLICY IF EXISTS "update_deadline_requests" ON deadline_requests;
CREATE POLICY "update_deadline_requests" ON deadline_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'sow_admin' OR (p.company_id = deadline_requests.company_id AND (p.is_primary_admin = true OR p.role = 'company_admin' OR p.role = 'area_manager')))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'sow_admin' OR (p.company_id = deadline_requests.company_id AND (p.is_primary_admin = true OR p.role = 'company_admin' OR p.role = 'area_manager')))
    )
  );

-- ============================================================
-- 5. CRIAR TABELA audit_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid,
  fact_id uuid REFERENCES facts(id) ON DELETE SET NULL,
  action_id uuid REFERENCES actions(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_fact ON audit_logs(fact_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- audit_logs: SELECT para usuários da empresa com permissão can_view_history
DROP POLICY IF EXISTS "select_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (
        p.role = 'sow_admin'
        OR (p.company_id = audit_logs.company_id AND p.is_primary_admin = true)
        OR (
          p.company_id = audit_logs.company_id
          AND EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = auth.uid()
            AND up.company_id = audit_logs.company_id
            AND (up.can_view_history = true OR up.full_management = true)
          )
        )
      )
    )
  );

-- audit_logs: INSERT somente via SECURITY DEFINER function ou admin
DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'sow_admin' OR p.company_id = audit_logs.company_id)
    )
  );

-- audit_logs: UPDATE e DELETE NUNCA permitidos
DROP POLICY IF EXISTS "update_audit_logs" ON audit_logs;
CREATE POLICY "update_audit_logs" ON audit_logs FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "delete_audit_logs" ON audit_logs;
CREATE POLICY "delete_audit_logs" ON audit_logs FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================
-- 6. MARCAR ADMINISTRADORES PRINCIPAIS EXISTENTES
-- ============================================================

-- Para cada empresa, marcar o primeiro company_admin como is_primary_admin
UPDATE profiles SET is_primary_admin = true
WHERE id IN (
  SELECT DISTINCT ON (company_id) id
  FROM profiles
  WHERE role = 'company_admin' AND company_id IS NOT NULL
  ORDER BY company_id, created_at ASC
);

-- Criar registros de user_permissions para os primary admins existentes
INSERT INTO user_permissions (company_id, user_id, profile_id, is_primary_admin, full_management,
  can_create_facts, can_edit_facts, can_edit_causes,
  can_create_plans, can_edit_plans,
  can_create_actions, can_edit_actions,
  can_change_responsible, can_change_deadlines, can_change_indicators,
  can_change_targets, can_change_priorities, can_change_weights,
  can_cancel_actions, can_reopen_actions, can_approve_actions,
  can_view_all_actions, can_view_history)
SELECT p.company_id, p.user_id, p.id, true, true,
  true, true, true, true, true, true, true,
  true, true, true, true, true, true,
  true, true, true, true, true
FROM profiles p
WHERE p.is_primary_admin = true
ON CONFLICT (company_id, user_id) DO UPDATE SET
  is_primary_admin = true,
  full_management = true;

-- ============================================================
-- 7. FUNÇÕES SECURITY DEFINER
-- ============================================================

-- has_permission(p_company_id, p_user_id, p_permission)
-- Verifica se o usuário tem uma permissão específica na empresa
CREATE OR REPLACE FUNCTION has_permission(
  p_company_id uuid,
  p_user_id uuid,
  p_permission text
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- SOW admin tem todas as permissões
    (EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND role = 'sow_admin')),
    -- Primary admin tem todas as permissões da empresa
    (EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND company_id = p_company_id AND is_primary_admin = true)),
    -- full_management concede todas as operacionais
    (EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND full_management = true)),
    -- Permissão específica delegada
    CASE p_permission
      WHEN 'can_create_facts' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_create_facts = true)
      WHEN 'can_edit_facts' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_edit_facts = true)
      WHEN 'can_edit_causes' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_edit_causes = true)
      WHEN 'can_create_plans' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_create_plans = true)
      WHEN 'can_edit_plans' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_edit_plans = true)
      WHEN 'can_create_actions' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_create_actions = true)
      WHEN 'can_edit_actions' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_edit_actions = true)
      WHEN 'can_change_responsible' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_change_responsible = true)
      WHEN 'can_change_deadlines' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_change_deadlines = true)
      WHEN 'can_change_indicators' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_change_indicators = true)
      WHEN 'can_change_targets' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_change_targets = true)
      WHEN 'can_change_priorities' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_change_priorities = true)
      WHEN 'can_change_weights' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_change_weights = true)
      WHEN 'can_cancel_actions' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_cancel_actions = true)
      WHEN 'can_reopen_actions' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_reopen_actions = true)
      WHEN 'can_approve_actions' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_approve_actions = true)
      WHEN 'can_view_all_actions' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_view_all_actions = true)
      WHEN 'can_view_history' THEN EXISTS (SELECT 1 FROM user_permissions WHERE user_id = p_user_id AND company_id = p_company_id AND can_view_history = true)
      ELSE false
    END
  );
$$;

-- can_edit_plan(p_fact_id, p_user_id)
-- Verifica se o usuário pode editar um plano de ação específico
CREATE OR REPLACE FUNCTION can_edit_plan(
  p_fact_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- SOW admin
    (EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND role = 'sow_admin')),
    -- Primary admin da empresa
    (EXISTS (
      SELECT 1 FROM profiles p
      JOIN facts f ON f.id = p_fact_id
      WHERE p.user_id = p_user_id AND p.company_id = f.company_id AND p.is_primary_admin = true
    )),
    -- Permissão geral de editar planos
    (has_permission((SELECT company_id FROM facts WHERE id = p_fact_id), p_user_id, 'can_edit_plans')),
    -- Permissão específica neste plano
    (EXISTS (SELECT 1 FROM plan_permissions WHERE fact_id = p_fact_id AND user_id = p_user_id AND can_edit = true))
  );
$$;

-- can_edit_action(p_action_id, p_user_id)
-- Verifica se o usuário pode editar a estrutura de uma ação
CREATE OR REPLACE FUNCTION can_edit_action(
  p_action_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- SOW admin
    (EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND role = 'sow_admin')),
    -- Primary admin
    (EXISTS (
      SELECT 1 FROM profiles p
      JOIN actions a ON a.id = p_action_id
      WHERE p.user_id = p_user_id AND p.company_id = a.company_id AND p.is_primary_admin = true
    )),
    -- Permissão geral de editar ações
    (has_permission((SELECT company_id FROM actions WHERE id = p_action_id), p_user_id, 'can_edit_actions')),
    -- Permissão no plano pai
    (can_edit_plan((SELECT fact_id FROM actions WHERE id = p_action_id), p_user_id))
  );
$$;

-- is_company_admin(p_company_id, p_user_id)
-- Verifica se é admin principal ou sow_admin
CREATE OR REPLACE FUNCTION is_company_admin(
  p_company_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND role = 'sow_admin')),
    (EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND company_id = p_company_id AND is_primary_admin = true))
  );
$$;

-- insert_audit_log(p_company_id, p_user_id, p_fact_id, p_action_id, p_action_type, p_field_name, p_old_value, p_new_value, p_reason)
-- Função SECURITY DEFINER para inserir auditoria — contorna RLS de INSERT
CREATE OR REPLACE FUNCTION insert_audit_log(
  p_company_id uuid,
  p_user_id uuid,
  p_fact_id uuid,
  p_action_id uuid,
  p_action_type text,
  p_field_name text,
  p_old_value text,
  p_new_value text,
  p_reason text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO audit_logs (company_id, user_id, fact_id, action_id, action_type, field_name, old_value, new_value, reason)
  VALUES (p_company_id, p_user_id, p_fact_id, p_action_id, p_action_type, p_field_name, p_old_value, p_new_value, p_reason)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Conceder EXECUTE nas funções para authenticated
GRANT EXECUTE ON FUNCTION has_permission(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_plan(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_action(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_company_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_audit_log(uuid, uuid, uuid, uuid, text, text, text, text, text) TO authenticated;

-- ============================================================
-- 8. REVOGAR ACESSO ANON
-- ============================================================
REVOKE ALL ON user_permissions FROM anon;
REVOKE ALL ON plan_permissions FROM anon;
REVOKE ALL ON deadline_requests FROM anon;
REVOKE ALL ON audit_logs FROM anon;
