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

    // 1. Fetch all active planned time templates to handle breaks
    const { data: templates } = await supabase
      .from("planned_time_templates")
      .select("plant_id, shift_id, break_start_time, break_end_time")
      .eq("is_active", true);

    const templateMap = new Map();
    templates?.forEach(t => {
      templateMap.set(`${t.plant_id}-${t.shift_id}`, t);
    });

    // 2. Find open events
    const { data: openEvents, error: fetchError } = await supabase
      .from("production_events")
      .select(`
        id, machine_id, start_ts, shift_calendar_id, notes,
        shift_calendar!inner(
          id, shift_date, plant_id, shift_id,
          shifts!inner(start_time, end_time)
        )
      `)
      .is("end_ts", null);

    if (fetchError) {
      console.error("Error fetching open events:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!openEvents || openEvents.length === 0) {
      return new Response(JSON.stringify({ closed: 0, message: "No open events found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const nowUtc = new Date();
    // Use Asia/Bangkok for Thailand local time comparisons
    const nowBangkok = new Date(nowUtc.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));

    let closedCount = 0;
    const closedIds: string[] = [];
    const errors: string[] = [];

    for (const ev of openEvents) {
      const sc = ev.shift_calendar as any;
      const shift = sc.shifts as any;
      const shiftDate = sc.shift_date;
      const startTime = shift.start_time;
      const endTime = shift.end_time;
      const plantId = sc.plant_id;
      const shiftId = sc.shift_id;

      // Check for Break Stop (Phase 4)
      const template = templateMap.get(`${plantId}-${shiftId}`);
      if (template && template.break_start_time && template.break_end_time) {
        const breakStartTs = new Date(`${shiftDate}T${template.break_start_time}+07:00`);
        const breakEndTs = new Date(`${shiftDate}T${template.break_end_time}+07:00`);

        // If current time is past break start but before break end, auto-stop!
        if (nowUtc >= breakStartTs && nowUtc < breakEndTs) {
          const { error: updateError } = await supabase
            .from("production_events")
            .update({
              end_ts: breakStartTs.toISOString(),
              updated_at: new Date().toISOString(),
              notes: (ev.notes ? ev.notes + " | " : "") + "Auto-closed: เข้าสู่ช่วงเวลาพัก",
            })
            .eq("id", ev.id);

          if (!updateError) {
            closedCount++;
            closedIds.push(ev.id);
            continue; // Skip shift-end check if already closed for break
          }
        }
      }

      // Existing Shift End check
      const isOvernight = startTime > endTime;
      let endDateStr = shiftDate;
      if (isOvernight) {
        const nextDay = new Date(shiftDate + "T00:00:00");
        nextDay.setDate(nextDay.getDate() + 1);
        endDateStr = nextDay.toISOString().split('T')[0];
      }
      const shiftEndTs = new Date(`${endDateStr}T${endTime}+07:00`);

      if (nowUtc > shiftEndTs) {
        const { error: updateError } = await supabase
          .from("production_events")
          .update({
            end_ts: shiftEndTs.toISOString(),
            updated_at: new Date().toISOString(),
            notes: (ev.notes ? ev.notes + " | " : "") + "Auto-closed: สิ้นสุดเวลากะ",
          })
          .eq("id", ev.id);

        if (!updateError) {
          closedCount++;
          closedIds.push(ev.id);
        } else {
          errors.push(`${ev.id}: ${updateError.message}`);
        }
      }
    }

    // Audit logs
    if (closedIds.length > 0) {
      await supabase.from("audit_logs").insert(
        closedIds.map(id => ({
          entity_type: "production_event",
          entity_id: id,
          action: "AUTO_CLOSE",
          after_json: { closed_at: new Date().toISOString() },
          actor_user_id: null
        }))
      );
    }

    return new Response(JSON.stringify({
      closed: closedCount,
      message: `ปิดอัตโนมัติ ${closedCount} เหตุการณ์ จากการตรวจสอบกะและเวลาพัก`
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
