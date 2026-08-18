import { useEffect, useState } from 'react';
import { Shield, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Modal, Button } from '@/lib/ui';
import type { Profile, PlanPermission } from '@/lib/types';

export function PlanPermissionsModal({
  open,
  onClose,
  factId,
  companyId,
  users,
}: {
  open: boolean;
  onClose: () => void;
  factId: string;
  companyId: string;
  users: Profile[];
}) {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<PlanPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('plan_permissions')
      .select('*')
      .eq('fact_id', factId);
    setPermissions((data as PlanPermission[] | undefined) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open && factId) load();
  }, [open, factId]);

  const authorizedUserIds = new Set(permissions.map((p) => p.profile_id));
  const availableUsers = users.filter(
    (u) => u.active && !authorizedUserIds.has(u.id) && u.id !== profile?.id,
  );

  const addPermission = async () => {
    if (!selectedUserId || !profile) return;
    const user = users.find((u) => u.id === selectedUserId);
    if (!user) return;
    const { error } = await supabase.from('plan_permissions').insert({
      fact_id: factId,
      company_id: companyId,
      user_id: user.user_id,
      profile_id: user.id,
      can_edit: true,
    });
    if (error) { alert(error.message); return; }
    setSelectedUserId('');
    load();
  };

  const removePermission = async (permId: string) => {
    const { error } = await supabase.from('plan_permissions').delete().eq('id', permId);
    if (error) { alert(error.message); return; }
    load();
  };

  return (
    <Modal open={open} onClose={onClose} title="Permissões do plano" size="md">
      <div className="space-y-4">
        <div className="bg-sow-50 border border-sow-200 rounded-lg p-3 flex items-center gap-2 text-sm text-sow-800">
          <Shield size={18} /> Usuários autorizados podem editar este plano de ação específico.
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">Usuários autorizados</div>
          {loading ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : permissions.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center bg-slate-50 rounded-lg">Nenhum usuário autorizado ainda.</p>
          ) : (
            <div className="space-y-2">
              {permissions.map((p) => {
                const u = users.find((usr) => usr.id === p.profile_id);
                return (
                  <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-sow-100 text-sow-700 text-xs font-bold flex items-center justify-center">
                        {u?.full_name?.charAt(0) ?? '?'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-700">{u?.full_name ?? 'Usuário'}</div>
                        <div className="text-xs text-slate-400">{u?.position ?? '-'}</div>
                      </div>
                    </div>
                    <button onClick={() => removePermission(p.id)} className="p-1 text-slate-300 hover:text-red-500">
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">Autorizar novo usuário</div>
          <div className="flex gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sow-500 outline-none bg-white"
            >
              <option value="">Selecione um usuário...</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name} {u.position ? `— ${u.position}` : ''}</option>
              ))}
            </select>
            <Button onClick={addPermission} disabled={!selectedUserId}>
              <Plus size={16} /> Autorizar
            </Button>
          </div>
          {availableUsers.length === 0 && (
            <p className="text-xs text-slate-400 mt-1.5">Todos os usuários ativos já estão autorizados.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
