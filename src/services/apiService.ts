import type { Problem, TestCase, Submission, Classroom, ClassStudent, StudentUser, Topic, TestResult, AccountRole } from '../types/judge';
import { normalizeOwnerEmail } from '../types/judge';
import { idbService } from './db';
import { storageService, DEFAULT_ADMIN_PASSWORD, type ResourceOwnersMap } from './storageService';

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
    ''
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

// ============================================================================
// "Bia mộ" (tombstone) cho bài tập đã xóa.
// Ngăn bài tập vừa xóa sống lại do: (1) một lượt làm mới đang chạy dở trả về
// danh sách cũ, (2) dữ liệu cũ còn sót trong IndexedDB/localStorage của máy khác.
// ============================================================================
const PROBLEM_TOMBSTONE_KEY = 'faminh_deleted_problems_v1';
const PROBLEM_TOMBSTONE_TTL_MS = 30 * 60 * 1000;

function readProblemTombstones(): Record<string, number> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(PROBLEM_TOMBSTONE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const now = Date.now();
    const out: Record<string, number> = {};
    for (const [id, ts] of Object.entries(parsed || {})) {
      if (typeof ts === 'number' && now - ts < PROBLEM_TOMBSTONE_TTL_MS) out[id] = ts;
    }
    return out;
  } catch {
    return {};
  }
}

function writeProblemTombstones(map: Record<string, number>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PROBLEM_TOMBSTONE_KEY, JSON.stringify(map));
    }
  } catch {
    // bỏ qua lỗi quota
  }
}

function markProblemDeleted(id: string): void {
  const map = readProblemTombstones();
  map[id] = Date.now();
  writeProblemTombstones(map);
}

function clearProblemTombstones(ids: string[]): void {
  if (ids.length === 0) return;
  const map = readProblemTombstones();
  let changed = false;
  for (const id of ids) {
    if (id in map) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) writeProblemTombstones(map);
}

/** File đính kèm chỉ có tên/kích thước (nội dung được tải riêng khi cần, tránh tải hàng MB mỗi lần làm mới). */
export function isAttachmentStub(f?: Problem['attachedFile']): boolean {
  return Boolean(f && !f.dataUrl && !f.rawHtml);
}

const attachmentCache = new Map<string, { at: number; value: Problem['attachedFile'] }>();
const ATTACHMENT_CACHE_TTL_MS = 60 * 1000;

// Gộp các lượt gọi fetchResourceOwners (lớp học, chủ đề, bài tập đều gọi) thành 1 request.
let ownersCache: { at: number; value: ResourceOwnersMap } | null = null;
let ownersInflight: Promise<ResourceOwnersMap> | null = null;
const OWNERS_CACHE_TTL_MS = 4000;

