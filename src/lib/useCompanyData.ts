import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type { Company, Department, Unit, Profile, StrategicObjective, Indicator } from './types';

export function useCompanyData() {
  const { profile, refreshProfile } = useAuth();
  const companyId = profile?.active_company_id ?? profile?.company_id ?? null;

  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [objectives, setObjectives] = useState<StrategicObjective[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) { setLoading(false); return; }

    // SOW admins can see all companies for switching
    if (profile.role === 'sow_admin') {
      const { data: allCompanies } = await supabase.from('companies').select('*').order('name');
      setCompanies((allCompanies as Company[] | undefined) ?? []);
    } else {
      setCompanies([]);
    }

    if (!companyId) { setCompany(null); setDepartments([]); setUnits([]); setUsers([]); setObjectives([]); setIndicators([]); setLoading(false); return; }
    setLoading(true);
    const [c, d, u, p, o, i] = await Promise.all([
      supabase.from('companies').select('*').eq('id', companyId).maybeSingle(),
      supabase.from('departments').select('*').eq('company_id', companyId).order('name'),
      supabase.from('units').select('*').eq('company_id', companyId).order('name'),
      supabase.rpc('get_user_access_overview', { p_company_id: companyId }),
      supabase.from('strategic_objectives').select('*').eq('company_id', companyId).order('name'),
      supabase.from('indicators').select('*').eq('company_id', companyId).order('name'),
    ]);
    setCompany(c.data as Company | null);
    setDepartments((d.data as Department[] | undefined) ?? []);
    setUnits((u.data as Unit[] | undefined) ?? []);
    setUsers((p.data as Profile[] | undefined) ?? []);
    setObjectives((o.data as StrategicObjective[] | undefined) ?? []);
    setIndicators((i.data as Indicator[] | undefined) ?? []);
    setLoading(false);
  }, [companyId, profile]);

  useEffect(() => { load(); }, [load]);

  const switchCompany = useCallback(async (newCompanyId: string | null, reason?: string) => {
    if (!profile) return;
    await supabase.from('profiles').update({ active_company_id: newCompanyId }).eq('user_id', profile.user_id);
    // Log SOW admin support access
    if (profile.role === 'sow_admin' && newCompanyId && newCompanyId !== profile.company_id) {
      await supabase.from('support_access_logs').insert({
        sow_admin_user_id: profile.user_id,
        company_id: newCompanyId,
        reason: reason ?? 'Acesso de suporte/administração',
      });
    }
    await refreshProfile();
  }, [profile, refreshProfile]);

  return { company, companies, departments, units, users, objectives, indicators, loading, reload: load, companyId, switchCompany };
}
