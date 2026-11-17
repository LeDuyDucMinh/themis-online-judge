import React, { useState, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Problem } from '../../types/judge';
import { isProblemInClass, isResourceOwnedByTeacher } from '../../types/judge';
import { storageService } from '../../services/storageService';
import { ClassLeaderboard } from '../common/ClassLeaderboard';

interface UserProblemListProps {
  onSelectProblem: (problem: Problem) => void;
  onBackToClasses?: () => void;
}

export const UserProblemList: React.FC<UserProblemListProps> = ({ onSelectProblem, onBackToClasses: _onBackToClasses }) => {
  const {
    classes,
    topics,
    problems,
    getProblemStatus,
    submissions,
    isAdminAuthenticated,
    currentStudent,
    activeClassId,
    activeClass,
  } = useJudge();

  // State điều hướng: activeTopicId === null là trang chủ đề, !== null là trang danh sách bài của chủ đề đó
  const [activeTopicId, setActiveTopicIdState] = useState<string | null>(() => {
    return storageService.getActiveTopicId();
  });

  const setActiveTopicId = (id: string | null) => {
    setActiveTopicIdState(id);
    storageService.setActiveTopicId(id);
  };

  // Bộ lọc bên trong chủ đề
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SOLVED' | 'UNSOLVED'>('ALL');

  // Bộ nhớ đệm tên tùy chỉnh của học sinh
  const currentStudentCustomName = useMemo(() => {
    if (!currentStudent) return null;
    return storageService.getStudentCustomName(currentStudent.id, currentStudent.email)?.trim().toLowerCase() || null;
  }, [currentStudent]);

  // Lấy điểm số cao nhất của bài (tính riêng theo từng học sinh)
  const getProblemScore = (problemId: string) => {
    let subs = submissions.filter((s) => s.problemId === problemId);
    if (!isAdminAuthenticated && currentStudent) {
      const sId = (currentStudent.id || '').trim().toLowerCase();
      const sUser = (currentStudent.username || '').trim().toLowerCase();
      const sEmail = (currentStudent.email || '').trim().toLowerCase();
      const sName = (currentStudent.fullName || '').trim().toLowerCase();
      const customName = currentStudentCustomName;

      subs = subs.filter((s) => {
        const subUser = (s.userId || '').trim().toLowerCase();
        const subName = (s.userName || '').trim().toLowerCase();
        const matchId = Boolean(sId && subUser && subUser === sId);
        const matchUser = Boolean(sUser && subUser && subUser === sUser);
        const matchEmail = Boolean(sEmail && subUser && subUser === sEmail);
        const matchName = Boolean(sName && subName && subName === sName);
        const matchCustom = Boolean(customName && subName && subName === customName);
        return matchId || matchName || matchUser || matchEmail || matchCustom;
      });
    }
    if (subs.length === 0) return null;
    return Math.max(...subs.map((s) => s.totalPointsEarned));
  };

  // Lọc bài tập chỉ thuộc lớp học hiện tại nếu có activeClassId
  const classScopedProblems = useMemo(() => {
    return activeClassId
      ? problems.filter((p) => isProblemInClass(p, activeClassId, topics, classes))
      : problems;
  }, [activeClassId, problems, topics, classes]);

  // Lọc chủ đề hiển thị
  const visibleTopics = useMemo(() => {
    return activeClassId
      ? topics.filter((t) => {
          const assignedIds = t.classIds && t.classIds.length > 0
            ? t.classIds
            : (t.classId ? [t.classId] : ['ALL']);

          if (assignedIds.includes(activeClassId)) return true;
          if (assignedIds.includes('ALL')) {
            if (activeClass?.teacherId && !isResourceOwnedByTeacher(t.teacherId, activeClass.teacherId)) {
              return false;
            }
            const hasClassProblems = classScopedProblems.some((p) => p.topicId === t.id);
            const totalInTopic = problems.filter((p) => p.topicId === t.id).length;
            return hasClassProblems || totalInTopic === 0;
          }
          return false;
        })
      : topics;
  }, [activeClassId, topics, activeClass, classScopedProblems, problems]);

  // Danh sách bài tập không thuộc chủ đề nào
  const unassignedProblems = useMemo(() => {
    return classScopedProblems.filter((p) => {
      if (!p.topicId || p.topicId === 'NONE' || p.topicId === '') return true;
      return !topics.some((t) => t.id === p.topicId);
    });
  }, [classScopedProblems, topics]);

  // Chủ đề hiện đang được chọn
  const isUnassignedSelected = activeTopicId === 'UNASSIGNED';
  const currentTopic = activeTopicId && !isUnassignedSelected
    ? topics.find((t) => t.id === activeTopicId) || null
    : null;

  // Danh sách bài tập hiển thị
  const topicProblems = useMemo(() => {
    if (isUnassignedSelected) return unassignedProblems;
    if (activeTopicId) return classScopedProblems.filter((p) => p.topicId === activeTopicId);
    return classScopedProblems;
  }, [isUnassignedSelected, activeTopicId, unassignedProblems, classScopedProblems]);

  // Lọc bài tập theo từ khóa, độ khó, trạng thái
  const filteredProblems = useMemo(() => {
    return topicProblems.filter((prob) => {
      const matchSearch =
        prob.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prob.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (prob.author && prob.author.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchDiff = selectedDifficulty === 'ALL' || prob.difficulty === selectedDifficulty;

      const status = getProblemStatus(prob.id);
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'SOLVED' && status === 'SOLVED') ||
        (statusFilter === 'UNSOLVED' && status !== 'SOLVED');

      return matchSearch && matchDiff && matchStatus;
    });
  }, [topicProblems, searchTerm, selectedDifficulty, statusFilter, getProblemStatus]);

  // Tổng số bài và số bài giải trong lớp
  const totalClassProblems = classScopedProblems.length;
  const solvedClassProblems = useMemo(() => {
    return classScopedProblems.filter((p) => getProblemStatus(p.id) === 'SOLVED').length;
  }, [classScopedProblems, getProblemStatus]);
  const classPercent = totalClassProblems > 0 ? Math.round((solvedClassProblems / totalClassProblems) * 100) : 0;

  // ==========================================
  // VIEW 1: TRANG DANH SÁCH BÀI CỦA 1 CHỦ ĐỀ (CĐ2)
  // Khớp 100% file HTML mẫu (Danh sách bài – CĐ2)
  // ==========================================
  if (currentTopic || isUnassignedSelected) {
    const topicTitle = currentTopic ? currentTopic.name : 'Bài tập bổ sung';
    const topicDesc = currentTopic ? (currentTopic.description || 'Chưa có mô tả cho chủ đề này.') : 'Các bài tập được giao trực tiếp cho lớp.';
    const totalInTopic = topicProblems.length;
    const solvedInTopic = topicProblems.filter((p) => getProblemStatus(p.id) === 'SOLVED').length;
    const progressPercent = totalInTopic > 0 ? Math.round((solvedInTopic / totalInTopic) * 100) : 0;

    return (
      <main className="fj-w" style={{ paddingTop: 32, paddingBottom: 64 }}>
        {/* Breadcrumb */}
        <p className="fj-m" style={{ margin: '0 0 16px' }}>
          <a
            href="javascript:void(0)"
            onClick={() => {
              setActiveTopicId(null);
              setSearchTerm('');
              setSelectedDifficulty('ALL');
              setStatusFilter('ALL');
            }}
          >
            Lớp {activeClass?.className || 'CPP04'}
          </a>{' '}
          / {topicTitle}
        </p>

        {/* Header Chủ Đề & Tiến độ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32, marginBottom: 28, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 36 }}>{topicTitle}</h1>
            <p className="fj-m" style={{ margin: '8px 0 0' }}>{topicDesc}</p>
          </div>
          <div style={{ width: 260 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Đã giải {solvedInTopic}/{totalInTopic} bài</span>
              <b>{progressPercent}%</b>
            </div>
            <div className="fj-bar"><i style={{ width: `${progressPercent}%` }}></i></div>
          </div>
        </div>

        {/* Thanh tìm kiếm & bộ lọc */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
          <input
            className="fj-f"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Tìm bài theo tên hoặc mã bài"
            aria-label="Tìm bài tập"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="fj-f"
            aria-label="Độ khó"
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
          >
            <option value="ALL">Tất cả độ khó</option>
            <option value="Dễ">Dễ</option>
            <option value="Trung bình">Trung bình</option>
            <option value="Khó">Khó</option>
          </select>
          <select
            className="fj-f"
            aria-label="Trạng thái"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="SOLVED">Đã làm</option>
            <option value="UNSOLVED">Chưa làm</option>
          </select>
        </div>

        {/* Tiêu đề bảng */}
        <div className="fj-g fj-m" style={{ borderTop: '2px solid #1F1D1A', padding: '10px 0', fontSize: 13 }}>
          <span>#</span>
          <span>Tên bài</span>
          <span>Độ khó</span>
          <span>Giới hạn</span>
          <span>Điểm</span>
          <span>Trạng thái</span>
          <span></span>
        </div>

        {/* Danh sách bài tập */}
        {filteredProblems.length === 0 ? (
          <div className="fj-r fj-m" style={{ textAlign: 'center', padding: '36px 0', fontSize: 14 }}>
            Không tìm thấy bài tập nào phù hợp với bộ lọc tìm kiếm.
          </div>
        ) : (
          filteredProblems.map((prob, index) => {
            const status = getProblemStatus(prob.id);
            const userScore = getProblemScore(prob.id);
            const diffColor =
              prob.difficulty === 'Khó'
                ? '#B4281F'
                : prob.difficulty === 'Trung bình'
                ? '#D97706'
                : '#2F6B3F';

            return (
              <div className="fj-r fj-g" key={prob.id}>
                <span className="fj-mono fj-m">{index + 1}</span>
                <b
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectProblem(prob)}
                  title={prob.title}
                >
                  {prob.code || prob.title}
                </b>
                <span style={{ color: diffColor }}>{prob.difficulty}</span>
                <span className="fj-m">{prob.timeLimit} giây · {prob.memoryLimit} MB</span>
                <span className={`fj-mono ${userScore === null ? 'fj-m' : ''}`}>
                  {userScore !== null ? userScore : '–'}/{prob.totalPoints}
                </span>
                {status === 'SOLVED' ? (
                  <b style={{ color: '#2F6B3F' }}>Hoàn thành</b>
                ) : status === 'PARTIAL' ? (
                  <b style={{ color: '#D97706' }}>Đang làm ({userScore}đ)</b>
                ) : (
                  <span className="fj-m">Chưa làm</span>
                )}
                <a
                  href="javascript:void(0)"
                  onClick={() => onSelectProblem(prob)}
                  style={{ color: '#B4281F', fontWeight: 600, textAlign: 'right' }}
                >
                  Làm bài →
                </a>
              </div>
            );
          })
        )}
      </main>
    );
  }

  // ==========================================
  // VIEW 2: TRANG LỚP HỌC (CLASS OVERVIEW)
  // Khớp 100% file HTML mẫu (Trang lớp CPP04)
  // ==========================================
  const createdDateStr = activeClass?.createdAt
    ? new Date(activeClass.createdAt).toLocaleDateString('vi-VN')
    : '26/10/2026';
  const studentName = currentStudent?.fullName || 'Học sinh';

  return (
    <main className="fj-w" style={{ paddingTop: 48, paddingBottom: 64 }}>
      {/* Hero Section */}
      <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, paddingBottom: 40, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 560 }}>
          <p className="fj-m" style={{ margin: '0 0 8px' }}>
            Lớp {activeClass?.className || 'CPP04'} · tạo ngày {createdDateStr}
          </p>
          <h1 style={{ fontSize: 44, lineHeight: 1.15 }}>Xin chào, {studentName}</h1>
          <p className="fj-m" style={{ fontSize: 17, margin: '16px 0 28px' }}>
            Bạn đã giải xong {solvedClassProblems} trên {totalClassProblems} bài của lớp ({classPercent}%). Chọn một chủ đề bên dưới để làm tiếp.
          </p>
          <button
            className="fj-btn"
            onClick={() => {
              if (visibleTopics.length > 0) {
                setActiveTopicId(visibleTopics[0].id);
              } else if (unassignedProblems.length > 0) {
                setActiveTopicId('UNASSIGNED');
              }
            }}
          >
            Vào làm bài
          </button>
        </div>

        {/* Vector Illustration: Tờ giấy ghi mã nguồn, dấu tích và cây bút chì */}
        <svg viewBox="0 0 360 240" width="340" height="227" role="img" aria-label="Tờ giấy ghi mã nguồn, dấu tích và cây bút chì">
          <g transform="rotate(-3 175 119)">
            <rect x="70" y="24" width="210" height="190" rx="6" fill="#FFFDF8" stroke="#1F1D1A" strokeWidth="2.5"></rect>
            <path d="M94 62h60M110 86h90M110 110h50M94 134h70M110 158h100" stroke="#1F1D1A" strokeWidth="2.5" strokeLinecap="round" fill="none"></path>
          </g>
          <path d="M232 150l20 22 44-54" stroke="#B4281F" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round"></path>
          <g transform="rotate(35 300 190)">
            <rect x="262" y="184" width="100" height="14" fill="#E9B949" stroke="#1F1D1A" strokeWidth="2.5"></rect>
            <path d="M262 184l-18 7 18 7z" fill="#FFFDF8" stroke="#1F1D1A" strokeWidth="2.5"></path>
          </g>
        </svg>
      </section>

      {/* 2 Cột: Chủ đề & Bảng xếp hạng */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 56, borderTop: '2px solid #1F1D1A', paddingTop: 28 }}>
        {/* Cột Trái: Danh sách chủ đề */}
        <section>
          <h2 style={{ fontSize: 22 }}>Chủ đề</h2>
          <p className="fj-m" style={{ margin: '4px 0 16px' }}>
            {visibleTopics.length + (unassignedProblems.length > 0 ? 1 : 0)} chủ đề · {totalClassProblems} bài tập
          </p>

          {visibleTopics.length === 0 && unassignedProblems.length === 0 ? (
            <div className="fj-r fj-m" style={{ padding: '16px 0', fontSize: 14 }}>
              Chưa có chủ đề hoặc bài tập nào được giao cho lớp này.
            </div>
          ) : (
            <>
              {visibleTopics.map((topic) => {
                const pInTopic = classScopedProblems.filter((p) => p.topicId === topic.id);
                const sInTopic = pInTopic.filter((p) => getProblemStatus(p.id) === 'SOLVED').length;
                const percent = pInTopic.length > 0 ? Math.round((sInTopic / pInTopic.length) * 100) : 0;

                return (
                  <a
                    key={topic.id}
                    className="fj-r fj-t"
                    href="javascript:void(0)"
                    onClick={() => setActiveTopicId(topic.id)}
                  >
                    <div>
                      <b>{topic.name}</b>
                      <div className="fj-m">{sInTopic}/{pInTopic.length} bài</div>
                    </div>
                    <div className="fj-bar"><i style={{ width: `${percent}%` }}></i></div>
                    <b style={{ textAlign: 'right' }}>{percent}%</b>
                  </a>
                );
              })}

              {unassignedProblems.length > 0 && (
                <a
                  className="fj-r fj-t"
                  href="javascript:void(0)"
                  onClick={() => setActiveTopicId('UNASSIGNED')}
                >
                  <div>
                    <b>Bài tập bổ sung</b>
                    <div className="fj-m">
                      {unassignedProblems.filter((p) => getProblemStatus(p.id) === 'SOLVED').length}/{unassignedProblems.length} bài
                    </div>
                  </div>
                  <div className="fj-bar">
                    <i
                      style={{
                        width: `${Math.round(
                          (unassignedProblems.filter((p) => getProblemStatus(p.id) === 'SOLVED').length /
                            unassignedProblems.length) *
                            100
                        )}%`,
                      }}
                    ></i>
                  </div>
                  <b style={{ textAlign: 'right' }}>
                    {Math.round(
                      (unassignedProblems.filter((p) => getProblemStatus(p.id) === 'SOLVED').length /
                        unassignedProblems.length) *
                        100
                    )}%
                  </b>
                </a>
              )}
            </>
          )}
        </section>

        {/* Cột Phải: Bảng xếp hạng lớp */}
        {activeClassId && (
          <ClassLeaderboard classId={activeClassId} variant="editorial" />
        )}
      </div>
    </main>
  );
};
