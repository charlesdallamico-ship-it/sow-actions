import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Badge, EmptyState } from '@/lib/ui';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';
import { cn, isOverdue } from '@/lib/utils';
import type { Fact, Action } from '@/lib/types';

export function CalendarPage({ onOpenFact }: { onOpenFact: (id: string) => void }) {
  const { companyId } = useCompanyData();
  const [facts, setFacts] = useState<Fact[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [cursor, setCursor] = useState(new Date());

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data: f } = await supabase.from('facts').select('*').eq('company_id', companyId);
      const { data: a } = await supabase.from('actions').select('*').eq('company_id', companyId);
      setFacts((f as Fact[] | undefined) ?? []);
      setActions((a as Action[] | undefined) ?? []);
    })();
  }, [companyId]);

  const factMap = useMemo(() => new Map(facts.map((f) => [f.id, f])), [facts]);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const arr: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [cursor]);

  const actionsByDate = useMemo(() => {
    const map = new Map<string, Action[]>();
    for (const a of actions) {
      if (!a.deadline) continue;
      const key = a.deadline;
      (map.get(key) ?? map.set(key, []).get(key)!).push(a);
    }
    return map;
  }, [actions]);

  const today = new Date().toDateString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendário</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ações por data de vencimento</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"><ChevronLeft size={20} /></button>
          <span className="text-sm font-semibold text-slate-700 w-40 text-center">{cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"><ChevronRight size={20} /></button>
          <button onClick={() => setCursor(new Date())} className="ml-2 text-sm text-sow-700 font-medium hover:underline">Hoje</button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const key = d.toISOString().split('T')[0];
            const dayActions = actionsByDate.get(key) ?? [];
            const isToday = d.toDateString() === today;
            const inMonth = d.getMonth() === cursor.getMonth();
            return (
              <div key={i} className={cn('min-h-[90px] rounded-lg p-1.5 border', inMonth ? 'bg-white border-slate-100' : 'bg-slate-50 border-transparent', isToday && 'ring-2 ring-sow-500')}>
                <div className={cn('text-xs mb-1', isToday ? 'font-bold text-sow-700' : inMonth ? 'text-slate-500' : 'text-slate-300')}>{d.getDate()}</div>
                <div className="space-y-1">
                  {dayActions.slice(0, 3).map((a) => {
                    const f = factMap.get(a.fact_id);
                    const overdue = isOverdue(a.deadline, a.status);
                    return (
                      <button key={a.id} onClick={() => f && onOpenFact(f.id)} className={cn('w-full text-left text-[10px] px-1.5 py-1 rounded truncate', STATUS_COLORS[a.status].bg, STATUS_COLORS[a.status].text)} title={a.description}>
                        {overdue && '⚠ '}{a.description}
                      </button>
                    );
                  })}
                  {dayActions.length > 3 && <div className="text-[10px] text-slate-400 px-1.5">+{dayActions.length - 3} mais</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {actions.length === 0 && <Card><EmptyState icon={<CalIcon size={28} />} title="Sem ações" message="Nenhuma ação com prazo definido." /></Card>}
    </div>
  );
}
