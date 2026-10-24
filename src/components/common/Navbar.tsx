import React from 'react';
import { useJudge } from '../../context/JudgeContext';
import {
  Code2,
  ShieldCheck,
  Lock,
  LogOut,
  KeyRound,
  RotateCcw,
  Trophy,
  ListTree,
  Sun,
  Moon,
  Users,
  GraduationCap,
  LogIn,
  Server,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'classes' | 'problems' | 'admin_classes' | 'admin_topics' | 'submissions';
  setCurrentTab: (tab: 'classes' | 'problems' | 'admin_classes' | 'admin_topics' | 'submissions') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const {
    isAdminAuthenticated,
    isAuthLoading,
    currentStudent,
    logoutStudent,
    setIsStudentModalOpen,
    setAuthModalTab,
    setIsAuthModalOpen,
    setIsChangePasswordModalOpen,
    setIsServerConfigModalOpen,
    logoutAdmin,
    resetAllData,
    theme,
    toggleTheme,
    openConfirmModal,
    activeClass,
    setActiveClassId,
  } = useJudge();

  const handleResetConfirm = () => {
    openConfirmModal({
      title: 'Khôi phục dữ liệu mẫu',
      message: 'Bạn có chắc chắn muốn khôi phục lại toàn bộ dữ liệu bài tập và bộ test case mặc định ban đầu của FAMINH?',
      confirmLabel: 'Khôi phục',
      onConfirm: () => resetAllData(),
    });
  };

  const handleBrandClick = () => {
    setActiveClassId(null);
    if (isAdminAuthenticated) {
      setCurrentTab('admin_classes');
    } else {
      setCurrentTab('classes');
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo FAMINH */}
        <div
          onClick={handleBrandClick}
          className="flex items-center gap-3 cursor-pointer group"
          title="Trang chủ FAMINH Online Judge"
        >
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-red-500/30 overflow-hidden shadow-lg shadow-red-500/10 flex items-center justify-center p-0.5 group-hover:scale-105 transition-transform">
            <img
              src="/faminh-logo.jpg"
              alt="FAMINH Logo"
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-wider text-red-600 dark:text-red-500">
                FAMINH
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/20 dark:border-red-500/30 uppercase tracking-wide">
                JUDGE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {activeClass ? (
                <span className="text-red-400 font-semibold flex items-center gap-1">
                  <span>Lớp:</span>
                  <span className="truncate max-w-[150px]">{activeClass.className}</span>
                </span>
              ) : (
                'Hệ thống luyện thi & Chấm bài tự động Themis'
              )}
            </p>
          </div>
        </div>

        {/* Navigation Tabs based on Role */}
        <div className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          {/* HỌC SINH: Tab Lớp học của tôi */}
          {!isAdminAuthenticated && (
            <button
              onClick={() => {
                setCurrentTab('classes');
                setActiveClassId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'classes' && !activeClass
                  ? 'bg-red-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-red-400" />
              <span>Lớp học của tôi</span>
            </button>
          )}

          {/* HỌC SINH: Tab Luyện tập khi đang ở trong một lớp */}
          {!isAdminAuthenticated && activeClass && (
            <button
              onClick={() => setCurrentTab('classes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'classes' && activeClass
                  ? 'bg-red-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Bài tập lớp</span>
            </button>
          )}

          {/* GIÁO VIÊN: Tab Quản lý Lớp học (Mặc định) */}
          {isAdminAuthenticated && (
            <button
              onClick={() => {
                setCurrentTab('admin_classes');
                setActiveClassId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'admin_classes' && !activeClass
                  ? 'bg-red-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-red-400" />
              <span>Quản lý Lớp học</span>
            </button>
          )}

          {/* GIÁO VIÊN: Tab Chi tiết lớp khi đang chọn lớp */}
          {isAdminAuthenticated && activeClass && (
            <button
              onClick={() => setCurrentTab('admin_classes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'admin_classes' && activeClass
                  ? 'bg-red-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <ListTree className="w-4 h-4" />
              <span>{activeClass.className}</span>
            </button>
          )}

          {/* GIÁO VIÊN: Tab Quản lý Chủ đề chung */}
          {isAdminAuthenticated && (
            <button
              onClick={() => {
                setCurrentTab('admin_topics');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'admin_topics'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <ListTree className="w-4 h-4" />
              <span>Quản lý Chủ đề</span>
            </button>
          )}

          {/* Tab Lịch sử nộp bài */}
          <button
            onClick={() => setCurrentTab('submissions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
              currentTab === 'submissions'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Lịch sử nộp bài</span>
          </button>
        </div>


        {/* Theme Toggle & Role Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* NÚT CHUYỂN NỀN SÁNG / TỐI Ở GÓC PHẢI MÀN HÌNH */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors flex items-center justify-center cursor-pointer shadow-sm"
            title={theme === 'dark' ? 'Chuyển sang chế độ Nền Sáng' : 'Chuyển sang chế độ Nền Tối'}
            aria-label="Chuyển chế độ sáng tối"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          {/* ROLE & AUTHENTICATION ACTIONS */}
          {isAdminAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 text-red-300 border border-red-500/30 text-xs font-bold shadow-sm">
                <ShieldCheck className="w-4 h-4 text-red-400" />
                <span className="hidden sm:inline">GIÁO VIÊN (ADMIN)</span>
              </div>

              {/* Nút Quản lý Học sinh dành riêng cho Giáo viên */}
              <button
                onClick={() => setIsStudentModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                title="Quản lý và cấp tài khoản học sinh"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden lg:inline">Quản lý Học sinh</span>
              </button>

              {/* Nút Cấu hình Máy chủ Chấm bài VPS */}
              <button
                onClick={() => setIsServerConfigModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                title="Cấu hình Máy chủ Chấm bài VPS (Judge0)"
              >
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden lg:inline">Server Chấm VPS</span>
              </button>


              {/* Đổi mật khẩu */}
              <button
                onClick={() => setIsChangePasswordModalOpen(true)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                title="Đổi mật mã Admin"
              >
                <KeyRound className="w-4 h-4" />
              </button>

              {/* Khôi phục mẫu */}
              <button
                onClick={handleResetConfirm}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                title="Khôi phục lại dữ liệu mẫu"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Đăng xuất Admin */}
              <button
                onClick={() => {
                  logoutAdmin();
                  setCurrentTab('problems');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-rose-300 border border-rose-900/50 hover:border-rose-700 text-xs font-semibold transition-all cursor-pointer"
                title="Đăng xuất quyền Admin"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          ) : currentStudent ? (
            /* Khi Học sinh đã đăng nhập */
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/15 text-blue-300 border border-blue-500/30 text-xs font-bold shadow-sm">
                <GraduationCap className="w-4 h-4 text-blue-400" />
                <span className="max-w-[130px] truncate" title={currentStudent.fullName}>
                  {currentStudent.fullName}
                </span>
              </div>

              {/* Nút Đăng xuất Học sinh */}
              <button
                onClick={() => logoutStudent()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-medium transition-all cursor-pointer"
                title="Đăng xuất tài khoản học sinh"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thoát</span>
              </button>

              {/* Nút chuyển sang đăng nhập Giáo viên */}
              <button
                onClick={() => {
                  setAuthModalTab('admin');
                  setIsAuthModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/80 transition-all cursor-pointer"
                title="Đăng nhập Giáo viên / Quản trị viên"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Giáo viên</span>
              </button>
            </div>
          ) : isAuthLoading ? (
            <div className="w-20 h-7 rounded-xl bg-slate-800/60 animate-pulse" />
          ) : (
            /* Khi chưa đăng nhập tài khoản nào */
            <button
              onClick={() => {
                setAuthModalTab('student');
                setIsAuthModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
