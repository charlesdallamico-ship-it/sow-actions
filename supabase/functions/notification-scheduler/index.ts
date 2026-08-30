import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EDGE_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function triggerEmail(payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to trigger email:", err);
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
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

    const now = new Date();
    const todayStr = formatDate(now);

    // 1. Process recurrence-based follow-ups
    const { data: recurrences } = await supabase
      .from("action_recurrence")
      .select("*, actions!inner(id, description, deadline, status, progress_percent, responsible_id, company_id, fact_id, last_updated_at, cancelled)")
      .lte("next_send_at", now.toISOString())
      .is("actions.cancelled", false)
      .neq("actions.status", "concluida")
      .neq("actions.status", "cancelada");

    for (const rec of recurrences ?? []) {
      const action = (rec as any).actions;
      if (!action || action.cancelled || action.status === "concluida" || action.status === "cancelada") continue;

      // Check if recurrence end_date passed
      if (rec.end_date && new Date(rec.end_date) < now) continue;

      await triggerEmail({
        type: "recurrence",
        companyId: action.company_id,
        actionId: action.id,
        factId: action.fact_id,
        recipientUserId: action.responsible_id,
      });

      // Calculate next send date
      const nextSend = calculateNextSend(rec, now);
      await supabase.from("action_recurrence").update({
        last_sent_at: now.toISOString(),
        next_send_at: nextSend?.toISOString() ?? null,
      }).eq("id", rec.id);
    }

    // 2. Process deadline reminders (15, 7, 3, 1, 0 days before)
    const { data: settingsRows } = await supabase.from("notification_settings").select("*").eq("deadline_reminders_enabled", true);

    for (const settings of settingsRows ?? []) {
      const { data: actions } = await supabase
        .from("actions")
        .select("*")
        .eq("company_id", settings.company_id)
        .eq("cancelled", false)
        .neq("status", "concluida")
        .neq("status", "cancelada")
        .not("deadline", "is", null);

      for (const action of actions ?? []) {
        const daysLeft = daysBetween(new Date(action.deadline), now);
        if ([15, 7, 3, 1, 0].includes(daysLeft)) {
          // Check dedup
          const dedupKey = `${action.id}_deadline_reminder_${todayStr}`;
          const { data: existing } = await supabase.from("notification_logs").select("id").eq("dedup_key", dedupKey).eq("status", "sent").maybeSingle();
          if (existing) continue;

          await triggerEmail({
            type: "deadline_reminder",
            companyId: action.company_id,
            actionId: action.id,
            factId: action.fact_id,
            recipientUserId: action.responsible_id,
            newValue: String(daysLeft),
          });
        }
      }
    }

    // 3. Process overdue actions and escalation
    const { data: overdueSettings } = await supabase.from("notification_settings").select("*").eq("overdue_alerts_enabled", true);

    for (const settings of overdueSettings ?? []) {
      const { data: overdueActions } = await supabase
        .from("actions")
        .select("*")
        .eq("company_id", settings.company_id)
        .eq("cancelled", false)
        .neq("status", "concluida")
        .neq("status", "cancelada")
        .neq("status", "atrasada")
        .not("deadline", "is", null)
        .lt("deadline", todayStr);

      for (const action of overdueActions ?? []) {
        // Mark as overdue
        await supabase.from("actions").update({ status: "atrasada" }).eq("id", action.id);

        // Send overdue email to responsible
        await triggerEmail({
          type: "overdue",
          companyId: action.company_id,
          actionId: action.id,
          factId: action.fact_id,
          recipientUserId: action.responsible_id,
        });

        // Process escalation
        if (settings.escalation_enabled) {
          const overdueDays = daysBetween(now, new Date(action.deadline));
          const { data: rules } = await supabase
            .from("escalation_rules")
            .select("*")
            .eq("company_id", settings.company_id)
            .lte("delay_days", overdueDays)
            .order("delay_days", { ascending: false });

          const triggeredRule = (rules ?? [])[0];
          if (triggeredRule) {
            // Escalation to responsible
            if (triggeredRule.notify_responsible && action.responsible_id) {
              await triggerEmail({
                type: "escalation",
                companyId: action.company_id,
                actionId: action.id,
                factId: action.fact_id,
                recipientUserId: action.responsible_id,
                newValue: `${overdueDays} dias de atraso`,
              });
            }
            // Escalate to managers
            if (triggeredRule.notify_managers) {
              const { data: managers } = await supabase
                .from("profiles")
                .select("user_id")
                .eq("company_id", settings.company_id)
                .in("role", ["company_admin", "area_manager"])
                .eq("active", true);
              for (const mgr of managers ?? []) {
                await triggerEmail({
                  type: "escalation",
                  companyId: action.company_id,
                  actionId: action.id,
                  factId: action.fact_id,
                  recipientUserId: mgr.user_id,
                  newValue: `${overdueDays} dias de atraso`,
                });
              }
            }
            // Escalate to admins
            if (triggeredRule.notify_admins) {
              const { data: admins } = await supabase
                .from("profiles")
                .select("user_id")
                .eq("company_id", settings.company_id)
                .eq("role", "sow_admin")
                .eq("active", true);
              for (const adm of admins ?? []) {
                await triggerEmail({
                  type: "escalation",
                  companyId: action.company_id,
                  actionId: action.id,
                  factId: action.fact_id,
                  recipientUserId: adm.user_id,
                  newValue: `${overdueDays} dias de atraso`,
                });
              }
            }
          }
        }
      }
    }

    // 4. Process no-movement alerts
    const { data: noMovementSettings } = await supabase.from("notification_settings").select("*").eq("no_movement_enabled", true);

    for (const settings of noMovementSettings ?? []) {
      const cutoffDays = settings.no_movement_days;
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

      const { data: staleActions } = await supabase
        .from("actions")
        .select("*")
        .eq("company_id", settings.company_id)
        .eq("cancelled", false)
        .neq("status", "concluida")
        .neq("status", "cancelada")
        .lt("last_updated_at", cutoffDate.toISOString());

      for (const action of staleActions ?? []) {
        const dedupKey = `${action.id}_no_movement_${todayStr}`;
        const { data: existing } = await supabase.from("notification_logs").select("id").eq("dedup_key", dedupKey).eq("status", "sent").maybeSingle();
        if (existing) continue;

        const staleDays = daysBetween(now, new Date(action.last_updated_at));
        await triggerEmail({
          type: "no_movement",
          companyId: action.company_id,
          actionId: action.id,
          factId: action.fact_id,
          recipientUserId: action.responsible_id,
          newValue: String(staleDays),
        });
      }
    }

    // 4b. Cancel recurrences for concluded/cancelled actions
    const { data: doneActions } = await supabase
      .from("actions")
      .select("id")
      .in("status", ["concluida", "cancelada"]);
    for (const da of doneActions ?? []) {
      await supabase.from("action_recurrence").update({ next_send_at: null }).eq("action_id", da.id).not("next_send_at", "is", null);
    }

    // 5. Weekly summaries (run on configured day, default Monday)
    const dayOfWeek = now.getDay();
    const { data: allSettings } = await supabase.from("notification_settings").select("*").eq("weekly_summary_enabled", true);
    const settingsOnThisDay = (allSettings ?? []).filter((s: any) => (s.weekly_summary_day ?? 1) === dayOfWeek);
    const summarySettings = settingsOnThisDay;
      const { data: summarySettings } = await supabase.from("notification_settings").select("*").eq("weekly_summary_enabled", true);

      for (const settings of summarySettings ?? []) {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);

        // Responsible summaries
        const { data: responsibles } = await supabase
          .from("actions")
          .select("responsible_id")
          .eq("company_id", settings.company_id)
          .eq("cancelled", false)
          .not("responsible_id", "is", null);

        const respIds = [...new Set((responsibles ?? []).map((r: any) => r.responsible_id))];

        for (const respId of respIds) {
          const { data: respActions } = await supabase
            .from("actions")
            .select("*")
            .eq("company_id", settings.company_id)
            .eq("responsible_id", respId)
            .eq("cancelled", false);

          const all = respActions ?? [];
          const inProgress = all.filter((a: any) => ["em_andamento", "nao_iniciada"].includes(a.status)).length;
          const overdue = all.filter((a: any) => a.status === "atrasada").length;
          const dueSoon = all.filter((a: any) => {
            if (!a.deadline) return false;
            const dl = daysBetween(new Date(a.deadline), now);
            return dl >= 0 && dl <= 7 && a.status !== "concluida";
          }).length;
          const pendingApproval = all.filter((a: any) => a.approval_status === "pending").length;
          const avgProgress = all.length ? Math.round(all.reduce((s: number, a: any) => s + (a.progress_percent || 0), 0) / all.length) : 0;

          const dedupKey = `${respId}_weekly_summary_responsible_${todayStr}`;
          const { data: existing } = await supabase.from("notification_logs").select("id").eq("dedup_key", dedupKey).eq("status", "sent").maybeSingle();
          if (existing) continue;

          await triggerEmail({
            type: "weekly_summary_responsible",
            companyId: settings.company_id,
            recipientUserId: respId,
            stats: { total: all.length, inProgress, overdue, dueSoon, pendingApproval, avgProgress },
          });
        }

        // Manager + Admin summaries
        const { data: managers } = await supabase
          .from("profiles")
          .select("user_id, role")
          .eq("company_id", settings.company_id)
          .in("role", ["company_admin", "area_manager", "sow_admin"])
          .eq("active", true);

        for (const mgr of managers ?? []) {
          const { data: teamActions } = await supabase
            .from("actions")
            .select("*")
            .eq("company_id", settings.company_id)
            .eq("cancelled", false);

          const all = teamActions ?? [];
          const open = all.filter((a: any) => a.status !== "concluida").length;
          const overdueCount = all.filter((a: any) => a.status === "atrasada").length;
          const completedThisWeek = all.filter((a: any) => a.status === "concluida" && a.approved_at && new Date(a.approved_at) >= weekAgo).length;
          const pendingApproval = all.filter((a: any) => a.approval_status === "pending").length;
          const avgProgress = all.length ? Math.round(all.reduce((s: number, a: any) => s + (a.progress_percent || 0), 0) / all.length) : 0;
          const noMovement = all.filter((a: any) => {
            if (!a.last_updated_at) return false;
            return daysBetween(now, new Date(a.last_updated_at)) > (settings.no_movement_days ?? 7) && a.status !== "concluida";
          }).length;

          const dedupKey = `${mgr.user_id}_weekly_summary_manager_${todayStr}`;
          const { data: existing } = await supabase.from("notification_logs").select("id").eq("dedup_key", dedupKey).eq("status", "sent").maybeSingle();
          if (existing) continue;

          const isCompanyAdmin = (mgr as any).role === "company_admin" || (mgr as any).role === "sow_admin";
          if (isCompanyAdmin) {
            // Admin executive summary
            const allActions = teamActions ?? [];
            const totalActions = allActions.length;
            const completed = allActions.filter((a: any) => a.status === "concluida").length;
            const critical = allActions.filter((a: any) => {
              if (!a.deadline) return false;
              return daysBetween(now, new Date(a.deadline)) < -7;
            }).length;
            const mostDelayed = [...allActions].filter((a: any) => a.status === "atrasada").sort((a: any, b: any) => {
              const da = a.deadline ? daysBetween(now, new Date(a.deadline)) : 0;
              const db = b.deadline ? daysBetween(now, new Date(b.deadline)) : 0;
              return da - db;
            }).slice(0, 3).map((a: any) => a.description?.substring(0, 40) ?? "-").join("; ");

            const adminDedupKey = `${mgr.user_id}_weekly_summary_admin_${todayStr}`;
            const { data: adminExisting } = await supabase.from("notification_logs").select("id").eq("dedup_key", adminDedupKey).eq("status", "sent").maybeSingle();
            if (!adminExisting) {
              await triggerEmail({
                type: "weekly_summary_admin",
                companyId: settings.company_id,
                recipientUserId: mgr.user_id,
                stats: {
                  avgProgress, open, completed, overdue: overdueCount, critical,
                  pendingApproval, mostDelayedPlans: mostDelayed, mostDelayedAreas: "-",
                },
              });
            }
          }

          await triggerEmail({
            type: "weekly_summary_manager",
            companyId: settings.company_id,
            recipientUserId: mgr.user_id,
            stats: { open, overdue: overdueCount, noMovement, completedThisWeek, pendingApproval, avgProgress },
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processedAt: now.toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function calculateNextSend(rec: any, from: Date): Date | null {
  if (rec.recurrence_type === "none") return null;
  const next = new Date(from);
  switch (rec.recurrence_type) {
    case "daily": next.setDate(next.getDate() + 1); break;
    case "every_2_days": next.setDate(next.getDate() + 2); break;
    case "every_3_days": next.setDate(next.getDate() + 3); break;
    case "weekly": next.setDate(next.getDate() + 7); break;
    case "every_15_days": next.setDate(next.getDate() + 15); break;
    case "monthly": next.setMonth(next.getMonth() + 1); break;
    case "custom":
      if (rec.custom_days) { next.setDate(next.getDate() + rec.custom_days); }
      else if (rec.weekday !== null) {
        const dayMap = [0, 1, 2, 3, 4, 5, 6];
        const targetDay = dayMap[rec.weekday] ?? 1;
        const currentDay = next.getDay();
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        next.setDate(next.getDate() + diff);
      }
      break;
  }
  // Set preferred time
  if (rec.preferred_time) {
    const [h, m] = rec.preferred_time.split(":").map(Number);
    next.setHours(h ?? 8, m ?? 0, 0, 0);
  }
  return next;
}
