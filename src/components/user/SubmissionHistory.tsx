import React, { useState, useEffect, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import { isProblemInClass, type Submission, type StudentUser, type Problem } from '../../types/judge';
import {
  Code2,
  X,
  Copy,
  Check,
  ChevronDown,
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
    studentClasses,
    isAdminAuthenticated,
    currentStudent,
    students,
    getStudentsInClass,
    activeClassId,
    refreshAllData,
  } = useJudge();
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopySourceCode = (codeStr: string) => {
    if (!codeStr) return;
    navigator.clipboard.writeText(codeStr);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const handleOpenDetail = async (sub: Submission) => {
    setSelectedSub(sub);
    if (!sub.testResults || sub.testResults.length === 0 || !sub.sourceCode) {
      try {
        setIsLoadingDetail(true);
        const full = await apiService.fetchSubmissionById(sub.id);
        if (full) {
          setSelectedSub((curr) =>
            curr?.id === sub.id
              ? {
                  ...curr,
                  ...full,
                  testResults: full.testResults && full.testResults.length > 0 ? full.testResults : curr.testResults,
                  sourceCode: full.sourceCode || curr.sourceCode,
                }
              : curr
          );
        }
      } catch (e) {
        console.warn('Lỗi tải chi tiết bài nộp:', e);
      } finally {
        setIsLoadingDetail(false);
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

  // Danh sách lớp hiển thị trên bộ lọc: Giáo viên thấy toàn bộ lớp, Học sinh chỉ thấy lớp mình đang tham gia
  const availableClasses = isAdminAuthenticated ? classes : studentClasses;

  // Tự động đưa bộ lọc về 'ALL' nếu lớp đang chọn không còn nằm trong danh sách lớp được phép xem (ví dụ khi đã ra khỏi lớp đó)
  useEffect(() => {
    if (selectedClassId !== 'ALL' && !availableClasses.some((c) => c.id === selectedClassId)) {
      setSelectedClassId('ALL');
    }
  }, [availableClasses, selectedClassId]);

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
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshRef.current().catch(() => {});
    }, 30000);
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
  const allFilteredSubmissions = useMemo(() => {
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

    return [...list].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }, [submissions, isAdminAuthenticated, currentStudent, selectedClassId, activeClassId, problems, topics, getStudentsInClass]);

  const [displayLimit, setDisplayLimit] = useState<number>(15);

  const displayedSubmissions = useMemo(() => {
    return allFilteredSubmissions.slice(0, displayLimit);
  }, [allFilteredSubmissions, displayLimit]);


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

  // 10 lượt gần nhất
  const recent10Submissions = useMemo(() => {
    return allFilteredSubmissions.slice(0, 10);
  }, [allFilteredSubmissions]);

  const recent10FullAcCount = useMemo(() => {
    return recent10Submissions.filter((s) => checkIsFullAc(s, s.maxTotalPoints || 10)).length;
  }, [recent10Submissions]);

  const recent10NotFullCount = recent10Submissions.length - recent10FullAcCount;

  // Gom nhóm danh sách bài nộp theo ngày
  interface DateGroup {
    dateKey: string;
    dateLabel: string;
    items: Submission[];
  }

  const groupedSubmissions = useMemo(() => {
    const groups: DateGroup[] = [];
    const map = new Map<string, DateGroup>();

    displayedSubmissions.forEach((sub) => {
      const d = new Date(sub.submittedAt);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      if (!map.has(dateKey)) {
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const dayName = days[d.getDay()];
        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const dateLabel = `${dayName}, ${day}/${month}/${year}`;
        const newGroup = { dateKey, dateLabel, items: [] };
        map.set(dateKey, newGroup);
        groups.push(newGroup);
      }
      map.get(dateKey)!.items.push(sub);
    });

    return groups;
  }, [displayedSubmissions]);

  const formatTimeOnly = (dateStr: string) => {
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const formatLanguageShort = (lang?: string) => {
    const l = (lang || '').toUpperCase().trim();
    if (l === 'CPP' || l === 'C++') return 'C++';
    if (l === 'PYTHON' || l === 'PY') return 'Python';
    if (l === 'PASCAL' || l === 'PAS') return 'Pascal';
    if (l === 'JAVA') return 'Java';
    return lang || 'C++';
  };

  const getExecutionTimeStr = (sub: Submission) => {
    const time =
      typeof sub.executionTime === 'number'
        ? sub.executionTime
        : typeof (sub as any).time === 'number'
        ? (sub as any).time
        : 0;
    return `${time.toFixed(3)}s`;
  };

  const isSubFullAc = (sub: Submission): boolean => {
    const maxPts = sub.maxTotalPoints > 0 ? sub.maxTotalPoints : 10;
    if (sub.totalPointsEarned >= maxPts && maxPts > 0) return true;
    if (sub.totalTests > 0 && sub.passedCount === sub.totalTests) return true;
    return sub.overallVerdict === 'AC';
  };

  const getPillBg = (sub: Submission) => {
    if (isSubFullAc(sub)) return '#2F6B3F';
    if (sub.totalPointsEarned > 0 || (sub.passedCount && sub.passedCount > 0)) return '#D97706';
    return '#B4281F';
  };

  const renderStudentVerdict = (sub: Submission) => {
    if (isSubFullAc(sub)) {
      return (
        <span className="text-[#2F6B3F] font-semibold text-[13px] flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] leading-none">■</span> Full AC
        </span>
      );
    }
    if (sub.overallVerdict === 'CE') {
      return (
        <span className="text-[#6B655C] font-semibold text-[13px] flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] leading-none">■</span> Lỗi biên dịch (CE)
        </span>
      );
    }
    if (sub.overallVerdict === 'TLE') {
      return (
        <span className="text-[#D97706] font-semibold text-[13px] flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] leading-none">■</span> Quá thời gian (TLE)
        </span>
      );
    }
    if (sub.overallVerdict === 'RTE') {
      return (
        <span className="text-[#DC2626] font-semibold text-[13px] flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] leading-none">■</span> Lỗi thực thi (RTE)
        </span>
      );
    }
    if (sub.totalPointsEarned > 0 || (sub.passedCount && sub.passedCount > 0)) {
      return (
        <span className="text-[#D97706] font-semibold text-[13px] flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] leading-none">■</span> Một phần ({sub.totalPointsEarned} điểm)
        </span>
      );
    }
    if (sub.overallVerdict === 'SYS') {
      return (
        <span className="text-[#7C3AED] font-semibold text-[13px] flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] leading-none">■</span> Lỗi hệ thống (SYS)
        </span>
      );
    }
    return (
      <span className="text-[#B4281F] font-semibold text-[13px] flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-[10px] leading-none">■</span> Sai kết quả (WA)
      </span>
    );
  };

  const renderDetailModal = () => {
    if (!selectedSub) return null;
    return (
      <div
        onClick={() => setSelectedSub(null)}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-[#FAF7EE] border border-[#D9D2C3] rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden relative shadow-2xl"
        >
          {/* Header Modal */}
          <div className="shrink-0 px-6 py-4 border-b border-[#D9D2C3] bg-[#FAF7EE] flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F3DFD8] text-[#B4281F] border border-[#B4281F]/20">
                  Mã bài: {displayCode}
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white text-[#1F1D1A] border border-[#D9D2C3]">
                  {formatLanguageShort(selectedSub.language)}
                </span>
                {activeTopic && (
                  <span className="text-xs text-[#6B655C]">
                    • Chủ đề: {activeTopic.name}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-[#1F1D1A] tracking-tight">
                {displayTitle}
              </h3>
            </div>
            <button
              onClick={() => setSelectedSub(null)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#D9D2C3] bg-white hover:bg-[#B4281F] hover:text-white text-[#1F1D1A] transition-colors cursor-pointer text-xs font-semibold"
            >
              <span>Đóng</span>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Modal */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="w-full">
              <ThemisGradingTable
                submission={selectedSub}
                isGrading={false}
              />
            </div>

            {/* Source code */}
            <div className="w-full border-t border-[#D9D2C3] pt-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F1D1A] flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#B4281F]" /> Mã nguồn đã nộp ({formatLanguageShort(selectedSub.language)}):
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    handleCopySourceCode(
                      typeof selectedSub.sourceCode === 'object'
                        ? JSON.stringify(selectedSub.sourceCode, null, 2)
                        : String(selectedSub.sourceCode || '')
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-[#D9D2C3] bg-white hover:bg-[#F4EFE6] text-[#1F1D1A] transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Đã chép' : 'Sao chép code'}</span>
                </button>
              </div>
              <pre
                className="p-4 bg-[#1F1D1A] rounded-xl text-emerald-400 font-mono text-xs sm:text-sm overflow-x-auto max-h-80 border border-[#3E3A33] leading-relaxed select-text"
                style={{
                  fontFamily: "'JetBrains Mono', 'Consolas', 'Courier New', monospace",
                  whiteSpace: 'pre',
                  tabSize: 4,
                }}
              >
                {isLoadingDetail && !selectedSub.sourceCode
                  ? '// Đang tải mã nguồn từ máy chủ...'
                  : typeof selectedSub.sourceCode === 'object'
                  ? JSON.stringify(selectedSub.sourceCode, null, 2)
                  : String(selectedSub.sourceCode || '// Không có mã nguồn được lưu')}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // GIAO DIỆN HỌC SINH (THEO ĐÚNG NGUYÊN BẢN THIẾT KẾ EDITORIAL)
  if (!isAdminAuthenticated) {
    return (
      <div className="fj-w space-y-6" style={{ paddingTop: 32, paddingBottom: 64 }}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1
              className="text-3xl md:text-4xl font-bold text-[#1F1D1A] tracking-tight"
              style={{ fontFamily: "'Be Vietnam Pro', serif" }}
            >
              Lịch sử nộp bài
            </h1>
            <p className="text-sm text-[#6B655C] mt-1">
              Kết quả chấm của các lượt nộp gần đây nhất.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[#6B655C] whitespace-nowrap">
              {displayLimit} lượt nộp gần nhất
            </span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-1.5 bg-[#FAF7EE] border border-[#D9D2C3] rounded text-[13px] font-sans font-medium text-[#1F1D1A] outline-none cursor-pointer hover:border-[#1F1D1A] transition-colors"
            >
              <option value="ALL">Tất cả lớp ({availableClasses.length})</option>
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Streak Bar (10 recent submissions) */}
        {allFilteredSubmissions.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-1">
              {recent10Submissions.map((sub, idx) => (
                <div
                  key={sub.id || idx}
                  className="w-5 h-4.5 rounded-[3px] transition-transform hover:scale-110 cursor-pointer"
                  style={{ backgroundColor: getPillBg(sub) }}
                  title={`${sub.problemCode}: ${isSubFullAc(sub) ? 'Full AC' : `${sub.totalPointsEarned}đ`}`}
                  onClick={() => handleOpenDetail(sub)}
                />
              ))}
            </div>
            <span className="text-[13px] text-[#6B655C]">
              {recent10Submissions.length} lượt gần nhất: {recent10FullAcCount} Full AC
              {recent10NotFullCount > 0 ? `, ${recent10NotFullCount} chưa đạt điểm tối đa` : ''}
            </span>
          </div>
        )}

        {/* Table or Empty state */}
        {displayedSubmissions.length === 0 ? (
          <div className="border-t-2 border-[#1F1D1A] pt-12 pb-16 text-center text-[#6B655C]">
            <p className="text-lg font-bold text-[#1F1D1A]">Chưa có lượt nộp bài nào</p>
            <p className="text-sm mt-1">
              Hãy chọn một bài tập bất kỳ và thử nộp bài để trải nghiệm hệ thống chấm Themis!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              {/* Table Column Headers */}
              <div className="border-t-2 border-[#1F1D1A] py-2.5 grid grid-cols-[100px_180px_80px_180px_90px_120px_1fr] items-center gap-3 text-[12px] text-[#6B655C] font-medium">
                <div>Giờ nộp</div>
                <div>Bài tập</div>
                <div>Ngôn ngữ</div>
                <div>Kết quả</div>
                <div>Điểm</div>
                <div>Thời gian chạy</div>
                <div></div>
              </div>

              {/* Date groups */}
              <div className="space-y-4">
                {groupedSubmissions.map((group, groupIdx) => (
                  <div key={group.dateKey} className={groupIdx > 0 ? 'border-t-2 border-[#1F1D1A] pt-4' : ''}>
                    <div className="flex items-center justify-between pb-2 text-sm">
                      <span className="font-bold text-[15px] text-[#1F1D1A]">{group.dateLabel}</span>
                      <span className="text-[13px] text-[#6B655C]">{group.items.length} lượt nộp</span>
                    </div>

                    <div className="divide-y divide-[#D9D2C3]">
                      {group.items.map((sub) => (
                        <div
                          key={sub.id}
                          className="py-3 grid grid-cols-[100px_180px_80px_180px_90px_120px_1fr] items-center gap-3 text-[13px] hover:bg-black/[0.02] transition-colors"
                        >
                          <div className="font-mono text-[#6B655C]">
                            {formatTimeOnly(sub.submittedAt)}
                          </div>
                          <div className="font-mono font-bold text-[#1F1D1A] truncate" title={sub.problemCode || sub.problemTitle}>
                            {sub.problemCode || sub.problemTitle}
                          </div>
                          <div className="font-mono text-[#6B655C]">
                            {formatLanguageShort(sub.language)}
                          </div>
                          <div>
                            {renderStudentVerdict(sub)}
                          </div>
                          <div className="font-mono font-medium text-[#1F1D1A]">
                            {sub.totalPointsEarned}/{sub.maxTotalPoints || 10}
                          </div>
                          <div className="font-mono text-[#6B655C]">
                            {getExecutionTimeStr(sub)}
                          </div>
                          <div className="text-right">
                            <button
                              onClick={() => handleOpenDetail(sub)}
                              className="text-[#B4281F] font-medium hover:underline cursor-pointer text-[13px] inline-flex items-center"
                            >
                              Chi tiết →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Table Footer */}
              <div className="border-t border-[#D9D2C3] pt-4 mt-4 flex items-center justify-between text-[13px]">
                <span className="text-[#6B655C]">
                  {allFilteredSubmissions.length > displayLimit
                    ? `Còn ${allFilteredSubmissions.length - displayLimit} lượt nộp cũ hơn`
                    : 'Đã hiển thị tất cả lượt nộp'}
                </span>
                {allFilteredSubmissions.length > displayLimit && (
                  <button
                    onClick={() => setDisplayLimit((prev) => prev + 15)}
                    className="text-[#B4281F] font-medium hover:underline cursor-pointer"
                  >
                    Xem thêm →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Chi tiết bài nộp */}
        {renderDetailModal()}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header & Tabs (Khung điều hướng giáo viên) */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#1F1D1A] tracking-tight">
            {viewMode === 'topic_grades' ? 'Bảng điểm theo chủ đề' : 'Lịch sử nộp bài'}
          </h1>
          <p className="text-sm text-[#6B655C] mt-1">
            {viewMode === 'topic_grades'
              ? 'Tổng điểm và tiến độ từng bài của học sinh theo chủ đề.'
              : 'Theo dõi chi tiết kết quả của các lượt nộp bài gần đây nhất.'}
          </p>
        </div>

        <div className="flex items-center gap-6 self-start sm:self-auto">
          {/* Tabs */}
          <div className="flex items-center gap-5 text-sm">
            <button
              type="button"
              onClick={() => setViewMode('log')}
              className={`pb-1 transition-all cursor-pointer ${
                viewMode === 'log'
                  ? 'text-[#1F1D1A] font-bold border-b-2 border-[#B4281F]'
                  : 'text-[#6B655C] hover:text-[#1F1D1A] font-medium'
              }`}
            >
              Nhật ký nộp bài
            </button>
            <button
              type="button"
              onClick={() => setViewMode('topic_grades')}
              className={`pb-1 transition-all cursor-pointer ${
                viewMode === 'topic_grades'
                  ? 'text-[#1F1D1A] font-bold border-b-2 border-[#B4281F]'
                  : 'text-[#6B655C] hover:text-[#1F1D1A] font-medium'
              }`}
            >
              Bảng điểm
            </button>
          </div>

          {/* Class selector */}
          <div className="relative">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="appearance-none bg-[#FAF7EE] border border-[#D9D2C3] rounded-lg px-3.5 py-1.5 pr-8 text-sm font-semibold text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A] cursor-pointer"
            >
              <option value="ALL">Tất cả lớp học</option>
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#6B655C] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* CHẾ ĐỘ 1: NHẬT KÝ TỪNG LẦN NỘP */}
      {viewMode === 'log' && (
        <div className="space-y-6">
          {/* Header tóm tắt lượt gần nhất */}
          {recent10Submissions.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                {recent10Submissions.map((sub, idx) => (
                  <span
                    key={sub.id || idx}
                    className="w-4 h-4 rounded-xs inline-block"
                    style={{ backgroundColor: getPillBg(sub) }}
                    title={`${sub.problemCode}: ${sub.totalPointsEarned}/${sub.maxTotalPoints || 10}`}
                  />
                ))}
              </div>
              <span className="text-xs text-[#6B655C]">
                10 lượt gần nhất: {recent10FullAcCount} Full AC, {recent10NotFullCount} chưa đạt điểm tối đa
              </span>
            </div>
          )}

          {displayedSubmissions.length === 0 ? (
            <div className="border border-[#D9D2C3] rounded-lg p-12 text-center text-[#6B655C]">
              Chưa có lượt nộp bài nào được ghi nhận trên hệ thống.
            </div>
          ) : (
            <div>
              <div className="border-t-2 border-[#1F1D1A] overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D9D2C3] text-xs font-semibold text-[#6B655C]">
                      <th className="py-3 px-3">Giờ nộp</th>
                      <th className="py-3 px-4">Học sinh</th>
                      <th className="py-3 px-4">Bài tập</th>
                      <th className="py-3 px-3">Ngôn ngữ</th>
                      <th className="py-3 px-4">Kết quả</th>
                      <th className="py-3 px-3">Điểm</th>
                      <th className="py-3 px-3">Thời gian chạy</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DDCE]">
                    {displayedSubmissions.map((sub) => (
                      <tr
                        key={sub.id}
                        className="hover:bg-[#F4EFE6] transition-colors cursor-pointer"
                        onClick={() => handleOpenDetail(sub)}
                      >
                        <td className="py-3.5 px-3 font-mono text-[#6B655C] whitespace-nowrap">
                          {formatTimeOnly(sub.submittedAt)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-sm text-[#1F1D1A]">
                            {getSubDisplayName(sub)}
                          </div>
                          <div className="text-xs text-[#6B655C] font-mono">
                            {sub.userId || ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold font-mono text-[#1F1D1A]">
                            [{sub.problemCode}]
                          </span>{' '}
                          <span className="text-[#1F1D1A] font-medium">
                            {sub.problemTitle}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[#6B655C]">
                          {formatLanguageShort(sub.language)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {renderStudentVerdict(sub)}
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-sm text-[#1F1D1A] whitespace-nowrap">
                          {sub.totalPointsEarned} / {sub.maxTotalPoints || 10}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[#6B655C] whitespace-nowrap">
                          {getExecutionTimeStr(sub)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(sub);
                            }}
                            className="text-[#B4281F] font-semibold hover:underline cursor-pointer inline-flex items-center gap-1"
                          >
                            Chi tiết →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="border-t border-[#D9D2C3] pt-4 mt-2 flex items-center justify-between text-xs text-[#6B655C]">
                <div>
                  {allFilteredSubmissions.length > displayLimit
                    ? `Còn ${allFilteredSubmissions.length - displayLimit} lượt nộp cũ hơn`
                    : `Đã hiển thị tất cả ${allFilteredSubmissions.length} lượt nộp`}
                </div>
                {allFilteredSubmissions.length > displayLimit && (
                  <button
                    onClick={() => setDisplayLimit((prev) => prev + 15)}
                    className="text-[#B4281F] font-semibold hover:underline cursor-pointer"
                  >
                    Xem thêm →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHẾ ĐỘ 2: BẢNG ĐIỂM THEO CHỦ ĐỀ */}
      {viewMode === 'topic_grades' && (
        <div className="space-y-6">
          {/* Subheader: Bộ chọn chủ đề & Thống kê */}
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <label className="block text-xs text-[#6B655C] mb-1">
                Chủ đề đang xem
              </label>
              <div className="relative">
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="appearance-none bg-[#FAF7EE] border border-[#D9D2C3] rounded-lg px-3.5 py-2 pr-9 text-sm font-bold text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A] cursor-pointer min-w-[260px]"
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#6B655C] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="text-xs text-[#6B655C] mb-1">Giao cho</div>
              <div className="text-sm font-bold text-[#1F1D1A]">
                {topicClassIds.includes('ALL')
                  ? 'Tất cả các lớp'
                  : topicClassIds
                      .map((id) => classes.find((c) => c.id === id)?.className || id)
                      .join(', ')}
              </div>
            </div>

            <div>
              <div className="text-xs text-[#6B655C] mb-1">Học sinh được làm</div>
              <div className="text-sm font-bold text-[#1F1D1A]">
                {topicEligibleStudents.length}
              </div>
            </div>

            <div>
              <div className="text-xs text-[#6B655C] mb-1">Số bài</div>
              <div className="text-sm font-bold text-[#1F1D1A]">
                {topicProblems.length}
              </div>
            </div>

            <div>
              <div className="text-xs text-[#6B655C] mb-1">Điểm tối đa</div>
              <div className="text-sm font-bold text-[#1F1D1A]">
                {topicMaxTotalPoints} điểm
              </div>
            </div>
          </div>

          {/* Table */}
          {students.length === 0 ? (
            <div className="border border-[#D9D2C3] rounded-lg p-12 text-center text-[#6B655C]">
              Chưa có tài khoản học sinh nào trong hệ thống.
            </div>
          ) : topicProblems.length === 0 ? (
            <div className="border border-[#D9D2C3] rounded-lg p-12 text-center text-[#6B655C]">
              Chuyên đề này chưa có bài tập nào. Hãy vào mục "Quản lý chủ đề" để thêm bài tập.
            </div>
          ) : topicEligibleStudents.length === 0 ? (
            <div className="border border-[#D9D2C3] rounded-lg p-12 text-center text-[#6B655C]">
              Không có học sinh nào được giao chuyên đề này.
            </div>
          ) : (
            <div>
              <div className="border-t-2 border-[#1F1D1A] overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D9D2C3] text-xs font-semibold text-[#6B655C]">
                      <th className="py-3 px-3 w-10 text-left">#</th>
                      <th className="py-3 px-4 min-w-[200px]">Học sinh</th>
                      <th className="py-3 px-4 min-w-[220px]">Tiến độ chủ đề</th>
                      {topicProblems.map((prob) => (
                        <th
                          key={prob.id}
                          className="py-3 px-3 text-center min-w-[100px]"
                        >
                          <div className="font-mono font-bold text-[#1F1D1A] tracking-tight">
                            {prob.code}
                          </div>
                          <div className="text-[11px] text-[#6B655C] font-normal mt-0.5">
                            {prob.totalPoints || 10} điểm
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DDCE]">
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
                          className="hover:bg-[#F4EFE6] transition-colors"
                        >
                          <td className="py-3.5 px-3 text-sm text-[#6B655C]">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-sm text-[#1F1D1A]">
                              {st.fullName || st.username}
                            </div>
                            <div className="text-xs text-[#6B655C] font-mono mt-0.5">
                              {st.email || `@${st.username}`}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-between text-xs text-[#1F1D1A] mb-1.5">
                              <span>
                                Đã làm {completedCount}/{topicProblems.length} bài
                              </span>
                              <span className="font-bold">{progressPercent}%</span>
                            </div>
                            <div className="w-full bg-[#E4DDCE] h-1 rounded-full overflow-hidden">
                              <div
                                className="bg-[#B4281F] h-full rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </td>

                          {problemBests.map(({ prob, bestSub, isFull, maxPts }) => {
                            return (
                              <td
                                key={prob.id}
                                className="py-3.5 px-3 text-center align-middle"
                              >
                                {bestSub ? (
                                  <button
                                    onClick={() => handleOpenDetail(bestSub)}
                                    className={`inline-block px-2.5 py-0.5 rounded text-xs font-mono font-bold transition-transform hover:scale-105 cursor-pointer ${
                                      isFull
                                        ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]'
                                        : 'bg-[#FDF2F0] text-[#B4281F] border border-[#F7D6D0]'
                                    }`}
                                    title="Nhấn để xem chi tiết bài nộp"
                                  >
                                    {bestSub.totalPointsEarned} / {maxPts}
                                  </button>
                                ) : (
                                  <span className="text-[#6B655C] font-mono text-sm block">
                                    –
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="border-t border-[#D9D2C3] pt-4 mt-2 flex items-center justify-between text-xs text-[#6B655C]">
                <div>
                  Hiện {topicEligibleStudents.length} học sinh · {topicProblems.length} bài · dấu – là chưa làm
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.querySelector('.overflow-x-auto');
                    if (el) el.scrollLeft = el.scrollWidth;
                  }}
                  className="text-[#B4281F] font-semibold hover:underline cursor-pointer"
                >
                  Xem đầy đủ →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Chi tiết bài nộp */}
      {renderDetailModal()}
    </div>
  );
};

