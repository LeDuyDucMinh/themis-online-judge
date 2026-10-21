import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { UserRole, Topic, Problem, Submission, UserStats, StudentUser } from '../types/judge';
import { storageService, INITIAL_TOPICS, INITIAL_PROBLEMS } from '../services/storageService';
import { gradeSubmission, type GradingProgressCallback, type SupportedLanguage } from '../services/judgeEngine';
import confetti from 'canvas-confetti';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

interface JudgeContextType {
  role: UserRole;
  isAdminAuthenticated: boolean;
  currentStudent: StudentUser | null;
  students: StudentUser[];
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalTab: 'student' | 'admin';
  setAuthModalTab: (tab: 'student' | 'admin') => void;
  isStudentModalOpen: boolean;
  setIsStudentModalOpen: (open: boolean) => void;
  isChangePasswordModalOpen: boolean;
  setIsChangePasswordModalOpen: (open: boolean) => void;

  // Theme (Dark / Light)
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // Centered Confirm Dialog
  confirmModalState: ConfirmModalState;
  openConfirmModal: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }) => void;
  closeConfirmModal: () => void;

  // Student Auth & Management Actions
  loginStudent: (username: string, password: string) => { success: boolean; message: string };
  logoutStudent: () => void;
  addStudent: (fullName: string, username: string, password: string) => { success: boolean; message: string };
  deleteStudent: (id: string) => void;

  // Admin Auth Actions
  loginAdmin: (password: string) => { success: boolean; message: string };
  logoutAdmin: () => void;
  changeAdminPassword: (oldPass: string, newPass: string) => { success: boolean; message: string };

  // Data
  topics: Topic[];
  problems: Problem[];
  submissions: Submission[];
  activeProblem: Problem | null;
  setActiveProblem: (problem: Problem | null) => void;
  activeTopicId: string | null;
  setActiveTopicId: (topicId: string | null) => void;
  stats: UserStats;
  toasts: ToastMessage[];
  showToast: (title: string, message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;

  // Actions
  addTopic: (topic: Omit<Topic, 'id'>) => void;
  updateTopic: (id: string, topic: Partial<Topic>) => void;
  deleteTopic: (id: string) => void;
  reorderTopics: (topicIds: string[]) => void;

  addProblem: (problem: Omit<Problem, 'id' | 'createdAt' | 'updatedAt'>) => Problem;
  updateProblem: (id: string, problem: Partial<Problem>) => void;
  deleteProblem: (id: string) => void;

  submitCode: (
    problemId: string,
    code: string,
    language: SupportedLanguage,
    onProgress?: GradingProgressCallback
  ) => Promise<Submission>;

  getProblemStatus: (problemId: string) => 'UNSOLVED' | 'PARTIAL' | 'SOLVED';
  resetAllData: () => void;
}

const JudgeContext = createContext<JudgeContextType | undefined>(undefined);

export const JudgeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('faminh_judge_theme_v1');
    return (saved as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('faminh_judge_theme_v1', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Centered Confirm Modal State
  const [confirmModalState, setConfirmModalState] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Xác nhận xóa',
    onConfirm: () => {},
  });

  const openConfirmModal = (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }) => {
    setConfirmModalState({
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel || 'Xác nhận xóa',
      onConfirm: options.onConfirm,
    });
  };

  const closeConfirmModal = () => {
    setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
  };

  // Mặc định luôn là USER để học sinh không thể truy cập trái phép
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return storageService.isAdminSessionActive();
  });
  const [currentStudent, setCurrentStudent] = useState<StudentUser | null>(() => {
    return storageService.getStudentSession();
  });
  const [students, setStudents] = useState<StudentUser[]>(() => {
    return storageService.getStudents();
  });
  const [role, setRole] = useState<UserRole>(() => {
    return storageService.isAdminSessionActive() ? 'ADMIN' : 'USER';
  });

  // Bắt buộc Đăng nhập khi vào web: Nếu chưa có phiên Admin hoặc Học sinh thì tự động bật modal
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => {
    return !storageService.isAdminSessionActive() && !storageService.getStudentSession();
  });
  const [authModalTab, setAuthModalTab] = useState<'student' | 'admin'>('student');
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  const [topics, setTopics] = useState<Topic[]>(() => storageService.getTopics());
  const [problems, setProblems] = useState<Problem[]>(() => storageService.getProblems());
  const [submissions, setSubmissions] = useState<Submission[]>(() => storageService.getSubmissions());
  const [activeProblem, setActiveProblem] = useState<Problem | null>(() => {
    const list = storageService.getProblems();
    return list.length > 0 ? list[0] : null;
  });
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [stats, setStats] = useState<UserStats>(() => storageService.getUserStats());

  useEffect(() => {
    storageService.saveTopics(topics);
  }, [topics]);

  useEffect(() => {
    storageService.saveProblems(problems);
  }, [problems]);

  useEffect(() => {
    setStats(storageService.getUserStats(isAdminAuthenticated ? null : currentStudent));
  }, [submissions, isAdminAuthenticated, currentStudent]);

  const showToast = (title: string, message: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Học sinh Đăng nhập
  const loginStudent = (username: string, password: string): { success: boolean; message: string } => {
    if (!username.trim() || !password.trim()) {
      return { success: false, message: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu!' };
    }

    const currentList = storageService.getStudents();
    const found = currentList.find(
      (s) => s.username.toLowerCase() === username.trim().toLowerCase() && s.password === password.trim()
    );

    if (found) {
      setCurrentStudent(found);
      storageService.setStudentSession(found);
      // Hủy quyền admin nếu có
      setIsAdminAuthenticated(false);
      setRole('USER');
      storageService.setAdminSessionActive(false);
      setIsAuthModalOpen(false);
      showToast(
        'Đăng nhập thành công',
        `Chào mừng học sinh ${found.fullName}! Chúc em luyện tập đạt kết quả tốt nhất.`,
        'success'
      );
      return { success: true, message: 'Đăng nhập thành công' };
    } else {
      return {
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu học sinh không chính xác! Vui lòng liên hệ Giáo viên nếu quên thông tin.',
      };
    }
  };

  // Học sinh Đăng xuất
  const logoutStudent = () => {
    setCurrentStudent(null);
    storageService.setStudentSession(null);
    setIsAuthModalOpen(true);
    setAuthModalTab('student');
    showToast('Đã đăng xuất', 'Đã đăng xuất tài khoản học sinh.', 'info');
  };

  // Giáo viên tạo tài khoản Học sinh mới
  const addStudent = (fullName: string, username: string, password: string): { success: boolean; message: string } => {
    if (!fullName.trim() || !username.trim() || !password.trim()) {
      return { success: false, message: 'Vui lòng điền đầy đủ Họ và tên, Tên đăng nhập và Mật khẩu!' };
    }
    const cleanUsername = username.trim().toLowerCase();
    const currentList = storageService.getStudents();
    if (currentList.some((s) => s.username.toLowerCase() === cleanUsername)) {
      return { success: false, message: `Tên đăng nhập "${cleanUsername}" đã tồn tại! Vui lòng chọn tên khác.` };
    }

    const newStudent: StudentUser = {
      id: `student_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fullName: fullName.trim(),
      username: cleanUsername,
      password: password.trim(),
      createdAt: new Date().toISOString(),
    };

    storageService.addStudent(newStudent);
    setStudents(storageService.getStudents());
    showToast('Cấp tài khoản thành công', `Đã tạo tài khoản cho học sinh ${newStudent.fullName} (${newStudent.username})`, 'success');
    return { success: true, message: 'Tạo tài khoản thành công' };
  };

  // Giáo viên xóa tài khoản Học sinh
  const deleteStudent = (id: string) => {
    storageService.deleteStudent(id);
    setStudents(storageService.getStudents());
    if (currentStudent?.id === id) {
      setCurrentStudent(null);
      storageService.setStudentSession(null);
      setIsAuthModalOpen(true);
    }
    showToast('Đã xóa', 'Đã xóa tài khoản học sinh khỏi danh sách.', 'info');
  };

  const loginAdmin = (password: string): { success: boolean; message: string } => {
    if (!password) {
      return { success: false, message: 'Vui lòng nhập mật mã quản trị viên!' };
    }

    const isValid = storageService.verifyAdminPassword(password);
    if (isValid) {
      setIsAdminAuthenticated(true);
      setRole('ADMIN');
      storageService.setAdminSessionActive(true);
      // Hủy session học sinh nếu đang đăng nhập admin
      setCurrentStudent(null);
      storageService.setStudentSession(null);
      setIsAuthModalOpen(false);
      showToast(
        'Xác thực thành công',
        'Chào mừng Giáo viên / Quản trị viên FAMINH! Đã mở quyền quản trị hệ thống.',
        'success'
      );
      return { success: true, message: 'Đăng nhập thành công' };
    } else {
      showToast(
        'Từ chối truy cập',
        'Mật mã quản trị viên không chính xác. Hành vi truy cập trái phép bị chặn!',
        'error'
      );
      return { success: false, message: 'Mật mã quản trị viên không chính xác!' };
    }
  };

  const logoutAdmin = () => {
    setIsAdminAuthenticated(false);
    setRole('USER');
    storageService.setAdminSessionActive(false);
    setIsAuthModalOpen(true);
    setAuthModalTab('student');
    showToast(
      'Đã đăng xuất Admin',
      'Đã khóa quyền quản trị. Hệ thống trở về màn hình đăng nhập.',
      'info'
    );
  };

  const changeAdminPassword = (
    oldPass: string,
    newPass: string
  ): { success: boolean; message: string } => {
    if (!storageService.verifyAdminPassword(oldPass)) {
      return { success: false, message: 'Mật mã hiện tại không đúng!' };
    }
    if (!newPass || newPass.length < 6) {
      return { success: false, message: 'Mật mã mới phải có ít nhất 6 ký tự!' };
    }

    storageService.setAdminPassword(newPass);
    setIsChangePasswordModalOpen(false);
    showToast('Đổi mật mã thành công', 'Mật mã quản trị FAMINH mới đã được cập nhật an toàn.', 'success');
    return { success: true, message: 'Đổi mật mã thành công' };
  };

  const addTopic = (topicData: Omit<Topic, 'id'>) => {
    if (!isAdminAuthenticated) {
      showToast('Không có quyền', 'Chỉ quản trị viên mới được tạo chủ đề', 'error');
      return;
    }
    const newTopic: Topic = {
      ...topicData,
      id: `topic_${Date.now()}`,
    };
    const nextTopics = [...topics, newTopic];
    setTopics(nextTopics);
    showToast('Thành công', `Đã tạo chủ đề "${newTopic.name}"`, 'success');
  };

  const updateTopic = (id: string, updated: Partial<Topic>) => {
    if (!isAdminAuthenticated) return;
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    showToast('Thành công', 'Đã cập nhật chủ đề', 'success');
  };

  const deleteTopic = (id: string) => {
    if (!isAdminAuthenticated) return;
    setTopics((prev) => prev.filter((t) => t.id !== id));
    showToast('Đã xóa', 'Đã xóa chủ đề được chọn', 'info');
  };

  const reorderTopics = (topicIds: string[]) => {
    if (!isAdminAuthenticated) return;
    const topicMap = new Map(topics.map((t) => [t.id, t]));
    const reordered: Topic[] = [];
    topicIds.forEach((id, idx) => {
      const item = topicMap.get(id);
      if (item) {
        reordered.push({ ...item, order: idx + 1 });
      }
    });
    setTopics(reordered);
  };

  const addProblem = (probData: Omit<Problem, 'id' | 'createdAt' | 'updatedAt'>): Problem => {
    if (!isAdminAuthenticated) {
      throw new Error('Chỉ quản trị viên mới có quyền tạo đề bài');
    }
    const newProblem: Problem = {
      ...probData,
      id: `prob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProblems((prev) => [newProblem, ...prev]);
    showToast('Đã thêm bài tập', `Đã tạo thành công bài [${newProblem.code}] ${newProblem.title}`, 'success');
    return newProblem;
  };

  const updateProblem = (id: string, updated: Partial<Problem>) => {
    if (!isAdminAuthenticated) return;
    setProblems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updated, updatedAt: new Date().toISOString() } : p))
    );
    if (activeProblem?.id === id) {
      setActiveProblem((prev) => (prev ? { ...prev, ...updated } : null));
    }
    showToast('Đã cập nhật', 'Cập nhật nội dung bài tập thành công', 'success');
  };

  const deleteProblem = (id: string) => {
    if (!isAdminAuthenticated) return;
    setProblems((prev) => prev.filter((p) => p.id !== id));
    if (activeProblem?.id === id) {
      setActiveProblem(problems.find((p) => p.id !== id) || null);
    }
    showToast('Đã xóa', 'Đã xóa bài tập khỏi hệ thống', 'info');
  };

  const submitCode = async (
    problemId: string,
    code: string,
    language: SupportedLanguage,
    onProgress?: GradingProgressCallback
  ): Promise<Submission> => {
    const problem = problems.find((p) => p.id === problemId);
    if (!problem) {
      throw new Error('Không tìm thấy bài tập để chấm');
    }

    const submission = await gradeSubmission(
      problem,
      code,
      language,
      isAdminAuthenticated ? 'admin_faminh' : (currentStudent?.username || 'student_01'),
      isAdminAuthenticated ? 'Giáo viên FAMINH' : (currentStudent?.fullName || 'Học sinh'),
      onProgress
    );

    storageService.saveSubmission(submission);
    setSubmissions((prev) => [submission, ...prev]);

    if (submission.passedCount === submission.totalTests && submission.totalTests > 0) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      showToast(
        'Chúc mừng! Điểm tối đa!',
        `Bạn đã vượt qua ${submission.totalTests}/${submission.totalTests} test case (${submission.totalPointsEarned}/${submission.maxTotalPoints} điểm)`,
        'success'
      );
    } else if (submission.passedCount > 0) {
      showToast(
        'Đã chấm xong (Chấm một phần)',
        `Đúng ${submission.passedCount}/${submission.totalTests} test. Đạt ${submission.totalPointsEarned}/${submission.maxTotalPoints} điểm.`,
        'warning'
      );
    } else if (submission.overallVerdict === 'CE') {
      showToast('Lỗi biên dịch (CE)', 'Mã nguồn bị lỗi khi biên dịch. Hãy xem chi tiết bên dưới.', 'error');
    } else {
      showToast(
        'Chưa đạt test nào (0 điểm)',
        `Kết quả kiểm thử không khớp (${submission.overallVerdict}). Hãy kiểm tra lại thuật toán.`,
        'error'
      );
    }

    return submission;
  };

  const getProblemStatus = (problemId: string): 'UNSOLVED' | 'PARTIAL' | 'SOLVED' => {
    const prob = problems.find((p) => p.id === problemId);
    const maxPoints = prob?.totalPoints || 10;

    let relevantSubs = submissions.filter((s) => s.problemId === problemId);
    if (!isAdminAuthenticated) {
      if (!currentStudent) return 'UNSOLVED';
      relevantSubs = relevantSubs.filter((s) => {
        const matchName = s.userName && currentStudent.fullName &&
          s.userName.trim().toLowerCase() === currentStudent.fullName.trim().toLowerCase();
        const matchUser = s.userId && currentStudent.username &&
          s.userId.trim().toLowerCase() === currentStudent.username.trim().toLowerCase();
        return Boolean(matchName || matchUser);
      });
    }

    if (relevantSubs.length === 0) return 'UNSOLVED';
    const maxEarned = Math.max(...relevantSubs.map((s) => s.totalPointsEarned));
    if (maxEarned >= maxPoints) return 'SOLVED';
    if (maxEarned > 0) return 'PARTIAL';
    return 'UNSOLVED';
  };

  const resetAllData = () => {
    if (!isAdminAuthenticated) {
      showToast('Từ chối', 'Chỉ quản trị viên mới có quyền khôi phục dữ liệu hệ thống!', 'error');
      return;
    }
    storageService.resetToDefault();
    setTopics(INITIAL_TOPICS);
    setProblems(INITIAL_PROBLEMS);
    setSubmissions([]);
    setStudents(storageService.getStudents());
    setCurrentStudent(null);
    setActiveProblem(INITIAL_PROBLEMS[0]);
    showToast('Khôi phục mẫu', 'Đã cài đặt lại dữ liệu mặc định hệ thống FAMINH', 'info');
  };

  return (
    <JudgeContext.Provider
      value={{
        role,
        isAdminAuthenticated,
        currentStudent,
        students,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalTab,
        setAuthModalTab,
        isStudentModalOpen,
        setIsStudentModalOpen,
        isChangePasswordModalOpen,
        setIsChangePasswordModalOpen,
        theme,
        toggleTheme,
        confirmModalState,
        openConfirmModal,
        closeConfirmModal,
        loginStudent,
        logoutStudent,
        addStudent,
        deleteStudent,
        loginAdmin,
        logoutAdmin,
        changeAdminPassword,
        topics,
        problems,
        submissions,
        activeProblem,
        setActiveProblem,
        activeTopicId,
        setActiveTopicId,
        stats,
        toasts,
        showToast,
        removeToast,
        addTopic,
        updateTopic,
        deleteTopic,
        reorderTopics,
        addProblem,
        updateProblem,
        deleteProblem,
        submitCode,
        getProblemStatus,
        resetAllData,
      }}
    >
      {children}
    </JudgeContext.Provider>
  );
};

export const useJudge = (): JudgeContextType => {
  const context = useContext(JudgeContext);
  if (!context) {
    throw new Error('useJudge must be used within a JudgeProvider');
  }
  return context;
};
