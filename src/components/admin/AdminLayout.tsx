import React, { useState, useEffect, useRef } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { storageService } from '../../services/storageService';
import { supabase } from '../../services/supabaseClient';
import {
  GraduationCap,
  ListTree,
  Trophy,
  Server,
  KeyRound,
  RotateCcw,
  LogOut,
  ExternalLink,
  Menu,
  X,
  ChevronRight,
  Sun,
  Moon,
  Users,
  LayoutDashboard,
  UserCheck,
  Crown,
  BookOpen,
} from 'lucide-react';

export type AdminTabType =
  | 'classes'
  | 'problems'
  | 'admin_dashboard'
  | 'admin_teachers'
  | 'admin_classes'
  | 'admin_topics'
  | 'admin_users'
  | 'submissions';

interface AdminLayoutProps {
  currentTab: AdminTabType;
  setCurrentTab: (tab: AdminTabType) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  setCurrentTab,
  children,
}) => {
  const {
    adminEmail: contextAdminEmail,
    isSuperAdmin,
    logoutAdmin,
    setIsServerConfigModalOpen,
    setIsChangePasswordModalOpen,
    resetAllData,
    openConfirmModal,
    setActiveClassId,
    theme,
    toggleTheme,
  } = useJudge();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNavScrolling, setIsNavScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNavScroll = () => {
    setIsNavScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsNavScrolling(false);
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Email hoặc danh tính tài khoản giáo viên quản trị
  const [displayEmail, setDisplayEmail] = useState<string>(() => {
    return contextAdminEmail || storageService.getAdminEmail() || '';
  });

  useEffect(() => {
    if (contextAdminEmail) {
      setDisplayEmail(contextAdminEmail);
      return;
    }
    const cached = storageService.getAdminEmail();
    if (cached) {
      setDisplayEmail(cached);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setDisplayEmail(data.user.email);
        storageService.setAdminEmail(data.user.email);
      }
    }).catch(() => {});
  }, [contextAdminEmail]);

  const handleResetConfirm = () => {
    openConfirmModal({
      title: 'Khôi phục dữ liệu mẫu',
      message:
        'Bạn có chắc chắn muốn khôi phục lại toàn bộ dữ liệu bài tập và bộ test case mặc định ban đầu của FAMINH?',
      confirmLabel: 'Khôi phục',
      onConfirm: () => resetAllData(),
    });
  };

  const handleLogout = () => {
    logoutAdmin();
    setCurrentTab('classes');
    setActiveClassId(null);
  };

  const handleOpenStudentView = () => {
    if (typeof window !== 'undefined') {
      window.open('/#classes', '_blank');
    }
  };

  // Danh sách menu tách biệt hoàn toàn giữa Admin tối cao (Supreme Admin) và Giáo viên (Teacher)
  const navItems = isSuperAdmin
    ? [
        {
          id: 'admin_dashboard',
          label: 'Tổng quan Tối cao',
          icon: LayoutDashboard,
          isActive: currentTab === 'admin_dashboard',
          onClick: () => {
            setCurrentTab('admin_dashboard');
            setActiveClassId(null);
            setIsMobileMenuOpen(false);
          },
        },
        {
          id: 'admin_teachers',
          label: 'Quản lý Giáo viên',
          icon: UserCheck,
          isActive: currentTab === 'admin_teachers',
          onClick: () => {
            setCurrentTab('admin_teachers');
            setActiveClassId(null);
            setIsMobileMenuOpen(false);
          },
        },
        {
          id: 'admin_users',
          label: 'Quản lý Học sinh',
          icon: Users,
          isActive: currentTab === 'admin_users',
          onClick: () => {
            setCurrentTab('admin_users');
            setActiveClassId(null);
            setIsMobileMenuOpen(false);
          },
        },
        {
          id: 'admin_classes',
          label: 'Giám sát Lớp học',
          icon: GraduationCap,
          isActive: currentTab === 'admin_classes',
          onClick: () => {
            setCurrentTab('admin_classes');
            setActiveClassId(null);
            setIsMobileMenuOpen(false);
          },
        },
        {
          id: 'admin_topics',
          label: 'Kho Chủ đề & Đề',
          icon: ListTree,
          isActive: currentTab === 'admin_topics',
          onClick: () => {
            setCurrentTab('admin_topics');
            setIsMobileMenuOpen(false);
          },
        },
        {
          id: 'submissions',
          label: 'Nhật ký Chấm bài',
          icon: Trophy,
          isActive: currentTab === 'submissions',
          onClick: () => {
            setCurrentTab('submissions');
            setIsMobileMenuOpen(false);
          },
        },
      ]
    : [
        {
          id: 'admin_classes',
          label: 'Lớp học của tôi',
          icon: GraduationCap,
          isActive: currentTab === 'admin_classes',
          onClick: () => {
            setCurrentTab('admin_classes');
            setActiveClassId(null);
            setIsMobileMenuOpen(false);
          },
        },
        {
          id: 'admin_topics',
          label: 'Quản lý Chủ đề',
          icon: ListTree,
          isActive: currentTab === 'admin_topics',
          onClick: () => {
            setCurrentTab('admin_topics');
            setIsMobileMenuOpen(false);
          },
        },
        {
          id: 'submissions',
          label: 'Lịch sử nộp bài',
          icon: Trophy,
          isActive: currentTab === 'submissions',
          onClick: () => {
            setCurrentTab('submissions');
            setIsMobileMenuOpen(false);
          },
        },
      ];

  return (
    <div className={`h-screen min-h-screen flex overflow-hidden font-sans antialiased transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#090d16] text-slate-100' : 'bg-[#f8fafc] text-stone-900'
    }`}>
      {/* ============================================================== */}
      {/* 1. THANH ĐIỀU HƯỚNG DỌC BÊN TRÁI                               */}
      {/* - Admin Tối Cao: Obsidian Black & Royal Gold (Supreme Admin)   */}
      {/* - Giáo viên: Crimson Red (#c51f26 - FAMINH Teacher)            */}
      {/* ============================================================== */}
      {/* Overlay cho Mobile */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs animate-in fade-in"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-full md:h-screen shrink-0 flex flex-col justify-between p-5 shadow-2xl transition-transform duration-300 md:sticky md:top-0 md:translate-x-0 ${
          isSuperAdmin
            ? 'bg-gradient-to-b from-[#0b0a09] via-[#14110b] to-[#080705] text-amber-50 border-r border-amber-500/30'
            : 'bg-[#c51f26] text-white'
        } ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Header Sidebar */}
          <div className={`flex items-center justify-between pb-6 border-b shrink-0 ${
            isSuperAdmin ? 'border-amber-500/20' : 'border-white/15'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl p-1.5 flex items-center justify-center shrink-0 ${
                isSuperAdmin
                  ? 'bg-stone-950 ring-2 ring-amber-400/80 shadow-lg shadow-amber-500/20'
                  : 'bg-white shadow-sm'
              }`}>
                <img
                  src="/faminh-logo.jpg"
                  alt="FAMINH Logo"
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="leading-tight">
                {isSuperAdmin ? (
                  <>
                    <h1 className="font-black text-base tracking-tight text-white flex items-center gap-1.5">
                      <span>FAMINH</span>
                      <span className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                        Supreme
                      </span>
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1 mt-0.5">
                      <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Quản Trị Tối Cao</span>
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="font-black text-base tracking-tight !text-white text-white flex items-center gap-1.5">
                      <span className="!text-white text-white">FAMINH</span>
                      <span className="!text-white/90 text-white/90">Teacher</span>
                    </h1>
                    <p className="text-[11px] font-semibold !text-white/75 text-white/75 tracking-wide mt-0.5 flex items-center gap-1">
                      <BookOpen className="w-3 h-3 shrink-0" />
                      <span>Không gian Giáo viên</span>
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Nút đóng trên Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              aria-label="Đóng menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nhóm Menu chính (Nav Items) */}
          <nav
            onScroll={handleNavScroll}
            className={`mt-6 flex flex-col gap-1.5 flex-1 overflow-y-auto min-h-0 pr-1 sidebar-scrollbar ${
              isNavScrolling ? 'is-scrolling' : ''
            }`}
          >
            <div className={`text-[10px] font-black uppercase tracking-wider px-3 mb-1 ${
              isSuperAdmin ? 'text-amber-400/80' : 'text-white/60'
            }`}>
              {isSuperAdmin ? 'Trung tâm Chỉ huy Tối cao' : 'Phân hệ giảng dạy'}
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left cursor-pointer ${
                    item.isActive
                      ? isSuperAdmin
                        ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 text-stone-950 font-black shadow-lg shadow-amber-500/20 translate-x-1'
                        : 'bg-white text-stone-900 shadow-md translate-x-1'
                      : isSuperAdmin
                      ? 'text-stone-300 hover:text-amber-200 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20'
                      : 'text-white/85 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      item.isActive
                        ? isSuperAdmin
                          ? 'text-stone-950'
                          : 'text-[#c51f26]'
                        : isSuperAdmin
                        ? 'text-amber-400/85'
                        : 'text-white/85'
                    }`}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.isActive && (
                    <ChevronRight className={`w-4 h-4 shrink-0 ${
                      isSuperAdmin ? 'text-stone-900' : 'text-stone-400'
                    }`} />
                  )}
                </button>
              );
            })}

            {/* Phân cách các nút cấu hình / công cụ hệ thống */}
            <div className={`text-[10px] font-black uppercase tracking-wider px-3 mt-5 mb-1 ${
              isSuperAdmin ? 'text-amber-400/80' : 'text-white/60'
            }`}>
              {isSuperAdmin ? 'Hạ tầng & Bảo mật Root' : 'Giao diện'}
            </div>

            {/* Nút Chuyển chế độ Giao diện Dark / Light Mode */}
            <button
              onClick={toggleTheme}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all text-left cursor-pointer ${
                isSuperAdmin
                  ? 'text-stone-300 hover:text-amber-200 hover:bg-amber-500/10'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
              title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng (Light Mode)' : 'Chuyển sang Giao diện Tối (Dark Mode)'}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-300 shrink-0" />
                ) : (
                  <Moon className="w-4 h-4 text-amber-200 shrink-0" />
                )}
                <span className="flex-1 truncate">
                  {theme === 'dark' ? 'Chế độ Sáng' : 'Chế độ Tối'}
                </span>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-2xs ${
                isSuperAdmin
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-white/20 text-white'
              }`}>
                {theme === 'dark' ? 'DARK' : 'LIGHT'}
              </span>
            </button>

            {isSuperAdmin && (
              <>
                {/* Nút Cấu hình Máy chủ Chấm bài VPS */}
                <button
                  onClick={() => {
                    setIsServerConfigModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-sm font-semibold text-stone-300 hover:text-amber-200 hover:bg-amber-500/10 transition-all text-left cursor-pointer"
                  title="Cấu hình Server VPS Judge0"
                >
                  <Server className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="flex-1 truncate">Server Chấm VPS</span>
                </button>

                {/* Nút Đổi mật mã Admin */}
                <button
                  onClick={() => {
                    setIsChangePasswordModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-sm font-semibold text-stone-300 hover:text-amber-200 hover:bg-amber-500/10 transition-all text-left cursor-pointer"
                  title="Đổi mật khẩu Quản trị viên"
                >
                  <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="flex-1 truncate">Đổi mật khẩu Admin</span>
                </button>

                {/* Nút Khôi phục dữ liệu mẫu */}
                <button
                  onClick={() => {
                    handleResetConfirm();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-sm font-semibold text-stone-300 hover:text-amber-200 hover:bg-amber-500/10 transition-all text-left cursor-pointer"
                  title="Khôi phục lại bài tập & bộ test mặc định"
                >
                  <RotateCcw className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="flex-1 truncate">Khôi phục dữ liệu</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Nút Đăng xuất ở chân Sidebar */}
        <div className={`pt-4 mt-auto border-t shrink-0 ${
          isSuperAdmin ? 'border-amber-500/20' : 'border-white/15'
        }`}>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer text-left ${
              isSuperAdmin
                ? 'text-rose-300 hover:text-white hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30'
                : 'text-white/90 hover:text-white hover:bg-white/15'
            }`}
            title="Đăng xuất"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. KHÔNG GIAN NỘI DUNG CHÍNH (RIGHT PANEL: HEADER + BODY)       */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar: Khác biệt rõ rệt giữa Admin Tối Cao (Gold/Obsidian) và Giáo viên (Crimson) */}
        <header className={`h-18 min-h-[72px] shrink-0 border-b px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs transition-colors duration-200 ${
          isSuperAdmin
            ? theme === 'dark'
              ? 'bg-gradient-to-r from-[#0e0c0a] via-[#16120c] to-[#0e0c0a] border-amber-500/30 text-white'
              : 'bg-gradient-to-r from-amber-50/90 via-white to-amber-50/90 border-amber-300/80 text-stone-900'
            : theme === 'dark'
            ? 'bg-slate-900/95 border-slate-800 text-white'
            : 'bg-white border-stone-200/90 text-stone-900'
        }`}>
          {/* Bên trái Header: Vai trò + Email */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Nút bật menu trên Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={`md:hidden p-2 rounded-xl cursor-pointer ${
                theme === 'dark'
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
              aria-label="Mở menu quản trị"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              {isSuperAdmin ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40">
                    <Crown className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" />
                    <span>QUẢN TRỊ VIÊN TỐI CAO (SUPREME ADMIN)</span>
                  </span>
                  <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    • TOÀN QUYỀN HỆ THỐNG
                  </span>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#c51f26]">
                  <BookOpen className="w-3 h-3 shrink-0" />
                  <span>TÀI KHOẢN GIÁO VIÊN (PHÂN HỆ GIẢNG DẠY)</span>
                </span>
              )}
              <span className={`block text-sm font-bold truncate max-w-[220px] sm:max-w-md mt-0.5 ${
                theme === 'dark' ? 'text-white' : 'text-stone-900'
              }`}>
                {displayEmail || (isSuperAdmin ? 'Admin tối cao' : 'Giáo viên')}
              </span>
            </div>
          </div>

          {/* Bên phải Header: Nút lối tắt Trung tâm Tối cao (cho Admin) + Xem trang chủ */}
          <div className="flex items-center gap-2.5 shrink-0">
            {isSuperAdmin && currentTab !== 'admin_dashboard' && (
              <button
                onClick={() => {
                  setCurrentTab('admin_dashboard');
                  setActiveClassId(null);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 text-xs font-black transition-all shadow-sm cursor-pointer"
                title="Quay về Bảng điều khiển Tối cao"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard Tối cao</span>
              </button>
            )}

            <button
              onClick={handleOpenStudentView}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                isSuperAdmin
                  ? theme === 'dark'
                    ? 'border-amber-500/40 bg-stone-900 text-amber-200 hover:text-white hover:bg-stone-800'
                    : 'border-amber-400 bg-white hover:bg-amber-50 text-amber-900'
                  : theme === 'dark'
                  ? 'border-slate-700 bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700'
                  : 'border-stone-300 hover:border-[#c51f26] bg-white hover:bg-red-50/50 text-stone-700 hover:text-[#c51f26]'
              }`}
              title="Mở giao diện học sinh (Trang chủ) trong tab mới"
            >
              <span>Xem trang chủ</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-75" />
            </button>
          </div>
        </header>

        {/* Nội dung trang quản trị */}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
};
