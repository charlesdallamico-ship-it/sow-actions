-- Equipes, participantes de planejamento e responsáveis por ação.
-- Mantém actions.responsible_id/team para compatibilidade, mas normaliza os vínculos.

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.strategic_objective_teams (
  objective_id uuid NOT NULL REFERENCES public.strategic_objectives(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (objective_id, team_id)
);

CREATE TABLE IF NOT EXISTS public.strategic_objective_users (
  objective_id uuid NOT NULL REFERENCES public.strategic_objectives(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  can_execute boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (objective_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.action_teams (
  action_id uuid NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (action_id, team_id)
);

CREATE TABLE IF NOT EXISTS public.action_assignees (
  action_id uuid NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assignment_type text NOT NULL DEFAULT 'responsible' CHECK (assignment_type IN ('responsible','participant')),
  can_edit boolean NOT NULL DEFAULT true,
  validated boolean NOT NULL DEFAULT false,
  validated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (action_id, profile_id)
);

ALTER TABLE public.actions ADD COLUMN IF NOT EXISTS responsibility_validated boolean NOT NULL DEFAULT false;
ALTER TABLE public.actions ADD COLUMN IF NOT EXISTS responsibility_validated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.actions ADD COLUMN IF NOT EXISTS responsibility_validated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_teams_company ON public.teams(company_id);
CREATE INDEX IF NOT EXISTS idx_team_members_company ON public.team_members(company_id);
CREATE INDEX IF NOT EXISTS idx_team_members_profile ON public.team_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_objective_teams_company ON public.strategic_objective_teams(company_id);
CREATE INDEX IF NOT EXISTS idx_objective_users_company ON public.strategic_objective_users(company_id);
CREATE INDEX IF NOT EXISTS idx_action_teams_company ON public.action_teams(company_id);
CREATE INDEX IF NOT EXISTS idx_action_assignees_profile ON public.action_assignees(profile_id);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_objective_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_objective_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams FOR SELECT TO authenticated USING (is_sow_admin() OR company_id = my_company_id());
DROP POLICY IF EXISTS teams_manage ON public.teams;
CREATE POLICY teams_manage ON public.teams FOR ALL TO authenticated USING (is_company_admin_of(company_id)) WITH CHECK (is_company_admin_of(company_id));

DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members FOR SELECT TO authenticated USING (is_sow_admin() OR company_id = my_company_id());
DROP POLICY IF EXISTS team_members_manage ON public.team_members;
CREATE POLICY team_members_manage ON public.team_members FOR ALL TO authenticated USING (is_company_admin_of(company_id)) WITH CHECK (
  is_company_admin_of(company_id)
  AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.company_id = company_id)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.company_id = company_id)
);

DROP POLICY IF EXISTS objective_teams_select ON public.strategic_objective_teams;
CREATE POLICY objective_teams_select ON public.strategic_objective_teams FOR SELECT TO authenticated USING (is_sow_admin() OR company_id = my_company_id());
DROP POLICY IF EXISTS objective_teams_manage ON public.strategic_objective_teams;
CREATE POLICY objective_teams_manage ON public.strategic_objective_teams FOR ALL TO authenticated USING (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_edit_plans')) WITH CHECK (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_edit_plans'));

DROP POLICY IF EXISTS objective_users_select ON public.strategic_objective_users;
CREATE POLICY objective_users_select ON public.strategic_objective_users FOR SELECT TO authenticated USING (is_sow_admin() OR company_id = my_company_id());
DROP POLICY IF EXISTS objective_users_manage ON public.strategic_objective_users;
CREATE POLICY objective_users_manage ON public.strategic_objective_users FOR ALL TO authenticated USING (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_edit_plans')) WITH CHECK (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_edit_plans'));

DROP POLICY IF EXISTS action_teams_select ON public.action_teams;
CREATE POLICY action_teams_select ON public.action_teams FOR SELECT TO authenticated USING (is_sow_admin() OR company_id = my_company_id());
DROP POLICY IF EXISTS action_teams_manage ON public.action_teams;
CREATE POLICY action_teams_manage ON public.action_teams FOR ALL TO authenticated USING (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_change_responsible')) WITH CHECK (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_change_responsible'));

DROP POLICY IF EXISTS action_assignees_select ON public.action_assignees;
CREATE POLICY action_assignees_select ON public.action_assignees FOR SELECT TO authenticated USING (is_sow_admin() OR company_id = my_company_id());
DROP POLICY IF EXISTS action_assignees_manage ON public.action_assignees;
CREATE POLICY action_assignees_manage ON public.action_assignees FOR ALL TO authenticated USING (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_change_responsible')) WITH CHECK (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_change_responsible'));

REVOKE ALL ON public.teams, public.team_members, public.strategic_objective_teams, public.strategic_objective_users, public.action_teams, public.action_assignees FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams, public.team_members, public.strategic_objective_teams, public.strategic_objective_users, public.action_teams, public.action_assignees TO authenticated;
