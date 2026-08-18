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
    const { token, password } = await req.json();
    if (!token || !password) {
      return new Response(JSON.stringify({ error: "token e password são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "A senha deve ter no mínimo 6 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

    // Validate token
    const { data: invite } = await supabaseAdmin.from("invite_tokens").select("*").eq("token", token).maybeSingle();
    if (!invite) {
      return new Response(JSON.stringify({ error: "Token de convite inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (invite.used_at) {
      return new Response(JSON.stringify({ error: "Este convite já foi utilizado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Este convite expirou" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(invite.user_id, {
      password,
      user_metadata: { full_name: invite.full_name, needs_password_setup: false },
    });
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Activate profile
    await supabaseAdmin.from("profiles").update({ active: true }).eq("user_id", invite.user_id);

    // Mark token as used
    await supabaseAdmin.from("invite_tokens").update({ used_at: new Date().toISOString() }).eq("id", invite.id);

    return new Response(JSON.stringify({ success: true, email: invite.email, companyId: invite.company_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
