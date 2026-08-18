import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, X, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { InAppNotification } from '@/lib/types';

interface Props {
  onNavigate: (page: string, factId?: string) => void;
}

export function NotificationCenter({ onNavigate }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadNotifications = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('in_app_notifications')
      .select('*')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .limit(20);
    setItems(data as InAppNotification[] | null ?? []);
    const { count } = await supabase
      .from('in_app_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.user_id)
      .eq('read', false);
    setUnread(count ?? 0);
  };

  const markRead = async (id: string) => {
    await supabase.from('in_app_notifications').update({ read: true }).eq('id', id);
    loadNotifications();
  };

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('in_app_notifications').update({ read: true }).eq('user_id', profile.user_id).eq('read', false);
    loadNotifications();
  };

  const handleClick = (item: InAppNotification) => {
    markRead(item.id);
    if (item.link) {
      const url = new URL(item.link, window.location.origin);
      const page = url.searchParams.get('page');
      const fact = url.searchParams.get('fact');
      const action = url.searchParams.get('action');
      if (fact) onNavigate('facts', fact);
      else if (action) onNavigate('tasks');
      else if (page) onNavigate(page);
    }
    setOpen(false);
  };

  if (!profile) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-500 hover:text-sow-600 hover:bg-sow-50 rounded-lg transition-colors"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 animate-scale-in overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="font-semibold text-slate-800 text-sm">Notificações</div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-sow-600 hover:text-sow-700 font-medium"
              >
                <CheckCheck size={14} /> Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Bell size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhuma notificação</p>
              </div>
            ) : items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleClick(item)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-sow-50 transition-colors group flex gap-3',
                  !item.read && 'bg-sow-50/50',
                )}
              >
                <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', item.read ? 'bg-transparent' : 'bg-sow-500')} />
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm leading-tight', !item.read ? 'font-semibold text-slate-800' : 'text-slate-600')}>
                    {item.title}
                  </div>
                  {item.body && (
                    <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.body}</div>
                  )}
                  <div className="text-[11px] text-slate-300 mt-1">
                    {new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {!item.read && (
                  <Check
                    size={14}
                    className="text-slate-300 opacity-0 group-hover:opacity-100 transition shrink-0 mt-1"
                    onClick={(e) => { e.stopPropagation(); markRead(item.id); }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
