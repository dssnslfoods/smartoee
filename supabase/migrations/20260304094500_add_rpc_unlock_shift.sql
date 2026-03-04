
-- Migration to add missing rpc_unlock_shift function
-- Created: 2026-03-04

CREATE OR REPLACE FUNCTION public.rpc_unlock_shift(p_shift_calendar_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted_count integer;
BEGIN
  -- 1. Check supervisor role
  IF NOT public.is_supervisor() THEN
    RETURN jsonb_build_object('success', false, 'ok', false, 'error', 'PERMISSION_DENIED', 'message', 'ต้องเป็น Supervisor เท่านั้น');
  END IF;

  -- 2. Verify status is LOCKED
  IF NOT EXISTS (SELECT 1 FROM public.shift_approvals WHERE shift_calendar_id = p_shift_calendar_id AND status = 'LOCKED') THEN
    RETURN jsonb_build_object('success', false, 'ok', false, 'error', 'NOT_LOCKED', 'message', 'กะนี้ยังไม่ได้ล็อค หรือไม่พบข้อมูล');
  END IF;

  -- 3. Unlock: revert to DRAFT status
  UPDATE public.shift_approvals
  SET status = 'DRAFT',
      approved_by = NULL,
      approved_at = NULL,
      locked_by = NULL,
      locked_at = NULL,
      updated_at = now()
  WHERE shift_calendar_id = p_shift_calendar_id;

  -- 4. Delete OEE Snapshots for this shift to force recalculation
  DELETE FROM public.oee_snapshots
  WHERE period = 'SHIFT' AND shift_calendar_id = p_shift_calendar_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- 5. Audit log
  INSERT INTO public.audit_logs (action, entity_type, entity_id, actor_user_id, after_json)
  VALUES ('UNLOCK', 'shift_approval', p_shift_calendar_id, v_user_id,
          jsonb_build_object('shift_calendar_id', p_shift_calendar_id, 'oee_snapshots_deleted', v_deleted_count));

  RETURN jsonb_build_object('success', true, 'ok', true, 'data', jsonb_build_object('shift_calendar_id', p_shift_calendar_id, 'oee_snapshots_deleted', v_deleted_count));
END;
$$;
