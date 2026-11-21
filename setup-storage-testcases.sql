-- ==============================================================================
-- KÍCH HOẠT KHO LƯU TRỮ BỘ TEST NÉN .ZIP CHUẨN VNOI (SUPABASE STORAGE)
-- Chạy 1 lần duy nhất trong Supabase -> SQL Editor -> Run
-- ==============================================================================

-- 1. Tạo kho lưu trữ 'testcases' (giới hạn tối đa 50MB / file .ZIP ~ 200-250MB test gốc)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'testcases',
  'testcases',
  false,
  52428800,
  ARRAY['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];

-- 2. Chính sách truy cập cho kho 'testcases' (hỗ trợ Giáo viên tải lên & Worker VPS tải về chấm)
DROP POLICY IF EXISTS "testcases_storage_select" ON storage.objects;
CREATE POLICY "testcases_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'testcases');

DROP POLICY IF EXISTS "testcases_storage_insert" ON storage.objects;
CREATE POLICY "testcases_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'testcases');

DROP POLICY IF EXISTS "testcases_storage_update" ON storage.objects;
CREATE POLICY "testcases_storage_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'testcases') WITH CHECK (bucket_id = 'testcases');

DROP POLICY IF EXISTS "testcases_storage_delete" ON storage.objects;
CREATE POLICY "testcases_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'testcases');
