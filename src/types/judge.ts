export type UserRole = 'ADMIN' | 'TEACHER' | 'USER';
export type AccountRole = 'admin' | 'teacher' | 'student';

export interface StudentUser {
  id: string;
  fullName: string; // Họ và tên người dùng (ví dụ: "Nguyễn Văn An")
  username: string; // Tên đăng nhập hoặc Email
  email?: string; // Email tài khoản Supabase Auth
  password?: string; // Mật khẩu (nếu có)
  role?: AccountRole; // Vai trò hệ thống: 'admin' | 'teacher' | 'student'
  createdAt: string;
}

export type Verdict = 'AC' | 'WA' | 'TLE' | 'RTE' | 'MLE' | 'CE' | 'SYS' | 'PENDING' | 'RUNNING';

export interface TestCase {
  id: string;
  name: string; // e.g. "Test #01", "Test #02"
  input: string;
  expectedOutput: string;
  points: number; // Điểm của test này (ví dụ: 1.0 hoặc 10)
  isHidden?: boolean; // Test ẩn hay hiện
  explanation?: string;
}

export interface VideoConfig {
  enabled: boolean;
  type: 'youtube' | 'drive' | 'direct';
  url: string; // YouTube URL, Drive URL, or mp4 direct link
  title?: string;
  unlockRule: 'always' | 'after_submission' | 'full_score';
}

export interface SampleIO {
  id: string;
  input: string;
  output: string;
  explanation?: string;
}

export interface Classroom {
  id: string;
  className: string;
  description: string;
  teacherId: string;
  joinCode: string; // Mã tham gia lớp (6 ký tự viết hoa)
  createdAt: string;
}

