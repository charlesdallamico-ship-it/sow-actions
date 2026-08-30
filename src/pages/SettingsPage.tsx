import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Building2, Bell, Shield, Mail, Save, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Button, Input, Textarea, Badge } from '@/lib/ui';
import { ROLE_LABELS } from '@/lib/constants';
import type { Company } from '@/lib/types';

interface NotificationSettings {
  id: string;
  company_id: string;
  emails_enabled: boolean;
  default_send_time: string;
  default_recurrence: string;
  deadline_reminders_enabled: boolean;
  overdue_alerts_enabled: boolean;
  weekly_summary_enabled: boolean;
  escalation_enabled: boolean;
  no_movement_days: number;
  no_movement_enabled: boolean;
  sender_name: string;
  sender_email: string;
  sender_reply_to: string | null;
  weekly_summary_day: number;
  weekly_summary_time: string;
}

interface EscalationRule {
  id: string;
  delay_days: number;
  notify_responsible: boolean;
  notify_managers: boolean;
  notify_admins: boolean;
  critical_alert: boolean;
}

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Sem recorrência' },
  { value: 'daily', label: 'Diariamente' },
  { value: 'every_2_days', label: 'A cada 2 dias' },
  { value: 'every_3_days', label: 'A cada 3 dias' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'every_15_days', label: 'A cada 15 dias' },
  { value: 'monthly', label: 'Mensalmente' },
  { value: 'custom', label: 'Personalizada' },
];

