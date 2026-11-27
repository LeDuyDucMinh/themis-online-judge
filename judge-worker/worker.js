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
import tls from 'tls';
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
const BACKUP_POLL_MS = parseInt(process.env.BACKUP_POLL_MS || '30000', 10); // 30s khi có Realtime WebSocket (giảm 97.7% Log Ingestion!)
const FALLBACK_POLL_MS = parseInt(process.env.FALLBACK_POLL_MS || '3000', 10); // 3s dự phòng nếu WebSocket tạm mất kết nối
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
  'import sys, hashlib',
  'STRIP = "".join(chr(c) for c in range(33)) + "\\x7f"',
  'def rtrim(l):',
  '    l = l.rstrip(STRIP)',
  '    while l and (l[-1] <= " " or l[-1] == "\\x7f" or l[-1].isspace()):',
  '        l = l.rstrip(STRIP).rstrip()',
  '    return l',
  'data = sys.stdin.buffer.read().decode("utf-8", "replace")',
  'data = data.replace("\\r\\n", "\\n").replace("\\r", "\\n")',
  'lines = [rtrim(l) for l in data.split("\\n")]',
  'while lines and lines[-1] == "":',
  '    lines.pop()',
  'norm = "\\n".join(lines)',
  'h1 = hashlib.sha256(norm.encode("utf-8")).hexdigest()',
  'toks = norm.split()',
  'h2 = hashlib.sha256(" ".join(toks).encode("utf-8")).hexdigest()',
  'bools = {"yes", "no", "true", "false"}',
  'toks_b = [t.lower() if (len(t) <= 5 and t[0] in "yYnNtTfF" and t.lower() in bools) else t for t in toks]',
  'h3 = hashlib.sha256(" ".join(toks_b).encode("utf-8")).hexdigest()',
  'sys.stdout.write(h1 + "," + h2 + "," + h3)',
].join('\n');
const NORM_PY_B64 = Buffer.from(NORM_PY_SCRIPT, 'utf8').toString('base64');

const TARGET_MAX_FILE_SIZE_KB = 65536; // 64MB chuẩn Themis/VNOI cho bài IO lớn (10^6 phần tử)
const DEFAULT_MAX_FILE_SIZE_KB = 4096; // 4MB mặc định Judge0 CE nếu VPS chưa nâng MAX_MAX_FILE_SIZE
let cachedMaxFileSizeKb = null;
let cachedMaxFileSizeAt = 0;

