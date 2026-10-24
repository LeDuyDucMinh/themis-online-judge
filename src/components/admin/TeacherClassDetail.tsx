import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { isProblemInClass } from '../../types/judge';
import { AdminDashboard } from './AdminDashboard';
import { TopicManager } from './TopicManager';
import {
  ArrowLeft,
  GraduationCap,
  Users,
  FileCode2,
  Copy,
  Check,
  UserPlus,
  Trash2,
  KeyRound,
  Calendar,
  X,
  Search,
  BookOpen,
  ListTree,
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
    students,
    enrollStudentToClass,
    removeStudentFromClass,
    addStudent,
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
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const [activeTab, setActiveTab] = useState<'assignments' | 'topics' | 'students'>('assignments');
  const [copiedCode, setCopiedCode] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Modal thêm học sinh
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [selectedExistingStudentId, setSelectedExistingStudentId] = useState('');
  const [newStudentFullName, setNewStudentFullName] = useState('');
  const [newStudentUsername, setNewStudentUsername] = useState('');
  const [newStudentPassword, setNewStudentPassword] = useState('123');
  const [addMode, setAddMode] = useState<'existing' | 'create'>('existing');

  const currentClass = classes.find((c) => c.id === classId);
  const classStudents = getStudentsInClass(classId);
  const pendingStudents = getPendingStudentsInClass(classId);
  const classProblems = problems.filter((p) => isProblemInClass(p, classId, topics));

  if (!currentClass) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-sm text-slate-400">Không tìm thấy thông tin lớp học này.</p>
        <button
          onClick={() => setActiveClassId(null)}
          className="mt-4 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold"
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

  const handleRemoveStudent = (studentId: string, studentName: string) => {
    openConfirmModal({
      title: 'Xóa học sinh khỏi lớp',
      message: `Bạn có chắc muốn đưa học sinh "${studentName}" ra khỏi lớp "${currentClass.className}"? Tài khoản của học sinh vẫn được giữ nguyên trong hệ thống.`,
      confirmLabel: 'Xác nhận xóa',
      onConfirm: () => {
        removeStudentFromClass(classId, studentId);
      },
    });
  };

  // Các học sinh trong hệ thống chưa thuộc lớp này
  const classStudentIds = new Set(classStudents.map((s) => s.id));
  const availableStudents = students.filter((s) => !classStudentIds.has(s.id));

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addMode === 'existing') {
      if (!selectedExistingStudentId) {
        showToast('Vui lòng chọn', 'Chọn một học sinh từ danh sách để thêm vào lớp', 'warning');
        return;
      }
      enrollStudentToClass(classId, selectedExistingStudentId);
      setIsAddStudentModalOpen(false);
      setSelectedExistingStudentId('');
    } else {
      if (!newStudentFullName.trim() || !newStudentUsername.trim()) {
        showToast('Thiếu thông tin', 'Vui lòng nhập Họ tên và Tên đăng nhập cho học sinh mới', 'warning');
        return;
      }
      const res = await addStudent(newStudentFullName.trim(), newStudentUsername.trim(), newStudentPassword.trim() || '123');
      if (res.success) {
        // Tự động gán vào lớp
        const created = students.find((s) => s.username === newStudentUsername.trim().toLowerCase());
        if (created) {
          enrollStudentToClass(classId, created.id);
        }
        setIsAddStudentModalOpen(false);
        setNewStudentFullName('');
        setNewStudentUsername('');
        setNewStudentPassword('123');
      }
    }
  };

  const filteredStudents = classStudents.filter((s) => {
    const q = studentSearch.toLowerCase();
    return s.fullName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-200">
      {/* Breadcrumb Navigation & Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <button
            onClick={() => setActiveClassId(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-red-500 font-bold border border-slate-300 dark:border-slate-700 transition-all cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 text-red-500 group-hover:-translate-x-0.5 transition-transform" />
            <span>Danh sách Lớp học</span>
          </button>
          <span>/</span>
          <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-none">
            {currentClass.className}
          </span>
        </div>

        {/* Join Code Banner */}
        <div className={`px-4 py-2 rounded-2xl border flex items-center gap-3 shadow-sm ${
          theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Mã vào lớp:</span>
            <span className="font-mono font-black text-sm text-red-600 dark:text-red-400 tracking-wider">
              {currentClass.joinCode}
            </span>
          </div>
          <button
            onClick={handleCopyCode}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all border ${
              copiedCode
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
            title="Sao chép mã gửi cho học sinh"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Đã chép' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Hero Banner lớp học */}
      <div className={`p-6 rounded-3xl border relative overflow-hidden shadow-sm ${
        theme === 'light'
          ? 'bg-gradient-to-r from-red-50 via-white to-slate-50 border-red-200'
          : 'bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-950 border-red-500/30'
      }`}>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-500 text-[10px] font-extrabold uppercase tracking-wide border border-red-500/20">
              <GraduationCap className="w-3 h-3" /> Không gian lớp học độc lập
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {currentClass.className}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {currentClass.description || 'Không gian giao đề thi, bài tập và chấm điểm chuẩn Themis cho học sinh của lớp.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-3 rounded-2xl border text-center min-w-[90px] ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'
            }`}>
              <div className="text-xl font-black text-red-600 dark:text-red-400">{classProblems.length}</div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                <FileCode2 className="w-3 h-3 text-amber-500" /> Bài tập
              </div>
            </div>

            <div className={`px-4 py-3 rounded-2xl border text-center min-w-[90px] relative ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'
            }`}>
              <div className="text-xl font-black text-blue-600 dark:text-blue-400">{classStudents.length}</div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                <Users className="w-3 h-3 text-blue-500" /> Học sinh
              </div>
              {pendingStudents.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 shadow">
                  +{pendingStudents.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher: [Bài tập] vs [Chủ đề] vs [Học sinh] */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'assignments'
              ? 'border-red-600 text-red-600 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Bài tập & Bộ test ({classProblems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('topics')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'topics'
              ? 'border-red-600 text-red-600 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
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
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'students'
              ? 'border-red-600 text-red-600 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Danh sách Học sinh ({classStudents.length})</span>
          {pendingStudents.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
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
                          <div className="font-mono text-[11px] text-blue-500 truncate">
                            @{stu.username}
                          </div>
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
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Tìm học sinh theo họ tên, username..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <button
              onClick={() => setIsAddStudentModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm học sinh vào lớp</span>
            </button>
          </div>

          {/* Table Học sinh */}
          <div className={`rounded-2xl border overflow-hidden shadow-sm ${
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={`border-b font-bold text-slate-500 dark:text-slate-400 ${
                  theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-800'
                }`}>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Họ và tên</th>
                  <th className="py-3 px-4">Tên đăng nhập</th>
                  <th className="py-3 px-4">Mật khẩu</th>
                  <th className="py-3 px-4">Ngày tạo</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      Chưa có học sinh nào trong lớp này. Hãy bấm "Thêm học sinh vào lớp" hoặc gửi mã{' '}
                      <b className="text-red-500 font-mono">{currentClass.joinCode}</b> cho học sinh.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((stu, idx) => (
                    <tr key={stu.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-red-500/15 text-red-500 font-bold flex items-center justify-center text-xs">
                          {stu.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span>{stu.fullName}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-500 font-semibold">{stu.username}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        <span className="flex items-center gap-1">
                          <KeyRound className="w-3 h-3 text-amber-500" />
                          <span>{stu.password}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(stu.createdAt).toLocaleDateString('vi-VN')}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRemoveStudent(stu.id, stu.fullName)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Xóa học sinh khỏi lớp"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Thêm Học Sinh */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl relative ${
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-500" />
                <span>Thêm học sinh vào {currentClass.className}</span>
              </h3>
              <button
                onClick={() => setIsAddStudentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-2 gap-2 mt-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setAddMode('existing')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                  addMode === 'existing'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Chọn từ hệ thống
              </button>
              <button
                type="button"
                onClick={() => setAddMode('create')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                  addMode === 'create'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Tạo tài khoản mới
              </button>
            </div>

            <form onSubmit={handleEnrollStudent} className="space-y-4 mt-4">
              {addMode === 'existing' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Chọn học sinh sẵn có:
                  </label>
                  {availableStudents.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                      Tất cả học sinh trong hệ thống đã có mặt trong lớp này, hoặc bạn chưa tạo học sinh nào.
                    </div>
                  ) : (
                    <select
                      value={selectedExistingStudentId}
                      onChange={(e) => setSelectedExistingStudentId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    >
                      <option value="">-- Chọn học sinh --</option>
                      {availableStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName} ({s.username})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Họ và tên học sinh: *
                    </label>
                    <input
                      type="text"
                      value={newStudentFullName}
                      onChange={(e) => setNewStudentFullName(e.target.value)}
                      placeholder="Ví dụ: Trần Văn Nam"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tên đăng nhập: *
                    </label>
                    <input
                      type="text"
                      value={newStudentUsername}
                      onChange={(e) => setNewStudentUsername(e.target.value)}
                      placeholder="Ví dụ: namtran"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mật khẩu cấp ban đầu:
                    </label>
                    <input
                      type="text"
                      value={newStudentPassword}
                      onChange={(e) => setNewStudentPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-white hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={addMode === 'existing' && availableStudents.length === 0}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/20"
                >
                  Thêm vào lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
