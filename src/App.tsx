import { useState, useEffect, useMemo } from 'react';
import { JudgeProvider, useJudge } from './context/JudgeContext';
import { Navbar } from './components/common/Navbar';
import { ToastContainer } from './components/common/Toast';
import { UserProblemList } from './components/user/UserProblemList';
import { ProblemView } from './components/user/ProblemView';
import { SubmissionHistory } from './components/user/SubmissionHistory';
import { StudentClassList } from './components/user/StudentClassList';
import { TopicManager } from './components/admin/TopicManager';
import { TeacherClassList } from './components/admin/TeacherClassList';
import { TeacherClassDetail } from './components/admin/TeacherClassDetail';
import { AuthModal } from './components/auth/AuthModal';
import { ChangePasswordModal } from './components/admin/ChangePasswordModal';
import { ChangeNameModal } from './components/user/ChangeNameModal';
import { ServerConfigModal } from './components/admin/ServerConfigModal';
import { ConfirmModal } from './components/common/ConfirmModal';
import type { Problem } from './types/judge';
import { ShieldCheck, Heart } from 'lucide-react';

import { storageService } from './services/storageService';

function MainApp() {
  const {
    isAdminAuthenticated,
    isAuthLoading,
    setIsAuthModalOpen,
    theme,
    activeClassId,
    setActiveClassId,
    isServerConfigModalOpen,
    setIsServerConfigModalOpen,
    problems,
    refreshAllData,
  } = useJudge();

  const [currentTab, setCurrentTab] = useState<'classes' | 'problems' | 'admin_classes' | 'admin_topics' | 'submissions'>(() => {
    // 1. Ưu tiên đọc từ URL Hash khi người dùng tải lại trang
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash.startsWith('submissions')) return 'submissions';
      if (hash.startsWith('admin/topics')) return 'admin_topics';
      if (hash.startsWith('admin/classes') || hash.startsWith('admin')) return 'admin_classes';
      if (hash.startsWith('classes')) return 'classes';
    }
    // 2. Dự phòng đọc từ localStorage
    const saved = storageService.getCurrentTab();
    if (saved === 'submissions') return 'submissions';
    if (isAdminAuthenticated) {
      if (saved === 'admin_classes' || saved === 'admin_topics') return saved;
      return 'admin_classes';
    } else {
      if (saved === 'classes') return 'classes';
      return 'classes';
    }
  });

  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(() => {
    // 1. Ưu tiên đọc bài tập từ URL Hash nếu có dạng #classes/:classId/problems/:id
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '');
      const probMatch = hash.match(/problems\/([^/?#]+)/);
      if (probMatch && probMatch[1]) {
        const probId = probMatch[1];
        const list = storageService.getProblems();
        const found = list.find((p) => p.id === probId || p.code?.toLowerCase() === probId.toLowerCase());
        if (found) return found;
      }
    }
    // 2. Dự phòng đọc từ localStorage
    const savedProblemId = storageService.getSelectedProblemId();
    if (savedProblemId) {
      const list = storageService.getProblems();
      return list.find((p) => p.id === savedProblemId) || null;
    }
    return null;
  });

  // Cập nhật lại bài tập đang mở khi danh sách problems từ Cloud tải về
  useEffect(() => {
    const savedProblemId = storageService.getSelectedProblemId();
    if (savedProblemId && problems.length > 0) {
      const found = problems.find((p) => p.id === savedProblemId);
      if (found && (!selectedProblem || selectedProblem.id !== found.id)) {
        setSelectedProblem(found);
      }
    }
  }, [problems]);

  // Luôn lấy dữ liệu bài tập mới nhất (kèm test cases đầy đủ từ IndexedDB)
  const activeSelectedProblem = useMemo(() => {
    if (!selectedProblem) return null;
    return problems.find((p) => p.id === selectedProblem.id) || selectedProblem;
  }, [selectedProblem, problems]);

  // Điều hướng phân vùng & Đặt màn hình mặc định theo vai trò:
  // - Khi Giáo viên (ADMIN) đăng nhập: Mặc định mở tab "Quản lý Lớp học" (admin_classes)
  // - Khi Học sinh (USER): Mặc định mở tab "Lớp học của tôi" (classes)
  // - Tuyệt đối không can thiệp khi trạng thái xác thực đang tải (isAuthLoading)
  useEffect(() => {
    if (isAuthLoading) return;
    if (isAdminAuthenticated) {
      if (currentTab === 'classes' || currentTab === 'problems') {
        setCurrentTab('admin_classes');
        storageService.setCurrentTab('admin_classes');
      }
      setSelectedProblem(null);
      storageService.setSelectedProblemId(null);
    } else {
      if (currentTab === 'admin_classes' || currentTab === 'admin_topics') {
        setCurrentTab('classes');
        storageService.setCurrentTab('classes');
      }
    }
  }, [isAdminAuthenticated, isAuthLoading]);

  // Đồng bộ trạng thái điều hướng vào URL Hash & localStorage để khi F5 / Reload tải lại đúng trang hiện tại
  useEffect(() => {
    if (isAuthLoading) return;

    let targetHash = '';
    if (isAdminAuthenticated) {
      if (currentTab === 'admin_classes') {
        targetHash = activeClassId ? `#admin/classes/${activeClassId}` : '#admin/classes';
      } else if (currentTab === 'admin_topics') {
        targetHash = '#admin/topics';
      } else if (currentTab === 'submissions') {
        targetHash = '#submissions';
      } else {
        targetHash = '#admin/classes';
      }
    } else {
      if (currentTab === 'classes') {
        if (activeClassId) {
          if (selectedProblem) {
            targetHash = `#classes/${activeClassId}/problems/${selectedProblem.id}`;
          } else {
            targetHash = `#classes/${activeClassId}`;
          }
        } else {
          targetHash = '#classes';
        }
      } else if (currentTab === 'submissions') {
        targetHash = '#submissions';
      } else {
        targetHash = '#classes';
      }
    }

    if (targetHash && typeof window !== 'undefined') {
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    }
    storageService.setCurrentTab(currentTab);
  }, [currentTab, activeClassId, selectedProblem, isAdminAuthenticated, isAuthLoading]);

  // Lắng nghe sự kiện hashchange khi người dùng dùng nút Back/Forward của trình duyệt
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash.startsWith('submissions')) {
        setCurrentTab('submissions');
        storageService.setCurrentTab('submissions');
      } else if (hash.startsWith('admin/topics')) {
        if (isAdminAuthenticated) {
          setCurrentTab('admin_topics');
          storageService.setCurrentTab('admin_topics');
        }
      } else if (hash.startsWith('admin/classes')) {
        if (isAdminAuthenticated) {
          setCurrentTab('admin_classes');
          storageService.setCurrentTab('admin_classes');
          const classMatch = hash.match(/^admin\/classes\/([^/?#]+)/);
          if (classMatch && classMatch[1]) {
            setActiveClassId(classMatch[1]);
          } else {
            setActiveClassId(null);
          }
        }
      } else if (hash.startsWith('classes')) {
        if (!isAdminAuthenticated) {
          setCurrentTab('classes');
          storageService.setCurrentTab('classes');
          const classMatch = hash.match(/^classes\/([^/?#]+)/);
          if (classMatch && classMatch[1]) {
            setActiveClassId(classMatch[1]);
            const probMatch = hash.match(/problems\/([^/?#]+)/);
            if (probMatch && probMatch[1]) {
              const pId = probMatch[1];
              const found = problems.find((p) => p.id === pId || p.code?.toLowerCase() === pId.toLowerCase());
              if (found) setSelectedProblem(found);
            } else {
              setSelectedProblem(null);
            }
          } else {
            setActiveClassId(null);
            setSelectedProblem(null);
          }
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAdminAuthenticated, problems, setActiveClassId]);

  // Tự động làm mới dữ liệu từ hệ thống mỗi khi người dùng chuyển trang / tab
  useEffect(() => {
    refreshAllData().catch(() => {});
  }, [currentTab, activeClassId]);

  // Tự động làm mới dữ liệu khi người dùng quay lại tab trình duyệt
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshAllData().catch(() => {});
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);

  const handleSelectProblem = (p: Problem) => {
    setSelectedProblem(p);
    storageService.setSelectedProblemId(p.id);
  };

  const handleBackToList = () => {
    setSelectedProblem(null);
    storageService.setSelectedProblemId(null);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-red-600 selection:text-white transition-colors duration-150 ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      {/* Toast Notification Container */}
      <ToastContainer />

      {/* Supabase Auth & Admin Modals */}
      <AuthModal />
      <ChangePasswordModal />
      <ChangeNameModal />
      <ServerConfigModal
        isOpen={isServerConfigModalOpen}
        onClose={() => setIsServerConfigModalOpen(false)}
      />
      <ConfirmModal />

      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (isAuthLoading) return;
          if ((tab === 'admin_classes' || tab === 'admin_topics') && !isAdminAuthenticated) {
            setIsAuthModalOpen(true);
            return;
          }
          if ((tab === 'classes' || tab === 'problems') && isAdminAuthenticated) {
            return;
          }
          setCurrentTab(tab);
          storageService.setCurrentTab(tab);
          if (tab !== 'classes' && tab !== 'admin_classes') {
            setSelectedProblem(null);
            storageService.setSelectedProblemId(null);
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Phân vùng HỌC SINH (USER):
            1. Khi chưa chọn lớp: Hiển thị "Các lớp học đang tham gia" (StudentClassList)
            2. Khi đã chọn lớp: Hiển thị danh sách đề bài hoặc màn hình làm bài của lớp đó */}
        {!isAdminAuthenticated && currentTab === 'classes' && (
          activeClassId ? (
            activeSelectedProblem ? (
              <ProblemView
                problem={activeSelectedProblem}
                onBackToList={handleBackToList}
              />
            ) : (
              <UserProblemList
                onSelectProblem={handleSelectProblem}
                onBackToClasses={() => {
                  setActiveClassId(null);
                  setSelectedProblem(null);
                  storageService.setSelectedProblemId(null);
                  storageService.setActiveTopicId(null);
                }}
              />
            )
          ) : (
            <StudentClassList />
          )
        )}

        {/* Phân vùng GIÁO VIÊN (ADMIN):
            1. Khi chưa chọn lớp: Hiển thị "Danh sách Lớp học do tôi quản lý" dạng Grid (TeacherClassList)
            2. Khi đã chọn lớp: Chuyển sang màn hình Chi tiết Lớp học gồm 2 tab "Bài tập" & "Học sinh" (TeacherClassDetail) */}
        {isAdminAuthenticated && currentTab === 'admin_classes' && (
          activeClassId ? (
            <TeacherClassDetail classId={activeClassId} />
          ) : (
            <TeacherClassList />
          )
        )}

        {/* Phân vùng GIÁO VIÊN (ADMIN): Quản lý Chủ đề chung */}
        {isAdminAuthenticated && currentTab === 'admin_topics' && (
          <TopicManager />
        )}

        {/* Tab Lịch sử nộp bài (dành cho cả giáo viên theo dõi và học sinh xem lại) */}
        {currentTab === 'submissions' && (
          <SubmissionHistory />
        )}
      </main>


      {/* Footer FAMINH */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md overflow-hidden bg-slate-800 p-0.5 border border-red-500/30 shrink-0">
              <img src="/faminh-logo.jpg" alt="FAMINH" className="w-full h-full object-cover rounded-sm" />
            </div>
            <span className="font-bold text-slate-300">FAMINH Online Judge</span>
            <span>— Nền tảng luyện thi & Chấm bài tự động chuẩn Themis</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            {isAdminAuthenticated ? (
              <span className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-lg border text-xs shadow-sm ${
                theme === 'light'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-red-950/40 text-red-300 border-red-800/50'
              }`}>
                <ShieldCheck className="w-3.5 h-3.5" /> Quản trị viên
              </span>
            ) : (
              <span className="text-slate-400">Học sinh (User)</span>
            )}
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1">
              Bản quyền thuộc <span className="font-semibold text-slate-300">FAMINH</span> <Heart className="w-3 h-3 text-red-500 fill-red-500" />
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <JudgeProvider>
      <MainApp />
    </JudgeProvider>
  );
}
