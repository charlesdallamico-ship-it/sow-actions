-- Usuários enxergam ações da própria equipe, ações atribuídas diretamente a eles
-- e ações liberadas pela permissão de visualização geral.
DROP POLICY IF EXISTS "select_actions" ON public.actions;
CREATE POLICY "select_actions" ON public.actions FOR SELECT TO authenticated
USING (
  is_sow_admin()
  OR is_company_admin_of(company_id)
  OR has_permission(company_id, auth.uid(), 'can_view_all_actions')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = actions.responsible_id AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.action_assignees aa
    JOIN public.profiles p ON p.id = aa.profile_id
    WHERE aa.action_id = actions.id AND aa.company_id = actions.company_id AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.action_teams at
    JOIN public.team_members tm ON tm.team_id = at.team_id AND tm.company_id = at.company_id
    JOIN public.profiles p ON p.id = tm.profile_id
    WHERE at.action_id = actions.id AND at.company_id = actions.company_id AND p.user_id = auth.uid()
  )
);
