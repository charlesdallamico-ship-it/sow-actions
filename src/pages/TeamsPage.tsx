import { useState } from 'react';
import { Users as UsersIcon, Plus, Trash2, Building } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Button, Input, Modal, EmptyState, Badge } from '@/lib/ui';
import { ROLE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function TeamsPage() {
  const { profile } = useAuth();
  const { departments, units, users, reload, companyId } = useCompanyData();
  const [tab, setTab] = useState<'departments' | 'units'>('departments');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '' });
  const canManage = profile?.role === 'sow_admin' || profile?.role === 'company_admin';

  const save = async () => {
    if (!form.name || !companyId) return;
    if (tab === 'departments') { const { error } = await supabase.from('departments').insert({ company_id: companyId, name: form.name }); if (error) { alert(error.message); return; } }
    else { const { error } = await supabase.from('units').insert({ company_id: companyId, name: form.name }); if (error) { alert(error.message); return; } }
    setModal(false); setForm({ name: '' }); reload();
  };
  const del = async (id: string) => { if (!confirm('Remover?')) return; if (tab === 'departments') { const { error } = await supabase.from('departments').delete().eq('id', id); if (error) { alert(error.message); return; } } else { const { error } = await supabase.from('units').delete().eq('id', id); if (error) { alert(error.message); return; } } reload(); };

  const list = tab === 'departments' ? departments : units;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Equipes</h1><p className="text-sm text-slate-500 mt-0.5">Departamentos e unidades</p></div>
        {canManage && <Button onClick={() => setModal(true)}><Plus size={18} /> Novo {tab === 'departments' ? 'departamento' : 'unidade'}</Button>}
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {[{ id: 'departments', label: 'Departamentos' }, { id: 'units', label: 'Unidades/Filiais' }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition', tab === t.id ? 'border-sow-600 text-sow-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>{t.label}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card><EmptyState icon={tab === 'departments' ? <UsersIcon size={28} /> : <Building size={28} />} title="Nenhum registro" message={`Cadastre ${tab === 'departments' ? 'departamentos' : 'unidades'} para organizar as ações.`} /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((item) => {
            const count = tab === 'departments' ? users.filter((u) => u.department_id === item.id).length : 0;
            return (
              <Card key={item.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-sow-50 text-sow-600 flex items-center justify-center">{tab === 'departments' ? <UsersIcon size={18} /> : <Building size={18} />}</div>
                    <div><div className="font-semibold text-slate-900">{item.name}</div>{tab === 'departments' && <div className="text-xs text-slate-500">{count} usuário(s)</div>}</div>
                  </div>
                  {canManage && <button onClick={() => del(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={`Novo ${tab === 'departments' ? 'departamento' : 'unidade'}`}>
        <div className="space-y-4">
          <Input label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder={tab === 'departments' ? 'Ex: Comercial' : 'Ex: Filial São Paulo'} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={save}>Criar</Button></div>
        </div>
      </Modal>
    </div>
  );
}
