import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { supabase, translateAuthError, fetchUserRoleFromSupabase } from '../../services/supabaseClient';
import { apiService } from '../../services/apiService';
import { storageService, resolveStudentFullName } from '../../services/storageService';
import { Eye, EyeOff, X, Loader2, AlertTriangle } from 'lucide-react';

// ---- Hằng số giao diện (thuần trình bày, không chứa logic) ----
const DISPLAY_FONT: React.CSSProperties = {
  fontFamily: "'Bricolage Grotesque', 'Inter', system-ui, sans-serif",
};

const LABEL_CLASS = 'mb-1.5 block text-[13px] font-medium text-stone-300';

const INPUT_CLASS =
  'h-11 w-full rounded-lg border border-white/15 bg-[#0d0c0a] px-3.5 text-sm text-stone-100 placeholder:text-stone-600 transition-colors focus:border-[#e5322d] focus:outline-none focus:ring-1 focus:ring-[#e5322d]';

const PRIMARY_BUTTON_CLASS =
  'flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#e5322d] text-sm font-semibold text-white transition-colors hover:bg-[#f04a44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5322d] disabled:cursor-not-allowed disabled:opacity-40';

const GOOGLE_BUTTON_CLASS =
  'flex h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-white/15 bg-transparent text-sm font-medium text-stone-100 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:cursor-not-allowed disabled:opacity-50';

