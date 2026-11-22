import React, { useState, useMemo, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Classroom, HomeBanner, Problem } from '../../types/judge';
import { isProblemInClass } from '../../types/judge';
import {
  Plus,
  X,
  KeyRound,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface StudentClassListProps {
  onSelectProblem?: (problem: Problem) => void;
}

function getLocalTodayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeSafeExternalUrl(raw?: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const StudentClassList: React.FC<StudentClassListProps> = ({ onSelectProblem }) => {
  const {
    classes,
    studentClasses,
    pendingClasses,
    setActiveClassId,
    joinClassByCode,
    currentStudent,
    problems,
    topics,
    homeBanners,
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
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [isBannerHovered, setIsBannerHovered] = useState(false);

  // Lọc các banner hợp lệ để hiển thị cho học sinh hiện tại
  const visibleBanners = useMemo(() => {
    const today = getLocalTodayIso();
    const enrolledIds = new Set(studentClasses.map((c) => c.id));
    return [...homeBanners]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .filter((b) => {
        if (!b.isActive) return false;
        if (b.startDate && today < b.startDate) return false;
        if (b.endDate && today > b.endDate) return false;
        if (b.audienceClassId && b.audienceClassId !== 'ALL') {
          return enrolledIds.has(b.audienceClassId);
        }
        return true;
      });
  }, [homeBanners, studentClasses]);

  useEffect(() => {
    if (activeBannerIdx >= visibleBanners.length && visibleBanners.length > 0) {
      setActiveBannerIdx(0);
    }
  }, [visibleBanners.length, activeBannerIdx]);

  useEffect(() => {
    if (visibleBanners.length <= 1 || isBannerHovered) return;
    const timer = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % visibleBanners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [visibleBanners.length, isBannerHovered]);

  const handleBannerClick = (banner: HomeBanner) => {
    if (banner.linkType === 'none') return;

    if (banner.linkType === 'external') {
      const safeUrl = normalizeSafeExternalUrl(banner.externalUrl);
      if (safeUrl) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    if (banner.linkType === 'internal') {
      if (banner.targetProblemId) {
        const targetProb = problems.find((p) => p.id === banner.targetProblemId);
        if (targetProb) {
          const matchingEnrolled = studentClasses.find((cls) =>
            isProblemInClass(targetProb, cls.id, topics, classes)
          );
          const fallbackClassId =
            matchingEnrolled?.id ||
            (targetProb.classId && targetProb.classId !== 'NONE' && targetProb.classId !== 'ALL'
              ? targetProb.classId
              : studentClasses[0]?.id);
          if (fallbackClassId) {
            setActiveClassId(fallbackClassId);
          }
          onSelectProblem?.(targetProb);
          return;
        }
      }

      if (banner.targetClassId) {
        const isEnrolled = studentClasses.some((c) => c.id === banner.targetClassId);
        if (isEnrolled) {
          setActiveClassId(banner.targetClassId);
        } else {
          const targetCls = classes.find((c) => c.id === banner.targetClassId);
          showToast(
            'Chưa tham gia lớp học',
            targetCls
              ? `Em chưa vào lớp "${targetCls.className}". Hãy bấm "+ Tham gia lớp học" và nhập mã lớp do thầy/cô cung cấp nhé!`
              : 'Lớp học này hiện chưa mở cho tài khoản của em.',
            'info'
          );
          setIsJoinModalOpen(true);
        }
      }
    }
  };

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

  const currentBanner = visibleBanners[activeBannerIdx] || visibleBanners[0] || null;
  const currentBannerClassProblemsCount = useMemo(() => {
    if (!currentBanner || currentBanner.linkType !== 'internal' || !currentBanner.targetClassId) {
      return null;
    }
    return problems.filter((p) => isProblemInClass(p, currentBanner.targetClassId, topics, classes)).length;
  }, [currentBanner, problems, topics, classes]);

  return (
    <div className="fj-w" style={{ paddingTop: 32, paddingBottom: 64 }}>
      {/* Header & Chào mừng */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <p className="fj-m" style={{ margin: '0 0 8px' }}>
            Xin chào, {currentStudent?.fullName || 'Học sinh'}
          </p>
          <h1 style={{ fontSize: 36 }}>Lớp học của tôi</h1>
          <p className="fj-m" style={{ margin: '8px 0 0', maxWidth: 520, lineHeight: 1.55 }}>
            Chọn lớp học bên dưới để xem chủ đề bài tập, nộp code chuẩn Themis và theo dõi kết quả chấm.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="fj-mono" style={{ fontSize: 28, fontWeight: 700, color: '#2F6B3F', lineHeight: 1.1 }}>
              {totalSolvedCount}
            </div>
            <div className="fj-m" style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>
              bài Full AC
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

      {/* Banner trang chủ (Carousel tự xoay khi có nhiều banner) */}
      {currentBanner && (
        <div
          onMouseEnter={() => setIsBannerHovered(true)}
          onMouseLeave={() => setIsBannerHovered(false)}
          onClick={() => handleBannerClick(currentBanner)}
          role={currentBanner.linkType !== 'none' ? 'button' : undefined}
          tabIndex={currentBanner.linkType !== 'none' ? 0 : undefined}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && currentBanner.linkType !== 'none') {
              e.preventDefault();
              handleBannerClick(currentBanner);
            }
          }}
          aria-label={currentBanner.title}
          style={{
            position: 'relative',
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 28,
            background: '#191715',
            cursor: currentBanner.linkType !== 'none' ? 'pointer' : 'default',
            minHeight: 196,
            boxShadow: '0 2px 12px rgba(31, 29, 26, 0.08)',
          }}
        >
          {currentBanner.imageUrl ? (
            <div
              style={{
                width: '100%',
                aspectRatio: '24 / 5',
                minHeight: 185,
                maxHeight: 260,
                position: 'relative',
                background: '#191715',
              }}
            >
              <img
                src={currentBanner.imageUrl}
                alt={currentBanner.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  display: 'block',
                }}
              />
            </div>
          ) : (
            <div
              style={{
                padding: '32px 44px 40px',
                minHeight: 218,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 28,
                color: '#FFFFFF',
                background: '#191715',
              }}
            >
              <div style={{ minWidth: 0, maxWidth: 640 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#E57368', marginBottom: 8 }}>
                  {currentBanner.linkType === 'external' ? 'Thông báo' : 'Bộ đề mới'}
                </div>
                <h2
                  style={{
                    fontSize: 'clamp(22px, 3vw, 34px)',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    margin: 0,
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {currentBanner.title}
                </h2>
                <p
                  style={{
                    fontSize: 14.5,
                    color: '#B8B1A6',
                    margin: '10px 0 0',
                    lineHeight: 1.5,
                  }}
                >
                  {currentBannerClassProblemsCount !== null
                    ? `${currentBannerClassProblemsCount} bài tập · làm trực tiếp trên web · chấm tự động chuẩn Themis`
                    : currentBanner.linkType === 'external' && currentBanner.externalUrl
                    ? currentBanner.externalUrl.replace(/^https?:\/\//i, '')
                    : 'Luyện tập trực tiếp trên FAMINH Judge'}
                </p>

                {currentBanner.linkType !== 'none' && (
                  <div style={{ marginTop: 20 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#B4281F',
                        color: '#FFFFFF',
                        padding: '10px 18px',
                        borderRadius: 8,
                        fontSize: 13.5,
                        fontWeight: 600,
                      }}
                    >
                      {currentBanner.linkType === 'external' ? 'Mở liên kết →' : 'Xem các đề →'}
                    </span>
                  </div>
                )}
              </div>

              <svg
                viewBox="0 0 64 64"
                fill="none"
                style={{ width: 120, height: 120, color: '#EFECE6', flexShrink: 0 }}
                className="hidden sm:block"
                aria-hidden="true"
              >
                <path
                  d="M32 6L55 19V45L32 58L9 45V19L32 6Z"
                  stroke="currentColor"
                  strokeWidth="4.5"
                  strokeLinejoin="round"
                />
                <path d="M32 32V58M32 32L55 19M32 32L9 19" stroke="currentColor" strokeWidth="4.5" strokeLinejoin="round" />
                <path d="M20 26L32 33L44 26" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {/* Chấm phân trang góc dưới trái (khi có > 1 banner) */}
          {visibleBanners.length > 1 && (
            <>
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: 24,
                  bottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: 'rgba(25, 23, 21, 0.45)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {visibleBanners.map((b, idx) => (
                  <button
                    key={b.id}
                    type="button"
                    aria-label={`Xem banner ${idx + 1}: ${b.title}`}
                    onClick={() => setActiveBannerIdx(idx)}
                    style={{
                      width: idx === activeBannerIdx ? 9 : 7,
                      height: idx === activeBannerIdx ? 9 : 7,
                      borderRadius: '50%',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      background: idx === activeBannerIdx ? '#FFFFFF' : 'rgba(255,255,255,0.42)',
                      transition: 'all 0.2s ease',
                    }}
                  />
                ))}
              </div>

              {/* Nút chuyển trái / phải nhẹ khi hover */}
              {isBannerHovered && (
                <>
                  <button
                    type="button"
                    aria-label="Banner trước"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBannerIdx((prev) => (prev - 1 + visibleBanners.length) % visibleBanners.length);
                    }}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(25, 23, 21, 0.6)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronLeft style={{ width: 18, height: 18 }} />
                  </button>
                  <button
                    type="button"
                    aria-label="Banner tiếp theo"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBannerIdx((prev) => (prev + 1) % visibleBanners.length);
                    }}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(25, 23, 21, 0.6)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronRight style={{ width: 18, height: 18 }} />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

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
                        style={{ background: 'none', border: 'none', color: '#6B655C', cursor: 'pointer', padding: '2px 4px', fontSize: 12.5, fontWeight: 500 }}
                        title="Rời khỏi lớp này"
                      >
                        Rời lớp
                      </button>
                    </div>

                    <p className="fj-m" style={{ fontSize: 13, marginBottom: 16, minHeight: 38 }}>
                      {cls.description || 'Chưa có mô tả cho lớp học này.'}
                    </p>

                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                        <span className="fj-m">Tiến độ bài tập</span>
                        <b className="fj-mono">{solvedInClass}/{totalProblems} ({percent}%)</b>
                      </div>
                      <div className="fj-bar">
                        <i
                          style={{
                            width: `${percent}%`,
                            background: percent === 100 && totalProblems > 0 ? '#2F6B3F' : '#B4281F',
                          }}
                        ></i>
                      </div>
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
