import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

interface AdminLayoutProps {
  currentTab: 'classes' | 'problems' | 'admin_classes' | 'admin_topics' | 'admin_users' | 'submissions';
  setCurrentTab: (tab: 'classes' | 'problems' | 'admin_classes' | 'admin_topics' | 'admin_users' | 'submissions') => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  setCurrentTab,
  children,
}) => {
  const {
    adminEmail: contextAdminEmail,
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

  // Danh sách các menu chức năng chuẩn REX Admin
  const navItems = [
    {
      id: 'admin_classes',
      label: 'Quản lý Lớp học',
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
      id: 'admin_users',
      label: 'Người dùng',
      icon: Users,
      isActive: currentTab === 'admin_users',
      onClick: () => {
        setCurrentTab('admin_users');
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
    <div className={`min-h-screen flex font-sans antialiased transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#090d16] text-slate-100' : 'bg-[#f8fafc] text-stone-900'
    }`}>
      {/* ============================================================== */}
      {/* 1. THANH ĐIỀU HƯỚNG DỌC BÊN TRÁI (REX ADMIN CRIMSON SIDEBAR)    */}
      {/* ============================================================== */}
      {/* Overlay cho Mobile */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs animate-in fade-in"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#c51f26] text-white flex flex-col justify-between p-5 shadow-2xl transition-transform duration-300 md:static md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Header Sidebar: Logo + FAMINH Admin Control Center */}
          <div className="flex items-center justify-between pb-6 border-b border-white/15">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white p-1.5 shadow-sm flex items-center justify-center shrink-0">
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
                <h1 className="font-black text-base tracking-tight !text-white text-white flex items-center gap-1.5">
                  <span className="!text-white text-white">FAMINH</span>
                  <span className="!text-white/90 text-white/90">Admin</span>
                </h1>
                <p className="text-[11px] font-semibold !text-white/70 text-white/70 tracking-wide mt-0.5">
                  Control Center
                </p>
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
          <nav className="mt-6 flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-white/60 px-3 mb-1">
              Phân hệ quản trị
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left cursor-pointer ${
                    item.isActive
                      ? 'bg-white text-stone-900 shadow-md translate-x-1'
                      : 'text-white/85 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      item.isActive ? 'text-[#c51f26]' : 'text-white/85'
                    }`}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.isActive && (
                    <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                  )}
                </button>
              );
            })}

            {/* Phân cách các nút cấu hình / công cụ hệ thống */}
            <div className="text-[10px] font-black uppercase tracking-wider text-white/60 px-3 mt-5 mb-1">
              Hệ thống & Máy chủ
            </div>

            {/* Nút Chuyển chế độ Giao diện Dark / Light Mode trên thanh đỏ */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-sm font-semibold text-white/85 hover:text-white hover:bg-white/10 transition-all text-left cursor-pointer"
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
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white shadow-2xs">
                {theme === 'dark' ? 'DARK' : 'LIGHT'}
              </span>
            </button>

            {/* Nút Cấu hình Máy chủ Chấm bài VPS */}
            <button
              onClick={() => {
                setIsServerConfigModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white/85 hover:text-white hover:bg-white/10 transition-all text-left cursor-pointer"
              title="Cấu hình Server VPS Judge0"
            >
              <Server className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="flex-1 truncate">Server Chấm VPS</span>
            </button>

            {/* Nút Đổi mật mã Admin */}
            <button
              onClick={() => {
                setIsChangePasswordModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white/85 hover:text-white hover:bg-white/10 transition-all text-left cursor-pointer"
              title="Đổi mật khẩu Quản trị viên"
            >
              <KeyRound className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="flex-1 truncate">Đổi mật khẩu Admin</span>
            </button>

            {/* Nút Khôi phục dữ liệu mẫu */}
            <button
              onClick={() => {
                handleResetConfirm();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white/85 hover:text-white hover:bg-white/10 transition-all text-left cursor-pointer"
              title="Khôi phục lại bài tập & bộ test mặc định"
            >
              <RotateCcw className="w-4 h-4 text-rose-200 shrink-0" />
              <span className="flex-1 truncate">Khôi phục dữ liệu</span>
            </button>
          </nav>
        </div>

        {/* Nút Đăng xuất ở chân Sidebar */}
        <div className="pt-4 mt-auto border-t border-white/15">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold text-white/90 hover:text-white hover:bg-white/15 transition-all cursor-pointer text-left"
            title="Đăng xuất khỏi phiên Quản trị viên"
          >
            <LogOut className="w-5 h-5 shrink-0 text-white/90" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. KHÔNG GIAN NỘI DUNG CHÍNH (RIGHT PANEL: HEADER + BODY)       */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar theo đúng ảnh REX Admin */}
        <header className={`h-18 min-h-[72px] border-b px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs transition-colors duration-200 ${
          theme === 'dark'
            ? 'bg-slate-900/95 border-slate-800 text-white'
            : 'bg-white border-stone-200/90 text-stone-900'
        }`}>
          {/* Bên trái Header: TÀI KHOẢN QUẢN TRỊ + Email */}
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
              <span className="block text-[10px] font-black uppercase tracking-wider text-[#c51f26]">
                TÀI KHOẢN QUẢN TRỊ
              </span>
              <span className={`block text-sm font-bold truncate max-w-[200px] sm:max-w-md ${
                theme === 'dark' ? 'text-white' : 'text-stone-900'
              }`}>
                {displayEmail || 'Giáo viên Quản trị'}
              </span>
            </div>
          </div>

          {/* Bên phải Header: Nút "Xem trang chủ" như ảnh REX Admin (Đã bỏ nút chế độ sáng ở header theo yêu cầu) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleOpenStudentView}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                theme === 'dark'
                  ? 'border-slate-700 bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700'
                  : 'border-stone-300 hover:border-[#c51f26] bg-white hover:bg-red-50/50 text-stone-700 hover:text-[#c51f26]'
              }`}
              title="Mở giao diện học sinh (Trang chủ) trong tab mới"
            >
              <span>Xem trang chủ</span>
              <ExternalLink className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-slate-400' : 'text-stone-400'}`} />
            </button>
          </div>
        </header>

        {/* Nội dung trang quản trị */}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