export interface ClassStudent {
  classId: string;
  studentId: string;
  studentName?: string;
  studentUsername?: string;
  studentEmail?: string;
  joinedAt: string;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface Problem {
  id: string;
  code: string; // Mã bài, ví dụ: "TONG2SO", "PRIME", "SUBARRAY"
  title: string;
  classId?: string; // ID lớp học sở hữu bài tập này (Multi-Classroom)
  topicId: string;
  difficulty: string; // Tự do cho Admin đặt (Dễ, Trung bình, Khó, HSG Tỉnh, Olympic...)
  timeLimit: number; // Giây, e.g. 1.0
  memoryLimit: number; // Megabytes, e.g. 1024
  totalPoints: number; // Thang điểm: 10 hoặc 100
  description: string; // Markdown + LaTeX math ($...$, $$...$$)
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  samples: SampleIO[];
  testCases: TestCase[];
  videoConfig: VideoConfig;
  author?: string;
  teacherId?: string; // Email hoặc ID của Giáo viên sở hữu bài tập
  createdAt: string;
  updatedAt: string;
  // Đính kèm file đề gốc (.docx hoặc .pdf) để giữ nguyên 100% định dạng đề thi
  attachedFile?: {
    name: string;
    size: number;
    type: 'docx' | 'pdf';
    dataUrl?: string; // File base64 để tải về hoặc hiển thị trực tiếp
    rawHtml?: string; // HTML giữ nguyên bảng biểu, định dạng từ Word
  };
  // Templates code mẫu cho học sinh
  starterCode?: {
    cpp?: string;
    python?: string;
    pascal?: string;
    java?: string;
  };
}

export interface Topic {
  id: string;
  name: string; // e.g. "Mảng 1 chiều", "Số học & Nguyên tố", "Quy hoạch động"
  description?: string;
  order: number;
  icon?: string;
  classId?: string; // (Tương thích ngược) ID lớp học nếu chỉ gán 1 lớp ('ALL' là tất cả các lớp của giáo viên đó)
  classIds?: string[]; // Danh sách các ID lớp học được giao chủ đề này (Hỗ trợ tích chọn nhiều lớp)
  teacherId?: string; // Email hoặc ID của Giáo viên sở hữu chủ đề
}

export interface TestResult {
  testId: string;
  testName: string;
  verdict: Verdict;
  time: number; // Giây (e.g. 0.04)
  memory: number; // Megabytes (e.g. 3.2)
  pointsEarned: number;
  maxPoints: number;
  actualOutput?: string;
  expectedOutput?: string;
  errorMessage?: string;
  errorLog?: string;
}

export interface Submission {
  id: string;
  problemId: string;
  problemCode: string;
  problemTitle: string;
  classId?: string; // Lớp học liên kết với bài nộp
  userId: string;
  userName: string;
  language: 'cpp' | 'python' | 'pascal' | 'java';
  sourceCode: string;
  submittedAt: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR';
  totalPointsEarned: number;
  maxTotalPoints: number;
  passedCount: number;
  totalTests: number;
  overallVerdict: Verdict;
  executionTime: number; // Tổng hoặc max thời gian chạy
  memory: number;
  compilationMessage?: string;
  testResults: TestResult[];
  freopenHandled?: boolean; // Cờ báo đã xử lý freopen
}

export interface UserStats {
  solvedCount: number;
  attemptedCount: number;
  totalSubmissions: number;
  pointsAccumulated: number;
}

/**
 * Chuẩn hóa định danh chủ sở hữu (Giáo viên / Admin).
 * Dữ liệu gốc chưa gắn chủ sở hữu hoặc gắn 'admin' mặc định thuộc về giáo viên gốc leduyducminh@gmail.com
 */
export function normalizeOwnerEmail(owner?: string | null): string {
  const clean = (owner || '').trim().toLowerCase();
  if (!clean || clean === 'admin' || clean === 'abf4d6f8-b481-490b-b36e-5fbb30409d48') {
    return 'leduyducminh@gmail.com';
  }
  if (clean === '44a78249-dd15-4011-b1de-e8190b4352fa') {
    return 'minh.ldd2610979@sis.hust.edu.vn';
  }
  return clean;
}

/**
 * Kiểm tra xem một tài nguyên (Lớp học, Chủ đề, Bài tập) có thuộc quyền sở hữu của Giáo viên hiện tại không
 */
export function isResourceOwnedByTeacher(
  resourceOwner: string | undefined | null,
  teacherEmail?: string | null,
  teacherId?: string | null
): boolean {
  const normResource = normalizeOwnerEmail(resourceOwner);
  const normTeacherEmail = (teacherEmail || '').trim().toLowerCase();
  const normTeacherId = (teacherId || '').trim().toLowerCase();

  if (normTeacherEmail && normResource === normTeacherEmail) return true;
  if (normTeacherId && normResource === normalizeOwnerEmail(normTeacherId)) return true;
  return false;
}

/**
 * Kiểm tra xem một bài tập có hiển thị trong lớp học cụ thể hay không:
 * 1. Khớp trực tiếp problem.classId
 * 2. Thuộc về chủ đề (Topic) được giao cho lớp này (hỗ trợ cả topic.classIds và topic.classId === 'ALL')
 * 3. Đảm bảo tính cô lập giữa các Giáo viên: 'ALL' chỉ áp dụng cho các lớp học thuộc cùng Giáo viên sở hữu bài tập/chủ đề đó
 */
export function isProblemInClass(
  problem: Problem,
  classId?: string | null,
  topics: Topic[] = [],
  classes: Classroom[] = []
): boolean {
  if (!classId) return true;

  // 1. Trực tiếp khớp classId cụ thể của bài tập
  if (problem.classId === classId) return true;

  const targetClass = classes.find((c) => c.id === classId);
  const parentTopic = problem.topicId ? topics.find((t) => t.id === problem.topicId) : undefined;

  const problemOwner = normalizeOwnerEmail(problem.teacherId || problem.author || parentTopic?.teacherId);
  const classOwner = targetClass ? normalizeOwnerEmail(targetClass.teacherId) : null;
  const isSameTeacher = !classOwner || problemOwner === classOwner;

  if (problem.classId === 'ALL' && isSameTeacher) return true;

  // 2. Kế thừa từ chủ đề (Topic) chứa bài tập
  if (parentTopic) {
    const topicClassIds = parentTopic.classIds && parentTopic.classIds.length > 0
      ? parentTopic.classIds
      : (parentTopic.classId ? [parentTopic.classId] : ['ALL']);

    if (topicClassIds.includes(classId)) {
      return true;
    }
    if (topicClassIds.includes('ALL') && isSameTeacher) {
      return true;
    }
  }

  return false;
}


