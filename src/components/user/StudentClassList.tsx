import React, { useState, useMemo, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Classroom } from '../../types/judge';
import { isProblemInClass } from '../../types/judge';
import {
  Plus,
  X,
  KeyRound,
  LogOut,
} from 'lucide-react';

export const StudentClassList: React.FC = () => {
  const {
    classes,
    studentClasses,
    pendingClasses,
    setActiveClassId,
    joinClassByCode,
    currentStudent,
    problems,
    topics,
    getProblemStatus,
    refreshAllData,
    showToast,
    leaveClass,
    openConfirmModal,
  } = useJudge();

  useEffect(() => {
    refreshAllData();
    const interval = setInterval(() => {
      refreshAllData().catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLeaveClass = (e: React.MouseEvent, cls: Classroom) => {
    e.stopPropagation();
    openConfirmModal({
      title: 'Rời khỏi lớp học',
      message: `Em có chắc chắn muốn rời khỏi lớp "${cls.className}"? Em sẽ cần nhập lại mã mời nếu muốn tham gia lại lớp này sau.`,
      confirmLabel: 'Xác nhận rời lớp',
      onConfirm: () => {
        leaveClass(cls.id);
      },
    });
  };

  const totalSolvedCount = useMemo(() => {
    const candidateProblemIds = new Set<string>();
    if (studentClasses.length > 0) {
      studentClasses.forEach((cls) => {
        problems.forEach((p) => {
          if (isProblemInClass(p, cls.id, topics, classes)) {
            candidateProblemIds.add(p.id);
          }
        });
      });
    } else {
      problems.forEach((p) => candidateProblemIds.add(p.id));
    }

    let count = 0;
    candidateProblemIds.forEach((pid) => {
      if (getProblemStatus(pid) === 'SOLVED') {
        count++;
      }
    });

    problems.forEach((p) => {
      if (!candidateProblemIds.has(p.id) && getProblemStatus(p.id) === 'SOLVED') {
        count++;
      }
    });

    return count;
  }, [studentClasses, problems, topics, getProblemStatus]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await joinClassByCode(joinCodeInput.trim());
      if (res.success) {
        setIsJoinModalOpen(false);
        setJoinCodeInput('');
        if (res.classroom && !res.pending) {
          setActiveClassId(res.classroom.id);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fj-w" style={{ paddingTop: 32, paddingBottom: 64 }}>
      {/* Header & Chào mừng */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <p className="fj-m" style={{ margin: '0 0 8px' }}>
            Xin chào, {currentStudent?.fullName || 'Học sinh'}
          </p>
          <h1 style={{ fontSize: 36 }}>Lớp học của tôi</h1>
          <p className="fj-m" style={{ margin: '8px 0 0' }}>
            Chọn lớp học bên dưới để xem chủ đề bài tập, nộp code chuẩn Themis và theo dõi kết quả chấm.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: '8px 16px', background: '#FFFDF8', border: '1px solid #D9D2C3', borderRadius: 8, textAlign: 'center' }}>
            <div className="fj-mono" style={{ fontSize: 18, fontWeight: 700, color: '#2F6B3F' }}>
              {totalSolvedCount}
            </div>
            <div className="fj-m" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
              Bài Full AC
            </div>
          </div>

          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="fj-btn"
          >
            <Plus style={{ width: 16, height: 16 }} />
            <span>Tham gia lớp học</span>
          </button>
        </div>
      </div>

      {/* Mục Lớp Đang Chờ Giáo Viên Phê Duyệt */}
      {pendingClasses.length > 0 && (
        <div style={{ marginBottom: 32, padding: 16, background: '#FFFDF8', border: '1px solid #D9D2C3', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>
              ⏳ Yêu cầu chờ giáo viên duyệt ({pendingClasses.length})
            </h3>
            <span className="fj-m" style={{ fontSize: 12 }}>
              Giáo viên sẽ duyệt mã lớp để em vào học
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {pendingClasses.map((cls) => (
              <div
                key={cls.id}
                onClick={() => {
                  showToast(
                    'Đang chờ duyệt',
                    `Yêu cầu tham gia lớp "${cls.className}" đang chờ giáo viên phê duyệt. Em hãy nhắc thầy/cô duyệt vào lớp nhé!`,
                    'info'
                  );
                }}
                style={{ padding: 12, background: '#F4F0E8', border: '1px solid #D9D2C3', borderRadius: 6, cursor: 'pointer' }}
              >
                <b>{cls.className}</b>
                <p className="fj-m" style={{ fontSize: 12, margin: '4px 0 0' }}>
                  Mã lớp: <span className="fj-mono" style={{ color: '#B4281F', fontWeight: 700 }}>{cls.joinCode}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danh sách lớp học */}
      <div style={{ borderTop: '2px solid #1F1D1A', paddingTop: 20 }}>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>
          Các lớp đang tham gia ({studentClasses.length})
        </h2>

        {studentClasses.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', background: '#FFFDF8', border: '1px dashed #D9D2C3', borderRadius: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Em chưa tham gia lớp học nào</h3>
            <p className="fj-m" style={{ fontSize: 14, maxWidth: 460, margin: '0 auto 20px' }}>
              Hãy hỏi giáo viên để nhận mã lớp học (6 ký tự) rồi bấm nút bên dưới để tham gia vào lớp.
            </p>
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="fj-btn"
            >
              <KeyRound style={{ width: 16, height: 16 }} />
              <span>Nhập mã lớp để vào học</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {studentClasses.map((cls: Classroom) => {
              const classProblems = problems.filter((p) => isProblemInClass(p, cls.id, topics, classes));
              const totalProblems = classProblems.length;
              const solvedInClass = classProblems.filter((p) => getProblemStatus(p.id) === 'SOLVED').length;
              const percent = totalProblems > 0 ? Math.round((solvedInClass / totalProblems) * 100) : 0;

              return (
                <div
                  key={cls.id}
                  onClick={() => setActiveClassId(cls.id)}
                  style={{
                    background: '#FFFDF8',
                    border: '1px solid #D9D2C3',
                    borderRadius: 8,
                    padding: 20,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#B4281F')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#D9D2C3')}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                        {cls.className}
                      </h3>
                      <button
                        type="button"
                        onClick={(e) => handleLeaveClass(e, cls)}
                        style={{ background: 'none', border: 'none', color: '#6B655C', cursor: 'pointer', padding: 4 }}
                        title="Rời khỏi lớp này"
                      >
                        <LogOut style={{ width: 14, height: 14 }} />
                      </button>
                    </div>

                    <p className="fj-m" style={{ fontSize: 13, marginBottom: 16, minHeight: 38 }}>
                      {cls.description || 'Chưa có mô tả cho lớp học này.'}
                    </p>

                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                        <span className="fj-m">Tiến độ bài tập:</span>
                        <b className="fj-mono">{solvedInClass}/{totalProblems} ({percent}%)</b>
                      </div>
                      <div className="fj-bar"><i style={{ width: `${percent}%` }}></i></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E4DDCE', paddingTop: 12, fontSize: 13 }}>
                    <span className="fj-m">{totalProblems} bài tập</span>
                    <b style={{ color: '#B4281F' }}>Vào làm bài →</b>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Nhập Mã Tham Gia Lớp */}
      {isJoinModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: '#FFFDF8', border: '1px solid #D9D2C3', borderRadius: 8, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid #D9D2C3' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Tham gia Lớp học mới</h3>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B655C' }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleJoinClass} style={{ marginTop: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Nhập mã tham gia lớp (6 ký tự):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="VÍ DỤ: ABCXYZ"
                  className="fj-f fj-mono"
                  style={{ width: '100%', textAlign: 'center', letterSpacing: '0.2em', fontSize: 24, fontWeight: 700, color: '#B4281F' }}
                  autoFocus
                  required
                />
                <p className="fj-m" style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                  Mã lớp gồm 6 ký tự do giáo viên cung cấp.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid #D9D2C3' }}>
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  style={{ padding: '10px 16px', background: 'none', border: '1px solid #D9D2C3', borderRadius: 8, cursor: 'pointer', font: 'inherit' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!joinCodeInput.trim() || isSubmitting}
                  className="fj-btn"
                >
                  {isSubmitting ? 'Đang kiểm tra...' : 'Vào lớp ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
