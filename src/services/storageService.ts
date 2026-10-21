import type { Topic, Problem, Submission, UserStats, StudentUser } from '../types/judge';

const STORAGE_KEYS = {
  TOPICS: 'faminh_judge_topics_v2',
  PROBLEMS: 'faminh_judge_problems_v2',
  SUBMISSIONS: 'faminh_judge_submissions_v2',
  ADMIN_PASSWORD: 'faminh_admin_password_v1',
  ADMIN_SESSION: 'faminh_admin_session_active_v1',
  STUDENTS: 'faminh_judge_students_v1',
  STUDENT_SESSION: 'faminh_judge_student_session_v1',
  THEME: 'faminh_judge_theme_v1',
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
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveTopics(topics: Topic[]): void {
    localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
  },

  getProblems(): Problem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PROBLEMS);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveProblems(problems: Problem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROBLEMS, JSON.stringify(problems));
    } catch (err) {
      console.warn('[storageService] Lỗi lưu trữ problems (vượt quá dung lượng localStorage):', err);
    }
  },

  getSubmissions(): Submission[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveSubmission(submission: Submission): void {
    const subs = this.getSubmissions();
    subs.unshift(submission); // Mới nhất lên đầu
    // Giữ tối đa 150 submissions gần nhất
    const trimmed = subs.slice(0, 150);
    try {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(trimmed));
    } catch (err) {
      console.warn('[storageService] Lỗi lưu trữ submissions vào localStorage:', err);
    }
  },

  getUserStats(student?: StudentUser | null): UserStats {
    let subs = this.getSubmissions();
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
      if (sub.passedCount === sub.totalTests && sub.totalTests > 0) {
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

  getProblemStatus(problemId: string, maxPoints: number, student?: StudentUser | null): 'UNSOLVED' | 'PARTIAL' | 'SOLVED' {
    let subs = this.getSubmissions().filter((s) => s.problemId === problemId);
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
    localStorage.removeItem(STORAGE_KEYS.SUBMISSIONS);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_PASSWORD);
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    sessionStorage.removeItem(STORAGE_KEYS.STUDENT_SESSION);
  },
};
