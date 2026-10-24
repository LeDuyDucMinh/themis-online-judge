import { createClient } from '@supabase/supabase-js';
import { ENV } from './apiService';

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
