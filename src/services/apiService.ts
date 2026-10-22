import type { Problem, TestCase, Submission } from '../types/judge';
import { idbService } from './db';
import { storageService } from './storageService';

/**
 * Hàm làm sạch chuỗi cấu hình (loại bỏ khoảng trắng, dấu xuống dòng \r, \n vô tình dính vào khi copy-paste trên Vercel)
 */
const cleanStr = (val: unknown, fallback: string = ''): string => {
  if (typeof val === 'string') {
    const trimmed = val.trim().replace(/[\r\n\t]+/g, '');
    return trimmed || fallback;
  }
  return fallback;
};

/**
 * Biến môi trường hệ thống cho Database và Judge0 VPS (Hỗ trợ Vite import.meta, process.env và fallback đám mây)
 */
export const ENV = {
  JUDGE0_URL: cleanStr(
    (typeof process !== 'undefined' && (process.env.JUDGE0_API_URL || process.env.VITE_JUDGE0_API_URL)) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_JUDGE0_API_URL),
    'http://103.149.170.5:2358'
  ),
  JUDGE0_TOKEN: cleanStr(
    (typeof process !== 'undefined' && (process.env.JUDGE0_API_TOKEN || process.env.VITE_JUDGE0_API_TOKEN)) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_JUDGE0_API_TOKEN),
    'faminh_secret_api_token'
  ),
  SUPABASE_URL: cleanStr(
    (typeof process !== 'undefined' && (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL),
    'https://wsccqtgnwejupfucfqtg.supabase.co'
  ),
  SUPABASE_ANON_KEY: cleanStr(
    (typeof process !== 'undefined' && (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2NxdGdud2VqdXBmdWNmcXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NjAxMTYsImV4cCI6MjEwODIzNjExNn0.ILXlVuUZGPfVo9n2_IhpVQHIPJ8QkZHajAWAKMP1280'
  ),
  FIREBASE_API_KEY: cleanStr(
    (typeof process !== 'undefined' && (process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY)) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_API_KEY),
    ''
  ),
  FIREBASE_PROJECT_ID: cleanStr(
    (typeof process !== 'undefined' && (process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID)) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID),
    ''
  ),
};

/**
 * Kiểm tra xem Supabase Cloud Database đã được cấu hình với URL và Key thực tế hay chưa
 */
export function isSupabaseConfigured(): boolean {
  return (
    Boolean(ENV.SUPABASE_URL) &&
    Boolean(ENV.SUPABASE_ANON_KEY) &&
    !ENV.SUPABASE_URL.includes('xyzcompany.supabase.co') &&
    ENV.SUPABASE_URL.startsWith('http')
  );
}

/**
 * Service API Database tập trung: Hỗ trợ cả Supabase Cloud REST API và IndexedDB dự phòng bền vững
 */
