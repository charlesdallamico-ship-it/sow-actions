import { useEffect, useState, useMemo } from 'react';
import { CheckSquare, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Badge, ProgressBar, EmptyState } from '@/lib/ui';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';
import { formatDate, daysUntil, isOverdue, cn } from '@/lib/utils';
import type { Fact, Action } from '@/lib/types';

export function TasksPage({ onOpenFact }: { onOpenFact: (id: string) => void }) {
  const { profile } = useAuth();
  const { companyId, users } = useCompanyData();
  const [facts, setFacts] = useState<Fact[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'pending' | 'overdue' | 'concluded'>('all');

  useEffect(() => {
    if (!companyId || !profile) return;
    (async () => {
      const { data: a } = await supabase.from('actions').select('*').eq('company_id', companyId).eq('responsible_id', profile.id);
      const actionsData = (a as Action[] | undefined) ?? [];
      setActions(actionsData);
      if (actionsData.length) {
        const { data: f } = await supabase.from('facts').select('*').in('id', actionsData.map((x) => x.fact_id));
        setFacts((f as Fact[] | undefined) ?? []);
      }
      setLoading(false);
    })();
  }, [companyId, profile]);

  const factMap = useMemo(() => new Map(facts.map((f) => [f.id, f])), [facts]);

  const filtered = useMemo(() => {
    if (tab === 'pending') return actions.filter((a) => a.status !== 'concluida' && a.status !== 'cancelada');
    if (tab === 'overdue') return actions.filter((a) => isOverdue(a.deadline, a.status));
    if (tab === 'concluded') return actions.filter((a) => a.status === 'concluida');
    return actions;
  }, [actions, tab]);

  if (loading) return <div className="text-slate-400">Carregando...</div>;

  const counts = {
    all: actions.length,
    pending: actions.filter((a) => a.status !== 'concluida' && a.status !== 'cancelada').length,
    overdue: actions.filter((a) => isOverdue(a.deadline, a.status)).length,
    concluded: actions.filter((a) => a.status === 'concluida').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Minhas Tarefas</h1>
        <p className="text-sm text-slate-500 mt-0.5">Ações atribuídas a você</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'all', label: 'Todas', count: counts.all, icon: CheckSquare },
          { id: 'pending', label: 'Pendentes', count: counts.pending, icon: Clock },
          { id: 'overdue', label: 'Atrasadas', count: counts.overdue, icon: AlertTriangle },
          { id: 'concluded', label: 'Concluídas', count: counts.concluded, icon: CheckCircle2 },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition', tab === t.id ? 'bg-sow-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}>
            <t.icon size={16} /> {t.label} <span className={cn('text-xs px-1.5 rounded-full', tab === t.id ? 'bg-white/20' : 'bg-slate-100')}>{t.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={<CheckSquare size={28} />} title="Nenhuma tarefa" message="Você não tem tarefas nesta categoria." /></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const f = factMap.get(a.fact_id);
            const d = daysUntil(a.deadline);
            const overdue = isOverdue(a.deadline, a.status);
            return (
              <Card key={a.id} className="p-4 hover:shadow-md transition cursor-pointer" >
                <div onClick={() => f && onOpenFact(f.id)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={cn(STATUS_COLORS[a.status].bg, STATUS_COLORS[a.status].text)}>{STATUS_LABELS[a.status]}</Badge>
                        {f && <span className="text-xs text-slate-400 font-mono">{f.code}</span>}
                        {overdue && <Badge className="bg-red-100 text-red-700">Atrasada</Badge>}
                        {a.approval_status === 'pending' && <Badge className="bg-violet-100 text-violet-700">Aguardando aprovação</Badge>}
                      </div>
                      <h3 className="font-semibold text-slate-900 mb-1">{a.description}</h3>
                      {f && <p className="text-sm text-slate-500 line-clamp-1">{f.fato}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn('text-sm font-medium', overdue ? 'text-red-600' : 'text-slate-600')}>{formatDate(a.deadline)}</div>
                      {d !== null && a.status !== 'concluida' && <div className={cn('text-xs', overdue ? 'text-red-500' : 'text-slate-400')}>{d > 0 ? `${d} dias restantes` : d === 0 ? 'Vence hoje' : `${Math.abs(d)} dias de atraso`}</div>}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <ProgressBar value={a.progress_percent} className="flex-1" />
                    <span className="text-sm font-medium text-slate-600 w-10">{a.progress_percent}%</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
