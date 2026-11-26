import type { RealtimeChannel } from '@supabase/supabase-js';
import type { StudentUser } from '../types/judge';
import { ENV, apiService } from './apiService';
import { supabase } from './supabaseClient';

const DEVICE_ID_STORAGE_KEY = 'faminh_device_id_v1';
const SYSTEM_SESSIONS_ROW_ID = '__system_active_sessions__';

let cachedUpdatedAt: string | null = null;
let cachedSessionsMap: Record<string, string> | null = null;
let lastClaimKey = '';
let lastClaimTimestamp = 0;
let inflightClaimMap = new Map<string, Promise<string | null>>();

/**
 * Tạo hoặc lấy mã định danh thiết bị/trình duyệt bền vững trong localStorage.
 * Các tab mở trên CÙNG 1 trình duyệt sẽ dùng chung mã này -> không bao giờ tự đá nhau.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'd_server';
  }
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.startsWith('d_') && existing.length >= 10) {
      return existing;
    }
    const rand =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const generated = `d_${rand}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `d_${Date.now().toString(36)}`;
  }
}

/**
 * Khóa định danh thống nhất cho 1 tài khoản học sinh (ưu tiên email lowercase, fallback userId).
 */
export function getStudentSessionKey(
  student?: Pick<StudentUser, 'id' | 'username' | 'email'> | null
): string | null {
  if (!student) return null;
  const rawEmail = (
    student.email ||
    (student.username && student.username.includes('@') ? student.username : '')
  )
    .trim()
    .toLowerCase();
  if (rawEmail && rawEmail.includes('@')) return rawEmail;
  const rawId = (student.id || '').trim().toLowerCase();
  return rawId || null;
}

/**
 * Chuyển userKey thành tên kênh Realtime Broadcast hợp lệ.
 */
export function buildSessionChannelName(userKey: string): string {
  const safe = userKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `faminh_single_device_${safe}`;
}

/**
 * Xác định xem tài khoản có thuộc nhóm được MIỄN TRỪ (Quản trị viên / Giáo viên) hay không.
 */
export function isExemptFromSingleDevice(
  role?: string | null,
  isAdminAuthenticated?: boolean
): boolean {
  if (isAdminAuthenticated) return true;
  const clean = String(role || '').trim().toLowerCase();
  return clean === 'admin' || clean === 'super_admin' || clean === 'teacher';
}

/**
 * Đọc bản đồ phiên đăng nhập đang hoạt động từ Supabase Cloud với tối ưu Egress (~70 bytes khi không đổi).
 * Trả về null nếu lỗi mạng -> nguyên tắc FAIL-OPEN, tuyệt đối không đá nhầm khi mất mạng.
 */
