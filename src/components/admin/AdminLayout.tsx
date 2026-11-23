import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { storageService } from '../../services/storageService';
import { supabase } from '../../services/supabaseClient';
import { Menu, X } from 'lucide-react';

export type AdminTabType =
  | 'classes'
  | 'problems'
  | 'admin_overview'
  | 'admin_classes'
  | 'admin_topics'
  | 'admin_student_home'
  | 'admin_users'
  | 'admin_banners'
  | 'admin_countdowns'
  | 'submissions';

interface AdminLayoutProps {
  currentTab: AdminTabType;
  setCurrentTab: (tab: AdminTabType) => void;
  breadcrumb?: React.ReactNode;
  onResetEditing?: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  setCurrentTab,
  breadcrumb,
  onResetEditing,
  children,
}) => {
  const {
    adminEmail: contextAdminEmail,
    logoutAdmin,
    setIsServerConfigModalOpen,
    resetAllData,
    openConfirmModal,
    setActiveClassId,
    classes,
    topics,
    problems,
    homeBanners,
    examCountdowns,
    showToast,
    theme,
    toggleTheme,
  } = useJudge();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

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

  const handleExportBackup = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        version: 'faminh-gv-v2',
        classes,
        topics,
        problems: problems.map((p) => ({
          ...p,
          // Xuất metadata gọn, tránh file backup phình quá lớn từ dataUrl nhị phân
          attachedFile: p.attachedFile
            ? { name: p.attachedFile.name, size: p.attachedFile.size, type: p.attachedFile.type }
            : undefined,
        })),
        homeBanners,
        examCountdowns,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `faminh-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Đã tải bản sao lưu', 'File sao lưu JSON cấu hình lớp, chủ đề và đề bài đã được tải về máy.', 'success');
    } catch {
      showToast('Không thể xuất sao lưu', 'Trình duyệt không thể tạo file sao lưu lúc này.', 'error');
    }
  };

  const handleResetConfirm = () => {
    setIsBackupModalOpen(false);
    openConfirmModal({
      title: 'Khôi phục dữ liệu mẫu',
      message:
        'Bạn có chắc chắn muốn xóa bộ nhớ tạm trên máy này và khôi phục lại trạng thái mặc định ban đầu không?',
      confirmLabel: 'Khôi phục',
      onConfirm: () => resetAllData(),
    });
  };

  const handleLogout = () => {
    logoutAdmin();
    setCurrentTab('classes');
    setActiveClassId(null);
    onResetEditing?.();
  };

  const handleOpenStudentView = () => {
    if (typeof window !== 'undefined') {
      window.open('/#classes', '_blank');
    }
  };

  const isStudentHomeActive =
    currentTab === 'admin_student_home' ||
    currentTab === 'admin_banners' ||
    currentTab === 'admin_countdowns';

  const navItems: Array<{ id: string; label: string; isActive: boolean; onClick: () => void }> = [
    {
      id: 'admin_overview',
      label: 'Tổng quan',
      isActive: currentTab === 'admin_overview' || currentTab === 'admin_users' || currentTab === 'submissions',
      onClick: () => {
        setCurrentTab('admin_overview');
        setActiveClassId(null);
        onResetEditing?.();
        setIsMobileMenuOpen(false);
      },
    },
    {
      id: 'admin_classes',
      label: 'Lớp học',
      isActive: currentTab === 'admin_classes',
      onClick: () => {
        setCurrentTab('admin_classes');
        setActiveClassId(null);
        onResetEditing?.();
        setIsMobileMenuOpen(false);
      },
    },
    {
      id: 'admin_topics',
      label: 'Kho bài',
      isActive: currentTab === 'admin_topics',
      onClick: () => {
        setCurrentTab('admin_topics');
        setActiveClassId(null);
        onResetEditing?.();
        setIsMobileMenuOpen(false);
      },
    },
    {
      id: 'admin_student_home',
      label: 'Trang chủ học sinh',
      isActive: isStudentHomeActive,
      onClick: () => {
        setCurrentTab('admin_student_home');
        setActiveClassId(null);
        onResetEditing?.();
        setIsMobileMenuOpen(false);
      },
    },
  ];

  const defaultBreadcrumbLabel = (() => {
    if (currentTab === 'admin_overview') return 'Tổng quan';
    if (currentTab === 'admin_classes') return 'Lớp học';
    if (currentTab === 'admin_topics') return 'Kho bài';
    if (isStudentHomeActive) return 'Trang chủ học sinh';
    if (currentTab === 'admin_users') return 'Tài khoản học sinh';
    if (currentTab === 'submissions') return 'Lịch sử nộp bài';
    return 'Tổng quan';
  })();

  return (
    <div
      className="gv2-shell min-h-screen h-screen flex overflow-hidden antialiased bg-[#F4F0E8] text-[#1F1D1A]"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {/* Backdrop mobile */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
        />
      )}

      {/* 1. SIDEBAR GV v2 (#EFE9DC, 232px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[232px] h-full md:h-screen shrink-0 bg-[#EFE9DC] text-[#1F1D1A] border-r border-[#D9D2C3] flex flex-col px-[14px] py-6 md:static transition-transform duration-200 select-none ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {/* Logo */}
          <div className="px-3 pb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setCurrentTab('admin_overview');
                setActiveClassId(null);
                onResetEditing?.();
                setIsMobileMenuOpen(false);
              }}
              className="text-[18px] font-bold tracking-tight text-[#1F1D1A] cursor-pointer text-left"
            >
              FAMINH <span className="text-[#B4281F]">Teacher</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-[#6B655C] hover:text-[#1F1D1A]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 4 mục điều hướng chính */}
          <nav className="space-y-0.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`w-full text-left block px-3 py-[9px] rounded-[6px] text-[15px] transition-colors cursor-pointer ${
                  item.isActive
                    ? 'bg-[#E2DAC8] text-[#1F1D1A] font-semibold'
                    : 'text-[#3A362F] hover:bg-[#E6DFD0] hover:text-[#1F1D1A] font-medium'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Nhóm Hệ thống */}
          <div className="text-[12px] text-[#6B655C] mt-[22px] mb-[6px] mx-3 font-medium">
            Hệ thống
          </div>

          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setIsServerConfigModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left block px-3 py-[9px] rounded-[6px] text-[15px] text-[#3A362F] hover:bg-[#E6DFD0] hover:text-[#1F1D1A] font-medium transition-colors cursor-pointer"
            >
              Máy chủ chấm
            </button>

            <button
              type="button"
              onClick={() => {
                setIsBackupModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left block px-3 py-[9px] rounded-[6px] text-[15px] text-[#3A362F] hover:bg-[#E6DFD0] hover:text-[#1F1D1A] font-medium transition-colors cursor-pointer"
            >
              Sao lưu &amp; khôi phục
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="w-full text-left flex items-center justify-between px-3 py-[9px] rounded-[6px] text-[15px] text-[#3A362F] hover:bg-[#E6DFD0] hover:text-[#1F1D1A] font-medium transition-colors cursor-pointer"
            >
              <span>Giao diện</span>
              <span className="text-[12px] text-[#6B655C] font-normal">
                {theme === 'dark' ? 'Tối' : 'Sáng'}
              </span>
            </button>
          </div>
        </div>

        {/* Chân sidebar: Email & Đăng xuất */}
        <div className="pt-3.5 px-3 border-t border-[#D9D2C3] text-[13px] shrink-0">
          <div className="font-bold text-[#1F1D1A] truncate" title={displayEmail}>
            {displayEmail}
          </div>
          <div className="mt-0.5">
            <button
              type="button"
              onClick={handleLogout}
              className="text-[#6B655C] hover:text-[#B4281F] underline underline-offset-[3px] cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* 2. VÙNG NỘI DUNG CHÍNH (#F4F0E8) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#F4F0E8]">
        {/* Top Bar 64px */}
        <header
          data-studio-header
          className="h-16 min-h-16 shrink-0 border-b border-[#D9D2C3] bg-[#F4F0E8] px-6 sm:px-10 lg:px-12 flex items-center justify-between gap-4 sticky top-0 z-20"
        >
          <div className="flex items-center gap-3 min-w-0 text-[15px] text-[#6B655C]">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-[#1F1D1A] hover:bg-[#E6DFD0]"
              aria-label="Mở menu điều hướng"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="truncate">
              {breadcrumb ?? <span>{defaultBreadcrumbLabel}</span>}
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenStudentView}
            className="text-[15px] text-[#1F1D1A] hover:text-[#B4281F] underline underline-offset-[3px] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Xem như học sinh ↗
          </button>
        </header>

        {/* Nội dung chính */}
        <main className="flex-1 overflow-y-auto min-h-0 bg-[#F4F0E8] px-6 sm:px-10 lg:px-12 py-8 sm:py-10 pb-16">
          {children}
        </main>
      </div>

      {/* Modal Sao lưu & Khôi phục gọn gàng */}
      {isBackupModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
          onClick={() => setIsBackupModalOpen(false)}
        >
          <div
            className="banner-editorial-page w-full max-w-md rounded-xl bg-[#FFFDF8] border border-[#D9D2C3] p-6 shadow-xl text-[#1F1D1A] space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[20px] font-bold text-[#1F1D1A]">Sao lưu &amp; khôi phục</h3>
                <p className="text-[13.5px] text-[#6B655C] mt-1">
                  Xuất bản sao lưu cấu hình lớp, chủ đề, bài tập hiện tại hoặc đặt lại bộ nhớ tạm trên máy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="p-1 text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 border-t border-[#D9D2C3] pt-4">
              <div className="flex items-center justify-between gap-4 py-1">
                <div>
                  <div className="font-semibold text-[14px] text-[#1F1D1A]">Xuất sao lưu JSON</div>
                  <div className="text-[12.5px] text-[#6B655C]">
                    {classes.length} lớp · {topics.length} chủ đề · {problems.length} bài tập
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-4 py-2 rounded-lg border-[1.5px] border-[#1F1D1A] text-[13.5px] font-semibold text-[#1F1D1A] hover:bg-[#E9E2D3] transition-colors cursor-pointer shrink-0"
                >
                  Tải về (.json)
                </button>
              </div>

              <div className="border-t border-[#D9D2C3] pt-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-[14px] text-[#1F1D1A]">Khôi phục mặc định</div>
                  <div className="text-[12.5px] text-[#6B655C]">
                    Xóa cache cục bộ trên trình duyệt này và tải lại dữ liệu sạch.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetConfirm}
                  className="px-4 py-2 rounded-lg bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[13.5px] font-semibold transition-colors cursor-pointer shrink-0"
                >
                  Khôi phục
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
