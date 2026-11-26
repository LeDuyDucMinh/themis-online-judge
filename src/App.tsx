import { useState, useEffect, useMemo } from 'react';
import { JudgeProvider, useJudge } from './context/JudgeContext';
import { Navbar } from './components/common/Navbar';
import { ToastContainer } from './components/common/Toast';
import { UserProblemList } from './components/user/UserProblemList';
import { ProblemView } from './components/user/ProblemView';
import { SubmissionHistory } from './components/user/SubmissionHistory';
import { StudentClassList } from './components/user/StudentClassList';
import { TeacherClassList } from './components/admin/TeacherClassList';
import { TeacherClassDetail, type TeacherClassV2Tab } from './components/admin/TeacherClassDetail';
import { TeacherOverview } from './components/admin/TeacherOverview';
import { ProblemBank, type ProblemBankFilterMode } from './components/admin/ProblemBank';
import { TeacherProblemWorkspace } from './components/admin/TeacherProblemWorkspace';
import { StudentHomeManager } from './components/admin/StudentHomeManager';
import { UserManager } from './components/admin/UserManager';
import { AdminLayout, type AdminTabType } from './components/admin/AdminLayout';
import { AuthModal } from './components/auth/AuthModal';
import { SessionRevokedModal } from './components/common/SessionRevokedModal';
import { ChangeNameModal } from './components/user/ChangeNameModal';
import { ServerConfigModal } from './components/admin/ServerConfigModal';
import { ConfirmModal } from './components/common/ConfirmModal';
import type { Problem } from './types/judge';
import { Heart } from 'lucide-react';

import { storageService } from './services/storageService';

const ADMIN_TABS: AdminTabType[] = [
  'admin_overview',
  'admin_classes',
  'admin_topics',
  'admin_student_home',
  'admin_users',
  'admin_banners',
  'admin_countdowns',
];

function isAdminOnlyTab(tab: AdminTabType): boolean {
  return ADMIN_TABS.includes(tab);
}

