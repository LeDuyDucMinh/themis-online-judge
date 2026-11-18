import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Problem, SampleIO, TestCase } from '../../types/judge';
import { idbService } from '../../services/db';
import { apiService } from '../../services/apiService';
import { MathRenderer } from '../common/MathRenderer';
import {
  parseDocxFile,
  parseTextOrPdfFile,
  parseExcelFile,
} from '../../services/fileParserService';
import {
  X,
  Upload,
  Trash2,
  Paperclip,
  Plus,
  Loader2,
  AlertTriangle,
  ChevronDown,
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
  const { problems, topics, classes, addProblem, updateProblem, showToast } = useJudge();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (problem) return problem.classId || 'NONE';
    if (classId) return classId;
    return 'NONE';
  });

  const handleTopicChange = (newTopicId: string) => {
    setTopicId(newTopicId);
  };

  // Mode Tab: 'manual' (Tự soạn thảo / Paste) vs 'file' (Đính kèm File)
  const [inputMode, setInputMode] = useState<'manual' | 'file'>('manual');

  // Form states
  const [code, setCode] = useState(problem?.code || '');
  const [title, setTitle] = useState(problem?.title || '');
  const [author, setAuthor] = useState(problem?.author || 'Thầy Minh (FAMINH)');
  const [topicId, setTopicId] = useState(() => {
    if (problem) return problem.topicId || '';
    if (initialTopicId !== undefined) return initialTopicId;
    return topics[0]?.id || '';
  });

  // Phát hiện trùng mã bài tập theo thời gian thực (giúp giáo viên nhận biết ngay khi đang gõ)
  const duplicateProblem = useMemo(() => {
    const clean = code.trim().toUpperCase().replace(/\s+/g, '_');
    if (!clean) return null;
    return problems.find((p) => p.code.trim().toUpperCase() === clean && p.id !== problem?.id) || null;
  }, [code, problems, problem?.id]);

  const duplicateTopic = useMemo(() => {
    if (!duplicateProblem || !duplicateProblem.topicId) return null;
    return topics.find((t) => t.id === duplicateProblem.topicId) || null;
  }, [duplicateProblem, topics]);

  // Gợi ý mã bài tập mới không trùng lặp (ví dụ: CD2_BAI2)
  const suggestedCode = useMemo(() => {
    const clean = code.trim().toUpperCase().replace(/\s+/g, '_');
    if (!clean) return '';
    const currentTopic = topics.find((t) => t.id === topicId);
    let prefix = 'CD';
    if (currentTopic && currentTopic.name) {
      const match = currentTopic.name.match(/CĐ\s*(\d+)|CD\s*(\d+)/i);
      if (match) {
        prefix = `CD${match[1] || match[2]}`;
      } else {
        const firstWord = currentTopic.name.split(/[\s-]+/)[0].replace(/[^a-zA-Z0-9]/g, '');
        if (firstWord) prefix = firstWord.toUpperCase();
      }
    }
    const candidate = `${prefix}_${clean}`;
    if (problems.some((p) => p.code.trim().toUpperCase() === candidate && p.id !== problem?.id)) {
      return `${candidate}_NEW`;
    }
    return candidate;
  }, [code, topicId, topics, problems, problem?.id]);
  const [difficulty, setDifficulty] = useState<string>(
    problem?.difficulty || 'Trung bình'
  );
  const [timeLimit, setTimeLimit] = useState(problem?.timeLimit || 1.0);
  const [memoryLimit, setMemoryLimit] = useState(problem?.memoryLimit || 1024);
  const [totalPoints, setTotalPoints] = useState(problem?.totalPoints || 10);
  const [description, setDescription] = useState(problem?.description || '');
  const [attachedFile, setAttachedFile] = useState<Problem['attachedFile']>(
    problem?.attachedFile
  );

  // Danh sách bài tập chỉ mang tên file đính kèm; tải nội dung gốc khi mở chỉnh sửa
  // (nếu chưa tải kịp, lúc lưu hệ thống sẽ giữ nguyên file hiện có trên Cloud).
  useEffect(() => {
    const f = problem?.attachedFile;
    if (!problem || !f || f.dataUrl || f.rawHtml) return;
    let cancelled = false;
    apiService
      .fetchProblemAttachment(problem.id)
      .then((full) => {
        if (cancelled || !full) return;
        setAttachedFile((prev) => (prev && !prev.dataUrl && !prev.rawHtml ? full : prev));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [problem?.id]);

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
      const hasContent = (tests?: TestCase[] | null) =>
        Boolean(tests && tests.length > 0 && tests.some((t) => (t.input && t.input.trim()) || (t.expectedOutput && t.expectedOutput.trim())));
      if (problem && !hasContent(problem.testCases)) {
        let dbTests = await idbService.getTestCases(problem.id);
        if (!hasContent(dbTests)) {
          dbTests = await apiService.fetchTestCases(problem.id);
        }
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

    if (isSubmitting) return;

    setFormError(null);

    if (!code.trim()) {
      const msg = 'Vui lòng nhập Mã bài tập (ví dụ: TONG2SO, BAI_02, XAU)';
      setFormError(msg);
      showToast('Thiếu thông tin', msg, 'warning');
      return;
    }

    const finalCode = code.trim().toUpperCase().replace(/\s+/g, '_');
    const finalTitle = title.trim() || finalCode;

    // Kiểm tra trùng mã bài tập với các bài tập đã có
    const duplicate = problems.find(
      (p) => p.code.trim().toUpperCase() === finalCode && p.id !== problem?.id
    );
    if (duplicate) {
      const dupTopic = duplicate.topicId ? topics.find((t) => t.id === duplicate.topicId) : null;
      const topicInfo = dupTopic ? ` trong chủ đề "${dupTopic.name}"` : '';
      const suggestion = suggestedCode || `CD2_${finalCode}`;
      const msg = `Mã bài tập "${finalCode}" đã tồn tại${topicInfo}. Mỗi bài tập trên hệ thống cần có một mã riêng biệt để tránh nhầm lẫn khi chấm bài. Vui lòng đổi mã khác (gợi ý: ${suggestion}).`;
      setFormError(msg);
      showToast('Trùng mã bài tập', msg, 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      // Lọc bỏ những cặp ví dụ hoàn toàn trống
      const validSamples = samples.filter(
        (s) => s.input.trim().length > 0 || s.output.trim().length > 0
      );

      let targetClassId = selectedClassId || problem?.classId || classId || 'NONE';
      if (targetClassId !== 'NONE' && (!targetClassId || targetClassId === 'class_default_faminh')) {
        targetClassId = classes[0]?.id || 'NONE';
      }

      const targetPoints = Number(totalPoints) || 10;
      const rawTests = testCases.length > 0 ? testCases : (problem?.testCases || []);
      const scaledTests = rawTests.map((tc, idx, arr) => {
        const pts = +(targetPoints / arr.length).toFixed(2);
        return {
          ...tc,
          points: idx === arr.length - 1 ? +(targetPoints - pts * (arr.length - 1)).toFixed(2) : pts,
        };
      });

      const problemData = {
        code: finalCode,
        title: finalTitle,
        classId: targetClassId,
        author: author.trim() || 'Thầy Minh (FAMINH)',
        topicId,
        difficulty: difficulty.trim() || 'Trung bình',

        timeLimit: Number(timeLimit) || 1.0,
        memoryLimit: Number(memoryLimit) || 1024,
        totalPoints: targetPoints,
        description,
        inputFormat: problem?.inputFormat || '',
        outputFormat: problem?.outputFormat || '',
        constraints: problem?.constraints || '',
        samples: validSamples,
        attachedFile,
        testCases: scaledTests,
        videoConfig: problem?.videoConfig || {
          enabled: false,
          type: 'youtube',
          url: '',
          unlockRule: 'always',
        },
        starterCode: problem?.starterCode,
      };

      if (problem) {
        await updateProblem(problem.id, problemData);
      } else {
        await addProblem(problemData);
      }
      onClose();
    } catch (err: unknown) {
      console.error('[ProblemEditorModal] Lỗi lưu bài tập:', err);
      let msg = (err as Error)?.message || 'Không thể lưu bài tập vào cơ sở dữ liệu';
      if (msg.includes('23505') || msg.includes('problems_code_key') || msg.includes('duplicate key')) {
        const suggestion = suggestedCode || `CD2_${finalCode}`;
        msg = `Mã bài tập "${finalCode}" đã tồn tại trên hệ thống. Vui lòng đổi sang mã khác (ví dụ: ${suggestion}).`;
      }
      setFormError(msg);
      showToast('Lỗi lưu bài tập', msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border border-[#D9D2C3] rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative font-sans">
        {/* Header matching Mockup */}
        <div className="shrink-0 px-6 py-5 border-b border-[#D9D2C3] flex items-start justify-between bg-white">
          <div>
            <h3 className="text-xl font-bold text-[#1F1D1A]">
              {problem ? 'Chỉnh sửa đề bài' : 'Tạo đề bài mới'}
            </h3>
            <p className="text-xs text-[#6B655C] mt-1">
              Soạn đề trực tiếp hoặc đính kèm file Word/PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#6B655C] hover:text-[#1F1D1A] rounded-lg transition-colors cursor-pointer"
            title="Đóng (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs matching Mockup */}
        <div className="shrink-0 flex items-center gap-8 px-6 border-b border-[#D9D2C3] bg-white">
          <button
            type="button"
            onClick={() => setInputMode('manual')}
            className={`py-3 text-xs font-bold transition-all relative cursor-pointer ${
              inputMode === 'manual'
                ? 'text-[#1F1D1A] border-b-2 border-[#B4281F]'
                : 'text-[#6B655C] hover:text-[#1F1D1A]'
            }`}
          >
            Tự soạn thảo
          </button>
          <button
            type="button"
            onClick={() => setInputMode('file')}
            className={`py-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
              inputMode === 'file'
                ? 'text-[#1F1D1A] border-b-2 border-[#B4281F]'
                : 'text-[#6B655C] hover:text-[#1F1D1A]'
            }`}
          >
            <span>Đính kèm file đề (Word/PDF)</span>
            {attachedFile && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Form Body matching Mockup */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* File Upload Box if file mode */}
          {inputMode === 'file' && (
            <div className="p-4 rounded-xl border border-[#D9D2C3] bg-[#FAF7EE] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#B4281F] flex items-center gap-1.5 uppercase">
                    <Paperclip className="w-4 h-4" /> Đính kèm File Đề Thi Gốc (.DOCX / .PDF)
                  </span>
                  <p className="text-xs text-[#6B655C] mt-1 max-w-xl">
                    Tải lên file Word hoặc PDF để học sinh được xem nguyên bản tài liệu đề thi và tải file về.
                  </p>
                </div>
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#B4281F] hover:bg-[#961F17] text-white text-xs font-bold transition-all shadow-sm">
                  <Upload className="w-4 h-4" />
                  <span>{isImporting ? 'Đang tải file...' : 'Chọn file Word (.docx) hoặc PDF'}</span>
                  <input
                    type="file"
                    accept=".docx,.pdf,.xlsx,.xls,.txt"
                    onChange={handleFileUpload}
                    disabled={isImporting}
                    className="hidden"
                  />
                </label>
              </div>

              {attachedFile && (
                <div className="p-3 rounded-lg border border-[#D9D2C3] bg-white flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-50 text-[#B4281F] flex items-center justify-center font-bold text-xs uppercase border border-red-200">
                      {attachedFile.type}
                    </div>
                    <div>
                      <span className="font-bold block text-[#1F1D1A]">{attachedFile.name}</span>
                      <span className="text-[11px] text-[#6B655C]">
                        {(attachedFile.size / 1024).toFixed(1)} KB • Giữ nguyên định dạng gốc
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(undefined)}
                    className="px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Gỡ file
                  </button>
                </div>
              )}
            </div>
          )}

          {formError && (
            <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-xs text-rose-900 flex items-center justify-between gap-2">
              <span>{formError}</span>
              <button type="button" onClick={() => setFormError(null)} className="text-rose-600 hover:text-rose-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form id="problem-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Mã bài & Tiêu đề bài tập */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#1F1D1A]">
                    Mã bài (bắt buộc)
                  </label>
                  {duplicateProblem && (
                    <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Trùng mã bài
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Ví dụ: TONG2SO, BAI_02, XAU"
                  required
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-medium placeholder:text-[#9E988F] focus:outline-none transition-all ${
                    duplicateProblem
                      ? 'border-amber-500 bg-amber-50/70 text-amber-950 font-bold'
                      : 'border-[#D9D2C3] bg-white text-[#1F1D1A] focus:border-[#1F1D1A]'
                  }`}
                />
                {duplicateProblem && (
                  <div className="mt-2 p-2.5 rounded-xl border border-amber-300 bg-amber-50 text-[11px] text-amber-950 space-y-1.5">
                    <div className="flex items-start gap-1.5 leading-snug">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Mã <b>{code.trim().toUpperCase()}</b> đã được dùng
                        {duplicateTopic ? ` ở chủ đề "${duplicateTopic.name}"` : ' cho bài khác'}.
                      </span>
                    </div>
                    {suggestedCode && (
                      <div className="pt-1.5 border-t border-amber-200 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold text-amber-900">Gợi ý đổi:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCode(suggestedCode);
                            if (formError) setFormError(null);
                          }}
                          className="px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-amber-200 hover:bg-amber-300 text-amber-950 border border-amber-400 cursor-pointer"
                        >
                          {suggestedCode}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1D1A] mb-1.5">
                  Tiêu đề bài tập (không bắt buộc)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Bài 2 - Tính tổng các số chẵn"
                  className="w-full px-3.5 py-2.5 border border-[#D9D2C3] rounded-xl text-xs font-medium text-[#1F1D1A] placeholder:text-[#9E988F] bg-white focus:outline-none focus:border-[#1F1D1A] transition-all"
                />
              </div>
            </div>

            {/* Row 2: Giao vào lớp & Chủ đề */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1F1D1A] mb-1.5">
                  Giao vào lớp (bắt buộc)
                </label>
                <div className="relative">
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 pr-8 border border-[#D9D2C3] rounded-xl text-xs font-medium text-[#1F1D1A] bg-white focus:outline-none focus:border-[#1F1D1A] cursor-pointer"
                  >
                    <option value="NONE">
                      Không giao vào lớp nào (kho lưu trữ)
                    </option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.className} (Mã: {c.joinCode})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#6B655C] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1D1A] mb-1.5">
                  Chủ đề
                </label>
                <div className="relative">
                  <select
                    value={topicId}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 pr-8 border border-[#D9D2C3] rounded-xl text-xs font-medium text-[#1F1D1A] bg-white focus:outline-none focus:border-[#1F1D1A] cursor-pointer"
                  >
                    <option value="">-- Chưa phân vào chủ đề --</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#6B655C] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Row 3: Tác giả / nguồn đề & Độ khó */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1F1D1A] mb-1.5">
                  Tác giả / nguồn đề (bắt buộc)
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Ví dụ: Thầy Minh (FAMINH)"
                  className="w-full px-3.5 py-2.5 border border-[#D9D2C3] rounded-xl text-xs font-medium text-[#1F1D1A] placeholder:text-[#9E988F] bg-white focus:outline-none focus:border-[#1F1D1A] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1D1A] mb-1.5">
                  Độ khó
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['Dễ', 'Trung bình', 'Khó', 'Nâng cao'].map((lvl) => {
                    const isSelected = (difficulty || 'Trung bình').trim().toLowerCase() === lvl.toLowerCase();
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setDifficulty(lvl)}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border text-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#1F1D1A] text-white border-[#1F1D1A] shadow-sm'
                            : 'bg-white text-[#1F1D1A] border-[#D9D2C3] hover:bg-[#F2ECE1]'
                        }`}
                      >
                        {lvl}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 4: Nội dung đề bài & Toolbar matching Mockup */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#1F1D1A]">
                  {inputMode === 'manual' ? 'Nội dung đề bài' : 'Mô tả tóm tắt / Hướng dẫn thêm'}
                </label>
                <div className="flex items-center gap-5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setViewMode('edit')}
                    className={`pb-1 transition-all cursor-pointer ${
                      viewMode === 'edit'
                        ? 'text-[#1F1D1A] border-b-2 border-[#B4281F]'
                        : 'text-[#6B655C] hover:text-[#1F1D1A]'
                    }`}
                  >
                    Soạn thảo
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('split')}
                    className={`pb-1 transition-all cursor-pointer ${
                      viewMode === 'split'
                        ? 'text-[#1F1D1A] border-b-2 border-[#B4281F]'
                        : 'text-[#6B655C] hover:text-[#1F1D1A]'
                    }`}
                  >
                    Chia đôi
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('preview')}
                    className={`pb-1 transition-all cursor-pointer ${
                      viewMode === 'preview'
                        ? 'text-[#1F1D1A] border-b-2 border-[#B4281F]'
                        : 'text-[#6B655C] hover:text-[#1F1D1A]'
                    }`}
                  >
                    Xem trước
                  </button>
                </div>
              </div>

              {/* Formatting toolbar matching Image 2 */}
              {viewMode !== 'preview' && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleInsertTemplate}
                    className="px-3 py-1.5 rounded-lg border border-[#D9D2C3] bg-white text-xs font-medium text-[#1F1D1A] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
                  >
                    Chèn khung đề mẫu
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor('**', '**', 'chữ in đậm')}
                    className="w-8 h-8 rounded-lg border border-[#D9D2C3] bg-white text-xs font-bold text-[#1F1D1A] hover:bg-[#F2ECE1] transition-colors flex items-center justify-center cursor-pointer"
                    title="In đậm"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor('*', '*', 'chữ in nghiêng')}
                    className="w-8 h-8 rounded-lg border border-[#D9D2C3] bg-white text-xs italic font-serif text-[#1F1D1A] hover:bg-[#F2ECE1] transition-colors flex items-center justify-center cursor-pointer"
                    title="In nghiêng"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor('`', '`', 'code')}
                    className="w-8 h-8 rounded-lg border border-[#D9D2C3] bg-white text-xs font-mono text-[#1F1D1A] hover:bg-[#F2ECE1] transition-colors flex items-center justify-center cursor-pointer"
                    title="Code"
                  >
                    &lt;&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor('$', '$', 'x')}
                    className="px-3 py-1.5 rounded-lg border border-[#D9D2C3] bg-white text-xs font-medium text-[#1F1D1A] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
                  >
                    Công thức $
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor('$', '$', 'x^2')}
                    className="px-2.5 py-1.5 rounded-lg border border-[#D9D2C3] bg-white text-xs font-mono text-[#1F1D1A] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
                  >
                    x²
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor('$', '$', '\\le')}
                    className="px-2.5 py-1.5 rounded-lg border border-[#D9D2C3] bg-white text-xs font-medium text-[#1F1D1A] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
                  >
                    ≤
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor('$', '$', '\\ge')}
                    className="px-2.5 py-1.5 rounded-lg border border-[#D9D2C3] bg-white text-xs font-medium text-[#1F1D1A] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
                  >
                    ≥
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor('$', '$', '10^n')}
                    className="px-2.5 py-1.5 rounded-lg border border-[#D9D2C3] bg-white text-xs font-mono text-[#1F1D1A] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
                  >
                    10ⁿ
                  </button>
                </div>
              )}

              {/* Textarea matching Image 2 */}
              {viewMode === 'edit' && (
                <textarea
                  ref={textareaRef}
                  rows={8}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Gõ hoặc dán đề bài vào đây. Hỗ trợ Markdown và công thức, ví dụ $N \le 10^5$."
                  className="w-full p-3.5 border border-[#D9D2C3] rounded-xl text-xs font-medium text-[#1F1D1A] placeholder:text-[#9E988F] bg-white leading-relaxed focus:outline-none focus:border-[#1F1D1A] min-h-[140px]"
                />
              )}

              {viewMode === 'split' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <textarea
                      ref={textareaRef}
                      rows={9}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Gõ hoặc dán đề bài vào đây. Hỗ trợ Markdown và công thức, ví dụ $N \le 10^5$."
                      className="w-full p-3.5 border border-[#D9D2C3] rounded-xl text-xs font-medium text-[#1F1D1A] placeholder:text-[#9E988F] bg-white leading-relaxed focus:outline-none focus:border-[#1F1D1A] min-h-[200px]"
                    />
                  </div>
                  <div className="p-4 border border-[#D9D2C3] bg-[#FAF7EE] rounded-xl min-h-[200px] max-h-[350px] overflow-y-auto">
                    <div className="text-[11px] font-bold text-[#6B655C] uppercase tracking-wider mb-2 pb-1 border-b border-[#D9D2C3]">
                      Xem trước trực tiếp (KaTeX)
                    </div>
                    <MathRenderer content={description || '*Chưa có nội dung đề bài*'} />
                  </div>
                </div>
              )}

              {viewMode === 'preview' && (
                <div className="p-4 border border-[#D9D2C3] bg-[#FAF7EE] rounded-xl min-h-[200px] max-h-[400px] overflow-y-auto">
                  <div className="text-[11px] font-bold text-[#6B655C] uppercase tracking-wider mb-2 pb-1 border-b border-[#D9D2C3]">
                    Bản xem trước hoàn chỉnh
                  </div>
                  <MathRenderer content={description || '*Chưa có nội dung đề bài*'} />
                </div>
              )}
            </div>

            {/* Ví dụ mẫu (Sample Input / Output) - Tùy chọn */}
            {inputMode === 'manual' && (
              <details className="pt-2 border-t border-[#D9D2C3] group">
                <summary className="text-xs font-bold text-[#6B655C] hover:text-[#1F1D1A] cursor-pointer flex items-center justify-between py-1 select-none">
                  <span>Ví dụ Input / Output mẫu ({samples.filter(s => s.input || s.output).length} ví dụ)</span>
                  <span className="text-[11px] text-[#9E988F] group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="space-y-3 pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-[#6B655C]">
                      Nhập bộ dữ liệu mẫu minh họa. Học sinh có thể xem và copy nhanh trong giao diện làm bài.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddSample}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-[#D9D2C3] bg-white text-[#1F1D1A] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#B4281F]" /> Thêm ví dụ
                    </button>
                  </div>

                  {samples.map((sample, idx) => (
                    <div key={sample.id || idx} className="p-3.5 rounded-xl border border-[#D9D2C3] bg-[#FAF7EE] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1F1D1A]">Ví dụ #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSample(idx)}
                          className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#1F1D1A] mb-1">Input:</label>
                          <textarea
                            rows={2}
                            value={sample.input}
                            onChange={(e) => handleUpdateSample(idx, 'input', e.target.value)}
                            placeholder="Ví dụ: 5 7"
                            className="w-full p-2 border border-[#D9D2C3] bg-white rounded-lg text-xs font-mono text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#1F1D1A] mb-1">Output:</label>
                          <textarea
                            rows={2}
                            value={sample.output}
                            onChange={(e) => handleUpdateSample(idx, 'output', e.target.value)}
                            placeholder="Ví dụ: 12"
                            className="w-full p-2 border border-[#D9D2C3] bg-white rounded-lg text-xs font-mono text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#6B655C] mb-1">Giải thích (tùy chọn):</label>
                        <input
                          type="text"
                          value={sample.explanation || ''}
                          onChange={(e) => handleUpdateSample(idx, 'explanation', e.target.value)}
                          placeholder="Ví dụ: 5 + 7 = 12"
                          className="w-full px-2.5 py-1.5 border border-[#D9D2C3] bg-white rounded-lg text-xs text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </form>
        </div>

        {/* Footer matching Mockup */}
        <div className="shrink-0 px-6 py-4 border-t border-[#D9D2C3] flex items-center justify-between bg-white">
          <div className="text-xs text-[#6B655C]">
            Đã tối ưu cho đề thi Tin học. Bạn có thể lưu ngay mà không cần tải file.
          </div>
          <button
            form="problem-form"
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-[#B4281F] hover:bg-[#961F17] text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang lưu...</span>
              </div>
            ) : (
              <span>{problem ? 'Lưu bài tập' : 'Tạo bài tập'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
