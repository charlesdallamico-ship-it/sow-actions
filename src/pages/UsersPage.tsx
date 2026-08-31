import { useEffect, useState } from 'react';
import { UserCog, Plus, Trash2, UserPlus, Link2, Copy, Check, Power, Users2, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Button, Input, Select, Modal, EmptyState, Badge } from '@/lib/ui';
import { ROLE_LABELS } from '@/lib/constants';
import { SIGNUP_ROLES, signupLinkUrl, listSignupLinks, createSignupLink, toggleSignupLinkActive, deleteSignupLink } from '@/lib/signupLinks';
import { cn } from '@/lib/utils';
import type { Profile, Role, SignupLink, Company } from '@/lib/types';

function UsersTab() {
  const { profile } = useAuth();
  const { users, departments, company, reload, companyId } = useCompanyData();
  const [modal, setModal] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', role: 'responsible' as Role, department_id: '', position: '', phone: '' });
  const [form, setForm] = useState({ full_name: '', email: '', role: 'responsible' as Role, department_id: '', position: '', phone: '' });
  const [delegatedUserManagement, setDelegatedUserManagement] = useState(false);
  const canManage = profile?.role === 'sow_admin' || profile?.role === 'company_admin' || delegatedUserManagement;

  useEffect(() => {
    if (!profile || !companyId || profile.role === 'sow_admin' || profile.role === 'company_admin') return;
    supabase.from('user_permissions').select('can_manage_users').eq('company_id', companyId).eq('user_id', profile.user_id).maybeSingle().then(({ data }) => setDelegatedUserManagement(data?.can_manage_users === true));
  }, [profile, companyId]);

  const roles: Role[] = profile?.role === 'sow_admin' ? ['sow_admin', 'company_admin', 'area_manager', 'responsible', 'viewer'] : ['company_admin', 'area_manager', 'responsible', 'viewer'];

  const createUser = async () => {
    if (!form.full_name || !form.email || !companyId) return;
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`;
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session?.access_token}` },
      body: JSON.stringify({ email: form.email, full_name: form.full_name, company_id: companyId, role: form.role, department_id: form.department_id || null, position: form.position || null, phone: form.phone || null }),
    });
    const result = await res.json();
    if (!res.ok || result.error) { alert(result.error || 'Erro ao criar usuário'); return; }
    if (result.email_sent === false) {
      alert(`Usuário cadastrado, mas o convite não foi enviado. ${result.email_error || 'Verifique a configuração do provedor de e-mail.'}`);
    }
    setModal(false); setForm({ full_name: '', email: '', role: 'responsible', department_id: '', position: '', phone: '' }); reload();
  };

  const toggleActive = async (u: Profile) => { const { error } = await supabase.from('profiles').update({ active: !u.active }).eq('id', u.id); if (error) { alert(error.message); return; } reload(); };
  const remove = async (u: Profile) => { if (!confirm(`Remover ${u.full_name}?`)) return; const { error } = await supabase.from('profiles').delete().eq('id', u.id); if (error) { alert(error.message); return; } reload(); };
  const openEdit = (u: Profile) => { setEditUser(u); setEditForm({ full_name: u.full_name, role: u.role, department_id: u.department_id ?? '', position: u.position ?? '', phone: u.phone ?? '' }); };
  const saveEdit = async () => { if (!editUser || !editForm.full_name) return; const { error } = await supabase.from('profiles').update({ full_name: editForm.full_name, role: editForm.role, department_id: editForm.department_id || null, position: editForm.position || null, phone: editForm.phone || null }).eq('id', editUser.id); if (error) { alert(error.message); return; } setEditUser(null); reload(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><p className="text-sm text-slate-500">Usuários da empresa selecionada</p></div>
        {canManage && <Button onClick={() => setModal(true)}><Plus size={18} /> Novo usuário</Button>}
      </div>

      {users.length === 0 ? (
        <Card><EmptyState icon={<UserCog size={28} />} title="Nenhum usuário" message="Cadastre usuários para a empresa." /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Nome</th><th className="px-4 py-3 font-medium">E-mail</th><th className="px-4 py-3 font-medium">Confirmação</th><th className="px-4 py-3 font-medium">Origem</th><th className="px-4 py-3 font-medium">Perfil</th><th className="px-4 py-3 font-medium">Departamento</th><th className="px-4 py-3 font-medium">Status</th>{canManage && <th className="px-4 py-3"></th>}
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-sow-600 text-white text-xs font-bold flex items-center justify-center">{u.full_name.charAt(0)}</div><span className="font-medium text-slate-700">{u.full_name}</span></div></td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3"><Badge className={u.email_confirmed_at ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>{u.email_confirmed_at ? 'Confirmado' : 'Pendente'}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{u.registration_source === 'manual_assignment' ? 'Atribuição manual' : u.registration_source === 'manual_invite' ? 'Convite manual' : u.registration_source === 'signup_link' ? 'Link da empresa' : 'Cadastro próprio'}</td>
                  <td className="px-4 py-3"><Badge className="bg-slate-100 text-slate-600">{ROLE_LABELS[u.role]}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{departments.find((d) => d.id === u.department_id)?.name ?? '-'}</td>
                  <td className="px-4 py-3"><Badge className={u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{u.active ? 'Ativo' : 'Inativo'}</Badge></td>
                  {canManage && <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => openEdit(u)} className="p-1 text-slate-400 hover:text-sow-600" title="Editar cadastro"><Pencil size={16} /></button><button onClick={() => toggleActive(u)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100">{u.active ? 'Desativar' : 'Ativar'}</button><button onClick={() => remove(u)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button></div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Novo usuário" size="lg">
        <div className="space-y-4">
          <div className="bg-sow-50 rounded-lg p-3 flex items-center gap-2 text-sm text-slate-600"><UserPlus size={18} className="text-sow-600" /> O usuário receberá um convite por e-mail para criar sua própria senha. Não é necessário definir senha manualmente.</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nome completo" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} required />
            <Input label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
            <Select label="Perfil de acesso" value={form.role} onChange={(v) => setForm({ ...form, role: v as Role })} options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
            <Select label="Departamento" value={form.department_id} onChange={(v) => setForm({ ...form, department_id: v })} placeholder="Sem departamento" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
            <Input label="Cargo" value={form.position} onChange={(v) => setForm({ ...form, position: v })} />
            <Input label="Telefone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={createUser}>Enviar convite</Button></div>
        </div>
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Editar cadastro do usuário" size="lg">
        <div className="space-y-4"><div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">Empresa vinculada: <strong>{company?.name ?? 'Empresa selecionada'}</strong>. O usuário permanece vinculado a esta empresa; a alteração da empresa deve ser feita pelo administrador SOW com autorização.</div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Nome completo" value={editForm.full_name} onChange={(v) => setEditForm({ ...editForm, full_name: v })} required /><div><label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label><div className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500">{editUser?.email ?? ''}</div></div><Select label="Perfil de acesso" value={editForm.role} onChange={(v) => setEditForm({ ...editForm, role: v as Role })} options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} /><Select label="Departamento" value={editForm.department_id} onChange={(v) => setEditForm({ ...editForm, department_id: v })} placeholder="Sem departamento" options={departments.map((d) => ({ value: d.id, label: d.name }))} /><Input label="Cargo" value={editForm.position} onChange={(v) => setEditForm({ ...editForm, position: v })} /><Input label="Telefone" value={editForm.phone} onChange={(v) => setEditForm({ ...editForm, phone: v })} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button><Button onClick={saveEdit}>Salvar alterações</Button></div></div>
      </Modal>
    </div>
  );
}

function SignupLinksTab() {
  const { profile } = useAuth();
  const { departments, companyId } = useCompanyData();
  const [links, setLinks] = useState<SignupLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({ role: 'responsible' as Role, department_id: '', label: '', max_uses: '' });

  const load = async () => {
    if (!companyId) { setLinks([]); setLoading(false); return; }
    setLoading(true);
    try { setLinks(await listSignupLinks(companyId)); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [companyId]);

  const create = async () => {
    if (!companyId || !profile) return;
    try {
      await createSignupLink({
        companyId,
        role: form.role,
        departmentId: form.department_id || null,
        label: form.label || null,
        maxUses: form.max_uses ? Number(form.max_uses) : null,
        createdBy: profile.user_id,
      });
      setModal(false);
      setForm({ role: 'responsible', department_id: '', label: '', max_uses: '' });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar link.');
    }
  };

  const copy = async (link: SignupLink) => {
    await navigator.clipboard.writeText(signupLinkUrl(link.token));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggle = async (link: SignupLink) => { await toggleSignupLinkActive(link); load(); };
  const remove = async (link: SignupLink) => { if (!confirm('Excluir este link de cadastro?')) return; await deleteSignupLink(link.id); load(); };

  if (!companyId) return <Card><EmptyState icon={<Link2 size={28} />} title="Selecione uma empresa" message="Escolha uma empresa para gerenciar links de cadastro." /></Card>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Compartilhe um link para que novas pessoas se cadastrem já com empresa e perfil definidos.</p>
        <Button onClick={() => setModal(true)}><Plus size={18} /> Novo link</Button>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Carregando...</div>
      ) : links.length === 0 ? (
        <Card><EmptyState icon={<Link2 size={28} />} title="Nenhum link criado" message="Crie um link de cadastro para convidar pessoas para esta empresa." /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Rótulo</th><th className="px-4 py-3 font-medium">Perfil</th><th className="px-4 py-3 font-medium">Usos</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{l.label || '—'}</td>
                  <td className="px-4 py-3"><Badge className="bg-slate-100 text-slate-600">{ROLE_LABELS[l.role]}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{l.uses_count}{l.max_uses ? ` / ${l.max_uses}` : ''}</td>
                  <td className="px-4 py-3"><Badge className={l.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{l.active ? 'Ativo' : 'Inativo'}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => copy(l)} className="p-1.5 text-slate-400 hover:text-sow-600 rounded" title="Copiar link">
                        {copiedId === l.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      </button>
                      <button onClick={() => toggle(l)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded" title={l.active ? 'Desativar' : 'Ativar'}><Power size={16} /></button>
                      <button onClick={() => remove(l)} className="p-1.5 text-slate-300 hover:text-red-500 rounded" title="Excluir"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Novo link de cadastro">
        <div className="space-y-4">
          <Input label="Rótulo (opcional)" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="Ex: Equipe comercial" />
          <Select label="Perfil de acesso" value={form.role} onChange={(v) => setForm({ ...form, role: v as Role })} options={SIGNUP_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
          <Select label="Departamento (opcional)" value={form.department_id} onChange={(v) => setForm({ ...form, department_id: v })} placeholder="Sem departamento" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          <Input label="Limite de usos (opcional)" type="number" value={form.max_uses} onChange={(v) => setForm({ ...form, max_uses: v })} placeholder="Ilimitado" />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={create}>Criar link</Button></div>
        </div>
      </Modal>
    </div>
  );
}

function OrphanUsersTab() {
  const { companies } = useCompanyData();
  const [orphans, setOrphans] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [assign, setAssign] = useState<Profile | null>(null);
  const [assignForm, setAssignForm] = useState({ company_id: '', role: 'responsible' as Role });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_user_access_overview', { p_company_id: null });
    if (error) { alert(error.message); setLoading(false); return; }
    setOrphans(((data as Profile[] | null) ?? []).filter((u) => !u.company_id && u.company_assignment_status === 'pending'));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAssign = (u: Profile) => { setAssign(u); setAssignForm({ company_id: companies[0]?.id ?? '', role: 'responsible' }); };

  const confirmAssign = async () => {
    if (!assign || !assignForm.company_id) return;
    const { error } = await supabase.rpc('assign_pending_user', { p_profile_id: assign.id, p_company_id: assignForm.company_id, p_role: assignForm.role });
    if (error) { alert(error.message); return; }
    setAssign(null);
    load();
  };

  if (loading) return <div className="text-slate-400 text-sm">Carregando...</div>;

  if (orphans.length === 0) {
    return <Card><EmptyState icon={<Users2 size={28} />} title="Nenhum cadastro pendente" message="Todo mundo que se cadastrou já está atribuído a uma empresa." /></Card>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Pessoas que criaram conta pelo formulário de cadastro mas ainda não foram atribuídas a nenhuma empresa.</p>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
            <th className="px-4 py-3 font-medium">Nome</th><th className="px-4 py-3 font-medium">E-mail</th><th className="px-4 py-3 font-medium">Cadastrado em</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {orphans.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-700">{u.full_name}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => openAssign(u)}>Atribuir empresa</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!assign} onClose={() => setAssign(null)} title={`Atribuir empresa — ${assign?.full_name ?? ''}`}>
        <div className="space-y-4">
          <Select label="Empresa" value={assignForm.company_id} onChange={(v) => setAssignForm({ ...assignForm, company_id: v })} options={companies.map((c: Company) => ({ value: c.id, label: c.name }))} />
          <Select label="Perfil de acesso" value={assignForm.role} onChange={(v) => setAssignForm({ ...assignForm, role: v as Role })} options={['company_admin', 'area_manager', 'responsible', 'viewer'].map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAssign(null)}>Cancelar</Button><Button onClick={confirmAssign}>Atribuir</Button></div>
        </div>
      </Modal>
    </div>
  );
}

export function UsersPage() {
  const { profile } = useAuth();
  const isSowAdmin = profile?.role === 'sow_admin';
  const canManage = profile?.role === 'sow_admin' || profile?.role === 'company_admin';
  const [tab, setTab] = useState<'users' | 'links' | 'orphans'>('users');

  const tabs: { id: 'users' | 'links' | 'orphans'; label: string }[] = [
    { id: 'users', label: 'Usuários' },
    ...(canManage ? [{ id: 'links' as const, label: 'Links de cadastro' }] : []),
    ...(isSowAdmin ? [{ id: 'orphans' as const, label: 'Cadastros sem empresa' }] : []),
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Usuários</h1><p className="text-sm text-slate-500 mt-0.5">Gestão de acessos</p></div>

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-sow-600 text-sow-700' : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'links' && canManage && <SignupLinksTab />}
      {tab === 'orphans' && isSowAdmin && <OrphanUsersTab />}
    </div>
  );
}
