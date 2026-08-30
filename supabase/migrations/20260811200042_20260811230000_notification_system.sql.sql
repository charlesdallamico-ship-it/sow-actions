/*
# Email Notification & Recurrence System for SOW ACTION

## Overview
Adds automatic email notifications, recurrence-based follow-ups, deadline reminders,
overdue escalation, and weekly summaries to the SOW ACTION system.

## New Tables

1. `notification_settings` — Per-company email/notification configuration
   - company_id (FK to companies)
   - emails_enabled (bool, default true)
   - default_send_time (time, default '08:00')
   - default_recurrence (text, default 'weekly')
   - deadline_reminders_enabled (bool, default true)
   - overdue_alerts_enabled (bool, default true)
   - weekly_summary_enabled (bool, default true)
   - escalation_enabled (bool, default true)
   - no_movement_days (int, default 7) — days without update before alert
   - no_movement_enabled (bool, default true)
   - sender_name (text, default 'SOW ACTION')
   - sender_email (text, nullable)
   - created_at, updated_at

2. `notification_preferences` — Per-user notification preferences
   - user_id, company_id
   - receive_recurrence (bool, default true) — user can opt out of recurrence emails
   - receive_weekly_summary (bool, default true)
   - receive_deadline_reminders (bool, default true)
   - Mandatory notifications (new_action, critical_change, overdue, reproved, deadline_change, responsible_change) are ALWAYS sent — not stored as preferences
   - created_at, updated_at

3. `action_recurrence` — Recurrence configuration per action
   - action_id (FK to actions, unique)
   - recurrence_type (enum: none, daily, every_2_days, every_3_days, weekly, every_15_days, monthly, custom)
   - custom_days (int, nullable) — for custom recurrence
   - weekday (int 0-6, nullable) — for weekly/custom
   - preferred_time (time, default '08:00')
   - start_date (date)
   - end_date (date, nullable) — null means until action concludes
   - last_sent_at (timestamptz, nullable)
   - next_send_at (timestamptz, nullable)
   - created_at, updated_at

4. `notification_logs` — History of all sent notifications
   - id, company_id, user_id, action_id, notification_type, subject
   - recipient_email, scheduled_at, sent_at, status (pending/sent/failed)
   - error_message, dedup_key (for duplicate prevention)
   - created_at

5. `escalation_rules` — Configurable escalation rules per company
   - company_id, delay_days, notify_responsible (bool), notify_managers (bool), notify_admins (bool), critical_alert (bool)
   - Default rules: 1 day (responsible), 3 days (responsible+managers), 7 days (responsible+managers+admins), 15 days (all + critical)

## Modified Tables
- `actions` — adds `recurrence_configured` (bool default false) to track if recurrence was set up

## Security
- RLS enabled on all new tables
- Policies scoped to authenticated users with company membership checks
- Admin-only write on notification_settings and escalation_rules
*/

-- ============================================================
-- 1. notification_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  emails_enabled boolean NOT NULL DEFAULT true,
  default_send_time time NOT NULL DEFAULT '08:00',
  default_recurrence text NOT NULL DEFAULT 'weekly',
  deadline_reminders_enabled boolean NOT NULL DEFAULT true,
  overdue_alerts_enabled boolean NOT NULL DEFAULT true,
  weekly_summary_enabled boolean NOT NULL DEFAULT true,
  escalation_enabled boolean NOT NULL DEFAULT true,
  no_movement_days integer NOT NULL DEFAULT 7,
  no_movement_enabled boolean NOT NULL DEFAULT true,
  sender_name text NOT NULL DEFAULT 'SOW ACTION',
  sender_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notification_settings" ON notification_settings;
CREATE POLICY "select_own_notification_settings" ON notification_settings
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_notification_settings" ON notification_settings;
CREATE POLICY "update_own_notification_settings" ON notification_settings
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role IN ('sow_admin', 'company_admin')));

DROP POLICY IF EXISTS "insert_own_notification_settings" ON notification_settings;
CREATE POLICY "insert_own_notification_settings" ON notification_settings
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role IN ('sow_admin', 'company_admin')));

-- ============================================================
-- 2. notification_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  receive_recurrence boolean NOT NULL DEFAULT true,
  receive_weekly_summary boolean NOT NULL DEFAULT true,
  receive_deadline_reminders boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notification_preferences" ON notification_preferences;
