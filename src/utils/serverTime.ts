/**
 * Tiện ích đồng bộ giờ chuẩn Server (0 request Supabase, 0 bytes Egress)
 * và tính toán thời hạn thành viên lớp học theo giờ Việt Nam (UTC+7).
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const CLOCK_SYNC_COOLDOWN_MS = 10 * 60 * 1000; // Tối đa 10 phút mới đồng bộ lại 1 lần

let serverOffsetMs = 0;
let hasSyncedServerClock = false;
let lastSyncAttemptMs = 0;
let maxObservedCloudMs = 0;
let inflightClockSync: Promise<number> | null = null;

/**
 * Ghi nhận các mốc thời gian ISO đáng tin cậy trả về từ Supabase (updated_at, submitted_at...)
 * làm chặn dưới an toàn, chống trường hợp chỉnh lùi đồng hồ máy khi không có header Date.
 */
export function observeCloudTimestamp(iso?: string | null): void {
  if (!iso) return;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return;
  // Bỏ qua mốc quá xa trong tương lai (> 2 ngày so với hiện tại nếu chưa sync) để tránh dữ liệu rác
  if (ms > maxObservedCloudMs && ms < Date.now() + 365 * DAY_MS) {
    maxObservedCloudMs = ms;
  }
}

/**
 * Đọc header Date từ một Response (nếu cùng origin hoặc server có expose header Date).
 */
