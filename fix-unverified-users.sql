-- ==============================================================================
-- BẢN SỬA LỖI: CHỈ LƯU TÀI KHOẢN ĐÃ XÁC THỰC EMAIL VÀO HỆ THỐNG FAMINH
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán toàn bộ mã này và nhấn "Run"
-- ==============================================================================

-- 1. CẬP NHẬT HÀM HANDLE_NEW_USER ĐỂ CHỈ TẠO PROFILE CHO TÀI KHOẢN ĐÃ XÁC THỰC EMAIL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Nếu tài khoản chưa xác thực email (email_confirmed_at IS NULL), KHÔNG tạo profile trong hệ thống!
  -- (Đối với Google OAuth, email_confirmed_at được Supabase tự động điền ngay khi tạo)
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

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
        WHEN LOWER(TRIM(NEW.email)) = 'leduyducminh@gmail.com' THEN 'teacher'
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
          WHEN LOWER(TRIM(NEW.email)) = 'leduyducminh@gmail.com' THEN 'teacher'
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

-- 2. KÍCH HOẠT TRIGGER CẢ KHI INSERT VÀ KHI UPDATE EMAIL_CONFIRMED_AT
-- Khi học sinh vừa mở hòm thư email và nhấn link xác thực, trigger sẽ tự động kích hoạt tạo profile!
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. CẤP QUYỀN CHO GIÁO VIÊN / ADMIN XÓA TÀI KHOẢN TRÊN PROFILES
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE USING (
    public.is_admin()
  );

-- 4. DỌN DẸP TOÀN BỘ CÁC TÀI KHOẢN RÁC / CHƯA XÁC THỰC EMAIL ĐANG CÒN DÍNH TRONG PROFILES
DELETE FROM public.profiles
WHERE id IN (
  SELECT id FROM auth.users WHERE email_confirmed_at IS NULL
);

