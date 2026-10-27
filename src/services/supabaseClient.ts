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
    msg.includes('networkerror') ||
    msg.includes('failed to fetch') ||
    msg.includes('connection')
  ) {
    return 'Không thể kết nối đến máy chủ xác thực Supabase. Vui lòng kiểm tra lại kết nối mạng.';
  }

  // Fallback giữ lại thông điệp gốc nếu không khớp mẫu
  return rawError;
}

export type AppUserRole = 'admin' | 'student';

export interface UserRoleResult {
  role: AppUserRole;
  rawRole?: string;
  source: 'profiles' | 'users' | 'metadata' | 'default';
}

/**
 * Lấy vai trò (role) của người dùng từ cơ sở dữ liệu Supabase sau khi đăng nhập thành công
 * 1. Truy vấn bảng `profiles` theo `id = user.id` (Cột `role`)
 * 2. Dự phòng: Truy vấn bảng `users` theo `id = user.id` (Cột `role`)
 * 3. Dự phòng: Kiểm tra `app_metadata` hoặc `user_metadata` của Supabase Auth
 */
export async function fetchUserRoleFromSupabase(
  userId: string,
  _userEmail?: string
): Promise<UserRoleResult> {
  if (!userId) {
    return { role: 'student', source: 'default' };
  }

  try {
    // 1. Kiểm tra bảng 'profiles' (Chuẩn Supabase)
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (!profileErr && profileData && profileData.role) {
      const cleanRole = String(profileData.role).trim().toLowerCase();
      if (cleanRole === 'admin' || cleanRole === 'teacher' || cleanRole === 'giao_vien') {
        return { role: 'admin', rawRole: profileData.role, source: 'profiles' };
      }
      return { role: 'student', rawRole: profileData.role, source: 'profiles' };
    }

    // 2. Dự phòng: Kiểm tra bảng 'users' (Nếu người dùng đặt tên bảng là users)
    const { data: userData, error: userErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (!userErr && userData && userData.role) {
      const cleanRole = String(userData.role).trim().toLowerCase();
      if (cleanRole === 'admin' || cleanRole === 'teacher' || cleanRole === 'giao_vien') {
        return { role: 'admin', rawRole: userData.role, source: 'users' };
      }
      return { role: 'student', rawRole: userData.role, source: 'users' };
    }

    // 3. Dự phòng: Kiểm tra user metadata trong Supabase Auth
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData?.user;
    if (currentUser && currentUser.id === userId) {
      const metaRole = String(
        currentUser.app_metadata?.role || currentUser.user_metadata?.role || ''
      ).trim().toLowerCase();
      if (metaRole === 'admin' || metaRole === 'teacher') {
        return { role: 'admin', rawRole: metaRole, source: 'metadata' };
      }
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
