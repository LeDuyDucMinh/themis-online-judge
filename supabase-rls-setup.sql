-- ==============================================================================
-- HỆ SINH THÁI PHÂN QUYỀN 3 CẤP (ADMIN TỐI CAO - GIÁO VIÊN - HỌC SINH) & RLS
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

-- Đồng bộ mọi tài khoản từ auth.users sang public.profiles nếu chưa có dòng
INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  u.id,
  LOWER(TRIM(u.email)),
  COALESCE(
    u.raw_user_meta_data->>'custom_full_name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ),
  CASE
    WHEN LOWER(TRIM(u.email)) = 'minh.ldd2610979@sis.hust.edu.vn' THEN 'admin'
    WHEN LOWER(TRIM(u.email)) = 'leduyducminh@gmail.com' THEN 'teacher'
    ELSE 'student'
  END
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (id) DO UPDATE
SET email = COALESCE(public.profiles.email, EXCLUDED.email);

-- Đảm bảo phân quyền chuẩn cho Admin tối cao và Giáo viên hiện tại
UPDATE public.profiles SET role = 'admin' WHERE LOWER(TRIM(email)) = 'minh.ldd2610979@sis.hust.edu.vn';
UPDATE public.profiles SET role = 'teacher' WHERE LOWER(TRIM(email)) = 'leduyducminh@gmail.com' AND LOWER(TRIM(role)) = 'admin';

-- 2. HÀM KIỂM TRA QUYỀN ADMIN TỐI CAO & GIÁO VIÊN (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND LOWER(TRIM(role)) IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND LOWER(TRIM(role)) IN ('admin', 'super_admin', 'teacher', 'giao_vien')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 2b. TRIGGER BẢO VỆ HỆ THỐNG LUÔN CÓ ÍT NHẤT 1 ADMIN TỐI CAO TRONG SUPABASE
CREATE OR REPLACE FUNCTION public.ensure_minimum_one_admin()
RETURNS TRIGGER AS $$
DECLARE
  remaining_admins INTEGER;
BEGIN
  IF (TG_OP = 'DELETE' AND LOWER(TRIM(OLD.role)) = 'admin') THEN
    SELECT COUNT(*) INTO remaining_admins
    FROM public.profiles
    WHERE LOWER(TRIM(role)) = 'admin' AND id <> OLD.id;

    IF remaining_admins < 1 THEN
      RAISE EXCEPTION 'Hệ thống bắt buộc phải có ít nhất 1 Admin tối cao (role = admin) để duy trì! Vui lòng cấp quyền admin cho tài khoản khác trước khi xóa tài khoản này.';
    END IF;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE' AND LOWER(TRIM(OLD.role)) = 'admin' AND LOWER(TRIM(NEW.role)) <> 'admin') THEN
    SELECT COUNT(*) INTO remaining_admins
    FROM public.profiles
    WHERE LOWER(TRIM(role)) = 'admin' AND id <> OLD.id;

    IF remaining_admins < 1 THEN
      RAISE EXCEPTION 'Hệ thống bắt buộc phải có ít nhất 1 Admin tối cao (role = admin) để duy trì! Vui lòng cấp quyền admin cho tài khoản khác trước khi hạ quyền tài khoản này.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_minimum_one_admin ON public.profiles;
CREATE TRIGGER trg_ensure_minimum_one_admin
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.ensure_minimum_one_admin();

-- 3. TRIGGER TỰ ĐỘNG KHỞI TẠO PROFILE HỌC SINH KHI ĐĂNG KÝ SUPABASE AUTH MỚI (AN TOÀN TUYỆT ĐỐI)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      LOWER(TRIM(NEW.email)),
      COALESCE(
        NEW.raw_user_meta_data->>'custom_full_name',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
      ),
      CASE
        WHEN LOWER(TRIM(NEW.email)) = 'minh.ldd2610979@sis.hust.edu.vn' THEN 'admin'
        ELSE 'student'
      END
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.profiles (id, email, role)
      VALUES (
        NEW.id,
        LOWER(TRIM(NEW.email)),
        CASE
          WHEN LOWER(TRIM(NEW.email)) = 'minh.ldd2610979@sis.hust.edu.vn' THEN 'admin'
          ELSE 'student'
        END
      )
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

-- Chỉ Admin tối cao mới được nâng/hạ quyền Giáo viên trên bảng profiles (Không ai trên web được phép tự nâng lên 'admin')
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR public.is_super_admin()
  ) WITH CHECK (
    (public.is_super_admin() AND LOWER(TRIM(role)) IN ('teacher', 'student', 'admin'))
    OR (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE USING (
    public.is_super_admin()
  );

-- ==============================================================================
-- CHÍNH SÁCH BẢO MẬT (POLICIES) CHO BẢNG CLASSROOMS
-- ==============================================================================
DROP POLICY IF EXISTS "classrooms_select_policy" ON public.classrooms;
CREATE POLICY "classrooms_select_policy" ON public.classrooms
  FOR SELECT USING (
    id NOT LIKE '__system_%' OR public.is_admin()
  );

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
DROP POLICY IF EXISTS "problems_select_policy" ON public.problems;
CREATE POLICY "problems_select_policy" ON public.problems
  FOR SELECT USING (true);

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
DROP POLICY IF EXISTS "test_cases_select_policy" ON public.test_cases;
CREATE POLICY "test_cases_select_policy" ON public.test_cases
  FOR SELECT USING (true);

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
DROP POLICY IF EXISTS "submissions_select_policy" ON public.submissions;
CREATE POLICY "submissions_select_policy" ON public.submissions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "submissions_insert_policy" ON public.submissions;
CREATE POLICY "submissions_insert_policy" ON public.submissions
  FOR INSERT WITH CHECK (
    public.is_admin() OR auth.role() = 'authenticated' OR user_id = auth.uid()::text
  );

DROP POLICY IF EXISTS "submissions_update_policy" ON public.submissions;
CREATE POLICY "submissions_update_policy" ON public.submissions
  FOR UPDATE USING (
    public.is_admin()
  ) WITH CHECK (
    public.is_admin()
  );

DROP POLICY IF EXISTS "submissions_delete_policy" ON public.submissions;
CREATE POLICY "submissions_delete_policy" ON public.submissions
  FOR DELETE USING (
    public.is_admin() OR user_id = auth.uid()::text
  );

-- ==============================================================================
-- HƯỚNG DẪN THÊM HOẶC BỎ QUYỀN ADMIN TỐI CAO TRỰC TIẾP TRÊN SUPABASE:
-- ==============================================================================
-- 1. Thêm 1 tài khoản mới làm Admin tối cao:
--    UPDATE public.profiles SET role = 'admin' WHERE LOWER(TRIM(email)) = 'email_admin_moi@gmail.com';
--
-- 2. Bỏ quyền Admin tối cao của 1 tài khoản (chuyển xuống làm Giáo viên hoặc Học sinh):
--    (Lưu ý: Hệ thống bắt buộc phải còn ít nhất 1 tài khoản role = 'admin' khác thì mới hạ quyền được)
--    UPDATE public.profiles SET role = 'teacher' WHERE LOWER(TRIM(email)) = 'email_admin_cu@gmail.com';
-- ==============================================================================
