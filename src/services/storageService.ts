import type { Topic, Problem, Submission, UserStats, StudentUser, Classroom, ClassStudent } from '../types/judge.ts';
import { isProblemInClass } from '../types/judge.ts';
import { idbService } from './db.ts';

const STORAGE_KEYS = {
  TOPICS: 'faminh_judge_topics_v2',
  PROBLEMS: 'faminh_judge_problems_v2',
  SUBMISSIONS: 'faminh_judge_submissions_v2',
  ADMIN_PASSWORD: 'faminh_admin_password_v1',
  ADMIN_SESSION: 'faminh_admin_session_active_v1',
  STUDENTS: 'faminh_judge_students_v1',
  STUDENT_SESSION: 'faminh_judge_student_session_v1',
  THEME: 'faminh_judge_theme_v1',
  CLASSES: 'faminh_judge_classes_v1',
  CLASS_STUDENTS: 'faminh_judge_class_students_v1',
  ACTIVE_CLASS_ID: 'faminh_judge_active_class_id_v1',
  CURRENT_TAB: 'faminh_judge_current_tab_v1',
  SELECTED_PROBLEM_ID: 'faminh_judge_selected_problem_id_v1',
};

// Dọn dẹp bộ nhớ đệm mẫu cũ (v1) nếu có trong trình duyệt người dùng
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    if (localStorage.getItem('faminh_judge_topics_v1')) {
      localStorage.removeItem('faminh_judge_topics_v1');
    }
    if (localStorage.getItem('faminh_judge_problems_v1')) {
      localStorage.removeItem('faminh_judge_problems_v1');
    }
  } catch {
    // Bỏ qua lỗi truy cập localStorage
  }
}

export const DEFAULT_ADMIN_PASSWORD = 'faminh@2026';

export const DEFAULT_STUDENTS: StudentUser[] = [
  {
    id: 'student_1',
    fullName: 'Lê Duy Đức Minh',
    username: 'ducminh',
    password: '123',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'student_2',
    fullName: 'Nguyễn Văn An',
    username: 'vanan',
    password: '123',
    createdAt: new Date().toISOString(),
  },
];

