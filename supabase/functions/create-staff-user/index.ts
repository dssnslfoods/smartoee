import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "UNAUTHORIZED", message: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with the user's token to verify they are a supervisor
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "UNAUTHORIZED", message: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is a supervisor
    const { data: profile, error: profileError } = await userClient
      .from("user_profiles")
      .select("role, company_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: "UNAUTHORIZED", message: "User profile not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile.role !== "SUPERVISOR" && profile.role !== "ADMIN") {
      return new Response(
        JSON.stringify({ success: false, error: "PERMISSION_DENIED", message: "Only supervisors can create staff users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email, password, fullName, role, companyId } = await req.json();

    if (!email || !password || !fullName) {
      return new Response(
        JSON.stringify({ success: false, error: "VALIDATION_ERROR", message: "Email, password, and fullName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: "VALIDATION_ERROR", message: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine role and company_id based on caller
    let targetRole = "STAFF";
    let targetCompanyId = profile.company_id;

    if (profile.role === "ADMIN") {
      // Admin can specify any role and company
      targetRole = role || "STAFF";
      targetCompanyId = companyId || profile.company_id;
    } else {
      // Supervisor can create STAFF or SUPERVISOR in their company
      const allowedRoles = ["STAFF", "SUPERVISOR"];
      const requestedRole = role || "STAFF";
      if (!allowedRoles.includes(requestedRole)) {
        return new Response(
          JSON.stringify({ success: false, error: "PERMISSION_DENIED", message: "Supervisors can only create STAFF or SUPERVISOR users" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetRole = requestedRole;
      targetCompanyId = profile.company_id;
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create the user using admin API (doesn't affect current session)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        role: targetRole,
        company_id: targetCompanyId,
      },
    });

    if (createError) {
      console.error("Failed to create user:", createError.message);
      // Check for duplicate email error
      let errorMessage = createError.message;
      if (createError.message.includes("already been registered") || createError.message.includes("duplicate")) {
        errorMessage = "อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น";
      }
      return new Response(
        JSON.stringify({ success: false, error: "CREATE_ERROR", message: errorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User created successfully:", { id: newUser.user.id, email: newUser.user.email, role: targetRole });

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: newUser.user.id, 
          email: newUser.user.email 
        },
        message: "User created successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error creating staff user:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: "INTERNAL_ERROR", message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
