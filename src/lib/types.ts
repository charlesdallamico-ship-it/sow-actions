export type Role = 'sow_admin' | 'company_admin' | 'area_manager' | 'responsible' | 'viewer';

export type ActionStatus =
  | 'nao_iniciada'
  | 'em_planejamento'
  | 'em_andamento'
  | 'aguardando_terceiro'
  | 'aguardando_aprovacao'
  | 'com_impedimento'
  | 'atrasada'
  | 'concluida'
  | 'cancelada';

export type ApprovalStatus = 'pending' | 'approved' | 'reproved' | 'correction' | 'info' | 'reopened';

export type CompanyStatus = 'active' | 'trial' | 'suspended' | 'inactive';
export type PlanType = 'start' | 'professional' | 'business' | 'enterprise';

export interface Company {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj: string | null;
  logo_url: string | null;
  segment: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  main_contact: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  mission: string | null;
  vision: string | null;
  values: string | null;
  active: boolean;
  status: CompanyStatus;
  plan_type: PlanType;
  max_users: number;
  is_demo: boolean;
  start_date: string | null;
  end_date: string | null;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  company_id: string | null;
  active_company_id: string | null;
  full_name: string;
  email: string;
  role: Role;
  department_id: string | null;
  position: string | null;
  phone: string | null;
  active: boolean;
  is_primary_admin: boolean;
  last_login_at: string | null;
  deactivated_at: string | null;
  email_confirmed_at: string | null;
  registration_source: 'self_signup' | 'signup_link' | 'manual_invite' | 'manual_assignment';
  company_assignment_status: 'pending' | 'approved' | 'rejected';
  assigned_at: string | null;
  assigned_by: string | null;
  created_at: string;
}

