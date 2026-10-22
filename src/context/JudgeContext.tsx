import React, { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { UserRole, Topic, Problem, Submission, UserStats, StudentUser, Classroom, ClassStudent } from '../types/judge';
import { storageService, DEFAULT_CLASS } from '../services/storageService';
import { apiService } from '../services/apiService';
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
  isServerConfigModalOpen: boolean;
  setIsServerConfigModalOpen: (open: boolean) => void;

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
  loginStudent: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  logoutStudent: () => void;
  addStudent: (fullName: string, username: string, password: string) => Promise<{ success: boolean; message: string }>;
  deleteStudent: (id: string) => Promise<void>;

  // Admin Auth Actions
  loginAdmin: (password: string) => Promise<{ success: boolean; message: string }>;
  logoutAdmin: () => void;
  changeAdminPassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;

  // Refresh & Anti-Cache
  refreshAllData: () => Promise<void>;
  isRefreshing: boolean;

  // Multi-Classroom (Nhiều lớp học độc lập)
  classes: Classroom[];
  activeClassId: string | null;
  setActiveClassId: (id: string | null) => void;
  activeClass: Classroom | null;
  studentClasses: Classroom[];
  createClass: (className: string, description: string) => Classroom;
  updateClass: (id: string, data: Partial<Classroom>) => void;
  deleteClass: (id: string) => void;
  joinClassByCode: (joinCode: string) => { success: boolean; message: string; classroom?: Classroom };
  getStudentsInClass: (classId: string) => StudentUser[];
  enrollStudentToClass: (classId: string, studentId: string) => void;
  removeStudentFromClass: (classId: string, studentId: string) => void;

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

  addProblem: (problem: Omit<Problem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Problem>;
  updateProblem: (id: string, problem: Partial<Problem>) => Promise<void>;
  deleteProblem: (id: string) => Promise<void>;

  submitCode: (
    problemId: string,
    code: string,
    language: SupportedLanguage,
    onProgress?: GradingProgressCallback
  ) => Promise<Submission>;

  getProblemStatus: (problemId: string) => 'UNSOLVED' | 'PARTIAL' | 'SOLVED';
  resetAllData: () => void;
  syncToCloud: () => Promise<{ success: boolean; message: string; problemsCount?: number }>;
  isCloudConfigured: boolean;
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
  const [isServerConfigModalOpen, setIsServerConfigModalOpen] = useState(false);

  // Multi-Classroom State
  const [classes, setClasses] = useState<Classroom[]>(() => storageService.getClasses());
  const [classStudents, setClassStudents] = useState<ClassStudent[]>(() => storageService.getClassStudents());
  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  const activeClass = useMemo(() => {
    return activeClassId ? classes.find((c) => c.id === activeClassId) || null : null;
  }, [activeClassId, classes]);

  const studentClasses = useMemo(() => {
    if (!currentStudent) return [];
    const relations = classStudents.filter((cs) => cs.studentId === currentStudent.id);
    const classIds = new Set(relations.map((cs) => cs.classId));
    return classes.filter((c) => classIds.has(c.id));
  }, [currentStudent, classStudents, classes]);

  const createClass = (className: string, description: string): Classroom => {
    const newClass = storageService.addClass({ className, description });
    apiService.saveClassroom(newClass).catch(() => {});
    setClasses(storageService.getClasses());
    showToast('Tạo lớp thành công', `Đã tạo lớp "${newClass.className}" - Mã tham gia: ${newClass.joinCode}`, 'success');
    return newClass;
  };

  const updateClass = (id: string, data: Partial<Classroom>) => {
    storageService.updateClass(id, data);
    const updated = storageService.getClassById(id);
    if (updated) {
      apiService.saveClassroom(updated).catch(() => {});
    }
    setClasses(storageService.getClasses());
    showToast('Cập nhật thành công', 'Đã lưu thay đổi thông tin lớp học', 'success');
  };

  const deleteClass = (id: string) => {
    storageService.deleteClass(id);
    apiService.deleteClassroom(id).catch(() => {});
    setClasses(storageService.getClasses());
    setClassStudents(storageService.getClassStudents());
    setTopics(storageService.getTopics());
    setProblems(storageService.getProblems());
    if (activeClassId === id) {
      setActiveClassId(null);
    }
    showToast('Đã xóa lớp học', 'Đã xóa lớp học thành công', 'info');
  };

  const joinClassByCode = (joinCode: string): { success: boolean; message: string; classroom?: Classroom } => {
    if (!currentStudent) {
      return { success: false, message: 'Vui lòng đăng nhập tài khoản học sinh trước khi tham gia lớp!' };
    }
    const res = storageService.joinClassByCode(currentStudent.id, joinCode);
    if (res.success) {
      const updatedRelations = storageService.getClassStudents();
      setClassStudents(updatedRelations);
      setClasses(storageService.getClasses());
      apiService.saveClassStudents(updatedRelations).catch(() => {});
      showToast(res.message, `Lớp: ${res.classroom?.className}`, 'success');
    } else {
      showToast('Không thể tham gia', res.message, 'error');
    }
    return res;
  };

  const getStudentsInClass = (classId: string): StudentUser[] => {
    return storageService.getStudentsInClass(classId);
  };

  const enrollStudentToClass = (classId: string, studentId: string) => {
    storageService.enrollStudentToClass(classId, studentId);
    const updatedRelations = storageService.getClassStudents();
    setClassStudents(updatedRelations);
    apiService.saveClassStudents(updatedRelations).catch(() => {});
    showToast('Thành công', 'Đã thêm học sinh vào lớp', 'success');
  };

  const removeStudentFromClass = (classId: string, studentId: string) => {
    storageService.removeStudentFromClass(classId, studentId);
    const updatedRelations = storageService.getClassStudents();
    setClassStudents(updatedRelations);
    apiService.saveClassStudents(updatedRelations).catch(() => {});
    showToast('Đã đưa ra khỏi lớp', 'Đã xóa học sinh khỏi danh sách lớp này', 'info');
  };

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

  const isHydratedRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * TẢI MỚI DỮ LIỆU TOÀN DIỆN TỪ SUPABASE CLOUD DATABASE (ANTI-CACHE REAL-TIME)
   * Không dùng cache cứng, luôn kéo dữ liệu mới nhất khi vào Dashboard hoặc đổi tài khoản
   */
  const refreshAllData = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      const [cloudClasses, cloudRelations, cloudStudents, cloudTopics, cloudProblems, cloudSubs] = await Promise.all([
        apiService.fetchClassrooms(),
        apiService.fetchClassStudents(),
        apiService.fetchStudents(),
        apiService.fetchTopics(),
        apiService.fetchProblems(),
        apiService.fetchSubmissions(),
      ]);

      if (cloudClasses && cloudClasses.length > 0) {
        setClasses(cloudClasses);
      }
      if (cloudRelations) {
        setClassStudents(cloudRelations);
      }
      if (cloudStudents && cloudStudents.length > 0) {
        setStudents(cloudStudents);
      }
      if (cloudTopics && cloudTopics.length > 0) {
        setTopics(cloudTopics);
      }
      if (cloudProblems && cloudProblems.length > 0) {
        setProblems((prev) => {
          const mergedMap = new Map<string, Problem>();
          cloudProblems.forEach((p) => mergedMap.set(p.id, p));
          prev.forEach((p) => {
            const existing = mergedMap.get(p.id);
            if (!existing) {
              mergedMap.set(p.id, p);
            } else {
              const existingHasRealTests = (existing.testCases || []).some(
                (t) => (t.input && t.input.trim().length > 0) || (t.expectedOutput && t.expectedOutput.trim().length > 0)
              );
              const prevHasRealTests = (p.testCases || []).some(
                (t) => (t.input && t.input.trim().length > 0) || (t.expectedOutput && t.expectedOutput.trim().length > 0)
              );
              if (!existingHasRealTests && prevHasRealTests) {
                mergedMap.set(p.id, { ...existing, testCases: p.testCases });
              }
            }
          });
          return Array.from(mergedMap.values());
        });

        setActiveProblem((curr) => {
          if (!curr) return cloudProblems[0] || null;
          const updated = cloudProblems.find((p) => p.id === curr.id);
          return updated || curr;
        });
      }
      if (cloudSubs) {
        setSubmissions(cloudSubs);
      }
    } catch (err) {
      console.warn('[JudgeContext] Lỗi refreshAllData:', err);
    } finally {
      setIsRefreshing(false);
      isHydratedRef.current = true;
    }
  };

  // 1. Phục hồi và bổ sung dữ liệu khi khởi động
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await refreshAllData();
      } catch (err) {
        if (isMounted) {
          console.warn('Lỗi tải dữ liệu khởi động:', err);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. ÉP VĂNG RA MÀN HÌNH ĐĂNG NHẬP NẾU PHIÊN ADMIN SAI MẬT KHẨU TRÊN DATABASE
  const forceAdminLogout = (reason: string) => {
    storageService.clearAllStorageAndCookies();
    sessionStorage.removeItem('faminh_admin_verified_pass');
    setCurrentStudent(null);
    setIsAdminAuthenticated(false);
    setRole('USER');
    setActiveClassId(null);
    setActiveProblem(null);
    setActiveTopicId(null);
    setClasses([]);
    setClassStudents([]);
    setSubmissions([]);
    setProblems([]);
    setTopics([]);
    setStats({
      solvedCount: 0,
      attemptedCount: 0,
      totalSubmissions: 0,
      pointsAccumulated: 0,
    });
    setIsAuthModalOpen(true);
    setAuthModalTab('admin');
    showToast('Phiên làm việc kết thúc', reason, 'error');
  };

  // 3. ĐỐI CHIẾU REAL-TIME MẬT KHẨU ADMIN VỚI DATABASE TRỰC TIẾP
  useEffect(() => {
    if (!isAdminAuthenticated) return;

    let isMounted = true;
    const verifySessionRealtime = async () => {
      const verifiedPass = sessionStorage.getItem('faminh_admin_verified_pass');
      if (!verifiedPass) {
        if (isMounted) {
          forceAdminLogout('Phiên quản trị chưa được đối chiếu trực tiếp với Database. Vui lòng đăng nhập lại!');
        }
        return;
      }

      const isValid = await apiService.verifyAdminPassword(verifiedPass);
      if (!isValid && isMounted) {
        forceAdminLogout('Mật mã quản trị viên trên Database đã thay đổi. Bạn đã bị đăng xuất để bảo vệ hệ thống!');
      }
    };

    verifySessionRealtime();

    const handleFocus = () => {
      verifySessionRealtime();
    };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(verifySessionRealtime, 45000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    storageService.saveTopics(topics);
  }, [topics]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    storageService.saveProblems(problems);
  }, [problems]);

  useEffect(() => {
    setStats(storageService.getUserStats(isAdminAuthenticated ? null : currentStudent, activeClassId, submissions));
  }, [submissions, isAdminAuthenticated, currentStudent, activeClassId]);

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
  const loginStudent = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
    if (!username.trim() || !password.trim()) {
      return { success: false, message: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu!' };
    }

    let currentList = await apiService.fetchStudents();
    if (!currentList || currentList.length === 0) {
      currentList = storageService.getStudents();
    }

    const found = currentList.find(
      (s) => s.username.toLowerCase() === username.trim().toLowerCase() && s.password === password.trim()
    );

    if (found) {
      // Dọn dẹp session admin cũ nếu có
      storageService.setAdminSessionActive(false);
      sessionStorage.removeItem('faminh_admin_verified_pass');
      setIsAdminAuthenticated(false);
      setRole('USER');

      setCurrentStudent(found);
      storageService.setStudentSession(found);
      setIsAuthModalOpen(false);

      // Fetch mới ngay danh sách lớp học và dữ liệu của học sinh này từ Database
      await refreshAllData();

      showToast(
        'Đăng nhập thành công',
        `Chào mừng học sinh ${found.fullName}! Dữ liệu lớp học đã được cập nhật mới nhất.`,
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
    storageService.clearAllStorageAndCookies();
    sessionStorage.removeItem('faminh_admin_verified_pass');
    setCurrentStudent(null);
    setIsAdminAuthenticated(false);
    setRole('USER');
    setActiveClassId(null);
    setActiveProblem(null);
    setActiveTopicId(null);
    setClasses([]);
    setClassStudents([]);
    setSubmissions([]);
    setProblems([]);
    setTopics([]);
    setStats({
      solvedCount: 0,
      attemptedCount: 0,
      totalSubmissions: 0,
      pointsAccumulated: 0,
    });
    setIsAuthModalOpen(true);
    setAuthModalTab('student');
    showToast('Đã đăng xuất', 'Đã đăng xuất tài khoản và xóa sạch toàn bộ phiên làm việc.', 'info');
  };

  // Giáo viên tạo tài khoản Học sinh mới
  const addStudent = async (fullName: string, username: string, password: string): Promise<{ success: boolean; message: string }> => {
    if (!fullName.trim() || !username.trim() || !password.trim()) {
      return { success: false, message: 'Vui lòng điền đầy đủ Họ và tên, Tên đăng nhập và Mật khẩu!' };
    }
    const cleanUsername = username.trim().toLowerCase();
    let currentList = await apiService.fetchStudents();
    if (!currentList || currentList.length === 0) {
      currentList = storageService.getStudents();
    }
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

    const nextList = [newStudent, ...currentList];
    storageService.saveStudents(nextList);
    await apiService.saveStudents(nextList);
    setStudents(nextList);
    showToast('Cấp tài khoản thành công', `Đã tạo tài khoản cho học sinh ${newStudent.fullName} (${newStudent.username})`, 'success');
    return { success: true, message: 'Tạo tài khoản thành công' };
  };

  // Giáo viên xóa tài khoản Học sinh
  const deleteStudent = async (id: string) => {
    storageService.deleteStudent(id);
    const list = storageService.getStudents();
    setStudents(list);
    await apiService.saveStudents(list);
    if (currentStudent?.id === id) {
      logoutStudent();
    }
    showToast('Đã xóa', 'Đã xóa tài khoản học sinh khỏi danh sách.', 'info');
  };

  // Giáo viên (Admin) Đăng nhập - BẮT BUỘC ĐỐI CHIẾU TRỰC TIẾP VỚI DATABASE
  const loginAdmin = async (password: string): Promise<{ success: boolean; message: string }> => {
    if (!password || !password.trim()) {
      return { success: false, message: 'Vui lòng nhập mật mã quản trị viên!' };
    }

    // Đối chiếu trực tiếp với Supabase Cloud Database qua API
    const isValid = await apiService.verifyAdminPassword(password.trim());
    if (isValid) {
      // Dọn dẹp session học sinh nếu có
      storageService.setStudentSession(null);
      setCurrentStudent(null);

      setIsAdminAuthenticated(true);
      setRole('ADMIN');
      storageService.setAdminSessionActive(true);
      sessionStorage.setItem('faminh_admin_verified_pass', password.trim());
      setIsAuthModalOpen(false);

      // Kéo dữ liệu mới nhất từ Database
      await refreshAllData();

      showToast(
        'Xác thực thành công',
        'Chào mừng Giáo viên / Quản trị viên FAMINH! Đã mở quyền quản trị hệ thống với Database.',
        'success'
      );
      return { success: true, message: 'Đăng nhập thành công' };
    } else {
      // Đối chiếu sai mật khẩu: ÉP VĂNG / TỪ CHỐI
      storageService.clearAllStorageAndCookies();
      sessionStorage.removeItem('faminh_admin_verified_pass');
      setIsAdminAuthenticated(false);
      setRole('USER');
      showToast(
        'Từ chối truy cập',
        'Mật mã quản trị viên không chính xác trên Database. Yêu cầu đăng nhập lại!',
        'error'
      );
      return { success: false, message: 'Mật mã quản trị viên không chính xác trên Database!' };
    }
  };

  // Quản trị viên Đăng xuất
  const logoutAdmin = () => {
    storageService.clearAllStorageAndCookies();
    sessionStorage.removeItem('faminh_admin_verified_pass');
    setCurrentStudent(null);
    setIsAdminAuthenticated(false);
    setRole('USER');
    setActiveClassId(null);
    setActiveProblem(null);
    setActiveTopicId(null);
    setClasses([]);
    setClassStudents([]);
    setSubmissions([]);
    setProblems([]);
    setTopics([]);
    setStats({
      solvedCount: 0,
      attemptedCount: 0,
      totalSubmissions: 0,
      pointsAccumulated: 0,
    });
    setIsAuthModalOpen(true);
    setAuthModalTab('admin');
    showToast(
      'Đã đăng xuất Admin',
      'Đã khóa quyền quản trị và dọn dẹp an toàn toàn bộ dữ liệu phiên.',
      'info'
    );
  };

  const changeAdminPassword = async (
    oldPass: string,
    newPass: string
  ): Promise<{ success: boolean; message: string }> => {
    // 1. Kiểm tra mật khẩu cũ trực tiếp qua Database
    const isOldValid = await apiService.verifyAdminPassword(oldPass);
    if (!isOldValid) {
      return { success: false, message: 'Mật mã hiện tại không đúng trên Database!' };
    }
    if (!newPass || newPass.trim().length < 6) {
      return { success: false, message: 'Mật mã mới phải có ít nhất 6 ký tự!' };
    }

    // 2. Cập nhật mật mã mới lên Database Supabase Cloud
    const updated = await apiService.updateAdminPasswordInDatabase(newPass.trim());
    if (updated) {
      sessionStorage.setItem('faminh_admin_verified_pass', newPass.trim());
      setIsChangePasswordModalOpen(false);
      showToast('Đổi mật mã thành công', 'Mật mã quản trị FAMINH mới đã được cập nhật an toàn lên Database.', 'success');
      return { success: true, message: 'Đổi mật mã thành công' };
    } else {
      return { success: false, message: 'Không thể kết nối đến Database để đổi mật mã!' };
    }
  };

  const addTopic = (topicData: Omit<Topic, 'id'>) => {
    if (!isAdminAuthenticated) {
      showToast('Không có quyền', 'Chỉ quản trị viên mới được tạo chủ đề', 'error');
      return;
    }
    const classIds = topicData.classIds && topicData.classIds.length > 0
      ? topicData.classIds
      : (topicData.classId ? [topicData.classId] : ['ALL']);

    const newTopic: Topic = {
      ...topicData,
      id: `topic_${Date.now()}`,
      classId: topicData.classId || classIds[0] || 'ALL',
      classIds,
    };
    const nextTopics = [...topics, newTopic];
    setTopics(nextTopics);
    showToast('Thành công', `Đã tạo chủ đề "${newTopic.name}"`, 'success');
  };

  const updateTopic = (id: string, updated: Partial<Topic>) => {
    if (!isAdminAuthenticated) return;
    setTopics((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const classIds = updated.classIds !== undefined
          ? updated.classIds
          : (updated.classId ? [updated.classId] : t.classIds || (t.classId ? [t.classId] : ['ALL']));
        const classId = updated.classId || classIds[0] || t.classId || 'ALL';
        return {
          ...t,
          ...updated,
          classId,
          classIds,
        };
      })
    );
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

  const addProblem = async (probData: Omit<Problem, 'id' | 'createdAt' | 'updatedAt'>): Promise<Problem> => {
    if (!isAdminAuthenticated) {
      throw new Error('Chỉ quản trị viên mới có quyền tạo đề bài');
    }
    let targetClassId = probData.classId;
    if (!targetClassId || targetClassId === DEFAULT_CLASS.id) {
      if (activeClassId) {
        targetClassId = activeClassId;
      } else if (probData.topicId) {
        const parentTopic = topics.find((t) => t.id === probData.topicId);
        if (parentTopic) {
          const ids = parentTopic.classIds && parentTopic.classIds.length > 0
            ? parentTopic.classIds
            : (parentTopic.classId ? [parentTopic.classId] : []);
          if (ids[0] && ids[0] !== 'ALL') {
            targetClassId = ids[0];
          }
        }
      }
    }
    if (!targetClassId) targetClassId = DEFAULT_CLASS.id;

    const newProblem: Problem = {
      ...probData,
      classId: targetClassId,
      id: `prob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // 1. BẮT BUỘC AWAIT ĐỂ LƯU THÀNH CÔNG VÀO DATABASE THỰC TẾ TRƯỚC
      await apiService.saveProblem(newProblem);
      if (newProblem.testCases && newProblem.testCases.length > 0) {
        await apiService.saveTestCases(newProblem.id, newProblem.testCases);
      }
      await storageService.saveProblems([newProblem, ...problems]);

      // 2. SAU KHI DATABASE LƯU XONG THÌ MỚI UPDATE STATE TRÊN GIAO DIỆN
      setProblems((prev) => [newProblem, ...prev]);
      showToast('Đã thêm bài tập', `Đã tạo thành công bài [${newProblem.code}] ${newProblem.title}`, 'success');
      return newProblem;
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Lỗi khi lưu bài tập vào cơ sở dữ liệu';
      showToast('Lỗi thêm bài tập', msg, 'error');
      throw err;
    }
  };

  const updateProblem = async (id: string, updated: Partial<Problem>): Promise<void> => {
    if (!isAdminAuthenticated) return;

    const existing = problems.find((p) => p.id === id);
    if (!existing) return;

    // BẢO VỆ TEST CASES: Không bao giờ để một cập nhật bài tập thông thường làm mất bộ test case đang có
    const mergedTestCases =
      updated.testCases && updated.testCases.length > 0
        ? updated.testCases
        : (existing.testCases && existing.testCases.length > 0 ? existing.testCases : (updated.testCases || []));

    const updatedProblem: Problem = {
      ...existing,
      ...updated,
      testCases: mergedTestCases,
      updatedAt: new Date().toISOString(),
    };

    try {
      // 1. BẮT BUỘC AWAIT ĐỂ LƯU THÀNH CÔNG VÀO DATABASE THỰC TẾ TRƯỚC
      await apiService.saveProblem(updatedProblem);
      if (mergedTestCases && mergedTestCases.length > 0) {
        await apiService.saveTestCases(id, mergedTestCases);
      }

      const nextList = problems.map((p) => (p.id === id ? updatedProblem : p));
      await storageService.saveProblems(nextList);

      // 2. SAU ĐÓ MỚI CẬP NHẬT STATE TRÊN GIAO DIỆN
      setProblems(nextList);
      if (activeProblem?.id === id) {
        setActiveProblem(updatedProblem);
      }
      showToast('Đã cập nhật', 'Cập nhật nội dung bài tập thành công', 'success');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Lỗi khi cập nhật bài tập vào Database';
      showToast('Lỗi cập nhật bài tập', msg, 'error');
      throw err;
    }
  };

  const deleteProblem = async (id: string): Promise<void> => {
    if (!isAdminAuthenticated) return;

    try {
      // 1. BẮT BUỘC AWAIT XÓA TRONG DATABASE THỰC TẾ TRƯỚC
      await apiService.deleteProblem(id);
      const nextList = problems.filter((p) => p.id !== id);
      await storageService.saveProblems(nextList);

      // 2. UPDATE STATE TRÊN GIAO DIỆN
      setProblems(nextList);
      if (activeProblem?.id === id) {
        setActiveProblem(nextList[0] || null);
      }
      showToast('Đã xóa', 'Đã xóa bài tập khỏi hệ thống', 'info');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Lỗi khi xóa bài tập khỏi Database';
      showToast('Lỗi xóa bài tập', msg, 'error');
      throw err;
    }
  };

  const submitCode = async (
    problemId: string,
    code: string,
    language: SupportedLanguage,
    onProgress?: GradingProgressCallback
  ): Promise<Submission> => {
    let problem = problems.find((p) => p.id === problemId);
    if (!problem) {
      throw new Error('Không tìm thấy bài tập để chấm');
    }

    // Nạp khẩn cấp từ Database nếu problem trong React state chưa có test hoặc test bị rỗng input do nén
    const hasRealTests = (problem.testCases || []).some(
      (t) => (t.input && t.input.trim().length > 0) || (t.expectedOutput && t.expectedOutput.trim().length > 0)
    );
    if (!problem.testCases || problem.testCases.length === 0 || !hasRealTests) {
      const savedTests = await apiService.fetchTestCases(problem.id);
      if (savedTests && savedTests.length > 0) {
        problem = { ...problem, testCases: savedTests };
        setProblems((prev) =>
          prev.map((p) => (p.id === problemId ? { ...p, testCases: savedTests } : p))
        );
      }
    }

    const submission = await gradeSubmission(
      problem,
      code,
      language,
      isAdminAuthenticated ? 'admin_faminh' : (currentStudent?.username || 'student_01'),
      isAdminAuthenticated ? 'Giáo viên FAMINH' : (currentStudent?.fullName || 'Học sinh'),
      onProgress
    );

    // Gắn classId cho bài nộp để dễ dàng lọc bảng điểm theo lớp
    submission.classId = activeClassId || problem.classId || DEFAULT_CLASS.id;

    // 1. BẮT BUỘC AWAIT ĐỂ LƯU THÀNH CÔNG SUBMISSION VÀO DATABASE THỰC TẾ TRƯỚC
    try {
      await apiService.saveSubmission(submission);
      await storageService.saveSubmission(submission);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Lỗi lưu bài nộp vào Database';
      console.error('[submitCode] Lỗi lưu Database:', err);
      showToast('Lỗi lưu Database', `Không thể lưu kết quả nộp bài: ${msg}`, 'error');
      throw new Error(`Lỗi lưu Database: ${msg}`);
    }

    // 2. CHỈ SAU KHI LƯU DB THÀNH CÔNG THÌ MỚI CẬP NHẬT STATE SUBMISSIONS VÀO REACT
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

    let relevantSubs = submissions.filter(
      (s) => s.problemId === problemId || (prob && s.problemCode && s.problemCode === prob.code)
    );
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
    const isFullAc = relevantSubs.some(
      (s) =>
        s.overallVerdict === 'AC' ||
        (s.maxTotalPoints > 0 && s.totalPointsEarned >= s.maxTotalPoints) ||
        (s.totalTests > 0 && s.passedCount === s.totalTests) ||
        s.totalPointsEarned >= maxPoints
    );
    if (isFullAc) return 'SOLVED';
    const maxEarned = Math.max(...relevantSubs.map((s) => s.totalPointsEarned));
    if (maxEarned > 0) return 'PARTIAL';
    return 'UNSOLVED';
  };

  const isCloudConfigured = apiService.isConfigured();

  const syncToCloud = async (): Promise<{ success: boolean; message: string; problemsCount?: number }> => {
    try {
      const res = await apiService.syncAllToCloud();
      showToast(
        'Đồng bộ thành công! ☁️',
        `Đã đẩy ${res.problemsCount} bài tập và ${res.testCasesCount} test case lên Supabase Cloud. Mọi thiết bị khác (điện thoại, máy tính) đã có thể xem được ngay!`,
        'success'
      );
      const cloudProbs = await apiService.fetchProblems();
      if (cloudProbs && cloudProbs.length > 0) {
        setProblems(cloudProbs);
      }
      return { success: true, message: 'Đồng bộ thành công', problemsCount: res.problemsCount };
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Lỗi khi đồng bộ dữ liệu lên Cloud';
      showToast('Lỗi đồng bộ Cloud', msg, 'error');
      return { success: false, message: msg };
    }
  };

  const resetAllData = () => {
    if (!isAdminAuthenticated) {
      showToast('Từ chối', 'Chỉ quản trị viên mới có quyền khôi phục dữ liệu hệ thống!', 'error');
      return;
    }
    storageService.resetToDefault();
    setTopics([]);
    setProblems([]);
    setSubmissions([]);
    setClasses(storageService.getClasses());
    setClassStudents(storageService.getClassStudents());
    setActiveClassId(null);
    setStudents(storageService.getStudents());
    setCurrentStudent(null);
    setActiveProblem(null);
    showToast('Đặt lại dữ liệu', 'Đã làm mới dữ liệu hệ thống (danh sách bài tập và chuyên đề trống)', 'info');
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
        isServerConfigModalOpen,
        setIsServerConfigModalOpen,
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
        refreshAllData,
        isRefreshing,
        classes,
        activeClassId,
        setActiveClassId,
        activeClass,
        studentClasses,
        createClass,
        updateClass,
        deleteClass,
        joinClassByCode,
        getStudentsInClass,
        enrollStudentToClass,
        removeStudentFromClass,
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
        syncToCloud,
        isCloudConfigured,
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
