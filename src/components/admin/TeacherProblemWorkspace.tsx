import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Problem, SampleIO, TestCase, VideoConfig } from '../../types/judge';
import { apiService } from '../../services/apiService';
import { MathRenderer } from '../common/MathRenderer';
import {
  parseDocxFile,
  parseTextOrPdfFile,
  parseExcelFile,
  inspectThemisZipForUpload,
  inspectThemisFilesForUpload,
  packThemisUploadToZipParts,
  type FastUploadPackage,
  type PairedTestUploadItem,
} from '../../services/fileParserService';
import { getProblemAssignedClasses } from '../../utils/teacherMetrics';
import { Loader2, Paperclip, Upload, FolderArchive, Plus, Trash2, AlertTriangle } from 'lucide-react';

interface TeacherProblemWorkspaceProps {
  problemId: string | 'NEW';
  initialTopicId?: string;
  initialClassId?: string;
  focusSection?: 'info' | 'de' | 'test' | 'giao';
  onClose: () => void;
  onSavedProblemId?: (id: string) => void;
}

const DIFFICULTY_PRESETS = ['Dễ', 'Trung bình', 'Khó', 'Nâng cao'];

const formatSizeMb = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

const parseDecimalInput = (raw: string): number => {
  const normalized = raw.replace(',', '.').trim();
  if (!normalized || normalized === '.' || normalized === '-') return NaN;
  const val = parseFloat(normalized);
  return Number.isFinite(val) ? val : NaN;
};

const formatPointValue = (val: number): string => {
  if (!Number.isFinite(val)) return '0';
  return Number(val.toFixed(3)).toString();
};

const formatPointDisplayVi = (val: number): string => {
  return formatPointValue(val).replace('.', ',');
};

const distributePointsEvenly = (tests: TestCase[], target: number): TestCase[] => {
  if (tests.length === 0 || !(target > 0)) return tests;
  const pts = +(target / tests.length).toFixed(3);
  return tests.map((tc, idx, arr) => ({
    ...tc,
    points: idx === arr.length - 1 ? +(target - pts * (arr.length - 1)).toFixed(3) : pts,
  }));
};