export const apiService = {
  /**
   * Kiểm tra cấu hình Cloud
   */
  isConfigured(): boolean {
    return isSupabaseConfigured();
  },

  /**
   * Đảm bảo Lớp học (Classroom) tồn tại trên Supabase Cloud để tránh lỗi Foreign Key Constraint 409
   */
  async ensureClassroom(classId: string, className?: string, joinCode?: string): Promise<void> {
    if (!isSupabaseConfigured() || !classId) return;
    try {
      const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms`;
      await fetch(targetUrl, {
        method: 'POST',
        headers: {
          apikey: ENV.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: classId,
          class_name: className || 'Lớp Học FAMINH',
          description: 'Lớp học lập trình FAMINH',
          join_code: joinCode || 'OXYZ',
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.warn('[apiService] ensureClassroom warning:', e);
    }
  },

  /**
   * Xóa Lớp học (Classroom) khỏi Supabase Cloud
   */
  async deleteClassroom(classId: string): Promise<void> {
    if (!isSupabaseConfigured() || !classId) return;
    try {
      // 1. Cập nhật các bài tập gán vào lớp này sang null để không vi phạm ràng buộc khóa ngoại (foreign key)
      const patchUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/problems?class_id=eq.${classId}`;
      await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          apikey: ENV.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ class_id: null }),
      });

      // 2. Xóa dòng lớp học trong bảng classrooms
      const deleteUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?id=eq.${classId}`;
      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          apikey: ENV.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
        },
      });
    } catch (e) {
      console.warn('[apiService] deleteClassroom warning:', e);
    }
  },

  /**
   * Lưu bộ Test Cases vào Database (Bắt buộc await và throw Error nếu thất bại)
   */
  async saveTestCases(problemId: string, testCases: TestCase[]): Promise<void> {
    if (!problemId) {
      throw new Error('Mã bài tập không hợp lệ khi lưu test case');
    }

    // 1. Luôn lưu vào IndexedDB cục bộ của trình duyệt trước để không bao giờ mất trên client
    await idbService.saveTestCases(problemId, testCases);

    // 2. Nếu đã cấu hình Supabase Cloud, gọi API PUT/POST (Upsert) lên bảng test_cases
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/test_cases`;
        const rows = testCases.map((tc, index) => ({
          id: tc.id || `${problemId}_tc_${index + 1}`,
          problem_id: problemId,
          test_name: tc.name || `Test #${index + 1}`,
          input: tc.input || '',
          expected_output: tc.expectedOutput || '',
          points: Number(tc.points) || 1,
          is_hidden: Boolean(tc.isHidden),
          order_index: index + 1,
          updated_at: new Date().toISOString(),
        }));

        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            apikey: ENV.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify(rows),
        });

        if (!res.ok) {
          const errDetail = await res.text();
          throw new Error(`Lỗi Supabase (${res.status}): ${errDetail.slice(0, 150)}`);
        }
      } catch (err: unknown) {
        console.error('[apiService] Lỗi lưu test cases lên Supabase Cloud:', err);
        throw new Error(
          `Không thể lưu bộ Test case lên Database đám mây: ${(err as Error)?.message || 'Lỗi kết nối'}`
        );
      }
    }
  },

  /**
   * Lấy danh sách Test Cases của bài tập từ Database
   */
  async fetchTestCases(problemId: string): Promise<TestCase[] | null> {
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/test_cases?problem_id=eq.${problemId}&order=order_index.asc`;
        const res = await fetch(targetUrl, {
          headers: {
            apikey: ENV.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapped: TestCase[] = data.map((d: any) => ({
              id: d.id,
              name: d.test_name || `Test #${d.order_index}`,
              input: d.input || '',
              expectedOutput: d.expected_output || '',
              points: d.points || 1,
              isHidden: Boolean(d.is_hidden),
            }));
            await idbService.saveTestCases(problemId, mapped);
            return mapped;
          }
        }
      } catch (err) {
        console.warn('[apiService] Không thể fetch test cases từ Supabase Cloud, dùng IndexedDB:', err);
      }
    }
    return idbService.getTestCases(problemId);
  },

  /**
   * Lưu Bài nộp (Submission/AC) vào Database thực tế (Bắt buộc await)
   */
  async saveSubmission(submission: Submission): Promise<void> {
    if (!submission || !submission.id) {
      throw new Error('Dữ liệu bài nộp không hợp lệ');
    }

    // 1. Lưu vào IndexedDB client trước
    await idbService.saveSubmission(submission);

    // 2. Nếu đã cấu hình Supabase Cloud, gọi API POST lên bảng submissions
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/submissions`;
        const payload = {
          id: submission.id,
          problem_id: submission.problemId,
          problem_code: submission.problemCode,
          problem_title: submission.problemTitle || submission.problemCode || '',
          user_id: submission.userId,
          user_name: submission.userName,
          class_id: submission.classId || 'class_default_faminh',
          language: submission.language,
          source_code: submission.sourceCode,
          verdict: submission.overallVerdict,
          status: submission.status || 'COMPLETED',
          total_points_earned: submission.totalPointsEarned,
          max_total_points: submission.maxTotalPoints,
          passed_count: submission.passedCount,
          total_tests: submission.totalTests,
          execution_time: submission.executionTime,
          memory: submission.memory,
          compilation_message: submission.compilationMessage,
          submitted_at: submission.submittedAt || new Date().toISOString(),
          test_results: submission.testResults,
        };

        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            apikey: ENV.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errDetail = await res.text();
          throw new Error(`Lỗi Supabase (${res.status}): ${errDetail.slice(0, 150)}`);
        }
      } catch (err: unknown) {
        console.error('[apiService] Lỗi lưu kết quả bài nộp lên Supabase Cloud:', err);
        throw new Error(
          `Không thể ghi nhận trạng thái nộp bài lên Database đám mây: ${(err as Error)?.message || 'Lỗi kết nối'}`
        );
      }
    }
  },

  /**
   * Lấy lịch sử nộp bài (Toàn bộ hoặc theo học sinh) từ Database thực tế
   */
  async fetchSubmissions(): Promise<Submission[]> {
    let cloudSubmissions: Submission[] = [];
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/submissions?order=submitted_at.desc&limit=150`;
        const res = await fetch(targetUrl, {
          headers: {
            apikey: ENV.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
          },
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            cloudSubmissions = list.map((item: any): Submission => ({
              id: item.id,
              problemId: item.problem_id,
              problemCode: item.problem_code,
              problemTitle: item.problem_title || item.problem_code || '',
              userId: item.user_id,
              userName: item.user_name,
              classId: item.class_id,
              language: item.language,
              sourceCode: item.source_code,
              status: (item.status as any) || 'COMPLETED',
              overallVerdict: item.verdict,
              totalPointsEarned: Number(item.total_points_earned) || 0,
              maxTotalPoints: Number(item.max_total_points) || 10,
              passedCount: Number(item.passed_count) || 0,
              totalTests: Number(item.total_tests) || 0,
              executionTime: Number(item.execution_time) || 0,
              memory: Number(item.memory) || 0,
              compilationMessage: item.compilation_message,
              submittedAt: item.submitted_at,
              testResults: item.test_results || [],
            }));
          }
        }
      } catch (err) {
        console.warn('[apiService] Lỗi tải submissions từ Supabase Cloud:', err);
      }
    }

    const localSubmissions = await idbService.getAllSubmissions();
    const mergedMap = new Map<string, Submission>();
    localSubmissions.forEach((s) => mergedMap.set(s.id, s));
    cloudSubmissions.forEach((s) => mergedMap.set(s.id, s));

    const result = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    // Đồng bộ lại vào local
    if (cloudSubmissions.length > 0) {
      idbService.saveSubmissions(result).catch(() => {});
    }

    return result;
  },

  /**
   * Lưu hoặc cập nhật Bài tập vào Database
   */
  async saveProblem(problem: Problem): Promise<void> {
    if (!problem || !problem.id) {
      throw new Error('Dữ liệu bài tập không hợp lệ');
    }

    await idbService.saveProblem(problem);

    if (isSupabaseConfigured()) {
      try {
        const targetClassId = problem.classId || 'class_default_faminh';
        // Đảm bảo lớp học tồn tại trên Supabase để không dính lỗi foreign key
        if (targetClassId && targetClassId !== 'class_default_faminh') {
          await this.ensureClassroom(targetClassId);
        }

        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/problems`;
        const payload = {
          id: problem.id,
          code: problem.code,
          title: problem.title,
          description: problem.description,
          difficulty: problem.difficulty,
          topic_id: problem.topicId,
          class_id: targetClassId,
          time_limit: problem.timeLimit,
          memory_limit: problem.memoryLimit,
          total_points: problem.totalPoints,
          input_format: problem.inputFormat,
          output_format: problem.outputFormat,
          constraints: problem.constraints,
          samples: problem.samples,
          starter_code: problem.starterCode,
          video_config: problem.videoConfig,
          attached_file: problem.attachedFile,
          created_at: problem.createdAt,
          updated_at: problem.updatedAt,
        };

        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            apikey: ENV.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errDetail = await res.text();
          throw new Error(`Lỗi Supabase (${res.status}): ${errDetail.slice(0, 150)}`);
        }
      } catch (err: unknown) {
        console.error('[apiService] Lỗi lưu bài tập lên Supabase Cloud:', err);
        throw new Error(
          `Không thể lưu bài tập vào Database đám mây: ${(err as Error)?.message || 'Lỗi kết nối'}`
        );
      }
    }
  },

  /**
   * Xóa Bài tập khỏi Database
   */
  async deleteProblem(problemId: string): Promise<void> {
    await idbService.deleteProblem(problemId);

    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/problems?id=eq.${problemId}`;
        const res = await fetch(targetUrl, {
          method: 'DELETE',
          headers: {
            apikey: ENV.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
          },
        });
        if (!res.ok) {
          const errDetail = await res.text();
          throw new Error(`Lỗi Supabase (${res.status}): ${errDetail.slice(0, 150)}`);
        }
      } catch (err: unknown) {
        console.error('[apiService] Lỗi xóa bài tập trên Supabase Cloud:', err);
        throw new Error(`Không thể xóa bài tập trên Database đám mây: ${(err as Error)?.message || 'Lỗi kết nối'}`);
      }
    }
  },

  /**
   * Lấy danh sách toàn bộ bài tập từ Database
   */
  async fetchProblems(): Promise<Problem[]> {
    let cloudProblems: Problem[] = [];
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/problems?order=code.asc`;
        const res = await fetch(targetUrl, {
          headers: {
            apikey: ENV.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
          },
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            cloudProblems = list.map((item: any): Problem => ({
              id: item.id,
              code: item.code,
              title: item.title,
              description: item.description || '',
              difficulty: item.difficulty || 'MEDIUM',
              topicId: item.topic_id,
              classId: item.class_id,
              timeLimit: Number(item.time_limit) || 1.0,
              memoryLimit: Number(item.memory_limit) || 256,
              totalPoints: Number(item.total_points) || 10,
              inputFormat: item.input_format || '',
              outputFormat: item.output_format || '',
              constraints: item.constraints || '',
              samples: item.samples || [],
              starterCode: item.starter_code,
              videoConfig: item.video_config || {
                enabled: false,
                type: 'youtube',
                url: '',
                unlockRule: 'always',
              },
              attachedFile: item.attached_file,
              createdAt: item.created_at || new Date().toISOString(),
              updatedAt: item.updated_at || new Date().toISOString(),
              testCases: [],
            }));
          }
        }
      } catch (err) {
        console.warn('[apiService] Lỗi tải problems từ Supabase Cloud:', err);
      }
    }

    // Lấy bài tập cục bộ từ cả IndexedDB và localStorage (đề phòng dữ liệu nằm trong localStorage trước khi nâng cấp)
    const [idbProblems, storageProblems] = await Promise.all([
      idbService.getAllProblems(),
      Promise.resolve(storageService.getProblems()),
    ]);
    const localMap = new Map<string, Problem>();
    idbProblems.forEach((p) => localMap.set(p.id, p));
    storageProblems.forEach((p) => {
      if (!localMap.has(p.id)) localMap.set(p.id, p);
    });
    const localProblems = Array.from(localMap.values());

    const mergedMap = new Map<string, Problem>();
    localProblems.forEach((p) => mergedMap.set(p.id, p));
    cloudProblems.forEach((p) => {
      const existing = mergedMap.get(p.id);
      if (existing) {
        mergedMap.set(p.id, {
          ...p,
          testCases: existing.testCases && existing.testCases.length > 0 ? existing.testCases : p.testCases,
        });
      } else {
        mergedMap.set(p.id, p);
      }
    });

    const result = Array.from(mergedMap.values());
    if (cloudProblems.length > 0) {
      idbService.saveProblems(result).catch(() => {});
    }

    // TỰ ĐỘNG ĐỒNG BỘ 2 CHIỀU:
    // Nếu trên máy này có bài tập trong IndexedDB/localStorage nhưng trên Supabase Cloud chưa có:
    // Tự động đẩy ngay bài tập và bộ test case lên Supabase để điện thoại và các máy khác thấy ngay lập tức!
    if (isSupabaseConfigured() && localProblems.length > 0) {
      for (const p of localProblems) {
        if (!cloudProblems.some((cp) => cp.id === p.id)) {
          this.saveProblem(p)
            .then(async () => {
              const tests = (await idbService.getTestCases(p.id)) || p.testCases;
              if (tests && tests.length > 0) {
                await this.saveTestCases(p.id, tests);
              }
              console.log(`[apiService] Đã tự động đồng bộ bài tập ${p.code} lên Cloud`);
            })
            .catch((err) => console.warn('[apiService] Auto-sync problem error:', err));
        }
      }
    }

    return result;
  },

  /**
   * ĐỒNG BỘ TOÀN DIỆN LÊN SUPABASE CLOUD
   * Đẩy toàn bộ danh sách lớp học, bài tập, test case và lịch sử nộp bài từ máy này lên Supabase Cloud
   */
  async syncAllToCloud(): Promise<{ problemsCount: number; testCasesCount: number; submissionsCount: number }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase Cloud chưa được cấu hình địa chỉ URL và API Key');
    }

    // 1. Đồng bộ Classrooms
    const localClasses = storageService.getClasses();
    for (const cls of localClasses) {
      await this.ensureClassroom(cls.id, cls.className, cls.joinCode);
    }

    // 2. Gom toàn bộ bài tập từ IndexedDB và localStorage
    const [idbProblems, storageProblems] = await Promise.all([
      idbService.getAllProblems(),
      Promise.resolve(storageService.getProblems()),
    ]);
    const problemMap = new Map<string, Problem>();
    idbProblems.forEach((p) => problemMap.set(p.id, p));
    storageProblems.forEach((p) => {
      if (!problemMap.has(p.id)) problemMap.set(p.id, p);
    });
    const allProblems = Array.from(problemMap.values());

    let syncedProblems = 0;
    let syncedTests = 0;

    for (const p of allProblems) {
      await this.saveProblem(p);
      syncedProblems++;

      let tests = await idbService.getTestCases(p.id);
      if (!tests || tests.length === 0) {
        tests = p.testCases;
      }
      if (tests && tests.length > 0) {
        await this.saveTestCases(p.id, tests);
        syncedTests += tests.length;
      }
    }

    // 3. Gom và đồng bộ lịch sử nộp bài Submissions
    const [idbSubs, storageSubs] = await Promise.all([
      idbService.getAllSubmissions(),
      Promise.resolve(storageService.getSubmissions()),
    ]);
    const subMap = new Map<string, Submission>();
    idbSubs.forEach((s) => subMap.set(s.id, s));
    storageSubs.forEach((s) => {
      if (!subMap.has(s.id)) subMap.set(s.id, s);
    });
    const allSubs = Array.from(subMap.values());
    let syncedSubs = 0;

    for (const sub of allSubs) {
      try {
        await this.saveSubmission(sub);
        syncedSubs++;
      } catch (e) {
        console.warn('[apiService] Sync submission warn:', e);
      }
    }

    return {
      problemsCount: syncedProblems,
      testCasesCount: syncedTests,
      submissionsCount: syncedSubs,
    };
  },
};