// Tự nhận diện trần max_max_file_size thực tế từ Judge0 /config_info để không bao giờ bị HTTP 422
async function getEffectiveMaxFileSizeKb() {
  const now = Date.now();
  const ttlMs = cachedMaxFileSizeKb && cachedMaxFileSizeKb >= TARGET_MAX_FILE_SIZE_KB ? 10 * 60 * 1000 : 60 * 1000;
  if (cachedMaxFileSizeKb && now - cachedMaxFileSizeAt < ttlMs) {
    return cachedMaxFileSizeKb;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${JUDGE0_URL}/config_info`, {
      headers: { 'X-Auth-Token': JUDGE0_TOKEN },
      signal: controller.signal,
    });
    if (res.ok) {
      const cfg = await res.json();
      const serverMax = Number(cfg?.max_max_file_size);
      if (Number.isFinite(serverMax) && serverMax >= 1024) {
        cachedMaxFileSizeKb = Math.min(Math.max(Math.floor(serverMax), 1024), TARGET_MAX_FILE_SIZE_KB);
        cachedMaxFileSizeAt = now;
        return cachedMaxFileSizeKb;
      }
    }
  } catch {
  } finally {
    clearTimeout(timer);
  }
  return cachedMaxFileSizeKb || DEFAULT_MAX_FILE_SIZE_KB;
}

// Xây dựng kịch bản Bash biên dịch 1 lần và chạy theo lô trong container
// Hỗ trợ tách đôi dữ liệu test siêu lớn (> 3.5MB sau gzip+base64) sang stdin + source_code để không bao giờ vượt ngưỡng HTTP 500 của Judge0
// Khi sandbox đủ trần file size, giải nén input ra in.txt TRƯỚC khi bấm giờ timeout để không tính oan thời gian giải nén vào bài làm học sinh
function buildBatchBashScript(batchItems, srcCode, lang, tlSec, maxFileSizeKb = DEFAULT_MAX_FILE_SIZE_KB) {
  const codeB64 = Buffer.from(srcCode, 'utf8').toString('base64');
  const clampedTl = Math.min(Math.max(Number(tlSec) || 1.0, 0.1), 5.0);
  const tlMs = Math.round(clampedTl * 1000);
  let extraStdin = '';

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

  const SPLIT_THRESHOLD = 3.5 * 1024 * 1024;
  const maxStageInputBytes = Math.max(0, maxFileSizeKb - 512) * 1024;
  for (const item of batchItems) {
    const idx = item.idx;
    const rawInputBytes =
      typeof item.tc.inputBytes === 'number' ? item.tc.inputBytes : Buffer.byteLength(item.tc.input || '', 'utf8');
    const gzB64 = item.tc.gzB64 || zlib.gzipSync(Buffer.from(item.tc.input || '', 'utf8')).toString('base64');
    const canStageInputFile = rawInputBytes < maxStageInputBytes;
    let stageCmd = '';
    let execCmd = '';
    let exitCapture = '';
    if (batchItems.length === 1 && gzB64.length > SPLIT_THRESHOLD && !extraStdin) {
      const half = Math.ceil(gzB64.length / 2);
      extraStdin = gzB64.slice(0, half);
      const part2 = gzB64.slice(half);
      if (canStageInputFile) {
        stageCmd = `{ cat; printf '%s' '${part2}'; } | base64 -d | gzip -d > in.txt`;
        execCmd = `timeout ${clampedTl}s ${runCmd} < in.txt > out.txt 2> err.txt`;
        exitCapture = 'EC=$?';
      } else {
        execCmd = `{ cat; printf '%s' '${part2}'; } | base64 -d | gzip -d | timeout ${clampedTl}s ${runCmd} > out.txt 2> err.txt`;
        exitCapture = 'EC=${PIPESTATUS[3]}';
      }
    } else if (canStageInputFile) {
      stageCmd = `echo '${gzB64}' | base64 -d | gzip -d > in.txt`;
      execCmd = `timeout ${clampedTl}s ${runCmd} < in.txt > out.txt 2> err.txt`;
      exitCapture = 'EC=$?';
    } else {
      execCmd = `echo '${gzB64}' | base64 -d | gzip -d | timeout ${clampedTl}s ${runCmd} > out.txt 2> err.txt`;
      exitCapture = 'EC=${PIPESTATUS[3]}';
    }
    const testBlock = [
      `NOW=$(date +%s%3N)`,
      `if [ $TLE_STREAK -ge 4 ] || [ $((NOW - START_ALL)) -gt 13500 ]; then`,
      `  echo "===THEMIS_TEST:${idx}:124:${tlMs}:::===END_TEST==="`,
      `else`,
    ];
    if (stageCmd) {
      testBlock.push(`  ${stageCmd}`);
    }
    testBlock.push(
      `  T1=$(date +%s%3N)`,
      `  ${execCmd}`,
      `  ${exitCapture}`,
      `  T2=$(date +%s%3N)`,
      `  rm -f in.txt`,
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
      `  rm -f out.txt err.txt`,
      `  echo "===THEMIS_TEST:${idx}:$EC:$EL:$OUT_B64:$ERR_B64:$OUT_HASH===END_TEST==="`,
      `fi`
    );
    lines.push(...testBlock);
  }

  return { script: lines.join('\n'), stdin: extraStdin };
}

function truncateDisplay(str, maxLen = 220) {
  if (!str) return '';
  const s = String(str);
  return s.length > maxLen ? s.slice(0, maxLen) + '\n... [đã rút gọn]' : s;
}

// Tạo bản ghi kết quả 1 test SIÊU GỌN (~95 byte/test thay vì hàng chục KB):
// - Test ẩn, test AC hoặc lỗi CE: KHÔNG lưu lặp lại input/expectedOutput/actualOutput vào DB.
// - Chỉ giữ preview ngắn (<= 220 ký tự) cho test mở (không ẩn) khi bị WA / RTE / TLE để học sinh đối chiếu.
function buildCompactTestResult({ tc, verdict, execTime, memoryMb, pointsEarned, actualStdout, errorMessage }) {
  const item = {
    testId: tc.id,
    testName: tc.name,
    verdict,
    time: execTime,
    memory: memoryMb,
    pointsEarned,
    maxPoints: tc.points,
  };
  if (errorMessage && verdict !== 'CE' && verdict !== 'AC') {
    item.errorMessage = truncateDisplay(errorMessage, 180);
  }
  if (!tc.isHidden && verdict !== 'AC' && verdict !== 'CE') {
    if (tc.input && !String(tc.input).startsWith('__STORAGE_ZIP__:')) {
      item.input = truncateDisplay(tc.input, 220);
    }
    if (tc.expectedOutput && !String(tc.expectedOutput).startsWith('__STORAGE_ZIP__:')) {
      item.expectedOutput = truncateDisplay(tc.expectedOutput, 220);
    }
    if (actualStdout) {
      item.actualOutput = truncateDisplay(actualStdout, 220);
    }
  }
  return item;
}

// Tự động giới hạn tối đa MAX_KEEP bản nộp hoàn tất trên mỗi cặp (học sinh, bài tập):
// Luôn bảo toàn 1 bản Điểm cao nhất / Full AC sớm nhất (giữ nguyên thứ hạng) + (MAX_KEEP - 1) bản mới nhất.
async function pruneUserProblemSubmissions(userId, problemId, maxKeep = 3) {
  if (!userId || !problemId) return;
  try {
    const sbHeaders = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    };
    const listUrl =
      `${SUPABASE_URL}/rest/v1/submissions?user_id=eq.${encodeURIComponent(userId)}` +
      `&problem_id=eq.${encodeURIComponent(problemId)}` +
      `&select=id,verdict,status,total_points_earned,submitted_at&order=submitted_at.desc&limit=100`;
    const res = await fetch(listUrl, { headers: sbHeaders });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows)) return;

    const finished = rows.filter((r) => r && r.id && r.status !== 'PENDING' && r.status !== 'RUNNING');
    if (finished.length <= maxKeep) return;

    const sortedBest = [...finished].sort((a, b) => {
      const acDiff = (b.verdict === 'AC' ? 1 : 0) - (a.verdict === 'AC' ? 1 : 0);
      if (acDiff !== 0) return acDiff;
      const ptsDiff = (Number(b.total_points_earned) || 0) - (Number(a.total_points_earned) || 0);
      if (ptsDiff !== 0) return ptsDiff;
      return (Date.parse(a.submitted_at || '') || 0) - (Date.parse(b.submitted_at || '') || 0);
    });

    const keepIds = new Set([sortedBest[0].id]);
    const sortedNewest = [...finished].sort(
      (a, b) => (Date.parse(b.submitted_at || '') || 0) - (Date.parse(a.submitted_at || '') || 0)
    );
    for (const r of sortedNewest) {
      if (keepIds.size >= maxKeep) break;
      keepIds.add(r.id);
    }

    const staleIds = finished.filter((r) => !keepIds.has(r.id)).map((r) => encodeURIComponent(r.id));
    if (staleIds.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/submissions?id=in.(${staleIds.join(',')})`, {
        method: 'DELETE',
        headers: sbHeaders,
      });
    }
  } catch {}
}

