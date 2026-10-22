import React, { useState } from 'react';
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
  ShieldCheck,
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
    problems,
    topics,
    showToast,
    openConfirmModal,
    theme,
  } = useJudge();

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-500 dark:text-red-400 flex items-center justify-center border border-red-500/30 shadow-sm shadow-red-500/10">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Quản Lý Lớp Học & Khóa Luyện Thi</span>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 dark:text-red-400 border border-red-500/20">
                  Multi-Classroom
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Mỗi lớp học là một không gian độc lập với đề bài, học sinh và bảng điểm riêng biệt chuẩn FAMINH
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/25 cursor-pointer hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo lớp học mới</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 shadow-sm ${
        theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên lớp học, mã tham gia (Join Code)..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Tổng cộng: <b className="text-red-500 dark:text-red-400">{filteredClasses.length}</b> lớp học
        </div>
      </div>

      {/* Grid Danh sách lớp học */}
      {filteredClasses.length === 0 ? (
        <div className={`p-12 text-center rounded-3xl border border-dashed ${
          theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-900/50 border-slate-800'
        }`}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Không tìm thấy lớp học nào</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'Không có lớp học nào khớp với từ khóa tìm kiếm của bạn.'
              : 'Hãy bấm "Tạo lớp học mới" để bắt đầu mở lớp và giao đề cho học sinh.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-600/25"
          >
            <Plus className="w-4 h-4" /> Tạo lớp học đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map((cls) => {
            const studentCount = getStudentsInClass(cls.id).length;
            const classProblems = problems.filter((p) => isProblemInClass(p, cls.id, topics));
            const problemCount = classProblems.length;

            return (
              <div
                key={cls.id}
                onClick={() => setActiveClassId(cls.id)}
                className={`group rounded-3xl border p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-xl cursor-pointer relative overflow-hidden ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 hover:border-red-300 hover:shadow-red-500/5'
                    : 'bg-slate-900/90 border-slate-800/90 hover:border-red-500/50 hover:shadow-red-500/10'
                }`}
              >
                {/* Glow accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none group-hover:bg-red-500/10 transition-colors" />

                <div className="space-y-3 relative z-10">
                  {/* Header Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500/20 to-rose-600/20 text-red-500 dark:text-red-400 flex items-center justify-center border border-red-500/30 group-hover:scale-105 transition-transform shadow-sm">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-1">
                          {cls.className}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Tạo ngày {new Date(cls.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>

                    {/* Quick Edit/Delete */}
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(cls);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Chỉnh sửa thông tin lớp"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {cls.id !== 'class_default_faminh' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClass(cls);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                          title="Xóa lớp học này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 min-h-[32px] leading-relaxed">
                    {cls.description || 'Chưa có mô tả cho lớp học này.'}
                  </p>

                  {/* Join Code Badge with Copy button */}
                  <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                    theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
                  }`}>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Mã tham gia lớp:
                      </span>
                      <span className="font-mono font-black text-sm text-red-600 dark:text-red-400 tracking-widest">
                        {cls.joinCode}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleCopyJoinCode(cls.joinCode, e)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        copiedCode === cls.joinCode
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : theme === 'light'
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                      title="Sao chép mã gửi cho học sinh"
                    >
                      {copiedCode === cls.joinCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-red-500" />
                          <span>Copy mã</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Footer Info & Enter Button */}
                <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs relative z-10">
                  <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5" title="Số lượng học sinh trong lớp">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <b>{studentCount}</b> hs
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5" title="Số lượng bài tập trong lớp">
                      <FileCode2 className="w-3.5 h-3.5 text-amber-500" />
                      <b>{problemCount}</b> bài
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400 group-hover:translate-x-0.5 transition-transform">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className={`border rounded-3xl max-w-lg w-full p-6 shadow-2xl relative ${
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingClass ? 'Chỉnh sửa Lớp học' : 'Tạo Lớp học mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên lớp học / Khóa học: *
                </label>
                <input
                  type="text"
                  value={classNameInput}
                  onChange={(e) => setClassNameInput(e.target.value)}
                  placeholder="Ví dụ: Đội tuyển Tin 9 - Trường THCS Chu Văn An"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả / Ghi chú:
                </label>
                <textarea
                  rows={3}
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="Ví dụ: Khóa học lập trình C++ nâng cao luyện thi Học sinh giỏi các cấp..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {!editingClass && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-700 dark:text-red-300">
                  💡 <b>Mã tham gia lớp (Join Code) 6 ký tự</b> sẽ được hệ thống tự động sinh ngẫu nhiên để bạn gửi cho học sinh ngay sau khi tạo.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/25 transition-all"
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
