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
  FolderArchive,
  Loader2,
  AlertTriangle,
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

const distributePointsEvenly = (tests: TestCase[], target: number): TestCase[] => {
  if (tests.length === 0 || !(target > 0)) return tests;
  const pts = +(target / tests.length).toFixed(3);
  return tests.map((tc, idx, arr) => ({
    ...tc,
    points: idx === arr.length - 1 ? +(target - pts * (arr.length - 1)).toFixed(3) : pts,
  }));
};

export const TestCaseManagerModal: React.FC<TestCaseManagerModalProps> = ({
  problem,
  onClose,
}) => {
  const { updateProblem, showToast } = useJudge();

  const [timeLimit, setTimeLimit] = useState(problem.timeLimit || 1.0);
  const [memoryLimit, setMemoryLimit] = useState(problem.memoryLimit || 1024);
  const [totalPoints, setTotalPoints] = useState(problem.totalPoints || 10);
  const [totalPointsInput, setTotalPointsInput] = useState(() =>
    formatPointValue(problem.totalPoints || 10)
  );
  const [pointDrafts, setPointDrafts] = useState<Record<string, string>>({});
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
    const target = Number(totalPoints) > 0 ? Number(totalPoints) : 10;
    const distributed = distributePointsEvenly(testCases, target);
    const pts = +(target / testCases.length).toFixed(3);
    setTestCases(distributed);
    setPointDrafts({});
    showToast(
      'Tự động chia điểm',
      `Đã chia đều ${formatPointValue(target)} điểm cho ${testCases.length} tests (${formatPointValue(pts)} điểm/test)`,
      'success'
    );
  };

  // Thêm test case thủ công (vẫn hỗ trợ song song cho bài nhỏ)
  const handleAddManualTest = () => {
    const nextIdx = testCases.length + 1;
    const newId = `${problem.id}_tc_m_${Date.now()}_${nextIdx}`;
    const defaultPts = +(totalPoints / Math.max(1, nextIdx)).toFixed(3);
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

      const parsedInputTotal = parseDecimalInput(totalPointsInput);
      const targetPoints =
        Number.isFinite(parsedInputTotal) && parsedInputTotal > 0
          ? +parsedInputTotal.toFixed(3)
          : (Number(totalPoints) > 0 ? +Number(totalPoints).toFixed(3) : 10);
      const currentSum = testCases.reduce((sum, tc) => sum + (Number(tc.points) || 0), 0);
      let finalizedTests = [...testCases];
      if (finalizedTests.length > 0 && Math.abs(currentSum - targetPoints) > 0.05) {
        finalizedTests = distributePointsEvenly(finalizedTests, targetPoints);
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
  const problemCodeText =
    typeof problem.code === 'object' ? JSON.stringify(problem.code) : String(problem.code || '');
  const problemTitleText =
    typeof problem.title === 'object' ? JSON.stringify(problem.title) : String(problem.title || '');
  const headerIdentifier = problemCodeText.trim() || problemTitleText.trim();
  const hasStatusSection =
    (isLoadingTests && Boolean(uploadStage)) ||
    (!isLoadingTests && Boolean(pendingUpload)) ||
    (!isLoadingTests && !pendingUpload && testCases.length > 0) ||
    Boolean(parseError);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSafeClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-150"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      <div className="tc-editorial-modal bg-white border border-[#D9D2C3] rounded-2xl max-w-[820px] w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative text-[#1F1D1A]">
        {/* Header */}
        <div className="shrink-0 px-7 pt-6 pb-4 border-b border-[#E6E0D3] flex items-start justify-between gap-4 bg-white">
          <div className="min-w-0">
            <h3
              className="text-[21px] sm:text-[22px] font-bold tracking-tight text-[#1F1D1A] leading-snug truncate"
              style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
            >
              Test case
              {headerIdentifier && (
                <>
                  <span className="text-[#6B655C] font-normal mx-1.5">·</span>
                  <span>{headerIdentifier}</span>
                </>
              )}
            </h3>
            <p className="text-[13px] text-[#6B655C] mt-1 leading-relaxed">
              Nạp bộ test dạng .ZIP, hệ thống tự ghép cặp .INP / .OUT. File đi thẳng lên kho lưu trữ, không nặng trình duyệt.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSafeClose}
            disabled={isLoadingTests}
            className="p-1.5 -mr-1.5 rounded-lg text-[#6B655C] hover:text-[#1F1D1A] hover:bg-[#FAF7EE] transition-colors cursor-pointer disabled:opacity-40 shrink-0"
            title="Đóng (Phím ESC hoặc click ra ngoài)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto bg-white">
          {/* Top Config Row: Giới hạn thời gian · Giới hạn bộ nhớ · Thang điểm */}
          <div className="px-7 py-5 border-b border-[#E6E0D3] grid grid-cols-1 md:grid-cols-[1fr_1fr_1.55fr] gap-5 items-end">
            <div>
              <label className="block text-[13px] font-bold text-[#1F1D1A] mb-2">
                Giới hạn thời gian
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10.0"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(parseFloat(e.target.value))}
                  className="h-10 w-full px-3.5 bg-white border border-[#D9D2C3] rounded-lg text-[14px] text-[#1F1D1A] font-mono focus:outline-none focus:border-[#1F1D1A] transition-colors"
                />
                <span className="text-[13px] text-[#6B655C] shrink-0">giây</span>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[#1F1D1A] mb-2">
                Giới hạn bộ nhớ
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="16"
                  max="2048"
                  value={memoryLimit}
                  onChange={(e) => setMemoryLimit(parseInt(e.target.value))}
                  className="h-10 w-full px-3.5 bg-white border border-[#D9D2C3] rounded-lg text-[14px] text-[#1F1D1A] font-mono focus:outline-none focus:border-[#1F1D1A] transition-colors"
                />
                <span className="text-[13px] text-[#6B655C] shrink-0">MB</span>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[#1F1D1A] mb-2">
                Thang điểm
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={totalPointsInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    // Chỉ cho phép số và tối đa 1 dấu chấm/phẩy thập phân
                    if (!/^\d*([.,]\d*)?$/.test(raw)) return;
                    setTotalPointsInput(raw);
                    const newTotal = parseDecimalInput(raw);
                    if (Number.isFinite(newTotal) && newTotal > 0 && newTotal <= 1000) {
                      const cleanTotal = +newTotal.toFixed(3);
                      setTotalPoints(cleanTotal);
                      if (testCases.length > 0) {
                        setTestCases((prev) => distributePointsEvenly(prev, cleanTotal));
                        setPointDrafts({});
                      }
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseDecimalInput(totalPointsInput);
                    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1000) {
                      const cleanTotal = +parsed.toFixed(3);
                      setTotalPoints(cleanTotal);
                      setTotalPointsInput(formatPointValue(cleanTotal));
                    } else {
                      setTotalPointsInput(formatPointValue(totalPoints));
                    }
                  }}
                  placeholder="10"
                  className="h-10 w-[76px] shrink-0 px-3 bg-white border border-[#D9D2C3] rounded-lg text-[14px] text-[#1F1D1A] font-mono focus:outline-none focus:border-[#1F1D1A] transition-colors"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  {[5, 10, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setTotalPoints(preset);
                        setTotalPointsInput(String(preset));
                        if (testCases.length > 0) {
                          setTestCases((prev) => distributePointsEvenly(prev, preset));
                          setPointDrafts({});
                        }
                      }}
                      className={`h-10 min-w-[38px] px-2.5 rounded-lg text-[13px] font-medium border transition-colors cursor-pointer ${
                        Math.abs(totalPoints - preset) < 1e-6
                          ? 'tc-preset-active bg-[#1F1D1A] text-white border-[#1F1D1A]'
                          : 'bg-white text-[#1F1D1A] border-[#D9D2C3] hover:border-[#1F1D1A]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                {testCases.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoDistributePoints}
                    className="text-[12.5px] leading-[1.25] text-[#B4281F] hover:text-[#8F1F18] underline underline-offset-2 text-left ml-1 max-w-[78px] cursor-pointer transition-colors"
                  >
                    Chia đều lại điểm
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dropzone Nạp Bộ Test */}
          <div className="px-7 py-6 border-b border-[#E6E0D3]">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`rounded-xl border border-dashed px-6 py-7 text-center transition-all ${
                isDragOver
                  ? 'bg-[#FDF2F0] border-[#B4281F] scale-[1.005]'
                  : 'bg-[#FAF7EE] border-[#D5CCBC] hover:border-[#B4281F]/60'
              }`}
            >
              {/* Biểu tượng thư mục .ZIP tối giản */}
              <svg
                className="w-16 h-12 mx-auto mb-3.5"
                viewBox="0 0 64 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M6 10.5C6 8.84315 7.34315 7.5 9 7.5H23.5L28 13H55C56.6569 13 58 14.3431 58 16V38.5C58 40.1569 56.6569 41.5 55 41.5H9C7.34315 41.5 6 40.1569 6 38.5V10.5Z"
                  stroke="#1F1D1A"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
                <line
                  x1="32"
                  y1="14"
                  x2="32"
                  y2="40.5"
                  stroke="#B4281F"
                  strokeWidth="2"
                  strokeDasharray="4 3.5"
                  strokeLinecap="round"
                />
              </svg>

              <h4
                className="text-[16px] font-bold text-[#1F1D1A]"
                style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
              >
                {isLoadingTests ? 'Đang xử lý gói test...' : 'Kéo thả file .ZIP vào đây'}
              </h4>
              <p className="text-[13px] text-[#6B655C] mt-1.5 max-w-[440px] mx-auto leading-relaxed">
                Tối đa 50 MB sau khi nén, khoảng 250 MB test gốc. Chọn cả thư mục thì hệ thống tự nén .ZIP trước khi tải.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
                <label
                  className={`tc-btn-primary cursor-pointer inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#B4281F] hover:bg-[#962018] text-white text-[13px] font-semibold transition-colors ${
                    isLoadingTests ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <span>Nạp file .ZIP</span>
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

                <label
                  className={`cursor-pointer inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-white hover:bg-[#F3EFE4] text-[#1F1D1A] text-[13px] font-semibold border border-[#1F1D1A] transition-colors ${
                    isLoadingTests ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <span>Nạp cả thư mục</span>
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

                <label
                  className={`cursor-pointer inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-white hover:bg-[#F3EFE4] text-[#1F1D1A] text-[13px] font-semibold border border-[#1F1D1A] transition-colors ${
                    isLoadingTests ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
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
          </div>

          {/* Dải trạng thái Cloud / Tiến trình / Cảnh báo lỗi */}
          {hasStatusSection && (
            <div className="px-7 py-4 border-b border-[#E6E0D3] space-y-3">
              {isLoadingTests && uploadStage && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1F1D1A]">
                      <Loader2 className="w-4 h-4 animate-spin text-[#B4281F] shrink-0" />
                      <span>{uploadStage.label}</span>
                    </div>
                    <span className="text-[13px] font-mono font-semibold text-[#1F1D1A]">
                      {uploadStage.percent}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#EAE4D7] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#B4281F] transition-all duration-200"
                      style={{ width: `${Math.max(4, uploadStage.percent)}%` }}
                    />
                  </div>
                </div>
              )}

              {!isLoadingTests && pendingUpload && (
                <div className="flex items-start gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-[#C26D00] mt-1.5 shrink-0" />
                  <div className="text-[13.5px] leading-snug">
                    <div>
                      <span className="font-bold text-[#B45309]">
                        Gói test mới sẵn sàng tải lên ({pendingUpload.pairs.length} test)
                      </span>
                      <span className="text-[#6B655C] ml-1.5">
                        dung lượng{' '}
                        <span className="font-mono text-[#1F1D1A]">
                          {formatSizeMb(pendingUpload.totalBytes)}
                        </span>
                        {pendingUpload.mode === 'zip' ? ' (.ZIP)' : ' (tự nén .ZIP)'}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-[#6B655C] mt-1">
                      Bấm <b>Lưu cấu hình test</b> ở góc dưới bên phải để tải gói test lên Cloud.
                    </p>
                  </div>
                </div>
              )}

              {!isLoadingTests && !pendingUpload && testCases.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-[#2E7D32] mt-1.5 shrink-0" />
                  <div className="text-[13.5px] leading-snug">
                    <div>
                      <span className="font-bold text-[#2E7D32]">
                        Đã nạp {testCases.length} test lên Cloud
                      </span>
                      <span className="text-[#6B655C] ml-2">
                        tổng điểm{' '}
                        <span className="font-mono text-[#1F1D1A]">
                          {formatPointValue(currentSumPoints)} / {formatPointValue(totalPoints)}
                        </span>
                      </span>
                    </div>
                    <p className="text-[12.5px] text-[#6B655C] mt-1">
                      Nội dung test được ẩn sẵn để mở trang nhanh. Bấm Xem / Sửa ở từng dòng khi cần kiểm tra.
                    </p>
                  </div>
                </div>
              )}

              {parseError && (
                <div className="p-3.5 rounded-lg bg-[#FDF2F0] border border-[#EBC5BF] flex items-start justify-between gap-3 text-[#8F1F18] animate-in fade-in duration-150">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-[#B4281F] shrink-0 mt-0.5" />
                    <div>
                      <h5
                        className="font-bold text-[13px] text-[#8F1F18]"
                        style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
                      >
                        Có lỗi xảy ra
                      </h5>
                      <p className="text-[12.5px] text-[#8F1F18]/90 mt-0.5 leading-relaxed">{parseError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setParseError(null)}
                    className="p-1 rounded-md hover:bg-[#B4281F]/10 text-[#B4281F] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Danh sách Test */}
          <div className="px-7 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h4
                className="text-[17px] font-bold text-[#1F1D1A]"
                style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
              >
                Danh sách test{' '}
                <span className="font-normal text-[#6B655C]">({testCases.length})</span>
              </h4>

              <div className="flex flex-wrap items-center gap-4">
                <span className="text-[13px] text-[#6B655C]">
                  Tổng{' '}
                  <span className="font-mono text-[#1F1D1A] ml-1">
                    {formatPointValue(currentSumPoints)} / {formatPointValue(totalPoints)}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={handleAutoDistributePoints}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#FAF7EE] text-[#1F1D1A] text-[13px] font-semibold border border-[#1F1D1A] transition-colors cursor-pointer"
                >
                  Chia đều điểm
                </button>

                <button
                  type="button"
                  onClick={handleAddManualTest}
                  className="text-[13px] font-semibold text-[#B4281F] hover:text-[#8F1F18] transition-colors cursor-pointer"
                >
                  + Thêm test thủ công
                </button>
              </div>
            </div>

            {testCases.length === 0 ? (
              <div className="py-10 px-6 text-center bg-[#FAF7EE] rounded-xl border border-dashed border-[#D5CCBC] text-[#6B655C]">
                <FolderArchive className="w-8 h-8 mx-auto text-[#8C8478] mb-2" />
                <p className="text-[13px] font-medium text-[#1F1D1A]">
                  Chưa có test case nào cho bài tập này.
                </p>
                <p className="text-[12.5px] mt-1 text-[#6B655C]">
                  Bấm <b>Nạp file .ZIP</b>, <b>Nạp cả thư mục</b> hoặc <b>+ Thêm test thủ công</b> để bắt đầu.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  {/* Header hàng bảng */}
                  <div className="grid grid-cols-[44px_minmax(130px,1.5fr)_110px_115px_85px_145px] items-center gap-3 py-2.5 border-t-[1.5px] border-t-[#1F1D1A] border-b border-b-[#E6E0D3] text-[12.5px] font-medium text-[#6B655C]">
                    <span>#</span>
                    <span>Test</span>
                    <span>Trạng thái</span>
                    <span>Điểm</span>
                    <span>Hiển thị</span>
                    <span className="text-right" />
                  </div>

                  {/* Các dòng Test */}
                  <div>
                    {testCases.map((tc, idx) => {
                      const isExpanded = expandedTestId === tc.id;
                      const isZipBacked =
                        (typeof tc.input === 'string' && tc.input.startsWith('__STORAGE_ZIP__:')) ||
                        Boolean(pendingUpload && !dirtyManualIds.has(tc.id));
                      const isInputTruncated = !isZipBacked && (tc.input || '').length > 1000;
                      const isOutputTruncated = !isZipBacked && (tc.expectedOutput || '').length > 1000;

                      return (
                        <div key={tc.id || idx} className="border-b border-[#ECE7DC]">
                          <div className="grid grid-cols-[44px_minmax(130px,1.5fr)_110px_115px_85px_145px] items-center gap-3 py-3 hover:bg-[#FAF7EE]/70 transition-colors">
                            <span className="font-mono text-[13.5px] text-[#6B655C]">
                              {idx + 1}
                            </span>

                            <input
                              type="text"
                              value={typeof tc.name === 'object' ? JSON.stringify(tc.name) : String(tc.name || '')}
                              onChange={(e) => handleUpdateTest(tc.id, 'name', e.target.value)}
                              className="tc-inline-name bg-transparent border-0 p-0 font-bold text-[14px] text-[#1F1D1A] focus:outline-none focus:underline w-full"
                            />

                            <div>
                              {pendingUpload && !dirtyManualIds.has(tc.id) ? (
                                <span className="text-[13px] font-semibold text-[#B45309]">
                                  Chờ tải .ZIP
                                </span>
                              ) : dirtyManualIds.has(tc.id) ? (
                                <span className="text-[13px] font-semibold text-[#1D4ED8]">
                                  Thủ công
                                </span>
                              ) : (
                                <span className="text-[13px] font-semibold text-[#2E7D32]">
                                  Đã nạp
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  pointDrafts[tc.id] !== undefined
                                    ? pointDrafts[tc.id]
                                    : formatPointValue(Number(tc.points) || 0)
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (!/^\d*([.,]\d*)?$/.test(raw)) return;
                                  setPointDrafts((prev) => ({ ...prev, [tc.id]: raw }));
                                  const parsed = parseDecimalInput(raw);
                                  if (Number.isFinite(parsed) && parsed >= 0) {
                                    handleUpdateTest(tc.id, 'points', +parsed.toFixed(3));
                                  } else if (raw === '') {
                                    handleUpdateTest(tc.id, 'points', 0);
                                  }
                                }}
                                onBlur={() => {
                                  setPointDrafts((prev) => {
                                    if (!(tc.id in prev)) return prev;
                                    const next = { ...prev };
                                    delete next[tc.id];
                                    return next;
                                  });
                                }}
                                className="w-[68px] h-8 px-2 bg-white border border-[#D9D2C3] rounded-md text-[13px] text-[#1F1D1A] font-mono text-right focus:outline-none focus:border-[#1F1D1A] transition-colors"
                              />
                              <span className="text-[13px] text-[#6B655C]">đ</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUpdateTest(tc.id, 'isHidden', !tc.isHidden)}
                              className={`text-left text-[13px] font-medium cursor-pointer transition-colors ${
                                tc.isHidden
                                  ? 'text-[#6B655C] hover:text-[#1F1D1A]'
                                  : 'text-[#1F1D1A] hover:text-[#B4281F]'
                              }`}
                              title={
                                tc.isHidden
                                  ? 'Test ẩn (học sinh không xem được dữ liệu) — bấm để đổi sang Hiện'
                                  : 'Test công khai — bấm để đổi sang Ẩn'
                              }
                            >
                              {tc.isHidden ? 'Ẩn' : 'Hiện'}
                            </button>

                            <div className="flex items-center justify-end gap-5">
                              <button
                                type="button"
                                onClick={() => handleToggleExpandTest(tc)}
                                className="text-[13px] font-semibold text-[#B4281F] hover:text-[#8F1F18] transition-colors cursor-pointer"
                                title="Mở xem hoặc sửa nội dung test này"
                              >
                                {isExpanded ? 'Thu gọn' : 'Xem / Sửa'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveTest(tc.id)}
                                className="text-[13px] font-medium text-[#6B655C] hover:text-[#B4281F] transition-colors cursor-pointer"
                                title="Xóa test này"
                              >
                                Xóa
                              </button>
                            </div>
                          </div>

                          {/* Khung chi tiết khi giáo viên bấm Xem / Sửa */}
                          {isExpanded && (
                            <div className="mb-3 p-4 rounded-xl bg-[#FAF7EE] border border-[#E6E0D3]">
                              {loadingDetailId === tc.id ? (
                                <div className="flex items-center gap-2 text-[13px] text-[#6B655C] py-1">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B4281F]" />
                                  <span>Đang tải nội dung test...</span>
                                </div>
                              ) : isZipBacked ? (
                                <div className="flex items-start gap-2.5 text-[13px] text-[#1F1D1A]">
                                  <FolderArchive className="w-4 h-4 text-[#2E7D32] shrink-0 mt-0.5" />
                                  <span className="leading-relaxed text-[#6B655C]">
                                    Dữ liệu test được lưu gọn trong gói nén <b className="text-[#1F1D1A]">.ZIP</b> trên Cloud Storage nên không tải về trình duyệt. Nếu cần sửa nội dung, hãy chỉnh file trên máy tính rồi kéo thả nạp lại gói .ZIP / Thư mục.
                                  </span>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-[11.5px] font-bold text-[#6B655C] uppercase tracking-wide">
                                        Input
                                      </span>
                                      {isInputTruncated && (
                                        <span className="text-[11px] font-mono text-[#B45309]">
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
                                      className={`w-full p-2.5 bg-white border border-[#D9D2C3] rounded-lg text-[12.5px] text-[#1F1D1A] font-mono focus:outline-none focus:border-[#1F1D1A] ${
                                        isInputTruncated ? 'cursor-not-allowed opacity-85' : ''
                                      }`}
                                    />
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-[11.5px] font-bold text-[#6B655C] uppercase tracking-wide">
                                        Expected Output
                                      </span>
                                      {isOutputTruncated && (
                                        <span className="text-[11px] font-mono text-[#2E7D32]">
                                          {formatSizeMb((tc.expectedOutput || '').length)} (Chỉ xem trước)
                                        </span>
                                      )}
                                    </div>
                                    <textarea
                                      rows={3}
                                      value={formatPreview(tc.expectedOutput)}
                                      readOnly={isOutputTruncated}
                                      onChange={(e) => {
                                        if (!isOutputTruncated)
                                          handleUpdateTest(tc.id, 'expectedOutput', e.target.value);
                                      }}
                                      placeholder="Đáp án đúng..."
                                      className={`w-full p-2.5 bg-white border border-[#D9D2C3] rounded-lg text-[12.5px] text-[#1F1D1A] font-mono focus:outline-none focus:border-[#1F1D1A] ${
                                        isOutputTruncated ? 'cursor-not-allowed opacity-85' : ''
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
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="shrink-0 px-7 py-4 bg-white border-t border-[#E6E0D3] flex items-center justify-between gap-4">
          <span className="text-[13px] text-[#6B655C]">
            Tổng {testCases.length} test · thang điểm {formatPointValue(totalPoints)}
          </span>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={handleSafeClose}
              disabled={isLoadingTests}
              className="text-[13.5px] font-semibold text-[#1F1D1A] hover:text-[#B4281F] transition-colors cursor-pointer disabled:opacity-40"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isLoadingTests}
              className="tc-btn-primary px-5 py-2.5 rounded-lg bg-[#B4281F] hover:bg-[#962018] text-white text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoadingTests && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{pendingUpload ? 'Tải gói .ZIP & Lưu cấu hình' : 'Lưu cấu hình test'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
