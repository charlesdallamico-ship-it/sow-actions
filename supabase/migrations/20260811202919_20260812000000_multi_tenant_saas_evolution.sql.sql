/*
# Multi-Tenant SaaS Evolution — SOW ACTION Platform

## Overview
Evolves SOW ACTION into a full multi-tenant SaaS platform where SOW Consultoria
administers multiple client companies, each with fully isolated data.

## Changes to `companies` table (ADD COLUMNS ONLY)
- trade_name, cnpj, city, state, email, phone, main_contact
- status (active/trial/suspended/inactive, default 'active')
- plan_type (start/professional/business/enterprise, default 'start')
- max_users (int, default 5) — seat limit
- is_demo (bool, default false)
- start_date, end_date — contract dates
- deactivated_at, updated_at

## Changes to `profiles` table (ADD COLUMNS ONLY)
- last_login_at (timestamptz) — last successful login
- deactivated_at (timestamptz) — when user was deactivated

## New Table: `support_access_logs`
- Audit trail for SOW admin company access (support/impersonation)
- RLS: SOW admins read all; company admins read their own company's logs

## New Function: `is_company_active(company_id)`
- SECURITY DEFINER function to check if a company's status allows login

## Demo Data
- Seeds "EMPRESA DEMONSTRAÇÃO SOW" with is_demo=true
- Creates demo department, objective, fact with 3 actions
- Uses correct schema (units has no department_id; facts has no fact_sequence)
*/

-- ============================================================
-- 1. Add columns to companies
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'trade_name') THEN
    ALTER TABLE companies ADD COLUMN trade_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'cnpj') THEN
    ALTER TABLE companies ADD COLUMN cnpj text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'city') THEN
    ALTER TABLE companies ADD COLUMN city text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'state') THEN
    ALTER TABLE companies ADD COLUMN state text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'email') THEN
    ALTER TABLE companies ADD COLUMN email text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'phone') THEN
    ALTER TABLE companies ADD COLUMN phone text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'main_contact') THEN
    ALTER TABLE companies ADD COLUMN main_contact text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'status') THEN
    ALTER TABLE companies ADD COLUMN status text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'trial', 'suspended', 'inactive'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'plan_type') THEN
    ALTER TABLE companies ADD COLUMN plan_type text NOT NULL DEFAULT 'start'
      CHECK (plan_type IN ('start', 'professional', 'business', 'enterprise'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'max_users') THEN
    ALTER TABLE companies ADD COLUMN max_users integer NOT NULL DEFAULT 5;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'is_demo') THEN
    ALTER TABLE companies ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'start_date') THEN
    ALTER TABLE companies ADD COLUMN start_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'end_date') THEN
    ALTER TABLE companies ADD COLUMN end_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'deactivated_at') THEN
    ALTER TABLE companies ADD COLUMN deactivated_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'updated_at') THEN
    ALTER TABLE companies ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Sync existing: if active=false, set status='inactive'
UPDATE companies SET status = 'inactive', deactivated_at = COALESCE(deactivated_at, now()) WHERE active = false AND status = 'active';

-- ============================================================
-- 2. Add columns to profiles
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_login_at') THEN
    ALTER TABLE profiles ADD COLUMN last_login_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'deactivated_at') THEN
    ALTER TABLE profiles ADD COLUMN deactivated_at timestamptz;
  END IF;
END $$;

-- ============================================================
-- 3. support_access_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS support_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_admin_user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reason text,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE support_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_support_access_logs" ON support_access_logs;
CREATE POLICY "select_support_access_logs" ON support_access_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'sow_admin')
    OR company_id IN (SELECT company_id FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'company_admin')
  );

DROP POLICY IF EXISTS "insert_support_access_logs" ON support_access_logs;
CREATE POLICY "insert_support_access_logs" ON support_access_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'sow_admin')
  );

CREATE INDEX IF NOT EXISTS idx_support_access_logs_company ON support_access_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_support_access_logs_admin ON support_access_logs(sow_admin_user_id);

-- ============================================================
-- 4. is_company_active function
-- ============================================================
CREATE OR REPLACE FUNCTION is_company_active(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status IN ('active', 'trial') FROM companies WHERE id = p_company_id),
    false
  );
$$;

-- ============================================================
-- 5. updated_at trigger for companies
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_updated_at ON companies;
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. Seed demo company (idempotent)
-- ============================================================
DO $$
DECLARE
  demo_company_id uuid;
  demo_obj_id uuid;
  demo_fact_id uuid;
  demo_dept_id uuid;
  demo_unit_id uuid;
BEGIN
  SELECT id INTO demo_company_id FROM companies WHERE is_demo = true LIMIT 1;

  IF demo_company_id IS NULL THEN
    INSERT INTO companies (name, trade_name, cnpj, segment, city, state, email, phone, main_contact, status, plan_type, max_users, is_demo, mission, vision, values)
    VALUES (
      'EMPRESA DEMONSTRAÇÃO SOW',
      'Demo SOW',
      '00.000.000/0001-00',
      'Comércio Varejista',
      'Florianópolis',
      'SC',
      'demo@sowconsultoria.com.br',
      '(48) 3000-0000',
      'Administrador Demo',
      'trial',
      'professional',
      20,
      true,
      'Ser referência regional em distribuição de produtos de consumo.',
      'Expandir atuação para todo o estado de Santa Catarina.',
      'Inovação, Proximidade com o cliente, Excelência operacional.'
    )
    RETURNING id INTO demo_company_id;

    INSERT INTO departments (company_id, name)
    VALUES (demo_company_id, 'Comercial')
    RETURNING id INTO demo_dept_id;

    INSERT INTO units (company_id, name)
    VALUES (demo_company_id, 'Unidade Sul')
    RETURNING id INTO demo_unit_id;

    INSERT INTO strategic_objectives (company_id, name, description)
    VALUES (demo_company_id, 'Expansão Comercial', 'Aumentar a participação de mercado em Santa Catarina')
    RETURNING id INTO demo_obj_id;

    INSERT INTO facts (company_id, code, fato, causa, priority, objective_id, department_id, unit_id, origin_date)
    VALUES (
      demo_company_id,
      'FATO-0001',
      'Queda da participação regional no segmento varejista.',
      'Baixa cobertura comercial com poucos vendedores atuando em Santa Catarina.',
      'alta',
      demo_obj_id,
      demo_dept_id,
      demo_unit_id,
      CURRENT_DATE
    )
    RETURNING id INTO demo_fact_id;

    INSERT INTO actions (fact_id, company_id, description, responsible_id, start_date, deadline, indicator_of_success, target, weight, status, progress_percent)
    VALUES
      (demo_fact_id, demo_company_id, 'Contratar 2 vendedores para atuação em Santa Catarina.', NULL, CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days', 'Número de vendedores ativos', '2 vendedores', 33.33, 'nao_iniciada', 0),
      (demo_fact_id, demo_company_id, 'Abrir 20 novos clientes em Santa Catarina.', NULL, CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', 'Número de novos clientes', '20 clientes', 33.33, 'nao_iniciada', 0),
      (demo_fact_id, demo_company_id, 'Criar promoção regional para impulsionar vendas.', NULL, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'Aumento percentual de vendas', '15% de aumento', 33.34, 'nao_iniciada', 0);
  END IF;
END $$;