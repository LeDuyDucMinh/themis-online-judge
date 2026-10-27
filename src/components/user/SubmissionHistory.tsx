import React, { useState, useEffect, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { isProblemInClass, type Submission, type StudentUser, type Problem } from '../../types/judge';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  AlertOctagon,
  FileCode2,
  Code2,
  Calendar,
  Layers,
  ChevronRight,
  X,
  User,
  BarChart3,
  BookOpen,
  Users,
  GraduationCap,
} from 'lucide-react';
import { ThemisGradingTable } from './ThemisGradingTable';
import { apiService } from '../../services/apiService';
import { storageService } from '../../services/storageService';

export const SubmissionHistory: React.FC = () => {
  const {
    submissions,
    problems,
    topics,
    classes,
    theme,
    isAdminAuthenticated,
    currentStudent,
    students,
    getStudentsInClass,
    activeClassId,
    refreshAllData,
  } = useJudge();
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);

  const handleOpenDetail = async (sub: Submission) => {
    setSelectedSub(sub);
    if (!sub.testResults || sub.testResults.length === 0) {
      try {
        const full = await apiService.fetchSubmissionById(sub.id);
        if (full?.testResults && full.testResults.length > 0) {
          setSelectedSub((curr) => (curr?.id === sub.id ? { ...curr, testResults: full.testResults } : curr));
        }
      } catch (e) {
        console.warn('Lỗi tải chi tiết bài nộp:', e);
      }
    }
  };

  // Bộ lọc theo Lớp học (Multi-Classroom) - ưu tiên lớp hiện tại của giáo viên
  const [selectedClassId, setSelectedClassIdState] = useState<string>(() => {
    const saved = storageService.getSubmissionsClassFilter();
    if (saved) return saved;
    return activeClassId || 'ALL';
  });
  const setSelectedClassId = (id: string) => {
    setSelectedClassIdState(id);
    storageService.setSubmissionsClassFilter(id);
  };

  // Chỉ đồng bộ khi giáo viên chủ động bấm chuyển sang lớp khác trên thanh điều hướng Navbar
  const prevActiveClassIdRef = React.useRef(activeClassId);
  useEffect(() => {
    if (activeClassId && prevActiveClassIdRef.current !== activeClassId) {
      setSelectedClassIdState(activeClassId);
      storageService.setSubmissionsClassFilter(activeClassId);
    }
    prevActiveClassIdRef.current = activeClassId;
  }, [activeClassId]);


  // Tự động làm mới dữ liệu ngầm khi mở màn hình Lịch sử nộp bài & Polling nhận bài nộp mới
  const refreshRef = React.useRef(refreshAllData);
  refreshRef.current = refreshAllData;

  useEffect(() => {
    refreshRef.current().catch(() => {});
    const interval = setInterval(() => {
      refreshRef.current().catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Chế độ xem dành riêng cho GIÁO VIÊN: 'log' = Nhật ký từng lần nộp, 'topic_grades' = Bảng điểm theo Chủ đề
  const [viewMode, setViewModeState] = useState<'log' | 'topic_grades'>(() => {
    return (storageService.getSubmissionsViewMode() as any) || 'log';
  });
  const setViewMode = (mode: 'log' | 'topic_grades') => {
    setViewModeState(mode);
    storageService.setSubmissionsViewMode(mode);
  };

  // Chủ đề được chọn trong Chế độ 2: Bảng điểm theo Chủ đề
  const [selectedTopicId, setSelectedTopicId] = useState<string>(() => topics[0]?.id || '');

  // Tự động đồng bộ topic ID hợp lệ
  useEffect(() => {
    if ((!selectedTopicId || !topics.some((t) => t.id === selectedTopicId)) && topics.length > 0) {
      setSelectedTopicId(topics[0].id);
    }
  }, [topics, selectedTopicId]);

  // Lọc danh sách bài nộp theo đúng phân quyền, học sinh trong lớp và chế độ mới nhất:
  const displayedSubmissions = useMemo(() => {
    let list = submissions;
    if (!isAdminAuthenticated) {
      if (!currentStudent) {
        return [];
      }
      const sId = (currentStudent.id || '').trim().toLowerCase();
      const sUser = (currentStudent.username || '').trim().toLowerCase();
      const sEmail = (currentStudent.email || '').trim().toLowerCase();
      const sName = (currentStudent.fullName || '').trim().toLowerCase();
      const customName = storageService.getStudentCustomName(currentStudent.id, currentStudent.email)?.trim().toLowerCase();

      list = list.filter((sub) => {
        const subUser = (sub.userId || '').trim().toLowerCase();
        const subName = (sub.userName || '').trim().toLowerCase();

        const matchId = Boolean(sId && subUser && subUser === sId);
        const matchUser = Boolean(sUser && subUser && subUser === sUser);
        const matchEmail = Boolean(sEmail && subUser && subUser === sEmail);
        const matchName = Boolean(sName && subName && subName === sName);
        const matchCustom = Boolean(customName && subName && subName === customName);

        return matchId || matchUser || matchEmail || matchName || matchCustom;
      });
    }

    if (selectedClassId !== 'ALL') {
      const enrolled = getStudentsInClass(selectedClassId);
      const enrolledIds = new Set(enrolled.map((s) => (s.id || '').trim().toLowerCase()));
      const enrolledUsernames = new Set(enrolled.map((s) => (s.username || '').trim().toLowerCase()));
      const enrolledEmails = new Set(enrolled.map((s) => (s.email || '').trim().toLowerCase()));
      const enrolledNames = new Set(enrolled.map((s) => (s.fullName || '').trim().toLowerCase()));

      // Nếu người dùng hiện tại là học sinh và đang trong lớp này, đảm bảo các định danh của học sinh có trong tập lớp
      if (currentStudent) {
        const isStudentInClass = enrolled.some((s) =>
          (s.id && currentStudent.id && s.id.toLowerCase() === currentStudent.id.toLowerCase()) ||
          (s.username && currentStudent.username && s.username.toLowerCase() === currentStudent.username.toLowerCase()) ||
          (s.email && currentStudent.email && s.email.toLowerCase() === currentStudent.email.toLowerCase())
        );
        if (isStudentInClass || activeClassId === selectedClassId) {
          if (currentStudent.id) enrolledIds.add(currentStudent.id.trim().toLowerCase());
          if (currentStudent.username) enrolledUsernames.add(currentStudent.username.trim().toLowerCase());
          if (currentStudent.email) enrolledEmails.add(currentStudent.email.trim().toLowerCase());
          if (currentStudent.fullName) enrolledNames.add(currentStudent.fullName.trim().toLowerCase());
          const custom = storageService.getStudentCustomName(currentStudent.id, currentStudent.email);
          if (custom) enrolledNames.add(custom.trim().toLowerCase());
        }
      }

      list = list.filter((sub) => {
        const prob = problems.find((p) => p.id === sub.problemId || (p.code && p.code === sub.problemCode));
        const isProbInSelectedClass = prob ? isProblemInClass(prob, selectedClassId, topics) : false;
        const matchesClass = sub.classId === selectedClassId || isProbInSelectedClass || (!sub.classId && selectedClassId === 'class_default_faminh');
        if (!matchesClass) return false;

        // Kiểm tra học sinh có thực sự thuộc lớp này không
        const subUser = (sub.userId || '').trim().toLowerCase();
        const subName = (sub.userName || '').trim().toLowerCase();
        const matchId = Boolean(subUser && enrolledIds.has(subUser));
        const matchUser = Boolean(subUser && enrolledUsernames.has(subUser));
        const matchEmail = Boolean(subUser && enrolledEmails.has(subUser));
        const matchName = Boolean(subName && enrolledNames.has(subName));
        return matchId || matchUser || matchEmail || matchName;
      });
    }

    const sorted = [...list].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    // Chỉ hiển thị tối đa 15 lượt nộp bài gần đây nhất (các lượt nộp quá 15 lượt sẽ không hiển thị ở bảng này)
    return sorted.slice(0, 15);
  }, [submissions, isAdminAuthenticated, currentStudent, selectedClassId, activeClassId, problems, topics, getStudentsInClass]);


  // Dữ liệu cho Chế độ 2: Bảng điểm theo Chủ đề
  const currentGradeTopic = topics.find((t) => t.id === selectedTopicId) || topics[0];
  const topicProblems = currentGradeTopic
    ? problems.filter((p) => p.topicId === currentGradeTopic.id)
    : [];
  const topicMaxTotalPoints = topicProblems.reduce((sum, p) => sum + (p.totalPoints || 10), 0);

  // Tập hợp các ID lớp học được phân bổ cho chủ đề này
  const topicClassIds = useMemo(() => {
    if (!currentGradeTopic) return ['ALL'];

    // Nếu chủ đề được phân vào 'ALL' hoặc mảng classIds chứa 'ALL' -> Mở cho tất cả các lớp
    if (
      (currentGradeTopic.classIds && currentGradeTopic.classIds.includes('ALL')) ||
      currentGradeTopic.classId === 'ALL'
    ) {
      return ['ALL'];
    }

    // Nếu chủ đề có danh sách lớp cụ thể
    if (currentGradeTopic.classIds && currentGradeTopic.classIds.length > 0) {
      const existingClassIds = new Set(classes.map((c) => c.id));
      const valid = currentGradeTopic.classIds.filter((id) => existingClassIds.has(id));
      return valid.length > 0 ? valid : ['ALL'];
    }

    if (currentGradeTopic.classId && currentGradeTopic.classId !== 'ALL') {
      const existingClassIds = new Set(classes.map((c) => c.id));
      if (existingClassIds.has(currentGradeTopic.classId)) {
        return [currentGradeTopic.classId];
      }
    }

    return ['ALL'];
  }, [currentGradeTopic, classes]);

  // Chỉ lấy những học sinh ĐƯỢC LÀM chủ đề này (thuộc các lớp được giao chủ đề)
  const topicEligibleStudents = useMemo(() => {
    if (!currentGradeTopic) return [];

    // Nếu người dùng chọn lọc 1 lớp cụ thể trên dropdown:
    if (selectedClassId !== 'ALL') {
      // Nếu chủ đề này không giao cho lớp đang chọn -> không có học sinh
      if (!topicClassIds.includes('ALL') && !topicClassIds.includes(selectedClassId)) {
        return [];
      }
      const classStudents = getStudentsInClass(selectedClassId);
      const eligibleIds = new Set(classStudents.map((s) => s.id));
      return students.filter((s) => eligibleIds.has(s.id));
    }

    // Nếu selectedClassId === 'ALL':
    // 1. Nếu chủ đề được giao cho các lớp cụ thể:
    if (!topicClassIds.includes('ALL')) {
      const eligibleIds = new Set<string>();
      topicClassIds.forEach((cId) => {
        getStudentsInClass(cId).forEach((s) => eligibleIds.add(s.id));
      });
      return students.filter((s) => eligibleIds.has(s.id));
    }

    // 2. Nếu chủ đề giao cho tất cả các lớp ('ALL'):
    // Chỉ lấy những học sinh đang tham gia ít nhất 1 lớp học trong hệ thống
    const enrolledIds = new Set<string>();
    classes.forEach((c) => {
      getStudentsInClass(c.id).forEach((s) => enrolledIds.add(s.id));
    });

    if (classes.length > 0) {
      return students.filter((s) => enrolledIds.has(s.id));
    }

    return students;
  }, [currentGradeTopic, topicClassIds, selectedClassId, students, classes, getStudentsInClass]);

  // Helper: Kiểm tra một bài nộp có đạt Full AC (100% test hoặc điểm tối đa) hay không
  // Không kiểm tra sub.overallVerdict === 'AC' đơn thuần vì bản ghi có thể bị gán nhầm
  const checkIsFullAc = (sub: Submission | null, maxPoints: number): boolean => {
    if (!sub) return false;
    const targetMax = maxPoints > 0 ? maxPoints : (sub.maxTotalPoints > 0 ? sub.maxTotalPoints : 10);
    const isFullPoints = targetMax > 0 && sub.totalPointsEarned >= targetMax;
    const isAllTestsPassed = sub.totalTests > 0 && sub.passedCount === sub.totalTests;
    return isFullPoints || isAllTestsPassed;
  };

  // Helper: Tìm bài nộp tốt nhất của 1 học sinh đối với 1 bài tập cụ thể
  // Nếu học sinh đã từng làm đạt tối đa (Full AC) bài này rồi, luôn giữ kết quả Full AC đó
  // để dù sau này học sinh có thử nghiệm nộp bài bị sai/điểm thấp hơn thì vẫn giữ trạng thái Full AC
  const getStudentProblemBest = (student: StudentUser, prob: Problem): { bestSub: Submission | null; isFull: boolean } => {
    const studentSubs = submissions.filter((s) => {
      const matchProb = s.problemId === prob.id || (prob.code && s.problemCode && s.problemCode === prob.code);
      if (!matchProb) return false;
      const subUser = (s.userId || '').trim().toLowerCase();
      const subName = (s.userName || '').trim().toLowerCase();
      const sId = (student.id || '').trim().toLowerCase();
      const sUser = (student.username || '').trim().toLowerCase();
      const sEmail = (student.email || '').trim().toLowerCase();
      const sName = (student.fullName || '').trim().toLowerCase();
      const custom = storageService.getStudentCustomName(student.id, student.email)?.trim().toLowerCase();

      const matchId = Boolean(sId && subUser && subUser === sId);
      const matchUser = Boolean(sUser && subUser && subUser === sUser);
      const matchEmail = Boolean(sEmail && subUser && subUser === sEmail);
      const matchName = Boolean(sName && subName && subName === sName);
      const matchCustom = Boolean(custom && subName && subName === custom);
      return matchId || matchName || matchUser || matchEmail || matchCustom;
    });

    if (studentSubs.length === 0) return { bestSub: null, isFull: false };

    const maxPts = prob.totalPoints || 10;
    const hasEverSolved = studentSubs.some((s) => checkIsFullAc(s, maxPts));

    const bestSub = studentSubs.reduce((best, cur) => {
      if (!best) return cur;
      // 1. Ưu tiên bài đạt Full AC nếu một trong hai đạt Full AC
      const curIsFull = checkIsFullAc(cur, maxPts);
      const bestIsFull = checkIsFullAc(best, maxPts);
      if (curIsFull && !bestIsFull) return cur;
      if (!curIsFull && bestIsFull) return best;
      // 2. Ưu tiên bài có điểm cao nhất
      if (cur.totalPointsEarned > best.totalPointsEarned) return cur;
      if (cur.totalPointsEarned < best.totalPointsEarned) return best;
      // 3. Nếu bằng điểm, ưu tiên bài nộp mới hơn
      if (new Date(cur.submittedAt).getTime() > new Date(best.submittedAt).getTime()) {
        return cur;
      }
      return best;
    }, null as Submission | null);

    return { bestSub, isFull: hasEverSolved };
  };

  // Bảo vệ bảo mật: Ẩn hoàn toàn bài nộp của Giáo viên và của học sinh khác khỏi học sinh hiện tại
  useEffect(() => {
    if (!isAdminAuthenticated && currentStudent && selectedSub) {
      const subUser = (selectedSub.userId || '').trim().toLowerCase();
      const subName = (selectedSub.userName || '').trim().toLowerCase();
      const sId = (currentStudent.id || '').trim().toLowerCase();
      const sUser = (currentStudent.username || '').trim().toLowerCase();
      const sEmail = (currentStudent.email || '').trim().toLowerCase();
      const sName = (currentStudent.fullName || '').trim().toLowerCase();
      const custom = storageService.getStudentCustomName(currentStudent.id, currentStudent.email)?.trim().toLowerCase();

      const matchId = Boolean(sId && subUser && subUser === sId);
      const matchUser = Boolean(sUser && subUser && subUser === sUser);
      const matchEmail = Boolean(sEmail && subUser && subUser === sEmail);
      const matchName = Boolean(sName && subName && subName === sName);
      const matchCustom = Boolean(custom && subName && subName === custom);
      if (!matchId && !matchName && !matchUser && !matchEmail && !matchCustom) {
        setSelectedSub(null);
      }
    }
  }, [isAdminAuthenticated, currentStudent, selectedSub]);

  // Helper lấy họ tên hiển thị chuẩn xác nhất cho bài nộp (luôn phản ánh tên mới nhất của học sinh)
  const getSubDisplayName = (sub: Submission): string => {
    if (sub.userId === 'admin_faminh' || sub.userName === 'Giáo viên FAMINH') {
      return 'Giáo viên FAMINH';
    }
    const subUser = (sub.userId || '').trim().toLowerCase();
    const subName = (sub.userName || '').trim().toLowerCase();

    if (currentStudent) {
      const sId = (currentStudent.id || '').trim().toLowerCase();
      const sUser = (currentStudent.username || '').trim().toLowerCase();
      const sEmail = (currentStudent.email || '').trim().toLowerCase();
      const sName = (currentStudent.fullName || '').trim().toLowerCase();
      const custom = storageService.getStudentCustomName(currentStudent.id, currentStudent.email)?.trim().toLowerCase();
      if (
        (sId && subUser && subUser === sId) ||
        (sUser && subUser && subUser === sUser) ||
        (sEmail && subUser && subUser === sEmail) ||
        (sName && subName && subName === sName) ||
        (custom && subName && subName === custom)
      ) {
        return currentStudent.fullName;
      }
    }

    const matchedStudent = students.find((s) => {
      const stuId = (s.id || '').trim().toLowerCase();
      const stuUser = (s.username || '').trim().toLowerCase();
      const stuEmail = (s.email || '').trim().toLowerCase();
      const stuName = (s.fullName || '').trim().toLowerCase();
      return (
        (stuId && subUser && subUser === stuId) ||
        (stuUser && subUser && subUser === stuUser) ||
        (stuEmail && subUser && subUser === stuEmail) ||
        (stuName && subName && subName === stuName)
      );
    });

    return matchedStudent?.fullName || sub.userName || 'Học sinh';
  };

  // Lấy thông tin bài tập và chủ đề tương ứng của bài nộp đang chọn
  const activeProblem = selectedSub ? problems.find((p) => p.id === selectedSub.problemId) : null;
  const activeTopic = activeProblem ? topics.find((t) => t.id === activeProblem.topicId) : null;
  const displayTitle = activeProblem?.title || selectedSub?.problemTitle || 'Bài tập';
  const displayCode = activeProblem?.code || selectedSub?.problemCode || 'CODE';

  // Lắng nghe phím ESC để đóng modal chi tiết
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSub(null);
      }
    };
    if (selectedSub) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSub]);

  const getVerdictBadge = (sub: Submission) => {
    const isFull =
      (sub.passedCount === sub.totalTests && sub.totalTests > 0) ||
      (sub.maxTotalPoints > 0 && sub.totalPointsEarned >= sub.maxTotalPoints);
    if (isFull) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          FULL AC (100%)
        </span>
      );
    }
    if (sub.passedCount > 0 || sub.totalPointsEarned > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          PARTIAL ({sub.totalPointsEarned}đ)
        </span>
      );
    }
    if (sub.overallVerdict === 'CE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
          <FileCode2 className="w-3.5 h-3.5" />
          LỖI BIÊN DỊCH (CE)
        </span>
      );
    }
    if (sub.overallVerdict === 'TLE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5" />
          QUÁ THỜI GIAN (TLE)
        </span>
      );
    }
    if (sub.overallVerdict === 'RTE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
          <AlertOctagon className="w-3.5 h-3.5" />
          LỖI THỰC THI (RTE)
        </span>
      );
    }
    if (sub.overallVerdict === 'SYS') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
          <AlertOctagon className="w-3.5 h-3.5" />
          LỖI MÁY CHẤM (SYS)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <XCircle className="w-3.5 h-3.5" />
        SAI KẾT QUẢ (WA)
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Bộ chuyển đổi chế độ xem (Dành cho Giáo viên) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            {viewMode === 'log' ? 'Nhật ký nộp bài & Kết quả chấm' : 'Bảng điểm & Tiến độ theo Chủ đề'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {viewMode === 'log'
              ? 'Theo dõi chi tiết kết quả của 15 lượt nộp bài gần đây nhất'
              : 'Thống kê tổng điểm và tiến độ hoàn thành từng bài tập của học sinh theo từng chuyên đề'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Bộ lọc theo Lớp học */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
            >
              <option value="ALL">Tất cả lớp học ({classes.length})</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className}
                </option>
              ))}
            </select>
          </div>


          {/* 2 Nút chuyển chế độ xem dành riêng cho Giáo viên */}
          {isAdminAuthenticated && (
            <div className="flex items-center p-1 bg-slate-800/80 rounded-2xl border border-slate-700/60 shadow-sm">

              <button
                type="button"
                onClick={() => setViewMode('log')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'log'
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Nhật ký từng lần nộp</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('topic_grades')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'topic_grades'
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Bảng điểm theo Chủ đề</span>
              </button>
            </div>
          )}

          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            {viewMode === 'log' ? `${displayedSubmissions.length} lượt nộp gần nhất` : `${topicEligibleStudents.length} học sinh được giao`}
          </span>
        </div>
      </div>

      {/* CHẾ ĐỘ 1: NHẬT KÝ TỪNG LẦN NỘP (Bảng thời gian như hiện tại) */}
      {(viewMode === 'log' || !isAdminAuthenticated) && (
        displayedSubmissions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <Layers className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <h5 className="font-semibold text-slate-300">Chưa có lượt nộp bài nào</h5>
            <p className="text-xs text-slate-500 mt-1">
              {isAdminAuthenticated
                ? 'Chưa có lượt nộp bài nào được ghi nhận trên hệ thống.'
                : 'Hãy chọn một bài tập bất kỳ và thử nộp bài để trải nghiệm hệ thống chấm Themis!'}
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 bg-slate-800/40">
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Học sinh</th>
                    <th className="py-3 px-4">Bài tập</th>
                    <th className="py-3 px-4">Ngôn ngữ</th>
                    <th className="py-3 px-4">Kết quả (Themis)</th>
                    <th className="py-3 px-4">Điểm số</th>
                    <th className="py-3 px-4">Thời gian chạy</th>
                    <th className="py-3 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {displayedSubmissions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetail(sub)}
                    >
                      <td className="py-3 px-4 text-slate-400 font-sans flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {new Date(sub.submittedAt).toLocaleTimeString()} ({new Date(sub.submittedAt).toLocaleDateString()})
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>{getSubDisplayName(sub)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                        [{sub.problemCode}] {sub.problemTitle}
                      </td>
                      <td className="py-3 px-4 uppercase text-slate-300 font-bold">
                        {sub.language}
                      </td>
                      <td className="py-3 px-4">{getVerdictBadge(sub)}</td>
                      <td className="py-3 px-4 font-bold">
                        <span className="text-amber-400">{sub.totalPointsEarned}</span>
                        <span className="text-slate-500"> / {sub.maxTotalPoints}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {(typeof sub.executionTime === 'number' ? sub.executionTime : (typeof (sub as any).time === 'number' ? (sub as any).time : 0)).toFixed(3)}s
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(sub);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          Chi tiết <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 bg-slate-800/40 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Chỉ hiển thị tối đa 15 lượt nộp bài gần đây nhất
              </span>
              <span className="text-slate-500 font-mono text-[10px]">
                (Các lượt nộp quá 15 lượt được ẩn trên bảng này)
              </span>
            </div>
          </div>
        )
      )}

      {/* CHẾ ĐỘ 2: BẢNG ĐIỂM THEO CHỦ ĐỀ (Dành riêng cho Giáo viên) */}
      {isAdminAuthenticated && viewMode === 'topic_grades' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Thanh chọn Chủ đề & Thống kê */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Chọn chủ đề (Chuyên đề) muốn xem bảng điểm:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer min-w-[220px]"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-400">Giao cho:</span>{' '}
                <b className="text-indigo-300 font-sans">
                  {topicClassIds.includes('ALL')
                    ? 'Tất cả các lớp'
                    : topicClassIds
                        .map((id) => classes.find((c) => c.id === id)?.className || id)
                        .join(', ')}
                </b>
              </span>
              <span className="text-xs font-mono text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">Học sinh được làm:</span>{' '}
                <b className="text-emerald-400">{topicEligibleStudents.length} HS</b>
              </span>
              <span className="text-xs font-mono text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                <span className="text-slate-400">Số bài:</span>{' '}
                <b className="text-blue-400">{topicProblems.length}</b>
              </span>
              <span className="text-xs font-mono text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                <span className="text-slate-400">Điểm tối đa:</span>{' '}
                <b className="text-amber-400">{topicMaxTotalPoints}đ</b>
              </span>
            </div>
          </div>

          {/* Bảng tổng hợp điểm số từng học sinh trong chủ đề */}
          {students.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <h5 className="font-semibold text-slate-300">Chưa có tài khoản học sinh nào</h5>
              <p className="text-xs text-slate-500 mt-1">
                Hãy nhấn vào nút <b>&quot;Quản lý Học sinh&quot;</b> trên thanh công cụ để cấp tài khoản cho học sinh.
              </p>
            </div>
          ) : topicProblems.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <h5 className="font-semibold text-slate-300">Chủ đề này chưa có bài tập nào</h5>
              <p className="text-xs text-slate-500 mt-1">
                Vui lòng vào mục &quot;Quản lý Chủ đề&quot; để thêm bài tập vào chuyên đề này.
              </p>
            </div>
          ) : topicEligibleStudents.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <h5 className="font-semibold text-slate-300">Không có học sinh nào được giao chủ đề này</h5>
              <p className="text-xs text-slate-500 mt-1">
                {selectedClassId !== 'ALL'
                  ? `Lớp hiện tại không thuộc danh sách lớp được giao chuyên đề "${currentGradeTopic?.name}". Hãy chọn "Tất cả lớp học" hoặc lớp được giao.`
                  : `Chuyên đề "${currentGradeTopic?.name}" hiện chưa có học sinh nào thuộc các lớp được giao làm bài.`}
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 bg-slate-800/40">
                      <th className="py-3 px-4 w-12 text-center">STT</th>
                      <th className="py-3 px-4 min-w-[180px]">Học sinh</th>
                      <th className="py-3 px-4 min-w-[170px]">Tiến độ chủ đề</th>
                      {topicProblems.map((prob) => (
                        <th
                          key={prob.id}
                          className="py-3 px-3 text-center min-w-[125px] border-l border-slate-800/50"
                        >
                          <div className="font-mono text-blue-400 font-bold tracking-tight">
                            [{prob.code}]
                          </div>
                          <div
                            className="text-[10px] text-slate-300 truncate max-w-[115px] font-medium mt-0.5 mx-auto"
                            title={prob.title}
                          >
                            {prob.title}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            ({prob.totalPoints || 10}đ)
                          </div>
                        </th>
                      ))}
                      <th className="py-3 px-4 text-center min-w-[140px] border-l border-slate-800/80 bg-slate-800/30">
                        Tổng điểm chủ đề
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {topicEligibleStudents.map((st, idx) => {
                      let completedCount = 0;
                      let totalPointsEarned = 0;

                      const problemBests = topicProblems.map((prob) => {
                        const maxPts = prob.totalPoints || 10;
                        const { bestSub, isFull } = getStudentProblemBest(st, prob);
                        if (bestSub) {
                          totalPointsEarned += bestSub.totalPointsEarned;
                        }
                        if (isFull) {
                          completedCount++;
                        }
                        return { prob, bestSub, isFull, maxPts };
                      });

                      const progressPercent =
                        topicProblems.length > 0
                          ? Math.round((completedCount / topicProblems.length) * 100)
                          : 0;

                      return (
                        <tr
                          key={st.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 text-center text-slate-500 font-bold">
                            #{idx + 1}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <span className="font-bold text-slate-100 block">
                                  {st.fullName}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  @{st.username}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-300 font-medium">
                                  Đã làm {completedCount} / {topicProblems.length} bài
                                </span>
                                <span className="font-mono font-bold text-blue-400">
                                  {progressPercent}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700/60">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Điểm từng bài tập */}
                          {problemBests.map(({ prob, bestSub, isFull, maxPts }) => {
                            return (
                              <td
                                key={prob.id}
                                className="py-3 px-3 text-center border-l border-slate-800/50"
                              >
                                {bestSub ? (
                                  <button
                                    onClick={() => handleOpenDetail(bestSub)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer shadow-sm hover:scale-105 ${
                                      isFull
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                        : bestSub.totalPointsEarned > 0
                                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                                    }`}
                                    title="Bấm để xem chi tiết bài nộp & mã nguồn của học sinh"
                                  >
                                    {isFull && (
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                    )}
                                    <span>
                                      {bestSub.totalPointsEarned} / {maxPts}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-500 font-mono italic">
                                    Chưa làm (0đ)
                                  </span>
                                )}
                              </td>
                            );
                          })}

                          {/* Tổng điểm chủ đề */}
                          <td className="py-3 px-4 text-center font-mono font-bold border-l border-slate-800/80 bg-slate-800/20">
                            <span
                              className={`text-sm ${
                                totalPointsEarned >= topicMaxTotalPoints &&
                                topicMaxTotalPoints > 0
                                  ? 'text-emerald-400'
                                  : totalPointsEarned > 0
                                  ? 'text-amber-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {totalPointsEarned}
                            </span>
                            <span className="text-slate-500 text-xs">
                              {' '}
                              / {topicMaxTotalPoints}đ
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submission Detail Modal (Chi tiết bài nộp & kết quả chấm Themis) */}
      {selectedSub && (
        <div
          onClick={() => setSelectedSub(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`border rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative transition-colors ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
            }`}
          >
            {/* Header: Cố định ở trên, không bao giờ bị cuộn nội dung tràn qua */}
            <div className={`shrink-0 px-6 py-4 border-b flex items-start justify-between gap-4 transition-colors ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                    theme === 'light'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-red-500/15 text-red-400 border-red-500/30'
                  }`}>
                    Mã bài: {displayCode}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-lg border ${
                    theme === 'light'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }`}>
                    <User className="w-3.5 h-3.5 text-emerald-500" />
                    Học sinh: {getSubDisplayName(selectedSub)}
                  </span>
                  {activeTopic && (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-lg border ${
                      theme === 'light'
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      Chủ đề: {activeTopic.name}
                    </span>
                  )}
                  <span className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    • Nhật ký chấm Themis
                  </span>
                </div>

                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                    theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Tên bài tập:
                  </span>
                  <h3 className={`text-xl sm:text-2xl font-black tracking-tight ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}>
                    {displayTitle}
                  </h3>
                </div>
              </div>

              {/* Chỉ 1 nút Đóng duy nhất ở góc trên bên phải */}
              <button
                onClick={() => setSelectedSub(null)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all border shadow-sm shrink-0 cursor-pointer ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-700 border-slate-200 hover:border-rose-500'
                    : 'bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white border-slate-700 hover:border-rose-500'
                }`}
                title="Đóng cửa sổ (Phím ESC hoặc click ra ngoài)"
              >
                <span className="text-xs font-semibold hidden sm:inline">Đóng</span>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body: Chứa Bảng điểm Themis và Mã nguồn, cuộn mượt mà bên trong, không bao giờ tràn ra viền */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Themis Table */}
              <div className="w-full">
                <ThemisGradingTable
                  submission={selectedSub}
                  isGrading={false}
                />
              </div>

              {/* Source Code View */}
              <div className="w-full">
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  <Code2 className="w-4 h-4 text-red-500 dark:text-red-400" /> Mã nguồn đã nộp ({(typeof selectedSub.language === 'string' ? selectedSub.language : String(selectedSub.language || '')).toUpperCase()}):
                </h4>
                <pre className="p-4 bg-slate-950 rounded-2xl text-emerald-400 font-mono text-xs overflow-x-auto max-h-64 border border-slate-800">
                  {typeof selectedSub.sourceCode === 'object' ? JSON.stringify(selectedSub.sourceCode, null, 2) : String(selectedSub.sourceCode || '')}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

