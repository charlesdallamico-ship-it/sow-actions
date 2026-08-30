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
    const { email: rawEmail } = await req.json();
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!email) {
      return new Response(JSON.stringify({ error: "email é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

    // Find user by email
    const { data: profile } = await supabaseAdmin.from("profiles").select("user_id, company_id, email, full_name, active, company_assignment_status, companies!company_id(status)").ilike("email", email).maybeSingle();
    if (!profile || !profile.active || profile.company_assignment_status !== "approved" || !profile.company_id || !profile.companies || !["active", "trial"].includes(profile.companies.status)) {
      // Don't reveal whether email exists — return success
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
    if (!authUser.user?.email_confirmed_at) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate reset token
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const { error: tokenError } = await supabaseAdmin.from("password_reset_tokens").insert({
      company_id: profile.company_id,
      user_id: profile.user_id,
      email: profile.email,
      token,
      expires_at: expiresAt.toISOString(),
    });
    if (tokenError) {
      console.error("Falha ao criar token de recuperação", tokenError.message);
      return new Response(JSON.stringify({ error: "Não foi possível enviar o e-mail de recuperação." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Trigger reset email
    const EDGE_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const emailResponse = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        type: "password_reset",
        companyId: profile.company_id,
        recipientUserId: profile.user_id,
        resetToken: token,
      }),
    });
    if (!emailResponse.ok) {
      console.error("Falha ao preparar recuperação de senha", await emailResponse.text().catch(() => ""));
      return new Response(JSON.stringify({ error: "Não foi possível enviar o e-mail de recuperação." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
