import React, { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { UserRole, Topic, Problem, Submission, UserStats, StudentUser, Classroom, ClassStudent } from '../types/judge';
import { storageService, DEFAULT_CLASS } from '../services/storageService';
import { idbService } from '../services/db';
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
  loginStudent: (username: string, password: string) => { success: boolean; message: string };
  logoutStudent: () => void;
  addStudent: (fullName: string, username: string, password: string) => { success: boolean; message: string };
  deleteStudent: (id: string) => void;

  // Admin Auth Actions
  loginAdmin: (password: string) => { success: boolean; message: string };
  logoutAdmin: () => void;
  changeAdminPassword: (oldPass: string, newPass: string) => { success: boolean; message: string };

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
    setClasses(storageService.getClasses());
    showToast('Tạo lớp thành công', `Đã tạo lớp "${newClass.className}" - Mã tham gia: ${newClass.joinCode}`, 'success');
    return newClass;
  };

  const updateClass = (id: string, data: Partial<Classroom>) => {
    storageService.updateClass(id, data);
    setClasses(storageService.getClasses());
    showToast('Cập nhật thành công', 'Đã lưu thay đổi thông tin lớp học', 'success');
  };

  const deleteClass = (id: string) => {
    storageService.deleteClass(id);
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
      setClassStudents(storageService.getClassStudents());
      setClasses(storageService.getClasses());
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
    setClassStudents(storageService.getClassStudents());
    showToast('Thành công', 'Đã thêm học sinh vào lớp', 'success');
  };

  const removeStudentFromClass = (classId: string, studentId: string) => {
    storageService.removeStudentFromClass(classId, studentId);
    setClassStudents(storageService.getClassStudents());
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

  // 1. Phục hồi và bổ sung dữ liệu bài tập, test cases & lịch sử nộp bài từ IndexedDB
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [cloudProblems, cloudSubmissions] = await Promise.all([
          apiService.fetchProblems(),
          apiService.fetchSubmissions(),
        ]);
        if (!isMounted) return;

        if (cloudProblems && cloudProblems.length > 0) {
          setProblems((prev) => {
            const mergedMap = new Map<string, Problem>();
            // 1. Nạp toàn bộ bài từ Database thực tế vào trước (chứa 100% test cases)
            cloudProblems.forEach((p) => mergedMap.set(p.id, p));

            // 2. Kết hợp với bài trong prev nếu prev có bài mới hơn hoặc có test case thực sự
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
                } else if (!existingHasRealTests && !prevHasRealTests && (p.testCases?.length || 0) > (existing.testCases?.length || 0)) {
                  mergedMap.set(p.id, { ...existing, testCases: p.testCases });
                }
              }
            });

            const finalList = Array.from(mergedMap.values());
            return finalList;
          });

          setActiveProblem((curr) => {
            if (!curr) return cloudProblems[0] || null;
            const updated = cloudProblems.find((p) => p.id === curr.id);
            return updated || curr;
          });
        } else {
          // Lần đầu mở app hoặc DB v2 mới khởi tạo: nạp dữ liệu hiện có từ localStorage vào IndexedDB
          const current = storageService.getProblems();
          if (current.length > 0) {
            await idbService.saveProblems(current);
          }
        }

        // BỔ SUNG QUAN TRỌNG: Nạp toàn bộ lịch sử nộp bài (AC) từ Database thực tế vào React state
        if (cloudSubmissions && cloudSubmissions.length > 0) {
          setSubmissions((prev) => {
            const subMap = new Map<string, Submission>();
            // Nạp từ prev trước, sau đó ghi đè bằng cloudSubmissions (nguồn chính thức và đầy đủ nhất từ DB)
            prev.forEach((s) => subMap.set(s.id, s));
            cloudSubmissions.forEach((s) => subMap.set(s.id, s));
            return Array.from(subMap.values()).sort(
              (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
            );
          });
        }
      } catch (err) {
        console.warn('Lỗi đồng bộ IndexedDB vào React state:', err);
      } finally {
        isHydratedRef.current = true;
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    storageService.saveTopics(topics);
  }, [topics]);

  // 2. Chỉ lưu problems khi đã hoàn tất hydration từ IndexedDB để không bị ghi đè dữ liệu rỗng
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
