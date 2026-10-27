// api/judge0.js - Vercel Serverless Function Reverse Proxy cho Judge0 VPS
// Bảo vệ VULN-05: Rate-limiting, Origin whitelist, Endpoint whitelist, Payload validation & SSRF prevention

const JUDGE0_TARGET = (process.env.JUDGE0_API_URL || 'http://103.149.170.5:2358').trim().replace(/\/+$/, '');
const JUDGE0_TOKEN = (process.env.JUDGE0_API_TOKEN || 'faminh_secret_api_token').trim();

// Cấu hình giới hạn tần suất (Rate Limiting) in-memory theo IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 30; // tối đa 30 lần nộp / phút / IP
const MAX_REQUESTS_PER_WINDOW = 120;   // tối đa 120 lần truy vấn / phút / IP
const ipRateLimits = new Map();

function cleanExpiredRateLimits(now) {
  if (ipRateLimits.size > 1000) {
    for (const [ip, data] of ipRateLimits.entries()) {
      data.submissions = data.submissions.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      data.requests = data.requests.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (data.submissions.length === 0 && data.requests.length === 0) {
        ipRateLimits.delete(ip);
      }
    }
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    // Chấp nhận local development
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
    // Chấp nhận domain chính thức
    if (host === 'faminh.io.vn' || host.endsWith('.faminh.io.vn')) return true;
    // Chấp nhận các link Vercel preview / deployment
    if (host.endsWith('.vercel.app')) return true;
    // Biến môi trường tuỳ chỉnh nếu có
    if (process.env.ALLOWED_ORIGIN) {
      try {
        const allowed = new URL(process.env.ALLOWED_ORIGIN).hostname.toLowerCase();
        if (host === allowed) return true;
      } catch {}
    }
    return false;
  } catch {
    return false;
  }
}

