import React, { useEffect, useState, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { apiService } from '../../services/apiService';
import { isProblemInClass } from '../../types/judge';
import { Trophy, Medal, CheckCircle2, Sparkles } from 'lucide-react';

interface ClassLeaderboardProps {
  classId: string;
}

interface LeaderboardEntry {
  studentId: string;
  fullName: string;
  email?: string;
  acCount: number;
  solvedCodes: string[];
  lastSolvedAt: string;
  isCurrentUser: boolean;
}

export const ClassLeaderboard: React.FC<ClassLeaderboardProps> = ({ classId }) => {
  const {
    classes,
    topics,
    problems,
    submissions,
    students,
    getStudentsInClass,
    currentStudent,
    theme,
  } = useJudge();

  const [cloudAcSubs, setCloudAcSubs] = useState<Array<{
    id: string;
    problemId: string;
    problemCode: string;
    userId: string;
    userName: string;
    classId: string;
    verdict: string;
    submittedAt: string;
  }> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Chỉ thực hiện truy vấn SELECT danh sách bài nộp AC theo class_id hiện tại từ Supabase
  useEffect(() => {
    let isMounted = true;
    if (!classId) {
      setCloudAcSubs([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    apiService
      .fetchClassAcSubmissions(classId)
      .then((rows) => {
        if (!isMounted) return;
        if (rows !== null) {
          setCloudAcSubs(rows);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [classId, submissions.length]);

  const currentClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classes, classId]
  );

  const classProblems = useMemo(
    () => problems.filter((p) => isProblemInClass(p, classId, topics, classes)),
    [problems, classId, topics, classes]
  );

  const enrolledStudents = useMemo(
    () => getStudentsInClass(classId),
    [getStudentsInClass, classId, students]
  );

  // Group By student_id và đếm DISTINCT problem_id có trạng thái AC trong class_id hiện tại
  const leaderboardEntries = useMemo<LeaderboardEntry[]>(() => {
    if (!classId) return [];

    // 1. Tạo bản đồ tra cứu bài tập để chuẩn hóa problem_id (chống trùng lặp tuyệt đối)
    const problemCanonicalMap = new Map<string, { id: string; code: string }>();
    problems.forEach((p) => {
      const pid = (p.id || '').trim().toLowerCase();
      const pcode = (p.code || '').trim().toLowerCase();
      const info = { id: p.id, code: p.code || p.id };
      if (pid) problemCanonicalMap.set(pid, info);
      if (pcode) problemCanonicalMap.set(pcode, info);
    });

    // 2. Tạo bản đồ học sinh của lớp & hệ thống để chuẩn hóa định danh học sinh (Group By ID học sinh)
    const studentLookup = new Map<
      string,
      { id: string; fullName: string; email?: string; role?: string }
    >();

    // Danh sách tài khoản giáo viên / admin cần loại trừ khỏi bảng xếp hạng học sinh
    const staffIdentifiers = new Set<string>(['admin_faminh', 'leduyducminh@gmail.com']);
    students.forEach((s) => {
      if (s.role === 'admin' || s.role === 'teacher') {
        if (s.id) staffIdentifiers.add(s.id.trim().toLowerCase());
        if (s.email) staffIdentifiers.add(s.email.trim().toLowerCase());
        if (s.username) staffIdentifiers.add(s.username.trim().toLowerCase());
      }
    });

    const registerStudent = (stu: {
      id: string;
      fullName: string;
      email?: string;
      username?: string;
      role?: string;
    }) => {
      const canonical = {
        id: stu.id,
        fullName: stu.fullName || stu.email?.split('@')[0] || 'Học sinh',
        email: stu.email || (stu.username?.includes('@') ? stu.username : undefined),
        role: stu.role,
      };
      if (stu.id) studentLookup.set(stu.id.trim().toLowerCase(), canonical);
      if (stu.email) studentLookup.set(stu.email.trim().toLowerCase(), canonical);
      if (stu.username) studentLookup.set(stu.username.trim().toLowerCase(), canonical);
    };

    students.forEach(registerStudent);
    enrolledStudents.forEach(registerStudent);
    if (currentStudent) {
      registerStudent(currentStudent);
    }

    // Tập hợp học sinh chính thức thuộc lớp học này (nếu lớp đã có danh sách thành viên)
    const enrolledKeys = new Set<string>();
    enrolledStudents.forEach((s) => {
      if (s.id) enrolledKeys.add(s.id.trim().toLowerCase());
      if (s.email) enrolledKeys.add(s.email.trim().toLowerCase());
      if (s.username) enrolledKeys.add(s.username.trim().toLowerCase());
      if (s.fullName) enrolledKeys.add(s.fullName.trim().toLowerCase());
    });

    // 3. Hợp nhất nguồn dữ liệu SELECT từ Supabase Cloud và bộ nhớ phiên hiện tại (BẮT BUỘC lọc theo classId và verdict === 'AC')
    const rawAcList: Array<{
      id: string;
      problemId: string;
      problemCode: string;
      userId: string;
      userName: string;
      classId?: string;
      verdict: string;
      submittedAt: string;
    }> = [];

    const seenSubIds = new Set<string>();

    if (cloudAcSubs) {
      cloudAcSubs.forEach((s) => {
        if (s.classId === classId && s.verdict === 'AC') {
          if (s.id) seenSubIds.add(s.id);
          rawAcList.push(s);
        }
      });
    }

    submissions.forEach((s) => {
      if (s.classId === classId && s.overallVerdict === 'AC') {
        if (s.id && seenSubIds.has(s.id)) return;
        if (s.id) seenSubIds.add(s.id);
        rawAcList.push({
          id: s.id,
          problemId: s.problemId,
          problemCode: s.problemCode,
          userId: s.userId,
          userName: s.userName,
          classId: s.classId,
          verdict: s.overallVerdict,
          submittedAt: s.submittedAt,
        });
      }
    });

    // Sắp xếp theo thời gian nộp tăng dần để ghi nhận thời điểm đạt AC đầu tiên của từng bài
    rawAcList.sort(
      (a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime()
    );

    // 4. GROUP BY ID HỌC SINH & ĐẾM DISTINCT PROBLEM_ID
    const groupedMap = new Map<
      string,
      {
        studentId: string;
        fullName: string;
        email?: string;
        distinctProblems: Map<string, string>; // canonicalProblemId -> problemCode
        lastSolvedAt: string;
      }
    >();

    for (const sub of rawAcList) {
      const rawUid = (sub.userId || '').trim();
      const lowerUid = rawUid.toLowerCase();
      const lowerUname = (sub.userName || '').trim().toLowerCase();

      if (!lowerUid) continue;
      if (staffIdentifiers.has(lowerUid) || lowerUname.startsWith('giáo viên')) continue;

      // Nếu lớp học đã có danh sách thành viên, kiểm tra học sinh có thuộc lớp học này không
      if (enrolledKeys.size > 0) {
        const matchedProfile = studentLookup.get(lowerUid);
        const isMember =
          enrolledKeys.has(lowerUid) ||
          enrolledKeys.has(lowerUname) ||
          (matchedProfile?.id && enrolledKeys.has(matchedProfile.id.toLowerCase())) ||
          (matchedProfile?.email && enrolledKeys.has(matchedProfile.email.toLowerCase()));
        if (!isMember) continue;
      }

      const resolvedStudent = studentLookup.get(lowerUid);
      if (resolvedStudent?.role === 'admin' || resolvedStudent?.role === 'teacher') continue;

      const canonicalStudentId = (resolvedStudent?.id || rawUid).trim();
      const groupKey = canonicalStudentId.toLowerCase();

      const rawPid = (sub.problemId || '').trim().toLowerCase();
      const rawPcode = (sub.problemCode || '').trim().toLowerCase();
      const canonicalProb =
        (rawPid && problemCanonicalMap.get(rawPid)) ||
        (rawPcode && problemCanonicalMap.get(rawPcode)) || {
          id: rawPid || rawPcode,
          code: (sub.problemCode || sub.problemId || '').toUpperCase(),
        };

      const distinctProbKey = (canonicalProb.id || rawPid || rawPcode).trim().toLowerCase();
      if (!distinctProbKey) continue;

      let group = groupedMap.get(groupKey);
      if (!group) {
        group = {
          studentId: canonicalStudentId,
          fullName:
            resolvedStudent?.fullName && resolvedStudent.fullName !== 'Học sinh'
              ? resolvedStudent.fullName
              : sub.userName || 'Học sinh',
          email: resolvedStudent?.email,
          distinctProblems: new Map<string, string>(),
          lastSolvedAt: sub.submittedAt || '',
        };
        groupedMap.set(groupKey, group);
      } else if (
        resolvedStudent?.fullName &&
        resolvedStudent.fullName !== 'Học sinh' &&
        group.fullName !== resolvedStudent.fullName
      ) {
        group.fullName = resolvedStudent.fullName;
      }

      // CHỈ ĐẾM DISTINCT PROBLEM_ID: Nếu bài tập này đã AC trước đó thì bỏ qua, không cộng dồn trùng lặp
      if (!group.distinctProblems.has(distinctProbKey)) {
        group.distinctProblems.set(distinctProbKey, canonicalProb.code);
        group.lastSolvedAt = sub.submittedAt || group.lastSolvedAt;
      }
    }

    const curId = (currentStudent?.id || '').trim().toLowerCase();
    const curEmail = (currentStudent?.email || '').trim().toLowerCase();

    const result: LeaderboardEntry[] = [];
    groupedMap.forEach((val) => {
      const acCount = val.distinctProblems.size;
      if (acCount <= 0) return;

      const isCurrentUser = Boolean(
        (curId && val.studentId.toLowerCase() === curId) ||
          (curEmail && val.email && val.email.toLowerCase() === curEmail)
      );

      result.push({
        studentId: val.studentId,
        fullName: val.fullName,
        email: val.email,
        acCount,
        solvedCodes: Array.from(val.distinctProblems.values()),
        lastSolvedAt: val.lastSolvedAt,
        isCurrentUser,
      });
    });

    // Sắp xếp giảm dần theo số bài FULL AC; nếu bằng nhau thì ưu tiên ai hoàn thành sớm hơn
    result.sort((a, b) => {
      if (b.acCount !== a.acCount) return b.acCount - a.acCount;
      const timeA = new Date(a.lastSolvedAt || 0).getTime();
      const timeB = new Date(b.lastSolvedAt || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.fullName.localeCompare(b.fullName, 'vi');
    });

    return result;
  }, [classId, cloudAcSubs, submissions, problems, students, enrolledStudents, currentStudent]);

  // Hàm render huy chương cho Top 1, 2, 3 và số thứ tự cho Top 4 trở đi
  const renderRankBadge = (rankIndex: number) => {
    const rank = rankIndex + 1;

    if (rank === 1) {
      return (
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 shadow-2xs ${
            theme === 'light'
              ? 'bg-amber-50 border-amber-300 text-amber-500'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-400'
          }`}
          title="Hạng 1 - Huy chương Vàng"
        >
          <Medal className="w-5 h-5" />
        </div>
      );
    }

    if (rank === 2) {
      return (
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 shadow-2xs ${
            theme === 'light'
              ? 'bg-slate-100 border-slate-300 text-slate-500'
              : 'bg-slate-400/15 border-slate-400/40 text-slate-300'
          }`}
          title="Hạng 2 - Huy chương Bạc"
        >
          <Medal className="w-5 h-5" />
        </div>
      );
    }

    if (rank === 3) {
      return (
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 shadow-2xs ${
            theme === 'light'
              ? 'bg-orange-50 border-orange-300 text-amber-700'
              : 'bg-amber-700/20 border-amber-600/40 text-amber-500'
          }`}
          title="Hạng 3 - Huy chương Đồng"
        >
          <Medal className="w-5 h-5" />
        </div>
      );
    }

    // Top 4 trở đi dùng số
    return (
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-extrabold border shrink-0 ${
          theme === 'light'
            ? 'bg-stone-50 border-stone-200 text-stone-600'
            : 'bg-stone-900 border-stone-800 text-stone-400'
        }`}
        title={`Hạng ${rank}`}
      >
        #{rank}
      </div>
    );
  };

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 transition-colors ${
        theme === 'light'
          ? 'bg-white border-stone-200 shadow-2xs'
          : 'bg-[#0d121d] border-stone-800'
      }`}
    >
      {/* Header Bảng Xếp Hạng Lớp Học */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3.5 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`text-base sm:text-lg font-black tracking-tight ${
                  theme === 'light' ? 'text-stone-900' : 'text-white'
                }`}
              >
                Bảng Xếp Hạng Lớp Học
              </h3>
              {currentClass && (
                <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-red-500/15 text-[#c51f26] dark:text-red-400 border border-red-500/20">
                  {currentClass.className}
                </span>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${theme === 'light' ? 'text-stone-500' : 'text-stone-400'}`}>
              Xếp hạng theo số bài giải đúng 100% (Full AC) trong lớp • Không tính trùng bài nộp lại
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono font-bold px-3 py-1.5 rounded-xl border ${
              theme === 'light'
                ? 'bg-stone-50 border-stone-200 text-stone-700'
                : 'bg-stone-900 border-stone-800 text-stone-300'
            }`}
          >
            {leaderboardEntries.length} học sinh đạt AC
          </span>
        </div>
      </div>

      {/* Nội dung Bảng Xếp Hạng */}
      {isLoading && leaderboardEntries.length === 0 ? (
        <div className="py-8 text-center text-xs text-stone-400 dark:text-stone-500 animate-pulse">
          Đang tải dữ liệu bảng xếp hạng lớp học...
        </div>
      ) : leaderboardEntries.length === 0 ? (
        /* Empty State khi chưa có học sinh nào nộp bài AC trong lớp này */
        <div
          className={`rounded-xl py-10 px-4 text-center border border-dashed ${
            theme === 'light'
              ? 'bg-stone-50/60 border-stone-200'
              : 'bg-stone-950/40 border-stone-800/80'
          }`}
        >
          <Trophy
            className={`w-8 h-8 mx-auto mb-2.5 opacity-40 ${
              theme === 'light' ? 'text-stone-400' : 'text-stone-500'
            }`}
          />
          <p
            className={`text-xs sm:text-sm font-medium ${
              theme === 'light' ? 'text-stone-400' : 'text-stone-500'
            }`}
          >
            Chưa có dữ liệu xếp hạng cho lớp học này
          </p>
        </div>
      ) : (
        /* Dynamic List: Hiển thị đúng số lượng học sinh thực tế có trong mảng */
        <div className="space-y-2.5">
          {leaderboardEntries.map((entry, idx) => {
            const rank = idx + 1;
            const totalProbs = classProblems.length;

            return (
              <div
                key={entry.studentId}
                className={`p-3.5 sm:px-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  entry.isCurrentUser
                    ? theme === 'light'
                      ? 'bg-red-50/60 border-red-300 shadow-2xs'
                      : 'bg-red-950/20 border-red-500/40'
                    : rank === 1
                    ? theme === 'light'
                      ? 'bg-amber-50/40 border-amber-200/90'
                      : 'bg-amber-500/5 border-amber-500/25'
                    : theme === 'light'
                    ? 'bg-stone-50/50 border-stone-200/80 hover:border-stone-300'
                    : 'bg-stone-900/50 border-stone-800/80 hover:border-stone-700'
                }`}
              >
                {/* Cột Trái: Huy chương / Thứ hạng + Avatar + Họ tên học sinh */}
                <div className="flex items-center gap-3 min-w-0">
                  {renderRankBadge(idx)}

                  <div
                    className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 border ${
                      rank === 1
                        ? 'bg-amber-500 text-white border-amber-400'
                        : rank === 2
                        ? 'bg-slate-500 text-white border-slate-400'
                        : rank === 3
                        ? 'bg-amber-700 text-white border-amber-600'
                        : theme === 'light'
                        ? 'bg-red-50 text-[#c51f26] border-red-200'
                        : 'bg-red-950/50 text-red-400 border-red-900/50'
                    }`}
                  >
                    {entry.fullName.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-bold text-sm truncate ${
                          theme === 'light' ? 'text-stone-900' : 'text-white'
                        }`}
                      >
                        {entry.fullName}
                      </span>

                      {rank <= 3 && (
                        <span
                          className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md border ${
                            rank === 1
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : rank === 2
                              ? 'bg-slate-400/15 text-slate-600 dark:text-slate-300 border-slate-400/30'
                              : 'bg-amber-700/15 text-amber-700 dark:text-amber-500 border-amber-700/30'
                          }`}
                        >
                          TOP {rank}
                        </span>
                      )}

                      {entry.isCurrentUser && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#c51f26] text-white">
                          <Sparkles className="w-2.5 h-2.5" /> Bạn
                        </span>
                      )}
                    </div>

                    {/* Danh sách mã bài đã giải đúng (distinct) */}
                    {entry.solvedCodes.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {entry.solvedCodes.slice(0, 6).map((code) => (
                          <span
                            key={code}
                            className={`font-mono text-[10px] px-1.5 py-0.2 rounded border ${
                              theme === 'light'
                                ? 'bg-white text-stone-600 border-stone-200'
                                : 'bg-stone-950 text-stone-400 border-stone-800'
                            }`}
                          >
                            {code}
                          </span>
                        ))}
                        {entry.solvedCodes.length > 6 && (
                          <span className="font-mono text-[10px] text-stone-400">
                            +{entry.solvedCodes.length - 6} bài
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cột Phải: Tổng số bài FULL AC */}
                <div className="flex items-center justify-end gap-3 shrink-0">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono text-xs font-extrabold border ${
                      theme === 'light'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {entry.acCount}
                      {totalProbs > 0 ? ` / ${totalProbs}` : ''} bài Full AC
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