export const TeacherProblemWorkspace: React.FC<TeacherProblemWorkspaceProps> = ({
  problemId,
  initialTopicId,
  initialClassId,
  focusSection,
  onClose,
  onSavedProblemId,
}) => {
  const {
    problems,
    topics,
    classes,
    adminEmail,
    addProblem,
    updateProblem,
    deleteProblem,
    updateTopic,
    refreshAllData,
    refreshProblemTestCounts,
    showToast,
    openConfirmModal,
  } = useJudge();

  const existingProblem = useMemo<Problem | null>(
    () => (problemId === 'NEW' ? null : problems.find((p) => p.id === problemId) || null),
    [problemId, problems]
  );

  // Anchor navigation state
  const [activeAnchor, setActiveAnchor] = useState<'info' | 'de' | 'mau' | 'test' | 'giao' | 'video'>(
    focusSection || 'info'
  );

  // 1. Thông tin bài
  const [code, setCode] = useState(existingProblem?.code || '');
  const [title, setTitle] = useState(existingProblem?.title || '');
  const [topicId, setTopicId] = useState(() => {
    if (existingProblem) return existingProblem.topicId || '';
    if (initialTopicId !== undefined) return initialTopicId;
    return topics[0]?.id || '';
  });
  const [difficulty, setDifficulty] = useState(existingProblem?.difficulty || 'Dễ');
  const [author, setAuthor] = useState(
    existingProblem?.author || adminEmail || 'leduyducminh@gmail.com'
  );
  const [timeLimit, setTimeLimit] = useState(String(existingProblem?.timeLimit ?? 1));
  const [memoryLimit, setMemoryLimit] = useState(String(existingProblem?.memoryLimit ?? 1024));
  const [totalPointsInput, setTotalPointsInput] = useState(() =>
    formatPointValue(existingProblem?.totalPoints ?? 10)
  );

  // 2. Đề bài & Đính kèm Word/PDF
  const [statementTab, setStatementTab] = useState<'edit' | 'split' | 'preview'>('edit');
  const [description, setDescription] = useState(existingProblem?.description || '');
  const [attachedFile, setAttachedFile] = useState<Problem['attachedFile']>(
    existingProblem?.attachedFile
  );
  const [isImportingFile, setIsImportingFile] = useState(false);

  // 3. Ví dụ mẫu
  const [samples, setSamples] = useState<SampleIO[]>(() => existingProblem?.samples || []);

  // 4. Test cases (chuẩn VNOI: chỉ tải metadata ~1KB, lazy-load 1 test khi Xem/Sửa)
  const [testCases, setTestCases] = useState<TestCase[]>(() => existingProblem?.testCases || []);
  const [pointDrafts, setPointDrafts] = useState<Record<string, string>>({});
  const [pendingUpload, setPendingUpload] = useState<FastUploadPackage | null>(null);
  const [dirtyManualIds, setDirtyManualIds] = useState<Set<string>>(new Set());
  const [testsMetaDirty, setTestsMetaDirty] = useState(false);
  const [showAllTests, setShowAllTests] = useState(false);
  const [showUploadDropzone, setShowUploadDropzone] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [isLoadingTestMeta, setIsLoadingTestMeta] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // 5. Video bài giảng
  const [videoConfig, setVideoConfig] = useState<VideoConfig>(
    () =>
      existingProblem?.videoConfig || {
        enabled: false,
        type: 'youtube',
        url: '',
        title: '',
        unlockRule: 'always',
      }
  );

  // Trạng thái lưu tổng
  const [isSaving, setIsSaving] = useState(false);
  const [saveStage, setSaveStage] = useState<{ label: string; percent: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [assigningClassId, setAssigningClassId] = useState<string | null>(null);

  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const looseFilesInputRef = useRef<HTMLInputElement>(null);

  // Scroll đến mục được yêu cầu (VD: bấm "Nạp test →" từ Tổng quan nhảy thẳng xuống #test)
  useEffect(() => {
    if (!focusSection) return;
    setActiveAnchor(focusSection);
    const t = setTimeout(() => {
      const el = document.getElementById(`gv2-prob-${focusSection}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(t);
  }, [focusSection, problemId]);

  // Tải metadata test (~1 KB) & file đính kèm gốc nếu bài cũ chỉ mang stub
  useEffect(() => {
    if (!existingProblem) return;
    let mounted = true;
    setIsLoadingTestMeta(true);
    apiService
      .fetchTestCasesMeta(existingProblem.id)
      .then((meta) => {
        if (mounted && meta) {
          setTestCases(meta);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsLoadingTestMeta(false);
      });

    const f = existingProblem.attachedFile;
    if (f && !f.dataUrl && !f.rawHtml) {
      apiService
        .fetchProblemAttachment(existingProblem.id)
        .then((full) => {
          if (mounted && full) {
            setAttachedFile((prev) => (prev && !prev.dataUrl && !prev.rawHtml ? full : prev));
          }
        })
        .catch(() => {});
    }

    return () => {
      mounted = false;
    };
  }, [existingProblem?.id]);

  // Phát hiện trùng mã bài
  const duplicateProblem = useMemo(() => {
    const clean = code.trim().toUpperCase().replace(/\s+/g, '_');
    if (!clean) return null;
    return problems.find((p) => p.code.trim().toUpperCase() === clean && p.id !== existingProblem?.id) || null;
  }, [code, problems, existingProblem?.id]);

  const currentTopic = useMemo(
    () => topics.find((t) => t.id === topicId) || null,
    [topics, topicId]
  );

  // Danh sách lớp đang được giao chủ đề chứa bài này
  const assignedClasses = useMemo(() => {
    const syntheticProblem: Problem = existingProblem
      ? { ...existingProblem, topicId }
      : {
          id: '__draft__',
          code: code || 'NEW',
          title: title || code || 'NEW',
          classId: initialClassId || 'NONE',
          topicId,
          difficulty,
          timeLimit: 1,
          memoryLimit: 1024,
          totalPoints: 10,
          description: '',
          inputFormat: '',
          outputFormat: '',
          constraints: '',
          samples: [],
          testCases: [],
          videoConfig,
          createdAt: '',
          updatedAt: '',
        };
    return getProblemAssignedClasses(syntheticProblem, topics, classes);
  }, [existingProblem, topicId, code, title, initialClassId, difficulty, videoConfig, topics, classes]);

  const assignedClassIdSet = useMemo(
    () => new Set(assignedClasses.map((c) => c.id)),
    [assignedClasses]
  );

  const parsedTotalPoints = useMemo(() => {
    const v = parseDecimalInput(totalPointsInput);
    return Number.isFinite(v) && v > 0 ? +v.toFixed(3) : 10;
  }, [totalPointsInput]);

  const currentPointsSum = useMemo(
    () => +testCases.reduce((sum, tc) => sum + (Number(tc.points) || 0), 0).toFixed(3),
    [testCases]
  );

  const scrollToSection = (id: 'info' | 'de' | 'mau' | 'test' | 'giao' | 'video') => {
    setActiveAnchor(id);
    const el = document.getElementById(`gv2-prob-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Chèn khung đề mẫu chuẩn
  const handleInsertTemplate = () => {
    const tpl = `### 1. Bài toán
Cho dãy số nguyên $A = (a_1, a_2, \\dots, a_n)$. Hãy tìm...

### 2. Dữ liệu vào (Input)
- Dòng đầu chứa số nguyên dương $N$ ($1 \\le N \\le 10^5$).
- Dòng thứ hai gồm $N$ số nguyên $a_1, a_2, \\dots, a_n$ ($|a_i| \\le 10^9$).

### 3. Dữ liệu ra (Output)
- In ra một số nguyên duy nhất là kết quả bài toán.

### 4. Ràng buộc
- 40% số test có $N \\le 10^3$.
- 60% số test có $N \\le 10^5$.`;
    if (description.trim() && !window.confirm('Thay nội dung đề hiện tại bằng khung đề mẫu chuẩn?')) {
      return;
    }
    setDescription(tpl);
  };

  // Đính kèm file Word / PDF / Excel
  const handleAttachStatementFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsImportingFile(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'docx') {
        const { text, html, dataUrl } = await parseDocxFile(file);
        setAttachedFile({ name: file.name, size: file.size, type: 'docx', dataUrl, rawHtml: html });
        if (!description.trim()) {
          setDescription(`### Đề thi đính kèm: **${file.name}**\n\n${text.slice(0, 300)}`);
        }
        if (!code.trim()) setCode(file.name.replace(/\.[^/.]+$/, '').toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
        showToast('Đã đính kèm file Word', `Đã gắn "${file.name}" vào đề bài.`, 'success');
      } else if (ext === 'pdf') {
        const { dataUrl } = await parseTextOrPdfFile(file);
        setAttachedFile({ name: file.name, size: file.size, type: 'pdf', dataUrl });
        if (!description.trim()) setDescription(`### Đề bài đính kèm PDF: **${file.name}**`);
        if (!code.trim()) setCode(file.name.replace(/\.[^/.]+$/, '').toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
        showToast('Đã đính kèm file PDF', `Đã gắn "${file.name}" vào đề bài.`, 'success');
      } else if (ext === 'xlsx' || ext === 'xls') {
        const parsed = await parseExcelFile(file);
        const first = parsed.problems?.[0];
        if (first) {
          if (first.code) setCode(first.code);
          if (first.title) setTitle(first.title);
          if (first.description) setDescription(first.description);
          if (first.timeLimit) setTimeLimit(String(first.timeLimit));
          if (first.memoryLimit) setMemoryLimit(String(first.memoryLimit));
          if (first.totalPoints) setTotalPointsInput(formatPointValue(first.totalPoints));
          showToast('Import Excel thành công', `Đã điền thông tin từ "${file.name}".`, 'success');
        }
      } else {
        const txt = await file.text();
        setDescription((prev) => (prev ? `${prev}\n\n${txt}` : txt));
        showToast('Đã đọc file văn bản', `Đã chèn nội dung từ "${file.name}".`, 'info');
      }
    } catch (err: unknown) {
      showToast('Không thể đọc file', (err as Error)?.message || 'Lỗi đọc file đính kèm', 'error');
    } finally {
      setIsImportingFile(false);
    }
  };

  // Nạp file .ZIP / Thư mục / File lẻ
  const handleZipSelect = async (file: File) => {
    setTestError(null);
    try {
      const pkg = await inspectThemisZipForUpload(file, parsedTotalPoints);
      const baseId = existingProblem?.id || 'draft';
      const mapped: TestCase[] = pkg.pairs.map((p, idx) => ({
        id: `${baseId}_tc_${idx + 1}`,
        name: p.name,
        input: '',
        expectedOutput: '',
        points: p.points,
        isHidden: p.isHidden,
      }));
      setTestCases(mapped);
      setPointDrafts({});
      setPendingUpload(pkg);
      setDirtyManualIds(new Set());
      setTestsMetaDirty(true);
      setExpandedTestId(null);
      setShowUploadDropzone(false);
      showToast('Đã nhận diện gói .ZIP', pkg.summary, 'success');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Không thể đọc file .ZIP';
      setTestError(msg);
      showToast('Lỗi đọc file .ZIP', msg, 'error');
    }
  };

  const handleDirectFilesSelect = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      await handleZipSelect(files[0]);
      return;
    }
    setTestError(null);
    try {
      const pkg = inspectThemisFilesForUpload(files, parsedTotalPoints);
      const baseId = existingProblem?.id || 'draft';
      const mapped: TestCase[] = pkg.pairs.map((p, idx) => ({
        id: `${baseId}_tc_${idx + 1}`,
        name: p.name,
        input: '',
        expectedOutput: '',
        points: p.points,
        isHidden: p.isHidden,
      }));
      setTestCases(mapped);
      setPointDrafts({});
      setPendingUpload(pkg);
      setDirtyManualIds(new Set());
      setTestsMetaDirty(true);
      setExpandedTestId(null);
      setShowUploadDropzone(false);
      showToast('Đã ghép cặp bộ test Themis', pkg.summary, 'success');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Không thể ghép cặp file test';
      setTestError(msg);
      showToast('Lỗi nạp file test', msg, 'error');
    }
  };

  const handleAutoDistributePoints = () => {
    if (testCases.length === 0) return;
    const distributed = distributePointsEvenly(testCases, parsedTotalPoints);
    setTestCases(distributed);
    setPointDrafts({});
    setTestsMetaDirty(true);
    showToast(
      'Đã chia đều điểm',
      `Chia đều ${formatPointValue(parsedTotalPoints)} điểm cho ${testCases.length} test.`,
      'success'
    );
  };

  const handleAddManualTest = () => {
    const nextIdx = testCases.length + 1;
    const baseId = existingProblem?.id || 'draft';
    const newId = `${baseId}_tc_m_${Date.now()}_${nextIdx}`;
    const defaultPts = +(parsedTotalPoints / Math.max(1, nextIdx)).toFixed(3);
    const newTc: TestCase = {
      id: newId,
      name: `Test #${String(nextIdx).padStart(2, '0')}`,
      input: '',
      expectedOutput: '',
      points: defaultPts,
      isHidden: nextIdx > 3,
    };
    setTestCases((prev) => [...prev, newTc]);
    setDirtyManualIds((prev) => new Set(prev).add(newId));
    setTestsMetaDirty(true);
    setShowAllTests(true);
    setExpandedTestId(newId);
  };

  const handleRemoveTest = (id: string) => {
    setTestCases((prev) => prev.filter((tc) => tc.id !== id));
    if (expandedTestId === id) setExpandedTestId(null);
    setDirtyManualIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setTestsMetaDirty(true);
  };

  const handleToggleInspectTest = async (tc: TestCase) => {
    if (expandedTestId === tc.id) {
      setExpandedTestId(null);
      return;
    }
    setExpandedTestId(tc.id);
    if (pendingUpload || tc.input || tc.expectedOutput || dirtyManualIds.has(tc.id)) return;
    setLoadingDetailId(tc.id);
    try {
      const full = await apiService.fetchSingleTestCase(tc.id);
      if (full) {
        setTestCases((prev) =>
          prev.map((item) =>
            item.id === tc.id
              ? { ...item, input: full.input, expectedOutput: full.expectedOutput }
              : item
          )
        );
      }
    } finally {
      setLoadingDetailId(null);
    }
  };

  // Giao / Bỏ giao chủ đề hiện tại cho 1 lớp cụ thể (1 chạm)
  const handleToggleAssignTopicToClass = async (clsId: string, assign: boolean) => {
    if (!currentTopic) {
      showToast('Chưa chọn chủ đề', 'Hãy chọn Chủ đề cho bài tập ở mục Thông tin trước khi giao lớp.', 'warning');
      scrollToSection('info');
      return;
    }
    setAssigningClassId(clsId);
    try {
      const existingIds =
        currentTopic.classIds && currentTopic.classIds.length > 0
          ? currentTopic.classIds
          : currentTopic.classId
          ? [currentTopic.classId]
          : [];
      let nextIds: string[];
      if (existingIds.includes('ALL')) {
        const allIds = classes.map((c) => c.id);
        nextIds = assign ? allIds : allIds.filter((id) => id !== clsId);
      } else if (assign) {
        nextIds = Array.from(new Set([...existingIds, clsId]));
      } else {
        nextIds = existingIds.filter((id) => id !== clsId);
      }
      await updateTopic(currentTopic.id, {
        classIds: nextIds,
        classId: nextIds[0] || '',
      });
      const clsName = classes.find((c) => c.id === clsId)?.className || 'lớp học';
      showToast(
        assign ? 'Đã giao cho lớp' : 'Đã gỡ khỏi lớp',
        assign
          ? `Chủ đề "${currentTopic.name}" đã được giao cho lớp ${clsName}.`
          : `Đã gỡ chủ đề "${currentTopic.name}" khỏi lớp ${clsName}.`,
        'success'
      );
    } catch (err: unknown) {
      showToast('Không thể cập nhật giao lớp', (err as Error)?.message || 'Lỗi lưu lên Cloud', 'error');
    } finally {
      setAssigningClassId(null);
    }
  };

  // LƯU TOÀN BỘ BÀI TẬP + BỘ TEST TRONG 1 BẤM
  const handleSaveAll = async () => {
    if (isSaving) return;
    setFormError(null);
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '_');
    if (!cleanCode) {
      setFormError('Vui lòng nhập Mã bài (VD: ARRZIP, TONG2SO).');
      scrollToSection('info');
      return;
    }
    if (duplicateProblem) {
      setFormError(`Mã bài "${cleanCode}" đã tồn tại trên hệ thống. Vui lòng chọn mã khác.`);
      scrollToSection('info');
      return;
    }

    const finalTitle = title.trim() || cleanCode;
    const tl = parseDecimalInput(timeLimit);
    const finalTimeLimit = Number.isFinite(tl) && tl > 0 ? tl : 1;
    const ml = parseInt(memoryLimit, 10);
    const finalMemoryLimit = Number.isFinite(ml) && ml > 0 ? ml : 1024;
    const validSamples = samples.filter(
      (s) => s.input.trim().length > 0 || s.output.trim().length > 0
    );

    setIsSaving(true);
    setSaveStage({ label: 'Đang lưu thông tin bài tập...', percent: 12 });

    try {
      let targetProblemId = existingProblem?.id || '';
      const basePayload = {
        code: cleanCode,
        title: finalTitle,
        classId: existingProblem?.classId || initialClassId || 'NONE',
        author: author.trim() || adminEmail || 'Thầy Minh (FAMINH)',
        topicId,
        difficulty: difficulty.trim() || 'Dễ',
        timeLimit: finalTimeLimit,
        memoryLimit: finalMemoryLimit,
        totalPoints: parsedTotalPoints,
        description,
        inputFormat: existingProblem?.inputFormat || '',
        outputFormat: existingProblem?.outputFormat || '',
        constraints: existingProblem?.constraints || '',
        samples: validSamples,
        attachedFile,
        videoConfig,
        starterCode: existingProblem?.starterCode,
      };

      // Nếu là bài mới -> tạo bài trong bảng `problems` trước để lấy `id`
      if (!existingProblem) {
        const created = await addProblem({
          ...basePayload,
          testCases: [],
        });
        targetProblemId = created.id;
      }

      // 2. Xử lý lưu Test Case (chỉ chạy khi có gói .ZIP mới HOẶC giáo viên có sửa điểm/test)
      if (pendingUpload) {
        const oldBaseId = existingProblem?.id || 'draft';
        const pairById = new Map<string, PairedTestUploadItem>();
        pendingUpload.pairs.forEach((p, idx) => {
          pairById.set(`${oldBaseId}_tc_${idx + 1}`, p);
        });

        let finalizedTests = [...testCases];
        const sumNow = finalizedTests.reduce((acc, tc) => acc + (Number(tc.points) || 0), 0);
        if (finalizedTests.length > 0 && Math.abs(sumNow - parsedTotalPoints) > 0.05) {
          finalizedTests = distributePointsEvenly(finalizedTests, parsedTotalPoints);
        }

        const activeZipPairs: PairedTestUploadItem[] = [];
        for (const tc of finalizedTests) {
          const matched = pairById.get(tc.id);
          if (matched) activeZipPairs.push(matched);
        }

        if (activeZipPairs.length > 0) {
          setSaveStage({ label: 'Đang nén gói test .ZIP...', percent: 25 });
          const parts = await packThemisUploadToZipParts(
            pendingUpload,
            activeZipPairs,
            (label, percent) => setSaveStage({ label, percent })
          );

          const uploadVersion = Date.now();
          const pairToPointerBase = new Map<PairedTestUploadItem, string>();
          const uploadedObjectPaths: string[] = [];

          for (let partIdx = 0; partIdx < parts.length; partIdx++) {
            const part = parts[partIdx];
            const partMb = formatSizeMb(part.blob.size);
            const partPrefix =
              parts.length > 1
                ? `Đang tải gói ${partIdx + 1}/${parts.length} (${partMb})`
                : `Đang tải file .ZIP (${partMb})`;
            const uploaded = await apiService.uploadTestCasesZip(
              targetProblemId,
              part.blob,
              (pct) => {
                const overall = Math.round(((partIdx + pct / 100) / parts.length) * 90);
                setSaveStage({ label: `${partPrefix}: ${pct}%`, percent: overall });
              },
              {
                version: uploadVersion,
                partIndex: parts.length > 1 ? partIdx + 1 : undefined,
                skipCleanup: true,
              }
            );
            uploadedObjectPaths.push(uploaded.objectPath);
            const pointerBase = `__STORAGE_ZIP__:${uploaded.bucket}/${uploaded.objectPath}?v=${uploaded.version}`;
            for (const p of part.pairs) pairToPointerBase.set(p, pointerBase);
          }

          void apiService.cleanupOldTestCasesZips(targetProblemId, uploadedObjectPaths);

          const pointerTests: TestCase[] = finalizedTests.map((tc, idx) => {
            const matched = pairById.get(tc.id);
            const pointerBase = matched ? pairToPointerBase.get(matched) : undefined;
            const realId = `${targetProblemId}_tc_${idx + 1}`;
            if (matched && pointerBase) {
              return {
                ...tc,
                id: realId,
                input: `${pointerBase}#${matched.inputEntryName}`,
                expectedOutput: `${pointerBase}#${matched.outputEntryName}`,
              };
            }
            return {
              ...tc,
              id: realId,
              input: (tc.input || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
              expectedOutput: (tc.expectedOutput || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
            };
          });

          setSaveStage({ label: 'Đang lưu cấu hình bài và test...', percent: 95 });
          if (existingProblem) {
            await updateProblem(targetProblemId, { ...basePayload, testCases: pointerTests });
          } else {
            await apiService.saveTestCases(targetProblemId, pointerTests);
          }
          setTestCases(pointerTests);
          setPendingUpload(null);
          setTestsMetaDirty(false);
          setDirtyManualIds(new Set());
        }
      } else {
        // Không có .ZIP mới: cập nhật thông tin bài trước (KHÔNG truyền testCases để không ghi đè input/output!)
        if (existingProblem) {
          await updateProblem(targetProblemId, basePayload);
        }

        // Chỉ chạm tới bảng `test_cases` nếu giáo viên thực sự có sửa test / điểm / thêm test thủ công
        if (testsMetaDirty || dirtyManualIds.size > 0) {
          setSaveStage({ label: 'Đang cập nhật điểm & test thủ công...', percent: 75 });
          const normalizedForSave = testCases.map((tc, idx) => ({
            ...tc,
            id: tc.id.startsWith('draft_')
              ? `${targetProblemId}_${tc.id.slice('draft_'.length)}`
              : tc.id,
            orderIndex: idx + 1,
          }));

          const manualItems = normalizedForSave.filter((_, idx) =>
            dirtyManualIds.has(testCases[idx].id)
          );
          if (manualItems.length > 0) {
            await apiService.upsertManualTestCases(
              targetProblemId,
              manualItems.map((tc) => ({
                ...tc,
                input: (tc.input || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
                expectedOutput: (tc.expectedOutput || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
              }))
            );
          }

          await apiService.updateTestCasesMetaOnly(
            targetProblemId,
            normalizedForSave.map((tc) => ({
              id: tc.id,
              name: tc.name,
              points: Number(tc.points) || 1,
              isHidden: Boolean(tc.isHidden),
            }))
          );

          setTestCases(normalizedForSave);
          setTestsMetaDirty(false);
          setDirtyManualIds(new Set());
        }
      }

      await refreshProblemTestCounts(true).catch(() => {});
      if (!existingProblem) {
        await refreshAllData().catch(() => {});
        onSavedProblemId?.(targetProblemId);
      }
      showToast('Đã lưu bài tập', `Bài [${cleanCode}] đã được lưu đồng bộ lên hệ thống.`, 'success');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Không thể lưu bài tập lên Cloud.';
      setFormError(msg);
      showToast('Lỗi lưu bài tập', msg, 'error');
    } finally {
      setIsSaving(false);
      setSaveStage(null);
    }
  };

  const handleDeleteCurrentProblem = () => {
    if (!existingProblem) return;
    openConfirmModal({
      title: `Xóa bài "${existingProblem.code}"`,
      message: `Bạn có chắc muốn xóa vĩnh viễn bài "${existingProblem.code}" cùng bộ test case khỏi Kho bài không?`,
      confirmLabel: 'Xóa bài',
      onConfirm: async () => {
        await deleteProblem(existingProblem.id);
        await refreshProblemTestCounts(true).catch(() => {});
        onClose();
      },
    });
  };

  const visibleTests = showAllTests ? testCases : testCases.slice(0, 3);
  const hiddenTestsCount = Math.max(0, testCases.length - visibleTests.length);

  return (
    <div
      className="banner-editorial-page w-full text-[#1F1D1A] animate-in fade-in duration-150"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {/* Header trang Sửa bài */}
      <div className="flex flex-wrap justify-between items-end gap-6 mb-6">
        <div className="min-w-0">
          <h1 className="font-mono text-[34px] sm:text-[36px] font-bold tracking-tight text-[#1F1D1A] leading-tight">
            {code.trim().toUpperCase() || 'BÀI MỚI'}
          </h1>
          <p className="text-[15px] text-[#6B655C] mt-1.5">
            Chủ đề {currentTopic?.name || 'Chưa chọn'} · {testCases.length} test · giao cho{' '}
            {assignedClasses.length} lớp
          </p>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          {existingProblem && (
            <button
              type="button"
              onClick={handleDeleteCurrentProblem}
              disabled={isSaving}
              className="text-[14.5px] font-medium text-[#6B655C] hover:text-[#B4281F] transition-colors cursor-pointer disabled:opacity-50"
            >
              Xóa bài
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-[15px] font-semibold text-[#1F1D1A] hover:text-[#B4281F] transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-[11px] rounded-[8px] bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[15px] font-semibold transition-colors cursor-pointer disabled:opacity-60"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isSaving ? 'Đang lưu...' : 'Lưu bài'}</span>
          </button>
        </div>
      </div>

      {/* Thanh tiến độ lưu / upload ZIP */}
      {saveStage && (
        <div className="mb-6 p-3.5 rounded-[8px] bg-[#FFFDF8] border border-[#D9D2C3]">
          <div className="flex items-center justify-between text-[13.5px] mb-1.5">
            <span className="font-medium text-[#1F1D1A]">{saveStage.label}</span>
            <span className="font-mono text-[#6B655C]">{saveStage.percent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#E4DDCE] overflow-hidden">
            <div
              className="h-full bg-[#B4281F] rounded-full transition-all duration-200"
              style={{ width: `${saveStage.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Báo lỗi chung nếu có */}
      {formError && (
        <div className="mb-6 p-3.5 rounded-[8px] bg-[#FFF1F0] border border-[#F2C0BC] text-[#8F1F18] text-[14px] flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Bố cục 2 cột: Mục lục neo trái (160px) + Nội dung 1 trang bên phải */}
      <div className="grid grid-cols-1 lg:grid-cols-[164px_1fr] gap-8 lg:gap-12 items-start">
        {/* Mục lục neo trái */}
        <nav className="lg:sticky lg:top-6 flex lg:grid gap-1 overflow-x-auto pb-2 lg:pb-0 text-[15px]">
          {(
            [
              { id: 'info', label: 'Thông tin' },
              { id: 'de', label: 'Đề bài' },
              { id: 'mau', label: `Ví dụ mẫu (${samples.length})` },
              { id: 'test', label: `Test (${testCases.length})` },
              { id: 'giao', label: 'Giao cho lớp' },
              { id: 'video', label: videoConfig.enabled ? 'Video (Bật)' : 'Video' },
            ] as const
          ).map((nav) => (
            <button
              key={nav.id}
              type="button"
              onClick={() => scrollToSection(nav.id)}
              className={`text-left px-3 py-[9px] rounded-[6px] whitespace-nowrap transition-colors cursor-pointer ${
                activeAnchor === nav.id
                  ? 'bg-[#E2DAC8] text-[#1F1D1A] font-semibold'
                  : 'text-[#3A362F] hover:bg-[#E6DFD0] hover:text-[#1F1D1A] font-medium'
              }`}
            >
              {nav.label}
            </button>
          ))}
        </nav>

        {/* Nội dung chính */}
        <div className="min-w-0">
          {/* 1. THÔNG TIN */}
          <section id="gv2-prob-info" className="mb-11 scroll-mt-6">
            <div className="border-t-2 border-[#1F1D1A] pt-[18px]">
              <h2 className="text-[22px] font-bold text-[#1F1D1A]">Thông tin</h2>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block font-semibold text-[14px] mb-1.5" htmlFor="gv2-ma">
                    Mã bài
                  </label>
                  <input
                    id="gv2-ma"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="VD: ARRZIP, TONG2SO"
                    className="w-full px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] font-mono text-[14.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                  />
                  {duplicateProblem && (
                    <p className="text-[12.5px] text-[#B4281F] mt-1">
                      Mã bài này đã tồn tại trên hệ thống. Hãy chọn mã khác.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-[14px] mb-1.5" htmlFor="gv2-tt">
                    Tiêu đề
                  </label>
                  <input
                    id="gv2-tt"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Không bắt buộc (để trống sẽ lấy theo mã bài)"
                    className="w-full px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14.5px] text-[#1F1D1A] placeholder-[#8C857B] focus:outline-none focus:border-[#1F1D1A]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[14px] mb-1.5" htmlFor="gv2-cd">
                    Chủ đề
                  </label>
                  <select
                    id="gv2-cd"
                    value={topicId}
                    onChange={(e) => setTopicId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                  >
                    <option value="">-- Chưa gắn chủ đề --</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="block font-semibold text-[14px] mb-1.5">Độ khó</div>
                  <div className="flex flex-wrap gap-2">
                    {DIFFICULTY_PRESETS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setDifficulty(lvl)}
                        className={`px-3.5 py-[7px] rounded-[6px] text-[14px] border transition-colors cursor-pointer ${
                          difficulty === lvl
                            ? 'banner-pill-active bg-[#1F1D1A] text-[#F4F0E8] border-[#1F1D1A] font-medium'
                            : 'bg-[#FFFDF8] text-[#1F1D1A] border-[#D9D2C3] hover:border-[#1F1D1A]'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[14px] mb-1.5" htmlFor="gv2-tg">
                    Tác giả / nguồn đề
                  </label>
                  <input
                    id="gv2-tg"
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-[14px] mb-1.5" htmlFor="gv2-tl">
                      Thời gian (giây)
                    </label>
                    <input
                      id="gv2-tl"
                      type="text"
                      inputMode="decimal"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] font-mono text-[14.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[14px] mb-1.5" htmlFor="gv2-bn">
                      Bộ nhớ (MB)
                    </label>
                    <input
                      id="gv2-bn"
                      type="number"
                      min={16}
                      value={memoryLimit}
                      onChange={(e) => setMemoryLimit(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] font-mono text-[14.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[14px] mb-1.5" htmlFor="gv2-td">
                      Thang điểm
                    </label>
                    <input
                      id="gv2-td"
                      type="text"
                      inputMode="decimal"
                      value={totalPointsInput}
                      onChange={(e) => setTotalPointsInput(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] font-mono text-[14.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. ĐỀ BÀI (Soạn thảo Markdown/KaTeX + Đính kèm Word/PDF) */}
          <section id="gv2-prob-de" className="mb-11 scroll-mt-6">
            <div className="border-t-2 border-[#1F1D1A] pt-[18px]">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h2 className="text-[22px] font-bold text-[#1F1D1A]">Đề bài</h2>
                <div className="flex flex-wrap items-center gap-4 text-[13.5px]">
                  <button
                    type="button"
                    onClick={handleInsertTemplate}
                    className="text-[#6B655C] hover:text-[#1F1D1A] underline underline-offset-3 cursor-pointer"
                  >
                    Chèn khung đề mẫu
                  </button>
                  <label className="inline-flex items-center gap-1.5 text-[#B4281F] hover:text-[#8F1F18] font-semibold cursor-pointer">
                    {isImportingFile ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Paperclip className="w-3.5 h-3.5" />
                    )}
                    <span>Đính kèm Word / PDF</span>
                    <input
                      type="file"
                      accept=".docx,.pdf,.xlsx,.xls,.txt,.md"
                      onChange={handleAttachStatementFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Thanh file đính kèm (nếu có) */}
              {attachedFile && (
                <div className="mt-3 px-3.5 py-2.5 rounded-[8px] bg-[#FFFDF8] border border-[#D9D2C3] flex items-center justify-between gap-3 text-[13.5px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2 py-0.5 rounded bg-[#EFE9DC] font-mono text-[11.5px] font-bold uppercase text-[#1F1D1A]">
                      {attachedFile.type}
                    </span>
                    <span className="font-semibold text-[#1F1D1A] truncate">{attachedFile.name}</span>
                    <span className="text-[#6B655C] shrink-0">
                      ({formatSizeMb(attachedFile.size || 0)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(undefined)}
                    className="text-[#B4281F] hover:underline font-medium shrink-0 cursor-pointer"
                  >
                    Gỡ file
                  </button>
                </div>
              )}

              <div className="mt-4">
                <div className="flex items-center gap-5 mb-3">
                  {(
                    [
                      { id: 'edit', label: 'Soạn thảo' },
                      { id: 'split', label: 'Chia đôi' },
                      { id: 'preview', label: 'Xem trước' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setStatementTab(t.id)}
                      className={`pb-2 text-[14.5px] transition-colors cursor-pointer ${
                        statementTab === t.id
                          ? 'text-[#1F1D1A] font-semibold border-b-2 border-[#B4281F]'
                          : 'text-[#6B655C] hover:text-[#1F1D1A] font-medium border-b-2 border-transparent'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {statementTab === 'edit' && (
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={8}
                    placeholder="Chưa có đề bài. Gõ hoặc dán đề vào đây, hỗ trợ Markdown và công thức LaTeX ($a + b$)."
                    className="w-full px-3.5 py-3 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14.5px] text-[#1F1D1A] placeholder-[#8C857B] focus:outline-none focus:border-[#1F1D1A] resize-y"
                  />
                )}

                {statementTab === 'split' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={10}
                      placeholder="Gõ đề bài Markdown + LaTeX..."
                      className="w-full px-3.5 py-3 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] font-mono text-[13.5px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A] resize-y"
                    />
                    <div className="px-4 py-3 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] min-h-[220px] max-h-[420px] overflow-y-auto text-[14.5px]">
                      {description.trim() ? (
                        <MathRenderer content={description} />
                      ) : (
                        <span className="text-[#8C857B]">Chưa có nội dung để xem trước.</span>
                      )}
                    </div>
                  </div>
                )}

                {statementTab === 'preview' && (
                  <div className="px-4 py-3.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] min-h-[160px] text-[14.5px]">
                    {description.trim() ? (
                      <MathRenderer content={description} />
                    ) : (
                      <span className="text-[#8C857B]">Chưa có nội dung để xem trước.</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 3. VÍ DỤ MẪU */}
          <section id="gv2-prob-mau" className="mb-11 scroll-mt-6">
            <div className="border-t-2 border-[#1F1D1A] pt-[18px]">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-[22px] font-bold text-[#1F1D1A]">Ví dụ mẫu</h2>
                  <p className="text-[14px] text-[#6B655C] mt-0.5">
                    Cặp Input / Output minh họa hiển thị ngay dưới đề bài cho học sinh.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSamples((prev) => [
                      ...prev,
                      { id: `sample-${Date.now()}-${prev.length + 1}`, input: '', output: '', explanation: '' },
                    ])
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] border-[1.5px] border-[#1F1D1A] text-[13.5px] font-semibold text-[#1F1D1A] hover:bg-[#E9E2D3] transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm ví dụ</span>
                </button>
              </div>

              {samples.length === 0 ? (
                <div className="border-t border-b border-[#D9D2C3] py-4 text-[14px] text-[#6B655C]">
                  Chưa có ví dụ mẫu (không bắt buộc nếu đã có trong đề hoặc file đính kèm).
                </div>
              ) : (
                <div className="space-y-4">
                  {samples.map((s, idx) => (
                    <div
                      key={s.id || idx}
                      className="p-4 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[13.5px] text-[#1F1D1A]">
                          Ví dụ #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSamples((prev) => prev.filter((_, i) => i !== idx))}
                          className="inline-flex items-center gap-1 text-[12.5px] text-[#6B655C] hover:text-[#B4281F] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[12.5px] text-[#6B655C] mb-1">Input mẫu</label>
                          <textarea
                            rows={3}
                            value={s.input}
                            onChange={(e) =>
                              setSamples((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, input: e.target.value } : it))
                              )
                            }
                            className="w-full px-3 py-2 rounded-[6px] border border-[#D9D2C3] bg-white font-mono text-[13px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                          />
                        </div>
                        <div>
                          <label className="block text-[12.5px] text-[#6B655C] mb-1">Output mẫu</label>
                          <textarea
                            rows={3}
                            value={s.output}
                            onChange={(e) =>
                              setSamples((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, output: e.target.value } : it))
                              )
                            }
                            className="w-full px-3 py-2 rounded-[6px] border border-[#D9D2C3] bg-white font-mono text-[13px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={s.explanation || ''}
                        onChange={(e) =>
                          setSamples((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, explanation: e.target.value } : it))
                          )
                        }
                        placeholder="Giải thích ngắn cho ví dụ (không bắt buộc)"
                        className="w-full px-3 py-2 rounded-[6px] border border-[#D9D2C3] bg-white text-[13px] text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 4. TEST CASE (Chuẩn VNOI + auto-split ZIP <= 48 MB + điểm thập phân) */}
          <section id="gv2-prob-test" className="mb-11 scroll-mt-6">
            <div className="border-t-2 border-[#1F1D1A] pt-[18px]">
              <h2 className="text-[22px] font-bold text-[#1F1D1A]">Test</h2>
              <p className="text-[14px] text-[#6B655C] mt-1">
                Nạp bộ test dạng .ZIP, hệ thống tự ghép cặp .INP / .OUT (file lớn hơn 50 MB tự động tách gói).
              </p>

              {/* Input ẩn phục vụ chọn file .ZIP / thư mục / file lẻ */}
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void handleZipSelect(f);
                }}
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                // @ts-expect-error webkitdirectory is standard in Chromium/Edge/Firefox
                webkitdirectory=""
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) void handleDirectFilesSelect(files);
                  e.target.value = '';
                }}
              />
              <input
                ref={looseFilesInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) void handleDirectFilesSelect(files);
                  e.target.value = '';
                }}
              />

              {/* Thanh trạng thái test + nút Chia đều điểm / Nạp lại file .ZIP */}
              <div className="mt-5 flex flex-wrap items-center gap-3 mb-4">
                {testCases.length > 0 ? (
                  <>
                    <i className="inline-block w-[10px] h-[10px] rounded-[2px] bg-[#2F6B3F] shrink-0" />
                    <div className="text-[15px]">
                      <b className="text-[#2F6B3F]">
                        {pendingUpload
                          ? `Sẵn sàng tải lên ${testCases.length} test (bấm Lưu bài để đẩy lên Cloud)`
                          : `Đã nạp ${testCases.length} test lên Cloud`}
                      </b>{' '}
                      <span className="font-mono text-[13px] text-[#6B655C]">
                        tổng điểm {currentPointsSum} / {parsedTotalPoints}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <i className="inline-block w-[10px] h-[10px] rounded-[2px] bg-[#D69A1F] shrink-0" />
                    <div className="text-[15px]">
                      <b className="text-[#8A5A00]">
                        {isLoadingTestMeta ? 'Đang kiểm tra bộ test...' : 'Chưa có test nào'}
                      </b>
                    </div>
                  </>
                )}

                <span className="flex-1" />

                {testCases.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoDistributePoints}
                    className="px-3.5 py-1.5 rounded-[8px] border-[1.5px] border-[#1F1D1A] text-[14px] font-semibold text-[#1F1D1A] hover:bg-[#E9E2D3] transition-colors cursor-pointer"
                  >
                    Chia đều điểm
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowUploadDropzone((v) => !v)}
                  className="px-3.5 py-1.5 rounded-[8px] border-[1.5px] border-[#1F1D1A] text-[14px] font-semibold text-[#1F1D1A] hover:bg-[#E9E2D3] transition-colors cursor-pointer"
                >
                  {testCases.length > 0 ? 'Nạp lại file .ZIP' : 'Nạp file .ZIP'}
                </button>
              </div>

              {/* Vùng kéo thả nạp .ZIP / thư mục / file lẻ (tự mở khi 0 test hoặc bấm Nạp lại) */}
              {(showUploadDropzone || testCases.length === 0) && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files?.length) {
                      void handleDirectFilesSelect(e.dataTransfer.files);
                    }
                  }}
                  className={`mb-5 p-6 rounded-[10px] border border-dashed text-center transition-colors ${
                    isDragOver
                      ? 'border-[#B4281F] bg-[#FFF5F4]'
                      : 'border-[#C8BFA9] bg-[#FFFDF8]'
                  }`}
                >
                  <FolderArchive className="w-7 h-7 mx-auto text-[#6B655C] mb-2" />
                  <div className="font-bold text-[15px] text-[#1F1D1A]">
                    Kéo thả file .ZIP hoặc thư mục test vào đây
                  </div>
                  <p className="text-[13px] text-[#6B655C] mt-1 mb-4">
                    Hỗ trợ bộ test Themis bất kỳ kích thước (file .ZIP trên 50 MB sẽ tự tách gói an toàn).
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => zipInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#B4281F] hover:bg-[#8F1F18] text-white text-[13.5px] font-semibold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Nạp file .ZIP</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => folderInputRef.current?.click()}
                      className="px-4 py-2 rounded-[8px] border border-[#1F1D1A] bg-white hover:bg-[#EFE9DC] text-[13.5px] font-semibold text-[#1F1D1A] cursor-pointer"
                    >
                      Nạp cả thư mục
                    </button>
                    <button
                      type="button"
                      onClick={() => looseFilesInputRef.current?.click()}
                      className="px-4 py-2 rounded-[8px] border border-[#D9D2C3] bg-white hover:border-[#1F1D1A] text-[13.5px] font-medium text-[#1F1D1A] cursor-pointer"
                    >
                      Chọn file lẻ
                    </button>
                  </div>
                </div>
              )}

              {testError && (
                <div className="mb-4 p-3 rounded-[8px] bg-[#FFF1F0] border border-[#F2C0BC] text-[#8F1F18] text-[13.5px]">
                  {testError}
                </div>
              )}

              {/* Bảng danh sách test thu gọn (3 test đầu + Xem tất cả) */}
              {testCases.length > 0 && (
                <div className="overflow-x-auto">
                  <div className="min-w-[560px]">
                    <div className="border-t-2 border-[#1F1D1A] py-2.5 grid grid-cols-[36px_1fr_95px_125px_100px_54px] gap-4 items-center text-[13px] text-[#6B655C]">
                      <span>#</span>
                      <span>Test</span>
                      <span>Trạng thái</span>
                      <span>Điểm</span>
                      <span />
                      <span />
                    </div>

                    {visibleTests.map((tc, idx) => {
                      const draftVal =
                        pointDrafts[tc.id] !== undefined
                          ? pointDrafts[tc.id]
                          : formatPointDisplayVi(tc.points);
                      const isExpanded = expandedTestId === tc.id;

                      return (
                        <div key={tc.id} className="border-t border-[#D9D2C3]">
                          <div className="py-3 grid grid-cols-[36px_1fr_95px_125px_100px_54px] gap-4 items-center text-[14.5px]">
                            <span className="font-mono text-[#6B655C] tabular-nums">{idx + 1}</span>
                            <span className="font-bold text-[#1F1D1A] truncate">{tc.name}</span>
                            <span className="font-bold text-[#2F6B3F] text-[14px]">
                              {pendingUpload ? 'Chờ lưu' : 'Đã nạp'}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <input
                                type="text"
                                inputMode="decimal"
                                aria-label={`Điểm ${tc.name}`}
                                value={draftVal}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  setPointDrafts((prev) => ({ ...prev, [tc.id]: raw }));
                                  const parsed = parseDecimalInput(raw);
                                  if (Number.isFinite(parsed) && parsed >= 0) {
                                    setTestCases((prev) =>
                                      prev.map((item) =>
                                        item.id === tc.id ? { ...item, points: +parsed.toFixed(3) } : item
                                      )
                                    );
                                    setTestsMetaDirty(true);
                                  }
                                }}
                                onBlur={() => {
                                  setPointDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[tc.id];
                                    return next;
                                  });
                                }}
                                className="w-[68px] px-2 py-1.5 rounded-[6px] border border-[#D9D2C3] bg-[#FFFDF8] font-mono text-[13.5px] text-right text-[#1F1D1A] focus:outline-none focus:border-[#1F1D1A]"
                              />
                              <span className="text-[#6B655C] text-[13.5px]">đ</span>
                            </span>

                            <button
                              type="button"
                              onClick={() => handleToggleInspectTest(tc)}
                              className="text-left text-[#B4281F] hover:underline font-semibold text-[14px] cursor-pointer whitespace-nowrap"
                            >
                              {isExpanded ? 'Đóng' : 'Xem / Sửa'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveTest(tc.id)}
                              className="text-right text-[#6B655C] hover:text-[#B4281F] text-[14px] cursor-pointer"
                            >
                              Xóa
                            </button>
                          </div>

                          {/* Khung xem / sửa 1 test lẻ (lazy load) */}
                          {isExpanded && (
                            <div className="pb-4 pt-1">
                              {loadingDetailId === tc.id ? (
                                <div className="p-4 rounded-[8px] bg-[#FFFDF8] border border-[#D9D2C3] text-[13.5px] text-[#6B655C]">
                                  Đang tải nội dung test từ Cloud...
                                </div>
                              ) : (tc.input || '').startsWith('__STORAGE_ZIP__:') ? (
                                <div className="p-4 rounded-[8px] bg-[#FFFDF8] border border-[#D9D2C3] text-[13.5px] text-[#6B655C]">
                                  Test đang nằm gọn trong gói nén <b>.ZIP</b> trên Supabase Storage (tự động giải nén trên VPS khi chấm bài).
                                </div>
                              ) : (
                                <div className="p-4 rounded-[8px] bg-[#FFFDF8] border border-[#D9D2C3] grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[12px] font-semibold text-[#6B655C] mb-1">
                                      Input (.INP)
                                    </label>
                                    <textarea
                                      rows={4}
                                      value={tc.input}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTestCases((prev) =>
                                          prev.map((item) =>
                                            item.id === tc.id ? { ...item, input: val } : item
                                          )
                                        );
                                        setDirtyManualIds((prev) => new Set(prev).add(tc.id));
                                        setTestsMetaDirty(true);
                                      }}
                                      className="w-full px-3 py-2 rounded-[6px] border border-[#D9D2C3] bg-white font-mono text-[12.5px] text-[#1F1D1A]"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[12px] font-semibold text-[#6B655C] mb-1">
                                      Output chuẩn (.OUT)
                                    </label>
                                    <textarea
                                      rows={4}
                                      value={tc.expectedOutput}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTestCases((prev) =>
                                          prev.map((item) =>
                                            item.id === tc.id ? { ...item, expectedOutput: val } : item
                                          )
                                        );
                                        setDirtyManualIds((prev) => new Set(prev).add(tc.id));
                                        setTestsMetaDirty(true);
                                      }}
                                      className="w-full px-3 py-2 rounded-[6px] border border-[#D9D2C3] bg-white font-mono text-[12.5px] text-[#1F1D1A]"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chân bảng test */}
              <div className="border-t border-[#D9D2C3] py-3 text-[14px] text-[#6B655C] flex flex-wrap items-center gap-2">
                {hiddenTestsCount > 0 && (
                  <>
                    <span>Còn {hiddenTestsCount} test nữa</span>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setShowAllTests(true)}
                      className="text-[#B4281F] font-semibold hover:underline cursor-pointer"
                    >
                      Xem tất cả {testCases.length} test
                    </button>
                    <span>·</span>
                  </>
                )}
                {showAllTests && testCases.length > 3 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowAllTests(false)}
                      className="text-[#6B655C] hover:text-[#1F1D1A] underline cursor-pointer"
                    >
                      Thu gọn còn 3 test
                    </button>
                    <span>·</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleAddManualTest}
                  className="text-[#B4281F] font-semibold hover:underline cursor-pointer"
                >
                  + Thêm test thủ công
                </button>
              </div>
            </div>
          </section>

          {/* 5. GIAO CHO LỚP */}
          <section id="gv2-prob-giao" className="mb-11 scroll-mt-6">
            <div className="border-t-2 border-[#1F1D1A] pt-[18px]">
              <h2 className="text-[22px] font-bold text-[#1F1D1A]">Giao cho lớp</h2>
              <div className="mt-4">
                <p className="text-[15px] text-[#1F1D1A] mb-3">
                  {currentTopic ? (
                    <>
                      Bài thuộc chủ đề <b>{currentTopic.name}</b> nên hiện ở các lớp đang được giao chủ đề này.
                    </>
                  ) : (
                    'Hãy chọn một Chủ đề ở mục Thông tin để giao bài này cho các lớp học.'
                  )}
                </p>

                <div className="border-b border-[#D9D2C3]">
                  {classes.map((cls) => {
                    const isAssigned = assignedClassIdSet.has(cls.id);
                    const isBusy = assigningClassId === cls.id;
                    return (
                      <div
                        key={cls.id}
                        className="border-t border-[#D9D2C3] py-3.5 grid grid-cols-[22px_160px_1fr] gap-4 items-center text-[15px]"
                      >
                        {isAssigned ? (
                          <i className="inline-block w-[10px] h-[10px] rounded-[2px] bg-[#2F6B3F]" />
                        ) : (
                          <i
                            className="inline-block w-[10px] h-[10px] rounded-[2px]"
                            style={{ boxShadow: 'inset 0 0 0 1.5px #A39B8B' }}
                          />
                        )}
                        <b className="truncate">{cls.className}</b>
                        <div className="flex items-center justify-between gap-3">
                          {isAssigned ? (
                            <>
                              <span className="text-[14px] text-[#6B655C]">Đang giao</span>
                              {currentTopic && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleToggleAssignTopicToClass(cls.id, false)}
                                  className="text-[13px] text-[#6B655C] hover:text-[#B4281F] underline cursor-pointer disabled:opacity-50"
                                >
                                  {isBusy ? 'Đang cập nhật...' : 'Bỏ giao'}
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy || !currentTopic}
                              onClick={() => handleToggleAssignTopicToClass(cls.id, true)}
                              className="text-[14.5px] font-semibold text-[#B4281F] hover:text-[#8F1F18] hover:underline cursor-pointer disabled:opacity-50"
                            >
                              {isBusy ? 'Đang giao...' : 'Giao chủ đề này cho lớp →'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 6. VIDEO BÀI GIẢNG (Tính năng mở rộng gọn gàng) */}
          <section id="gv2-prob-video" className="mb-11 scroll-mt-6">
            <div className="border-t-2 border-[#1F1D1A] pt-[18px]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[22px] font-bold text-[#1F1D1A]">Video bài giảng</h2>
                  <p className="text-[14px] text-[#6B655C] mt-0.5">
                    Gắn video chữa bài (YouTube, Google Drive hoặc MP4) cho học sinh xem.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#1F1D1A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={videoConfig.enabled}
                    onChange={(e) =>
                      setVideoConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#B4281F] cursor-pointer"
                  />
                  <span>Bật video</span>
                </label>
              </div>

              {videoConfig.enabled && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-[14px] mb-1.5">Nguồn video</label>
                    <select
                      value={videoConfig.type}
                      onChange={(e) =>
                        setVideoConfig((prev) => ({
                          ...prev,
                          type: e.target.value as VideoConfig['type'],
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14px] text-[#1F1D1A]"
                    >
                      <option value="youtube">YouTube</option>
                      <option value="drive">Google Drive</option>
                      <option value="direct">Link MP4 trực tiếp</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[14px] mb-1.5">Điều kiện mở khóa</label>
                    <select
                      value={videoConfig.unlockRule}
                      onChange={(e) =>
                        setVideoConfig((prev) => ({
                          ...prev,
                          unlockRule: e.target.value as VideoConfig['unlockRule'],
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14px] text-[#1F1D1A]"
                    >
                      <option value="always">Luôn mở cho học sinh xem</option>
                      <option value="after_submission">Mở sau khi nộp bài ít nhất 1 lần</option>
                      <option value="full_score">Chỉ mở khi đạt Full AC (100%)</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-[14px] mb-1.5">Đường dẫn video (URL)</label>
                    <input
                      type="url"
                      value={videoConfig.url}
                      onChange={(e) =>
                        setVideoConfig((prev) => ({ ...prev, url: e.target.value }))
                      }
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-3 py-2.5 rounded-[8px] border border-[#D9D2C3] bg-[#FFFDF8] text-[14px] text-[#1F1D1A]"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