CREATE POLICY "select_own_notification_preferences" ON notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_notification_preferences" ON notification_preferences;
CREATE POLICY "insert_own_notification_preferences" ON notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_notification_preferences" ON notification_preferences;
CREATE POLICY "update_own_notification_preferences" ON notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 3. action_recurrence
-- ============================================================
CREATE TABLE IF NOT EXISTS action_recurrence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL UNIQUE REFERENCES actions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recurrence_type text NOT NULL DEFAULT 'none'
    CHECK (recurrence_type IN ('none','daily','every_2_days','every_3_days','weekly','every_15_days','monthly','custom')),
  custom_days integer,
  weekday integer CHECK (weekday >= 0 AND weekday <= 6),
  preferred_time time NOT NULL DEFAULT '08:00',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  last_sent_at timestamptz,
  next_send_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE action_recurrence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_action_recurrence" ON action_recurrence;
CREATE POLICY "select_own_action_recurrence" ON action_recurrence
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_action_recurrence" ON action_recurrence;
CREATE POLICY "insert_own_action_recurrence" ON action_recurrence
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_action_recurrence" ON action_recurrence;
CREATE POLICY "update_own_action_recurrence" ON action_recurrence
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_action_recurrence" ON action_recurrence;
CREATE POLICY "delete_own_action_recurrence" ON action_recurrence
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid()));

-- ============================================================
-- 4. notification_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid,
  action_id uuid REFERENCES actions(id) ON DELETE SET NULL,
  notification_type text NOT NULL,
  subject text NOT NULL,
  recipient_email text NOT NULL,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error_message text,
  dedup_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notification_logs" ON notification_logs;
CREATE POLICY "select_own_notification_logs" ON notification_logs
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_notification_logs" ON notification_logs;
CREATE POLICY "insert_own_notification_logs" ON notification_logs
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_notification_logs" ON notification_logs;
CREATE POLICY "update_own_notification_logs" ON notification_logs
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_notification_logs_company ON notification_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_dedup ON notification_logs(dedup_key);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_action_recurrence_next_send ON action_recurrence(next_send_at);

-- ============================================================
-- 5. escalation_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS escalation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  delay_days integer NOT NULL,
  notify_responsible boolean NOT NULL DEFAULT true,
  notify_managers boolean NOT NULL DEFAULT false,
  notify_admins boolean NOT NULL DEFAULT false,
  critical_alert boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, delay_days)
);

ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_escalation_rules" ON escalation_rules;
CREATE POLICY "select_own_escalation_rules" ON escalation_rules
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_escalation_rules" ON escalation_rules;
CREATE POLICY "insert_own_escalation_rules" ON escalation_rules
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role IN ('sow_admin', 'company_admin')));

DROP POLICY IF EXISTS "update_own_escalation_rules" ON escalation_rules;
CREATE POLICY "update_own_escalation_rules" ON escalation_rules
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role IN ('sow_admin', 'company_admin')));

DROP POLICY IF EXISTS "delete_own_escalation_rules" ON escalation_rules;
CREATE POLICY "delete_own_escalation_rules" ON escalation_rules
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role IN ('sow_admin', 'company_admin')));

-- ============================================================
-- 6. Add recurrence_configured to actions
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'actions' AND column_name = 'recurrence_configured') THEN
    ALTER TABLE actions ADD COLUMN recurrence_configured boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 7. Insert default escalation rules for existing companies
-- ============================================================
INSERT INTO escalation_rules (company_id, delay_days, notify_responsible, notify_managers, notify_admins, critical_alert)
SELECT c.id, d.delay_days,
  d.delay_days <= 1,
  d.delay_days >= 3,
  d.delay_days >= 7,
  d.delay_days >= 15
FROM companies c
CROSS JOIN (VALUES (1), (3), (7), (15)) AS d(delay_days)
WHERE NOT EXISTS (
  SELECT 1 FROM escalation_rules er WHERE er.company_id = c.id AND er.delay_days = d.delay_days
);

-- ============================================================
-- 8. Insert default notification settings for existing companies
-- ============================================================
INSERT INTO notification_settings (company_id)
SELECT c.id FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM notification_settings ns WHERE ns.company_id = c.id);