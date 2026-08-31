import { useState } from 'react';
import { Users as UsersIcon, Plus, Trash2, Building, UserPlus, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Button, Input, Modal, EmptyState, Badge } from '@/lib/ui';
import { cn } from '@/lib/utils';

export function TeamsPage() {
  const { profile } = useAuth();
  const { departments, units, users, teams, teamMembers, reload, companyId } = useCompanyData();
  const [tab, setTab] = useState<'teams' | 'departments' | 'units'>('teams');
  const [modal, setModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const canManage = profile?.role === 'sow_admin' || profile?.role === 'company_admin';

  const closeModal = () => {
    setModal(false);
    setEditingTeam(null);
    setForm({ name: '', description: '' });
    setSelectedMembers([]);
  };

  const openNew = () => {
    setEditingTeam(null);
    setForm({ name: '', description: '' });
    setSelectedMembers([]);
    setModal(true);
  };

  const save = async () => {
    if (!form.name || !companyId) return;
    if (tab === 'teams') {
      if (editingTeam) {
        const { error } = await supabase.from('teams').update({ name: form.name, description: form.description || null, updated_at: new Date().toISOString() }).eq('id', editingTeam);
        if (error) { alert(error.message); return; }
        await supabase.from('team_members').delete().eq('team_id', editingTeam);
        if (selectedMembers.length) await supabase.from('team_members').insert(selectedMembers.map((profileId) => ({ company_id: companyId, team_id: editingTeam, profile_id: profileId })));
      } else {
      const { data, error } = await supabase.from('teams').insert({ company_id: companyId, name: form.name, description: form.description || null, created_by: profile?.id ?? null }).select('id').single();
      if (error || !data) { alert(error?.message ?? 'Não foi possível criar a equipe.'); return; }
      if (selectedMembers.length) {
        const { error: memberError } = await supabase.from('team_members').insert(selectedMembers.map((profileId) => ({ company_id: companyId, team_id: data.id, profile_id: profileId })));
        if (memberError) { alert(memberError.message); return; }
      }
      }
    } else {
      const table = tab === 'departments' ? 'departments' : 'units';
      const { error } = await supabase.from(table).insert({ company_id: companyId, name: form.name });
      if (error) { alert(error.message); return; }
    }
    closeModal(); reload();
  };
  const openEditTeam = (teamId: string) => { const team = teams.find((item) => item.id === teamId); if (!team) return; setEditingTeam(teamId); setForm({ name: team.name, description: team.description ?? '' }); setSelectedMembers(teamMembers.filter((m) => m.team_id === teamId).map((m) => m.profile_id)); setModal(true); };
  const del = async (id: string) => {
    if (!confirm('Remover?')) return;
    const table = tab === 'teams' ? 'teams' : tab === 'departments' ? 'departments' : 'units';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { alert(error.message); return; }
    reload();
  };

  const list = tab === 'teams' ? teams : tab === 'departments' ? departments : units;
  return <div className="space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Equipes</h1><p className="text-sm text-slate-500 mt-0.5">Equipes, departamentos e unidades da empresa</p></div>{canManage && <Button onClick={openNew}><Plus size={18} /> Novo {tab === 'teams' ? 'equipe' : tab === 'departments' ? 'departamento' : 'unidade'}</Button>}</div>
    <div className="flex gap-1 border-b border-slate-200">{[{ id: 'teams', label: 'Equipes' }, { id: 'departments', label: 'Departamentos' }, { id: 'units', label: 'Unidades/Filiais' }].map((t) => <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition', tab === t.id ? 'border-sow-600 text-sow-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>{t.label}</button>)}</div>
    {list.length === 0 ? <Card><EmptyState icon={tab === 'units' ? <Building size={28} /> : <UsersIcon size={28} />} title="Nenhum registro" message={`Cadastre ${tab === 'teams' ? 'equipes' : tab === 'departments' ? 'departamentos' : 'unidades'} para organizar as ações.`} /></Card> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{list.map((item) => { const members = tab === 'teams' ? teamMembers.filter((m) => m.team_id === item.id) : []; return <Card key={item.id} className="p-5"><div className="flex items-start justify-between mb-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-sow-50 text-sow-600 flex items-center justify-center">{tab === 'units' ? <Building size={18} /> : <UsersIcon size={18} />}</div><div><div className="font-semibold text-slate-900">{item.name}</div><div className="text-xs text-slate-500">{tab === 'teams' ? `${members.length} membro(s)` : tab === 'departments' ? `${users.filter((u) => u.department_id === item.id).length} usuário(s)` : 'Unidade/filial'}</div></div></div>{canManage && <div className="flex gap-2">{tab === 'teams' && <button onClick={() => openEditTeam(item.id)} className="text-slate-400 hover:text-sow-600" aria-label={`Editar equipe ${item.name}`}><Pencil size={16} /></button>}<button onClick={() => del(item.id)} className="text-slate-300 hover:text-red-500" aria-label={`Remover ${item.name}`}><Trash2 size={16} /></button></div>}</div>{tab === 'teams' && (members.length > 0 ? <div className="flex flex-wrap gap-1">{members.map((m) => { const u = users.find((x) => x.id === m.profile_id); return <Badge key={m.id} className="bg-slate-100 text-slate-600">{u?.full_name ?? 'Usuário'}</Badge>; })}</div> : <p className="text-xs text-slate-400">Sem usuários vinculados</p>)}</Card>; })}</div>}
    <Modal open={modal} onClose={closeModal} title={`${editingTeam ? 'Editar' : 'Novo'} ${tab === 'teams' ? 'equipe' : tab === 'departments' ? 'departamento' : 'unidade'}`} size={tab === 'teams' ? 'lg' : 'md'}><div className="space-y-4"><Input label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder={tab === 'teams' ? 'Ex: Comercial' : tab === 'departments' ? 'Ex: Operações' : 'Ex: Filial São Paulo'} />{tab === 'teams' && <><Input label="Descrição" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Objetivo ou escopo da equipe" /><div><div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1"><UserPlus size={16} /> Usuários da equipe <span className="text-xs font-normal text-slate-400">(opcional)</span></div><p className="text-xs text-slate-500 mb-2">Crie a equipe agora e vincule nenhum, um ou vários usuários. Um usuário pode participar de várias equipes.</p><div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">{users.length === 0 ? <div className="p-3 text-sm text-slate-500">Nenhum usuário disponível. A equipe poderá ser criada sem participantes.</div> : users.map((u) => <label key={u.id} className="flex items-center gap-2 p-2.5 text-sm hover:bg-slate-50 cursor-pointer"><input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={() => setSelectedMembers((current) => current.includes(u.id) ? current.filter((id) => id !== u.id) : [...current, u.id])} />{u.full_name}<span className="text-xs text-slate-400">{u.email}</span></label>)}</div></div></>}{<div className="flex justify-end gap-2"><Button variant="outline" onClick={closeModal}>Cancelar</Button><Button onClick={save}>{editingTeam ? 'Salvar' : 'Criar'}</Button></div>}</div></Modal>
  </div>;
}
