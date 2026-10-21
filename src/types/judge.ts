export type UserRole = 'ADMIN' | 'USER';

export interface StudentUser {
  id: string;
  fullName: string; // Họ và tên học sinh (ví dụ: "Nguyễn Văn An")
  username: string; // Tên đăng nhập (ví dụ: "vanan")
  password: string; // Mật khẩu do giáo viên cấp
  createdAt: string;
}

export type Verdict = 'AC' | 'WA' | 'TLE' | 'RTE' | 'MLE' | 'CE' | 'PENDING' | 'RUNNING';

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

export interface Problem {
  id: string;
  code: string; // Mã bài, ví dụ: "TONG2SO", "PRIME", "SUBARRAY"
  title: string;
  topicId: string;
  difficulty: string; // Tự do cho Admin đặt (Dễ, Trung bình, Khó, HSG Tỉnh, Olympic...)
  timeLimit: number; // Giây, e.g. 1.0
  memoryLimit: number; // Megabytes, e.g. 256
  totalPoints: number; // Thang điểm: 10 hoặc 100
  description: string; // Markdown + LaTeX math ($...$, $$...$$)
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  samples: SampleIO[];
  testCases: TestCase[];
  videoConfig: VideoConfig;
  author?: string;
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
  description: string;
  order: number;
  icon?: string;
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
}

export interface Submission {
  id: string;
  problemId: string;
  problemCode: string;
  problemTitle: string;
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

