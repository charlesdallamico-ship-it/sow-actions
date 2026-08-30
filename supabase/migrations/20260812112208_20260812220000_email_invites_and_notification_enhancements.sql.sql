-- Invite tokens for user onboarding (secure, single-use, expiring)
CREATE TABLE IF NOT EXISTS invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'responsible',
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  position text,
  phone text,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_invites" ON invite_tokens FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "anon_select_invite_by_token" ON invite_tokens FOR SELECT
  TO anon USING (true);
CREATE POLICY "anon_update_invite_used" ON invite_tokens FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  user_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_reset_by_token" ON password_reset_tokens FOR SELECT
  TO anon USING (true);
CREATE POLICY "anon_update_reset_used" ON password_reset_tokens FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- Enhance notification_logs with additional fields
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS action_plan_id uuid REFERENCES facts(id) ON DELETE SET NULL;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS reply_to text;

-- Add sender_reply_to and weekly summary config to notification_settings
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS sender_reply_to text;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS weekly_summary_day integer DEFAULT 1;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS weekly_summary_time text DEFAULT '08:00';
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS email_provider_configured boolean DEFAULT false;

-- In-app notification center table
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action_id uuid,
  fact_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_inapp_notifs" ON in_app_notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "update_own_inapp_notifs" ON in_app_notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_inapp_notifs" ON in_app_notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_inapp_notifs_user_unread ON in_app_notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_dedup ON notification_logs(dedup_key);
