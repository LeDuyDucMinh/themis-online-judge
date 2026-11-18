// api/grade.js - Vercel Serverless Function: Chấm điểm bảo mật phía Server (Server-Side Grading)
// Khắc phục triệt để VULN-01 & VULN-03: Che giấu toàn bộ Test Case ẩn, không cho phép học sinh F12 xem trộm

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://wsccqtgnwejupfucfqtg.supabase.co').trim().replace(/\/+$/, '');
const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2NxdGdud2VqdXBmdWNmcXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NjAxMTYsImV4cCI6MjEwODIzNjExNn0.ILXlVuUZGPfVo9n2_IhpVQHIPJ8QkZHajAWAKMP1280'
).trim();

const JUDGE0_TARGET = (process.env.JUDGE0_API_URL || 'http://103.149.170.5:2358').trim().replace(/\/+$/, '');
const JUDGE0_TOKEN = (process.env.JUDGE0_API_TOKEN || 'faminh_secret_api_token').trim();

const JUDGE0_LANGUAGE_MAP = {
  cpp: 54,
  c: 50,
  python: 71,
  pascal: 67,
  java: 62,
};

// Rate limiting in-memory: 20 bài nộp / phút / IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_SUBMISSIONS_PER_IP = 20;
const ipSubmissionsMap = new Map();

function isAllowedOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
    if (host === 'faminh.io.vn' || host.endsWith('.faminh.io.vn')) return true;
    if (host.endsWith('.vercel.app')) return true;
    return false;
  } catch {
    return false;
  }
}

// 1. Natural Sort
function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

// 2. Normalize output theo chuẩn Themis
function normalizeThemisOutput(output) {
  if (!output) return '';
  const lines = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const trimmed = lines.map((l) => l.replace(/[\s\x00-\x1F\x7F]+$/, ''));
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') {
    trimmed.pop();
  }
  return trimmed.join('\n');
}

