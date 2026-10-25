import React, { useState, useEffect } from 'react';
import { useJudge } from '../../context/JudgeContext';
import type { Problem, TestCase } from '../../types/judge';
import { idbService } from '../../services/db';
import { apiService } from '../../services/apiService';
import {
  parseThemisZipTestcases,
  parseThemisFileList,
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
} from 'lucide-react';

interface TestCaseManagerModalProps {
  problem: Problem;
  onClose: () => void;
}

/**
 * Chặn tràn bộ nhớ giao diện: Nếu nội dung test case dài quá 1000 ký tự,
 * khi hiển thị ra giao diện (để xem trước), BẮT BUỘC phải cắt ngắn chuỗi:
 * content.substring(0, 1000) + "\n... [Dữ liệu quá dài, đã ẩn bớt]"
 */
const formatPreview = (content: unknown): string => {
  if (content === null || content === undefined) return '';
  if (typeof content === 'object') {
    try {
      const jsonStr = JSON.stringify(content, null, 2);
      return jsonStr.length > 1000
        ? jsonStr.substring(0, 1000) + '\n... [Dữ liệu quá dài, đã ẩn bớt]'
        : jsonStr;
    } catch {
      return String(content);
    }
  }
  const str = String(content);
  if (str.length > 1000) {
    return str.substring(0, 1000) + '\n... [Dữ liệu quá dài, đã ẩn bớt]';
  }
  return str;
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
    // Deduplicate by name/order in case props has duplicate rows
    const seen = new Set<string>();
    return problem.testCases.filter((tc, idx) => {
      const key = tc.name || `Test #${idx + 1}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Tự động nạp test cases từ IndexedDB hoặc Cloud nếu problem trong props chưa có test cases HOẶC test cases bị rỗng nội dung input/output
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const hasContent = (tests?: TestCase[] | null) =>
        Boolean(tests && tests.length > 0 && tests.some((t) => (t.input && t.input.trim()) || (t.expectedOutput && t.expectedOutput.trim())));

      const isDuplicated = Boolean(
        problem.testCases &&
        problem.testCases.length > 1 &&
        problem.testCases.some((t, i) => problem.testCases!.findIndex((o) => o.name === t.name) !== i)
      );

      // Nếu không có nội dung thực tế (chỉ là metadata) hoặc có test trùng lặp
      if (!hasContent(problem.testCases) || isDuplicated) {
        setIsLoadingTests(true);
        try {
          let dbTests = await idbService.getTestCases(problem.id);
          if (!hasContent(dbTests) || isDuplicated) {
            dbTests = await apiService.fetchTestCases(problem.id);
          }
          if (isMounted && dbTests && dbTests.length > 0) {
            setTestCases(dbTests);
          }
        } catch (err) {
          console.warn('[TestCaseManagerModal] Lỗi nạp test cases:', err);
        } finally {
          if (isMounted) setIsLoadingTests(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [problem.id, problem.testCases]);

  // Đóng an toàn: Tự động lưu test cases nếu có nội dung để không bao giờ bị mất dữ liệu
  const handleSafeClose = async () => {
    const hasContent = testCases.some((t) => (t.input && t.input.trim()) || (t.expectedOutput && t.expectedOutput.trim()));
    if (hasContent && testCases.length > 0) {
      try {
        await idbService.saveTestCases(problem.id, testCases);
        await updateProblem(problem.id, {
          testCases,
          totalPoints: Number(totalPoints) || 10,
          timeLimit: Number(timeLimit) || 1.0,
          memoryLimit: Number(memoryLimit) || 1024,
        });
      } catch (err) {
        console.warn('[TestCaseManagerModal] Lỗi lưu tự động khi đóng:', err);
      }
    }
    onClose();
  };

  // Lắng nghe phím ESC để đóng modal an toàn
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSafeClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [testCases, totalPoints, timeLimit, memoryLimit]);

  // Tự động chia đều điểm cho các test case
  const handleAutoDistributePoints = () => {
    if (testCases.length === 0) return;
    const pts = +(totalPoints / testCases.length).toFixed(2);
    setTestCases(
      testCases.map((tc) => ({
        ...tc,
        points: pts,
      }))
    );
    showToast('Tự động chia điểm', `Đã chia đều ${totalPoints} điểm cho ${testCases.length} tests (${pts} điểm/test)`, 'success');
  };

  // Thêm test case thủ công
  const handleAddManualTest = () => {
    const nextIdx = testCases.length + 1;
    const defaultPts = +(totalPoints / Math.max(1, nextIdx)).toFixed(2);
    const newTest: TestCase = {
      id: `${problem.id}_tc_${nextIdx}`,
      name: `Test #${String(nextIdx).padStart(2, '0')}`,
      input: '',
      expectedOutput: '',
      points: defaultPts,
      isHidden: nextIdx > 2,
    };
    setTestCases([...testCases, newTest]);
  };

  // Xóa test case
  const handleRemoveTest = (id: string) => {
    setTestCases(testCases.filter((tc) => tc.id !== id));
  };

  // Cập nhật thông tin test
  const handleUpdateTest = (id: string, field: keyof TestCase, val: unknown) => {
    setTestCases(testCases.map((tc) => (tc.id === id ? { ...tc, [field]: val } : tc)));
  };

  // Xử lý nạp từ File ZIP
  const handleZipUpload = async (file: File) => {
    setIsLoadingTests(true);
    setParseError(null);
    setLoadingProgress(null);
    try {
      const { testCases: parsedTests, summary, warnings } = await parseThemisZipTestcases(
        file,
        totalPoints,
        (current, total) => setLoadingProgress({ current, total })
      );
      // Chuẩn hóa ID xác định theo bài toán
      const standardizedTests: TestCase[] = parsedTests.map((tc, idx) => ({
        ...tc,
        id: `${problem.id}_tc_${idx + 1}`,
        name: `Test #${String(idx + 1).padStart(2, '0')}`,
      }));
      setTestCases(standardizedTests);

      // TỰ ĐỘNG LƯU NGAY: Lưu vào IndexedDB và JudgeContext để khi người dùng ấn nút "X" Đóng thì test KHÔNG BỊ MẤT!
      await idbService.saveTestCases(problem.id, standardizedTests);
      await updateProblem(problem.id, {
        testCases: standardizedTests,
        totalPoints: Number(totalPoints) || 10,
        timeLimit: Number(timeLimit) || 1.0,
        memoryLimit: Number(memoryLimit) || 1024,
      });
      await apiService.saveTestCases(problem.id, standardizedTests).catch((err) => {
        console.warn('[TestCaseManagerModal] Lỗi lưu ngầm lên Cloud:', err);
      });

      showToast('Nạp Test Themis thành công', summary, 'success');
      if (warnings && warnings.length > 0) {
        showToast('Lưu ý nạp test', warnings.join(' '), 'warning');
      }
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || 'Không thể đọc file test';
      setParseError(errorMsg);
      showToast('Không thể đọc file test', errorMsg, 'error');
    } finally {
      setIsLoadingTests(false);
      setLoadingProgress(null);
    }
  };

  // Xử lý nạp nhiều file (.INP & .OUT) trực tiếp hoặc nạp nguyên thư mục
  const handleDirectFilesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    // Nếu chỉ chọn 1 file và file đó là file .zip
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      await handleZipUpload(files[0]);
      return;
    }

    setIsLoadingTests(true);
    setParseError(null);
    setLoadingProgress(null);
    try {
      const { testCases: parsedTests, summary, warnings } = await parseThemisFileList(
        files,
        totalPoints,
        (current, total) => setLoadingProgress({ current, total })
      );
      // Chuẩn hóa ID xác định theo bài toán
      const standardizedTests: TestCase[] = parsedTests.map((tc, idx) => ({
        ...tc,
        id: `${problem.id}_tc_${idx + 1}`,
        name: `Test #${String(idx + 1).padStart(2, '0')}`,
      }));
      setTestCases(standardizedTests);

      // TỰ ĐỘNG LƯU NGAY: Lưu vào IndexedDB và JudgeContext để khi người dùng ấn nút "X" Đóng thì test KHÔNG BỊ MẤT!
      await idbService.saveTestCases(problem.id, standardizedTests);
      await updateProblem(problem.id, {
        testCases: standardizedTests,
        totalPoints: Number(totalPoints) || 10,
        timeLimit: Number(timeLimit) || 1.0,
        memoryLimit: Number(memoryLimit) || 1024,
      });
      await apiService.saveTestCases(problem.id, standardizedTests).catch((err) => {
        console.warn('[TestCaseManagerModal] Lỗi lưu ngầm lên Cloud:', err);
      });

      showToast('Nạp Test Themis thành công', summary, 'success');
      if (warnings && warnings.length > 0) {
        showToast('Lưu ý nạp test', warnings.join(' '), 'warning');
      }
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || 'Không thể đọc file test';
      setParseError(errorMsg);
      showToast('Không thể đọc file test', errorMsg, 'error');
    } finally {
      setIsLoadingTests(false);
      setLoadingProgress(null);
    }
  };

  // Xử lý kéo thả Drag & Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleDirectFilesUpload(e.dataTransfer.files);
    }
  };

  // Lưu toàn bộ cấu hình vào problem
  const handleSaveAll = async () => {
    try {
      setIsLoadingTests(true);
      setParseError(null);

      const targetPoints = Number(totalPoints) || 10;
      // Đảm bảo tổng điểm các test case luôn tương ứng với thang điểm bài toán
      const currentSum = testCases.reduce((sum, tc) => sum + (Number(tc.points) || 0), 0);
      let finalizedTests = [...testCases];
      if (finalizedTests.length > 0 && Math.abs(currentSum - targetPoints) > 0.05) {
        const pts = +(targetPoints / finalizedTests.length).toFixed(2);
        finalizedTests = finalizedTests.map((tc, idx, arr) => ({
          ...tc,
          points: idx === arr.length - 1 ? +(targetPoints - pts * (arr.length - 1)).toFixed(2) : pts,
        }));
      }

      // 1. BẮT BUỘC AWAIT: Lưu trực tiếp vào Database thực tế (Supabase Cloud REST API / IndexedDB)
      await apiService.saveTestCases(problem.id, finalizedTests);

      // 2. Chỉ khi Database lưu thành công mới gọi cập nhật state bài tập trong React
      await updateProblem(problem.id, {
        timeLimit: Number(timeLimit) || 1.0,
        memoryLimit: Number(memoryLimit) || 1024,
        totalPoints: targetPoints,
        testCases: finalizedTests,
      });

      showToast('Đã lưu Test Case', `Đã lưu thành công ${finalizedTests.length} bộ test case cho bài [${problem.code}] (Thang điểm: ${targetPoints}đ) vào Database`, 'success');
      onClose();
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Lỗi lưu trữ test case vào Database';
      setParseError(`Không thể lưu cấu hình test: ${msg}`);
      showToast('Lỗi lưu test case', msg, 'error');
    } finally {
      setIsLoadingTests(false);
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
        {/* Sticky Header với nút Đóng to rõ */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-800/90 backdrop-blur sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                {typeof problem.code === 'object' ? JSON.stringify(problem.code) : String(problem.code || '')}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Trình Quản Lý Test Case Chuẩn Themis: {typeof problem.title === 'object' ? JSON.stringify(problem.title) : String(problem.title || '')}
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Quản lý các cặp Test.INP và Test.OUT, cấu hình giới hạn thực thi và phân bổ điểm số
            </p>
          </div>

          <button
            onClick={handleSafeClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all flex items-center gap-1 text-xs font-semibold"
            title="Đóng (Phím ESC hoặc click ra ngoài)"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Đóng</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
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
                    onClick={() => {
                      const target = Number(totalPoints) || 10;
                      const pts = +(target / testCases.length).toFixed(2);
                      setTestCases((prev) =>
                        prev.map((tc, idx, arr) => ({
                          ...tc,
                          points: idx === arr.length - 1 ? +(target - pts * (arr.length - 1)).toFixed(2) : pts,
                        }))
                      );
                      showToast('Đã chia đều điểm', `Đã chia đều ${target} điểm cho ${testCases.length} test case`, 'info');
                    }}
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
                  <button
                    type="button"
                    onClick={() => {
                      setTotalPoints(10);
                      if (testCases.length > 0) {
                        const pts = +(10 / testCases.length).toFixed(2);
                        setTestCases((prev) =>
                          prev.map((tc, idx, arr) => ({
                            ...tc,
                            points: idx === arr.length - 1 ? +(10 - pts * (arr.length - 1)).toFixed(2) : pts,
                          }))
                        );
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      totalPoints === 10
                        ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    10đ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTotalPoints(100);
                      if (testCases.length > 0) {
                        const pts = +(100 / testCases.length).toFixed(2);
                        setTestCases((prev) =>
                          prev.map((tc, idx, arr) => ({
                            ...tc,
                            points: idx === arr.length - 1 ? +(100 - pts * (arr.length - 1)).toFixed(2) : pts,
                          }))
                        );
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      totalPoints === 100
                        ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    100đ
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Hộp Nạp Bộ Test Linh Hoạt (Files / Folders / ZIP / Drag & Drop) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`p-6 rounded-3xl border-2 transition-all ${
              isDragOver
                ? 'bg-red-950/40 border-red-500 border-dashed scale-[1.01]'
                : 'bg-gradient-to-r from-red-950/20 via-slate-800/40 to-slate-900 border-slate-700/80 hover:border-red-500/50'
            }`}
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wider">
                  <FileCheck className="w-4 h-4" /> Nạp Bộ Test Case Tự Động Phân Cặp .INP & .OUT
                </div>
                <h4 className="text-base font-bold text-white">
                  {isLoadingTests ? 'Đang phân tích & ghép cặp...' : 'Chọn các file .INP/.OUT, tải Thư mục hoặc file .ZIP'}
                </h4>
                <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                  Hệ thống thông minh sẽ <b>tự động phân loại</b> đâu là dữ liệu vào (.INP) và đâu là đáp án (.OUT), lọc bỏ file rác hệ điều hành và chia đều điểm số.
                </p>
              </div>

              {/* Upload Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
                {/* 1. Chọn nhiều file .INP và .OUT cùng lúc */}
                <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/25 ${isLoadingTests ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Files className="w-4 h-4" />
                  <span>Chọn các file .INP & .OUT</span>
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

                {/* 2. Chọn nguyên cả Folder Test từ ổ cứng */}
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

                {/* 3. Nạp file ZIP */}
                <label className={`cursor-pointer inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-all ${isLoadingTests ? 'opacity-50 pointer-events-none' : ''}`}>
                  <FolderArchive className="w-4 h-4 text-blue-400" />
                  <span>File .ZIP</span>
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
              </div>
            </div>

            <div className="mt-3 text-center text-[11px] text-slate-500">
              💡 Hoặc kéo & thả trực tiếp các file <b>.INP</b>, <b>.OUT</b> hoặc file <b>.ZIP</b> vào khung này
            </div>
          </div>

          {/* Hiệu ứng Loading Spinner (Rule 4) */}
          {isLoadingTests && (
            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/40 flex items-center justify-center gap-3 text-blue-300 animate-pulse">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400 shrink-0" />
              <span className="text-xs font-semibold">
                {loadingProgress
                  ? `Đang đọc và ghép cặp các test case (${loadingProgress.current}/${loadingProgress.total} file)... Vui lòng đợi trong giây lát!`
                  : 'Đang giải nén, lọc file rác và ghép cặp các test case chuẩn Themis... Vui lòng đợi trong giây lát!'}
              </span>
            </div>
          )}

          {/* Thông báo lỗi khi nạp file thất bại (Rule 1) */}
          {parseError && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 flex items-start justify-between gap-3 text-rose-300 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-xs text-rose-200">Không thể đọc file test</h5>
                  <p className="text-xs text-rose-300/90 mt-0.5 leading-relaxed">{typeof parseError === 'object' && parseError !== null ? JSON.stringify(parseError) : String(parseError)}</p>
                </div>
              </div>
              <button
                onClick={() => setParseError(null)}
                className="p-1 rounded-lg hover:bg-rose-900/40 text-rose-400 hover:text-white transition-colors"
                title="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Test Cases List Header & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-red-400" />
                Danh sách Test Cases ({testCases.length} tests)
              </h4>
              <span className="text-xs font-mono text-slate-400">
                Tổng điểm test: <b className="text-amber-400">{currentSumPoints.toFixed(1)}</b> / {totalPoints}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoDistributePoints}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                title="Tự động chia đều tổng điểm cho tất cả các test case"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Chia đều điểm
              </button>

              <button
                type="button"
                onClick={handleAddManualTest}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm Test thủ công
              </button>
            </div>
          </div>

          {/* Test cases list */}
          {testCases.length === 0 ? (
            <div className="p-12 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 text-slate-500">
              <FolderArchive className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-xs">Chưa có test case nào cho bài tập này.</p>
              <p className="text-xs mt-1 text-slate-400">
                Hãy bấm <b>"Chọn các file .INP & .OUT"</b> hoặc <b>"Nạp cả Thư mục Test"</b> ở trên.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {testCases.map((tc, idx) => {
                const isInputTruncated = (typeof tc.input === 'string' ? tc.input.length : String(tc.input || '').length) > 1000;
                const isOutputTruncated = (typeof tc.expectedOutput === 'string' ? tc.expectedOutput.length : String(tc.expectedOutput || '').length) > 1000;

                return (
                  <div
                    key={tc.id || idx}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 relative group"
                  >
                    {/* Test Top Line */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-xs font-bold">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={typeof tc.name === 'object' ? JSON.stringify(tc.name) : String(tc.name || '')}
                          onChange={(e) => handleUpdateTest(tc.id, 'name', e.target.value)}
                          className="bg-transparent border-0 font-bold text-xs text-white focus:ring-0 p-0 hover:underline"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Points per test */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span>Điểm:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={tc.points}
                            onChange={(e) => handleUpdateTest(tc.id, 'points', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-amber-300 font-mono font-bold text-center focus:outline-none"
                          />
                          <span>đ</span>
                        </div>

                        {/* Hidden status toggle */}
                        <button
                          type="button"
                          onClick={() => handleUpdateTest(tc.id, 'isHidden', !tc.isHidden)}
                          className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                            tc.isHidden
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                          title={tc.isHidden ? 'Test ẩn (học sinh không xem được dữ liệu)' : 'Test công khai'}
                        >
                          {tc.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span className="text-[10px]">{tc.isHidden ? 'Ẩn' : 'Hiện'}</span>
                        </button>

                        {/* Delete Test */}
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

                    {/* Input and Expected Output columns (Rule 3: Truncate Preview for > 1000 chars) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                            Input ({typeof problem.code === 'string' ? problem.code : String(problem.code || '')}.INP):
                          </span>
                          {isInputTruncated && (
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              {(((typeof tc.input === 'string' ? tc.input.length : String(tc.input || '').length)) / 1024).toFixed(1)} KB (Đã ẩn bớt để tránh tràn bộ nhớ)
                            </span>
                          )}
                        </div>
                        <textarea
                          rows={3}
                          value={formatPreview(tc.input)}
                          readOnly={isInputTruncated}
                          onChange={(e) => {
                            if (!isInputTruncated) {
                              handleUpdateTest(tc.id, 'input', e.target.value);
                            }
                          }}
                          placeholder="Dữ liệu vào..."
                          className={`w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono leading-relaxed ${
                            isInputTruncated ? 'cursor-not-allowed opacity-90' : ''
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                            Expected Output ({typeof problem.code === 'string' ? problem.code : String(problem.code || '')}.OUT):
                          </span>
                          {isOutputTruncated && (
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              {(((typeof tc.expectedOutput === 'string' ? tc.expectedOutput.length : String(tc.expectedOutput || '').length)) / 1024).toFixed(1)} KB (Đã ẩn bớt để tránh tràn bộ nhớ)
                            </span>
                          )}
                        </div>
                        <textarea
                          rows={3}
                          value={formatPreview(tc.expectedOutput)}
                          readOnly={isOutputTruncated}
                          onChange={(e) => {
                            if (!isOutputTruncated) {
                              handleUpdateTest(tc.id, 'expectedOutput', e.target.value);
                            }
                          }}
                          placeholder="Đáp án đúng tương ứng..."
                          className={`w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-emerald-400 font-mono leading-relaxed ${
                            isOutputTruncated ? 'cursor-not-allowed opacity-90' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Footer với nút Đóng / Hủy */}
        <div className="shrink-0 p-4 bg-slate-800/90 border-t border-slate-800 flex items-center justify-between sticky bottom-0 z-10">
          <span className="text-xs text-slate-400">
            Tổng cộng: <b>{testCases.length}</b> tests • Thang điểm:{' '}
            <b className="text-amber-400">{totalPoints}đ</b>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSafeClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
            >
              Đóng / Hủy
            </button>
            <button
              onClick={handleSaveAll}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-600/25 transition-all"
            >
              <Save className="w-4 h-4" /> Lưu cấu hình Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
