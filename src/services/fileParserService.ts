import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import type { Problem, TestCase } from '../types/judge';

/**
 * Regex lọc bỏ các file rác và thư mục ẩn hệ điều hành (macOS, Windows, Git, SVN)
 */
export const JUNK_PATH_REGEX = /(?:^|[/\\])(?:__MACOSX|\.DS_Store|desktop\.ini|Thumbs\.db|\.git|\.svn)(?:[/\\]|$)/i;
export const JUNK_FILENAME_REGEX = /^(?:\._|\.DS_Store|desktop\.ini|Thumbs\.db|\.)/i;
export const VALID_TEST_EXT_REGEX = /\.(inp|out|in|ans|txt)$/i;

/**
 * Kiểm tra xem một file có phải là file rác/hệ thống hay không
 */
export function isJunkOrSystemFile(path: string, fileName: string): boolean {
  if (JUNK_PATH_REGEX.test(path)) return true;
  if (JUNK_FILENAME_REGEX.test(fileName)) return true;
  if (!VALID_TEST_EXT_REGEX.test(fileName)) return true;
  return false;
}

/**
 * Chuyển đổi File thành chuỗi DataURL (Base64) để lưu trữ và tải về
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Trích xuất nội dung từ file Word (.docx), giữ nguyên cấu trúc bảng và định dạng HTML
 */
export async function parseDocxFile(file: File): Promise<{ text: string; html: string; dataUrl: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const rawResult = await mammoth.extractRawText({ arrayBuffer });
  const htmlResult = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "table => table.table-bordered",
      ],
    }
  );
  const dataUrl = await fileToBase64(file);

  return {
    text: rawResult.value,
    html: htmlResult.value,
    dataUrl,
  };
}

/**
 * Đọc file văn bản thuần hoặc file PDF (client-side text extraction + base64)
 */
export async function parseTextOrPdfFile(file: File): Promise<{ text: string; dataUrl: string }> {
  const dataUrl = await fileToBase64(file);

  if (file.name.toLowerCase().endsWith('.pdf')) {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const raw = decoder.decode(buffer);

    // Lọc các chuỗi text có thể đọc được từ stream PDF
    const textMatches = raw.match(/\(([^()]+)\)[\s]*Tj/g) || [];
    let extracted = textMatches
      .map((m) => m.replace(/^[\\(]/, '').replace(/\)[\s]*Tj$/, ''))
      .join(' ');

    if (!extracted || extracted.length < 20) {
      extracted = `[Đề thi đính kèm dạng file PDF: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]\nHọc sinh có thể xem hoặc tải file đề thi gốc ở khung bên trên.`;
    }
    return { text: extracted, dataUrl };
  }

  const text = await file.text();
  return { text, dataUrl };
}

/**
 * Trích xuất danh sách bài tập hoặc bảng Test Case từ file Excel (.xlsx)
 */
