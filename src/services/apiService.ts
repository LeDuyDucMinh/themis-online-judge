import type { Problem, TestCase, Submission, Classroom, ClassStudent, StudentUser, Topic } from '../types/judge';
import { idbService } from './db';
import { storageService, DEFAULT_ADMIN_PASSWORD } from './storageService';

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
   * Header tiêu chuẩn chống aggressive cache trên mọi thiết bị và trình duyệt
   */
  getAntiCacheHeaders(): Record<string, string> {
    return {
      apikey: ENV.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };
  },

  /**
   * Lấy danh sách Lớp học (Classrooms) từ Database đám mây (Anti-cache real-time)
   */
  async fetchClassrooms(): Promise<Classroom[]> {
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?order=created_at.asc`;
        const res = await fetch(targetUrl, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const cloudClasses = data
              .filter((c: any) => c.id && !c.id.startsWith('__system_'))
              .map((c: any): Classroom => ({
                id: c.id,
                className: c.class_name || 'Lớp Học FAMINH',
                description: c.description || '',
                teacherId: 'admin',
                joinCode: c.join_code || 'OXYZ',
                createdAt: c.created_at || new Date().toISOString(),
              }));

            // ĐỒNG BỘ CHUẨN TỪ CLOUD (SINGLE SOURCE OF TRUTH):
            // Supabase Cloud là chân lý duy nhất. Lớp đã xóa trên Cloud thì client PHẢI XÓA THEO!
            // Tuyệt đối KHÔNG tự ý đẩy các lớp đã bị xóa từ local ngược lên lại Cloud (ngăn chặn Zombie Resurrect).
            storageService.saveClasses(cloudClasses);
            return cloudClasses;
          }
        }
      } catch (err) {
        console.warn('[apiService] Lỗi fetch classrooms từ Supabase Cloud:', err);
      }
    }

    return storageService.getClasses();
  },

  /**
   * Lưu hoặc cập nhật Lớp học lên Supabase Cloud
   */
  async saveClassroom(cls: Classroom): Promise<void> {
    if (!cls || !cls.id) return;
    if (!isSupabaseConfigured()) return;
    try {
      const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?on_conflict=id`;
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...this.getAntiCacheHeaders(),
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: cls.id,
          class_name: cls.className,
          description: cls.description || '',
          join_code: cls.joinCode || 'OXYZ',
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Lỗi lưu lớp học (${res.status}): ${detail.slice(0, 150)}`);
      }
    } catch (e) {
      console.error('[apiService] saveClassroom error:', e);
      throw e;
    }
  },

  /**
   * Đảm bảo Lớp học (Classroom) tồn tại trên Supabase Cloud để tránh lỗi Foreign Key Constraint 409
   */
  async ensureClassroom(classId: string, className?: string, joinCode?: string): Promise<void> {
    if (!isSupabaseConfigured() || !classId) return;
    // Lớp 'ALL' và 'class_default_faminh' là hệ thống và đã tồn tại, không bao giờ ghi đè tránh làm mất tên lớp người dùng đã đổi
    if (classId === 'ALL' || classId === 'class_default_faminh') return;
    try {
      const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?on_conflict=id`;
      const defaultName = 'Lớp Học FAMINH';
      const defaultCode = 'OXYZ';

      await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...this.getAntiCacheHeaders(),
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify({
          id: classId,
          class_name: className || defaultName,
          description: 'Lớp học lập trình FAMINH',
          join_code: joinCode || defaultCode,
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
      // 1. Cập nhật các bài tập gán vào lớp này sang 'ALL' để không vi phạm ràng buộc khóa ngoại (foreign key)
      const patchUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/problems?class_id=eq.${classId}`;
      await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          ...this.getAntiCacheHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ class_id: 'ALL' }),
      });

      // 2. Dọn liên kết học sinh của lớp này
      try {
        const relations = await this.fetchClassStudents();
        const updatedRelations = relations.filter((r) => r.classId !== classId);
        await this.saveClassStudents(updatedRelations);
      } catch {
        // Tiếp tục xóa lớp nếu dọn quan hệ lỗi
      }

      // 3. Xóa dòng lớp học trong bảng classrooms
      const deleteUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?id=eq.${classId}`;
      const res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: this.getAntiCacheHeaders(),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Lỗi xóa lớp học (${res.status}): ${detail.slice(0, 150)}`);
      }
    } catch (e) {
      console.error('[apiService] deleteClassroom error:', e);
      throw e;
    }
  },

  /**
   * Lấy danh sách liên kết Học sinh - Lớp học từ Supabase Cloud (Anti-cache real-time)
   */
  async fetchClassStudents(): Promise<ClassStudent[]> {
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?id=eq.__system_class_students__`;
        const res = await fetch(targetUrl, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0 && rows[0].description) {
            const parsed = JSON.parse(rows[0].description);
            if (Array.isArray(parsed)) {
              storageService.saveClassStudents(parsed);
              return parsed;
            }
          }
        }
      } catch (e) {
        console.warn('[apiService] fetchClassStudents warn:', e);
      }
    }
    return storageService.getClassStudents();
  },

  /**
   * Lưu liên kết Học sinh - Lớp học lên Supabase Cloud
   */
  async saveClassStudents(list: ClassStudent[]): Promise<void> {
    storageService.saveClassStudents(list);
    if (!isSupabaseConfigured()) return;
    try {
      const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?on_conflict=id`;
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...this.getAntiCacheHeaders(),
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: '__system_class_students__',
          class_name: 'CLASS_STUDENTS',
          description: JSON.stringify(list),
          join_code: 'REL',
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Lỗi lưu quan hệ học sinh-lớp (${res.status}): ${detail.slice(0, 150)}`);
      }
    } catch (e) {
      console.error('[apiService] saveClassStudents warn:', e);
      throw e;
    }
  },

  /**
   * Đọc danh sách học sinh THUẦN từ Cloud (không trộn với bộ nhớ máy).
   * Trả về null nếu lỗi mạng/HTTP; trả về [] nếu Cloud chưa có học sinh nào.
   * Có timeout dài hơn và tự thử lại 1 lần để không rơi về dữ liệu cũ khi mạng chậm.
   */
  async fetchRawCloudStudents(): Promise<StudentUser[] | null> {
    if (!isSupabaseConfigured()) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), 15000);
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?id=eq.__system_students__&select=description&_t=${Date.now()}`;
        const res = await fetch(targetUrl, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeoutTimer);
        if (!res.ok) {
          console.warn(`[apiService] fetchRawCloudStudents HTTP ${res.status}`);
          continue;
        }
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0 || !rows[0].description) return [];
        let parsed: any[];
        try {
          parsed = JSON.parse(rows[0].description);
        } catch {
          return null;
        }
        if (!Array.isArray(parsed)) return null;
        return parsed
          .filter((s: any) => s && s.username)
          .map((s: any) => ({
            id: s.id || `student_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            fullName: s.fullName || s.username || 'Học sinh',
            username: s.username,
            password: s.password || '123',
            createdAt: s.createdAt || new Date().toISOString(),
          }));
      } catch (e) {
        clearTimeout(timeoutTimer);
        console.warn('[apiService] fetchRawCloudStudents error/timeout:', e);
      }
    }
    return null;
  },

  /**
   * Lấy danh sách Học sinh trực tiếp từ Supabase Cloud (trả về null nếu không kết nối được hoặc lỗi)
   */
  async fetchStudentsFromCloud(): Promise<StudentUser[] | null> {
    const cloudStudents = await this.fetchRawCloudStudents();
    if (cloudStudents === null || cloudStudents.length === 0) return null;

    // Hợp nhất an toàn: Không làm mất học sinh cục bộ còn đang hoạt động
    const localList = storageService.getStudents();
    const studentMap = new Map<string, StudentUser>();
    cloudStudents.forEach((s) => studentMap.set((s.username || '').trim().toLowerCase(), s));
    localList.forEach((s) => {
      const u = (s.username || '').trim().toLowerCase();
      if (u && !studentMap.has(u)) {
        studentMap.set(u, s);
      }
    });
    const mergedList = Array.from(studentMap.values());
    storageService.saveStudents(mergedList);
    return mergedList;
  },

  /**
   * Lấy danh sách Học sinh từ Supabase Cloud (Anti-cache real-time, Single Source of Truth)
   */
  async fetchStudents(): Promise<StudentUser[]> {
    const cloud = await this.fetchStudentsFromCloud();
    if (cloud !== null) {
      return cloud;
    }
    return storageService.getStudents();
  },

  /**
   * Lưu danh sách Học sinh lên Supabase Cloud
   */
  async saveStudents(list: StudentUser[], removeIds: string[] = []): Promise<StudentUser[]> {
    const removeSet = new Set(removeIds);
    const normalize = (s: StudentUser) => (s.username || '').trim().toLowerCase();

    // Hợp nhất với danh sách MỚI NHẤT trên Cloud: không bao giờ ghi đè làm mất học sinh do máy khác tạo
    const merged = new Map<string, StudentUser>();
    const cloudLatest = isSupabaseConfigured() ? await this.fetchRawCloudStudents() : [];
    if (cloudLatest === null) {
      // Không đọc được Cloud -> chỉ lưu trên máy, tuyệt đối không ghi đè Cloud bằng danh sách không đầy đủ
      list.forEach((s) => {
        if (normalize(s) && !removeSet.has(s.id)) merged.set(normalize(s), s);
      });
      storageService.saveStudents(Array.from(merged.values()));
      throw new Error('Không đọc được danh sách học sinh trên Cloud (mạng chậm hoặc mất kết nối)');
    }
    cloudLatest.forEach((s) => {
      if (normalize(s) && !removeSet.has(s.id)) merged.set(normalize(s), s);
    });
    list.forEach((s) => {
      if (normalize(s) && !removeSet.has(s.id)) merged.set(normalize(s), s);
    });
    const finalList = Array.from(merged.values());

    storageService.saveStudents(finalList);
    if (!isSupabaseConfigured()) return finalList;

    // Không bao giờ ghi danh sách rỗng đè lên Cloud trừ khi đang xóa chủ ý
    if (finalList.length === 0 && removeIds.length === 0) return finalList;

    try {
      const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?on_conflict=id`;
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...this.getAntiCacheHeaders(),
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: '__system_students__',
          class_name: 'STUDENTS',
          description: JSON.stringify(finalList),
          join_code: 'USER',
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Lỗi lưu danh sách học sinh (${res.status}): ${detail.slice(0, 150)}`);
      }
    } catch (e) {
      console.error('[apiService] saveStudents warn:', e);
      throw e;
    }
    return finalList;
  },

  /**
   * Xóa toàn bộ lịch sử bài làm của học sinh (IndexedDB và Supabase Cloud)
   */
  async deleteSubmissionsForStudent(studentId: string, username?: string, fullName?: string): Promise<void> {
    // 1. Xóa trong IndexedDB máy hiện tại
    await idbService.deleteSubmissionsForStudent(studentId, username, fullName);

    // 2. Xóa trên Supabase Cloud Database nếu có
    if (isSupabaseConfigured()) {
      try {
        const deleteCalls: Promise<any>[] = [];
        if (studentId) {
          deleteCalls.push(
            fetch(`${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/submissions?user_id=eq.${encodeURIComponent(studentId)}`, {
              method: 'DELETE',
              headers: this.getAntiCacheHeaders(),
            })
          );
        }
        if (username && username !== studentId) {
          deleteCalls.push(
            fetch(`${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/submissions?user_id=eq.${encodeURIComponent(username)}`, {
              method: 'DELETE',
              headers: this.getAntiCacheHeaders(),
            })
          );
        }
        if (fullName) {
          deleteCalls.push(
            fetch(`${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/submissions?user_name=eq.${encodeURIComponent(fullName)}`, {
              method: 'DELETE',
              headers: this.getAntiCacheHeaders(),
            })
          );
        }
        await Promise.allSettled(deleteCalls);
      } catch (e) {
        console.warn('[apiService] deleteSubmissionsForStudent cloud error:', e);
      }
    }
  },

  /**
   * Lấy danh sách Chủ đề từ Supabase Cloud
   */
  async fetchTopics(): Promise<Topic[]> {
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?id=eq.__system_topics__`;
        const res = await fetch(targetUrl, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0 && rows[0].description) {
            const parsed = JSON.parse(rows[0].description);
            if (Array.isArray(parsed)) {
              storageService.saveTopics(parsed);
              return parsed;
            }
          }
        }
      } catch (e) {
        console.warn('[apiService] fetchTopics warn:', e);
      }
    }
    return storageService.getTopics();
  },

  /**
   * Lưu danh sách Chủ đề lên Supabase Cloud
   */
  async saveTopics(list: Topic[]): Promise<void> {
    storageService.saveTopics(list);
    if (!isSupabaseConfigured()) return;
    try {
      const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?on_conflict=id`;
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...this.getAntiCacheHeaders(),
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: '__system_topics__',
          class_name: 'TOPICS',
          description: JSON.stringify(list),
          join_code: 'TOPIC',
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Lỗi lưu danh sách chủ đề (${res.status}): ${detail.slice(0, 150)}`);
      }
    } catch (e) {
      console.error('[apiService] saveTopics warn:', e);
      throw e;
    }
  },

  /**
   * Lấy mật mã Admin hiện tại trực tiếp từ Database (Supabase Cloud)
   * Không phụ thuộc vào LocalStorage
   */
  async getAdminPasswordFromDatabase(): Promise<string> {
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?id=eq.__system_admin_auth__`;
        const res = await fetch(targetUrl, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0 && rows[0].description) {
            const dbPass = rows[0].description.trim();
            storageService.setAdminPassword(dbPass);
            return dbPass;
          }
          if (Array.isArray(rows) && rows.length === 0) {
            // Chỉ khi bảng xác thực rỗng thực sự trên Cloud mới khởi tạo mặc định
            await this.updateAdminPasswordInDatabase(DEFAULT_ADMIN_PASSWORD);
            return DEFAULT_ADMIN_PASSWORD;
          }
        }
      } catch (err) {
        console.warn('[apiService] Lỗi kết nối Supabase Cloud khi lấy Admin Password:', err);
      }
    }
    return storageService.getAdminPassword();
  },

  /**
   * BẮT BUỘC KIỂM TRA MẬT KHẨU ADMIN QUA API VỚI DATABASE TRỰC TIẾP
   * Không ưu tiên mật khẩu/token cũ ở LocalStorage
   */
  async verifyAdminPassword(password: string): Promise<boolean> {
    if (!password || !password.trim()) return false;
    try {
      const dbPassword = await this.getAdminPasswordFromDatabase();
      return password.trim() === dbPassword.trim();
    } catch {
      return false;
    }
  },

  /**
   * Cập nhật mật mã Admin mới lên Database (Supabase Cloud)
   */
  async updateAdminPasswordInDatabase(newPassword: string): Promise<boolean> {
    if (!newPassword || newPassword.trim().length < 6) return false;
    const cleanPass = newPassword.trim();
    storageService.setAdminPassword(cleanPass);
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?on_conflict=id`;
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            ...this.getAntiCacheHeaders(),
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            id: '__system_admin_auth__',
            class_name: 'ADMIN_CREDENTIAL',
            description: cleanPass,
            join_code: 'ROOT',
            updated_at: new Date().toISOString(),
          }),
        });
        return res.ok;
      } catch (err) {
        console.error('[apiService] Lỗi cập nhật Admin Password lên Supabase Cloud:', err);
        return false;
      }
    }
    return true;
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
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/test_cases?on_conflict=id`;
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
            ...this.getAntiCacheHeaders(),
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
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/submissions?on_conflict=id`;
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
            ...this.getAntiCacheHeaders(),
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
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
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

    if (isSupabaseConfigured() && cloudSubmissions.length >= 0) {
      // Khi Cloud đã kết nối, Cloud là nguồn chân lý duy nhất cho danh sách nộp bài
      // Cập nhật đồng bộ ngược vào IndexedDB và localStorage (loại bỏ hoàn toàn Zombie Resurrect bài nộp cũ)
      try {
        await idbService.clearSubmissions();
        if (cloudSubmissions.length > 0) {
          await idbService.saveSubmissions(cloudSubmissions);
        }
        storageService.saveSubmissions(cloudSubmissions);
      } catch (e) {
        console.warn('[apiService] Đồng bộ submissions vào local cảnh báo:', e);
      }
      return cloudSubmissions;
    }

    // Chỉ dùng bộ nhớ cục bộ làm dự phòng khi không kết nối được Supabase Cloud
    const localSubmissions = await idbService.getAllSubmissions();
    return localSubmissions.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
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
        const isNone = problem.classId === 'NONE' || !problem.classId;
        const targetClassId = isNone ? null : (problem.classId !== 'class_default_faminh' ? problem.classId : 'ALL');
        // Đảm bảo lớp học luôn tồn tại trên Supabase để tránh lỗi Foreign Key Constraint 409
        if (targetClassId) {
          await this.ensureClassroom(targetClassId);
        }

        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/problems?on_conflict=id`;
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
            ...this.getAntiCacheHeaders(),
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
        // 1. Xóa các test cases của bài tập này trên Supabase để giải phóng ràng buộc
        try {
          await fetch(`${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/test_cases?problem_id=eq.${problemId}`, {
            method: 'DELETE',
            headers: this.getAntiCacheHeaders(),
          });
        } catch {
          // Bỏ qua lỗi xóa test case nếu không tồn tại
        }

        // 2. Xóa bài tập khỏi bảng problems trên Supabase
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/problems?id=eq.${problemId}`;
        const res = await fetch(targetUrl, {
          method: 'DELETE',
          headers: this.getAntiCacheHeaders(),
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
   * Lấy danh sách toàn bộ bài tập từ Database (Cloud Single Source of Truth)
   */
  async fetchProblems(): Promise<Problem[]> {
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/problems?order=code.asc`;
        const res = await fetch(targetUrl, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            const cloudProblems = list.map((item: any): Problem => ({
              id: item.id,
              code: item.code,
              title: item.title,
              description: item.description || '',
              difficulty: item.difficulty || 'MEDIUM',
              topicId: item.topic_id,
              classId: item.class_id || 'NONE',
              timeLimit: Number(item.time_limit) || 1.0,
              memoryLimit: Number(item.memory_limit) || 1024,
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

            // ĐỒNG BỘ CHUẨN TỪ CLOUD (SINGLE SOURCE OF TRUTH):
            // Supabase Cloud là chân lý. Tự động đẩy các bài tập local chưa có trên Cloud nếu là phiên Admin.
            const cloudIdSet = new Set(cloudProblems.map((p) => p.id));
            const [idbProblems, storageProblems] = await Promise.all([
              idbService.getAllProblems(),
              Promise.resolve(storageService.getProblems()),
            ]);

            // Tải toàn bộ test cases từ Supabase Cloud để gộp vào cloudProblems
            const cloudTcMap = new Map<string, TestCase[]>();
            try {
              const tcUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/test_cases?select=id,problem_id,test_name,input,expected_output,points,is_hidden,order_index&order=order_index.asc`;
              const tcRes = await fetch(tcUrl, {
                headers: {
                  ...this.getAntiCacheHeaders(),
                  apikey: ENV.SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
                },
                cache: 'no-store',
              });
              if (tcRes.ok) {
                const allTcRows = await tcRes.json();
                if (Array.isArray(allTcRows)) {
                  for (const row of allTcRows) {
                    const pid = row.problem_id;
                    if (!cloudTcMap.has(pid)) cloudTcMap.set(pid, []);
                    cloudTcMap.get(pid)!.push({
                      id: row.id,
                      name: row.test_name || `Test #${row.order_index}`,
                      input: row.input || '',
                      expectedOutput: row.expected_output || '',
                      points: Number(row.points) || 1,
                      isHidden: Boolean(row.is_hidden),
                    });
                  }
                }
              }
            } catch (tcErr) {
              console.warn('[apiService] Không thể fetch test_cases từ Supabase:', tcErr);
            }

            // Gộp test cases từ Cloud, IndexedDB hoặc LocalStorage vào từng bài tập trong cloudProblems
            const idbMap = new Map(idbProblems.map((p) => [p.id, p]));
            const storageMap = new Map(storageProblems.map((p) => [p.id, p]));

            for (const cp of cloudProblems) {
              const fromCloud = cloudTcMap.get(cp.id);
              const fromIdb = idbMap.get(cp.id)?.testCases;
              const fromStorage = storageMap.get(cp.id)?.testCases;

              const tests = (fromCloud && fromCloud.length > 0)
                ? fromCloud
                : (fromIdb && fromIdb.length > 0)
                ? fromIdb
                : (fromStorage && fromStorage.length > 0)
                ? fromStorage
                : [];

              cp.testCases = tests;

              if (tests.length > 0) {
                idbService.saveTestCases(cp.id, tests).catch(() => {});
              }
            }

            const unSyncedLocalProblems: Problem[] = [];
            idbProblems.forEach((p) => {
              if (!cloudIdSet.has(p.id) && !p.id.startsWith('mock_')) unSyncedLocalProblems.push(p);
            });
            storageProblems.forEach((p) => {
              if (!cloudIdSet.has(p.id) && !unSyncedLocalProblems.some((u) => u.id === p.id) && !p.id.startsWith('mock_')) {
                unSyncedLocalProblems.push(p);
              }
            });

            if (unSyncedLocalProblems.length > 0 && storageService.isAdminSessionActive()) {
              for (const unp of unSyncedLocalProblems) {
                try {
                  await this.saveProblem(unp);
                  let tc = await idbService.getTestCases(unp.id);
                  if (!tc || tc.length === 0) tc = unp.testCases;
                  if (tc && tc.length > 0) {
                    await this.saveTestCases(unp.id, tc);
                  }
                  cloudProblems.push(unp);
                } catch (e) {
                  console.warn('[apiService] Auto-sync local problem to Cloud warn:', e);
                }
              }
            }

            await idbService.saveProblems(cloudProblems);
            storageService.saveProblems(cloudProblems);
            return cloudProblems;
          }
        }
      } catch (err) {
        console.warn('[apiService] Lỗi tải problems từ Supabase Cloud, dùng local cache:', err);
      }
    }

    // Fallback: chỉ dùng IndexedDB / LocalStorage khi mất kết nối mạng
    const [idbProblems, storageProblems] = await Promise.all([
      idbService.getAllProblems(),
      Promise.resolve(storageService.getProblems()),
    ]);
    const localMap = new Map<string, Problem>();
    idbProblems.forEach((p) => localMap.set(p.id, p));
    storageProblems.forEach((p) => {
      if (!localMap.has(p.id)) localMap.set(p.id, p);
    });
    return Array.from(localMap.values());
  },

  /**
   * ĐỒNG BỘ TOÀN DIỆN LÊN SUPABASE CLOUD
   * Đẩy toàn bộ danh sách lớp học, bài tập, test case và lịch sử nộp bài từ máy này lên Supabase Cloud
   */
  async syncAllToCloud(): Promise<{ problemsCount: number; testCasesCount: number; submissionsCount: number }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase Cloud chưa được cấu hình địa chỉ URL và API Key');
    }

    // 0. Tự động đồng bộ mật mã Admin nếu máy này đã đổi mật khẩu
    const localPass = storageService.getAdminPassword();
    if (localPass && localPass !== DEFAULT_ADMIN_PASSWORD && localPass.length >= 6) {
      await this.updateAdminPasswordInDatabase(localPass);
    }

    // 1. Đồng bộ Classrooms: chỉ khởi tạo nếu Cloud chưa có lớp nào
    const cloudClasses = await this.fetchClassrooms();
    if (cloudClasses.length === 0) {
      const localClasses = storageService.getClasses();
      for (const cls of localClasses) {
        await this.saveClassroom(cls);
      }
    }

    // 2. Đồng bộ quan hệ học sinh - lớp, danh sách học sinh và chủ đề (Merge an toàn)
    await this.saveClassStudents(storageService.getClassStudents());
    const cloudStudents = await this.fetchStudents();
    const localStudents = storageService.getStudents();
    const studentMap = new Map<string, StudentUser>();
    localStudents.forEach((s) => studentMap.set((s.username || '').toLowerCase(), s));
    cloudStudents.forEach((s) => {
      const uName = (s.username || '').toLowerCase();
      if (!studentMap.has(uName)) {
        studentMap.set(uName, s);
      }
    });
    const mergedStudents = Array.from(studentMap.values()).filter((s) => s.username);
    if (mergedStudents.length > 0) {
      try {
        await this.saveStudents(mergedStudents);
      } catch (e) {
        console.warn('[apiService] syncAllToCloud: bỏ qua bước đồng bộ học sinh:', e);
      }
      storageService.saveStudents(mergedStudents);
    }
    await this.saveTopics(storageService.getTopics());

    // 3. Gom toàn bộ bài tập từ IndexedDB và localStorage
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

    // Chỉ đẩy lên những gì Cloud còn thiếu (thay vì tải lại toàn bộ mỗi lần đăng nhập/tải trang)
    const fetchIdSet = async (table: string, column: string): Promise<Set<string> | null> => {
      try {
        const res = await fetch(
          `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${table}?select=${column}&limit=100000`,
          { headers: this.getAntiCacheHeaders(), cache: 'no-store' }
        );
        if (!res.ok) return null;
        const rows = await res.json();
        if (!Array.isArray(rows)) return null;
        return new Set(rows.map((r: any) => String(r[column])));
      } catch {
        return null;
      }
    };
    const runBatches = async <T,>(items: T[], worker: (item: T) => Promise<void>, size = 5) => {
      for (let i = 0; i < items.length; i += size) {
        await Promise.all(items.slice(i, i + size).map((it) => worker(it)));
      }
    };

    const [cloudProblemIds, cloudTestProblemIds] = await Promise.all([
      fetchIdSet('problems', 'id'),
      fetchIdSet('test_cases', 'problem_id'),
    ]);

    let syncedProblems = 0;
    let syncedTests = 0;

    await runBatches(allProblems, async (p) => {
      try {
        const problemMissing = !cloudProblemIds || !cloudProblemIds.has(p.id);
        if (problemMissing) {
          await this.saveProblem(p);
          syncedProblems++;
        }
        const testsMissing = !cloudTestProblemIds || !cloudTestProblemIds.has(p.id);
        if (problemMissing || testsMissing) {
          let tests = await idbService.getTestCases(p.id);
          if (!tests || tests.length === 0) {
            tests = p.testCases;
          }
          if (tests && tests.length > 0) {
            await this.saveTestCases(p.id, tests);
            syncedTests += tests.length;
          }
        }
      } catch (e) {
        console.warn('[apiService] Sync problem warn:', e);
      }
    });

    // 3. Gom và đồng bộ lịch sử nộp bài Submissions (chỉ những bài Cloud chưa có)
    const [idbSubs, storageSubs] = await Promise.all([
      idbService.getAllSubmissions(),
      Promise.resolve(storageService.getSubmissions()),
    ]);
    const subMap = new Map<string, Submission>();
    idbSubs.forEach((s) => subMap.set(s.id, s));
    storageSubs.forEach((s) => {
      if (!subMap.has(s.id)) subMap.set(s.id, s);
    });
    const cloudSubIds = await fetchIdSet('submissions', 'id');
    const subsToUpload = Array.from(subMap.values()).filter((s) => !cloudSubIds || !cloudSubIds.has(s.id));
    let syncedSubs = 0;

    await runBatches(subsToUpload, async (sub) => {
      try {
        await this.saveSubmission(sub);
        syncedSubs++;
      } catch (e) {
        console.warn('[apiService] Sync submission warn:', e);
      }
    });

    return {
      problemsCount: syncedProblems,
      testCasesCount: syncedTests,
      submissionsCount: syncedSubs,
    };
  },
};
