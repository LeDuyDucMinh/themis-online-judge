import React, { useState, useEffect } from 'react';
import type { Problem, Submission } from '../../types/judge';
import { useJudge } from '../../context/JudgeContext';
import { MathRenderer } from '../common/MathRenderer';
import { ThemisGradingTable } from './ThemisGradingTable';
import { VideoSection } from './VideoSection';
import Editor from '@monaco-editor/react';
import {
  LANGUAGE_CONFIG,
  type SupportedLanguage,
} from '../../services/judgeEngine';
import {
  Play,
  RotateCcw,
  Sparkles,
  FileCode,
  ArrowLeft,
  Download,
  FileText,
  Paperclip,
  Copy,
  Check,
} from 'lucide-react';

interface ProblemViewProps {
  problem: Problem;
  onBackToList: () => void;
}

export const ProblemView: React.FC<ProblemViewProps> = ({ problem, onBackToList }) => {
  const { submitCode, submissions, theme, isAdminAuthenticated, currentStudent, activeClass, showToast } = useJudge();


  const [language, setLanguage] = useState<SupportedLanguage>('cpp');
  const [code, setCode] = useState<string>(() => {
    return problem.starterCode?.cpp || LANGUAGE_CONFIG.cpp.defaultCode;
  });

  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [currentRunningIndex, setCurrentRunningIndex] = useState<number>(0);
  const [latestSubmission, setLatestSubmission] = useState<Submission | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  const handleDownloadAttached = () => {
    if (!problem.attachedFile?.dataUrl) return;
    const a = document.createElement('a');
    a.href = problem.attachedFile.dataUrl;
    a.download = problem.attachedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Lấy lịch sử nộp bài gần nhất của bài này (cho đúng học sinh đang đăng nhập)
  useEffect(() => {
    const existing = submissions.find((s) => {
      if (s.problemId !== problem.id) return false;
      if (isAdminAuthenticated) return true;
      if (!currentStudent) return false;
      return (
        (s.userId && s.userId.toLowerCase() === currentStudent.username.toLowerCase()) ||
        (s.userName && s.userName.trim().toLowerCase() === currentStudent.fullName.trim().toLowerCase())
      );
    });
    if (existing) {
      setLatestSubmission(existing);
    } else {
      setLatestSubmission(null);
    }
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

  // Nộp bài và chạy chấm điểm Themis
  const handleSubmit = async () => {
    if (isGrading) return;
    setIsGrading(true);
    setCurrentRunningIndex(0);

    try {
      const sub = await submitCode(
        problem.id,
        code,
        language,
        (currentIdx: number) => {
          setCurrentRunningIndex(currentIdx);
        }
      );
      setLatestSubmission(sub);
    } catch (err: unknown) {
      console.error(err);
      const msg = (err as Error)?.message || 'Có lỗi xảy ra khi nộp bài hoặc lưu vào cơ sở dữ liệu';
      showToast('Lỗi nộp bài', msg, 'error');
    } finally {
      setIsGrading(false);
    }
  };

  // Kiểm tra điều kiện mở khóa video theo đúng học sinh hiện tại
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top action bar with Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={onBackToList}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold transition-all border border-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-red-500" />
            <span>{activeClass ? `Lớp ${activeClass.className}` : 'Danh sách bài tập'}</span>
          </button>
          {activeClass && (
            <>
              <span className="text-slate-500">/</span>
              <span className="font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                {problem.code}
              </span>
            </>
          )}
        </div>


        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Độ khó:</span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              problem.difficulty === 'Dễ'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : problem.difficulty === 'Trung bình'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {problem.difficulty}
          </span>
        </div>
      </div>

      {/* Layout: Đề bài ở TRÊN, Phần nộp bài ở DƯỚI */}
      <div className="flex flex-col space-y-8">
        {/* SECTION 1 (TRÊN): KHU VỰC ĐỀ BÀI CHI TIẾT */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          {/* Header Đề Bài */}
          <div className="border-b border-slate-800 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {problem.code}
                </span>
                <span className="text-xs text-slate-400">
                  Tác giả / Nguồn đề: <b className="text-slate-200">{problem.author || 'FAMINH Judge'}</b>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Độ khó:</span>
                <span
                  className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                    problem.difficulty === 'Dễ'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : problem.difficulty === 'Trung bình'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {problem.difficulty}
                </span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {problem.title}
            </h1>
          </div>

          {/* Attached Document File View or Description */}
          {problem.attachedFile ? (
            <div className="border-t border-slate-800 pt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-red-600 text-white shadow-md shadow-red-600/30">
                    <FileText className="w-4 h-4" /> Đề bài gốc ({problem.attachedFile.type.toUpperCase()})
                  </span>
                  <span className="text-xs text-slate-300 font-medium hidden sm:inline">
                    {problem.attachedFile.name}
                  </span>
                </div>

                <button
                  onClick={handleDownloadAttached}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-700 text-red-400 hover:text-red-300 text-xs font-semibold border border-slate-700 transition-colors shadow-sm cursor-pointer"
                  title="Tải file đề bài gốc về máy tính"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải file gốc ({problem.attachedFile.name} - {(problem.attachedFile.size / 1024).toFixed(0)} KB)</span>
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 overflow-x-auto space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs text-slate-400">
                  <Paperclip className="w-4 h-4 text-red-400" />
                  <span>Tài liệu đề thi: <b>{problem.attachedFile.name}</b> (Hiển thị nguyên bản)</span>
                </div>

                {problem.attachedFile.type === 'docx' && problem.attachedFile.rawHtml ? (
                  <div
                    className="prose prose-invert max-w-none text-slate-200 leading-relaxed font-sans [&_table]:border-collapse [&_table]:w-full [&_table]:my-4 [&_td]:border [&_td]:border-slate-700 [&_td]:p-3 [&_th]:border [&_th]:border-slate-700 [&_th]:p-3 [&_th]:bg-slate-800 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_p]:my-2"
                    dangerouslySetInnerHTML={{ __html: problem.attachedFile.rawHtml }}
                  />
                ) : problem.attachedFile.type === 'pdf' && problem.attachedFile.dataUrl ? (
                  <iframe
                    src={problem.attachedFile.dataUrl}
                    title={problem.attachedFile.name}
                    className="w-full h-[650px] rounded-xl border border-slate-800 bg-black"
                  />
                ) : (
                  <MathRenderer content={problem.description} />
                )}
              </div>
            </div>
          ) : (
            /* Description with LaTeX */
            <div className="border-t border-slate-800 pt-5 text-sm leading-relaxed text-slate-200">
              <MathRenderer content={problem.description} />
            </div>
          )}

          {/* Bảng Ví dụ (Sample Input / Sample Output) */}
          {problem.samples && problem.samples.length > 0 && (
            <div className="border-t border-slate-800 pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 bg-red-600 rounded-full inline-block"></span>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Ví dụ (Sample Test)
                </h3>
              </div>

              <div className="space-y-4">
                {problem.samples.map((sample, idx) => (
                  <div
                    key={sample.id || idx}
                    className={`border rounded-2xl overflow-hidden shadow-lg ${
                      theme === 'light'
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-950 border-slate-700/80'
                    }`}
                  >
                    {/* Header 2 cột chuẩn đề thi Tin học kèm nút Copy */}
                    <div className={`grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-b ${
                      theme === 'light'
                        ? 'bg-slate-100/90 border-slate-200 divide-slate-200'
                        : 'bg-slate-800/80 border-slate-800 divide-slate-800'
                    }`}>
                      <div className="px-4 py-2.5 flex items-center justify-between">
                        <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                          theme === 'light' ? 'text-slate-800' : 'text-slate-300'
                        }`}>
                          Ví dụ Input {problem.samples.length > 1 ? `#${idx + 1}` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(sample.input, `in-${idx}`)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer border ${
                            copiedKey === `in-${idx}`
                              ? theme === 'light'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                              : theme === 'light'
                              ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 hover:border-slate-400 font-bold'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-100 border-slate-600'
                          }`}
                          title="Sao chép Input"
                        >
                          {copiedKey === `in-${idx}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Đã chép!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="px-4 py-2.5 flex items-center justify-between">
                        <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                          theme === 'light' ? 'text-slate-800' : 'text-slate-300'
                        }`}>
                          Ví dụ Output {problem.samples.length > 1 ? `#${idx + 1}` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(sample.output, `out-${idx}`)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer border ${
                            copiedKey === `out-${idx}`
                              ? theme === 'light'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                              : theme === 'light'
                              ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 hover:border-slate-400 font-bold'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-100 border-slate-600'
                          }`}
                          title="Sao chép Output"
                        >
                          {copiedKey === `out-${idx}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Đã chép!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Nội dung 2 cột Input và Output */}
                    <div className={`grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x font-mono text-xs ${
                      theme === 'light' ? 'divide-slate-200' : 'divide-slate-800'
                    }`}>
                      <div className={`p-4 overflow-x-auto whitespace-pre leading-relaxed select-all ${
                        theme === 'light'
                          ? 'bg-slate-50/70 text-slate-900 font-medium'
                          : 'bg-slate-900/50 text-emerald-400'
                      }`}>
                        {sample.input || ' '}
                      </div>
                      <div className={`p-4 overflow-x-auto whitespace-pre leading-relaxed select-all ${
                        theme === 'light'
                          ? 'bg-slate-50/70 text-slate-900 font-medium'
                          : 'bg-slate-900/50 text-blue-400'
                      }`}>
                        {sample.output || ' '}
                      </div>
                    </div>

                    {/* Giải thích ví dụ nếu có */}
                    {sample.explanation && (
                      <div className={`p-3 border-t text-xs flex items-start gap-2 ${
                        theme === 'light'
                          ? 'bg-slate-50 border-slate-200 text-slate-800'
                          : 'bg-slate-900/90 border-slate-800 text-slate-300'
                      }`}>
                        <span className={`font-semibold shrink-0 ${
                          theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                        }`}>Giải thích:</span>
                        <div className="flex-1">
                          <MathRenderer content={sample.explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* SECTION 2 (DƯỚI): KHU VỰC NỘP BÀI & TRÌNH BIÊN DỊCH CODE */}
        <section className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            {/* Editor Toolbar */}
            <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
              theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/90 border-slate-700/80'
            }`}>
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-500" />
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  theme === 'light' ? 'text-slate-800' : 'text-white'
                }`}>
                  Trình soạn thảo mã nguồn & Nộp bài
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Language Selector */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs hidden sm:inline ${
                    theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'
                  }`}>Ngôn ngữ:</span>
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                    className={`text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold border ${
                      theme === 'light'
                        ? 'bg-white border-slate-300 text-slate-800 shadow-sm'
                        : 'bg-slate-900 border-slate-700 text-slate-200'
                    }`}
                  >
                    <option value="cpp">C++ (G++ 10.2 / 17)</option>
                    <option value="python">Python 3</option>
                    <option value="pascal">Pascal (FPC 3.2)</option>
                    <option value="java">Java (OpenJDK 15)</option>
                  </select>
                </div>

                {/* Reset button */}
                <button
                  onClick={handleResetCode}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                    theme === 'light'
                      ? 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
                      : 'bg-slate-900 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                  }`}
                  title="Khôi phục code mẫu mặc định"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Khôi phục mẫu</span>
                </button>
              </div>
            </div>

            {/* Monaco Editor Container */}
            <div className={`h-[480px] w-full ${theme === 'light' ? 'bg-[#fffffe]' : 'bg-[#1e1e1e]'}`}>
              <Editor
                height="100%"
                language={LANGUAGE_CONFIG[language].monacoLang}
                theme={theme === 'light' ? 'light' : 'vs-dark'}
                value={code}
                onChange={(val) => setCode(val || '')}
                options={{
                  fontSize: 14,
                  fontFamily: "'Consolas', 'Fira Code', 'Cascadia Code', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 4,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  cursorBlinking: 'smooth',
                  smoothScrolling: true,
                }}
              />
            </div>

            {/* Bottom Bar & Submit Action */}
            <div className={`p-4 sm:p-5 border-t flex flex-wrap items-center justify-between gap-4 ${
              theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/80 border-slate-700/80'
            }`}>
              <div className={`text-xs flex items-center gap-2 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>
                  Hệ thống tự động hỗ trợ lệnh đọc/ghi file kiểu Themis:{' '}
                  <code className={`px-1.5 py-0.5 rounded font-mono border ${
                    theme === 'light'
                      ? 'text-blue-700 bg-white border-blue-200'
                      : 'text-blue-300 bg-slate-900 border-slate-700'
                  }`}>
                    freopen(&quot;{problem.code}.INP&quot;, &quot;r&quot;, stdin);
                  </code>
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isGrading}
                className={`inline-flex items-center gap-2.5 px-8 py-3 rounded-2xl font-bold text-sm text-white shadow-xl transition-all ${
                  isGrading
                    ? 'bg-blue-600/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 hover:shadow-red-600/25 active:scale-[0.98]'
                }`}
              >
                <Play className={`w-4 h-4 ${isGrading ? 'animate-spin' : 'fill-white'}`} />
                {isGrading ? 'Đang chạy chấm bài...' : 'Nộp bài (Chấm điểm)'}
              </button>
            </div>
          </div>

          {/* Themis Result Table */}
          <ThemisGradingTable
            submission={latestSubmission}
            isGrading={isGrading}
            currentRunningIndex={currentRunningIndex}
            totalTestsToRun={problem.testCases?.length || 5}
          />
        </section>
      </div>

      {/* Video Guide Section at the bottom */}
      <VideoSection
        videoConfig={problem.videoConfig}
        hasSubmitted={hasSubmitted}
        isFullScore={isFullScore}
      />
    </div>
  );
};