function MainApp() {
  const {
    isAdminAuthenticated,
    isAuthLoading,
    setIsAuthModalOpen,
    classes,
    activeClassId,
    setActiveClassId,
    isServerConfigModalOpen,
    setIsServerConfigModalOpen,
    problems,
    refreshAllData,
    showToast,
  } = useJudge();

  const [currentTab, setCurrentTab] = useState<AdminTabType>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash.startsWith('submissions')) return 'submissions';
      if (hash.startsWith('admin/countdowns')) return 'admin_student_home';
      if (hash.startsWith('admin/banners')) return 'admin_student_home';
      if (hash.startsWith('admin/student-home')) return 'admin_student_home';
      if (hash.startsWith('admin/users')) return 'admin_users';
      if (hash.startsWith('admin/topics') || hash.startsWith('admin/problems')) return 'admin_topics';
      if (hash.startsWith('admin/classes')) return 'admin_classes';
      if (hash.startsWith('admin/overview') || hash === 'admin') return 'admin_overview';
      if (hash.startsWith('classes')) return 'classes';
    }
    const saved = storageService.getCurrentTab() as AdminTabType | null;
    if (saved === 'submissions') return 'submissions';
    if (isAdminAuthenticated) {
      if (saved === 'admin_banners' || saved === 'admin_countdowns') return 'admin_student_home';
      if (saved && isAdminOnlyTab(saved)) return saved;
      return 'admin_overview';
    }
    return 'classes';
  });

  // Trạng thái điều hướng phụ cho giao diện GV v2
  const [studentHomeSubTab, setStudentHomeSubTab] = useState<'banners' | 'countdowns'>(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('countdowns')) {
      return 'countdowns';
    }
    return 'banners';
  });
  const [problemBankFilter, setProblemBankFilter] = useState<ProblemBankFilterMode>('all');
  const [classInitialTab, setClassInitialTab] = useState<TeacherClassV2Tab>('students');
  const [classFilterZeroAc, setClassFilterZeroAc] = useState(false);

  // Trang Sửa bài một trang (GV v2)
  const [editingProblemId, setEditingProblemId] = useState<string | 'NEW' | null>(null);
  const [editingProblemFocus, setEditingProblemFocus] = useState<'info' | 'de' | 'test' | 'giao' | undefined>(
    undefined
  );
  const [editingOriginTab, setEditingOriginTab] = useState<AdminTabType>('admin_topics');

  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(() => {
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
    const savedProblemId = storageService.getSelectedProblemId();
    if (savedProblemId) {
      const list = storageService.getProblems();
      return list.find((p) => p.id === savedProblemId) || null;
    }
    return null;
  });

  useEffect(() => {
    const savedProblemId = storageService.getSelectedProblemId();
    if (savedProblemId && problems.length > 0) {
      const found = problems.find((p) => p.id === savedProblemId);
      if (found && (!selectedProblem || selectedProblem.id !== found.id)) {
        setSelectedProblem(found);
      }
    }
  }, [problems]);

  const activeSelectedProblem = useMemo(() => {
    if (!selectedProblem) return null;
    return problems.find((p) => p.id === selectedProblem.id) || selectedProblem;
  }, [selectedProblem, problems]);

  const activeClassObj = useMemo(
    () => (activeClassId ? classes.find((c) => c.id === activeClassId) || null : null),
    [activeClassId, classes]
  );

  const editingProblemObj = useMemo(
    () =>
      editingProblemId && editingProblemId !== 'NEW'
        ? problems.find((p) => p.id === editingProblemId) || null
        : null,
    [editingProblemId, problems]
  );

  // Route Guard cho khu vực Admin
  useEffect(() => {
    if (isAuthLoading) return;

    const currentHash = typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '') : '';
    const currentPath = typeof window !== 'undefined' ? window.location.pathname.replace(/^\//, '') : '';
    const isTargetingAdmin =
      currentHash.startsWith('admin') ||
      currentPath.startsWith('admin') ||
      isAdminOnlyTab(currentTab);

    if (isTargetingAdmin && !isAdminAuthenticated) {
      console.warn('[Route Guard] Chặn truy cập trái phép vào khu vực Admin. Chuyển hướng về trang chủ.');
      setCurrentTab('classes');
      storageService.setCurrentTab('classes');
      setActiveClassId(null);
      setSelectedProblem(null);
      setEditingProblemId(null);

      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/#classes');
      }

      showToast(
        'Từ chối truy cập',
        'Khu vực Quản trị viên chỉ dành cho tài khoản Admin đã được cấp quyền. Đã chuyển về trang chủ.',
        'error'
      );
    }
  }, [isAdminAuthenticated, isAuthLoading, currentTab]);

  // Đặt màn hình mặc định theo vai trò (Giáo viên -> Tổng quan GV v2; Học sinh -> Lớp học của tôi)
  useEffect(() => {
    if (isAuthLoading) return;
    if (isAdminAuthenticated) {
      if (currentTab === 'classes' || currentTab === 'problems') {
        setCurrentTab('admin_overview');
        storageService.setCurrentTab('admin_overview');
      }
      setSelectedProblem(null);
      storageService.setSelectedProblemId(null);
    } else {
      if (isAdminOnlyTab(currentTab)) {
        setCurrentTab('classes');
        storageService.setCurrentTab('classes');
      }
    }
  }, [isAdminAuthenticated, isAuthLoading, currentTab]);

  // Đồng bộ URL Hash & localStorage
  useEffect(() => {
    if (isAuthLoading) return;

    let targetHash = '';
    if (isAdminAuthenticated) {
      if (editingProblemId) {
        targetHash =
          editingProblemId === 'NEW'
            ? '#admin/problems/new'
            : `#admin/problems/${editingProblemId}`;
      } else if (currentTab === 'admin_overview') {
        targetHash = '#admin/overview';
      } else if (currentTab === 'admin_users') {
        targetHash = '#admin/users';
      } else if (
        currentTab === 'admin_student_home' ||
        currentTab === 'admin_banners' ||
        currentTab === 'admin_countdowns'
      ) {
        targetHash =
          studentHomeSubTab === 'countdowns' ? '#admin/countdowns' : '#admin/student-home';
      } else if (currentTab === 'admin_classes') {
        targetHash = activeClassId ? `#admin/classes/${activeClassId}` : '#admin/classes';
      } else if (currentTab === 'admin_topics') {
        targetHash = '#admin/topics';
      } else if (currentTab === 'submissions') {
        targetHash = '#submissions';
      } else {
        targetHash = '#admin/overview';
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
  }, [
    currentTab,
    activeClassId,
    selectedProblem,
    editingProblemId,
    studentHomeSubTab,
    isAdminAuthenticated,
    isAuthLoading,
  ]);

  // Lắng nghe hashchange
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash.startsWith('submissions')) {
        setEditingProblemId(null);
        setCurrentTab('submissions');
        storageService.setCurrentTab('submissions');
      } else if (hash.startsWith('admin')) {
        if (!isAdminAuthenticated) {
          window.history.replaceState(null, '', '/#classes');
          setCurrentTab('classes');
          storageService.setCurrentTab('classes');
          showToast(
            'Từ chối truy cập',
            'Tài khoản không có quyền Quản trị viên hoặc Giáo viên. Đã chuyển về trang chủ.',
            'error'
          );
          return;
        }

        if (hash.startsWith('admin/countdowns')) {
          setEditingProblemId(null);
          setStudentHomeSubTab('countdowns');
          setCurrentTab('admin_student_home');
        } else if (hash.startsWith('admin/banners') || hash.startsWith('admin/student-home')) {
          setEditingProblemId(null);
          setStudentHomeSubTab('banners');
          setCurrentTab('admin_student_home');
        } else if (hash.startsWith('admin/users')) {
          setEditingProblemId(null);
          setCurrentTab('admin_users');
          setActiveClassId(null);
        } else if (hash.startsWith('admin/topics') || hash.startsWith('admin/problems')) {
          setCurrentTab('admin_topics');
          const m = hash.match(/^admin\/problems\/([^/?#]+)/);
          if (m && m[1]) {
            setEditingProblemId(m[1] === 'new' ? 'NEW' : m[1]);
          } else {
            setEditingProblemId(null);
          }
        } else if (hash.startsWith('admin/classes')) {
          setEditingProblemId(null);
          setCurrentTab('admin_classes');
          const classMatch = hash.match(/^admin\/classes\/([^/?#]+)/);
          setActiveClassId(classMatch && classMatch[1] ? classMatch[1] : null);
        } else {
          setEditingProblemId(null);
          setActiveClassId(null);
          setCurrentTab('admin_overview');
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
              const found = problems.find(
                (p) => p.id === pId || p.code?.toLowerCase() === pId.toLowerCase()
              );
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

  useEffect(() => {
    refreshAllData().catch(() => {});
  }, [currentTab, activeClassId]);

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

  // Điều hướng GV v2 dùng chung
  const handleOpenProblemEditor = (
    problemId: string | 'NEW',
    focusSection?: 'info' | 'de' | 'test' | 'giao'
  ) => {
    setEditingOriginTab(currentTab);
    setEditingProblemId(problemId);
    setEditingProblemFocus(focusSection);
    setCurrentTab('admin_topics');
  };

  const handleCloseProblemEditor = () => {
    setEditingProblemId(null);
    setEditingProblemFocus(undefined);
    if (editingOriginTab === 'admin_classes' && activeClassId) {
      setCurrentTab('admin_classes');
    } else if (editingOriginTab === 'admin_overview') {
      setCurrentTab('admin_overview');
    } else {
      setCurrentTab('admin_topics');
    }
  };

  const handleOpenClassFromV2 = (
    classId: string,
    options?: { tab?: TeacherClassV2Tab; filterZeroAc?: boolean }
  ) => {
    setEditingProblemId(null);
    setClassInitialTab(options?.tab || 'students');
    setClassFilterZeroAc(Boolean(options?.filterZeroAc));
    setActiveClassId(classId);
    setCurrentTab('admin_classes');
  };

  const handleNavigateV2Tab = (
    tab: AdminTabType,
    options?: {
      studentHomeSubTab?: 'banners' | 'countdowns';
      problemBankFilter?: ProblemBankFilterMode;
    }
  ) => {
    setEditingProblemId(null);
    if (options?.studentHomeSubTab) {
      setStudentHomeSubTab(options.studentHomeSubTab);
    }
    if (options?.problemBankFilter) {
      setProblemBankFilter(options.problemBankFilter);
    } else if (tab === 'admin_topics') {
      setProblemBankFilter('all');
    }
    if (tab !== 'admin_classes') {
      setActiveClassId(null);
    }
    setCurrentTab(tab);
  };

  // Breadcrumb động chuẩn GV v2 trên top bar
  const adminBreadcrumb = useMemo(() => {
    if (editingProblemId) {
      const label = editingProblemId === 'NEW' ? 'Bài mới' : editingProblemObj?.code || 'Sửa bài';
      return (
        <span>
          <button
            type="button"
            onClick={() => {
              setEditingProblemId(null);
              setCurrentTab('admin_topics');
            }}
            className="underline underline-offset-[3px] hover:text-[#1F1D1A] cursor-pointer"
          >
            Kho bài
          </button>{' '}
          / <span className="text-[#1F1D1A] font-medium font-mono">{label}</span>
        </span>
      );
    }

    if (currentTab === 'admin_classes' && activeClassObj) {
      return (
        <span>
          <button
            type="button"
            onClick={() => setActiveClassId(null)}
            className="underline underline-offset-[3px] hover:text-[#1F1D1A] cursor-pointer"
          >
            Lớp học
          </button>{' '}
          / <span className="text-[#1F1D1A] font-medium">{activeClassObj.className}</span>
        </span>
      );
    }

    if (currentTab === 'admin_users') {
      return (
        <span>
          <button
            type="button"
            onClick={() => setCurrentTab('admin_overview')}
            className="underline underline-offset-[3px] hover:text-[#1F1D1A] cursor-pointer"
          >
            Tổng quan
          </button>{' '}
          / <span className="text-[#1F1D1A] font-medium">Tài khoản học sinh</span>
        </span>
      );
    }

    if (currentTab === 'submissions') {
      return (
        <span>
          <button
            type="button"
            onClick={() => setCurrentTab('admin_overview')}
            className="underline underline-offset-[3px] hover:text-[#1F1D1A] cursor-pointer"
          >
            Tổng quan
          </button>{' '}
          / <span className="text-[#1F1D1A] font-medium">Lịch sử nộp bài</span>
        </span>
      );
    }

    return undefined;
  }, [editingProblemId, editingProblemObj, currentTab, activeClassObj, setActiveClassId]);

  return (
    <>
      <ToastContainer />
      <SessionRevokedModal />
      <AuthModal />
      <ChangeNameModal />
      <ServerConfigModal
        isOpen={isServerConfigModalOpen}
        onClose={() => setIsServerConfigModalOpen(false)}
      />
      <ConfirmModal />

      {/* GIAO DIỆN GIÁO VIÊN GV v2 */}
      {isAdminAuthenticated ? (
        <AdminLayout
          currentTab={currentTab}
          setCurrentTab={(tab) => handleNavigateV2Tab(tab)}
          breadcrumb={adminBreadcrumb}
          onResetEditing={() => {
            setEditingProblemId(null);
            setEditingProblemFocus(undefined);
          }}
        >
          {/* Trang Sửa bài một trang (ưu tiên hiển thị khi đang mở bài) */}
          {editingProblemId ? (
            <TeacherProblemWorkspace
              key={editingProblemId}
              problemId={editingProblemId}
              initialClassId={activeClassId || undefined}
              focusSection={editingProblemFocus}
              onClose={handleCloseProblemEditor}
              onSavedProblemId={(newId) => setEditingProblemId(newId)}
            />
          ) : (
            <>
              {/* 1. Tổng quan */}
              {currentTab === 'admin_overview' && (
                <TeacherOverview
                  onOpenProblemEditor={handleOpenProblemEditor}
                  onOpenClass={handleOpenClassFromV2}
                  onNavigateTab={handleNavigateV2Tab}
                  onOpenServerConfig={() => setIsServerConfigModalOpen(true)}
                />
              )}

              {/* 2. Lớp học */}
              {currentTab === 'admin_classes' &&
                (activeClassId ? (
                  <TeacherClassDetail
                    classId={activeClassId}
                    initialTab={classInitialTab}
                    initialFilterZeroAc={classFilterZeroAc}
                    onOpenProblemEditor={handleOpenProblemEditor}
                  />
                ) : (
                  <TeacherClassList />
                ))}

              {/* 3. Kho bài */}
              {currentTab === 'admin_topics' && (
                <ProblemBank
                  initialFilter={problemBankFilter}
                  onOpenProblemEditor={handleOpenProblemEditor}
                  onOpenClass={(clsId) => handleOpenClassFromV2(clsId, { tab: 'assignments' })}
                />
              )}

              {/* 4. Trang chủ học sinh (Banner + Đếm ngược kỳ thi) */}
              {(currentTab === 'admin_student_home' ||
                currentTab === 'admin_banners' ||
                currentTab === 'admin_countdowns') && (
                <StudentHomeManager
                  initialSubTab={
                    currentTab === 'admin_countdowns'
                      ? 'countdowns'
                      : currentTab === 'admin_banners'
                      ? 'banners'
                      : studentHomeSubTab
                  }
                />
              )}

              {/* Trang phụ mở từ Tổng quan: Toàn bộ tài khoản học sinh */}
              {currentTab === 'admin_users' && <UserManager />}

              {/* Trang phụ mở từ Tổng quan: Toàn bộ lịch sử nộp bài */}
              {currentTab === 'submissions' && <SubmissionHistory />}
            </>
          )}
        </AdminLayout>
      ) : (
        /* GIAO DIỆN HỌC SINH (USER): GIỮ NGUYÊN 100% */
        <div className="min-h-screen flex flex-col fj-student-root selection:bg-[#B4281F] selection:text-white">
          <Navbar
            currentTab={currentTab}
            setCurrentTab={(tab) => {
              if (isAuthLoading) return;
              if (isAdminOnlyTab(tab) && !isAdminAuthenticated) {
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

          <main className="flex-1">
            {currentTab === 'classes' &&
              (activeClassId ? (
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
                <StudentClassList onSelectProblem={handleSelectProblem} />
              ))}

            {currentTab === 'submissions' && <SubmissionHistory />}
          </main>

          <footer className="border-t border-[#D9D2C3] bg-[#F4F0E8] py-6 text-xs text-[#6B655C]">
            <div className="fj-w flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1F1D1A]">
                  FAMINH <span style={{ color: '#B4281F' }}>Judge</span>
                </span>
                <span>— Nền tảng luyện thi &amp; Chấm bài tự động chuẩn Themis</span>
              </div>

              <div className="flex items-center gap-2 text-[#6B655C]">
                <span>Học sinh</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  Bản quyền thuộc <span className="font-semibold text-[#1F1D1A]">FAMINH</span>{' '}
                  <Heart className="w-3 h-3 text-[#B4281F] fill-[#B4281F]" />
                </span>
              </div>
            </div>
          </footer>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <JudgeProvider>
      <MainApp />
    </JudgeProvider>
  );
}
