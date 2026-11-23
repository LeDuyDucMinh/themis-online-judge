import React from 'react';
import type { ExamCountdown } from '../../types/judge';

const VN_WEEKDAYS = [
  'Chủ nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

export const EXAM_COLOR_SWATCHES = [
  '#1F1D1A', // Đen mực ấm
  '#B4281F', // Đỏ FAMINH
  '#26653A', // Xanh lá trầm
  '#8F5A08', // Vàng đất ấm
  '#25364B', // Xanh navy trầm
];

/**
 * Chuyển ngày (YYYY-MM-DD) & giờ (HH:mm) theo giờ Việt Nam (UTC+7) sang Unix timestamp (ms)
 */
export function getExamTargetTimestamp(examDate: string, examTime: string = '07:30'): number {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(examDate || '') ? examDate : '2026-12-20';
  const safeTime = /^\d{2}:\d{2}$/.test(examTime || '') ? examTime : '07:30';
  const ts = Date.parse(`${safeDate}T${safeTime}:00+07:00`);
  return Number.isFinite(ts) ? ts : Date.now() + 86400000;
}

/**
 * Định dạng kiểu "Chủ nhật, 20/12/2026 · 07:30" theo lịch Việt Nam
 */
export function formatExamDateTimeVN(examDate: string, examTime: string = '07:30'): string {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(examDate || '') ? examDate : '2026-12-20';
  const safeTime = /^\d{2}:\d{2}$/.test(examTime || '') ? examTime : '07:30';
  const [y, m, d] = safeDate.split('-').map(Number);
  // Tạo ngày UTC cố định 12:00 để lấy thứ chính xác không bị lệch múi giờ trình duyệt
  const weekdayIdx = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
  const weekday = VN_WEEKDAYS[weekdayIdx] || '';
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${weekday}, ${dd}/${mm}/${y} · ${safeTime}`;
}

/**
 * Định dạng gọn kiểu "07:30, 20/12/2026" cho bảng quản lý giáo viên
 */
export function formatExamCompactTimeVN(examDate: string, examTime: string = '07:30'): string {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(examDate || '') ? examDate : '2026-12-20';
  const safeTime = /^\d{2}:\d{2}$/.test(examTime || '') ? examTime : '07:30';
  const [y, m, d] = safeDate.split('-');
  return `${safeTime}, ${d}/${m}/${y}`;
}

/**
 * Kiểm tra màu HEX có phải nền sáng không để tự đổi chữ sang màu tối / sáng
 */
export function isLightHexColor(hex?: string): boolean {
  const clean = (hex || '').trim().replace(/^#/, '');
  let r = 31;
  let g = 29;
  let b = 26;
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (/^[0-9a-f]{6}$/i.test(clean)) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  } else {
    return false;
  }
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 165;
}

export function normalizeHexColor(hex?: string): string {
  const raw = (hex || '').trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw.toUpperCase();
  if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return `#${raw.toUpperCase()}`;
  return '#1F1D1A';
}

export type ExamCountdownPhase = 'upcoming' | 'today' | 'ongoing' | 'ended' | 'expired';

export interface ComputedExamState {
  phase: ExamCountdownPhase;
  targetMs: number;
  diffMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isVisibleToStudent: boolean;
  pillLabel: string;
}

export function computeExamState(
  exam: Pick<ExamCountdown, 'examDate' | 'examTime' | 'expireBehavior' | 'isActive'>,
  nowMs: number
): ComputedExamState {
  const targetMs = getExamTargetTimestamp(exam.examDate, exam.examTime);
  const diffMs = targetMs - nowMs;

  if (diffMs > 0) {
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    const phase: ExamCountdownPhase = days === 0 ? 'today' : 'upcoming';
    return {
      phase,
      targetMs,
      diffMs,
      days,
      hours,
      minutes,
      seconds,
      isVisibleToStudent: exam.isActive,
      pillLabel: days === 0 ? 'Hôm nay thi' : `còn ${days} ngày`,
    };
  }

  const elapsedMs = -diffMs;
  const ONE_DAY_MS = 86400000;
  const behavior = exam.expireBehavior || 'ongoing_1d';

  if (behavior === 'hide_immediately') {
    return {
      phase: 'expired',
      targetMs,
      diffMs,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isVisibleToStudent: false,
      pillLabel: 'đã qua',
    };
  }

  if (behavior === 'keep_ended') {
    const isOngoing = elapsedMs < ONE_DAY_MS;
    return {
      phase: isOngoing ? 'ongoing' : 'ended',
      targetMs,
      diffMs,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isVisibleToStudent: exam.isActive,
      pillLabel: isOngoing ? 'đang diễn ra' : 'đã kết thúc',
    };
  }

  // Mặc định: ongoing_1d — Hiện "Đang diễn ra", sau 1 ngày tự ẩn
  if (elapsedMs < ONE_DAY_MS) {
    return {
      phase: 'ongoing',
      targetMs,
      diffMs,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isVisibleToStudent: exam.isActive,
      pillLabel: 'đang diễn ra',
    };
  }

  return {
    phase: 'expired',
    targetMs,
    diffMs,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isVisibleToStudent: false,
    pillLabel: 'đã qua',
  };
}

/**
 * Sắp xếp kỳ thi: sắp diễn ra nhất hiện đầu tiên, kỳ thi đã qua xếp cuối cùng
 */
export function sortExamCountdowns(list: ExamCountdown[], nowMs: number): ExamCountdown[] {
  return [...list].sort((a, b) => {
    const sa = computeExamState(a, nowMs);
    const sb = computeExamState(b, nowMs);
    const aPast = sa.phase === 'expired' || sa.phase === 'ended';
    const bPast = sb.phase === 'expired' || sb.phase === 'ended';
    if (aPast !== bPast) return aPast ? 1 : -1;
    if (!aPast) return sa.targetMs - sb.targetMs;
    return sb.targetMs - sa.targetMs;
  });
}

interface ExamCountdownCardProps {
  exam: Pick<
    ExamCountdown,
    'title' | 'note' | 'examDate' | 'examTime' | 'bgType' | 'bgColor' | 'bgImageUrl' | 'expireBehavior' | 'isActive'
  >;
  nowMs: number;
  compact?: boolean;
}

export const ExamCountdownCard: React.FC<ExamCountdownCardProps> = ({
  exam,
  nowMs,
  compact = false,
}) => {
  const state = computeExamState(exam, nowMs);
  const useImage = exam.bgType === 'image' && Boolean(exam.bgImageUrl);
  const safeBgColor = normalizeHexColor(exam.bgColor);
  const isLightText = useImage ? true : !isLightHexColor(safeBgColor);

  const primaryText = isLightText ? '#FFFFFF' : '#1F1D1A';
  const mutedText = isLightText ? 'rgba(255, 255, 255, 0.74)' : 'rgba(31, 29, 26, 0.72)';
  const subtlePillBg = isLightText ? 'rgba(255, 255, 255, 0.16)' : 'rgba(31, 29, 26, 0.1)';

  const formattedDateLine = formatExamDateTimeVN(exam.examDate, exam.examTime);
  const subtitleText = exam.note?.trim()
    ? `${formattedDateLine} · ${exam.note.trim()}`
    : formattedDateLine;

  const pad2 = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      className="exam-countdown-card"
      style={{
        position: 'relative',
        borderRadius: compact ? 12 : 14,
        overflow: 'hidden',
        backgroundColor: safeBgColor,
        backgroundImage: useImage ? `url("${exam.bgImageUrl}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: primaryText,
        padding: compact ? '18px 20px 20px' : '22px 26px 26px',
      }}
    >
      {useImage && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(18, 16, 14, 0.68), rgba(18, 16, 14, 0.52))',
          }}
        />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                fontSize: compact ? 16 : 17.5,
                fontWeight: 700,
                margin: 0,
                lineHeight: 1.3,
                color: primaryText,
              }}
            >
              {exam.title?.trim() || 'Tên kỳ thi'}
            </h3>
            <p
              style={{
                fontSize: compact ? 12 : 13,
                margin: '4px 0 0',
                color: mutedText,
                lineHeight: 1.4,
              }}
            >
              {subtitleText}
            </p>
          </div>

          {state.phase === 'today' && (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                backgroundColor: subtlePillBg,
                color: primaryText,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Hôm nay thi
            </span>
          )}
        </div>

        {/* Bộ số đếm ngược hoặc trạng thái khi đến giờ thi */}
        {state.phase === 'upcoming' || state.phase === 'today' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: state.phase === 'today' ? 'repeat(3, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
              gap: compact ? 8 : 16,
              marginTop: compact ? 18 : 22,
              textAlign: 'center',
            }}
          >
            {state.phase === 'upcoming' && (
              <div>
                <div
                  className="fj-mono"
                  style={{
                    fontSize: compact ? 28 : 34,
                    fontWeight: 700,
                    lineHeight: 1.05,
                    color: primaryText,
                  }}
                >
                  {state.days}
                </div>
                <div style={{ fontSize: compact ? 11.5 : 12.5, color: mutedText, marginTop: 6 }}>
                  ngày
                </div>
              </div>
            )}

            <div>
              <div
                className="fj-mono"
                style={{
                  fontSize: compact ? 28 : 34,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  color: primaryText,
                }}
              >
                {pad2(state.hours)}
              </div>
              <div style={{ fontSize: compact ? 11.5 : 12.5, color: mutedText, marginTop: 6 }}>
                giờ
              </div>
            </div>

            <div>
              <div
                className="fj-mono"
                style={{
                  fontSize: compact ? 28 : 34,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  color: primaryText,
                }}
              >
                {pad2(state.minutes)}
              </div>
              <div style={{ fontSize: compact ? 11.5 : 12.5, color: mutedText, marginTop: 6 }}>
                phút
              </div>
            </div>

            <div>
              <div
                className="fj-mono"
                style={{
                  fontSize: compact ? 28 : 34,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  color: primaryText,
                }}
              >
                {pad2(state.seconds)}
              </div>
              <div style={{ fontSize: compact ? 11.5 : 12.5, color: mutedText, marginTop: 6 }}>
                giây
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: compact ? 18 : 22,
              padding: compact ? '12px 14px' : '14px 18px',
              borderRadius: 10,
              backgroundColor: subtlePillBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span style={{ fontSize: compact ? 14 : 15, fontWeight: 700, color: primaryText }}>
              {state.phase === 'ongoing' ? 'Đang diễn ra' : 'Đã kết thúc'}
            </span>
            <span style={{ fontSize: 12, color: mutedText }}>
              {state.phase === 'ongoing'
                ? 'Chúc các em làm bài thật tốt!'
                : 'Kỳ thi đã qua'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