export async function parseExcelFile(
  file: File
): Promise<{ problems?: Partial<Problem>[]; testCases?: Partial<TestCase>[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (rows.length === 0) {
    return {};
  }

  const firstRowKeys = Object.keys(rows[0]).map((k) => k.toLowerCase());

  if (firstRowKeys.some((k) => k.includes('mã bài') || k.includes('tiêu đề') || k.includes('title') || k.includes('code'))) {
    const problems: Partial<Problem>[] = rows.map((r, index) => {
      const getVal = (candidates: string[]) => {
        for (const [key, value] of Object.entries(r)) {
          if (candidates.some((c) => key.toLowerCase().includes(c))) {
            return String(value);
          }
        }
        return '';
      };

      const code = getVal(['code', 'mã bài', 'mã']) || `BAI_${index + 1}`;
      const title = getVal(['title', 'tiêu đề', 'tên']) || `Bài tập ${code}`;
      const description = getVal(['mô tả', 'đề bài', 'description']) || 'Mô tả bài toán...';
      const timeLimit = parseFloat(getVal(['thời gian', 'time'])) || 1.0;
      const memoryLimit = parseInt(getVal(['bộ nhớ', 'memory'])) || 256;
      const totalPoints = parseInt(getVal(['điểm', 'points', 'thang điểm'])) || 10;

      return {
        id: `prob_imported_${Date.now()}_${index}`,
        code: code.toUpperCase().replace(/\s+/g, '_'),
        title,
        description,
        timeLimit,
        memoryLimit,
        totalPoints,
        difficulty: 'Trung bình',
        inputFormat: 'Dòng đầu chứa dữ liệu vào.',
        outputFormat: 'In ra kết quả bài toán.',
        constraints: '1 <= N <= 10^5',
        samples: [{ id: 'sample_1', input: '1 2', output: '3', explanation: 'Ví dụ mẫu' }],
        testCases: [],
        videoConfig: { enabled: false, type: 'youtube', url: '', unlockRule: 'always' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    return { problems };
  } else {
    const testCases: Partial<TestCase>[] = rows.map((r, index) => {
      const getVal = (candidates: string[]) => {
        for (const [key, value] of Object.entries(r)) {
          if (candidates.some((c) => key.toLowerCase().includes(c))) {
            return String(value);
          }
        }
        return '';
      };

      const input = getVal(['input', 'đầu vào', 'inp', 'dữ liệu vào']);
      const output = getVal(['output', 'kết quả', 'đáp án', 'out', 'expected']);
      const points = parseFloat(getVal(['điểm', 'point', 'weight'])) || 1.0;

      return {
        id: `test_xlsx_${index + 1}`,
        name: `Test #${String(index + 1).padStart(2, '0')}`,
        input,
        expectedOutput: output,
        points,
      };
    });

    return { testCases };
  }
}

interface RawFileItem {
  path: string;
  name: string;
  content: string;
}

/**
 * Thuật toán ghép cặp thông minh giữa file Input và Output chuẩn Themis
 * Hỗ trợ tất cả các định dạng:
 *  1. Cấu trúc thư mục Themis: Test01/BAI.INP & Test01/BAI.OUT
 *  2. Lồng thư mục: TEST/bai2/Test01/BAI2.INP & TEST/bai2/Test01/BAI2.OUT
 *  3. File phẳng: test01.inp & test01.out hoặc 01.inp & 01.out
 *  4. Đuôi mở rộng: .inp / .out, .in / .out, .in / .ans, .txt
 */
export function pairTestFiles(
  items: RawFileItem[],
  totalPoints: number = 10
): { testCases: TestCase[]; summary: string; warnings: string[] } {
  const warnings: string[] = [];
  const inputs: RawFileItem[] = [];
  const outputs: RawFileItem[] = [];

  for (const item of items) {
    const lowerName = item.name.toLowerCase();
    const lowerPath = item.path.toLowerCase();

    const isInput =
      lowerName.endsWith('.inp') ||
      lowerName.endsWith('.in') ||
      lowerName.includes('input') ||
      (lowerName.endsWith('.txt') && lowerPath.includes('in') && !lowerPath.includes('out'));

    const isOutput =
      lowerName.endsWith('.out') ||
      lowerName.endsWith('.ans') ||
      lowerName.includes('output') ||
      (lowerName.endsWith('.txt') && (lowerPath.includes('out') || lowerPath.includes('ans')));

    if (isInput && !isOutput) {
      inputs.push(item);
    } else if (isOutput && !isInput) {
      outputs.push(item);
    } else if (isInput && isOutput) {
      if (lowerName.includes('out') || lowerName.includes('ans')) {
        outputs.push(item);
      } else {
        inputs.push(item);
      }
    }
  }

  if (inputs.length === 0 || outputs.length === 0) {
    throw new Error(
      `Không tìm thấy đủ cặp file test! (Tìm thấy ${inputs.length} file Input và ${outputs.length} file Output). Vui lòng kiểm tra các file có đuôi .INP và .OUT tương ứng.`
    );
  }

  // Hàm trích xuất Key nhận diện bài test từ path hoặc name
  const extractTestKey = (item: RawFileItem): string => {
    const normalized = item.path.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);

    // Cách 1: Thư mục chứa chữ "test" hoặc số (e.g. Test01, Test02, 01, 1)
    if (parts.length >= 2) {
      for (let i = parts.length - 2; i >= 0; i--) {
        const seg = parts[i];
        if (/test[_\s-]*\d+/i.test(seg) || /^\d+$/.test(seg)) {
          return seg.trim();
        }
      }
      const parent = parts[parts.length - 2];
      if (parent && !parent.toLowerCase().includes('bai') && !parent.toLowerCase().includes('problem')) {
        return parent.trim();
      }
    }

    // Cách 2: Trích xuất từ tên file (e.g. test01.inp -> 01, 1.inp -> 1, bai2_01.inp -> 01)
    const base = item.name.replace(/\.[^/.]+$/, '');
    const numMatch = base.match(/\d+/g);
    if (numMatch) {
      return numMatch[numMatch.length - 1]; // Lấy chuỗi số cuối cùng
    }
    return base.trim();
  };

  // Gom các cặp Input và Output
  const map = new Map<string, { name: string; input?: string; output?: string }>();

  // Duyệt inputs
  for (const inp of inputs) {
    const key = extractTestKey(inp);
    if (!map.has(key)) {
      map.set(key, { name: key });
    }
    map.get(key)!.input = inp.content;
  }

  // Duyệt outputs
  for (const out of outputs) {
    const key = extractTestKey(out);
    if (map.has(key)) {
      map.get(key)!.output = out.content;
    } else {
      // Thử tìm theo số tương đương (ví dụ key "1" khớp "01" hoặc "Test 1")
      const numMatch = key.match(/\d+/);
      let matched = false;
      if (numMatch) {
        const numVal = parseInt(numMatch[0], 10);
        for (const [k, val] of map.entries()) {
          const kNum = k.match(/\d+/);
          if (kNum && parseInt(kNum[0], 10) === numVal && val.output === undefined) {
            val.output = out.content;
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        map.set(key, { name: key, output: out.content });
      }
    }
  }

  // Lọc ra các cặp đầy đủ cả Input và Output, bỏ qua các file thiếu cặp đối ứng (Rule 2)
  const validPairs: { key: string; input: string; output: string }[] = [];
  let skippedMissingOut = 0;
  let skippedMissingIn = 0;

  map.forEach((val, key) => {
    if (val.input !== undefined && val.output !== undefined) {
      validPairs.push({
        key,
        input: val.input,
        output: val.output,
      });
    } else if (val.input !== undefined && val.output === undefined) {
      skippedMissingOut++;
    } else if (val.input === undefined && val.output !== undefined) {
      skippedMissingIn++;
    }
  });

  if (skippedMissingOut > 0) {
    warnings.push(`Đã bỏ qua ${skippedMissingOut} file Input không có file Output đối ứng.`);
  }
  if (skippedMissingIn > 0) {
    warnings.push(`Đã bỏ qua ${skippedMissingIn} file Output không có file Input đối ứng.`);
  }

  // Fallback ghép tuần tự 1-1 nếu không khớp theo key nhưng có đủ cả 2 danh sách
  if (validPairs.length === 0 && inputs.length > 0 && outputs.length > 0) {
    inputs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    outputs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const count = Math.min(inputs.length, outputs.length);
    for (let i = 0; i < count; i++) {
      if (inputs[i]?.content !== undefined && outputs[i]?.content !== undefined) {
        validPairs.push({
          key: `Test ${i + 1}`,
          input: inputs[i].content,
          output: outputs[i].content,
        });
      }
    }
  }

  if (validPairs.length === 0) {
    throw new Error(
      `Không thể tự động ghép cặp file Input và Output! Đã tìm thấy ${inputs.length} file .INP và ${outputs.length} file .OUT nhưng tên hoặc cấu trúc thư mục không tương ứng.`
    );
  }

  // Sắp xếp tự nhiên (Natural Sort: Test 1, Test 2, ..., Test 9, Test 10, ..., Test 20)
  validPairs.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' }));

  const pointsPerTest = +(totalPoints / validPairs.length).toFixed(2);

  // Tạo TestCase: Lưu 100% dữ liệu gốc cho việc chấm thi
  const testCases: TestCase[] = validPairs.map((pair, idx) => ({
    id: `test_themis_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
    name: `Test #${String(idx + 1).padStart(2, '0')}`,
    input: pair.input,
    expectedOutput: pair.output,
    points: pointsPerTest,
    isHidden: idx >= 3,
  }));

  const summary = `Đã ghép cặp thành công ${testCases.length} bộ Test Case Themis (.INP & .OUT). Mỗi test được phân bổ ${pointsPerTest} điểm.`;

  return { testCases, summary, warnings };
}

/**
 * Xử lý khi người dùng chọn nhiều file (.INP và .OUT) trực tiếp hoặc tải cả thư mục từ máy tính
 * Hỗ trợ bất đồng bộ, nhường luồng (non-blocking) và lọc file rác
 */
export async function parseThemisFileList(
  files: FileList | File[],
  totalPoints: number = 10,
  onProgress?: (current: number, total: number) => void
): Promise<{ testCases: TestCase[]; summary: string; warnings: string[] }> {
  const fileArray = Array.from(files);
  const items: RawFileItem[] = [];

  // Lọc bỏ ngay lập tức các file rác và file hệ thống (Rule 2)
  const validFiles: { file: File; path: string; name: string }[] = [];
  for (const file of fileArray) {
    const path = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const normalizedPath = path.replace(/\\/g, '/');
    const name = file.name;

    if (isJunkOrSystemFile(normalizedPath, name)) {
      continue;
    }
    validFiles.push({ file, path: normalizedPath, name });
  }

  if (validFiles.length === 0) {
    throw new Error('Không tìm thấy file test hợp lệ (.INP/.OUT/.IN/.ANS/.TXT) trong danh sách đã chọn');
  }

  // Đọc file bất đồng bộ kết hợp nhường luồng event loop (Rule 4)
  for (let i = 0; i < validFiles.length; i++) {
    const { file, path, name } = validFiles[i];
    const content = await file.text();
    items.push({
      path,
      name,
      content,
    });

    if (onProgress) {
      onProgress(i + 1, validFiles.length);
    }

    // Nhường luồng cho giao diện mỗi 3 file
    if (i % 3 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return pairTestFiles(items, totalPoints);
}

/**
 * Giải nén và phân tích bộ Test Case từ file nén .ZIP
 * Hỗ trợ bất đồng bộ, nhường luồng (non-blocking) và lọc file rác
 */
export async function parseThemisZipTestcases(
  file: File,
  totalPoints: number = 10,
  onProgress?: (current: number, total: number) => void
): Promise<{ testCases: TestCase[]; summary: string; warnings: string[] }> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const items: RawFileItem[] = [];
  const validEntries: { relativePath: string; zipEntry: JSZip.JSZipObject; name: string }[] = [];

  // 1. Quét lọc trước: Bỏ qua thư mục rỗng và file ẩn hệ điều hành (__MACOSX, .DS_Store, desktop.ini) (Rule 2)
  loadedZip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;

    const normalizedPath = relativePath.replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(Boolean);
    const fileName = parts[parts.length - 1] || '';

    if (!fileName || isJunkOrSystemFile(normalizedPath, fileName)) {
      return;
    }

    validEntries.push({ relativePath: normalizedPath, zipEntry, name: fileName });
  });

  if (validEntries.length === 0) {
    throw new Error('File nén .ZIP không chứa bất kỳ file test hợp lệ (.INP/.OUT/.IN/.ANS/.TXT) nào');
  }

  // 2. Đọc tuần tự bất đồng bộ và nhường luồng event loop để UI không bị freeze (Rule 4)
  for (let i = 0; i < validEntries.length; i++) {
    const { relativePath, zipEntry, name } = validEntries[i];
    const content = await zipEntry.async('string');
    items.push({
      path: relativePath,
      name,
      content,
    });

    if (onProgress) {
      onProgress(i + 1, validEntries.length);
    }

    // Nhường luồng event loop để browser giữ FPS và cập nhật Spinner Loading
    if (i % 3 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return pairTestFiles(items, totalPoints);
}
