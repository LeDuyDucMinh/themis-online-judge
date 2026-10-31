import { createClient } from '@supabase/supabase-js';
import { ENV, registerAuthTokenGetter } from './apiService';

/**
 * Khởi tạo Supabase Client hỗ trợ Supabase Auth (Email/Password, OAuth Google, Session auto-refresh)
 */
export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

/**
 * Hàm biên dịch thông báo lỗi Supabase Auth sang Tiếng Việt chuẩn mực, thân thiện với người dùng
 */
export function translateAuthError(rawError?: string | null): string {
  if (!rawError) return 'Đã có lỗi xảy ra trong quá trình xác thực. Vui lòng thử lại!';

  const msg = rawError.toLowerCase();

  if (
    msg.includes('user already registered') ||
    msg.includes('already exists') ||
    msg.includes('user_already_exists') ||
    msg.includes('email already in use')
  ) {
    return 'Email này đã được đăng ký tài khoản. Vui lòng chuyển sang tab "Đăng nhập" để tiếp tục.';
  }

  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid_grant') ||
    msg.includes('invalid credentials') ||
    msg.includes('wrong password')
  ) {
    return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!';
  }

  if (
    msg.includes('password should be at least 6 characters') ||
    msg.includes('weak_password') ||
    msg.includes('password is too short') ||
    msg.includes('at least 6 characters')
  ) {
    return 'Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên.';
  }

  if (
    msg.includes('email not confirmed') ||
    msg.includes('unconfirmed') ||
    msg.includes('email_not_confirmed')
  ) {
    return 'Tài khoản chưa được kích hoạt qua email. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư Spam) để kích hoạt.';
  }

  if (
    msg.includes('unable to validate email') ||
    msg.includes('invalid email') ||
    msg.includes('invalid_email') ||
    msg.includes('email format')
  ) {
    return 'Định dạng email không hợp lệ. Vui lòng nhập đúng email (ví dụ: hocsinh@gmail.com).';
  }

  if (
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('over_email_send_rate_limit') ||
    msg.includes('over_request_rate_limit')
  ) {
    return 'Thao tác gửi yêu cầu quá nhanh. Vui lòng chờ ít giây rồi thử lại.';
  }

  if (
    msg.includes('signup requires a valid password') ||
    msg.includes('password cannot be empty')
  ) {
    return 'Vui lòng nhập mật khẩu hợp lệ (tối thiểu 6 ký tự).';
  }

  if (
    msg.includes('database error saving new user') ||
    msg.includes('error saving new user')
  ) {
    return 'Lỗi cơ sở dữ liệu Supabase khi lưu tài khoản (thiếu cột full_name trong bảng profiles). Vui lòng chạy lệnh ALTER TABLE trong Supabase SQL Editor.';
  }

  if (
    msg.includes('networkerror') ||
    msg.includes('failed to fetch') ||
    msg.includes('connection')
  ) {
    return 'Không thể kết nối đến máy chủ xác thực Supabase. Vui lòng kiểm tra lại kết nối mạng.';
  }

  // Fallback giữ lại thông điệp gốc nếu không khớp mẫu
  return rawError;
}

export type AppUserRole = 'admin' | 'teacher' | 'student';

export interface UserRoleResult {
  role: AppUserRole;
  rawRole?: string;
  source: 'profiles' | 'system_roles' | 'users' | 'metadata' | 'default';
}

function normalizeRoleValue(raw?: string | null): AppUserRole {
  const clean = String(raw || '').trim().toLowerCase();
  if (clean === 'admin' || clean === 'super_admin' || clean === 'superadmin') {
    return 'admin';
  }
  if (clean === 'teacher' || clean === 'giao_vien' || clean === 'giaovien') {
    return 'teacher';
  }
  return 'student';
}

/**
 * Lấy vai trò (role: 'admin' | 'teacher' | 'student') của người dùng từ Supabase Database.
 * - Bảng `public.profiles` trên Supabase là nguồn chân lý tối cao (cho phép thêm/bỏ Admin trực tiếp trên Supabase).
 * - Đảm bảo nguyên tắc bất biến: Hệ thống luôn duy trì ít nhất 1 Admin tối cao (mặc định: minh.ldd2610979@sis.hust.edu.vn).
 */
