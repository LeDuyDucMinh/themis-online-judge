import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Trash2,
  Search,
  RefreshCw,
  Mail,
  User,
  GraduationCap,
  AlertTriangle,
  ShieldCheck,
  UserCheck,
  UserMinus,
  BookOpen,
  Lock,
  Database,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useJudge } from '../../context/JudgeContext';
import { storageService } from '../../services/storageService';
import { isResourceOwnedByTeacher, type StudentUser, type AccountRole } from '../../types/judge';

interface UserManagerProps {
  mode?: 'teachers' | 'students' | 'all';
}

export const UserManager: React.FC<UserManagerProps> = ({ mode = 'all' }) => {
  const {
    students,
    allClasses,
    allProblems,
    deleteStudent,
    updateUserRole,
    openConfirmModal,
    refreshStudents,
    isRefreshing,
  } = useJudge();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | AccountRole>(() => {
    if (mode === 'teachers') return 'teacher';
    if (mode === 'students') return 'student';
    return 'ALL';
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [showSupabaseGuide, setShowSupabaseGuide] = useState(false);

  useEffect(() => {
    if (mode === 'teachers') setRoleFilter('teacher');
    else if (mode === 'students') setRoleFilter('student');
    else setRoleFilter('ALL');
  }, [mode]);

  // Lấy danh sách liên kết học sinh - lớp học để hiển thị lớp tham gia
  const classStudents = useMemo(() => {
    return storageService.getClassStudents();
  }, [students, allClasses]);

  const rolesMap = useMemo(() => {
    return storageService.getUserRolesMap();
  }, [students]);

  // Lấy tên hiển thị hiện tại của người dùng (ưu tiên tên tuỳ chỉnh mới nhất)
  const getDisplayName = (student: StudentUser): string => {
    const custom = storageService.getStudentCustomName(student.id, student.email || student.username);
    if (custom && custom.trim()) return custom.trim();
    if (student.fullName && student.fullName.trim() && student.fullName !== 'Học sinh') {
      return student.fullName.trim();
    }
    return student.username || 'Chưa đặt tên';
  };

  // Lấy email đăng nhập thực tế (không ghi đè email giáo viên)
  const getDisplayEmail = (student: StudentUser): string => {
    const raw = student.email || (student.username && student.username.includes('@') ? student.username : null);
    return (raw || student.username || 'Chưa cập nhật email').trim().toLowerCase();
  };

  // Xác định vai trò của tài khoản: 'admin' | 'teacher' | 'student'
  const getEffectiveRole = (student: StudentUser): AccountRole => {
    const email = getDisplayEmail(student);
    if (email === 'minh.ldd2610979@sis.hust.edu.vn') return 'admin';
    if (student.role === 'admin' || student.role === 'teacher' || student.role === 'student') {
      return student.role;
    }
    const mapped = rolesMap[email];
    if (mapped === 'admin' || mapped === 'teacher' || mapped === 'student') {
      return mapped;
    }
    return 'student';
  };

  // Lấy danh sách các lớp học học sinh đang tham gia
  const getUserEnrolledClasses = (student: StudentUser): string[] => {
    const cleanId = (student.id || '').trim().toLowerCase();
    const cleanUser = (student.username || '').trim().toLowerCase();
    const cleanEmail = (student.email || '').trim().toLowerCase();

    const enrolledClassIds = new Set<string>();
    classStudents.forEach((cs) => {
      if (!cs.status || cs.status === 'approved') {
        const csId = (cs.studentId || '').trim().toLowerCase();
        const csUser = (cs.studentUsername || '').trim().toLowerCase();
        const csEmail = (cs.studentEmail || '').trim().toLowerCase();
        if (
          (cleanId && csId === cleanId) ||
          (cleanUser && (csId === cleanUser || csUser === cleanUser)) ||
          (cleanEmail && (csEmail === cleanEmail || csUser === cleanEmail))
        ) {
          enrolledClassIds.add(cs.classId);
        }
      }
    });

    return allClasses
      .filter((c) => enrolledClassIds.has(c.id))
      .map((c) => c.className);
  };

  // Lấy danh sách lớp học và số bài tập do Giáo viên sở hữu
  const getTeacherOwnedSummary = (student: StudentUser) => {
    const email = getDisplayEmail(student);
    const ownedClasses = allClasses.filter((c) => isResourceOwnedByTeacher(c.teacherId, email));
    const ownedProblemsCount = allProblems.filter((p) =>
      isResourceOwnedByTeacher(p.teacherId || p.author, email)
    ).length;
    return {
      ownedClasses,
      ownedProblemsCount,
    };
  };

  // Chỉ lấy các tài khoản hợp lệ có Email và khử trùng lặp theo địa chỉ Email
  const validEmailStudents = useMemo(() => {
    const studentMap = new Map<string, StudentUser>();
    students.forEach((s) => {
      const email = (s.email || (s.username && s.username.includes('@') ? s.username : '')).trim().toLowerCase();
      if (!email || !email.includes('@')) return;
      const existing = studentMap.get(email);
      if (!existing) {
        studentMap.set(email, s);
      } else {
        const isExistingUUID = existing.id && !existing.id.startsWith('student_');
        const isNewUUID = s.id && !s.id.startsWith('student_');
        const mergedRole = s.role || existing.role;
        if (isNewUUID && !isExistingUUID) {
          studentMap.set(email, { ...s, role: mergedRole });
        } else if (new Date(s.createdAt || 0).getTime() >= new Date(existing.createdAt || 0).getTime()) {
          studentMap.set(email, { ...s, role: mergedRole });
        } else {
          studentMap.set(email, { ...existing, role: mergedRole });
        }
      }
    });

    // Đảm bảo tài khoản Admin tối cao luôn hiển thị trong danh sách
    if (!studentMap.has('minh.ldd2610979@sis.hust.edu.vn')) {
      studentMap.set('minh.ldd2610979@sis.hust.edu.vn', {
        id: '44a78249-dd15-4011-b1de-e8190b4352fa',
        fullName: 'Lê Duy Đức Minh (Admin tối cao)',
        username: 'minh.ldd2610979@sis.hust.edu.vn',
        email: 'minh.ldd2610979@sis.hust.edu.vn',
        password: '',
        createdAt: '2026-10-25T15:10:00.000Z',
        role: 'admin',
      });
    }

    // Đảm bảo tài khoản Giáo viên leduyducminh@gmail.com luôn hiển thị trong danh sách
    if (!studentMap.has('leduyducminh@gmail.com')) {
      studentMap.set('leduyducminh@gmail.com', {
        id: 'f55ba161-505f-4de3-96ef-2c13df59301e',
        fullName: 'Lê Duy Đức Minh (Giáo viên)',
        username: 'leduyducminh@gmail.com',
        email: 'leduyducminh@gmail.com',
        password: '',
        createdAt: '2026-10-25T15:00:00.000Z',
        role: rolesMap['leduyducminh@gmail.com'] || 'teacher',
      });
    }

    const list = Array.from(studentMap.values());
    // Sắp xếp: Admin tối cao -> Giáo viên -> Học sinh
    const rolePriority: Record<AccountRole, number> = {
      admin: 0,
      teacher: 1,
      student: 2,
    };
    return list.sort((a, b) => {
      const rA = rolePriority[getEffectiveRole(a)];
      const rB = rolePriority[getEffectiveRole(b)];
      if (rA !== rB) return rA - rB;
      return getDisplayName(a).localeCompare(getDisplayName(b), 'vi');
    });
  }, [students, rolesMap]);

  const roleCounts = useMemo(() => {
    let admin = 0;
    let teacher = 0;
    let student = 0;
    validEmailStudents.forEach((s) => {
      const r = getEffectiveRole(s);
      if (r === 'admin') admin++;
      else if (r === 'teacher') teacher++;
      else student++;
    });
    return { admin, teacher, student, total: validEmailStudents.length };
  }, [validEmailStudents]);

  // Lọc danh sách theo vai trò và từ khoá tìm kiếm
  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return validEmailStudents.filter((s) => {
      const r = getEffectiveRole(s);
      if (roleFilter !== 'ALL' && r !== roleFilter) return false;
      if (!q) return true;
      const name = getDisplayName(s).toLowerCase();
      const email = getDisplayEmail(s).toLowerCase();
      const username = (s.username || '').toLowerCase();
      return name.includes(q) || email.includes(q) || username.includes(q);
    });
  }, [validEmailStudents, searchTerm, roleFilter]);

  // Cấp quyền Giáo viên hoặc Thu hồi quyền Giáo viên
  const handleToggleTeacherRole = (student: StudentUser, targetRole: 'teacher' | 'student') => {
    const displayName = getDisplayName(student);
    const displayEmail = getDisplayEmail(student);

    openConfirmModal({
      title: targetRole === 'teacher' ? 'Cấp quyền Giáo viên' : 'Chuyển về vai trò Học sinh',
      message:
        targetRole === 'teacher'
          ? `Bạn có chắc chắn muốn cấp quyền GIÁO VIÊN cho tài khoản "${displayName}" (${displayEmail})? Khi đăng nhập, giáo viên này sẽ được vào giao diện Quản lý Lớp học, Chủ đề và Bài tập riêng biệt của mình.`
          : `Bạn có chắc chắn muốn thu hồi quyền Giáo viên của "${displayName}" (${displayEmail}) và chuyển về tài khoản Học sinh? (Các lớp học và bài tập đã tạo của tài khoản này vẫn được giữ nguyên an toàn trên hệ thống).`,
      confirmLabel: targetRole === 'teacher' ? 'Cấp quyền Giáo viên' : 'Chuyển về Học sinh',
      onConfirm: async () => {
        try {
          setUpdatingRoleId(student.id);
          await updateUserRole(student.id, displayEmail, targetRole);
        } finally {
          setUpdatingRoleId(null);
        }
      },
    });
  };

  // Xử lý Xóa vĩnh viễn tài khoản người dùng khỏi toàn bộ hệ thống
  const handleDeleteUserCompletely = (student: StudentUser) => {
    const displayName = getDisplayName(student);
    const displayEmail = getDisplayEmail(student);

    openConfirmModal({
      title: 'Xóa vĩnh viễn tài khoản người dùng',
      message: `Bạn có chắc chắn muốn xóa VĨNH VIỄN tài khoản "${displayName}" (${displayEmail}) ra khỏi toàn bộ hệ thống? Thao tác này sẽ xoá hoàn toàn tài khoản, đưa người dùng ra khỏi tất cả các lớp học và xóa sạch toàn bộ lịch sử bài nộp của tài khoản này khỏi hệ thống.`,
      confirmLabel: 'Xóa vĩnh viễn tài khoản',
      onConfirm: async () => {
        try {
          setDeletingId(student.id);
          await deleteStudent(student.id);
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 1. Header Quản lý Hệ sinh thái 3 cấp: Admin - Giáo viên - Học sinh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              mode === 'teachers'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : mode === 'students'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-red-50 dark:bg-red-950/20 text-[#c51f26] dark:text-red-400 border-red-100 dark:border-red-900/30'
            }`}>
              {mode === 'teachers' ? <UserCheck className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-white">
                {mode === 'teachers'
                  ? 'Quản lý Đội ngũ Giáo viên & Cấp quyền'
                  : mode === 'students'
                  ? 'Quản lý Học sinh Toàn Hệ Thống'
                  : 'Quản lý Phân quyền: Admin • Giáo viên • Học sinh'}
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                {mode === 'teachers'
                  ? 'Theo dõi các Giáo viên đang giảng dạy hoặc bấm vào thẻ "Học sinh" bên dưới để cấp quyền Giáo viên cho tài khoản mới đăng ký'
                  : mode === 'students'
                  ? 'Quản lý toàn bộ tài khoản Học sinh, lớp học đang tham gia và nâng cấp quyền Giáo viên khi cần'
                  : 'Cấp quyền Giáo viên cho tài khoản đăng ký mới, quản lý danh sách Giáo viên và Học sinh toàn hệ thống'}
              </p>
            </div>
          </div>
        </div>

        {/* Nút Hướng dẫn Supabase & Làm mới danh sách */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSupabaseGuide((v) => !v)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Cách thêm/bỏ Admin tối cao trên Supabase</span>
            {showSupabaseGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => refreshStudents?.()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            title="Đồng bộ danh sách người dùng mới nhất từ Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#c51f26]' : ''}`} />
            <span>{isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* 1b. Hộp hướng dẫn Thêm / Bỏ quyền Admin tối cao trực tiếp trong Supabase */}
      {showSupabaseGuide && (
        <div className="p-5 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 space-y-3 text-xs leading-relaxed">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Cơ chế bảo vệ Admin tối cao (Bắt buộc tối thiểu 1 Admin duy trì hệ thống)</span>
          </div>
          <p className="text-slate-300">
            Trên giao diện web, tài khoản <span className="font-mono font-bold text-white">Admin tối cao</span> bị khóa nút hạ quyền và xóa để tránh thao tác nhầm làm mất quyền điều khiển hệ thống. Để <b>thêm</b> hoặc <b>bỏ</b> quyền Admin tối cao, bạn vào <b>Supabase Dashboard &rarr; SQL Editor</b> (hoặc <b>Table Editor &rarr; bảng profiles</b>) và chạy lệnh:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="font-bold text-emerald-400">1. Thêm 1 tài khoản làm Admin tối cao:</div>
              <pre className="font-mono text-[11px] text-slate-200 overflow-x-auto whitespace-pre-wrap">
{`UPDATE public.profiles
SET role = 'admin'
WHERE lower(email) = 'email_can_cap@gmail.com';`}
              </pre>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="font-bold text-amber-400">2. Bỏ quyền Admin tối cao (chuyển về Giáo viên):</div>
              <pre className="font-mono text-[11px] text-slate-200 overflow-x-auto whitespace-pre-wrap">
{`-- Chỉ chạy được khi hệ thống còn ít nhất 1 Admin khác
UPDATE public.profiles
SET role = 'teacher'
WHERE lower(email) = 'email_admin_cu@gmail.com';`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 2. Thẻ thống kê nhanh & Bộ lọc theo 3 cấp vai trò */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setRoleFilter('ALL')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            roleFilter === 'ALL'
              ? 'bg-[#c51f26]/10 border-[#c51f26] dark:bg-[#c51f26]/20'
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-300'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            Tất cả tài khoản
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-white mt-1">
            {roleCounts.total}
          </div>
        </button>

        <button
          onClick={() => setRoleFilter('admin')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            roleFilter === 'admin'
              ? 'bg-amber-500/10 border-amber-500 dark:bg-amber-500/20'
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-300'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin tối cao</span>
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-white mt-1">
            {roleCounts.admin}
          </div>
        </button>

        <button
          onClick={() => setRoleFilter('teacher')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            roleFilter === 'teacher'
              ? 'bg-blue-500/10 border-blue-500 dark:bg-blue-500/20'
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-300'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Giáo viên</span>
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-white mt-1">
            {roleCounts.teacher}
          </div>
        </button>

        <button
          onClick={() => setRoleFilter('student')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            roleFilter === 'student'
              ? 'bg-emerald-500/10 border-emerald-500 dark:bg-emerald-500/20'
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-300'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Học sinh</span>
          </div>
          <div className="text-2xl font-black text-stone-900 dark:text-white mt-1">
            {roleCounts.student}
          </div>
        </button>
      </div>

      {/* 2b. Hướng dẫn quy trình cấp quyền Giáo viên */}
      <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <span className="font-bold">Quy trình cấp tài khoản Giáo viên:</span> Giáo viên đăng ký tài khoản trên web như bình thường &rarr; Admin tối cao tìm email của giáo viên trong bảng dưới đây và bấm nút <span className="font-bold text-blue-700 dark:text-blue-300">"Cấp quyền Giáo viên"</span>. Mỗi giáo viên sẽ chỉ nhìn thấy và quản lý các lớp học, chủ đề, bài tập do chính giáo viên đó tạo ra.
        </div>
      </div>

      {/* 3. Thanh Tìm kiếm */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên hoặc địa chỉ email..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#c51f26] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
          <span>Hiển thị:</span>
          <span className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold">
            {filteredStudents.length} / {validEmailStudents.length} tài khoản
          </span>
        </div>
      </div>

      {/* 4. Bảng Danh sách Người dùng */}
      <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto text-stone-400">
              <User className="w-6 h-6" />
            </div>
            <div className="text-base font-bold text-stone-800 dark:text-stone-200">
              Không tìm thấy tài khoản phù hợp
            </div>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc chọn bộ lọc vai trò khác.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  <th className="py-3.5 px-4 w-12 text-center">STT</th>
                  <th className="py-3.5 px-4">Người dùng & Vai trò</th>
                  <th className="py-3.5 px-4">Email đăng nhập</th>
                  <th className="py-3.5 px-4">Lớp học & Tài nguyên</th>
                  <th className="py-3.5 px-4">Phân quyền Hệ sinh thái</th>
                  <th className="py-3.5 px-4 w-36 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs sm:text-sm">
                {filteredStudents.map((student, idx) => {
                  const displayName = getDisplayName(student);
                  const displayEmail = getDisplayEmail(student);
                  const userRole = getEffectiveRole(student);
                  const enrolledClasses = getUserEnrolledClasses(student);
                  const teacherSummary = userRole !== 'student' ? getTeacherOwnedSummary(student) : null;
                  const isBusyDelete = deletingId === student.id;
                  const isBusyRole = updatingRoleId === student.id;

                  return (
                    <tr
                      key={student.id || student.username || idx}
                      className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      {/* Cột 1: STT */}
                      <td className="py-3.5 px-4 text-center text-xs font-mono text-stone-400">
                        #{idx + 1}
                      </td>

                      {/* Cột 2: Tên người dùng + Nhãn Vai trò */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-xs shrink-0 ${
                              userRole === 'admin'
                                ? 'bg-amber-600'
                                : userRole === 'teacher'
                                ? 'bg-blue-600'
                                : 'bg-[#c51f26]'
                            }`}
                          >
                            {displayName.charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0 flex flex-wrap items-center gap-2">
                            <span className="font-bold text-stone-900 dark:text-white truncate">
                              {displayName}
                            </span>

                            {userRole === 'admin' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Admin tối cao</span>
                              </span>
                            )}

                            {userRole === 'teacher' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                                <BookOpen className="w-3 h-3" />
                                <span>Giáo viên</span>
                              </span>
                            )}

                            {userRole === 'student' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                                <GraduationCap className="w-3 h-3" />
                                <span>Học sinh</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cột 3: Email đăng nhập */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                          <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="font-medium font-mono text-xs truncate max-w-[260px]">
                            {displayEmail}
                          </span>
                        </div>
                      </td>

                      {/* Cột 4: Lớp học & Tài nguyên */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          {teacherSummary && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                                <BookOpen className="w-3 h-3 shrink-0" />
                                <span>
                                  GV sở hữu: {teacherSummary.ownedClasses.length} lớp • {teacherSummary.ownedProblemsCount} bài tập
                                </span>
                              </span>
                              {teacherSummary.ownedClasses.map((cls) => (
                                <span
                                  key={cls.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40"
                                >
                                  <span>Lớp {cls.className}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {enrolledClasses.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {enrolledClasses.map((clsName, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
                                >
                                  <GraduationCap className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[130px]">{clsName}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            userRole === 'student' && (
                              <span className="text-xs text-stone-400 italic">Chưa vào lớp nào</span>
                            )
                          )}
                        </div>
                      </td>

                      {/* Cột 5: Phân quyền Giáo viên / Học sinh */}
                      <td className="py-3.5 px-4">
                        {userRole === 'admin' ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                            title="Quyền Admin tối cao chỉ có thể thay đổi trực tiếp trong Supabase Database"
                          >
                            <Lock className="w-3 h-3 shrink-0" />
                            <span>Bảo vệ cấp Supabase</span>
                          </span>
                        ) : userRole === 'student' ? (
                          <button
                            onClick={() => handleToggleTeacherRole(student, 'teacher')}
                            disabled={isBusyRole}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                            title={`Cấp quyền Giáo viên cho "${displayName}"`}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{isBusyRole ? 'Đang xử lý...' : 'Cấp quyền Giáo viên'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleTeacherRole(student, 'student')}
                            disabled={isBusyRole}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-colors cursor-pointer disabled:opacity-50"
                            title={`Chuyển "${displayName}" về vai trò Học sinh`}
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>{isBusyRole ? 'Đang xử lý...' : 'Hạ xuống Học sinh'}</span>
                          </button>
                        )}
                      </td>

                      {/* Cột 6: Xóa khỏi hệ thống */}
                      <td className="py-3.5 px-4 text-right">
                        {userRole === 'admin' ? (
                          <span className="text-[11px] font-semibold text-stone-400 italic">
                            Không thể xóa
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDeleteUserCompletely(student)}
                            disabled={isBusyDelete}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#c51f26] dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 hover:bg-[#c51f26] hover:text-white dark:hover:bg-[#c51f26] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                            title={`Xóa vĩnh viễn tài khoản "${displayName}" ra khỏi hệ thống`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa tài khoản</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
