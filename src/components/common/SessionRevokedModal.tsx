import React from 'react';
import { ShieldAlert, LogIn } from 'lucide-react';
import { useJudge } from '../../context/JudgeContext';

interface SessionRevokedModalProps {
  isOpen?: boolean;
  onConfirm?: () => void;
}

/**
 * Modal thông báo rõ ràng khi tài khoản học sinh bị đăng xuất do có thiết bị khác đăng nhập.
 */
export const SessionRevokedModal: React.FC<SessionRevokedModalProps> = ({ isOpen, onConfirm }) => {
  const { isSessionRevokedModalOpen, handleAcknowledgeRevokedSession } = useJudge();

  const visible = typeof isOpen === 'boolean' ? isOpen : isSessionRevokedModalOpen;
  if (!visible) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      handleAcknowledgeRevokedSession();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-revoked-title"
        className="w-full max-w-[440px] rounded-[12px] bg-[#FFFDF8] border border-[#D9D2C3] shadow-2xl overflow-hidden text-[#1F1D1A]"
      >
        <div className="px-6 py-5 bg-[#FEF2F2] border-b border-[#FECACA] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-[#B4281F] text-white flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 id="session-revoked-title" className="text-[17px] font-bold text-[#991B1B] leading-snug">
              Tài khoản đang đăng nhập ở thiết bị khác
            </h3>
            <p className="text-[12.5px] text-[#7F1D1D]/80 mt-0.5">
              Phiên làm việc trên thiết bị này đã kết thúc
            </p>
          </div>
        </div>

        <div className="p-6 space-y-3 text-[14px] leading-relaxed text-[#3F3A33]">
          <p>
            Tài khoản học sinh của em vừa được đăng nhập trên một <b>thiết bị hoặc trình duyệt khác</b>.
          </p>
          <p className="text-[13px] text-[#6B655C]">
            Theo quy định chống chia sẻ tài khoản, mỗi tài khoản học sinh chỉ được sử dụng trên{' '}
            <b>1 thiết bị tại một thời điểm</b>. Nếu không phải em đăng nhập, hãy đổi mật khẩu hoặc báo cho giáo viên.
          </p>
        </div>

        <div className="px-6 py-4 bg-[#F4F0E8] border-t border-[#D9D2C3] flex justify-end">
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-[8px] bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[14px] font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Về trang Đăng nhập</span>
          </button>
        </div>
      </div>
    </div>
  );
};
