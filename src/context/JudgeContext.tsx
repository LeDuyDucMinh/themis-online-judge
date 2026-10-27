import React, { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { UserRole, Topic, Problem, Submission, UserStats, StudentUser, Classroom, ClassStudent, TestCase } from '../types/judge';
import { storageService, resolveStudentFullName } from '../services/storageService';
import { apiService } from '../services/apiService';
import { idbService } from '../services/db';
import { gradeSubmission, type GradingProgressCallback, type SupportedLanguage } from '../services/judgeEngine';
import { supabase, fetchUserRoleFromSupabase } from '../services/supabaseClient';
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
  setRole: (role: UserRole) => void;
  isAdminAuthenticated: boolean;
  setIsAdminAuthenticated: (auth: boolean) => void;
  currentStudent: StudentUser | null;
  setCurrentStudent: (student: StudentUser | null) => void;
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
  isChangeNameModalOpen: boolean;
  setIsChangeNameModalOpen: (open: boolean) => void;
  isServerConfigModalOpen: boolean;
  setIsServerConfigModalOpen: (open: boolean) => void;

  // Cơ chế "Lưới điện" (Action-Triggered Logout) - Modal cảnh báo phiên làm việc bị thu hồi
  isSessionRevokedModalOpen: boolean;
  setIsSessionRevokedModalOpen: (open: boolean) => void;
  handleAcknowledgeRevokedSession: () => void;

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
  logoutStudent: (options?: { reason?: string } | any) => void;
  verifyStudentAccountStatus: (options?: { force?: boolean }) => Promise<boolean>;
  addStudent: (fullName: string, username: string, password: string) => Promise<{ success: boolean; message: string }>;
  updateStudentPassword: (id: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  updateStudentName: (newName: string) => Promise<{ success: boolean; message: string }>;
  deleteStudent: (id: string) => Promise<void>;

  // Admin Auth Actions
  loginAdmin: (password: string) => Promise<{ success: boolean; message: string }>;
  logoutAdmin: () => void;
  changeAdminPassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;

  // Refresh & Anti-Cache
  refreshAllData: () => Promise<void>;
  refreshStudents: () => Promise<void>;
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
  const [isChangeNameModalOpen, setIsChangeNameModalOpen] = useState(false);
  const [isServerConfigModalOpen, setIsServerConfigModalOpen] = useState(false);

  // Cơ chế "Lưới điện" (Action-Triggered Logout) - Modal cảnh báo phiên làm việc bị thu hồi
  const [isSessionRevokedModalOpen, setIsSessionRevokedModalOpen] = useState(false);

  // Multi-Classroom State
  const [classes, setClasses] = useState<Classroom[]>(() => storageService.getClasses());
  const [classStudents, setClassStudents] = useState<ClassStudent[]>(() => storageService.getClassStudents());
  const [activeClassId, setActiveClassIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '');
      const match = hash.match(/(?:admin\/)?classes\/([^/?#]+)/);
      if (match && match[1] && match[1] !== 'new') {
        return match[1];
      }
    }
    return storageService.getActiveClassId();
  });

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

  /**
   * Xử lý khi học sinh bấm nút "Về trang Đăng nhập" trên Modal cảnh báo Lưới điện
   * Chỉ khi học sinh tự tay bấm vào nút này, hệ thống mới xóa bộ nhớ đệm (localStorage)
   * và điều hướng về cửa cổng đăng nhập.
   */
  /**
   * Cơ chế Lưới điện / Văng nick đã được dỡ bỏ hoàn toàn.
   * Hàm này giữ lại để tương thích interface nhưng tuyệt đối không logout học sinh.
   */
  const handleAcknowledgeRevokedSession = () => {
    setIsSessionRevokedModalOpen(false);
  };

  /**
   * CƠ CHẾ VĂNG NICK ĐÃ ĐƯỢC XÓA BỎ HOÀN TOÀN:
   * Dù cho học sinh có bị xóa tài khoản hay không, hệ thống vẫn để nguyên nick đang đăng nhập.
   * Luôn trả về true an toàn, không bao giờ mở modal văng nick hay ngắt phiên làm việc.
   */
  const checkActionTriggeredSession = async (_studentToCheck?: StudentUser | null): Promise<boolean> => {
    return true;
  };

  /**
   * Tính năng tự động văng học sinh đã được tắt hoàn toàn theo yêu cầu người dùng.
   * Luôn trả về true để học sinh duy trì phiên làm việc ổn định, không bao giờ bị văng ngẫu nhiên.
   */
  const verifyStudentAccountStatus = async (_options?: { force?: boolean }): Promise<boolean> => {
    return true;
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

    // CƠ CHẾ "LƯỚI ĐIỆN": Kiểm tra tài khoản khi học sinh thực hiện hành động tham gia lớp
    const isSessionValid = await checkActionTriggeredSession(student);
    if (!isSessionValid) {
      return {
        success: false,
        message: 'Phiên đăng nhập đã hết hạn hoặc tài khoản đã được thu hồi. Vui lòng liên hệ Giáo viên để biết thêm chi tiết.',
      };
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

    // 4. Tạo quan hệ tham gia lớp học ở trạng thái CHỜ PHÊ DUYỆT (pending)
    const newRelation: ClassStudent = {
      classId: targetClass.id,
      studentId: student.id,
      studentName: student.fullName,
      studentUsername: student.username,
      studentEmail: student.email,
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

    // Luôn đồng bộ hồ sơ học sinh lên Cloud để Giáo viên nhìn thấy ngay trong danh sách chờ duyệt
    try {
      await apiService.saveStudents([student]);
    } catch (e) {
      console.warn('Lỗi ghi thông tin học sinh lên Cloud:', e);
    }

    showToast(
      'Đã gửi yêu cầu tham gia',
      `Yêu cầu tham gia lớp "${targetClass.className}" đã được gửi tới Giáo viên. Vui lòng chờ Thầy/Cô phê duyệt để vào lớp!`,
      'info'
    );
    return {
      success: true,
      pending: true,
      message: `Yêu cầu tham gia lớp "${targetClass.className}" đang chờ giáo viên phê duyệt!`,
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
    const rawRelations = classStudents.length > 0 ? classStudents : storageService.getClassStudents();
    const relations = rawRelations.filter(
      (cs) => cs.classId === classId && cs.status === 'pending'
    );
    const rawStudents = students.length > 0 ? students : storageService.getStudents();
    const studentMap = new Map<string, StudentUser>();
    rawStudents.forEach((s) => {
      studentMap.set(s.id, s);
      if (s.username) studentMap.set(s.username.toLowerCase(), s);
      if (s.email) studentMap.set(s.email.toLowerCase(), s);
      if (s.fullName) studentMap.set(s.fullName.toLowerCase(), s);
    });
    return relations.map((rel) => {
      const found = studentMap.get(rel.studentId) ||
        (rel.studentEmail ? studentMap.get(rel.studentEmail.toLowerCase()) : undefined) ||
        (rel.studentUsername ? studentMap.get(rel.studentUsername.toLowerCase()) : undefined) ||
        (rel.studentName ? studentMap.get(rel.studentName.toLowerCase()) : undefined);
      const rawEmail = found?.email || rel.studentEmail || (found?.username?.includes('@') ? found.username : rel.studentUsername?.includes('@') ? rel.studentUsername : undefined);
      const studentEmail = rawEmail === 'leduyducminh@gmail.com' ? 'minh.ldd2610979@sis.hust.edu.vn' : rawEmail;
      const stu: StudentUser = found ? {
        ...found,
        fullName: found.fullName && found.fullName !== 'Học sinh' ? found.fullName : (rel.studentName || found.fullName || 'Học sinh'),
        email: studentEmail,
        username: studentEmail || found.username,
      } : {
        id: rel.studentId,
        fullName: rel.studentName || 'Học sinh',
        username: studentEmail || rel.studentUsername || rel.studentId,
        email: studentEmail,
        password: '',
        createdAt: rel.joinedAt,
      };
      return { student: stu, joinedAt: rel.joinedAt };
    });
  };

  const getStudentsInClass = (classId: string): StudentUser[] => {
    const rawRelations = classStudents.length > 0 ? classStudents : storageService.getClassStudents();
    const relations = rawRelations.filter(
      (cs) => cs.classId === classId && (!cs.status || cs.status === 'approved')
    );
    const rawStudents = students.length > 0 ? students : storageService.getStudents();
    const studentMap = new Map<string, StudentUser>();
    rawStudents.forEach((s) => {
      studentMap.set(s.id, s);
      if (s.username) studentMap.set(s.username.toLowerCase(), s);
      if (s.email) studentMap.set(s.email.toLowerCase(), s);
      if (s.fullName) studentMap.set(s.fullName.toLowerCase(), s);
    });

    return relations.map((rel) => {
      const found = studentMap.get(rel.studentId) ||
        (rel.studentEmail ? studentMap.get(rel.studentEmail.toLowerCase()) : undefined) ||
        (rel.studentUsername ? studentMap.get(rel.studentUsername.toLowerCase()) : undefined) ||
        (rel.studentName ? studentMap.get(rel.studentName.toLowerCase()) : undefined);
      if (found) {
        const rawEmail = found.email || rel.studentEmail || (found.username?.includes('@') ? found.username : rel.studentUsername?.includes('@') ? rel.studentUsername : undefined);
        const studentEmail = rawEmail === 'leduyducminh@gmail.com' ? 'minh.ldd2610979@sis.hust.edu.vn' : rawEmail;
        return {
          ...found,
          fullName: found.fullName && found.fullName !== 'Học sinh' ? found.fullName : (rel.studentName || found.fullName || 'Học sinh'),
          email: studentEmail,
          username: studentEmail || found.username,
        };
      }
      const rawEmail = rel.studentEmail || (rel.studentUsername?.includes('@') ? rel.studentUsername : undefined);
      const studentEmail = rawEmail === 'leduyducminh@gmail.com' ? 'minh.ldd2610979@sis.hust.edu.vn' : rawEmail;
      return {
        id: rel.studentId,
        fullName: rel.studentName || 'Học sinh',
        username: studentEmail || rel.studentUsername || rel.studentId,
        email: studentEmail,
        password: '',
        createdAt: rel.joinedAt,
      };
    });
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
        storageService.saveClasses(cloudClasses);
      }
      if (cloudRelations) {
        setClassStudents(cloudRelations);
        storageService.saveClassStudents(cloudRelations);
      }
      if (cloudStudents || storageService.getStudents().length > 0) {
        const local = storageService.getStudents();
        const studentMap = new Map<string, StudentUser>();
        // Cloud là Single Source of Truth
        if (cloudStudents && cloudStudents.length > 0) {
          cloudStudents.forEach((s) => {
            const key = (s.id || s.username || '').toLowerCase();
            if (key && s.username !== 'leduyducminh@gmail.com') studentMap.set(key, s);
          });
        }
        local.forEach((s) => {
          const key = (s.id || s.username || '').toLowerCase();
          if (key && !studentMap.has(key) && s.username !== 'leduyducminh@gmail.com') {
            studentMap.set(key, s);
          }
        });
        const mergedStudents = Array.from(studentMap.values()).filter((s) => s.username && s.username !== 'leduyducminh@gmail.com');
        if (mergedStudents.length > 0) {
          setStudents(mergedStudents);
          storageService.saveStudents(mergedStudents);
        }

        // Luôn bảo vệ và cập nhật họ tên tùy chỉnh của học sinh từ Cloud nếu có
        const activeSession = storageService.getStudentSession();
        if (activeSession && cloudStudents && cloudStudents.length > 0) {
          const match = cloudStudents.find((s) =>
            (activeSession.id && s.id === activeSession.id) ||
            (activeSession.email && s.email && s.email.toLowerCase() === activeSession.email.toLowerCase()) ||
            (activeSession.username && s.username && s.username.toLowerCase() === activeSession.username.toLowerCase())
          );
          if (match?.fullName && match.fullName !== 'Học sinh' && match.fullName !== activeSession.fullName) {
            const custom = storageService.getStudentCustomName(activeSession.id, activeSession.email);
            const chosen = custom || match.fullName;
            const updated = { ...activeSession, fullName: chosen };
            setCurrentStudent(updated);
            storageService.setStudentSession(updated);
          }
        }
      }
      if (cloudTopics) {
        setTopics(cloudTopics);
        storageService.saveTopics(cloudTopics);
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
        const validStudentEmails = new Set(currentStudentList.map((s) => (s.email || '').trim().toLowerCase()));
        const validStudentNames = new Set(currentStudentList.map((s) => (s.fullName || '').trim().toLowerCase()));
        const validStudentIds = new Set(currentStudentList.map((s) => (s.id || '').trim().toLowerCase()));

        const curSession = storageService.getStudentSession();
        if (curSession) {
          if (curSession.id) validStudentIds.add(curSession.id.trim().toLowerCase());
          if (curSession.username) validStudentUsers.add(curSession.username.trim().toLowerCase());
          if (curSession.email) validStudentEmails.add(curSession.email.trim().toLowerCase());
          if (curSession.fullName) validStudentNames.add(curSession.fullName.trim().toLowerCase());
        }

        const activeSubs = cloudSubs.filter((sub) => {
          if (sub.userId === 'admin_faminh' || sub.userName === 'Giáo viên FAMINH') return true;
          const subUser = (sub.userId || '').trim().toLowerCase();
          const subName = (sub.userName || '').trim().toLowerCase();
          const matchId = Boolean(subUser && validStudentIds.has(subUser));
          const matchUser = Boolean(subUser && validStudentUsers.has(subUser));
          const matchEmail = Boolean(subUser && validStudentEmails.has(subUser));
          const matchName = Boolean(subName && validStudentNames.has(subName));
          return matchId || matchUser || matchEmail || matchName;
        });

        const currentSubMap = new Map(submissions.map((s) => [s.id, s]));
        const enrichedSubs = activeSubs.map((sub) => {
          let updatedUserName = sub.userName;
          // Đồng bộ với tên mới nhất của học sinh hiện tại nếu bài nộp thuộc học sinh này
          if (
            curSession &&
            ((sub.userId && curSession.id && sub.userId.trim().toLowerCase() === curSession.id.trim().toLowerCase()) ||
              (sub.userId && curSession.username && sub.userId.trim().toLowerCase() === curSession.username.trim().toLowerCase()) ||
              (sub.userId && curSession.email && sub.userId.trim().toLowerCase() === curSession.email.trim().toLowerCase()))
          ) {
            const custom = storageService.getStudentCustomName(curSession.id, curSession.email);
            updatedUserName = custom || curSession.fullName || updatedUserName;
          }

          let res: Submission = { ...sub, userName: updatedUserName };
          if (res.testResults && res.testResults.length > 0) return res;
          const localMatch = currentSubMap.get(res.id);
          if (localMatch?.testResults && localMatch.testResults.length > 0) {
            return { ...res, testResults: localMatch.testResults };
          }
          return res;
        });

        setSubmissions(enrichedSubs);
        storageService.saveSubmissions(enrichedSubs);
      }
    } catch (err) {
      console.warn('[JudgeContext] Lỗi refreshAllData:', err);
    } finally {
      setIsRefreshing(false);
      isHydratedRef.current = true;
    }
  };

  /**
   * Làm mới NHẸ chỉ danh sách học sinh (vài trăm byte) - dùng cho bảng Quản lý học sinh.
   * Giáo viên: tự đẩy học sinh chỉ có trên máy này lên Cloud để máy khác nhìn thấy.
   */
  const PENDING_STUDENTS_KEY = 'faminh_pending_student_ids';
  const getPendingStudentIds = (): string[] => {
    try {
      const v = JSON.parse(localStorage.getItem(PENDING_STUDENTS_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const setPendingStudentIds = (ids: string[]) => {
    try { localStorage.setItem(PENDING_STUDENTS_KEY, JSON.stringify(ids)); } catch {}
  };

  const refreshStudents = async (): Promise<void> => {
    try {
      const raw = await apiService.fetchRawCloudStudents();
      if (raw === null) return;

      // Cloud là chân lý; chỉ giữ thêm các tài khoản máy này mới tạo mà chưa upload được
      const pending = new Set(getPendingStudentIds());
      const studentMap = new Map<string, StudentUser>();
      raw.forEach((s) => studentMap.set((s.username || '').toLowerCase(), s));
      const unsynced: StudentUser[] = [];
      storageService.getStudents().forEach((s) => {
        const u = (s.username || '').toLowerCase();
        if (u && pending.has(s.id) && !studentMap.has(u)) {
          studentMap.set(u, s);
          unsynced.push(s);
        }
      });
      let merged = Array.from(studentMap.values()).filter((s) => s.username);

      if (unsynced.length > 0 && storageService.isAdminSessionActive()) {
        try {
          merged = await apiService.saveStudents(merged);
          setPendingStudentIds([]);
        } catch (e) {
          console.warn('[JudgeContext] Chưa đẩy được học sinh mới lên Cloud, sẽ thử lại:', e);
        }
      } else {
        setPendingStudentIds(Array.from(pending).filter((id) => unsynced.some((u) => u.id === id)));
      }
      storageService.saveStudents(merged);
      setStudents(merged);
    } catch (err) {
      console.warn('[JudgeContext] Lỗi refreshStudents:', err);
    }
  };

  // 1b. Phiên làm việc của học sinh được duy trì ổn định và bền vững
  // Tuyệt đối không sử dụng setInterval ngầm để đuổi học sinh khi đang ngồi làm bài

  // 1a. LẮNG NGHE THAY ĐỔI TRẠNG THÁI XÁC THỰC SUPABASE AUTH (OAuth Google & Email/Password)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const u = session.user;
        const fullName = resolveStudentFullName(
          u.id,
          u.email,
          u.user_metadata?.custom_full_name || u.user_metadata?.full_name || u.user_metadata?.name
        );

        // Truy vấn vai trò (Role) trực tiếp từ Supabase Database
        const roleRes = await fetchUserRoleFromSupabase(u.id, u.email);

        // Kiểm tra xem người dùng có phải vừa đăng nhập qua Google OAuth hay không
        const isGoogleLogin = typeof window !== 'undefined' && (
          sessionStorage.getItem('faminh_pending_google_oauth_login') === 'true' ||
          localStorage.getItem('faminh_pending_google_oauth_login') === 'true'
        );
        if (isGoogleLogin && typeof window !== 'undefined') {
          sessionStorage.removeItem('faminh_pending_google_oauth_login');
          localStorage.removeItem('faminh_pending_google_oauth_login');
        }

        if (roleRes.role === 'admin') {
          // Người dùng là QUẢN TRỊ VIÊN (Admin)
          setIsAdminAuthenticated(true);
          setRole('ADMIN');
          storageService.setAdminSessionActive(true);
          setCurrentStudent(null);
          setIsAuthModalOpen(false);

          // Auto Redirect thẳng vào giao diện Quản trị viên (nếu chưa ở trong trang admin)
          if (typeof window !== 'undefined') {
            if (!window.location.hash.startsWith('#admin')) {
              window.location.hash = '#admin/classes';
              window.history.pushState({}, '', '/#admin/classes');
            }
          }

          // CHỈ HIỂN THỊ THÔNG BÁO CHÀO MỪNG DUY NHẤT KHI VỪA ĐĂNG NHẬP GOOGLE THÀNH CÔNG
          // Tuyệt đối không lặp lại khi chuyển tab, reload hoặc mở lại trình duyệt
          if (isGoogleLogin) {
            showToast('Quản trị viên', `Chào mừng ${fullName}! Đã kích hoạt quyền Quản trị viên hệ thống.`, 'success');
          }
        } else {
          // Người dùng là HỌC SINH (Student) hoặc các vai trò khác
          const studentUser: StudentUser = {
            id: u.id,
            fullName,
            username: u.email || u.id,
            email: u.email,
            password: '',
            createdAt: u.created_at || new Date().toISOString(),
          };
          setCurrentStudent(studentUser);
          storageService.setStudentSession(studentUser);
          setIsAdminAuthenticated(false);
          setRole('USER');
          storageService.setAdminSessionActive(false);
          setIsAuthModalOpen(false);

          // Tự động lưu học sinh lên Cloud để Giáo viên có thể nhìn thấy trong lớp
          apiService.saveStudents([studentUser]).catch(() => {});

          // Auto Redirect về không gian luyện thi/nộp bài của Học sinh
          if (typeof window !== 'undefined') {
            if (
              window.location.hash.startsWith('#admin') ||
              window.location.pathname.startsWith('/admin') ||
              window.location.pathname === '/login'
            ) {
              window.location.hash = '#classes';
              window.history.pushState({}, '', '/#classes');
            }
          }

          // CHỈ HIỂN THỊ THÔNG BÁO CHÀO MỪNG DUY NHẤT KHI VỪA ĐĂNG NHẬP GOOGLE THÀNH CÔNG
          // Tuyệt đối không lặp lại khi chuyển tab, reload hoặc mở lại trình duyệt
          if (isGoogleLogin) {
            showToast('Đăng nhập thành công', `Chào mừng ${fullName}! Chúc em học tập tốt.`, 'success');
          }
        }
      } else if (event === 'SIGNED_OUT') {
        storageService.setAdminSessionActive(false);
        storageService.setStudentSession(null);
        setIsAdminAuthenticated(false);
        setCurrentStudent(null);
        setRole('USER');
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('faminh_pending_google_oauth_login');
          localStorage.removeItem('faminh_pending_google_oauth_login');
          window.location.hash = '#classes';
          window.history.pushState({}, '', '/#classes');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 1. Phục hồi và tự động đồng bộ dữ liệu khi khởi động (Auth Hydration & Cloud Sync)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        // 1. Khôi phục phiên Supabase Auth (Email / Google OAuth)
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const u = session.user;
            const fullName = resolveStudentFullName(
              u.id,
              u.email,
              u.user_metadata?.custom_full_name || u.user_metadata?.full_name || u.user_metadata?.name
            );

            // Kiểm tra vai trò từ Supabase Database
            const roleRes = await fetchUserRoleFromSupabase(u.id, u.email);

            if (roleRes.role === 'admin') {
              if (isMounted) {
                setIsAdminAuthenticated(true);
                setRole('ADMIN');
                storageService.setAdminSessionActive(true);
                setCurrentStudent(null);
                setIsAuthModalOpen(false);
              }
            } else {
              const student = {
                id: u.id,
                fullName,
                username: u.email || u.id,
                email: u.email,
                password: '',
                createdAt: u.created_at || new Date().toISOString(),
              };
              if (isMounted) {
                storageService.setStudentSession(student);
                setCurrentStudent(student);
                setIsAdminAuthenticated(false);
                setRole('USER');
                storageService.setAdminSessionActive(false);
                setIsAuthModalOpen(false);
              }
              apiService.saveStudents([student]).catch(() => {});
            }
          } else {
            // Không có session Supabase Auth hợp lệ
            const localStudent = storageService.getStudentSession();
            if (localStudent) {
              if (isMounted) {
                setCurrentStudent(localStudent);
                setIsAdminAuthenticated(false);
                setRole('USER');
                setIsAuthModalOpen(false);
              }
            } else {
              if (isMounted) {
                setIsAdminAuthenticated(false);
                setRole('USER');
                storageService.setAdminSessionActive(false);
                setIsAuthModalOpen(true);
              }
            }
          }
        } catch (e) {
          console.warn('[JudgeContext] Lỗi đọc session Supabase Auth:', e);
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

        // Học sinh giữ nguyên phiên làm việc ổn định, tuyệt đối không tự ý ngắt phiên khi nạp trang
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
      storageService.refreshSessionExpiry(currentStudent);
    };
    window.addEventListener('focus', handleActivity);
    window.addEventListener('click', handleActivity);
    const tokenRefreshTimer = setInterval(handleActivity, 60000); // 1 phút gia hạn 1 lần
    return () => {
      window.removeEventListener('focus', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearInterval(tokenRefreshTimer);
    };
  }, [currentStudent]);

  // Luôn liên tục neo chặt phiên học sinh vào localStorage & cookies khi tài khoản đang đăng nhập
  useEffect(() => {
    if (currentStudent) {
      storageService.setStudentSession(currentStudent);
    }
  }, [currentStudent]);

  // 1.1 TỰ ĐỘNG LÀM MỚI DỮ LIỆU ĐÁM MÂY KHI CHUYỂN TAB HOẶC ĐỊNH KỲ (ĐẢM BẢO HỌC SINH & MÁY B LUÔN CÓ BÀI MỚI)
  useEffect(() => {
    let lastFocusTime = 0;
    const handleWindowFocus = () => {
      const now = Date.now();
      if (now - lastFocusTime < 25000) return; // Không spam refresh quá dồn dập khi click chuột qua lại giữa các cửa sổ
      lastFocusTime = now;
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

  // Học sinh Đăng nhập - Tìm kiếm đa tầng (React State, LocalStorage, Supabase Cloud)
  const loginStudent = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
    if (!username.trim() || !password.trim()) {
      return { success: false, message: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu!' };
    }

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // Gom học sinh từ mọi nguồn (tránh độ trễ mạng hoặc bộ nhớ cục bộ)
    const studentMap = new Map<string, StudentUser>();
    storageService.getStudents().forEach((s) => studentMap.set((s.username || '').toLowerCase(), s));
    students.forEach((s) => studentMap.set((s.username || '').toLowerCase(), s));
    try {
      const cloudList = await apiService.fetchStudents();
      if (cloudList && cloudList.length > 0) {
        cloudList.forEach((s) => studentMap.set((s.username || '').toLowerCase(), s));
      }
    } catch {}

    const allStudents = Array.from(studentMap.values());
    const found = allStudents.find(
      (s) => s.username.toLowerCase() === cleanUser && (s.password || '123') === cleanPass
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

      // Đảm bảo học sinh đã đăng nhập được lưu đồng bộ vào bộ nhớ của máy này
      storageService.saveStudents(allStudents);

      // Tải dữ liệu lớp học ở chế độ nền: không bắt học sinh chờ ~10MB dữ liệu mới vào được web
      refreshAllData().catch((e) => console.warn('[JudgeContext] Lỗi tải nền sau đăng nhập học sinh:', e));

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

  // Học sinh Đăng xuất - Chỉ xóa session của học sinh này, tuyệt đối không xóa database hay danh sách lớp/bài tập
  const logoutStudent = (options?: { reason?: string } | any) => {
    supabase.auth.signOut().catch((e) => console.warn('[JudgeContext] Lỗi Supabase signOut:', e));
    storageService.setStudentSession(null);
    setCurrentStudent(null);
    setActiveClassId(null);
    setActiveProblem(null);
    setIsAuthModalOpen(true);
    setAuthModalTab('student');
    const customReason =
      options && typeof options === 'object' && 'reason' in options && typeof options.reason === 'string'
        ? options.reason
        : null;
    if (customReason) {
      showToast('Đã đăng xuất', customReason, 'info');
    } else {
      showToast('Đã đăng xuất', 'Đã đăng xuất tài khoản học sinh an toàn.', 'info');
    }
  };

  // Học sinh tự đổi họ và tên - Đồng bộ tức thì lên Cloud (cả học sinh và danh sách lớp) để Giáo viên nhìn thấy ngay
  const updateStudentName = async (newName: string): Promise<{ success: boolean; message: string }> => {
    const cleanName = (newName || '').trim();
    if (!cleanName) {
      showToast('Tên không hợp lệ', 'Họ và tên không được để trống!', 'error');
      return { success: false, message: 'Họ và tên không được để trống!' };
    }
    const student = currentStudent || storageService.getStudentSession();
    if (!student) {
      showToast('Chưa đăng nhập', 'Bạn chưa đăng nhập tài khoản học sinh!', 'warning');
      return { success: false, message: 'Bạn chưa đăng nhập tài khoản học sinh!' };
    }

    const updatedStudent: StudentUser = {
      ...student,
      fullName: cleanName,
    };

    // 0. Lưu vào bảng tên tùy chỉnh bền vững (không bao giờ bị reset khi logout/login)
    storageService.setStudentCustomName(student.id, student.email || student.username, cleanName);

    // 1. Cập nhật currentStudent và local student session
    setCurrentStudent(updatedStudent);
    storageService.setStudentSession(updatedStudent);

    // 2. Cập nhật trong danh sách students
    const currentStudents = students.length > 0 ? students : storageService.getStudents();
    const updatedStudents = currentStudents.map((s) => {
      if (s.id === student.id || (s.username && student.username && s.username.toLowerCase() === student.username.toLowerCase())) {
        return { ...s, fullName: cleanName };
      }
      return s;
    });
    setStudents(updatedStudents);
    storageService.saveStudents(updatedStudents);

    // 3. Cập nhật tên trong toàn bộ quan hệ lớp học (classStudents) của học sinh
    const currentClassStudents = classStudents.length > 0 ? classStudents : storageService.getClassStudents();
    const updatedClassStudents = currentClassStudents.map((cs) => {
      if (cs.studentId === student.id || (cs.studentUsername && student.username && cs.studentUsername.toLowerCase() === student.username.toLowerCase())) {
        return { ...cs, studentName: cleanName };
      }
      return cs;
    });
    setClassStudents(updatedClassStudents);
    storageService.saveClassStudents(updatedClassStudents);

    // 4. Cập nhật tên trong các bài nộp (submissions) của học sinh
    setSubmissions((prevSubs) => {
      const sId = (student.id || '').trim().toLowerCase();
      const sUser = (student.username || '').trim().toLowerCase();
      const sEmail = (student.email || '').trim().toLowerCase();
      const oldName = (student.fullName || '').trim().toLowerCase();

      const updatedSubs = prevSubs.map((sub) => {
        const subUser = (sub.userId || '').trim().toLowerCase();
        const subName = (sub.userName || '').trim().toLowerCase();

        const matchId = Boolean(sId && subUser && subUser === sId);
        const matchUser = Boolean(sUser && subUser && subUser === sUser);
        const matchEmail = Boolean(sEmail && subUser && subUser === sEmail);
        const matchOldName = Boolean(oldName && subName && subName === oldName);

        if (matchId || matchUser || matchEmail || matchOldName) {
          return { ...sub, userName: cleanName };
        }
        return sub;
      });
      storageService.saveSubmissions(updatedSubs);
      idbService.saveSubmissions(updatedSubs).catch(() => {});
      return updatedSubs;
    });

    // 5. Đồng bộ tức thì lên Supabase Cloud Database và Supabase Auth
    try {
      await Promise.all([
        apiService.saveStudents([updatedStudent]),
        apiService.saveClassStudents(updatedClassStudents),
        apiService.updateSubmissionsUserName(student.id, student.username, student.email, cleanName),
        supabase.auth.updateUser({ data: { custom_full_name: cleanName, full_name: cleanName, name: cleanName } }).catch(() => {}),
      ]);
    } catch (e) {
      console.warn('[JudgeContext] Lỗi đồng bộ đổi tên lên Cloud:', e);
    }

    showToast('Đổi tên thành công', `Họ và tên của em đã được cập nhật thành "${cleanName}"!`, 'success');
    return { success: true, message: 'Cập nhật tên thành công!' };
  };

  // Giáo viên tạo tài khoản Học sinh mới - Đồng bộ tức thì lên Cloud và bộ nhớ máy
  const addStudent = async (fullName: string, username: string, password: string): Promise<{ success: boolean; message: string }> => {
    if (!fullName.trim() || !username.trim() || !password.trim()) {
      return { success: false, message: 'Vui lòng điền đầy đủ Họ và tên, Tên đăng nhập và Mật khẩu!' };
    }
    const cleanUsername = username.trim().toLowerCase();

    // Gom học sinh: Cloud là chân lý; nếu mất mạng mới dùng dữ liệu máy này
    const studentMap = new Map<string, StudentUser>();
    const rawCloud = await apiService.fetchRawCloudStudents();
    if (rawCloud !== null) {
      rawCloud.forEach((s) => studentMap.set((s.username || '').toLowerCase(), s));
      const pendingIds = new Set(getPendingStudentIds());
      storageService.getStudents().forEach((s) => {
        const u = (s.username || '').toLowerCase();
        if (u && pendingIds.has(s.id) && !studentMap.has(u)) studentMap.set(u, s);
      });
    } else {
      storageService.getStudents().forEach((s) => studentMap.set((s.username || '').toLowerCase(), s));
      students.forEach((s) => studentMap.set((s.username || '').toLowerCase(), s));
    }

    if (studentMap.has(cleanUsername)) {
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

    studentMap.set(cleanUsername, newStudent);
    const nextList = [newStudent, ...Array.from(studentMap.values()).filter((s) => s.username.toLowerCase() !== cleanUsername)];
    storageService.saveStudents(nextList);
    setStudents(nextList);
    setPendingStudentIds([...getPendingStudentIds(), newStudent.id]);
    try {
      const savedList = await apiService.saveStudents(nextList);
      setStudents(savedList);
      setPendingStudentIds(getPendingStudentIds().filter((pid) => pid !== newStudent.id));
    } catch (err) {
      console.warn('[JudgeContext] Lỗi ghi học sinh mới lên Cloud:', err);
      showToast('Chưa đồng bộ được lên Cloud', 'Tài khoản mới mới chỉ lưu trên máy này. Hệ thống sẽ tự thử đồng bộ lại khi bảng Quản lý học sinh đang mở.', 'error');
      return { success: true, message: 'Tạo tài khoản thành công (chưa đồng bộ Cloud)' };
    }
    showToast('Cấp tài khoản thành công', `Đã tạo tài khoản cho học sinh ${newStudent.fullName} (${newStudent.username})`, 'success');
    return { success: true, message: 'Tạo tài khoản thành công' };
  };

  // Giáo viên đổi mật khẩu cho Học sinh
  const updateStudentPassword = async (id: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!newPassword || !newPassword.trim()) {
      return { success: false, message: 'Vui lòng nhập mật khẩu mới!' };
    }
    const cleanPass = newPassword.trim();
    const baseList = (await apiService.fetchStudents()).map((s) => (s.id === id ? { ...s, password: cleanPass } : s));
    storageService.updateStudentPassword(id, cleanPass);
    let updatedList = baseList;
    try {
      updatedList = await apiService.saveStudents(baseList);
    } catch (e) {
      console.warn('[JudgeContext] Đổi mật khẩu: chưa đồng bộ được Cloud:', e);
      showToast('Chưa đồng bộ được lên Cloud', 'Mật khẩu mới mới chỉ lưu trên máy này, vui lòng thử lại khi có mạng.', 'error');
    }
    setStudents(updatedList);
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
    try {
      const updatedList = await apiService.saveStudents(storageService.getStudents(), [id]);
      setStudents(updatedList);
    } catch (e) {
      console.warn('[JudgeContext] Xóa học sinh: chưa đồng bộ được Cloud:', e);
      setStudents(storageService.getStudents());
      showToast('Chưa đồng bộ được lên Cloud', 'Việc xóa học sinh chưa được cập nhật lên Cloud, vui lòng thử lại khi có mạng.', 'error');
    }

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

    // 4. Dù cho học sinh có bị xóa acc hay không, tuyệt đối không văng nick, giữ nguyên tài khoản đang đăng nhập
    showToast('Đã xóa', `Đã xóa tài khoản học sinh "${stuFullName || stuUsername || ''}" khỏi danh sách quản lý.`, 'info');
  };

  // Giáo viên (Admin) Đăng nhập - BẮT BUỘC ĐỐI CHIẾU TRỰC TIẾP VỚI DATABASE
  const loginAdmin = async (password: string): Promise<{ success: boolean; message: string }> => {
    if (!password || !password.trim()) {
      return { success: false, message: 'Vui lòng nhập mật mã quản trị viên!' };
    }

    const cleanPass = password.trim();
    // 1. Đối chiếu trực tiếp với Supabase Cloud Database qua API
    let isValid = await apiService.verifyAdminPassword(cleanPass);

    // Fallback chỉ khi không cấu hình Supabase Cloud hoặc offline
    if (!isValid && !apiService.isConfigured()) {
      isValid = cleanPass === storageService.getAdminPassword().trim();
    }

    if (isValid) {
      storageService.setAdminPassword(cleanPass);
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

      // Đồng bộ + tải dữ liệu ở chế độ nền (một lượt duy nhất) để vào trang giáo viên ngay lập tức
      apiService.syncAllToCloud().then((res) => {
        console.log('[JudgeContext] Đồng bộ tự động ngầm thành công:', res);
      }).catch((err) => {
        console.warn('[JudgeContext] Lỗi đồng bộ ngầm sau đăng nhập:', err);
      }).finally(() => {
        refreshAllData().catch(() => {});
      });

      showToast(
        'Xác thực thành công',
        'Chào mừng Giáo viên FAMINH! Hệ thống đã tự động bật đồng bộ toàn diện trên Cloud.',
        'success'
      );
      return { success: true, message: 'Đăng nhập thành công' };
    } else {
      // Đối chiếu sai mật khẩu: Chỉ từ chối quyền Admin, tuyệt đối không xóa session học sinh
      storageService.setAdminSessionActive(false);
      sessionStorage.removeItem('faminh_admin_verified_pass');
      try { localStorage.removeItem('faminh_admin_verified_pass'); } catch {}
      storageService.deleteCookie('faminh_admin_verified_pass');
      setIsAdminAuthenticated(false);
      showToast(
        'Từ chối truy cập',
        'Mật mã quản trị viên không chính xác trên Database. Vui lòng thử lại!',
        'error'
      );
      return { success: false, message: 'Mật mã quản trị viên không chính xác trên Database!' };
    }
  };

  // Quản trị viên Đăng xuất - Chỉ giải phóng quyền Admin, tuyệt đối không xóa dữ liệu lớp, bài tập hay học sinh
  const logoutAdmin = () => {
    supabase.auth.signOut().catch(() => {});
    storageService.setAdminSessionActive(false);
    sessionStorage.removeItem('faminh_admin_verified_pass');
    try { localStorage.removeItem('faminh_admin_verified_pass'); } catch {}
    storageService.deleteCookie('faminh_admin_verified_pass');
    setIsAdminAuthenticated(false);
    setRole('USER');
    setActiveClassId(null);
    if (typeof window !== 'undefined') {
      window.location.hash = '#classes';
      window.history.replaceState(null, '', '/#classes');
    }
    setIsAuthModalOpen(true);
    setAuthModalTab('student');
    showToast(
      'Đã đăng xuất Admin',
      'Đã đăng xuất phiên làm việc của Quản trị viên an toàn.',
      'info'
    );
  };

  const changeAdminPassword = async (
    oldPass: string,
    newPass: string
  ): Promise<{ success: boolean; message: string }> => {
    // 1. Kiểm tra mật khẩu cũ trực tiếp qua Database
    let isOldValid = await apiService.verifyAdminPassword(oldPass);
    if (!isOldValid && !apiService.isConfigured() && oldPass.trim() === storageService.getAdminPassword().trim()) {
      isOldValid = true;
    }
    if (!isOldValid) {
      return { success: false, message: 'Mật mã hiện tại không đúng trên Database!' };
    }
    if (!newPass || newPass.trim().length < 6) {
      return { success: false, message: 'Mật mã mới phải có ít nhất 6 ký tự!' };
    }

    const cleanNewPass = newPass.trim();

    // 2. Cập nhật mật mã mới trực tiếp lên Database Supabase Cloud
    const updated = await apiService.updateAdminPasswordInDatabase(cleanNewPass);
    if (updated) {
      storageService.setAdminPassword(cleanNewPass);
      sessionStorage.setItem('faminh_admin_verified_pass', cleanNewPass);
      try { localStorage.setItem('faminh_admin_verified_pass', cleanNewPass); } catch {}
      storageService.setCookie('faminh_admin_verified_pass', cleanNewPass, 30);
      setIsChangePasswordModalOpen(false);
      showToast('Đổi mật mã thành công', 'Mật mã quản trị FAMINH mới đã được cập nhật an toàn lên Database đám mây.', 'success');
      return { success: true, message: 'Đổi mật mã thành công' };
    } else {
      return { success: false, message: 'Không thể kết nối đến Database để đổi mật mã mới! Vui lòng thử lại.' };
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

    const cleanCode = (probData.code || '').trim().toUpperCase().replace(/\s+/g, '_');
    const duplicate = problems.find((p) => (p.code || '').trim().toUpperCase() === cleanCode);
    if (duplicate) {
      const err = new Error(`Mã bài tập "${cleanCode}" đã tồn tại trên hệ thống. Vui lòng chọn mã khác.`);
      showToast('Trùng mã bài tập', err.message, 'warning');
      throw err;
    }

    let targetClassId = probData.classId;
    if (!targetClassId || targetClassId === 'class_default_faminh') {
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
    if (!targetClassId || targetClassId === 'class_default_faminh') targetClassId = 'ALL';

    const newProblem: Problem = {
      ...probData,
      code: cleanCode,
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
      let msg = (err as Error)?.message || 'Lỗi khi lưu bài tập vào cơ sở dữ liệu';
      if (msg.includes('23505') || msg.includes('problems_code_key') || msg.includes('duplicate key')) {
        msg = `Mã bài tập "${newProblem.code}" đã tồn tại trên hệ thống. Vui lòng chọn mã khác.`;
      }
      showToast('Lỗi thêm bài tập', msg, 'error');
      throw err;
    }
  };

  const updateProblem = async (id: string, updated: Partial<Problem>): Promise<void> => {
    if (!isAdminAuthenticated) return;

    const existing = problems.find((p) => p.id === id);
    if (!existing) return;

    if (updated.code) {
      const cleanCode = updated.code.trim().toUpperCase().replace(/\s+/g, '_');
      const duplicate = problems.find(
        (p) => p.id !== id && (p.code || '').trim().toUpperCase() === cleanCode
      );
      if (duplicate) {
        const err = new Error(`Mã bài tập "${cleanCode}" đã bị trùng với bài tập khác.`);
        showToast('Trùng mã bài tập', err.message, 'warning');
        throw err;
      }
      updated.code = cleanCode;
    }

    // BẢO VỆ TEST CASES: Không bao giờ để một cập nhật bài tập thông thường làm mất bộ test case đang có
    const hasRealContent = (tests?: TestCase[] | null) =>
      Boolean(tests && tests.length > 0 && tests.some((t) => (t.input && t.input.trim()) || (t.expectedOutput && t.expectedOutput.trim())));

    let mergedTestCases =
      updated.testCases && updated.testCases.length > 0
        ? updated.testCases
        : (existing.testCases && existing.testCases.length > 0 ? existing.testCases : []);

    if (!hasRealContent(mergedTestCases)) {
      const idbTests = await idbService.getTestCases(id);
      if (hasRealContent(idbTests)) {
        mergedTestCases = idbTests!;
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
      // Chỉ đồng bộ test case lên Cloud khi có thay đổi test case thực sự được truyền vào
      if (updated.testCases && hasRealContent(updated.testCases)) {
        await apiService.saveTestCases(id, updated.testCases);
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
      let msg = (err as Error)?.message || 'Lỗi khi cập nhật bài tập vào Database';
      if (msg.includes('23505') || msg.includes('problems_code_key') || msg.includes('duplicate key')) {
        msg = `Mã bài tập "${updatedProblem.code}" đã bị trùng với bài khác. Vui lòng chọn mã khác.`;
      }
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
    // CƠ CHẾ "LƯỚI ĐIỆN": Kiểm tra tài khoản khi học sinh nộp bài
    const isSessionValid = await checkActionTriggeredSession();
    if (!isSessionValid) {
      throw new Error('Phiên đăng nhập đã hết hạn hoặc tài khoản đã được thu hồi. Vui lòng liên hệ Giáo viên để biết thêm chi tiết.');
    }

    let problem = problems.find((p) => p.id === problemId);
    if (!problem) {
      throw new Error('Không tìm thấy bài tập để chấm');
    }

    // Nạp đầy đủ từ Database nếu problem trong React state chưa có test hoặc test bị rỗng nội dung input/output
    const hasRealContent = (tests?: TestCase[] | null) =>
      Boolean(tests && tests.length > 0 && tests.some((t) => (t.input && t.input.trim().length > 0) || (t.expectedOutput && t.expectedOutput.trim().length > 0)));

    let submission: Submission | null = null;
    const targetUserId = isAdminAuthenticated ? 'admin_faminh' : (currentStudent?.id || currentStudent?.username || 'student_01');
    const targetUserName = isAdminAuthenticated ? 'Giáo viên FAMINH' : (currentStudent?.fullName || 'Học sinh');
    const targetClassId = activeClassId || (problem.classId !== 'class_default_faminh' ? problem.classId : undefined);

    // ƯU TIÊN #1: CHẤM BẢO MẬT PHÍA SERVER (SERVER-SIDE GRADING QUA /api/grade)
    // Giữ bí mật 100% Test Case ẩn: học sinh không thể mở Network hay Console để xem trộm input/output test
    if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      try {
        const gradeRes = await fetch('/api/grade', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Themis-Client': 'themis-web-oj',
            ...apiService.getAntiCacheHeaders(),
          },
          body: JSON.stringify({
            problemId: problem.id,
            code,
            language,
            userId: targetUserId,
            userName: targetUserName,
            classId: targetClassId,
          }),
        });

        if (gradeRes.ok) {
          const serverSub = await gradeRes.json();
          if (serverSub && serverSub.id) {
            submission = serverSub as Submission;
          }
        }
      } catch (serverErr) {
        console.warn('[Server-side Grading Fallback]:', serverErr);
      }
    }

    // NẾU SERVER-SIDE GRADING CHƯA KHẢ DỤNG (HOẶC LOCAL/OFFLINE), TỰ ĐỘNG DỰ PHÒNG VỀ CLIENT-SIDE GRADING
    if (!submission) {
      if (!hasRealContent(problem.testCases)) {
        // 1. Thử lấy từ IndexedDB
        let savedTests = await idbService.getTestCases(problem.id);
        // 2. Nếu IndexedDB không có hoặc chỉ chứa test rỗng, bắt buộc nạp ngay từ Cloud
        if (!hasRealContent(savedTests)) {
          savedTests = await apiService.fetchTestCases(problem.id);
        }
        if (hasRealContent(savedTests)) {
          problem = { ...problem, testCases: savedTests! };
          setProblems((prev) =>
            prev.map((p) => (p.id === problemId ? { ...p, testCases: savedTests! } : p))
          );
        }
      }

      // Bảo vệ tuyệt đối: Nếu bài tập chưa có test case có dữ liệu thật, không bao giờ chấm lụi thành đúng hết
      if (!hasRealContent(problem.testCases)) {
        throw new Error(
          'Bài tập này chưa có dữ liệu Test Case thực tế (Input/Output) để chấm điểm. Vui lòng thông báo Giáo viên nạp bộ test case trước khi nộp bài!'
        );
      }

      submission = await gradeSubmission(
        problem,
        code,
        language,
        targetUserId,
        targetUserName,
        onProgress
      );
      submission.classId = targetClassId;

      // Lưu bài nộp vào Database khi chấm tại client
      try {
        await apiService.saveSubmission(submission);
      } catch (err: unknown) {
        const msg = (err as Error)?.message || 'Lỗi lưu bài nộp vào Database';
        console.error('[submitCode] Lỗi lưu Database:', err);
        showToast('Lỗi lưu Database', `Không thể lưu kết quả nộp bài: ${msg}`, 'error');
        throw new Error(`Lỗi lưu Database: ${msg}`);
      }
    }

    // Lưu vào bộ nhớ cục bộ để xem lại lịch sử
    await storageService.saveSubmission(submission);

    // CẬP NHẬT STATE SUBMISSIONS VÀO REACT
    setSubmissions((prev) => [submission!, ...prev]);


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
        const subUser = (s.userId || '').trim().toLowerCase();
        const subName = (s.userName || '').trim().toLowerCase();
        const sId = (currentStudent.id || '').trim().toLowerCase();
        const sUser = (currentStudent.username || '').trim().toLowerCase();
        const sEmail = (currentStudent.email || '').trim().toLowerCase();
        const sName = (currentStudent.fullName || '').trim().toLowerCase();
        const customName = storageService.getStudentCustomName(currentStudent.id, currentStudent.email)?.trim().toLowerCase();

        const matchId = Boolean(sId && subUser && subUser === sId);
        const matchUser = Boolean(sUser && subUser && subUser === sUser);
        const matchEmail = Boolean(sEmail && subUser && subUser === sEmail);
        const matchName = Boolean(sName && subName && subName === sName);
        const matchCustom = Boolean(customName && subName && subName === customName);
        return matchId || matchName || matchUser || matchEmail || matchCustom;
      });
    }

    if (relevantSubs.length === 0) return 'UNSOLVED';
    const isFullAc = relevantSubs.some((s) => {
      const targetMax = maxPoints > 0 ? maxPoints : (s.maxTotalPoints > 0 ? s.maxTotalPoints : 10);
      const isFullPoints = targetMax > 0 && s.totalPointsEarned >= targetMax;
      const isAllTestsPassed = s.totalTests > 0 && s.passedCount === s.totalTests;
      return isFullPoints || isAllTestsPassed;
    });
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
        setRole,
        isAdminAuthenticated,
        setIsAdminAuthenticated,
        currentStudent,
        setCurrentStudent,
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
        isChangeNameModalOpen,
        setIsChangeNameModalOpen,
        isServerConfigModalOpen,
        setIsServerConfigModalOpen,
        isSessionRevokedModalOpen,
        setIsSessionRevokedModalOpen,
        handleAcknowledgeRevokedSession,
        theme,
        toggleTheme,
        confirmModalState,
        openConfirmModal,
        closeConfirmModal,
        loginStudent,
        logoutStudent,
        verifyStudentAccountStatus,
        addStudent,
        updateStudentPassword,
        updateStudentName,
        deleteStudent,
        loginAdmin,
        logoutAdmin,
        changeAdminPassword,
        refreshAllData,
        refreshStudents,
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
