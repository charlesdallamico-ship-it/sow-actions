import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "notificacoes@sownegocios.com.br";
const REPLY_TO_EMAIL = Deno.env.get("REPLY_TO_EMAIL") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://sowaction.com";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

async function sendEmail({ to, subject, html, replyTo }: SendEmailParams): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const body: Record<string, unknown> = {
      from: `SOW ACTION <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    };
    if (replyTo) body.reply_to = replyTo;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Resend API error ${res.status}: ${errText}` };
    }
    const data = await res.json();
    return { success: true, messageId: data.id ?? null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function buildButton(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;padding:12px 32px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin:8px 4px;">${label}</a>`;
}

function buildEmailTemplate(title: string, bodyContent: string, buttons: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;color:#1e293b;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <div style="background:#0f766e;padding:24px 32px;"><h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">SOW ACTION</h1><p style="margin:4px 0 0;color:#a7f3d0;font-size:13px;">Planejamento Estratégico</p></div>
  <div style="padding:32px;">
    <h2 style="margin:0 0 16px;font-size:18px;color:#0f766e;">${title}</h2>
    ${bodyContent}
    <div style="margin:24px 0;text-align:center;">${buttons}</div>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;text-align:center;"><p style="margin:0;font-size:12px;color:#94a3b8;">Este é um e-mail automático do SOW ACTION. Não responda diretamente a este endereço.</p></div>
</div>
</body></html>`;
}

function fieldRow(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;font-weight:600;color:#64748b;font-size:13px;width:160px;vertical-align:top;">${label}</td><td style="padding:6px 0;color:#1e293b;font-size:14px;">${value}</td></tr>`;
}

function infoTable(rows: string[]): string {
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows.join("")}</table>`;
}

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

function formatDateTimeBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const payload = await req.json();
    const { type, companyId, actionId, factId, recipientUserId, changedByUserId, fieldName, oldValue, newValue, reason, inviteToken, resetToken, recipientName: overrideName, recipientEmail: overrideEmail, stats, profileData } = payload;

    if (!type || !companyId) {
      return new Response(JSON.stringify({ error: "type and companyId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch notification settings
    const { data: settings } = await supabase.from("notification_settings").select("*").eq("company_id", companyId).maybeSingle();
    if (settings && !settings.emails_enabled && !["invite", "password_reset"].includes(type)) {
      return new Response(JSON.stringify({ skipped: "emails disabled" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const replyTo = settings?.sender_reply_to || REPLY_TO_EMAIL || undefined;

    // Fetch recipient profile
    let recipientProfile: any = null;
    if (recipientUserId) {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", recipientUserId).maybeSingle();
      recipientProfile = data;
    }
    if (!recipientProfile && overrideEmail) {
      recipientProfile = { email: overrideEmail, full_name: overrideName ?? "Usuário" };
    }
    if (!recipientProfile || !recipientProfile.email) {
      return new Response(JSON.stringify({ skipped: "no recipient" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate multi-tenant isolation: recipient must belong to the same company
    if (recipientProfile.company_id && recipientProfile.company_id !== companyId) {
      // Log security event
      await supabase.from("notification_logs").insert({
        company_id: companyId,
        user_id: recipientUserId ?? null,
        notification_type: type,
        subject: "BLOCKED: cross-company notification attempt",
        recipient_email: recipientProfile.email,
        status: "failed",
        error_message: `Recipient company ${recipientProfile.company_id} does not match notification company ${companyId}`,
      });
      return new Response(JSON.stringify({ error: "cross-company notification blocked" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch action and fact
    let action: any = null;
    let fact: any = null;
    if (actionId) {
      const { data } = await supabase.from("actions").select("*").eq("id", actionId).maybeSingle();
      action = data;
    }
    if (factId || action?.fact_id) {
      const fid = factId ?? action?.fact_id;
      const { data } = await supabase.from("facts").select("*").eq("id", fid).maybeSingle();
      fact = data;
    }

    // Fetch company
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();

    // Fetch changed-by user
    let changedBy: any = null;
    if (changedByUserId) {
      const { data } = await supabase.from("profiles").select("full_name").eq("user_id", changedByUserId).maybeSingle();
      changedBy = data;
    }

    // Check user preferences for non-mandatory emails
    const mandatoryTypes = ["new_action", "action_changed", "overdue", "action_reproved", "deadline_approved", "action_reopened", "responsible_changed", "invite", "company_welcome", "password_reset", "action_completed"];
    const isMandatory = mandatoryTypes.includes(type);
    if (!isMandatory && recipientUserId) {
      const { data: prefs } = await supabase.from("notification_preferences").select("*").eq("user_id", recipientUserId).eq("company_id", companyId).maybeSingle();
      if (prefs) {
        if (type === "recurrence" && !prefs.receive_recurrence) {
          return new Response(JSON.stringify({ skipped: "user opted out" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (type === "weekly_summary_responsible" && !prefs.receive_weekly_summary) {
          return new Response(JSON.stringify({ skipped: "user opted out" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (type === "deadline_reminder" && !prefs.receive_deadline_reminders) {
          return new Response(JSON.stringify({ skipped: "user opted out" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // Build dedup key
    const weekNum = Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000 / 7);
    const dedupPeriod = type.includes("weekly") ? `${new Date().getFullYear()}_W${weekNum}` : new Date().toISOString().split("T")[0];
    const dedupKey = `${actionId ?? factId ?? recipientUserId}_${type}_${dedupPeriod}`;

    // Check for duplicate
    const { data: existing } = await supabase.from("notification_logs").select("id").eq("dedup_key", dedupKey).in("status", ["sent", "configuration_required"]).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ skipped: "duplicate" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const recipientName = recipientProfile.full_name ?? "Responsável";
    const actionUrl = `${APP_URL}/?action=${actionId}`;
    const factUrl = factId ? `${APP_URL}/?fact=${factId}` : actionUrl;
    const tasksUrl = `${APP_URL}/?page=tasks`;

    let subject = "";
    let bodyContent = "";
    let buttons = "";

    switch (type) {
      // ──── INVITE ────
      case "invite": {
        subject = "VOCÊ RECEBEU ACESSO AO SOW ACTION";
        const inviteUrl = `${APP_URL}/?page=accept-invite&token=${inviteToken}`;
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Você recebeu acesso ao SOW ACTION para acompanhar as ações e responsabilidades relacionadas ao Planejamento Estratégico da sua empresa.</p>`;
        const rows = [
          fieldRow("Nome", escapeHtml(profileData?.full_name ?? recipientName)),
          fieldRow("Empresa", escapeHtml(company?.name ?? "-")),
          fieldRow("Cargo", escapeHtml(profileData?.position ?? "-")),
          fieldRow("Perfil", escapeHtml(profileData?.role ?? "-")),
        ];
        bodyContent += infoTable(rows);
        bodyContent += `<p style="color:#475569;font-size:14px;">Clique abaixo para criar sua senha e ativar seu acesso.</p>`;
        buttons = buildButton("CRIAR MINHA SENHA", inviteUrl);
        break;
      }

      // ──── COMPANY WELCOME ────
      case "company_welcome": {
        subject = "BEM-VINDO AO SOW ACTION — ATIVE SEU ACESSO";
        const inviteUrl = `${APP_URL}/?page=accept-invite&token=${inviteToken}`;
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Sua empresa <strong>${escapeHtml(company?.name ?? "")}</strong> recebeu acesso ao SOW ACTION.</p><p>O SOW ACTION é a plataforma de acompanhamento do Planejamento Estratégico da sua empresa.</p><p>Clique abaixo para criar sua senha e ativar seu acesso.</p>`;
        buttons = buildButton("ATIVAR MEU ACESSO", inviteUrl);
        break;
      }

      // ──── PASSWORD RESET ────
      case "password_reset": {
        subject = "RECUPERAÇÃO DE SENHA — SOW ACTION";
        const resetUrl = `${APP_URL}/?page=accept-reset&token=${resetToken}`;
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Você solicitou a recuperação de sua senha no SOW ACTION.</p><p>Clique no botão abaixo para definir uma nova senha. Este link é válido por 1 hora.</p><p style="color:#94a3b8;font-size:13px;">Se você não solicitou esta recuperação, ignore este e-mail.</p>`;
        buttons = buildButton("REDEFINIR MINHA SENHA", resetUrl);
        break;
      }

      // ──── NEW ACTION ────
      case "new_action": {
        subject = "NOVA AÇÃO ATRIBUÍDA — SOW ACTION";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Uma nova ação foi atribuída a você no SOW ACTION.</p>`;
        const rows = [
          fieldRow("Empresa", escapeHtml(company?.name ?? "-")),
          fieldRow("Plano de Ação", escapeHtml(fact?.fato ?? "-")),
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Responsável", escapeHtml(recipientName)),
          fieldRow("Data de origem", formatDateBR(fact?.origin_date)),
          fieldRow("Prazo final", formatDateBR(action?.deadline)),
          fieldRow("Prioridade", fact?.priority ?? "-"),
          fieldRow("Indicador", escapeHtml(action?.indicator_of_success ?? "-")),
          fieldRow("Meta", escapeHtml(action?.target ?? "-")),
          fieldRow("Status", action?.status ?? "-"),
          fieldRow("Percentual", "0%"),
        ];
        bodyContent += infoTable(rows);
        bodyContent += `<p style="color:#475569;font-size:14px;">Esta ação faz parte do Planejamento Estratégico da empresa e deverá ser acompanhada até sua conclusão.</p>`;
        buttons = buildButton("ACESSAR MINHA AÇÃO", actionUrl);
        break;
      }

      // ──── RESPONSIBLE CHANGED (new responsible) ────
      case "responsible_changed": {
        subject = "NOVA RESPONSABILIDADE ATRIBUÍDA — SOW ACTION";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Uma ação foi transferida para sua responsabilidade.</p>`;
        const rows = [
          fieldRow("Empresa", escapeHtml(company?.name ?? "-")),
          fieldRow("Plano de Ação", escapeHtml(fact?.fato ?? "-")),
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Responsável anterior", escapeHtml(oldValue ?? "-")),
          fieldRow("Novo responsável", escapeHtml(recipientName)),
          fieldRow("Alterado por", escapeHtml(changedBy?.full_name ?? "-")),
          fieldRow("Data", formatDateTimeBR(new Date().toISOString())),
          fieldRow("Motivo", escapeHtml(reason ?? "-")),
          fieldRow("Prazo", formatDateBR(action?.deadline)),
          fieldRow("Status", action?.status ?? "-"),
        ];
        bodyContent += infoTable(rows);
        buttons = buildButton("ACESSAR MINHA AÇÃO", actionUrl);
        break;
      }

      // ──── RESPONSIBLE REMOVED (old responsible) ────
      case "responsible_removed": {
        subject = "ALTERAÇÃO DE RESPONSABILIDADE — SOW ACTION";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>A ação abaixo não está mais sob sua responsabilidade.</p>`;
        const rows = [
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Plano de Ação", escapeHtml(fact?.fato ?? "-")),
          fieldRow("Responsável anterior", escapeHtml(recipientName)),
          fieldRow("Novo responsável", escapeHtml(newValue ?? "-")),
          fieldRow("Alterado por", escapeHtml(changedBy?.full_name ?? "-")),
          fieldRow("Data", formatDateTimeBR(new Date().toISOString())),
          fieldRow("Motivo", escapeHtml(reason ?? "-")),
        ];
        bodyContent += infoTable(rows);
        break;
      }

      // ──── ACTION CHANGED ────
      case "action_changed": {
        subject = "ALTERAÇÃO NO PLANO DE AÇÃO — SOW ACTION";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Uma ação sob sua responsabilidade foi alterada.</p>`;
        const rows = [
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Alterado por", escapeHtml(changedBy?.full_name ?? "-")),
          fieldRow("Data", formatDateTimeBR(new Date().toISOString())),
          fieldRow("Campo alterado", escapeHtml(fieldName ?? "-")),
          fieldRow("Antes", escapeHtml(oldValue ?? "-")),
          fieldRow("Agora", escapeHtml(newValue ?? "-")),
          fieldRow("Motivo", escapeHtml(reason ?? "-")),
        ];
        bodyContent += infoTable(rows);
        buttons = buildButton("VER PLANO ATUALIZADO", actionUrl);
        break;
      }

      // ──── RECURRENCE ────
      case "recurrence": {
        subject = "ACOMPANHAMENTO DE AÇÃO — SOW ACTION";
        const daysLeft = action?.deadline ? Math.ceil((new Date(action.deadline).getTime() - Date.now()) / 86400000) : null;
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Este é um acompanhamento automático da ação sob sua responsabilidade.</p>`;
        const rows = [
          fieldRow("Empresa", escapeHtml(company?.name ?? "-")),
          fieldRow("Plano", escapeHtml(fact?.fato ?? "-")),
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Prazo", formatDateBR(action?.deadline)),
          fieldRow("Dias restantes", daysLeft !== null ? String(daysLeft) : "-"),
          fieldRow("Percentual", `${action?.progress_percent ?? 0}%`),
          fieldRow("Status", action?.status ?? "-"),
          fieldRow("Meta", escapeHtml(action?.target ?? "-")),
          fieldRow("Última atualização", formatDateTimeBR(action?.last_updated_at)),
        ];
        bodyContent += infoTable(rows);
        bodyContent += `<p style="color:#475569;font-size:14px;">Esta ação faz parte do Planejamento Estratégico da empresa. Mantenha seu andamento atualizado para permitir o acompanhamento da gestão.</p>`;
        buttons = buildButton("ATUALIZAR MINHA AÇÃO", actionUrl) + buildButton("VER DETALHES", actionUrl);
        break;
      }

      // ──── DEADLINE REMINDER ────
      case "deadline_reminder": {
        const daysLabel = newValue === "0" ? "Hoje é o vencimento" : `Faltam ${newValue} dias`;
        subject = "LEMBRETE DE PRAZO — SOW ACTION";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>${daysLabel} para o prazo de sua ação.</p>`;
        const rows = [
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Prazo", formatDateBR(action?.deadline)),
          fieldRow("Dias restantes", newValue ?? "-"),
          fieldRow("Percentual", `${action?.progress_percent ?? 0}%`),
          fieldRow("Status", action?.status ?? "-"),
        ];
        bodyContent += infoTable(rows);
        buttons = buildButton("ATUALIZAR AÇÃO", actionUrl);
        break;
      }

      // ──── OVERDUE ────
      case "overdue": {
        const overdueDays = action?.deadline ? Math.floor((Date.now() - new Date(action.deadline).getTime()) / 86400000) : 0;
        subject = "AÇÃO ATRASADA — ATUALIZAÇÃO NECESSÁRIA";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>A ação abaixo ultrapassou o prazo definido.</p>`;
        const rows = [
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Plano", escapeHtml(fact?.fato ?? "-")),
          fieldRow("Prazo", formatDateBR(action?.deadline)),
          fieldRow("Dias em atraso", `${overdueDays}`),
          fieldRow("Percentual", `${action?.progress_percent ?? 0}%`),
          fieldRow("Última atualização", formatDateTimeBR(action?.last_updated_at)),
          fieldRow("Status", "ATRASADA"),
        ];
        bodyContent += infoTable(rows);
        bodyContent += `<p style="color:#dc2626;font-size:14px;">Solicitamos que atualize imediatamente: situação atual, motivo do atraso, próxima providência, previsão e eventual solicitação de novo prazo.</p>`;
        buttons = buildButton("ATUALIZAR AÇÃO", actionUrl);
        break;
      }

      // ──── NO MOVEMENT ────
      case "no_movement": {
        subject = "AÇÃO SEM ATUALIZAÇÃO — SOW ACTION";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>A ação abaixo não recebe atualização há ${newValue ?? "alguns"} dias.</p>`;
        const rows = [
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Última atualização", formatDateTimeBR(action?.last_updated_at)),
          fieldRow("Dias sem movimentação", String(newValue ?? "-")),
          fieldRow("Prazo", formatDateBR(action?.deadline)),
          fieldRow("Percentual", `${action?.progress_percent ?? 0}%`),
        ];
        bodyContent += infoTable(rows);
        bodyContent += `<p style="color:#475569;font-size:14px;">Solicitamos que registre o andamento atual.</p>`;
        buttons = buildButton("ATUALIZAR AGORA", actionUrl);
        break;
      }

      // ──── DEADLINE REQUEST (to manager) ────
      case "deadline_request": {
        subject = "SOLICITAÇÃO DE ALTERAÇÃO DE PRAZO — SOW ACTION";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Um responsável solicitou alteração de prazo para uma ação.</p>`;
        const rows = [
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Responsável", escapeHtml(oldValue ?? "-")),
          fieldRow("Prazo atual", formatDateBR(action?.deadline)),
          fieldRow("Novo prazo solicitado", formatDateBR(newValue)),
          fieldRow("Motivo", escapeHtml(reason ?? "-")),
        ];
        bodyContent += infoTable(rows);
        buttons = buildButton("ANALISAR SOLICITAÇÃO", `${APP_URL}/?page=tasks`);
        break;
      }

      // ──── DEADLINE APPROVED ────
      case "deadline_approved": {
        subject = "NOVO PRAZO APROVADO — SOW ACTION";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Sua solicitação de alteração de prazo foi <strong>aprovada</strong>.</p>`;
        const rows = [
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Prazo anterior", formatDateBR(oldValue)),
          fieldRow("Novo prazo", formatDateBR(newValue)),
          fieldRow("Aprovado por", escapeHtml(changedBy?.full_name ?? "-")),
          fieldRow("Data", formatDateTimeBR(new Date().toISOString())),
          fieldRow("Justificativa", escapeHtml(reason ?? "-")),
        ];
        bodyContent += infoTable(rows);
        buttons = buildButton("VER AÇÃO", actionUrl);
        break;
      }

      // ──── ACTION COMPLETED (to manager for approval) ────
      case "action_completed": {
        subject = "AÇÃO CONCLUÍDA — APROVAÇÃO NECESSÁRIA";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>O responsável marcou uma ação como concluída (100%). Sua aprovação é necessária.</p>`;
        const rows = [
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Responsável", escapeHtml(newValue ?? "-")),
          fieldRow("Data da conclusão", formatDateTimeBR(new Date().toISOString())),
          fieldRow("Meta", escapeHtml(action?.target ?? "-")),
          fieldRow("Percentual", "100%"),
          fieldRow("Evidências", escapeHtml(action?.completion_evidence ?? "-")),
        ];
        bodyContent += infoTable(rows);
        buttons = buildButton("ANALISAR CONCLUSÃO", actionUrl);
        break;
      }

      // ──── ACTION APPROVED ────
      case "action_approved": {
        subject = "AÇÃO APROVADA — SOW ACTION";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Sua ação foi <strong>aprovada</strong> pelo gestor e considerada concluída.</p>`;
        const rows = [
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Plano", escapeHtml(fact?.fato ?? "-")),
          fieldRow("Resultado", "Aprovado"),
          fieldRow("Data", formatDateTimeBR(new Date().toISOString())),
          fieldRow("Aprovador", escapeHtml(changedBy?.full_name ?? "-")),
        ];
        bodyContent += infoTable(rows);
        bodyContent += `<p style="color:#475569;font-size:14px;">Recorrências, lembretes e alertas de atraso foram automaticamente encerrados.</p>`;
        buttons = buildButton("VER AÇÃO", actionUrl);
        break;
      }

      // ──── ACTION REPROVED ────
      case "action_reproved": {
        subject = "AÇÃO REQUER AJUSTES — SOW ACTION";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Sua ação foi <strong>reprovada</strong> pelo gestor e requer ajustes.</p>`;
        const rows = [
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Motivo", escapeHtml(reason ?? "-")),
          fieldRow("Comentário do gestor", escapeHtml(action?.approval_comment ?? "-")),
          fieldRow("Prazo", formatDateBR(action?.deadline)),
          fieldRow("Status", action?.status ?? "-"),
        ];
        bodyContent += infoTable(rows);
        buttons = buildButton("REVISAR AÇÃO", actionUrl);
        break;
      }

      // ──── ACTION REOPENED ────
      case "action_reopened": {
        subject = "AÇÃO REABERTA — SOW ACTION";
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Sua ação foi <strong>reaberta</strong> pelo gestor.</p>`;
        const rows = [
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Reaberto por", escapeHtml(changedBy?.full_name ?? "-")),
          fieldRow("Comentário", escapeHtml(reason ?? "-")),
        ];
        bodyContent += infoTable(rows);
        buttons = buildButton("VER AÇÃO", actionUrl);
        break;
      }

      // ──── ESCALATION ────
      case "escalation": {
        subject = `ESCALONAMENTO DE ATRASO — SOW ACTION`;
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Uma ação está com atraso escalonado.</p>`;
        const rows = [
          fieldRow("Ação", escapeHtml(action?.description ?? "-")),
          fieldRow("Dias de atraso", String(newValue ?? "-")),
          fieldRow("Responsável", escapeHtml(recipientName)),
          fieldRow("Percentual", `${action?.progress_percent ?? 0}%`),
        ];
        bodyContent += infoTable(rows);
        buttons = buildButton("VER AÇÃO", actionUrl);
        break;
      }

      // ──── WEEKLY SUMMARY (RESPONSIBLE) ────
      case "weekly_summary_responsible": {
        subject = "RESUMO SEMANAL DE SUAS AÇÕES — SOW ACTION";
        const s = stats ?? {};
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Aqui está o resumo semanal das suas ações:</p>`;
        const rows = [
          fieldRow("Total", String(s.total ?? 0)),
          fieldRow("Em andamento", String(s.inProgress ?? 0)),
          fieldRow("Atrasadas", String(s.overdue ?? 0)),
          fieldRow("Vencendo", String(s.dueSoon ?? 0)),
          fieldRow("Aguardando aprovação", String(s.pendingApproval ?? 0)),
          fieldRow("Concluídas na semana", String(s.completedThisWeek ?? 0)),
        ];
        bodyContent += infoTable(rows);
        buttons = buildButton("VER MINHAS TAREFAS", tasksUrl);
        break;
      }

      // ──── WEEKLY SUMMARY (MANAGER) ────
      case "weekly_summary_manager": {
        subject = "RESUMO SEMANAL DA EQUIPE — SOW ACTION";
        const s = stats ?? {};
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Aqui está o resumo semanal da sua equipe:</p>`;
        const rows = [
          fieldRow("Total de ações", String(s.total ?? 0)),
          fieldRow("Em andamento", String(s.inProgress ?? 0)),
          fieldRow("Atrasadas", String(s.overdue ?? 0)),
          fieldRow("Sem atualização", String(s.noMovement ?? 0)),
          fieldRow("Concluídas na semana", String(s.completedThisWeek ?? 0)),
          fieldRow("Aguardando aprovação", String(s.pendingApproval ?? 0)),
          fieldRow("Percentual médio", `${s.avgProgress ?? 0}%`),
        ];
        bodyContent += infoTable(rows);
        buttons = buildButton("ACOMPANHAR EQUIPE", tasksUrl);
        break;
      }

      // ──── WEEKLY SUMMARY (ADMIN EXECUTIVE) ────
      case "weekly_summary_admin": {
        subject = "RESUMO EXECUTIVO SEMANAL — SOW ACTION";
        const s = stats ?? {};
        bodyContent = `<p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p><p>Resumo executivo do Planejamento Estratégico:</p>`;
        const rows = [
          fieldRow("Percentual geral", `${s.avgProgress ?? 0}%`),
          fieldRow("Ações abertas", String(s.open ?? 0)),
          fieldRow("Ações concluídas", String(s.completed ?? 0)),
          fieldRow("Ações atrasadas", String(s.overdue ?? 0)),
          fieldRow("Ações críticas", String(s.critical ?? 0)),
          fieldRow("Aguardando aprovação", String(s.pendingApproval ?? 0)),
          fieldRow("Planos com maior atraso", escapeHtml(s.mostDelayedPlans ?? "-")),
          fieldRow("Áreas com maior atraso", escapeHtml(s.mostDelayedAreas ?? "-")),
        ];
        bodyContent += infoTable(rows);
        buttons = buildButton("VER DASHBOARD", `${APP_URL}/?page=dashboard`);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "unknown type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const html = buildEmailTemplate(subject, bodyContent, buttons);

    // Insert log with status based on whether email is configured
    const isConfigured = !!RESEND_API_KEY;
    const logStatus = isConfigured ? "pending" : "configuration_required";

    const { data: logEntry } = await supabase.from("notification_logs").insert({
      company_id: companyId,
      user_id: recipientUserId ?? null,
      action_id: actionId ?? null,
      action_plan_id: factId ?? fact?.id ?? null,
      notification_type: type,
      subject,
      recipient_email: recipientProfile.email,
      scheduled_at: new Date().toISOString(),
      status: logStatus,
      dedup_key: dedupKey,
      reply_to: replyTo ?? null,
    }).select("id").single();

    if (!isConfigured) {
      return new Response(JSON.stringify({ success: false, error: "CONFIGURAÇÃO DE E-MAIL PENDENTE", status: "configuration_required" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email
    const result = await sendEmail({ to: recipientProfile.email, subject, html, replyTo });

    // Update log
    if (logEntry) {
      await supabase.from("notification_logs").update({
        status: result.success ? "sent" : "failed",
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.error ?? null,
        provider_message_id: result.messageId ?? null,
      }).eq("id", logEntry.id);
    }

    // Insert in-app notification as well
    await supabase.from("in_app_notifications").insert({
      company_id: companyId,
      user_id: recipientUserId,
      action_id: actionId ?? null,
      fact_id: factId ?? fact?.id ?? null,
      type,
      title: subject,
      body: bodyContent.replace(/<[^>]*>/g, "").substring(0, 200),
      link: actionId ? `?action=${actionId}` : null,
    });

    return new Response(JSON.stringify({ success: result.success, error: result.error }), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
