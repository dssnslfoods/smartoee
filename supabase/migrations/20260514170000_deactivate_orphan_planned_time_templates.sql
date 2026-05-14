-- ============================================================================
-- Cleanup: deactivate planned_time_templates ที่ plant_id ไม่ match กับ shift จริง
-- ----------------------------------------------------------------------------
-- พบ row 1 row ที่ plant_id ใน planned_time_templates ไม่มี shift ใน shifts table
-- ตรงกัน → ทำให้ join ตอน compute_net_planned_time() ไม่ติด และไม่มีผลต่อระบบ
-- แต่ทำให้ Admin/Manager หลงคิดว่ามี template ใช้งานอยู่
-- ============================================================================

UPDATE public.planned_time_templates
   SET is_active = false, updated_at = NOW()
 WHERE is_active = true
   AND NOT EXISTS (
       SELECT 1 FROM public.shifts s
        WHERE s.id = planned_time_templates.shift_id
          AND s.plant_id = planned_time_templates.plant_id
   );