// Whitelist endpoint an toàn cho Judge0 (Chống SSRF & Traversal)
const ALLOWED_ENDPOINT_REGEX = /^(about|languages(\/[0-9]+)?|statuses|submissions(\/[a-zA-Z0-9_\-]+)?|workers)$/;
const ALLOWED_QUERY_PARAMS = new Set(['base64_encoded', 'wait', 'fields', 'page', 'per_page']);

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Xác thực Origin / Referer chống Cross-Site Abuse
  let isOriginAllowed = false;
  let responseOrigin = '';

  if (origin) {
    if (isAllowedOrigin(origin)) {
      isOriginAllowed = true;
      responseOrigin = origin;
    }
  } else if (referer) {
    try {
      const refUrl = new URL(referer);
      if (isAllowedOrigin(refUrl.origin)) {
        isOriginAllowed = true;
        responseOrigin = refUrl.origin;
      }
    } catch {}
  } else {
    // Không có origin lẫn referer (ví dụ direct fetch cùng domain)
    const secFetchSite = req.headers['sec-fetch-site'];
    if (!secFetchSite || secFetchSite === 'same-origin' || secFetchSite === 'none') {
      isOriginAllowed = true;
      responseOrigin = 'https://faminh.io.vn';
    }
  }

  // Nếu origin được xác thực, đặt header CORS chính xác
  if (isOriginAllowed && responseOrigin) {
    res.setHeader('Access-Control-Allow-Origin', responseOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Themis-Client, X-Auth-Token, Authorization, X-Requested-With'
  );

  if (req.method === 'OPTIONS') {
    if (origin && !isOriginAllowed) {
      return res.status(403).json({ error: 'Forbidden', message: 'Origin không được cấp phép.' });
    }
    return res.status(204).end();
  }

  // Từ chối nếu Origin không hợp lệ
  if (!isOriginAllowed) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Yêu cầu bị từ chối: Nguồn gốc truy cập không hợp lệ.',
    });
  }

  // Giới hạn các HTTP method cho phép
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: `Phương thức ${req.method} không được hỗ trợ.`,
    });
  }

  try {
    // 1. Phân tích endpoint từ query hoặc URL pathname
    let endpoint = req.query?.endpoint || '';
    if (Array.isArray(endpoint)) {
      endpoint = endpoint.join('/');
    }
    if (!endpoint) {
      const parsedUrl = new URL(req.url, 'http://localhost');
      endpoint = parsedUrl.pathname.replace(/^\/api\/judge0\/?/, '');
    }
    endpoint = endpoint.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');

    // Chống Path Traversal (SSRF)
    if (endpoint.includes('..') || endpoint.includes('%2e') || endpoint.includes('%2E')) {
      return res.status(400).json({ error: 'Bad Request', message: 'Đường dẫn endpoint không hợp lệ.' });
    }

    // Kiểm tra Endpoint Whitelist
    if (!ALLOWED_ENDPOINT_REGEX.test(endpoint)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Endpoint không được cấp phép qua proxy.',
      });
    }

    // 2. Rate Limiting theo IP
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    cleanExpiredRateLimits(now);

    if (!ipRateLimits.has(clientIp)) {
      ipRateLimits.set(clientIp, { submissions: [], requests: [] });
    }
    const ipData = ipRateLimits.get(clientIp);
    ipData.submissions = ipData.submissions.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    ipData.requests = ipData.requests.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    const isSubmission = req.method === 'POST' && endpoint.startsWith('submissions');

    if (isSubmission) {
      if (ipData.submissions.length >= MAX_SUBMISSIONS_PER_WINDOW) {
        res.setHeader('Retry-After', '30');
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Tần suất gửi bài quá nhanh. Vui lòng thử lại sau 30 giây.',
        });
      }
      ipData.submissions.push(now);
    } else {
      if (ipData.requests.length >= MAX_REQUESTS_PER_WINDOW) {
        res.setHeader('Retry-After', '30');
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Quá nhiều yêu cầu đến máy chủ. Vui lòng thử lại sau giây lát.',
        });
      }
      ipData.requests.push(now);
    }

    // 3. Xây dựng URL chuyển tiếp đến VPS Judge0
    const targetUrl = new URL(`${JUDGE0_TARGET}/${endpoint}`);
    const reqUrl = new URL(req.url, 'http://localhost');
    reqUrl.searchParams.forEach((value, key) => {
      if (key !== 'endpoint' && ALLOWED_QUERY_PARAMS.has(key)) {
        targetUrl.searchParams.set(key, value);
      }
    });

    const headers = {
      'X-Auth-Token': JUDGE0_TOKEN,
    };
    if (req.headers && req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }

    const fetchOptions = {
      method: req.method,
      headers,
    };

    // 4. Payload Validation và Sanitization cho Submission
    if (req.method === 'POST') {
      let bodyData = req.body;
      if (typeof bodyData === 'string') {
        try {
          bodyData = JSON.parse(bodyData);
        } catch {
          return res.status(400).json({ error: 'Bad Request', message: 'Dữ liệu JSON không hợp lệ.' });
        }
      }

      if (endpoint.startsWith('submissions')) {
        if (!bodyData || typeof bodyData !== 'object') {
          return res.status(400).json({ error: 'Bad Request', message: 'Thiếu dữ liệu nộp bài.' });
        }

        // Kiểm tra source_code
        if (typeof bodyData.source_code !== 'string' || !bodyData.source_code.trim()) {
          return res.status(400).json({ error: 'Bad Request', message: 'Mã nguồn không được để trống.' });
        }
        if (bodyData.source_code.length > 131072) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Mã nguồn vượt quá dung lượng tối đa cho phép (128 KB).',
          });
        }

        // Kiểm tra stdin
        if (typeof bodyData.stdin === 'string') {
          if (bodyData.stdin.length > 524288) {
            return res.status(400).json({
              error: 'Bad Request',
              message: 'Dữ liệu input vượt quá dung lượng tối đa (512 KB).',
            });
          }
          bodyData.stdin = bodyData.stdin.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        }

        // Giới hạn tài nguyên thực thi (ngăn chặn DoS / compute lock trên VPS)
        const cpuLimit = Number(bodyData.cpu_time_limit);
        bodyData.cpu_time_limit = Number.isFinite(cpuLimit) ? Math.min(Math.max(cpuLimit, 0.1), 10.0) : 1.0;

        if (bodyData.wall_time_limit) {
          const wallLimit = Number(bodyData.wall_time_limit);
          bodyData.wall_time_limit = Number.isFinite(wallLimit) ? Math.min(Math.max(wallLimit, 0.1), 15.0) : 15.0;
        }

        if (bodyData.memory_limit) {
          const memLimit = Number(bodyData.memory_limit);
          bodyData.memory_limit = Number.isFinite(memLimit) ? Math.min(Math.max(memLimit, 1024), 512000) : 512000;
        }

        // Kiểm tra language_id hợp lệ
        if (bodyData.language_id !== undefined) {
          const langId = Number(bodyData.language_id);
          if (!Number.isInteger(langId) || langId <= 0 || langId > 200) {
            return res.status(400).json({ error: 'Bad Request', message: 'Ngôn ngữ lập trình không hợp lệ.' });
          }
        }
      }

      fetchOptions.body = typeof bodyData === 'object' ? JSON.stringify(bodyData) : bodyData;
    }

    // 5. Chuyển tiếp tới upstream VPS Judge0 với timeout bảo vệ
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    fetchOptions.signal = controller.signal;

    try {
      const upstreamResponse = await fetch(targetUrl.toString(), fetchOptions);
      clearTimeout(timeoutId);

      const data = await upstreamResponse.text();

      res.status(upstreamResponse.status);
      const contentType = upstreamResponse.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      return res.send(data);
    } catch (upstreamErr) {
      clearTimeout(timeoutId);
      if (upstreamErr.name === 'AbortError') {
        return res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Máy chủ Judge0 VPS mất quá nhiều thời gian phản hồi (Timeout 25s).',
        });
      }
      throw upstreamErr;
    }
  } catch (error) {
    console.error('[Judge0 Proxy Error]:', error);
    return res.status(502).json({
      error: 'Judge0 Proxy Error',
      message: error?.message || 'Không thể kết nối đến máy chủ Judge0 VPS qua Proxy.',
    });
  }
}
