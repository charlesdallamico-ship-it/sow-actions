import { useEffect, useState } from 'react';
import { ShieldCheck, ChevronRight, Crown, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Button, Badge, EmptyState, Modal } from '@/lib/ui';
import { ROLE_LABELS } from '@/lib/constants';
import { isPrimaryAdmin, canManagePermissions, ALL_PERMISSIONS, PERMISSION_LABELS } from '@/lib/permissions';
import type { Profile, UserPermission, PermissionKey } from '@/lib/types';

export function PermissionsPage() {
  const { profile } = useAuth();
  const { users, departments, companyId, reload } = useCompanyData();
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editPerms, setEditPerms] = useState<UserPermission | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = canManagePermissions(profile);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('company_id', companyId);
    setPermissions((data as UserPermission[] | undefined) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId]);

  const permMap = new Map(permissions.map((p) => [p.profile_id, p]));
  const activeUsers = users.filter((u) => u.active);

  const openEdit = (user: Profile) => {
    const existing = permMap.get(user.id);
    if (existing) {
      setEditPerms(existing);
    } else {
      setEditPerms({
        id: '', company_id: companyId!, user_id: user.user_id, profile_id: user.id,
        can_create_facts: false, can_edit_facts: false, can_edit_causes: false,
        can_create_plans: false, can_edit_plans: false,
        can_create_actions: false, can_edit_actions: false,
        can_change_responsible: false, can_change_deadlines: false,
        can_change_indicators: false, can_change_targets: false,
        can_change_priorities: false, can_change_weights: false,
        can_cancel_actions: false, can_reopen_actions: false,
        can_approve_actions: false, can_view_all_actions: false,
        can_view_history: false,
        full_management: false, is_primary_admin: user.is_primary_admin,
        created_at: '', updated_at: '',
      });
    }
    setEditUser(user);
  };

  const togglePermission = (key: PermissionKey | 'full_management') => {
    if (!editPerms) return;
    if (key === 'full_management') {
      const newVal = !editPerms.full_management;
      const updated = { ...editPerms, full_management: newVal };
      if (newVal) {
        for (const k of ALL_PERMISSIONS) {
          (updated as Record<string, unknown>)[k] = true;
        }
      }
      setEditPerms(updated);
    } else {
      setEditPerms({ ...editPerms, [key]: !editPerms[key as keyof UserPermission] as boolean });
    }
  };

  const save = async () => {
    if (!editPerms || !editUser) return;
    setSaving(true);
    if (editPerms.id) {
      const { id, created_at, updated_at, is_primary_admin, ...updatable } = editPerms;
      void created_at; void updated_at; void is_primary_admin;
      const { error } = await supabase
        .from('user_permissions')
        .update({ ...updatable, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) { alert(error.message); setSaving(false); return; }
    } else {
      const { id, created_at, updated_at, ...insertable } = editPerms;
      void id; void created_at; void updated_at;
      const { error } = await supabase.from('user_permissions').insert(insertable);
      if (error) { alert(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setEditUser(null);
    setEditPerms(null);
    load();
    reload();
  };

  const countActive = (perm: UserPermission | undefined): number => {
    if (!perm) return 0;
    if (perm.full_management) return ALL_PERMISSIONS.length;
    return ALL_PERMISSIONS.filter((k) => perm[k]).length;
  };

  if (loading) return <div className="text-slate-400">Carregando...</div>;

  if (!canManage) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldCheck size={28} />}
          title="Acesso restrito"
          message="Somente o Administrador Principal pode gerenciar permissões."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gestão de Permissões</h1>
        <p className="text-sm text-slate-500 mt-0.5">Controle de permissões de edição por usuário</p>
      </div>

      <div className="bg-sow-50 border border-sow-200 rounded-lg p-4 flex items-start gap-3">
        <ShieldCheck size={20} className="text-sow-600 mt-0.5 shrink-0" />
        <div className="text-sm text-sow-800">
          <p className="font-medium mb-1">Como funciona</p>
          <p className="text-sow-700">O Administrador Principal possui autoridade total. Aqui você delega permissões específicas para outros usuários. Usuários com Permissão Total de Gestão podem executar todas as operações, mas não podem delegar permissões.</p>
        </div>
      </div>

      {activeUsers.length === 0 ? (
        <Card><EmptyState icon={<ShieldCheck size={28} />} title="Nenhum usuário" message="Cadastre usuários para gerenciar permissões." /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">Departamento</th>
                <th className="px-4 py-3 font-medium">Perfil</th>
                <th className="px-4 py-3 font-medium">Permissões</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((u) => {
                const perm = permMap.get(u.id);
                const active = countActive(perm);
                const primary = u.is_primary_admin || u.role === 'sow_admin';
                return (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-sow-600 text-white text-xs font-bold flex items-center justify-center">
                          {u.full_name.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-700">{u.full_name}</span>
                        {primary && <Crown size={14} className="text-amber-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.position ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{departments.find((d) => d.id === u.department_id)?.name ?? '-'}</td>
                    <td className="px-4 py-3"><Badge className="bg-slate-100 text-slate-600">{ROLE_LABELS[u.role]}</Badge></td>
                    <td className="px-4 py-3">
                      {primary ? (
                        <Badge className="bg-amber-100 text-amber-700">Administrador Principal</Badge>
                      ) : perm?.full_management ? (
                        <Badge className="bg-sow-100 text-sow-700">Permissão Total</Badge>
                      ) : (
                        <span className="text-slate-500">{active} de {ALL_PERMISSIONS.length}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                        {u.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {primary ? (
                        <span className="text-xs text-slate-400">Não editável</span>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                          Gerenciar <ChevronRight size={14} />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Edit permissions modal */}
      <Modal
        open={!!editUser}
        onClose={() => { setEditUser(null); setEditPerms(null); }}
        title={`Permissões — ${editUser?.full_name ?? ''}`}
        size="lg"
      >
        {editPerms && (
          <div className="space-y-4">
            {/* Full management toggle */}
            <div className="flex items-center justify-between bg-sow-50 border border-sow-200 rounded-lg p-4">
              <div>
                <div className="font-semibold text-slate-900">Permissão Total de Gestão</div>
                <p className="text-xs text-slate-500 mt-0.5">Ativa todas as permissões operacionais. Não permite delegar permissões.</p>
              </div>
              <button onClick={() => togglePermission('full_management')} className="shrink-0">
                {editPerms.full_management
                  ? <ToggleRight size={40} className="text-sow-600" />
                  : <ToggleLeft size={40} className="text-slate-300" />}
              </button>
            </div>

            {/* Individual permissions */}
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-3">Permissões individuais</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map((key) => {
                  const enabled = editPerms[key];
                  return (
                    <button
                      key={key}
                      onClick={() => togglePermission(key)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition ${
                        enabled
                          ? 'border-sow-300 bg-sow-50 text-sow-800'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-left">{PERMISSION_LABELS[key]}</span>
                      {enabled
                        ? <ToggleRight size={24} className="text-sow-600 shrink-0" />
                        : <ToggleLeft size={24} className="text-slate-300 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => { setEditUser(null); setEditPerms(null); }}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar permissões'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
