import { useEffect, useState } from 'react';
import { Target, Plus, Trash2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Button, Input, Textarea, Select, Modal, EmptyState, Badge } from '@/lib/ui';
import type { StrategicObjective, Indicator } from '@/lib/types';

export function PlanningPage() {
  const { profile } = useAuth();
  const { company, objectives, indicators, teams, users, reload, companyId } = useCompanyData();
  const [tab, setTab] = useState<'objectives' | 'indicators' | 'identity'>('objectives');
  const [objModal, setObjModal] = useState(false);
  const [indModal, setIndModal] = useState(false);
  const [objForm, setObjForm] = useState({ name: '', description: '', type: '', teamIds: [] as string[], userIds: [] as string[] });
  const [objectiveTeams, setObjectiveTeams] = useState<{ objective_id: string; team_id: string }[]>([]);
  const [objectiveUsers, setObjectiveUsers] = useState<{ objective_id: string; profile_id: string }[]>([]);
  const [indForm, setIndForm] = useState({ name: '', unit: '', current_value: '', target_value: '', objective_id: '' });

  const canEdit = profile?.role === 'sow_admin' || profile?.role === 'company_admin' || profile?.role === 'area_manager';

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      supabase.from('strategic_objective_teams').select('objective_id,team_id').eq('company_id', companyId),
      supabase.from('strategic_objective_users').select('objective_id,profile_id').eq('company_id', companyId),
    ]).then(([t, u]) => { setObjectiveTeams(t.data ?? []); setObjectiveUsers(u.data ?? []); });
  }, [companyId, objectives.length]);

  const saveObj = async () => {
    if (!objForm.name || !companyId) return;
    const { data, error } = await supabase.from('strategic_objectives').insert({ company_id: companyId, name: objForm.name, description: objForm.description, type: objForm.type }).select('id').single();
    if (error || !data) { alert(error?.message ?? 'Não foi possível criar o objetivo.'); return; }
    if (objForm.teamIds.length) await supabase.from('strategic_objective_teams').insert(objForm.teamIds.map((team_id) => ({ company_id: companyId, objective_id: data.id, team_id })));
    if (objForm.userIds.length) await supabase.from('strategic_objective_users').insert(objForm.userIds.map((profile_id) => ({ company_id: companyId, objective_id: data.id, profile_id, can_view: true, can_execute: true, can_edit: profile_id === profile?.id })));
    setObjModal(false); setObjForm({ name: '', description: '', type: '', teamIds: [], userIds: [] }); reload();
  };
  const saveInd = async () => {
    if (!indForm.name || !companyId) return;
    const { error } = await supabase.from('indicators').insert({ company_id: companyId, name: indForm.name, unit: indForm.unit, current_value: indForm.current_value ? Number(indForm.current_value) : null, target_value: indForm.target_value ? Number(indForm.target_value) : null, objective_id: indForm.objective_id || null });
    if (error) { alert(error.message); return; }
    setIndModal(false); setIndForm({ name: '', unit: '', current_value: '', target_value: '', objective_id: '' }); reload();
  };
  const delObj = async (o: StrategicObjective) => { if (!confirm('Remover objetivo?')) return; const { error } = await supabase.from('strategic_objectives').delete().eq('id', o.id); if (error) { alert(error.message); return; } reload(); };
  const delInd = async (i: Indicator) => { if (!confirm('Remover indicador?')) return; const { error } = await supabase.from('indicators').delete().eq('id', i.id); if (error) { alert(error.message); return; } reload(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planejamento Estratégico</h1>
          <p className="text-sm text-slate-500 mt-0.5">Objetivos, metas e indicadores{company ? ` — ${company.name}` : ''}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {[
          { id: 'objectives', label: 'Objetivos' },
          { id: 'indicators', label: 'Indicadores' },
          { id: 'identity', label: 'Identidade' },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.id ? 'border-sow-600 text-sow-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'objectives' && (
        <div className="space-y-4">
          {canEdit && <div className="flex justify-end"><Button onClick={() => setObjModal(true)}><Plus size={18} /> Novo objetivo</Button></div>}
          {objectives.length === 0 ? (
            <Card><EmptyState icon={<Target size={28} />} title="Nenhum objetivo" message="Cadastre os objetivos estratégicos da empresa." /></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {objectives.map((o) => (
                <Card key={o.id} className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-9 h-9 rounded-lg bg-sow-50 text-sow-600 flex items-center justify-center"><Target size={18} /></div>
                    {canEdit && <button onClick={() => delObj(o)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>}
                  </div>
                  <div className="font-semibold text-slate-900 mb-1">{o.name}</div>
                  {o.type && <Badge className="bg-slate-100 text-slate-600 mb-2">{o.type}</Badge>}
                  {o.description && <p className="text-sm text-slate-500">{o.description}</p>}
                  <div className="mt-3 space-y-1 text-xs text-slate-500"><div><span className="font-medium">Criado em:</span> {new Date(o.created_at).toLocaleDateString('pt-BR')}</div><div><span className="font-medium">Equipes:</span> {objectiveTeams.filter((x) => x.objective_id === o.id).map((x) => teams.find((t) => t.id === x.team_id)?.name).filter(Boolean).join(', ') || 'Não vinculadas'}</div><div><span className="font-medium">Responsáveis:</span> {objectiveUsers.filter((x) => x.objective_id === o.id).map((x) => users.find((u) => u.id === x.profile_id)?.full_name).filter(Boolean).join(', ') || 'Não definidos'}</div></div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'indicators' && (
        <div className="space-y-4">
          {canEdit && <div className="flex justify-end"><Button onClick={() => setIndModal(true)}><Plus size={18} /> Novo indicador</Button></div>}
          {indicators.length === 0 ? (
            <Card><EmptyState icon={<TrendingUp size={28} />} title="Nenhum indicador" message="Cadastre indicadores para acompanhar metas." /></Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Indicador</th><th className="px-4 py-3 font-medium">Objetivo</th><th className="px-4 py-3 font-medium">Atual</th><th className="px-4 py-3 font-medium">Meta</th><th className="px-4 py-3 font-medium">Unidade</th>{canEdit && <th className="px-4 py-3"></th>}
                </tr></thead>
                <tbody>
                  {indicators.map((i) => {
                    const obj = objectives.find((o) => o.id === i.objective_id);
                    return (
                      <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">{i.name}</td>
                        <td className="px-4 py-3 text-slate-500">{obj?.name ?? '-'}</td>
                        <td className="px-4 py-3 text-slate-700">{i.current_value ?? '-'}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{i.target_value ?? '-'}</td>
                        <td className="px-4 py-3 text-slate-500">{i.unit ?? '-'}</td>
                        {canEdit && <td className="px-4 py-3"><button onClick={() => delInd(i)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {tab === 'identity' && company && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Identidade organizacional</h3>
            <div className="space-y-4 text-sm">
              <div><div className="text-xs text-slate-500 font-medium mb-1">Missão</div><p className="text-slate-700">{company.mission || 'Não definida'}</p></div>
              <div><div className="text-xs text-slate-500 font-medium mb-1">Visão</div><p className="text-slate-700">{company.vision || 'Não definida'}</p></div>
              <div><div className="text-xs text-slate-500 font-medium mb-1">Valores</div><p className="text-slate-700">{company.values || 'Não definidos'}</p></div>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Identidade visual</h3>
            <div className="flex items-center gap-4 mb-4">
              {company.logo_url ? <img src={company.logo_url} alt="" className="w-16 h-16 rounded-lg object-cover" /> : <div className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-2xl" style={{ backgroundColor: company.primary_color ?? '#0f766e' }}>{company.name.charAt(0)}</div>}
              <div><div className="font-medium text-slate-900">{company.name}</div><div className="text-sm text-slate-500">{company.segment}</div></div>
            </div>
            <div className="flex gap-3">
              <div className="text-center"><div className="w-16 h-16 rounded-lg mb-1" style={{ backgroundColor: company.primary_color ?? '#0f766e' }} /><div className="text-xs text-slate-500">Primária</div></div>
              <div className="text-center"><div className="w-16 h-16 rounded-lg mb-1" style={{ backgroundColor: company.secondary_color ?? '#1e293b' }} /><div className="text-xs text-slate-500">Secundária</div></div>
            </div>
          </Card>
        </div>
      )}

      <Modal open={objModal} onClose={() => setObjModal(false)} title="Novo objetivo estratégico">
        <div className="space-y-4">
          <Input label="Nome" value={objForm.name} onChange={(v) => setObjForm({ ...objForm, name: v })} required placeholder="Ex: Aumentar faturamento" />
          <Input label="Tipo" value={objForm.type} onChange={(v) => setObjForm({ ...objForm, type: v })} placeholder="Ex: Crescimento, Eficiência" />
          <Textarea label="Descrição" value={objForm.description} onChange={(v) => setObjForm({ ...objForm, description: v })} rows={3} />
          <div><div className="text-sm font-medium text-slate-700 mb-2">Equipes envolvidas</div><div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg">{teams.length === 0 ? <div className="p-3 text-sm text-slate-500">Crie equipes antes de vincular.</div> : teams.map((team) => <label key={team.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-slate-50"><input type="checkbox" checked={objForm.teamIds.includes(team.id)} onChange={() => setObjForm((f) => ({ ...f, teamIds: f.teamIds.includes(team.id) ? f.teamIds.filter((id) => id !== team.id) : [...f.teamIds, team.id] }))} />{team.name}</label>)}</div></div>
          <div><div className="text-sm font-medium text-slate-700 mb-2">Usuários responsáveis/envolvidos</div><div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg">{users.map((user) => <label key={user.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-slate-50"><input type="checkbox" checked={objForm.userIds.includes(user.id)} onChange={() => setObjForm((f) => ({ ...f, userIds: f.userIds.includes(user.id) ? f.userIds.filter((id) => id !== user.id) : [...f.userIds, user.id] }))} />{user.full_name}<span className="text-xs text-slate-400">{user.email}</span></label>)}</div><p className="text-xs text-slate-500 mt-1">A autorização individual será aplicada no vínculo do objetivo.</p></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setObjModal(false)}>Cancelar</Button><Button onClick={saveObj}>Criar</Button></div>
        </div>
      </Modal>

      <Modal open={indModal} onClose={() => setIndModal(false)} title="Novo indicador">
        <div className="space-y-4">
          <Input label="Nome" value={indForm.name} onChange={(v) => setIndForm({ ...indForm, name: v })} required placeholder="Ex: Novos clientes por mês" />
          <Input label="Unidade de medida" value={indForm.unit} onChange={(v) => setIndForm({ ...indForm, unit: v })} placeholder="Ex: clientes, R$, %" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor atual" type="number" value={indForm.current_value} onChange={(v) => setIndForm({ ...indForm, current_value: v })} />
            <Input label="Meta" type="number" value={indForm.target_value} onChange={(v) => setIndForm({ ...indForm, target_value: v })} />
          </div>
          <Select label="Objetivo relacionado" value={indForm.objective_id} onChange={(v) => setIndForm({ ...indForm, objective_id: v })} placeholder="Sem objetivo" options={objectives.map((o) => ({ value: o.id, label: o.name }))} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setIndModal(false)}>Cancelar</Button><Button onClick={saveInd}>Criar</Button></div>
        </div>
      </Modal>
    </div>
  );
}
