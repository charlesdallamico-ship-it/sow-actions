import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, full_name, company_id, role, department_id, position, phone } = await req.json();

    if (!email || !full_name || !company_id) {
      return new Response(JSON.stringify({ error: "email, full_name e company_id são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: callerData } = await callerClient.auth.getUser(authHeader.replace("Bearer ", ""));
    const callerId = callerData.user?.id;
    if (!callerId) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: callerProfile } = await supabaseAdmin.from("profiles").select("role, company_id").eq("user_id", callerId).maybeSingle();
    if (!callerProfile || !["sow_admin", "company_admin"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (callerProfile.role === "company_admin" && callerProfile.company_id !== company_id) {
      return new Response(JSON.stringify({ error: "Sem permissão para esta empresa" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check company status and seat limit
    const { data: company } = await supabaseAdmin.from("companies").select("status, max_users").eq("id", company_id).maybeSingle();
    if (!company) return new Response(JSON.stringify({ error: "Empresa não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (company.status === "inactive" || company.status === "suspended") {
      return new Response(JSON.stringify({ error: "Empresa inativa ou suspensa" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { count } = await supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("company_id", company_id).eq("active", true);
    if ((count ?? 0) >= (company.max_users ?? 5)) {
      return new Response(JSON.stringify({ error: `Limite de usuários atingido (${company.max_users ?? 5})` }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create auth user WITHOUT password (will set password via invite)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(), // temporary random password; will be replaced
      email_confirm: true,
      user_metadata: { full_name, needs_password_setup: true },
    });

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const validRole = ["sow_admin", "company_admin", "area_manager", "responsible", "viewer"].includes(role) ? role : "responsible";

    // Create profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      user_id: data.user.id, company_id, full_name, email, role: validRole,
      department_id: department_id || null, position: position || null, phone: phone || null, active: false,
    });
    if (profileError) return new Response(JSON.stringify({ error: profileError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Generate invite token
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabaseAdmin.from("invite_tokens").insert({
      company_id, user_id: data.user.id, email, full_name, role: validRole,
      department_id: department_id || null, position: position || null, phone: phone || null,
      token, expires_at: expiresAt.toISOString(),
    });

    // Trigger invite email
    const EDGE_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const isCompanyWelcome = callerProfile.role === "sow_admin";
    await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({
        type: isCompanyWelcome ? "company_welcome" : "invite",
        companyId,
        recipientUserId: data.user.id,
        inviteToken: token,
        profileData: { full_name, position, role: validRole },
      }),
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, user_id: data.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
