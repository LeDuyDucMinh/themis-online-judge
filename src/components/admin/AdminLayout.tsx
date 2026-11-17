import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { storageService } from '../../services/storageService';
import { supabase } from '../../services/supabaseClient';
import { Menu, X } from 'lucide-react';

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

  // Email hoặc danh tính tài khoản giáo viên quản trị
  const [displayEmail, setDisplayEmail] = useState<string>(() => {
    return contextAdminEmail || storageService.getAdminEmail() || 'leduyducminh@gmail.com';
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
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data?.user?.email) {
          setDisplayEmail(data.user.email);
          storageService.setAdminEmail(data.user.email);
        }
      })
      .catch(() => {});
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

  const navItems = [
    {
      id: 'admin_classes',
      label: 'Quản lý lớp học',
      isActive: currentTab === 'admin_classes',
      onClick: () => {
        setCurrentTab('admin_classes');
        setActiveClassId(null);
        setIsMobileMenuOpen(false);
      },
    },
    {
      id: 'admin_topics',
      label: 'Quản lý chủ đề',
      isActive: currentTab === 'admin_topics',
      onClick: () => {
        setCurrentTab('admin_topics');
        setIsMobileMenuOpen(false);
      },
    },
    {
      id: 'admin_users',
      label: 'Người dùng',
      isActive: currentTab === 'admin_users',
      onClick: () => {
        setCurrentTab('admin_users');
        setIsMobileMenuOpen(false);
      },
    },
    {
      id: 'submissions',
      label: 'Lịch sử nộp bài',
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
      className="min-h-screen h-screen flex overflow-hidden antialiased bg-[#FAF7EE] text-[#1F1D1A]"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {/* Backdrop mobile */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
        />
      )}

      {/* 1. THANH ĐIỀU HƯỚNG BÊN TRÁI (SIDEBAR) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-full md:h-screen shrink-0 bg-[#EFEAE1] text-[#1F1D1A] border-r border-[#D9D2C3] flex flex-col justify-between p-6 md:static transition-transform duration-200 select-none ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          {/* Logo & Không gian giảng dạy */}
          <div className="pb-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold tracking-tight text-[#1F1D1A]">
                FAMiNH <span className="text-[#B4281F]">Teacher</span>
              </h1>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="md:hidden text-[#6B655C] hover:text-[#1F1D1A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[13px] text-[#6B655C] mt-0.5">Không gian giảng dạy</p>
          </div>

          {/* Nhóm 1: Giảng dạy */}
          <div className="mt-2 space-y-1">
            <div className="text-[12px] font-medium text-[#6B655C] px-3 pb-2 pt-1">
              Giảng dạy
            </div>

            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`w-full text-left px-3.5 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                  item.isActive
                    ? 'bg-[#1F1D1A] text-white font-medium shadow-xs'
                    : 'text-[#1F1D1A] hover:text-[#B4281F] font-medium'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Nhóm 2: Hệ thống */}
          <div className="mt-6 space-y-1">
            <div className="text-[12px] font-medium text-[#6B655C] px-3 pb-2">
              Hệ thống
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="w-full text-left px-3.5 py-2 rounded-lg text-sm text-[#1F1D1A] hover:text-[#B4281F] font-medium transition-colors cursor-pointer"
            >
              Giao diện: {theme === 'dark' ? 'Tối' : 'Sáng'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsServerConfigModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 rounded-lg text-sm text-[#1F1D1A] hover:text-[#B4281F] font-medium transition-colors cursor-pointer"
            >
              Server chấm VPS
            </button>

            <button
              type="button"
              onClick={() => {
                handleResetConfirm();
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 rounded-lg text-sm text-[#1F1D1A] hover:text-[#B4281F] font-medium transition-colors cursor-pointer"
            >
              Khôi phục dữ liệu
            </button>
          </div>
        </div>

        {/* Nút Đăng xuất ở chân Sidebar */}
        <div className="pt-4 mt-auto">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-3.5 py-2 text-sm text-[#1F1D1A] hover:text-[#B4281F] font-medium transition-colors cursor-pointer"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* 2. NỘI DUNG CHÍNH (RIGHT PANEL) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#FAF7EE]">
        {/* Top Header Bar / Breadcrumb */}
        <header className="h-14 min-h-14 shrink-0 border-b border-[#D9D2C3] bg-[#FAF7EE] px-6 sm:px-10 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-[#1F1D1A] hover:bg-[#EFEAE1]"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="text-sm truncate">
              <span className="text-[#6B655C]">Giáo viên phụ trách</span>{' '}
              <span className="font-bold text-[#1F1D1A]">{displayEmail}</span>{' '}
              <span className="text-[#6B655C]">/ {activeNavItem?.label || 'Quản lý'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={handleOpenStudentView}
              className="text-sm font-medium text-[#1F1D1A] hover:text-[#B4281F] underline flex items-center gap-1 cursor-pointer"
            >
              <span>Xem trang chủ</span>
              <span>↗</span>
            </button>
          </div>
        </header>

        {/* Vùng nội dung các màn hình */}
        <main className="flex-1 p-6 sm:p-10 overflow-y-auto min-h-0 bg-[#FAF7EE]">
          {children}
        </main>
      </div>
    </div>
  );
};