// Lớp học chung mặc định (dùng cho Fallback và gom bài tập cũ)
export const DEFAULT_CLASS: Classroom = {
  id: 'class_default_faminh',
  className: 'Lớp Học Chung',
  description: 'Lớp học chung mặc định dành cho toàn bộ học sinh và bài tập tiêu chuẩn FAMINH.',
  teacherId: 'admin',
  joinCode: 'OXYZ',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/**
 * Sinh mã tham gia lớp học ngẫu nhiên 6 ký tự viết hoa (không lẫn lộn 0/O, 1/I)
 */
export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Không tự động tạo chủ đề hoặc bài tập mẫu. Bắt đầu từ danh sách trống để giáo viên/người dùng tự tạo.
export const INITIAL_TOPICS: Topic[] = [];
export const INITIAL_PROBLEMS: Problem[] = [];


export const storageService = {
  getTopics(): Topic[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TOPICS);
    if (!raw) {
      return [];
    }
    try {
      const list: Topic[] = JSON.parse(raw);
      const classes = this.getClasses();
      const existingClassIds = new Set(classes.map((c) => c.id));
      let changed = false;

      const cleaned = list.map((t) => {
        let classIds = t.classIds && t.classIds.length > 0
          ? t.classIds
          : (t.classId ? [t.classId] : ['ALL']);

        // Loại bỏ các classId của lớp học đã bị xóa
        if (!classIds.includes('ALL') && classes.length > 0) {
          const filtered = classIds.filter((cId) => existingClassIds.has(cId));
          if (filtered.length !== classIds.length) {
            classIds = filtered.length > 0 ? filtered : ['ALL'];
            changed = true;
          }
        }

        const classId = t.classId && (t.classId === 'ALL' || existingClassIds.has(t.classId))
          ? t.classId
          : (classIds[0] || 'ALL');
        if (classId !== t.classId) {
          changed = true;
        }

        return {
          ...t,
          classId,
          classIds,
        };
      });

      if (changed) {
        this.saveTopics(cleaned);
      }
      return cleaned;
    } catch {
      return [];
    }
  },

  saveTopics(topics: Topic[]): void {
    localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
  },

  getProblems(classId?: string | null): Problem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PROBLEMS);
    if (!raw) {
      return [];
    }
    try {
      const list: Problem[] = JSON.parse(raw);
      const topics = this.getTopics();
      // Fallback migration: gán classId nếu bài cũ chưa có hoặc tự động đồng bộ theo chủ đề
      let changed = false;
      const existingClassIds = new Set(this.getClasses().map((c) => c.id));
      const migrated = list.map((p) => {
        // 1. Nếu bài tập đang trỏ đến ID lớp học đã bị xóa (và không phải NONE)
        if (p.classId && p.classId !== 'ALL' && p.classId !== 'NONE' && !existingClassIds.has(p.classId)) {
          changed = true;
          if (p.topicId) {
            const parent = topics.find((t) => t.id === p.topicId);
            if (parent) {
              const ids = parent.classIds && parent.classIds.length > 0
                ? parent.classIds
                : (parent.classId ? [parent.classId] : ['ALL']);
              return { ...p, classId: ids[0] || 'ALL' };
            }
          }
          return { ...p, classId: 'ALL' };
        }

        // 2. Nếu bài tập chưa có classId
        if (!p.classId) {
          changed = true;
          if (p.topicId) {
            const parent = topics.find((t) => t.id === p.topicId);
            if (parent) {
              const ids = parent.classIds && parent.classIds.length > 0
                ? parent.classIds
                : (parent.classId ? [parent.classId] : ['ALL']);
              return { ...p, classId: ids[0] || 'ALL' };
            }
          }
          return { ...p, classId: 'ALL' };
        }

        return p;
      });
      if (changed) {
        try {
          localStorage.setItem(STORAGE_KEYS.PROBLEMS, JSON.stringify(migrated));
        } catch {
          // Tránh ghi đè IndexedDB khi chỉ đọc dữ liệu
        }
      }
      if (classId) {
        return migrated.filter((p) => isProblemInClass(p, classId, topics));
      }
      return migrated;
    } catch {
      return [];
    }
  },

  saveProblems(problems: Problem[]): void {
    if (!problems) return;

    // 1. Lưu đồng bộ ngay lập tức vào localStorage để đồng bộ tức thì với state và môi trường test
    try {
      localStorage.setItem(STORAGE_KEYS.PROBLEMS, JSON.stringify(problems));
    } catch {
      try {
        // Cấp 1: Cắt gọn input/output quá dài (>300 ký tự) và bỏ dataUrl lớn, NHƯNG giữ nguyên 100% số lượng testCases
        const light = problems.map((p) => ({
          ...p,
          attachedFile: p.attachedFile?.dataUrl && p.attachedFile.dataUrl.length > 5000
            ? { ...p.attachedFile, dataUrl: '' }
            : p.attachedFile,
          testCases: (p.testCases || []).map((tc) => ({
            ...tc,
            input: tc.input && tc.input.length > 300 ? tc.input.substring(0, 300) : tc.input,
            expectedOutput: tc.expectedOutput && tc.expectedOutput.length > 300 ? tc.expectedOutput.substring(0, 300) : tc.expectedOutput,
          })),
        }));
        localStorage.setItem(STORAGE_KEYS.PROBLEMS, JSON.stringify(light));
      } catch {
        try {
          // Cấp 2: Giữ toàn bộ danh sách test cases (id, name, points, isHidden) để số test luôn > 0
          const headerOnly = problems.map((p) => ({
            ...p,
            attachedFile: undefined,
            testCases: (p.testCases || []).map((tc) => ({
              id: tc.id,
              name: tc.name,
              points: tc.points,
              isHidden: tc.isHidden,
              input: '',
              expectedOutput: '',
            })),
          }));
          localStorage.setItem(STORAGE_KEYS.PROBLEMS, JSON.stringify(headerOnly));
        } catch {
          // IndexedDB là kho lưu trữ bền vững hoàn chỉnh
        }
      }
    }

    // 2. Lưu toàn bộ 100% dữ liệu vào IndexedDB bền vững
    idbService.saveProblems(problems).catch((err) => {
      console.warn('[storageService] Lỗi khi lưu problems vào IndexedDB:', err);
    });
    for (const p of problems) {
      if (p.testCases && p.testCases.length > 0) {
        idbService.saveTestCases(p.id, p.testCases).catch(() => {});
      }
    }
  },

  getSubmissions(classId?: string | null): Submission[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    if (!raw) return [];
    try {
      const list: Submission[] = JSON.parse(raw);
      if (classId) {
        return list.filter((s) => s.classId === classId || (!s.classId && classId === DEFAULT_CLASS.id));
      }
      return list;
    } catch {
      return [];
    }
  },

  saveSubmission(submission: Submission): void {
    // 1. Lưu đồng bộ ngay vào localStorage phiên bản rút gọn
    const lightSubmission: Submission = {
      ...submission,
      sourceCode: submission.sourceCode && submission.sourceCode.length > 2000
        ? submission.sourceCode.substring(0, 2000)
        : submission.sourceCode,
      compilationMessage: submission.compilationMessage && submission.compilationMessage.length > 1000
        ? submission.compilationMessage.substring(0, 1000)
        : submission.compilationMessage,
      testResults: (submission.testResults || []).map((tr) => ({
        testId: tr.testId,
        testName: tr.testName,
        verdict: tr.verdict,
        time: tr.time,
        memory: tr.memory,
        pointsEarned: tr.pointsEarned,
        maxPoints: tr.maxPoints,
        errorMessage: tr.errorMessage,
        actualOutput: tr.actualOutput && tr.actualOutput.length > 150 ? tr.actualOutput.substring(0, 150) : tr.actualOutput,
        expectedOutput: tr.expectedOutput && tr.expectedOutput.length > 150 ? tr.expectedOutput.substring(0, 150) : tr.expectedOutput,
      })),
    };

    const subs = this.getSubmissions();
    const existingIdx = subs.findIndex((s) => s.id === submission.id);
    if (existingIdx >= 0) {
      subs[existingIdx] = lightSubmission;
    } else {
      subs.unshift(lightSubmission);
    }
    const trimmed = subs.slice(0, 50);
    try {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(trimmed));
    } catch (err) {
      console.warn('[storageService] Lỗi lưu trữ submissions vào localStorage, cắt giảm còn 20:', err);
      try {
        localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs.slice(0, 20)));
      } catch {
        // IndexedDB đã lưu đầy đủ
      }
    }

    // 2. Lưu vào IndexedDB đầy đủ
    idbService.saveSubmission(submission).catch((err) => {
      console.warn('[storageService] Lỗi khi lưu submission vào IndexedDB:', err);
    });
  },

  // ==========================================
  // MULTI-CLASSROOM (LỚP HỌC ĐỘC LẬP)
  // ==========================================

  getClasses(): Classroom[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CLASSES);
    if (raw === null) {
      this.saveClasses([DEFAULT_CLASS]);
      return [DEFAULT_CLASS];
    }
    try {
      const list: Classroom[] = JSON.parse(raw);
      if (!Array.isArray(list)) {
        return [];
      }
      return list;
    } catch {
      return [];
    }
  },

  saveClasses(classes: Classroom[]): void {
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
  },

  addClass(data: { className: string; description: string; teacherId?: string; joinCode?: string }): Classroom {
    const classes = this.getClasses();
    const newClass: Classroom = {
      id: `class_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      className: data.className.trim(),
      description: data.description.trim(),
      teacherId: data.teacherId || 'admin',
      joinCode: (data.joinCode || generateJoinCode()).toUpperCase().trim(),
      createdAt: new Date().toISOString(),
    };
    this.saveClasses([newClass, ...classes]);
    return newClass;
  },

  updateClass(id: string, data: Partial<Classroom>): void {
    const classes = this.getClasses().map((c) => (c.id === id ? { ...c, ...data } : c));
    this.saveClasses(classes);
  },

  deleteClass(id: string): void {
    const classes = this.getClasses().filter((c) => c.id !== id);
    this.saveClasses(classes);
    // Dọn dẹp quan hệ học sinh
    const relations = this.getClassStudents().filter((cs) => cs.classId !== id);
    this.saveClassStudents(relations);

    // Dọn dẹp id lớp học đã xóa khỏi toàn bộ các chủ đề
    const topics = this.getTopics().map((t) => {
      let classIds = (t.classIds || []).filter((cId) => cId !== id);
      if (classIds.length === 0) classIds = ['ALL'];
      const classId = t.classId === id ? classIds[0] || 'ALL' : t.classId;
      return { ...t, classId, classIds };
    });
    this.saveTopics(topics);

    // Dọn dẹp bài tập thuộc lớp đã xóa
    const problems = this.getProblems().map((p) => {
      if (p.classId === id) {
        return { ...p, classId: 'ALL' };
      }
      return p;
    });
    this.saveProblems(problems);
  },

  getClassById(id: string): Classroom | null {
    return this.getClasses().find((c) => c.id === id) || null;
  },

  getClassByJoinCode(code: string): Classroom | null {
    const clean = code.trim().toUpperCase();
    return this.getClasses().find((c) => c.joinCode.toUpperCase() === clean) || null;
  },

  getClassStudents(): ClassStudent[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CLASS_STUDENTS);
    if (!raw) {
      const initialRelations: ClassStudent[] = DEFAULT_STUDENTS.map((s) => ({
        classId: DEFAULT_CLASS.id,
        studentId: s.id,
        joinedAt: new Date().toISOString(),
      }));
      this.saveClassStudents(initialRelations);
      return initialRelations;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveClassStudents(list: ClassStudent[]): void {
    localStorage.setItem(STORAGE_KEYS.CLASS_STUDENTS, JSON.stringify(list));
  },

  getActiveClassId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_CLASS_ID) || null;
    } catch {
      return null;
    }
  },

  setActiveClassId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_CLASS_ID, id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_CLASS_ID);
      }
    } catch {
      // ignore
    }
  },

  getCurrentTab(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.CURRENT_TAB) || null;
    } catch {
      return null;
    }
  },

  setCurrentTab(tab: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_TAB, tab);
    } catch {
      // ignore
    }
  },

  getSelectedProblemId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.SELECTED_PROBLEM_ID) || null;
    } catch {
      return null;
    }
  },

  setSelectedProblemId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEYS.SELECTED_PROBLEM_ID, id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_PROBLEM_ID);
      }
    } catch {
      // ignore
    }
  },

  getStudentsInClass(classId: string): StudentUser[] {
    const relations = this.getClassStudents().filter(
      (cs) => cs.classId === classId && (!cs.status || cs.status === 'approved')
    );
    const studentIds = new Set(relations.map((cs) => cs.studentId));
    return this.getStudents().filter((s) => studentIds.has(s.id));
  },

  getPendingStudentsInClass(classId: string): Array<{ student: StudentUser; joinedAt: string }> {
    const relations = this.getClassStudents().filter(
      (cs) => cs.classId === classId && cs.status === 'pending'
    );
    const studentMap = new Map(this.getStudents().map((s) => [s.id, s]));
    const result: Array<{ student: StudentUser; joinedAt: string }> = [];
    for (const rel of relations) {
      const stu = studentMap.get(rel.studentId) || {
        id: rel.studentId,
        fullName: 'Học sinh',
        username: rel.studentId,
        password: '',
        createdAt: rel.joinedAt,
      };
      result.push({ student: stu, joinedAt: rel.joinedAt });
    }
    return result;
  },

  getClassesForStudent(studentId: string): Classroom[] {
    const relations = this.getClassStudents().filter(
      (cs) => cs.studentId === studentId && (!cs.status || cs.status === 'approved')
    );
    const classIds = new Set(relations.map((cs) => cs.classId));
    return this.getClasses().filter((c) => classIds.has(c.id));
  },

  getPendingClassesForStudent(studentId: string): Classroom[] {
    const relations = this.getClassStudents().filter(
      (cs) => cs.studentId === studentId && cs.status === 'pending'
    );
    const classIds = new Set(relations.map((cs) => cs.classId));
    return this.getClasses().filter((c) => classIds.has(c.id));
  },

  joinClassByCode(studentId: string, joinCode: string): {
    success: boolean;
    message: string;
    pending?: boolean;
    classroom?: Classroom;
  } {
    const targetClass = this.getClassByJoinCode(joinCode);
    if (!targetClass) {
      return { success: false, message: 'Mã tham gia lớp học không hợp lệ hoặc lớp không tồn tại!' };
    }
    const relations = this.getClassStudents();
    const existing = relations.find((cs) => cs.classId === targetClass.id && cs.studentId === studentId);
    if (existing) {
      if (!existing.status || existing.status === 'approved') {
        return {
          success: true,
          pending: false,
          message: `Bạn đã là thành viên chính thức của lớp "${targetClass.className}"!`,
          classroom: targetClass,
        };
      } else if (existing.status === 'pending') {
        return {
          success: true,
          pending: true,
          message: `Yêu cầu tham gia lớp "${targetClass.className}" của bạn đang chờ giáo viên duyệt. Vui lòng liên hệ giáo viên để được vào lớp!`,
          classroom: targetClass,
        };
      } else {
        existing.status = 'pending';
        existing.joinedAt = new Date().toISOString();
        this.saveClassStudents(relations);
        return {
          success: true,
          pending: true,
          message: `Đã gửi lại yêu cầu tham gia lớp "${targetClass.className}". Vui lòng chờ giáo viên duyệt!`,
          classroom: targetClass,
        };
      }
    }
    const newRelation: ClassStudent = {
      classId: targetClass.id,
      studentId,
      joinedAt: new Date().toISOString(),
      status: 'pending',
    };
    this.saveClassStudents([...relations, newRelation]);
    return {
      success: true,
      pending: true,
      message: `Đã gửi yêu cầu tham gia lớp "${targetClass.className}". Vui lòng chờ giáo viên duyệt để vào lớp!`,
      classroom: targetClass,
    };
  },

  approveStudentJoin(classId: string, studentId: string): void {
    const relations = this.getClassStudents();
    const updated = relations.map((cs) => {
      if (cs.classId === classId && cs.studentId === studentId) {
        return { ...cs, status: 'approved' as const };
      }
      return cs;
    });
    this.saveClassStudents(updated);
  },

  rejectStudentJoin(classId: string, studentId: string): void {
    const relations = this.getClassStudents().filter(
      (cs) => !(cs.classId === classId && cs.studentId === studentId)
    );
    this.saveClassStudents(relations);
  },

  enrollStudentToClass(classId: string, studentId: string): void {
    const relations = this.getClassStudents();
    const existing = relations.find((cs) => cs.classId === classId && cs.studentId === studentId);
    if (existing) {
      existing.status = 'approved';
      this.saveClassStudents([...relations]);
    } else {
      this.saveClassStudents([...relations, { classId, studentId, joinedAt: new Date().toISOString(), status: 'approved' }]);
    }
  },

  removeStudentFromClass(classId: string, studentId: string): void {
    const relations = this.getClassStudents().filter(
      (cs) => !(cs.classId === classId && cs.studentId === studentId)
    );
    this.saveClassStudents(relations);
  },

  getUserStats(
    student?: StudentUser | null,
    classId?: string | null,
    customSubs?: Submission[]
  ): UserStats {
    let subs = customSubs ? [...customSubs] : this.getSubmissions(classId);
    if (classId && customSubs) {
      subs = subs.filter((s) => s.classId === classId || (!s.classId && classId === DEFAULT_CLASS.id));
    }
    if (student) {
      subs = subs.filter((s) => {
        const matchName = s.userName && student.fullName &&
          s.userName.trim().toLowerCase() === student.fullName.trim().toLowerCase();
        const matchUser = s.userId && student.username &&
          s.userId.trim().toLowerCase() === student.username.trim().toLowerCase();
        return Boolean(matchName || matchUser);
      });
    }
    const solvedProblemIds = new Set<string>();
    const attemptedProblemIds = new Set<string>();
    let pointsAccumulated = 0;

    // Tính điểm cao nhất của mỗi bài
    const bestScoreMap = new Map<string, number>();

    for (const sub of subs) {
      attemptedProblemIds.add(sub.problemId);
      const currentBest = bestScoreMap.get(sub.problemId) || 0;
      if (sub.totalPointsEarned > currentBest) {
        bestScoreMap.set(sub.problemId, sub.totalPointsEarned);
      }
      if (
        sub.overallVerdict === 'AC' ||
        (Number(sub.passedCount) === Number(sub.totalTests) && Number(sub.totalTests) > 0) ||
        (Number(sub.maxTotalPoints) > 0 && Number(sub.totalPointsEarned) >= Number(sub.maxTotalPoints))
      ) {
        solvedProblemIds.add(sub.problemId);
      }
    }

    bestScoreMap.forEach((score) => {
      pointsAccumulated += score;
    });

    return {
      solvedCount: solvedProblemIds.size,
      attemptedCount: attemptedProblemIds.size,
      totalSubmissions: subs.length,
      pointsAccumulated: +pointsAccumulated.toFixed(1),
    };
  },

  getProblemStatus(problemId: string, maxPoints: number, student?: StudentUser | null, classId?: string | null): 'UNSOLVED' | 'PARTIAL' | 'SOLVED' {
    let subs = this.getSubmissions(classId).filter((s) => s.problemId === problemId);
    if (student) {
      subs = subs.filter((s) => {
        const matchName = s.userName && student.fullName &&
          s.userName.trim().toLowerCase() === student.fullName.trim().toLowerCase();
        const matchUser = s.userId && student.username &&
          s.userId.trim().toLowerCase() === student.username.trim().toLowerCase();
        return Boolean(matchName || matchUser);
      });
    }
    if (subs.length === 0) return 'UNSOLVED';

    const maxEarned = Math.max(...subs.map((s) => s.totalPointsEarned));
    if (maxEarned >= maxPoints) return 'SOLVED';
    if (maxEarned > 0) return 'PARTIAL';
    return 'UNSOLVED';
  },

  getAdminPassword(): string {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD) || DEFAULT_ADMIN_PASSWORD;
  },

  setAdminPassword(newPassword: string): void {
    localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, newPassword);
  },

  verifyAdminPassword(password: string): boolean {
    const stored = this.getAdminPassword();
    return password.trim() === stored.trim();
  },

  isAdminSessionActive(): boolean {
    return sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === 'true';
  },

  setAdminSessionActive(active: boolean): void {
    if (active) {
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'true');
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    }
  },

  getStudents(): StudentUser[] {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) {
      this.saveStudents(DEFAULT_STUDENTS);
      return DEFAULT_STUDENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_STUDENTS;
    }
  },

  saveStudents(students: StudentUser[]): void {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  },

  addStudent(student: StudentUser): void {
    const list = this.getStudents();
    this.saveStudents([student, ...list]);
  },

  deleteStudent(id: string): void {
    const list = this.getStudents().filter((s) => s.id !== id);
    this.saveStudents(list);
  },

  getStudentSession(): StudentUser | null {
    const raw = sessionStorage.getItem(STORAGE_KEYS.STUDENT_SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setStudentSession(student: StudentUser | null): void {
    if (student) {
      sessionStorage.setItem(STORAGE_KEYS.STUDENT_SESSION, JSON.stringify(student));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.STUDENT_SESSION);
    }
  },

  resetToDefault(): void {
    localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.PROBLEMS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify([DEFAULT_CLASS]));
    const defaultRelations: ClassStudent[] = DEFAULT_STUDENTS.map((s) => ({
      classId: DEFAULT_CLASS.id,
      studentId: s.id,
      joinedAt: new Date().toISOString(),
    }));
    localStorage.setItem(STORAGE_KEYS.CLASS_STUDENTS, JSON.stringify(defaultRelations));
    localStorage.removeItem(STORAGE_KEYS.SUBMISSIONS);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_PASSWORD);
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    sessionStorage.removeItem(STORAGE_KEYS.STUDENT_SESSION);
  },

  /**
   * XÓA TOÀN BỘ STORAGE, COOKIES VÀ STATE KHI LOGOUT
   * - Xóa toàn bộ sessionStorage
   * - Xóa toàn bộ Cookies trình duyệt
   * - Xóa các khóa dữ liệu phiên, người dùng, lớp học, bài tập trong localStorage
   */
  clearAllStorageAndCookies(): void {
    // Lưu lại theme giao diện nếu có trước khi dọn dẹp
    let savedTheme: string | null = null;
    if (typeof localStorage !== 'undefined') {
      try {
        savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      } catch {
        // Bỏ qua lỗi truy cập localStorage
      }
    }

    // 1. Dọn dẹp sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.clear();
      } catch {
        // Bỏ qua lỗi truy cập sessionStorage
      }
    }

    // 2. Dọn dẹp localStorage (giữ lại theme giao diện nếu có)
    if (typeof localStorage !== 'undefined') {
      try {

        // Xóa tất cả các khóa lưu trữ của FAMINH
        Object.values(STORAGE_KEYS).forEach((k) => {
          if (k !== STORAGE_KEYS.THEME) {
            localStorage.removeItem(k);
          }
        });

        // Quét và xóa toàn bộ các khóa bắt đầu bằng faminh_ khác (ngoại trừ theme)
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('faminh_') && k !== STORAGE_KEYS.THEME) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));

        if (savedTheme) {
          localStorage.setItem(STORAGE_KEYS.THEME, savedTheme);
        }
      } catch {
        // Bỏ qua lỗi truy cập localStorage
      }
    }

    // 3. Dọn dẹp Cookies
    if (typeof document !== 'undefined' && typeof document.cookie === 'string') {
      try {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
          if (name) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            if (typeof window !== 'undefined' && window.location && window.location.hostname) {
              const host = window.location.hostname;
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${host}`;
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${host}`;
            }
          }
        }
      } catch {
        // Bỏ qua lỗi cookies
      }
    }

    // 4. Dọn dẹp bộ đệm submissions trong IndexedDB
    try {
      idbService.clearSubmissions();
    } catch {
      // Bỏ qua lỗi
    }
  },
};

