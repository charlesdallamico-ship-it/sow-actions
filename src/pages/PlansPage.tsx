import { useEffect, useState, useMemo } from 'react';
import { ClipboardList, Search, LayoutGrid, List } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Badge, ProgressBar, EmptyState, Select } from '@/lib/ui';
import { STATUS_LABELS, STATUS_COLORS, KANBAN_COLUMNS, PRIORITIES } from '@/lib/constants';
import { formatDate, daysUntil, isOverdue, cn } from '@/lib/utils';
import type { Fact, Action, ActionStatus } from '@/lib/types';

export function PlansPage({ onOpenFact }: { onOpenFact: (id: string) => void }) {
  const { companyId, users, departments, objectives } = useCompanyData();
  const [facts, setFacts] = useState<Fact[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [filters, setFilters] = useState({ search: '', status: '', responsible: '', department: '', priority: '', objective: '' });

  const load = async () => {
    if (!companyId) return;
    const { data: f } = await supabase.from('facts').select('*').eq('company_id', companyId);
    const { data: a } = await supabase.from('actions').select('*').eq('company_id', companyId);
    setFacts((f as Fact[] | undefined) ?? []);
    setActions((a as Action[] | undefined) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const factMap = useMemo(() => new Map(facts.map((f) => [f.id, f])), [facts]);

  const filtered = useMemo(() => {
    return actions.filter((a) => {
      const f = factMap.get(a.fact_id);
      if (!f) return false;
      if (filters.search && !a.description.toLowerCase().includes(filters.search.toLowerCase()) && !f.fato.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.status && a.status !== filters.status) return false;
      if (filters.responsible && a.responsible_id !== filters.responsible) return false;
      if (filters.department && f.department_id !== filters.department) return false;
      if (filters.priority && f.priority !== filters.priority) return false;
      if (filters.objective && f.objective_id !== filters.objective) return false;
      return true;
    });
  }, [actions, factMap, filters]);

  if (loading) return <div className="text-slate-400">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planos de Ação</h1>
          <p className="text-sm text-slate-500 mt-0.5">Todas as ações em lista e kanban</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setView('list')} className={cn('px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1.5', view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}><List size={16} /> Lista</button>
          <button onClick={() => setView('kanban')} className={cn('px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1.5', view === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}><LayoutGrid size={16} /> Kanban</button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Buscar..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sow-500 outline-none" />
          </div>
          <Select value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} placeholder="Todos status" options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          <Select value={filters.responsible} onChange={(v) => setFilters({ ...filters, responsible: v })} placeholder="Responsável" options={users.map((u) => ({ value: u.id, label: u.full_name }))} />
          <Select value={filters.department} onChange={(v) => setFilters({ ...filters, department: v })} placeholder="Departamento" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          <Select value={filters.priority} onChange={(v) => setFilters({ ...filters, priority: v })} placeholder="Prioridade" options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
        </div>
      </Card>

      {view === 'list' ? (
        filtered.length === 0 ? (
          <Card><EmptyState icon={<ClipboardList size={28} />} title="Nenhuma ação" message="Não há ações com os filtros selecionados." /></Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="px-4 py-3 font-medium">Ação</th><th className="px-4 py-3 font-medium">Fato</th><th className="px-4 py-3 font-medium">Responsável</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Prazo</th><th className="px-4 py-3 font-medium">Progresso</th>
              </tr></thead>
              <tbody>
                {filtered.map((a) => {
                  const f = factMap.get(a.fact_id);
                  const resp = users.find((u) => u.id === a.responsible_id);
                  const d = daysUntil(a.deadline);
                  const overdue = isOverdue(a.deadline, a.status);
                  return (
                    <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => f && onOpenFact(f.id)}>
                      <td className="px-4 py-3 max-w-xs"><div className="font-medium text-slate-700 truncate">{a.description}</div></td>
                      <td className="px-4 py-3"><span className="text-xs text-slate-400 font-mono">{f?.code}</span></td>
                      <td className="px-4 py-3 text-slate-600">{resp?.full_name ?? '-'}</td>
                      <td className="px-4 py-3"><Badge className={cn(STATUS_COLORS[a.status].bg, STATUS_COLORS[a.status].text)}>{STATUS_LABELS[a.status]}</Badge></td>
                      <td className="px-4 py-3"><span className={cn(overdue && 'text-red-600 font-medium')}>{formatDate(a.deadline)}</span>{d !== null && a.status !== 'concluida' && <span className={cn('text-xs ml-1', overdue ? 'text-red-500' : 'text-slate-400')}>({d > 0 ? `${d}d` : d === 0 ? 'hoje' : `${Math.abs(d)}d`})</span>}</td>
                      <td className="px-4 py-3 w-32"><div className="flex items-center gap-2"><ProgressBar value={a.progress_percent} className="flex-1" /><span className="text-xs text-slate-500 w-8">{a.progress_percent}%</span></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {KANBAN_COLUMNS.map((col) => {
              const colActions = filtered.filter((a) => a.status === col || (col === 'atrasada' && isOverdue(a.deadline, a.status) && a.status !== 'concluida' && a.status !== 'cancelada'));
              return (
                <div key={col} className="w-72 shrink-0">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2"><span className={cn('w-2.5 h-2.5 rounded-full', STATUS_COLORS[col].dot)} /><span className="text-sm font-semibold text-slate-700">{STATUS_LABELS[col]}</span></div>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{colActions.length}</span>
                  </div>
                  <div className="space-y-2 bg-slate-50 rounded-lg p-2 min-h-[200px]">
                    {colActions.map((a) => {
                      const f = factMap.get(a.fact_id);
                      const resp = users.find((u) => u.id === a.responsible_id);
                      return (
                        <div key={a.id} className="bg-white rounded-lg p-3 shadow-sm border border-slate-200 hover:shadow-md transition cursor-pointer" onClick={() => f && onOpenFact(f.id)}>
                          <div className="text-xs text-slate-400 font-mono mb-1">{f?.code}</div>
                          <p className="text-sm font-medium text-slate-700 mb-2 line-clamp-2">{a.description}</p>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 truncate">{resp?.full_name ?? 'Sem responsável'}</span>
                            <span className="text-slate-400">{formatDate(a.deadline)}</span>
                          </div>
                          <ProgressBar value={a.progress_percent} className="mt-2" />
                        </div>
                      );
                    })}
                    {colActions.length === 0 && <div className="text-center py-8 text-xs text-slate-300">Vazio</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
