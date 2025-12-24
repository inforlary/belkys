import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const demoUsers = [
      {
        id: '62b6914c-e524-4116-ae13-c04b81c2ec20',
        email: 'admin@kadikoybld.gov.tr',
        password: 'Admin123!',
        full_name: 'Admin',
        role: 'admin',
        department_id: null
      },
      {
        id: '53e98123-c7ff-44c9-80df-f71379bd4749',
        email: 'mudur@kadikoybld.gov.tr',
        password: 'Mudur123!',
        full_name: 'Ayşe Yılmaz',
        role: 'manager',
        department_id: '89a949f1-ea1a-4f26-a1af-cc128cfb3ec6'
      },
      {
        id: '74e2a30c-15df-4249-a943-b9261f74fa31',
        email: 'kullanici@kadikoybld.gov.tr',
        password: 'Kullanici123!',
        full_name: 'Mehmet Demir',
        role: 'user',
        department_id: '99eb42c4-880d-4f29-99f2-1bec92aceb15'
      }
    ];

    const results = [];

    for (const user of demoUsers) {
      if (user.id) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          { password: user.password }
        );

        if (updateError) {
          results.push({ email: user.email, error: updateError.message });
        } else {
          results.push({ email: user.email, updated: true });
        }
        continue;
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (authError && !authError.message.includes('already registered')) {
        results.push({ email: user.email, error: authError.message });
        continue;
      }

      const userId = authData?.user?.id;
      if (userId) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            organization_id: '525d1056-ba28-46e1-9a9c-0734b9a49cf7',
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            department_id: user.department_id
          }, {
            onConflict: 'id'
          });

        if (profileError) {
          results.push({ email: user.email, error: profileError.message });
        } else {
          results.push({ email: user.email, success: true });
        }
      }
    }

    return new Response(
      JSON.stringify({ message: 'Demo users created', results }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});