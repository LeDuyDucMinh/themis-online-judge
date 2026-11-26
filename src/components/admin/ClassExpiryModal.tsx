import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Infinity as InfinityIcon, AlertTriangle } from 'lucide-react';
import {
  addMonthsToExpiry,
  buildExpiryFromDateInput,
  expiryToDateInputValue,
  formatExpiryDateVN,
  getRemainingDays,
  isClassMembershipExpired,
  EXPIRY_WARNING_DAYS,
} from '../../utils/serverTime';

interface ClassExpiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  className: string;
  studentName: string;
  studentEmail?: string;
  currentExpiresAt: string | null;
  nowMs: number;
  onSave: (newExpiresAt: string | null) => Promise<void>;
}

const PRESET_MONTHS = [1, 3, 6, 8, 12];

export const ClassExpiryModal: React.FC<ClassExpiryModalProps> = ({
  isOpen,
  onClose,
  className,
  studentName,
  studentEmail,
  currentExpiresAt,
  nowMs,
  onSave,
}) => {
  const [draftExpiresAt, setDraftExpiresAt] = useState<string | null>(currentExpiresAt);
  const [dateInput, setDateInput] = useState<string>(expiryToDateInputValue(currentExpiresAt));
  const [customMonths, setCustomMonths] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraftExpiresAt(currentExpiresAt);
      setDateInput(expiryToDateInputValue(currentExpiresAt));
      setCustomMonths('');
      setIsSaving(false);
    }
  }, [isOpen, currentExpiresAt]);

  if (!isOpen) return null;

  const handleApplyMonths = (months: number) => {
    if (!Number.isFinite(months) || months < 1) return;
    // Cộng dồn từ ngày hạn hiện tại (nếu đang còn hạn) hoặc từ hôm nay (nếu chưa có hạn)
    const nextIso = addMonthsToExpiry(draftExpiresAt ?? currentExpiresAt, months, nowMs);
    setDraftExpiresAt(nextIso);
    setDateInput(expiryToDateInputValue(nextIso));
  };

  const handleDateChange = (val: string) => {
    setDateInput(val);
    if (!val) {
      setDraftExpiresAt(null);
      return;
    }
    const iso = buildExpiryFromDateInput(val);
    if (iso) setDraftExpiresAt(iso);
  };

  const handleSetUnlimited = () => {
    setDraftExpiresAt(null);
    setDateInput('');
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draftExpiresAt);
      onClose();
    } catch {
      // Toast lỗi đã được xử lý trong JudgeContext
    } finally {
      setIsSaving(false);
    }
  };

  const currentRemaining = getRemainingDays(currentExpiresAt, nowMs);
  const draftRemaining = getRemainingDays(draftExpiresAt, nowMs);
  const isDraftExpired = isClassMembershipExpired(draftExpiresAt, nowMs);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[500px] rounded-[12px] bg-[#FFFDF8] border border-[#D9D2C3] shadow-2xl overflow-hidden text-[#1F1D1A]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#F4F0E8] border-b border-[#D9D2C3] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold text-[#1F1D1A] leading-snug">
              Điều chỉnh thời hạn trong lớp
            </h3>
            <p className="text-[13px] text-[#6B655C] mt-0.5 truncate">
              <b className="text-[#1F1D1A]">{studentName}</b>
              {studentEmail ? ` (${studentEmail})` : ''} · Lớp{' '}
              <b className="text-[#B4281F]">{className}</b>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-[#6B655C] hover:text-[#1F1D1A] hover:bg-black/5 cursor-pointer shrink-0"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Trạng thái hiện tại */}
          <div className="px-4 py-3 rounded-[8px] bg-[#F4F0E8]/70 border border-[#D9D2C3] flex items-center justify-between gap-3 text-[13.5px]">
            <span className="text-[#6B655C] inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#6B655C]" />
              <span>Thời hạn hiện tại:</span>
            </span>
            {currentExpiresAt ? (
              <span
                className={`font-semibold ${
                  currentRemaining !== null && currentRemaining <= EXPIRY_WARNING_DAYS
                    ? 'text-[#B45309]'
                    : 'text-[#1F1D1A]'
                }`}
              >
                {formatExpiryDateVN(currentExpiresAt)}{' '}
                {currentRemaining !== null && currentRemaining >= 0 && (
                  <span className="font-normal text-[#6B655C]">
                    ({currentRemaining === 0 ? 'hết hôm nay' : `còn ${currentRemaining} ngày`})
                  </span>
                )}
              </span>
            ) : (
              <span className="font-semibold text-[#2F6B3F]">Không giới hạn</span>
            )}
          </div>

          {/* 1. Gia hạn nhanh theo tháng */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1F1D1A] mb-2">
              Gia hạn nhanh theo tháng
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_MONTHS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleApplyMonths(m)}
                  className="px-3.5 py-1.5 rounded-[7px] border border-[#D9D2C3] bg-[#FFFDF8] hover:border-[#1F1D1A] hover:bg-[#F4F0E8] text-[13.5px] font-semibold text-[#1F1D1A] transition-colors cursor-pointer"
                >
                  +{m} tháng
                </button>
              ))}
            </div>

            {/* Nhập số tháng tùy ý */}
            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={120}
                value={customMonths}
                onChange={(e) => setCustomMonths(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const n = parseInt(customMonths, 10);
                    if (n >= 1) {
                      handleApplyMonths(n);
                      setCustomMonths('');
                    }
                  }
                }}
                placeholder="Số tháng tùy chỉnh (VD: 4, 9, 18...)"
                className="flex-1 px-3 py-2 rounded-[7px] border border-[#D9D2C3] bg-white text-[13.5px] text-[#1F1D1A] placeholder-[#8C857B] focus:outline-none focus:border-[#1F1D1A]"
              />
              <button
                type="button"
                disabled={!customMonths || parseInt(customMonths, 10) < 1}
                onClick={() => {
                  const n = parseInt(customMonths, 10);
                  if (n >= 1) {
                    handleApplyMonths(n);
                    setCustomMonths('');
                  }
                }}
                className="px-3.5 py-2 rounded-[7px] bg-[#1F1D1A] hover:bg-[#33302B] disabled:opacity-40 text-white text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                + Cộng tháng
              </button>
            </div>
            <p className="text-[12px] text-[#6B655C] mt-1.5">
              Nếu học sinh đang còn hạn, hệ thống tự cộng tiếp từ ngày hết hạn hiện tại để không mất ngày dư.
            </p>
          </div>

          {/* 2. Chọn ngày hết hạn cụ thể hoặc Đặt không giới hạn */}
          <div className="pt-1 border-t border-[#E4DDCE]">
            <label
              htmlFor="expiry-date-picker"
              className="block text-[13px] font-semibold text-[#1F1D1A] mb-2 inline-flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-[#6B655C]" />
              <span>Hoặc chọn ngày hết hạn cụ thể</span>
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                id="expiry-date-picker"
                type="date"
                value={dateInput}
                onChange={(e) => handleDateChange(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-2 rounded-[7px] border border-[#D9D2C3] bg-white text-[14px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
              />
              <button
                type="button"
                onClick={handleSetUnlimited}
                className={`px-3.5 py-2 rounded-[7px] border text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  draftExpiresAt === null
                    ? 'bg-[#2F6B3F] text-white border-[#2F6B3F]'
                    : 'bg-[#FFFDF8] text-[#1F1D1A] border-[#D9D2C3] hover:border-[#1F1D1A]'
                }`}
              >
                <InfinityIcon className="w-3.5 h-3.5" />
                <span>Không giới hạn</span>
              </button>
            </div>
          </div>

          {/* Xem trước kết quả sau khi lưu */}
          <div
            className={`px-4 py-3 rounded-[8px] border text-[13.5px] ${
              isDraftExpired
                ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]'
                : draftExpiresAt === null
                ? 'bg-[#F0F7F2] border-[#B7D6C0] text-[#225431]'
                : 'bg-[#FFFBEB] border-[#FCD34D] text-[#78350F]'
            }`}
          >
            {isDraftExpired ? (
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <b>Ngày {formatExpiryDateVN(draftExpiresAt)} đã qua!</b> Nếu lưu mốc này, học sinh sẽ{' '}
                  <b>tự động bị đưa ra khỏi lớp</b> ngay lập tức.
                </div>
              </div>
            ) : draftExpiresAt === null ? (
              <div>
                <b>Hạn mới: Không giới hạn</b> — học sinh ở trong lớp vĩnh viễn cho tới khi thầy rút hoặc đặt hạn mới.
              </div>
            ) : (
              <div>
                <b>Hạn mới: {formatExpiryDateVN(draftExpiresAt)}</b>{' '}
                <span>
                  ({draftRemaining === 0 ? 'hết hạn cuối ngày hôm nay' : `còn ${draftRemaining} ngày`} · tính đến 23:59 giờ VN).
                </span>
                <div className="text-[12px] opacity-85 mt-0.5">
                  Quá thời điểm này theo giờ Server, tài khoản sẽ tự động rời khỏi lớp "{className}".
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#F4F0E8] border-t border-[#D9D2C3] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] hover:bg-[#E9E2D3] text-[14px] font-medium text-[#1F1D1A] transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirmSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-[8px] bg-[#B4281F] hover:bg-[#8F1F18] disabled:opacity-50 text-white text-[14px] font-semibold transition-colors cursor-pointer"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu thời hạn'}
          </button>
        </div>
      </div>
    </div>
  );
};
