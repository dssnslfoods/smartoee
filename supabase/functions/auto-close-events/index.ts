import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find open events (end_ts IS NULL) and check if their shift has ended
    // We use Asia/Bangkok timezone since all shift times are in local Thai time
    const { data: openEvents, error: fetchError } = await supabase
      .from("production_events")
      .select(
        `
        id, machine_id, start_ts, shift_calendar_id,
        shift_calendar!inner(
          id, shift_date, plant_id,
          shifts!inner(start_time, end_time)
        )
      `
      )
      .is("end_ts", null);

    if (fetchError) {
      console.error("Error fetching open events:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!openEvents || openEvents.length === 0) {
      return new Response(
        JSON.stringify({ closed: 0, message: "No open events found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nowBangkok = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
    );
    const nowTime = `${String(nowBangkok.getHours()).padStart(2, "0")}:${String(nowBangkok.getMinutes()).padStart(2, "0")}:00`;
    const nowDate = `${nowBangkok.getFullYear()}-${String(nowBangkok.getMonth() + 1).padStart(2, "0")}-${String(nowBangkok.getDate()).padStart(2, "0")}`;

    let closedCount = 0;
    const closedIds: string[] = [];
    const errors: string[] = [];

    for (const ev of openEvents) {
      const sc = ev.shift_calendar as any;
      const shift = sc.shifts as any;
      const shiftDate = sc.shift_date;
      const startTime = shift.start_time; // e.g. "08:00:00"
      const endTime = shift.end_time; // e.g. "17:00:00"

      // Calculate shift end datetime in Bangkok timezone
      const isOvernight = startTime > endTime;

      let shiftEndDateStr: string;
      if (isOvernight) {
        // Overnight shift: end time is next day
        const nextDay = new Date(shiftDate + "T00:00:00");
        nextDay.setDate(nextDay.getDate() + 1);
        shiftEndDateStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
      } else {
        shiftEndDateStr = shiftDate;
      }

      // Build shift end timestamp in Asia/Bangkok
      const shiftEndTs = new Date(`${shiftEndDateStr}T${endTime}+07:00`);

      // Check if current time has passed the shift end
      const nowUtc = new Date();
      if (nowUtc <= shiftEndTs) {
        continue; // Shift hasn't ended yet
      }

      // Close the event with end_ts = shift end time
      const { error: updateError } = await supabase
        .from("production_events")
        .update({
          end_ts: shiftEndTs.toISOString(),
          updated_at: new Date().toISOString(),
          notes: ((ev as any).notes ? (ev as any).notes + " | " : "") + "Auto-closed: สิ้นสุดเวลากะ",
        })
        .eq("id", ev.id)
        .is("end_ts", null); // Extra safety: only close if still open

      if (updateError) {
        console.error(`Error closing event ${ev.id}:`, updateError);
        errors.push(`${ev.id}: ${updateError.message}`);
      } else {
        closedCount++;
        closedIds.push(ev.id);
      }
    }

    // Audit log for auto-closed events
    if (closedIds.length > 0) {
      await supabase.from("audit_logs").insert(
        closedIds.map((id) => ({
          entity_type: "production_event",
          entity_id: id,
          action: "AUTO_CLOSE",
          after_json: { reason: "shift_ended", closed_at: new Date().toISOString() },
          actor_user_id: null,
        }))
      );
    }

    console.log(`Auto-close completed: ${closedCount} events closed`);

    return new Response(
      JSON.stringify({
        closed: closedCount,
        closed_ids: closedIds,
        errors: errors.length > 0 ? errors : undefined,
        checked: openEvents.length,
        message: `ปิดอัตโนมัติ ${closedCount} เหตุการณ์ จากทั้งหมด ${openEvents.length} เหตุการณ์ที่เปิดค้าง`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Auto-close error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
