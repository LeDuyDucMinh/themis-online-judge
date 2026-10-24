import React, { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { UserRole, Topic, Problem, Submission, UserStats, StudentUser, Classroom, ClassStudent } from '../types/judge';
import { storageService, DEFAULT_CLASS } from '../services/storageService';
import { apiService } from '../services/apiService';
import { idbService } from '../services/db';
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
  isAuthLoading: boolean;
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
  updateStudentPassword: (id: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
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
  pendingClasses: Classroom[];
  createClass: (className: string, description: string) => Promise<Classroom>;
  updateClass: (id: string, data: Partial<Classroom>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  joinClassByCode: (joinCode: string) => Promise<{ success: boolean; message: string; pending?: boolean; classroom?: Classroom }>;
  getStudentsInClass: (classId: string) => StudentUser[];
  getPendingStudentsInClass: (classId: string) => Array<{ student: StudentUser; joinedAt: string }>;
  approveStudentJoin: (classId: string, studentId: string) => Promise<void>;
  rejectStudentJoin: (classId: string, studentId: string) => Promise<void>;
  enrollStudentToClass: (classId: string, studentId: string) => Promise<void>;
  removeStudentFromClass: (classId: string, studentId: string) => Promise<void>;

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
  addTopic: (topic: Omit<Topic, 'id'>) => Promise<Topic>;
  updateTopic: (id: string, topic: Partial<Topic>) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;
  reorderTopics: (topicIds: string[]) => Promise<void>;

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

  // Cờ trạng thái loading xác thực (Auth Loading Flag) - Chống triệt để Race Condition khi tải trang / chuyển trang
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

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

  // Bắt buộc Đăng nhập khi vào web: Tuyệt đối KHÔNG mở modal khi hệ thống đang trong quá trình tải và đọc session
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'student' | 'admin'>('student');
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isServerConfigModalOpen, setIsServerConfigModalOpen] = useState(false);

  // Multi-Classroom State
  const [classes, setClasses] = useState<Classroom[]>(() => storageService.getClasses());
  const [classStudents, setClassStudents] = useState<ClassStudent[]>(() => storageService.getClassStudents());
  const [activeClassId, setActiveClassIdState] = useState<string | null>(() => storageService.getActiveClassId());

  const setActiveClassId = (id: string | null) => {
    setActiveClassIdState(id);
    storageService.setActiveClassId(id);
  };

  const activeClass = useMemo(() => {
    return activeClassId ? classes.find((c) => c.id === activeClassId) || null : null;
  }, [activeClassId, classes]);

  const studentClasses = useMemo(() => {
    if (!currentStudent) return [];
    return storageService.getClassesForStudent(currentStudent.id);
  }, [currentStudent, classStudents, classes]);

  const pendingClasses = useMemo(() => {
    if (!currentStudent) return [];
    return storageService.getPendingClassesForStudent(currentStudent.id);
  }, [currentStudent, classStudents, classes]);

  const createClass = async (className: string, description: string): Promise<Classroom> => {
    const newClass = storageService.addClass({ className, description });
    try {
      await apiService.saveClassroom(newClass);
    } catch (e) {
      console.warn('Lỗi lưu lớp học lên Cloud:', e);
    }
    setClasses(storageService.getClasses());
    showToast('Tạo lớp thành công', `Đã tạo lớp "${newClass.className}" - Mã tham gia: ${newClass.joinCode}`, 'success');
    return newClass;
  };

  const updateClass = async (id: string, data: Partial<Classroom>): Promise<void> => {
    storageService.updateClass(id, data);
    const updated = storageService.getClassById(id);
    if (updated) {
      try {
        await apiService.saveClassroom(updated);
      } catch (e) {
        console.warn('Lỗi cập nhật lớp học lên Cloud:', e);
      }
    }
    setClasses(storageService.getClasses());
    showToast('Cập nhật thành công', 'Đã lưu thay đổi thông tin lớp học', 'success');
  };

  const deleteClass = async (id: string): Promise<void> => {
    storageService.deleteClass(id);
    try {
      await apiService.deleteClassroom(id);
    } catch (e) {
      console.warn('Lỗi xóa lớp học trên Cloud:', e);
    }
    setClasses(storageService.getClasses());
    setClassStudents(storageService.getClassStudents());
    setTopics(storageService.getTopics());
    setProblems(storageService.getProblems());
    if (activeClassId === id) {
      setActiveClassId(null);
    }
    showToast('Đã xóa lớp học', 'Đã xóa lớp học thành công', 'info');
  };

  const joinClassByCode = async (joinCode: string): Promise<{ success: boolean; message: string; pending?: boolean; classroom?: Classroom }> => {
    const student = currentStudent || storageService.getStudentSession();
    if (!student) {
      return { success: false, message: 'Vui lòng đăng nhập tài khoản học sinh trước khi tham gia lớp!' };
    }

    const cleanCode = (joinCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Vui lòng nhập mã tham gia lớp học!' };
    }

    // Kiểm tra tài khoản học sinh còn tồn tại trên hệ thống
    const allStudents = await apiService.fetchStudents();
    const stillExists = allStudents.some(
      (s) =>
        (s.id && student.id && s.id === student.id) ||
        (s.username && student.username && s.username.toLowerCase() === student.username.toLowerCase())
    );
    if (!stillExists && allStudents.length > 0) {
      logoutStudent();
      showToast(
        'Tài khoản không tồn tại',
        'Tài khoản học sinh của bạn đã bị Giáo viên xóa khỏi hệ thống. Vui lòng liên hệ Giáo viên!',
        'error'
      );
      return { success: false, message: 'Tài khoản học sinh đã bị xóa khỏi hệ thống!' };
    }

    // 1. Luôn kéo danh sách Lớp học mới nhất trực tiếp từ Cloud để đảm bảo máy B tìm được lớp mới tạo trên máy A
    let latestClasses = await apiService.fetchClassrooms();
    if (!latestClasses || latestClasses.length === 0) {
      latestClasses = storageService.getClasses();
    }
    setClasses(latestClasses);

    // 2. Tìm lớp học theo mã tham gia (không phân biệt hoa/thường)
    const targetClass = latestClasses.find((c) => c.joinCode && c.joinCode.trim().toUpperCase() === cleanCode);
    if (!targetClass) {
      showToast('Mã không hợp lệ', `Mã tham gia "${cleanCode}" không tồn tại hoặc không chính xác. Vui lòng kiểm tra lại mã do Giáo viên cung cấp!`, 'error');
      return { success: false, message: 'Mã tham gia lớp học không hợp lệ hoặc lớp không tồn tại!' };
    }

    // 3. Kéo danh sách liên kết học sinh - lớp học mới nhất từ Cloud
    let allRelations = await apiService.fetchClassStudents();
    if (!allRelations) {
      allRelations = storageService.getClassStudents();
    }

    const stuId = (student.id || '').trim();
    const stuUser = (student.username || '').trim().toLowerCase();

    const existing = allRelations.find(
      (cs) => cs.classId === targetClass.id && (cs.studentId === stuId || (stuUser && cs.studentId.toLowerCase() === stuUser))
    );

    if (existing) {
      if (!existing.status || existing.status === 'approved') {
        showToast('Đã tham gia', `Em đã là thành viên chính thức của lớp "${targetClass.className}"!`, 'success');
        setActiveClassId(targetClass.id);
        return {
          success: true,
          pending: false,
          message: `Bạn đã là thành viên chính thức của lớp "${targetClass.className}"!`,
          classroom: targetClass,
        };
      }
      if (existing.status === 'pending') {
        showToast('Đang chờ duyệt', `Yêu cầu tham gia lớp "${targetClass.className}" của em đang chờ giáo viên phê duyệt. Em hãy nhắc Thầy/Cô duyệt vào lớp nhé!`, 'info');
        return {
          success: true,
          pending: true,
          message: `Yêu cầu tham gia lớp "${targetClass.className}" đang chờ giáo viên duyệt!`,
          classroom: targetClass,
        };
      }
    }

    // 4. Tạo quan hệ chờ duyệt (pending)
    const newRelation: ClassStudent = {
      classId: targetClass.id,
      studentId: student.id,
      joinedAt: new Date().toISOString(),
      status: 'pending',
    };

    const updatedRelations = [
      ...allRelations.filter((r) => !(r.classId === targetClass.id && (r.studentId === stuId || (stuUser && r.studentId.toLowerCase() === stuUser)))),
      newRelation,
    ];

    storageService.saveClassStudents(updatedRelations);
    setClassStudents(updatedRelations);

    try {
      await apiService.saveClassStudents(updatedRelations);
    } catch (e) {
      console.warn('Lỗi ghi liên kết lớp lên Cloud:', e);
    }

    showToast('Đã gửi yêu cầu', `Đã gửi yêu cầu tham gia lớp "${targetClass.className}". Vui lòng chờ Giáo viên phê duyệt để vào lớp làm bài nhé!`, 'info');
    return {
      success: true,
      pending: true,
      message: `Đã gửi yêu cầu tham gia lớp "${targetClass.className}". Vui lòng chờ giáo viên duyệt để vào lớp!`,
      classroom: targetClass,
    };
  };

  const approveStudentJoin = async (classId: string, studentId: string): Promise<void> => {
    storageService.approveStudentJoin(classId, studentId);
    let relations = await apiService.fetchClassStudents();
    if (!relations) {
      relations = storageService.getClassStudents();
    }
    const updatedRelations = relations.map((cs) => {
      if (cs.classId === classId && (cs.studentId === studentId || cs.studentId === studentId.trim())) {
        return { ...cs, status: 'approved' as const };
      }
      return cs;
    });

    storageService.saveClassStudents(updatedRelations);
    setClassStudents(updatedRelations);
    try {
      await apiService.saveClassStudents(updatedRelations);
    } catch (e) {
      console.warn('Lỗi ghi duyệt học sinh lên Cloud:', e);
    }
    const student = storageService.getStudents().find((s) => s.id === studentId);
    showToast('Đã duyệt học sinh', `Đã duyệt học sinh ${student?.fullName || ''} vào lớp thành công!`, 'success');
  };

  const rejectStudentJoin = async (classId: string, studentId: string): Promise<void> => {
    storageService.rejectStudentJoin(classId, studentId);
    const updatedRelations = storageService.getClassStudents();
    setClassStudents(updatedRelations);
    try {
      await apiService.saveClassStudents(updatedRelations);
    } catch (e) {
      console.warn('Lỗi ghi từ chối học sinh lên Cloud:', e);
    }
    const student = storageService.getStudents().find((s) => s.id === studentId);
    showToast('Đã từ chối', `Đã từ chối yêu cầu tham gia của ${student?.fullName || 'học sinh'}`, 'info');
  };

  const getPendingStudentsInClass = (classId: string): Array<{ student: StudentUser; joinedAt: string }> => {
    return storageService.getPendingStudentsInClass(classId);
  };

  const getStudentsInClass = (classId: string): StudentUser[] => {
    return storageService.getStudentsInClass(classId);
  };

  const enrollStudentToClass = async (classId: string, studentId: string): Promise<void> => {
    storageService.enrollStudentToClass(classId, studentId);
    const updatedRelations = storageService.getClassStudents();
    setClassStudents(updatedRelations);
    try {
      await apiService.saveClassStudents(updatedRelations);
    } catch (e) {
      console.warn('Lỗi ghi liên kết lớp lên Cloud:', e);
    }
    showToast('Thành công', 'Đã thêm học sinh vào lớp', 'success');
  };

  const removeStudentFromClass = async (classId: string, studentId: string): Promise<void> => {
    storageService.removeStudentFromClass(classId, studentId);
    const updatedRelations = storageService.getClassStudents();
    setClassStudents(updatedRelations);
    try {
      await apiService.saveClassStudents(updatedRelations);
    } catch (e) {
      console.warn('Lỗi ghi hủy liên kết lớp lên Cloud:', e);
    }
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

      if (cloudClasses) {
        setClasses(cloudClasses);
      }
      if (cloudRelations) {
        setClassStudents(cloudRelations);
      }
      if (cloudStudents) {
        setStudents(cloudStudents);
      }
      if (cloudTopics) {
        setTopics(cloudTopics);
      }
      if (cloudProblems) {
        const enrichedProblems = cloudProblems.map((cp) => {
          if (cp.testCases && cp.testCases.length > 0) return cp;
          const current = problems.find((p) => p.id === cp.id);
          if (current?.testCases && current.testCases.length > 0) {
            return { ...cp, testCases: current.testCases };
          }
          return cp;
        });
        setProblems(enrichedProblems);
        setActiveProblem((curr) => {
          if (!curr) return enrichedProblems[0] || null;
          const updated = enrichedProblems.find((p) => p.id === curr.id);
          return updated || enrichedProblems[0] || null;
        });
      }
      if (cloudSubs) {
        // Tự động làm sạch bài nộp của các tài khoản đã bị xóa khỏi hệ thống
        const currentStudentList = cloudStudents && cloudStudents.length > 0 ? cloudStudents : storageService.getStudents();
        const validStudentUsers = new Set(currentStudentList.map((s) => (s.username || '').trim().toLowerCase()));
        const validStudentNames = new Set(currentStudentList.map((s) => (s.fullName || '').trim().toLowerCase()));
        const validStudentIds = new Set(currentStudentList.map((s) => (s.id || '').trim()));

        const activeSubs = cloudSubs.filter((sub) => {
          if (sub.userId === 'admin_faminh' || sub.userName === 'Giáo viên FAMINH') return true;
          const matchId = sub.userId && validStudentIds.has(sub.userId.trim());
          const matchUser = sub.userId && validStudentUsers.has(sub.userId.trim().toLowerCase());
          const matchName = sub.userName && validStudentNames.has(sub.userName.trim().toLowerCase());
          return Boolean(matchId || matchUser || matchName);
        });

        setSubmissions(activeSubs);
        storageService.saveSubmissions(activeSubs);
      }
    } catch (err) {
      console.warn('[JudgeContext] Lỗi refreshAllData:', err);
    } finally {
      setIsRefreshing(false);
      isHydratedRef.current = true;
    }
  };

  // 1b. Phiên làm việc của học sinh được duy trì ổn định và bền vững
  // Tuyệt đối không sử dụng setInterval ngầm để đuổi học sinh khi đang ngồi làm bài

  // 1. Phục hồi và tự động đồng bộ dữ liệu khi khởi động (Auth Hydration & Cloud Sync)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        // Đọc và khôi phục phiên xác thực an toàn từ Cookies / localStorage / sessionStorage
        const student = storageService.getStudentSession();
        const admin = storageService.isAdminSessionActive();

        if (student) {
          if (isMounted) {
            setCurrentStudent(student);
            setIsAdminAuthenticated(false);
            setRole('USER');
            setIsAuthModalOpen(false);
          }
        } else if (admin) {
          if (isMounted) {
            setIsAdminAuthenticated(true);
            setRole('ADMIN');
            setIsAuthModalOpen(false);
          }
        } else {
          // Chỉ hiển thị modal đăng nhập khi xác định chắc chắn không có phiên sau khi load
          if (isMounted) {
            setIsAuthModalOpen(true);
          }
        }

        if (isMounted) {
          setIsAuthLoading(false);
        }

        if (storageService.isAdminSessionActive() && apiService.isConfigured()) {
          // Tự động đồng bộ ngầm toàn bộ dữ liệu từ máy này lên Cloud
          apiService.syncAllToCloud().catch((err) => {
            console.warn('[JudgeContext] Lỗi đồng bộ ngầm khi khởi động:', err);
          });
        }
        await refreshAllData();
      } catch (err) {
        if (isMounted) {
          console.warn('Lỗi tải dữ liệu khởi động:', err);
          setIsAuthLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // 1c. TỰ ĐỘNG GIA HẠN THỜI HẠN TOKEN / PHIÊN (SLIDING TOKEN REFRESH)
  // Khi người dùng click, focus hoặc hoạt động, gia hạn cookie/token thêm 30 ngày để không bị hết hạn
  useEffect(() => {
    const handleActivity = () => {
      storageService.refreshSessionExpiry();
    };
    window.addEventListener('focus', handleActivity);
    window.addEventListener('click', handleActivity);
    const tokenRefreshTimer = setInterval(handleActivity, 60000); // 1 phút gia hạn 1 lần
    return () => {
      window.removeEventListener('focus', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearInterval(tokenRefreshTimer);
    };
  }, []);

  // 1.1 TỰ ĐỘNG LÀM MỚI DỮ LIỆU ĐÁM MÂY KHI CHUYỂN TAB HOẶC ĐỊNH KỲ (ĐẢM BẢO HỌC SINH & MÁY B LUÔN CÓ BÀI MỚI)
  useEffect(() => {
    const handleWindowFocus = () => {
      refreshAllData().catch(() => {});
    };
    window.addEventListener('focus', handleWindowFocus);
    const periodicSync = setInterval(() => {
      refreshAllData().catch(() => {});
    }, 90000);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      clearInterval(periodicSync);
    };
  }, []);

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
      (s) => s.username.toLowerCase() === username.trim().toLowerCase() && (s.password || '123') === password.trim()
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
    if (
      currentList.some((s) => s.username.toLowerCase() === cleanUsername) ||
      students.some((s) => s.username.toLowerCase() === cleanUsername)
    ) {
      const msg = `Tên đăng nhập "${cleanUsername}" đã tồn tại trên hệ thống! Vui lòng chọn tên đăng nhập khác.`;
      showToast('Trùng tên đăng nhập', msg, 'error');
      return { success: false, message: msg };
    }

    const newStudent: StudentUser = {
      id: `student_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fullName: fullName.trim(),
      username: cleanUsername,
      password: password.trim(),
      createdAt: new Date().toISOString(),
    };

    const nextList = [newStudent, ...currentList.filter((s) => s.username.toLowerCase() !== cleanUsername)];
    storageService.saveStudents(nextList);
    await apiService.saveStudents(nextList);
    setStudents(nextList);
    showToast('Cấp tài khoản thành công', `Đã tạo tài khoản cho học sinh ${newStudent.fullName} (${newStudent.username})`, 'success');
    return { success: true, message: 'Tạo tài khoản thành công' };
  };

  // Giáo viên đổi mật khẩu cho Học sinh
  const updateStudentPassword = async (id: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!newPassword || !newPassword.trim()) {
      return { success: false, message: 'Vui lòng nhập mật khẩu mới!' };
    }
    const cleanPass = newPassword.trim();
    storageService.updateStudentPassword(id, cleanPass);
    const updatedList = storageService.getStudents();
    setStudents(updatedList);
    await apiService.saveStudents(updatedList);
    const target = updatedList.find((s) => s.id === id);
    showToast(
      'Đổi mật khẩu thành công',
      `Đã cập nhật mật khẩu mới cho học sinh ${target?.fullName || target?.username || ''}.`,
      'success'
    );
    return { success: true, message: 'Đổi mật khẩu thành công' };
  };

  // Giáo viên xóa tài khoản Học sinh
  const deleteStudent = async (id: string) => {
    const studentToDelete = students.find((s) => s.id === id) || storageService.getStudents().find((s) => s.id === id);
    const stuUsername = studentToDelete?.username;
    const stuFullName = studentToDelete?.fullName;

    // 1. Xóa khỏi danh sách học sinh
    storageService.deleteStudent(id);
    const updatedList = storageService.getStudents();
    setStudents(updatedList);
    await apiService.saveStudents(updatedList);

    // 2. Xóa khỏi mọi lớp học
    storageService.removeStudentFromAllClasses(id, stuUsername);
    const remainingClassStudents = storageService.getClassStudents();
    setClassStudents(remainingClassStudents);
    await apiService.saveClassStudents(remainingClassStudents);

    // 3. XÓA TOÀN BỘ LỊCH SỬ NỘP BÀI CỦA HỌC SINH NÀY (LocalStorage, IndexedDB, Supabase Cloud, React State)
    storageService.deleteSubmissionsForStudent(id, stuUsername, stuFullName);
    await apiService.deleteSubmissionsForStudent(id, stuUsername, stuFullName);
    setSubmissions((prev) =>
      prev.filter((sub) => {
        const matchId = sub.userId && sub.userId === id;
        const matchUser = stuUsername && sub.userId && sub.userId.toLowerCase() === stuUsername.toLowerCase();
        const matchName = stuFullName && sub.userName && sub.userName.toLowerCase() === stuFullName.toLowerCase();
        return !(matchId || matchUser || matchName);
      })
    );

    // 4. Nếu học sinh đang đăng nhập chính là tài khoản bị xóa
    if (currentStudent?.id === id || (stuUsername && currentStudent?.username.toLowerCase() === stuUsername.toLowerCase())) {
      logoutStudent();
      showToast('Tài khoản đã bị xóa', 'Tài khoản của bạn đã bị Giáo viên xóa khỏi hệ thống. Vui lòng liên hệ giáo viên!', 'error');
    } else {
      showToast('Đã xóa', `Đã xóa tài khoản học sinh "${stuFullName || stuUsername || ''}" và toàn bộ lịch sử làm bài.`, 'info');
    }
  };

  // Giáo viên (Admin) Đăng nhập - BẮT BUỘC ĐỐI CHIẾU TRỰC TIẾP VỚI DATABASE
  const loginAdmin = async (password: string): Promise<{ success: boolean; message: string }> => {
    if (!password || !password.trim()) {
      return { success: false, message: 'Vui lòng nhập mật mã quản trị viên!' };
    }

    const cleanPass = password.trim();
    // 1. Đối chiếu trực tiếp với Supabase Cloud Database qua API
    let isValid = await apiService.verifyAdminPassword(cleanPass);

    // Nếu mật mã trên Cloud chưa khớp nhưng khớp với mật mã lưu trên máy này
    // (do lần đổi hôm qua trên máy A chưa kịp đẩy lên Cloud) -> Tự động khôi phục và cập nhật lên Cloud!
    if (!isValid && cleanPass === storageService.getAdminPassword().trim()) {
      const synced = await apiService.updateAdminPasswordInDatabase(cleanPass);
      if (synced) {
        isValid = true;
      }
    }

    if (isValid) {
      // Dọn dẹp session học sinh nếu có
      storageService.setStudentSession(null);
      setCurrentStudent(null);

      setIsAdminAuthenticated(true);
      setRole('ADMIN');
      storageService.setAdminSessionActive(true);
      sessionStorage.setItem('faminh_admin_verified_pass', cleanPass);
      try { localStorage.setItem('faminh_admin_verified_pass', cleanPass); } catch {}
      storageService.setCookie('faminh_admin_verified_pass', cleanPass, 30);
      setIsAuthModalOpen(false);

      // TỰ ĐỘNG ĐỒNG BỘ TOÀN BỘ BÀI TẬP, TEST CASE, LỚP VÀ HỌC SINH TỪ MÁY NÀY LÊN CLOUD
      apiService.syncAllToCloud().then(async (res) => {
        console.log('[JudgeContext] Đồng bộ tự động ngầm thành công:', res);
        await refreshAllData();
      }).catch((err) => {
        console.warn('[JudgeContext] Lỗi đồng bộ ngầm sau đăng nhập:', err);
      });

      // Kéo dữ liệu mới nhất từ Database
      await refreshAllData();

      showToast(
        'Xác thực thành công',
        'Chào mừng Giáo viên FAMINH! Hệ thống đã tự động bật đồng bộ toàn diện trên Cloud.',
        'success'
      );
      return { success: true, message: 'Đăng nhập thành công' };
    } else {
      // Đối chiếu sai mật khẩu: ÉP VĂNG / TỪ CHỐI
      storageService.clearAllStorageAndCookies();
      sessionStorage.removeItem('faminh_admin_verified_pass');
      try { localStorage.removeItem('faminh_admin_verified_pass'); } catch {}
      storageService.deleteCookie('faminh_admin_verified_pass');
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
    try { localStorage.removeItem('faminh_admin_verified_pass'); } catch {}
    storageService.deleteCookie('faminh_admin_verified_pass');
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
    // 1. Kiểm tra mật khẩu cũ trực tiếp qua Database hoặc fallback mật khẩu máy này
    let isOldValid = await apiService.verifyAdminPassword(oldPass);
    if (!isOldValid && oldPass.trim() === storageService.getAdminPassword().trim()) {
      isOldValid = true;
    }
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
      try { localStorage.setItem('faminh_admin_verified_pass', newPass.trim()); } catch {}
      storageService.setCookie('faminh_admin_verified_pass', newPass.trim(), 30);
      setIsChangePasswordModalOpen(false);
      showToast('Đổi mật mã thành công', 'Mật mã quản trị FAMINH mới đã được cập nhật an toàn lên Database đám mây.', 'success');
      return { success: true, message: 'Đổi mật mã thành công' };
    } else {
      return { success: false, message: 'Không thể kết nối đến Database để đổi mật mã!' };
    }
  };

  const addTopic = async (topicData: Omit<Topic, 'id'>): Promise<Topic> => {
    if (!isAdminAuthenticated) {
      showToast('Không có quyền', 'Chỉ quản trị viên mới được tạo chủ đề', 'error');
      throw new Error('Chỉ quản trị viên mới được tạo chủ đề');
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
    try {
      await apiService.saveTopics(nextTopics);
    } catch (e) {
      console.warn('Lỗi lưu chủ đề lên Cloud:', e);
    }
    setTopics(nextTopics);
    showToast('Thành công', `Đã tạo chủ đề "${newTopic.name}"`, 'success');
    return newTopic;
  };

  const updateTopic = async (id: string, updated: Partial<Topic>): Promise<void> => {
    if (!isAdminAuthenticated) return;
    const nextTopics = topics.map((t) => {
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
    });
    try {
      await apiService.saveTopics(nextTopics);
    } catch (e) {
      console.warn('Lỗi cập nhật chủ đề lên Cloud:', e);
    }
    setTopics(nextTopics);
    showToast('Thành công', 'Đã cập nhật chủ đề', 'success');
  };

  const deleteTopic = async (id: string): Promise<void> => {
    if (!isAdminAuthenticated) return;
    const nextTopics = topics.filter((t) => t.id !== id);
    try {
      await apiService.saveTopics(nextTopics);
    } catch (e) {
      console.warn('Lỗi xóa chủ đề trên Cloud:', e);
    }
    setTopics(nextTopics);
    showToast('Đã xóa', 'Đã xóa chủ đề được chọn', 'info');
  };

  const reorderTopics = async (topicIds: string[]): Promise<void> => {
    if (!isAdminAuthenticated) return;
    const topicMap = new Map(topics.map((t) => [t.id, t]));
    const reordered: Topic[] = [];
    topicIds.forEach((id, idx) => {
      const item = topicMap.get(id);
      if (item) {
        reordered.push({ ...item, order: idx + 1 });
      }
    });
    try {
      await apiService.saveTopics(reordered);
    } catch (e) {
      console.warn('Lỗi lưu thứ tự chủ đề lên Cloud:', e);
    }
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
    let mergedTestCases =
      updated.testCases && updated.testCases.length > 0
        ? updated.testCases
        : (existing.testCases && existing.testCases.length > 0 ? existing.testCases : []);

    if (mergedTestCases.length === 0) {
      const idbTests = await idbService.getTestCases(id);
      if (idbTests && idbTests.length > 0) {
        mergedTestCases = idbTests;
      }
    }

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

    // Kiểm tra tài khoản học sinh còn hợp lệ trước khi cho nộp bài
    if (!isAdminAuthenticated && currentStudent) {
      const allStudents = await apiService.fetchStudents();
      const stillExists = allStudents.some(
        (s) =>
          (s.id && currentStudent.id && s.id === currentStudent.id) ||
          (s.username && currentStudent.username && s.username.toLowerCase() === currentStudent.username.toLowerCase())
      );
      if (!stillExists && allStudents.length > 0) {
        logoutStudent();
        showToast(
          'Tài khoản không tồn tại',
          'Tài khoản học sinh của bạn đã bị Giáo viên xóa khỏi hệ thống. Bạn đã được chuyển về trang đăng nhập.',
          'error'
        );
        throw new Error('Tài khoản học sinh đã bị xóa khỏi hệ thống');
      }
    }

    // Nạp khẩn cấp từ Database nếu problem trong React state chưa có test hoặc test bị rỗng input do nén
    const hasRealTests = (problem.testCases || []).some(
      (t) => (t.input && t.input.trim().length > 0) || (t.expectedOutput && t.expectedOutput.trim().length > 0)
    );
    if (!problem.testCases || problem.testCases.length === 0 || !hasRealTests) {
      let savedTests = await idbService.getTestCases(problem.id);
      if (!savedTests || savedTests.length === 0) {
        savedTests = await apiService.fetchTestCases(problem.id);
      }
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
        isAuthLoading,
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
        updateStudentPassword,
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
        pendingClasses,
        createClass,
        updateClass,
        deleteClass,
        joinClassByCode,
        getStudentsInClass,
        getPendingStudentsInClass,
        approveStudentJoin,
        rejectStudentJoin,
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
