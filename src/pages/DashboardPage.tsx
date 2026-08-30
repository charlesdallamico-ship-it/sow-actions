import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { FileText, ListTodo, CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Badge, ProgressBar, EmptyState } from '@/lib/ui';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';
import { isOverdue, daysUntil, weightedProgress, cn, priorityColor } from '@/lib/utils';
import type { Fact, Action } from '@/lib/types';

const PIE_COLORS = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function DashboardPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { profile } = useAuth();
  const { companyId, users, departments } = useCompanyData();
  const [facts, setFacts] = useState<Fact[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const [f, a] = await Promise.all([
        supabase.from('facts').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
        supabase.from('actions').select('*').eq('company_id', companyId),
      ]);
      setFacts(f.data as Fact[] | undefined ?? []);
      setActions(a.data as Action[] | undefined ?? []);
      setLoading(false);
    })();
  }, [companyId]);

  const stats = useMemo(() => {
    const concluded = actions.filter((a) => a.status === 'concluida');
    const inProgress = actions.filter((a) => ['em_andamento', 'em_planejamento'].includes(a.status));
    const overdue = actions.filter((a) => isOverdue(a.deadline, a.status) || a.status === 'atrasada');
    const critical = actions.filter((a) => a.fact_id && facts.find((f) => f.id === a.fact_id)?.priority === 'critica' && a.status !== 'concluida' && a.status !== 'cancelada');
    const avgProgress = actions.length ? Math.round(actions.reduce((s, a) => s + a.progress_percent, 0) / actions.length) : 0;
    const dueSoon = actions.filter((a) => {
      const d = daysUntil(a.deadline);
      return d !== null && d >= 0 && d <= 7 && a.status !== 'concluida' && a.status !== 'cancelada';
    });
    return {
      facts: facts.length,
      actions: actions.length,
      concluded: concluded.length,
      inProgress: inProgress.length,
      overdue: overdue.length,
      critical: critical.length,
      avgProgress,
      dueSoon: dueSoon.length,
    };
  }, [facts, actions]);

  const byDepartment = useMemo(() => {
    const map = new Map<string, { name: string; total: number; concluded: number }>();
    for (const f of facts) {
      const dept = departments.find((d) => d.id === f.department_id);
      const name = dept?.name ?? 'Sem departamento';
      const entry = map.get(name) ?? { name, total: 0, concluded: 0 };
      const fActions = actions.filter((a) => a.fact_id === f.id);
      entry.total += fActions.length;
      entry.concluded += fActions.filter((a) => a.status === 'concluida').length;
      map.set(name, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [facts, actions, departments]);

  const byStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of actions) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
    return Array.from(counts.entries()).map(([status, value]) => ({ name: STATUS_LABELS[status as keyof typeof STATUS_LABELS], value }));
  }, [actions]);

  const monthly = useMemo(() => {
    const map = new Map<string, string>();
    const months: { month: string; criadas: number; concluidas: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'short' });
      months.push({ month: label, criadas: 0, concluidas: 0 });
      map.set(key, label);
    }
    const idx = new Map(months.map((m) => [m.month, m]));
    for (const a of actions) {
      const d = new Date(a.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = map.get(key);
      if (label) { const m = idx.get(label)!; m.criadas++; }
      if (a.status === 'concluida' && a.approved_at) {
        const cd = new Date(a.approved_at);
        const ckey = `${cd.getFullYear()}-${cd.getMonth()}`;
        const clabel = map.get(ckey);
        if (clabel) { const m = idx.get(clabel)!; m.concluidas++; }
      }
    }
    return months;
  }, [actions]);

  const ranking = useMemo(() => {
    const map = new Map<string, { name: string; total: number; concluded: number; progress: number }>();
    for (const u of users) map.set(u.id, { name: u.full_name, total: 0, concluded: 0, progress: 0 });
    for (const a of actions) {
      if (!a.responsible_id) continue;
      const entry = map.get(a.responsible_id);
      if (!entry) continue;
      entry.total++;
      if (a.status === 'concluida') entry.concluded++;
      entry.progress += a.progress_percent;
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, avg: e.total ? Math.round(e.progress / e.total) : 0 }))
      .filter((e) => e.total > 0)
      .sort((a, b) => b.concluded - a.concluded || b.avg - a.avg)
      .slice(0, 5);
  }, [actions, users]);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Carregando...</div>;

  const kpis = [
    { label: 'Fatos registrados', value: stats.facts, icon: FileText, color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Ações abertas', value: stats.actions, icon: ListTodo, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Concluídas', value: stats.concluded, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Em andamento', value: stats.inProgress, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Atrasadas', value: stats.overdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Críticas', value: stats.critical, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Vencendo (7d)', value: stats.dueSoon, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Execução média', value: `${stats.avgProgress}%`, icon: TrendingUp, color: 'text-sow-600', bg: 'bg-sow-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visão geral das ações estratégicas</p>
        </div>
        <button onClick={() => onNavigate('reports')} className="text-sm text-sow-700 font-medium hover:underline">Ver relatórios</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">{k.label}</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{k.value}</div>
              </div>
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', k.bg)}>
                <k.icon size={18} className={k.color} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Evolução mensal</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthly}>
              <defs>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} /><stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} /></linearGradient>
                <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="criadas" name="Criadas" stroke="#0ea5e9" fill="url(#gC)" strokeWidth={2} />
              <Area type="monotone" dataKey="concluidas" name="Concluídas" stroke="#10b981" fill="url(#gD)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Ações por status</h3>
          {byStatus.length === 0 ? (
            <EmptyState icon={<ListTodo size={24} />} title="Sem dados" message="Nenhuma ação cadastrada ainda." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Ações por departamento</h3>
          {byDepartment.length === 0 ? (
            <EmptyState icon={<TrendingUp size={24} />} title="Sem dados" message="Nenhum departamento com ações." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byDepartment}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" name="Total" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="concluded" name="Concluídas" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Ranking de responsáveis</h3>
          {ranking.length === 0 ? (
            <EmptyState icon={<TrendingUp size={24} />} title="Sem dados" message="Nenhuma ação atribuída." />
          ) : (
            <div className="space-y-3">
              {ranking.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0', i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500')}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate">{r.name}</span>
                      <span className="text-xs text-slate-500 shrink-0 ml-2">{r.concluded}/{r.total}</span>
                    </div>
                    <ProgressBar value={r.avg} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Ações vencendo nos próximos 7 dias</h3>
        {(() => {
          const due = actions.filter((a) => { const d = daysUntil(a.deadline); return d !== null && d >= 0 && d <= 7 && a.status !== 'concluida' && a.status !== 'cancelada'; }).sort((a, b) => (daysUntil(a.deadline) ?? 0) - (daysUntil(b.deadline) ?? 0));
          if (!due.length) return <EmptyState icon={<Clock size={24} />} title="Nada vencendo" message="Nenhuma ação vence nos próximos 7 dias." />;
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-medium">Ação</th><th className="pb-2 font-medium">Prazo</th><th className="pb-2 font-medium">Dias</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium">Progresso</th>
                </tr></thead>
                <tbody>
                  {due.map((a) => {
                    const f = facts.find((f) => f.id === a.fact_id);
                    const d = daysUntil(a.deadline) ?? 0;
                    return (
                      <tr key={a.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 max-w-xs"><div className="font-medium text-slate-700 truncate">{a.description}</div>{f && <div className="text-xs text-slate-400 truncate">{f.code}</div>}</td>
                        <td className="py-2.5 text-slate-600">{new Date(a.deadline!).toLocaleDateString('pt-BR')}</td>
                        <td className="py-2.5"><Badge className={d <= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>{d}d</Badge></td>
                        <td className="py-2.5"><Badge className={cn(STATUS_COLORS[a.status].bg, STATUS_COLORS[a.status].text)}>{STATUS_LABELS[a.status]}</Badge></td>
                        <td className="py-2.5 w-32"><ProgressBar value={a.progress_percent} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </Card>
    </div>
  );
}
