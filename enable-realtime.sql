-- ==============================================================================
-- KÍCH HOẠT SUPABASE REALTIME & CẤP QUYỀN CHO BẢNG SUBMISSIONS
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán toàn bộ mã này -> Nhấn "Run"
-- ==============================================================================

-- 1. Bật Realtime cho bảng submissions (để học sinh nhận kết quả chấm bài tức thì < 50ms)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  END IF;
END $$;

-- 2. Cấp quyền UPDATE trên bảng submissions cho Worker VPS & Serverless Function
DROP POLICY IF EXISTS "submissions_update_policy" ON public.submissions;
CREATE POLICY "submissions_update_policy" ON public.submissions
  FOR UPDATE USING (
    public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon' OR auth.role() = 'authenticated'
  ) WITH CHECK (
    public.is_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon' OR auth.role() = 'authenticated'
  );
