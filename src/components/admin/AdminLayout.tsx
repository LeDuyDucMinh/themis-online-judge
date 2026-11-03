/* Hallmark · shape: app screen · genre: modern-minimal · theme: brand · redesign: full
 * paper: oklch(98.5% 0.004 60) · accent: oklch(50.8% 0.198 26.8) · display: Bricolage Grotesque · body: Inter
 * nav: sidebar-rail · signature: teacher-studio-rail · states: default, hover, focus-visible, active, disabled
 * axes: light/grotesk-sans/warm · posture: whisper · contrast: pass · v2.0.0 */
/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V4 · weakest: S, standard admin rail; anchored around FAMiNH Teacher studio lockup and VPS judge controls */

import React, { useState, useEffect, useRef } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { storageService } from '../../services/storageService';
import { supabase } from '../../services/supabaseClient';
import {
  GraduationCap,
  ListTree,
  Trophy,
  Server,
  RotateCcw,
  LogOut,
  ExternalLink,
  Menu,
  ChevronRight,
  Sun,
  Moon,
  Users,
} from 'lucide-react';

export type AdminTabType =
  | 'classes'
  | 'problems'
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
    logoutAdmin,
    setIsServerConfigModalOpen,
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

  // Danh sách các menu chức năng giảng dạy FAMiNH Teacher
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

  const activeNavItem = navItems.find((item) => item.isActive);

  return (
    <div
      data-studio-shell
      className="h-screen min-h-screen flex overflow-hidden font-sans antialiased bg-paper text-ink transition-colors duration-200"
    >
      {/* ============================================================== */}
      {/* 1. THANH ĐIỀU HƯỚNG DỌC BÊN TRÁI (FAMiNH TEACHER STUDIO RAIL)  */}
      {/* ============================================================== */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-ink/60 z-40 md:hidden"
        />
      )}

      <aside
        aria-label="Điều hướng không gian giảng dạy"
        className={`fixed inset-y-0 left-0 z-50 w-64 h-full md:h-screen shrink-0 bg-paper-2 text-ink border-r border-rule flex flex-col justify-between p-5 md:static motion-safe:transition-transform motion-reduce:transition-none duration-200 ease-out select-none ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Phần Logo Header của FAMiNH Teacher */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-3 px-1.5 pb-5 border-b border-rule">
            <div className="w-10 h-10 rounded-xl bg-paper border border-rule p-1 flex items-center justify-center shrink-0">
              <img
                src="/faminh-logo.jpg"
                alt="FAMiNH Teacher"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-base tracking-tight text-ink truncate leading-tight">
                FAMiNH Teacher
              </h1>
              <p className="text-xs font-medium text-muted truncate mt-0.5">
                Không gian giảng dạy
              </p>
            </div>
          </div>

          {/* Nhóm Menu Chính */}
          <nav
            onScroll={handleNavScroll}
            className={`space-y-1 mt-5 overflow-y-auto pr-1 flex-1 ${
              isNavScrolling ? 'sidebar-scroll-active' : 'sidebar-scroll-inactive'
            }`}
          >
            <div className="text-xs font-medium px-3 mb-2 text-muted">
              Phân hệ giảng dạy
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors text-left cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed ${
                    item.isActive
                      ? 'bg-accent text-accent-ink font-semibold'
                      : 'text-ink-2 hover:text-ink hover:bg-paper-3 font-medium'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      item.isActive
                        ? 'text-accent-ink'
                        : 'text-muted group-hover:text-ink'
                    }`}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.isActive && (
                    <ChevronRight className="w-4 h-4 shrink-0 text-accent-ink/80" />
                  )}
                </button>
              );
            })}

            {/* Phân cách các nút cấu hình / công cụ hệ thống */}
            <div className="text-xs font-medium px-3 pt-5 mb-2 text-muted">
              Hệ thống & máy chủ
            </div>

            {/* Nút Chuyển chế độ Giao diện Dark / Light Mode */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-ink-2 hover:text-ink hover:bg-paper-3 transition-colors text-left cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                theme === 'dark'
                  ? 'Chuyển sang giao diện sáng'
                  : 'Chuyển sang giao diện tối'
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-muted group-hover:text-ink transition-colors shrink-0" />
                ) : (
                  <Moon className="w-4 h-4 text-muted group-hover:text-ink transition-colors shrink-0" />
                )}
                <span className="flex-1 truncate">
                  {theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
                </span>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-paper-3 text-ink-2 border border-rule">
                {theme === 'dark' ? 'Tối' : 'Sáng'}
              </span>
            </button>

            {/* Nút Cấu hình Máy chủ Chấm bài VPS */}
            <button
              type="button"
              onClick={() => {
                setIsServerConfigModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-ink-2 hover:text-ink hover:bg-paper-3 transition-colors text-left cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
              title="Cấu hình Server VPS Judge0"
            >
              <Server className="w-4 h-4 text-muted group-hover:text-ink transition-colors shrink-0" />
              <span className="flex-1 truncate">Server Chấm VPS</span>
            </button>

            {/* Nút Khôi phục dữ liệu mẫu */}
            <button
              type="button"
              onClick={() => {
                handleResetConfirm();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-ink-2 hover:text-ink hover:bg-paper-3 transition-colors text-left cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
              title="Khôi phục lại bài tập & bộ test mặc định"
            >
              <RotateCcw className="w-4 h-4 text-muted group-hover:text-ink transition-colors shrink-0" />
              <span className="flex-1 truncate">Khôi phục dữ liệu</span>
            </button>
          </nav>
        </div>

        {/* Nút Đăng xuất ở chân Sidebar */}
        <div className="pt-4 mt-auto border-t border-rule shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-ink-2 hover:text-accent hover:bg-paper-3 transition-colors cursor-pointer text-left group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            title="Đăng xuất khỏi phiên Giáo viên"
          >
            <LogOut className="w-4 h-4 shrink-0 text-muted group-hover:text-accent transition-colors" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. KHÔNG GIAN NỘI DUNG CHÍNH (RIGHT PANEL: HEADER + BODY)       */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header
          data-studio-header
          className="h-16 min-h-16 shrink-0 border-b border-rule bg-paper text-ink px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20 transition-colors duration-200"
        >
          {/* Bên trái Header: Danh tính Giáo viên + Phân hệ hiện tại */}
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Nút bật menu trên Mobile */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-ink-2 hover:text-ink hover:bg-paper-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Mở menu giảng dạy"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <span className="block text-xs font-medium text-muted leading-tight">
                  Giáo viên phụ trách
                </span>
                <span className="block text-sm font-semibold text-ink truncate max-w-52 sm:max-w-md leading-snug">
                  {displayEmail || 'Giáo viên quản trị'}
                </span>
              </div>

              {activeNavItem && (
                <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-rule">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span className="text-xs font-medium text-ink-2">
                    {activeNavItem.label}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bên phải Header: Nút "Xem trang chủ" */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleOpenStudentView}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-rule bg-paper-2 hover:bg-paper-3 text-ink text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
              title="Mở giao diện học sinh (Trang chủ) trong tab mới"
            >
              <span>Xem trang chủ</span>
              <ExternalLink className="w-3.5 h-3.5 text-muted" />
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