export async function fetchActiveSessionsMap(options?: {
  force?: boolean;
  timeoutMs?: number;
}): Promise<Record<string, string> | null> {
  if (!apiService.isConfigured()) return null;
  const base = ENV.SUPABASE_URL.replace(/\/+$/, '');
  const headers = apiService.getAntiCacheHeaders();
  const timeoutMs = options?.timeoutMs ?? (options?.force ? 4000 : 1500);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    // 1. Nếu đã có cache trong RAM, chỉ hỏi trường updated_at (~70 bytes)
    if (!options?.force && cachedSessionsMap !== null && cachedUpdatedAt !== null) {
      const metaUrl = `${base}/rest/v1/classrooms?id=eq.${SYSTEM_SESSIONS_ROW_ID}&select=updated_at`;
      const metaRes = await fetch(metaUrl, {
        headers,
        cache: 'no-store',
        signal: controller?.signal,
      });
      if (!metaRes.ok) return null;
      const metaRows = await metaRes.json();
      if (!Array.isArray(metaRows) || metaRows.length === 0) {
        cachedSessionsMap = {};
        cachedUpdatedAt = '__empty__';
        return cachedSessionsMap;
      }
      const cloudVer = metaRows[0]?.updated_at ? String(metaRows[0].updated_at) : null;
      if (cloudVer && cloudVer === cachedUpdatedAt) {
        return cachedSessionsMap;
      }
    }

    // 2. Tải bản đồ đầy đủ khi chưa có cache hoặc updated_at đã thay đổi
    const dataUrl = `${base}/rest/v1/classrooms?id=eq.${SYSTEM_SESSIONS_ROW_ID}&select=description,updated_at`;
    const res = await fetch(dataUrl, {
      headers,
      cache: 'no-store',
      signal: controller?.signal,
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      cachedSessionsMap = {};
      cachedUpdatedAt = '__empty__';
      return cachedSessionsMap;
    }

    let parsed: Record<string, string> = {};
    if (rows[0]?.description) {
      try {
        const raw = JSON.parse(rows[0].description);
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          parsed = raw as Record<string, string>;
        }
      } catch {
        parsed = {};
      }
    }
    cachedSessionsMap = parsed;
    cachedUpdatedAt = rows[0]?.updated_at ? String(rows[0].updated_at) : String(Date.now());
    return cachedSessionsMap;
  } catch (e) {
    console.warn('[deviceSessionService] Lỗi/timeout đọc phiên hoạt động (bỏ qua an toàn):', e);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Ghi đè mã thiết bị hợp lệ cho 1 học sinh lên Cloud (merge an toàn với các học sinh khác).
 */
async function persistActiveSessionForKey(userKey: string, deviceId: string): Promise<boolean> {
  if (!apiService.isConfigured()) return false;
  const base = ENV.SUPABASE_URL.replace(/\/+$/, '');
  const headers = apiService.getAntiCacheHeaders();

  try {
    const latest = (await fetchActiveSessionsMap({ force: true })) || {};
    const nextMap: Record<string, string> = {
      ...latest,
      [userKey]: deviceId,
    };

    const nowIso = new Date().toISOString();
    const res = await fetch(`${base}/rest/v1/classrooms?on_conflict=id`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        id: SYSTEM_SESSIONS_ROW_ID,
        class_name: 'ACTIVE_SESSIONS',
        description: JSON.stringify(nextMap),
        join_code: 'SES',
        updated_at: nowIso,
      }),
    });

    if (!res.ok) return false;
    const savedRows = await res.json().catch(() => null);
    cachedSessionsMap = nextMap;
    cachedUpdatedAt =
      Array.isArray(savedRows) && savedRows[0]?.updated_at
        ? String(savedRows[0].updated_at)
        : nowIso;
    return true;
  } catch (e) {
    console.warn('[deviceSessionService] Lỗi lưu phiên thiết bị lên Cloud:', e);
    return false;
  }
}

/**
 * Bắn gói tin Realtime Broadcast (~80 bytes, 0 DB read/write) để đá thiết bị cũ trong ~1 giây.
 */
async function broadcastSessionClaim(userKey: string, deviceId: string): Promise<void> {
  try {
    const channelName = buildSessionChannelName(userKey);
    // Tái sử dụng kênh nếu đang mở sẵn, nếu chưa thì tạo tạm để gửi xong đóng
    const existing = supabase
      .getChannels()
      .find((ch) => ch.topic === `realtime:${channelName}` || ch.topic === channelName);

    const payload = { userKey, deviceId, ts: Date.now() };

    if (existing && existing.state === 'joined') {
      await existing.send({
        type: 'broadcast',
        event: 'session_claimed',
        payload,
      });
      return;
    }

    const tempChannel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        supabase.removeChannel(tempChannel).catch(() => {});
        resolve();
      }, 2500);

      tempChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await tempChannel.send({
              type: 'broadcast',
              event: 'session_claimed',
              payload,
            });
          } finally {
            clearTimeout(timeout);
            // Giữ 250ms cho WebSocket flush xong rồi mới gỡ kênh tạm
            setTimeout(() => {
              supabase.removeChannel(tempChannel).catch(() => {});
              resolve();
            }, 250);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timeout);
          supabase.removeChannel(tempChannel).catch(() => {});
          resolve();
        }
      });
    });
  } catch {
    // Dự phòng bằng Cloud verify nên không làm gián đoạn luồng đăng nhập
  }
}

/**
 * Đăng ký thiết bị hiện tại làm THIẾT BỊ DUY NHẤT hợp lệ khi học sinh ĐĂNG NHẬP MỚI.
 * - Ghi đè deviceId lên Cloud
 * - Bắn Realtime Broadcast đá máy cũ trong ~1 giây
 * - Thu hồi refresh token của các thiết bị khác ở Supabase Auth (signOut scope: 'others')
 */