export interface SignupLink {
  id: string;
  company_id: string;
  role: Role;
  department_id: string | null;
  token: string;
  label: string | null;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface StrategicObjective {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  type: string | null;
  created_at: string;
}

export interface Indicator {
  id: string;
  company_id: string;
  objective_id: string | null;
  name: string;
  unit: string | null;
  current_value: number | null;
  target_value: number | null;
  measure_date: string | null;
  achieved_value: number | null;
  created_at: string;
}

export interface Fact {
  id: string;
  company_id: string;
  code: string;
  objective_id: string | null;
  department_id: string | null;
  unit_id: string | null;
  category: string | null;
  priority: 'baixa' | 'media' | 'alta' | 'critica';
  origin_date: string;
  fato: string;
  causa: string;
  cause_type: string | null;
  impact_type: string | null;
  impact_level: 'baixo' | 'medio' | 'alto' | 'critico' | null;
  expected_result: string | null;
  created_by: string | null;
  created_at: string;
  cancelled: boolean;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  original_fato: string | null;
  original_causa: string | null;
}

export interface Action {
  id: string;
  fact_id: string;
  company_id: string;
  description: string;
  responsible_id: string | null;
  team: string | null;
  start_date: string | null;
  deadline: string | null;
  original_deadline: string | null;
  indicator_of_success: string | null;
  target: string | null;
  progress_percent: number;
  weight: number;
  status: ActionStatus;
  comments: string | null;
  attachment_url: string | null;
  last_updated_at: string;
  approval_status: ApprovalStatus | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_comment: string | null;
  approval_evaluation: string | null;
  completion_evidence: string | null;
  created_at: string;
  cancelled: boolean;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  original_description: string | null;
  recurrence_configured: boolean;
}

export interface Comment {
  id: string;
  action_id: string;
  company_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
}

export interface ActionHistory {
  id: string;
  action_id: string;
  company_id: string;
  user_id: string | null;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
}

export interface DeadlineChange {
  id: string;
  action_id: string;
  company_id: string;
  old_deadline: string | null;
  new_deadline: string | null;
  reason: string | null;
  user_id: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  company_id: string;
  user_id: string | null;
  action_id: string | null;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface FactWithRelations extends Fact {
  objective?: StrategicObjective | null;
  department?: Department | null;
  unit?: Unit | null;
  actions?: Action[];
}

export interface ActionWithRelations extends Action {
  responsible?: Profile | null;
  fact?: Fact | null;
  commentList?: Comment[];
  historyList?: ActionHistory[];
}

export type PermissionKey =
  | 'can_create_facts'
  | 'can_edit_facts'
  | 'can_edit_causes'
  | 'can_create_plans'
  | 'can_edit_plans'
  | 'can_create_actions'
  | 'can_edit_actions'
  | 'can_change_responsible'
  | 'can_change_deadlines'
  | 'can_change_indicators'
  | 'can_change_targets'
  | 'can_change_priorities'
  | 'can_change_weights'
  | 'can_cancel_actions'
  | 'can_reopen_actions'
  | 'can_approve_actions'
  | 'can_view_all_actions'
  | 'can_view_history';

export interface UserPermission {
  id: string;
  company_id: string;
  user_id: string;
  profile_id: string;
  can_create_facts: boolean;
  can_edit_facts: boolean;
  can_edit_causes: boolean;
  can_create_plans: boolean;
  can_edit_plans: boolean;
  can_create_actions: boolean;
  can_edit_actions: boolean;
  can_change_responsible: boolean;
  can_change_deadlines: boolean;
  can_change_indicators: boolean;
  can_change_targets: boolean;
  can_change_priorities: boolean;
  can_change_weights: boolean;
  can_cancel_actions: boolean;
  can_reopen_actions: boolean;
  can_approve_actions: boolean;
  can_view_all_actions: boolean;
  can_view_history: boolean;
  full_management: boolean;
  is_primary_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanPermission {
  id: string;
  fact_id: string;
  company_id: string;
  user_id: string;
  profile_id: string;
  can_edit: boolean;
  created_at: string;
}

export interface DeadlineRequest {
  id: string;
  action_id: string;
  company_id: string;
  requested_by: string | null;
  current_deadline: string | null;
  requested_deadline: string;
  reason: string;
  observation: string | null;
  status: 'pending' | 'approved' | 'reproved';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  company_id: string;
  user_id: string | null;
  fact_id: string | null;
  action_id: string | null;
  action_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
}

export type RecurrenceType =
  | 'none' | 'daily' | 'every_2_days' | 'every_3_days'
  | 'weekly' | 'every_15_days' | 'monthly' | 'custom';

export interface ActionRecurrence {
  id: string;
  action_id: string;
  company_id: string;
  recurrence_type: RecurrenceType;
  custom_days: number | null;
  weekday: number | null;
  preferred_time: string;
  start_date: string;
  end_date: string | null;
  last_sent_at: string | null;
  next_send_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettings {
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
  sender_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  company_id: string;
  receive_recurrence: boolean;
  receive_weekly_summary: boolean;
  receive_deadline_reminders: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  company_id: string;
  user_id: string | null;
  action_id: string | null;
  notification_type: string;
  subject: string;
  recipient_email: string;
  scheduled_at: string | null;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  dedup_key: string | null;
  created_at: string;
}

export interface EscalationRule {
  id: string;
  company_id: string;
  delay_days: number;
  notify_responsible: boolean;
  notify_managers: boolean;
  notify_admins: boolean;
  critical_alert: boolean;
  created_at: string;
}

export interface SupportAccessLog {
  id: string;
  sow_admin_user_id: string;
  company_id: string;
  reason: string | null;
  accessed_at: string;
}

export interface InviteToken {
  id: string;
  company_id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: Role;
  department_id: string | null;
  position: string | null;
  phone: string | null;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface PasswordResetToken {
  id: string;
  company_id: string | null;
  user_id: string;
  email: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface InAppNotification {
  id: string;
  company_id: string;
  user_id: string;
  action_id: string | null;
  fact_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}
