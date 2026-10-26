// api/judge0.js - Vercel Serverless Function Reverse Proxy cho Judge0 VPS
// Giải quyết triệt để lỗi Mixed Content (Trang web HTTPS gọi API HTTP trên VPS) và che giấu Token bảo mật

const JUDGE0_TARGET = (process.env.JUDGE0_API_URL || 'http://103.149.170.5:2358').trim().replace(/\/+$/, '');
const JUDGE0_TOKEN = (process.env.JUDGE0_API_TOKEN || 'faminh_secret_api_token').trim();

export default async function handler(req, res) {
  // Thiết lập Headers CORS đầy đủ
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Auth-Token, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 1. Phân tích endpoint từ query (do vercel.json rewrite ?endpoint=...) hoặc từ pathname
    let endpoint = req.query?.endpoint || '';
    if (Array.isArray(endpoint)) {
      endpoint = endpoint.join('/');
    }

    if (!endpoint) {
      const parsedUrl = new URL(req.url, 'http://localhost');
      endpoint = parsedUrl.pathname.replace(/^\/api\/judge0\/?/, '');
    }

    // 2. Xây dựng URL chuyển tiếp đến VPS Judge0
    const targetUrl = new URL(`${JUDGE0_TARGET}/${endpoint.replace(/^\/+/, '')}`);
    const reqUrl = new URL(req.url, 'http://localhost');
    reqUrl.searchParams.forEach((value, key) => {
      if (key !== 'endpoint') {
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

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      let bodyData = req.body;
      if (typeof bodyData === 'string') {
        try {
          bodyData = JSON.parse(bodyData);
        } catch {}
      }
      if (bodyData && typeof bodyData === 'object' && typeof bodyData.stdin === 'string') {
        bodyData.stdin = bodyData.stdin.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      }
      fetchOptions.body = typeof bodyData === 'object' ? JSON.stringify(bodyData) : bodyData;
    }

    const upstreamResponse = await fetch(targetUrl.toString(), fetchOptions);
    const data = await upstreamResponse.text();

    res.status(upstreamResponse.status);
    const contentType = upstreamResponse.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    return res.send(data);
  } catch (error) {
    console.error('[Judge0 Proxy Error]:', error);
    return res.status(502).json({
      error: 'Judge0 Proxy Error',
      message: error?.message || 'Không thể kết nối đến máy chủ Judge0 VPS qua Proxy',
    });
  }
}