export async function claimStudentDeviceSession(
  student: Pick<StudentUser, 'id' | 'username' | 'email' | 'role'>,
  options?: { silentBootstrap?: boolean }
): Promise<string | null> {
  if (isExemptFromSingleDevice(student.role, false)) return null;
  const userKey = getStudentSessionKey(student);
  if (!userKey) return null;

  const deviceId = getOrCreateDeviceId();
  const dedupeKey = `${userKey}:${deviceId}`;
  const now = Date.now();

  // Chống gửi lặp khi cả AuthModal và onAuthStateChange cùng kích hoạt trong < 4 giây
  const existingInflight = inflightClaimMap.get(dedupeKey);
  if (existingInflight) {
    return existingInflight;
  }
  if (dedupeKey === lastClaimKey && now - lastClaimTimestamp < 4000) {
    return deviceId;
  }
  lastClaimKey = dedupeKey;
  lastClaimTimestamp = now;

  const claimTask = (async () => {
    await persistActiveSessionForKey(userKey, deviceId);

    if (!options?.silentBootstrap) {
      // 1. Bắn Broadcast đá thiết bị cũ ngay lập tức (~1s)
      void broadcastSessionClaim(userKey, deviceId);
      // 2. Thu hồi phiên ở tầng Supabase Auth cho mọi thiết bị khác (giữ nguyên máy hiện tại)
      supabase.auth.signOut({ scope: 'others' }).catch(() => {});
    }

    return deviceId;
  })().finally(() => {
    inflightClaimMap.delete(dedupeKey);
  });

  inflightClaimMap.set(dedupeKey, claimTask);
  return claimTask;
}

export type SessionVerifyStatus = 'valid' | 'kicked' | 'unknown';

/**
 * Đối chiếu mã thiết bị hiện tại với mã hợp lệ trên Cloud.
 * - Nếu Cloud chưa từng có bản ghi cho học sinh này -> tự đăng ký âm thầm (không đá học sinh cũ sau khi nâng cấp).
 * - Nếu lỗi mạng -> trả về 'unknown' (tuyệt đối không đá nhầm).
 * - Chỉ trả về 'kicked' khi chắc chắn Cloud đang lưu mã của một thiết bị KHÁC.
 */
export async function verifyStudentDeviceSession(
  student: Pick<StudentUser, 'id' | 'username' | 'email' | 'role'>,
  options?: { force?: boolean }
): Promise<SessionVerifyStatus> {
  if (isExemptFromSingleDevice(student.role, false)) return 'valid';
  const userKey = getStudentSessionKey(student);
  if (!userKey) return 'unknown';

  const myDeviceId = getOrCreateDeviceId();
  const dedupeKey = `${userKey}:${myDeviceId}`;

  // Chờ nếu thiết bị hiện tại đang ghi nhận phiên đăng nhập mới (tránh race condition lúc Google OAuth redirect)
  const pendingClaim = inflightClaimMap.get(dedupeKey);
  if (pendingClaim) {
    await pendingClaim;
    return 'valid';
  }
  if (dedupeKey === lastClaimKey && Date.now() - lastClaimTimestamp < 5000) {
    return 'valid';
  }

  const map = await fetchActiveSessionsMap({ force: options?.force });
  if (map === null) return 'unknown';

  const cloudDeviceId = map[userKey];
  if (!cloudDeviceId) {
    // Học sinh đăng nhập từ trước khi bật tính năng -> tự gắn mã máy hiện tại âm thầm
    void claimStudentDeviceSession(student, { silentBootstrap: true });
    return 'valid';
  }

  return cloudDeviceId === myDeviceId ? 'valid' : 'kicked';
}

/**
 * Lắng nghe kênh Realtime Broadcast riêng của tài khoản học sinh để thoát ngay khi có máy khác đăng nhập.
 */
export function subscribeStudentSessionKick(
  student: Pick<StudentUser, 'id' | 'username' | 'email' | 'role'>,
  onKicked: () => void
): () => void {
  if (isExemptFromSingleDevice(student.role, false)) return () => {};
  const userKey = getStudentSessionKey(student);
  if (!userKey) return () => {};

  const myDeviceId = getOrCreateDeviceId();
  const channelName = buildSessionChannelName(userKey);

  const channel: RealtimeChannel = supabase
    .channel(channelName, {
      config: { broadcast: { self: false } },
    })
    .on('broadcast', { event: 'session_claimed' }, (msg) => {
      const incomingId = msg?.payload?.deviceId;
      if (typeof incomingId === 'string' && incomingId.length > 0 && incomingId !== myDeviceId) {
        // Cập nhật cache local để các lượt kiểm tra sau đồng bộ ngay
        if (cachedSessionsMap) {
          cachedSessionsMap[userKey] = incomingId;
        }
        onKicked();
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel).catch(() => {});
  };
}

/**
 * Xóa cache trong RAM khi đăng xuất.
 */
export function resetDeviceSessionMemoryCache(): void {
  cachedUpdatedAt = null;
  cachedSessionsMap = null;
  lastClaimKey = '';
  lastClaimTimestamp = 0;
  inflightClaimMap.clear();
}
