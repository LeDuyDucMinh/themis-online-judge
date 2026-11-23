import React, { useState, useEffect, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { isProblemInClass, type Submission } from '../../types/judge';
import { apiService } from '../../services/apiService';
import { computeExamState, sortExamCountdowns } from '../common/ExamCountdownCard';
import { ThemisGradingTable } from '../user/ThemisGradingTable';
import {
  checkJudgeServerHealthCached,
  computeClassStudentProgress,
  formatShortSubmissionTime,
  getCachedJudgeHealth,
  getEffectiveTestCount,
  isSubmissionTodayVN,
  type JudgeHealthSnapshot,
} from '../../utils/teacherMetrics';
import type { AdminTabType } from './AdminLayout';
import { X, Copy, Check } from 'lucide-react';

interface TeacherOverviewProps {
  onOpenProblemEditor: (problemId: string | 'NEW', focusSection?: 'info' | 'de' | 'test' | 'giao') => void;
  onOpenClass: (
    classId: string,
    options?: { tab?: 'students' | 'assignments' | 'grades' | 'submissions' | 'settings'; filterZeroAc?: boolean }
  ) => void;
  onNavigateTab: (tab: AdminTabType, options?: { studentHomeSubTab?: 'banners' | 'countdowns'; problemBankFilter?: 'all' | 'missing_tests' | 'unassigned' }) => void;
  onOpenServerConfig: () => void;
}

export const TeacherOverview: React.FC<TeacherOverviewProps> = ({
  onOpenProblemEditor,
  onOpenClass,
  onNavigateTab,
  onOpenServerConfig,
}) => {
  const {
    classes,
    students,
    problems,
    topics,
    submissions,
    examCountdowns,
    problemTestCounts,
    refreshProblemTestCounts,
    getStudentsInClass,
    getPendingStudentsInClass,
    createClass,
    showToast,
  } = useJudge();

  // Trạng thái máy chủ chấm VPS (tự ping 1 lần rồi cache 5 phút, tránh gây tải VPS)
  const [vpsHealth, setVpsHealth] = useState<JudgeHealthSnapshot | null>(() => getCachedJudgeHealth());
  const [isCheckingVps, setIsCheckingVps] = useState(false);

  // Modal tạo lớp nhanh ngay từ nút "+ Tạo lớp"
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [isCreatingClass, setIsCreatingClass] = useState(false);

  // Modal xem nhanh chi tiết 1 bài nộp khi bấm vào bảng "Nộp bài gần đây"
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [isLoadingSubDetail, setIsLoadingSubDetail] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    refreshProblemTestCounts(false).catch(() => {});
    let active = true;
    const cached = getCachedJudgeHealth();
    if (!cached) {
      setIsCheckingVps(true);
    }
    checkJudgeServerHealthCached(false)
      .then((snap) => {
        if (active) setVpsHealth(snap);
      })
      .finally(() => {
        if (active) setIsCheckingVps(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleRecheckVps = async () => {
    setIsCheckingVps(true);
    try {
      const snap = await checkJudgeServerHealthCached(true);
      setVpsHealth(snap);
    } finally {
      setIsCheckingVps(false);
    }
  };

  // Đếm tài khoản học sinh (loại tài khoản admin/teacher)
  const studentAccountsCount = useMemo(() => {
    return students.filter((s) => s.role !== 'admin' && s.role !== 'teacher').length;
  }, [students]);

  // Đếm lượt nộp hôm nay theo giờ Việt Nam (0 request thừa)
  const todaySubmissionsCount = useMemo(() => {
    return submissions.filter((s) => isSubmissionTodayVN(s.submittedAt)).length;
  }, [submissions]);

  // 5 lượt nộp gần nhất
  const recentSubmissions = useMemo(() => {
    return [...submissions]
      .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
      .slice(0, 6);
  }, [submissions]);

  // Danh sách lớp kèm thống kê học sinh & bài tập & số em chưa có Full AC
  const classSummaries = useMemo(() => {
    return classes.map((cls) => {
      const clsStudents = getStudentsInClass(cls.id);
      const clsPending = getPendingStudentsInClass(cls.id);
      const clsProblems = problems.filter((p) => isProblemInClass(p, cls.id, topics, classes));
      const progress = computeClassStudentProgress(cls.id, clsStudents, clsProblems, submissions);
      const zeroAcCount = progress.filter((r) => r.acCount === 0).length;
      return {
        cls,
        studentCount: clsStudents.length,
        pendingCount: clsPending.length,
        problemCount: clsProblems.length,
        zeroAcCount,
      };
    });
  }, [classes, problems, topics, submissions, getStudentsInClass, getPendingStudentsInClass]);

  // Các bài tập chưa có test trên Cloud (sử dụng problemTestCounts đã cache 3 phút)
  const missingTestProblems = useMemo(() => {
    return problems.filter((p) => getEffectiveTestCount(p, problemTestCounts) === 0);
  }, [problems, problemTestCounts]);

  // Kỳ thi sắp tới gần nhất
  const upcomingExams = useMemo(() => {
    const now = Date.now();
    return sortExamCountdowns(examCountdowns, now)
      .map((exam) => ({ exam, state: computeExamState(exam, now) }))
      .filter(({ state }) => state.isVisibleToStudent && state.phase !== 'ended')
      .slice(0, 2);
  }, [examCountdowns]);

  // Dữ liệu cho khối "Cần chú ý"
  const attentionPendingClasses = useMemo(
    () => classSummaries.filter((c) => c.pendingCount > 0),
    [classSummaries]
  );
  const attentionZeroAcClass = useMemo(
    () => classSummaries.find((c) => c.zeroAcCount > 0 && c.problemCount > 0) || null,
    [classSummaries]
  );

  const handleOpenSubDetail = async (sub: Submission) => {
    setSelectedSub(sub);
    if (!sub.testResults || sub.testResults.length === 0 || !sub.sourceCode) {
      setIsLoadingSubDetail(true);
      try {
        const full = await apiService.fetchSubmissionById(sub.id);
        if (full) {
          setSelectedSub((curr) =>
            curr?.id === sub.id
              ? {
                  ...curr,
                  ...full,
                  testResults: full.testResults?.length ? full.testResults : curr.testResults,
                  sourceCode: full.sourceCode || curr.sourceCode,
                }
              : curr
          );
        }
      } finally {
        setIsLoadingSubDetail(false);
      }
    }
  };

  const handleCreateClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      showToast('Thiếu tên lớp', 'Vui lòng nhập tên lớp học.', 'warning');
      return;
    }
    setIsCreatingClass(true);
    try {
      const created = await createClass(newClassName.trim(), newClassDesc.trim());
      setIsCreateClassOpen(false);
      setNewClassName('');
      setNewClassDesc('');
      onOpenClass(created.id, { tab: 'students' });
    } catch (err: unknown) {
      showToast('Không thể tạo lớp', (err as Error)?.message || 'Lỗi tạo lớp học', 'error');
    } finally {
      setIsCreatingClass(false);
    }
  };

  const renderVerdictCell = (sub: Submission) => {
    if (sub.overallVerdict === 'AC') {
      return (
        <span className="inline-flex items-center whitespace-nowrap">
          <i className="inline-block w-[10px] h-[10px] rounded-[2px] mr-2 bg-[#2F6B3F] shrink-0" />
          <b className="text-[#2F6B3F] text-[14px]">Full AC</b>
        </span>
      );
    }
    if ((sub.passedCount || 0) > 0 || (sub.totalPointsEarned || 0) > 0) {
      return (
        <span className="inline-flex items-center whitespace-nowrap">
          <i className="inline-block w-[10px] h-[10px] rounded-[2px] mr-2 bg-[#D69A1F] shrink-0" />
          <b className="text-[#8A5A00] text-[14px]">Một phần</b>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center whitespace-nowrap">
        <i className="inline-block w-[10px] h-[10px] rounded-[2px] mr-2 bg-[#B4281F] shrink-0" />
        <b className="text-[#B4281F] text-[14px]">{sub.overallVerdict || 'Chưa đạt'}</b>
      </span>
    );
  };

  return (
    <div
      className="banner-editorial-page w-full text-[#1F1D1A] animate-in fade-in duration-150"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-6 mb-6">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-[#1F1D1A] leading-tight">
            Tổng quan
          </h1>
          <p className="text-[15px] text-[#6B655C] mt-2 max-w-[600px]">
            Việc cần xem hôm nay và các lớp của bạn.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onOpenProblemEditor('NEW')}
            className="px-[18px] py-[9.5px] rounded-[8px] border-[1.5px] border-[#1F1D1A] text-[#1F1D1A] hover:bg-[#E9E2D3] text-[15px] font-semibold transition-colors cursor-pointer"
          >
            + Thêm bài
          </button>
          <button
            type="button"
            onClick={() => setIsCreateClassOpen(true)}
            className="px-5 py-[11px] rounded-[8px] bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[15px] font-semibold transition-colors cursor-pointer"
          >
            + Tạo lớp
          </button>
        </div>
      </div>

      {/* 3 chỉ số chính */}
      <div className="flex flex-wrap gap-10 sm:gap-14 py-5 border-t-2 border-[#1F1D1A] border-b border-[#D9D2C3] mb-9">
        <button
          type="button"
          onClick={() => onNavigateTab('admin_classes')}
          className="text-left group cursor-pointer"
        >
          <div className="font-mono text-[34px] font-bold leading-none text-[#1F1D1A] group-hover:text-[#B4281F] transition-colors tabular-nums">
            {classes.length}
          </div>
          <div className="text-[14px] text-[#6B655C] mt-1.5">lớp đang mở</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('admin_users')}
          className="text-left group cursor-pointer"
          title="Xem toàn bộ tài khoản học sinh trên hệ thống"
        >
          <div className="font-mono text-[34px] font-bold leading-none text-[#1F1D1A] group-hover:text-[#B4281F] transition-colors tabular-nums">
            {studentAccountsCount}
          </div>
          <div className="text-[14px] text-[#6B655C] mt-1.5">tài khoản học sinh</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('submissions')}
          className="text-left group cursor-pointer"
          title="Xem toàn bộ lịch sử nộp bài"
        >
          <div className="font-mono text-[34px] font-bold leading-none text-[#1F1D1A] group-hover:text-[#B4281F] transition-colors tabular-nums">
            {todaySubmissionsCount}
          </div>
          <div className="text-[14px] text-[#6B655C] mt-1.5">lượt nộp hôm nay</div>
        </button>
      </div>

      {/* Bố cục 2 cột chính: Trái (Cần chú ý + Nộp bài gần đây) | Phải (Lớp của bạn + Sắp tới) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 lg:gap-14 items-start">
        {/* CỘT TRÁI */}
        <div className="min-w-0">
          {/* 1. Cần chú ý */}
          <h2 className="text-[20px] font-bold text-[#1F1D1A] mb-3">Cần chú ý</h2>

          <div className="border-b border-[#D9D2C3]">
            {/* Cảnh báo yêu cầu duyệt vào lớp (nếu có) */}
            {attentionPendingClasses.map((item) => (
              <div
                key={`pending-${item.cls.id}`}
                className="border-t border-[#D9D2C3] py-3.5 grid grid-cols-[22px_1fr_auto] gap-2.5 items-center text-[15px]"
              >
                <i className="inline-block w-[10px] h-[10px] rounded-[2px] bg-[#D69A1F]" />
                <span>
                  <b>{item.pendingCount} yêu cầu</b> chờ duyệt vào lớp <b>{item.cls.className}</b>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenClass(item.cls.id, { tab: 'students' })}
                  className="text-[#B4281F] hover:text-[#8F1F18] font-semibold text-[14.5px] whitespace-nowrap cursor-pointer"
                >
                  Duyệt ngay →
                </button>
              </div>
            ))}

            {/* Cảnh báo học sinh chưa có bài Full AC */}
            {attentionZeroAcClass && (
              <div className="border-t border-[#D9D2C3] py-3.5 grid grid-cols-[22px_1fr_auto] gap-2.5 items-center text-[15px]">
                <i className="inline-block w-[10px] h-[10px] rounded-[2px] bg-[#D69A1F]" />
                <span>
                  {attentionZeroAcClass.zeroAcCount} học sinh trong lớp{' '}
                  <b>{attentionZeroAcClass.cls.className}</b> chưa có bài Full AC nào
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onOpenClass(attentionZeroAcClass.cls.id, { tab: 'students', filterZeroAc: true })
                  }
                  className="text-[#B4281F] hover:text-[#8F1F18] font-semibold text-[14.5px] whitespace-nowrap cursor-pointer"
                >
                  Xem học sinh →
                </button>
              </div>
            )}

            {/* Cảnh báo bài thiếu test trên Cloud */}
            {missingTestProblems.length > 0 && (
              <div className="border-t border-[#D9D2C3] py-3.5 grid grid-cols-[22px_1fr_auto] gap-2.5 items-center text-[15px]">
                <i className="inline-block w-[10px] h-[10px] rounded-[2px] bg-[#D69A1F]" />
                <span>
                  {missingTestProblems.length === 1 ? (
                    <>
                      Bài <b className="font-mono">{missingTestProblems[0].code}</b> chưa có test nên học sinh chưa làm được
                    </>
                  ) : (
                    <>
                      Bài <b className="font-mono">{missingTestProblems[0].code}</b> và{' '}
                      {missingTestProblems.length - 1} bài khác chưa có test nên học sinh chưa làm được
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    missingTestProblems.length === 1
                      ? onOpenProblemEditor(missingTestProblems[0].id, 'test')
                      : onNavigateTab('admin_topics', { problemBankFilter: 'missing_tests' })
                  }
                  className="text-[#B4281F] hover:text-[#8F1F18] font-semibold text-[14.5px] whitespace-nowrap cursor-pointer"
                >
                  Nạp test →
                </button>
              </div>
            )}

            {/* Trạng thái Máy chủ chấm VPS (cache 5 phút) */}
            <div className="border-t border-[#D9D2C3] py-3.5 grid grid-cols-[22px_1fr_auto] gap-2.5 items-center text-[15px]">
              <i
                className={`inline-block w-[10px] h-[10px] rounded-[2px] ${
                  isCheckingVps
                    ? 'bg-[#A39B8B]'
                    : vpsHealth?.success
                    ? 'bg-[#2F6B3F]'
                    : 'bg-[#D69A1F]'
                }`}
              />
              <span>
                {isCheckingVps ? (
                  <span className="text-[#6B655C]">Đang kiểm tra trạng thái máy chủ chấm VPS...</span>
                ) : vpsHealth?.success ? (
                  <>
                    Máy chủ chấm hoạt động tốt, phản hồi{' '}
                    <span className="font-mono">{vpsHealth.latencyMs} ms</span>
                  </>
                ) : (
                  <span>
                    Máy chủ chấm chưa phản hồi ({vpsHealth?.message || 'kiểm tra lại cấu hình VPS'})
                  </span>
                )}
              </span>
              <div className="flex items-center gap-3 whitespace-nowrap">
                <button
                  type="button"
                  onClick={handleRecheckVps}
                  disabled={isCheckingVps}
                  className="text-[13px] text-[#6B655C] hover:text-[#1F1D1A] underline underline-offset-3 cursor-pointer disabled:opacity-50"
                >
                  Kiểm tra lại
                </button>
                <button
                  type="button"
                  onClick={onOpenServerConfig}
                  className="text-[#B4281F] hover:text-[#8F1F18] font-semibold text-[14.5px] cursor-pointer"
                >
                  Cấu hình →
                </button>
              </div>
            </div>
          </div>

          {/* 2. Nộp bài gần đây */}
          <div className="flex items-baseline justify-between gap-4 mt-10 mb-3">
            <h2 className="text-[20px] font-bold text-[#1F1D1A]">Nộp bài gần đây</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('submissions')}
              className="text-[13.5px] font-semibold text-[#B4281F] hover:text-[#8F1F18] hover:underline cursor-pointer"
            >
              Xem tất cả →
            </button>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="border-t-2 border-[#1F1D1A] py-2.5 grid grid-cols-[100px_1fr_1fr_120px] gap-4 items-center text-[13px] text-[#6B655C]">
                <span>Thời gian</span>
                <span>Học sinh</span>
                <span>Bài</span>
                <span>Kết quả</span>
              </div>

              {recentSubmissions.length === 0 ? (
                <div className="border-t border-b border-[#D9D2C3] py-6 text-[14px] text-[#6B655C]">
                  Chưa có lượt nộp bài nào trên hệ thống.
                </div>
              ) : (
                <div className="border-b border-[#D9D2C3]">
                  {recentSubmissions.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleOpenSubDetail(sub)}
                      className="w-full text-left border-t border-[#D9D2C3] py-3.5 grid grid-cols-[100px_1fr_1fr_120px] gap-4 items-center hover:bg-black/[0.02] transition-colors cursor-pointer"
                    >
                      <span className="font-mono text-[13px] text-[#6B655C] tabular-nums">
                        {formatShortSubmissionTime(sub.submittedAt)}
                      </span>
                      <span className="font-bold text-[15px] text-[#1F1D1A] truncate">
                        {sub.userName || 'Học sinh'}
                      </span>
                      <span className="font-mono text-[13px] text-[#1F1D1A] truncate">
                        {sub.problemCode}
                      </span>
                      <div>{renderVerdictCell(sub)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: Lớp của bạn + Sắp tới */}
        <aside className="min-w-0">
          {/* Lớp của bạn */}
          <div className="border-t-2 border-[#1F1D1A] pt-[18px]">
            <h2 className="text-[20px] font-bold text-[#1F1D1A] mb-2">Lớp của bạn</h2>

            {classSummaries.length === 0 ? (
              <div className="border-t border-[#D9D2C3] py-4 text-[14px] text-[#6B655C]">
                Chưa có lớp học nào. Bấm <b>+ Tạo lớp</b> để bắt đầu.
              </div>
            ) : (
              <div>
                {classSummaries.map(({ cls, studentCount, problemCount }) => (
                  <div
                    key={cls.id}
                    className="border-t border-[#D9D2C3] py-3.5 grid grid-cols-[1fr_auto] gap-4 items-center"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[15px] text-[#1F1D1A] truncate">
                        {cls.className}
                      </div>
                      <div className="text-[14px] text-[#6B655C]">
                        {studentCount > 0 ? `${studentCount} học sinh · ` : ''}
                        {problemCount} bài
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenClass(cls.id, { tab: 'students' })}
                      className="text-[#B4281F] hover:text-[#8F1F18] font-semibold text-[14.5px] whitespace-nowrap cursor-pointer"
                    >
                      Vào lớp →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sắp tới (Đếm ngược kỳ thi gần nhất) */}
          <div className="border-t-2 border-[#1F1D1A] pt-[18px] mt-8">
            <h2 className="text-[20px] font-bold text-[#1F1D1A] mb-2">Sắp tới</h2>

            {upcomingExams.length === 0 ? (
              <div className="border-t border-[#D9D2C3] py-3.5">
                <div className="text-[14px] text-[#6B655C] mb-2">
                  Chưa có kỳ thi nào đang đếm ngược.
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onNavigateTab('admin_student_home', { studentHomeSubTab: 'countdowns' })
                  }
                  className="text-[#B4281F] hover:text-[#8F1F18] font-semibold text-[14.5px] cursor-pointer"
                >
                  Tạo đếm ngược kỳ thi →
                </button>
              </div>
            ) : (
              <div>
                {upcomingExams.map(({ exam, state }) => {
                  const dateFormatted = exam.examDate
                    ? exam.examDate.split('-').reverse().join('/')
                    : '';
                  const remainLabel =
                    state.phase === 'ongoing'
                      ? 'Đang diễn ra'
                      : state.phase === 'today'
                      ? 'Hôm nay thi'
                      : `Còn ${state.days} ngày`;
                  return (
                    <div key={exam.id} className="border-t border-[#D9D2C3] py-3.5">
                      <div className="font-bold text-[15px] text-[#1F1D1A]">{exam.title}</div>
                      <div className="text-[14px] text-[#6B655C] mt-0.5 mb-2">
                        {remainLabel} · {dateFormatted}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onNavigateTab('admin_student_home', { studentHomeSubTab: 'countdowns' })
                        }
                        className="text-[#B4281F] hover:text-[#8F1F18] font-semibold text-[14.5px] cursor-pointer"
                      >
                        Quản lý đếm ngược →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Modal tạo lớp học nhanh */}
      {isCreateClassOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
          onClick={() => !isCreatingClass && setIsCreateClassOpen(false)}
        >
          <form
            onSubmit={handleCreateClassSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl bg-[#FFFDF8] border border-[#D9D2C3] p-6 shadow-xl space-y-4 text-[#1F1D1A]"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[20px] font-bold">Tạo lớp học mới</h3>
              <button
                type="button"
                onClick={() => setIsCreateClassOpen(false)}
                className="p-1 text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-[14px] font-semibold mb-1.5">Tên lớp học</label>
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="VD: CPP05, Đội tuyển HSG Tỉnh..."
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg border border-[#D9D2C3] bg-[#FFFDF8] text-[14.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
              />
            </div>

            <div>
              <label className="block text-[14px] font-semibold mb-1.5">
                Mô tả ngắn <span className="font-normal text-[#6B655C]">(không bắt buộc)</span>
              </label>
              <textarea
                rows={2}
                value={newClassDesc}
                onChange={(e) => setNewClassDesc(e.target.value)}
                placeholder="Giao đề, bài tập và chấm điểm chuẩn Themis cho học sinh của lớp."
                className="w-full px-3 py-2 rounded-lg border border-[#D9D2C3] bg-[#FFFDF8] text-[14px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#D9D2C3]">
              <button
                type="button"
                onClick={() => setIsCreateClassOpen(false)}
                className="px-4 py-2 text-[14px] font-semibold text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isCreatingClass}
                className="px-5 py-2 rounded-lg bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[14px] font-semibold cursor-pointer disabled:opacity-60"
              >
                {isCreatingClass ? 'Đang tạo...' : 'Tạo lớp'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal xem nhanh chi tiết bài nộp */}
      {selectedSub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setSelectedSub(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl bg-[#FFFDF8] border border-[#D9D2C3] shadow-2xl overflow-hidden text-[#1F1D1A]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#D9D2C3] flex items-center justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <div className="font-bold text-[17px] text-[#1F1D1A] truncate">
                  {selectedSub.userName} · <span className="font-mono">{selectedSub.problemCode}</span>
                </div>
                <div className="text-[13px] text-[#6B655C] mt-0.5">
                  {formatShortSubmissionTime(selectedSub.submittedAt)} · Điểm:{' '}
                  <b className="font-mono text-[#1F1D1A]">
                    {selectedSub.totalPointsEarned}/{selectedSub.maxTotalPoints}
                  </b>{' '}
                  · {selectedSub.passedCount}/{selectedSub.totalTests} test
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                className="p-1.5 text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isLoadingSubDetail ? (
                <div className="py-10 text-center text-[14px] text-[#6B655C]">
                  Đang tải mã nguồn và kết quả chấm chi tiết...
                </div>
              ) : (
                <>
                  {selectedSub.sourceCode && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[13px] font-bold text-[#1F1D1A]">
                          Mã nguồn ({selectedSub.language?.toUpperCase() || 'CPP'})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedSub.sourceCode);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 1800);
                          }}
                          className="inline-flex items-center gap-1.5 text-[12.5px] text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer"
                        >
                          {copiedCode ? <Check className="w-3.5 h-3.5 text-[#2F6B3F]" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedCode ? 'Đã sao chép' : 'Sao chép code'}</span>
                        </button>
                      </div>
                      <pre className="p-4 rounded-lg bg-[#1F1D1A] text-[#F4F0E8] font-mono text-[12.5px] overflow-x-auto max-h-[260px]">
                        <code>{selectedSub.sourceCode}</code>
                      </pre>
                    </div>
                  )}

                  {selectedSub.testResults && selectedSub.testResults.length > 0 && (
                    <ThemisGradingTable submission={selectedSub} isGrading={false} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
