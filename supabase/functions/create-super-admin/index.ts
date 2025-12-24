import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateSuperAdminRequest {
  email: string;
  password: string;
  fullName: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateSuperAdminRequest = await req.json();
    const { email, password, fullName } = body;

    if (!email || !password || !fullName) {
      throw new Error("Email, şifre ve isim gereklidir");
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Kullanıcı oluşturulamadı");

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        organization_id: null,
        email,
        full_name: fullName,
        role: "admin",
        is_super_admin: true,
      });

    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user.id,
          email,
          fullName,
          isSuperAdmin: true,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});