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
} from 'lucide-react';


export const StudentClassList: React.FC = () => {
  const {
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

  // Tính tổng số bài đã đạt Full AC trên các chủ đề/lớp học đã được giao cho học sinh
  const totalSolvedCount = useMemo(() => {
    const candidateProblemIds = new Set<string>();
    if (studentClasses.length > 0) {
      studentClasses.forEach((cls) => {
        problems.forEach((p) => {
          if (isProblemInClass(p, cls.id, topics)) {
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
      {/* Hero Banner Chào mừng Học sinh */}
      <div className={`p-6 sm:p-8 rounded-3xl border relative overflow-hidden shadow-2xl ${
        theme === 'light'
          ? 'bg-gradient-to-r from-red-50/80 via-white to-slate-50 border-red-200 shadow-red-500/5'
          : 'bg-[#0d111a] border-slate-800/90 shadow-2xl'
      }`}>
        {/* Subtle red ambient glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/20">
              <Sparkles className="w-3.5 h-3.5" /> Không gian học sinh FAMINH
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Xin chào, {currentStudent?.fullName || 'Học sinh'}! 🎯
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Chọn lớp học bên dưới để làm bài thi, nộp code chuẩn Themis và theo dõi kết quả chấm chi tiết.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Stats Pill */}
            <div className={`px-5 py-3 rounded-2xl border text-center ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <div className="text-xl font-black text-emerald-500 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>{totalSolvedCount}</span>
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-400 mt-0.5 tracking-wider">
                Bài Full AC
              </div>
            </div>

            {/* Nút Tham gia lớp */}
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/25 cursor-pointer hover:scale-[1.02]"
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
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-amber-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Yêu Cầu Chờ Giáo Viên Duyệt ({pendingClasses.length})</span>
            </h3>
            <span className="text-[11px] text-slate-500">
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
                className={`p-5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-amber-50/80 border-amber-200 hover:border-amber-300 hover:shadow-md'
                    : 'bg-amber-950/20 border-amber-800/40 hover:border-amber-700/60 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {cls.className}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Chờ duyệt
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Mã vào lớp: <span className="font-mono font-bold text-red-500">{cls.joinCode}</span>
                  </p>
                </div>
                <div className="text-xs text-amber-500 font-semibold">
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
          <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center border border-red-500/30 shadow-sm shadow-red-500/10">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Các Lớp Học Đang Tham Gia</span>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                {studentClasses.length} lớp
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Nhấp vào từng lớp để xem đề bài và thực hành nộp bài
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="text-xs font-bold text-red-500 hover:text-red-400 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>+ Nhập mã vào lớp mới</span>
          </button>
        </div>
      </div>

      {/* Grid danh sách lớp học của học sinh */}
      {studentClasses.length === 0 ? (
        <div className={`p-12 text-center rounded-3xl border border-dashed ${
          theme === 'light' ? 'bg-white border-slate-300' : 'bg-[#0d121d] border-slate-800'
        }`}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Em chưa tham gia lớp học nào</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
            Hãy liên hệ Giáo viên để lấy <b>Mã tham gia lớp (6 ký tự)</b> và nhấn nút bên dưới để vào lớp học nhé!
          </p>
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-600/25 cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>Nhập mã tham gia lớp ngay</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studentClasses.map((cls: Classroom) => {
            const classProblems = problems.filter((p) => isProblemInClass(p, cls.id, topics));
            const totalProblems = classProblems.length;
            const solvedInClass = classProblems.filter((p) => getProblemStatus(p.id) === 'SOLVED').length;
            const percent = totalProblems > 0 ? Math.round((solvedInClass / totalProblems) * 100) : 0;

            return (
              <div
                key={cls.id}
                onClick={() => setActiveClassId(cls.id)}
                className={`group rounded-3xl border p-6 flex flex-col justify-between transition-all duration-200 hover:shadow-2xl cursor-pointer relative overflow-hidden ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 hover:border-red-400 hover:shadow-red-500/5'
                    : 'bg-[#0d121d] border-slate-800/80 hover:border-red-500/40 hover:shadow-red-500/10'
                }`}
              >
                {/* Subtle hover red ambient */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none group-hover:bg-red-500/15 transition-colors" />

                <div className="space-y-4 relative z-10">
                  {/* Header Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center border border-red-500/30 group-hover:scale-105 transition-transform shadow-sm">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-red-400 transition-colors line-clamp-1">
                          {cls.className}
                        </h3>
                        <span className="text-[11px] text-slate-500">
                          {cls.createdAt ? `Tạo ngày ${new Date(cls.createdAt).toLocaleDateString('vi-VN')}` : 'Lớp học Themis'}
                        </span>
                      </div>
                    </div>

                    <span className={`font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                      theme === 'light'
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-slate-950/80 text-slate-300 border-slate-800'
                    }`}>
                      Mã: {cls.joinCode}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[32px] leading-relaxed">
                    {cls.description || 'Chưa có mô tả cho lớp học này.'}
                  </p>

                  {/* Progress Bar Tiến độ giải bài */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Tiến độ bài tập:</span>
                      <span className="font-bold font-mono text-slate-900 dark:text-white">
                        {solvedInClass} / {totalProblems} ({percent}%)
                      </span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden border ${
                      theme === 'light'
                        ? 'bg-slate-100 border-slate-200'
                        : 'bg-slate-950 border-slate-800/80'
                    }`}>
                      <div
                        className="h-full bg-gradient-to-r from-red-600 to-rose-500 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs relative z-10">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                    <FileCode2 className="w-3.5 h-3.5 text-amber-500" />
                    <b>{totalProblems}</b> bài tập
                  </span>

                  <span className="inline-flex items-center gap-1 font-bold text-red-500 group-hover:translate-x-1 transition-transform">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className={`border rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative ${
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0c1017] border-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <span>Tham gia Lớp học mới</span>
              </h3>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleJoinClass} className="space-y-5 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Nhập mã tham gia lớp (6 ký tự):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="VÍ DỤ: ABCXYZ"
                  className="w-full text-center tracking-widest font-mono uppercase text-2xl font-black py-3.5 bg-slate-50 dark:bg-[#07090e] border border-slate-300 dark:border-slate-800 rounded-2xl text-red-500 placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-center">
                  Mã lớp học gồm các chữ cái/số do Giáo viên cung cấp (ví dụ: <b className="font-mono text-slate-700 dark:text-slate-300">ABCXYZ</b>).
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!joinCodeInput.trim() || isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-red-600/25 transition-all cursor-pointer hover:scale-[1.02]"
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
