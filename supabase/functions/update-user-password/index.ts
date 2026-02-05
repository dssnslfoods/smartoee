 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
       console.error("Missing authorization header");
       return new Response(
         JSON.stringify({ success: false, error: "UNAUTHORIZED", message: "Missing authorization header" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Create client with the user's token to verify permissions
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 
     const userClient = createClient(supabaseUrl, supabaseAnonKey, {
       global: { headers: { Authorization: authHeader } },
     });
 
     // Get the current user (requester)
     const { data: { user: requester }, error: requesterError } = await userClient.auth.getUser();
     if (requesterError || !requester) {
       console.error("Invalid user token:", requesterError?.message);
       return new Response(
         JSON.stringify({ success: false, error: "UNAUTHORIZED", message: "Invalid user token" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Get requester's profile to check role and company
     const { data: requesterProfile, error: profileError } = await userClient
       .from("user_profiles")
       .select("role, company_id")
       .eq("user_id", requester.id)
       .single();
 
     if (profileError || !requesterProfile) {
       console.error("Requester profile not found:", profileError?.message);
       return new Response(
         JSON.stringify({ success: false, error: "UNAUTHORIZED", message: "User profile not found" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log("Requester:", { id: requester.id, role: requesterProfile.role, company_id: requesterProfile.company_id });
 
     // Parse request body
    const { targetUserId, newPassword, newEmail } = await req.json();
 
    if (!targetUserId) {
       return new Response(
        JSON.stringify({ success: false, error: "VALIDATION_ERROR", message: "targetUserId is required" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
    if (!newPassword && !newEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "VALIDATION_ERROR", message: "newPassword or newEmail is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (newPassword && newPassword.length < 6) {
       return new Response(
         JSON.stringify({ success: false, error: "VALIDATION_ERROR", message: "Password must be at least 6 characters" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
    if (newEmail && !newEmail.includes("@")) {
      return new Response(
        JSON.stringify({ success: false, error: "VALIDATION_ERROR", message: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

     // Create admin client with service role key
     const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
       auth: {
         autoRefreshToken: false,
         persistSession: false,
       },
     });
 
     // Get target user's profile
     const { data: targetProfile, error: targetError } = await adminClient
       .from("user_profiles")
       .select("user_id, role, company_id, full_name")
       .eq("user_id", targetUserId)
       .single();
 
     if (targetError || !targetProfile) {
       console.error("Target user not found:", targetError?.message);
       return new Response(
         JSON.stringify({ success: false, error: "NOT_FOUND", message: "Target user not found" }),
         { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log("Target user:", { id: targetUserId, role: targetProfile.role, company_id: targetProfile.company_id });
 
     // Permission checks
     const isAdmin = requesterProfile.role === "ADMIN";
     const isSupervisor = requesterProfile.role === "SUPERVISOR";
 
     // Admin can update any user
     // Supervisor can only update STAFF in the same company
     if (isAdmin) {
      console.log("Admin updating user account");
     } else if (isSupervisor) {
       // Supervisor can only update STAFF in their company
       if (targetProfile.role !== "STAFF") {
         console.error("Supervisor cannot update non-STAFF users");
         return new Response(
           JSON.stringify({ success: false, error: "PERMISSION_DENIED", message: "Supervisors can only update STAFF users" }),
           { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
       if (targetProfile.company_id !== requesterProfile.company_id) {
         console.error("Supervisor cannot update users from different company");
         return new Response(
           JSON.stringify({ success: false, error: "PERMISSION_DENIED", message: "Supervisors can only update staff in their own company" }),
           { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
      console.log("Supervisor updating staff account");
     } else {
       console.error("Insufficient permissions:", requesterProfile.role);
       return new Response(
        JSON.stringify({ success: false, error: "PERMISSION_DENIED", message: "Only admins and supervisors can update user accounts" }),
         { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
    // Build update payload
    const updatePayload: { password?: string; email?: string } = {};
    if (newPassword) {
      updatePayload.password = newPassword;
    }
    if (newEmail) {
      updatePayload.email = newEmail;
    }

    // Update the user using admin API
    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      updatePayload
    );
 
     if (updateError) {
      console.error("Failed to update user:", updateError.message);
       return new Response(
         JSON.stringify({ success: false, error: "UPDATE_ERROR", message: updateError.message }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
    console.log("User updated successfully:", targetUserId, { emailUpdated: !!newEmail, passwordUpdated: !!newPassword });
 
     return new Response(
       JSON.stringify({ 
         success: true, 
        message: "User updated successfully",
         user: {
           id: updatedUser.user.id,
           email: updatedUser.user.email
         }
       }),
       { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
 
   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error updating user:", errorMessage);
     return new Response(
       JSON.stringify({ success: false, error: "INTERNAL_ERROR", message: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });