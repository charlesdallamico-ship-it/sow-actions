import { useEffect, useState, useMemo } from 'react';
import { Plus, Lightbulb, Search, Trash2, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Button, Input, Textarea, Select, Modal, EmptyState, Badge, ProgressBar } from '@/lib/ui';
import { CAUSE_TYPES, IMPACT_TYPES, IMPACT_LEVELS, ACTION_CATEGORIES, PRIORITIES } from '@/lib/constants';
import { formatDate, weightedProgress, priorityColor, cn } from '@/lib/utils';
import type { Fact, Action } from '@/lib/types';

export function FactsPage({ onOpenFact }: { onOpenFact: (id: string) => void }) {
  const { profile } = useAuth();
  const { companyId, departments, units, objectives } = useCompanyData();
  const [facts, setFacts] = useState<Fact[]>([]);
  const [actionsMap, setActionsMap] = useState<Record<string, Action[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    fato: '', causa: '', cause_type: '', impact_type: '', impact_level: '', expected_result: '',
    objective_id: '', department_id: '', unit_id: '', category: '', priority: 'media', origin_date: new Date().toISOString().split('T')[0],
  });

  const canEdit = profile?.role !== 'viewer';

  const load = async () => {
    if (!companyId) return;
    const { data: f } = await supabase.from('facts').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    const factsData = (f as Fact[] | undefined) ?? [];
    setFacts(factsData);
    if (factsData.length) {
      const { data: acts } = await supabase.from('actions').select('*').in('fact_id', factsData.map((x) => x.id));
      const map: Record<string, Action[]> = {};
      for (const a of (acts as Action[] | undefined) ?? []) {
        (map[a.fact_id] ??= []).push(a);
      }
      setActionsMap(map);
    } else {
      setActionsMap({});
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const filtered = useMemo(() => facts.filter((f) => {
    const q = search.toLowerCase();
    return f.fato.toLowerCase().includes(q) || f.causa.toLowerCase().includes(q) || f.code.toLowerCase().includes(q);
  }), [facts, search]);

  const save = async () => {
    if (!form.fato || !form.causa || !form.objective_id || !companyId) { alert('Selecione um objetivo estratégico para vincular o fato.'); return; }
    const { data: codeData } = await supabase.rpc('next_fact_code', { company_uuid: companyId });
    const code = (codeData as string) || `FATO-0001`;
    const { data, error } = await supabase.from('facts').insert({
      company_id: companyId, code, fato: form.fato, causa: form.causa, cause_type: form.cause_type || null,
      impact_type: form.impact_type || null, impact_level: form.impact_level || null, expected_result: form.expected_result || null,
      objective_id: form.objective_id || null, department_id: form.department_id || null, unit_id: form.unit_id || null,
      category: form.category || null, priority: form.priority, origin_date: form.origin_date, created_by: profile?.user_id,
    }).select().single();
    if (error) { alert(error.message); return; }
    setModal(false);
    setForm({ fato: '', causa: '', cause_type: '', impact_type: '', impact_level: '', expected_result: '', objective_id: '', department_id: '', unit_id: '', category: '', priority: 'media', origin_date: new Date().toISOString().split('T')[0] });
    load();
    if (data) onOpenFact((data as Fact).id);
  };

  const remove = async (f: Fact) => { if (!confirm('Remover este fato e todas as suas ações?')) return; const { error } = await supabase.from('facts').delete().eq('id', f.id); if (error) { alert(error.message); return; } load(); };

  if (loading) return <div className="text-slate-400">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fatos e Causas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registros de fatos que originam ações</p>
        </div>
        {canEdit && <Button onClick={() => setModal(true)}><Plus size={18} /> Novo fato</Button>}
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar fatos..." className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sow-500 focus:border-sow-500 outline-none" />
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={<Lightbulb size={28} />} title="Nenhum fato registrado" message="Cadastre o primeiro fato para iniciar um plano de ação." /></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => {
            const acts = actionsMap[f.id] ?? [];
            const progress = weightedProgress(acts);
            const prio = PRIORITIES.find((p) => p.value === f.priority);
            return (
              <Card key={f.id} className="p-5 hover:shadow-md transition cursor-pointer" >
                <div className="flex items-start justify-between gap-4" onClick={() => onOpenFact(f.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge className="bg-slate-100 text-slate-600 font-mono">{f.code}</Badge>
                      <Badge className={priorityColor(f.priority)}>{prio?.label}</Badge>
                      {f.impact_level && <Badge className="bg-amber-100 text-amber-700">Impacto: {IMPACT_LEVELS.find((i) => i.value === f.impact_level)?.label}</Badge>}
                      {f.category && <Badge className="bg-slate-100 text-slate-500">{f.category}</Badge>}
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1 line-clamp-2">{f.fato}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2 mb-2"><span className="font-medium text-slate-600">Causa: </span>{f.causa}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>{formatDate(f.origin_date)}</span>
                      <span>{acts.length} ação(ões)</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="w-28"><div className="text-xs text-slate-500 mb-1 text-right">{progress}%</div><ProgressBar value={progress} /></div>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); onOpenFact(f.id); }} className="p-1.5 text-slate-400 hover:text-sow-600 rounded"><Eye size={16} /></button>
                      {canEdit && <button onClick={(e) => { e.stopPropagation(); remove(f); }} className="p-1.5 text-slate-300 hover:text-red-500 rounded"><Trash2 size={16} /></button>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Novo fato — registro" size="xl">
        <div className="space-y-5">
          <div className="bg-sow-50 border border-sow-200 rounded-lg p-3 text-sm text-sow-800">
            Método: <strong>Fato → Causa → Ação → Responsável → Prazo → Acompanhamento → Resultado</strong>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label="Objetivo estratégico" value={form.objective_id} onChange={(v) => setForm({ ...form, objective_id: v })} placeholder="Selecione um objetivo" required options={objectives.map((o) => ({ value: o.id, label: o.name }))} />
            <Select label="Departamento" value={form.department_id} onChange={(v) => setForm({ ...form, department_id: v })} placeholder="Sem departamento" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
            <Select label="Unidade/Filial" value={form.unit_id} onChange={(v) => setForm({ ...form, unit_id: v })} placeholder="Sem unidade" options={units.map((u) => ({ value: u.id, label: u.name }))} />
            <Select label="Categoria" value={form.category} onChange={(v) => setForm({ ...form, category: v })} placeholder="Selecione" options={ACTION_CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
            <Select label="Prioridade" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
            <Input label="Data de origem" type="date" value={form.origin_date} onChange={(v) => setForm({ ...form, origin_date: v })} />
          </div>
          <Textarea label="Fato — O que aconteceu ou o que originou a necessidade da ação?" value={form.fato} onChange={(v) => setForm({ ...form, fato: v })} required rows={3} placeholder="Ex: Perda de participação de mercado em Santa Catarina no último mês." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Textarea label="Causa — Por que esse fato aconteceu ou por que é importante?" value={form.causa} onChange={(v) => setForm({ ...form, causa: v })} required rows={3} placeholder="Ex: Redução da cobertura comercial e ausência de campanhas." />
            <div className="space-y-4">
              <Select label="Classificação da causa" value={form.cause_type} onChange={(v) => setForm({ ...form, cause_type: v })} placeholder="Selecione" options={CAUSE_TYPES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
              <Select label="Tipo de impacto" value={form.impact_type} onChange={(v) => setForm({ ...form, impact_type: v })} placeholder="Selecione" options={IMPACT_TYPES.map((i) => ({ value: i, label: i.charAt(0).toUpperCase() + i.slice(1) }))} />
              <Select label="Nível do impacto" value={form.impact_level} onChange={(v) => setForm({ ...form, impact_level: v })} placeholder="Selecione" options={IMPACT_LEVELS.map((i) => ({ value: i.value, label: i.label }))} />
            </div>
          </div>
          <Textarea label="Resultado esperado" value={form.expected_result} onChange={(v) => setForm({ ...form, expected_result: v })} rows={2} placeholder="Ex: Recuperar a participação de mercado e aumentar o faturamento." />
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={save}>Registrar fato</Button></div>
        </div>
      </Modal>
    </div>
  );
}
