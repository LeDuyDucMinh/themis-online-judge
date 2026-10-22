import React, { useState, useEffect, useRef } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Problem, SampleIO, TestCase } from '../../types/judge';
import { idbService } from '../../services/db';
import { MathRenderer } from '../common/MathRenderer';
import {
  parseDocxFile,
  parseTextOrPdfFile,
  parseExcelFile,
} from '../../services/fileParserService';
import {
  X,
  Check,
  Upload,
  FileText,
  Eye,
  Trash2,
  HelpCircle,
  Paperclip,
  Bold,
  Italic,
  Code,
  Plus,
  Sparkles,
  Columns,
  PenLine,
  GraduationCap,
} from 'lucide-react';

interface ProblemEditorModalProps {
  problem: Problem | null; // null nếu là tạo mới
  initialTopicId?: string;
  classId?: string;
  onClose: () => void;
}

export const ProblemEditorModal: React.FC<ProblemEditorModalProps> = ({
  problem,
  initialTopicId,
  classId,
  onClose,
}) => {
  const { topics, classes, addProblem, updateProblem, showToast, theme, activeClassId } = useJudge();

  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (problem?.classId) return problem.classId;
    if (classId) return classId;
    if (activeClassId) return activeClassId;
    const initialTopic = topics.find((t) => t.id === (initialTopicId || topics[0]?.id));
    if (initialTopic) {
      const ids = initialTopic.classIds && initialTopic.classIds.length > 0
        ? initialTopic.classIds
        : (initialTopic.classId ? [initialTopic.classId] : ['ALL']);
      if (ids[0] && ids[0] !== 'ALL') return ids[0];
    }
    return classes[0]?.id || 'class_default_faminh';
  });

  const handleTopicChange = (newTopicId: string) => {
    setTopicId(newTopicId);
    const parentTopic = topics.find((t) => t.id === newTopicId);
    if (parentTopic) {
      const ids = parentTopic.classIds && parentTopic.classIds.length > 0
        ? parentTopic.classIds
        : (parentTopic.classId ? [parentTopic.classId] : ['ALL']);
      if (ids[0] && ids[0] !== 'ALL') {
        setSelectedClassId(ids[0]);
      }
    }
  };

  // Mode Tab: 'manual' (Tự soạn thảo / Paste) vs 'file' (Đính kèm File)
  const [inputMode, setInputMode] = useState<'manual' | 'file'>('manual');

  // Form states
  const [code, setCode] = useState(problem?.code || '');
  const [title, setTitle] = useState(problem?.title || '');
  const [author, setAuthor] = useState(problem?.author || 'Thầy Minh (FAMINH)');
  const [topicId, setTopicId] = useState(
    problem?.topicId || initialTopicId || topics[0]?.id || ''
  );
  const [difficulty, setDifficulty] = useState<string>(
    problem?.difficulty || 'Trung bình'
  );
  const [timeLimit, setTimeLimit] = useState(problem?.timeLimit || 1.0);
  const [memoryLimit, setMemoryLimit] = useState(problem?.memoryLimit || 256);
  const [totalPoints, setTotalPoints] = useState(problem?.totalPoints || 10);
  const [description, setDescription] = useState(problem?.description || '');
  const [attachedFile, setAttachedFile] = useState<Problem['attachedFile']>(
    problem?.attachedFile
  );

  // Bảng ví dụ mẫu (Sample Input / Output)
  const [samples, setSamples] = useState<SampleIO[]>(() => {
    if (problem) {
      return problem.samples || [];
    }
    return [{ id: 'sample-1', input: '', output: '', explanation: '' }];
  });

  // Chế độ hiển thị khung soạn thảo: 'edit' (Chỉ gõ), 'split' (Chia đôi vừa gõ vừa xem), 'preview' (Xem trước KaTeX)
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('edit');
  const [isImporting, setIsImporting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [testCases, setTestCases] = useState<TestCase[]>(problem?.testCases || []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (problem && (!problem.testCases || problem.testCases.length === 0)) {
        const dbTests = await idbService.getTestCases(problem.id);
        if (isMounted && dbTests && dbTests.length > 0) {
          setTestCases(dbTests);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [problem?.id, problem?.testCases]);

  // Lắng nghe phím ESC để đóng modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Thao tác chèn văn bản hoặc bọc vùng chọn tại con trỏ trong Textarea
  const insertTextAtCursor = (prefix: string, suffix = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setDescription((prev) => prev + prefix + defaultText + suffix);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const selected = currentVal.substring(start, end);
    const textToInsert = selected || defaultText;
    const replacement = prefix + textToInsert + suffix;
    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    setDescription(newVal);

    setTimeout(() => {
      textarea.focus();
      const newCursorStart = start + prefix.length;
      const newCursorEnd = newCursorStart + textToInsert.length;
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    }, 0);
  };

  // Chèn khung đề thi chuẩn Tin học
  const handleInsertTemplate = () => {
    const standardTemplate = `### 1. Bài toán
Cho dãy số nguyên $A = (a_1, a_2, \\dots, a_n)$. Hãy tìm...

### 2. Dữ liệu vào (Input)
- Dòng đầu chứa số nguyên dương $N$ ($1 \\le N \\le 10^5$).
- Dòng thứ hai gồm $N$ số nguyên $a_1, a_2, \\dots, a_n$ ($|a_i| \\le 10^9$) cách nhau bởi dấu cách.

### 3. Dữ liệu ra (Output)
- In ra một số nguyên duy nhất là kết quả của bài toán.

### 4. Ràng buộc (Subtasks)
- Subtask 1 (40% số điểm): $N \\le 10^3$ và $|a_i| \\le 10^3$.
- Subtask 2 (60% số điểm): $N \\le 10^5$ và $|a_i| \\le 10^9$.`;

    if (
      description.trim() &&
      !window.confirm('Nội dung đề bài hiện tại sẽ được thay bằng khung đề mẫu chuẩn. Bạn có chắc chắn muốn chèn không?')
    ) {
      return;
    }

    setDescription(standardTemplate);

    // Điền mẫu ví dụ nếu các ô ví dụ đang trống hoặc chưa có ví dụ
    if (samples.length === 0 || (samples.length === 1 && !samples[0].input.trim() && !samples[0].output.trim())) {
      setSamples([
        {
          id: 'sample-1',
          input: '5\n1 2 3 4 5',
          output: '15',
          explanation: 'Tổng của 5 số là 1 + 2 + 3 + 4 + 5 = 15.',
        },
      ]);
    }

    showToast('Đã chèn khung đề mẫu', 'Bạn có thể chỉnh sửa các phần theo yêu cầu bài toán', 'info');
  };

  // Quản lý các cặp ví dụ mẫu
  const handleAddSample = () => {
    setSamples((prev) => [
      ...prev,
      {
        id: `sample-${Date.now()}-${prev.length + 1}`,
        input: '',
        output: '',
        explanation: '',
      },
    ]);
  };

  const handleUpdateSample = (index: number, field: keyof SampleIO, value: string) => {
    setSamples((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const handleRemoveSample = (index: number) => {
    setSamples((prev) => prev.filter((_, i) => i !== index));
  };

  // Xử lý nạp từ file (.docx, .pdf, .xlsx)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'docx') {
        const { text, html, dataUrl } = await parseDocxFile(file);
        setAttachedFile({
          name: file.name,
          size: file.size,
          type: 'docx',
          dataUrl,
          rawHtml: html,
        });

        if (!description) {
          setDescription(
            `### Đề thi đính kèm: **${file.name}**\n\n*(Xem toàn bộ định dạng văn bản gốc, bảng biểu đề thi ở khung xem tài liệu bên dưới hoặc tải file về máy)*\n\n${text.slice(0, 300)}...`
          );
        }
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
        if (!code) {
          setCode('BAI_1');
        }
        showToast('Đính kèm file Word thành công', `Đã gắn toàn bộ tài liệu "${file.name}" vào đề bài`, 'success');
      } else if (ext === 'pdf') {
        const { dataUrl } = await parseTextOrPdfFile(file);
        setAttachedFile({
          name: file.name,
          size: file.size,
          type: 'pdf',
          dataUrl,
        });
        if (!description) {
          setDescription(`### Đề bài chính thức đính kèm dạng PDF: **${file.name}**`);
        }
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
        if (!code) {
          setCode('BAI_1');
        }
        showToast('Đính kèm file PDF thành công', `Đã gắn file PDF "${file.name}" vào đề bài`, 'success');
      } else if (ext === 'xlsx' || ext === 'xls') {
        const parsed = await parseExcelFile(file);
        if (parsed.problems && parsed.problems.length > 0) {
          const first = parsed.problems[0];
          if (first.title) setTitle(first.title);
          if (first.code) setCode(first.code);
          if (first.description) setDescription(first.description);
          if (first.timeLimit) setTimeLimit(first.timeLimit);
          if (first.memoryLimit) setMemoryLimit(first.memoryLimit);
          if (first.totalPoints) setTotalPoints(first.totalPoints);
          showToast('Import Excel thành công', `Đã nạp dữ liệu bài tập từ "${file.name}"`, 'success');
        }
      } else {
        const text = await file.text();
        setDescription((prev) => (prev ? `${prev}\n\n${text}` : text));
        showToast('Đã đọc file văn bản', `Đã trích xuất nội dung từ "${file.name}"`, 'info');
      }
    } catch (err: unknown) {
      showToast('Lỗi đọc file', (err as Error).message, 'error');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || !title.trim()) {
      showToast('Thiếu thông tin', 'Vui lòng nhập Mã bài và Tiêu đề bài tập', 'warning');
      return;
    }

    // Lọc bỏ những cặp ví dụ hoàn toàn trống
    const validSamples = samples.filter(
      (s) => s.input.trim().length > 0 || s.output.trim().length > 0
    );

    let targetClassId = selectedClassId || problem?.classId || classId || activeClassId;
    if (!targetClassId || targetClassId === 'class_default_faminh') {
      const parentTopic = topics.find((t) => t.id === topicId);
      if (parentTopic) {
        const ids = parentTopic.classIds && parentTopic.classIds.length > 0
          ? parentTopic.classIds
          : (parentTopic.classId ? [parentTopic.classId] : ['ALL']);
        if (ids[0] && ids[0] !== 'ALL') {
          targetClassId = ids[0];
        }
      }
    }
    if (!targetClassId) targetClassId = 'class_default_faminh';

    const problemData = {
      code: code.trim().toUpperCase().replace(/\s+/g, '_'),
      title: title.trim(),
      classId: targetClassId,
      author: author.trim() || 'Thầy Minh (FAMINH)',
      topicId,
      difficulty: difficulty.trim() || 'Trung bình',

      timeLimit: Number(timeLimit) || 1.0,
      memoryLimit: Number(memoryLimit) || 256,
      totalPoints: Number(totalPoints) || 10,
      description,
      inputFormat: problem?.inputFormat || '',
      outputFormat: problem?.outputFormat || '',
      constraints: problem?.constraints || '',
      samples: validSamples,
      attachedFile,
      testCases: testCases.length > 0 ? testCases : (problem?.testCases || []),
      videoConfig: problem?.videoConfig || {
        enabled: false,
        type: 'youtube',
        url: '',
        unlockRule: 'always',
      },
      starterCode: problem?.starterCode,
    };

    try {
      if (problem) {
        await updateProblem(problem.id, problemData);
      } else {
        await addProblem(problemData);
      }
      onClose();
    } catch (err: unknown) {
      console.error('[ProblemEditorModal] Lỗi lưu bài tập:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className={`border rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative ${
        theme === 'light'
          ? 'bg-white border-slate-200'
          : 'bg-slate-900 border-slate-800'
      }`}>
        {/* Sticky Header với nút Đóng to rõ */}
        <div className={`shrink-0 p-4 sm:p-5 border-b flex items-center justify-between backdrop-blur sticky top-0 z-10 ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200'
            : 'bg-slate-800/90 border-slate-800'
        }`}>
          <div>
            <h3 className={`text-base sm:text-lg font-bold flex items-center gap-2 ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>
              <FileText className="w-5 h-5 text-red-500" />
              {problem
                ? `Chỉnh sửa đề bài: [${problem.code}] ${problem.title}`
                : 'Tạo Đề Bài Mới (Đính kèm file hoặc soạn thảo)'}
            </h3>
            <p className={`text-xs mt-0.5 ${
              theme === 'light' ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Hỗ trợ tự soạn thảo / paste đề thi chuẩn Tin học hoặc đính kèm nguyên file Word / PDF
            </p>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer ${
              theme === 'light'
                ? 'bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white border border-slate-200'
                : 'bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white'
            }`}
            title="Đóng (Phím ESC)"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Đóng</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* 2 Tabs chuyển đổi chế độ nhập đề bài - Tương thích mượt mà cả Light và Dark Mode */}
          <div className={`flex items-center gap-2 p-1.5 rounded-2xl border transition-all ${
            theme === 'light'
              ? 'bg-slate-100 border-slate-200 shadow-inner'
              : 'bg-slate-950/70 border-slate-800'
          }`}>
            <button
              type="button"
              onClick={() => setInputMode('manual')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                inputMode === 'manual'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                  : theme === 'light'
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>✍️ Tự soạn thảo / Paste đề bài</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                inputMode === 'file'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                  : theme === 'light'
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>📎 Đính kèm File đề (Word / PDF)</span>
              {attachedFile && (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"
                  title="Đã đính kèm file"
                />
              )}
            </button>
          </div>

          {/* Tab 2 Content: Hộp tải file đính kèm Word / PDF */}
          {inputMode === 'file' && (
            <div className={`p-5 rounded-2xl border space-y-3 animate-in fade-in duration-200 ${
              theme === 'light'
                ? 'bg-red-50/60 border-red-200'
                : 'bg-gradient-to-r from-red-950/30 via-slate-800/50 to-slate-900 border-red-500/30'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${
                    theme === 'light' ? 'text-red-700' : 'text-red-300'
                  }`}>
                    <Paperclip className="w-4 h-4 text-red-500" /> Đính kèm File Đề Thi Gốc (.DOCX / .PDF)
                  </span>
                  <p className={`text-xs mt-0.5 max-w-xl ${
                    theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    Tải lên file Word hoặc PDF để học sinh được <b>xem nguyên bản tài liệu đề thi</b> (giữ 100% font chữ, bảng tổng quan, hình vẽ và công thức) và có nút tải file về.
                  </p>
                </div>

                <label
                  style={{ color: '#ffffff' }}
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 !text-white text-xs font-bold transition-all shadow-md shadow-red-600/25"
                >
                  <Upload className="w-4 h-4 !text-white shrink-0" style={{ color: '#ffffff' }} />
                  <span style={{ color: '#ffffff' }} className="!text-white font-bold">
                    {isImporting ? 'Đang tải file...' : 'Chọn file Word (.docx) hoặc PDF'}
                  </span>
                  <input
                    type="file"
                    accept=".docx,.pdf,.xlsx,.xls,.txt"
                    onChange={handleFileUpload}
                    disabled={isImporting}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Display Attached File Badge if present */}
              {attachedFile && (
                <div className={`p-3 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
                  theme === 'light'
                    ? 'bg-white border-red-200 shadow-sm'
                    : 'bg-slate-900 border-red-500/40'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-600 flex items-center justify-center font-bold text-xs uppercase">
                      {attachedFile.type}
                    </div>
                    <div>
                      <span className={`font-bold block ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                        {attachedFile.name}
                      </span>
                      <span className={`text-[11px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {(attachedFile.size / 1024).toFixed(1)} KB • Giữ nguyên bảng biểu và định dạng gốc
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAttachedFile(undefined)}
                    className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                        : 'bg-slate-800 text-rose-400 hover:bg-rose-950'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Gỡ file
                  </button>
                </div>
              )}
            </div>
          )}

          <form id="problem-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Thông tin cơ bản: Mã bài, Tiêu đề */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mã bài (Code - Admin tự đặt): *
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ví dụ: TONG2SO, BAI_02, XAU"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white uppercase font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tiêu đề bài tập: *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Bài 2 - Tính tổng các số chẵn"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Row 2: Lớp học được giao, Chủ đề */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-red-400" />
                  Giao vào Lớp học: *
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500 font-medium cursor-pointer"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      🏫 {c.className} (Mã: {c.joinCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  Chủ đề (Topic):
                </label>
                <select
                  value={topicId}
                  onChange={(e) => handleTopicChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500 font-medium cursor-pointer"
                >
                  {topics.length === 0 && (
                    <option value="">(Chưa có chủ đề - Vui lòng tạo chủ đề trước)</option>
                  )}
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Tác giả, Độ khó */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tác giả / Nguồn đề: *
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Ví dụ: Thầy Minh, Đề thi HSG..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Độ khó:
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    list="difficulty-datalist"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    placeholder="Chọn mức độ bên dưới hoặc tự điền..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <datalist id="difficulty-datalist">
                    <option value="Dễ" />
                    <option value="Trung bình" />
                    <option value="Khó" />
                    <option value="Nâng cao" />
                  </datalist>

                  {/* 4 mức độ chọn nhanh nhưng vẫn tự gõ tùy ý được */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: 'Dễ', color: 'emerald' },
                      { label: 'Trung bình', color: 'blue' },
                      { label: 'Khó', color: 'amber' },
                      { label: 'Nâng cao', color: 'rose' },
                    ].map(({ label, color }) => {
                      const isSelected = difficulty.trim().toLowerCase() === label.toLowerCase();
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setDifficulty(label)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                            isSelected
                              ? color === 'emerald'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : color === 'blue'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : color === 'amber'
                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                : 'bg-rose-600 text-white border-rose-600 shadow-sm'
                              : theme === 'light'
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* KHÔNG GIAN SOẠN THẢO CHÍNH (Tab 1 hoặc Ghi chú ở Tab 2) */}
            <div className="space-y-3">
              {/* Header của Khung soạn thảo kèm Toolbar thao tác nhanh */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-3.5 bg-red-600 rounded-full inline-block"></span>
                  <span className="font-bold">
                    {inputMode === 'manual' ? 'Nội dung đề bài chi tiết:' : 'Mô tả tóm tắt / Hướng dẫn thêm:'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {'(Hỗ trợ Markdown & KaTeX $...$)'}
                  </span>
                </label>

                {/* View switcher: Soạn thảo | Chia đôi | Xem trước */}
                <div className={`flex items-center gap-1 p-1 rounded-xl border ${
                  theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
                }`}>
                  <button
                    type="button"
                    onClick={() => setViewMode('edit')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                      viewMode === 'edit'
                        ? 'bg-red-600 text-white shadow-sm'
                        : theme === 'light'
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Chế độ soạn thảo toàn màn hình"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Soạn thảo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('split')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                      viewMode === 'split'
                        ? 'bg-red-600 text-white shadow-sm'
                        : theme === 'light'
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Chia đôi: Vừa gõ vừa xem trước công thức"
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Chia đôi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('preview')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                      viewMode === 'preview'
                        ? 'bg-red-600 text-white shadow-sm'
                        : theme === 'light'
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Xem trước kết quả hiển thị"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Xem trước</span>
                  </button>
                </div>
              </div>

              {/* Thanh công cụ thao tác nhanh chuẩn đề Tin học (khi đang ở chế độ soạn thảo hoặc chia đôi) */}
              {viewMode !== 'preview' && (
                <div className={`p-2 rounded-xl flex flex-wrap items-center gap-1.5 text-xs border ${
                  theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/80 border-slate-700'
                }`}>
                  {/* Nút Chèn khung đề mẫu */}
                  <button
                    type="button"
                    onClick={handleInsertTemplate}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border transition-all shadow-sm cursor-pointer ${
                      theme === 'light'
                        ? 'bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border-red-200'
                        : 'bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border-red-500/30'
                    }`}
                    title="Tự động điền khung: Bài toán -> Dữ liệu vào -> Dữ liệu ra -> Ràng buộc"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-red-500" />
                    <span>📋 Chèn khung đề mẫu</span>
                  </button>

                  <div className={`h-4 w-px mx-1 hidden sm:block ${
                    theme === 'light' ? 'bg-slate-300' : 'bg-slate-700'
                  }`} />

                  {/* Nút định dạng nhanh */}
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor('**', '**', 'chữ in đậm')}
                    className={`p-1.5 px-2 rounded-lg font-bold border flex items-center gap-1 transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                    }`}
                    title="In đậm: **text**"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => insertTextAtCursor('*', '*', 'chữ in nghiêng')}
                    className={`p-1.5 px-2 rounded-lg font-semibold italic border flex items-center gap-1 transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                    }`}
                    title="In nghiêng: *text*"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => insertTextAtCursor('`', '`', 'code')}
                    className={`p-1.5 px-2 rounded-lg font-mono border flex items-center gap-1 transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                    }`}
                    title="Khối mã hoặc từ khóa: `code`"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>

                  <div className={`h-4 w-px mx-1 hidden sm:block ${
                    theme === 'light' ? 'bg-slate-300' : 'bg-slate-700'
                  }`} />

                  {/* Nhóm công thức toán học KaTeX */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('$', '$', 'x')}
                      className={`px-2.5 py-1 rounded-lg font-mono font-semibold border transition-colors cursor-pointer ${
                        theme === 'light'
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border-slate-700'
                      }`}
                      title="Chèn công thức toán LaTeX: $...$"
                    >
                      $ Công thức $
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('$', '$', 'x^2')}
                      className={`px-2 py-1 rounded-lg font-mono border transition-colors cursor-pointer ${
                        theme === 'light'
                          ? 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                      }`}
                      title="Chèn số mũ x² ($x^2$)"
                    >
                      x²
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('$', '$', '\\le')}
                      className={`px-2 py-1 rounded-lg font-mono border transition-colors cursor-pointer ${
                        theme === 'light'
                          ? 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                      }`}
                      title="Chèn nhỏ hơn hoặc bằng ≤ ($\le$)"
                    >
                      ≤
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('$', '$', '\\ge')}
                      className={`px-2 py-1 rounded-lg font-mono border transition-colors cursor-pointer ${
                        theme === 'light'
                          ? 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                      }`}
                      title="Chèn lớn hơn hoặc bằng ≥ ($\ge$)"
                    >
                      ≥
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('$', '$', '10^9')}
                      className={`px-2 py-1 rounded-lg font-mono border transition-colors cursor-pointer ${
                        theme === 'light'
                          ? 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                      }`}
                      title="Chèn giới hạn 10⁹ ($10^9$)"
                    >
                      10⁹
                    </button>
                  </div>
                </div>
              )}

              {/* Vùng soạn thảo / Chia đôi / Xem trước */}
              {viewMode === 'edit' && (
                <textarea
                  ref={textareaRef}
                  rows={13}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Gõ hoặc dán nội dung đề bài tại đây... (Hỗ trợ Markdown, công thức $N \le 10^5$, $10^9$...)"
                  className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-red-500 min-h-[280px]"
                />
              )}

              {viewMode === 'split' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <textarea
                      ref={textareaRef}
                      rows={14}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Gõ hoặc dán nội dung đề bài tại đây..."
                      className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-red-500 min-h-[320px] h-full"
                    />
                  </div>
                  <div className={`p-4 border rounded-2xl min-h-[320px] max-h-[500px] overflow-y-auto ${
                    theme === 'light'
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-slate-950 border-slate-800'
                  }`}>
                    <div className={`text-[11px] font-semibold uppercase tracking-wider mb-2 pb-1 border-b flex items-center justify-between ${
                      theme === 'light' ? 'text-slate-500 border-slate-200' : 'text-slate-400 border-slate-800'
                    }`}>
                      <span>Xem trước trực tiếp (KaTeX)</span>
                      <span className="text-[10px]">Thời gian thực</span>
                    </div>
                    <MathRenderer content={description || '*Chưa có nội dung đề bài*'} />
                  </div>
                </div>
              )}

              {viewMode === 'preview' && (
                <div className={`p-5 border rounded-2xl min-h-[300px] max-h-[550px] overflow-y-auto ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-slate-950 border-slate-800'
                }`}>
                  <div className={`text-[11px] font-semibold uppercase tracking-wider mb-3 pb-1 border-b ${
                    theme === 'light' ? 'text-slate-500 border-slate-200' : 'text-slate-400 border-slate-800'
                  }`}>
                    Bản xem trước hoàn chỉnh
                  </div>
                  <MathRenderer content={description || '*Chưa có nội dung đề bài*'} />
                </div>
              )}
            </div>

            {/* BẢNG VÍ DỤ (SAMPLE INPUT / SAMPLE OUTPUT) - Chỉ hiển thị ở Tab Tự soạn thảo */}
            {inputMode === 'manual' && (
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-3.5 bg-red-600 rounded-full inline-block"></span>
                      <span>Bảng Ví dụ (Sample Input / Sample Output):</span>
                    </label>
                    <p className={`text-[11px] mt-0.5 ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      Nhập các bộ dữ liệu mẫu minh họa cho bài toán. Tự động hiển thị dạng bảng 2 cột chuẩn đề thi Tin học và có nút Copy nhanh ở màn hình Học sinh.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSample}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-sm cursor-pointer ${
                      theme === 'light'
                        ? 'bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border-red-200'
                        : 'bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border-red-500/30'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm cặp ví dụ</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {samples.length === 0 ? (
                    <div
                      className={`p-6 rounded-2xl border border-dashed text-center space-y-2.5 ${
                        theme === 'light'
                          ? 'bg-slate-50 border-slate-300 text-slate-600'
                          : 'bg-slate-900/60 border-slate-700/60 text-slate-400'
                      }`}
                    >
                      <p className="text-xs">
                        Bài tập này hiện không có cặp ví dụ nào (tùy chọn, không bắt buộc).
                      </p>
                      <button
                        type="button"
                        onClick={handleAddSample}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-sm ${
                          theme === 'light'
                            ? 'bg-white hover:bg-red-50 text-red-600 border-red-200 hover:border-red-300'
                            : 'bg-slate-800 hover:bg-slate-700 text-red-400 border-slate-700'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 text-red-500" />
                        <span>Thêm cặp ví dụ</span>
                      </button>
                    </div>
                  ) : (
                    samples.map((sample, idx) => (
                      <div
                        key={sample.id || idx}
                        className={`p-4 rounded-2xl space-y-3 relative group border ${
                          theme === 'light'
                            ? 'bg-slate-50/80 border-slate-200'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className={`flex items-center justify-between pb-2 border-b ${
                          theme === 'light' ? 'border-slate-200' : 'border-slate-800/80'
                        }`}>
                          <span className="text-xs font-bold font-mono flex items-center gap-1.5">
                            <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                              theme === 'light'
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'bg-slate-800 text-red-400'
                            }`}>
                              Ví dụ #{idx + 1}
                            </span>
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveSample(idx)}
                            className={`p-1 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                              theme === 'light'
                                ? 'text-rose-600 hover:bg-rose-50 border border-rose-200 hover:border-rose-300'
                                : 'text-rose-400 hover:bg-rose-950/40 border border-rose-500/30 hover:border-rose-500/50'
                            }`}
                            title="Xóa cặp ví dụ này"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            <span>Xóa ví dụ</span>
                          </button>
                        </div>

                      {/* 2 cột đặt cạnh nhau trên 1 hàng */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                            <span>Ví dụ Input (Dữ liệu vào):</span>
                            <span className="text-[10px] text-slate-500 font-mono">stdin</span>
                          </label>
                          <textarea
                            rows={3}
                            value={sample.input}
                            onChange={(e) => handleUpdateSample(idx, 'input', e.target.value)}
                            placeholder="Ví dụ: 5 7"
                            className="w-full p-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-red-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                            <span>Ví dụ Output (Kết quả ra):</span>
                            <span className="text-[10px] text-slate-500 font-mono">stdout</span>
                          </label>
                          <textarea
                            rows={3}
                            value={sample.output}
                            onChange={(e) => handleUpdateSample(idx, 'output', e.target.value)}
                            placeholder="Ví dụ: 12"
                            className="w-full p-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-red-500"
                          />
                        </div>
                      </div>

                      {/* Giải thích ví dụ (tùy chọn) */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Giải thích ví dụ (tùy chọn):
                        </label>
                        <input
                          type="text"
                          value={sample.explanation || ''}
                          onChange={(e) => handleUpdateSample(idx, 'explanation', e.target.value)}
                          placeholder="Ví dụ: Tổng của 5 và 7 là 12..."
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  ))
                )}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Sticky Footer */}
        <div className={`shrink-0 p-4 border-t flex items-center justify-between sticky bottom-0 z-10 ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200'
            : 'bg-slate-800/90 border-slate-800'
        }`}>
          <div className={`text-xs flex items-center gap-1.5 hidden sm:flex ${
            theme === 'light' ? 'text-slate-500' : 'text-slate-400'
          }`}>
            <HelpCircle className="w-4 h-4 text-red-500" />
            <span>
              {inputMode === 'manual'
                ? 'Đã tối ưu cho đề thi Tin học. Bạn có thể lưu ngay mà không cần tải file.'
                : 'Sau khi lưu, bạn có thể nạp thêm bộ file Test chấm tự động Themis.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              form="problem-form"
              type="submit"
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-600/25 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" /> {problem ? 'Lưu thay đổi' : 'Tạo bài tập'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
