import { supabase } from './supabase';
import type { Action, Fact, Profile, RecurrenceType, ActionRecurrence } from './types';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface EmailPayload {
  type: 'new_action' | 'action_changed' | 'recurrence' | 'deadline_reminder' | 'overdue' | 'no_movement' | 'weekly_summary_responsible' | 'weekly_summary_manager' | 'escalation' | 'deadline_approved' | 'action_approved' | 'action_reproved' | 'action_reopened';
  companyId: string;
  actionId?: string;
  factId?: string;
  recipientUserId?: string;
  changedByUserId?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
}

async function sendNotification(payload: EmailPayload): Promise<void> {
  try {
    const response = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.warn('Notification send failed:', response.status);
    }
  } catch (err) {
    console.warn('Notification send error:', err);
  }
}

export async function notifyNewAction(action: Action, fact: Fact): Promise<void> {
  if (!action.responsible_id) return;
  await sendNotification({
    type: 'new_action',
    companyId: action.company_id,
    actionId: action.id,
    factId: action.fact_id,
    recipientUserId: action.responsible_id,
  });
}

export async function notifyActionChanged(
  action: Action,
  changedByUserId: string,
  fieldName: string,
  oldValue: string,
  newValue: string,
  reason: string,
): Promise<void> {
  if (!action.responsible_id) return;
  await sendNotification({
    type: 'action_changed',
    companyId: action.company_id,
    actionId: action.id,
    factId: action.fact_id,
    recipientUserId: action.responsible_id,
    changedByUserId,
    fieldName,
    oldValue,
    newValue,
    reason,
  });
}

export async function notifyDeadlineApproved(
  action: Action,
  newDeadline: string,
  approvedByUserId: string,
): Promise<void> {
  if (!action.responsible_id) return;
  await sendNotification({
    type: 'deadline_approved',
    companyId: action.company_id,
    actionId: action.id,
    factId: action.fact_id,
    recipientUserId: action.responsible_id,
    changedByUserId: approvedByUserId,
    fieldName: 'prazo',
    newValue: newDeadline,
  });
}

export async function notifyActionApproval(
  action: Action,
  approvalStatus: 'approved' | 'reproved' | 'reopened',
  approvedByUserId: string,
  comment: string,
): Promise<void> {
  if (!action.responsible_id) return;
  await sendNotification({
    type: approvalStatus === 'approved' ? 'action_approved' : approvalStatus === 'reproved' ? 'action_reproved' : 'action_reopened',
    companyId: action.company_id,
    actionId: action.id,
    factId: action.fact_id,
    recipientUserId: action.responsible_id,
    changedByUserId: approvedByUserId,
    reason: comment,
  });
}

export async function saveRecurrence(
  actionId: string,
  companyId: string,
  config: {
    recurrence_type: RecurrenceType;
    custom_days?: number | null;
    weekday?: number | null;
    preferred_time?: string;
    start_date?: string;
    end_date?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('action_recurrence').upsert({
    action_id: actionId,
    company_id: companyId,
    ...config,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'action_id' });

  if (error) throw error;

  await supabase.from('actions').update({ recurrence_configured: config.recurrence_type !== 'none' }).eq('id', actionId);
}

export async function fetchRecurrence(actionId: string): Promise<ActionRecurrence | null> {
  const { data } = await supabase
    .from('action_recurrence')
    .select('*')
    .eq('action_id', actionId)
    .maybeSingle();
  return data as ActionRecurrence | null;
}

export async function fetchNotificationSettings(companyId: string) {
  const { data } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  return data;
}

export async function fetchNotificationPreferences(userId: string, companyId: string) {
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .maybeSingle();
  return data;
}

export async function fetchEscalationRules(companyId: string) {
  const { data } = await supabase
    .from('escalation_rules')
    .select('*')
    .eq('company_id', companyId)
    .order('delay_days', { ascending: true });
  return data ?? [];
}

export async function fetchNotificationLogs(companyId: string, limit = 50) {
  const { data } = await supabase
    .from('notification_logs')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export { sendNotification };
