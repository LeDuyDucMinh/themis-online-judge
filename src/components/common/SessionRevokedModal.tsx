import React from 'react';
import { AlertTriangle, LogIn } from 'lucide-react';

interface SessionRevokedModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

/**
 * Modal hiển thị theo Cơ chế "Lưới điện" (Action-Triggered Logout)
 * - Màn hình làm mờ lại (backdrop-blur-md)
 * - Biểu tượng cảnh báo và thông báo thu hồi tài khoản
 * - Duy nhất 1 nút "Về trang Đăng nhập"
 * - Không cho phép bấm ra ngoài hoặc bấm phím để tắt
 */
export const SessionRevokedModal: React.FC<SessionRevokedModalProps> = ({
  isOpen,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div
        className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full shadow-2xl shadow-red-950/60 overflow-hidden relative p-6 sm:p-8 text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow effect phía trên */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-amber-500/15 blur-2xl rounded-full pointer-events-none" />

        {/* Biểu tượng cảnh báo */}
        <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 mb-5 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-amber-500/10 border border-amber-500/30 animate-pulse" />
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <AlertTriangle className="w-8 h-8 sm:w-9 sm:h-9 text-amber-400" />
          </div>
        </div>

        {/* Tiêu đề */}
        <h3 className="text-lg sm:text-xl font-bold text-white mb-3 tracking-tight">
          Thông Báo Phiên Đăng Nhập
        </h3>

        {/* Nội dung thông báo theo đúng yêu cầu */}
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6 px-1">
          Phiên đăng nhập đã hết hạn hoặc tài khoản đã được thu hồi. Vui lòng liên hệ Giáo viên để biết thêm chi tiết.
        </p>

        {/* Nút duy nhất: Về trang Đăng nhập */}
        <button
          type="button"
          onClick={onConfirm}
          className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-[0.98] transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>Về trang Đăng nhập</span>
        </button>
      </div>
    </div>
  );
};
