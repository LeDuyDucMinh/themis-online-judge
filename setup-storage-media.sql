-- ==============================================================================
-- KÍCH HOẠT KHO LƯU TRỮ ẢNH CÔNG KHAI (BANNER TRANG CHỦ & ĐẾM NGƯỢC KỲ THI)
-- Chạy 1 lần duy nhất trong Supabase -> SQL Editor -> Run
-- Giúp ảnh tự cache trên CDN & trình duyệt học sinh, tiết kiệm >99% băng thông.
-- ==============================================================================

-- 1. Tạo kho lưu trữ công khai 'media' (giới hạn 5 MB / ảnh, hỗ trợ JPG / PNG / WebP)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Chính sách truy cập cho kho 'media' (học sinh xem ảnh công khai, giáo viên tải lên / dọn ảnh cũ)
DROP POLICY IF EXISTS "media_storage_select" ON storage.objects;
CREATE POLICY "media_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

DROP POLICY IF EXISTS "media_storage_insert" ON storage.objects;
CREATE POLICY "media_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "media_storage_update" ON storage.objects;
CREATE POLICY "media_storage_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'media') WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "media_storage_delete" ON storage.objects;
CREATE POLICY "media_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'media');
