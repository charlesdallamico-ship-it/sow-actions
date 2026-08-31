-- Restringe alterações dos vínculos às permissões de planejamento/responsabilidade.
DROP POLICY IF EXISTS objective_teams_manage ON public.strategic_objective_teams;
CREATE POLICY objective_teams_manage ON public.strategic_objective_teams FOR ALL TO authenticated USING (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_edit_plans')) WITH CHECK (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_edit_plans'));
DROP POLICY IF EXISTS objective_users_manage ON public.strategic_objective_users;
CREATE POLICY objective_users_manage ON public.strategic_objective_users FOR ALL TO authenticated USING (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_edit_plans')) WITH CHECK (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_edit_plans'));
DROP POLICY IF EXISTS action_teams_manage ON public.action_teams;
CREATE POLICY action_teams_manage ON public.action_teams FOR ALL TO authenticated USING (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_change_responsible')) WITH CHECK (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_change_responsible'));
DROP POLICY IF EXISTS action_assignees_manage ON public.action_assignees;
CREATE POLICY action_assignees_manage ON public.action_assignees FOR ALL TO authenticated USING (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_change_responsible')) WITH CHECK (is_sow_admin() OR is_company_admin_of(company_id) OR has_permission(company_id, auth.uid(), 'can_change_responsible'));
