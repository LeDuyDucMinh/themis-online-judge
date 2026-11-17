import React, { useState, useMemo } from 'react';
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

  const getDisplayName = (student: StudentUser): string => {
    if (student.fullName && student.fullName.trim() && student.fullName !== 'Học sinh') {
      return student.fullName.trim();
    }
    const custom = storageService.getStudentCustomName(student.id, student.email || student.username);
    if (custom && custom.trim() && custom !== 'Học sinh') return custom.trim();
    return student.username || 'Chưa đặt tên';
  };

  const getDisplayEmail = (student: StudentUser): string => {
    const raw = student.email || (student.username && student.username.includes('@') ? student.username : null);
    return (raw || student.username || 'Chưa cập nhật email').trim().toLowerCase();
  };

  const isTeacherAccount = (student: StudentUser): boolean => {
    if (student.role === 'admin' || student.role === 'teacher') return true;
    if (student.role === 'student') return false;
    const email = getDisplayEmail(student);
    if (adminEmail && email === adminEmail.toLowerCase().trim()) return true;
    const rolesMap = storageService.getUserRolesMap();
    if (rolesMap[email] === 'admin' || rolesMap[email] === 'teacher') return true;
    return false;
  };

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
    <div className="space-y-6" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1F1D1A] tracking-tight">
            Học sinh & tài khoản
          </h1>
          <p className="text-sm text-[#6B655C] mt-1">
            Danh sách học sinh đã đăng ký và lớp các em đang theo học.
          </p>
        </div>

        <div>
          <button
            onClick={() => refreshStudents?.()}
            disabled={isRefreshing}
            className="px-4 py-2 border border-[#D9D2C3] bg-[#FAF7EE] hover:bg-[#F4EFE6] text-[#1F1D1A] text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {isRefreshing ? 'Đang đồng bộ...' : 'Đang đồng bộ...'}
          </button>
        </div>
      </div>

      {/* Search Bar & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm theo tên, email hoặc username"
          className="w-full max-w-xl px-4 py-2.5 bg-white border border-[#D9D2C3] rounded-lg text-sm text-[#1F1D1A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1F1D1A]"
        />

        <div className="text-sm text-[#6B655C] whitespace-nowrap">
          Tổng cộng {filteredStudents.length} tài khoản
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto pt-2">
        <div className="min-w-[760px]">
          {/* Table Header */}
          <div className="border-t-2 border-[#1F1D1A] py-3 grid grid-cols-[40px_220px_260px_1fr_60px] items-center gap-3 text-[13px] text-[#6B655C] font-normal">
            <div>#</div>
            <div>Học sinh</div>
            <div>Email đăng nhập</div>
            <div>Lớp tham gia</div>
            <div className="text-right"></div>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="border-t border-[#D9D2C3] py-12 text-center text-[#6B655C]">
              <p className="text-base font-bold text-[#1F1D1A]">
                {searchTerm ? 'Không tìm thấy học sinh nào' : 'Chưa có học sinh nào đăng ký'}
              </p>
              <p className="text-xs text-[#6B655C] mt-1">
                {searchTerm ? 'Thử tìm với từ khóa khác.' : 'Học sinh sẽ xuất hiện ở đây khi tham gia lớp học.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#D9D2C3]">
              {filteredStudents.map((student, idx) => {
                const displayName = getDisplayName(student);
                const displayEmail = getDisplayEmail(student);
                const userClasses = getUserClasses(student);
                const isTeacher = isTeacherAccount(student);
                const isBusy = deletingId === student.id;

                return (
                  <div
                    key={student.id || displayEmail}
                    className="py-4 grid grid-cols-[40px_220px_260px_1fr_60px] items-center gap-3 text-sm hover:bg-black/[0.01] transition-colors"
                  >
                    {/* Cột # */}
                    <div className="text-sm text-[#6B655C]">
                      {idx + 1}
                    </div>

                    {/* Cột Học sinh */}
                    <div>
                      <span className="font-bold text-[#1F1D1A] text-sm block">
                        {displayName}
                      </span>
                    </div>

                    {/* Cột Email đăng nhập */}
                    <div>
                      <span className="font-mono text-sm text-[#1F1D1A]">
                        {displayEmail}
                      </span>
                    </div>

                    {/* Cột Lớp tham gia */}
                    <div>
                      {isTeacher ? (
                        <span className="font-medium text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Giáo viên
                        </span>
                      ) : userClasses.length > 0 ? (
                        <span className="font-bold text-sm text-[#1F1D1A]">
                          {userClasses.join(', ')}
                        </span>
                      ) : (
                        <span className="text-sm text-[#6B655C]">
                          Chưa vào lớp nào
                        </span>
                      )}
                    </div>

                    {/* Cột Xóa */}
                    <div className="text-right">
                      {!isTeacher && (
                        <button
                          onClick={() => handleDeleteUserCompletely(student)}
                          disabled={isBusy}
                          className="text-sm text-[#6B655C] hover:text-[#B4281F] underline cursor-pointer disabled:opacity-50"
                        >
                          Xóa
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
  );
};
