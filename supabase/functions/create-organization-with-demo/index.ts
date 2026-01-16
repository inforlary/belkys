import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateOrgRequest {
  organizationName: string;
  code: string;
  city: string;
  district: string;
  subdomain: string;
  contactEmail: string;
  contactPhone?: string;
  logoUrl?: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName: string;
  maxUsers?: number;
  moduleStrategicPlanning?: boolean;
  moduleActivityReports?: boolean;
  moduleBudgetPerformance?: boolean;
  moduleInternalControl?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Yetkilendirme gerekli");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Geçersiz token");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_super_admin) {
      throw new Error("Bu işlem için Super Admin yetkisi gerekli");
    }

    const body: CreateOrgRequest = await req.json();

    const { organizationName, code, city, district, subdomain, contactEmail, contactPhone, logoUrl, adminEmail, adminPassword, adminFullName } = body;

    if (!organizationName || !code || !city || !subdomain || !contactEmail || !adminEmail || !adminPassword || !adminFullName) {
      throw new Error("Gerekli alanlar eksik");
    }

    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("subdomain", subdomain)
      .maybeSingle();

    if (existingOrg) {
      throw new Error("Bu subdomain zaten kullanımda");
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: organizationName,
        code: code,
        city: city,
        district: district || '',
        subdomain: subdomain,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        logo_url: logoUrl || null,
        is_active: true,
        max_users: body.maxUsers || 50,
        module_strategic_planning: body.moduleStrategicPlanning ?? true,
        module_activity_reports: body.moduleActivityReports ?? true,
        module_budget_performance: body.moduleBudgetPerformance ?? true,
        module_internal_control: body.moduleInternalControl ?? true,
      })
      .select()
      .single();

    if (orgError) throw orgError;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (authError) throw authError;

    const { data: profile2, error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        organization_id: org.id,
        email: adminEmail,
        full_name: adminFullName,
        role: "admin",
        initial_password: adminPassword,
      })
      .select()
      .single();

    if (profileError) throw profileError;

    await supabase.from("super_admin_credentials").insert({
      organization_id: org.id,
      user_id: authData.user.id,
      email: adminEmail,
      password: adminPassword,
    });

    const { error: demoError } = await supabase.functions.invoke("create-demo-users", {
      body: { organizationId: org.id },
    });

    if (demoError) {
      console.error("Demo data creation error:", demoError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        organizationId: org.id,
        adminId: authData.user.id,
        message: "Belediye başarıyla oluşturuldu",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Bir hata oluştu",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});