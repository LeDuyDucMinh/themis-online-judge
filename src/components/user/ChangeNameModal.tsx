import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { X, Loader2 } from 'lucide-react';

export const ChangeNameModal: React.FC = () => {
  const {
    isChangeNameModalOpen,
    setIsChangeNameModalOpen,
    currentStudent,
    updateStudentName,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl border border-[#D9D2C3] bg-[#FFFDF8] p-6 text-[#1F1D1A] shadow-2xl relative transition-all"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      >
        {/* Nút đóng */}
        <button
          onClick={handleClose}
          disabled={isUpdating}
          className="absolute top-5 right-5 text-[#6B655C] hover:text-[#1F1D1A] transition-colors cursor-pointer disabled:opacity-50"
          title="Đóng cửa sổ"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Tiêu đề Modal */}
        <div className="mb-4 pr-6">
          <h3 className="text-xl font-bold text-[#1F1D1A] tracking-tight">
            Đổi họ và tên
          </h3>
          <p className="text-[13px] text-[#6B655C] mt-1.5 leading-snug">
            Tên này hiện trong danh sách lớp, bảng xếp hạng và kết quả chấm bài.
          </p>
        </div>

        {/* Thông tin tài khoản hiện tại */}
        <div className="border-t border-[#E5E0D5] text-[13px]">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[#6B655C]">Tài khoản</span>
            <span
              className="font-mono text-[#1F1D1A] text-right truncate max-w-[220px]"
              title={currentStudent.email || currentStudent.username}
            >
              {currentStudent.email || currentStudent.username}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5 border-t border-[#E5E0D5]">
            <span className="text-[#6B655C]">Tên hiện tại</span>
            <span className="font-bold text-[#1F1D1A] text-right">
              {currentStudent.fullName}
            </span>
          </div>
        </div>

        {/* Form đổi tên */}
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div className="border-t border-[#E5E0D5] pt-4">
            <label className="block text-[13px] font-bold text-[#1F1D1A] mb-2">
              Họ và tên mới
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Nhập họ và tên..."
              disabled={isUpdating}
              autoFocus
              required
              className="w-full px-3.5 py-2.5 bg-white border border-[#1F1D1A] rounded-lg text-sm text-[#1F1D1A] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#1F1D1A] transition-all font-medium"
            />
            <p className="text-[12px] text-[#6B655C] mt-2 leading-relaxed">
              Tên mới có hiệu lực ngay, giáo viên cũng sẽ thấy tên này trong danh sách học sinh.
            </p>
          </div>

          {/* Thông báo lỗi nếu có */}
          {error && (
            <div className="p-2.5 rounded-lg bg-[#B4281F]/10 border border-[#B4281F]/20 text-[#B4281F] text-xs font-medium">
              {error}
            </div>
          )}

          {/* Nút bấm */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isUpdating}
              className="px-4 py-2 text-sm font-medium text-[#1F1D1A] hover:text-[#6B655C] transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isUpdating || !newName.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#B4281F] hover:bg-[#8F1F18] text-white transition-colors cursor-pointer disabled:opacity-50 min-w-[120px]"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>Lưu thay đổi</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
