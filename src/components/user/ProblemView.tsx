import React, { useState, useEffect, useMemo } from 'react';
import type { Problem, Submission } from '../../types/judge';
import { useJudge } from '../../context/JudgeContext';
import { MathRenderer } from '../common/MathRenderer';
import { ThemisGradingTable } from './ThemisGradingTable';
import { VideoSection } from './VideoSection';
import Editor from '@monaco-editor/react';
import DOMPurify from 'dompurify';
import {
  LANGUAGE_CONFIG,
  type SupportedLanguage,
} from '../../services/judgeEngine';
import { apiService } from '../../services/apiService';

interface ProblemViewProps {
  problem: Problem;
  onBackToList: () => void;
}

export const ProblemView: React.FC<ProblemViewProps> = ({ problem, onBackToList }) => {
  const {
    submitCode,
    submissions,
    isAdminAuthenticated,
    currentStudent,
    activeClass,
    topics,
    showToast,
  } = useJudge();

  const [language, setLanguage] = useState<SupportedLanguage>('cpp');
  const [code, setCode] = useState<string>(() => {
    return problem.starterCode?.cpp || LANGUAGE_CONFIG.cpp.defaultCode;
  });

  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [currentRunningIndex, setCurrentRunningIndex] = useState<number>(0);
  const [totalTestsRunning, setTotalTestsRunning] = useState<number>(problem.testCases?.length || 0);
  const [latestSubmission, setLatestSubmission] = useState<Submission | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const problemTopicName = useMemo(() => {
    if (!problem.topicId || problem.topicId === 'NONE') return 'Bài tập lớp';
    const found = topics.find((t) => t.id === problem.topicId);
    return found ? found.name : 'Bài tập lớp';
  }, [problem.topicId, topics]);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  const handleDownloadAttached = () => {
    if (!attachment?.dataUrl) return;
    const a = document.createElement('a');
    a.href = attachment.dataUrl;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Danh sách bài tập chỉ mang tên file đính kèm; nội dung (Word/PDF) được tải riêng khi mở đề
  const [attachment, setAttachment] = useState<Problem['attachedFile']>(problem.attachedFile);
  useEffect(() => {
    const f = problem.attachedFile;
    setAttachment(f);
    if (!f || f.dataUrl || f.rawHtml) return;
    let cancelled = false;
    apiService
      .fetchProblemAttachment(problem.id)
      .then((full) => {
        if (!cancelled && full) setAttachment(full);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [problem.id, problem.updatedAt, problem.attachedFile?.name]);

  // Lấy lịch sử nộp bài gần nhất của bài này (cho đúng học sinh đang đăng nhập)
  useEffect(() => {
    let isMounted = true;
    const existing = submissions.find((s) => {
      if (s.problemId !== problem.id) return false;
      if (isAdminAuthenticated) return true;
      if (!currentStudent) return false;
      return (
        (s.userId && (
          s.userId.toLowerCase() === currentStudent.username.toLowerCase() ||
          s.userId === currentStudent.id
        )) ||
        (s.userName && s.userName.trim().toLowerCase() === currentStudent.fullName.trim().toLowerCase())
      );
    });

    if (existing) {
      setLatestSubmission((prev) => {
        if (
          prev &&
          prev.id === existing.id &&
          prev.testResults &&
          prev.testResults.length > 0 &&
          (!existing.testResults || existing.testResults.length === 0)
        ) {
          return { ...existing, testResults: prev.testResults };
        }
        return existing;
      });

      if ((!existing.testResults || existing.testResults.length === 0) && existing.id) {
        apiService.fetchSubmissionById(existing.id).then((full) => {
          if (isMounted && full?.testResults && full.testResults.length > 0) {
            setLatestSubmission((prev) =>
              prev?.id === existing.id ? { ...prev, testResults: full.testResults } : prev
            );
          }
        }).catch(() => {});
      }
    } else {
      setLatestSubmission(null);
    }

    return () => {
      isMounted = false;
    };
  }, [problem.id, submissions, isAdminAuthenticated, currentStudent]);

  // Cập nhật code khi chuyển đổi ngôn ngữ
  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    const starter = problem.starterCode?.[newLang];
    if (starter) {
      setCode(starter);
    } else {
      setCode(LANGUAGE_CONFIG[newLang].defaultCode);
    }
  };

  // Reset về template mặc định
  const handleResetCode = () => {
    if (confirm('Khôi phục code về khung mẫu mặc định ban đầu?')) {
      const starter = problem.starterCode?.[language];
      setCode(starter || LANGUAGE_CONFIG[language].defaultCode);
    }
  };

  // Đồng bộ số lượng test cases từ metadata đề bài (đã tải phân trang đầy đủ từ Cloud)
  useEffect(() => {
    if (problem.testCases && problem.testCases.length > 0) {
      setTotalTestsRunning(problem.testCases.length);
    }
  }, [problem.id, problem.testCases?.length]);

  // Nộp bài và chạy chấm điểm Themis
  const handleSubmit = async () => {
    if (isGrading) return;
    setIsGrading(true);
    setCurrentRunningIndex(1);
    const initialTests = Math.max(problem.testCases?.length || 0, totalTestsRunning || 0);
    setTotalTestsRunning(initialTests);

    try {
      const sub = await submitCode(
        problem.id,
        code,
        language,
        (currentIdx: number, totalTests?: number) => {
          setCurrentRunningIndex(currentIdx);
          if (totalTests && totalTests > 0) {
            setTotalTestsRunning(totalTests);
          }
        }
      );
      setLatestSubmission(sub);
      if (sub.totalTests > 0) {
        setTotalTestsRunning(sub.totalTests);
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = (err as Error)?.message || 'Có lỗi xảy ra khi nộp bài hoặc lưu vào cơ sở dữ liệu';
      showToast('Lỗi nộp bài', msg, 'error');
    } finally {
      setIsGrading(false);
    }
  };

  const studentProblemSubs = submissions.filter((s) => {
    if (s.problemId !== problem.id) return false;
    if (isAdminAuthenticated) return true;
    if (!currentStudent) return false;
    return (
      (s.userId && s.userId.toLowerCase() === currentStudent.username.toLowerCase()) ||
      (s.userName && s.userName.trim().toLowerCase() === currentStudent.fullName.trim().toLowerCase())
    );
  });
  const hasSubmitted = studentProblemSubs.length > 0;
  const isFullScore = studentProblemSubs.some(
    (s) => s.passedCount === s.totalTests && s.totalTests > 0
  );

  return (
    <main className="fj-w" style={{ paddingTop: 32, paddingBottom: 64 }}>
      {/* Breadcrumb */}
      <p className="fj-m" style={{ margin: '0 0 16px' }}>
        <a href="javascript:void(0)" onClick={onBackToList}>
          Lớp {activeClass?.className || 'CPP04'}
        </a>{' '}
        /{' '}
        <a href="javascript:void(0)" onClick={onBackToList}>
          {problemTopicName}
        </a>{' '}
        / {problem.code || problem.title}
      </p>

      {/* Tiêu đề & Giới hạn bài */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ fontSize: 36 }}>{problem.code || problem.title}</h1>
        <p className="fj-m" style={{ margin: 0 }}>
          {problem.difficulty} · {problem.timeLimit} giây · {problem.memoryLimit} MB · {problem.totalPoints} điểm
        </p>
      </div>

      {/* 2 Cột: Đề bài (trái) và Soạn thảo/Chấm (phải) */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 40, alignItems: 'start' }} className="grid-cols-1 md:grid-cols-[320px_1fr]">
        {/* CỘT TRÁI: ĐỀ BÀI */}
        <aside style={{ borderTop: '2px solid #1F1D1A', paddingTop: 16 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Đề bài</h2>

          {/* Đính kèm file tài liệu gốc nếu có */}
          {attachment ? (
            <div style={{ marginBottom: 16 }}>
              <button
                type="button"
                className="fj-btn"
                style={{ padding: '8px 14px', fontSize: 13, marginBottom: 12, width: '100%' }}
                onClick={handleDownloadAttached}
                disabled={!attachment.dataUrl}
              >
                {attachment.dataUrl ? `Tải file gốc (${attachment.name})` : `Đang tải file gốc (${attachment.name})...`}
              </button>
              {attachment.type === 'docx' && attachment.rawHtml ? (
                <div
                  className="prose max-w-none text-sm text-[#1F1D1A] leading-relaxed font-sans"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(attachment.rawHtml) }}
                />
              ) : (
                <MathRenderer content={problem.description || ''} />
              )}
            </div>
          ) : (
            <div style={{ fontSize: 14, lineHeight: 1.6, color: '#1F1D1A', marginBottom: 20 }}>
              {problem.description ? (
                <MathRenderer content={problem.description} />
              ) : (
                <p className="fj-m" style={{ margin: 0 }}>Chưa có mô tả cho bài này.</p>
              )}
            </div>
          )}

          {/* Ví dụ mẫu (Sample Tests) */}
          {problem.samples && problem.samples.length > 0 && (
            <div style={{ marginTop: 24, borderTop: '1px solid #D9D2C3', paddingTop: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Ví dụ mẫu</h3>
              {problem.samples.map((sample, idx) => (
                <div key={sample.id || idx} style={{ marginBottom: 16, background: '#FFFDF8', border: '1px solid #D9D2C3', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6B655C' }}>Input</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(sample.input, `in-${idx}`)}
                      style={{ background: 'none', border: 'none', color: copiedKey === `in-${idx}` ? '#2F6B3F' : '#B4281F', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                    >
                      {copiedKey === `in-${idx}` ? 'Đã chép!' : 'Sao chép'}
                    </button>
                  </div>
                  <pre className="fj-mono" style={{ background: '#F4F0E8', padding: 8, borderRadius: 6, fontSize: 13, margin: '0 0 10px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                    {sample.input || ' '}
                  </pre>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6B655C' }}>Output</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(sample.output, `out-${idx}`)}
                      style={{ background: 'none', border: 'none', color: copiedKey === `out-${idx}` ? '#2F6B3F' : '#B4281F', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                    >
                      {copiedKey === `out-${idx}` ? 'Đã chép!' : 'Sao chép'}
                    </button>
                  </div>
                  <pre className="fj-mono" style={{ background: '#F4F0E8', padding: 8, borderRadius: 6, fontSize: 13, margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                    {sample.output || ' '}
                  </pre>

                  {sample.explanation && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#6B655C', borderTop: '1px dashed #D9D2C3', paddingTop: 6 }}>
                      <b>Giải thích: </b> <MathRenderer content={sample.explanation} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Video hướng dẫn nếu có */}
          {problem.videoConfig && (
            <div style={{ marginTop: 20 }}>
              <VideoSection
                videoConfig={problem.videoConfig}
                hasSubmitted={hasSubmitted}
                isFullScore={isFullScore}
              />
            </div>
          )}
        </aside>

        {/* CỘT PHẢI: TRÌNH SOẠN THẢO CODE & KẾT QUẢ CHẤM */}
        <div>
          {/* Hộp soạn code */}
          <div style={{ border: '1px solid #D9D2C3', borderRadius: 8, overflow: 'hidden' }}>
            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#FFFDF8' }}>
              <select
                className="fj-f"
                aria-label="Ngôn ngữ"
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
              >
                <option value="cpp">C++ (G++ 10.2 / 17)</option>
                <option value="python">Python 3</option>
                <option value="pascal">Pascal</option>
              </select>
              <button
                type="button"
                className="fj-m"
                onClick={handleResetCode}
                style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}
              >
                Khôi phục mẫu
              </button>
            </div>

            {/* Trình soạn Monaco Editor nền #23201C */}
            <div style={{ background: '#23201C', padding: '6px 0' }}>
              <Editor
                height="420px"
                language={language === 'cpp' ? 'cpp' : language === 'python' ? 'python' : 'pascal'}
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || '')}
                options={{
                  fontSize: 14,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontLigatures: false,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  roundedSelection: true,
                  padding: { top: 12, bottom: 12 },
                  tabSize: 4,
                  automaticLayout: true,
                }}
              />
            </div>

            {/* Bottom Toolbar & Nút Nộp bài */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 16px', background: '#FFFDF8', flexWrap: 'wrap' }}>
              <span className="fj-m" style={{ fontSize: 13 }}>
                Hệ thống tự hỗ trợ đọc/ghi file kiểu Themis (freopen).
              </span>
              <button
                className="fj-btn"
                onClick={handleSubmit}
                disabled={isGrading}
              >
                {isGrading ? `Đang chấm test ${currentRunningIndex}/${totalTestsRunning}...` : 'Nộp bài'}
              </button>
            </div>
          </div>

          {/* Vùng Kết quả chấm bài */}
          {!latestSubmission && !isGrading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 24, padding: '20px 24px', border: '1.5px dashed #BDB5A3', borderRadius: 8, background: '#FFFDF8' }}>
              <svg viewBox="60 14 230 210" width="96" height="88" aria-hidden="true">
                <g transform="rotate(-3 175 119)">
                  <rect x="70" y="24" width="210" height="190" rx="6" fill="#FFFDF8" stroke="#1F1D1A" strokeWidth="5"></rect>
                  <path d="M94 62h60M110 86h90M110 110h50M94 134h70M110 158h100" stroke="#1F1D1A" strokeWidth="5" strokeLinecap="round" fill="none"></path>
                </g>
              </svg>
              <div>
                <b style={{ fontSize: 16 }}>Chưa có kết quả chấm</b>
                <p className="fj-m" style={{ margin: '4px 0 0', fontSize: 14 }}>
                  Soạn hoặc dán code rồi nhấn “Nộp bài”. Kết quả từng test sẽ hiện ở đây.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 24 }}>
              <ThemisGradingTable
                submission={latestSubmission}
                isGrading={isGrading}
                currentRunningIndex={currentRunningIndex}
                totalTestsToRun={totalTestsRunning}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
