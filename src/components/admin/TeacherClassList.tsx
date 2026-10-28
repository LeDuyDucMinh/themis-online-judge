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
      {/* Top Header REX Admin style */}
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c51f26] hover:bg-[#a8181e] text-white text-xs font-bold transition-all shadow-sm cursor-pointer hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo lớp học mới</span>
          </button>
        </div>
      </div>

      {/* Filter Bar REX Admin style */}
      <div className="p-4 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên lớp học, mã tham gia (Join Code)..."
            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-xl text-xs text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#c51f26] focus:ring-1 focus:ring-[#c51f26]"
          />
        </div>

        <div className="text-xs font-semibold text-stone-500 dark:text-slate-400">
          Tổng cộng: <b className="text-[#c51f26] font-black">{filteredClasses.length}</b> lớp học
        </div>
      </div>

      {/* Grid Danh sách lớp học REX Admin style */}
      {filteredClasses.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-stone-300 bg-white shadow-2xs">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 text-[#c51f26] border border-red-100 flex items-center justify-center">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Không tìm thấy lớp học nào</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'Không có lớp học nào khớp với từ khóa tìm kiếm của bạn.'
              : 'Hãy bấm "Tạo lớp học mới" để bắt đầu mở lớp và giao đề cho học sinh.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c51f26] hover:bg-[#a8181e] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tạo lớp học đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map((cls) => {
            const studentCount = getStudentsInClass(cls.id).length;
            const pendingCount = getPendingStudentsInClass(cls.id).length;
            const classProblems = problems.filter((p) => isProblemInClass(p, cls.id, topics));
            const problemCount = classProblems.length;

            return (
              <div
                key={cls.id}
                onClick={() => setActiveClassId(cls.id)}
                className="group rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between transition-all duration-200 hover:border-[#c51f26]/40 dark:hover:border-red-500/40 hover:shadow-lg cursor-pointer relative overflow-hidden"
              >
                <div className="space-y-3 relative z-10">
                  {/* Header Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-500/10 text-[#c51f26] dark:text-red-400 border border-red-100 dark:border-red-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-black text-stone-900 dark:text-white group-hover:text-[#c51f26] dark:group-hover:text-red-400 transition-colors truncate">
                            {cls.className}
                          </h3>
                          {pendingCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 shrink-0 animate-pulse">
                              ⏳ {pendingCount} chờ duyệt
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-400 dark:text-slate-500 font-medium">
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
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                        title="Chỉnh sửa thông tin lớp"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClass(cls);
                        }}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Xóa lớp học này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-stone-500 dark:text-slate-400 line-clamp-2 min-h-[32px] leading-relaxed">
                    {cls.description || 'Chưa có mô tả cho lớp học này.'}
                  </p>

                  {/* Join Code Badge with Copy button */}
                  <div className="p-3.5 rounded-xl border border-stone-200/90 dark:border-slate-800 bg-stone-50/80 dark:bg-slate-800/60 flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-stone-400 dark:text-slate-400 uppercase tracking-wider">
                        MÃ THAM GIA LỚP:
                      </span>
                      <span className="font-mono font-black text-base text-[#c51f26] dark:text-red-400 tracking-wider">
                        {cls.joinCode}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleCopyJoinCode(cls.joinCode, e)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                        copiedCode === cls.joinCode
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-white border-stone-300 hover:border-[#c51f26] hover:bg-red-50/50 text-stone-700 hover:text-[#c51f26]'
                      }`}
                      title="Sao chép mã gửi cho học sinh"
                    >
                      {copiedCode === cls.joinCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy mã</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Footer Info & Enter Button */}
                <div className="mt-5 pt-4 border-t border-stone-100 dark:border-slate-800/80 flex items-center justify-between text-xs relative z-10">
                  <div className="flex items-center gap-3 text-stone-500 dark:text-slate-400 font-semibold">
                    <span className="flex items-center gap-1.5" title="Số lượng học sinh trong lớp">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <b>{studentCount}</b> hs
                      {pendingCount > 0 && (
                        <span className="text-amber-600 font-bold" title="Học sinh đang chờ duyệt">
                          (+{pendingCount})
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
