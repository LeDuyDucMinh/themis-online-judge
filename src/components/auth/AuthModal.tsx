import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { supabase, translateAuthError } from '../../services/supabaseClient';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  X,
  Loader2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  KeyRound,
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    isAuthLoading,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isAdminAuthenticated,
    currentStudent,
    setCurrentStudent,
    loginAdmin,
    showToast,
    setActiveClassId,
    setRole,
    authModalTab,
  } = useJudge();

  // Chế độ xác thực: 'login' (Đăng nhập) | 'register' (Đăng ký) | 'admin' (Giáo viên quản trị)
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'admin'>('login');

  // Fields: Đăng nhập & Đăng ký
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Field: Giáo viên
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Đồng bộ tab khi modal được mở ra từ Navbar
  useEffect(() => {
    if (isAuthModalOpen) {
      if (authModalTab === 'admin') {
        setActiveTab('admin');
      } else {
        setActiveTab('login');
      }
      setErrorMessage('');
    }
  }, [isAuthModalOpen, authModalTab]);

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
   * Định tuyến tự động về Dashboard lớp học sau khi đăng nhập / đăng ký thành công
   */
  const handleRedirectToDashboard = (studentName?: string) => {
    setIsAuthModalOpen(false);
    setActiveClassId(null);
    setErrorMessage('');
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      window.history.pushState({}, '', '/');
    }
    if (studentName) {
      showToast(
        'Đăng nhập thành công',
        `Chào mừng ${studentName} đến với FAMINH Online Judge!`,
        'success'
      );
    }
  };

  /**
   * Xử lý ĐĂNG NHẬP BẰNG GOOGLE (OAuth)
   */
  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setIsGoogleLoading(true);
    try {
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
        // Nếu hệ thống Supabase trả về session ngay lập tức (không bắt buộc email confirmation)
        if (data.session) {
          const student = {
            id: data.user.id,
            fullName: cleanName,
            username: cleanEmail,
            email: cleanEmail,
            password: '',
            createdAt: data.user.created_at || new Date().toISOString(),
          };
          setCurrentStudent(student);
          setRole('USER');
          handleRedirectToDashboard(cleanName);
        } else {
          // Trường hợp Supabase dự án bật chế độ "Confirm email"
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
   * Xử lý TAB ĐĂNG NHẬP (Email/Password)
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
        const studentFullName =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          cleanEmail.split('@')[0] ||
          'Học sinh';

        const student = {
          id: data.user.id,
          fullName: studentFullName,
          username: cleanEmail,
          email: cleanEmail,
          password: '',
          createdAt: data.user.created_at || new Date().toISOString(),
        };

        setCurrentStudent(student);
        setRole('USER');
        handleRedirectToDashboard(studentFullName);
      }
    } catch (err: any) {
      const viMsg = translateAuthError(err?.message);
      setErrorMessage(viMsg);
      showToast('Lỗi đăng nhập', viMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Xử lý TAB GIÁO VIÊN (Quản trị viên với Passcode)
   */
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim() || isSubmitting) return;

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const res = await loginAdmin(adminPassword);
      if (!res.success) {
        setErrorMessage(res.message);
        showToast('Lỗi xác thực', res.message, 'error');
      } else {
        setAdminPassword('');
        setErrorMessage('');
        setIsAuthModalOpen(false);
        setActiveClassId(null);
        if (typeof window !== 'undefined' && window.location.pathname === '/login') {
          window.history.pushState({}, '', '/');
        }
      }
    } catch {
      setErrorMessage('Không thể kết nối đến Database để xác thực quyền Quản trị.');
      showToast('Lỗi kết nối', 'Không thể xác thực quyền Quản trị lúc này.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-slate-900 border border-red-500/30 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden relative text-white my-auto">
        {/* Dải gradient viền trên đầu thẻ */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />

        {/* Nút Đóng (chỉ xuất hiện khi người dùng đã có phiên trước đó) */}
        {canClose && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors z-10 cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Logo FAMINH & Tiêu đề */}
        <div className="p-6 pb-2 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl p-1 bg-gradient-to-tr from-red-600 to-rose-400 shadow-xl shadow-red-600/30 flex items-center justify-center">
            <img
              src="/faminh-logo.jpg"
              alt="FAMINH Logo"
              className="w-full h-full object-cover rounded-xl"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 mb-2 uppercase tracking-wide">
            {activeTab === 'admin' ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-red-400" /> KHU VỰC BẢO MẬT GIÁO VIÊN
              </>
            ) : (
              <>
                <GraduationCap className="w-3.5 h-3.5 text-blue-400" /> CỔNG XÁC THỰC FAMINH JUDGE
              </>
            )}
          </div>

          <h3 className="text-xl font-extrabold text-white tracking-tight">
            {activeTab === 'login'
              ? 'Đăng Nhập FAMINH JUDGE'
              : activeTab === 'register'
              ? 'Tạo Tài Khoản Học Sinh'
              : 'Xác Thực Quyền Giáo Viên'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
            {activeTab === 'login'
              ? 'Chào mừng bạn quay trở lại! Đăng nhập để tiếp tục làm bài và nộp code.'
              : activeTab === 'register'
              ? 'Đăng ký tài khoản để tham gia các lớp học và chấm bài tự động Themis.'
              : 'Dành riêng cho Giáo viên / Quản trị viên để quản lý đề thi và lớp học.'}
          </p>
        </div>

        {/* Cơ chế Tabs chuyển đổi qua lại giữa 'Đăng nhập' và 'Đăng ký' */}
        {activeTab !== 'admin' && (
          <div className="px-6 pt-3">
            <div className="grid grid-cols-2 p-1 bg-slate-800/80 rounded-2xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMessage('');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span>Đăng nhập</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMessage('');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Đăng ký</span>
              </button>
            </div>
          </div>
        )}

        {/* Thông báo lỗi nếu có */}
        {errorMessage && (
          <div className="px-6 pt-3">
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: FORM ĐĂNG NHẬP (Email & Mật khẩu)                  */}
        {/* ======================================================== */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="p-6 pt-4 space-y-3.5">
            {/* Input: Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-rose-400" /> Email:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Nhập địa chỉ email của bạn..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-sans"
                />
              </div>
            </div>

            {/* Input: Mật khẩu */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-400" /> Mật khẩu:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Nhập mật khẩu..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Nút Submit: 'Đăng nhập ->' */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting || !email.trim() || !password}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang đăng nhập...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng nhập</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Dòng chữ 'HOẶC' phân cách & Nút Google */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-slate-700/80 w-full" />
              <span className="bg-slate-900 px-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest absolute">
                HOẶC
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isSubmitting}
              className="w-full bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 font-semibold text-xs rounded-xl flex items-center justify-center gap-2.5 py-2.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isGoogleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              )}
              <span>Tiếp tục với Google</span>
            </button>

            {/* Liên kết phụ sang Giáo viên */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('admin');
                  setErrorMessage('');
                }}
                className="text-[11px] text-slate-400 hover:text-red-400 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <ShieldCheck className="w-3 h-3 text-red-400" />
                <span>Khu vực Giáo viên quản trị? Nhập mã tại đây</span>
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 2: FORM ĐĂNG KÝ (Họ tên, Email, Password, Confirm)   */}
        {/* ======================================================== */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="p-6 pt-4 space-y-3">
            {/* Input: Họ và tên (Icon user) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-rose-400" /> Họ và tên:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Ví dụ: Nguyễn Văn An..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-sans"
                />
              </div>
            </div>

            {/* Input: Email (Icon mail) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-rose-400" /> Email:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Địa chỉ email cá nhân..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-sans"
                />
              </div>
            </div>

            {/* Input: Mật khẩu (Icon lock, tối thiểu 6 ký tự) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-400" /> Mật khẩu (tối thiểu 6 ký tự):
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Tối thiểu 6 ký tự..."
                  className="w-full pl-10 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Input: Xác nhận mật khẩu */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-400" /> Xác nhận mật khẩu:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Nhập lại mật khẩu..."
                  className="w-full pl-10 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Nút Submit: 'Tạo tài khoản ->' */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting || !fullName.trim() || !email.trim() || !password || !confirmPassword}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tạo tài khoản...</span>
                  </>
                ) : (
                  <>
                    <span>Tạo tài khoản</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Dòng chữ 'HOẶC' phân cách & Nút Google */}
            <div className="relative my-3 flex items-center justify-center">
              <div className="border-t border-slate-700/80 w-full" />
              <span className="bg-slate-900 px-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest absolute">
                HOẶC
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isSubmitting}
              className="w-full bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 font-semibold text-xs rounded-xl flex items-center justify-center gap-2.5 py-2.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isGoogleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              )}
              <span>Tiếp tục với Google</span>
            </button>

            {/* Liên kết phụ sang Giáo viên */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('admin');
                  setErrorMessage('');
                }}
                className="text-[11px] text-slate-400 hover:text-red-400 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <ShieldCheck className="w-3 h-3 text-red-400" />
                <span>Khu vực Giáo viên quản trị? Nhập mã tại đây</span>
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 3: FORM GIÁO VIÊN QUẢN TRỊ (ADMIN PASSCODE)          */}
        {/* ======================================================== */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="p-6 pt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-red-400" /> Mật mã Quản trị viên (Admin Passcode):
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  required
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  disabled={isSubmitting}
                  placeholder="Nhập mật mã quản trị..."
                  autoFocus
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                >
                  {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !adminPassword.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang kiểm tra mật mã...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Mở Quyền Quản Trị</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMessage('');
                }}
                className="text-[11px] text-blue-400 hover:underline transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowRight className="w-3 h-3 rotate-180" />
                <span>Quay lại Cổng đăng nhập Học sinh</span>
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};
