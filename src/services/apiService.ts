import type { Problem, TestCase, Submission, Classroom, ClassStudent, StudentUser, Topic, TestResult } from '../types/judge';
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

let authTokenGetter: (() => string | null) | null = null;

export function registerAuthTokenGetter(fn: () => string | null): void {
  authTokenGetter = fn;
}

export function getActiveAuthToken(): string {
  if (authTokenGetter) {
    try {
      const token = authTokenGetter();
      if (token && token.trim()) return token.trim();
    } catch {}
  }
  return ENV.SUPABASE_ANON_KEY;
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
   * Tự động đính kèm Supabase Auth JWT của người dùng đã đăng nhập để hỗ trợ Row Level Security (RLS)
   */
  getAntiCacheHeaders(): Record<string, string> {
    const bearerToken = getActiveAuthToken();
    return {
      apikey: ENV.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${bearerToken}`,
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
        // Bảo mật: Lọc ngay từ phía máy chủ Supabase, tuyệt đối không trả các bản ghi __system_ về mạng của người dùng
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?id=not.like.__system_%25&order=created_at.asc`;
        const res = await fetch(targetUrl, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const cloudClasses = data
              .filter(
                (c: any) =>
                  c.id &&
                  !c.id.startsWith('__system_') &&
                  c.id !== 'ALL' &&
                  c.id !== 'class_default_faminh' &&
                  c.join_code !== 'OXYZ' &&
                  c.class_name !== 'Lớp Học FAMINH'
              )
              .map((c: any): Classroom => ({
                id: c.id,
                className: c.class_name || 'Lớp học',
                description: c.description || '',
                teacherId: 'admin',
                joinCode: c.join_code || '',
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
  async ensureClassroom(_classId: string, _className?: string, _joinCode?: string): Promise<void> {
    // Không tự động tạo lớp học mặc định khi lưu bài tập
    return;
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
      const timeoutTimer = setTimeout(() => controller.abort(), 10000);
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?id=eq.__system_students__&select=description`;
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
            email: s.email || (s.username && s.username.includes('@') ? s.username : undefined),
            password: s.password || '',
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
    if (cloudStudents === null) return null;

    // Hợp nhất an toàn: Không làm mất học sinh cục bộ còn đang hoạt động
    const localList = storageService.getStudents();
    const studentMap = new Map<string, StudentUser>();
    cloudStudents.forEach((s) => {
      const k = (s.id || s.username || '').trim().toLowerCase();
      if (k && s.username !== 'leduyducminh@gmail.com') studentMap.set(k, s);
    });
    localList.forEach((s) => {
      const k = (s.id || s.username || '').trim().toLowerCase();
      if (k && !studentMap.has(k) && s.username !== 'leduyducminh@gmail.com') {
        studentMap.set(k, s);
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
    const getKey = (s: StudentUser) => (s.id || s.username || '').trim().toLowerCase();

    // Hợp nhất với danh sách MỚI NHẤT trên Cloud: không bao giờ ghi đè làm mất học sinh do máy khác tạo
    const merged = new Map<string, StudentUser>();
    const cloudLatest = isSupabaseConfigured() ? await this.fetchRawCloudStudents() : [];
    if (cloudLatest === null) {
      // Không đọc được Cloud -> chỉ lưu trên máy, tuyệt đối không ghi đè Cloud bằng danh sách không đầy đủ
      list.forEach((s) => {
        const k = getKey(s);
        if (k && !removeSet.has(s.id) && s.username !== 'leduyducminh@gmail.com') merged.set(k, s);
      });
      storageService.saveStudents(Array.from(merged.values()));
      throw new Error('Không đọc được danh sách học sinh trên Cloud (mạng chậm hoặc mất kết nối)');
    }
    cloudLatest.forEach((s) => {
      const k = getKey(s);
      if (k && !removeSet.has(s.id) && s.username !== 'leduyducminh@gmail.com') merged.set(k, s);
    });
    list.forEach((s) => {
      const k = getKey(s);
      if (k && !removeSet.has(s.id) && s.username !== 'leduyducminh@gmail.com') {
        const prev = merged.get(k);
        const customName = storageService.getStudentCustomName(s.id, s.email || s.username) || storageService.getStudentCustomName(prev?.id, prev?.email || prev?.username);
        const chosenFullName = customName || (s.fullName && s.fullName !== 'Học sinh' ? s.fullName : (prev?.fullName || s.fullName || 'Học sinh'));
        merged.set(k, {
          ...prev,
          ...s,
          fullName: chosenFullName,
          username: s.username || prev?.username || '',
          email: s.email || prev?.email || (s.username?.includes('@') ? s.username : prev?.username?.includes('@') ? prev.username : undefined),
        });
      }
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
        // 1. Thử cập nhật trực tiếp (PATCH) vào bản ghi __system_admin_auth__
        const patchUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?id=eq.__system_admin_auth__`;
        const patchRes = await fetch(patchUrl, {
          method: 'PATCH',
          headers: {
            ...this.getAntiCacheHeaders(),
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            class_name: 'ADMIN_CREDENTIAL',
            description: cleanPass,
            join_code: 'ROOT',
            updated_at: new Date().toISOString(),
          }),
        });

        if (patchRes.ok) {
          const patched = await patchRes.json().catch(() => null);
          if (Array.isArray(patched) && patched.length > 0) {
            storageService.setAdminPassword(cleanPass);
            return true;
          }
        }

        // 2. Nếu chưa có bản ghi (lần đầu tạo), dùng POST upsert on_conflict=id
        const postUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?on_conflict=id`;
        const postRes = await fetch(postUrl, {
          method: 'POST',
          headers: {
            ...this.getAntiCacheHeaders(),
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify({
            id: '__system_admin_auth__',
            class_name: 'ADMIN_CREDENTIAL',
            description: cleanPass,
            join_code: 'ROOT',
            updated_at: new Date().toISOString(),
          }),
        });

        if (postRes.ok) {
          storageService.setAdminPassword(cleanPass);
          return true;
        }
        return false;
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

    const hasRealContent = (tests?: TestCase[] | null) =>
      Boolean(tests && tests.length > 0 && tests.some((t) => (t.input && t.input.trim().length > 0) || (t.expectedOutput && t.expectedOutput.trim().length > 0)));

    // BẢO VỆ CHỐNG GHI ĐÈ: Không bao giờ lưu bộ test case rỗng vào Cloud hoặc IndexedDB
    if (!hasRealContent(testCases)) {
      console.warn('[apiService.saveTestCases] Bỏ qua vì test cases không có nội dung thực tế:', problemId);
      return;
    }

    // Chuẩn hóa danh sách test case và ID xác định theo bài toán
    const standardizedTests: TestCase[] = testCases.map((tc, index) => ({
      ...tc,
      id: `${problemId}_tc_${index + 1}`,
      name: tc.name || `Test #${String(index + 1).padStart(2, '0')}`,
      points: Number(tc.points) || 1,
      isHidden: Boolean(tc.isHidden),
    }));

    // 1. Luôn lưu vào IndexedDB cục bộ của trình duyệt trước để không bao giờ mất trên client
    await idbService.saveTestCases(problemId, standardizedTests);

    // 2. Nếu đã cấu hình Supabase Cloud, đồng bộ lên bảng test_cases
    if (isSupabaseConfigured()) {
      try {
        // Thử xóa test case cũ của bài tập này trên cloud (nếu có quyền DELETE)
        try {
          await fetch(`${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/test_cases?problem_id=eq.${encodeURIComponent(problemId)}`, {
            method: 'DELETE',
            headers: this.getAntiCacheHeaders(),
          });
        } catch (delErr) {
          console.warn('[apiService] DELETE test_cases warn:', delErr);
        }

        if (standardizedTests.length > 0) {
          // Luôn Upsert với on_conflict=id và Prefer: resolution=merge-duplicates để đảm bảo thành công 100%
          const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/test_cases?on_conflict=id`;
          const rows = standardizedTests.map((tc, index) => ({
            id: tc.id,
            problem_id: problemId,
            test_name: tc.name,
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
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/test_cases?problem_id=eq.${encodeURIComponent(problemId)}&order=order_index.asc,updated_at.desc`;
        const res = await fetch(targetUrl, {
          headers: {
            ...this.getAntiCacheHeaders(),
            apikey: ENV.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
          },
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Loại bỏ trùng lặp nếu trong database có nhiều hàng cùng order_index (do lỗi merge trước đây)
            const seenOrders = new Set<number>();
            const uniqueRows: any[] = [];
            for (const d of data) {
              const ord = Number(d.order_index) || 0;
              if (ord > 0 && seenOrders.has(ord)) continue;
              if (ord > 0) seenOrders.add(ord);
              uniqueRows.push(d);
            }

            const mapped: TestCase[] = uniqueRows.map((d: any, idx) => ({
              id: d.id || `${problemId}_tc_${idx + 1}`,
              name: d.test_name || `Test #${String(idx + 1).padStart(2, '0')}`,
              input: d.input || '',
              expectedOutput: d.expected_output || '',
              points: Number(d.points) || 1,
              isHidden: Boolean(d.is_hidden),
            }));

            const hasReal = mapped.some((t) => (t.input && t.input.trim().length > 0) || (t.expectedOutput && t.expectedOutput.trim().length > 0));
            if (hasReal) {
              await idbService.saveTestCases(problemId, mapped);
              return mapped;
            }
          }
        }
      } catch (err) {
        console.warn('[apiService] Không thể fetch test cases từ Supabase Cloud, dùng IndexedDB:', err);
      }
    }

    const localTests = await idbService.getTestCases(problemId);
    return localTests;
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
          class_id: submission.classId || null,
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
   * Cập nhật họ tên hiển thị trong các bài nộp của học sinh trên Supabase Cloud
   * Đảm bảo khi học sinh đổi tên, toàn bộ bài nộp trên Cloud được cập nhật tên mới
   */
  async updateSubmissionsUserName(
    studentId: string,
    studentUsername?: string,
    studentEmail?: string,
    newName?: string
  ): Promise<void> {
    const cleanName = (newName || '').trim();
    if (!cleanName || !isSupabaseConfigured()) return;
    try {
      const headers = {
        ...this.getAntiCacheHeaders(),
        'Content-Type': 'application/json',
      };
      const body = JSON.stringify({ user_name: cleanName });

      const targets = new Set<string>();
      if (studentId) targets.add(studentId);
      if (studentUsername) targets.add(studentUsername);
      if (studentEmail) targets.add(studentEmail);

      await Promise.all(
        Array.from(targets).map((uid) =>
          fetch(
            `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/submissions?user_id=eq.${encodeURIComponent(uid)}`,
            {
              method: 'PATCH',
              headers,
              body,
            }
          ).catch(() => {})
        )
      );
    } catch (err) {
      console.warn('[apiService] Lỗi cập nhật tên bài nộp trên Cloud:', err);
    }
  },

  /**
   * Lấy lịch sử nộp bài (Toàn bộ hoặc theo học sinh) từ Database thực tế
   * Tối ưu hiệu năng: Tải các trường thông tin cần thiết, bỏ trường test_results khổng lồ (giảm từ 7.5MB xuống 12KB)
   */
  async fetchSubmissions(): Promise<Submission[]> {
    let cloudSubmissions: Submission[] = [];
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/submissions?select=id,problem_id,problem_code,problem_title,user_id,user_name,class_id,language,status,verdict,total_points_earned,max_total_points,passed_count,total_tests,execution_time,memory,compilation_message,submitted_at,source_code,test_results&order=submitted_at.desc&limit=60`;
        const res = await fetch(targetUrl, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            // Lấy trước thông tin học sinh hiện tại và danh sách tên tùy chỉnh để đồng bộ tên mới nhất
            let activeStudentName: string | null = null;
            let activeStudentId: string | null = null;
            let activeStudentUsername: string | null = null;
            let activeStudentEmail: string | null = null;
            try {
              const session = storageService.getStudentSession();
              if (session) {
                activeStudentId = session.id;
                activeStudentUsername = session.username || null;
                activeStudentEmail = session.email || null;
                const custom = storageService.getStudentCustomName(session.id, session.email);
                activeStudentName = custom || session.fullName;
              }
            } catch {}

            cloudSubmissions = list.map((item: any): Submission => {
              let parsedTestResults: TestResult[] = [];
              if (Array.isArray(item.test_results)) {
                parsedTestResults = item.test_results;
              } else if (typeof item.test_results === 'string' && item.test_results.trim()) {
                try {
                  const p = JSON.parse(item.test_results);
                  if (Array.isArray(p)) parsedTestResults = p;
                } catch {}
              }

              // Luôn bảo toàn tên mới nhất của học sinh nếu bài nộp thuộc về học sinh hiện tại
              let resolvedUserName = item.user_name;
              if (
                activeStudentName &&
                (item.user_id === activeStudentId ||
                  (activeStudentUsername && item.user_id === activeStudentUsername) ||
                  (activeStudentEmail && item.user_id === activeStudentEmail))
              ) {
                resolvedUserName = activeStudentName;
              }

              return {
                id: item.id,
                problemId: item.problem_id,
                problemCode: item.problem_code,
                problemTitle: item.problem_title || item.problem_code || '',
                userId: item.user_id,
                userName: resolvedUserName || item.user_name,
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
                testResults: parsedTestResults,
              };
            });
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
        const existingLocalSubs = await idbService.getAllSubmissions().catch(() => []);
        const localSubMap = new Map(existingLocalSubs.map((s) => [s.id, s]));

        const enrichedSubmissions = cloudSubmissions.map((cs) => {
          if (cs.testResults && cs.testResults.length > 0) return cs;
          const localMatch = localSubMap.get(cs.id);
          if (localMatch?.testResults && localMatch.testResults.length > 0) {
            return { ...cs, testResults: localMatch.testResults };
          }
          return cs;
        });

        await idbService.clearSubmissions();
        if (enrichedSubmissions.length > 0) {
          await idbService.saveSubmissions(enrichedSubmissions);
        }
        storageService.saveSubmissions(enrichedSubmissions);
        return enrichedSubmissions;
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
   * Lấy chi tiết một bài nộp (bao gồm đầy đủ test_results) khi người dùng mở xem chi tiết
   */
  async fetchSubmissionById(id: string): Promise<Submission | null> {
    if (!id) return null;
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/submissions?id=eq.${encodeURIComponent(id)}&limit=1`;
        const res = await fetch(targetUrl, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const item = list[0];
            let parsedTestResults: TestResult[] = [];
            if (Array.isArray(item.test_results)) {
              parsedTestResults = item.test_results;
            } else if (typeof item.test_results === 'string' && item.test_results.trim()) {
              try {
                const p = JSON.parse(item.test_results);
                if (Array.isArray(p)) parsedTestResults = p;
              } catch {}
            }
            return {
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
              testResults: parsedTestResults,
            };
          }
        }
      } catch (err) {
        console.warn('[apiService] Lỗi fetchSubmissionById:', err);
      }
    }
    return idbService.getSubmissionById(id);
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
        const isNone = problem.classId === 'NONE' || !problem.classId || problem.classId === 'ALL' || problem.classId === 'class_default_faminh';
        const targetClassId = isNone ? null : problem.classId;

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
          if (res.status === 409 || errDetail.includes('problems_code_key') || errDetail.includes('23505')) {
            throw new Error(`Mã bài tập "${problem.code}" đã tồn tại trên hệ thống. Vui lòng chọn mã khác.`);
          }
          throw new Error(`Lỗi Supabase (${res.status}): ${errDetail.slice(0, 150)}`);
        }
      } catch (err: unknown) {
        console.error('[apiService] Lỗi lưu bài tập lên Supabase Cloud:', err);
        throw new Error(
          (err as Error)?.message || 'Không thể lưu bài tập vào Database đám mây'
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

            // Tải siêu nhẹ metadata test cases từ Supabase Cloud để gộp số lượng test vào cloudProblems (giảm từ 2.9MB xuống 4.5KB)
            const cloudTcMap = new Map<string, TestCase[]>();
            try {
              const tcUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/test_cases?select=id,problem_id,test_name,points,is_hidden,order_index&order=order_index.asc,updated_at.desc`;
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
                  // Deduplicate: Mỗi problem_id chỉ lấy 1 hàng cho mỗi order_index
                  const seenOrdersByPid = new Map<string, Set<number>>();
                  for (const row of allTcRows) {
                    const pid = row.problem_id;
                    if (!seenOrdersByPid.has(pid)) seenOrdersByPid.set(pid, new Set());
                    const orderSet = seenOrdersByPid.get(pid)!;
                    const ord = Number(row.order_index) || 0;
                    if (ord > 0 && orderSet.has(ord)) continue;
                    if (ord > 0) orderSet.add(ord);

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

            const hasContent = (tests?: TestCase[]) =>
              Boolean(tests && tests.length > 0 && tests.some((t) => (t.input && t.input.trim()) || (t.expectedOutput && t.expectedOutput.trim())));

            for (const cp of cloudProblems) {
              const fromCloud = cloudTcMap.get(cp.id);
              const fromIdb = idbMap.get(cp.id)?.testCases;
              const fromStorage = storageMap.get(cp.id)?.testCases;

              // Ưu tiên giữ lại bộ test case có dữ liệu nội dung thật (input/output) từ local IndexedDB hoặc Storage
              let tests: TestCase[] = [];
              if (hasContent(fromIdb)) {
                tests = fromIdb!;
              } else if (hasContent(fromStorage)) {
                tests = fromStorage!;
              } else if (fromCloud && fromCloud.length > 0) {
                tests = fromCloud;
              } else if (fromIdb && fromIdb.length > 0) {
                tests = fromIdb;
              } else if (fromStorage && fromStorage.length > 0) {
                tests = fromStorage;
              }

              cp.testCases = tests;

              // CHỈ LƯU VÀO IndexedDB KHI TESTS THỰC SỰ CÓ DỮ LIỆU INPUT HOẶC OUTPUT!
              // TUYỆT ĐỐI KHÔNG GHI ĐÈ BỘ TEST CASE RỖNG CỦA METADATA LÊN IndexedDB!
              if (hasContent(tests)) {
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

    // 0. Luôn kéo mật mã Admin mới nhất từ Cloud Database về máy này (Cloud là Single Source of Truth)
    await this.getAdminPasswordFromDatabase().catch(() => {});

    const cloudClasses = await this.fetchClassrooms();
    if (cloudClasses.length === 0) {
      const localClasses = storageService.getClasses();
      for (const cls of localClasses) {
        if (cls.id !== 'class_default_faminh' && cls.className !== 'Lớp Học FAMINH' && cls.joinCode !== 'OXYZ') {
          await this.saveClassroom(cls);
        }
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
