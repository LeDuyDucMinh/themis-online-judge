import React, { useState } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Problem } from '../../types/judge';
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
} from 'lucide-react';

interface UserProblemListProps {
  onSelectProblem: (problem: Problem) => void;
}

export const UserProblemList: React.FC<UserProblemListProps> = ({ onSelectProblem }) => {
  const { topics, problems, getProblemStatus, submissions, isAdminAuthenticated, currentStudent } = useJudge();

  // State điều hướng: activeTopicId === null là trang chủ đề, !== null là trang danh sách bài của chủ đề đó
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);

  // Bộ lọc bên trong chủ đề hoặc danh sách chung
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SOLVED' | 'UNSOLVED'>('ALL');

  // Lấy điểm số cao nhất của bài (tính riêng theo từng học sinh)
  const getProblemScore = (problemId: string) => {
    let subs = submissions.filter((s) => s.problemId === problemId);
    if (!isAdminAuthenticated && currentStudent) {
      subs = subs.filter((s) => {
        const matchName = s.userName && currentStudent.fullName &&
          s.userName.trim().toLowerCase() === currentStudent.fullName.trim().toLowerCase();
        const matchUser = s.userId && currentStudent.username &&
          s.userId.trim().toLowerCase() === currentStudent.username.trim().toLowerCase();
        return Boolean(matchName || matchUser);
      });
    }
    if (subs.length === 0) return null;
    return Math.max(...subs.map((s) => s.totalPointsEarned));
  };

  // Chủ đề hiện đang được chọn
  const currentTopic = activeTopicId ? topics.find((t) => t.id === activeTopicId) : null;

  // Danh sách bài tập hiển thị (nếu đang trong chủ đề thì chỉ lấy bài của chủ đề đó)
  const topicProblems = activeTopicId
    ? problems.filter((p) => p.topicId === activeTopicId)
    : problems;

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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-all border border-slate-300 dark:border-slate-700 shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 text-blue-500 dark:text-blue-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Quay lại tất cả chủ đề</span>
          </button>

          <div className="text-xs text-slate-400 font-medium">
            <span>Danh mục chủ đề</span>
            <span className="mx-2 text-slate-600">/</span>
            <span className="text-blue-400 font-bold">{currentTopic.name}</span>
          </div>
        </div>

        {/* Header Banner của Chủ Đề */}
        <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <Layers className="w-3.5 h-3.5" />
                Chủ đề luyện tập
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {currentTopic.name}
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                {currentTopic.description || 'Chưa có mô tả cho chủ đề này.'}
              </p>
            </div>

            {/* Tiến độ trong chủ đề này */}
            <div className="bg-slate-900/90 border border-slate-700/80 p-5 rounded-2xl min-w-[260px] shadow-xl shrink-0">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                <span className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Tiến độ hoàn thành
                </span>
                <span className="font-mono font-bold text-blue-400 text-sm">
                  {progressPercent}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/60 mb-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Số bài đã nộp đúng:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {solvedInTopic} / {totalInTopic} bài
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Thanh Tìm kiếm & Lọc bài tập trong chủ đề */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Tìm bài tập trong "${currentTopic.name}" theo tên, mã bài...`}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Lọc theo độ khó */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
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
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
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
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
              <Search className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <h5 className="font-bold text-slate-200 text-base">
                {topicProblems.length === 0
                  ? 'Chủ đề này chưa có bài tập nào'
                  : 'Không tìm thấy bài tập phù hợp bộ lọc'}
              </h5>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {topicProblems.length === 0
                  ? 'Giáo viên sẽ sớm bổ sung các bài tập mới vào chủ đề này. Hãy quay lại sau!'
                  : 'Hãy thử xóa từ khóa tìm kiếm hoặc đặt lại bộ lọc độ khó / trạng thái.'}
              </p>
              {topicProblems.length === 0 && (
                <button
                  onClick={() => setActiveTopicId(null)}
                  className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  Chọn chủ đề khác
                </button>
              )}
            </div>
          ) : (
            filteredProblems.map((prob, index) => {
              const status = getProblemStatus(prob.id);
              const userScore = getProblemScore(prob.id);

              return (
                <div
                  key={prob.id}
                  onClick={() => onSelectProblem(prob)}
                  className="group cursor-pointer bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/60 rounded-2xl p-4 sm:p-5 transition-all shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* Cột Trái: Thứ tự, Trạng thái, Mã bài, Tiêu đề, Tác giả */}
                  <div className="flex items-start sm:items-center gap-4">
                    {/* STT và Icon trạng thái */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono text-xs font-bold text-slate-500 w-5 text-center">
                        #{index + 1}
                      </span>
                      {status === 'SOLVED' ? (
                        <div
                          className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-sm"
                          title="Đã giải đúng 100% (Full AC)"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      ) : status === 'PARTIAL' ? (
                        <div
                          className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs shadow-sm"
                          title={`Đang làm dở: ${userScore}/${prob.totalPoints}đ`}
                        >
                          {userScore}đ
                        </div>
                      ) : (
                        <div
                          className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-500 flex items-center justify-center"
                          title="Chưa nộp bài"
                        >
                          <Clock className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/15 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-500/30">
                          {prob.code}
                        </span>
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                          {prob.title}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>{prob.author || 'FAMINH Judge'}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> {prob.timeLimit}s
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono">
                          <HardDrive className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> {prob.memoryLimit}MB
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400">
                          <Award className="w-3.5 h-3.5" /> {prob.totalPoints} điểm
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cột Phải: Độ khó, Kết quả điểm số, Nút làm bài */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                    <div className="flex items-center gap-3">
                      {/* Badge Độ khó */}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          prob.difficulty === 'Dễ'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : prob.difficulty === 'Trung bình'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {prob.difficulty}
                      </span>

                      {/* Điểm học sinh đạt được */}
                      <div className="text-right">
                        {status === 'SOLVED' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold font-mono text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-xl border border-emerald-500/30 shadow-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{prob.totalPoints} / {prob.totalPoints} điểm - Đã hoàn thành</span>
                          </span>
                        ) : status === 'PARTIAL' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold font-mono text-amber-400 bg-amber-500/15 px-3 py-1 rounded-xl border border-amber-500/30 shadow-sm">
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{userScore} / {prob.totalPoints} điểm - Đang làm</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium font-mono text-slate-400 bg-slate-800/80 px-3 py-1 rounded-xl border border-slate-700/60">
                            <span>Chưa làm</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Nút Làm Bài */}
                    <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600/90 group-hover:bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-600/20 group-hover:scale-105 transition-all">
                      <span>Làm bài</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Hero Banner FAMINH */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-950 via-slate-900 to-slate-900 p-8 border border-red-500/20 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-red-400" /> Hệ thống Luyện thi FAMINH JUDGE
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Nền Tảng Luyện Code & Chấm Điểm Chuẩn Themis
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Học sinh tự do luyện giải các chủ đề thuật toán, nhận kết quả chấm tự động từng phần (Partial Scoring), tự động tương thích{' '}
            <code className="text-red-300 bg-red-950/80 px-1.5 py-0.5 rounded font-mono">freopen</code>,
            và bảng kết quả chi tiết từng test case chuẩn thi Học sinh giỏi Tin học.
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-center">
          <div className="w-24 h-24 rounded-2xl p-1.5 bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 shadow-2xl shadow-red-600/30">
            <img
              src="/faminh-logo.jpg"
              alt="FAMINH Logo"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 mt-2 tracking-widest uppercase">FAMINH</span>
        </div>
      </div>

      {/* Danh Sách Các Ô Chủ Đề Bài Tập */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              Chủ đề bài tập đã giao
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chọn một ô chủ đề bên dưới để xem toàn bộ danh sách bài tập và bắt đầu làm bài
            </p>
          </div>
          <span className="text-xs font-mono text-slate-700 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-sm">
            {topics.length} chủ đề • {problems.length} bài tập
          </span>
        </div>

        {/* Lưới các ô Chủ Đề (Bấm vào để chuyển trang danh sách bài) */}
        {topics.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center shadow-lg">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8 text-blue-400 opacity-60" />
            </div>
            <h4 className="text-lg font-bold text-slate-200">Chưa có chủ đề bài tập nào</h4>
            <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              Hệ thống hiện tại chưa có chủ đề bài tập nào được tạo. Giáo viên / Quản trị viên vui lòng đăng nhập để bắt đầu tạo chủ đề và thêm bài tập.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {topics.map((topic) => {
              const topicProblems = problems.filter((p) => p.topicId === topic.id);
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
                  className="cursor-pointer p-6 rounded-3xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800/90 hover:border-blue-500/60 transition-all duration-200 relative overflow-hidden group shadow-lg hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col justify-between"
                >
                  <div>
                    {/* Top: Icon và số lượng bài */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        <Layers className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80">
                        {solvedInTopic}/{topicProblems.length} bài
                      </span>
                    </div>

                    {/* Tên chủ đề & Mô tả */}
                    <h4 className="font-extrabold text-lg text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {topic.name}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {topic.description || 'Tuyển tập các bài tập rèn luyện tư duy thuật toán theo chủ đề.'}
                    </p>
                  </div>

                  {/* Bottom: Thanh tiến độ hoàn thành */}
                  <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1.5 font-medium">
                      <span>Tiến độ hoàn thành</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {progressPercent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-300 dark:border-slate-700/40">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {/* Call to action */}
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                      <span>Vào làm bài chủ đề này</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
