import React from 'react';
import { useJudge } from '../../context/JudgeContext';
import {
  Code2,
  ShieldCheck,
  LogOut,
  KeyRound,
  RotateCcw,
  Trophy,
  ListTree,
  Sun,
  Moon,
  GraduationCap,
  LogIn,
  Server,
  UserCheck,
  Settings,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'classes' | 'problems' | 'admin_classes' | 'admin_topics' | 'admin_users' | 'submissions';
  setCurrentTab: (tab: 'classes' | 'problems' | 'admin_classes' | 'admin_topics' | 'admin_users' | 'submissions') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const {
    isAdminAuthenticated,
    isAuthLoading,
    currentStudent,
    logoutStudent,
    setAuthModalTab,
    setIsAuthModalOpen,
    setIsChangePasswordModalOpen,
    setIsChangeNameModalOpen,
    setIsServerConfigModalOpen,
    logoutAdmin,
    resetAllData,
    theme,
    toggleTheme,
    openConfirmModal,
    activeClass,
    setActiveClassId,
  } = useJudge();

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const settingsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen]);

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
    <header className={`backdrop-blur-md border-b sticky top-0 z-40 transition-colors duration-200 ${
      theme === 'light'
        ? 'bg-white/95 border-stone-200 text-stone-900 shadow-2xs'
        : 'bg-[#090d16]/95 border-stone-800 text-stone-100'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo FAMINH */}
        <div
          onClick={handleBrandClick}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
          title="Trang chủ FAMINH Online Judge"
        >
          <div className={`w-9 h-9 rounded-xl border p-0.5 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs ${
            theme === 'light' ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-700'
          }`}>
            <img
              src="/faminh-logo.jpg"
              alt="FAMINH Logo"
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className={`font-display font-black text-lg tracking-tight ${
                theme === 'light' ? 'text-stone-900' : 'text-stone-100'
              }`}>
                FAMINH <span className="text-[#c51f26]">Judge</span>
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 hidden sm:block">
              {activeClass ? (
                <span className="text-[#c51f26] font-semibold flex items-center gap-1">
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
        <div className="hidden md:flex items-stretch gap-1.5 self-stretch py-2.5">
          {/* HỌC SINH: Tab Lớp học của tôi */}
          {!isAdminAuthenticated && (
            <button
              onClick={() => {
                setCurrentTab('classes');
                setActiveClassId(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'classes' && !activeClass
                  ? 'bg-[#c51f26] text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-300 hover:text-[#c51f26] dark:hover:text-white hover:bg-red-50/50 dark:hover:bg-stone-800/60'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-[#c51f26] dark:text-red-400 group-hover:scale-105" />
              <span>Lớp học của tôi</span>
            </button>
          )}

          {/* HỌC SINH: Tab Luyện tập khi đang ở trong một lớp */}
          {!isAdminAuthenticated && activeClass && (
            <button
              onClick={() => setCurrentTab('classes')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'classes' && activeClass
                  ? 'bg-[#c51f26] text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-300 hover:text-[#c51f26] dark:hover:text-white hover:bg-red-50/50 dark:hover:bg-stone-800/60'
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'admin_classes' && !activeClass
                  ? 'bg-[#c51f26] text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-300 hover:text-[#c51f26] dark:hover:text-white hover:bg-red-50/50 dark:hover:bg-stone-800/60'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-[#c51f26] dark:text-red-400" />
              <span>Quản lý Lớp học</span>
            </button>
          )}

          {/* GIÁO VIÊN: Tab Chi tiết lớp khi đang chọn lớp */}
          {isAdminAuthenticated && activeClass && (
            <button
              onClick={() => {
                setCurrentTab('admin_classes');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'admin_classes' && activeClass
                  ? 'bg-[#c51f26] text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-300 hover:text-[#c51f26] dark:hover:text-white hover:bg-red-50/50 dark:hover:bg-stone-800/60'
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'admin_topics'
                  ? 'bg-[#c51f26] text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-300 hover:text-[#c51f26] dark:hover:text-white hover:bg-red-50/50 dark:hover:bg-stone-800/60'
              }`}
            >
              <ListTree className="w-4 h-4" />
              <span>Quản lý Chủ đề</span>
            </button>
          )}

          {/* Tab Lịch sử nộp bài */}
          <button
            onClick={() => {
              setCurrentTab('submissions');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              currentTab === 'submissions'
                ? 'bg-[#c51f26] text-white shadow-2xs'
                : 'text-stone-600 dark:text-stone-300 hover:text-[#c51f26] dark:hover:text-white hover:bg-red-50/50 dark:hover:bg-stone-800/60'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Lịch sử nộp bài</span>
          </button>
        </div>


        {/* Actions & Settings */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* ROLE & AUTHENTICATION ACTIONS */}
          {isAdminAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#c51f26] dark:text-red-300 border border-red-200 dark:border-red-900/60 text-xs font-bold shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-[#c51f26]" />
                <span className="hidden sm:inline">GIÁO VIÊN (ADMIN)</span>
              </div>

              {/* Nút Cấu hình Máy chủ Chấm bài VPS */}
              <button
                onClick={() => setIsServerConfigModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white border border-stone-200 dark:border-stone-700 text-xs font-semibold transition-colors cursor-pointer"
                title="Cấu hình Máy chủ Chấm bài VPS (Judge0)"
              >
                <Server className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden lg:inline">Server Chấm VPS</span>
              </button>
            </div>
          ) : currentStudent ? (
            /* Khi Học sinh đã đăng nhập */
            <div className="flex items-center gap-2">
              <div
                onClick={() => setIsChangeNameModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100/80 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-[#c51f26] dark:text-red-300 border border-red-200 dark:border-red-900/60 text-xs font-bold shadow-2xs cursor-pointer transition-all"
                title="Nhấn để đổi họ và tên"
              >
                <GraduationCap className="w-4 h-4 text-[#c51f26]" />
                <span className="max-w-[130px] truncate" title={currentStudent.fullName}>
                  {currentStudent.fullName}
                </span>
              </div>

              {/* Nút Đổi tên học sinh */}
              <button
                onClick={() => setIsChangeNameModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 text-stone-700 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white border border-stone-200 dark:border-stone-800 transition-all cursor-pointer"
                title="Đổi họ và tên của bạn"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#c51f26]" />
                <span className="hidden sm:inline">Đổi tên</span>
              </button>
            </div>
          ) : null}

          {/* MÀN HỌC SINH (CHƯA ĐĂNG NHẬP ADMIN): CHỈ HIỂN THỊ NÚT CHUYỂN CHẾ ĐỘ SÁNG TỐI */}
          {!isAdminAuthenticated ? (
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white border border-stone-200 dark:border-stone-700 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
              title={theme === 'dark' ? 'Chuyển sang chế độ Nền Sáng' : 'Chuyển sang chế độ Nền Tối'}
              aria-label="Đổi giao diện sáng/tối"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-stone-700" />
              )}
            </button>
          ) : (
            /* MÀN GIÁO VIÊN (ADMIN): NÚT CÀI ĐẶT (BÁNH RĂNG) CHỨA 3 NÚT */
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer shadow-sm ${
                  isSettingsOpen
                    ? 'bg-slate-700 text-white border-slate-600 ring-2 ring-red-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                }`}
                title="Cài đặt hệ thống"
                aria-label="Cài đặt hệ thống"
                aria-expanded={isSettingsOpen}
              >
                <Settings className={`w-4 h-4 transition-transform duration-300 ${isSettingsOpen ? 'rotate-90 text-red-400' : ''}`} />
              </button>

              {isSettingsOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5 text-red-400" />
                      Cài đặt hệ thống
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                      Admin
                    </span>
                  </div>

                  <div className="space-y-1">
                    {/* 1. NÚT CHUYỂN ĐỘ SÁNG / TỐI */}
                    <button
                      onClick={() => {
                        toggleTheme();
                        setIsSettingsOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-all cursor-pointer group"
                      title={theme === 'dark' ? 'Chuyển sang chế độ Nền Sáng' : 'Chuyển sang chế độ Nền Tối'}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
                          {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-400" />}
                        </div>
                        <div className="text-left">
                          <span className="block text-slate-200 font-medium">Chế độ giao diện</span>
                          <span className="block text-[10px] text-slate-400">
                            {theme === 'dark' ? 'Đang dùng Nền Tối' : 'Đang dùng Nền Sáng'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-amber-400 border border-slate-700/60 font-mono">
                        {theme === 'dark' ? 'Sáng' : 'Tối'}
                      </span>
                    </button>

                    {/* 2. NÚT ĐỔI MẬT MÃ ADMIN */}
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        setIsChangePasswordModalOpen(true);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-all cursor-pointer group"
                      title="Đổi mật mã Admin"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center border border-red-500/20 group-hover:scale-105 transition-transform">
                          <KeyRound className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <span className="block text-slate-200 font-medium">Đổi mật mã Admin</span>
                          <span className="block text-[10px] text-slate-400">Thiết lập mật khẩu quản trị</span>
                        </div>
                      </div>
                    </button>

                    {/* 3. NÚT KHÔI PHỤC LẠI DỮ LIỆU MẪU */}
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        handleResetConfirm();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/40 transition-all cursor-pointer group"
                      title="Khôi phục lại dữ liệu mẫu"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/20 group-hover:scale-105 transition-transform">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <span className="block font-medium">Khôi phục dữ liệu mẫu</span>
                          <span className="block text-[10px] text-slate-400">Đặt lại bộ dữ liệu hệ thống</span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ĐĂNG XUẤT HOẶC ĐĂNG NHẬP */}
          {isAdminAuthenticated ? (
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
          ) : currentStudent ? (
            <button
              onClick={() => logoutStudent()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-medium transition-all cursor-pointer"
              title="Đăng xuất tài khoản học sinh"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Thoát</span>
            </button>
          ) : isAuthLoading ? (
            <div className="w-20 h-7 rounded-xl bg-slate-800/60 animate-pulse" />
          ) : (
            <button
              onClick={() => {
                setAuthModalTab('student');
                setIsAuthModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25 transition-all cursor-pointer hover:scale-[1.02]"
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
