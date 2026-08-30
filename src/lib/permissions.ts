import { supabase } from './supabase';
import type { Profile, PermissionKey, UserPermission } from './types';

export function isSowAdmin(profile: Profile | null): boolean {
  return profile?.role === 'sow_admin';
}

export function isPrimaryAdmin(profile: Profile | null): boolean {
  return profile?.is_primary_admin === true || profile?.role === 'sow_admin';
}

export function canManagePermissions(profile: Profile | null): boolean {
  return isSowAdmin(profile) || (profile?.is_primary_admin === true);
}

const ALL_PERMISSIONS: PermissionKey[] = [
  'can_create_facts',
  'can_edit_facts',
  'can_edit_causes',
  'can_create_plans',
  'can_edit_plans',
  'can_create_actions',
  'can_edit_actions',
  'can_change_responsible',
  'can_change_deadlines',
  'can_change_indicators',
  'can_change_targets',
  'can_change_priorities',
  'can_change_weights',
  'can_cancel_actions',
  'can_reopen_actions',
  'can_approve_actions',
  'can_view_all_actions',
  'can_view_history',
];

export { ALL_PERMISSIONS };

export async function fetchUserPermissions(
  companyId: string,
  userId: string,
): Promise<UserPermission | null> {
  const { data } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle();
  return data as UserPermission | null;
}

export async function fetchAllUserPermissions(
  companyId: string,
): Promise<UserPermission[]> {
  const { data } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('company_id', companyId);
  return (data as UserPermission[] | undefined) ?? [];
}

export async function hasPermission(
  companyId: string,
  userId: string,
  permission: PermissionKey,
): Promise<boolean> {
  const { data } = await supabase.rpc('has_permission', {
    p_company_id: companyId,
    p_user_id: userId,
    p_permission: permission,
  });
  return data === true;
}

export async function canEditPlan(
  factId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc('can_edit_plan', {
    p_fact_id: factId,
    p_user_id: userId,
  });
  return data === true;
}

export async function canEditAction(
  actionId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc('can_edit_action', {
    p_action_id: actionId,
    p_user_id: userId,
  });
  return data === true;
}

export async function isCompanyAdmin(
  companyId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc('is_company_admin', {
    p_company_id: companyId,
    p_user_id: userId,
  });
  return data === true;
}

export async function insertAuditLog(params: {
  companyId: string;
  userId: string;
  factId?: string | null;
  actionId?: string | null;
  actionType: string;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  reason: string;
}): Promise<void> {
  await supabase.rpc('insert_audit_log', {
    p_company_id: params.companyId,
    p_user_id: params.userId,
    p_fact_id: params.factId ?? null,
    p_action_id: params.actionId ?? null,
    p_action_type: params.actionType,
    p_field_name: params.fieldName ?? null,
    p_old_value: params.oldValue ?? null,
    p_new_value: params.newValue ?? null,
    p_reason: params.reason,
  });
}

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  can_create_facts: 'Criar Fatos',
  can_edit_facts: 'Editar Fatos',
  can_edit_causes: 'Editar Causas',
  can_create_plans: 'Criar Planos de Ação',
  can_edit_plans: 'Editar Planos de Ação',
  can_create_actions: 'Criar Ações',
  can_edit_actions: 'Editar Ações',
  can_change_responsible: 'Alterar Responsáveis',
  can_change_deadlines: 'Alterar Prazos',
  can_change_indicators: 'Alterar Indicadores',
  can_change_targets: 'Alterar Metas',
  can_change_priorities: 'Alterar Prioridades',
  can_change_weights: 'Alterar Pesos',
  can_cancel_actions: 'Cancelar Ações',
  can_reopen_actions: 'Reabrir Ações',
  can_approve_actions: 'Aprovar Ações',
  can_view_all_actions: 'Ver todas as ações da empresa',
  can_view_history: 'Ver histórico de alterações',
};

export { PERMISSION_LABELS };

export function permissionLabel(key: PermissionKey): string {
  return PERMISSION_LABELS[key] ?? key;
}