export async function fetchUserRoleFromSupabase(
  userId: string,
  userEmail?: string
): Promise<UserRoleResult> {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  if (!userId && !cleanEmail) {
    return { role: 'student', source: 'default' };
  }

  try {
    // 1. Truy vấn bảng 'profiles' trên Supabase
    const { data: allProfiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, role');

    // 2. Truy vấn bảng cấu hình vai trò đồng bộ '__system_user_roles__'
    let sysRolesMap: Record<string, string> = {};
    try {
      const { data: sysRow } = await supabase
        .from('classrooms')
        .select('description')
        .eq('id', '__system_user_roles__')
        .maybeSingle();
      if (sysRow?.description) {
        const parsed = JSON.parse(sysRow.description);
        if (parsed && typeof parsed === 'object') {
          sysRolesMap = parsed;
        }
      }
    } catch {}

    if (!profileErr && Array.isArray(allProfiles)) {
      const matchedProfile = allProfiles.find(
        (p) =>
          (userId && p.id === userId) ||
          (cleanEmail && p.email && String(p.email).trim().toLowerCase() === cleanEmail)
      );

      // Kiểm tra xem trên bảng profiles đã có ít nhất 1 tài khoản role = 'admin' nào chưa
      const hasAdminInProfiles = allProfiles.some(
        (p) => normalizeRoleValue(p.role) === 'admin'
      );

      if (matchedProfile && matchedProfile.role) {
        let resolvedRole = normalizeRoleValue(matchedProfile.role);

        // Nếu trong bảng profiles chưa có bất kỳ admin nào (ví dụ admin gốc chưa được đồng bộ dòng vào profiles
        // hoặc người dùng vô tình xóa hết admin khiến hệ thống mất admin duy nhất),
        // tự động bảo vệ quyền admin cho minh.ldd2610979@sis.hust.edu.vn
        if (!hasAdminInProfiles && cleanEmail === 'minh.ldd2610979@sis.hust.edu.vn') {
          resolvedRole = 'admin';
          supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', matchedProfile.id)
            .then(() => {});
        }

        return {
          role: resolvedRole,
          rawRole: matchedProfile.role,
          source: 'profiles',
        };
      }

      // Nếu tài khoản chưa có dòng trong bảng `profiles` (ví dụ minh.ldd2610979@sis.hust.edu.vn đăng nhập lần đầu)
      let fallbackRole: AppUserRole = 'student';
      if (cleanEmail && sysRolesMap[cleanEmail]) {
        fallbackRole = normalizeRoleValue(sysRolesMap[cleanEmail]);
      } else if (cleanEmail === 'minh.ldd2610979@sis.hust.edu.vn') {
        fallbackRole = 'admin';
      } else if (cleanEmail === 'leduyducminh@gmail.com') {
        fallbackRole = 'teacher';
      }

      // Tự động khởi tạo dòng trong bảng `profiles` theo UUID thực của Supabase Auth để hiển thị trên Supabase Dashboard
      if (userId && !userId.startsWith('student_')) {
        supabase
          .from('profiles')
          .upsert(
            {
              id: userId,
              email: cleanEmail || undefined,
              role: fallbackRole,
            },
            { onConflict: 'id' }
          )
          .then(() => {});
      }

      return {
        role: fallbackRole,
        rawRole: fallbackRole,
        source: 'system_roles',
      };
    }

    // Dự phòng nếu bảng profiles chưa truy cập được: dùng __system_user_roles__
    if (cleanEmail && sysRolesMap[cleanEmail]) {
      const r = normalizeRoleValue(sysRolesMap[cleanEmail]);
      return { role: r, rawRole: sysRolesMap[cleanEmail], source: 'system_roles' };
    }
    if (cleanEmail === 'minh.ldd2610979@sis.hust.edu.vn') {
      return { role: 'admin', rawRole: 'admin', source: 'system_roles' };
    }
    if (cleanEmail === 'leduyducminh@gmail.com') {
      return { role: 'teacher', rawRole: 'teacher', source: 'system_roles' };
    }
  } catch (err) {
    console.warn('[supabaseClient] Lỗi khi truy vấn vai trò (role) từ Supabase:', err);
  }

  return { role: 'student', source: 'default' };
}

let cachedAccessToken: string | null = null;

// Tự động đồng bộ JWT token khi trạng thái đăng nhập thay đổi
supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token || null;
});

/**
 * Lấy JWT access token đang hoạt động của người dùng để đính kèm vào các REST API header
 */
export function getActiveAccessToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.access_token) {
              cachedAccessToken = parsed.access_token;
              return parsed.access_token;
            }
          }
        }
      }
    } catch {}
  }
  return null;
}

// Đăng ký provider để apiService luôn gửi JWT thực tế của người dùng đã xác thực
registerAuthTokenGetter(getActiveAccessToken);