// Bộ nhớ đệm bài nộp để các lượt làm mới định kỳ chỉ tải phần mới.
let submissionsCache: Map<string, Submission> | null = null;
let submissionsFullFetchAt = 0;
const SUBMISSIONS_FULL_REFRESH_MS = 5 * 60 * 1000;

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
   * Lấy bản đồ chủ sở hữu tài nguyên (Lớp học, Chủ đề, Bài tập của từng Giáo viên) từ Supabase Cloud
   */
  async fetchResourceOwners(): Promise<ResourceOwnersMap> {
    if (ownersCache && Date.now() - ownersCache.at < OWNERS_CACHE_TTL_MS) {
      return ownersCache.value;
    }
    if (ownersInflight) return ownersInflight;
    ownersInflight = this.fetchResourceOwnersUncached()
      .then((value) => {
        ownersCache = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        ownersInflight = null;
      });
    return ownersInflight;
  },

  async fetchResourceOwnersUncached(): Promise<ResourceOwnersMap> {
    const localOwners = storageService.getResourceOwners();
    if (isSupabaseConfigured()) {
      try {
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?id=eq.__system_resource_owners__&select=description`;
        const res = await fetch(targetUrl, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0 && rows[0].description) {
            const parsed = JSON.parse(rows[0].description);
            if (parsed && typeof parsed === 'object') {
              const merged: ResourceOwnersMap = {
                classes: { ...localOwners.classes, ...(parsed.classes || {}) },
                topics: { ...localOwners.topics, ...(parsed.topics || {}) },
                problems: { ...localOwners.problems, ...(parsed.problems || {}) },
              };
              storageService.saveResourceOwners(merged);
              return merged;
            }
          }
        }
      } catch (e) {
        console.warn('[apiService] fetchResourceOwners warn:', e);
      }
    }
    return localOwners;
  },

  /**
   * Lưu bản đồ chủ sở hữu tài nguyên (Lớp học, Chủ đề, Bài tập) lên Supabase Cloud
   */
  async saveResourceOwners(owners: ResourceOwnersMap): Promise<void> {
    ownersCache = null;
    storageService.saveResourceOwners(owners);
    if (!isSupabaseConfigured()) return;
    try {
      const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?on_conflict=id`;
      await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...this.getAntiCacheHeaders(),
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: '__system_resource_owners__',
          class_name: 'RESOURCE_OWNERS',
          description: JSON.stringify(owners),
          join_code: 'OWN',
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.warn('[apiService] saveResourceOwners warn:', e);
    }
  },

  /**
   * Lấy danh sách phân quyền người dùng (admin | teacher | student) kết hợp từ bảng `profiles` và `__system_user_roles__`
   */
  async fetchUserRolesMap(): Promise<Record<string, AccountRole>> {
    const localMap = storageService.getUserRolesMap();
    if (!isSupabaseConfigured()) return localMap;

    const normalizeRole = (raw?: string | null): AccountRole => {
      const clean = String(raw || '').trim().toLowerCase();
      if (clean === 'admin' || clean === 'super_admin' || clean === 'superadmin') return 'admin';
      if (clean === 'teacher' || clean === 'giao_vien' || clean === 'giaovien') return 'teacher';
      return 'student';
    };

    try {
      const baseUrl = ENV.SUPABASE_URL.replace(/\/+$/, '');
      const [profilesRes, sysRolesRes] = await Promise.all([
        fetch(`${baseUrl}/rest/v1/profiles?select=id,email,role`, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
        }).catch(() => null),
        fetch(`${baseUrl}/rest/v1/classrooms?id=eq.__system_user_roles__&select=description`, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
        }).catch(() => null),
      ]);

      const merged: Record<string, AccountRole> = { ...localMap };

      if (sysRolesRes && sysRolesRes.ok) {
        const rows = await sysRolesRes.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0].description) {
          try {
            const parsed = JSON.parse(rows[0].description);
            if (parsed && typeof parsed === 'object') {
              Object.entries(parsed).forEach(([k, v]) => {
                if (k) merged[k.trim().toLowerCase()] = normalizeRole(String(v));
              });
            }
          } catch {}
        }
      }

      if (profilesRes && profilesRes.ok) {
        const profiles = await profilesRes.json();
        if (Array.isArray(profiles)) {
          const hasAdminInProfiles = profiles.some((p: any) => normalizeRole(p.role) === 'admin');
          profiles.forEach((p: any) => {
            const email = (p.email || '').trim().toLowerCase();
            if (email) {
              merged[email] = normalizeRole(p.role);
            }
          });
          // Nếu trong bảng profiles chưa có admin nào (hoặc lỡ bị xóa hết admin), luôn bảo vệ ít nhất 1 admin tối cao
          if (!hasAdminInProfiles && !Object.values(merged).some((r) => r === 'admin')) {
            merged['minh.ldd2610979@sis.hust.edu.vn'] = 'admin';
          }
        }
      }

      if (!Object.values(merged).some((r) => r === 'admin')) {
        merged['minh.ldd2610979@sis.hust.edu.vn'] = 'admin';
      }

      storageService.saveUserRolesMap(merged);
      return merged;
    } catch (e) {
      console.warn('[apiService] fetchUserRolesMap warn:', e);
      return localMap;
    }
  },

  /**
   * Cập nhật vai trò của một người dùng (Giáo viên <-> Học sinh) trên cả bảng `profiles`, `__system_user_roles__` và `__system_students__`
   * Lưu ý: Quyền 'admin' tối cao được bảo vệ và chỉ có thể chỉnh sửa trực tiếp trong Supabase Dashboard.
   */
  async updateUserRoleOnCloud(userId: string, email: string, newRole: 'teacher' | 'student'): Promise<void> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const rolesMap = await this.fetchUserRolesMap();

    // Không cho phép hạ quyền Admin tối cao từ giao diện web
    if (cleanEmail && rolesMap[cleanEmail] === 'admin') {
      throw new Error('Tài khoản Admin tối cao được bảo vệ. Muốn thay đổi quyền Admin, vui lòng thực hiện trực tiếp trong Supabase.');
    }

    if (cleanEmail) {
      rolesMap[cleanEmail] = newRole;
    }
    storageService.saveUserRolesMap(rolesMap);

    // Cập nhật ngay trong danh sách students local
    const localStudents = storageService.getStudents().map((s) => {
      const sEmail = (s.email || s.username || '').trim().toLowerCase();
      if ((userId && s.id === userId) || (cleanEmail && sEmail === cleanEmail)) {
        return { ...s, role: newRole };
      }
      return s;
    });
    storageService.saveStudents(localStudents);

    if (!isSupabaseConfigured()) return;

    const baseUrl = ENV.SUPABASE_URL.replace(/\/+$/, '');
    const calls: Promise<any>[] = [];

    // 1. Cập nhật bảng `public.profiles` trên Supabase
    if (userId && !userId.startsWith('student_')) {
      calls.push(
        fetch(`${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers: {
            ...this.getAntiCacheHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: newRole, updated_at: new Date().toISOString() }),
        })
      );
    }
    if (cleanEmail) {
      calls.push(
        fetch(`${baseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(cleanEmail)}`, {
          method: 'PATCH',
          headers: {
            ...this.getAntiCacheHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: newRole, updated_at: new Date().toISOString() }),
        })
      );
    }

    // 2. Cập nhật bảng `__system_user_roles__`
    calls.push(
      fetch(`${baseUrl}/rest/v1/classrooms?on_conflict=id`, {
        method: 'POST',
        headers: {
          ...this.getAntiCacheHeaders(),
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: '__system_user_roles__',
          class_name: 'USER_ROLES',
          description: JSON.stringify(rolesMap),
          join_code: 'ROLE',
          updated_at: new Date().toISOString(),
        }),
      })
    );

    await Promise.allSettled(calls);

    // 3. Đồng bộ lại vào `__system_students__`
    try {
      await this.saveStudents(localStudents);
    } catch {}
  },

  /**
   * Lấy danh sách Lớp học (Classrooms) từ Database đám mây (Anti-cache real-time)
   */
  async fetchClassrooms(): Promise<Classroom[]> {
    if (isSupabaseConfigured()) {
      try {
        // Tải song song bản đồ chủ sở hữu và danh sách lớp (trước đây chạy nối đuôi nhau)
        // Bảo mật: Lọc ngay từ phía máy chủ Supabase, tuyệt đối không trả các bản ghi __system_ về mạng của người dùng
        const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?id=not.like.__system_%25&order=created_at.asc`;
        const [owners, res] = await Promise.all([
          this.fetchResourceOwners(),
          fetch(targetUrl, {
            headers: this.getAntiCacheHeaders(),
            cache: 'no-store',
          }),
        ]);
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
                teacherId: normalizeOwnerEmail(owners.classes[c.id] || c.teacher_id),
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
    if (cls.teacherId) {
      const owners = storageService.getResourceOwners();
      owners.classes[cls.id] = normalizeOwnerEmail(cls.teacherId);
      await this.saveResourceOwners(owners);
    }
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
  async fetchRawCloudClassStudents(): Promise<ClassStudent[] | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/classrooms?id=eq.__system_class_students__&select=description`;
      const res = await fetch(targetUrl, {
        headers: this.getAntiCacheHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].description) {
        const parsed = JSON.parse(rows[0].description);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch (e) {
      console.warn('[apiService] fetchRawCloudClassStudents warn:', e);
      return null;
    }
  },

  async saveClassStudents(list: ClassStudent[], options?: { replace?: boolean }): Promise<void> {
    let finalList = Array.isArray(list) ? [...list] : [];

    if (isSupabaseConfigured() && !options?.replace) {
      const cloudList = await this.fetchRawCloudClassStudents();
      if (cloudList && cloudList.length > 0) {
        const merged: ClassStudent[] = [...cloudList];
        const isSameRelation = (a: ClassStudent, b: ClassStudent) => {
          if (a.classId !== b.classId) return false;
          const aId = (a.studentId || '').trim().toLowerCase();
          const bId = (b.studentId || '').trim().toLowerCase();
          const aEmail = (a.studentEmail || (a.studentUsername?.includes('@') ? a.studentUsername : '')).trim().toLowerCase();
          const bEmail = (b.studentEmail || (b.studentUsername?.includes('@') ? b.studentUsername : '')).trim().toLowerCase();
          const aUser = (a.studentUsername || '').trim().toLowerCase();
          const bUser = (b.studentUsername || '').trim().toLowerCase();
          if (aId && bId && aId === bId) return true;
          if (aEmail && bEmail && aEmail === bEmail) return true;
          if (aUser && bUser && aUser === bUser) return true;
          if (aId && bEmail && aId === bEmail) return true;
          if (bId && aEmail && bId === aEmail) return true;
          return false;
        };

        for (const item of finalList) {
          const idx = merged.findIndex((m) => isSameRelation(m, item));
          if (idx >= 0) {
            const existing = merged[idx];
            merged[idx] = {
              ...existing,
              ...item,
              studentName:
                item.studentName && item.studentName !== 'Học sinh'
                  ? item.studentName
                  : existing.studentName || item.studentName,
              status:
                item.status === 'approved' || existing.status === 'approved'
                  ? 'approved'
                  : item.status || existing.status || 'approved',
            };
          } else {
            merged.push(item);
          }
        }
        finalList = merged;
      }
    }

    storageService.saveClassStudents(finalList);
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
          description: JSON.stringify(finalList),
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

  async _legacySaveClassStudents_unused(list: ClassStudent[]): Promise<void> {
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
        const baseUrl = ENV.SUPABASE_URL.replace(/\/+$/, '');
        const [res, profilesRes, rolesMap] = await Promise.all([
          fetch(`${baseUrl}/rest/v1/classrooms?id=eq.__system_students__&select=description`, {
            headers: this.getAntiCacheHeaders(),
            cache: 'no-store',
            signal: controller.signal,
          }),
          fetch(`${baseUrl}/rest/v1/profiles?select=id,email,full_name,role,created_at`, {
            headers: this.getAntiCacheHeaders(),
            cache: 'no-store',
          }).catch(() => null),
          this.fetchUserRolesMap(),
        ]);
        clearTimeout(timeoutTimer);
        if (!res.ok) {
          console.warn(`[apiService] fetchRawCloudStudents HTTP ${res.status}`);
          continue;
        }
        const rows = await res.json();
        let parsed: any[] = [];
        if (Array.isArray(rows) && rows.length > 0 && rows[0].description) {
          try {
            const p = JSON.parse(rows[0].description);
            if (Array.isArray(p)) parsed = p;
          } catch {
            return null;
          }
        }

        const parsedMap = new Map<string, any>();
        if (Array.isArray(parsed)) {
          parsed
            .filter((s: any) => {
              if (!s || !s.username) return false;
              return Boolean(
                (s.email && s.email.includes('@')) ||
                (s.username && s.username.includes('@'))
              );
            })
            .forEach((s: any) => {
              const email = (s.email || (s.username && s.username.includes('@') ? s.username : '')).trim().toLowerCase();
              if (email) parsedMap.set(email, s);
            });
        }

        const userMap = new Map<string, StudentUser>();

        if (profilesRes && profilesRes.ok) {
          const profileRows = await profilesRes.json();
          if (Array.isArray(profileRows)) {
            // Nguồn chân lý tối cao: Chỉ những tài khoản đã có trong bảng profiles (đã xác thực) mới được đưa vào hệ thống
            profileRows.forEach((p: any) => {
              const email = (p.email || '').trim().toLowerCase();
              if (!email || !email.includes('@')) return;
              const prev = parsedMap.get(email);
              userMap.set(email, {
                id: p.id || prev?.id || `student_${Date.now()}`,
                fullName:
                  (prev?.fullName && prev.fullName.trim() && prev.fullName !== 'Học sinh' ? prev.fullName.trim() : null) || (p.full_name && p.full_name.trim() && p.full_name !== 'Học sinh' ? p.full_name.trim() : null) ||
                  (prev?.fullName && prev.fullName.trim() && prev.fullName !== 'Học sinh' ? prev.fullName.trim() : null) ||
                  p.full_name ||
                  email.split('@')[0],
                username: email,
                email,
                password: prev?.password || '',
                role: p.role ? ((p.role === 'admin' || p.role === 'teacher') ? p.role : 'student') : (rolesMap[email] || prev?.role || 'student'),
                createdAt: prev?.createdAt || p.created_at || new Date().toISOString(),
              });
            });
          }
        } else {
          // Dự phòng khi bảng profiles không truy cập được (mạng offline hoặc lỗi kết nối): dùng __system_students__
          parsedMap.forEach((s: any, email: string) => {
            userMap.set(email, {
              id: s.id || `student_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              fullName: s.fullName || s.username || 'Học sinh',
              username: email,
              email,
              password: s.password || '',
              role: rolesMap[email] || s.role || 'student',
              createdAt: s.createdAt || new Date().toISOString(),
            });
          });
        }

        return Array.from(userMap.values());
      } catch (e) {
        clearTimeout(timeoutTimer);
        console.warn('[apiService] fetchRawCloudStudents error/timeout:', e);
      }
    }
    return null;
  },

  /**
   * Lấy danh sách Học sinh / Người dùng trực tiếp từ Supabase Cloud (trả về null nếu không kết nối được hoặc lỗi)
   */
  async fetchStudentsFromCloud(): Promise<StudentUser[] | null> {
    const cloudStudents = await this.fetchRawCloudStudents();
    if (cloudStudents === null) return null;

    const rolesMap = storageService.getUserRolesMap();
    const studentMap = new Map<string, StudentUser>();

    const getEmailKey = (s: StudentUser) => {
      const e = (s.email || '').trim().toLowerCase();
      if (e && e.includes('@')) return e;
      const u = (s.username || '').trim().toLowerCase();
      if (u && u.includes('@')) return u;
      return (s.id || '').trim().toLowerCase();
    };

    const upsertStudent = (s: StudentUser) => {
      const k = getEmailKey(s);
      if (!k) return;
      const resolvedRole = rolesMap[k] || s.role || 'student';
      const existing = studentMap.get(k);
      if (!existing) {
        studentMap.set(k, { ...s, role: resolvedRole });
      } else {
        // Ưu tiên tài khoản Supabase Auth (UUID) hơn ID mock "student_..." cũ
        const isExistingUUID = existing.id && !existing.id.startsWith('student_');
        const isNewUUID = s.id && !s.id.startsWith('student_');
        if (isNewUUID && !isExistingUUID) {
          studentMap.set(k, { ...s, role: resolvedRole });
        } else if (new Date(s.createdAt || 0).getTime() >= new Date(existing.createdAt || 0).getTime()) {
          studentMap.set(k, { ...existing, ...s, role: resolvedRole });
        }
      }
    };

    cloudStudents.forEach((s) => {
      const hasEmail = Boolean((s.email && s.email.includes('@')) || (s.username && s.username.includes('@')));
      if (hasEmail) upsertStudent(s);
    });
    // Chỉ giữ thêm phiên đăng nhập hiện tại nếu đang làm việc offline mà chưa kịp sync
    const curSession = storageService.getStudentSession();
    if (curSession && curSession.email) {
      const k = getEmailKey(curSession);
      if (k && !studentMap.has(k)) {
        upsertStudent(curSession);
      }
    }
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
   * Lưu danh sách Học sinh / Người dùng lên Supabase Cloud
   */
  async saveStudents(list: StudentUser[], removeIds: string[] = []): Promise<StudentUser[]> {
    const rolesMap = storageService.getUserRolesMap();
    const removeSet = new Set(removeIds.map((id) => (id || '').trim().toLowerCase()));
    const isToRemove = (s: StudentUser) => {
      const sId = (s.id || '').trim().toLowerCase();
      const sUser = (s.username || '').trim().toLowerCase();
      const sEmail = (s.email || '').trim().toLowerCase();
      if (sId && removeSet.has(sId)) return true;
      if (sUser && removeSet.has(sUser)) return true;
      if (sEmail && removeSet.has(sEmail)) return true;
      return false;
    };
    const getKey = (s: StudentUser) => {
      const e = (s.email || '').trim().toLowerCase();
      if (e && e.includes('@')) return e;
      const u = (s.username || '').trim().toLowerCase();
      if (u && u.includes('@')) return u;
      return (s.id || '').trim().toLowerCase();
    };

    // Hợp nhất với danh sách MỚI NHẤT trên Cloud: không bao giờ ghi đè làm mất học sinh do máy khác tạo
    const merged = new Map<string, StudentUser>();
    const cloudLatest = isSupabaseConfigured() ? await this.fetchRawCloudStudents() : [];
    if (cloudLatest === null) {
      // Không đọc được Cloud -> chỉ lưu trên máy, tuyệt đối không ghi đè Cloud bằng danh sách không đầy đủ
      list.forEach((s) => {
        const k = getKey(s);
        if (k && !isToRemove(s)) merged.set(k, { ...s, role: rolesMap[k] || s.role || 'student' });
      });
      storageService.saveStudents(Array.from(merged.values()));
      throw new Error('Không đọc được danh sách học sinh trên Cloud (mạng chậm hoặc mất kết nối)');
    }
    cloudLatest.forEach((s) => {
      const k = getKey(s);
      if (k && !isToRemove(s)) {
        const existing = merged.get(k);
        const resolvedRole = rolesMap[k] || s.role || 'student';
        if (!existing) {
          merged.set(k, { ...s, role: resolvedRole });
        } else {
          const isExistingUUID = existing.id && !existing.id.startsWith('student_');
          const isNewUUID = s.id && !s.id.startsWith('student_');
          if (isNewUUID && !isExistingUUID) {
            merged.set(k, { ...s, role: resolvedRole });
          }
        }
      }
    });
    list.forEach((s) => {
      const k = getKey(s);
      if (k && !isToRemove(s)) {
        const prev = merged.get(k);
        const customName = storageService.getStudentCustomName(s.id, s.email || s.username) || storageService.getStudentCustomName(prev?.id, prev?.email || prev?.username);
        const chosenFullName =
          (s.fullName && s.fullName.trim() && s.fullName !== 'Học sinh')
            ? s.fullName.trim()
            : ((customName && customName !== 'Học sinh') ? customName : (prev?.fullName || s.fullName || 'Học sinh'));
        const resolvedRole = rolesMap[k] || s.role || prev?.role || 'student';
        merged.set(k, {
          ...prev,
          ...s,
          fullName: chosenFullName,
          username: s.username || prev?.username || '',
          email: s.email || prev?.email || (s.username?.includes('@') ? s.username : prev?.username?.includes('@') ? prev.username : undefined),
          role: resolvedRole,
        });
      }
    });
    const finalList = Array.from(merged.values()).filter((s) => {
      return Boolean((s.email && s.email.includes('@')) || (s.username && s.username.includes('@')));
    });

    storageService.saveStudents(finalList);
    if (!isSupabaseConfigured()) return finalList;

    // Không bao giờ ghi danh sách rỗng đè lên Cloud trừ khi đang xóa chủ ý
    if (finalList.length === 0 && removeIds.length === 0) return finalList;

    try {
      const baseUrl = ENV.SUPABASE_URL.replace(/\/+$/, '');
      const authHeaders = this.getAntiCacheHeaders();

      // Nếu có danh sách cần xóa, đồng bộ xóa cả trên bảng public.profiles
      if (removeIds.length > 0) {
        for (const remId of removeIds) {
          const clean = remId.trim().toLowerCase();
          if (clean.includes('@')) {
            fetch(`${baseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(clean)}`, {
              method: 'DELETE',
              headers: authHeaders,
            }).catch(() => {});
          } else if (clean.includes('-')) {
            fetch(`${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(clean)}`, {
              method: 'DELETE',
              headers: authHeaders,
            }).catch(() => {});
          }
        }
      }

      const targetUrl = `${baseUrl}/rest/v1/classrooms?on_conflict=id`;
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
  async deleteSubmissionsForStudent(studentId: string, username?: string, fullName?: string, email?: string): Promise<void> {
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
        if (email && email !== username && email !== studentId) {
          deleteCalls.push(
            fetch(`${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/submissions?user_id=eq.${encodeURIComponent(email)}`, {
              method: 'DELETE',
              headers: this.getAntiCacheHeaders(),
            })
          );
        }
        // KHÔNG xóa theo user_name: nhiều học sinh có thể trùng họ tên, xóa theo tên sẽ làm mất bài của học sinh khác
        void fullName;
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
        const [owners, res] = await Promise.all([
          this.fetchResourceOwners(),
          fetch(targetUrl, {
            headers: this.getAntiCacheHeaders(),
            cache: 'no-store',
          }),
        ]);
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0 && rows[0].description) {
            const parsed = JSON.parse(rows[0].description);
            if (Array.isArray(parsed)) {
              const normalized = parsed.map((t: any): Topic => ({
                ...t,
                teacherId: normalizeOwnerEmail(t.teacherId || owners.topics[t.id]),
              }));
              storageService.saveTopics(normalized);
              return normalized;
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
    const owners = storageService.getResourceOwners();
    const normalized = list.map((t) => {
      const owner = normalizeOwnerEmail(t.teacherId || owners.topics[t.id]);
      owners.topics[t.id] = owner;
      return { ...t, teacherId: owner };
    });
    storageService.saveTopics(normalized);
    this.saveResourceOwners(owners).catch(() => {});
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
          description: JSON.stringify(normalized),
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
        // GHI TRƯỚC, DỌN SAU: trước đây xóa hết test cũ rồi mới ghi test mới, nếu ghi lỗi giữa chừng
        // bài tập sẽ mất test; nếu xóa bị chặn thì test cũ còn sót làm chấm sai.
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

          // Chia nhỏ theo từng batch (5 test cases / batch) để chống triệt để lỗi statement timeout (57014) trên Supabase
          const BATCH_SIZE = 5;
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const res = await fetch(targetUrl, {
              method: 'POST',
              headers: {
                ...this.getAntiCacheHeaders(),
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates',
              },
              body: JSON.stringify(batch),
            });

            if (!res.ok) {
              const errDetail = await res.text();
              if (res.status === 500 && (errDetail.includes('57014') || errDetail.includes('statement timeout'))) {
                throw new Error('Dữ liệu test quá lớn khiến Supabase quá tải thời gian chờ. Hệ thống đã lưu trữ an toàn trên thiết bị.');
              }
              throw new Error(`Lỗi Supabase (${res.status}): ${errDetail.slice(0, 150)}`);
            }
          }

          // Dọn các test cũ không còn trong bộ test mới (không gây lỗi nếu bị chặn)
          try {
            const keepIds = standardizedTests.map((t) => encodeURIComponent(t.id)).join(',');
            await fetch(
              `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/test_cases?problem_id=eq.${encodeURIComponent(problemId)}&id=not.in.(${keepIds})`,
              { method: 'DELETE', headers: this.getAntiCacheHeaders() }
            );
          } catch (delErr) {
            console.warn('[apiService] Dọn test_cases cũ warn:', delErr);
          }
        }
      } catch (err: unknown) {
        console.error('[apiService] Lỗi lưu test cases lên Supabase Cloud:', err);
        throw new Error(
          (err as Error)?.message || 'Không thể lưu bộ Test case lên Database đám mây'
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
          headers: this.getAntiCacheHeaders(),
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
  async fetchSubmissions(options?: { full?: boolean }): Promise<Submission[]> {
    const sortDesc = (list: Submission[]): Submission[] =>
      list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    if (isSupabaseConfigured()) {
      try {
        const base = ENV.SUPABASE_URL.replace(/\/+$/, '');
        const select =
          'id,problem_id,problem_code,problem_title,user_id,user_name,class_id,language,status,verdict,total_points_earned,max_total_points,passed_count,total_tests,execution_time,memory,compilation_message,submitted_at';
        const now = Date.now();

        // Làm mới ĐỊNH KỲ chỉ tải phần bài nộp mới (vài KB) thay vì 5000 dòng mỗi 90 giây.
        // Cứ 5 phút (hoặc khi bị ép làm mới) mới tải lại toàn bộ để bắt các thay đổi/xóa.
        const canIncremental =
          !options?.full &&
          submissionsCache !== null &&
          submissionsCache.size > 0 &&
          now - submissionsFullFetchAt < SUBMISSIONS_FULL_REFRESH_MS;

        let url = `${base}/rest/v1/submissions?select=${select}&order=submitted_at.desc&limit=5000`;
        if (canIncremental && submissionsCache) {
          let latest = 0;
          submissionsCache.forEach((s) => {
            const t = Date.parse(s.submittedAt);
            if (t > latest) latest = t;
          });
          const since = new Date(Math.max(0, latest - 2 * 60 * 1000)).toISOString();
          url = `${base}/rest/v1/submissions?select=${select}&submitted_at=gte.${encodeURIComponent(since)}&order=submitted_at.desc&limit=5000`;
        }

        const res = await fetch(url, {
          headers: this.getAntiCacheHeaders(),
          cache: 'no-store',
        });

        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows)) {
            // Lấy trước thông tin học sinh hiện tại để đồng bộ tên mới nhất
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

            const mapped = rows.map((item: any): Submission => {
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
                sourceCode: '',
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
                testResults: [],
              };
            });

            if (canIncremental && submissionsCache) {
              for (const m of mapped) submissionsCache.set(m.id, m);
            } else {
              submissionsCache = new Map(mapped.map((m) => [m.id, m]));
              submissionsFullFetchAt = now;
              // Dọn bản sao cục bộ đã bị xóa trên Cloud (chạy nền, rất nhẹ)
              idbService.pruneSubmissions(new Set(submissionsCache.keys())).catch(() => {});
            }
            return sortDesc(Array.from(submissionsCache.values()));
          }
        }
      } catch (err) {
        console.warn('[apiService] Lỗi tải submissions từ Supabase Cloud:', err);
      }

      // Cloud lỗi tạm thời: giữ nguyên dữ liệu đã có thay vì trả về danh sách rỗng
      // (trước đây lỗi mạng khiến toàn bộ lịch sử nộp bài biến mất khỏi màn hình).
      if (submissionsCache && submissionsCache.size > 0) {
        return sortDesc(Array.from(submissionsCache.values()));
      }
    }

    // Chỉ dùng bộ nhớ cục bộ làm dự phòng khi không kết nối được Supabase Cloud
    const localSubmissions = await idbService.getAllSubmissions();
    return sortDesc(localSubmissions);
  },

  /**
   * Lấy chi tiết một bài nộp (bao gồm đầy đủ test_results) khi người dùng mở xem chi tiết
   */
  async fetchClassAcSubmissions(classId: string): Promise<Array<{
    id: string;
    problemId: string;
    problemCode: string;
    userId: string;
    userName: string;
    classId: string;
    verdict: string;
    submittedAt: string;
  }> | null> {
    if (!classId || !isSupabaseConfigured()) return null;
    try {
      const targetUrl = `${ENV.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/submissions?select=id,problem_id,problem_code,user_id,user_name,class_id,verdict,submitted_at&class_id=eq.${encodeURIComponent(classId)}&verdict=eq.AC&order=submitted_at.asc`;
      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: this.getAntiCacheHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const rows = await res.json();
      if (!Array.isArray(rows)) return null;
      return rows.map((r: any) => ({
        id: String(r.id || ''),
        problemId: String(r.problem_id || ''),
        problemCode: String(r.problem_code || ''),
        userId: String(r.user_id || ''),
        userName: String(r.user_name || ''),
        classId: String(r.class_id || ''),
        verdict: String(r.verdict || ''),
        submittedAt: String(r.submitted_at || ''),
      }));
    } catch (err) {
      console.warn('[apiService] Lỗi truy vấn SELECT bảng xếp hạng lớp học:', err);
      return null;
    }
  },

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

    if (problem.teacherId || problem.author) {
      const owners = storageService.getResourceOwners();
      owners.problems[problem.id] = normalizeOwnerEmail(problem.teacherId || problem.author);
      this.saveResourceOwners(owners).catch(() => {});
    }

    attachmentCache.delete(problem.id);
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
          // Không ghi đè file đính kèm trên Cloud bằng bản rút gọn (chỉ có tên/kích thước)
          ...(isAttachmentStub(problem.attachedFile) ? {} : { attached_file: problem.attachedFile }),
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
   * Xóa Bài tập khỏi Database.
   * Chỉ báo thành công khi máy chủ THỰC SỰ đã xóa (trước đây nếu quyền bị chặn, Supabase vẫn trả 204
   * nên giao diện báo "đã xóa" nhưng bài tập tự xuất hiện lại ở lần làm mới sau).
   */
  async deleteProblem(problemId: string): Promise<void> {
    if (!problemId) return;

    if (isSupabaseConfigured()) {
      const base = ENV.SUPABASE_URL.replace(/\/+$/, '');
      const encodedId = encodeURIComponent(problemId);
      try {
        // 1. Xóa test case của bài (cố gắng hết sức, tránh vướng ràng buộc khóa ngoại)
        try {
          await fetch(`${base}/rest/v1/test_cases?problem_id=eq.${encodedId}`, {
            method: 'DELETE',
            headers: this.getAntiCacheHeaders(),
          });
        } catch {
          // Bỏ qua lỗi xóa test case nếu không tồn tại
        }

        // 2. Xóa bài tập và yêu cầu trả về các dòng đã xóa để xác nhận
        const res = await fetch(`${base}/rest/v1/problems?id=eq.${encodedId}`, {
          method: 'DELETE',
          headers: { ...this.getAntiCacheHeaders(), Prefer: 'return=representation' },
        });
        if (!res.ok) {
          const errDetail = await res.text();
          throw new Error(`Lỗi Supabase (${res.status}): ${errDetail.slice(0, 150)}`);
        }

        let deletedRows: unknown = [];
        try {
          deletedRows = await res.json();
        } catch {
          deletedRows = [];
        }

        if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
          // Không có dòng nào bị xóa: hoặc bài đã mất từ trước, hoặc bị chặn quyền. Kiểm tra lại cho chắc.
          const check = await fetch(`${base}/rest/v1/problems?id=eq.${encodedId}&select=id&limit=1`, {
            headers: this.getAntiCacheHeaders(),
            cache: 'no-store',
          });
          if (check.ok) {
            const stillThere = await check.json();
            if (Array.isArray(stillThere) && stillThere.length > 0) {
              throw new Error(
                'Máy chủ từ chối xóa bài này (phiên đăng nhập giáo viên đã hết hạn hoặc không đủ quyền). Hãy đăng xuất rồi đăng nhập lại.'
              );
            }
          }
        }
      } catch (err: unknown) {
        console.error('[apiService] Lỗi xóa bài tập trên Supabase Cloud:', err);
        throw new Error(`Không thể xóa bài tập trên Database đám mây: ${(err as Error)?.message || 'Lỗi kết nối'}`);
      }
    }

    // Đã xóa thật trên Cloud: ghi "bia mộ" rồi dọn bản sao cục bộ
    markProblemDeleted(problemId);
    attachmentCache.delete(problemId);
    await idbService.deleteProblem(problemId).catch(() => {});
  },

  /**
   * Tải nội dung file đính kèm (Word/PDF) của 1 bài tập khi thật sự cần (xem đề, chỉnh sửa).
   * Danh sách bài tập không còn mang theo nội dung file (có thể vài MB mỗi bài).
   */
  async fetchProblemAttachment(problemId: string): Promise<Problem['attachedFile'] | null> {
    if (!problemId) return null;
    const cached = attachmentCache.get(problemId);
    if (cached && Date.now() - cached.at < ATTACHMENT_CACHE_TTL_MS) return cached.value || null;

    if (isSupabaseConfigured()) {
      try {
        const base = ENV.SUPABASE_URL.replace(/\/+$/, '');
        const res = await fetch(
          `${base}/rest/v1/problems?id=eq.${encodeURIComponent(problemId)}&select=attached_file&limit=1`,
          { headers: this.getAntiCacheHeaders(), cache: 'no-store' }
        );
        if (res.ok) {
          const rows = await res.json();
          const file = Array.isArray(rows) && rows.length > 0 ? rows[0]?.attached_file : null;
          if (file) {
            attachmentCache.set(problemId, { at: Date.now(), value: file });
            return file;
          }
          return null;
        }
      } catch (err) {
        console.warn('[apiService] Lỗi tải file đính kèm:', err);
      }
    }

    try {
      const locals = await idbService.getAllProblems();
      const local = locals.find((p) => p.id === problemId)?.attachedFile;
      if (local && !isAttachmentStub(local)) return local;
    } catch {
      // bỏ qua
    }
    return null;
  },

  /**
   * Lấy danh sách toàn bộ bài tập từ Database (Cloud Single Source of Truth)
   *
   * Tối ưu hiệu năng so với trước:
   *  - Không tải nội dung file đính kèm (base64 vài MB) trong danh sách.
   *  - Tải song song (chủ sở hữu + bài tập + số test) thay vì nối đuôi nhau.
   *  - Học sinh không đọc IndexedDB nặng mỗi lần làm mới.
   * Chống "bài tập ma": KHÔNG còn tự đẩy bài chỉ có ở máy lên lại Cloud.
   */
  async fetchProblems(): Promise<Problem[]> {
    if (isSupabaseConfigured()) {
      try {
        const base = ENV.SUPABASE_URL.replace(/\/+$/, '');
        const isAdmin = storageService.isAdminSessionActive();
        const topics = storageService.getTopics();
        const topicOwnerMap = new Map(topics.map((t) => [t.id, t.teacherId]));

        const slimSelect =
          'id,code,title,description,difficulty,topic_id,class_id,time_limit,memory_limit,total_points,input_format,output_format,constraints,samples,starter_code,video_config,created_at,updated_at,att_name:attached_file->>name,att_size:attached_file->>size,att_type:attached_file->>type';

        const loadRows = async (): Promise<{ rows: any[]; slim: boolean } | null> => {
          const headers = this.getAntiCacheHeaders();
          try {
            const res = await fetch(`${base}/rest/v1/problems?select=${slimSelect}&order=code.asc`, {
              headers,
              cache: 'no-store',
            });
            if (res.ok) {
              const rows = await res.json();
              if (Array.isArray(rows)) return { rows, slim: true };
            }
          } catch {
            // thử lại bằng truy vấn đầy đủ bên dưới
          }
          const res = await fetch(`${base}/rest/v1/problems?order=code.asc`, { headers, cache: 'no-store' });
          if (!res.ok) return null;
          const rows = await res.json();
          return Array.isArray(rows) ? { rows, slim: false } : null;
        };

        // Siêu nhẹ: chỉ metadata test case (không có input/output) để biết số lượng, điểm, ẩn/hiện.
        // Lưu ý quan trọng: Supabase giới hạn tối đa 1.000 dòng / 1 request (0-999). Khi hệ thống có >50 bài
        // (ví dụ 66 bài × 20 test = 1.320 dòng), nếu chỉ gọi 1 request thì các test thứ 20 bị cắt mất khiến
        // giao diện hiển thị sai thành 19 test! Do đó ta tải phân trang song song (1.000 dòng/trang).
        const loadTestMeta = async (): Promise<Map<string, TestCase[]>> => {
          const map = new Map<string, TestCase[]>();
          try {
            const tcHeaders = {
              ...this.getAntiCacheHeaders(),
              apikey: ENV.SUPABASE_ANON_KEY,
              Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
            };
            const fetchPage = async (offset: number): Promise<any[]> => {
              const tcUrl = `${base}/rest/v1/test_cases?select=id,problem_id,test_name,points,is_hidden,order_index&order=order_index.asc,updated_at.desc&limit=1000&offset=${offset}`;
              const tcRes = await fetch(tcUrl, { headers: tcHeaders, cache: 'no-store' });
              if (!tcRes.ok) return [];
              const rows = await tcRes.json();
              return Array.isArray(rows) ? rows : [];
            };

            const [page0, page1] = await Promise.all([fetchPage(0), fetchPage(1000)]);
            const allTcRows = [...page0, ...page1];
            let nextOffset = 2000;
            let lastLen = page1.length;
            while (lastLen === 1000 && nextOffset <= 10000) {
              const more = await fetchPage(nextOffset);
              allTcRows.push(...more);
              lastLen = more.length;
              nextOffset += 1000;
            }

            if (allTcRows.length > 0) {
              // Deduplicate: Mỗi problem_id chỉ lấy 1 hàng cho mỗi order_index
              const seenOrdersByPid = new Map<string, Set<number>>();
              for (const row of allTcRows) {
                const pid = row.problem_id;
                if (!seenOrdersByPid.has(pid)) seenOrdersByPid.set(pid, new Set());
                const orderSet = seenOrdersByPid.get(pid)!;
                const ord = Number(row.order_index) || 0;
                if (ord > 0 && orderSet.has(ord)) continue;
                if (ord > 0) orderSet.add(ord);

                if (!map.has(pid)) map.set(pid, []);
                map.get(pid)!.push({
                  id: row.id,
                  name: row.test_name || `Test #${row.order_index}`,
                  input: row.input || '',
                  expectedOutput: row.expected_output || '',
                  points: Number(row.points) || 1,
                  isHidden: Boolean(row.is_hidden),
                });
              }
            }
          } catch (tcErr) {
            console.warn('[apiService] Không thể fetch test_cases từ Supabase:', tcErr);
          }
          return map;
        };

        const [owners, loaded, cloudTcMap] = await Promise.all([
          this.fetchResourceOwners(),
          loadRows(),
          loadTestMeta(),
        ]);

        if (loaded) {
          // Bia mộ: loại bài vừa xóa khỏi kết quả (phòng lượt tải cũ trả về muộn) và dọn bia mộ đã được Cloud xác nhận
          const tombstones = readProblemTombstones();
          const cloudIdSet = new Set<string>(loaded.rows.map((r: any) => String(r.id)));
          const confirmedGone = Object.keys(tombstones).filter((id) => !cloudIdSet.has(id));
          if (confirmedGone.length > 0) clearProblemTombstones(confirmedGone);
          const visibleRows = loaded.rows.filter((r: any) => !tombstones[String(r.id)]);

          const cloudProblems = visibleRows.map((item: any): Problem => {
            const resolvedOwner = normalizeOwnerEmail(
              owners.problems[item.id] ||
                (item.topic_id ? topicOwnerMap.get(item.topic_id) : undefined) ||
                (item.class_id ? owners.classes[item.class_id] : undefined)
            );

            let attachedFile: Problem['attachedFile'];
            if (loaded.slim) {
              attachedFile = item.att_name
                ? {
                    name: String(item.att_name),
                    size: Number(item.att_size) || 0,
                    type: item.att_type === 'pdf' ? 'pdf' : 'docx',
                  }
                : undefined;
            } else {
              attachedFile = item.attached_file || undefined;
            }

            return {
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
              attachedFile,
              author: resolvedOwner,
              teacherId: resolvedOwner,
              createdAt: item.created_at || new Date().toISOString(),
              updatedAt: item.updated_at || new Date().toISOString(),
              testCases: [],
            };
          });

          if (isAdmin) {
            // Giáo viên: giữ bộ test có nội dung thật (input/output) đã lưu ở máy để chấm/chỉnh sửa nhanh
            const [idbProblems, storageProblems] = await Promise.all([
              idbService.getAllProblems(),
              Promise.resolve(storageService.getProblems()),
            ]);
            const idbMap = new Map(idbProblems.map((p) => [p.id, p]));
            const storageMap = new Map(storageProblems.map((p) => [p.id, p]));

            const hasContent = (tests?: TestCase[]) =>
              Boolean(tests && tests.length > 0 && tests.some((t) => (t.input && t.input.trim()) || (t.expectedOutput && t.expectedOutput.trim())));

            for (const cp of cloudProblems) {
              const fromCloud = cloudTcMap.get(cp.id);
              const fromIdb = idbMap.get(cp.id)?.testCases;
              const fromStorage = storageMap.get(cp.id)?.testCases;

              const cloudLen = fromCloud?.length || 0;
              let tests: TestCase[] = [];
              if (hasContent(fromIdb) && fromIdb!.length >= cloudLen) {
                tests = fromIdb!;
              } else if (hasContent(fromStorage) && fromStorage!.length >= cloudLen) {
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
              if (hasContent(tests)) {
                idbService.saveTestCases(cp.id, tests).catch(() => {});
              }
            }
          } else {
            for (const cp of cloudProblems) {
              cp.testCases = cloudTcMap.get(cp.id) || [];
            }
          }

          // Dọn bài tập đã bị xóa trên Cloud khỏi IndexedDB của máy này (chạy nền).
          // Việc lưu danh sách mới vào localStorage/IndexedDB do JudgeContext đảm nhiệm (1 lần duy nhất).
          idbService.pruneProblems(cloudIdSet).catch(() => {});

          return cloudProblems;
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
    const tombstones = readProblemTombstones();
    const localMap = new Map<string, Problem>();
    idbProblems.forEach((p) => localMap.set(p.id, p));
    storageProblems.forEach((p) => {
      if (!localMap.has(p.id)) localMap.set(p.id, p);
    });
    return Array.from(localMap.values()).filter((p) => !tombstones[p.id]);
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
    const cloudRelations = await this.fetchRawCloudClassStudents();
    if (cloudRelations && cloudRelations.length > 0) {
      await this.saveClassStudents(storageService.getClassStudents());
    } else if (cloudRelations !== null && storageService.getClassStudents().length > 0) {
      await this.saveClassStudents(storageService.getClassStudents());
    }
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
    const cloudTopics = await this.fetchTopics();
    if (cloudTopics.length === 0 && storageService.getTopics().length > 0) {
      await this.saveTopics(storageService.getTopics());
    }

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

    // CHỐNG "BÀI TẬP MA": Cloud là nguồn chân lý. Chỉ đẩy bài từ máy lên khi Cloud hoàn toàn trống
    // (di chuyển dữ liệu lần đầu). Nếu không, bản sao cũ còn sót trên máy này sẽ làm bài đã xóa sống lại.
    const allowProblemUpload = cloudProblemIds !== null && cloudProblemIds.size === 0;
    const tombstonedIds = readProblemTombstones();

    await runBatches(allProblems, async (p) => {
      try {
        if (tombstonedIds[p.id]) return;
        const existsOnCloud = Boolean(cloudProblemIds && cloudProblemIds.has(p.id));
        if (!existsOnCloud && !allowProblemUpload) return;
        const problemMissing = !existsOnCloud;
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
