import React, { useState } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Problem } from '../../types/judge';
import { isProblemInClass } from '../../types/judge';
import { storageService } from '../../services/storageService';
import {
  CheckCircle2,
  Clock,
  ChevronRight,
  Search,
  BookOpen,
  Layers,
  Sparkles,
  ArrowLeft,
  Award,
  HardDrive,
  User,
  Filter,
  FileCode2,
} from 'lucide-react';

interface UserProblemListProps {
  onSelectProblem: (problem: Problem) => void;
  onBackToClasses?: () => void;
}

export const UserProblemList: React.FC<UserProblemListProps> = ({ onSelectProblem, onBackToClasses }) => {
  const {
    topics,
    problems,
    getProblemStatus,
    submissions,
    isAdminAuthenticated,
    currentStudent,
    activeClassId,
    activeClass,
    setActiveClassId,
    theme,
  } = useJudge();

  // State điều hướng: activeTopicId === null là trang chủ đề, !== null là trang danh sách bài của chủ đề đó
  const [activeTopicId, setActiveTopicIdState] = useState<string | null>(() => {
    return storageService.getActiveTopicId();
  });

  const setActiveTopicId = (id: string | null) => {
    setActiveTopicIdState(id);
    storageService.setActiveTopicId(id);
  };

  // Bộ lọc bên trong chủ đề hoặc danh sách chung
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SOLVED' | 'UNSOLVED'>('ALL');

  // Bộ nhớ đệm tên tùy chỉnh của học sinh để không đọc localStorage lặp lại trong vòng lặp render
  const currentStudentCustomName = React.useMemo(() => {
    if (!currentStudent) return null;
    return storageService.getStudentCustomName(currentStudent.id, currentStudent.email)?.trim().toLowerCase() || null;
  }, [currentStudent]);

  // Lấy điểm số cao nhất của bài (tính riêng theo từng học sinh)
  const getProblemScore = (problemId: string) => {
    let subs = submissions.filter((s) => s.problemId === problemId);
    if (!isAdminAuthenticated && currentStudent) {
      const sId = (currentStudent.id || '').trim().toLowerCase();
      const sUser = (currentStudent.username || '').trim().toLowerCase();
      const sEmail = (currentStudent.email || '').trim().toLowerCase();
      const sName = (currentStudent.fullName || '').trim().toLowerCase();
      const customName = currentStudentCustomName;

      subs = subs.filter((s) => {
        const subUser = (s.userId || '').trim().toLowerCase();
        const subName = (s.userName || '').trim().toLowerCase();
        const matchId = Boolean(sId && subUser && subUser === sId);
        const matchUser = Boolean(sUser && subUser && subUser === sUser);
        const matchEmail = Boolean(sEmail && subUser && subUser === sEmail);
        const matchName = Boolean(sName && subName && subName === sName);
        const matchCustom = Boolean(customName && subName && subName === customName);
        return matchId || matchName || matchUser || matchEmail || matchCustom;
      });
    }
    if (subs.length === 0) return null;
    return Math.max(...subs.map((s) => s.totalPointsEarned));
  };

  // Chủ đề hiện đang được chọn
  const currentTopic = activeTopicId ? topics.find((t) => t.id === activeTopicId) : null;

  // Lọc bài tập chỉ thuộc lớp học hiện tại nếu có activeClassId
  const classScopedProblems = activeClassId
    ? problems.filter((p) => isProblemInClass(p, activeClassId, topics))
    : problems;

  // Lọc chủ đề hiển thị: nếu đang trong lớp học cụ thể, chỉ hiển thị chủ đề giao cho lớp này (hỗ trợ cả mảng classIds và classId) hoặc giao cho tất cả các lớp (ALL)
  const visibleTopics = activeClassId
    ? topics.filter((t) => {
        const assignedIds = t.classIds && t.classIds.length > 0
          ? t.classIds
          : (t.classId ? [t.classId] : ['ALL']);

        if (assignedIds.includes(activeClassId)) return true;
        if (assignedIds.includes('ALL')) {
          // Chủ đề chung: hiển thị nếu có bài tập thuộc lớp này hoặc nếu chủ đề này chưa có bài nào
          const hasClassProblems = classScopedProblems.some((p) => p.topicId === t.id);
          const totalInTopic = problems.filter((p) => p.topicId === t.id).length;
          return hasClassProblems || totalInTopic === 0;
        }
        return false;
      })
    : topics;

  // Danh sách bài tập không thuộc chủ đề nào (giao trực tiếp cho lớp hoặc chưa phân chủ đề)
  const unassignedProblems = classScopedProblems.filter((p) => {
    if (!p.topicId || p.topicId === 'NONE' || p.topicId === '') return true;
    return !topics.some((t) => t.id === p.topicId);
  });

  // Danh sách bài tập hiển thị (nếu đang trong chủ đề thì chỉ lấy bài của chủ đề đó)
  const topicProblems = activeTopicId
    ? classScopedProblems.filter((p) => p.topicId === activeTopicId)
    : classScopedProblems;

  // Render một thẻ bài tập thống nhất cho cả danh sách trong chủ đề và danh sách ngoài chủ đề
  const renderProblemCard = (prob: Problem, index: number) => {
    const status = getProblemStatus(prob.id);
    const userScore = getProblemScore(prob.id);

    return (
      <div
        key={prob.id}
        onClick={() => onSelectProblem(prob)}
        className={`group cursor-pointer rounded-2xl p-4 sm:p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 border ${
          theme === 'light'
            ? 'bg-white border-stone-200 hover:border-[#c51f26] hover:shadow-2xs'
            : 'bg-[#0d121d] border-stone-800 hover:border-red-500/50 hover:bg-stone-800/40'
        }`}
      >
        {/* Cột Trái: Thứ tự, Trạng thái, Mã bài, Tiêu đề, Tác giả */}
        <div className="flex items-start sm:items-center gap-4">
          {/* STT và Icon trạng thái */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className={`font-mono text-xs font-bold w-5 text-center ${
              theme === 'light' ? 'text-slate-400' : 'text-slate-500'
            }`}>
              #{index + 1}
            </span>
            {status === 'SOLVED' ? (
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border ${
                  theme === 'light'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                }`}
                title="Đã giải đúng 100% (Full AC)"
              >
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : status === 'PARTIAL' ? (
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm border ${
                  theme === 'light'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                }`}
                title={`Đang làm dở: ${userScore}/${prob.totalPoints}đ`}
              >
                {userScore}đ
              </div>
            ) : (
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  theme === 'light'
                    ? 'bg-slate-100 border-slate-200 text-slate-400'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
                title="Chưa nộp bài"
              >
                <Clock className="w-4 h-4" />
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                theme === 'light'
                  ? 'text-[#c51f26] bg-red-50 border-red-200'
                  : 'text-red-400 bg-red-950/40 border-red-900/60'
              }`}>
                {prob.code}
              </span>
              <h4 className={`font-bold text-sm sm:text-base group-hover:text-[#c51f26] transition-colors ${
                theme === 'light' ? 'text-stone-900' : 'text-white'
              }`}>
                {prob.title}
              </h4>
            </div>

            <div className={`flex flex-wrap items-center gap-3 text-xs ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              <span className="flex items-center gap-1">
                <User className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`} />
                <span className={theme === 'light' ? 'text-slate-700 font-medium' : 'text-slate-300'}>
                  {prob.author || 'FAMINH Judge'}
                </span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`} /> {prob.timeLimit}s
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono">
                <HardDrive className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-slate-400' : 'text-slate-400'}`} /> {prob.memoryLimit}MB
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-amber-500">
                <Award className="w-3.5 h-3.5" /> {prob.totalPoints} điểm
              </span>
            </div>
          </div>
        </div>

        {/* Cột Phải: Độ khó, Kết quả điểm số, Nút làm bài */}
        <div className={`flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 ${
          theme === 'light' ? 'border-slate-100' : 'border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            {/* Badge Độ khó */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                prob.difficulty === 'Dễ'
                  ? theme === 'light'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : prob.difficulty === 'Trung bình'
                  ? theme === 'light'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : theme === 'light'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {prob.difficulty}
            </span>

            {/* Điểm học sinh đạt được */}
            <div className="text-right">
              {status === 'SOLVED' ? (
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold font-mono px-3 py-1 rounded-xl border shadow-sm ${
                  theme === 'light'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{prob.totalPoints} / {prob.totalPoints} điểm - Đã hoàn thành</span>
                </span>
              ) : status === 'PARTIAL' ? (
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold font-mono px-3 py-1 rounded-xl border shadow-sm ${
                  theme === 'light'
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                }`}>
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{userScore} / {prob.totalPoints} điểm - Đang làm</span>
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium font-mono px-3 py-1 rounded-xl border ${
                  theme === 'light'
                    ? 'text-slate-600 bg-slate-100 border-slate-200'
                    : 'text-slate-400 bg-slate-950 border-slate-800'
                }`}>
                  <span>Chưa làm</span>
                </span>
              )}
            </div>
          </div>

          {/* Nút Làm Bài */}
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/20 group-hover:scale-105 transition-all cursor-pointer">
            <span>Làm bài</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };


  // Lọc bài tập theo từ khóa, độ khó, trạng thái
  const filteredProblems = topicProblems.filter((prob) => {
    const matchSearch =
      prob.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prob.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prob.author && prob.author.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchDiff = selectedDifficulty === 'ALL' || prob.difficulty === selectedDifficulty;

    const status = getProblemStatus(prob.id);
    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'SOLVED' && status === 'SOLVED') ||
      (statusFilter === 'UNSOLVED' && status !== 'SOLVED');

    return matchSearch && matchDiff && matchStatus;
  });

  // ==========================================
  // VIEW 1: TRANG DANH SÁCH BÀI CỦA 1 CHỦ ĐỀ
  // (Được kích hoạt khi học sinh ấn vào ô chủ đề)
  // ==========================================
  if (currentTopic) {
    const totalInTopic = topicProblems.length;
    const solvedInTopic = topicProblems.filter((p) => getProblemStatus(p.id) === 'SOLVED').length;
    const progressPercent = totalInTopic > 0 ? Math.round((solvedInTopic / totalInTopic) * 100) : 0;

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-200">
        {/* Thanh điều hướng quay lại & Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => {
              setActiveTopicId(null);
              setSearchTerm('');
              setSelectedDifficulty('ALL');
              setStatusFilter('ALL');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm group cursor-pointer ${
              theme === 'light'
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
            }`}
          >
            <ArrowLeft className="w-4 h-4 text-red-500 group-hover:-translate-x-0.5 transition-transform" />
            <span>Quay lại tất cả chủ đề</span>
          </button>

          <div className={`text-xs font-medium ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>Danh mục chủ đề</span>
            <span className={`mx-2 ${theme === 'light' ? 'text-slate-400' : 'text-slate-600'}`}>/</span>
            <span className={theme === 'light' ? 'text-red-600 font-bold' : 'text-red-400 font-bold'}>{currentTopic.name}</span>
          </div>
        </div>

        {/* Header Banner của Chủ Đề */}
        <div className={`rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border ${
          theme === 'light'
            ? 'bg-gradient-to-r from-red-50/70 via-white to-slate-50 border-red-200/80 shadow-slate-200/50'
            : 'bg-[#0d121d] border-slate-800/90 shadow-2xl'
        }`}>
          {/* Subtle red ambient glow */}
          <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10 ${
            theme === 'light' ? 'bg-red-400/10' : 'bg-red-600/10'
          }`} />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
                theme === 'light'
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : 'bg-red-500/15 text-red-400 border-red-500/20'
              }`}>
                <Layers className="w-3.5 h-3.5" />
                Chủ đề luyện tập
              </div>
              <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                {currentTopic.name}
              </h1>
              <p className={`text-xs sm:text-sm leading-relaxed ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
              }`}>
                {currentTopic.description || 'Chưa có mô tả cho chủ đề này.'}
              </p>
            </div>

            {/* Tiến độ trong chủ đề này */}
            <div className={`p-5 rounded-2xl min-w-[260px] shadow-xl shrink-0 border ${
              theme === 'light'
                ? 'bg-white border-slate-200 shadow-md'
                : 'bg-slate-950/80 border border-slate-800'
            }`}>
              <div className={`flex items-center justify-between text-xs mb-2 ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-300'
              }`}>
                <span className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className={`w-4 h-4 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`} /> Tiến độ hoàn thành
                </span>
                <span className={`font-mono font-bold text-sm ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`}>
                  {progressPercent}%
                </span>
              </div>

              {/* Progress bar */}
              <div className={`w-full rounded-full h-2.5 overflow-hidden border mb-2 ${
                theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}>
                <div
                  className="bg-gradient-to-r from-red-600 to-rose-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className={`flex items-center justify-between text-[11px] ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>
                <span>Số bài đã nộp đúng:</span>
                <span className={`font-mono font-bold ${theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {solvedInTopic} / {totalInTopic} bài
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Thanh Tìm kiếm & Lọc bài tập trong chủ đề */}
        <div className={`rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm border ${
          theme === 'light'
            ? 'bg-white border-slate-200'
            : 'bg-[#0d121d] border-slate-800/80'
        }`}>
          <div className="flex-1 min-w-[240px] relative">
            <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
              theme === 'light' ? 'text-slate-400' : 'text-slate-500'
            }`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Tìm bài tập trong "${currentTopic.name}" theo tên, mã bài...`}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs transition-colors border focus:outline-none focus:border-red-500 ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  : 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
              }`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Lọc theo độ khó */}
            <div className={`flex items-center gap-1.5 text-xs ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              <Filter className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-red-500' : 'text-red-400'}`} />
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className={`text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-red-500 font-medium border ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200 text-slate-800'
                    : 'bg-slate-950 border-slate-800 text-slate-200'
                }`}
              >
                <option value="ALL">Tất cả độ khó</option>
                <option value="Dễ">Dễ</option>
                <option value="Trung bình">Trung bình</option>
                <option value="Khó">Khó</option>
                <option value="Nâng cao">Nâng cao</option>
              </select>
            </div>

            {/* Lọc theo trạng thái */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'SOLVED' | 'UNSOLVED')}
              className={`text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-red-500 font-medium border ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200 text-slate-800'
                  : 'bg-slate-950 border-slate-800 text-slate-200'
              }`}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="SOLVED">Đã hoàn thành (Full AC)</option>
              <option value="UNSOLVED">Chưa hoàn thành</option>
            </select>
          </div>
        </div>

        {/* Danh sách bài tập của chủ đề - Bố trí gọn gàng, khoa học */}
        <div className="space-y-3">
          {filteredProblems.length === 0 ? (
            <div className={`rounded-3xl p-12 text-center border ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-500'
                : 'bg-[#0d121d] border-slate-800 text-slate-400'
            }`}>
              <Search className={`w-12 h-12 mx-auto mb-3 ${theme === 'light' ? 'text-slate-400' : 'text-slate-600'}`} />
              <h5 className={`font-bold text-base ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
                {topicProblems.length === 0
                  ? 'Chủ đề này chưa có bài tập nào'
                  : 'Không tìm thấy bài tập phù hợp bộ lọc'}
              </h5>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                {topicProblems.length === 0
                  ? 'Giáo viên sẽ sớm bổ sung các bài tập mới vào chủ đề này. Hãy quay lại sau!'
                  : 'Hãy thử xóa từ khóa tìm kiếm hoặc đặt lại bộ lọc độ khó / trạng thái.'}
              </p>
              {topicProblems.length === 0 && (
                <button
                  onClick={() => setActiveTopicId(null)}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/25 transition-all cursor-pointer"
                >
                  Chọn chủ đề khác
                </button>
              )}
            </div>
          ) : (
            filteredProblems.map((prob, index) => renderProblemCard(prob, index))
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: TRANG CHỦ ĐỀ CHÍNH (TOPIC DIRECTORY)
  // (Hiển thị các ô chủ đề, khi ấn vào ô sẽ chuyển sang trang danh sách bài)
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-200">
      {/* Nút quay lại danh sách lớp học nếu đang trong 1 lớp */}
      {activeClass && (
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => {
              if (onBackToClasses) onBackToClasses();
              else setActiveClassId(null);
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-red-500 text-xs font-bold transition-all border border-slate-300 dark:border-slate-700 cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 text-red-500 group-hover:-translate-x-0.5 transition-transform" />
            <span>Quay lại danh sách lớp học</span>
          </button>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">Lớp học hiện tại:</span>
            <span className="px-3 py-1 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 font-black border border-red-500/20">
              {activeClass.className}
            </span>
          </div>
        </div>
      )}

      {/* Hero Banner FAMINH - 2D Minimalist Red & White */}
      <div className={`p-6 sm:p-8 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6 transition-colors ${
        theme === 'light'
          ? 'bg-white border-stone-200 shadow-2xs'
          : 'bg-[#0d121d] border-stone-800'
      }`}>
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-50 text-[#c51f26] border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60 mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Hệ thống Luyện thi FAMINH JUDGE
          </span>

          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white tracking-tight leading-tight">
            Nền Tảng Luyện Code & Chấm Điểm Chuẩn Themis
          </h1>
          <p className="text-stone-600 dark:text-stone-400 text-xs sm:text-sm mt-2 leading-relaxed">
            Học sinh tự do luyện giải các chủ đề thuật toán, nhận kết quả chấm tự động từng phần (Partial Scoring), tự động tương thích{' '}
            <code className="text-[#c51f26] bg-red-50 dark:bg-red-950/60 dark:text-red-300 px-1.5 py-0.5 rounded font-mono font-semibold border border-red-100 dark:border-red-900/40">freopen</code>,
            và bảng kết quả chi tiết từng test case chuẩn thi Học sinh giỏi Tin học.
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-center">
          <div className="w-20 h-20 rounded-2xl p-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs">
            <img
              src="/faminh-logo.jpg"
              alt="FAMINH Logo"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <span className="text-xs font-black text-stone-700 dark:text-stone-300 mt-2 tracking-widest uppercase">FAMINH</span>
        </div>
      </div>

      {/* Danh Sách Các Ô Chủ Đề Bài Tập (nếu lớp có chủ đề) */}
      {visibleTopics.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`text-xl font-bold flex items-center gap-2 ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                <BookOpen className="w-5 h-5 text-red-500" />
                <span>Chủ đề bài tập đã giao</span>
              </h3>
              <p className={`text-xs mt-0.5 ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Chọn một ô chủ đề bên dưới để xem toàn bộ danh sách bài tập và bắt đầu làm bài
              </p>
            </div>
            <span className={`text-xs font-mono px-3 py-1.5 rounded-xl border shadow-sm ${
              theme === 'light'
                ? 'text-slate-700 bg-white border-slate-200'
                : 'text-slate-400 bg-slate-950 border-slate-800'
            }`}>
              {visibleTopics.length} chủ đề • {classScopedProblems.length} bài tập
            </span>
          </div>

          {/* Lưới các ô Chủ Đề (Bấm vào để chuyển trang danh sách bài) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleTopics.map((topic) => {
              const topicProblems = classScopedProblems.filter((p) => p.topicId === topic.id);
              const solvedInTopic = topicProblems.filter(
                (p) => getProblemStatus(p.id) === 'SOLVED'
              ).length;
              const progressPercent =
                topicProblems.length > 0
                  ? Math.round((solvedInTopic / topicProblems.length) * 100)
                  : 0;

              return (
                <div
                  key={topic.id}
                  onClick={() => setActiveTopicId(topic.id)}
                  className={`cursor-pointer p-5 rounded-2xl transition-all duration-150 group border flex flex-col justify-between ${
                    theme === 'light'
                      ? 'bg-white border-stone-200 hover:border-[#c51f26] hover:shadow-2xs'
                      : 'bg-[#0d121d] border-stone-800 hover:border-red-500/50'
                  }`}
                >
                  <div>
                    {/* Top: Icon và số lượng bài */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-[#c51f26] dark:text-red-400 flex items-center justify-center font-bold shadow-2xs group-hover:bg-[#c51f26] group-hover:text-white transition-all">
                        <Layers className="w-5 h-5" />
                      </div>
                      <span className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-lg border ${
                        theme === 'light'
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-slate-950/80 text-slate-300 border-slate-800'
                      }`}>
                        {solvedInTopic}/{topicProblems.length} bài
                      </span>
                    </div>

                    {/* Tên chủ đề & Mô tả */}
                    <h4 className={`font-extrabold text-lg group-hover:text-red-500 transition-colors ${
                      theme === 'light' ? 'text-slate-900' : 'text-white'
                    }`}>
                      {topic.name}
                    </h4>
                    <p className={`text-xs mt-2 line-clamp-2 leading-relaxed ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      {topic.description || 'Tuyển tập các bài tập rèn luyện tư duy thuật toán theo chủ đề.'}
                    </p>
                  </div>

                  {/* Bottom: Thanh tiến độ hoàn thành */}
                  <div className={`mt-6 pt-4 border-t relative z-10 ${
                    theme === 'light' ? 'border-slate-100' : 'border-slate-800/80'
                  }`}>
                    <div className={`flex justify-between text-xs mb-1.5 font-medium ${
                      theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      <span>Tiến độ hoàn thành</span>
                      <span className={`font-mono font-bold ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`}>
                        {progressPercent}%
                      </span>
                    </div>
                    <div className={`w-full rounded-full h-2 overflow-hidden border ${
                      theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
                    }`}>
                      <div
                        className="bg-gradient-to-r from-red-600 to-rose-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {/* Call to action */}
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-red-500 group-hover:text-red-600 transition-colors">
                      <span>Vào làm bài chủ đề này</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Danh Sách Bài Tập Không Thuộc Chủ Đề Nào (Giao trực tiếp cho lớp) */}
      {unassignedProblems.length > 0 && (
        <div className={`space-y-4 ${visibleTopics.length > 0 ? (theme === 'light' ? 'pt-6 border-t border-slate-200' : 'pt-6 border-t border-slate-800') : ''}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className={`text-xl font-bold flex items-center gap-2 ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                <FileCode2 className="w-5 h-5 text-red-500" />
                <span>Bài tập ngoài chủ đề</span>
              </h3>
              <p className={`text-xs mt-0.5 ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Các bài tập được giáo viên giao trực tiếp cho lớp không nằm trong chủ đề nào
              </p>
            </div>
            <span className={`text-xs font-mono font-semibold px-3 py-1.5 rounded-xl border shadow-sm ${
              theme === 'light'
                ? 'text-red-600 bg-red-50 border-red-200'
                : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}>
              {unassignedProblems.length} bài tập
            </span>
          </div>

          {/* Danh sách các bài tập */}
          <div className="space-y-3">
            {unassignedProblems.map((prob, index) => renderProblemCard(prob, index))}
          </div>
        </div>
      )}

      {/* Trạng thái trống: Khi lớp học chưa có bất kỳ bài tập nào */}
      {visibleTopics.length === 0 && unassignedProblems.length === 0 && (
        <div className={`rounded-3xl p-12 text-center shadow-lg border ${
          theme === 'light'
            ? 'bg-white border-slate-200'
            : 'bg-[#0d121d] border-slate-800'
        }`}>
          <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-4 ${
            theme === 'light'
              ? 'bg-red-50 border-red-200 text-red-500'
              : 'bg-slate-950 border-slate-800 text-slate-500'
          }`}>
            <Layers className="w-8 h-8 text-red-500/80" />
          </div>
          <h4 className={`text-lg font-bold ${
            theme === 'light' ? 'text-slate-900' : 'text-slate-200'
          }`}>Chưa có bài tập nào cho lớp học này</h4>
          <p className={`text-xs mt-2 max-w-md mx-auto leading-relaxed ${
            theme === 'light' ? 'text-slate-500' : 'text-slate-500'
          }`}>
            Giáo viên chưa giao chủ đề hoặc bài tập nào vào lớp này. Khi giáo viên tạo hoặc gán bài tập vào lớp, các bài tập sẽ xuất hiện ở đây.
          </p>
        </div>
      )}
    </div>
  );
};
