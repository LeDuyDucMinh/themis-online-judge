import {
  isProblemInClass,
  type Classroom,
  type Problem,
  type StudentUser,
  type Submission,
  type Topic,
} from '../types/judge';
import { testJudge0Connection, DEFAULT_JUDGE0_URL } from '../services/judgeEngine';

// ============================================================================
// 1. VPS HEALTH PING VỚI CACHE 5 PHÚT (BẢO VỆ VPS 1 vCPU / 1.4 GB RAM)
// ============================================================================
export interface JudgeHealthSnapshot {
  checkedAt: number;
  success: boolean;
  latencyMs: number;
  version?: string;
  message: string;
}

const VPS_HEALTH_TTL_MS = 5 * 60 * 1000;
let cachedHealth: JudgeHealthSnapshot | null = null;
let healthInflight: Promise<JudgeHealthSnapshot> | null = null;

export function getCachedJudgeHealth(): JudgeHealthSnapshot | null {
  return cachedHealth;
}

export async function checkJudgeServerHealthCached(
  force: boolean = false
): Promise<JudgeHealthSnapshot> {
  const now = Date.now();
  if (!force && cachedHealth && now - cachedHealth.checkedAt < VPS_HEALTH_TTL_MS) {
    return cachedHealth;
  }
  if (healthInflight) return healthInflight;

  healthInflight = (async () => {
    let targetUrl = DEFAULT_JUDGE0_URL;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('faminh_judge0_api_url');
      if (saved && saved.trim() && saved !== '/api/judge0') {
        targetUrl = saved.trim();
      }
    }
    const start = performance.now();
    try {
      const res = await testJudge0Connection(targetUrl);
      const latencyMs = Math.max(1, Math.round(performance.now() - start));
      const snap: JudgeHealthSnapshot = {
        checkedAt: Date.now(),
        success: Boolean(res.success),
        latencyMs,
        version: res.version,
        message: res.message,
      };
      cachedHealth = snap;
      return snap;
    } catch {
      const snap: JudgeHealthSnapshot = {
        checkedAt: Date.now(),
        success: false,
        latencyMs: Math.max(1, Math.round(performance.now() - start)),
        message: 'Không thể kết nối máy chủ chấm bài',
      };
      cachedHealth = snap;
      return snap;
    }
  })().finally(() => {
    healthInflight = null;
  });

  return healthInflight;
}

// ============================================================================
// 2. TÍNH TOÁN TIẾN ĐỘ FULL AC / BẢNG XẾP HẠNG TỪ DỮ LIỆU ĐÃ CACHE (0 REQUEST)
// ============================================================================
export interface StudentClassProgress {
  student: StudentUser;
  rank: number;
  acCount: number;
  totalProblems: number;
  pct: number;
  solvedCodes: string[];
  solvedProblemIds: Set<string>;
  totalSubmissions: number;
  lastSubmittedAt: string | null;
  lastSolvedAt: string | null;
}

function getStudentIdentityKeys(s: StudentUser): string[] {
  const keys: string[] = [];
  if (s.id) keys.push(s.id.trim().toLowerCase());
  if (s.email) keys.push(s.email.trim().toLowerCase());
  if (s.username) keys.push(s.username.trim().toLowerCase());
  return keys;
}

export function getDisplayEmail(stu: { email?: string; username?: string }): string {
  if (stu.email && stu.email.trim()) return stu.email.trim();
  if (stu.username && stu.username.includes('@')) return stu.username.trim();
  return stu.username || '';
}

