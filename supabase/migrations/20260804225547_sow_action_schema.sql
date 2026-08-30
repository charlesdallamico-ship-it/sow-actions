/*
# SOW Action — Core schema (multi-tenant strategic action management)

## Purpose
Transforms facts/problems/opportunities/decisions into tracked action plans following
the method: Fato -> Causa -> Acao -> Responsavel -> Prazo -> Acompanhamento -> Resultado.
Multi-tenant: each company has isolated data. SOW Consultoria admin sees all companies.

## New Tables
1. `companies` — client companies (multi-tenant root). fields: name, logo_url, segment,
   primary_color, secondary_color, mission, vision, values, active.
2. `units` — branches/units belonging to a company.
3. `departments` — departments belonging to a company.
4. `profiles` — per-user record linked to auth.users, holding role, company membership,
   position, phone, active status. Roles: sow_admin, company_admin, area_manager,
   responsible, viewer.
5. `strategic_objectives` — company strategic objectives (name, description, type).
6. `indicators` — indicators tied to an objective (name, unit, current, target, measure_date).
7. `facts` — the registered fact: what happened. Linked to company, objective, department,
   unit, category, priority, origin date. Stores fato text, causa text, cause_type,
   impact_type, impact_level, expected_result.
8. `actions` — 1 to 3 actions per fact. description, responsible_id, team, start_date,
   deadline, indicator_of_success, target, progress_percent, weight, status, comments,
   attachment_url, last_updated_at, approved_by, approved_at, approval_comment,
   approval_status, approval_evaluation, completion_evidence.
9. `comments` — comments on an action (author, content).
10. `action_history` — audit log of changes to actions (field, old_value, new_value, user).
11. `deadline_changes` — deadline change requests/records (old, new, reason, user).
12. `alerts` — in-system alerts (type, message, action_id, read status).

## Security
- RLS enabled on every table.
- All policies scoped TO authenticated with ownership/membership checks.
- Company isolation: users can only see rows belonging to a company they are a member of
  (profiles.company_id = auth.uid()'s profile company), except sow_admin role who sees all.
- Owner defaults to auth.uid() where a row is created by a user.
*/

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  segment text,
  primary_color text DEFAULT '#0f766e',
  secondary_color text DEFAULT '#1e293b',
  mission text,
  vision text,
  values text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Units / branches
CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Profiles (user metadata + role + company membership)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'responsible' CHECK (role IN ('sow_admin','company_admin','area_manager','responsible','viewer')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  position text,
  phone text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Strategic objectives
CREATE TABLE IF NOT EXISTS strategic_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE strategic_objectives ENABLE ROW LEVEL SECURITY;

-- Indicators
CREATE TABLE IF NOT EXISTS indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  objective_id uuid REFERENCES strategic_objectives(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit text,
  current_value numeric,
  target_value numeric,
  measure_date date,
  achieved_value numeric,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;

-- Facts
CREATE TABLE IF NOT EXISTS facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  objective_id uuid REFERENCES strategic_objectives(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  category text,
  priority text DEFAULT 'media' CHECK (priority IN ('baixa','media','alta','critica')),
  origin_date date NOT NULL DEFAULT CURRENT_DATE,
  fato text NOT NULL,
  causa text NOT NULL,
  cause_type text,
  impact_type text,
  impact_level text CHECK (impact_level IN ('baixo','medio','alto','critico')),
  expected_result text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE facts ENABLE ROW LEVEL SECURITY;

-- Actions
CREATE TABLE IF NOT EXISTS actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id uuid NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  description text NOT NULL,
  responsible_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team text,
  start_date date DEFAULT CURRENT_DATE,
  deadline date,
  original_deadline date,
  indicator_of_success text,
  target text,
  progress_percent numeric DEFAULT 0,
  weight numeric DEFAULT 33.33,
  status text DEFAULT 'nao_iniciada' CHECK (status IN ('nao_iniciada','em_planejamento','em_andamento','aguardando_terceiro','aguardando_aprovacao','com_impedimento','atrasada','concluida','cancelada')),
  comments text,
  attachment_url text,
  last_updated_at timestamptz DEFAULT now(),
  approval_status text CHECK (approval_status IN ('pending','approved','reproved','correction','info','reopened', NULL)),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  approval_comment text,
  approval_evaluation text,
  completion_evidence text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

-- Comments on actions
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Action history (audit log)
CREATE TABLE IF NOT EXISTS action_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  field text,
  old_value text,
  new_value text,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE action_history ENABLE ROW LEVEL SECURITY;

-- Deadline change requests
CREATE TABLE IF NOT EXISTS deadline_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  old_deadline date,
  new_deadline date,
  reason text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE deadline_changes ENABLE ROW LEVEL SECURITY;

-- Alerts (in-system)
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id uuid REFERENCES actions(id) ON DELETE CASCADE,
  type text,
  message text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_units_company ON units(company_id);
CREATE INDEX IF NOT EXISTS idx_departments_company ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_objectives_company ON strategic_objectives(company_id);
CREATE INDEX IF NOT EXISTS idx_indicators_company ON indicators(company_id);
CREATE INDEX IF NOT EXISTS idx_facts_company ON facts(company_id);
CREATE INDEX IF NOT EXISTS idx_actions_fact ON actions(fact_id);
CREATE INDEX IF NOT EXISTS idx_actions_company ON actions(company_id);
CREATE INDEX IF NOT EXISTS idx_actions_responsible ON actions(responsible_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_deadline ON actions(deadline);
CREATE INDEX IF NOT EXISTS idx_comments_action ON comments(action_id);
CREATE INDEX IF NOT EXISTS idx_history_action ON action_history(action_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);

-- Helper function: is the current user a SOW admin?
CREATE OR REPLACE FUNCTION is_sow_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'sow_admin'
  );
$$;

-- Helper function: current user's company id
CREATE OR REPLACE FUNCTION my_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============ POLICIES ============

-- Companies: SOW admin sees all; company users see their own
DROP POLICY IF EXISTS "select_companies" ON companies;
CREATE POLICY "select_companies" ON companies FOR SELECT
  TO authenticated USING (is_sow_admin() OR id = my_company_id());

DROP POLICY IF EXISTS "insert_companies" ON companies;
CREATE POLICY "insert_companies" ON companies FOR INSERT
  TO authenticated WITH CHECK (is_sow_admin());

DROP POLICY IF EXISTS "update_companies" ON companies;
CREATE POLICY "update_companies" ON companies FOR UPDATE
  TO authenticated USING (is_sow_admin() OR id = my_company_id()) WITH CHECK (is_sow_admin() OR id = my_company_id());

DROP POLICY IF EXISTS "delete_companies" ON companies;
CREATE POLICY "delete_companies" ON companies FOR DELETE
  TO authenticated USING (is_sow_admin());

-- Units
DROP POLICY IF EXISTS "select_units" ON units;
CREATE POLICY "select_units" ON units FOR SELECT
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "insert_units" ON units;
CREATE POLICY "insert_units" ON units FOR INSERT
  TO authenticated WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "update_units" ON units;
CREATE POLICY "update_units" ON units FOR UPDATE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id()) WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "delete_units" ON units;
CREATE POLICY "delete_units" ON units FOR DELETE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

-- Departments
DROP POLICY IF EXISTS "select_departments" ON departments;
CREATE POLICY "select_departments" ON departments FOR SELECT
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "insert_departments" ON departments;
CREATE POLICY "insert_departments" ON departments FOR INSERT
  TO authenticated WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "update_departments" ON departments;
CREATE POLICY "update_departments" ON departments FOR UPDATE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id()) WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "delete_departments" ON departments;
CREATE POLICY "delete_departments" ON departments FOR DELETE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

-- Profiles
DROP POLICY IF EXISTS "select_profiles" ON profiles;
CREATE POLICY "select_profiles" ON profiles FOR SELECT
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id() OR user_id = auth.uid());

DROP POLICY IF EXISTS "insert_profiles" ON profiles;
CREATE POLICY "insert_profiles" ON profiles FOR INSERT
  TO authenticated WITH CHECK (is_sow_admin() OR company_id = my_company_id() OR user_id = auth.uid());

DROP POLICY IF EXISTS "update_profiles" ON profiles;
CREATE POLICY "update_profiles" ON profiles FOR UPDATE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id() OR user_id = auth.uid()) WITH CHECK (is_sow_admin() OR company_id = my_company_id() OR user_id = auth.uid());

DROP POLICY IF EXISTS "delete_profiles" ON profiles;
CREATE POLICY "delete_profiles" ON profiles FOR DELETE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

