import React, { useState, useEffect, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { isProblemInClass, type Submission } from '../../types/judge';
import { apiService } from '../../services/apiService';
import { ClassLeaderboard } from '../common/ClassLeaderboard';
import { ThemisGradingTable } from '../user/ThemisGradingTable';
import { ClassExpiryModal } from './ClassExpiryModal';
import {
  formatExpiryDateVN,
  getRemainingDays,
  EXPIRY_WARNING_DAYS,
} from '../../utils/serverTime';
import {
  computeClassStudentProgress,
  formatDateVN,
  formatShortSubmissionTime,
  getDisplayEmail,
  getEffectiveTestCount,
  type StudentClassProgress,
} from '../../utils/teacherMetrics';
import { Check, X, Copy } from 'lucide-react';

export type TeacherClassV2Tab = 'students' | 'assignments' | 'grades' | 'submissions' | 'settings';

interface TeacherClassDetailProps {
  classId: string;
  initialTab?: TeacherClassV2Tab;
  initialFilterZeroAc?: boolean;
  onOpenProblemEditor?: (problemId: string | 'NEW', focusSection?: 'info' | 'de' | 'test' | 'giao') => void;
}

export const TeacherClassDetail: React.FC<TeacherClassDetailProps> = ({
  classId,
  initialTab = 'students',
  initialFilterZeroAc = false,
  onOpenProblemEditor,
}) => {
  const {
    classes,
    setActiveClassId,
    getStudentsInClass,
    getPendingStudentsInClass,
    approveStudentJoin,
    rejectStudentJoin,
    removeStudentFromClass,
    updateStudentClassExpiry,
    getStudentClassExpiry,
    serverNowMs,
    deleteStudent,
    updateClass,
    deleteClass,
    updateTopic,
    problems,
    topics,
    submissions,
    problemTestCounts,
    refreshProblemTestCounts,
    showToast,
    openConfirmModal,
    refreshAllData,
  } = useJudge();

  useEffect(() => {
    refreshAllData();
    refreshProblemTestCounts(false).catch(() => {});
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshAllData().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [classId]);

  const [activeTab, setActiveTab] = useState<TeacherClassV2Tab>(initialTab);
  const [copiedCode, setCopiedCode] = useState(false);

  // Bộ lọc tab Học sinh
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'zero_ac' | 'expiring_soon'>(
    initialFilterZeroAc ? 'zero_ac' : 'all'
  );
  const [studentSort, setStudentSort] = useState<'ac_desc' | 'name_asc' | 'joined_desc' | 'expiry_asc'>('ac_desc');
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);
  const [expiryModalStudent, setExpiryModalStudent] = useState<StudentClassProgress['student'] | null>(null);

  // Bộ lọc tab Bài được giao
  const [assignSearch, setAssignSearch] = useState('');
  const [assignTopicFilter, setAssignTopicFilter] = useState<string>('ALL');
  const [isAssignTopicPanelOpen, setIsAssignTopicPanelOpen] = useState(false);
  const [busyTopicId, setBusyTopicId] = useState<string | null>(null);

  // Tab Cài đặt lớp
  const currentClass = classes.find((c) => c.id === classId);
  const [editClassName, setEditClassName] = useState(currentClass?.className || '');
  const [editClassDesc, setEditClassDesc] = useState(currentClass?.description || '');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Modal xem chi tiết 1 lượt nộp bài (dùng chung cho Tab Nộp bài & Trang chi tiết học sinh)
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [isLoadingSub, setIsLoadingSub] = useState(false);
  const [copiedSubCode, setCopiedSubCode] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, classId]);

  useEffect(() => {
    setStudentFilter(initialFilterZeroAc ? 'zero_ac' : 'all');
    setDetailStudentId(null);
  }, [initialFilterZeroAc, classId]);

  useEffect(() => {
    if (currentClass) {
      setEditClassName(currentClass.className);
      setEditClassDesc(currentClass.description || '');
    }
  }, [currentClass?.id, currentClass?.className, currentClass?.description]);

  const classStudents = getStudentsInClass(classId);
  const pendingStudents = getPendingStudentsInClass(classId);

  const classProblems = useMemo(
    () => problems.filter((p) => isProblemInClass(p, classId, topics, classes)),
    [problems, classId, topics, classes]
  );

  const classTopics = useMemo(
    () =>
      topics.filter((t) => {
        const ids =
          t.classIds && t.classIds.length > 0 ? t.classIds : t.classId ? [t.classId] : ['ALL'];
        return ids.includes(classId) || ids.includes('ALL');
      }),
    [topics, classId]
  );

  const topicNameMap = useMemo(() => {
    const m = new Map<string, string>();
    topics.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [topics]);

  // Tính tiến độ Full AC từng học sinh hoàn toàn từ dữ liệu submissions đã cache (0 request thừa!)
  const studentProgressList = useMemo<StudentClassProgress[]>(
    () => computeClassStudentProgress(classId, classStudents, classProblems, submissions),
    [classId, classStudents, classProblems, submissions]
  );

  const zeroAcCount = useMemo(
    () => studentProgressList.filter((r) => r.acCount === 0).length,
    [studentProgressList]
  );

  const expiringSoonCount = useMemo(
    () =>
      studentProgressList.filter((r) => {
        const exp = getStudentClassExpiry(classId, r.student);
        const days = getRemainingDays(exp, serverNowMs);
        return days !== null && days <= EXPIRY_WARNING_DAYS;
      }).length,
    [studentProgressList, classId, serverNowMs, getStudentClassExpiry]
  );

  const filteredStudentRows = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const list = studentProgressList.filter((row) => {
      if (studentFilter === 'zero_ac' && row.acCount > 0) return false;
      if (studentFilter === 'expiring_soon') {
        const exp = getStudentClassExpiry(classId, row.student);
        const days = getRemainingDays(exp, serverNowMs);
        if (days === null || days > EXPIRY_WARNING_DAYS) return false;
      }
      if (!q) return true;
      const email = getDisplayEmail(row.student).toLowerCase();
      return (
        row.student.fullName.toLowerCase().includes(q) ||
        row.student.username.toLowerCase().includes(q) ||
        email.includes(q)
      );
    });

    if (studentSort === 'name_asc') {
      return [...list].sort((a, b) => a.student.fullName.localeCompare(b.student.fullName, 'vi'));
    }
    if (studentSort === 'joined_desc') {
      return [...list].sort(
        (a, b) =>
          new Date(b.student.createdAt || 0).getTime() - new Date(a.student.createdAt || 0).getTime()
      );
    }
    if (studentSort === 'expiry_asc') {
      return [...list].sort((a, b) => {
        const da = getRemainingDays(getStudentClassExpiry(classId, a.student), serverNowMs);
        const db = getRemainingDays(getStudentClassExpiry(classId, b.student), serverNowMs);
        const va = da === null ? Number.MAX_SAFE_INTEGER : da;
        const vb = db === null ? Number.MAX_SAFE_INTEGER : db;
        return va - vb;
      });
    }
    return list;
  }, [studentProgressList, studentFilter, studentSearch, studentSort, classId, serverNowMs, getStudentClassExpiry]);

  const activeDetailRow = useMemo(
    () =>
      detailStudentId
        ? studentProgressList.find((r) => r.student.id === detailStudentId) || null
        : null,
    [detailStudentId, studentProgressList]
  );

  // Các bài nộp thuộc lớp này (0 request thừa)
  const classSubmissions = useMemo(() => {
    const probIds = new Set(classProblems.map((p) => p.id));
    return [...submissions]
      .filter((s) => s.classId === classId || (!s.classId && probIds.has(s.problemId)))
      .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
  }, [submissions, classId, classProblems]);

  const detailStudentSubmissions = useMemo(() => {
    if (!activeDetailRow) return [];
    const stu = activeDetailRow.student;
    const keys = new Set(
      [stu.id, stu.email, stu.username].filter(Boolean).map((x) => String(x).trim().toLowerCase())
    );
    return classSubmissions.filter((s) => keys.has((s.userId || '').trim().toLowerCase()));
  }, [activeDetailRow, classSubmissions]);

  const filteredClassProblems = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    return classProblems.filter((p) => {
      if (assignTopicFilter !== 'ALL' && p.topicId !== assignTopicFilter) return false;
      if (!q) return true;
      return (
        (p.code || '').toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q)
      );
    });
  }, [classProblems, assignSearch, assignTopicFilter]);

  if (!currentClass) {
    if (classes.length === 0) {
      return <div className="py-16 text-center text-[14px] text-[#6B655C]">Đang tải thông tin lớp học...</div>;
    }
    return (
      <div className="py-12 text-center">
        <p className="text-[14px] text-[#6B655C]">Không tìm thấy thông tin lớp học này.</p>
        <button
          type="button"
          onClick={() => setActiveClassId(null)}
          className="mt-4 px-4 py-2 rounded-[8px] bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[13.5px] font-semibold cursor-pointer"
        >
          Quay lại danh sách lớp
        </button>
      </div>
    );
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentClass.joinCode);
    setCopiedCode(true);
    showToast('Đã sao chép mã lớp', `Mã "${currentClass.joinCode}" đã được sao chép vào bộ nhớ tạm`, 'success');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleOpenSubDetail = async (sub: Submission) => {
    setSelectedSub(sub);
    if (!sub.testResults || sub.testResults.length === 0 || !sub.sourceCode) {
      setIsLoadingSub(true);
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
        setIsLoadingSub(false);
      }
    }
  };

  const handleRemoveStudent = (stu: StudentClassProgress['student']) => {
    openConfirmModal({
      title: 'Rút học sinh khỏi lớp',
      message: `Bạn có chắc muốn rút "${stu.fullName}" khỏi lớp "${currentClass.className}"? Tài khoản và bài nộp của học sinh vẫn được giữ nguyên trong hệ thống.`,
      confirmLabel: 'Rút khỏi lớp',
      onConfirm: () => {
        removeStudentFromClass(classId, stu.id, stu.username, stu.email);
        setDetailStudentId(null);
      },
    });
  };

  const handleDeleteStudentAccount = (stu: StudentClassProgress['student']) => {
    openConfirmModal({
      title: 'Xóa vĩnh viễn tài khoản học sinh',
      message: `Bạn có chắc muốn xóa VĨNH VIỄN tài khoản "${stu.fullName}" khỏi toàn bộ hệ thống? Mọi bài nộp của học sinh này sẽ bị xóa sạch.`,
      confirmLabel: 'Xóa tài khoản',
      onConfirm: async () => {
        await deleteStudent(stu.id);
        setDetailStudentId(null);
      },
    });
  };

  const handleToggleTopicForThisClass = async (topicIdToToggle: string, assign: boolean) => {
    const target = topics.find((t) => t.id === topicIdToToggle);
    if (!target) return;
    setBusyTopicId(topicIdToToggle);
    try {
      const existingIds =
        target.classIds && target.classIds.length > 0
          ? target.classIds
          : target.classId
          ? [target.classId]
          : [];
      let nextIds: string[];
      if (existingIds.includes('ALL')) {
        const allIds = classes.map((c) => c.id);
        nextIds = assign ? allIds : allIds.filter((id) => id !== classId);
      } else if (assign) {
        nextIds = Array.from(new Set([...existingIds, classId]));
      } else {
        nextIds = existingIds.filter((id) => id !== classId);
      }
      await updateTopic(target.id, { classIds: nextIds, classId: nextIds[0] || '' });
      showToast(
        assign ? 'Đã giao chủ đề cho lớp' : 'Đã gỡ chủ đề khỏi lớp',
        `Chủ đề "${target.name}" đã được cập nhật cho lớp ${currentClass.className}.`,
        'success'
      );
    } catch (err: unknown) {
      showToast('Không thể cập nhật chủ đề', (err as Error)?.message || 'Lỗi lưu Cloud', 'error');
    } finally {
      setBusyTopicId(null);
    }
  };

  const handleSaveClassSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClassName.trim()) {
      showToast('Thiếu tên lớp', 'Tên lớp học không được để trống.', 'warning');
      return;
    }
    setIsSavingSettings(true);
    try {
      await updateClass(currentClass.id, {
        className: editClassName.trim(),
        description: editClassDesc.trim(),
      });
      showToast('Đã lưu cài đặt lớp', `Thông tin lớp "${editClassName.trim()}" đã được cập nhật.`, 'success');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteCurrentClass = () => {
    openConfirmModal({
      title: `Xóa lớp "${currentClass.className}"`,
      message: `Bạn có chắc muốn xóa lớp "${currentClass.className}" không? Các bài tập trong Kho bài vẫn được giữ nguyên.`,
      confirmLabel: 'Xóa lớp học',
      onConfirm: async () => {
        await deleteClass(currentClass.id);
        setActiveClassId(null);
      },
    });
  };

  const renderVerdictBadge = (sub: Submission) => {
    if (sub.overallVerdict === 'AC') {
      return (
        <span className="inline-flex items-center whitespace-nowrap">
          <i className="inline-block w-[10px] h-[10px] rounded-[2px] mr-2 bg-[#2F6B3F]" />
          <b className="text-[#2F6B3F] text-[14px]">Full AC</b>
        </span>
      );
    }
    if ((sub.passedCount || 0) > 0 || (sub.totalPointsEarned || 0) > 0) {
      return (
        <span className="inline-flex items-center whitespace-nowrap">
          <i className="inline-block w-[10px] h-[10px] rounded-[2px] mr-2 bg-[#D69A1F]" />
          <b className="text-[#8A5A00] text-[14px]">Một phần</b>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center whitespace-nowrap">
        <i className="inline-block w-[10px] h-[10px] rounded-[2px] mr-2 bg-[#B4281F]" />
        <b className="text-[#B4281F] text-[14px]">{sub.overallVerdict || 'Chưa đạt'}</b>
      </span>
    );
  };

  return (
    <div
      className="banner-editorial-page w-full text-[#1F1D1A] animate-in fade-in duration-150"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {/* Header Lớp học v2 */}
      <div className="flex flex-wrap justify-between items-end gap-6 mb-6">
        <div className="min-w-0">
          <h1 className="text-[36px] sm:text-[40px] font-bold tracking-tight text-[#1F1D1A] leading-tight">
            {currentClass.className}
          </h1>
          <p className="text-[15px] text-[#6B655C] mt-1.5">
            Tạo ngày {formatDateVN(currentClass.createdAt)} · {classStudents.length} học sinh ·{' '}
            {classTopics.length} chủ đề · {classProblems.length} bài
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 shrink-0">
          <span className="text-[15px] text-[#1F1D1A]">
            Mã vào lớp{' '}
            <b className="font-mono text-[#B4281F] mx-2 tracking-wide">{currentClass.joinCode}</b>
            <button
              type="button"
              onClick={handleCopyCode}
              className="text-[#6B655C] hover:text-[#1F1D1A] underline underline-offset-[3px] cursor-pointer"
            >
              {copiedCode ? 'Đã chép' : 'Sao chép'}
            </button>
          </span>

          <button
            type="button"
            onClick={() => {
              setActiveTab('assignments');
              setIsAssignTopicPanelOpen(true);
            }}
            className="px-5 py-[11px] rounded-[8px] bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[15px] font-semibold transition-colors cursor-pointer"
          >
            + Giao bài
          </button>
        </div>
      </div>

      {/* 5 Tab chính của Lớp học v2 */}
      <div className="flex items-center gap-7 border-b border-[#D9D2C3] mb-7 overflow-x-auto">
        {(
          [
            {
              id: 'students',
              label: `Học sinh (${classStudents.length})`,
              badge: pendingStudents.length > 0 ? `${pendingStudents.length} chờ` : null,
            },
            { id: 'assignments', label: `Bài được giao (${classProblems.length})`, badge: null },
            { id: 'grades', label: 'Bảng điểm', badge: null },
            { id: 'submissions', label: 'Nộp bài', badge: null },
            { id: 'settings', label: 'Cài đặt lớp', badge: null },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setActiveTab(t.id);
              if (t.id !== 'students') setDetailStudentId(null);
            }}
            className={`py-2.5 text-[15px] whitespace-nowrap border-b-2 -mb-[1px] transition-colors cursor-pointer inline-flex items-center gap-2 ${
              activeTab === t.id
                ? 'border-[#B4281F] text-[#1F1D1A] font-semibold'
                : 'border-transparent text-[#6B655C] hover:text-[#1F1D1A] font-medium'
            }`}
          >
            <span>{t.label}</span>
            {t.badge && (
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-[#B4281F] text-white leading-none">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ============================================================
          TAB 1: HỌC SINH (V2LopHocSinh + Trang Chi tiết từng em)
         ============================================================ */}
      {activeTab === 'students' && (
        <div>
          {/* Yêu cầu chờ duyệt vào lớp (nếu có) */}
          {pendingStudents.length > 0 && !activeDetailRow && (
            <section className="mb-6 p-5 rounded-[10px] bg-[#FDF7E7] border border-[#E5C98B] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15.5px] font-bold text-[#7A4B00]">
                    Yêu cầu tham gia lớp chờ duyệt ({pendingStudents.length})
                  </h3>
                  <p className="text-[13px] text-[#8C6520]">
                    Học sinh đã nhập mã {currentClass.joinCode} và đang chờ bạn phê duyệt.
                  </p>
                </div>
                {pendingStudents.length > 1 && (
                  <button
                    type="button"
                    onClick={async () => {
                      for (const p of pendingStudents) {
                        await approveStudentJoin(classId, p.student.id);
                      }
                      showToast(
                        'Duyệt thành công',
                        `Đã duyệt tất cả ${pendingStudents.length} học sinh vào lớp.`,
                        'success'
                      );
                    }}
                    className="px-3.5 py-1.5 rounded-[8px] bg-[#2F6B3F] hover:bg-[#23543E] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Duyệt tất cả ({pendingStudents.length})</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-[#EBDAB2] border-t border-[#EBDAB2]">
                {pendingStudents.map(({ student: stu, joinedAt }) => (
                  <div key={stu.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-[14.5px] text-[#1F1D1A]">{stu.fullName}</div>
                      <div className="text-[12.5px] text-[#6B655C] font-mono">
                        {getDisplayEmail(stu)} · gửi lúc {formatShortSubmissionTime(joinedAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => approveStudentJoin(classId, stu.id)}
                        className="px-3 py-1.5 rounded-[6px] bg-[#2F6B3F] hover:bg-[#23543E] text-white text-[13px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Duyệt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectStudentJoin(classId, stu.id)}
                        className="p-1.5 rounded-[6px] text-[#6B655C] hover:text-[#B4281F] hover:bg-black/5 cursor-pointer"
                        title="Từ chối"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Chế độ xem CHI TIẾT 1 HỌC SINH */}
          {activeDetailRow ? (
            <div className="space-y-7 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setDetailStudentId(null)}
                  className="text-[14.5px] text-[#6B655C] hover:text-[#1F1D1A] underline underline-offset-3 cursor-pointer"
                >
                  ← Quay lại danh sách học sinh
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpiryModalStudent(activeDetailRow.student)}
                    className="px-4 py-2 rounded-[8px] border-[1.5px] border-[#2F6B3F] text-[14px] font-semibold text-[#2F6B3F] hover:bg-[#2F6B3F] hover:text-white transition-colors cursor-pointer"
                  >
                    Gia hạn lớp
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveStudent(activeDetailRow.student)}
                    className="px-4 py-2 rounded-[8px] border-[1.5px] border-[#1F1D1A] text-[14px] font-semibold text-[#1F1D1A] hover:bg-[#E9E2D3] transition-colors cursor-pointer"
                  >
                    Rút khỏi lớp
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteStudentAccount(activeDetailRow.student)}
                    className="px-4 py-2 rounded-[8px] bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[14px] font-semibold transition-colors cursor-pointer"
                  >
                    Xóa tài khoản
                  </button>
                </div>
              </div>

              {/* Thông tin tổng hợp học sinh */}
              <div className="border-t-2 border-[#1F1D1A] border-b border-[#D9D2C3] py-5 flex flex-wrap items-end justify-between gap-6">
                <div>
                  <div className="text-[13px] text-[#6B655C]">Hạng #{activeDetailRow.rank} trong lớp</div>
                  <h2 className="text-[26px] font-bold text-[#1F1D1A] mt-0.5">
                    {activeDetailRow.student.fullName}
                  </h2>
                  <div className="font-mono text-[13.5px] text-[#6B655C] mt-1">
                    {getDisplayEmail(activeDetailRow.student)} · Tham gia{' '}
                    {formatDateVN(activeDetailRow.student.createdAt)}
                    {(() => {
                      const exp = getStudentClassExpiry(classId, activeDetailRow.student);
                      const days = getRemainingDays(exp, serverNowMs);
                      if (!exp) return ' · Thời hạn: Không giới hạn';
                      return ` · Hạn lớp: ${formatExpiryDateVN(exp)} (${days === 0 ? 'hết hôm nay' : `còn ${days} ngày`})`;
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-10">
                  <div>
                    <div className="font-mono text-[26px] font-bold leading-none text-[#1F1D1A]">
                      {activeDetailRow.acCount}/{activeDetailRow.totalProblems}
                    </div>
                    <div className="text-[13px] text-[#6B655C] mt-1">bài Full AC ({activeDetailRow.pct}%)</div>
                  </div>
                  <div>
                    <div className="font-mono text-[26px] font-bold leading-none text-[#1F1D1A]">
                      {activeDetailRow.totalSubmissions}
                    </div>
                    <div className="text-[13px] text-[#6B655C] mt-1">lượt nộp trong lớp</div>
                  </div>
                </div>
              </div>

              {/* Các bài đã Full AC */}
              <div>
                <h3 className="text-[18px] font-bold text-[#1F1D1A] mb-3">
                  Bài đã giải đúng 100% ({activeDetailRow.solvedCodes.length})
                </h3>
                {activeDetailRow.solvedCodes.length === 0 ? (
                  <p className="text-[14px] text-[#6B655C]">
                    Học sinh này chưa có bài nào đạt Full AC trong lớp.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {activeDetailRow.solvedCodes.map((c) => (
                      <span
                        key={c}
                        className="px-2.5 py-1 rounded-[6px] border border-[#D9D2C3] bg-[#FFFDF8] font-mono text-[13px] text-[#1F1D1A]"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Lịch sử nộp bài gần đây của học sinh này trong lớp */}
              <div>
                <h3 className="text-[18px] font-bold text-[#1F1D1A] mb-3">
                  Lịch sử nộp bài trong lớp ({detailStudentSubmissions.length})
                </h3>
                <div className="overflow-x-auto">
                  <div className="min-w-[540px]">
                    <div className="border-t-2 border-[#1F1D1A] py-2.5 grid grid-cols-[120px_1fr_110px_130px_90px] gap-4 items-center text-[13px] text-[#6B655C]">
                      <span>Thời gian</span>
                      <span>Bài tập</span>
                      <span>Điểm</span>
                      <span>Kết quả</span>
                      <span />
                    </div>
                    {detailStudentSubmissions.length === 0 ? (
                      <div className="border-t border-b border-[#D9D2C3] py-6 text-[14px] text-[#6B655C]">
                        Chưa có lượt nộp bài nào trong lớp này.
                      </div>
                    ) : (
                      <div className="border-b border-[#D9D2C3]">
                        {detailStudentSubmissions.slice(0, 30).map((sub) => (
                          <div
                            key={sub.id}
                            className="border-t border-[#D9D2C3] py-3 grid grid-cols-[120px_1fr_110px_130px_90px] gap-4 items-center text-[14px]"
                          >
                            <span className="font-mono text-[13px] text-[#6B655C]">
                              {formatShortSubmissionTime(sub.submittedAt)}
                            </span>
                            <span className="font-mono font-bold text-[#1F1D1A] truncate">
                              {sub.problemCode}
                            </span>
                            <span className="font-mono text-[#1F1D1A]">
                              {sub.totalPointsEarned}/{sub.maxTotalPoints}
                            </span>
                            <div>{renderVerdictBadge(sub)}</div>
                            <button
                              type="button"
                              onClick={() => handleOpenSubDetail(sub)}
                              className="text-right text-[#B4281F] font-semibold hover:underline cursor-pointer"
                            >
                              Xem code
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* DANH SÁCH HỌC SINH V2 (khớp 100% V2LopHocSinh.dc.html) */
            <div>
              {/* Thanh tìm kiếm + chip lọc + sắp xếp */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Tìm theo họ tên hoặc email"
                  aria-label="Tìm học sinh"
                  className="w-full sm:w-[320px] px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14.5px] text-[#1F1D1A] placeholder-[#8C857B] focus:outline-none focus:border-[#1F1D1A]"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStudentFilter('all')}
                    className={`px-3.5 py-[7px] rounded-[6px] text-[14px] border transition-colors cursor-pointer ${
                      studentFilter === 'all'
                        ? 'banner-pill-active bg-[#1F1D1A] text-[#F4F0E8] border-[#1F1D1A] font-medium'
                        : 'bg-[#FFFDF8] text-[#1F1D1A] border-[#D9D2C3] hover:border-[#1F1D1A]'
                    }`}
                  >
                    Tất cả ({classStudents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentFilter('zero_ac')}
                    className={`px-3.5 py-[7px] rounded-[6px] text-[14px] border transition-colors cursor-pointer ${
                      studentFilter === 'zero_ac'
                        ? 'banner-pill-active bg-[#1F1D1A] text-[#F4F0E8] border-[#1F1D1A] font-medium'
                        : 'bg-[#FFFDF8] text-[#1F1D1A] border-[#D9D2C3] hover:border-[#1F1D1A]'
                    }`}
                  >
                    Chưa có Full AC ({zeroAcCount})
                  </button>
                  {expiringSoonCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setStudentFilter('expiring_soon')}
                      className={`px-3.5 py-[7px] rounded-[6px] text-[14px] border transition-colors cursor-pointer ${
                        studentFilter === 'expiring_soon'
                          ? 'banner-pill-active bg-[#92400E] text-[#FFFDF8] border-[#92400E] font-medium'
                          : 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/50 hover:border-[#92400E]'
                      }`}
                    >
                      Sắp hết hạn ({expiringSoonCount})
                    </button>
                  )}
                </div>

                <span className="flex-1" />

                <div className="flex items-center gap-2.5">
                  <label htmlFor="gv2-sx" className="text-[14px] text-[#6B655C] whitespace-nowrap">
                    Xếp theo
                  </label>
                  <select
                    id="gv2-sx"
                    value={studentSort}
                    onChange={(e) => setStudentSort(e.target.value as any)}
                    className="px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                  >
                    <option value="ac_desc">Số bài Full AC</option>
                    <option value="name_asc">Tên A → Z</option>
                    <option value="joined_desc">Mới tham gia</option>
                    <option value="expiry_asc">Sắp hết hạn trước</option>
                  </select>
                </div>
              </div>

              {/* Bảng học sinh 6 cột: Hạng | Học sinh | Số bài Full AC | Thời hạn | Tham gia | Chi tiết → */}
              <div className="overflow-x-auto">
                <div className="min-w-[780px]">
                  <div className="border-t-2 border-[#1F1D1A] py-2.5 grid grid-cols-[44px_1fr_220px_165px_96px_86px] gap-4 items-center text-[13px] text-[#6B655C]">
                    <span>Hạng</span>
                    <span>Học sinh</span>
                    <span>Số bài Full AC</span>
                    <span>Thời hạn</span>
                    <span>Tham gia</span>
                    <span />
                  </div>

                  {filteredStudentRows.length === 0 ? (
                    <div className="border-t border-b border-[#D9D2C3] py-10 text-center text-[14px] text-[#6B655C]">
                      {classStudents.length === 0 ? (
                        <>
                          Chưa có học sinh nào trong lớp này. Hãy gửi mã vào lớp{' '}
                          <b className="font-mono text-[#B4281F]">{currentClass.joinCode}</b> cho học sinh.
                        </>
                      ) : (
                        'Không có học sinh nào khớp điều kiện lọc.'
                      )}
                    </div>
                  ) : (
                    <div>
                      {filteredStudentRows.map((row) => {
                        const rowExpiry = getStudentClassExpiry(classId, row.student);
                        const rowDaysLeft = getRemainingDays(rowExpiry, serverNowMs);
                        const isExpiringSoon =
                          rowDaysLeft !== null && rowDaysLeft <= EXPIRY_WARNING_DAYS;

                        return (
                          <div
                            key={row.student.id}
                            className="border-t border-[#D9D2C3] py-3.5 grid grid-cols-[44px_1fr_220px_165px_96px_86px] gap-4 items-center hover:bg-black/[0.015] transition-colors"
                          >
                            <span className="font-mono text-[14px] text-[#6B655C] tabular-nums">
                              {row.rank}
                            </span>

                            <div className="min-w-0">
                              <div className="font-bold text-[15px] text-[#1F1D1A] truncate">
                                {row.student.fullName}
                              </div>
                              <div className="font-mono text-[12px] text-[#6B655C] truncate">
                                {getDisplayEmail(row.student)}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-[6px] rounded-[3px] bg-[#E4DDCE] overflow-hidden">
                                <div
                                  className="h-full rounded-[3px] transition-all duration-300"
                                  style={{
                                    width: `${row.pct}%`,
                                    backgroundColor:
                                      row.totalProblems > 0 && row.acCount >= row.totalProblems
                                        ? '#2F6B3F'
                                        : '#B4281F',
                                  }}
                                />
                              </div>
                              <b className="font-mono text-[14px] text-[#1F1D1A] w-[58px] text-right tabular-nums shrink-0">
                                {row.acCount}/{row.totalProblems}
                              </b>
                            </div>

                            {/* Cột Thời hạn (bấm để mở hộp gia hạn / điều chỉnh) */}
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setExpiryModalStudent(row.student)}
                                title="Bấm để gia hạn hoặc điều chỉnh thời hạn học sinh trong lớp"
                                className="text-left group cursor-pointer"
                              >
                                {rowExpiry ? (
                                  <div>
                                    <span
                                      className={`inline-block text-[13px] font-semibold leading-tight group-hover:underline ${
                                        isExpiringSoon
                                          ? 'px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/40'
                                          : 'text-[#1F1D1A]'
                                      }`}
                                    >
                                      {isExpiringSoon
                                        ? rowDaysLeft === 0
                                          ? 'Hết hạn hôm nay'
                                          : `Còn ${rowDaysLeft} ngày`
                                        : formatExpiryDateVN(rowExpiry)}
                                    </span>
                                    <div className="text-[11.5px] text-[#6B655C] mt-0.5 tabular-nums">
                                      {isExpiringSoon
                                        ? `${formatExpiryDateVN(rowExpiry)} · Gia hạn`
                                        : `còn ${rowDaysLeft} ngày · Sửa`}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[13.5px] text-[#6B655C] group-hover:text-[#B4281F] group-hover:underline">
                                    Không giới hạn
                                  </span>
                                )}
                              </button>
                            </div>

                            <span className="text-[13.5px] text-[#6B655C] tabular-nums">
                              {formatDateVN(row.student.createdAt)}
                            </span>

                            <button
                              type="button"
                              onClick={() => setDetailStudentId(row.student.id)}
                              className="text-right text-[14.5px] font-semibold text-[#B4281F] hover:text-[#8F1F18] hover:underline whitespace-nowrap cursor-pointer"
                            >
                              Chi tiết →
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="border-t border-[#D9D2C3] py-3.5 text-[14px] text-[#6B655C]">
                    Bấm trực tiếp vào cột <b>Thời hạn</b> để gia hạn cho từng em. Rút khỏi lớp hoặc xóa tài khoản nằm trong trang <b>Chi tiết</b>.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 2: BÀI ĐƯỢC GIAO
         ============================================================ */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          {/* Thanh tìm kiếm + giao thêm chủ đề / thêm bài mới */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              placeholder="Tìm bài trong lớp theo mã hoặc tên"
              className="w-full sm:w-[300px] px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14.5px] text-[#1F1D1A] placeholder-[#8C857B] focus:outline-none focus:border-[#1F1D1A]"
            />

            <select
              value={assignTopicFilter}
              onChange={(e) => setAssignTopicFilter(e.target.value)}
              className="px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14px] text-[#1F1D1A]"
            >
              <option value="ALL">Mọi chủ đề của lớp ({classTopics.length})</option>
              {classTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <span className="flex-1" />

            <button
              type="button"
              onClick={() => setIsAssignTopicPanelOpen((v) => !v)}
              className="px-4 py-2 rounded-[8px] border-[1.5px] border-[#1F1D1A] text-[14px] font-semibold text-[#1F1D1A] hover:bg-[#E9E2D3] transition-colors cursor-pointer"
            >
              {isAssignTopicPanelOpen ? 'Đóng chọn chủ đề' : 'Chọn chủ đề giao cho lớp'}
            </button>

            {onOpenProblemEditor && (
              <button
                type="button"
                onClick={() => onOpenProblemEditor('NEW')}
                className="px-4 py-2 rounded-[8px] bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[14px] font-semibold transition-colors cursor-pointer"
              >
                + Tạo bài mới
              </button>
            )}
          </div>

          {/* Panel chọn nhanh các chủ đề giao cho lớp này */}
          {isAssignTopicPanelOpen && (
            <div className="p-5 rounded-[10px] bg-[#FFFDF8] border border-[#D9D2C3] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-[#1F1D1A]">
                  Chủ đề đang giao cho lớp {currentClass.className}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAssignTopicPanelOpen(false)}
                  className="text-[13px] text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer"
                >
                  Đóng
                </button>
              </div>
              <div className="divide-y divide-[#D9D2C3] border-t border-[#D9D2C3]">
                {topics.map((t) => {
                  const ids =
                    t.classIds && t.classIds.length > 0 ? t.classIds : t.classId ? [t.classId] : [];
                  const assigned = ids.includes(classId) || ids.includes('ALL');
                  const countInTopic = problems.filter((p) => p.topicId === t.id).length;
                  const isBusy = busyTopicId === t.id;
                  return (
                    <div key={t.id} className="py-3 flex items-center justify-between gap-4 text-[14.5px]">
                      <div className="flex items-center gap-3 min-w-0">
                        {assigned ? (
                          <i className="inline-block w-[10px] h-[10px] rounded-[2px] bg-[#2F6B3F] shrink-0" />
                        ) : (
                          <i
                            className="inline-block w-[10px] h-[10px] rounded-[2px] shrink-0"
                            style={{ boxShadow: 'inset 0 0 0 1.5px #A39B8B' }}
                          />
                        )}
                        <b className="truncate">{t.name}</b>
                        <span className="text-[13px] text-[#6B655C] shrink-0">({countInTopic} bài)</span>
                      </div>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleTopicForThisClass(t.id, !assigned)}
                        className={`text-[13.5px] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                          assigned
                            ? 'text-[#6B655C] hover:text-[#B4281F] underline'
                            : 'text-[#B4281F] hover:underline'
                        }`}
                      >
                        {isBusy ? 'Đang lưu...' : assigned ? 'Bỏ giao' : 'Giao cho lớp →'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bảng danh sách bài được giao */}
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="border-t-2 border-[#1F1D1A] py-2.5 grid grid-cols-[120px_1.3fr_100px_140px_120px_75px] gap-4 items-center text-[13px] text-[#6B655C]">
                <span>Mã bài</span>
                <span>Chủ đề</span>
                <span>Độ khó</span>
                <span>Giới hạn</span>
                <span>Test</span>
                <span />
              </div>

              {filteredClassProblems.length === 0 ? (
                <div className="border-t border-b border-[#D9D2C3] py-10 text-center text-[14px] text-[#6B655C]">
                  Chưa có bài tập nào được giao cho lớp này. Bấm <b>Chọn chủ đề giao cho lớp</b> để giao bài.
                </div>
              ) : (
                <div className="border-b border-[#D9D2C3]">
                  {filteredClassProblems.map((p) => {
                    const tcCount = getEffectiveTestCount(p, problemTestCounts);
                    return (
                      <div
                        key={p.id}
                        className="border-t border-[#D9D2C3] py-3.5 grid grid-cols-[120px_1.3fr_100px_140px_120px_75px] gap-4 items-center text-[14px] hover:bg-black/[0.015]"
                      >
                        <b className="font-mono text-[#1F1D1A] truncate">{p.code}</b>
                        <span className="truncate">{topicNameMap.get(p.topicId) || 'Chưa gắn chủ đề'}</span>
                        <span>{p.difficulty || 'Dễ'}</span>
                        <span className="text-[#6B655C] whitespace-nowrap">
                          {p.timeLimit || 1} giây · {p.memoryLimit || 1024} MB
                        </span>
                        <span className="whitespace-nowrap">
                          {tcCount > 0 ? (
                            <span className="inline-flex items-center">
                              <i className="inline-block w-[10px] h-[10px] rounded-[2px] mr-2 bg-[#2F6B3F]" />
                              {tcCount} test
                            </span>
                          ) : (
                            <span className="inline-flex items-center">
                              <i className="inline-block w-[10px] h-[10px] rounded-[2px] mr-2 bg-[#D69A1F]" />
                              <b className="text-[#8A5A00]">Chưa có test</b>
                            </span>
                          )}
                        </span>
                        <div className="text-right">
                          {onOpenProblemEditor && (
                            <button
                              type="button"
                              onClick={() => onOpenProblemEditor(p.id)}
                              className="text-[#B4281F] font-semibold hover:underline cursor-pointer"
                            >
                              Sửa →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 3: BẢNG ĐIỂM / XẾP HẠNG LỚP
         ============================================================ */}
      {activeTab === 'grades' && <ClassLeaderboard classId={classId} variant="teacher-full" />}

      {/* ============================================================
          TAB 4: NỘP BÀI CỦA RIÊNG LỚP (0 request thừa)
         ============================================================ */}
      {activeTab === 'submissions' && (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="border-t-2 border-[#1F1D1A] py-2.5 grid grid-cols-[115px_1.2fr_140px_110px_130px_90px] gap-4 items-center text-[13px] text-[#6B655C]">
              <span>Thời gian</span>
              <span>Học sinh</span>
              <span>Bài</span>
              <span>Điểm</span>
              <span>Kết quả</span>
              <span />
            </div>

            {classSubmissions.length === 0 ? (
              <div className="border-t border-b border-[#D9D2C3] py-10 text-center text-[14px] text-[#6B655C]">
                Chưa có lượt nộp bài nào trong lớp này.
              </div>
            ) : (
              <div className="border-b border-[#D9D2C3]">
                {classSubmissions.slice(0, 60).map((sub) => (
                  <div
                    key={sub.id}
                    className="border-t border-[#D9D2C3] py-3.5 grid grid-cols-[115px_1.2fr_140px_110px_130px_90px] gap-4 items-center text-[14px] hover:bg-black/[0.015]"
                  >
                    <span className="font-mono text-[13px] text-[#6B655C]">
                      {formatShortSubmissionTime(sub.submittedAt)}
                    </span>
                    <b className="text-[#1F1D1A] truncate">{sub.userName || 'Học sinh'}</b>
                    <span className="font-mono text-[13.5px] text-[#1F1D1A] truncate">
                      {sub.problemCode}
                    </span>
                    <span className="font-mono text-[#1F1D1A]">
                      {sub.totalPointsEarned}/{sub.maxTotalPoints}
                    </span>
                    <div>{renderVerdictBadge(sub)}</div>
                    <button
                      type="button"
                      onClick={() => handleOpenSubDetail(sub)}
                      className="text-right text-[#B4281F] font-semibold hover:underline cursor-pointer"
                    >
                      Chi tiết →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 5: CÀI ĐẶT LỚP
         ============================================================ */}
      {activeTab === 'settings' && (
        <div className="max-w-xl space-y-8">
          <form onSubmit={handleSaveClassSettings} className="border-t-2 border-[#1F1D1A] pt-5 space-y-4">
            <h2 className="text-[20px] font-bold text-[#1F1D1A]">Thông tin lớp học</h2>

            <div>
              <label className="block font-semibold text-[14px] mb-1.5">Tên lớp học</label>
              <input
                type="text"
                value={editClassName}
                onChange={(e) => setEditClassName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[14px] mb-1.5">Mô tả lớp học</label>
              <textarea
                rows={3}
                value={editClassDesc}
                onChange={(e) => setEditClassDesc(e.target.value)}
                placeholder="Giao đề, bài tập và chấm điểm chuẩn Themis cho học sinh của lớp."
                className="w-full px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 rounded-[8px] bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[14.5px] font-semibold cursor-pointer disabled:opacity-60"
              >
                {isSavingSettings ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>

          <div className="border-t border-[#D9D2C3] pt-5">
            <h3 className="text-[16px] font-bold text-[#B4281F]">Xóa lớp học</h3>
            <p className="text-[14px] text-[#6B655C] mt-1 mb-4">
              Xóa lớp sẽ ngắt liên kết học sinh khỏi lớp này. Các bài tập và bộ test trong Kho bài vẫn được giữ nguyên.
            </p>
            <button
              type="button"
              onClick={handleDeleteCurrentClass}
              className="px-4 py-2 rounded-[8px] border-[1.5px] border-[#B4281F] text-[#B4281F] hover:bg-[#B4281F] hover:text-white text-[14px] font-semibold transition-colors cursor-pointer"
            >
              Xóa lớp "{currentClass.className}"
            </button>
          </div>
        </div>
      )}

      {/* Modal xem chi tiết 1 lượt nộp bài */}
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
              {isLoadingSub ? (
                <div className="py-10 text-center text-[14px] text-[#6B655C]">
                  Đang tải mã nguồn và bảng chấm từng test...
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
                            setCopiedSubCode(true);
                            setTimeout(() => setCopiedSubCode(false), 1800);
                          }}
                          className="inline-flex items-center gap-1.5 text-[12.5px] text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer"
                        >
                          {copiedSubCode ? (
                            <Check className="w-3.5 h-3.5 text-[#2F6B3F]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedSubCode ? 'Đã sao chép' : 'Sao chép code'}</span>
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

      {/* Modal điều chỉnh / gia hạn thời gian của học sinh trong lớp */}
      <ClassExpiryModal
        isOpen={Boolean(expiryModalStudent)}
        onClose={() => setExpiryModalStudent(null)}
        className={currentClass.className}
        studentName={expiryModalStudent?.fullName || ''}
        studentEmail={expiryModalStudent ? getDisplayEmail(expiryModalStudent) : ''}
        currentExpiresAt={
          expiryModalStudent ? getStudentClassExpiry(classId, expiryModalStudent) : null
        }
        nowMs={serverNowMs}
        onSave={async (newExpiresAt) => {
          if (!expiryModalStudent) return;
          await updateStudentClassExpiry(
            classId,
            expiryModalStudent.id,
            newExpiresAt,
            expiryModalStudent.username,
            expiryModalStudent.email
          );
        }}
      />
    </div>
  );
};
