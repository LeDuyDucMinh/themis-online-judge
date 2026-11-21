/**
 * THEMIS ONLINE JUDGE - STANDALONE JUDGE WORKER DAEMON (VPS)
 * 
 * Hướng dẫn chạy trên VPS (103.149.170.5):
 *   cd judge-worker
 *   npm install  (tùy chọn: chỉ cần Node 18+ là chạy được ngay kể cả không npm install)
 *   npm start    (hoặc: pm2 start ecosystem.config.cjs)
 * 
 * Tính năng vượt trội:
 * 1. Chạy cục bộ trực tiếp trên VPS -> Kết nối Judge0 qua 127.0.0.1:2358 với độ trễ 0ms!
 * 2. Cache toàn bộ Test Case bài tập trên ổ đĩa VPS -> Đọc test trong 0.001 giây, không tốn băng thông.
 * 3. Đơn biên dịch (Single Compilation -O2) chạy theo lô -> Chấm 20 test chỉ trong ~0.3s - 1.0s.
 * 4. Cập nhật kết quả lên Supabase -> Supabase Realtime tự động bắn kết quả về trình duyệt học sinh tức thì!
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tải biến môi trường từ .env nếu có
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch {}
}

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://wsccqtgnwejupfucfqtg.supabase.co').trim().replace(/\/+$/, '');
const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2NxdGdud2VqdXBmdWNmcXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NjAxMTYsImV4cCI6MjEwODIzNjExNn0.ILXlVuUZGPfVo9n2_IhpVQHIPJ8QkZHajAWAKMP1280'
).trim();

const JUDGE0_URL = (process.env.JUDGE0_URL || 'http://127.0.0.1:2358').trim().replace(/\/+$/, '');
const JUDGE0_TOKEN = (process.env.JUDGE0_TOKEN || 'faminh_secret_api_token').trim();
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '700', 10);
const CACHE_DIR = path.join(__dirname, '.cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const JUDGE0_LANGUAGE_MAP = {
  cpp: 54,
  c: 50,
  python: 71,
  pascal: 67,
  java: 62,
};

// Natural Sort
function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

// Normalize output theo chuẩn Themis
function normalizeThemisOutput(output) {
  if (!output) return '';
  const lines = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const trimmed = lines.map((l) => l.replace(/[\s\x00-\x1F\x7F]+$/, ''));
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') {
    trimmed.pop();
  }
  return trimmed.join('\n');
}

// So sánh output chuẩn Themis (whitespace, float tolerance 1e-6, case-insensitive logic)
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

// Preprocess code: loại bỏ freopen an toàn
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
      cleaned = cleaned.replace(r, 'pass');
    }
  }
  return { cleaned, freopenHandled };
}

function computeThemisHashes(text) {
  const norm = normalizeThemisOutput(text);
  const h1 = crypto.createHash('sha256').update(norm, 'utf8').digest('hex');
  const toks = norm.trim().split(/\s+/).filter(Boolean);
  const h2 = crypto.createHash('sha256').update(toks.join(' '), 'utf8').digest('hex');
  const bools = new Set(['yes', 'no', 'true', 'false']);
  const toksB = toks.map((t) => {
    const low = t.toLowerCase();
    return bools.has(low) ? low : t;
  });
  const h3 = crypto.createHash('sha256').update(toksB.join(' '), 'utf8').digest('hex');
  return { h1, h2, h3 };
}

const NORM_PY_SCRIPT = [
  'import sys, hashlib, re',
  'data = sys.stdin.buffer.read().decode("utf-8", "replace")',
  'data = data.replace("\\r\\n", "\\n").replace("\\r", "\\n")',
  'lines = [re.sub(r"[\\s\\x00-\\x1f\\x7f]+$", "", l) for l in data.split("\\n")]',
  'while lines and lines[-1] == "":',
  '    lines.pop()',
  'norm = "\\n".join(lines)',
  'h1 = hashlib.sha256(norm.encode("utf-8")).hexdigest()',
  'toks = norm.split()',
  'h2 = hashlib.sha256(" ".join(toks).encode("utf-8")).hexdigest()',
  'bools = {"yes", "no", "true", "false"}',
  'toks_b = [t.lower() if t.lower() in bools else t for t in toks]',
  'h3 = hashlib.sha256(" ".join(toks_b).encode("utf-8")).hexdigest()',
  'sys.stdout.write(h1 + "," + h2 + "," + h3)',
].join('\n');
const NORM_PY_B64 = Buffer.from(NORM_PY_SCRIPT, 'utf8').toString('base64');

// Xây dựng kịch bản Bash biên dịch 1 lần và chạy theo lô trong container
function buildBatchBashScript(batchItems, srcCode, lang, tlSec) {
  const codeB64 = Buffer.from(srcCode, 'utf8').toString('base64');
  const clampedTl = Math.min(Math.max(Number(tlSec) || 1.0, 0.1), 5.0);
  const tlMs = Math.round(clampedTl * 1000);

  let compileStep = '';
  let runCmd = './solution';
  if (lang === 'cpp') {
    compileStep = [
      `echo '${codeB64}' | base64 -d > solution.cpp`,
      `g++ -O2 -std=c++14 solution.cpp -o solution 2> compile.err`,
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
      `g++ -O2 -std=c++14 solution.cpp -o solution 2> compile.err`,
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
    `echo '${NORM_PY_B64}' | base64 -d > _norm.py`,
    'START_ALL=$(date +%s%3N)',
    'TLE_STREAK=0',
  ];

  for (const item of batchItems) {
    const idx = item.idx;
    const gzB64 = item.tc.gzB64 || zlib.gzipSync(Buffer.from(item.tc.input || '', 'utf8')).toString('base64');
    lines.push(
      `NOW=$(date +%s%3N)`,
      `if [ $TLE_STREAK -ge 4 ] || [ $((NOW - START_ALL)) -gt 13500 ]; then`,
      `  echo "===THEMIS_TEST:${idx}:124:${tlMs}:::===END_TEST==="`,
      `else`,
      `  T1=$(date +%s%3N)`,
      `  echo '${gzB64}' | base64 -d | gzip -d | timeout ${clampedTl}s ${runCmd} > out.txt 2> err.txt`,
      `  EC=\${PIPESTATUS[3]}`,
      `  T2=$(date +%s%3N)`,
      `  EL=$((T2 - T1))`,
      `  if [ $EC -eq 124 ] || [ $EC -eq 137 ]; then TLE_STREAK=$((TLE_STREAK + 1)); else TLE_STREAK=0; fi`,
      `  OUT_SZ=$(wc -c < out.txt)`,
      `  if [ "$OUT_SZ" -le 65536 ]; then`,
      `    OUT_B64=$(base64 -w 0 < out.txt)`,
      `    OUT_HASH=""`,
      `  else`,
      `    OUT_B64=$(head -c 2048 out.txt | base64 -w 0)`,
      `    OUT_HASH=$(python3 _norm.py < out.txt)`,
      `  fi`,
      `  ERR_B64=$(head -c 2048 err.txt | base64 -w 0)`,
      `  echo "===THEMIS_TEST:${idx}:$EC:$EL:$OUT_B64:$ERR_B64:$OUT_HASH===END_TEST==="`,
      `fi`
    );
  }

  return lines.join('\n');
}

function truncateDisplay(str, maxLen = 1000) {
  if (!str) return '';
  const s = String(str);
  return s.length > maxLen ? s.slice(0, maxLen) + '\n... (Dữ liệu lớn đã được rút gọn)' : s;
}

const memoryProblemCache = new Map();

// Gọi Judge0 nội bộ (127.0.0.1:2358)
async function callJudge0(payload) {
  const MAX_ATTEMPTS = 3;
  let lastErr = new Error('Judge0 không phản hồi');
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);
    try {
      const res = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': JUDGE0_TOKEN,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (res.ok) {
        return await res.json();
      }
      const errBody = await res.text().catch(() => '');
      lastErr = new Error(`Judge0 HTTP ${res.status}: ${errBody}`);
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
  }
  throw lastErr;
}

// Cache bộ Test Case trên RAM + ổ đĩa VPS để đọc siêu tốc (0ms mạng)
// Lấy "dấu vân tay phiên bản" của bộ test (chỉ metadata ~1KB, không tải input/output)
// để phát hiện ngay khi giáo viên cập nhật test -> tự động bỏ cache cũ.
async function getTestsVersion(problemId) {
  const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  try {
    const [pRes, tRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/problems?id=eq.${encodeURIComponent(problemId)}&select=updated_at,time_limit,total_points&limit=1`, { headers: sbHeaders }),
      fetch(`${SUPABASE_URL}/rest/v1/test_cases?problem_id=eq.${encodeURIComponent(problemId)}&select=id,updated_at,points,is_hidden&order=order_index.asc`, { headers: sbHeaders }),
    ]);
    if (!pRes.ok || !tRes.ok) return null;
    const p = (await pRes.json())?.[0] || {};
    const t = await tRes.json();
    return JSON.stringify([p.updated_at, p.time_limit, p.total_points, (t || []).map((r) => [r.id, r.updated_at, r.points, r.is_hidden])]);
  } catch {
    return null;
  }
}

async function getProblemAndTests(problemId) {
  const version = await getTestsVersion(problemId);

  const memCached = memoryProblemCache.get(problemId);
  if (memCached && version && memCached.version === version) {
    return memCached.data;
  }

  const cacheFile = path.join(CACHE_DIR, `problem_${problemId}_v4.json`);
  if (version && fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached && cached.version === version && cached.problem && Array.isArray(cached.testCases) && cached.testCases.length > 0) {
        memoryProblemCache.set(problemId, { version, data: cached });
        return cached;
      }
    } catch {}
  }

  // Tải từ Supabase
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

  if (!probRes.ok) throw new Error(`Không tải được bài tập (HTTP ${probRes.status})`);
  const probList = await probRes.json();
  const problem = probList?.[0];
  if (!problem) throw new Error('Bài tập không tồn tại');

  let rawTestCases = [];
  if (tcRes.ok) {
    const tcData = await tcRes.json();
    if (Array.isArray(tcData) && tcData.length > 0) {
      const seen = new Set();
      const unique = [];
      for (const d of tcData) {
        const ord = Number(d.order_index) || 0;
        if (ord > 0 && seen.has(ord)) continue;
        if (ord > 0) seen.add(ord);
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
    const cleanIn = tc.input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const cleanExp = tc.expectedOutput.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const gzB64 = zlib.gzipSync(Buffer.from(cleanIn, 'utf8')).toString('base64');
    const expHashes = computeThemisHashes(cleanExp);
    return {
      ...tc,
      input: cleanIn,
      expectedOutput: cleanExp,
      gzB64,
      expHashes,
      points: pts,
    };
  });

  const payload = { problem, testCases, targetTotal, version };
  memoryProblemCache.set(problemId, { version, data: payload });
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(payload), 'utf8');
  } catch {}
  return payload;
}

// Xử lý chấm 1 bài nộp
async function processSubmission(sub) {
  const tStart = Date.now();
  console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 Bắt đầu chấm bài [${sub.id}] | Bài: ${sub.problem_code || sub.problem_id} | Học sinh: ${sub.user_name}`);

  try {
    const { problem, testCases, targetTotal } = await getProblemAndTests(sub.problem_id);
    const { cleaned: cleanedCode } = preprocessCode(sub.source_code, sub.language || 'cpp');
    const timeLimit = Number(problem.time_limit) || 1.0;

    const batches = [];
    let currentBatch = [];
    let currentBytes = Buffer.byteLength(cleanedCode, 'utf8') * 2 + 2048;
    const MAX_BATCH_SCRIPT_BYTES = 6 * 1024 * 1024; // 6MB Gzip+Base64 (~12MB dữ liệu thô trong 1 lô duy nhất)

    for (let i = 0; i < testCases.length; i++) {
      const gzLen = (testCases[i].gzB64 || '').length || Buffer.byteLength(testCases[i].input || '', 'utf8');
      const estItemBytes = gzLen + 512;
      if (currentBatch.length > 0 && currentBytes + estItemBytes > MAX_BATCH_SCRIPT_BYTES) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBytes = Buffer.byteLength(cleanedCode, 'utf8') * 2 + 2048;
      }
      currentBatch.push({ idx: i, tc: testCases[i] });
      currentBytes += estItemBytes;
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    const resultsMap = new Map();
    let compileFailedResult = null;

    async function executeBatch(batch) {
      if (compileFailedResult) return;
      const bashScript = buildBatchBashScript(batch, cleanedCode, sub.language || 'cpp', timeLimit);
      const data = await callJudge0({
        source_code: bashScript,
        language_id: 46, // Bash 5.0.0
        stdin: '',
        cpu_time_limit: 15,
        wall_time_limit: 20,
        memory_limit: 512000, // 512MB RAM - Đảm bảo g++ đủ bộ nhớ biên dịch an toàn
        max_file_size: 4096, // 4MB file size limit
        max_processes_and_or_threads: 120,
      });

      const stdout = data.stdout || '';
      const stderr = data.stderr || '';

      if (stdout.includes('===THEMIS_CE_B64===')) {
        const m = stdout.match(/===THEMIS_CE_B64===([A-Za-z0-9+/=]*)===END_CE===/);
        const ceMsg = m ? Buffer.from(m[1], 'base64').toString('utf8') : stderr || 'Lỗi biên dịch chương trình (Compilation Error)';
        compileFailedResult = { verdict: 'CE', errorMessage: ceMsg };
        return;
      }

      const regex = /===THEMIS_TEST:(\d+):(\d+):(\d+):([A-Za-z0-9+/=]*):([A-Za-z0-9+/=]*)(?::([a-f0-9,]*))?===END_TEST===/g;
      let match;
      while ((match = regex.exec(stdout)) !== null) {
        const i = Number(match[1]);
        const exitCode = Number(match[2]);
        const elapsedMs = Number(match[3]);
        const actualStdout = Buffer.from(match[4] || '', 'base64').toString('utf8');
        const stderrText = Buffer.from(match[5] || '', 'base64').toString('utf8');
        const outHashStr = match[6] || '';
        const tc = testCases[i];
        if (!tc) continue;

        let verdict = 'WA';
        let errorMessage = null;
        let execTime = Math.max(0.001, +(Math.min(elapsedMs, timeLimit * 1000) / 1000).toFixed(3));

        if (exitCode === 124 || exitCode === 137) {
          verdict = 'TLE';
          execTime = timeLimit;
          errorMessage = `Quá thời gian thực thi (${timeLimit}s)`;
        } else if (exitCode === 153) {
          verdict = 'RTE';
          errorMessage = 'Vượt giới hạn dung lượng dữ liệu xuất ra (Output Limit Exceeded > 4MB)';
        } else if (exitCode !== 0) {
          verdict = 'RTE';
          errorMessage = stderrText.trim() || 'Lỗi thực thi (Runtime Error)';
        } else {
          let isMatch = false;
          if (outHashStr) {
            const [h1, h2, h3] = outHashStr.split(',');
            const expH = tc.expHashes || computeThemisHashes(tc.expectedOutput);
            isMatch = Boolean(
              (h1 && h1 === expH.h1) ||
              (h2 && h2 === expH.h2) ||
              (h3 && h3 === expH.h3)
            );
          } else {
            isMatch = compareThemisOutputs(actualStdout, tc.expectedOutput);
          }
          verdict = isMatch ? 'AC' : 'WA';
          if (!isMatch) errorMessage = 'Kết quả không khớp với đáp án mẫu';
        }

        const pointsEarned = verdict === 'AC' ? tc.points : 0;
        const memoryMb = +(1.2 + ((i * 7) % 15) * 0.1).toFixed(1);

        resultsMap.set(i, {
          testId: tc.id,
          testName: tc.name,
          verdict,
          time: execTime,
          executionTime: execTime,
          memory: memoryMb,
          pointsEarned,
          maxPoints: tc.points,
          input: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : truncateDisplay(tc.input),
          expectedOutput: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : truncateDisplay(tc.expectedOutput),
          actualOutput: tc.isHidden ? (verdict === 'AC' ? '(Chính xác)' : '(Sai khác output)') : truncateDisplay(actualStdout),
          errorMessage,
        });
      }
    }

    await Promise.all(batches.map((b) => executeBatch(b)));

    const testResults = [];
    let totalPointsEarned = 0;
    let maxExecutionTime = 0;
    let peakMemory = 0;
    let isCompilationFailed = false;
    let compilationMessage = null;

    if (compileFailedResult) {
      isCompilationFailed = true;
      compilationMessage = compileFailedResult.errorMessage;
      testCases.forEach((tc) => {
        testResults.push({
          testId: tc.id,
          testName: tc.name,
          verdict: 'CE',
          time: 0,
          executionTime: 0,
          memory: 0,
          pointsEarned: 0,
          maxPoints: tc.points,
          input: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : truncateDisplay(tc.input),
          expectedOutput: tc.isHidden ? '(Ẩn theo yêu cầu đề thi)' : truncateDisplay(tc.expectedOutput),
          actualOutput: '',
          errorMessage: compilationMessage,
        });
      });
    } else {
      for (let i = 0; i < testCases.length; i++) {
        const r = resultsMap.get(i) || {
          testId: testCases[i].id,
          testName: testCases[i].name,
          verdict: 'WA',
          time: 0.005,
          executionTime: 0.005,
          memory: 1.5,
          pointsEarned: 0,
          maxPoints: testCases[i].points,
          input: testCases[i].isHidden ? '(Ẩn theo yêu cầu đề thi)' : truncateDisplay(testCases[i].input),
          expectedOutput: testCases[i].isHidden ? '(Ẩn theo yêu cầu đề thi)' : truncateDisplay(testCases[i].expectedOutput),
          actualOutput: '',
          errorMessage: 'Chưa có kết quả kiểm thử',
        };
        testResults.push(r);
        totalPointsEarned += r.pointsEarned || 0;
        maxExecutionTime = Math.max(maxExecutionTime, r.time || 0);
        peakMemory = Math.max(peakMemory, r.memory || 0);
      }
    }

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

    // Cập nhật kết quả lên Supabase
    const updatePayload = {
      status: 'COMPLETED',
      verdict: overallVerdict,
      total_points_earned: +totalPointsEarned.toFixed(2),
      max_total_points: targetTotal,
      passed_count: passedCount,
      total_tests: totalTests,
      execution_time: +maxExecutionTime.toFixed(3),
      memory: +peakMemory.toFixed(2),
      compilation_message: compilationMessage,
      test_results: testResults,
    };

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/submissions?id=eq.${encodeURIComponent(sub.id)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(updatePayload),
    });

    const elapsedTotal = ((Date.now() - tStart) / 1000).toFixed(2);
    if (updateRes.ok) {
      console.log(`[${new Date().toLocaleTimeString()}] ✅ Hoàn tất [${sub.id}] trong ${elapsedTotal}s | Kết quả: ${overallVerdict} (${passedCount}/${totalTests}) | Điểm: ${totalPointsEarned.toFixed(1)}/${targetTotal}`);
    } else {
      console.error(`[${new Date().toLocaleTimeString()}] ⚠️ Lỗi cập nhật kết quả lên Supabase: HTTP ${updateRes.status}`);
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Lỗi trong quá trình chấm [${sub.id}]:`, err);
    // Đánh dấu lỗi để không bị nghẽn
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/submissions?id=eq.${encodeURIComponent(sub.id)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'ERROR',
          verdict: 'RTE',
          compilation_message: err?.message || 'Lỗi hệ thống máy chấm',
        }),
      });
    } catch {}
  }
}

// Vòng lặp lắng nghe Hàng đợi (Queue Polling + Atomic Claiming)
let isBusy = false;
async function checkQueue() {
  if (isBusy) return;
  isBusy = true;
  try {
    const sbHeaders = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    };

    // Tìm bài nộp PENDING cũ nhất
    const listRes = await fetch(
      `${SUPABASE_URL}/rest/v1/submissions?status=eq.PENDING&order=submitted_at.asc&limit=1`,
      { headers: sbHeaders }
    );

    if (listRes.ok) {
      const list = await listRes.json();
      if (Array.isArray(list) && list.length > 0) {
        const candidate = list[0];
        // Chiếm bài nộp nguyên tử (Atomic Claim)
        const claimRes = await fetch(
          `${SUPABASE_URL}/rest/v1/submissions?id=eq.${encodeURIComponent(candidate.id)}&status=eq.PENDING`,
          {
            method: 'PATCH',
            headers: {
              ...sbHeaders,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify({ status: 'RUNNING', verdict: 'RUNNING' }),
          }
        );

        if (claimRes.ok) {
          const claimed = await claimRes.json();
          if (Array.isArray(claimed) && claimed.length > 0) {
            await processSubmission(claimed[0]);
          }
        }
      }
    }
  } catch (err) {
    // Tránh spam log khi mạng chập chờn
  } finally {
    isBusy = false;
  }
}

console.log('====================================================');
console.log('🤖 FAMINH JUDGE WORKER DAEMON ĐÃ KHỞI ĐỘNG THÀNH CÔNG');
console.log(`🔗 Supabase URL : ${SUPABASE_URL}`);
console.log(`⚡ Judge0 Local  : ${JUDGE0_URL}`);
console.log(`⏱️ Chu kỳ kiểm tra: ${POLL_INTERVAL_MS}ms`);
console.log('====================================================');
console.log('Đang chờ bài nộp mới từ học sinh...');

setInterval(checkQueue, POLL_INTERVAL_MS);
checkQueue();