-- Strategic objectives
DROP POLICY IF EXISTS "select_objectives" ON strategic_objectives;
CREATE POLICY "select_objectives" ON strategic_objectives FOR SELECT
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "insert_objectives" ON strategic_objectives;
CREATE POLICY "insert_objectives" ON strategic_objectives FOR INSERT
  TO authenticated WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "update_objectives" ON strategic_objectives;
CREATE POLICY "update_objectives" ON strategic_objectives FOR UPDATE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id()) WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "delete_objectives" ON strategic_objectives;
CREATE POLICY "delete_objectives" ON strategic_objectives FOR DELETE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

-- Indicators
DROP POLICY IF EXISTS "select_indicators" ON indicators;
CREATE POLICY "select_indicators" ON indicators FOR SELECT
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "insert_indicators" ON indicators;
CREATE POLICY "insert_indicators" ON indicators FOR INSERT
  TO authenticated WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "update_indicators" ON indicators;
CREATE POLICY "update_indicators" ON indicators FOR UPDATE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id()) WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "delete_indicators" ON indicators;
CREATE POLICY "delete_indicators" ON indicators FOR DELETE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

-- Facts
DROP POLICY IF EXISTS "select_facts" ON facts;
CREATE POLICY "select_facts" ON facts FOR SELECT
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "insert_facts" ON facts;
CREATE POLICY "insert_facts" ON facts FOR INSERT
  TO authenticated WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "update_facts" ON facts;
CREATE POLICY "update_facts" ON facts FOR UPDATE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id()) WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "delete_facts" ON facts;
CREATE POLICY "delete_facts" ON facts FOR DELETE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

-- Actions
DROP POLICY IF EXISTS "select_actions" ON actions;
CREATE POLICY "select_actions" ON actions FOR SELECT
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "insert_actions" ON actions;
CREATE POLICY "insert_actions" ON actions FOR INSERT
  TO authenticated WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "update_actions" ON actions;
CREATE POLICY "update_actions" ON actions FOR UPDATE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id()) WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "delete_actions" ON actions;
CREATE POLICY "delete_actions" ON actions FOR DELETE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

-- Comments
DROP POLICY IF EXISTS "select_comments" ON comments;
CREATE POLICY "select_comments" ON comments FOR SELECT
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "insert_comments" ON comments;
CREATE POLICY "insert_comments" ON comments FOR INSERT
  TO authenticated WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "delete_comments" ON comments;
CREATE POLICY "delete_comments" ON comments FOR DELETE
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

-- Action history
DROP POLICY IF EXISTS "select_history" ON action_history;
CREATE POLICY "select_history" ON action_history FOR SELECT
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "insert_history" ON action_history;
CREATE POLICY "insert_history" ON action_history FOR INSERT
  TO authenticated WITH CHECK (is_sow_admin() OR company_id = my_company_id());

-- Deadline changes
DROP POLICY IF EXISTS "select_deadline_changes" ON deadline_changes;
CREATE POLICY "select_deadline_changes" ON deadline_changes FOR SELECT
  TO authenticated USING (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "insert_deadline_changes" ON deadline_changes;
CREATE POLICY "insert_deadline_changes" ON deadline_changes FOR INSERT
  TO authenticated WITH CHECK (is_sow_admin() OR company_id = my_company_id());

-- Alerts
DROP POLICY IF EXISTS "select_alerts" ON alerts;
CREATE POLICY "select_alerts" ON alerts FOR SELECT
  TO authenticated USING (is_sow_admin() OR user_id = auth.uid() OR company_id = my_company_id());

DROP POLICY IF EXISTS "insert_alerts" ON alerts;
CREATE POLICY "insert_alerts" ON alerts FOR INSERT
  TO authenticated WITH CHECK (is_sow_admin() OR company_id = my_company_id());

DROP POLICY IF EXISTS "update_alerts" ON alerts;
CREATE POLICY "update_alerts" ON alerts FOR UPDATE
  TO authenticated USING (is_sow_admin() OR user_id = auth.uid() OR company_id = my_company_id()) WITH CHECK (is_sow_admin() OR user_id = auth.uid() OR company_id = my_company_id());

DROP POLICY IF EXISTS "delete_alerts" ON alerts;
CREATE POLICY "delete_alerts" ON alerts FOR DELETE
  TO authenticated USING (is_sow_admin() OR user_id = auth.uid());
