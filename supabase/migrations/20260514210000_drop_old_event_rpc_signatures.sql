-- Cleanup: ลบ signature เก่าของ rpc_start_event และ rpc_create_manual_event
-- (ไม่มี p_std_setup_time_seconds) เพื่อให้เหลือเฉพาะ version ใหม่ที่รับ std time
--
-- Why: CREATE OR REPLACE FUNCTION ที่มี parameter list ต่าง = function ใหม่
-- ใน Postgres → ทั้ง 2 versions อยู่ใน DB พร้อมกัน → PostgREST เลือกไม่ถูก
-- error: "Could not choose the best candidate function between..."

DROP FUNCTION IF EXISTS public.rpc_start_event(UUID, public.event_type, UUID, TEXT, UUID);

DROP FUNCTION IF EXISTS public.rpc_create_manual_event(
    uuid, event_type,
    timestamp with time zone, timestamp with time zone,
    uuid, uuid, text
);
