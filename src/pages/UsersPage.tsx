import { useState } from 'react';
import { UserCog, Plus, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Button, Input, Select, Modal, EmptyState, Badge } from '@/lib/ui';
import { ROLE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Profile, Role } from '@/lib/types';

export function UsersPage() {
  const { profile } = useAuth();
  const { users, departments, reload, companyId } = useCompanyData();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', role: 'responsible' as Role, department_id: '', position: '', phone: '' });
  const canManage = profile?.role === 'sow_admin' || profile?.role === 'company_admin';

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
    setModal(false); setForm({ full_name: '', email: '', role: 'responsible', department_id: '', position: '', phone: '' }); reload();
  };

  const toggleActive = async (u: Profile) => { const { error } = await supabase.from('profiles').update({ active: !u.active }).eq('id', u.id); if (error) { alert(error.message); return; } reload(); };
  const remove = async (u: Profile) => { if (!confirm(`Remover ${u.full_name}?`)) return; const { error } = await supabase.from('profiles').delete().eq('id', u.id); if (error) { alert(error.message); return; } reload(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Usuários</h1><p className="text-sm text-slate-500 mt-0.5">Gestão de usuários da empresa</p></div>
        {canManage && <Button onClick={() => setModal(true)}><Plus size={18} /> Novo usuário</Button>}
      </div>

      {users.length === 0 ? (
        <Card><EmptyState icon={<UserCog size={28} />} title="Nenhum usuário" message="Cadastre usuários para a empresa." /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Nome</th><th className="px-4 py-3 font-medium">E-mail</th><th className="px-4 py-3 font-medium">Perfil</th><th className="px-4 py-3 font-medium">Departamento</th><th className="px-4 py-3 font-medium">Status</th>{canManage && <th className="px-4 py-3"></th>}
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-sow-600 text-white text-xs font-bold flex items-center justify-center">{u.full_name.charAt(0)}</div><span className="font-medium text-slate-700">{u.full_name}</span></div></td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3"><Badge className="bg-slate-100 text-slate-600">{ROLE_LABELS[u.role]}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{departments.find((d) => d.id === u.department_id)?.name ?? '-'}</td>
                  <td className="px-4 py-3"><Badge className={u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{u.active ? 'Ativo' : 'Inativo'}</Badge></td>
                  {canManage && <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => toggleActive(u)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100">{u.active ? 'Desativar' : 'Ativar'}</button><button onClick={() => remove(u)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button></div></td>}
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
    </div>
  );
}
