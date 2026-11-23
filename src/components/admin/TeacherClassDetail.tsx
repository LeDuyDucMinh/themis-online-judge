import React, { useState, useEffect, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { isProblemInClass } from '../../types/judge';
import { storageService } from '../../services/storageService';
import { AdminDashboard } from './AdminDashboard';
import { TopicManager } from './TopicManager';
import { ClassLeaderboard } from '../common/ClassLeaderboard';
import { Check, X } from 'lucide-react';

interface TeacherClassDetailProps {
  classId: string;
}

export const TeacherClassDetail: React.FC<TeacherClassDetailProps> = ({ classId }) => {
  const {
    classes,
    setActiveClassId,
    getStudentsInClass,
    getPendingStudentsInClass,
    approveStudentJoin,
    rejectStudentJoin,
    removeStudentFromClass,
    deleteStudent,
    problems,
    topics,
    showToast,
    openConfirmModal,
    refreshAllData,
  } = useJudge();

  useEffect(() => {
    refreshAllData();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshAllData().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [classId]);

  const [activeTab, setActiveTabState] = useState<'assignments' | 'topics' | 'students' | 'leaderboard'>(() => {
    return (storageService.getTeacherClassTab() as any) || 'assignments';
  });
  const setActiveTab = (tab: 'assignments' | 'topics' | 'students' | 'leaderboard') => {
    setActiveTabState(tab);
    storageService.setTeacherClassTab(tab);
  };
  const [copiedCode, setCopiedCode] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const currentClass = classes.find((c) => c.id === classId);
  const classStudents = getStudentsInClass(classId);
  const pendingStudents = getPendingStudentsInClass(classId);
  const classProblems = useMemo(
    () => problems.filter((p) => isProblemInClass(p, classId, topics, classes)),
    [problems, classId, topics, classes]
  );

  const classTopicsCount = useMemo(
    () =>
      topics.filter((t) => {
        const ids = t.classIds && t.classIds.length > 0 ? t.classIds : t.classId ? [t.classId] : ['ALL'];
        return ids.includes(classId) || ids.includes('ALL');
      }).length,
    [topics, classId]
  );

  if (!currentClass) {
    if (classes.length === 0) {
      return (
        <div className="py-16 text-center text-sm text-[#6B655C]">
          Đang tải thông tin lớp học...
        </div>
      );
    }
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-[#6B655C]">Không tìm thấy thông tin lớp học này.</p>
        <button
          type="button"
          onClick={() => setActiveClassId(null)}
          className="mt-4 px-4 py-2 rounded-lg bg-[#B4281F] hover:bg-[#8F1F18] text-white text-xs font-semibold cursor-pointer"
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

  const handleRemoveStudent = (
    studentId: string,
    studentName: string,
    studentUsername?: string,
    studentEmail?: string
  ) => {
    openConfirmModal({
      title: 'Rút học sinh khỏi lớp',
      message: `Bạn có chắc muốn rút học sinh "${studentName}" khỏi lớp "${currentClass.className}"? Tài khoản và bài nộp của học sinh vẫn được giữ nguyên trong hệ thống.`,
      confirmLabel: 'Rút khỏi lớp',
      onConfirm: () => {
        removeStudentFromClass(classId, studentId, studentUsername, studentEmail);
      },
    });
  };

  const handleDeleteStudentCompletely = (studentId: string, studentName: string) => {
    openConfirmModal({
      title: 'Xóa vĩnh viễn tài khoản học sinh',
      message: `Bạn có chắc muốn xóa VĨNH VIỄN tài khoản "${studentName}" khỏi toàn bộ hệ thống? Thao tác này sẽ rút học sinh khỏi mọi lớp học và XÓA SẠCH toàn bộ lịch sử bài nộp trên bảng điểm!`,
      confirmLabel: 'Xóa tài khoản',
      onConfirm: async () => {
        await deleteStudent(studentId);
      },
    });
  };

  const getDisplayEmail = (stu: { email?: string; username?: string }) => {
    return stu.email || (stu.username && stu.username.includes('@') ? stu.username : null);
  };

  const filteredStudents = classStudents.filter((s) => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    const email = getDisplayEmail(s);
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.username.toLowerCase().includes(q) ||
      (email ? email.toLowerCase().includes(q) : false)
    );
  });

  return (
    <div
      className="banner-editorial-page w-full space-y-6 pb-10 text-[#1F1D1A] animate-in fade-in duration-200"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {/* Breadcrumb & Mã vào lớp */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setActiveClassId(null)}
            className="text-[#6B655C] hover:text-[#1F1D1A] underline underline-offset-4 decoration-[#9E9589] transition-colors cursor-pointer whitespace-nowrap"
          >
            ← Danh sách lớp
          </button>
          <span className="text-[#9E9589]">/</span>
          <span className="font-bold text-[#1F1D1A] truncate">{currentClass.className}</span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[#6B655C]">Mã vào lớp</span>
          <span className="font-mono font-bold text-[13.5px] text-[#B4281F] tracking-wide">
            {currentClass.joinCode}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="text-[#6B655C] hover:text-[#1F1D1A] underline underline-offset-4 decoration-[#9E9589] transition-colors cursor-pointer"
            title="Sao chép mã gửi cho học sinh"
          >
            {copiedCode ? 'Đã chép' : 'Sao chép'}
          </button>
        </div>
      </div>

      {/* Header lớp học editorial — không đóng khung thẻ */}
      <div className="flex flex-wrap items-end justify-between gap-6 pt-0.5 pb-1">
        <div className="min-w-0 max-w-2xl">
          <h1
            className="text-[34px] font-bold tracking-tight text-[#1F1D1A] leading-tight"
            style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
          >
            {currentClass.className}
          </h1>
          <p className="text-[14px] text-[#6B655C] mt-1.5 leading-relaxed">
            {currentClass.description || 'Giao đề, bài tập và chấm điểm chuẩn Themis cho học sinh của lớp.'}
          </p>
        </div>

        <div className="flex items-center gap-8 shrink-0">
          <div className="text-right">
            <div className="text-[26px] font-bold font-mono text-[#1F1D1A] leading-none tabular-nums">
              {classProblems.length}
            </div>
            <div className="text-[12px] text-[#6B655C] mt-1">bài tập</div>
          </div>

          <div className="text-right">
            <div className="text-[26px] font-bold font-mono text-[#1F1D1A] leading-none tabular-nums">
              {classStudents.length}
            </div>
            <div className="text-[12px] text-[#6B655C] mt-1">học sinh</div>
          </div>
        </div>
      </div>

      {/* Thanh chuyển tab ngang */}
      <div className="flex items-center gap-7 border-b border-[#D9D2C3] overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 text-[13.5px] whitespace-nowrap border-b-2 -mb-[1px] transition-colors cursor-pointer ${
            activeTab === 'assignments'
              ? 'border-[#B4281F] text-[#1F1D1A] font-semibold'
              : 'border-transparent text-[#6B655C] hover:text-[#1F1D1A] font-medium'
          }`}
        >
          Bài tập &amp; bộ test ({classProblems.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('topics')}
          className={`pb-3 text-[13.5px] whitespace-nowrap border-b-2 -mb-[1px] transition-colors cursor-pointer ${
            activeTab === 'topics'
              ? 'border-[#B4281F] text-[#1F1D1A] font-semibold'
              : 'border-transparent text-[#6B655C] hover:text-[#1F1D1A] font-medium'
          }`}
        >
          Chủ đề của lớp ({classTopicsCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`pb-3 text-[13.5px] whitespace-nowrap border-b-2 -mb-[1px] transition-colors cursor-pointer inline-flex items-center gap-2 ${
            activeTab === 'students'
              ? 'border-[#B4281F] text-[#1F1D1A] font-semibold'
              : 'border-transparent text-[#6B655C] hover:text-[#1F1D1A] font-medium'
          }`}
        >
          <span>Danh sách học sinh ({classStudents.length})</span>
          {pendingStudents.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#B4281F] text-white leading-none">
              {pendingStudents.length} chờ
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          className={`pb-3 text-[13.5px] whitespace-nowrap border-b-2 -mb-[1px] transition-colors cursor-pointer ${
            activeTab === 'leaderboard'
              ? 'border-[#B4281F] text-[#1F1D1A] font-semibold'
              : 'border-transparent text-[#6B655C] hover:text-[#1F1D1A] font-medium'
          }`}
        >
          Bảng xếp hạng
        </button>
      </div>

      {/* Tab 1: Bài tập & bộ test */}
      {activeTab === 'assignments' && (
        <div className="animate-in fade-in duration-150">
          <AdminDashboard classId={classId} hideHeader={true} />
        </div>
      )}

      {/* Tab 2: Chủ đề của lớp */}
      {activeTab === 'topics' && (
        <div className="animate-in fade-in duration-150">
          <TopicManager initialClassId={classId} />
        </div>
      )}

      {/* Tab 3: Danh sách học sinh */}
      {activeTab === 'students' && (
        <div className="space-y-9 pt-1 animate-in fade-in duration-150">
          {/* 1. Đứng đầu lớp (Top 2 + nút xem đầy đủ) */}
          <ClassLeaderboard
            classId={classId}
            variant="teacher-compact"
            maxItems={2}
            onViewFullLeaderboard={() => setActiveTab('leaderboard')}
          />

          {/* 2. Hộp duyệt học sinh chờ tham gia lớp (chỉ hiện khi có yêu cầu) */}
          {pendingStudents.length > 0 && (
            <section className="p-5 rounded-xl bg-[#FDF7E7] border border-[#E5C98B] space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3
                    className="text-[15px] font-bold text-[#7A4B00]"
                    style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
                  >
                    Yêu cầu tham gia lớp chờ duyệt ({pendingStudents.length})
                  </h3>
                  <span className="text-[12.5px] text-[#8C6520]">
                    Học sinh đã nhập mã lớp và đang chờ giáo viên phê duyệt.
                  </span>
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
                        `Đã duyệt tất cả ${pendingStudents.length} học sinh vào lớp`,
                        'success'
                      );
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2D6A4F] hover:bg-[#23543E] text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Duyệt tất cả ({pendingStudents.length})</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-[#EBDAB2] border-t border-[#EBDAB2]">
                {pendingStudents.map(({ student: stu, joinedAt }) => {
                  const email = getDisplayEmail(stu);
                  return (
                    <div
                      key={stu.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[13.5px] text-[#1F1D1A] truncate">
                          {stu.fullName}
                        </div>
                        <div className="text-[12px] text-[#6B655C] mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="font-mono">{email || `@${stu.username}`}</span>
                          <span>·</span>
                          <span>
                            Gửi lúc{' '}
                            {new Date(joinedAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            ({new Date(joinedAt).toLocaleDateString('vi-VN')})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => approveStudentJoin(classId, stu.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#2D6A4F] hover:bg-[#23543E] text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Duyệt</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectStudentJoin(classId, stu.id)}
                          className="p-1.5 rounded-lg text-[#6B655C] hover:text-[#B4281F] hover:bg-black/5 transition-colors cursor-pointer"
                          title="Từ chối yêu cầu"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 3. Học sinh trong lớp */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
              <h2
                className="text-[20px] font-bold tracking-tight text-[#1F1D1A]"
                style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
              >
                Học sinh trong lớp ({classStudents.length})
              </h2>

              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Tìm theo họ tên hoặc email"
                className="w-full sm:w-[300px] px-3.5 py-2 bg-white border border-[#D9D2C3] rounded-lg text-[13px] text-[#1F1D1A] placeholder-[#8C857B] focus:outline-none focus:border-[#1F1D1A]"
              />
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[740px]">
                {/* Header bảng editorial */}
                <div className="border-t-[1.5px] border-[#1F1D1A] border-b border-[#D9D2C3] py-3 grid grid-cols-[44px_minmax(170px,1.15fr)_minmax(210px,1.55fr)_110px_195px] items-center gap-3 text-[12.5px] font-normal text-[#6B655C]">
                  <div>#</div>
                  <div>Họ và tên</div>
                  <div>Email đăng nhập</div>
                  <div>Ngày tạo</div>
                  <div />
                </div>

                {filteredStudents.length === 0 ? (
                  <div className="border-b border-[#D9D2C3] py-10 text-center text-[13.5px] text-[#6B655C]">
                    {studentSearch.trim() ? (
                      'Không tìm thấy học sinh phù hợp với từ khóa tìm kiếm.'
                    ) : (
                      <>
                        Chưa có học sinh nào trong lớp này. Hãy gửi mã vào lớp{' '}
                        <b className="font-mono text-[#B4281F]">{currentClass.joinCode}</b> cho học sinh để tham gia.
                      </>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-[#D9D2C3] border-b border-[#D9D2C3]">
                    {filteredStudents.map((stu, idx) => {
                      const email = getDisplayEmail(stu);
                      return (
                        <div
                          key={stu.id}
                          className="py-3.5 grid grid-cols-[44px_minmax(170px,1.15fr)_minmax(210px,1.55fr)_110px_195px] items-center gap-3 text-[13.5px] hover:bg-black/[0.015] transition-colors"
                        >
                          <div className="font-mono text-[13px] text-[#6B655C] tabular-nums">
                            {idx + 1}
                          </div>

                          <div className="font-bold text-[#1F1D1A] truncate" title={stu.fullName}>
                            {stu.fullName}
                          </div>

                          <div
                            className="font-mono text-[13px] text-[#4E4840] truncate"
                            title={email || stu.username}
                          >
                            {email || stu.username}
                          </div>

                          <div className="text-[13px] text-[#6B655C] tabular-nums">
                            {new Date(stu.createdAt).toLocaleDateString('vi-VN')}
                          </div>

                          <div className="flex items-center justify-end gap-4 whitespace-nowrap text-[13px]">
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveStudent(stu.id, stu.fullName, stu.username, stu.email)
                              }
                              className="text-[#6B655C] hover:text-[#1F1D1A] font-medium transition-colors cursor-pointer"
                              title="Rút học sinh khỏi lớp này (giữ bài làm và tài khoản)"
                            >
                              Rút khỏi lớp
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudentCompletely(stu.id, stu.fullName)}
                              className="text-[#B4281F] hover:text-[#8F1F18] font-medium transition-colors cursor-pointer"
                              title="Xóa vĩnh viễn tài khoản & xóa sạch lịch sử bài nộp"
                            >
                              Xóa tài khoản
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {studentSearch.trim() && filteredStudents.length > 0 && (
              <p className="mt-3 text-[12.5px] text-[#6B655C]">
                Đang hiện {filteredStudents.length} / {classStudents.length} học sinh trong lớp.
              </p>
            )}
          </section>
        </div>
      )}

      {/* Tab 4: Bảng xếp hạng đầy đủ */}
      {activeTab === 'leaderboard' && (
        <div className="pt-1 animate-in fade-in duration-150">
          <ClassLeaderboard classId={classId} variant="teacher-full" />
        </div>
      )}
    </div>
  );
};
