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

    // 1. Tải thông tin bài tập từ Supabase
    const probRes = await fetch(`${SUPABASE_URL}/rest/v1/problems?id=eq.${encodeURIComponent(problemId)}&limit=1`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!probRes.ok) {
      throw new Error(`Không thể tải bài tập từ Database (HTTP ${probRes.status})`);
    }
    const problemsData = await probRes.json();
    const problem = problemsData?.[0];
    if (!problem) {
      return res.status(404).json({ error: 'Not Found', message: 'Không tìm thấy bài tập này trong hệ thống.' });
    }

    // 2. Tải toàn bộ Test Case bí mật từ Supabase (Học sinh KHÔNG THỂ nhìn thấy request này)
    const tcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/test_cases?problem_id=eq.${encodeURIComponent(problemId)}&order=order_index.asc,updated_at.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    let rawTestCases = [];
    if (tcRes.ok) {
      const tcData = await tcRes.json();
      if (Array.isArray(tcData) && tcData.length > 0) {
        rawTestCases = tcData.map((d) => ({
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

    // Helper hàm chạy 1 test case trên Judge0 VPS
    async function executeSingleTest(tc) {
      try {
        const j0Res = await fetch(`${JUDGE0_TARGET}/submissions?base64_encoded=false&wait=true`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': JUDGE0_TOKEN,
          },
          body: JSON.stringify({
            source_code: cleanedCode,
            language_id: langId,
            stdin: tc.input,
            cpu_time_limit: Math.min(Math.max(timeLimit, 0.1), 10.0),
          }),
        });

        if (!j0Res.ok) {
          throw new Error(`Judge0 HTTP ${j0Res.status}`);
        }

        const data = await j0Res.json();
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

    // 4.1. Chạy thử Test Case 1 trước để phát hiện ngay Lỗi biên dịch (CE)
    const firstResult = await executeSingleTest(testCases[0]);
    if (firstResult.verdict === 'CE') {
      isCompilationFailed = true;
      compilationMessage = firstResult.errorMessage || 'Lỗi biên dịch chương trình (Compilation Error)';
      testResults.push(firstResult);
      maxExecutionTime = Math.max(maxExecutionTime, firstResult.time || 0);
      peakMemory = Math.max(peakMemory, firstResult.memory || 0);

      for (let i = 1; i < testCases.length; i++) {
        const tc = testCases[i];
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
    } else {
      // 4.2. Code biên dịch thành công! Chạy song song các test còn lại với concurrency worker pool (CONCURRENCY = 4)
      const resultsMap = new Map();
      resultsMap.set(0, firstResult);

      if (testCases.length > 1) {
        const CONCURRENCY = 4;
        let nextIndex = 1;

        async function worker() {
          while (nextIndex < testCases.length) {
            const idx = nextIndex++;
            const tc = testCases[idx];
            const res = await executeSingleTest(tc);
            resultsMap.set(idx, res);
          }
        }

        const workerCount = Math.min(CONCURRENCY, testCases.length - 1);
        const workers = Array.from({ length: workerCount }, () => worker());
        await Promise.all(workers);
      }

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
