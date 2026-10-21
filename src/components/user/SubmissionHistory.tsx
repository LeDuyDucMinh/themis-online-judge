import React, { useState, useEffect, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Submission, StudentUser } from '../../types/judge';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  AlertOctagon,
  FileCode2,
  Code2,
  Calendar,
  Layers,
  ChevronRight,
  X,
  User,
  BarChart3,
  BookOpen,
  Users,
} from 'lucide-react';
import { ThemisGradingTable } from './ThemisGradingTable';

export const SubmissionHistory: React.FC = () => {
  const { submissions, problems, topics, theme, isAdminAuthenticated, currentStudent, students } = useJudge();
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);

  // Chế độ xem dành riêng cho GIÁO VIÊN: 'log' = Nhật ký từng lần nộp, 'topic_grades' = Bảng điểm theo Chủ đề
  const [viewMode, setViewMode] = useState<'log' | 'topic_grades'>('log');

  // Chủ đề được chọn trong Chế độ 2: Bảng điểm theo Chủ đề
  const [selectedTopicId, setSelectedTopicId] = useState<string>(() => topics[0]?.id || '');

  // Tự động đồng bộ topic ID hợp lệ
  useEffect(() => {
    if ((!selectedTopicId || !topics.some((t) => t.id === selectedTopicId)) && topics.length > 0) {
      setSelectedTopicId(topics[0].id);
    }
  }, [topics, selectedTopicId]);

  // Lọc danh sách bài nộp theo đúng phân quyền:
  // - GIÁO VIÊN (ADMIN): Hiển thị đầy đủ 100% tất cả các bài nộp của mọi học sinh và của giáo viên
  // - HỌC SINH (USER): CHỈ hiển thị những bài nộp có tên trùng khớp với tên Học sinh đang đăng nhập hiện tại
  const displayedSubmissions = useMemo(() => {
    if (isAdminAuthenticated) {
      return submissions;
    }
    if (!currentStudent) {
      return [];
    }
    return submissions.filter((sub) => {
      const matchName = sub.userName && currentStudent.fullName &&
        sub.userName.trim().toLowerCase() === currentStudent.fullName.trim().toLowerCase();
      const matchUser = sub.userId && currentStudent.username &&
        sub.userId.trim().toLowerCase() === currentStudent.username.trim().toLowerCase();
      return Boolean(matchName || matchUser);
    });
  }, [submissions, isAdminAuthenticated, currentStudent]);

  // Dữ liệu cho Chế độ 2: Bảng điểm theo Chủ đề
  const currentGradeTopic = topics.find((t) => t.id === selectedTopicId) || topics[0];
  const topicProblems = currentGradeTopic
    ? problems.filter((p) => p.topicId === currentGradeTopic.id)
    : [];
  const topicMaxTotalPoints = topicProblems.reduce((sum, p) => sum + (p.totalPoints || 10), 0);

  // Helper: Tìm bài nộp có điểm số cao nhất của 1 học sinh đối với 1 bài tập cụ thể
  const getStudentProblemBest = (student: StudentUser, problemId: string): Submission | null => {
    const studentSubs = submissions.filter((s) => {
      if (s.problemId !== problemId) return false;
      const matchName = s.userName && student.fullName &&
        s.userName.trim().toLowerCase() === student.fullName.trim().toLowerCase();
      const matchUser = s.userId && student.username &&
        s.userId.trim().toLowerCase() === student.username.trim().toLowerCase();
      return Boolean(matchName || matchUser);
    });

    if (studentSubs.length === 0) return null;

    return studentSubs.reduce((best, cur) => {
      if (!best) return cur;
      if (cur.totalPointsEarned > best.totalPointsEarned) return cur;
      if (
        cur.totalPointsEarned === best.totalPointsEarned &&
        new Date(cur.submittedAt).getTime() > new Date(best.submittedAt).getTime()
      ) {
        return cur;
      }
      return best;
    }, null as Submission | null);
  };

  // Bảo vệ bảo mật: Ẩn hoàn toàn bài nộp của Giáo viên và của học sinh khác khỏi học sinh hiện tại
  useEffect(() => {
    if (!isAdminAuthenticated && currentStudent && selectedSub) {
      const matchName = selectedSub.userName && currentStudent.fullName &&
        selectedSub.userName.trim().toLowerCase() === currentStudent.fullName.trim().toLowerCase();
      const matchUser = selectedSub.userId && currentStudent.username &&
        selectedSub.userId.trim().toLowerCase() === currentStudent.username.trim().toLowerCase();
      if (!matchName && !matchUser) {
        setSelectedSub(null);
      }
    }
  }, [isAdminAuthenticated, currentStudent, selectedSub]);

  // Lấy thông tin bài tập và chủ đề tương ứng của bài nộp đang chọn
  const activeProblem = selectedSub ? problems.find((p) => p.id === selectedSub.problemId) : null;
  const activeTopic = activeProblem ? topics.find((t) => t.id === activeProblem.topicId) : null;
  const displayTitle = activeProblem?.title || selectedSub?.problemTitle || 'Bài tập';
  const displayCode = activeProblem?.code || selectedSub?.problemCode || 'CODE';

  // Lắng nghe phím ESC để đóng modal chi tiết
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSub(null);
      }
    };
    if (selectedSub) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSub]);

  const getVerdictBadge = (sub: Submission) => {
    const isFull = sub.passedCount === sub.totalTests && sub.totalTests > 0;
    if (isFull) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          FULL AC (100%)
        </span>
      );
    }
    if (sub.passedCount > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          PARTIAL ({sub.totalPointsEarned}đ)
        </span>
      );
    }
    if (sub.overallVerdict === 'CE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
          <FileCode2 className="w-3.5 h-3.5" />
          LỖI BIÊN DỊCH (CE)
        </span>
      );
    }
    if (sub.overallVerdict === 'TLE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5" />
          QUÁ THỜI GIAN (TLE)
        </span>
      );
    }
    if (sub.overallVerdict === 'RTE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
          <AlertOctagon className="w-3.5 h-3.5" />
          LỖI THỰC THI (RTE)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <XCircle className="w-3.5 h-3.5" />
        SAI KẾT QUẢ (WA)
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Bộ chuyển đổi chế độ xem (Dành cho Giáo viên) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            {viewMode === 'log' ? 'Nhật ký nộp bài & Kết quả chấm' : 'Bảng điểm & Tiến độ theo Chủ đề'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {viewMode === 'log'
              ? 'Theo dõi chi tiết điểm số từng test case của tất cả các lần nộp bài gần nhất'
              : 'Thống kê tổng điểm và tiến độ hoàn thành từng bài tập của học sinh theo từng chuyên đề'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 2 Nút chuyển chế độ xem dành riêng cho Giáo viên */}
          {isAdminAuthenticated && (
            <div className="flex items-center p-1 bg-slate-800/80 rounded-2xl border border-slate-700/60 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('log')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'log'
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Nhật ký từng lần nộp</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('topic_grades')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'topic_grades'
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Bảng điểm theo Chủ đề</span>
              </button>
            </div>
          )}

          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            {viewMode === 'log' ? `${displayedSubmissions.length} bài nộp` : `${students.length} học sinh`}
          </span>
        </div>
      </div>

      {/* CHẾ ĐỘ 1: NHẬT KÝ TỪNG LẦN NỘP (Bảng thời gian như hiện tại) */}
      {(viewMode === 'log' || !isAdminAuthenticated) && (
        displayedSubmissions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <Layers className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <h5 className="font-semibold text-slate-300">Chưa có lượt nộp bài nào</h5>
            <p className="text-xs text-slate-500 mt-1">
              {isAdminAuthenticated
                ? 'Chưa có lượt nộp bài nào được ghi nhận trên hệ thống.'
                : 'Hãy chọn một bài tập bất kỳ và thử nộp bài để trải nghiệm hệ thống chấm Themis!'}
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 bg-slate-800/40">
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Học sinh</th>
                    <th className="py-3 px-4">Bài tập</th>
                    <th className="py-3 px-4">Ngôn ngữ</th>
                    <th className="py-3 px-4">Kết quả (Themis)</th>
                    <th className="py-3 px-4">Điểm số</th>
                    <th className="py-3 px-4">Thời gian chạy</th>
                    <th className="py-3 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {displayedSubmissions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedSub(sub)}
                    >
                      <td className="py-3 px-4 text-slate-400 font-sans flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {new Date(sub.submittedAt).toLocaleTimeString()} ({new Date(sub.submittedAt).toLocaleDateString()})
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-blue-400">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{sub.userName || 'Học sinh'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                        [{sub.problemCode}] {sub.problemTitle}
                      </td>
                      <td className="py-3 px-4 uppercase text-slate-300 font-bold">
                        {sub.language}
                      </td>
                      <td className="py-3 px-4">{getVerdictBadge(sub)}</td>
                      <td className="py-3 px-4 font-bold">
                        <span className="text-amber-400">{sub.totalPointsEarned}</span>
                        <span className="text-slate-500"> / {sub.maxTotalPoints}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {sub.executionTime.toFixed(3)}s
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSub(sub);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors"
                        >
                          Chi tiết <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* CHẾ ĐỘ 2: BẢNG ĐIỂM THEO CHỦ ĐỀ (Dành riêng cho Giáo viên) */}
      {isAdminAuthenticated && viewMode === 'topic_grades' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Thanh chọn Chủ đề & Thống kê */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Chọn chủ đề (Chuyên đề) muốn xem bảng điểm:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer min-w-[220px]"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                <span className="text-slate-400">Số bài trong chủ đề:</span>{' '}
                <b className="text-blue-400">{topicProblems.length} bài</b>
              </span>
              <span className="text-xs font-mono text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                <span className="text-slate-400">Tổng điểm tối đa:</span>{' '}
                <b className="text-amber-400">{topicMaxTotalPoints}đ</b>
              </span>
            </div>
          </div>

          {/* Bảng tổng hợp điểm số từng học sinh trong chủ đề */}
          {students.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <h5 className="font-semibold text-slate-300">Chưa có tài khoản học sinh nào</h5>
              <p className="text-xs text-slate-500 mt-1">
                Hãy nhấn vào nút <b>&quot;Quản lý Học sinh&quot;</b> trên thanh công cụ để cấp tài khoản cho học sinh.
              </p>
            </div>
          ) : topicProblems.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <h5 className="font-semibold text-slate-300">Chủ đề này chưa có bài tập nào</h5>
              <p className="text-xs text-slate-500 mt-1">
                Vui lòng vào mục &quot;Quản lý Chủ đề&quot; để thêm bài tập vào chuyên đề này.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 bg-slate-800/40">
                      <th className="py-3 px-4 w-12 text-center">STT</th>
                      <th className="py-3 px-4 min-w-[180px]">Học sinh</th>
                      <th className="py-3 px-4 min-w-[170px]">Tiến độ chủ đề</th>
                      {topicProblems.map((prob) => (
                        <th
                          key={prob.id}
                          className="py-3 px-3 text-center min-w-[125px] border-l border-slate-800/50"
                        >
                          <div className="font-mono text-blue-400 font-bold tracking-tight">
                            [{prob.code}]
                          </div>
                          <div
                            className="text-[10px] text-slate-300 truncate max-w-[115px] font-medium mt-0.5 mx-auto"
                            title={prob.title}
                          >
                            {prob.title}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            ({prob.totalPoints || 10}đ)
                          </div>
                        </th>
                      ))}
                      <th className="py-3 px-4 text-center min-w-[140px] border-l border-slate-800/80 bg-slate-800/30">
                        Tổng điểm chủ đề
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {students.map((st, idx) => {
                      let attemptedCount = 0;
                      let totalPointsEarned = 0;

                      const problemBests = topicProblems.map((prob) => {
                        const bestSub = getStudentProblemBest(st, prob.id);
                        if (bestSub) {
                          attemptedCount++;
                          totalPointsEarned += bestSub.totalPointsEarned;
                        }
                        return { prob, bestSub };
                      });

                      const progressPercent =
                        topicProblems.length > 0
                          ? Math.round((attemptedCount / topicProblems.length) * 100)
                          : 0;

                      return (
                        <tr
                          key={st.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 text-center text-slate-500 font-bold">
                            #{idx + 1}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <span className="font-bold text-slate-100 block">
                                  {st.fullName}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  @{st.username}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-300 font-medium">
                                  Đã làm {attemptedCount} / {topicProblems.length} bài
                                </span>
                                <span className="font-mono font-bold text-blue-400">
                                  {progressPercent}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700/60">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Điểm từng bài tập */}
                          {problemBests.map(({ prob, bestSub }) => {
                            const maxPts = prob.totalPoints || 10;
                            const isFull =
                              bestSub &&
                              bestSub.passedCount === bestSub.totalTests &&
                              bestSub.totalTests > 0;

                            return (
                              <td
                                key={prob.id}
                                className="py-3 px-3 text-center border-l border-slate-800/50"
                              >
                                {bestSub ? (
                                  <button
                                    onClick={() => setSelectedSub(bestSub)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer shadow-sm hover:scale-105 ${
                                      isFull
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                        : bestSub.totalPointsEarned > 0
                                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                                    }`}
                                    title="Bấm để xem chi tiết bài nộp & mã nguồn của học sinh"
                                  >
                                    {isFull && (
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                    )}
                                    <span>
                                      {bestSub.totalPointsEarned} / {maxPts}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-500 font-mono italic">
                                    Chưa làm (0đ)
                                  </span>
                                )}
                              </td>
                            );
                          })}

                          {/* Tổng điểm chủ đề */}
                          <td className="py-3 px-4 text-center font-mono font-bold border-l border-slate-800/80 bg-slate-800/20">
                            <span
                              className={`text-sm ${
                                totalPointsEarned >= topicMaxTotalPoints &&
                                topicMaxTotalPoints > 0
                                  ? 'text-emerald-400'
                                  : totalPointsEarned > 0
                                  ? 'text-amber-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {totalPointsEarned}
                            </span>
                            <span className="text-slate-500 text-xs">
                              {' '}
                              / {topicMaxTotalPoints}đ
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submission Detail Modal (Chi tiết bài nộp & kết quả chấm Themis) */}
      {selectedSub && (
        <div
          onClick={() => setSelectedSub(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative flex flex-col space-y-6"
          >
            {/* Header: Chỉ 1 nút đóng góc trên bên phải, hiển thị TÊN BÀI TẬP rõ ràng, decor đẹp mắt */}
            <div className={`sticky top-0 z-20 backdrop-blur-md px-6 py-4 border-b -mx-6 -mt-6 rounded-t-3xl flex items-start justify-between gap-4 transition-colors ${
              theme === 'light' ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-slate-800'
            }`}>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                    theme === 'light'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                  }`}>
                    Mã bài: {displayCode}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-lg border ${
                    theme === 'light'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }`}>
                    <User className="w-3.5 h-3.5 text-emerald-500" />
                    Học sinh: {selectedSub.userName || 'Học sinh'}
                  </span>
                  {activeTopic && (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-lg border ${
                      theme === 'light'
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      Chủ đề: {activeTopic.name}
                    </span>
                  )}
                  <span className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    • Nhật ký chấm Themis
                  </span>
                </div>

                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                    theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Tên bài tập:
                  </span>
                  <h3 className={`text-xl sm:text-2xl font-black tracking-tight ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}>
                    {displayTitle}
                  </h3>
                </div>
              </div>

              {/* Chỉ 1 nút Đóng duy nhất ở góc trên bên phải */}
              <button
                onClick={() => setSelectedSub(null)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all border shadow-sm shrink-0 ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-700 border-slate-200 hover:border-rose-500'
                    : 'bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white border-slate-700 hover:border-rose-500'
                }`}
                title="Đóng cửa sổ (Phím ESC hoặc click ra ngoài)"
              >
                <span className="text-xs font-semibold hidden sm:inline">Đóng</span>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Themis Table */}
            <ThemisGradingTable
              submission={selectedSub}
              isGrading={false}
            />

            {/* Source Code View */}
            <div>
              <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-300'
              }`}>
                <Code2 className="w-4 h-4 text-blue-500 dark:text-blue-400" /> Mã nguồn đã nộp ({selectedSub.language.toUpperCase()}):
              </h4>
              <pre className="p-4 bg-slate-950 rounded-2xl text-emerald-400 font-mono text-xs overflow-x-auto max-h-64 border border-slate-800">
                {selectedSub.sourceCode}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

