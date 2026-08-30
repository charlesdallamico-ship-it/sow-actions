import { useState, useEffect } from 'react';
import { TrendingUp, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Button, Input, Select, Modal, EmptyState, Badge, ProgressBar } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { Indicator } from '@/lib/types';

export function IndicatorsPage() {
  const { profile } = useAuth();
  const { indicators, objectives, reload, companyId } = useCompanyData();
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing] = useState<Indicator | null>(null);
  const [form, setForm] = useState({ name: '', unit: '', current_value: '', target_value: '', achieved_value: '', objective_id: '', measure_date: '' });
  const canEdit = profile?.role !== 'viewer';

  const openEdit = (i: Indicator | null) => {
    setEditing(i);
    setForm({ name: i?.name ?? '', unit: i?.unit ?? '', current_value: String(i?.current_value ?? ''), target_value: String(i?.target_value ?? ''), achieved_value: String(i?.achieved_value ?? ''), objective_id: i?.objective_id ?? '', measure_date: i?.measure_date ?? '' });
    setEditModal(true);
  };

  const save = async () => {
    if (!form.name) return;
    const payload = { name: form.name, unit: form.unit || null, current_value: form.current_value ? Number(form.current_value) : null, target_value: form.target_value ? Number(form.target_value) : null, achieved_value: form.achieved_value ? Number(form.achieved_value) : null, objective_id: form.objective_id || null, measure_date: form.measure_date || null };
    if (editing) { const { error } = await supabase.from('indicators').update(payload).eq('id', editing.id); if (error) { alert(error.message); return; } }
    else if (companyId) { const { error } = await supabase.from('indicators').insert({ ...payload, company_id: companyId }); if (error) { alert(error.message); return; } }
    setEditModal(false); reload();
  };

  const del = async (i: Indicator) => { if (!confirm('Remover indicador?')) return; const { error } = await supabase.from('indicators').delete().eq('id', i.id); if (error) { alert(error.message); return; } reload(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Indicadores</h1><p className="text-sm text-slate-500 mt-0.5">Acompanhamento de metas e resultados</p></div>
        {canEdit && <Button onClick={() => openEdit(null)}>Novo indicador</Button>}
      </div>

      {indicators.length === 0 ? (
        <Card><EmptyState icon={<TrendingUp size={28} />} title="Nenhum indicador" message="Cadastre indicadores para acompanhar resultados." /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {indicators.map((i) => {
            const obj = objectives.find((o) => o.id === i.objective_id);
            const progress = i.target_value && i.current_value ? Math.min(100, Math.round((i.current_value / i.target_value) * 100)) : 0;
            return (
              <Card key={i.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-sow-50 text-sow-600 flex items-center justify-center"><TrendingUp size={18} /></div>
                  {canEdit && <div className="flex gap-1"><button onClick={() => openEdit(i)} className="p-1 text-slate-300 hover:text-slate-600"><Edit2 size={16} /></button><button onClick={() => del(i)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button></div>}
                </div>
                <div className="font-semibold text-slate-900 mb-1">{i.name}</div>
                {obj && <Badge className="bg-slate-100 text-slate-500 mb-3">{obj.name}</Badge>}
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Atual</span><span className="font-medium text-slate-700">{i.current_value ?? '-'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Meta</span><span className="font-medium text-slate-700">{i.target_value ?? '-'}</span></div>
                  {i.achieved_value !== null && <div className="flex justify-between text-sm"><span className="text-slate-500">Alcançado</span><span className="font-medium text-emerald-600">{i.achieved_value}</span></div>}
                  <div className="text-xs text-slate-400">{i.unit ?? ''}</div>
                  <ProgressBar value={progress} />
                  <div className="text-xs text-slate-500 text-right">{progress}% da meta</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={editModal} onClose={() => setEditModal(false)} title={editing ? 'Editar indicador' : 'Novo indicador'} size="lg">
        <div className="space-y-4">
          <Input label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor atual" type="number" value={form.current_value} onChange={(v) => setForm({ ...form, current_value: v })} />
            <Input label="Meta" type="number" value={form.target_value} onChange={(v) => setForm({ ...form, target_value: v })} />
            <Input label="Resultado alcançado" type="number" value={form.achieved_value} onChange={(v) => setForm({ ...form, achieved_value: v })} />
            <Input label="Unidade" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="Ex: clientes, R$" />
            <Input label="Data de medição" type="date" value={form.measure_date} onChange={(v) => setForm({ ...form, measure_date: v })} />
            <Select label="Objetivo" value={form.objective_id} onChange={(v) => setForm({ ...form, objective_id: v })} placeholder="Sem objetivo" options={objectives.map((o) => ({ value: o.id, label: o.name }))} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditModal(false)}>Cancelar</Button><Button onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