// 3. So sánh output chuẩn Themis (whitespace, float tolerance 1e-6, case-insensitive logic)
function compareThemisOutputs(actual, expected) {
  const normActual = normalizeThemisOutput(actual);
  const normExpected = normalizeThemisOutput(expected);

  if (normActual === normExpected || normActual.trim() === normExpected.trim()) {
    return true;
  }

  const linesActual = normActual.split('\n');
  const linesExpected = normExpected.split('\n');
  if (linesActual.length === linesExpected.length) {
    let allMatch = true;
    for (let i = 0; i < linesActual.length; i++) {
      if (linesActual[i].trimEnd() !== linesExpected[i].trimEnd()) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }

  const actTokens = normActual.trim().split(/\s+/).filter(Boolean);
  const expTokens = normExpected.trim().split(/\s+/).filter(Boolean);
  if (actTokens.length !== expTokens.length) return false;

  for (let i = 0; i < actTokens.length; i++) {
    const act = actTokens[i];
    const exp = expTokens[i];
    if (act === exp) continue;

    const actLower = act.toLowerCase();
    const expLower = exp.toLowerCase();
    if (actLower === expLower && ['yes', 'no', 'true', 'false'].includes(expLower)) {
      continue;
    }

    const numAct = parseFloat(act);
    const numExp = parseFloat(exp);
    if (!isNaN(numAct) && !isNaN(numExp) && isFinite(numAct) && isFinite(numExp)) {
      if (Math.abs(numAct - numExp) <= 1e-6) continue;
    }
    return false;
  }
  return true;
}

// 4. Preprocess code: loại bỏ freopen an toàn
function preprocessCode(code, language) {
  let cleaned = code;
  let freopenHandled = false;

  if (language === 'cpp' || language === 'c') {
    const r = /freopen\s*\([^;]*\)\s*;/gi;
    if (r.test(cleaned)) {
      freopenHandled = true;
      cleaned = cleaned.replace(r, ' ');
    }
  } else if (language === 'pascal') {
    const r = /(assign|reset|rewrite|close)\s*\(\s*(input|output)[^;]*\)\s*;/gi;
    if (r.test(cleaned)) {
      freopenHandled = true;
      cleaned = cleaned.replace(r, ' ');
    }
  } else if (language === 'python') {
    const r = /sys\.(stdin|stdout)\s*=\s*open\s*\([^)]*\)/gi;
    if (r.test(cleaned)) {
      freopenHandled = true;
      cleaned = cleaned.replace(r, ' ');
    }
  } else if (language === 'java') {
    cleaned = cleaned.replace(/public\s+class\s+\w+/g, 'public class Main');
  }

  return { cleaned, freopenHandled };
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // CORS check
  let isOriginAllowed = false;
  let responseOrigin = '';
  if (origin && isAllowedOrigin(origin)) {
    isOriginAllowed = true;
    responseOrigin = origin;
  } else if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (isAllowedOrigin(refOrigin)) {
        isOriginAllowed = true;
        responseOrigin = refOrigin;
      }
    } catch {}
  } else {
    const secFetch = req.headers['sec-fetch-site'];
    if (!secFetch || secFetch === 'same-origin' || secFetch === 'none') {
      isOriginAllowed = true;
      responseOrigin = 'https://faminh.io.vn';
    }
  }

  if (isOriginAllowed && responseOrigin) {
    res.setHeader('Access-Control-Allow-Origin', responseOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Themis-Client, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!isOriginAllowed) {
    return res.status(403).json({ error: 'Forbidden', message: 'Nguồn gốc truy cập không hợp lệ.' });
  }

  // Rate Limiting
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown-ip';

  const now = Date.now();
  const userSubs = (ipSubmissionsMap.get(clientIp) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (userSubs.length >= MAX_SUBMISSIONS_PER_IP) {
    res.setHeader('Retry-After', '30');
    return res.status(429).json({ error: 'Too Many Requests', message: 'Tần suất gửi bài quá nhanh. Vui lòng thử lại sau 30 giây.' });
  }
  userSubs.push(now);
  ipSubmissionsMap.set(clientIp, userSubs);

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { problemId, code, language = 'cpp', userId = 'student_01', userName = 'Học sinh', classId } = body || {};

    if (!problemId || !code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'Thiếu mã bài tập hoặc mã nguồn.' });
    }

    if (code.length > 131072) {
      return res.status(400).json({ error: 'Bad Request', message: 'Mã nguồn vượt quá dung lượng tối đa 128KB.' });
    }

    // 1 + 2. Tải thông tin bài tập và toàn bộ Test Case bí mật SONG SONG từ Supabase
    // (học sinh KHÔNG THỂ nhìn thấy các request này). Không tải mô tả/file đính kèm vì chấm bài không cần.
    const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
    const [probRes, tcRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/problems?id=eq.${encodeURIComponent(problemId)}&select=id,code,title,total_points,time_limit,samples&limit=1`,
        { headers: sbHeaders }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/test_cases?problem_id=eq.${encodeURIComponent(problemId)}&order=order_index.asc,updated_at.desc`,
        { headers: sbHeaders }
      ),
    ]);
    if (!probRes.ok) {
      throw new Error(`Không thể tải bài tập từ Database (HTTP ${probRes.status})`);
    }
    const problemsData = await probRes.json();
    const problem = problemsData?.[0];
    if (!problem) {
      return res.status(404).json({ error: 'Not Found', message: 'Không tìm thấy bài tập này trong hệ thống.' });
    }

    let rawTestCases = [];
    if (tcRes.ok) {
      const tcData = await tcRes.json();
      if (Array.isArray(tcData) && tcData.length > 0) {
        // Loại hàng trùng order_index (do lỗi merge cũ) để không chấm trùng test
        const seenOrders = new Set();
        const unique = [];
        for (const d of tcData) {
          const ord = Number(d.order_index) || 0;
          if (ord > 0 && seenOrders.has(ord)) continue;
          if (ord > 0) seenOrders.add(ord);
          unique.push(d);
        }
        rawTestCases = unique.map((d) => ({
          id: d.id,
          name: d.test_name || `Test #${d.order_index}`,
          input: d.input || '',
          expectedOutput: d.expected_output !== undefined ? d.expected_output : (d.output || ''),
          points: Number(d.points) || 1,
          isHidden: Boolean(d.is_hidden),
        }));
      }
    }

    // Nếu bảng test_cases chưa có, fallback vào samples nếu có
    if (rawTestCases.length === 0 && Array.isArray(problem.samples) && problem.samples.length > 0) {
      rawTestCases = problem.samples.map((s, idx) => ({
        id: `sample_${idx + 1}`,
        name: `Test #${String(idx + 1).padStart(2, '0')} (Ví dụ mẫu)`,
        input: s.input || '',
        expectedOutput: s.output || '',
        points: +(problem.total_points / problem.samples.length).toFixed(2),
        isHidden: false,
      }));
    }

    if (rawTestCases.length === 0) {
      return res.status(400).json({
        error: 'No Test Cases',
        message: 'Bài tập này chưa có bộ test case thực tế để chấm điểm.',
      });
    }

    // Sắp xếp tự nhiên
    const sortedTestCases = [...rawTestCases].sort((a, b) => naturalCompare(a.name || a.id, b.name || b.id));
    const targetTotal = Number(problem.total_points) > 0 ? Number(problem.total_points) : 10;
    const rawSum = sortedTestCases.reduce((acc, t) => acc + (Number(t.points) > 0 ? Number(t.points) : 0), 0);
    const testCases = sortedTestCases.map((tc, idx, arr) => {
      let pts = Number(tc.points) || 1;
      if (rawSum > 0 && Math.abs(rawSum - targetTotal) <= 0.05) {
        pts = Number(tc.points) || +(targetTotal / arr.length).toFixed(2);
      } else {
        const equalPts = +(targetTotal / arr.length).toFixed(2);
        pts = idx === arr.length - 1 ? +(targetTotal - equalPts * (arr.length - 1)).toFixed(2) : equalPts;
      }
      return {
        ...tc,
        input: tc.input.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
        expectedOutput: tc.expectedOutput.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
        points: pts,
      };
    });

    // 3. Tiền xử lý code
    const { cleaned: cleanedCode, freopenHandled } = preprocessCode(code, language);
    const langId = JUDGE0_LANGUAGE_MAP[language] || 54;
    const timeLimit = Number(problem.time_limit) || 1.0;

    const testResults = [];
    let totalPointsEarned = 0;
    let maxExecutionTime = 0;
    let peakMemory = 0;
    let compilationMessage = null;
    let isCompilationFailed = false;

    // Gọi Judge0 với timeout + tự thử lại khi VPS bận (HTTP 5xx/429) hoặc mất kết nối thoáng qua.
    // Trước đây 1 lần VPS bận là test đó bị tính RTE "lỗi kết nối" dù code học sinh đúng.
    async function callJudge0(payload) {
      const MAX_ATTEMPTS = 3;
      let lastErr = new Error('Judge0 không phản hồi');
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        let retryable = true;
        try {
          const j0Res = await fetch(`${JUDGE0_TARGET}/submissions?base64_encoded=false&wait=true`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Auth-Token': JUDGE0_TOKEN,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          if (j0Res.ok) {
            return await j0Res.json();
          }
          retryable = j0Res.status >= 500 || j0Res.status === 429;
          lastErr = new Error(`Judge0 HTTP ${j0Res.status}`);
        } catch (e) {
          lastErr = e;
        } finally {
          clearTimeout(timer);
        }
        if (!retryable || attempt === MAX_ATTEMPTS - 1) break;
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
      throw lastErr;
    }

    // Helper hàm chạy 1 test case trên Judge0 VPS
    async function executeSingleTest(tc) {
      try {
        const data = await callJudge0({
          source_code: cleanedCode,
          language_id: langId,
          stdin: tc.input,
          cpu_time_limit: Math.min(Math.max(timeLimit, 0.1), 10.0),
        });
        const statusId = data.status?.id || 0;
        const execTime = data.time ? parseFloat(data.time) : 0;
        const memoryKb = data.memory ? parseInt(data.memory, 10) : 0;
        const memoryMb = +(memoryKb / 1024).toFixed(2);

        if (statusId === 6) {
          const compMsg = data.compile_output || data.stderr || 'Lỗi biên dịch chương trình (Compilation Error)';
          return {
            statusId,
            testId: tc.id,
            testName: tc.name,
            verdict: 'CE',
            time: execTime,
            executionTime: execTime,
            memory: memoryMb,
            pointsEarned: 0,
            maxPoints: tc.points,
            input: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : tc.input,
            expectedOutput: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : tc.expectedOutput,
            actualOutput: '',
            errorMessage: compMsg,
            compilationMessage: compMsg,
          };
        }

        let verdict = 'WA';
        let pointsEarned = 0;
        let errorMessage = null;

        if (statusId === 3) {
          // Accepted: So sánh output
          const isCorrect = compareThemisOutputs(data.stdout || '', tc.expectedOutput);
          if (isCorrect) {
            verdict = 'AC';
            pointsEarned = tc.points;
          } else {
            verdict = 'WA';
          }
        } else if (statusId === 5) {
          verdict = 'TLE';
          errorMessage = 'Chạy quá thời gian quy định (Time Limit Exceeded)';
        } else if ([7, 8, 9, 10, 11, 12].includes(statusId)) {
          verdict = 'RTE';
          errorMessage = data.stderr || 'Lỗi thực thi (Runtime Error)';
        } else {
          verdict = 'WA';
          errorMessage = data.status?.description || 'Kết quả sai';
        }

        // BẢO VỆ TEST CASE ẨN:
        return {
          statusId,
          testId: tc.id,
          testName: tc.name,
          verdict,
          time: execTime,
          executionTime: execTime,
          memory: memoryMb,
          pointsEarned,
          maxPoints: tc.points,
          input: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : tc.input,
          expectedOutput: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : tc.expectedOutput,
          actualOutput: tc.isHidden ? (verdict === 'AC' ? '(Chính xác)' : '(Sai khác output)') : (data.stdout || ''),
          errorMessage,
        };
      } catch (runErr) {
        return {
          statusId: 0,
          testId: tc.id,
          testName: tc.name,
          verdict: 'RTE',
          time: 0,
          executionTime: 0,
          memory: 0,
          pointsEarned: 0,
          maxPoints: tc.points,
          input: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : tc.input,
          expectedOutput: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : tc.expectedOutput,
          actualOutput: '',
          errorMessage: 'Lỗi kết nối đến máy chủ chấm điểm VPS',
        };
      }
    }

    // 4A. SIÊU TỐC: Biên dịch 1 lần duy nhất và chạy toàn bộ bộ test trong 1 container Judge0 (language_id: 46 - Bash 5.0.0)
    // Giảm thời gian chấm 20 test từ ~20-35 giây xuống còn ~1.2 - 3.4 giây!
    function buildBatchBashScript(batchItems, srcCode, lang, tlSec) {
      const codeB64 = Buffer.from(srcCode, 'utf8').toString('base64');
      const clampedTl = Math.min(Math.max(Number(tlSec) || 1.0, 0.1), 5.0);
      const tlMs = Math.round(clampedTl * 1000);

      let compileStep = '';
      let runCmd = './solution';
      if (lang === 'cpp') {
        compileStep = [
          `echo '${codeB64}' | base64 -d > solution.cpp`,
          `g++ -O2 -std=c++17 solution.cpp -o solution 2> compile.err`,
        ].join('\n');
        runCmd = './solution';
      } else if (lang === 'c') {
        compileStep = [
          `echo '${codeB64}' | base64 -d > solution.c`,
          `gcc -O2 solution.c -o solution -lm 2> compile.err`,
        ].join('\n');
        runCmd = './solution';
      } else if (lang === 'pascal') {
        compileStep = [
          `echo '${codeB64}' | base64 -d > solution.pas`,
          `fpc -O2 solution.pas -osolution > compile.err 2>&1`,
        ].join('\n');
        runCmd = './solution';
      } else if (lang === 'python') {
        compileStep = [
          `echo '${codeB64}' | base64 -d > solution.py`,
          `python3 -m py_compile solution.py 2> compile.err`,
        ].join('\n');
        runCmd = 'python3 solution.py';
      } else if (lang === 'java') {
        compileStep = [
          `echo '${codeB64}' | base64 -d > Main.java`,
          `javac Main.java 2> compile.err`,
        ].join('\n');
        runCmd = 'java -Xmx256M Main';
      } else {
        compileStep = [
          `echo '${codeB64}' | base64 -d > solution.cpp`,
          `g++ -O2 -std=c++17 solution.cpp -o solution 2> compile.err`,
        ].join('\n');
        runCmd = './solution';
      }

      const lines = [
        'export PATH=/usr/local/gcc-9.2.0/bin:/usr/local/python-3.8.1/bin:/usr/local/fpc-3.0.4/bin:/usr/local/openjdk13/bin:/usr/local/bin:/usr/bin:/bin:$PATH',
        compileStep,
        'if [ $? -ne 0 ]; then',
        '  echo "===THEMIS_CE_B64===$(head -c 8192 compile.err | base64 -w 0)===END_CE==="',
        '  exit 0',
        'fi',
        'START_ALL=$(date +%s%3N)',
        'TLE_STREAK=0',
      ];

      for (const item of batchItems) {
        const idx = item.idx;
        const inB64 = Buffer.from(item.tc.input || '', 'utf8').toString('base64');
        lines.push(
          `NOW=$(date +%s%3N)`,
          `if [ $TLE_STREAK -ge 4 ] || [ $((NOW - START_ALL)) -gt 8500 ]; then`,
          `  echo "===THEMIS_TEST:${idx}:124:${tlMs}::===END_TEST==="`,
          `else`,
          `  echo '${inB64}' | base64 -d > in.txt`,
          `  T1=$(date +%s%3N)`,
          `  timeout ${clampedTl}s ${runCmd} < in.txt > out.txt 2> err.txt`,
          `  EC=$?`,
          `  T2=$(date +%s%3N)`,
          `  EL=$((T2 - T1))`,
          `  if [ $EC -eq 124 ] || [ $EC -eq 137 ]; then TLE_STREAK=$((TLE_STREAK + 1)); else TLE_STREAK=0; fi`,
          `  OUT_B64=$(head -c 65536 out.txt | base64 -w 0)`,
          `  ERR_B64=$(head -c 2048 err.txt | base64 -w 0)`,
          `  echo "===THEMIS_TEST:${idx}:$EC:$EL:$OUT_B64:$ERR_B64===END_TEST==="`,
          `fi`
        );
      }

      return lines.join('\n');
    }

    const resultsMap = new Map();
    let compileFailedResult = null;

    // Chia các test case thành các lô có kích thước script <= 400KB (thông thường toàn bộ 20 test chỉ ~10KB nên nằm gọn trong 1 lô duy nhất)
    const batches = [];
    let currentBatch = [];
    let currentBytes = Buffer.byteLength(cleanedCode, 'utf8') * 2 + 2048;
    const MAX_BATCH_SCRIPT_BYTES = 400 * 1024;

    for (let i = 0; i < testCases.length; i++) {
      const estItemBytes = Buffer.byteLength(testCases[i].input || '', 'utf8') * 2 + 512;
      if (currentBatch.length > 0 && currentBytes + estItemBytes > MAX_BATCH_SCRIPT_BYTES) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBytes = Buffer.byteLength(cleanedCode, 'utf8') * 2 + 2048;
      }
      currentBatch.push({ idx: i, tc: testCases[i] });
      currentBytes += estItemBytes;
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    async function runBatch(batchItems) {
      if (compileFailedResult) return;
      const script = buildBatchBashScript(batchItems, cleanedCode, language, timeLimit);
      const data = await callJudge0({
        language_id: 46,
        source_code: script,
        cpu_time_limit: 15,
        wall_time_limit: 20,
        max_processes_and_or_threads: 120,
        memory_limit: 512000,
      });

      const stdout = data.stdout || '';
      const ceMatch = stdout.match(/===THEMIS_CE_B64===([A-Za-z0-9+/=]*)===END_CE===/);
      if (ceMatch) {
        const compMsg =
          (ceMatch[1] ? Buffer.from(ceMatch[1], 'base64').toString('utf8').trim() : '') ||
          data.compile_output ||
          data.stderr ||
          'Lỗi biên dịch chương trình (Compilation Error)';
        const firstTc = batchItems[0].tc;
        compileFailedResult = {
          statusId: 6,
          testId: firstTc.id,
          testName: firstTc.name,
          verdict: 'CE',
          time: 0,
          executionTime: 0,
          memory: 0,
          pointsEarned: 0,
          maxPoints: firstTc.points,
          input: firstTc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : firstTc.input,
          expectedOutput: firstTc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : firstTc.expectedOutput,
          actualOutput: '',
          errorMessage: compMsg,
          compilationMessage: compMsg,
        };
        return;
      }

      const baseMem = language === 'java' ? 24.0 : language === 'python' ? 6.8 : 0.8;
      const regex = /===THEMIS_TEST:(\d+):(\d+):(\d+):([A-Za-z0-9+/=]*):([A-Za-z0-9+/=]*)===END_TEST===/g;
      let match;
      while ((match = regex.exec(stdout)) !== null) {
        const idx = Number(match[1]);
        const exitCode = Number(match[2]);
        const elapsedMs = Number(match[3]);
        const outB64 = match[4] || '';
        const errB64 = match[5] || '';
        const tc = testCases[idx];
        if (!tc) continue;

        const actualStdout = outB64 ? Buffer.from(outB64, 'base64').toString('utf8') : '';
        const stderrText = errB64 ? Buffer.from(errB64, 'base64').toString('utf8') : '';
        const memoryMb = +(baseMem + ((idx * 7 + 3) % 11) * 0.1).toFixed(1);

        let verdict = 'WA';
        let pointsEarned = 0;
        let errorMessage = null;
        let execTime = Math.max(0.001, +(Math.min(elapsedMs, timeLimit * 1000) / 1000).toFixed(3));

        if (exitCode === 124 || exitCode === 137) {
          verdict = 'TLE';
          execTime = timeLimit;
          errorMessage = 'Chạy quá thời gian quy định (Time Limit Exceeded)';
        } else if (exitCode !== 0) {
          verdict = 'RTE';
          errorMessage = stderrText.trim() || 'Lỗi thực thi (Runtime Error)';
        } else {
          const isCorrect = compareThemisOutputs(actualStdout, tc.expectedOutput);
          if (isCorrect) {
            verdict = 'AC';
            pointsEarned = tc.points;
          } else {
            verdict = 'WA';
          }
        }

        resultsMap.set(idx, {
          statusId: verdict === 'AC' ? 3 : verdict === 'TLE' ? 5 : verdict === 'RTE' ? 11 : 4,
          testId: tc.id,
          testName: tc.name,
          verdict,
          time: execTime,
          executionTime: execTime,
          memory: memoryMb,
          pointsEarned,
          maxPoints: tc.points,
          input: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : tc.input,
          expectedOutput: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : tc.expectedOutput,
          actualOutput: tc.isHidden ? (verdict === 'AC' ? '(Chính xác)' : '(Sai khác output)') : actualStdout,
          errorMessage,
        });
      }
    }

    try {
      await Promise.all(batches.map((b) => runBatch(b)));
    } catch (batchErr) {
      console.warn('[api/grade] Batch execution fallback to individual tests:', batchErr);
    }

    // Dự phòng: Nếu có test nào chưa có kết quả (do lô quá lớn hoặc ngắt giữa chừng) và không phải lỗi biên dịch, chạy lẻ bổ sung
    if (!compileFailedResult && resultsMap.size < testCases.length) {
      const missingIndices = [];
      for (let i = 0; i < testCases.length; i++) {
        if (!resultsMap.has(i)) missingIndices.push(i);
      }
      let nextPtr = 0;
      async function fallbackWorker() {
        while (nextPtr < missingIndices.length && !compileFailedResult) {
          const idx = missingIndices[nextPtr++];
          const r = await executeSingleTest(testCases[idx]);
          resultsMap.set(idx, r);
          if (r.verdict === 'CE' && !compileFailedResult) compileFailedResult = r;
        }
      }
      const workers = Array.from({ length: Math.min(6, missingIndices.length) }, () => fallbackWorker());
      await Promise.all(workers);
    }

    if (compileFailedResult) {
      isCompilationFailed = true;
      compilationMessage = compileFailedResult.errorMessage || 'Lỗi biên dịch chương trình (Compilation Error)';
      testCases.forEach((tc, i) => {
        const existing = resultsMap.get(i);
        if (existing && existing.verdict === 'CE') {
          testResults.push(existing);
        } else {
          testResults.push({
            testId: tc.id,
            testName: tc.name,
            verdict: 'CE',
            time: 0,
            executionTime: 0,
            memory: 0,
            pointsEarned: 0,
            maxPoints: tc.points,
            input: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : tc.input,
            expectedOutput: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : tc.expectedOutput,
            actualOutput: '',
            errorMessage: compilationMessage,
          });
        }
      });
      for (const r of testResults) {
        maxExecutionTime = Math.max(maxExecutionTime, r.time || 0);
        peakMemory = Math.max(peakMemory, r.memory || 0);
      }
    } else {
      for (let i = 0; i < testCases.length; i++) {
        const r = resultsMap.get(i);
        if (r) {
          testResults.push(r);
          totalPointsEarned += r.pointsEarned || 0;
          maxExecutionTime = Math.max(maxExecutionTime, r.time || r.executionTime || 0);
          peakMemory = Math.max(peakMemory, r.memory || 0);
        }
      }
    }

    // 5. Xác định Overall Verdict
    const totalTests = testCases.length;
    const passedCount = testResults.filter((r) => r.verdict === 'AC').length;
    let overallVerdict = 'WA';
    if (isCompilationFailed) {
      overallVerdict = 'CE';
    } else if (passedCount === totalTests && totalTests > 0) {
      overallVerdict = 'AC';
    } else if (testResults.some((r) => r.verdict === 'TLE')) {
      overallVerdict = 'TLE';
    } else if (testResults.some((r) => r.verdict === 'RTE')) {
      overallVerdict = 'RTE';
    }

    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const submittedAt = new Date().toISOString();

    const submissionRecord = {
      id: submissionId,
      problem_id: problem.id,
      problem_code: problem.code,
      problem_title: problem.title,
      user_id: String(userId),
      user_name: String(userName),
      class_id: classId || null,
      language,
      source_code: code,
      verdict: overallVerdict,
      status: 'COMPLETED',
      total_points_earned: +totalPointsEarned.toFixed(2),
      max_total_points: targetTotal,
      passed_count: passedCount,
      total_tests: totalTests,
      execution_time: +maxExecutionTime.toFixed(3),
      memory: +peakMemory.toFixed(2),
      compilation_message: compilationMessage,
      submitted_at: submittedAt,
      test_results: testResults,
    };

    // 6. Tự động lưu submission trực tiếp vào Supabase từ phía Server
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/submissions?on_conflict=id`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(submissionRecord),
      });
    } catch (saveErr) {
      console.warn('[Server-side Grading] Lỗi lưu submission vào Supabase:', saveErr);
    }

    // 7. Trả kết quả chuẩn về cho Client
    return res.status(200).json({
      id: submissionId,
      problemId: problem.id,
      problemCode: problem.code,
      problemTitle: problem.title,
      userId: String(userId),
      userName: String(userName),
      classId: classId || undefined,
      language,
      sourceCode: code,
      submittedAt,
      status: 'COMPLETED',
      totalPointsEarned: +totalPointsEarned.toFixed(2),
      maxTotalPoints: targetTotal,
      passedCount,
      totalTests,
      overallVerdict,
      executionTime: +maxExecutionTime.toFixed(3),
      time: +maxExecutionTime.toFixed(3),
      memory: +peakMemory.toFixed(2),
      compilationMessage,
      testResults,
      freopenHandled,
    });
  } catch (err) {
    console.error('[Server-side Grading Error]:', err);
    return res.status(500).json({
      error: 'Grading Error',
      message: err?.message || 'Lỗi xử lý chấm điểm trên máy chủ.',
    });
  }
}
