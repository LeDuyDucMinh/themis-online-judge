import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import {
  UserCheck,
  X,
  Check,
  Loader2,
  Mail,
  Sparkles,
} from 'lucide-react';

export const ChangeNameModal: React.FC = () => {
  const {
    isChangeNameModalOpen,
    setIsChangeNameModalOpen,
    currentStudent,
    updateStudentName,
    theme,
  } = useJudge();

  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isChangeNameModalOpen && currentStudent) {
      setNewName(currentStudent.fullName || '');
      setError('');
    }
  }, [isChangeNameModalOpen, currentStudent]);

  if (!isChangeNameModalOpen || !currentStudent) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean) {
      setError('Họ và tên không được để trống!');
      return;
    }
    if (clean === currentStudent.fullName) {
      setIsChangeNameModalOpen(false);
      return;
    }

    setIsUpdating(true);
    setError('');
    try {
      const res = await updateStudentName(clean);
      if (!res.success) {
        setError(res.message);
      } else {
        setIsChangeNameModalOpen(false);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    if (isUpdating) return;
    setIsChangeNameModalOpen(false);
    setError('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 sm:p-7 relative overflow-hidden transition-all duration-200 ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-900/10'
            : 'bg-[#0c1017] border-slate-800 text-white shadow-black/60'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng */}
        <button
          onClick={handleClose}
          disabled={isUpdating}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          title="Đóng cửa sổ"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Tiêu đề Modal */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Đổi họ và tên</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cập nhật tên hiển thị trong lớp học và bài thi Themis
            </p>
          </div>
        </div>

        {/* Thông tin tài khoản hiện tại */}
        <div className="mb-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Tài khoản:</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Mail className="w-3 h-3 text-red-400" />
              <span>{currentStudent.email || currentStudent.username}</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Tên hiện tại:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {currentStudent.fullName}
            </span>
          </div>
        </div>

        {/* Form đổi tên */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Họ và tên mới <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Nhập họ và tên đầy đủ (ví dụ: Lê Duy Đức Minh)..."
              disabled={isUpdating}
              autoFocus
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#07090e] border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-all"
            />
          </div>

          {/* Thông báo lỗi nếu có */}
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
              {error}
            </div>
          )}

          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400 leading-relaxed">
            💡 Tên mới sẽ được cập nhật ngay lập tức và đồng bộ lên hệ thống để Giáo viên nhìn thấy trong danh sách học sinh và kết quả chấm bài.
          </div>

          {/* Nút bấm */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isUpdating}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isUpdating || !newName.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25 transition-all cursor-pointer hover:scale-[1.02] disabled:opacity-50"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Lưu thay đổi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
