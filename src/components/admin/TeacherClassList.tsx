import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Classroom } from '../../types/judge';
import { isProblemInClass } from '../../types/judge';
import { X } from 'lucide-react';

export const TeacherClassList: React.FC = () => {
  const {
    classes,
    createClass,
    updateClass,
    deleteClass,
    setActiveClassId,
    getStudentsInClass,
    problems,
    topics,
    showToast,
    openConfirmModal,
    refreshAllData,
  } = useJudge();

  useEffect(() => {
    refreshAllData().catch(() => {});
    const interval = setInterval(() => {
      refreshAllData().catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Classroom | null>(null);
  const [classNameInput, setClassNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');

  const handleOpenCreateModal = () => {
    setEditingClass(null);
    setClassNameInput('');
    setDescriptionInput('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cls: Classroom) => {
    setEditingClass(cls);
    setClassNameInput(cls.className);
    setDescriptionInput(cls.description);
    setIsModalOpen(true);
  };

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classNameInput.trim()) {
      showToast('Thiếu thông tin', 'Vui lòng nhập tên lớp học!', 'warning');
      return;
    }

    if (editingClass) {
      updateClass(editingClass.id, {
        className: classNameInput.trim(),
        description: descriptionInput.trim(),
      });
    } else {
      createClass(classNameInput.trim(), descriptionInput.trim());
    }

    setIsModalOpen(false);
  };

  const handleDeleteClass = (cls: Classroom) => {
    openConfirmModal({
      title: `Xóa lớp "${cls.className}"`,
      message: `Bạn có chắc chắn muốn xóa lớp học này không? Toàn bộ học sinh và bài tập thuộc lớp sẽ được ngắt kết nối.`,
      confirmLabel: 'Xác nhận xóa lớp',
      onConfirm: () => {
        deleteClass(cls.id);
      },
    });
  };

  const handleCopyJoinCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    showToast('Đã sao chép mã lớp', `Mã "${code}" đã được lưu vào bộ nhớ tạm. Gửi mã này cho học sinh để vào lớp.`, 'success');
  };

  const filteredClasses = classes.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.className.toLowerCase().includes(q) ||
      c.joinCode.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1F1D1A] tracking-tight">
            Quản lý lớp học
          </h1>
          <p className="text-sm text-[#6B655C] mt-1">
            Mỗi lớp là một không gian riêng với đề bài, học sinh và bảng điểm của lớp đó.
          </p>
        </div>

        <div>
          <button
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 rounded-lg bg-[#B4281F] hover:bg-[#8F1F18] text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Tạo lớp học mới
          </button>
        </div>
      </div>

      {/* Search Bar & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm theo tên lớp hoặc mã tham gia"
          className="w-full max-w-xl px-4 py-2.5 bg-white border border-[#D9D2C3] rounded-lg text-sm text-[#1F1D1A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1F1D1A]"
        />

        <div className="text-sm text-[#6B655C] whitespace-nowrap">
          Tổng cộng {filteredClasses.length} lớp
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto pt-2">
        <div className="min-w-[760px]">
          {/* Table Header */}
          <div className="border-t-2 border-[#1F1D1A] py-3 grid grid-cols-[240px_180px_140px_120px_1fr] items-center gap-3 text-[13px] text-[#6B655C] font-normal">
            <div>Lớp</div>
            <div>Mã tham gia</div>
            <div>Học sinh</div>
            <div>Bài tập</div>
            <div></div>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="border-t border-[#D9D2C3] py-12 text-center text-[#6B655C]">
              <p className="text-base font-bold text-[#1F1D1A]">
                {searchTerm ? 'Không tìm thấy lớp học nào' : 'Bạn chưa có lớp học nào'}
              </p>
              <p className="text-xs text-[#6B655C] mt-1">
                {searchTerm
                  ? 'Thử tìm kiếm với từ khóa khác hoặc mã lớp chính xác.'
                  : 'Hãy bấm nút "Tạo lớp học mới" ở trên để bắt đầu tổ chức khóa học.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#D9D2C3]">
              {filteredClasses.map((cls) => {
                const studentCount = getStudentsInClass(cls.id).length;
                const problemCount = problems.filter((p) =>
                  isProblemInClass(p, cls.id, topics, classes)
                ).length;

                return (
                  <div
                    key={cls.id}
                    className="py-4 grid grid-cols-[240px_180px_140px_120px_1fr] items-center gap-3 text-sm hover:bg-black/[0.01] transition-colors"
                  >
                    {/* Cột Lớp */}
                    <div>
                      <span className="font-bold text-[#1F1D1A] text-sm block">
                        {cls.className}
                      </span>
                      <span className="text-xs text-[#6B655C] block mt-0.5">
                        Tạo ngày {new Date(cls.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    {/* Cột Mã tham gia */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#1F1D1A]">
                        {cls.joinCode}
                      </span>
                      <button
                        onClick={(e) => handleCopyJoinCode(cls.joinCode, e)}
                        className="text-xs text-[#6B655C] hover:text-[#1F1D1A] underline cursor-pointer"
                      >
                        Sao chép
                      </button>
                    </div>

                    {/* Cột Học sinh */}
                    <div className="text-sm text-[#1F1D1A]">
                      {studentCount} học sinh
                    </div>

                    {/* Cột Bài tập */}
                    <div className="text-sm text-[#1F1D1A]">
                      {problemCount} bài
                    </div>

                    {/* Cột Thao tác */}
                    <div className="text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEditModal(cls)}
                        className="text-sm text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDeleteClass(cls)}
                        className="text-sm text-[#6B655C] hover:text-[#B4281F] cursor-pointer ml-3"
                      >
                        Xóa
                      </button>
                      <button
                        onClick={() => setActiveClassId(cls.id)}
                        className="text-sm font-semibold text-[#B4281F] hover:underline cursor-pointer ml-4"
                      >
                        Vào quản trị →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Tạo / Sửa lớp học */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] rounded-2xl border border-[#D9D2C3] bg-[#FFFDF8] p-6 text-[#1F1D1A] shadow-2xl relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D5]">
              <h3 className="text-lg font-bold text-[#1F1D1A]">
                {editingClass ? 'Chỉnh sửa Lớp học' : 'Tạo Lớp học mới'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="space-y-4 mt-4">
              <div>
                <label className="block text-[13px] font-bold text-[#1F1D1A] mb-1.5">
                  Tên lớp học / Khóa học: *
                </label>
                <input
                  type="text"
                  value={classNameInput}
                  onChange={(e) => setClassNameInput(e.target.value)}
                  placeholder="Ví dụ: CPP04 - Luyện thi Chuyên Tin"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#1F1D1A] rounded-lg text-sm text-[#1F1D1A] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#1F1D1A]"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#1F1D1A] mb-1.5">
                  Mô tả / Ghi chú:
                </label>
                <textarea
                  rows={3}
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="Mô tả nội dung hoặc yêu cầu khóa học..."
                  className="w-full p-3 bg-white border border-[#D9D2C3] rounded-lg text-sm text-[#1F1D1A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1F1D1A]"
                />
              </div>

              {!editingClass && (
                <p className="text-[12px] text-[#6B655C] leading-relaxed">
                  Mã tham gia lớp (Join Code) 6 ký tự sẽ được tự động sinh ngẫu nhiên sau khi tạo.
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E0D5]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[#1F1D1A] hover:text-[#6B655C] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#B4281F] hover:bg-[#8F1F18] text-white transition-colors cursor-pointer"
                >
                  {editingClass ? 'Lưu thay đổi' : 'Tạo lớp ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
