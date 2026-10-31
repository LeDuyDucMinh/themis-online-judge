import React, { useState, useMemo, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Classroom } from '../../types/judge';
import { isProblemInClass } from '../../types/judge';
import {
  GraduationCap,
  Plus,
  ArrowRight,
  CheckCircle2,
  X,
  Sparkles,
  KeyRound,
  FileCode2,
  LogOut,
} from 'lucide-react';


export const StudentClassList: React.FC = () => {
  const {
    classes,
    studentClasses,
    pendingClasses,
    setActiveClassId,
    joinClassByCode,
    currentStudent,
    problems,
    topics,
    getProblemStatus,
    theme,
    refreshAllData,
    showToast,
    leaveClass,
    openConfirmModal,
  } = useJudge();

  // Luôn nạp dữ liệu lớp học và tự động cập nhật khi giáo viên phê duyệt yêu cầu vào lớp
  useEffect(() => {
    refreshAllData();
    const interval = setInterval(() => {
      refreshAllData().catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLeaveClass = (e: React.MouseEvent, cls: Classroom) => {
    e.stopPropagation();
    openConfirmModal({
      title: 'Rời khỏi lớp học',
      message: `Em có chắc chắn muốn rời khỏi lớp "${cls.className}"? Em sẽ cần nhập lại mã mời nếu muốn tham gia lại lớp này sau.`,
      confirmLabel: 'Xác nhận rời lớp',
      onConfirm: () => {
        leaveClass(cls.id);
      },
    });
  };

  // Tính tổng số bài đã đạt Full AC trên các chủ đề/lớp học đã được giao cho học sinh
  const totalSolvedCount = useMemo(() => {
    const candidateProblemIds = new Set<string>();
    if (studentClasses.length > 0) {
      studentClasses.forEach((cls) => {
        problems.forEach((p) => {
          if (isProblemInClass(p, cls.id, topics, classes)) {
            candidateProblemIds.add(p.id);
          }
        });
      });
    } else {
      problems.forEach((p) => candidateProblemIds.add(p.id));
    }

    let count = 0;
    candidateProblemIds.forEach((pid) => {
      if (getProblemStatus(pid) === 'SOLVED') {
        count++;
      }
    });

    // Đảm bảo không bỏ sót bất kỳ bài nào học sinh đã nộp đạt AC
    problems.forEach((p) => {
      if (!candidateProblemIds.has(p.id) && getProblemStatus(p.id) === 'SOLVED') {
        count++;
      }
    });

    return count;
  }, [studentClasses, problems, topics, getProblemStatus]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await joinClassByCode(joinCodeInput.trim());
      if (res.success) {
        setIsJoinModalOpen(false);
        setJoinCodeInput('');
        if (res.classroom && !res.pending) {
          setActiveClassId(res.classroom.id);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Hero Banner Chào mừng Học sinh - Phong cách 2D Minimalist FAMINH */}
      <div className={`p-6 sm:p-8 rounded-2xl border transition-colors ${
        theme === 'light'
          ? 'bg-white border-stone-200 shadow-2xs'
          : 'bg-[#0d121d] border-stone-800'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-50 text-[#c51f26] border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60">
              <Sparkles className="w-3.5 h-3.5" /> Không gian học sinh FAMINH
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white tracking-tight">
              Xin chào, {currentStudent?.fullName || 'Học sinh'}! 🎯
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              Chọn lớp học bên dưới để làm bài thi, nộp code chuẩn Themis và theo dõi kết quả chấm chi tiết.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Stats Pill */}
            <div className={`px-5 py-3 rounded-xl border text-center ${
              theme === 'light' ? 'bg-stone-50 border-stone-200' : 'bg-stone-900/90 border-stone-800'
            }`}>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 font-mono">
                <CheckCircle2 className="w-5 h-5" />
                <span>{totalSolvedCount}</span>
              </div>
              <div className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 mt-0.5 tracking-wider">
                Bài Full AC
              </div>
            </div>

            {/* Nút Tham gia lớp */}
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#c51f26] hover:bg-[#a8181e] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tham gia lớp học</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mục Lớp Đang Chờ Giáo Viên Phê Duyệt (Bảo mật vào lớp) */}
      {pendingClasses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Yêu Cầu Chờ Giáo Viên Duyệt ({pendingClasses.length})</span>
            </h3>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">
              Chờ giáo viên duyệt mã lớp để đảm bảo an toàn & bảo mật
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingClasses.map((cls) => (
              <div
                key={cls.id}
                onClick={() => {
                  showToast(
                    'Đang chờ duyệt',
                    `Yêu cầu tham gia lớp "${cls.className}" đang chờ giáo viên phê duyệt. Em hãy nhắc thầy/cô duyệt vào lớp nhé!`,
                    'info'
                  );
                }}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-amber-50/80 border-amber-200 hover:border-amber-400'
                    : 'bg-amber-950/20 border-amber-800/40 hover:border-amber-700/60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-stone-900 dark:text-white">
                      {cls.className}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      Chờ duyệt
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    Mã vào lớp: <span className="font-mono font-bold text-[#c51f26]">{cls.joinCode}</span>
                  </p>
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                  <span>⏳ Nhấp để xem</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tiêu đề mục lớp học */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#c51f26] dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-900/60 shadow-2xs">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Các Lớp Học Đang Tham Gia</span>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-[#c51f26] dark:text-red-300 border border-red-200 dark:border-red-900/60">
                {studentClasses.length} lớp
              </span>
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Nhấp vào từng lớp để xem đề bài và thực hành nộp bài
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="text-xs font-bold text-[#c51f26] hover:text-[#a8181e] dark:text-red-400 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>+ Nhập mã vào lớp mới</span>
          </button>
        </div>
      </div>

      {/* Grid danh sách lớp học của học sinh */}
      {studentClasses.length === 0 ? (
        <div className={`p-12 text-center rounded-2xl border border-dashed ${
          theme === 'light' ? 'bg-white border-stone-300' : 'bg-[#0d121d] border-stone-800'
        }`}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-[#c51f26] flex items-center justify-center">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-white">Em chưa tham gia lớp học nào</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-md mx-auto leading-relaxed">
            Hãy liên hệ Giáo viên để lấy <b>Mã tham gia lớp (6 ký tự)</b> và nhấn nút bên dưới để vào lớp học nhé!
          </p>
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c51f26] hover:bg-[#a8181e] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>Nhập mã tham gia lớp ngay</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {studentClasses.map((cls: Classroom) => {
            const classProblems = problems.filter((p) => isProblemInClass(p, cls.id, topics, classes));
            const totalProblems = classProblems.length;
            const solvedInClass = classProblems.filter((p) => getProblemStatus(p.id) === 'SOLVED').length;
            const percent = totalProblems > 0 ? Math.round((solvedInClass / totalProblems) * 100) : 0;

            return (
              <div
                key={cls.id}
                onClick={() => setActiveClassId(cls.id)}
                className={`group rounded-2xl border p-5 flex flex-col justify-between transition-all duration-150 cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white border-stone-200 hover:border-[#c51f26] hover:shadow-sm'
                    : 'bg-[#0d121d] border-stone-800 hover:border-red-500/50'
                }`}
              >
                <div className="space-y-3.5">
                  {/* Header Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#c51f26] dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-900/60 shrink-0 shadow-2xs">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-stone-900 dark:text-white group-hover:text-[#c51f26] dark:group-hover:text-red-400 transition-colors truncate">
                          {cls.className}
                        </h3>
                        <span className="text-[11px] text-stone-400 dark:text-stone-500">
                          {cls.createdAt ? `Tạo ngày ${new Date(cls.createdAt).toLocaleDateString('vi-VN')}` : 'Lớp học Themis'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                        theme === 'light'
                          ? 'bg-stone-50 text-stone-700 border-stone-200'
                          : 'bg-stone-900 text-stone-300 border-stone-800'
                      }`}>
                        Mã: {cls.joinCode}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleLeaveClass(e, cls)}
                        className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Rời khỏi lớp học này"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 min-h-[32px] leading-relaxed">
                    {cls.description || 'Chưa có mô tả cho lớp học này.'}
                  </p>

                  {/* Progress Bar Tiến độ giải bài */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500 dark:text-stone-400 font-medium">Tiến độ bài tập:</span>
                      <span className="font-bold font-mono text-stone-900 dark:text-white">
                        {solvedInClass} / {totalProblems} ({percent}%)
                      </span>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden border ${
                      theme === 'light'
                        ? 'bg-stone-100 border-stone-200'
                        : 'bg-stone-950 border-stone-800'
                    }`}>
                      <div
                        className="h-full bg-[#c51f26] rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-5 pt-3.5 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 font-medium">
                    <FileCode2 className="w-3.5 h-3.5 text-amber-500" />
                    <b>{totalProblems}</b> bài tập
                  </span>

                  <span className="inline-flex items-center gap-1 font-bold text-[#c51f26] group-hover:translate-x-1 transition-transform">
                    <span>Vào làm bài</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nhập Mã Tham Gia Lớp */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className={`border rounded-2xl max-w-md w-full p-6 shadow-xl relative ${
            theme === 'light' ? 'bg-white border-stone-200' : 'bg-[#0c1017] border-stone-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/40 text-[#c51f26] dark:text-red-400 border border-red-200 dark:border-red-900/60 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <span>Tham gia Lớp học mới</span>
              </h3>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleJoinClass} className="space-y-5 mt-5">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
                  Nhập mã tham gia lớp (6 ký tự):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="VÍ DỤ: ABCXYZ"
                  className="w-full text-center tracking-widest font-mono uppercase text-2xl font-black py-3 bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-[#c51f26] placeholder-stone-400 focus:outline-none focus:border-[#c51f26] focus:ring-1 focus:ring-[#c51f26] transition-colors"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2 text-center">
                  Mã lớp học gồm các chữ cái/số do Giáo viên cung cấp (ví dụ: <b className="font-mono text-stone-700 dark:text-stone-300">ABCXYZ</b>).
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!joinCodeInput.trim() || isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#c51f26] hover:bg-[#a8181e] disabled:opacity-50 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Đang kiểm tra...' : 'Vào lớp ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
