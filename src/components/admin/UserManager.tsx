import React, { useState, useMemo } from 'react';
import {
  Users,
  Trash2,
  Search,
  RefreshCw,
  Mail,
  GraduationCap,
  UserCheck,
} from 'lucide-react';
import { useJudge } from '../../context/JudgeContext';
import { storageService } from '../../services/storageService';
import type { StudentUser } from '../../types/judge';

export const UserManager: React.FC = () => {
  const {
    students,
    classes,
    adminEmail,
    deleteStudent,
    openConfirmModal,
    refreshStudents,
    isRefreshing,
  } = useJudge();

  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Lấy danh sách liên kết học sinh - lớp học để hiển thị lớp tham gia
  const classStudents = useMemo(() => {
    return storageService.getClassStudents();
  }, [students, classes]);

  // Lấy tên hiển thị hiện tại của người dùng (ưu tiên tên tuỳ chỉnh mới nhất)
  const getDisplayName = (student: StudentUser): string => {
    const custom = storageService.getStudentCustomName(student.id, student.email || student.username);
    if (custom && custom.trim()) return custom.trim();
    if (student.fullName && student.fullName.trim() && student.fullName !== 'Học sinh') {
      return student.fullName.trim();
    }
    return student.username || 'Chưa đặt tên';
  };

  // Lấy email đăng nhập thực tế
  const getDisplayEmail = (student: StudentUser): string => {
    const raw = student.email || (student.username && student.username.includes('@') ? student.username : null);
    return (raw || student.username || 'Chưa cập nhật email').trim().toLowerCase();
  };

  // Nhận diện tài khoản Giáo viên / Quản trị viên (Single Source of Truth từ Supabase profiles)
  const isTeacherAccount = (student: StudentUser): boolean => {
    if (student.role === 'admin' || student.role === 'teacher') {
      return true;
    }
    if (student.role === 'student') {
      return false;
    }
    const email = getDisplayEmail(student);
    if (adminEmail && email === adminEmail.toLowerCase().trim()) {
      return true;
    }
    const rolesMap = storageService.getUserRolesMap();
    if (rolesMap[email] === 'admin' || rolesMap[email] === 'teacher') {
      return true;
    }
    return false;
  };

  // Lấy danh sách các lớp học người dùng đang tham gia
  const getUserClasses = (student: StudentUser): string[] => {
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

    return classes
      .filter((c) => enrolledClassIds.has(c.id))
      .map((c) => c.className);
  };

  // Chỉ lấy các tài khoản hợp lệ tạo bằng Gmail/Email và khử trùng lặp theo địa chỉ Email
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
        if (isNewUUID && !isExistingUUID) {
          studentMap.set(email, s);
        } else if (new Date(s.createdAt || 0).getTime() >= new Date(existing.createdAt || 0).getTime()) {
          studentMap.set(email, s);
        }
      }
    });
    return Array.from(studentMap.values());
  }, [students]);

  // Lọc danh sách theo từ khoá tìm kiếm
  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return validEmailStudents;
    return validEmailStudents.filter((s) => {
      const name = getDisplayName(s).toLowerCase();
      const email = getDisplayEmail(s).toLowerCase();
      const username = (s.username || '').toLowerCase();
      return name.includes(q) || email.includes(q) || username.includes(q);
    });
  }, [validEmailStudents, searchTerm]);

  // Xử lý Xóa vĩnh viễn tài khoản người dùng
  const handleDeleteUserCompletely = (student: StudentUser) => {
    const name = getDisplayName(student);
    const email = getDisplayEmail(student);

    openConfirmModal({
      title: 'Xóa tài khoản người dùng',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${name}" (${email})? Toàn bộ bài nộp và liên kết lớp học của người dùng này sẽ bị hủy.`,
      confirmLabel: 'Xóa tài khoản',
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
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Tiêu đề chuẩn FAMINH */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-[#c51f26]">
            QUẢN LÝ NGƯỜI DÙNG
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white tracking-tight mt-0.5">
            Danh sách Học sinh & Tài khoản
          </h2>
          <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Xem toàn bộ danh sách học sinh đã đăng ký và lớp học các em đang theo học trên hệ thống.
          </p>
        </div>

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

      {/* 2. Thanh Tìm kiếm & Thống kê */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên học sinh, email hoặc username..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#c51f26]"
          />
        </div>

        <div className="text-xs text-stone-500 dark:text-slate-400">
          Tổng cộng: <b className="text-[#c51f26] font-bold">{filteredStudents.length}</b> tài khoản
        </div>
      </div>

      {/* 3. Bảng danh sách Học sinh */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden shadow-xs">
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users className="w-10 h-10 text-stone-300 dark:text-stone-700 mx-auto" />
            <p className="text-sm font-bold text-stone-700 dark:text-stone-300">
              Không tìm thấy học sinh nào
            </p>
            <p className="text-xs text-stone-400">
              {searchTerm ? 'Thử tìm với từ khóa khác.' : 'Chưa có học sinh nào đăng ký tài khoản trên hệ thống.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 text-stone-500 dark:text-stone-400 uppercase tracking-wider text-[11px] font-bold">
                  <th className="py-3.5 px-4 w-12 text-center">STT</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Tên Học sinh</th>
                  <th className="py-3.5 px-4 min-w-[200px]">Email đăng nhập</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Lớp học tham gia</th>
                  <th className="py-3.5 px-4 w-28 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/70">
                {filteredStudents.map((student, idx) => {
                  const displayName = getDisplayName(student);
                  const displayEmail = getDisplayEmail(student);
                  const userClasses = getUserClasses(student);
                  const isBusy = deletingId === student.id;

                  return (
                    <tr
                      key={student.id || displayEmail}
                      className="hover:bg-stone-50/70 dark:hover:bg-stone-800/30 transition-colors"
                    >
                      {/* Cột 1: STT */}
                      <td className="py-3.5 px-4 text-center text-xs font-mono text-stone-400">
                        #{idx + 1}
                      </td>

                      {/* Cột 2: Tên người dùng */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#c51f26] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-stone-900 dark:text-white truncate">
                            {displayName}
                          </span>
                        </div>
                      </td>

                      {/* Cột 3: Email đăng nhập */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                          <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="font-medium font-mono text-xs truncate max-w-[280px]">
                            {displayEmail}
                          </span>
                        </div>
                      </td>

                      {/* Cột 4: Các lớp học đang tham gia hoặc Vai trò Giáo viên */}
                      <td className="py-3.5 px-4">
                        {isTeacherAccount(student) ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shadow-2xs">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Giáo viên</span>
                          </span>
                        ) : userClasses.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {userClasses.map((clsName, cIdx) => (
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
                          <span className="text-xs text-stone-400 italic">Chưa vào lớp nào</span>
                        )}
                      </td>

                      {/* Cột 5: Nút Xóa tài khoản */}
                      <td className="py-3.5 px-4 text-right">
                        {isTeacherAccount(student) ? (
                          <span className="text-[11px] font-semibold text-stone-400 italic pr-2">
                            Quản trị viên
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDeleteUserCompletely(student)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#c51f26] dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 hover:bg-[#c51f26] hover:text-white dark:hover:bg-[#c51f26] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                            title={`Xóa tài khoản "${displayName}" ra khỏi hệ thống`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
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
