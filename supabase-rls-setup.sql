-- ==============================================================================
-- BẢO MẬT ROW LEVEL SECURITY (RLS) CHO THEMIS ONLINE JUDGE TRÊN SUPABASE (VULN-04)
-- Hướng dẫn: Mở Supabase Dashboard -> Vào mục "SQL Editor" -> Dán toàn bộ mã này và nhấn "Run"
-- ==============================================================================

-- 1. TẠO BẢNG HỒ SƠ NGƯỜI DÙNG (PROFILES) NẾU CHƯA TỒN TẠI & BỔ SUNG CỘT
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tự động bổ sung các cột nếu bảng profiles đã được tạo từ trước mà thiếu cột
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. HÀM KIỂM TRA QUYỀN QUẢN TRỊ VIÊN / GIÁO VIÊN (SECURITY DEFINER)
-- Chạy với quyền bảo mật của PostgreSQL để tránh vòng lặp vô hạn (infinite recursion) khi kiểm tra RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND LOWER(TRIM(role)) IN ('admin', 'teacher', 'giao_vien')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 3. TRIGGER TỰ ĐỘNG KHỞI TẠO PROFILE HỌC SINH KHI ĐĂNG KÝ SUPABASE AUTH MỚI (AN TOÀN TUYỆT ĐỐI)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(
        NEW.raw_user_meta_data->>'custom_full_name',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
      ),
      'student'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback an toàn: nếu bảng profiles có bất kỳ lỗi ràng buộc nào, không bao giờ chặn đăng ký Auth
    BEGIN
      INSERT INTO public.profiles (id, email, role)
      VALUES (NEW.id, NEW.email, 'student')
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- BẬT ROW LEVEL SECURITY (RLS) TRÊN TẤT CẢ CÁC BẢNG DỮ LIỆU
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- CHÍNH SÁCH BẢO MẬT (POLICIES) CHO BẢNG PROFILES
-- ==============================================================================
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR public.is_admin() OR auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id AND (role IS NULL OR role = 'student' OR public.is_admin())
  );

-- Chống lỗ hổng leo thang đặc quyền (Privilege Escalation): Học sinh không thể tự sửa role thành admin
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR public.is_admin()
  ) WITH CHECK (
    public.is_admin() OR (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE USING (
    public.is_admin()
  );

-- ==============================================================================
-- CHÍNH SÁCH BẢO MẬT (POLICIES) CHO BẢNG CLASSROOMS
-- ==============================================================================
-- Học sinh chỉ thấy lớp học thông thường; các bản ghi nội bộ __system_ chỉ dành cho Admin
DROP POLICY IF EXISTS "classrooms_select_policy" ON public.classrooms;
CREATE POLICY "classrooms_select_policy" ON public.classrooms
  FOR SELECT USING (
    id NOT LIKE '__system_%' OR public.is_admin()
  );

-- Chỉ Giáo viên / Quản trị viên mới được tạo, chỉnh sửa hoặc xóa lớp học
DROP POLICY IF EXISTS "classrooms_modify_policy" ON public.classrooms;
CREATE POLICY "classrooms_modify_policy" ON public.classrooms
  FOR ALL USING (
    public.is_admin()
  ) WITH CHECK (
    public.is_admin()
  );

-- ==============================================================================
-- CHÍNH SÁCH BẢO MẬT (POLICIES) CHO BẢNG PROBLEMS (ĐỀ BÀI)
-- ==============================================================================
-- Mọi người (kể cả khách vãng lai và học sinh) được xem đề bài
DROP POLICY IF EXISTS "problems_select_policy" ON public.problems;
CREATE POLICY "problems_select_policy" ON public.problems
  FOR SELECT USING (true);

-- Chỉ Quản trị viên / Giáo viên mới được thêm, sửa, xóa đề bài
DROP POLICY IF EXISTS "problems_modify_policy" ON public.problems;
CREATE POLICY "problems_modify_policy" ON public.problems
  FOR ALL USING (
    public.is_admin()
  ) WITH CHECK (
    public.is_admin()
  );

-- ==============================================================================
-- CHÍNH SÁCH BẢO MẬT (POLICIES) CHO BẢNG TEST_CASES
-- ==============================================================================
-- Học sinh được đọc test case để làm bài/chấm điểm
DROP POLICY IF EXISTS "test_cases_select_policy" ON public.test_cases;
CREATE POLICY "test_cases_select_policy" ON public.test_cases
  FOR SELECT USING (true);

-- Tuyệt đối chỉ Giáo viên / Admin mới có quyền chèn, sửa, xóa test cases
DROP POLICY IF EXISTS "test_cases_modify_policy" ON public.test_cases;
CREATE POLICY "test_cases_modify_policy" ON public.test_cases
  FOR ALL USING (
    public.is_admin()
  ) WITH CHECK (
    public.is_admin()
  );

-- ==============================================================================
-- CHÍNH SÁCH BẢO MẬT (POLICIES) CHO BẢNG SUBMISSIONS (LỊCH SỬ NỘP BÀI)
-- ==============================================================================
-- Mọi người được xem bảng xếp hạng và lịch sử nộp bài
DROP POLICY IF EXISTS "submissions_select_policy" ON public.submissions;
CREATE POLICY "submissions_select_policy" ON public.submissions
  FOR SELECT USING (true);

-- Học sinh chỉ được quyền nộp bài cho chính tài khoản của mình
DROP POLICY IF EXISTS "submissions_insert_policy" ON public.submissions;
CREATE POLICY "submissions_insert_policy" ON public.submissions
  FOR INSERT WITH CHECK (
    public.is_admin() OR auth.role() = 'authenticated' OR user_id = auth.uid()::text
  );

-- Chống gian lận điểm số: Học sinh KHÔNG THỂ gửi API sửa điểm (UPDATE) bài đã nộp
DROP POLICY IF EXISTS "submissions_update_policy" ON public.submissions;
CREATE POLICY "submissions_update_policy" ON public.submissions
  FOR UPDATE USING (
    public.is_admin()
  ) WITH CHECK (
    public.is_admin()
  );

-- Chỉ Quản trị viên hoặc chính chủ mới có thể xóa bài nộp
DROP POLICY IF EXISTS "submissions_delete_policy" ON public.submissions;
CREATE POLICY "submissions_delete_policy" ON public.submissions
  FOR DELETE USING (
    public.is_admin() OR user_id = auth.uid()::text
  );

-- ==============================================================================
-- GÁN QUYỀN QUẢN TRỊ VIÊN CHO TÀI KHOẢN CỦA BẠN (TÙY CHỌN):
-- Thay thế 'email_cua_ban@gmail.com' bằng email bạn dùng để đăng nhập:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'email_cua_ban@gmail.com';
-- ==============================================================================
