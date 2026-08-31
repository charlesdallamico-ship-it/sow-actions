import { useEffect, useState, useMemo, useCallback } from 'react';
import { ArrowLeft, Plus, MessageSquare, History as HistoryIcon, Clock, CheckCircle2, XCircle, AlertCircle, Shield, Ban, Pencil, Eye, Edit3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Button, Input, Textarea, Select, Modal, Badge, ProgressBar, EmptyState } from '@/lib/ui';
import { JustificationModal } from '@/components/JustificationModal';
import { DeadlineRequestModal } from '@/components/DeadlineRequestModal';
import { PlanPermissionsModal } from '@/components/PlanPermissionsModal';
import {
  STATUS_LABELS, STATUS_COLORS, PROGRESS_STEPS, QUICK_DEADLINES, IMPACT_LEVELS,
  CAUSE_TYPES, IMPACT_TYPES, ACTION_CATEGORIES, RECURRENCE_OPTIONS,
} from '@/lib/constants';
import {
  formatDate, formatDateTime, daysUntil, isOverdue, weightedProgress, cn, addDays, toISODate,
} from '@/lib/utils';
import { isPrimaryAdmin, canManagePermissions, insertAuditLog } from '@/lib/permissions';
import { notifyActionChanged, notifyNewAction, saveRecurrence, fetchRecurrence } from '@/lib/notifications';
import type { Fact, Action, Comment, ActionHistory, DeadlineChange, ActionStatus, ApprovalStatus, AuditLog, DeadlineRequest, RecurrenceType } from '@/lib/types';

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

type Tab = 'actions' | 'history' | 'deadline_requests';

