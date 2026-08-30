import { useEffect, useState } from 'react';
import { X, Bell, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { formatDate, isOverdue, daysUntil, cn } from '@/lib/utils';
import type { Alert, Action, Fact } from '@/lib/types';

export function AlertsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const { companyId } = useCompanyData();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<{ action: Action; fact?: Fact; type: string; message: string }[]>([]);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase.from('alerts').select('*').eq('user_id', profile.user_id).order('created_at', { ascending: false }).limit(50);
    setAlerts((data as Alert[] | undefined) ?? []);
  };

  useEffect(() => { if (open) load(); }, [open, profile]);

  // Generate live alerts from actions
  useEffect(() => {
    if (!companyId || !profile) return;
    (async () => {
      const { data: acts } = await supabase.from('actions').select('*').eq('company_id', companyId).or(`responsible_id.eq.${profile.id},created_by.eq.${profile.user_id}`);
      const actionsData = (acts as Action[] | undefined) ?? [];
      const factIds = actionsData.map((a) => a.fact_id);
      const factsMap = new Map<string, Fact>();
      if (factIds.length) {
        const { data: fs } = await supabase.from('facts').select('*').in('id', factIds);
        for (const f of (fs as Fact[] | undefined) ?? []) factsMap.set(f.id, f);
      }
      const live: { action: Action; fact?: Fact; type: string; message: string }[] = [];
      for (const a of actionsData) {
        if (a.status === 'concluida' || a.status === 'cancelada') continue;
        const d = daysUntil(a.deadline);
        if (isOverdue(a.deadline, a.status)) live.push({ action: a, fact: factsMap.get(a.fact_id), type: 'overdue', message: `Ação atrasada: "${a.description}"` });
        else if (d !== null && d <= 3) live.push({ action: a, fact: factsMap.get(a.fact_id), type: 'due', message: `Vence em ${d}d: "${a.description}"` });
        else if (d !== null && d <= 7) live.push({ action: a, fact: factsMap.get(a.fact_id), type: 'soon', message: `Vence em ${d}d: "${a.description}"` });
        if (a.approval_status === 'pending') live.push({ action: a, fact: factsMap.get(a.fact_id), type: 'approval', message: `Aguardando aprovação: "${a.description}"` });
      }
      setLiveAlerts(live);
    })();
  }, [companyId, profile]);

  const markRead = async (id: string) => { await supabase.from('alerts').update({ read: true }).eq('id', id); load(); };
  const markAll = async () => { if (!profile) return; await supabase.from('alerts').update({ read: true }).eq('user_id', profile.user_id).eq('read', false); load(); };

  if (!open) return null;
  const unread = alerts.filter((a) => !a.read).length;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2"><Bell size={20} className="text-slate-600" /><h2 className="font-semibold text-slate-900">Notificações</h2>{unread > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unread}</span>}</div>
          <div className="flex items-center gap-2">
            {alerts.length > 0 && <button onClick={markAll} className="text-xs text-sow-700 font-medium hover:underline">Marcar todas</button>}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {liveAlerts.length === 0 && alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400"><Bell size={32} className="mb-2" /><p className="text-sm">Nenhuma notificação</p></div>
          ) : (
            <>
              {liveAlerts.map((la, i) => (
                <div key={`live-${i}`} className={cn('rounded-lg p-3 border', la.type === 'overdue' ? 'bg-red-50 border-red-200' : la.type === 'due' ? 'bg-amber-50 border-amber-200' : la.type === 'approval' ? 'bg-violet-50 border-violet-200' : 'bg-sky-50 border-sky-200')}>
                  <div className="text-sm font-medium text-slate-700">{la.message}</div>
                  {la.fact && <div className="text-xs text-slate-400 mt-0.5">{la.fact.code} — {la.fact.fato.substring(0, 50)}</div>}
                  {la.action.deadline && <div className="text-xs text-slate-500 mt-1">Prazo: {formatDate(la.action.deadline)}</div>}
                </div>
              ))}
              {alerts.map((a) => (
                <div key={a.id} className={cn('rounded-lg p-3 border', a.read ? 'bg-white border-slate-100' : 'bg-sow-50 border-sow-200')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1"><div className="text-sm font-medium text-slate-700">{a.message}</div><div className="text-xs text-slate-400 mt-0.5">{formatDate(a.created_at)}</div></div>
                    {!a.read && <button onClick={() => markRead(a.id)} className="text-sow-600 hover:text-sow-800"><Check size={16} /></button>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
