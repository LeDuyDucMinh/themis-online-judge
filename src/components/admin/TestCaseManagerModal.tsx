import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Problem, TestCase } from '../../types/judge';
import { apiService } from '../../services/apiService';
import {
  inspectThemisZipForUpload,
  inspectThemisFilesForUpload,
  packThemisPairsToZip,
  type FastUploadPackage,
  type PairedTestUploadItem,
} from '../../services/fileParserService';
import {
  X,
  Plus,
  Trash2,
  FolderArchive,
  Save,
  Clock,
  HardDrive,
  Award,
  Layers,
  Eye,
  EyeOff,
  Sparkles,
  Files,
  FolderUp,
  FileCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
} from 'lucide-react';

interface TestCaseManagerModalProps {
  problem: Problem;
  onClose: () => void;
}

const formatPreview = (content: unknown): string => {
  if (content === null || content === undefined) return '';
  const str = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
  if (str.length > 1000) {
    return str.substring(0, 1000) + '\n... [Dữ liệu quá dài, đã ẩn bớt]';
  }
  return str;
};

const formatSizeMb = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

export const TestCaseManagerModal: React.FC<TestCaseManagerModalProps> = ({
  problem,
  onClose,
}) => {
  const { updateProblem, showToast } = useJudge();

  const [timeLimit, setTimeLimit] = useState(problem.timeLimit || 1.0);
  const [memoryLimit, setMemoryLimit] = useState(problem.memoryLimit || 1024);
  const [totalPoints, setTotalPoints] = useState(problem.totalPoints || 10);
  const [testCases, setTestCases] = useState<TestCase[]>(() => {
    if (!problem.testCases || problem.testCases.length === 0) return [];
    const seen = new Set<string>();
    return problem.testCases.filter((tc, idx) => {
      const key = tc.name || `Test #${idx + 1}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  // Chuẩn VNOI: Gói file .ZIP / Thư mục đang chờ tải lên Storage khi bấm "Lưu cấu hình Test"
  const [pendingUpload, setPendingUpload] = useState<FastUploadPackage | null>(null);
  // Các test được thêm/sửa thủ công bằng tay (cần lưu nội dung vào SQL)
  const [dirtyManualIds, setDirtyManualIds] = useState<Set<string>>(new Set());
  // Test nào đang mở rộng xem/sửa nội dung theo yêu cầu
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [uploadStage, setUploadStage] = useState<{ label: string; percent: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Mở modal TỨC THÌ (<50ms): chỉ tải metadata (~1KB), KHÔNG tải hàng chục MB nội dung .INP/.OUT!
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const meta = await apiService.fetchTestCasesMeta(problem.id);
        if (isMounted && meta) {
          setTestCases(meta);
        }
      } catch (err) {
        console.warn('[TestCaseManagerModal] Lỗi tải metadata test:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [problem.id]);

  // Đóng / Hủy an toàn (không tự ghi đè dữ liệu lên Cloud)
  const handleSafeClose = () => {
    if (isLoadingTests) return;
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSafeClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoadingTests]);

  // Tự động chia đều điểm cho các test case
  const handleAutoDistributePoints = () => {
    if (testCases.length === 0) return;
    const target = Number(totalPoints) || 10;
    const pts = +(target / testCases.length).toFixed(2);
    setTestCases(
      testCases.map((tc, idx, arr) => ({
        ...tc,
        points: idx === arr.length - 1 ? +(target - pts * (arr.length - 1)).toFixed(2) : pts,
      }))
    );
    showToast('Tự động chia điểm', `Đã chia đều ${target} điểm cho ${testCases.length} tests (${pts} điểm/test)`, 'success');
  };

  // Thêm test case thủ công (vẫn hỗ trợ song song cho bài nhỏ)
  const handleAddManualTest = () => {
    const nextIdx = testCases.length + 1;
    const newId = `${problem.id}_tc_m_${Date.now()}_${nextIdx}`;
    const defaultPts = +(totalPoints / Math.max(1, nextIdx)).toFixed(2);
    const newTest: TestCase = {
      id: newId,
      name: `Test #${String(nextIdx).padStart(2, '0')}`,
      input: '',
      expectedOutput: '',
      points: defaultPts,
      isHidden: nextIdx > 3,
    };
    setTestCases([...testCases, newTest]);
    setDirtyManualIds((prev) => new Set(prev).add(newId));
    setExpandedTestId(newId);
  };

  // Xóa test case
  const handleRemoveTest = (id: string) => {
    setTestCases(testCases.filter((tc) => tc.id !== id));
    if (expandedTestId === id) setExpandedTestId(null);
    setDirtyManualIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Cập nhật thông tin test
  const handleUpdateTest = (id: string, field: keyof TestCase, val: unknown) => {
    setTestCases(testCases.map((tc) => (tc.id === id ? { ...tc, [field]: val } : tc)));
    if (field === 'input' || field === 'expectedOutput') {
      setDirtyManualIds((prev) => new Set(prev).add(id));
    }
  };

  // Xem / sửa nội dung 1 test cụ thể theo yêu cầu (chỉ tải đúng 1 test đó)
  const handleToggleExpandTest = async (tc: TestCase) => {
    if (expandedTestId === tc.id) {
      setExpandedTestId(null);
      return;
    }
    setExpandedTestId(tc.id);

    // Nếu là test trong gói .ZIP mới chọn chờ tải lên hoặc đã có nội dung sẵn thì không cần gọi API
    if (pendingUpload || tc.input || tc.expectedOutput || dirtyManualIds.has(tc.id)) {
      return;
    }

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

  // Chuẩn VNOI: Quét file .ZIP siêu tốc (~20ms, KHÔNG giải nén nội dung ra RAM)
  const handleZipUpload = async (file: File) => {
    setIsLoadingTests(true);
    setParseError(null);
    setUploadStage({ label: 'Đang quét danh mục file .ZIP...', percent: 30 });
    try {
      const pkg = await inspectThemisZipForUpload(file, Number(totalPoints) || 10);
      const standardizedTests: TestCase[] = pkg.pairs.map((p, idx) => ({
        id: `${problem.id}_tc_${idx + 1}`,
        name: p.name,
        input: '',
        expectedOutput: '',
        points: p.points,
        isHidden: p.isHidden,
      }));
      setTestCases(standardizedTests);
      setPendingUpload(pkg);
      setDirtyManualIds(new Set());
      setExpandedTestId(null);

      showToast('Đã nhận diện gói .ZIP', pkg.summary, 'success');
      if (pkg.warnings.length > 0) {
        showToast('Lưu ý nạp test', pkg.warnings.join(' '), 'warning');
      }
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || 'Không thể đọc file .ZIP';
      setParseError(errorMsg);
      showToast('Không thể đọc file .ZIP', errorMsg, 'error');
    } finally {
      setIsLoadingTests(false);
      setUploadStage(null);
    }
  };

  // Chuẩn VNOI: Quét thư mục / danh sách file .INP & .OUT siêu tốc (~10ms, KHÔNG đọc nội dung vào RAM)
  const handleDirectFilesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      await handleZipUpload(files[0]);
      return;
    }

    setIsLoadingTests(true);
    setParseError(null);
    try {
      const pkg = inspectThemisFilesForUpload(files, Number(totalPoints) || 10);
      const standardizedTests: TestCase[] = pkg.pairs.map((p, idx) => ({
        id: `${problem.id}_tc_${idx + 1}`,
        name: p.name,
        input: '',
        expectedOutput: '',
        points: p.points,
        isHidden: p.isHidden,
      }));
      setTestCases(standardizedTests);
      setPendingUpload(pkg);
      setDirtyManualIds(new Set());
      setExpandedTestId(null);

      showToast('Đã ghép cặp bộ Test Themis', pkg.summary, 'success');
      if (pkg.warnings.length > 0) {
        showToast('Lưu ý nạp test', pkg.warnings.join(' '), 'warning');
      }
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || 'Không thể đọc danh sách file test';
      setParseError(errorMsg);
      showToast('Không thể đọc file test', errorMsg, 'error');
    } finally {
      setIsLoadingTests(false);
      setUploadStage(null);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleDirectFilesUpload(e.dataTransfer.files);
    }
  };

  // Lưu toàn bộ cấu hình (Chuẩn VNOI: đóng gói & tải 1 file .ZIP duy nhất lên Storage -> SQL chỉ lưu ~2KB metadata)
  const handleSaveAll = async () => {
    try {
      setIsLoadingTests(true);
      setParseError(null);

      const targetPoints = Number(totalPoints) || 10;
      const currentSum = testCases.reduce((sum, tc) => sum + (Number(tc.points) || 0), 0);
      let finalizedTests = [...testCases];
      if (finalizedTests.length > 0 && Math.abs(currentSum - targetPoints) > 0.05) {
        const pts = +(targetPoints / finalizedTests.length).toFixed(2);
        finalizedTests = finalizedTests.map((tc, idx, arr) => ({
          ...tc,
          points: idx === arr.length - 1 ? +(targetPoints - pts * (arr.length - 1)).toFixed(2) : pts,
        }));
      }

      if (pendingUpload) {
        // 1. Khớp danh sách cặp test còn lại (trong trường hợp giáo viên vừa xóa bớt 1 test trước khi lưu)
        const pairById = new Map<string, PairedTestUploadItem>();
        pendingUpload.pairs.forEach((p, idx) => {
          pairById.set(`${problem.id}_tc_${idx + 1}`, p);
        });

        const activeZipPairs: PairedTestUploadItem[] = [];
        for (const tc of finalizedTests) {
          const matched = pairById.get(tc.id);
          if (matched) activeZipPairs.push(matched);
        }

        let zipBlobToUpload: Blob | null = null;
        if (activeZipPairs.length > 0) {
          if (pendingUpload.mode === 'zip' && pendingUpload.zipBlob) {
            zipBlobToUpload = pendingUpload.zipBlob;
          } else {
            setUploadStage({ label: 'Đang nén bộ test thành 1 file .ZIP siêu gọn...', percent: 5 });
            zipBlobToUpload = await packThemisPairsToZip(activeZipPairs, (pct) => {
              setUploadStage({ label: `Đang nén bộ test .ZIP... (${pct}%)`, percent: pct });
            });
          }

          const totalMb = formatSizeMb(zipBlobToUpload.size);
          setUploadStage({ label: `Đang tải file nén .ZIP (${totalMb}) lên Cloud...`, percent: 0 });
          const uploaded = await apiService.uploadTestCasesZip(
            problem.id,
            zipBlobToUpload,
            (pct, loaded, total) => {
              setUploadStage({
                label: `Đang tải gói test .ZIP lên Cloud: ${pct}% (${formatSizeMb(loaded)} / ${formatSizeMb(total)})`,
                percent: pct,
              });
            }
          );

          // Xây dựng danh sách pointer nhẹ (~90 byte/test) chuẩn VNOI
          const pointerBase = `__STORAGE_ZIP__:${uploaded.bucket}/${uploaded.objectPath}?v=${uploaded.version}`;
          const pointerTests: TestCase[] = finalizedTests.map((tc) => {
            const matched = pairById.get(tc.id);
            if (matched) {
              return {
                ...tc,
                input: `${pointerBase}#${matched.inputEntryName}`,
                expectedOutput: `${pointerBase}#${matched.outputEntryName}`,
              };
            }
            return {
              ...tc,
              input: (tc.input || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
              expectedOutput: (tc.expectedOutput || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
            };
          });

          setUploadStage({ label: 'Đang lưu cấu hình bài tập...', percent: 98 });
          await updateProblem(problem.id, {
            timeLimit: Number(timeLimit) || 1.0,
            memoryLimit: Number(memoryLimit) || 1024,
            totalPoints: targetPoints,
            testCases: pointerTests,
          });

          showToast(
            'Đã nạp bộ Test chuẩn VNOI!',
            `Đã tải lên gói .ZIP (${totalMb}) gồm ${pointerTests.length} test cho bài [${problem.code}] (${targetPoints}đ).`,
            'success'
          );
          onClose();
          return;
        }
      }

      // Nhánh 2: Không nạp gói mới — chỉ cập nhật metadata (điểm, giới hạn, ẩn/hiện, xóa test) hoặc test gõ tay
      setUploadStage({ label: 'Đang cập nhật cấu hình test...', percent: 60 });

      const manualToUpsert: Array<TestCase & { orderIndex: number }> = [];
      finalizedTests.forEach((tc, idx) => {
        if (dirtyManualIds.has(tc.id)) {
          manualToUpsert.push({
            ...tc,
            input: (tc.input || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
            expectedOutput: (tc.expectedOutput || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
            orderIndex: idx + 1,
          });
        }
      });

      const metaOnlyList = finalizedTests.map((tc) => ({
        id: tc.id,
        name: tc.name,
        points: Number(tc.points) || 1,
        isHidden: Boolean(tc.isHidden),
      }));

      // Cập nhật test thủ công trước (nếu có thêm mới), rồi đồng bộ metadata + dọn test đã xóa
      if (manualToUpsert.length > 0) {
        await apiService.upsertManualTestCases(problem.id, manualToUpsert);
      }
      await apiService.updateTestCasesMetaOnly(problem.id, metaOnlyList);

      // Cập nhật bảng problems và React state (truyền testCases metadata không có input/output để tránh saveTestCases ghi đè)
      await updateProblem(problem.id, {
        timeLimit: Number(timeLimit) || 1.0,
        memoryLimit: Number(memoryLimit) || 1024,
        totalPoints: targetPoints,
        testCases: finalizedTests.map((tc) => ({
          id: tc.id,
          name: tc.name,
          points: tc.points,
          isHidden: tc.isHidden,
          input: '',
          expectedOutput: '',
        })),
      });

      showToast(
        'Đã lưu cấu hình Test',
        `Đã cập nhật nhanh cấu hình ${finalizedTests.length} test cho bài [${problem.code}] (Thang điểm: ${targetPoints}đ).`,
        'success'
      );
      onClose();
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Lỗi lưu trữ test case vào Database';
      setParseError(`Không thể lưu cấu hình test: ${msg}`);
      showToast('Lỗi lưu test case', msg, 'error');
    } finally {
      setIsLoadingTests(false);
      setUploadStage(null);
    }
  };

  const currentSumPoints = testCases.reduce((sum, tc) => sum + (Number(tc.points) || 0), 0);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSafeClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Sticky Header */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-800/90 backdrop-blur sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                {typeof problem.code === 'object' ? JSON.stringify(problem.code) : String(problem.code || '')}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Quản Lý Test Case Chuẩn VNOI / Themis: {typeof problem.title === 'object' ? JSON.stringify(problem.title) : String(problem.title || '')}
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Nạp siêu tốc qua gói nén .ZIP (Storage) • Tự phân cặp .INP/.OUT • Không tải nội dung nặng về trình duyệt
            </p>
          </div>

          <button
            onClick={handleSafeClose}
            disabled={isLoadingTests}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all flex items-center gap-1 text-xs font-semibold disabled:opacity-40"
            title="Đóng (Phím ESC hoặc click ra ngoài)"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Đóng</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Top Config Row: Time Limit, Memory Limit, Total Points */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Giới hạn thời gian (Time Limit):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10.0"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(parseFloat(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <span className="text-xs text-slate-400">giây</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" /> Giới hạn bộ nhớ (Memory Limit):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="16"
                  max="2048"
                  value={memoryLimit}
                  onChange={(e) => setMemoryLimit(parseInt(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <span className="text-xs text-slate-400">MB</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" /> Thang điểm:
                </label>
                {testCases.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoDistributePoints}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                  >
                    Chia đều lại điểm
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={totalPoints}
                  onChange={(e) => {
                    const newTotal = parseInt(e.target.value) || 0;
                    setTotalPoints(newTotal);
                    if (newTotal > 0 && testCases.length > 0) {
                      const pts = +(newTotal / testCases.length).toFixed(2);
                      setTestCases((prev) =>
                        prev.map((tc, idx, arr) => ({
                          ...tc,
                          points: idx === arr.length - 1 ? +(newTotal - pts * (arr.length - 1)).toFixed(2) : pts,
                        }))
                      );
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <div className="flex items-center gap-1 shrink-0">
                  {[5, 10, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setTotalPoints(preset);
                        if (testCases.length > 0) {
                          const pts = +(preset / testCases.length).toFixed(2);
                          setTestCases((prev) =>
                            prev.map((tc, idx, arr) => ({
                              ...tc,
                              points: idx === arr.length - 1 ? +(preset - pts * (arr.length - 1)).toFixed(2) : pts,
                            }))
                          );
                        }
                      }}
                      className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        totalPoints === preset
                          ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      {preset}đ
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Hộp Nạp Bộ Test Siêu Tốc Chuẩn VNOI */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`p-5 rounded-3xl border-2 transition-all ${
              isDragOver
                ? 'bg-red-950/40 border-red-500 border-dashed scale-[1.01]'
                : 'bg-gradient-to-r from-red-950/20 via-slate-800/40 to-slate-900 border-slate-700/80 hover:border-red-500/50'
            }`}
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-5">
              <div className="space-y-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wider">
                  <FileCheck className="w-4 h-4" /> Nạp Bộ Test Siêu Tốc Chuẩn VNOI (.ZIP / Thư mục)
                </div>
                <h4 className="text-base font-bold text-white">
                  {isLoadingTests ? 'Đang xử lý gói test...' : 'Chọn file .ZIP (nhanh nhất) hoặc cả Thư mục Test'}
                </h4>
                <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                  File <b>.ZIP</b> được đẩy thẳng lên kho lưu trữ Cloud (tối đa 50 MB nén ≈ 250 MB test gốc) mà <b>không giải nén ra trình duyệt</b>. Chọn Thư mục sẽ tự động nén .ZIP gọn nhẹ trước khi tải.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
                {/* 1. Nạp File ZIP (Nhanh nhất) */}
                <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/25 ${isLoadingTests ? 'opacity-50 pointer-events-none' : ''}`}>
                  <FolderArchive className="w-4 h-4" />
                  <span>Nạp File .ZIP (Nhanh nhất)</span>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleZipUpload(e.target.files[0]);
                      e.target.value = '';
                    }}
                    disabled={isLoadingTests}
                    className="hidden"
                  />
                </label>

                {/* 2. Chọn nguyên cả Folder Test */}
                <label className={`cursor-pointer inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-all ${isLoadingTests ? 'opacity-50 pointer-events-none' : ''}`}>
                  <FolderUp className="w-4 h-4 text-amber-400" />
                  <span>Nạp cả Thư mục Test</span>
                  <input
                    type="file"
                    // @ts-expect-error webkitdirectory là thuộc tính chuẩn của browser
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={(e) => {
                      if (e.target.files) handleDirectFilesUpload(e.target.files);
                      e.target.value = '';
                    }}
                    disabled={isLoadingTests}
                    className="hidden"
                  />
                </label>

                {/* 3. Chọn nhiều file lẻ */}
                <label className={`cursor-pointer inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-all ${isLoadingTests ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Files className="w-4 h-4 text-blue-400" />
                  <span>Chọn file lẻ</span>
                  <input
                    type="file"
                    multiple
                    accept=".inp,.out,.in,.ans,.txt,.zip"
                    onChange={(e) => {
                      if (e.target.files) handleDirectFilesUpload(e.target.files);
                      e.target.value = '';
                    }}
                    disabled={isLoadingTests}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="mt-3 text-center text-[11px] text-slate-500">
              💡 Mẹo: Nếu bộ test nặng hàng chục MB (như <b>NTO</b>), hãy nén thư mục test thành <b>1 file .ZIP</b> rồi kéo thả vào đây — nạp xong chỉ trong <b>2–4 giây</b>!
            </div>
          </div>

          {/* Thanh tiến trình nén / tải lên Cloud có % thực tế */}
          {isLoadingTests && uploadStage && (
            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/40 space-y-2">
              <div className="flex items-center justify-between gap-3 text-blue-300">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                  <span className="text-xs font-semibold">{uploadStage.label}</span>
                </div>
                <span className="text-xs font-mono font-bold text-blue-200">{uploadStage.percent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-200"
                  style={{ width: `${Math.max(4, uploadStage.percent)}%` }}
                />
              </div>
            </div>
          )}

          {/* Banner trạng thái bộ test hiện tại */}
          {!isLoadingTests && pendingUpload && (
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 text-amber-200">
              <div className="flex items-center gap-2.5 text-xs">
                <CloudUpload className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <b>Gói test mới sẵn sàng tải lên:</b> {pendingUpload.pairs.length} tests ({formatSizeMb(pendingUpload.totalBytes)}
                  {pendingUpload.mode === 'zip' ? ' file .ZIP' : ' gốc — sẽ tự nén .ZIP'}). Hãy bấm nút <b>"Lưu cấu hình Test"</b> ở góc dưới bên phải để hoàn tất!
                </span>
              </div>
            </div>
          )}

          {!isLoadingTests && !pendingUpload && testCases.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-2.5 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <b>Đã nạp thành công {testCases.length} bộ test trên Cloud</b> (Tổng điểm: <b>{currentSumPoints.toFixed(1)}/{totalPoints}đ</b>). Hệ thống ẩn sẵn nội dung test để mở trang tức thì — bấm <b>Xem / Sửa</b> trên từng dòng nếu cần kiểm tra lẻ.
              </span>
            </div>
          )}

          {/* Thông báo lỗi */}
          {parseError && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 flex items-start justify-between gap-3 text-rose-300 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-xs text-rose-200">Có lỗi xảy ra</h5>
                  <p className="text-xs text-rose-300/90 mt-0.5 leading-relaxed">{parseError}</p>
                </div>
              </div>
              <button
                onClick={() => setParseError(null)}
                className="p-1 rounded-lg hover:bg-rose-900/40 text-rose-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Test Cases List Header & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-red-400" />
                Danh sách Test Cases ({testCases.length} tests)
              </h4>
              <span className="text-xs font-mono text-slate-400">
                Tổng điểm: <b className="text-amber-400">{currentSumPoints.toFixed(1)}</b> / {totalPoints}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoDistributePoints}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Chia đều điểm
              </button>

              <button
                type="button"
                onClick={handleAddManualTest}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" /> Thêm Test thủ công
              </button>
            </div>
          </div>

          {/* Danh sách Test gọn nhẹ chuẩn VNOI */}
          {testCases.length === 0 ? (
            <div className="p-10 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 text-slate-500">
              <FolderArchive className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-xs">Chưa có test case nào cho bài tập này.</p>
              <p className="text-xs mt-1 text-slate-400">
                Hãy bấm <b>"Nạp File .ZIP (Nhanh nhất)"</b> hoặc <b>"Nạp cả Thư mục Test"</b> ở trên.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {testCases.map((tc, idx) => {
                const isExpanded = expandedTestId === tc.id;
                const isZipBacked =
                  (typeof tc.input === 'string' && tc.input.startsWith('__STORAGE_ZIP__:')) ||
                  Boolean(pendingUpload && !dirtyManualIds.has(tc.id));
                const isInputTruncated = !isZipBacked && (tc.input || '').length > 1000;
                const isOutputTruncated = !isZipBacked && (tc.expectedOutput || '').length > 1000;

                return (
                  <div
                    key={tc.id || idx}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 transition-colors hover:border-slate-700"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={typeof tc.name === 'object' ? JSON.stringify(tc.name) : String(tc.name || '')}
                          onChange={(e) => handleUpdateTest(tc.id, 'name', e.target.value)}
                          className="bg-transparent border-0 font-bold text-xs text-white focus:ring-0 p-0 hover:underline w-28 sm:w-36"
                        />
                        {pendingUpload && !dirtyManualIds.has(tc.id) ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                            Chờ tải .ZIP
                          </span>
                        ) : dirtyManualIds.has(tc.id) ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25">
                            Test thủ công
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                            ✓ Đã nạp trên Cloud
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5">
                        {/* Điểm */}
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <span>Điểm:</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            value={tc.points}
                            onChange={(e) => handleUpdateTest(tc.id, 'points', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-amber-300 font-mono font-bold text-center focus:outline-none"
                          />
                          <span>đ</span>
                        </div>

                        {/* Ẩn/Hiện */}
                        <button
                          type="button"
                          onClick={() => handleUpdateTest(tc.id, 'isHidden', !tc.isHidden)}
                          className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                            tc.isHidden
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-300 hover:text-white'
                          }`}
                          title={tc.isHidden ? 'Test ẩn (học sinh không xem được dữ liệu)' : 'Test công khai'}
                        >
                          {tc.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span className="text-[10px]">{tc.isHidden ? 'Ẩn' : 'Hiện'}</span>
                        </button>

                        {/* Nút Xem/Sửa theo yêu cầu */}
                        <button
                          type="button"
                          onClick={() => handleToggleExpandTest(tc)}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 transition-colors"
                          title="Mở xem hoặc sửa nội dung test này"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          <span>{isExpanded ? 'Thu gọn' : 'Xem / Sửa'}</span>
                        </button>

                        {/* Xóa */}
                        <button
                          type="button"
                          onClick={() => handleRemoveTest(tc.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Xóa test này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Khung chi tiết chỉ mở khi giáo viên chủ động bấm "Xem / Sửa" */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80">
                        {loadingDetailId === tc.id ? (
                          <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tải nội dung test...
                          </div>
                        ) : isZipBacked ? (
                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                            <FolderArchive className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>
                              Dữ liệu test được lưu gọn trong gói nén <b>.ZIP (chuẩn VNOI)</b> trên Storage nên không tải về trình duyệt. Nếu cần sửa nội dung test, bạn hãy sửa file trên máy tính rồi kéo thả nạp lại gói .ZIP / Thư mục.
                            </span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-slate-400 uppercase">Input:</span>
                                {isInputTruncated && (
                                  <span className="text-[10px] font-mono text-amber-400">
                                    {formatSizeMb((tc.input || '').length)} (Chỉ xem trước)
                                  </span>
                                )}
                              </div>
                              <textarea
                                rows={3}
                                value={formatPreview(tc.input)}
                                readOnly={isInputTruncated}
                                onChange={(e) => {
                                  if (!isInputTruncated) handleUpdateTest(tc.id, 'input', e.target.value);
                                }}
                                placeholder="Dữ liệu vào..."
                                className={`w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono ${
                                  isInputTruncated ? 'cursor-not-allowed opacity-90' : ''
                                }`}
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-slate-400 uppercase">Expected Output:</span>
                                {isOutputTruncated && (
                                  <span className="text-[10px] font-mono text-emerald-400">
                                    {formatSizeMb((tc.expectedOutput || '').length)} (Chỉ xem trước)
                                  </span>
                                )}
                              </div>
                              <textarea
                                rows={3}
                                value={formatPreview(tc.expectedOutput)}
                                readOnly={isOutputTruncated}
                                onChange={(e) => {
                                  if (!isOutputTruncated) handleUpdateTest(tc.id, 'expectedOutput', e.target.value);
                                }}
                                placeholder="Đáp án đúng..."
                                className={`w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-emerald-400 font-mono ${
                                  isOutputTruncated ? 'cursor-not-allowed opacity-90' : ''
                                }`}
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
          )}
        </div>

        {/* Sticky Footer */}
        <div className="shrink-0 p-4 bg-slate-800/90 border-t border-slate-800 flex items-center justify-between sticky bottom-0 z-10">
          <span className="text-xs text-slate-400">
            Tổng cộng: <b>{testCases.length}</b> tests • Thang điểm:{' '}
            <b className="text-amber-400">{totalPoints}đ</b>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSafeClose}
              disabled={isLoadingTests}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-40"
            >
              Đóng / Hủy
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isLoadingTests}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-600/25 transition-all disabled:opacity-50"
            >
              {isLoadingTests ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {pendingUpload ? 'Tải gói .ZIP & Lưu cấu hình' : 'Lưu cấu hình Test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
