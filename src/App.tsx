import { useState, useEffect } from 'react';
import { JudgeProvider, useJudge } from './context/JudgeContext';
import { Navbar } from './components/common/Navbar';
import { ToastContainer } from './components/common/Toast';
import { UserProblemList } from './components/user/UserProblemList';
import { ProblemView } from './components/user/ProblemView';
import { SubmissionHistory } from './components/user/SubmissionHistory';
import { TopicManager } from './components/admin/TopicManager';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminAuthModal } from './components/admin/AdminAuthModal';
import { ChangePasswordModal } from './components/admin/ChangePasswordModal';
import { StudentManagerModal } from './components/admin/StudentManagerModal';
import { ConfirmModal } from './components/common/ConfirmModal';
import type { Problem } from './types/judge';
import { ShieldCheck, Heart } from 'lucide-react';

function MainApp() {
  const { isAdminAuthenticated, setIsAuthModalOpen, theme } = useJudge();
  const [currentTab, setCurrentTab] = useState<'problems' | 'admin_topics' | 'admin_problems' | 'submissions'>(() => {
    return isAdminAuthenticated ? 'admin_topics' : 'problems';
  });
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);

  // Điều hướng phân vùng & Đặt màn hình mặc định theo vai trò:
  // - Khi Giáo viên (ADMIN) đăng nhập: Mặc định mở tab "Quản lý Chủ đề", ẩn hoàn toàn chức năng làm bài/luyện tập
  // - Khi Học sinh (USER): Mặc định mở tab "Luyện tập (Bài tập)", chặn mọi quyền truy cập vào các tab quản lý
  useEffect(() => {
    if (isAdminAuthenticated) {
      if (currentTab === 'problems') {
        setCurrentTab('admin_topics');
      }
      setSelectedProblem(null);
    } else {
      if (currentTab === 'admin_topics' || currentTab === 'admin_problems') {
        setCurrentTab('problems');
      }
    }
  }, [isAdminAuthenticated]);

  const handleSelectProblem = (p: Problem) => {
    setSelectedProblem(p);
  };

  const handleBackToList = () => {
    setSelectedProblem(null);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-red-600 selection:text-white transition-colors duration-150 ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      {/* Toast Notification Container */}
      <ToastContainer />

      {/* Admin Auth, Student Manager & Change Password Modals */}
      <AdminAuthModal />
      <ChangePasswordModal />
      <StudentManagerModal />
      <ConfirmModal />

      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if ((tab === 'admin_topics' || tab === 'admin_problems') && !isAdminAuthenticated) {
            setIsAuthModalOpen(true);
            return;
          }
          if (tab === 'problems' && isAdminAuthenticated) {
            return; // Giáo viên không truy cập tab luyện tập
          }
          setCurrentTab(tab);
          if (tab !== 'problems') {
            setSelectedProblem(null);
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Phân vùng HỌC SINH (USER): Làm bài, xem danh sách chủ đề & Banner luyện tập */}
        {!isAdminAuthenticated && currentTab === 'problems' && (
          selectedProblem ? (
            <ProblemView
              problem={selectedProblem}
              onBackToList={handleBackToList}
            />
          ) : (
            <UserProblemList onSelectProblem={handleSelectProblem} />
          )
        )}

        {/* Phân vùng GIÁO VIÊN (ADMIN): Quản lý Chủ đề (Màn hình mặc định) */}
        {isAdminAuthenticated && currentTab === 'admin_topics' && (
          <TopicManager />
        )}

        {/* Phân vùng GIÁO VIÊN (ADMIN): Quản lý Đề bài, Test Cases & Video */}
        {isAdminAuthenticated && currentTab === 'admin_problems' && (
          <AdminDashboard />
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
