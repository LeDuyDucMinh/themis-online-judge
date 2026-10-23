import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import {
  ShieldAlert,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  X,
  LogIn,
  AlertTriangle,
  GraduationCap,
  ShieldCheck,
  User,
  Loader2,
} from 'lucide-react';

export const AdminAuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    loginAdmin,
    loginStudent,
    isAdminAuthenticated,
    currentStudent,
    authModalTab,
    setAuthModalTab,
  } = useJudge();

  // Tab 1: Học sinh
  const [studentUsername, setStudentUsername] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  // Tab 2: Giáo viên
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);

  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Bộ đếm thời gian khóa nếu nhập sai mật khẩu admin quá 5 lần
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockCountdown > 0) {
      timer = setTimeout(() => {
        setLockCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [lockCountdown]);

  if (!isAuthModalOpen) return null;

  // Kiểm tra xem đã có ai đăng nhập chưa (để quyết định có cho phép bấm nút X đóng hay không)
  const canClose = Boolean(isAdminAuthenticated || currentStudent);

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsVerifying(true);
    try {
      const res = await loginStudent(studentUsername, studentPassword);
      if (!res.success) {
        setErrorMessage(res.message);
      } else {
        setStudentUsername('');
        setStudentPassword('');
        setErrorMessage('');
      }
    } catch {
      setErrorMessage('Đã xảy ra lỗi kết nối khi đăng nhập. Vui lòng thử lại!');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockCountdown > 0 || isVerifying) return;
    setErrorMessage('');
    setIsVerifying(true);

    try {
      const res = await loginAdmin(adminPassword);
      if (!res.success) {
        const nextFail = failedAttempts + 1;
        setFailedAttempts(nextFail);
        setErrorMessage(res.message);

        if (nextFail >= 5) {
          setLockCountdown(30);
          setErrorMessage('Nhập sai quá 5 lần. Tạm thời khóa xác thực trong 30 giây để bảo vệ hệ thống.');
        }
      } else {
        setAdminPassword('');
        setErrorMessage('');
        setFailedAttempts(0);
      }
    } catch {
      setErrorMessage('Không thể kết nối đến Database để xác thực mật khẩu Admin!');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    if (canClose) {
      setIsAuthModalOpen(false);
      setErrorMessage('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-red-500/30 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden relative">
        {/* Top Gradient Stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />

        {/* Close Button (chỉ hiện khi đã đăng nhập trước đó) */}
        {canClose && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors z-10"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header with FAMINH Logo */}
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
            {authModalTab === 'student' ? (
              <>
                <GraduationCap className="w-3.5 h-3.5 text-blue-400" /> CỔNG ĐĂNG NHẬP HỌC SINH
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5" /> KHU VỰC BẢO MẬT GIÁO VIÊN
              </>
            )}
          </div>

          <h3 className="text-xl font-extrabold text-white tracking-tight">
            {authModalTab === 'student' ? 'Đăng Nhập Luyện Thi FAMINH' : 'Xác Thực Quyền Quản Trị FAMINH'}
          </h3>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
            {authModalTab === 'student'
              ? 'Nhập Tên đăng nhập và Mật khẩu do Giáo viên cấp để bắt đầu luyện tập và nộp bài chấm điểm.'
              : 'Dành riêng cho Giáo viên / Quản trị viên để quản lý đề thi, nạp bộ test case và cấp tài khoản.'}
          </p>
        </div>

        {/* 2 Chế độ chọn (Tabs) */}
        <div className="px-6 pt-3">
          <div className="grid grid-cols-2 p-1 bg-slate-800/80 rounded-2xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => {
                setAuthModalTab('student');
                setErrorMessage('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                authModalTab === 'student'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Học sinh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthModalTab('admin');
                setErrorMessage('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                authModalTab === 'admin'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Giáo viên</span>
            </button>
          </div>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="px-6 pt-3">
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Countdown timer when admin lock triggered */}
        {authModalTab === 'admin' && lockCountdown > 0 && (
          <div className="px-6 pt-2 text-center font-mono text-xs font-bold text-amber-400">
            Vui lòng thử lại sau: {lockCountdown}s
          </div>
        )}

        {/* TAB 1: FORM HỌC SINH ĐĂNG NHẬP */}
        {authModalTab === 'student' && (
          <form onSubmit={handleStudentSubmit} className="p-6 pt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" /> Tên đăng nhập (Username):
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={studentUsername}
                  onChange={(e) => {
                    setStudentUsername(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Nhập username do giáo viên cấp..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-400" /> Mật khẩu học sinh:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showStudentPassword ? 'text' : 'password'}
                  required
                  value={studentPassword}
                  onChange={(e) => {
                    setStudentPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Nhập mật khẩu..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowStudentPassword(!showStudentPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                >
                  {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isVerifying || !studentUsername.trim() || !studentPassword.trim()}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang đăng nhập...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Đăng Nhập Luyện Tập</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-center text-slate-500 pt-1">
              Chưa có tài khoản? Vui lòng liên hệ Thầy/Cô giáo viên để được cấp tài khoản.
            </p>
          </form>
        )}

        {/* TAB 2: FORM GIÁO VIÊN (ADMIN) XÁC THỰC */}
        {authModalTab === 'admin' && (
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
                  disabled={lockCountdown > 0 || isVerifying}
                  placeholder="Nhập mật mã quản trị..."
                  autoFocus
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                >
                  {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={lockCountdown > 0 || isVerifying || !adminPassword.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang đối chiếu Database...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Mở Quyền Quản Trị Admin</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-center text-slate-500 pt-1">
              Khu vực bảo mật cao chỉ dành cho Giáo viên quản trị hệ thống FAMINH.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
