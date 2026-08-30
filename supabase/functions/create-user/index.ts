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
    const { email, password, full_name, company_id, role, department_id, position, phone } = await req.json();

    if (!email || !password || !full_name || !company_id) {
      return new Response(
        JSON.stringify({ error: "email, password, full_name e company_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Verify the caller is authenticated and is a company_admin or sow_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: callerData } = await callerClient.auth.getUser(authHeader.replace("Bearer ", ""));
    const callerId = callerData.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, company_id")
      .eq("user_id", callerId)
      .maybeSingle();

    if (!callerProfile || !["sow_admin", "company_admin"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Sem permissão para criar usuários" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // company_admin can only create users in their own company
    if (callerProfile.role === "company_admin" && callerProfile.company_id !== company_id) {
      return new Response(JSON.stringify({ error: "Sem permissão para esta empresa" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check company status — block user creation for inactive/suspended companies
    const { data: company } = await supabaseAdmin.from("companies").select("status, max_users").eq("id", company_id).maybeSingle();
    if (!company) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (company.status === "inactive" || company.status === "suspended") {
      return new Response(JSON.stringify({ error: "Esta empresa está inativa ou suspensa. Não é possível cadastrar usuários." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Enforce seat limit
    const { count: activeUserCount } = await supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("company_id", company_id).eq("active", true);
    const maxUsers = company.max_users ?? 5;
    if ((activeUserCount ?? 0) >= maxUsers) {
      return new Response(JSON.stringify({ error: `Limite de usuários do plano atingido (${maxUsers}). Para adicionar mais usuários, faça upgrade do plano.` }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validRole = ["sow_admin", "company_admin", "area_manager", "responsible", "viewer"].includes(role) ? role : "responsible";

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      user_id: data.user.id,
      company_id,
      full_name,
      email,
      role: validRole,
      department_id: department_id || null,
      position: position || null,
      phone: phone || null,
    });

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, user_id: data.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