export function FactDetailPage({ factId, onBack }: { factId: string; onBack: () => void }) {
  const { profile } = useAuth();
  const { users, departments, units, objectives, teams, companyId } = useCompanyData();
  const [fact, setFact] = useState<Fact | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [history, setHistory] = useState<ActionHistory[]>([]);
  const [deadlineChanges, setDeadlineChanges] = useState<DeadlineChange[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [deadlineRequests, setDeadlineRequests] = useState<DeadlineRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('actions');
  const [actionModal, setActionModal] = useState(false);
  const [editAction, setEditAction] = useState<Action | null>(null);
  const [detailAction, setDetailAction] = useState<Action | null>(null);
  const [commentText, setCommentText] = useState('');
  const [actionForm, setActionForm] = useState({
    description: '', responsible_id: '', team: '', start_date: toISODate(new Date()), deadline: '', indicator_of_success: '', target: '', weight: '33.33',
  });
  const [actionTeamIds, setActionTeamIds] = useState<string[]>([]);

  // Edit fact modal
  const [editFactModal, setEditFactModal] = useState(false);
  const [factForm, setFactForm] = useState({
    fato: '', causa: '', priority: 'media' as Fact['priority'],
    category: '' as string, cause_type: '' as string, impact_type: '' as string,
    impact_level: '' as string, expected_result: '', objective_id: '' as string,
    department_id: '' as string, unit_id: '' as string, origin_date: '' as string,
  });

  // Recurrence state for action editing
  const [actionRecurrence, setActionRecurrence] = useState<RecurrenceType>('none');
  const [recurrenceCustomDays, setRecurrenceCustomDays] = useState('');

  // Permission state
  const [perms, setPerms] = useState({
    canEditFact: false,
    canEditCause: false,
    canCreateActions: false,
    canEditActions: false,
    canChangeResponsible: false,
    canChangeDeadlines: false,
    canChangeIndicators: false,
    canChangeTargets: false,
    canChangeWeights: false,
    canChangePriorities: false,
    canCancelActions: false,
    canReopenActions: false,
    canApproveActions: false,
    canViewHistory: false,
  });
  const [planPerms, setPlanPerms] = useState(false);
  const [planPermsModal, setPlanPermsModal] = useState(false);

  // Justification modal
  const [justification, setJustification] = useState<{
    open: boolean;
    onConfirm: (reason: string) => void;
    title: string;
    fieldName: string;
    oldValue: string;
    newValue: string;
  } | null>(null);

  // Deadline request modal
  const [deadlineReqModal, setDeadlineReqModal] = useState(false);
  const [deadlineReqAction, setDeadlineReqAction] = useState<Action | null>(null);

  // Cancel action modal
  const [cancelActionModal, setCancelActionModal] = useState<Action | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Cancel fact modal
  const [cancelFactModal, setCancelFactModal] = useState(false);
  const [cancelFactReason, setCancelFactReason] = useState('');

  const isPrimary = isPrimaryAdmin(profile);
  const canManagePlan = isPrimary || planPerms || perms.canEditActions;

  const load = useCallback(async () => {
    const { data: f } = await supabase.from('facts').select('*').eq('id', factId).maybeSingle();
    setFact(f as Fact | null);
    const { data: acts } = await supabase.from('actions').select('*').eq('fact_id', factId).order('created_at', { ascending: true });
    const actionsData = (acts as Action[] | undefined) ?? [];
    setActions(actionsData.filter((a) => !a.cancelled));
    if (actionsData.length) {
      const { data: c } = await supabase.from('comments').select('*').in('action_id', actionsData.map((a) => a.id)).order('created_at', { ascending: true });
      const cmap: Record<string, Comment[]> = {};
      for (const cm of (c as Comment[] | undefined) ?? []) (cmap[cm.action_id] ??= []).push(cm);
      setComments(cmap);
      const { data: h } = await supabase.from('action_history').select('*').in('action_id', actionsData.map((a) => a.id)).order('created_at', { ascending: false });
      setHistory((h as ActionHistory[] | undefined) ?? []);
      const { data: dc } = await supabase.from('deadline_changes').select('*').in('action_id', actionsData.map((a) => a.id)).order('created_at', { ascending: false });
      setDeadlineChanges((dc as DeadlineChange[] | undefined) ?? []);
    }
    // Load audit logs for this fact
    const { data: al } = await supabase.from('audit_logs').select('*').eq('fact_id', factId).order('created_at', { ascending: false });
    setAuditLogs((al as AuditLog[] | undefined) ?? []);
    // Load deadline requests for actions of this fact
    if (actionsData.length) {
      const { data: dr } = await supabase.from('deadline_requests').select('*').in('action_id', actionsData.map((a) => a.id)).order('created_at', { ascending: false });
      setDeadlineRequests((dr as DeadlineRequest[] | undefined) ?? []);
    }
    setLoading(false);
  }, [factId]);

  // Load permissions
  useEffect(() => {
    if (!profile || !companyId || !factId) return;
    (async () => {
      if (isPrimary) {
        setPerms({
          canEditFact: true, canEditCause: true, canCreateActions: true, canEditActions: true,
          canChangeResponsible: true, canChangeDeadlines: true, canChangeIndicators: true,
          canChangeTargets: true, canChangeWeights: true, canChangePriorities: true,
          canCancelActions: true, canReopenActions: true, canApproveActions: true, canViewHistory: true,
        });
        setPlanPerms(true);
        return;
      }
      const { data: up } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('company_id', companyId)
        .eq('user_id', profile.user_id)
        .maybeSingle();
      const p = up as Record<string, boolean> | null;
      const fm = p?.full_management === true;
      setPerms({
        canEditFact: fm || p?.can_edit_facts === true,
        canEditCause: fm || p?.can_edit_causes === true,
        canCreateActions: fm || p?.can_create_actions === true,
        canEditActions: fm || p?.can_edit_actions === true,
        canChangeResponsible: fm || p?.can_change_responsible === true,
        canChangeDeadlines: fm || p?.can_change_deadlines === true,
        canChangeIndicators: fm || p?.can_change_indicators === true,
        canChangeTargets: fm || p?.can_change_targets === true,
        canChangeWeights: fm || p?.can_change_weights === true,
        canChangePriorities: fm || p?.can_change_priorities === true,
        canCancelActions: fm || p?.can_cancel_actions === true,
        canReopenActions: fm || p?.can_reopen_actions === true,
        canApproveActions: fm || p?.can_approve_actions === true,
        canViewHistory: fm || p?.can_view_history === true,
      });
      // Check plan-specific permission
      const { data: pp } = await supabase
        .from('plan_permissions')
        .select('*')
        .eq('fact_id', factId)
        .eq('user_id', profile.user_id)
        .maybeSingle();
      const hasPlanEdit = (pp as { can_edit?: boolean } | null)?.can_edit === true;
      setPlanPerms(hasPlanEdit);
      // If user has plan edit permission, they can edit actions in this plan
      if (hasPlanEdit) {
        setPerms((prev) => ({
          ...prev,
          canEditActions: true,
          canCreateActions: true,
          canChangeResponsible: true,
          canChangeDeadlines: true,
          canChangeIndicators: true,
          canChangeTargets: true,
          canChangeWeights: true,
          canChangePriorities: true,
          canCancelActions: true,
          canReopenActions: true,
        }));
      }
    })();
  }, [profile, companyId, factId, isPrimary]);

  useEffect(() => { load(); }, [load]);

  const planProgress = useMemo(() => weightedProgress(actions), [actions]);

  // ===== Action CRUD with justification =====

  const openNewAction = () => {
    if (actions.length >= 3) { alert('Cada fato pode ter no máximo 3 ações.'); return; }
    setEditAction(null);
    setActionForm({ description: '', responsible_id: '', team: '', start_date: toISODate(new Date()), deadline: '', indicator_of_success: '', target: '', weight: String(actions.length === 0 ? 34 : actions.length === 1 ? 33 : 33) });
    setActionTeamIds([]);
    setActionModal(true);
  };
  const openEditAction = async (a: Action) => {
    setEditAction(a);
    setActionForm({ description: a.description, responsible_id: a.responsible_id ?? '', team: a.team ?? '', start_date: a.start_date ?? toISODate(new Date()), deadline: a.deadline ?? '', indicator_of_success: a.indicator_of_success ?? '', target: a.target ?? '', weight: String(a.weight) });
    const { data: linkedTeams } = await supabase.from('action_teams').select('team_id').eq('action_id', a.id);
    setActionTeamIds((linkedTeams ?? []).map((item) => item.team_id));
    const rec = await fetchRecurrence(a.id);
    setActionRecurrence(rec?.recurrence_type ?? 'none');
    setRecurrenceCustomDays(rec?.custom_days ? String(rec.custom_days) : '');
    setActionModal(true);
  };

  const logHistory = async (actionId: string, field: string, oldVal: string, newVal: string) => {
    if (!fact || oldVal === newVal) return;
    await supabase.from('action_history').insert({ action_id: actionId, company_id: fact.company_id, user_id: profile?.user_id, field, old_value: oldVal, new_value: newVal });
  };

  const saveAction = async () => {
    if (!actionForm.description || !fact || !profile) return;
    if (editAction) {
      // Check what changed
      const changes: { field: string; oldVal: string; newVal: string; perm: boolean }[] = [];
      if (editAction.description !== actionForm.description) changes.push({ field: 'descrição', oldVal: editAction.description, newVal: actionForm.description, perm: perms.canEditActions });
      if ((editAction.responsible_id ?? '') !== actionForm.responsible_id) changes.push({ field: 'responsável', oldVal: editAction.responsible_id ?? '-', newVal: actionForm.responsible_id || '-', perm: perms.canChangeResponsible });
      if ((editAction.deadline ?? '') !== actionForm.deadline) changes.push({ field: 'prazo', oldVal: editAction.deadline ?? '-', newVal: actionForm.deadline || '-', perm: perms.canChangeDeadlines });
      if ((editAction.indicator_of_success ?? '') !== actionForm.indicator_of_success) changes.push({ field: 'indicador', oldVal: editAction.indicator_of_success ?? '-', newVal: actionForm.indicator_of_success || '-', perm: perms.canChangeIndicators });
      if ((editAction.target ?? '') !== actionForm.target) changes.push({ field: 'meta', oldVal: editAction.target ?? '-', newVal: actionForm.target || '-', perm: perms.canChangeTargets });
      if (String(editAction.weight) !== actionForm.weight) changes.push({ field: 'peso', oldVal: String(editAction.weight), newVal: actionForm.weight, perm: perms.canChangeWeights });

      // Check if user has permission for all changes
      const unauthorized = changes.find((c) => !c.perm);
      if (unauthorized) {
        alert(`Você não tem permissão para alterar: ${unauthorized.field}`);
        return;
      }

      // If structural changes, require justification
      const hasStructuralChanges = changes.length > 0;
      if (hasStructuralChanges) {
        const changeSummary = changes.map((c) => `${c.field}: ${c.oldVal} → ${c.newVal}`).join(', ');
        setJustification({
          open: true,
          title: 'Motivo da alteração da ação',
          fieldName: changeSummary,
          oldValue: changes.map((c) => c.oldVal).join(', '),
          newValue: changes.map((c) => c.newVal).join(', '),
          onConfirm: async (reason) => {
            const payload: Record<string, unknown> = { last_updated_at: new Date().toISOString() };
            if (perms.canEditActions) payload.description = actionForm.description;
            if (perms.canChangeResponsible) payload.responsible_id = actionForm.responsible_id || null;
            payload.team = actionForm.team || null;
            payload.start_date = actionForm.start_date || null;
            if (perms.canChangeDeadlines) payload.deadline = actionForm.deadline || null;
            if (perms.canChangeIndicators) payload.indicator_of_success = actionForm.indicator_of_success || null;
            if (perms.canChangeTargets) payload.target = actionForm.target || null;
            if (perms.canChangeWeights) payload.weight = Number(actionForm.weight) || 33.33;

            const { error } = await supabase.from('actions').update(payload).eq('id', editAction.id);
            if (error) { alert(error.message); return; }
            await supabase.from('action_teams').delete().eq('action_id', editAction.id);
            if (actionTeamIds.length) await supabase.from('action_teams').insert(actionTeamIds.map((team_id) => ({ action_id: editAction.id, team_id, company_id: fact.company_id })));
            for (const c of changes) {
              await logHistory(editAction.id, c.field, c.oldVal, c.newVal);
              await insertAuditLog({
                companyId: fact.company_id, userId: profile.user_id,
                factId: fact.id, actionId: editAction.id,
                actionType: 'edit_action', fieldName: c.field,
                oldValue: c.oldVal, newValue: c.newVal, reason,
              });
              // Send notification for responsible/deadline changes
              if (c.field === 'responsável' || c.field === 'prazo') {
                const updatedAction = { ...editAction, ...payload } as Action;
                await notifyActionChanged(updatedAction, profile.user_id, c.field, c.oldVal, c.newVal, reason);
              }
            }
            // Save recurrence if changed
            if (actionRecurrence !== 'none' || recurrenceCustomDays) {
              await saveRecurrence(editAction.id, fact.company_id, {
                recurrence_type: actionRecurrence,
                custom_days: actionRecurrence === 'custom' ? Number(recurrenceCustomDays) || null : null,
              });
            } else {
              await saveRecurrence(editAction.id, fact.company_id, { recurrence_type: 'none' });
            }
            setJustification(null);
            setActionModal(false);
            load();
          },
        });
        return;
      }
      // No structural changes, just save
      const { error } = await supabase.from('actions').update({ team: actionForm.team || null, start_date: actionForm.start_date || null, last_updated_at: new Date().toISOString() }).eq('id', editAction.id);
      if (error) { alert(error.message); return; }
      await supabase.from('action_teams').delete().eq('action_id', editAction.id);
      if (actionTeamIds.length) await supabase.from('action_teams').insert(actionTeamIds.map((team_id) => ({ action_id: editAction.id, team_id, company_id: fact.company_id })));
      setActionModal(false);
      load();
    } else {
      // New action
      const payload = {
        fact_id: fact.id, company_id: fact.company_id, description: actionForm.description,
        responsible_id: actionForm.responsible_id || null, team: actionForm.team || null,
        start_date: actionForm.start_date || null, deadline: actionForm.deadline || null,
        original_deadline: actionForm.deadline ?? null,
        indicator_of_success: actionForm.indicator_of_success || null, target: actionForm.target || null,
        weight: Number(actionForm.weight) || 33.33,
      };
      const { data: newAction, error } = await supabase.from('actions').insert(payload).select().single();
      if (error || !newAction) { alert(error?.message ?? 'Erro ao criar ação'); return; }
      const newAct = newAction as Action;
      if (actionTeamIds.length) await supabase.from('action_teams').insert(actionTeamIds.map((team_id) => ({ action_id: newAct.id, team_id, company_id: fact.company_id })));
      if (actionForm.responsible_id) await supabase.from('action_assignees').upsert({ action_id: newAct.id, profile_id: actionForm.responsible_id, company_id: fact.company_id, assignment_type: 'responsible', can_edit: true, validated: false });
      if (profile) {
        await insertAuditLog({
          companyId: fact.company_id, userId: profile.user_id,
          factId: fact.id, actionType: 'create_action',
          fieldName: 'description', newValue: actionForm.description,
          reason: 'Criação de nova ação',
        });
      }
      // Notify responsible user of new action assignment
      await notifyNewAction(newAct, fact);
      // Save recurrence if configured
      if (actionRecurrence !== 'none') {
        await saveRecurrence(newAct.id, fact.company_id, {
          recurrence_type: actionRecurrence,
          custom_days: actionRecurrence === 'custom' ? Number(recurrenceCustomDays) || null : null,
        });
      }
      setActionModal(false);
      load();
    }
  };

  const validateResponsibility = async (a: Action) => {
    if (!profile || !isPrimary || !a.responsible_id || !fact) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('actions').update({ responsibility_validated: true, responsibility_validated_by: profile.id, responsibility_validated_at: now }).eq('id', a.id);
    if (error) { alert(error.message); return; }
    await supabase.from('action_assignees').upsert({ action_id: a.id, profile_id: a.responsible_id, company_id: fact.company_id, assignment_type: 'responsible', can_edit: true, validated: true, validated_by: profile.id, validated_at: now });
    load();
  };

  const updateProgress = async (a: Action, percent: number) => {
    const isResponsible = a.responsible_id === profile?.id;
    const isEditor = canManagePlan || perms.canEditActions;
    // If an editor (not the responsible) changes progress, require justification
    if (isEditor && !isResponsible && percent !== a.progress_percent) {
      setJustification({
        open: true,
        title: 'Motivo da correção de percentual',
        fieldName: 'percentual de realização',
        oldValue: `${a.progress_percent}%`,
        newValue: `${percent}%`,
        onConfirm: async (reason) => {
          const { error } = await supabase.from('actions').update({ progress_percent: percent, last_updated_at: new Date().toISOString() }).eq('id', a.id);
          if (error) { alert(error.message); return; }
          await logHistory(a.id, 'progress_percent', String(a.progress_percent), String(percent));
          if (fact && profile) {
            await insertAuditLog({
              companyId: a.company_id, userId: profile.user_id,
              factId: fact.id, actionId: a.id,
              actionType: 'edit_action', fieldName: 'percentual de realização',
              oldValue: `${a.progress_percent}%`, newValue: `${percent}%`, reason,
            });
          }
          if (percent === 100) { await supabase.from('actions').update({ approval_status: 'pending', status: 'aguardando_aprovacao' }).eq('id', a.id); }
          setJustification(null);
          load();
        },
      });
      return;
    }
    // Responsible user updating own progress — no justification needed
    const { error } = await supabase.from('actions').update({ progress_percent: percent, last_updated_at: new Date().toISOString() }).eq('id', a.id);
    if (error) { alert(error.message); return; }
    await logHistory(a.id, 'progress_percent', String(a.progress_percent), String(percent));
    if (percent === 100) { await supabase.from('actions').update({ approval_status: 'pending', status: 'aguardando_aprovacao' }).eq('id', a.id); }
    load();
  };

  const updateStatus = async (a: Action, status: ActionStatus) => {
    const { error } = await supabase.from('actions').update({ status, last_updated_at: new Date().toISOString() }).eq('id', a.id);
    if (error) { alert(error.message); return; }
    await logHistory(a.id, 'status', a.status, status);
    load();
  };

  const requestDeadline = async (a: Action, days: number) => {
    if (!perms.canChangeDeadlines) {
      // Open deadline request modal instead
      setDeadlineReqAction(a);
      setDeadlineReqModal(true);
      return;
    }
    const newDeadline = toISODate(addDays(new Date(), days));
    setJustification({
      open: true,
      title: 'Motivo da alteração de prazo',
      fieldName: 'prazo',
      oldValue: formatDate(a.deadline),
      newValue: formatDate(newDeadline),
      onConfirm: async (reason) => {
        const { error } = await supabase.from('actions').update({ deadline: newDeadline, last_updated_at: new Date().toISOString() }).eq('id', a.id);
        if (error) { alert(error.message); return; }
        await supabase.from('deadline_changes').insert({ action_id: a.id, company_id: a.company_id, old_deadline: a.deadline, new_deadline: newDeadline, reason, user_id: profile?.user_id });
        if (fact && profile) {
          await insertAuditLog({
            companyId: a.company_id, userId: profile.user_id,
            factId: fact.id, actionId: a.id,
            actionType: 'change_deadline', fieldName: 'deadline',
            oldValue: a.deadline, newValue: newDeadline, reason,
          });
        }
        // Notify responsible user about deadline change
        const updatedAction = { ...a, deadline: newDeadline } as Action;
        await notifyActionChanged(updatedAction, profile?.user_id ?? '', 'prazo', a.deadline ?? '', newDeadline, reason);
        setJustification(null);
        load();
      },
    });
  };

  const approve = async (a: Action, status: ApprovalStatus, comment: string) => {
    const newStatus = status === 'approved' ? 'concluida' : status === 'reproved' ? 'com_impedimento' : status === 'reopened' ? 'em_andamento' : a.status;
    const { error } = await supabase.from('actions').update({
      approval_status: status, approved_by: profile?.user_id, approved_at: new Date().toISOString(), approval_comment: comment,
      status: newStatus,
    }).eq('id', a.id);
    if (error) { alert(error.message); return; }
    await logHistory(a.id, 'approval', a.approval_status ?? 'none', status);
    setDetailAction(null); load();
  };

  const addComment = async (a: Action) => {
    if (!commentText.trim()) return;
    const { error } = await supabase.from('comments').insert({ action_id: a.id, company_id: a.company_id, author_id: profile?.user_id, content: commentText });
    if (error) { alert(error.message); return; }
    setCommentText(''); load();
  };

  const cancelAction = async () => {
    if (!cancelActionModal || !cancelReason.trim() || !profile) return;
    const a = cancelActionModal;
    const { error } = await supabase.from('actions').update({
      cancelled: true, cancelled_at: new Date().toISOString(), cancelled_by: profile.user_id,
      cancel_reason: cancelReason.trim(), status: 'cancelada',
    }).eq('id', a.id);
    if (error) { alert(error.message); return; }
    if (fact) {
      await insertAuditLog({
        companyId: a.company_id, userId: profile.user_id,
        factId: fact.id, actionId: a.id,
        actionType: 'cancel_action', fieldName: 'status',
        oldValue: a.status, newValue: 'cancelada', reason: cancelReason.trim(),
      });
    }
    setCancelActionModal(null);
    setCancelReason('');
    load();
  };

  const cancelFact = async () => {
    if (!fact || !cancelFactReason.trim() || !profile) return;
    setJustification({
      open: true,
      title: 'Motivo do cancelamento do fato',
      fieldName: 'status',
      oldValue: 'Ativo',
      newValue: 'Cancelado',
      onConfirm: async (reason) => {
        const { error } = await supabase.from('facts').update({
          cancelled: true, cancelled_at: new Date().toISOString(), cancelled_by: profile.user_id,
          cancel_reason: reason,
        }).eq('id', fact.id);
        if (error) { alert(error.message); return; }
        await insertAuditLog({
          companyId: fact.company_id, userId: profile.user_id,
          factId: fact.id, actionType: 'cancel_fact',
          fieldName: 'status', oldValue: 'Ativo', newValue: 'Cancelado', reason,
        });
        setJustification(null);
        setCancelFactModal(false);
        setCancelFactReason('');
        onBack();
      },
    });
  };

  const saveFactEdit = async (reason: string) => {
    if (!fact || !profile) return;
    const updates: Record<string, unknown> = {};
    const changes: { field: string; oldVal: string; newVal: string; type: string } = [];
    if (factForm.fato !== fact.fato) {
      updates.fato = factForm.fato;
      if (!fact.original_fato) updates.original_fato = fact.fato;
      changes.push({ field: 'fato', oldVal: fact.fato, newVal: factForm.fato, type: 'edit_fact' });
    }
    if (factForm.causa !== fact.causa) {
      updates.causa = factForm.causa;
      if (!fact.original_causa) updates.original_causa = fact.causa;
      changes.push({ field: 'causa', oldVal: fact.causa, newVal: factForm.causa, type: 'edit_cause' });
    }
    if (factForm.priority !== fact.priority) {
      if (!perms.canChangePriorities) { alert('Você não tem permissão para alterar prioridades.'); return; }
      updates.priority = factForm.priority;
      changes.push({ field: 'prioridade', oldVal: fact.priority, newVal: factForm.priority, type: 'edit_fact' });
    }
    if (factForm.category !== (fact.category ?? '')) {
      updates.category = factForm.category || null;
      changes.push({ field: 'categoria', oldVal: fact.category ?? '-', newVal: factForm.category || '-', type: 'edit_fact' });
    }
    if (factForm.cause_type !== (fact.cause_type ?? '')) {
      updates.cause_type = factForm.cause_type || null;
      changes.push({ field: 'classificação da causa', oldVal: fact.cause_type ?? '-', newVal: factForm.cause_type || '-', type: 'edit_fact' });
    }
    if (factForm.impact_type !== (fact.impact_type ?? '')) {
      updates.impact_type = factForm.impact_type || null;
      changes.push({ field: 'tipo de impacto', oldVal: fact.impact_type ?? '-', newVal: factForm.impact_type || '-', type: 'edit_fact' });
    }
    if (factForm.impact_level !== (fact.impact_level ?? '')) {
      updates.impact_level = factForm.impact_level || null;
      changes.push({ field: 'nível do impacto', oldVal: fact.impact_level ?? '-', newVal: factForm.impact_level || '-', type: 'edit_fact' });
    }
    if (factForm.expected_result !== (fact.expected_result ?? '')) {
      updates.expected_result = factForm.expected_result || null;
      changes.push({ field: 'resultado esperado', oldVal: fact.expected_result ?? '-', newVal: factForm.expected_result || '-', type: 'edit_fact' });
    }
    if (factForm.objective_id !== (fact.objective_id ?? '')) {
      updates.objective_id = factForm.objective_id || null;
      const oldObj = objectives.find((o) => o.id === fact.objective_id)?.name ?? '-';
      const newObj = objectives.find((o) => o.id === factForm.objective_id)?.name ?? '-';
      changes.push({ field: 'objetivo estratégico', oldVal: oldObj, newVal: newObj, type: 'edit_fact' });
    }
    if (factForm.department_id !== (fact.department_id ?? '')) {
      updates.department_id = factForm.department_id || null;
      const oldDept = departments.find((d) => d.id === fact.department_id)?.name ?? '-';
      const newDept = departments.find((d) => d.id === factForm.department_id)?.name ?? '-';
      changes.push({ field: 'departamento', oldVal: oldDept, newVal: newDept, type: 'edit_fact' });
    }
    if (factForm.unit_id !== (fact.unit_id ?? '')) {
      updates.unit_id = factForm.unit_id || null;
      changes.push({ field: 'unidade', oldVal: fact.unit_id ?? '-', newVal: factForm.unit_id || '-', type: 'edit_fact' });
    }
    if (factForm.origin_date !== (fact.origin_date ?? '')) {
      updates.origin_date = factForm.origin_date || null;
      changes.push({ field: 'data de origem', oldVal: fact.origin_date ?? '-', newVal: factForm.origin_date || '-', type: 'edit_fact' });
    }
    if (changes.length === 0) { setEditFactModal(false); return; }
    const { error } = await supabase.from('facts').update(updates).eq('id', fact.id);
    if (error) { alert(error.message); return; }
    for (const c of changes) {
      await insertAuditLog({
        companyId: fact.company_id, userId: profile.user_id,
        factId: fact.id, actionType: c.type, fieldName: c.field,
        oldValue: c.oldVal, newValue: c.newVal, reason,
      });
    }
    setEditFactModal(false);
    load();
  };

  const openEditFact = () => {
    if (!fact) return;
    setFactForm({
      fato: fact.fato, causa: fact.causa, priority: fact.priority,
      category: fact.category ?? '', cause_type: fact.cause_type ?? '',
      impact_type: fact.impact_type ?? '', impact_level: fact.impact_level ?? '',
      expected_result: fact.expected_result ?? '', objective_id: fact.objective_id ?? '',
      department_id: fact.department_id ?? '', unit_id: fact.unit_id ?? '',
      origin_date: fact.origin_date ?? '',
    });
    setEditFactModal(true);
  };

  const approveDeadlineRequest = async (req: DeadlineRequest, approved: boolean, comment: string) => {
    if (!profile) return;
    const { error } = await supabase.from('deadline_requests').update({
      status: approved ? 'approved' : 'reproved',
      reviewed_by: profile.user_id,
      reviewed_at: new Date().toISOString(),
      review_comment: comment,
    }).eq('id', req.id);
    if (error) { alert(error.message); return; }
    if (approved) {
      await supabase.from('actions').update({ deadline: req.requested_deadline, last_updated_at: new Date().toISOString() }).eq('id', req.action_id);
      await supabase.from('deadline_changes').insert({
        action_id: req.action_id, company_id: req.company_id,
        old_deadline: req.current_deadline, new_deadline: req.requested_deadline,
        reason: req.reason, user_id: req.requested_by,
      });
      if (fact) {
        await insertAuditLog({
          companyId: req.company_id, userId: profile.user_id,
          factId: fact.id, actionId: req.action_id,
          actionType: 'approve_deadline_request', fieldName: 'deadline',
          oldValue: req.current_deadline, newValue: req.requested_deadline,
          reason: `Aprovado: ${comment || req.reason}`,
        });
      }
    }
    load();
  };

  if (loading) return <div className="text-slate-400">Carregando...</div>;
  if (!fact) return <EmptyState icon={<AlertCircle size={28} />} title="Fato não encontrado" message="O fato solicitado não existe." />;

  if (fact.cancelled) {
    return (
      <div className="space-y-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition">
          <ArrowLeft size={18} /> Voltar para fatos
        </button>
        <Card className="p-6">
          <EmptyState
            icon={<Ban size={28} />}
            title="Fato cancelado"
            message={`Este fato foi cancelado. Motivo: ${fact.cancel_reason ?? 'Não informado'}`}
          />
        </Card>
      </div>
    );
  }

  const obj = objectives.find((o) => o.id === fact.objective_id);
  const dept = departments.find((d) => d.id === fact.department_id);
  const unit = units.find((u) => u.id === fact.unit_id);
  const canEditFact = isPrimary || perms.canEditFact;
  const canEditCause = isPrimary || perms.canEditCause;

  // Audit log history list (combined with action_history)
  const allHistoryItems = [
    ...auditLogs.map((al) => ({
      user: users.find((u) => u.user_id === al.user_id)?.full_name ?? 'Usuário',
      field: al.field_name ?? al.action_type,
      oldVal: al.old_value, newVal: al.new_value,
      reason: al.reason, date: al.created_at,
    })),
    ...history.map((h) => ({
      user: users.find((u) => u.user_id === h.user_id)?.full_name ?? 'Usuário',
      field: h.field, oldVal: h.old_value, newVal: h.new_value,
      reason: undefined as string | undefined, date: h.created_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition">
        <ArrowLeft size={18} /> Voltar para fatos
      </button>

      {/* Fact header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-slate-100 text-slate-600 font-mono">{fact.code}</Badge>
            <Badge className={cn('capitalize', fact.priority === 'critica' ? 'bg-red-100 text-red-700' : fact.priority === 'alta' ? 'bg-orange-100 text-orange-700' : fact.priority === 'media' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600')}>Prioridade {fact.priority}</Badge>
            {fact.impact_level && <Badge className="bg-amber-100 text-amber-700">Impacto {IMPACT_LEVELS.find((i) => i.value === fact.impact_level)?.label}</Badge>}
            {fact.category && <Badge className="bg-slate-100 text-slate-500 capitalize">{fact.category}</Badge>}
          </div>
          <div className="flex gap-2">
            {canManagePlan && (
              <Button variant="primary" size="sm" onClick={openEditFact}><Edit3 size={14} /> Editar Plano</Button>
            )}
            {canManagePermissions(profile) && (
              <Button variant="outline" size="sm" onClick={() => setPlanPermsModal(true)}><Shield size={14} /> Permissões do plano</Button>
            )}
            {isPrimary && !fact.cancelled && (
              <Button variant="outline" size="sm" onClick={() => setCancelFactModal(true)}><Ban size={14} /> Cancelar fato</Button>
            )}
          </div>
        </div>
        {/* Last modification indicator */}
        {allHistoryItems.length > 0 && (() => {
          const lastMod = allHistoryItems[0];
          return (
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
              <Clock size={12} />
              <span>Última alteração: {formatDateTime(lastMod.date)} por {lastMod.user}</span>
              <button onClick={() => setTab('history')} className="text-sow-600 hover:text-sow-700 font-medium">Ver histórico</button>
            </div>
          );
        })()}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Fato {canEditFact && fact.original_fato && fact.original_fato !== fact.fato && <span className="text-amber-500 normal-case ml-1">— versão original preservada</span>}</div>
              <p className="text-slate-900">{fact.fato}</p>
              {canEditFact && fact.original_fato && fact.original_fato !== fact.fato && (
                <p className="text-xs text-slate-400 mt-1 italic">Original: {fact.original_fato}</p>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Causa {fact.cause_type && <span className="text-slate-400 normal-case">— {fact.cause_type}</span>}</div>
              <p className="text-slate-700">{fact.causa}</p>
              {canEditCause && fact.original_causa && fact.original_causa !== fact.causa && (
                <p className="text-xs text-slate-400 mt-1 italic">Original: {fact.original_causa}</p>
              )}
            </div>
            {fact.impact_type && <div><div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Impacto</div><p className="text-slate-700 capitalize">{fact.impact_type}</p></div>}
            {fact.expected_result && <div><div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Resultado esperado</div><p className="text-slate-700">{fact.expected_result}</p></div>}
          </div>
          <div className="space-y-3 text-sm">
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between"><span className="text-slate-500">Objetivo</span><span className="font-medium text-slate-700 text-right">{obj?.name ?? '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Departamento</span><span className="font-medium text-slate-700 text-right">{dept?.name ?? '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Unidade</span><span className="font-medium text-slate-700 text-right">{unit?.name ?? '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Origem</span><span className="font-medium text-slate-700">{formatDate(fact.origin_date)}</span></div>
            </div>
            <div className="bg-sow-50 rounded-lg p-4">
              <div className="text-xs text-sow-700 font-medium mb-1">Progresso geral do plano</div>
              <div className="text-2xl font-bold text-sow-800 mb-2">{planProgress}%</div>
              <ProgressBar value={planProgress} />
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap border-b border-slate-200">
        {[
          { id: 'actions' as Tab, label: 'Ações', count: actions.length },
          { id: 'history' as Tab, label: 'Histórico', count: allHistoryItems.length },
          { id: 'deadline_requests' as Tab, label: 'Solicitações de prazo', count: deadlineRequests.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition -mb-px',
              tab === t.id ? 'border-sow-600 text-sow-700' : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label} <span className="text-xs text-slate-400">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Actions tab */}
      {tab === 'actions' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Ações do plano ({actions.length}/3)</h2>
            {canManagePlan && actions.length < 3 && <Button size="sm" onClick={openNewAction}><Plus size={16} /> Nova ação</Button>}
          </div>
          {actions.length === 0 ? (
            <Card><EmptyState icon={<Plus size={28} />} title="Nenhuma ação" message="Adicione de 1 a 3 ações para este fato." /></Card>
          ) : (
            <div className="space-y-4">
              {actions.map((a, idx) => {
                const resp = users.find((u) => u.id === a.responsible_id);
                const d = daysUntil(a.deadline);
                const overdue = isOverdue(a.deadline, a.status);
                const aComments = comments[a.id] ?? [];
                const isResponsible = a.responsible_id === profile?.id;
                const canEditThisAction = canManagePlan || perms.canEditActions;
                const canUpdateProgress = canEditThisAction || isResponsible;
                return (
                  <Card key={a.id} className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-6 h-6 rounded-full bg-sow-100 text-sow-700 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                          <Badge className={cn(STATUS_COLORS[a.status].bg, STATUS_COLORS[a.status].text)}><span className={cn('w-1.5 h-1.5 rounded-full', STATUS_COLORS[a.status].dot)} />{STATUS_LABELS[a.status]}</Badge>
                          {a.approval_status && a.approval_status !== 'approved' && <Badge className="bg-violet-100 text-violet-700">Aprovação: {a.approval_status}</Badge>}
                          {a.responsible_id && (a.responsibility_validated ? <Badge className="bg-emerald-100 text-emerald-700">Responsável validado</Badge> : isPrimary ? <button onClick={() => validateResponsibility(a)} className="text-xs text-sow-700 underline">Validar responsável</button> : <Badge className="bg-amber-100 text-amber-700">Aguardando validação</Badge>)}
                        </div>
                        <h3 className="font-semibold text-slate-900">{a.description}</h3>
                        {a.original_description && a.original_description !== a.description && canManagePlan && (
                          <p className="text-xs text-slate-400 mt-0.5 italic">Original: {a.original_description}</p>
                        )}
                        {a.indicator_of_success && <p className="text-sm text-slate-500 mt-1">Indicador: {a.indicator_of_success} {a.target && `• Meta: ${a.target}`}</p>}
                      </div>
                      {canManagePlan && !a.cancelled && (
                        <div className="flex gap-1">
                          <button onClick={() => openEditAction(a)} className="p-1.5 text-slate-400 hover:text-sow-600 rounded" title="Editar"><Pencil size={16} /></button>
                          {perms.canCancelActions && (
                            <button onClick={() => setCancelActionModal(a)} className="p-1.5 text-slate-300 hover:text-red-500 rounded" title="Cancelar"><Ban size={16} /></button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                      <div><div className="text-xs text-slate-400">Responsável</div><div className="font-medium text-slate-700">{resp?.full_name ?? 'Não atribuído'}</div></div>
                      <div><div className="text-xs text-slate-400">Prazo</div><div className={cn('font-medium', overdue ? 'text-red-600' : 'text-slate-700')}>{formatDate(a.deadline)} {d !== null && a.status !== 'concluida' && <span className="text-xs">({d > 0 ? `${d}d` : d === 0 ? 'hoje' : `${Math.abs(d)}d atraso`})</span>}</div></div>
                      <div><div className="text-xs text-slate-400">Início</div><div className="font-medium text-slate-700">{formatDate(a.start_date)}</div></div>
                      <div><div className="text-xs text-slate-400">Peso</div><div className="font-medium text-slate-700">{a.weight}%</div></div>
                    </div>

                    {/* Progress */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-slate-500">Percentual de realização</span>
                        <span className="text-sm font-bold text-slate-700">{a.progress_percent}%</span>
                      </div>
                      <ProgressBar value={a.progress_percent} className="mb-2" />
                      {canUpdateProgress && (
                        <div className="flex flex-wrap gap-1.5">
                          {PROGRESS_STEPS.map((p) => (
                            <button key={p} onClick={() => updateProgress(a, p)} className={cn('px-2.5 py-1 rounded text-xs font-medium transition', a.progress_percent === p ? 'bg-sow-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{p}%</button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                      {canEditThisAction && (
                        <Select value={a.status} onChange={(v) => updateStatus(a, v as ActionStatus)} options={STATUS_OPTIONS} className="w-48" />
                      )}
                      {canEditThisAction && (
                        <Button variant="outline" size="sm" onClick={() => openEditAction(a)}><Pencil size={14} /> Editar</Button>
                      )}
                      {!canEditThisAction && (
                        <Button variant="outline" size="sm" onClick={() => setDetailAction(a)}><Eye size={14} /> Visualizar</Button>
                      )}
                      {!perms.canChangeDeadlines && !isPrimary && !planPerms && (
                        <Button variant="outline" size="sm" onClick={() => { setDeadlineReqAction(a); setDeadlineReqModal(true); }}>
                          <Clock size={14} /> Solicitar alteração de prazo
                        </Button>
                      )}
                      {perms.canChangeDeadlines && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">Prazo:</span>
                          {QUICK_DEADLINES.slice(0, 4).map((q) => (
                            <button key={q.days} onClick={() => requestDeadline(a, q.days)} className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-600 hover:bg-slate-200">{q.label}</button>
                          ))}
                        </div>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setDetailAction(a)}><MessageSquare size={14} /> Detalhes ({aComments.length})</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <Card className="p-6">
          {allHistoryItems.length === 0 ? (
            <EmptyState icon={<HistoryIcon size={28} />} title="Nenhum histórico" message="As alterações aparecerão aqui." />
          ) : (
            <div className="space-y-3">
              {allHistoryItems.map((item, idx) => (
                <div key={idx} className="border-l-2 border-slate-200 pl-4 py-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span className="font-medium text-slate-600">{item.user}</span>
                    <span>•</span>
                    <span>{formatDateTime(item.date)}</span>
                  </div>
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">{item.field}</span>: {item.oldVal ?? '-'} → {item.newVal ?? '-'}
                  </div>
                  {item.reason && <div className="text-xs text-slate-500 mt-0.5">Motivo: {item.reason}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Deadline requests tab */}
      {tab === 'deadline_requests' && (
        <Card className="p-6">
          {deadlineRequests.length === 0 ? (
            <EmptyState icon={<Clock size={28} />} title="Nenhuma solicitação" message="Solicitações de alteração de prazo aparecerão aqui." />
          ) : (
            <div className="space-y-3">
              {deadlineRequests.map((req) => {
                const action = actions.find((a) => a.id === req.action_id);
                const requester = users.find((u) => u.user_id === req.requested_by);
                const reviewer = users.find((u) => u.user_id === req.reviewed_by);
                const canReview = isPrimary || perms.canChangeDeadlines;
                return (
                  <div key={req.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={req.status === 'pending' ? 'bg-amber-100 text-amber-700' : req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                          {req.status === 'pending' ? 'Pendente' : req.status === 'approved' ? 'Aprovada' : 'Reprovada'}
                        </Badge>
                        <span className="text-sm font-medium text-slate-700">{action?.description ?? 'Ação'}</span>
                      </div>
                      <span className="text-xs text-slate-400">{formatDateTime(req.created_at)}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-2">
                      <div><div className="text-xs text-slate-400">Solicitante</div><div className="font-medium text-slate-700">{requester?.full_name ?? '-'}</div></div>
                      <div><div className="text-xs text-slate-400">Prazo atual</div><div className="font-medium text-slate-700">{formatDate(req.current_deadline)}</div></div>
                      <div><div className="text-xs text-slate-400">Novo prazo</div><div className="font-medium text-slate-700">{formatDate(req.requested_deadline)}</div></div>
                      {req.reviewed_at && <div><div className="text-xs text-slate-400">Revisado por</div><div className="font-medium text-slate-700">{reviewer?.full_name ?? '-'}</div></div>}
                    </div>
                    <div className="text-sm text-slate-600 mb-1"><span className="text-slate-400">Motivo:</span> {req.reason}</div>
                    {req.observation && <div className="text-sm text-slate-600 mb-1"><span className="text-slate-400">Observação:</span> {req.observation}</div>}
                    {req.review_comment && <div className="text-sm text-slate-600 mb-1"><span className="text-slate-400">Comentário do revisor:</span> {req.review_comment}</div>}
                    {req.status === 'pending' && canReview && (
                      <DeadlineReviewButtons onApprove={(comment) => approveDeadlineRequest(req, true, comment)} onReject={(comment) => approveDeadlineRequest(req, false, comment)} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Action modal */}
      <Modal open={actionModal} onClose={() => setActionModal(false)} title={editAction ? 'Editar ação' : 'Nova ação'} size="lg">
        <div className="space-y-4">
          <Textarea label="Descrição da ação" value={actionForm.description} onChange={(v) => setActionForm({ ...actionForm, description: v })} required rows={2} placeholder="Ex: Contratar ou realocar vendedores para Santa Catarina." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Responsável" value={actionForm.responsible_id} onChange={(v) => setActionForm({ ...actionForm, responsible_id: v })} placeholder="Selecione" options={users.map((u) => ({ value: u.id, label: u.full_name }))} />
            <div><div className="block text-sm font-medium text-slate-700 mb-1.5">Equipe envolvida</div><div className="max-h-32 overflow-y-auto border border-slate-300 rounded-lg">{teams.length === 0 ? <div className="p-2.5 text-sm text-slate-500">Nenhuma equipe cadastrada.</div> : teams.map((team) => <label key={team.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-slate-50"><input type="checkbox" checked={actionTeamIds.includes(team.id)} onChange={() => setActionTeamIds((current) => current.includes(team.id) ? current.filter((id) => id !== team.id) : [...current, team.id])} />{team.name}</label>)}</div><p className="text-xs text-slate-500 mt-1">Selecione uma ou mais equipes já formadas no sistema.</p></div>
            <Input label="Data de início" type="date" value={actionForm.start_date} onChange={(v) => setActionForm({ ...actionForm, start_date: v })} />
            <Input label="Prazo final" type="date" value={actionForm.deadline} onChange={(v) => setActionForm({ ...actionForm, deadline: v })} />
            <Input label="Indicador de sucesso" value={actionForm.indicator_of_success} onChange={(v) => setActionForm({ ...actionForm, indicator_of_success: v })} placeholder="Ex: Número de vendedores ativos" />
            <Input label="Meta esperada" value={actionForm.target} onChange={(v) => setActionForm({ ...actionForm, target: v })} placeholder="Ex: 2 novos vendedores" />
            <Input label="Peso (%)" type="number" value={actionForm.weight} onChange={(v) => setActionForm({ ...actionForm, weight: v })} />
          </div>
          {/* Recurrence */}
          <div className="border-t border-slate-100 pt-3">
            <Select label="Recorrência" value={actionRecurrence} onChange={(v) => setActionRecurrence(v as RecurrenceType)} options={RECURRENCE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))} />
            {actionRecurrence === 'custom' && (
              <div className="mt-2">
                <Input label="Dias personalizados" type="number" value={recurrenceCustomDays} onChange={setRecurrenceCustomDays} placeholder="Ex: 10" />
              </div>
            )}
          </div>
          {editAction && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">Alterações estruturais exigirão justificativa obrigatória.</div>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setActionModal(false)}>Cancelar</Button><Button onClick={saveAction}>{editAction ? 'Salvar' : 'Criar ação'}</Button></div>
        </div>
      </Modal>

      {/* Edit fact modal */}
      <Modal open={editFactModal} onClose={() => setEditFactModal(false)} title="Editar plano de ação" size="xl">
        <div className="space-y-4">
          {/* Identificação */}
          <div className="border-b border-slate-100 pb-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Identificação</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="Objetivo estratégico" value={factForm.objective_id} onChange={(v) => setFactForm({ ...factForm, objective_id: v })} placeholder="Selecione" options={[{ value: '', label: 'Nenhum' }, ...objectives.map((o) => ({ value: o.id, label: o.name }))]} />
              <Select label="Departamento" value={factForm.department_id} onChange={(v) => setFactForm({ ...factForm, department_id: v })} placeholder="Selecione" options={[{ value: '', label: 'Nenhum' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
              <Select label="Unidade" value={factForm.unit_id} onChange={(v) => setFactForm({ ...factForm, unit_id: v })} placeholder="Selecione" options={[{ value: '', label: 'Nenhuma' }, ...units.map((u) => ({ value: u.id, label: u.name }))]} />
              <Select label="Categoria" value={factForm.category} onChange={(v) => setFactForm({ ...factForm, category: v })} placeholder="Selecione" options={[{ value: '', label: 'Nenhuma' }, ...ACTION_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
              <Select label="Prioridade" value={factForm.priority} onChange={(v) => setFactForm({ ...factForm, priority: v as Fact['priority'] })} options={[{ value: 'baixa', label: 'Baixa' }, { value: 'media', label: 'Média' }, { value: 'alta', label: 'Alta' }, { value: 'critica', label: 'Crítica' }]} />
              <Input label="Data de origem" type="date" value={factForm.origin_date} onChange={(v) => setFactForm({ ...factForm, origin_date: v })} />
            </div>
          </div>
          {/* Fato e Causa */}
          <div className="border-b border-slate-100 pb-3 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Fato e Causa</div>
            <Textarea label="Fato" value={factForm.fato} onChange={(v) => setFactForm({ ...factForm, fato: v })} required rows={3} />
            <Textarea label="Causa" value={factForm.causa} onChange={(v) => setFactForm({ ...factForm, causa: v })} required rows={3} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="Classificação da causa" value={factForm.cause_type} onChange={(v) => setFactForm({ ...factForm, cause_type: v })} placeholder="Selecione" options={[{ value: '', label: 'Nenhuma' }, ...CAUSE_TYPES.map((c) => ({ value: c, label: c }))]} />
            </div>
          </div>
          {/* Impacto */}
          <div className="border-b border-slate-100 pb-3 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Impacto</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="Tipo de impacto" value={factForm.impact_type} onChange={(v) => setFactForm({ ...factForm, impact_type: v })} placeholder="Selecione" options={[{ value: '', label: 'Nenhum' }, ...IMPACT_TYPES.map((i) => ({ value: i, label: i }))]} />
              <Select label="Nível do impacto" value={factForm.impact_level} onChange={(v) => setFactForm({ ...factForm, impact_level: v })} placeholder="Selecione" options={[{ value: '', label: 'Nenhum' }, ...IMPACT_LEVELS.map((i) => ({ value: i.value, label: i.label }))]} />
            </div>
          </div>
          {/* Resultado esperado */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Resultado esperado</div>
            <Textarea label="Resultado esperado" value={factForm.expected_result} onChange={(v) => setFactForm({ ...factForm, expected_result: v })} rows={2} placeholder="Descreva o resultado esperado..." />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">A alteração exigirá um motivo obrigatório. O valor original será preservado no histórico.</div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditFactModal(false)}>Cancelar</Button>
            <Button onClick={() => {
              const hasChanges =
                factForm.fato !== fact.fato || factForm.causa !== fact.causa ||
                factForm.priority !== fact.priority || factForm.category !== (fact.category ?? '') ||
                factForm.cause_type !== (fact.cause_type ?? '') || factForm.impact_type !== (fact.impact_type ?? '') ||
                factForm.impact_level !== (fact.impact_level ?? '') || factForm.expected_result !== (fact.expected_result ?? '') ||
                factForm.objective_id !== (fact.objective_id ?? '') || factForm.department_id !== (fact.department_id ?? '') ||
                factForm.unit_id !== (fact.unit_id ?? '') || factForm.origin_date !== (fact.origin_date ?? '');
              if (!hasChanges) { setEditFactModal(false); return; }
              setJustification({
                open: true,
                title: 'Motivo da alteração do plano',
                fieldName: 'Plano de Ação',
                oldValue: fact.fato,
                newValue: factForm.fato,
                onConfirm: (reason) => { saveFactEdit(reason); setJustification(null); },
              });
            }}>Salvar alterações</Button>
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detailAction} onClose={() => setDetailAction(null)} title="Detalhes da ação" size="lg">
        {detailAction && (
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">{detailAction.description}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn(STATUS_COLORS[detailAction.status].bg, STATUS_COLORS[detailAction.status].text)}>{STATUS_LABELS[detailAction.status]}</Badge>
                <span className="text-sm text-slate-500">{detailAction.progress_percent}% concluído</span>
              </div>
            </div>

            {/* Approval section */}
            {perms.canApproveActions && detailAction.approval_status === 'pending' && (
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                <div className="text-sm font-medium text-violet-800 mb-2">Ação aguardando aprovação</div>
                <ApprovalButtons action={detailAction} onApprove={approve} />
              </div>
            )}
            {detailAction.approval_status === 'approved' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 size={18} /> Aprovada em {formatDateTime(detailAction.approved_at)} {detailAction.approval_comment && `— "${detailAction.approval_comment}"`}
              </div>
            )}
            {detailAction.approval_status === 'reproved' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
                <XCircle size={18} /> Reprovada {detailAction.approval_comment && `— "${detailAction.approval_comment}"`}
              </div>
            )}

            {/* Comments */}
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3"><MessageSquare size={16} /> Comentários</div>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                {(comments[detailAction.id] ?? []).map((c) => {
                  const author = users.find((u) => u.user_id === c.author_id);
                  return (
                    <div key={c.id} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-slate-700">{author?.full_name ?? 'Usuário'}</span><span className="text-xs text-slate-400">{formatDateTime(c.created_at)}</span></div>
                      <p className="text-sm text-slate-600">{c.content}</p>
                    </div>
                  );
                })}
                {((comments[detailAction.id] ?? []).length === 0) && <p className="text-sm text-slate-400">Nenhum comentário ainda.</p>}
              </div>
              <div className="flex gap-2">
                <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Escreva um comentário..." className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sow-500 outline-none" onKeyDown={(e) => e.key === 'Enter' && addComment(detailAction)} />
                <Button size="sm" onClick={() => addComment(detailAction)}>Enviar</Button>
              </div>
            </div>

            {/* History */}
            {history.filter((h) => h.action_id === detailAction.id).length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3"><HistoryIcon size={16} /> Histórico de alterações</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {history.filter((h) => h.action_id === detailAction.id).map((h) => (
                    <div key={h.id} className="text-xs text-slate-500 border-l-2 border-slate-200 pl-3">
                      <span className="font-medium text-slate-600">{h.field}</span>: {h.old_value ?? '-'} → {h.new_value ?? '-'} <span className="text-slate-400">({formatDateTime(h.created_at)})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deadline changes */}
            {deadlineChanges.filter((dc) => dc.action_id === detailAction.id).length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3"><Clock size={16} /> Alterações de prazo</div>
                <div className="space-y-2">
                  {deadlineChanges.filter((dc) => dc.action_id === detailAction.id).map((dc) => (
                    <div key={dc.id} className="text-xs text-slate-500 bg-slate-50 rounded p-2">
                      {formatDate(dc.old_deadline)} → <span className="font-medium text-slate-700">{formatDate(dc.new_deadline)}</span> — {dc.reason} <span className="text-slate-400">({formatDate(dc.created_at)})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Justification modal */}
      {justification && (
        <JustificationModal
          open={justification.open}
          title={justification.title}
          fieldName={justification.fieldName}
          oldValue={justification.oldValue}
          newValue={justification.newValue}
          onClose={() => setJustification(null)}
          onConfirm={justification.onConfirm}
        />
      )}

      {/* Deadline request modal */}
      <DeadlineRequestModal
        open={deadlineReqModal}
        onClose={() => { setDeadlineReqModal(false); setDeadlineReqAction(null); }}
        action={deadlineReqAction}
        companyId={companyId!}
      />

      {/* Plan permissions modal */}
      <PlanPermissionsModal
        open={planPermsModal}
        onClose={() => setPlanPermsModal(false)}
        factId={factId}
        companyId={companyId!}
        users={users}
      />

      {/* Cancel action modal */}
      <Modal open={!!cancelActionModal} onClose={() => { setCancelActionModal(null); setCancelReason(''); }} title="Cancelar ação" size="md">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">A ação será cancelada, não excluída. O registro será mantido no histórico.</div>
          <Textarea label="Motivo do cancelamento" value={cancelReason} onChange={setCancelReason} required rows={3} placeholder="Descreva o motivo..." />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setCancelActionModal(null); setCancelReason(''); }}>Cancelar</Button>
            <Button variant="danger" onClick={cancelAction} disabled={!cancelReason.trim()}>Confirmar cancelamento</Button>
          </div>
        </div>
      </Modal>

      {/* Cancel fact modal */}
      <Modal open={cancelFactModal} onClose={() => { setCancelFactModal(false); setCancelFactReason(''); }} title="Cancelar fato" size="md">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">O fato será cancelado, não excluído. Todas as ações e o histórico serão preservados.</div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setCancelFactModal(false); setCancelFactReason(''); }}>Voltar</Button>
            <Button variant="danger" onClick={cancelFact}>Confirmar cancelamento</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ApprovalButtons({ action, onApprove }: { action: Action; onApprove: (a: Action, s: ApprovalStatus, c: string) => void }) {
  const [comment, setComment] = useState('');
  return (
    <div className="space-y-3">
      <Textarea label="Comentário de avaliação" value={comment} onChange={setComment} rows={2} placeholder="Avaliação da entrega..." />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onApprove(action, 'approved', comment)}><CheckCircle2 size={16} /> Aprovar</Button>
        <Button size="sm" variant="danger" onClick={() => onApprove(action, 'reproved', comment)}><XCircle size={16} /> Reprovar</Button>
        <Button size="sm" variant="outline" onClick={() => onApprove(action, 'correction', comment)}>Solicitar correção</Button>
        <Button size="sm" variant="outline" onClick={() => onApprove(action, 'info', comment)}>Solicitar informações</Button>
        <Button size="sm" variant="ghost" onClick={() => onApprove(action, 'reopened', comment)}>Reabrir</Button>
      </div>
    </div>
  );
}

function DeadlineReviewButtons({ onApprove, onReject }: { onApprove: (comment: string) => void; onReject: (comment: string) => void }) {
  const [comment, setComment] = useState('');
  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-slate-100">
      <Textarea label="Comentário de avaliação" value={comment} onChange={setComment} rows={2} placeholder="Avaliação da solicitação..." />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onApprove(comment)}><CheckCircle2 size={16} /> Aprovar</Button>
        <Button size="sm" variant="danger" onClick={() => onReject(comment)}><XCircle size={16} /> Reprovar</Button>
      </div>
    </div>
  );
}
