import React, { useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

export const ConfirmModal: React.FC = () => {
  const { confirmModalState, closeConfirmModal } = useJudge();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeConfirmModal();
      }
    };
    if (confirmModalState.isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmModalState.isOpen, closeConfirmModal]);

  if (!confirmModalState.isOpen) return null;

  const handleConfirm = () => {
    confirmModalState.onConfirm();
    closeConfirmModal();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) closeConfirmModal();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className="bg-slate-900 border border-red-500/40 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden relative p-6 text-center animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={closeConfirmModal}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon */}
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-white tracking-tight">
          {confirmModalState.title || 'Xác nhận xóa'}
        </h3>

        {/* Message */}
        <p className="text-xs text-slate-300 mt-2 leading-relaxed max-w-sm mx-auto">
          {confirmModalState.message}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mt-6 pt-2">
          <button
            type="button"
            onClick={closeConfirmModal}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/30 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>{confirmModalState.confirmLabel || 'Xác nhận xóa'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

