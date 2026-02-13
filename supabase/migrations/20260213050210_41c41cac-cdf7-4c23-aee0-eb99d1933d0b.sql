
CREATE OR REPLACE FUNCTION public.rpc_unlock_shift(p_shift_calendar_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_approval shift_approvals%ROWTYPE;
BEGIN
  -- Check supervisor role
  IF NOT is_supervisor(v_user_id) THEN
    RETURN json_build_object('ok', false, 'error', 'ต้องเป็น Supervisor เท่านั้น');
  END IF;

  -- Get current approval
  SELECT * INTO v_approval
  FROM shift_approvals
  WHERE shift_calendar_id = p_shift_calendar_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'ไม่พบข้อมูลการอนุมัติ');
  END IF;

  IF v_approval.status != 'LOCKED' THEN
    RETURN json_build_object('ok', false, 'error', 'กะนี้ยังไม่ได้ล็อค');
  END IF;

  -- Unlock: revert to APPROVED status, clear lock info
  UPDATE shift_approvals
  SET status = 'APPROVED',
      locked_by = NULL,
      locked_at = NULL,
      updated_at = now()
  WHERE shift_calendar_id = p_shift_calendar_id;

  -- Audit log
  INSERT INTO audit_logs (action, entity_type, entity_id, actor_user_id, after_json)
  VALUES ('UNLOCK', 'shift_approval', p_shift_calendar_id, v_user_id,
          json_build_object('shift_calendar_id', p_shift_calendar_id));

  RETURN json_build_object('ok', true);
END;
$$;
