import React, { useState } from 'react';
import type { Submission, TestResult, Verdict } from '../../types/judge';
import { useJudge } from '../../context/JudgeContext';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertOctagon,
  FileCode2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

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
  const { theme } = useJudge();
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

  // Mở rộng chi tiết I/O cho mọi người dùng (học sinh & giáo viên), trừ khi bị truyền showDetails={false}
  const canViewDetails = showDetails !== false;

  const formatOutput = (str?: unknown): string => {
    if (str === null || str === undefined) return 'Không có dữ liệu';
    if (typeof str === 'object') {
      try {
        const jsonStr = JSON.stringify(str, null, 2);
        return jsonStr.length > 1000
          ? jsonStr.substring(0, 1000) + '\n\n... [Dữ liệu quá dài, đã được ẩn bớt]'
          : jsonStr;
      } catch {
        return String(str);
      }
    }
    const s = String(str);
    return s.length > 1000
      ? s.substring(0, 1000) + '\n\n... [Dữ liệu quá dài, đã được ẩn bớt]'
      : s;
  };

  const formatPoint = (val: number) => {
    const rounded = Number(val.toFixed(2));
    return Number.isInteger(rounded) ? rounded.toFixed(1) : rounded.toString();
  };

  if (isGrading) {
    const displayTotal = Math.max(totalTestsToRun || 0, currentRunningIndex);
    const percent = displayTotal > 0 ? Math.round((currentRunningIndex / displayTotal) * 100) : 0;
    return (
      <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 text-white shadow-xl animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-blue-400 animate-spin" />
            </div>
            <div>
              <h4 className="font-bold text-base text-blue-300">
                Đang chấm bài theo cơ chế Themis...
              </h4>
              <p className="text-xs text-slate-400">
                Đang thực thi Test #{currentRunningIndex} / {displayTotal}
              </p>
            </div>
          </div>
          <span className="font-mono text-sm font-semibold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            {percent}% Hoàn tất
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700/60">
          <div
            className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full transition-all duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <Layers className="w-10 h-10 mx-auto text-slate-600 mb-2" />
        <h5 className="font-semibold text-sm text-slate-300">Chưa có kết quả chấm bài</h5>
        <p className="text-xs text-slate-500 mt-1">
          Soạn thảo hoặc dán code của bạn ở khung bên phải và nhấn nút <b>"Nộp bài (Chấm điểm)"</b>.
        </p>
      </div>
    );
  }

  const getVerdictBadge = (verdict: Verdict) => {
    switch (verdict) {
      case 'AC':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            ĐÚNG (AC)
          </span>
        );
      case 'WA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            SAI KẾT QUẢ (WA)
          </span>
        );
      case 'TLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            QUÁ THỜI GIAN (TLE)
          </span>
        );
      case 'RTE':
      case 'MLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
            <AlertOctagon className="w-3.5 h-3.5" />
            LỖI THỰC THI ({verdict})
          </span>
        );
      case 'CE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
            <FileCode2 className="w-3.5 h-3.5" />
            LỖI BIÊN DỊCH (CE)
          </span>
        );
      case 'SYS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <AlertOctagon className="w-3.5 h-3.5" />
            LỖI MÁY CHẤM (SYS)
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{verdict}</span>;
    }
  };

  const isFullAC = submission.passedCount === submission.totalTests && submission.totalTests > 0;
  const isZero = submission.passedCount === 0;

  return (
    <div
      className={`rounded-2xl border overflow-hidden shadow-2xl transition-all duration-300 ${
        theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}
    >
      {/* Themis Banner Header */}
      <div
        className={`p-5 border-b flex flex-wrap items-center justify-between gap-4 ${
          theme === 'light'
            ? isFullAC
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : isZero
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : 'bg-amber-50 border-amber-200 text-amber-950'
            : isFullAC
            ? 'bg-emerald-950/40 border-emerald-800/40 text-white'
            : isZero
            ? 'bg-rose-950/30 border-rose-800/40 text-white'
            : 'bg-amber-950/30 border-amber-800/40 text-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl border shadow-sm ${
              theme === 'light'
                ? isFullAC
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : isZero
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
                : isFullAC
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : isZero
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            }`}
          >
            {isFullAC ? 'AC' : submission.overallVerdict}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4
                className={`text-lg font-black tracking-wide ${
                  theme === 'light'
                    ? isFullAC
                      ? 'text-emerald-950'
                      : isZero
                      ? 'text-rose-950'
                      : 'text-amber-950'
                    : 'text-white'
                }`}
              >
                BẢNG ĐIỂM CHẤM THEMIS
              </h4>
              {isFullAC && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                  <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> TUYỆT ĐỐI 100%
                </span>
              )}
            </div>
            <div
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mt-0.5 ${
                theme === 'light' ? 'text-slate-700 font-medium' : 'text-slate-300'
              }`}
            >
              <span>
                Bài tập:{' '}
                <b
                  className={`font-black ${
                    theme === 'light'
                      ? isFullAC
                        ? 'text-emerald-950'
                        : isZero
                        ? 'text-rose-950'
                        : 'text-amber-950'
                      : 'text-white'
                  }`}
                >
                  {typeof submission.problemTitle === 'object' ? JSON.stringify(submission.problemTitle) : String(submission.problemTitle || '')}
                </b>{' '}
                <span className="font-mono text-blue-700 dark:text-blue-400 font-bold bg-blue-100 dark:bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-500/20">
                  {typeof submission.problemCode === 'object' ? JSON.stringify(submission.problemCode) : String(submission.problemCode || '')}
                </span>
              </span>
              <span className={theme === 'light' ? 'text-slate-400' : 'text-slate-500'}>•</span>
              <span>
                Ngôn ngữ:{' '}
                <span
                  className={`font-bold uppercase ${
                    theme === 'light' ? 'text-slate-900' : 'text-slate-200'
                  }`}
                >
                  {typeof submission.language === 'object' ? JSON.stringify(submission.language) : String(submission.language || '')}
                </span>
              </span>
              <span className={theme === 'light' ? 'text-slate-400' : 'text-slate-500'}>•</span>
              <span className={theme === 'light' ? 'text-slate-600' : 'text-slate-400'}>
                {(() => {
                  try {
                    const d = new Date(submission.submittedAt);
                    return isNaN(d.getTime()) ? String(submission.submittedAt || '') : d.toLocaleTimeString();
                  } catch {
                    return String(submission.submittedAt || '');
                  }
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* Score & Passed stats */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span
              className={`text-xs block font-semibold ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              Tổng điểm đạt được
            </span>
            <div className="text-2xl font-black tracking-tight font-mono">
              <span
                className={
                  isFullAC
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : isZero
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-amber-700 dark:text-amber-400'
                }
              >
                {submission.totalPointsEarned}
              </span>
              <span
                className={`text-lg font-semibold ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-500'
                }`}
              >
                {' '}
                / {submission.maxTotalPoints}
              </span>
            </div>
          </div>
          <div
            className={`h-8 w-px hidden sm:block ${
              theme === 'light' ? 'bg-slate-300' : 'bg-slate-700/60'
            }`}
          />
          <div className="text-right hidden sm:block">
            <span
              className={`text-xs block font-semibold ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              Số Test đúng
            </span>
            <div
              className={`text-base font-black font-mono ${
                theme === 'light'
                  ? isFullAC
                    ? 'text-emerald-950'
                    : isZero
                    ? 'text-rose-950'
                    : 'text-amber-950'
                  : 'text-slate-200'
              }`}
            >
              {submission.passedCount} / {submission.totalTests} tests
            </div>
          </div>
        </div>
      </div>

      {/* Freopen compatibility notice */}
      {submission.freopenHandled && (
        <div
          className={`border-b px-5 py-2.5 flex items-center gap-2 text-xs ${
            theme === 'light'
              ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
              : 'bg-indigo-950/30 border-indigo-900/40 text-indigo-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
          <span>
            <b>Tương thích Themis:</b> Hệ thống đã tự động nhận diện và xử lý lệnh đọc/ghi file{' '}
            <code
              className={`px-1 py-0.5 rounded font-mono font-semibold ${
                theme === 'light'
                  ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                  : 'bg-indigo-900/40 text-indigo-200'
              }`}
            >
              freopen / assign
            </code>{' '}
            thành stdin/stdout chuẩn để code không bị lỗi Runtime Error.
          </span>
        </div>
      )}

      {/* Compilation Error Details (if any) */}
      {submission.compilationMessage && (
        <div
          className={`p-5 border-b ${
            theme === 'light'
              ? 'border-rose-200 bg-rose-50'
              : 'border-rose-900/50 bg-rose-950/20'
          }`}
        >
          <h5 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-2 flex items-center gap-2">
            <FileCode2 className="w-4 h-4" /> Chi tiết thông báo lỗi biên dịch (Compilation Log)
          </h5>
          <pre
            className={`p-3 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap border ${
              theme === 'light'
                ? 'bg-white text-rose-800 border-rose-200'
                : 'bg-black/60 text-rose-300 border-rose-900/40'
            }`}
          >
            {typeof submission.compilationMessage === 'object' ? JSON.stringify(submission.compilationMessage, null, 2) : String(submission.compilationMessage)}
          </pre>
        </div>
      )}

      {/* Test Cases Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr
              className={`border-b text-[11px] font-bold uppercase ${
                theme === 'light'
                  ? 'border-slate-200 text-slate-700 bg-slate-100/90'
                  : 'border-slate-800 text-slate-400 bg-slate-800/40'
              }`}
            >
              <th className="py-3 px-4">Tên Test</th>
              <th className="py-3 px-4">Trạng thái (Verdict)</th>
              <th className="py-3 px-4">Thời gian</th>
              <th className="py-3 px-4">Bộ nhớ</th>
              <th className="py-3 px-4 text-right">Điểm số</th>
              {canViewDetails && <th className="py-3 px-3 text-center w-16">Chi tiết</th>}
            </tr>
          </thead>
          <tbody
            className={`divide-y font-mono text-xs ${
              theme === 'light'
                ? 'divide-slate-200 bg-white'
                : 'divide-slate-800/60'
            }`}
          >
            {submission.testResults.map((tr: TestResult, idx: number) => {
              const testKey = tr.testId || `test_${idx}`;
              const isExpanded = canViewDetails && expandedTestId === testKey;
              const isPassed = tr.verdict === 'AC';
              const isError =
                tr.verdict === 'RTE' ||
                tr.verdict === 'CE' ||
                tr.verdict === 'MLE' ||
                tr.verdict === 'SYS' ||
                Boolean(tr.errorLog) ||
                Boolean(tr.errorMessage);

              const handleToggle = () => {
                if (!canViewDetails) return;
                setExpandedTestId(isExpanded ? null : testKey);
              };

              return (
                <React.Fragment key={testKey}>
                  <tr
                    onClick={handleToggle}
                    className={`transition-colors ${
                      canViewDetails ? 'cursor-pointer select-none' : ''
                    } ${
                      theme === 'light'
                        ? isPassed
                          ? 'hover:bg-emerald-50/70 bg-white'
                          : 'hover:bg-rose-50/70 bg-white'
                        : isPassed
                        ? 'hover:bg-slate-800/40 bg-emerald-950/5'
                        : 'hover:bg-slate-800/40 bg-rose-950/5'
                    }`}
                  >
                    <td
                      className={`py-3 px-4 font-bold ${
                        theme === 'light' ? 'text-slate-950' : 'text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {canViewDetails && (
                          <span
                            className={`p-0.5 rounded transition-transform duration-200 ${
                              isExpanded
                                ? 'text-blue-500 rotate-180'
                                : 'text-slate-400'
                            }`}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span>{typeof tr.testName === 'object' ? JSON.stringify(tr.testName) : String(tr.testName || '')}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{getVerdictBadge(tr.verdict)}</td>
                    <td
                      className={`py-3 px-4 font-medium ${
                        theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                      }`}
                    >
                      {tr.time.toFixed(3)}s
                    </td>
                    <td
                      className={`py-3 px-4 ${
                        theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                      }`}
                    >
                      {tr.memory.toFixed(1)} MB
                    </td>
                    <td className="py-3 px-4 text-right font-bold">
                      <span
                        className={
                          isPassed
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500'
                        }
                      >
                        {formatPoint(tr.pointsEarned)}
                      </span>
                      <span
                        className={
                          theme === 'light' ? 'text-slate-500' : 'text-slate-600'
                        }
                      >
                        {' '}
                        / {formatPoint(tr.maxPoints)}
                      </span>
                    </td>
                    {canViewDetails && (
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle();
                          }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isExpanded
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : theme === 'light'
                              ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
                              : 'hover:bg-slate-700/50 text-slate-400 hover:text-white'
                          }`}
                          title={isExpanded ? 'Thu gọn chi tiết' : 'Xem chi tiết kết quả test này'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-blue-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    )}
                  </tr>

                  {/* Expanded Row for viewing Actual vs Expected Output */}
                  {canViewDetails && isExpanded && (
                    <tr
                      className={
                        theme === 'light'
                          ? 'bg-slate-50 border-y border-slate-200'
                          : 'bg-slate-950/80 border-y border-slate-800/80'
                      }
                    >
                      <td colSpan={6} className="p-4 sm:p-5">
                        <div className="space-y-3.5">
                          {/* Block Thông báo lỗi (Error Log) nếu là RTE, CE hoặc có errorMessage/errorLog */}
                          {isError && (
                            <div
                              className={`p-3.5 rounded-xl border ${
                                theme === 'light'
                                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                                  : 'bg-rose-950/30 border-rose-900/50 text-rose-300'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide mb-1.5 text-rose-700 dark:text-rose-400">
                                <AlertOctagon className="w-4 h-4 shrink-0" />
                                <span>Thông báo lỗi (Error Log)</span>
                              </div>
                              <pre className="font-mono text-xs whitespace-pre-wrap break-all overflow-x-auto max-h-40 leading-relaxed">
                                {formatOutput(tr.errorLog || tr.errorMessage || 'Lỗi thực thi (Runtime Error)')}
                              </pre>
                            </div>
                          )}

                          {/* Khu vực chi tiết chia làm 2 cột cạnh nhau */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Cột trái: Đầu ra của bạn (Actual Output) */}
                            <div>
                              <span
                                className={`text-[11px] font-bold uppercase tracking-wide block mb-1.5 ${
                                  theme === 'light' ? 'text-slate-700' : 'text-slate-400'
                                }`}
                              >
                                Đầu ra của bạn (Actual Output):
                              </span>
                              <pre
                                className={`p-3 rounded-xl font-mono text-xs overflow-x-auto max-h-48 whitespace-pre-wrap break-all border leading-relaxed ${
                                  theme === 'light'
                                    ? `bg-white border-slate-200 ${
                                        isPassed ? 'text-emerald-800' : 'text-rose-800'
                                      }`
                                    : `bg-slate-900 border-slate-800 ${
                                        isPassed ? 'text-emerald-400' : 'text-rose-400'
                                      }`
                                }`}
                              >
                                {formatOutput(tr.actualOutput)}
                              </pre>
                            </div>

                            {/* Cột phải: Đầu ra mong muốn (Expected Output) */}
                            <div>
                              <span
                                className={`text-[11px] font-bold uppercase tracking-wide block mb-1.5 ${
                                  theme === 'light' ? 'text-slate-700' : 'text-slate-400'
                                }`}
                              >
                                Đầu ra mong muốn (Expected Output):
                              </span>
                              <pre
                                className={`p-3 rounded-xl font-mono text-xs overflow-x-auto max-h-48 whitespace-pre-wrap break-all border leading-relaxed ${
                                  theme === 'light'
                                    ? 'bg-white text-emerald-800 border-slate-200'
                                    : 'bg-slate-900 text-emerald-400 border-slate-800'
                                }`}
                              >
                                {formatOutput(tr.expectedOutput)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