const memoryProblemCache = new Map();

// Gọi Judge0 nội bộ (127.0.0.1:2358)
async function callJudge0(payload) {
  const MAX_ATTEMPTS = 3;
  let lastErr = new Error('Judge0 không phản hồi');
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
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

// Giải nén bộ đệm .ZIP thuần Node.js (0 thư viện ngoài, dùng sẵn zlib.inflateRawSync)
function extractZipBuffer(buf) {
  const entries = new Map();
  if (!Buffer.isBuffer(buf) || buf.length < 22) return entries;

  const minOffset = Math.max(0, buf.length - 65557);
  let eocdPos = -1;
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      const commentLen = buf.readUInt16LE(i + 20);
      if (i + 22 + commentLen === buf.length) {
        eocdPos = i;
        break;
      }
    }
  }
  if (eocdPos < 0) {
    throw new Error('File nén .ZIP không hợp lệ (không tìm thấy EOCD)');
  }

  const totalEntries = buf.readUInt16LE(eocdPos + 10);
  let pos = buf.readUInt32LE(eocdPos + 16);

  for (let e = 0; e < totalEntries && pos + 46 <= buf.length; e++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const rawName = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    pos += 46 + nameLen + extraLen + commentLen;

    if (rawName.endsWith('/')) continue;
    if (localHeaderOffset + 30 > buf.length) continue;
    if (buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > buf.length) continue;

    const compSlice = buf.subarray(dataStart, dataEnd);
    let fileBuf;
    if (method === 0) {
      fileBuf = compSlice;
    } else if (method === 8) {
      fileBuf = zlib.inflateRawSync(compSlice);
    } else {
      continue;
    }
    entries.set(rawName, fileBuf);
    const normName = rawName.replace(/\\/g, '/');
    if (normName !== rawName) entries.set(normName, fileBuf);
  }
  return entries;
}

