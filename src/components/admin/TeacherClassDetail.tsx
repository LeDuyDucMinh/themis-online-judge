import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { isProblemInClass } from '../../types/judge';
import { storageService } from '../../services/storageService';
import { AdminDashboard } from './AdminDashboard';
import { TopicManager } from './TopicManager';
import {
  ArrowLeft,
  GraduationCap,
  Users,
  FileCode2,
  Copy,
  Check,
  Trash2,
  KeyRound,
  Calendar,
  X,
  Search,
  BookOpen,
  ListTree,
  Mail,
  UserMinus,
} from 'lucide-react';

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
    theme,
    refreshAllData,
  } = useJudge();

  useEffect(() => {
    refreshAllData();
    const timer = setInterval(() => {
      refreshAllData().catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [classId]);

  const [activeTab, setActiveTabState] = useState<'assignments' | 'topics' | 'students'>(() => {
    return (storageService.getTeacherClassTab() as any) || 'assignments';
  });
  const setActiveTab = (tab: 'assignments' | 'topics' | 'students') => {
    setActiveTabState(tab);
    storageService.setTeacherClassTab(tab);
  };
  const [copiedCode, setCopiedCode] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const currentClass = classes.find((c) => c.id === classId);
  const classStudents = getStudentsInClass(classId);
  const pendingStudents = getPendingStudentsInClass(classId);
  const classProblems = problems.filter((p) => isProblemInClass(p, classId, topics));

  if (!currentClass) {
    if (classes.length === 0) {
      return (
        <div className="max-w-7xl mx-auto px-4 py-16 text-center animate-pulse">
          <div className="w-12 h-12 bg-slate-800 rounded-2xl mx-auto mb-3" />
          <p className="text-sm text-slate-400">Đang tải thông tin lớp học...</p>
        </div>
      );
    }
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-sm text-slate-400">Không tìm thấy thông tin lớp học này.</p>
        <button
          onClick={() => setActiveClassId(null)}
          className="mt-4 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer"
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

  const handleRemoveStudent = (studentId: string, studentName: string, studentUsername?: string, studentEmail?: string) => {
    openConfirmModal({
      title: 'Đưa học sinh ra khỏi lớp',
      message: `Bạn có chắc muốn đưa học sinh "${studentName}" ra khỏi lớp "${currentClass.className}"? Tài khoản và bài nộp của học sinh vẫn được giữ nguyên trong hệ thống.`,
      confirmLabel: 'Đưa ra khỏi lớp',
      onConfirm: () => {
        removeStudentFromClass(classId, studentId, studentUsername, studentEmail);
      },
    });
  };

  const handleDeleteStudentCompletely = (studentId: string, studentName: string) => {
    openConfirmModal({
      title: 'Xóa vĩnh viễn học sinh khỏi hệ thống',
      message: `Bạn có chắc muốn xóa VĨNH VIỄN học sinh "${studentName}" khỏi toàn bộ hệ thống? Thao tác này sẽ đưa học sinh ra khỏi mọi lớp học và XÓA SẠCH toàn bộ lịch sử bài nộp của học sinh này trên bảng điểm!`,
      confirmLabel: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        await deleteStudent(studentId);
      },
    });
  };



  const getDisplayEmail = (stu: { email?: string; username?: string }) => {
    const raw = stu.email || (stu.username && stu.username.includes('@') ? stu.username : null);
    if (raw === 'leduyducminh@gmail.com') return 'minh.ldd2610979@sis.hust.edu.vn';
    return raw;
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-200">
      {/* Breadcrumb Navigation & Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
          <button
            onClick={() => setActiveClassId(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 hover:text-[#c51f26] font-bold border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 text-[#c51f26]" />
            <span>Danh sách Lớp học</span>
          </button>
          <span>/</span>
          <span className="font-bold text-stone-900 dark:text-white truncate max-w-[200px] sm:max-w-none">
            {currentClass.className}
          </span>
        </div>

        {/* Join Code Banner */}
        <div className="px-3.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-stone-500 dark:text-stone-400 font-medium">Mã vào lớp:</span>
            <span className="font-mono font-bold text-sm text-[#c51f26] dark:text-red-400 tracking-wider">
              {currentClass.joinCode}
            </span>
          </div>
          <button
            onClick={handleCopyCode}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-colors border cursor-pointer ${
              copiedCode
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-stone-50 dark:bg-stone-800 hover:bg-[#c51f26] hover:text-white text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-700'
            }`}
            title="Sao chép mã gửi cho học sinh"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Đã chép' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Hero Banner lớp học 2D minimalist */}
      <div className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-950/20 text-[#c51f26] dark:text-red-400 border border-red-100 dark:border-red-900/30">
              <GraduationCap className="w-3 h-3" /> Không gian lớp học độc lập
            </div>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white tracking-tight">
              {currentClass.className}
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              {currentClass.description || 'Không gian giao đề thi, bài tập và chấm điểm chuẩn Themis cho học sinh của lớp.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-center min-w-[90px]">
              <div className="text-xl font-bold text-[#c51f26] dark:text-red-400">{classProblems.length}</div>
              <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 flex items-center justify-center gap-1">
                <FileCode2 className="w-3 h-3 text-amber-500" /> Bài tập
              </div>
            </div>

            <div className="px-4 py-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-center min-w-[90px] relative">
              <div className="text-xl font-bold text-stone-900 dark:text-stone-100">{classStudents.length}</div>
              <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 flex items-center justify-center gap-1">
                <Users className="w-3 h-3 text-stone-400" /> Học sinh
              </div>
              {pendingStudents.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  +{pendingStudents.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher: [Bài tập] vs [Chủ đề] vs [Học sinh] */}
      <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800">
        <button
          onClick={() => setActiveTab('assignments')}
          className={`pb-2.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'assignments'
              ? 'border-[#c51f26] text-[#c51f26] dark:text-red-400'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Bài tập & Bộ test ({classProblems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('topics')}
          className={`pb-2.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'topics'
              ? 'border-[#c51f26] text-[#c51f26] dark:text-red-400'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <ListTree className="w-4 h-4" />
          <span>
            Chủ đề của lớp (
            {topics.filter((t) => {
              const ids = t.classIds && t.classIds.length > 0 ? t.classIds : (t.classId ? [t.classId] : ['ALL']);
              return ids.includes(classId) || ids.includes('ALL');
            }).length}
            )
          </span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`pb-2.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'students'
              ? 'border-[#c51f26] text-[#c51f26] dark:text-red-400'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Danh sách Học sinh ({classStudents.length})</span>
          {pendingStudents.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
              {pendingStudents.length} chờ duyệt
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Bài tập (Assignments) */}
      {activeTab === 'assignments' && (
        <div className="animate-in fade-in duration-150">
          <AdminDashboard classId={classId} hideHeader={true} />
        </div>
      )}

      {/* Tab 2: Quản lý Chủ đề của lớp (Topics) */}
      {activeTab === 'topics' && (
        <div className="animate-in fade-in duration-150">
          <TopicManager initialClassId={classId} />
        </div>
      )}

      {/* Tab 3: Danh sách Học sinh (Students) */}
      {activeTab === 'students' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Hộp duyệt học sinh chờ tham gia lớp học */}
          {pendingStudents.length > 0 && (
            <div className={`p-5 rounded-2xl border-2 space-y-3 ${
              theme === 'light'
                ? 'bg-amber-50/90 border-amber-300 shadow-sm'
                : 'bg-amber-950/30 border-amber-600/50 shadow-sm'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  <h4 className="text-sm font-black text-amber-800 dark:text-amber-300">
                    Yêu cầu tham gia lớp chờ duyệt ({pendingStudents.length})
                  </h4>
                  <span className="text-[11px] text-amber-700/80 dark:text-amber-400 font-medium hidden sm:inline">
                    • Học sinh đã nhập mã lớp, cần giáo viên phê duyệt để đảm bảo bảo mật
                  </span>
                </div>

                {pendingStudents.length > 1 && (
                  <button
                    onClick={async () => {
                      for (const p of pendingStudents) {
                        await approveStudentJoin(classId, p.student.id);
                      }
                      showToast('Duyệt thành công', `Đã duyệt tất cả ${pendingStudents.length} học sinh vào lớp`, 'success');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Duyệt tất cả ({pendingStudents.length})</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {pendingStudents.map(({ student: stu, joinedAt }) => (
                  <div
                    key={stu.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      theme === 'light' ? 'bg-white border-amber-200' : 'bg-slate-900 border-amber-800/40'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center text-xs shrink-0">
                          {stu.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-slate-900 dark:text-white truncate text-xs">
                            {stu.fullName}
                          </div>
                          {(() => {
                            const email = getDisplayEmail(stu);
                            return email ? (
                              <div className="font-mono text-[11px] text-blue-500 dark:text-blue-400 truncate flex items-center gap-1 mt-0.5" title={email}>
                                <Mail className="w-3 h-3 text-blue-400 shrink-0" />
                                <span className="truncate">{email}</span>
                              </div>
                            ) : (
                              <div className="font-mono text-[11px] text-blue-500 dark:text-blue-400 truncate mt-0.5">
                                @{stu.username}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Gửi lúc: {new Date(joinedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({new Date(joinedAt).toLocaleDateString('vi-VN')})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => approveStudentJoin(classId, stu.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                        title="Duyệt cho học sinh vào lớp"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Duyệt</span>
                      </button>
                      <button
                        onClick={() => rejectStudentJoin(classId, stu.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Từ chối yêu cầu"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Top Bar Học sinh */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Tìm học sinh theo họ tên, username..."
                className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:border-[#c51f26]"
              />
            </div>
          </div>

          {/* Table Học sinh */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden bg-white dark:bg-stone-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 font-bold text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Họ và tên</th>
                  <th className="py-3 px-4">Email / Tên đăng nhập</th>
                  <th className="py-3 px-4">Mật khẩu</th>
                  <th className="py-3 px-4">Ngày tạo</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-stone-500 dark:text-stone-400">
                      Chưa có học sinh nào trong lớp này. Hãy gửi mã vào lớp{' '}
                      <b className="text-[#c51f26] font-mono">{currentClass.joinCode}</b> cho học sinh để tham gia.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((stu, idx) => (
                    <tr key={stu.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-stone-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-stone-900 dark:text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/20 text-[#c51f26] border border-red-100 dark:border-red-900/30 font-bold flex items-center justify-center text-xs">
                          {stu.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span>{stu.fullName}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold">
                        {(() => {
                          const email = getDisplayEmail(stu);
                          return email ? (
                            <span className="flex items-center gap-1.5 text-xs text-stone-800 dark:text-stone-200" title={email}>
                              <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                              <span className="truncate max-w-[200px]">{email}</span>
                            </span>
                          ) : (
                            <span className="text-stone-800 dark:text-stone-200 text-xs">{stu.username}</span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-400">
                        <span className="flex items-center gap-1">
                          <KeyRound className="w-3 h-3 text-amber-500" />
                          <span>{stu.password || 'Auth (Bảo mật)'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-400">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(stu.createdAt).toLocaleDateString('vi-VN')}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRemoveStudent(stu.id, stu.fullName, stu.username, stu.email)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                            title="Đưa học sinh ra khỏi lớp này (giữ bài làm và tài khoản)"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudentCompletely(stu.id, stu.fullName)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-[#c51f26] hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                            title="Xóa vĩnh viễn học sinh & xóa sạch toàn bộ bài nộp khỏi bảng điểm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
