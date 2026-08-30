import { supabase } from './supabase';
import type { SignupLink, Role } from './types';

export const SIGNUP_ROLES: Role[] = ['company_admin', 'area_manager', 'responsible', 'viewer'];

export function signupLinkUrl(token: string): string {
  return `${window.location.origin}/signup/${token}`;
}

export async function listSignupLinks(companyId: string): Promise<SignupLink[]> {
  const { data, error } = await supabase
    .from('signup_links')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as SignupLink[] | null) ?? [];
}

export async function createSignupLink(params: {
  companyId: string;
  role: Role;
  departmentId?: string | null;
  label?: string | null;
  maxUses?: number | null;
  expiresAt?: string | null;
  createdBy: string;
}): Promise<SignupLink> {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const { data, error } = await supabase
    .from('signup_links')
    .insert({
      company_id: params.companyId,
      role: params.role,
      department_id: params.departmentId || null,
      label: params.label || null,
      max_uses: params.maxUses ?? null,
      expires_at: params.expiresAt || null,
      created_by: params.createdBy,
      token,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as SignupLink;
}

export async function toggleSignupLinkActive(link: SignupLink): Promise<void> {
  const { error } = await supabase.from('signup_links').update({ active: !link.active }).eq('id', link.id);
  if (error) throw error;
}

export async function deleteSignupLink(id: string): Promise<void> {
  const { error } = await supabase.from('signup_links').delete().eq('id', id);
  if (error) throw error;
}

export interface SignupLinkInfo {
  company_name: string | null;
  role: Role | null;
  department_name: string | null;
  is_valid: boolean;
  message: string;
}

export async function getSignupLinkInfo(token: string): Promise<SignupLinkInfo> {
  const { data, error } = await supabase.rpc('get_signup_link_info', { p_token: token });
  if (error) throw error;
  const row = (data as SignupLinkInfo[] | null)?.[0];
  return row ?? { company_name: null, role: null, department_name: null, is_valid: false, message: 'Link inválido.' };
}

export async function redeemSignupLink(token: string, fullName: string): Promise<void> {
  const { error } = await supabase.rpc('redeem_signup_link', { p_token: token, p_full_name: fullName });
  if (error) throw error;
}
