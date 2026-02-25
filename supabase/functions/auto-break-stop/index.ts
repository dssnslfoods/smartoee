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

    // Get current Bangkok time
    const nowUtc = new Date();
    const bangkokTime = new Date(
      nowUtc.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
    );
    const nowTimeStr = `${String(bangkokTime.getHours()).padStart(2, "0")}:${String(bangkokTime.getMinutes()).padStart(2, "0")}:00`;
    const nowDateStr = `${bangkokTime.getFullYear()}-${String(bangkokTime.getMonth() + 1).padStart(2, "0")}-${String(bangkokTime.getDate()).padStart(2, "0")}`;

    console.log(`Auto-break-stop check at Bangkok time: ${nowDateStr} ${nowTimeStr}`);

    // Find PPT templates that have break_start_time set and current time is within break window
    const { data: templates, error: tplErr } = await supabase
      .from("planned_time_templates")
      .select("id, plant_id, shift_id, break_start_time, break_minutes")
      .eq("is_active", true)
      .not("break_start_time", "is", null)
      .gt("break_minutes", 0);

    if (tplErr) throw tplErr;
    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ stopped: 0, message: "No break schedules configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter templates where current time is within break window
    // We only trigger at break_start_time (within a 2-minute window to account for cron timing)
    const activeBreaks = templates.filter((t) => {
      const breakStart = t.break_start_time as string; // e.g. "12:00:00"

      // Check if now is within the first 2 minutes of break start
      const breakStartMinutes = timeToMinutes(breakStart);
      const nowMinutes = timeToMinutes(nowTimeStr);

      // Allow 2-minute window from break start
      const diff = nowMinutes - breakStartMinutes;
      return diff >= 0 && diff < 2;
    });

    if (activeBreaks.length === 0) {
      return new Response(
        JSON.stringify({
          stopped: 0,
          templates_checked: templates.length,
          message: "No breaks starting right now",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${activeBreaks.length} break schedules starting now`);

    let stoppedCount = 0;
    const stoppedIds: string[] = [];
    const errors: string[] = [];

    for (const tpl of activeBreaks) {
      // Find shift_calendar entries for today matching this plant+shift
      const { data: calendars, error: calErr } = await supabase
        .from("shift_calendar")
        .select("id")
        .eq("plant_id", tpl.plant_id)
        .eq("shift_id", tpl.shift_id)
        .eq("shift_date", nowDateStr);

      if (calErr) {
        errors.push(`Calendar lookup error: ${calErr.message}`);
        continue;
      }

      if (!calendars || calendars.length === 0) {
        // Also check previous day for overnight shifts
        const yesterday = new Date(bangkokTime);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

        const { data: overnightCals } = await supabase
          .from("shift_calendar")
          .select("id")
          .eq("plant_id", tpl.plant_id)
          .eq("shift_id", tpl.shift_id)
          .eq("shift_date", yesterdayStr);

        if (!overnightCals || overnightCals.length === 0) continue;
        calendars?.push(...overnightCals);
      }

      const calendarIds = (calendars || []).map((c) => c.id);
      if (calendarIds.length === 0) continue;

      // Find open RUN events in these shift calendars
      const { data: openEvents, error: evErr } = await supabase
        .from("production_events")
        .select("id, notes")
        .in("shift_calendar_id", calendarIds)
        .eq("event_type", "RUN")
        .is("end_ts", null);

      if (evErr) {
        errors.push(`Event lookup error: ${evErr.message}`);
        continue;
      }

      if (!openEvents || openEvents.length === 0) continue;

      // Close all open RUN events with break_start_time as end_ts
      const breakEndTs = new Date(`${nowDateStr}T${tpl.break_start_time}+07:00`);

      // Calculate break end time from break_start_time + break_minutes
      const breakStartMin = timeToMinutes(tpl.break_start_time as string);
      const breakEndMin = breakStartMin + (tpl.break_minutes as number);
      const breakEndH = String(Math.floor(breakEndMin / 60) % 24).padStart(2, "0");
      const breakEndM = String(breakEndMin % 60).padStart(2, "0");
      const breakEndTimeStr = `${breakEndH}:${breakEndM}`;

      for (const ev of openEvents) {
        const { error: updateErr } = await supabase
          .from("production_events")
          .update({
            end_ts: breakEndTs.toISOString(),
            updated_at: new Date().toISOString(),
            notes: (ev.notes ? ev.notes + " | " : "") +
              `Auto-stopped: พักกลางวัน (${(tpl.break_start_time as string).slice(0, 5)}-${breakEndTimeStr})`,
          })
          .eq("id", ev.id)
          .is("end_ts", null);

        if (updateErr) {
          errors.push(`${ev.id}: ${updateErr.message}`);
        } else {
          stoppedCount++;
          stoppedIds.push(ev.id);
        }
      }
    }

    // Audit log
    if (stoppedIds.length > 0) {
      await supabase.from("audit_logs").insert(
        stoppedIds.map((id) => ({
          entity_type: "production_event",
          entity_id: id,
          action: "AUTO_BREAK_STOP",
          after_json: {
            reason: "scheduled_break",
            stopped_at: new Date().toISOString(),
          },
          actor_user_id: null,
        }))
      );
    }

    console.log(`Auto-break-stop completed: ${stoppedCount} events stopped`);

    return new Response(
      JSON.stringify({
        stopped: stoppedCount,
        stopped_ids: stoppedIds,
        errors: errors.length > 0 ? errors : undefined,
        breaks_triggered: activeBreaks.length,
        message: `หยุดเครื่องอัตโนมัติ ${stoppedCount} เครื่อง เนื่องจากถึงเวลาพัก`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Auto-break-stop error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}
