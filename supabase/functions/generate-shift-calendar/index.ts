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

    // Parse optional days_ahead param (default: 7 days ahead)
    let daysAhead = 7;
    try {
      const body = await req.json();
      if (body?.days_ahead) daysAhead = Math.min(body.days_ahead, 30);
    } catch {
      // no body is fine
    }

    // Get all active shifts with their plants and planned time templates
    const { data: shifts, error: shiftErr } = await supabase
      .from("shifts")
      .select("id, plant_id, start_time, end_time, working_days, name")
      .eq("is_active", true);

    if (shiftErr) throw shiftErr;

    // Get all active planned time templates
    const { data: templates, error: tplErr } = await supabase
      .from("planned_time_templates")
      .select("*")
      .eq("is_active", true);

    if (tplErr) throw tplErr;

    // Get holidays
    const { data: holidays, error: holErr } = await supabase
      .from("holidays")
      .select("holiday_date, plant_id, is_recurring, company_id");

    if (holErr) throw holErr;

    // Get plant -> company mapping
    const { data: plants, error: plantErr } = await supabase
      .from("plants")
      .select("id, company_id")
      .eq("is_active", true);

    if (plantErr) throw plantErr;

    const plantCompanyMap = new Map(plants?.map((p: any) => [p.id, p.company_id]) || []);

    const today = new Date();
    // Use Bangkok timezone
    const bangkokOffset = 7 * 60; // UTC+7
    const utcNow = today.getTime() + today.getTimezoneOffset() * 60000;
    const bangkokNow = new Date(utcNow + bangkokOffset * 60000);
    
    let created = 0;
    let skipped = 0;
    const rows: any[] = [];

    for (let d = 0; d < daysAhead; d++) {
      const date = new Date(bangkokNow);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split("T")[0];
      const dow = date.getDay(); // 0=Sun, 1=Mon, ...

      for (const shift of shifts || []) {
        // Check if this day is a working day for this shift
        if (!shift.working_days?.includes(dow)) {
          skipped++;
          continue;
        }

        // Check if holiday
        const companyId = plantCompanyMap.get(shift.plant_id);
        const isHoliday = holidays?.some((h: any) => {
          if (h.company_id !== companyId) return false;
          if (h.plant_id && h.plant_id !== shift.plant_id) return false;
          if (h.is_recurring) {
            const hDate = new Date(h.holiday_date);
            return hDate.getMonth() === date.getMonth() && hDate.getDate() === date.getDate();
          }
          return h.holiday_date === dateStr;
        });

        if (isHoliday) {
          skipped++;
          continue;
        }

        // Calculate planned_time_minutes from PPT template
        const shiftDuration = calcShiftDuration(shift.start_time, shift.end_time);
        
        // Find best matching template
        const template = templates
          ?.filter((t: any) => 
            t.plant_id === shift.plant_id && 
            t.shift_id === shift.id && 
            t.effective_from <= dateStr
          )
          .sort((a: any, b: any) => b.effective_from.localeCompare(a.effective_from))[0];

        let plannedTime = shiftDuration;
        if (template) {
          const deductions = (template.break_minutes || 0) +
            (template.meal_minutes || 0) +
            (template.meeting_minutes || 0) +
            (template.maintenance_minutes || 0) +
            (template.other_minutes || 0);
          plannedTime = Math.max(shiftDuration - deductions, 0);
        }

        rows.push({
          plant_id: shift.plant_id,
          shift_id: shift.id,
          shift_date: dateStr,
          planned_time_minutes: plannedTime,
        });
      }
    }

    // Upsert - use ON CONFLICT to avoid duplicates
    if (rows.length > 0) {
      // Check existing entries first
      const dates = [...new Set(rows.map(r => r.shift_date))];
      const { data: existing } = await supabase
        .from("shift_calendar")
        .select("plant_id, shift_id, shift_date")
        .in("shift_date", dates);

      const existingSet = new Set(
        (existing || []).map((e: any) => `${e.plant_id}_${e.shift_id}_${e.shift_date}`)
      );

      const newRows = rows.filter(
        r => !existingSet.has(`${r.plant_id}_${r.shift_id}_${r.shift_date}`)
      );

      if (newRows.length > 0) {
        const { error: insertErr } = await supabase
          .from("shift_calendar")
          .insert(newRows);
        if (insertErr) throw insertErr;
        created = newRows.length;
      }

      skipped += rows.length - newRows.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        created,
        skipped,
        days_ahead: daysAhead,
        message: `สร้าง shift_calendar ${created} รายการ, ข้าม ${skipped} รายการ (มีอยู่แล้ว/วันหยุด/ไม่ใช่วันทำงาน)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calcShiftDuration(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 1440; // overnight shift
  return mins;
}
