import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Classroom } from '../../types/judge';
import { isProblemInClass } from '../../types/judge';
import {
  GraduationCap,
  Plus,
  Search,
  Users,
  FileCode2,
  Copy,
  Check,
  Edit2,
  Trash2,
  ArrowRight,
  X,
  Sparkles,
} from 'lucide-react';

export const TeacherClassList: React.FC = () => {
  const {
    classes,
    createClass,
    updateClass,
    deleteClass,
    setActiveClassId,
    getStudentsInClass,
    getPendingStudentsInClass,
    problems,
    topics,
    showToast,
    openConfirmModal,
    theme,
    refreshAllData,
  } = useJudge();

  // Tự động nạp dữ liệu lớp học mới nhất từ Database và làm mới ngầm định kỳ
  useEffect(() => {
    refreshAllData().catch(() => {});
    const interval = setInterval(() => {
      refreshAllData().catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
    setCopiedCode(code);
    showToast('Đã sao chép mã lớp', `Mã "${code}" đã được lưu vào bộ nhớ tạm. Gửi mã này cho học sinh để vào lớp.`, 'success');
    setTimeout(() => {
      setCopiedCode(null);
    }, 2500);
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
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-[#c51f26]">
            LỚP HỌC & KHÓA LUYỆN THI
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white tracking-tight mt-0.5">
            Quản lý lớp học
          </h2>
          <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Mỗi lớp học là một không gian độc lập với đề bài, học sinh và bảng điểm riêng biệt chuẩn FAMINH.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#c51f26] hover:bg-[#a8181e] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo lớp học mới</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên lớp học, mã tham gia (Join Code)..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#c51f26]"
          />
        </div>

        <div className="text-xs text-stone-500 dark:text-slate-400">
          Tổng cộng: <b className="text-[#c51f26] font-bold">{filteredClasses.length}</b> lớp học
        </div>
      </div>

      {/* Class List Grid */}
      {filteredClasses.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-stone-300 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
          <GraduationCap className="w-12 h-12 text-stone-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-bold text-stone-700 dark:text-stone-300">
            {searchTerm ? 'Không tìm thấy lớp học nào' : 'Bạn chưa có lớp học nào'}
          </h3>
          <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'Thử tìm kiếm với từ khóa khác hoặc mã lớp chính xác.'
              : 'Hãy bấm nút "Tạo lớp học mới" ở trên để bắt đầu tổ chức khóa học và phân phát đề bài.'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#c51f26] text-white text-xs font-bold hover:bg-[#a8181e] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo lớp đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {filteredClasses.map((cls) => {
            const studentCount = getStudentsInClass(cls.id).length;
            const pendingCount = getPendingStudentsInClass(cls.id).length;
            const problemCount = problems.filter((p) =>
              isProblemInClass(p, cls.id, topics, classes)
            ).length;

            return (
              <div
                key={cls.id}
                onClick={() => setActiveClassId(cls.id)}
                className="group relative p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-[#c51f26]/60 transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 text-[#c51f26] flex items-center justify-center shrink-0">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-stone-900 dark:text-white group-hover:text-[#c51f26] transition-colors">
                          {cls.className}
                        </h3>
                        <span className="text-[11px] text-stone-400">
                          Tạo ngày {new Date(cls.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenEditModal(cls)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                        title="Chỉnh sửa thông tin lớp"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClass(cls)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        title="Xóa lớp học này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                    {cls.description || 'Chưa có mô tả cho lớp học này.'}
                  </p>

                  {/* Join Code Box */}
                  <div className="mt-4 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        MÃ THAM GIA LỚP:
                      </span>
                      <span className="font-mono text-sm font-black text-stone-900 dark:text-white tracking-wider">
                        {cls.joinCode}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleCopyJoinCode(cls.joinCode, e)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-stone-700 hover:bg-stone-100 dark:hover:bg-stone-600 text-stone-700 dark:text-white border border-stone-200 dark:border-stone-600 shadow-2xs transition-colors cursor-pointer"
                      title="Sao chép mã lớp để gửi cho học sinh"
                    >
                      {copiedCode === cls.joinCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500 font-bold">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-stone-400" />
                          <span>Copy mã</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Footer Stats */}
                <div className="mt-5 pt-3.5 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-xs text-stone-500 dark:text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5" title="Số lượng học sinh trong lớp">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <b>{studentCount}</b> hs
                      {pendingCount > 0 && (
                        <span className="text-amber-500 font-bold ml-0.5">
                          (+{pendingCount} chờ)
                        </span>
                      )}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5" title="Số lượng bài tập trong lớp">
                      <FileCode2 className="w-3.5 h-3.5 text-amber-500" />
                      <b>{problemCount}</b> bài
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 font-black text-[#c51f26] group-hover:translate-x-1 transition-transform">
                    <span>Vào quản trị</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tạo / Sửa lớp học */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className={`border rounded-xl max-w-lg w-full p-6 relative ${
            theme === 'light' ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/20 text-[#c51f26] border border-red-100 dark:border-red-900/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white">
                  {editingClass ? 'Chỉnh sửa Lớp học' : 'Tạo Lớp học mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Tên lớp học / Khóa học: *
                </label>
                <input
                  type="text"
                  value={classNameInput}
                  onChange={(e) => setClassNameInput(e.target.value)}
                  placeholder="Ví dụ: Đội tuyển Tin 9 - Trường THCS Chu Văn An"
                  className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:border-[#c51f26]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Mô tả / Ghi chú:
                </label>
                <textarea
                  rows={3}
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="Ví dụ: Khóa học lập trình C++ nâng cao luyện thi Học sinh giỏi các cấp..."
                  className="w-full p-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:border-[#c51f26]"
                />
              </div>

              {!editingClass && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-xs text-[#c51f26] dark:text-red-400">
                  💡 <b>Mã tham gia lớp (Join Code) 6 ký tự</b> sẽ được hệ thống tự động sinh ngẫu nhiên để bạn gửi cho học sinh ngay sau khi tạo.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#c51f26] hover:bg-[#a8181e] text-white text-xs font-bold transition-colors cursor-pointer"
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
