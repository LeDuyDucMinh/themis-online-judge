import React, { useState, useMemo } from 'react';
import {
  Crown,
  Users,
  GraduationCap,
  FileCode2,
  BookOpen,
  UserCheck,
  UserMinus,
  Search,
  ArrowRight,
  Server,
  CloudUpload,
  RefreshCw,
  Sparkles,
  Mail,
} from 'lucide-react';
import { useJudge } from '../../context/JudgeContext';
import { storageService } from '../../services/storageService';
import {
  isProblemInClass,
  isResourceOwnedByTeacher,
  type StudentUser,
  type AccountRole,
} from '../../types/judge';

interface SuperAdminDashboardProps {
  onNavigateTab: (
    tab:
      | 'admin_dashboard'
      | 'admin_teachers'
      | 'admin_users'
      | 'admin_classes'
      | 'admin_topics'
      | 'submissions'
  ) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onNavigateTab,
}) => {
  const {
    adminEmail,
    students,
    allClasses,
    allTopics,
    allProblems,
    submissions,
    updateUserRole,
    openConfirmModal,
    setActiveClassId,
    setIsServerConfigModalOpen,
    syncToCloud,
    refreshAllData,
    isRefreshing,
    getStudentsInClass,
    getPendingStudentsInClass,
  } = useJudge();

  const [quickSearch, setQuickSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const rolesMap = useMemo(() => storageService.getUserRolesMap(), [students]);

  const getDisplayName = (s: StudentUser): string => {
    const custom = storageService.getStudentCustomName(s.id, s.email || s.username);
    if (custom && custom.trim()) return custom.trim();
    if (s.fullName && s.fullName.trim() && s.fullName !== 'Học sinh') {
      return s.fullName.trim();
    }
    return s.username || 'Chưa đặt tên';
  };

  const getDisplayEmail = (s: StudentUser): string => {
    const raw = s.email || (s.username && s.username.includes('@') ? s.username : null);
    return (raw || s.username || '').trim().toLowerCase();
  };

  const getEffectiveRole = (s: StudentUser): AccountRole => {
    const email = getDisplayEmail(s);
    if (email === 'minh.ldd2610979@sis.hust.edu.vn') return 'admin';
    if (s.role === 'admin' || s.role === 'teacher' || s.role === 'student') {
      return s.role;
    }
    const mapped = rolesMap[email];
    if (mapped === 'admin' || mapped === 'teacher' || mapped === 'student') {
      return mapped;
    }
    return 'student';
  };

  // Danh sách toàn bộ tài khoản hợp lệ
  const allAccounts = useMemo(() => {
    const map = new Map<string, StudentUser>();
    students.forEach((s) => {
      const email = getDisplayEmail(s);
      if (!email || !email.includes('@')) return;
      const existing = map.get(email);
      if (!existing) {
        map.set(email, s);
      } else {
        const mergedRole = s.role || existing.role;
        map.set(email, { ...existing, ...s, role: mergedRole });
      }
    });

    if (!map.has('minh.ldd2610979@sis.hust.edu.vn')) {
      map.set('minh.ldd2610979@sis.hust.edu.vn', {
        id: '44a78249-dd15-4011-b1de-e8190b4352fa',
        fullName: 'Lê Duy Đức Minh (Admin tối cao)',
        username: 'minh.ldd2610979@sis.hust.edu.vn',
        email: 'minh.ldd2610979@sis.hust.edu.vn',
        password: '',
        createdAt: '2026-10-25T15:10:00.000Z',
        role: 'admin',
      });
    }

    if (!map.has('leduyducminh@gmail.com')) {
      map.set('leduyducminh@gmail.com', {
        id: 'abf4d6f8-b481-490b-b36e-5fbb30409d48',
        fullName: 'Lê Duy Đức Minh (Giáo viên)',
        username: 'leduyducminh@gmail.com',
        email: 'leduyducminh@gmail.com',
        password: '',
        createdAt: '2026-10-25T15:00:00.000Z',
        role: 'teacher',
      });
    }

    return Array.from(map.values());
  }, [students, rolesMap]);

  const teachersList = useMemo(
    () => allAccounts.filter((a) => getEffectiveRole(a) === 'teacher'),
    [allAccounts]
  );

  const adminsList = useMemo(
    () => allAccounts.filter((a) => getEffectiveRole(a) === 'admin'),
    [allAccounts]
  );

  const studentsList = useMemo(
    () => allAccounts.filter((a) => getEffectiveRole(a) === 'student'),
    [allAccounts]
  );

  // Tìm kiếm nhanh học sinh để cấp quyền Giáo viên
  const candidateAccountsForPromotion = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    const list = studentsList.filter((s) => {
      if (!q) return true;
      return (
        getDisplayName(s).toLowerCase().includes(q) ||
        getDisplayEmail(s).toLowerCase().includes(q)
      );
    });
    return list.slice(0, 6);
  }, [studentsList, quickSearch]);

  const handlePromoteToTeacher = (user: StudentUser) => {
    const name = getDisplayName(user);
    const email = getDisplayEmail(user);
    openConfirmModal({
      title: 'Cấp quyền Giáo viên chính thức',
      message: `Bạn có chắc chắn muốn cấp quyền GIÁO VIÊN cho tài khoản "${name}" (${email})? Khi đăng nhập, tài khoản này sẽ vào giao diện Giáo viên để tự tạo lớp học và đề bài riêng.`,
      confirmLabel: 'Cấp quyền Giáo viên',
      onConfirm: async () => {
        try {
          setUpdatingId(user.id);
          await updateUserRole(user.id, email, 'teacher');
        } finally {
          setUpdatingId(null);
        }
      },
    });
  };

  const handleDemoteToStudent = (user: StudentUser) => {
    const name = getDisplayName(user);
    const email = getDisplayEmail(user);
    openConfirmModal({
      title: 'Thu hồi quyền Giáo viên',
      message: `Bạn có chắc chắn muốn hạ tài khoản Giáo viên "${name}" (${email}) về lại vai trò Học sinh? Toàn bộ lớp học và bộ test của giáo viên này vẫn được giữ nguyên an toàn.`,
      confirmLabel: 'Chuyển về Học sinh',
      onConfirm: async () => {
        try {
          setUpdatingId(user.id);
          await updateUserRole(user.id, email, 'student');
        } finally {
          setUpdatingId(null);
        }
      },
    });
  };

  const handleCloudSync = async () => {
    setIsSyncing(true);
    try {
      await syncToCloud();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-7 pb-14 animate-in fade-in duration-200">
      {/* ===================================================================== */}
      {/* 1. SUPREME COMMAND BANNER (OBSIDIAN & ROYAL GOLD)                     */}
      {/* ===================================================================== */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-r from-[#0e0c0a] via-[#17130d] to-[#110e0a] p-6 sm:p-8 text-white shadow-2xl">
        <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-44 w-44 rounded-full bg-yellow-500/5 blur-2xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[11px] font-black uppercase tracking-widest">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>SUPREME ADMIN • TRUNG TÂM QUYỀN LỰC TỐI CAO</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Bảng Điều Khiển Quản Trị Hệ Thống Toàn Diện
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
              Xin chào Admin tối cao{' '}
              <span className="font-mono font-bold text-amber-300">
                {adminEmail || 'minh.ldd2610979@sis.hust.edu.vn'}
              </span>
              . Tại đây bạn nắm toàn quyền cấp phép Giáo viên, quản lý Học sinh toàn hệ thống và giám sát mọi lớp học & kho đề.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleCloudSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 text-xs font-black transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{isSyncing ? 'Đang đồng bộ Cloud...' : 'Đồng bộ Cloud Toàn Hệ Thống'}</span>
            </button>

            <button
              onClick={() => setIsServerConfigModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs font-bold transition-all cursor-pointer"
            >
              <Server className="w-4 h-4 text-amber-400" />
              <span>Cấu hình Server VPS</span>
            </button>

            <button
              onClick={() => refreshAllData()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-stone-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Làm mới toàn bộ dữ liệu từ Supabase Cloud"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. 4 THẺ CHỈ SỐ TOÀN HỆ THỐNG (GOLD STAT CARDS)                       */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Đội ngũ Giáo viên */}
        <div
          onClick={() => onNavigateTab('admin_teachers')}
          className="group p-5 rounded-2xl border border-amber-500/30 bg-white dark:bg-[#12100d] hover:border-amber-500 transition-all cursor-pointer shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                ĐỘI NGŨ GIÁO VIÊN
              </span>
              <div className="text-3xl font-black text-stone-900 dark:text-white mt-1">
                {teachersList.length}
                <span className="text-xs font-bold text-stone-400 ml-1.5">
                  giáo viên (+{adminsList.length} Admin)
                </span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
            <span>Cấp quyền & Quản lý GV</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: Tổng số Học sinh */}
        <div
          onClick={() => onNavigateTab('admin_users')}
          className="group p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#12100d] hover:border-amber-500/60 transition-all cursor-pointer shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                HỌC SINH TOÀN HỆ THỐNG
              </span>
              <div className="text-3xl font-black text-stone-900 dark:text-white mt-1">
                {studentsList.length}
                <span className="text-xs font-bold text-stone-400 ml-1.5">tài khoản</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span>Quản lý tất cả Học sinh</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 3: Tất cả Lớp học */}
        <div
          onClick={() => {
            setActiveClassId(null);
            onNavigateTab('admin_classes');
          }}
          className="group p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#12100d] hover:border-amber-500/60 transition-all cursor-pointer shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                LỚP HỌC TOÀN HỆ THỐNG
              </span>
              <div className="text-3xl font-black text-stone-900 dark:text-white mt-1">
                {allClasses.length}
                <span className="text-xs font-bold text-stone-400 ml-1.5">lớp đang mở</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400">
            <span>Giám sát mọi Lớp học</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 4: Kho Đề bài & Lượt nộp */}
        <div
          onClick={() => onNavigateTab('admin_topics')}
          className="group p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#12100d] hover:border-amber-500/60 transition-all cursor-pointer shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                KHO ĐỀ & BÀI NỘP
              </span>
              <div className="text-3xl font-black text-stone-900 dark:text-white mt-1">
                {allProblems.length}
                <span className="text-xs font-bold text-stone-400 ml-1.5">
                  đề • {submissions.length} bài nộp
                </span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <FileCode2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400">
            <span>Xem {allTopics.length} Chủ đề & Kho đề</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. KHU VỰC PHÂN QUYỀN NHANH & GIÁM SÁT ĐỘI NGŨ GIÁO VIÊN              */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột Trái (7 phần): Danh sách Đội ngũ Giáo viên & Tài nguyên sở hữu */}
        <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#12100d] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-stone-900 dark:text-white">
                  Đội ngũ Giáo viên đang hoạt động ({teachersList.length})
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Mỗi giáo viên quản lý độc lập các lớp học, chủ đề và đề bài của riêng mình
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('admin_teachers')}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-stone-200 dark:divide-stone-800">
            {teachersList.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-bold text-stone-700 dark:text-stone-300">
                  Chưa có tài khoản Giáo viên nào
                </p>
                <p className="text-xs text-stone-500">
                  Hãy cấp quyền Giáo viên cho tài khoản từ khung bên phải.
                </p>
              </div>
            ) : (
              teachersList.map((teacher) => {
                const email = getDisplayEmail(teacher);
                const name = getDisplayName(teacher);
                const ownedClasses = allClasses.filter((c) =>
                  isResourceOwnedByTeacher(c.teacherId, email)
                );
                const ownedTopics = allTopics.filter((t) =>
                  isResourceOwnedByTeacher(t.teacherId, email)
                );
                const ownedProblems = allProblems.filter((p) =>
                  isResourceOwnedByTeacher(p.teacherId || p.author, email)
                );

                return (
                  <div
                    key={teacher.id || email}
                    className="p-5 hover:bg-stone-50 dark:hover:bg-stone-900/50 transition-colors space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-sm flex items-center justify-center shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-stone-900 dark:text-white">
                              {name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                              👨‍🏫 Giáo viên chính thức
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 font-mono mt-0.5">
                            <Mail className="w-3 h-3" />
                            <span>{email}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDemoteToStudent(teacher)}
                        disabled={updatingId === teacher.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-red-600 hover:text-white border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer disabled:opacity-50"
                        title="Thu hồi quyền Giáo viên (chuyển về Học sinh)"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        <span>Thu hồi quyền GV</span>
                      </button>
                    </div>

                    {/* Thống kê tài nguyên của Giáo viên này */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-100 dark:bg-stone-800/90 text-stone-700 dark:text-stone-300">
                        🏫 <b>{ownedClasses.length}</b> lớp học
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-100 dark:bg-stone-800/90 text-stone-700 dark:text-stone-300">
                        📚 <b>{ownedTopics.length}</b> chủ đề
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-100 dark:bg-stone-800/90 text-stone-700 dark:text-stone-300">
                        💻 <b>{ownedProblems.length}</b> bài tập
                      </span>
                    </div>

                    {/* Danh sách các lớp của Giáo viên này để Admin bấm vào kiểm tra ngay */}
                    {ownedClasses.length > 0 && (
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-stone-400">
                          Truy cập nhanh lớp của GV:
                        </span>
                        {ownedClasses.map((cls) => (
                          <button
                            key={cls.id}
                            onClick={() => {
                              setActiveClassId(cls.id);
                              onNavigateTab('admin_classes');
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                          >
                            <GraduationCap className="w-3.5 h-3.5" />
                            <span>Lớp {cls.className}</span>
                            <span className="text-[10px] opacity-75">({cls.joinCode})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cột Phải (5 phần): Cấp quyền Giáo viên 1 chạm cho tài khoản đã đăng ký */}
        <div className="lg:col-span-5 rounded-2xl border border-amber-500/30 bg-white dark:bg-[#12100d] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-stone-900 dark:text-white">
                  Cấp quyền Giáo viên nhanh
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Tìm tài khoản đã đăng ký để nâng cấp lên Giáo viên với 1 cú nhấp
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Nhập email hoặc tên người đăng ký..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="divide-y divide-stone-200 dark:divide-stone-800 flex-1">
            {candidateAccountsForPromotion.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500">
                Không tìm thấy tài khoản Học sinh nào khớp với từ khóa.
              </div>
            ) : (
              candidateAccountsForPromotion.map((stu) => {
                const email = getDisplayEmail(stu);
                const name = getDisplayName(stu);
                const isBusy = updatingId === stu.id;

                return (
                  <div
                    key={stu.id || email}
                    className="p-3.5 px-5 flex items-center justify-between gap-3 hover:bg-stone-50 dark:hover:bg-stone-900/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-stone-900 dark:text-white truncate">
                        {name}
                      </div>
                      <div className="font-mono text-[11px] text-stone-500 dark:text-stone-400 truncate">
                        {email}
                      </div>
                    </div>

                    <button
                      onClick={() => handlePromoteToTeacher(stu)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isBusy ? 'Đang cấp...' : 'Cấp quyền GV'}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/50 text-center">
            <button
              onClick={() => onNavigateTab('admin_teachers')}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Mở trang Quản lý Giáo viên & Phân quyền đầy đủ &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. GIÁM SÁT TOÀN BỘ LỚP HỌC TRÊN HỆ THỐNG                             */}
      {/* ===================================================================== */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#12100d] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
              GLOBAL CLASSROOM INSPECTOR
            </span>
            <h2 className="text-lg font-black text-stone-900 dark:text-white">
              Giám sát Tất cả Lớp học Toàn Hệ Thống ({allClasses.length} lớp)
            </h2>
          </div>

          <button
            onClick={() => {
              setActiveClassId(null);
              onNavigateTab('admin_classes');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold transition-colors cursor-pointer"
          >
            <span>Vào trình quản lý Lớp học</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allClasses.map((cls) => {
            const stuCount = getStudentsInClass(cls.id).length;
            const pendingCount = getPendingStudentsInClass(cls.id).length;
            const probCount = allProblems.filter((p) =>
              isProblemInClass(p, cls.id, allTopics, allClasses)
            ).length;

            return (
              <div
                key={cls.id}
                onClick={() => {
                  setActiveClassId(cls.id);
                  onNavigateTab('admin_classes');
                }}
                className="group p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-base text-stone-900 dark:text-white group-hover:text-amber-500 transition-colors">
                      Lớp {cls.className}
                    </span>
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Mã: {cls.joinCode}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/25">
                    <span>👨‍🏫 GV phụ trách: {cls.teacherId || 'leduyducminh@gmail.com'}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-200/70 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                  <span>
                    <b>{stuCount}</b> học sinh{' '}
                    {pendingCount > 0 && (
                      <b className="text-amber-500">(+{pendingCount} chờ duyệt)</b>
                    )}{' '}
                    • <b>{probCount}</b> bài tập
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform">
                    Kiểm tra &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