export function observeResponseDateHeader(res?: Response | null): boolean {
  if (!res) return false;
  try {
    const dateHeader = res.headers?.get('date');
    if (!dateHeader) return false;
    const serverMs = Date.parse(dateHeader);
    if (!Number.isFinite(serverMs)) return false;
    serverOffsetMs = serverMs - Date.now();
    hasSyncedServerClock = true;
    if (serverMs > maxObservedCloudMs) {
      maxObservedCloudMs = serverMs;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Đồng bộ đồng hồ theo giờ chuẩn Server bằng 1 request HEAD same-origin (0 byte body, 0 Supabase Egress).
 */
export async function syncServerClock(force = false): Promise<number> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return getServerNowMs();
  }
  const nowLocal = Date.now();
  if (!force && hasSyncedServerClock && nowLocal - lastSyncAttemptMs < CLOCK_SYNC_COOLDOWN_MS) {
    return getServerNowMs();
  }
  if (inflightClockSync) return inflightClockSync;

  lastSyncAttemptMs = nowLocal;
  inflightClockSync = (async () => {
    try {
      const target = `${window.location.origin}/?_t=${nowLocal}`;
      const res = await fetch(target, { method: 'HEAD', cache: 'no-store' });
      observeResponseDateHeader(res);
    } catch {
      // Giữ nguyên offset hiện có hoặc fallback sang chặn dưới từ Cloud
    } finally {
      inflightClockSync = null;
    }
    return getServerNowMs();
  })();

  return inflightClockSync;
}

/**
 * Lấy thời gian hiện tại (epoch ms) theo giờ chuẩn Server.
 * Nếu đồng hồ máy bị chỉnh lùi, luôn đảm bảo không nhỏ hơn mốc Cloud đã quan sát.
 */
export function getServerNowMs(): number {
  const adjusted = Date.now() + serverOffsetMs;
  if (maxObservedCloudMs > 0 && adjusted < maxObservedCloudMs) {
    return maxObservedCloudMs;
  }
  return adjusted;
}

export function isServerClockSynced(): boolean {
  return hasSyncedServerClock;
}

/**
 * Phân tích chuỗi expiresAt thành timestamp ms (cuối ngày giờ VN nếu chỉ truyền YYYY-MM-DD).
 */
export function parseExpiryMs(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  const trimmed = String(expiresAt).trim();
  if (!trimmed) return null;

  // Hỗ trợ dạng YYYY-MM-DD (hiểu là 23:59:59.999 giờ Việt Nam UTC+7)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const ms = Date.parse(`${trimmed}T23:59:59.999+07:00`);
    return Number.isFinite(ms) ? ms : null;
  }

  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Kiểm tra thành viên lớp đã hết hạn hay chưa theo giờ chuẩn Server.
 * expiresAt rỗng/null => Không giới hạn (không bao giờ hết hạn).
 */
export function isClassMembershipExpired(
  expiresAt?: string | null,
  nowMs: number = getServerNowMs()
): boolean {
  const expMs = parseExpiryMs(expiresAt);
  if (expMs === null) return false;
  return nowMs > expMs;
}

/**
 * Chuyển timestamp ms sang ngày lịch Việt Nam (YYYY-MM-DD).
 */
export function toVNDateKey(ms: number): string {
  const vnDate = new Date(ms + VN_OFFSET_MS);
  const y = vnDate.getUTCFullYear();
  const m = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(vnDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Chuyển YYYY-MM-DD thành ISO cuối ngày theo giờ Việt Nam (23:59:59+07:00).
 */
export function buildExpiryFromDateInput(yyyyMmDd: string): string | null {
  const clean = (yyyyMmDd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const ms = Date.parse(`${clean}T23:59:59+07:00`);
  if (!Number.isFinite(ms)) return null;
  return `${clean}T23:59:59+07:00`;
}

/**
 * Lấy giá trị YYYY-MM-DD (theo giờ Việt Nam) từ expiresAt để điền vào <input type="date">.
 */
export function expiryToDateInputValue(expiresAt?: string | null): string {
  const expMs = parseExpiryMs(expiresAt);
  if (expMs === null) return '';
  return toVNDateKey(expMs);
}

/**
 * Cộng thêm N tháng theo lịch (giữ đúng ngày trong tháng, tự kẹp cuối tháng nếu tháng đích ít ngày hơn).
 * - Nếu học sinh đang còn hạn -> cộng dồn từ ngày hết hạn hiện tại (không làm mất ngày dư).
 * - Nếu học sinh chưa có hạn (vĩnh viễn) hoặc đã hết hạn -> tính từ ngày hôm nay theo giờ Server.
 */
export function addMonthsToExpiry(
  currentExpiresAt: string | null | undefined,
  months: number,
  nowMs: number = getServerNowMs()
): string {
  const safeMonths = Math.max(1, Math.round(months));
  const currentExpMs = parseExpiryMs(currentExpiresAt);
  const baseMs = currentExpMs !== null && currentExpMs > nowMs ? currentExpMs : nowMs;

  const vnBase = new Date(baseMs + VN_OFFSET_MS);
  const baseYear = vnBase.getUTCFullYear();
  const baseMonth = vnBase.getUTCMonth(); // 0..11
  const baseDay = vnBase.getUTCDate();

  const totalMonths = baseMonth + safeMonths;
  const targetYear = baseYear + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  // Số ngày tối đa trong tháng đích (tránh tràn 31/01 + 1 tháng -> 03/03)
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(baseDay, lastDayOfTargetMonth);

  const y = String(targetYear);
  const m = String(targetMonth + 1).padStart(2, '0');
  const d = String(clampedDay).padStart(2, '0');
  return `${y}-${m}-${d}T23:59:59+07:00`;
}

/**
 * Số ngày còn lại theo lịch Việt Nam (0 = hết hạn cuối ngày hôm nay, âm = đã quá hạn, null = không giới hạn).
 */
export function getRemainingDays(
  expiresAt?: string | null,
  nowMs: number = getServerNowMs()
): number | null {
  const expMs = parseExpiryMs(expiresAt);
  if (expMs === null) return null;
  if (nowMs > expMs) return -1;

  const todayKey = toVNDateKey(nowMs);
  const expKey = toVNDateKey(expMs);
  const todayStart = Date.parse(`${todayKey}T00:00:00+07:00`);
  const expStart = Date.parse(`${expKey}T00:00:00+07:00`);
  const diffDays = Math.round((expStart - todayStart) / DAY_MS);
  return Math.max(0, diffDays);
}

/**
 * Định dạng ngày hết hạn chuẩn dd/mm/yyyy theo giờ Việt Nam.
 */
export function formatExpiryDateVN(expiresAt?: string | null): string {
  const expMs = parseExpiryMs(expiresAt);
  if (expMs === null) return 'Không giới hạn';
  const key = toVNDateKey(expMs);
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

export const EXPIRY_WARNING_DAYS = 14;