export function computeClassStudentProgress(
  classId: string,
  classStudents: StudentUser[],
  classProblems: Problem[],
  submissions: Submission[]
): StudentClassProgress[] {
  const problemMap = new Map<string, Problem>();
  const problemCodeMap = new Map<string, Problem>();
  for (const p of classProblems) {
    if (p.id) problemMap.set(p.id.trim().toLowerCase(), p);
    if (p.code) problemCodeMap.set(p.code.trim().toLowerCase(), p);
  }

  // Ánh xạ mọi định danh (id / email / username) -> chỉ số học sinh trong lớp
  const keyToStudentId = new Map<string, string>();
  for (const stu of classStudents) {
    for (const k of getStudentIdentityKeys(stu)) {
      keyToStudentId.set(k, stu.id);
    }
  }

  interface Acc {
    solvedMap: Map<string, string>; // canonicalProblemId -> code
    totalSubs: number;
    lastSubmittedAt: string | null;
    lastSolvedAt: string | null;
  }

  const accMap = new Map<string, Acc>();
  for (const stu of classStudents) {
    accMap.set(stu.id, {
      solvedMap: new Map(),
      totalSubs: 0,
      lastSubmittedAt: null,
      lastSolvedAt: null,
    });
  }

  // Sắp xếp tăng dần theo thời gian để ghi nhận thời điểm AC chuẩn
  const relevantSubs = submissions
    .filter((sub) => {
      if (sub.classId && sub.classId !== classId) return false;
      const uid = (sub.userId || '').trim().toLowerCase();
      if (!uid || !keyToStudentId.has(uid)) return false;
      const pid = (sub.problemId || '').trim().toLowerCase();
      const pcode = (sub.problemCode || '').trim().toLowerCase();
      return problemMap.has(pid) || problemCodeMap.has(pcode);
    })
    .sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());

  for (const sub of relevantSubs) {
    const uid = (sub.userId || '').trim().toLowerCase();
    const stuId = keyToStudentId.get(uid);
    if (!stuId) continue;
    const acc = accMap.get(stuId);
    if (!acc) continue;

    acc.totalSubs += 1;
    if (
      sub.submittedAt &&
      (!acc.lastSubmittedAt ||
        new Date(sub.submittedAt).getTime() > new Date(acc.lastSubmittedAt).getTime())
    ) {
      acc.lastSubmittedAt = sub.submittedAt;
    }

    if (sub.overallVerdict === 'AC') {
      const pid = (sub.problemId || '').trim().toLowerCase();
      const pcode = (sub.problemCode || '').trim().toLowerCase();
      const prob = problemMap.get(pid) || problemCodeMap.get(pcode);
      if (prob && !acc.solvedMap.has(prob.id)) {
        acc.solvedMap.set(prob.id, prob.code || prob.title || prob.id);
        acc.lastSolvedAt = sub.submittedAt || acc.lastSolvedAt;
      }
    }
  }

  const totalProblems = classProblems.length;
  const rows: StudentClassProgress[] = classStudents.map((stu) => {
    const acc = accMap.get(stu.id)!;
    const acCount = acc.solvedMap.size;
    const pct = totalProblems > 0 ? Math.min(100, Math.round((acCount / totalProblems) * 100)) : 0;
    return {
      student: stu,
      rank: 0,
      acCount,
      totalProblems,
      pct,
      solvedCodes: Array.from(acc.solvedMap.values()),
      solvedProblemIds: new Set(acc.solvedMap.keys()),
      totalSubmissions: acc.totalSubs,
      lastSubmittedAt: acc.lastSubmittedAt,
      lastSolvedAt: acc.lastSolvedAt,
    };
  });

  // Xếp hạng mặc định theo số bài Full AC giảm dần, hòa thì ai hoàn thành sớm hơn đứng trước
  rows.sort((a, b) => {
    if (b.acCount !== a.acCount) return b.acCount - a.acCount;
    if (a.acCount > 0 && a.lastSolvedAt && b.lastSolvedAt) {
      const ta = new Date(a.lastSolvedAt).getTime();
      const tb = new Date(b.lastSolvedAt).getTime();
      if (ta !== tb) return ta - tb;
    }
    return a.student.fullName.localeCompare(b.student.fullName, 'vi');
  });

  rows.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return rows;
}

export function getProblemAssignedClasses(
  problem: Problem,
  topics: Topic[],
  classes: Classroom[]
): Classroom[] {
  return classes.filter((cls) => isProblemInClass(problem, cls.id, topics, classes));
}

export function getEffectiveTestCount(
  problem: Problem,
  cloudTestCounts: Record<string, number>
): number {
  if (Object.prototype.hasOwnProperty.call(cloudTestCounts, problem.id)) {
    return cloudTestCounts[problem.id];
  }
  return problem.testCases?.length || 0;
}

// ============================================================================
// 3. ĐỊNH DẠNG THỜI GIAN CHUẨN VIỆT NAM (UTC+7)
// ============================================================================
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export function isSubmissionTodayVN(iso?: string): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const nowVn = new Date(Date.now() + VN_OFFSET_MS);
  const subVn = new Date(t + VN_OFFSET_MS);
  return (
    nowVn.getUTCFullYear() === subVn.getUTCFullYear() &&
    nowVn.getUTCMonth() === subVn.getUTCMonth() &&
    nowVn.getUTCDate() === subVn.getUTCDate()
  );
}

export function formatShortSubmissionTime(iso?: string): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const d = new Date(t + VN_OFFSET_MS);
  const dd = d.getUTCDate();
  const mm = d.getUTCMonth() + 1;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

export function formatDateVN(iso?: string): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const d = new Date(t + VN_OFFSET_MS);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
}
