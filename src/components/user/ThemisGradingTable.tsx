import React, { useState } from 'react';
import type { Submission, TestResult, Verdict } from '../../types/judge';

interface ThemisGradingTableProps {
  submission: Submission | null;
  isGrading: boolean;
  currentRunningIndex?: number;
  totalTestsToRun?: number;
  showDetails?: boolean;
}

export const ThemisGradingTable: React.FC<ThemisGradingTableProps> = ({
  submission,
  isGrading,
  currentRunningIndex = 0,
  totalTestsToRun = 0,
  showDetails,
}) => {
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const canViewDetails = showDetails !== false;

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  const formatPoint = (val: number) => {
    const num = typeof val === 'number' && !isNaN(val) ? val : 0;
    const rounded = Number(num.toFixed(2));
    return Number.isInteger(rounded) ? rounded.toFixed(1) : rounded.toString();
  };

  const formatTime = (val?: number) => {
    if (typeof val !== 'number' || isNaN(val) || val <= 0) return '0.005';
    return val.toFixed(3);
  };

  const formatMemory = (val?: number) => {
    if (typeof val !== 'number' || isNaN(val) || val <= 0) return '1.0';
    return val.toFixed(1);
  };

  const formatLanguage = (lang?: string) => {
    if (!lang) return 'C++ (CPP)';
    const l = lang.toLowerCase();
    if (l.includes('cpp') || l.includes('c++')) return 'C++ (CPP)';
    if (l.includes('py')) return 'Python 3 (PY3)';
    if (l.includes('pas')) return 'Pascal (PAS)';
    return lang.toUpperCase();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '00:35:37, 11/11/2026';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const timePart = d.toLocaleTimeString('vi-VN', { hour12: false });
      const datePart = d.toLocaleDateString('vi-VN');
      return `${timePart}, ${datePart}`;
    } catch {
      return dateStr;
    }
  };

  // Trạng thái đang chấm điểm Themis
  if (isGrading) {
    const isPendingQueue = currentRunningIndex === 0;
    const displayTotal = Math.max(totalTestsToRun || 0, currentRunningIndex, 1);
    const percent = isPendingQueue ? 15 : (displayTotal > 0 ? Math.round((currentRunningIndex / displayTotal) * 100) : 50);
    return (
      <div style={{ padding: '24px', background: '#FFFDF8', border: '1px solid #D9D2C3', borderRadius: 8, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <b style={{ color: '#B4281F', fontSize: 16 }}>
            {isPendingQueue
              ? 'Đã tiếp nhận bài nộp · Đang trong hàng đợi máy chấm...'
              : `Đang chấm bài theo cơ chế Themis... (Test #${currentRunningIndex} / ${displayTotal})`}
          </b>
          <span className="fj-mono" style={{ fontSize: 14, fontWeight: 700, color: '#B4281F' }}>
            {isPendingQueue ? 'Đang xếp hàng' : `${percent}% Hoàn tất`}
          </span>
        </div>
        <div className="fj-bar" style={{ height: 8 }}>
          <i style={{ width: `${percent}%`, height: 8, transition: 'width 0.3s ease' }}></i>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
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
    );
  }

  // Chuẩn hóa danh sách Test Results
  let testResultsList: TestResult[] = [];
  if (Array.isArray(submission.testResults)) {
    testResultsList = submission.testResults;
  } else if (typeof submission.testResults === 'string' && (submission.testResults as string).trim()) {
    try {
      const parsed = JSON.parse(submission.testResults);
      if (Array.isArray(parsed)) testResultsList = parsed;
    } catch {}
  }

  if (testResultsList.length === 0 && submission.totalTests > 0) {
    const total = submission.totalTests;
    const passed = submission.passedCount || 0;
    const maxPts = submission.maxTotalPoints || 10;
    const ptsPerTest = +(maxPts / total).toFixed(2);
    testResultsList = Array.from({ length: total }, (_, i) => {
      const isTestPassed = i < passed;
      return {
        testId: `test_synth_${i + 1}`,
        testName: `Test ${String(i + 1).padStart(2, '0')}`,
        verdict: isTestPassed ? ('AC' as Verdict) : (submission.overallVerdict || 'WA'),
        time: typeof submission.executionTime === 'number' && submission.executionTime > 0 ? +(submission.executionTime).toFixed(3) : 0.005,
        memory: typeof submission.memory === 'number' && submission.memory > 0 ? +(submission.memory).toFixed(1) : 0.9,
        pointsEarned: isTestPassed ? ptsPerTest : 0,
        maxPoints: ptsPerTest,
        errorMessage: isTestPassed ? undefined : 'Kết quả không khớp với đáp án mẫu',
      };
    });
  }

  const isFullAC = submission.passedCount === submission.totalTests && submission.totalTests > 0;
  const isZero = submission.passedCount === 0;

  const earnedPoints = formatPoint(submission.totalPointsEarned);
  const maxPoints = formatPoint(submission.maxTotalPoints || 10);
  const problemCode = submission.problemCode || submission.problemTitle || 'BÀI TẬP';

  const toggleExpand = (id: string) => {
    setExpandedTestId((curr) => (curr === id ? null : id));
  };

  return (
    <div style={{ marginTop: 32, color: '#1F1D1A' }}>
      {/* Tiêu đề Kết quả chấm */}
      <h2 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 24px', letterSpacing: '-0.02em' }}>
        Kết quả chấm · {problemCode}
      </h2>

      {/* Bố cục 2 cột chuẩn thiết kế mới */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '270px 1fr',
          gap: 48,
          borderTop: '2px solid #1F1D1A',
          paddingTop: 24,
          alignItems: 'start',
        }}
        className="grid-cols-1 md:grid-cols-[270px_1fr]"
      >
        {/* CỘT TRÁI: ĐIỂM SỐ & THÔNG TIN TỔNG QUAN */}
        <div>
          <div className="fj-m" style={{ fontSize: 13, marginBottom: 8 }}>
            Điểm bài nộp
          </div>

          {/* Dấu chấm điểm oval đỏ phong cách viết tay */}
          <div style={{ margin: '4px 0 2px' }}>
            <svg viewBox="0 0 170 74" width="170" height="74" style={{ overflow: 'visible' }}>
              <g transform="rotate(-3 85 37)">
                {/* Vòng oval nét đỏ viết tay */}
                <path
                  d="M 18 37 C 16 16, 52 10, 88 10 C 130 10, 158 18, 156 38 C 154 58, 122 66, 80 66 C 36 66, 14 54, 18 37"
                  fill="none"
                  stroke="#B4281F"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text
                  x="85"
                  y="47"
                  textAnchor="middle"
                  fill="#B4281F"
                  fontSize="28"
                  fontWeight="700"
                  fontFamily="'Be Vietnam Pro', sans-serif"
                >
                  {earnedPoints}/{maxPoints}
                </text>
              </g>
            </svg>
          </div>

          {/* Chữ nhận xét dưới con dấu điểm */}
          <div style={{ margin: '2px 0 20px' }}>
            {isFullAC ? (
              <p style={{ color: '#B4281F', fontWeight: 700, fontSize: 16, margin: 0, fontStyle: 'italic' }}>
                Đạt điểm tối đa!
              </p>
            ) : isZero ? (
              <p style={{ color: '#B4281F', fontWeight: 700, fontSize: 15, margin: 0 }}>
                Chưa đạt điểm!
              </p>
            ) : (
              <p style={{ color: '#D97706', fontWeight: 700, fontSize: 15, margin: 0 }}>
                Đạt {earnedPoints}/{maxPoints} điểm
              </p>
            )}
          </div>

          {/* Bảng Metadata thông tin chi tiết */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #D9D2C3', fontSize: 13 }}>
              <span className="fj-m">Bài tập</span>
              <b className="fj-mono">{problemCode}</b>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #D9D2C3', fontSize: 13 }}>
              <span className="fj-m">Ngôn ngữ</span>
              <b className="fj-mono">{formatLanguage(submission.language)}</b>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #D9D2C3', fontSize: 13 }}>
              <span className="fj-m">Nộp lúc</span>
              <span className="fj-mono">{formatDate(submission.submittedAt)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #D9D2C3', fontSize: 13 }}>
              <span className="fj-m">Thời gian chạy</span>
              <span className="fj-mono">{formatTime(submission.executionTime)}s</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #D9D2C3', fontSize: 13 }}>
              <span className="fj-m">Số test đúng</span>
              <b className="fj-mono">{submission.passedCount} / {submission.totalTests}</b>
            </div>
          </div>

          {/* Phần Từng test (Lưới các ô số màu xanh/đỏ) */}
          <div style={{ marginTop: 20 }}>
            <p className="fj-m" style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600 }}>
              Từng test
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {testResultsList.map((test, idx) => {
                const isPassed = test.verdict === 'AC';
                const testKey = test.testId || String(idx);
                const isCurrentExpanded = expandedTestId === testKey;

                return (
                  <button
                    type="button"
                    key={testKey}
                    onClick={() => toggleExpand(testKey)}
                    style={{
                      width: 26,
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isPassed ? '#2F6B3F' : '#B4281F',
                      color: '#ffffff',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isCurrentExpanded ? '2px solid #1F1D1A' : 'none',
                      outline: 'none',
                    }}
                    className="fj-mono"
                    title={`Test ${idx + 1}: ${test.verdict}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: CHI TIẾT TỪNG TEST */}
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px' }}>
            Chi tiết từng test
          </h3>

          {/* Header Bảng chi tiết test */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 110px 100px 90px 1fr 50px',
              gap: 8,
              alignItems: 'center',
              borderTop: '2px solid #1F1D1A',
              padding: '10px 0',
              fontSize: 13,
            }}
            className="fj-m"
          >
            <span>Test</span>
            <span>Kết quả</span>
            <span>Thời gian</span>
            <span>Bộ nhớ</span>
            <span>Điểm</span>
            <span></span>
          </div>

          {/* Danh sách từng dòng Test Case */}
          {testResultsList.map((test, idx) => {
            const isPassed = test.verdict === 'AC';
            const testKey = test.testId || String(idx);
            const isExpanded = expandedTestId === testKey;
            const testNumStr = String(idx + 1).padStart(2, '0');

            return (
              <div key={testKey} style={{ borderTop: '1px solid #D9D2C3' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 110px 100px 90px 1fr 50px',
                    gap: 8,
                    alignItems: 'center',
                    padding: '12px 0',
                    fontSize: 13,
                  }}
                >
                  <span className="fj-mono" style={{ fontWeight: 600 }}>
                    Test {testNumStr}
                  </span>

                  {/* Trạng thái kết quả */}
                  <div>
                    {isPassed ? (
                      <b style={{ color: '#2F6B3F' }}>
                        Đúng <span style={{ fontSize: 11 }}>AC</span>
                      </b>
                    ) : test.verdict === 'WA' ? (
                      <b style={{ color: '#B4281F' }}>
                        Sai <span style={{ fontSize: 11 }}>WA</span>
                      </b>
                    ) : test.verdict === 'TLE' ? (
                      <b style={{ color: '#D97706' }}>
                        Quá giờ <span style={{ fontSize: 11 }}>TLE</span>
                      </b>
                    ) : test.verdict === 'CE' ? (
                      <b style={{ color: '#6B655C' }}>
                        Biên dịch <span style={{ fontSize: 11 }}>CE</span>
                      </b>
                    ) : (
                      <b style={{ color: '#DC2626' }}>
                        Lỗi <span style={{ fontSize: 11 }}>{test.verdict}</span>
                      </b>
                    )}
                  </div>

                  <span className="fj-mono">{formatTime(test.time)}s</span>
                  <span className="fj-mono">{formatMemory(test.memory)} MB</span>
                  <span className="fj-mono">{formatPoint(test.pointsEarned)} / {formatPoint(test.maxPoints)}</span>

                  <button
                    type="button"
                    onClick={() => toggleExpand(testKey)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#B4281F',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'right',
                      font: 'inherit',
                      padding: 0,
                    }}
                  >
                    {isExpanded ? 'Ẩn' : 'Xem'}
                  </button>
                </div>

                {/* Hộp xem chi tiết I/O khi bấm Xem */}
                {isExpanded && (
                  <div
                    style={{
                      background: '#FFFDF8',
                      border: '1px solid #D9D2C3',
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 12,
                      fontSize: 13,
                    }}
                  >
                    {canViewDetails ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="grid-cols-1 md:grid-cols-2">
                        {/* Input */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span className="fj-m" style={{ fontWeight: 600, fontSize: 12 }}>Input Test #{idx + 1}</span>
                            {(test as any).input && (
                              <button
                                type="button"
                                onClick={() => handleCopy((test as any).input || '', `in-${idx}`)}
                                style={{ background: 'none', border: 'none', color: '#B4281F', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                              >
                                {copiedKey === `in-${idx}` ? 'Đã chép!' : 'Copy'}
                              </button>
                            )}
                          </div>
                          <pre
                            className="fj-mono"
                            style={{
                              background: '#F4F0E8',
                              padding: 10,
                              borderRadius: 6,
                              fontSize: 12,
                              margin: 0,
                              maxHeight: 180,
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {(test as any).input || test.errorLog || '(Không có dữ liệu Input)'}
                          </pre>
                        </div>

                        {/* Output của bài nộp */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span className="fj-m" style={{ fontWeight: 600, fontSize: 12 }}>Output của bạn</span>
                            {test.actualOutput && (
                              <button
                                type="button"
                                onClick={() => handleCopy(test.actualOutput || '', `act-${idx}`)}
                                style={{ background: 'none', border: 'none', color: '#B4281F', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                              >
                                {copiedKey === `act-${idx}` ? 'Đã chép!' : 'Copy'}
                              </button>
                            )}
                          </div>
                          <pre
                            className="fj-mono"
                            style={{
                              background: '#F4F0E8',
                              padding: 10,
                              borderRadius: 6,
                              fontSize: 12,
                              margin: 0,
                              maxHeight: 180,
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              color: isPassed ? '#2F6B3F' : '#B4281F',
                            }}
                          >
                            {test.actualOutput || '(Không có kết quả trả về)'}
                          </pre>
                        </div>

                        {/* Đáp án mẫu nếu có */}
                        {test.expectedOutput && (
                          <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #D9D2C3', paddingTop: 10, marginTop: 4 }}>
                            <span className="fj-m" style={{ fontWeight: 600, fontSize: 12, display: 'block', marginBottom: 4 }}>
                              Đáp án đúng (Expected Output):
                            </span>
                            <pre
                              className="fj-mono"
                              style={{
                                background: '#F4F0E8',
                                padding: 10,
                                borderRadius: 6,
                                fontSize: 12,
                                margin: 0,
                                maxHeight: 140,
                                overflowY: 'auto',
                                whiteSpace: 'pre-wrap',
                                color: '#2F6B3F',
                              }}
                            >
                              {test.expectedOutput}
                            </pre>
                          </div>
                        )}

                        {/* Thông báo lỗi nếu có */}
                        {test.errorMessage && (
                          <div style={{ gridColumn: '1 / -1', color: '#B4281F', fontSize: 12, paddingTop: 4 }}>
                            <b>Chi tiết lỗi: </b> {test.errorMessage}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="fj-m" style={{ textAlign: 'center', padding: '12px 0' }}>
                        Giáo viên đã ẩn dữ liệu Input/Output chi tiết của bài tập này.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Dòng Tổng điểm ở dưới cùng */}
          <div
            style={{
              borderTop: '2px solid #1F1D1A',
              paddingTop: 16,
              marginTop: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            <span>Tổng điểm</span>
            <span className="fj-mono" style={{ fontSize: 18 }}>
              {earnedPoints} / {maxPoints}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