const GoogleMark: React.FC = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const AuthModal: React.FC = () => {
  const {
    isAuthLoading,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isAdminAuthenticated,
    currentStudent,
    setCurrentStudent,
    setIsAdminAuthenticated,
    showToast,
    setActiveClassId,
    setRole,
  } = useJudge();

  // Chế độ xác thực: 'login' (Đăng nhập) | 'register' (Đăng ký)
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Fields: Đăng nhập & Đăng ký
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Reset về tab đăng nhập khi mở modal
  useEffect(() => {
    if (isAuthModalOpen) {
      setActiveTab('login');
      setErrorMessage('');
    }
  }, [isAuthModalOpen]);

  // Kiểm tra có đang ở trang /login hoặc cần mở modal
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      setIsAuthModalOpen(true);
    }
  }, [setIsAuthModalOpen]);

  // Tuyệt đối không hiển thị modal khi phiên xác thực đang trong quá trình tải
  if (isAuthLoading || !isAuthModalOpen) return null;

  // Cho phép đóng modal nếu người dùng đã có phiên đăng nhập trước đó
  const canClose = Boolean(isAdminAuthenticated || currentStudent);

  const handleClose = () => {
    if (canClose) {
      setIsAuthModalOpen(false);
      setErrorMessage('');
      if (typeof window !== 'undefined' && window.location.pathname === '/login') {
        window.history.pushState({}, '', '/');
      }
    }
  };

  /**
   * Xử lý ĐĂNG NHẬP BẰNG GOOGLE (OAuth)
   */
  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setIsGoogleLoading(true);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('faminh_pending_google_oauth_login', 'true');
        localStorage.setItem('faminh_pending_google_oauth_login', 'true');
      }
      const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        const viMsg = translateAuthError(error.message);
        setErrorMessage(viMsg);
        showToast('Lỗi xác thực Google', viMsg, 'error');
      }
    } catch (err: any) {
      const viMsg = translateAuthError(err?.message);
      setErrorMessage(viMsg);
      showToast('Lỗi xác thực Google', viMsg, 'error');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  /**
   * Xử lý TAB ĐĂNG KÝ (Email/Password với Họ và tên)
   */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setErrorMessage('Vui lòng nhập Họ và tên của bạn.');
      showToast('Lỗi đăng ký', 'Vui lòng nhập Họ và tên của bạn.', 'error');
      return;
    }

    if (!cleanEmail) {
      setErrorMessage('Vui lòng nhập địa chỉ email hợp lệ.');
      showToast('Lỗi đăng ký', 'Vui lòng nhập địa chỉ email hợp lệ.', 'error');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên.');
      showToast('Mật khẩu quá ngắn', 'Mật khẩu phải có tối thiểu 6 ký tự để bảo vệ tài khoản.', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại!');
      showToast('Mật khẩu không khớp', 'Mật khẩu và Xác nhận mật khẩu không giống nhau.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanName,
          },
        },
      });

      if (error) {
        const viMsg = translateAuthError(error.message);
        setErrorMessage(viMsg);
        showToast('Lỗi tạo tài khoản', viMsg, 'error');
        return;
      }

      if (data.user) {
        if (data.session) {
          const roleRes = await fetchUserRoleFromSupabase(data.user.id, cleanEmail);

          if (roleRes.role === 'admin') {
            setIsAdminAuthenticated(true);
            setRole('ADMIN');
            storageService.setAdminSessionActive(true);
            setCurrentStudent(null);
            setIsAuthModalOpen(false);
            setActiveClassId(null);
            setErrorMessage('');

            if (typeof window !== 'undefined') {
              window.location.hash = '#admin/classes';
              window.history.pushState({}, '', '/#admin/classes');
            }

            showToast(
              'Đăng ký Quản trị viên',
              `Chào mừng Quản trị viên ${cleanName}! Đã chuyển đến Dashboard Quản trị.`,
              'success'
            );
          } else {
            const student = {
              id: data.user.id,
              fullName: cleanName,
              username: cleanEmail,
              email: cleanEmail,
              password: '',
              createdAt: data.user.created_at || new Date().toISOString(),
            };
            apiService.saveStudents([student]).catch(() => {});
            setCurrentStudent(student);
            storageService.setStudentSession(student);
            setIsAdminAuthenticated(false);
            setRole('USER');
            storageService.setAdminSessionActive(false);
            setIsAuthModalOpen(false);
            setActiveClassId(null);
            setErrorMessage('');

            if (typeof window !== 'undefined') {
              window.location.hash = '#classes';
              window.history.pushState({}, '', '/#classes');
            }

            showToast(
              'Tạo tài khoản thành công',
              `Chào mừng ${cleanName} đến với FAMINH Online Judge!`,
              'success'
            );
          }
        } else {
          showToast(
            'Tạo tài khoản thành công',
            `Chào mừng ${cleanName}! Vui lòng kiểm tra email "${cleanEmail}" để hoàn tất xác thực hoặc đăng nhập.`,
            'success'
          );
          setActiveTab('login');
          setErrorMessage('');
        }
      }
    } catch (err: any) {
      const viMsg = translateAuthError(err?.message);
      setErrorMessage(viMsg);
      showToast('Lỗi hệ thống', viMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Xử lý TAB ĐĂNG NHẬP (Email/Password chung cho CẢ Giáo viên và Học sinh)
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      showToast('Thiếu thông tin', 'Vui lòng nhập đầy đủ Email và Mật khẩu để đăng nhập.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (error) {
        const viMsg = translateAuthError(error.message);
        setErrorMessage(viMsg);
        showToast('Đăng nhập thất bại', viMsg, 'error');
        return;
      }

      if (data.user && data.session) {
        const userFullName = resolveStudentFullName(
          data.user.id,
          cleanEmail,
          data.user.user_metadata?.custom_full_name ||
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name
        );

        // Lấy user.id để query vào bảng chứa thông tin người dùng (profiles / users) lấy giá trị của cột role
        const roleRes = await fetchUserRoleFromSupabase(data.user.id, cleanEmail);

        if (roleRes.role === 'admin') {
          // =========================================================================
          // NẾU ROLE === 'ADMIN': Router.push thẳng vào giao diện Quản trị viên
          // =========================================================================
          setIsAdminAuthenticated(true);
          setRole('ADMIN');
          storageService.setAdminSessionActive(true);
          setCurrentStudent(null);
          setIsAuthModalOpen(false);
          setActiveClassId(null);
          setErrorMessage('');

          if (typeof window !== 'undefined') {
            window.location.hash = '#admin/classes';
            window.history.pushState({}, '', '/#admin/classes');
          }

          showToast(
            'Quản trị viên',
            `Chào mừng Quản trị viên ${userFullName}! Đã chuyển đến Dashboard Quản trị.`,
            'success'
          );
        } else {
          // =========================================================================
          // NẾU ROLE LÀ 'STUDENT', NULL HOẶC KHÁC: Router.push về không gian Học sinh
          // =========================================================================
          const student = {
            id: data.user.id,
            fullName: userFullName,
            username: cleanEmail,
            email: cleanEmail,
            password: '',
            createdAt: data.user.created_at || new Date().toISOString(),
          };

          apiService.saveStudents([student]).catch(() => {});
          setCurrentStudent(student);
          storageService.setStudentSession(student);
          setIsAdminAuthenticated(false);
          setRole('USER');
          storageService.setAdminSessionActive(false);
          setIsAuthModalOpen(false);
          setActiveClassId(null);
          setErrorMessage('');

          if (typeof window !== 'undefined') {
            window.location.hash = '#classes';
            window.history.pushState({}, '', '/#classes');
          }

          showToast(
            'Đăng nhập thành công',
            `Chào mừng ${userFullName} đến với FAMINH Online Judge!`,
            'success'
          );
        }
      }
    } catch (err: any) {
      const viMsg = translateAuthError(err?.message);
      setErrorMessage(viMsg);
      showToast('Lỗi đăng nhập', viMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0908]/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-heading"
          className="relative my-auto grid w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-[#13110e] text-stone-100 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] md:grid-cols-[1.05fr_1fr]"
        >
          {/* ===================== CỘT TRÁI: THƯƠNG HIỆU ===================== */}
          <aside className="relative hidden flex-col justify-between border-r border-white/10 bg-[#0d0b09] p-10 md:flex">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-[#1a1713]">
                <img
                  src="/faminh-logo.jpg"
                  alt="FAMINH Logo"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <span style={DISPLAY_FONT} className="text-lg font-semibold tracking-tight text-stone-100">
                FAMINH <span className="text-[#e5322d]">Judge</span>
              </span>
            </div>

            <div>
              <p
                style={DISPLAY_FONT}
                className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-stone-50"
              >
                Nộp code.
                <br />
                Xem điểm
                <br />
                từng test.
              </p>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-stone-400">
                Chấm tự động theo chuẩn Themis. Kết quả hiển thị ngay sau mỗi lần nộp bài.
              </p>
            </div>

            {/* Minh hoạ bảng chấm (trang trí, không phải dữ liệu thật) */}
            <div aria-hidden="true" className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
              <div className="border-b border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-stone-500">
                Ví dụ bảng chấm
              </div>
              <div className="divide-y divide-white/5 font-mono text-[12px]">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-stone-400">Test 01</span>
                  <span className="text-emerald-400">AC</span>
                  <span className="text-stone-500">0.004s</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-stone-400">Test 02</span>
                  <span className="text-emerald-400">AC</span>
                  <span className="text-stone-500">0.006s</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-stone-400">Test 03</span>
                  <span className="text-[#ff6b63]">WA</span>
                  <span className="text-stone-500">0.005s</span>
                </div>
              </div>
            </div>
          </aside>

          {/* ===================== CỘT PHẢI: BIỂU MẪU ===================== */}
          <div className="relative flex flex-col p-6 sm:p-10">
            {/* Nút Đóng (chỉ xuất hiện khi người dùng đã có phiên trước đó) */}
            {canClose && (
              <button
                onClick={handleClose}
                className="absolute right-4 top-4 z-10 cursor-pointer rounded-lg p-2 text-stone-500 transition-colors hover:bg-white/5 hover:text-stone-100 focus-visible:outline-2 focus-visible:outline-[#e5322d]"
                title="Đóng cửa sổ"
                aria-label="Đóng cửa sổ"
              >
                <X className="h-5 w-5" />
              </button>
            )}

            {/* Thương hiệu rút gọn cho màn hình nhỏ */}
            <div className="mb-8 flex items-center gap-2.5 md:hidden">
              <div className="h-8 w-8 overflow-hidden rounded-md border border-white/10 bg-[#1a1713]">
                <img
                  src="/faminh-logo.jpg"
                  alt="FAMINH Logo"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <span style={DISPLAY_FONT} className="text-base font-semibold tracking-tight">
                FAMINH <span className="text-[#e5322d]">Judge</span>
              </span>
            </div>

            {/* Cơ chế Tabs chuyển đổi qua lại giữa 'Đăng nhập' và 'Đăng ký' */}
            <div role="tablist" className="mb-8 flex gap-7 border-b border-white/10">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'login'}
                onClick={() => {
                  setActiveTab('login');
                  setErrorMessage('');
                }}
                className={`-mb-px cursor-pointer border-b-2 pb-3 text-sm font-semibold transition-colors ${
                  activeTab === 'login'
                    ? 'border-[#e5322d] text-stone-50'
                    : 'border-transparent text-stone-500 hover:text-stone-200'
                }`}
              >
                Đăng nhập
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'register'}
                onClick={() => {
                  setActiveTab('register');
                  setErrorMessage('');
                }}
                className={`-mb-px cursor-pointer border-b-2 pb-3 text-sm font-semibold transition-colors ${
                  activeTab === 'register'
                    ? 'border-[#e5322d] text-stone-50'
                    : 'border-transparent text-stone-500 hover:text-stone-200'
                }`}
              >
                Đăng ký
              </button>
            </div>

            <h2
              id="auth-heading"
              style={DISPLAY_FONT}
              className="text-2xl font-semibold tracking-tight text-stone-50"
            >
              {activeTab === 'login' ? 'Đăng Nhập FAMINH JUDGE' : 'Tạo Tài Khoản FAMINH JUDGE'}
            </h2>
            <p className="mb-7 mt-2 max-w-sm text-sm leading-relaxed text-stone-400">
              {activeTab === 'login'
                ? 'Chào mừng bạn quay trở lại! Đăng nhập để truy cập không gian lớp học và nộp bài.'
                : 'Đăng ký tài khoản để tham gia các lớp học và chấm bài tự động Themis.'}
            </p>

            {/* Thông báo lỗi nếu có */}
            {errorMessage && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-[#e5322d]/40 bg-[#e5322d]/10 px-3.5 py-3 text-sm text-red-200 animate-in fade-in"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6b63]" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 1: FORM ĐĂNG NHẬP CHUNG (Email & Mật khẩu)            */}
            {/* ======================================================== */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Input: Email */}
                <div>
                  <label htmlFor="auth-login-email" className={LABEL_CLASS}>
                    Email
                  </label>
                  <input
                    id="auth-login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="Nhập địa chỉ email của bạn..."
                    autoFocus
                    className={INPUT_CLASS}
                  />
                </div>

                {/* Input: Password */}
                <div>
                  <label htmlFor="auth-login-password" className={LABEL_CLASS}>
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <input
                      id="auth-login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMessage('');
                      }}
                      placeholder="Nhập mật khẩu..."
                      className={`${INPUT_CLASS} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3.5 text-stone-500 transition-colors hover:text-stone-100"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Nút Submit Đăng nhập */}
                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim() || !password}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang kiểm tra thông tin...</span>
                    </>
                  ) : (
                    <>
                      <span>Đăng Nhập Hệ Thống</span>
                    </>
                  )}
                </button>

                {/* Dòng chữ 'HOẶC' phân cách & Nút Google */}
                <div className="flex items-center gap-4 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-600">
                  <span className="h-px flex-1 bg-white/10" />
                  Hoặc
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isSubmitting}
                  className={GOOGLE_BUTTON_CLASS}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
                  ) : (
                    <GoogleMark />
                  )}
                  <span>Tiếp tục với Google</span>
                </button>
              </form>
            )}

            {/* ======================================================== */}
            {/* TAB 2: FORM ĐĂNG KÝ (Họ tên, Email, Password, Confirm)   */}
            {/* ======================================================== */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Input: Họ và tên */}
                <div>
                  <label htmlFor="auth-register-name" className={LABEL_CLASS}>
                    Họ và tên
                  </label>
                  <input
                    id="auth-register-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="Ví dụ: Nguyễn Văn An..."
                    autoFocus
                    className={INPUT_CLASS}
                  />
                </div>

                {/* Input: Email */}
                <div>
                  <label htmlFor="auth-register-email" className={LABEL_CLASS}>
                    Email
                  </label>
                  <input
                    id="auth-register-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="Nhập email của bạn..."
                    className={INPUT_CLASS}
                  />
                </div>

                {/* Input: Mật khẩu */}
                <div>
                  <label htmlFor="auth-register-password" className={LABEL_CLASS}>
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <input
                      id="auth-register-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMessage('');
                      }}
                      placeholder="Tối thiểu 6 ký tự..."
                      className={`${INPUT_CLASS} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3.5 text-stone-500 transition-colors hover:text-stone-100"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Input: Xác nhận Mật khẩu */}
                <div>
                  <label htmlFor="auth-register-confirm" className={LABEL_CLASS}>
                    Xác nhận mật khẩu
                  </label>
                  <div className="relative">
                    <input
                      id="auth-register-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setErrorMessage('');
                      }}
                      placeholder="Nhập lại mật khẩu..."
                      className={`${INPUT_CLASS} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3.5 text-stone-500 transition-colors hover:text-stone-100"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Nút Tạo tài khoản */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting || !fullName.trim() || !email.trim() || !password}
                    className={PRIMARY_BUTTON_CLASS}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Đang tạo tài khoản...</span>
                      </>
                    ) : (
                      <>
                        <span>Đăng Ký Tài Khoản</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Dòng chữ 'HOẶC' phân cách & Nút Google */}
                <div className="flex items-center gap-4 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-600">
                  <span className="h-px flex-1 bg-white/10" />
                  Hoặc
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isSubmitting}
                  className={GOOGLE_BUTTON_CLASS}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
                  ) : (
                    <GoogleMark />
                  )}
                  <span>Tiếp tục với Google</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
