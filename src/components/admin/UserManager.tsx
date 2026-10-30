import React, { useState, useMemo } from 'react';
import {
  Users,
  Trash2,
  Search,
  RefreshCw,
  Mail,
  User,
  GraduationCap,
  AlertTriangle,
} from 'lucide-react';
import { useJudge } from '../../context/JudgeContext';
import { storageService } from '../../services/storageService';
import type { StudentUser } from '../../types/judge';

export const UserManager: React.FC = () => {
  const {
    students,
    classes,
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

  // Lấy email đăng nhập
  const getDisplayEmail = (student: StudentUser): string => {
    const raw = student.email || (student.username && student.username.includes('@') ? student.username : null);
    if (raw === 'leduyducminh@gmail.com') return 'minh.ldd2610979@sis.hust.edu.vn';
    return raw || student.username || 'Chưa cập nhật email';
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

  // Chỉ lấy các tài khoản hợp lệ tạo bằng Gmail/Email (loại bỏ hoàn toàn các tài khoản cơ chế cũ không có email)
  // và khử trùng lặp theo địa chỉ Email (mỗi email chỉ có duy nhất 1 tài khoản, ưu tiên tài khoản mới từ Supabase Auth)
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

  // Tự động dọn dẹp các tài khoản rác cơ chế cũ và tài khoản trùng lặp khỏi Storage nếu còn sót lại
  React.useEffect(() => {
    if (students.length > 0 && students.length !== validEmailStudents.length) {
      storageService.saveStudents(validEmailStudents);
    }
  }, [students.length, validEmailStudents.length, validEmailStudents]);

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
      {/* 1. Header Quản lý Người dùng */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 text-[#c51f26] dark:text-red-400 border border-red-100 dark:border-red-900/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
                Quản lý Người dùng (Users)
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                Danh sách tài khoản học sinh trong hệ thống, thông tin đăng nhập và quản trị tài khoản
              </p>
            </div>
          </div>
        </div>

        {/* Nút Làm mới danh sách từ Cloud */}
        <div className="flex items-center gap-2">
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

      {/* 2. Cảnh báo thông tin quản trị */}
      <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <span className="font-bold">Lưu ý quan trọng:</span> Nút <span className="font-bold text-[#c51f26] dark:text-red-400">Xóa tài khoản</span> tại mục này sẽ <span className="font-semibold underline">xóa hẳn tài khoản người dùng ra khỏi toàn bộ hệ thống</span> (thu hồi quyền đăng nhập, đưa học sinh ra khỏi mọi lớp học và dọn dẹp sạch toàn bộ lịch sử nộp bài trên máy chủ lẫn đám mây).
        </div>
      </div>

      {/* 3. Thanh Tìm kiếm & Thống kê */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Ô tìm kiếm */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên người dùng hoặc email..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:border-[#c51f26] transition-colors"
          />
        </div>

        {/* Thống kê người dùng */}
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
          <span>Tổng số:</span>
          <span className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold">
            {validEmailStudents.length} tài khoản
          </span>
          {searchTerm && (
            <span className="text-stone-400">
              (Khớp: {filteredStudents.length})
            </span>
          )}
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
              {searchTerm ? 'Không tìm thấy người dùng phù hợp' : 'Chưa có tài khoản người dùng nào'}
            </div>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {searchTerm
                ? 'Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc thử với email/tên khác.'
                : 'Khi học sinh đăng ký hoặc tham gia hệ thống, danh sách tài khoản sẽ xuất hiện tại đây.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  <th className="py-3.5 px-4 w-14 text-center">STT</th>
                  <th className="py-3.5 px-4">Tên người dùng hiện tại & Thao tác</th>
                  <th className="py-3.5 px-4">Email đăng nhập</th>
                  <th className="py-3.5 px-4">Lớp tham gia</th>
                  <th className="py-3.5 px-4 w-40 text-right">Xoá khỏi hệ thống</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs sm:text-sm">
                {filteredStudents.map((student, idx) => {
                  const displayName = getDisplayName(student);
                  const displayEmail = getDisplayEmail(student);
                  const userClasses = getUserClasses(student);
                  const isBusy = deletingId === student.id;

                  return (
                    <tr
                      key={student.id || student.username || idx}
                      className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      {/* Cột 1: STT */}
                      <td className="py-3.5 px-4 text-center text-xs font-mono text-stone-400">
                        #{idx + 1}
                      </td>

                      {/* Cột 2: Tên người dùng hiện tại + Nút Xóa bên cạnh tên */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {/* Avatar chữ cái đầu */}
                          <div className="w-8 h-8 rounded-lg bg-[#c51f26] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {displayName.charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0 flex flex-wrap items-center gap-2">
                            {/* Tên người dùng hiện tại */}
                            <span className="font-bold text-stone-900 dark:text-white truncate">
                              {displayName}
                            </span>

                            {/* Nút xóa tài khoản người dùng ngay bên cạnh tên theo yêu cầu */}
                            <button
                              onClick={() => handleDeleteUserCompletely(student)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-[#c51f26] dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 hover:bg-[#c51f26] hover:text-white dark:hover:bg-[#c51f26] dark:hover:text-white transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                              title={`Xóa vĩnh viễn tài khoản "${displayName}" ra khỏi hệ thống`}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Xóa tài khoản</span>
                            </button>
                          </div>
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

                      {/* Cột 4: Các lớp học đang tham gia */}
                      <td className="py-3.5 px-4">
                        {userClasses.length > 0 ? (
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

                      {/* Cột 6: Nút Xóa tài khoản độc lập ở cột Thao tác */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteUserCompletely(student)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#c51f26] dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 hover:bg-[#c51f26] hover:text-white dark:hover:bg-[#c51f26] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                          title={`Xóa vĩnh viễn tài khoản "${displayName}" ra khỏi hệ thống`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa tài khoản</span>
                        </button>
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
