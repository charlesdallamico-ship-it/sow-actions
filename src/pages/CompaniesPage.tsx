import { useEffect, useState } from 'react';
import { Building2, Plus, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Button, Input, Textarea, Modal, EmptyState, Badge } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { Company } from '@/lib/types';

const DEFAULT_COLORS = ['#0f766e', '#1e293b', '#0369a1', '#7c2d12', '#4d7c0f', '#9d174d'];

export function CompaniesPage() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', segment: '', primary_color: '#0f766e', secondary_color: '#1e293b', mission: '', vision: '', values: '', logo_url: '' });

  const load = async () => {
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
    setCompanies((data as Company[] | undefined) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: '', segment: '', primary_color: '#0f766e', secondary_color: '#1e293b', mission: '', vision: '', values: '', logo_url: '' }); setModal(true); };
  const openEdit = (c: Company) => { setEditing(c); setForm({ name: c.name, segment: c.segment ?? '', primary_color: c.primary_color ?? '#0f766e', secondary_color: c.secondary_color ?? '#1e293b', mission: c.mission ?? '', vision: c.vision ?? '', values: c.values ?? '', logo_url: c.logo_url ?? '' }); setModal(true); };

  const save = async () => {
    if (!form.name) return;
    if (editing) { const { error } = await supabase.from('companies').update(form).eq('id', editing.id); if (error) { alert(error.message); return; } }
    else { const { error } = await supabase.from('companies').insert(form); if (error) { alert(error.message); return; } }
    setModal(false);
    load();
  };

  const remove = async (c: Company) => {
    if (!confirm(`Remover a empresa "${c.name}"? Todas as informações serão perdidas.`)) return;
    const { error } = await supabase.from('companies').delete().eq('id', c.id);
    if (error) { alert(error.message); return; }
    load();
  };

  if (profile?.role !== 'sow_admin') {
    return <EmptyState icon={<Building2 size={24} />} title="Acesso restrito" message="Apenas administradores da SOW Consultoria podem gerenciar empresas." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cadastro de empresas clientes</p>
        </div>
        <Button onClick={openNew}><Plus size={18} /> Nova empresa</Button>
      </div>

      {loading ? <div className="text-slate-400">Carregando...</div> : companies.length === 0 ? (
        <Card><EmptyState icon={<Building2 size={28} />} title="Nenhuma empresa" message="Cadastre a primeira empresa cliente para começar." /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c) => (
            <Card key={c.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {c.logo_url ? <img src={c.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: c.primary_color ?? '#0f766e' }}>{c.name.charAt(0)}</div>}
                  <div>
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.segment || 'Sem segmento'}</div>
                  </div>
                </div>
                <Badge className={c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{c.active ? 'Ativa' : 'Inativa'}</Badge>
              </div>
              <div className="flex gap-2 mb-3">
                <div className="w-6 h-6 rounded" style={{ backgroundColor: c.primary_color ?? '#0f766e' }} title="Cor primária" />
                <div className="w-6 h-6 rounded" style={{ backgroundColor: c.secondary_color ?? '#1e293b' }} title="Cor secundária" />
              </div>
              {c.mission && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{c.mission}</p>}
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => openEdit(c)}><Edit2 size={14} /> Editar</Button>
                <Button variant="ghost" size="sm" onClick={() => remove(c)} className="text-red-600 hover:bg-red-50"><Trash2 size={14} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar empresa' : 'Nova empresa'} size="lg">
        <div className="space-y-4">
          <Input label="Nome da empresa" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="Ex: Tech Solutions Ltda" />
          <Input label="Segmento de atuação" value={form.segment} onChange={(v) => setForm({ ...form, segment: v })} placeholder="Ex: Tecnologia, Indústria, Varejo" />
          <Input label="URL do logotipo" value={form.logo_url} onChange={(v) => setForm({ ...form, logo_url: v })} placeholder="https://..." />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cor primária</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer border border-slate-300" />
                <span className="text-sm text-slate-600">{form.primary_color}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cor secundária</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer border border-slate-300" />
                <span className="text-sm text-slate-600">{form.secondary_color}</span>
              </div>
            </div>
          </div>
          <Textarea label="Missão" value={form.mission} onChange={(v) => setForm({ ...form, mission: v })} rows={2} />
          <Textarea label="Visão" value={form.vision} onChange={(v) => setForm({ ...form, vision: v })} rows={2} />
          <Textarea label="Valores" value={form.values} onChange={(v) => setForm({ ...form, values: v })} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? 'Salvar' : 'Criar empresa'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