export function SettingsPage() {
  const { profile, signOut } = useAuth();
  const { company, reload } = useCompanyData();
  const [form, setForm] = useState<Partial<Company>>({});
  const [saved, setSaved] = useState(false);
  const canManageCompany = profile?.role === 'sow_admin' || profile?.role === 'company_admin';

  const [notifSettings, setNotifSettings] = useState<NotificationSettings | null>(null);
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([]);
  const [notifSaved, setNotifSaved] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  const syncForm = () => { if (company) setForm({ name: company.name, segment: company.segment ?? '', mission: company.mission ?? '', vision: company.vision ?? '', values: company.values ?? '', logo_url: company.logo_url ?? '', primary_color: company.primary_color ?? '#0f766e', secondary_color: company.secondary_color ?? '#1e293b' }); };

  const save = async () => {
    if (!company) return;
    const { error } = await supabase.from('companies').update(form).eq('id', company.id);
    if (error) { alert(error.message); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2000); reload();
  };

  useEffect(() => {
    if (company && canManageCompany) {
      loadNotificationSettings();
      loadEscalationRules();
    }
  }, [company, canManageCompany]);

  const loadNotificationSettings = async () => {
    if (!company) return;
    const { data } = await supabase.from('notification_settings').select('*').eq('company_id', company.id).maybeSingle();
    setNotifSettings(data as NotificationSettings | null);
  };

  const loadEscalationRules = async () => {
    if (!company) return;
    const { data } = await supabase.from('escalation_rules').select('*').eq('company_id', company.id).order('delay_days', { ascending: true });
    setEscalationRules(data as EscalationRule[] | null ?? []);
  };

  const saveNotifSettings = async () => {
    if (!notifSettings || !company) return;
    setNotifLoading(true);
    const { error } = await supabase.from('notification_settings').update({
      emails_enabled: notifSettings.emails_enabled,
      default_send_time: notifSettings.default_send_time,
      default_recurrence: notifSettings.default_recurrence,
      deadline_reminders_enabled: notifSettings.deadline_reminders_enabled,
      overdue_alerts_enabled: notifSettings.overdue_alerts_enabled,
      weekly_summary_enabled: notifSettings.weekly_summary_enabled,
      escalation_enabled: notifSettings.escalation_enabled,
      no_movement_days: notifSettings.no_movement_days,
      no_movement_enabled: notifSettings.no_movement_enabled,
      sender_name: notifSettings.sender_name,
      sender_email: notifSettings.sender_email,
      sender_reply_to: notifSettings.sender_reply_to,
      weekly_summary_day: notifSettings.weekly_summary_day,
      weekly_summary_time: notifSettings.weekly_summary_time,
    }).eq('id', notifSettings.id);
    if (error) { alert(error.message); setNotifLoading(false); return; }
    setNotifSaved(true); setTimeout(() => setNotifSaved(false), 2000);
    setNotifLoading(false);
  };

  const saveEscalationRule = async (rule: EscalationRule) => {
    const { error } = await supabase.from('escalation_rules').update({
      notify_responsible: rule.notify_responsible,
      notify_managers: rule.notify_managers,
      notify_admins: rule.notify_admins,
      critical_alert: rule.critical_alert,
    }).eq('id', rule.id);
    if (error) { alert(error.message); return; }
    loadEscalationRules();
  };

  const escalationLabel = (days: number) => {
    if (days === 1) return '1 dia de atraso';
    return `${days} dias de atraso`;
  };

  const escalationRecipients = (rule: EscalationRule) => {
    const parts: string[] = [];
    if (rule.notify_responsible) parts.push('Responsável');
    if (rule.notify_managers) parts.push('Gestor');
    if (rule.notify_admins) parts.push('Admin');
    return parts.join(' + ') || 'Ninguém';
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Configurações</h1><p className="text-sm text-slate-500 mt-0.5">Preferências do sistema e da empresa</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4"><SettingsIcon size={20} className="text-slate-400" /><h3 className="font-semibold text-slate-900">Seu perfil</h3></div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Nome</span><span className="font-medium text-slate-700">{profile?.full_name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">E-mail</span><span className="font-medium text-slate-700">{profile?.email}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Perfil</span><Badge className="bg-slate-100 text-slate-600">{profile ? ROLE_LABELS[profile.role] : '-'}</Badge></div>
            <div className="flex justify-between"><span className="text-slate-500">Cargo</span><span className="font-medium text-slate-700">{profile?.position ?? '-'}</span></div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100"><Button variant="outline" size="sm" onClick={signOut}>Sair do sistema</Button></div>
        </Card>

        {canManageCompany && company && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4"><Building2 size={20} className="text-slate-400" /><h3 className="font-semibold text-slate-900">Dados da empresa</h3></div>
            {Object.keys(form).length === 0 ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Empresa</span><span className="font-medium text-slate-700">{company.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Segmento</span><span className="font-medium text-slate-700">{company.segment ?? '-'}</span></div>
                <Button variant="outline" size="sm" onClick={syncForm}>Editar dados</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Input label="Nome" value={form.name ?? ''} onChange={(v) => setForm({ ...form, name: v })} />
                <Input label="Segmento" value={form.segment ?? ''} onChange={(v) => setForm({ ...form, segment: v })} />
                <Input label="URL do logotipo" value={form.logo_url ?? ''} onChange={(v) => setForm({ ...form, logo_url: v })} />
                <Textarea label="Missão" value={form.mission ?? ''} onChange={(v) => setForm({ ...form, mission: v })} rows={2} />
                <Textarea label="Visão" value={form.vision ?? ''} onChange={(v) => setForm({ ...form, vision: v })} rows={2} />
                <div className="flex gap-3">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Cor primária</label><input type="color" value={form.primary_color ?? '#0f766e'} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="w-12 h-10 rounded cursor-pointer border border-slate-300" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Cor secundária</label><input type="color" value={form.secondary_color ?? '#1e293b'} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} className="w-12 h-10 rounded cursor-pointer border border-slate-300" /></div>
                </div>
                <div className="flex gap-2">{saved && <span className="text-sm text-emerald-600 flex items-center">Salvo!</span>}<Button size="sm" onClick={save}>Salvar</Button><Button variant="outline" size="sm" onClick={() => setForm({})}>Cancelar</Button></div>
              </div>
            )}
          </Card>
        )}

        {/* Notification Settings */}
        {canManageCompany && notifSettings && (
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1"><Bell size={20} className="text-slate-400" /><h3 className="font-semibold text-slate-900">Configurações de Notificações</h3></div>
            <p className="text-xs text-slate-400 mb-5">Gerencie como o sistema envia e-mails, lembretes, alertas e resumos.</p>

            {/* Email provider status */}
            <div className={`rounded-lg border p-4 mb-5 ${notifSettings.emails_enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-start gap-3">
                {notifSettings.emails_enabled ? <CheckCircle2 size={20} className="text-emerald-600 mt-0.5" /> : <AlertTriangle size={20} className="text-amber-600 mt-0.5" />}
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">
                    {notifSettings.emails_enabled ? 'E-mails ativos' : 'E-mails desativados'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Convites, confirmações e recuperação de senha usam o serviço nativo de e-mail do Supabase Auth. Notificações operacionais personalizadas podem exigir um provedor SMTP/API adicional.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={notifSettings.emails_enabled} onChange={(e) => setNotifSettings({ ...notifSettings, emails_enabled: e.target.checked })} className="sr-only peer" />
                  <div className="w-10 h-5 bg-slate-300 rounded-full peer peer-checked:bg-sow-600 transition" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Sender config */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><Mail size={16} className="text-slate-400" /> Remetente</div>
                <Input label="Nome do remetente" value={notifSettings.sender_name ?? ''} onChange={(v) => setNotifSettings({ ...notifSettings, sender_name: v })} />
                <Input label="E-mail remetente" value={notifSettings.sender_email ?? ''} onChange={(v) => setNotifSettings({ ...notifSettings, sender_email: v })} placeholder="notificacoes@sownegocios.com.br" />
                <Input label="Reply-To (responder para)" value={notifSettings.sender_reply_to ?? ''} onChange={(v) => setNotifSettings({ ...notifSettings, sender_reply_to: v })} placeholder="contato@sownegocios.com.br" />
              </div>

              {/* Recurrence & timing */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><Clock size={16} className="text-slate-400" /> Recorrência e horários</div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Recorrência padrão</label>
                  <select value={notifSettings.default_recurrence} onChange={(e) => setNotifSettings({ ...notifSettings, default_recurrence: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:border-sow-500 focus:ring-1 focus:ring-sow-500 outline-none">
                    {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <Input label="Horário padrão de envio" type="time" value={notifSettings.default_send_time ?? '08:00'} onChange={(v) => setNotifSettings({ ...notifSettings, default_send_time: v })} />
              </div>

              {/* Alerts toggles */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><AlertTriangle size={16} className="text-slate-400" /> Alertas</div>
                <ToggleRow label="Alertas de prazo (15, 7, 3, 1 dia e vencimento)" checked={notifSettings.deadline_reminders_enabled} onChange={(v) => setNotifSettings({ ...notifSettings, deadline_reminders_enabled: v })} />
                <ToggleRow label="Alertas de atraso" checked={notifSettings.overdue_alerts_enabled} onChange={(v) => setNotifSettings({ ...notifSettings, overdue_alerts_enabled: v })} />
                <ToggleRow label="Alerta de ação sem atualização" checked={notifSettings.no_movement_enabled} onChange={(v) => setNotifSettings({ ...notifSettings, no_movement_enabled: v })} />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">Dias máximos sem atualização</label>
                  <input type="number" min={1} max={30} value={notifSettings.no_movement_days ?? 7} onChange={(e) => setNotifSettings({ ...notifSettings, no_movement_days: parseInt(e.target.value) || 7 })} className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-sm text-center" />
                </div>
              </div>

              {/* Weekly summary */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><TrendingUp size={16} className="text-slate-400" /> Resumo semanal</div>
                <ToggleRow label="Ativar resumo semanal" checked={notifSettings.weekly_summary_enabled} onChange={(v) => setNotifSettings({ ...notifSettings, weekly_summary_enabled: v })} />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Dia do resumo</label>
                  <select value={notifSettings.weekly_summary_day ?? 1} onChange={(e) => setNotifSettings({ ...notifSettings, weekly_summary_day: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:border-sow-500 focus:ring-1 focus:ring-sow-500 outline-none">
                    {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <Input label="Horário do resumo" type="time" value={notifSettings.weekly_summary_time ?? '08:00'} onChange={(v) => setNotifSettings({ ...notifSettings, weekly_summary_time: v })} />
              </div>
            </div>

            {/* Escalation rules */}
            {notifSettings.escalation_enabled && escalationRules.length > 0 && (
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><AlertTriangle size={16} className="text-slate-400" /><span className="text-sm font-medium text-slate-700">Escalonamento de atraso</span></div>
                  <ToggleRow label="Ativar escalonamento" checked={notifSettings.escalation_enabled} onChange={(v) => setNotifSettings({ ...notifSettings, escalation_enabled: v })} compact />
                </div>
                <div className="space-y-2">
                  {escalationRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5">
                      <div className="text-sm">
                        <span className="font-medium text-slate-700">{escalationLabel(rule.delay_days)}</span>
                        <span className="text-slate-400 ml-2">{escalationRecipients(rule)}</span>
                        {rule.critical_alert && <span className="ml-2 text-xs text-red-600 font-medium">+ Alerta crítico</span>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => saveEscalationRule({ ...rule, notify_responsible: !rule.notify_responsible })} className={`px-2 py-1 text-xs rounded ${rule.notify_responsible ? 'bg-sow-100 text-sow-700' : 'bg-slate-200 text-slate-400'}`}>Resp.</button>
                        <button onClick={() => saveEscalationRule({ ...rule, notify_managers: !rule.notify_managers })} className={`px-2 py-1 text-xs rounded ${rule.notify_managers ? 'bg-sow-100 text-sow-700' : 'bg-slate-200 text-slate-400'}`}>Gestor</button>
                        <button onClick={() => saveEscalationRule({ ...rule, notify_admins: !rule.notify_admins })} className={`px-2 py-1 text-xs rounded ${rule.notify_admins ? 'bg-sow-100 text-sow-700' : 'bg-slate-200 text-slate-400'}`}>Admin</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mandatory emails notice */}
            <div className="mt-5 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-800">
                <strong>E-mails obrigatórios</strong> — não podem ser desativados pelo usuário: convite de acesso, nova tarefa, alteração de responsável, alteração de prazo, reprovação, ação crítica e redefinição de senha.
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Button size="sm" onClick={saveNotifSettings} disabled={notifLoading}>
                {notifLoading ? 'Salvando...' : 'Salvar configurações'}
              </Button>
              {notifSaved && <span className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle2 size={16} /> Salvo!</span>}
            </div>
          </Card>
        )}

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4"><Shield size={20} className="text-slate-400" /><h3 className="font-semibold text-slate-900">Segurança</h3></div>
          <div className="space-y-2 text-sm text-slate-600">
            <ul className="space-y-1.5 text-slate-500">
              <li>• Isolamento de dados por empresa</li>
              <li>• Controle de acesso por perfil</li>
              <li>• Histórico de alterações</li>
              <li>• Proteção de documentos</li>
              <li>• Adequação à LGPD</li>
              <li>• Validação multiempresa em todos os envios</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, compact }: { label: string; checked: boolean; onChange: (v: boolean) => void; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${compact ? '' : 'py-1'}`}>
      <span className="text-sm text-slate-600">{label}</span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-sow-600 transition" />
        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-4" />
      </label>
    </div>
  );
}