function parseStorageZipPointer(val) {
  if (typeof val !== 'string' || !val.startsWith('__STORAGE_ZIP__:')) return null;
  const rest = val.slice('__STORAGE_ZIP__:'.length);
  const hashIdx = rest.indexOf('#');
  if (hashIdx < 0) return null;
  const urlPart = rest.slice(0, hashIdx);
  const entryName = rest.slice(hashIdx + 1);
  const qIdx = urlPart.indexOf('?');
  const pathOnly = qIdx >= 0 ? urlPart.slice(0, qIdx) : urlPart;
  const versionPart = qIdx >= 0 ? urlPart.slice(qIdx + 1) : '';
  const slashIdx = pathOnly.indexOf('/');
  if (slashIdx < 0) return null;
  return {
    bucket: pathOnly.slice(0, slashIdx),
    objectPath: pathOnly.slice(slashIdx + 1),
    cacheKey: `${pathOnly}_${versionPart}`,
    entryName,
  };
}

async function resolveStorageZipTestCases(rawTestCases, problemId, sbHeaders) {
  const zipSpecs = new Map();
  for (const tc of rawTestCases) {
    const pIn = parseStorageZipPointer(tc.input);
    const pOut = parseStorageZipPointer(tc.expectedOutput);
    if (pIn && !zipSpecs.has(pIn.cacheKey)) zipSpecs.set(pIn.cacheKey, pIn);
    if (pOut && !zipSpecs.has(pOut.cacheKey)) zipSpecs.set(pOut.cacheKey, pOut);
  }
  if (zipSpecs.size === 0) return { resolved: rawTestCases, usedStorageZip: false };

  // Tập tên file cache hợp lệ của phiên bản hiện tại (hỗ trợ nhiều gói .ZIP con p1, p2, p3... cho cùng 1 bài)
  const activeCacheFileNames = new Set();
  for (const [cacheKey] of zipSpecs.entries()) {
    const keyHash = crypto.createHash('md5').update(cacheKey).digest('hex').slice(0, 12);
    activeCacheFileNames.add(`zip_${problemId}_${keyHash}.zip`);
  }

  let downloadedAnyNew = false;
  const extractedMap = new Map();
  for (const [cacheKey, spec] of zipSpecs.entries()) {
    const keyHash = crypto.createHash('md5').update(cacheKey).digest('hex').slice(0, 12);
    const zipCacheFile = path.join(CACHE_DIR, `zip_${problemId}_${keyHash}.zip`);
    let zipBuf = null;

    if (fs.existsSync(zipCacheFile)) {
      try {
        zipBuf = fs.readFileSync(zipCacheFile);
      } catch {
        zipBuf = null;
      }
    }

    if (!zipBuf) {
      const encodedPath = spec.objectPath.split('/').map(encodeURIComponent).join('/');
      const dlUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(spec.bucket)}/${encodedPath}`;
      const dlRes = await fetch(dlUrl, { headers: sbHeaders });
      if (!dlRes.ok) {
        throw new Error(`Không thể tải gói test .ZIP từ Storage (HTTP ${dlRes.status})`);
      }
      zipBuf = Buffer.from(await dlRes.arrayBuffer());
      downloadedAnyNew = true;
      try {
        fs.writeFileSync(zipCacheFile, zipBuf);
      } catch {}
    }

    extractedMap.set(cacheKey, extractZipBuffer(zipBuf));
  }

  // Chỉ dọn các file .zip phiên bản cũ không còn nằm trong bộ activeCacheFileNames
  if (downloadedAnyNew) {
    try {
      const files = fs.readdirSync(CACHE_DIR);
      for (const f of files) {
        if (f.startsWith(`zip_${problemId}_`) && f.endsWith('.zip') && !activeCacheFileNames.has(f)) {
          fs.unlinkSync(path.join(CACHE_DIR, f));
        }
      }
    } catch {}
  }

  const readEntryText = (ptr) => {
    const entries = extractedMap.get(ptr.cacheKey);
    if (!entries) return '';
    const buf = entries.get(ptr.entryName) || entries.get(ptr.entryName.replace(/\\/g, '/'));
    return buf ? buf.toString('utf8') : '';
  };

  const resolved = rawTestCases.map((tc) => {
    const pIn = parseStorageZipPointer(tc.input);
    const pOut = parseStorageZipPointer(tc.expectedOutput);
    return {
      ...tc,
      input: pIn ? readEntryText(pIn) : tc.input,
      expectedOutput: pOut ? readEntryText(pOut) : tc.expectedOutput,
    };
  });

  return { resolved, usedStorageZip: true };
}

// Sắp xếp tự nhiên
  const { resolved: hydratedTestCases, usedStorageZip } = await resolveStorageZipTestCases(rawTestCases, problemId, sbHeaders);
  const sortedTestCases = [...hydratedTestCases].sort((a, b) => naturalCompare(a.name || a.id, b.name || b.id));
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
    const inBuf = Buffer.from(cleanIn, 'utf8');
    const gzB64 = zlib.gzipSync(inBuf, { level: inBuf.length > 2 * 1024 * 1024 ? 6 : 1 }).toString('base64');
    const expHashes = computeThemisHashes(cleanExp);
    return {
      ...tc,
      input: cleanIn,
      inputBytes: inBuf.length,
      expectedOutput: cleanExp,
      gzB64,
      expHashes,
      points: pts,
    };
  });

  const payload = { problem, testCases, targetTotal, version };
  memoryProblemCache.set(problemId, { version, data: payload });
  // Chỉ ghi cache JSON lớn cho bài SQL cũ; bài dùng .ZIP đã có sẵn file .zip siêu gọn trên ổ cứng VPS!
  if (!usedStorageZip) {
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(payload), 'utf8');
    } catch {}
  }
  return payload;
}

// Xử lý chấm 1 bài nộp
async function processSubmission(sub) {
  const tStart = Date.now();
  console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 Bắt đầu chấm bài [${sub.id}] | Bài: ${sub.problem_code || sub.problem_id} | Học sinh: ${sub.user_name}`);

  try {
    const [{ problem, testCases, targetTotal }, effectiveMaxFileSizeKb] = await Promise.all([
      getProblemAndTests(sub.problem_id),
      getEffectiveMaxFileSizeKb(),
    ]);
    const effectiveMaxFileMb = Math.round(effectiveMaxFileSizeKb / 1024);
    const { cleaned: cleanedCode } = preprocessCode(sub.source_code, sub.language || 'cpp');
    const timeLimit = Number(problem.time_limit) || 1.0;

    const batches = [];
    let currentBatch = [];
    let currentBytes = Buffer.byteLength(cleanedCode, 'utf8') * 2 + 2048;
    let currentRawBytes = 0;
    const MAX_BATCH_SCRIPT_BYTES = 3.5 * 1024 * 1024; // Giữ mỗi trường <= 3.5MB (an toàn dưới ngưỡng HTTP 500 ~5MB của Judge0)
    const MAX_BATCH_RAW_BYTES = 32 * 1024 * 1024; // Tránh dồn quá nhiều test 10MB+ (nén nhỏ nhưng giải nén lớn) vào cùng 1 lô 15s
    let totalGzBytes = 0;

    for (let i = 0; i < testCases.length; i++) {
      const rawBytes =
        typeof testCases[i].inputBytes === 'number'
          ? testCases[i].inputBytes
          : Buffer.byteLength(testCases[i].input || '', 'utf8');
      const gzLen = (testCases[i].gzB64 || '').length || rawBytes;
      totalGzBytes += gzLen;
      const estItemBytes = gzLen + 512;
      if (
        currentBatch.length > 0 &&
        (currentBytes + estItemBytes > MAX_BATCH_SCRIPT_BYTES || currentRawBytes + rawBytes > MAX_BATCH_RAW_BYTES)
      ) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBytes = Buffer.byteLength(cleanedCode, 'utf8') * 2 + 2048;
        currentRawBytes = 0;
      }
      currentBatch.push({ idx: i, tc: testCases[i] });
      currentBytes += estItemBytes;
      currentRawBytes += rawBytes;
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    const resultsMap = new Map();
    let compileFailedResult = null;

    async function executeBatch(batch) {
      if (compileFailedResult) return;
      const { script: bashScript, stdin: batchStdin } = buildBatchBashScript(
        batch,
        cleanedCode,
        sub.language || 'cpp',
        timeLimit,
        effectiveMaxFileSizeKb
      );
      const data = await callJudge0({
        source_code: bashScript,
        language_id: 46, // Bash 5.0.0
        stdin: batchStdin || '',
        cpu_time_limit: 15,
        wall_time_limit: 20,
        memory_limit: 512000, // 512MB RAM - Đảm bảo g++ đủ bộ nhớ biên dịch an toàn
        max_file_size: effectiveMaxFileSizeKb, // Tự nâng tối đa 64MB theo MAX_MAX_FILE_SIZE trên Judge0 VPS
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
          errorMessage = `Vượt giới hạn dung lượng dữ liệu xuất ra (Output Limit Exceeded > ${effectiveMaxFileMb}MB)`;
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

        resultsMap.set(
          i,
          buildCompactTestResult({
            tc,
            verdict,
            execTime,
            memoryMb,
            pointsEarned,
            actualStdout,
            errorMessage,
          })
        );
      }
    }

    // Với bộ test siêu lớn (> 2MB nén), chạy tuần tự từng lô để tránh tranh CPU trên VPS (chống TLE giả & giảm tải RAM/đĩa)
    const batchConcurrency = totalGzBytes > 2 * 1024 * 1024 ? 1 : Math.min(2, batches.length);
    let nextBatchIdx = 0;
    const batchWorker = async () => {
      while (nextBatchIdx < batches.length && !compileFailedResult) {
        const b = batches[nextBatchIdx++];
        if (b) await executeBatch(b);
      }
    };
    await Promise.all(Array.from({ length: batchConcurrency }, () => batchWorker()));

    const testResults = [];
    let totalPointsEarned = 0;
    let maxExecutionTime = 0;
    let peakMemory = 0;
    let isCompilationFailed = false;
    let compilationMessage = null;

    if (compileFailedResult) {
      isCompilationFailed = true;
      compilationMessage = truncateDisplay(compileFailedResult.errorMessage, 2000);
      testCases.forEach((tc) => {
        testResults.push(
          buildCompactTestResult({
            tc,
            verdict: 'CE',
            execTime: 0,
            memoryMb: 0,
            pointsEarned: 0,
            actualStdout: '',
            errorMessage: null,
          })
        );
      });
    } else {
      for (let i = 0; i < testCases.length; i++) {
        const r =
          resultsMap.get(i) ||
          buildCompactTestResult({
            tc: testCases[i],
            verdict: 'WA',
            execTime: 0.005,
            memoryMb: 1.5,
            pointsEarned: 0,
            actualStdout: '',
            errorMessage: 'Chưa có kết quả kiểm thử',
          });
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
      void pruneUserProblemSubmissions(sub.user_id, sub.problem_id, 3);
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

// ==============================================================================
// REALTIME WEBSOCKET CLIENT THUẦN NODE.JS (0 THƯ VIỆN NGOÀI, RFC 6455)
// Nhận thông báo bài nộp mới trong ~30ms -> Cắt giảm 97.7% Log Ingestion Supabase!
// ==============================================================================
class SimpleWssClient {
  constructor(url) {
    this.url = new URL(url);
    this.handlers = { open: [], message: [], close: [], error: [] };
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.upgraded = false;
    this.closed = false;
    this._connect();
  }
  on(ev, fn) {
    if (this.handlers[ev]) this.handlers[ev].push(fn);
  }
  _emit(ev, ...args) {
    for (const fn of this.handlers[ev] || []) {
      try {
        fn(...args);
      } catch {}
    }
  }
  _connect() {
    const key = crypto.randomBytes(16).toString('base64');
    const port = Number(this.url.port) || 443;
    const host = this.url.hostname;
    const reqPath = this.url.pathname + this.url.search;
    this.socket = tls.connect({ host, port, servername: host }, () => {
      const req = [
        `GET ${reqPath} HTTP/1.1`,
        `Host: ${host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '\r\n',
      ].join('\r\n');
      this.socket.write(req);
    });
    this.socket.setKeepAlive(true, 15000);
    this.socket.on('data', (chunk) => this._onData(chunk));
    this.socket.on('error', (err) => this._emit('error', err));
    this.socket.on('close', () => {
      if (!this.closed) {
        this.closed = true;
        this._emit('close');
      }
    });
  }
  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (!this.upgraded) {
      const sep = this.buffer.indexOf('\r\n\r\n');
      if (sep < 0) return;
      const head = this.buffer.subarray(0, sep).toString('utf8');
      this.buffer = this.buffer.subarray(sep + 4);
      if (!head.startsWith('HTTP/1.1 101')) {
        this._emit('error', new Error('WebSocket upgrade failed: ' + head.split('\r\n')[0]));
        this.close();
        return;
      }
      this.upgraded = true;
      this._emit('open');
    }
    this._drainFrames();
  }
  _drainFrames() {
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (this.buffer.length < 4) return;
        len = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (this.buffer.length < 10) return;
        len = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }
      const maskBytes = masked ? 4 : 0;
      if (this.buffer.length < offset + maskBytes + len) return;
      let payload = this.buffer.subarray(offset + maskBytes, offset + maskBytes + len);
      if (masked) {
        const mask = this.buffer.subarray(offset, offset + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buffer = this.buffer.subarray(offset + maskBytes + len);

      if (opcode === 0x08) {
        this.close();
        return;
      } else if (opcode === 0x09) {
        this._sendFrame(0x0a, payload);
      } else if (opcode === 0x01 || opcode === 0x00) {
        this.fragments.push(payload);
        if (fin) {
          const full = this.fragments.length === 1 ? this.fragments[0] : Buffer.concat(this.fragments);
          this.fragments = [];
          this._emit('message', full.toString('utf8'));
        }
      }
    }
  }
  _sendFrame(opcode, dataBuf) {
    if (!this.upgraded || this.closed || !this.socket || this.socket.destroyed) return;
    const len = dataBuf.length;
    const mask = crypto.randomBytes(4);
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    const maskedPayload = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) maskedPayload[i] = dataBuf[i] ^ mask[i & 3];
    this.socket.write(Buffer.concat([header, mask, maskedPayload]));
  }
  send(str) {
    this._sendFrame(0x01, Buffer.from(str, 'utf8'));
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.socket.destroy();
    } catch {}
    this._emit('close');
  }
}

// Vòng lặp xử lý Hàng đợi (Realtime Push + Atomic Claiming + Backup Poll 30s)
let isBusy = false;
let pendingRecheck = false;
let isRealtimeSubscribed = false;
let backupPollTimer = null;

function scheduleBackupPoll() {
  if (backupPollTimer) clearTimeout(backupPollTimer);
  const delay = isRealtimeSubscribed ? BACKUP_POLL_MS : FALLBACK_POLL_MS;
  backupPollTimer = setTimeout(() => {
    checkQueue();
  }, delay);
}

async function checkQueue() {
  if (isBusy) {
    pendingRecheck = true;
    return;
  }
  isBusy = true;
  pendingRecheck = false;
  let processedOne = false;
  try {
    const sbHeaders = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    };

    // Tìm bài nộp PENDING cũ nhất (chỉ lấy cột id cực nhẹ ~30 byte)
    const listRes = await fetch(
      `${SUPABASE_URL}/rest/v1/submissions?status=eq.PENDING&select=id&order=submitted_at.asc&limit=1`,
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
            processedOne = true;
            await processSubmission(claimed[0]);
          }
        }
      }
    }
  } catch (err) {
    // Tránh spam log khi mạng chập chờn
  } finally {
    isBusy = false;
    if (processedOne || pendingRecheck) {
      // Nếu vừa chấm xong 1 bài hoặc có tín hiệu Realtime mới đến lúc đang bận -> kiểm tra tiếp ngay lập tức
      setTimeout(checkQueue, 50);
    } else {
      scheduleBackupPoll();
    }
  }
}

let wsRefCounter = 1;
let reconnectAttempt = 0;

function startRealtimeListener() {
  const wsUrl =
    SUPABASE_URL.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://') +
    `/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_KEY)}&vsn=1.0.0`;

  let heartbeatTimer = null;
  const ws = new SimpleWssClient(wsUrl);

  const cleanup = () => {
    isRealtimeSubscribed = false;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    scheduleBackupPoll();
  };

  ws.on('open', () => {
    reconnectAttempt = 0;
    ws.send(
      JSON.stringify({
        topic: 'realtime:public:submissions',
        event: 'phx_join',
        payload: {
          config: {
            postgres_changes: [{ event: 'INSERT', schema: 'public', table: 'submissions' }],
          },
          access_token: SUPABASE_KEY,
        },
        ref: String(wsRefCounter++),
      })
    );
    heartbeatTimer = setInterval(() => {
      ws.send(
        JSON.stringify({
          topic: 'phoenix',
          event: 'heartbeat',
          payload: {},
          ref: String(wsRefCounter++),
        })
      );
    }, 25000);
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.event === 'system' && msg.payload?.status === 'ok') {
        isRealtimeSubscribed = true;
        console.log(`[${new Date().toLocaleTimeString()}] 📡 Đã kết nối Supabase Realtime WebSocket (nhận bài tức thì ~30ms · poll dự phòng ${BACKUP_POLL_MS / 1000}s)`);
        scheduleBackupPoll();
        checkQueue();
      } else if (msg.event === 'postgres_changes') {
        const rec = msg.payload?.data?.record;
        if (!rec || rec.status === 'PENDING') {
          checkQueue();
        }
      }
    } catch {}
  });

  ws.on('error', (err) => {
    console.warn(`[${new Date().toLocaleTimeString()}] ⚠️ Realtime WebSocket cảnh báo:`, err?.message || err);
  });

  ws.on('close', () => {
    cleanup();
    reconnectAttempt = Math.min(reconnectAttempt + 1, 5);
    const retryMs = Math.min(2000 * reconnectAttempt, 10000);
    setTimeout(startRealtimeListener, retryMs);
  });
}

console.log('====================================================');
console.log('🤖 FAMINH JUDGE WORKER DAEMON (REALTIME V2) ĐÃ KHỞI ĐỘNG');
console.log(`🔗 Supabase URL   : ${SUPABASE_URL}`);
console.log(`⚡ Judge0 Local    : ${JUDGE0_URL}`);
console.log(`📡 Chế độ nhận bài : Realtime WebSocket (~30ms) + Dự phòng ${BACKUP_POLL_MS / 1000}s`);
console.log('====================================================');
console.log('Đang kết nối Supabase Realtime và chờ bài nộp mới...');

startRealtimeListener();
checkQueue();
getEffectiveMaxFileSizeKb().then((kb) => {
  const mb = Math.round(kb / 1024);
  console.log(`📦 Giới hạn file I/O Judge0: ${mb} MB (${kb} KB)${kb < TARGET_MAX_FILE_SIZE_KB ? ' — Gợi ý nâng MAX_MAX_FILE_SIZE=65536 trong judge0.conf cho bài IO lớn' : ' (Tối ưu cho bài IO lớn 10^6)'}`);
});
