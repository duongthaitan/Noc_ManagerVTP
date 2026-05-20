// Vercel serverless proxy → Catbox/Litterbox
// Bypass firewall ISP/nội bộ chặn các file-host nước ngoài.
// Client gửi multipart/form-data; ta forward thẳng tới upstream và trả URL về.

export const config = {
  api: {
    bodyParser: false, // tự stream raw body để giữ nguyên multipart boundary
  },
};

const UPSTREAMS = [
  {
    name: 'Litterbox',
    url: 'https://litterbox.catbox.moe/resources/internals/api.php',
    expiryMs: 60 * 60 * 1000,
    expiryLabel: '1 giờ',
    needsTime: true,
  },
  {
    name: 'Catbox',
    url: 'https://catbox.moe/user/api.php',
    expiryMs: 0,
    expiryLabel: 'vĩnh viễn',
    needsTime: false,
  },
];

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Inject reqtype=fileupload (và time=1h nếu cần) vào multipart body do client gửi.
// Client chỉ gửi fileToUpload + time → ta thêm reqtype.
function injectFields(buf, contentType, needsTime) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) return buf;
  const boundary = m[1] || m[2];
  const delim = '--' + boundary;
  const headerCRLF = '\r\n';
  const reqtypePart = Buffer.from(
    delim + headerCRLF +
    'Content-Disposition: form-data; name="reqtype"' + headerCRLF + headerCRLF +
    'fileupload' + headerCRLF
  );
  // Tìm vị trí của boundary đầu tiên trong body để chèn trước nó
  const idx = buf.indexOf(delim);
  if (idx < 0) return buf;
  return Buffer.concat([buf.slice(0, idx), reqtypePart, buf.slice(idx)]);
}

async function tryUpstream(upstream, contentType, body) {
  // Inject reqtype để client không cần biết upstream là cái gì
  const finalBody = injectFields(body, contentType, upstream.needsTime);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 170000);
  try {
    const res = await fetch(upstream.url, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: finalBody,
      signal: ctrl.signal,
    });
    const text = (await res.text()).trim();
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 200));
    const url = text.split(/\r?\n/)[0].trim();
    if (!/^https?:\/\/\S+/i.test(url)) throw new Error('response lạ: ' + text.slice(0, 200));
    return { url: url.replace(/^http:\/\//i, 'https://'), provider: upstream };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  // CORS — cho phép gọi từ chính origin (Vercel rewrite cùng origin nên thực ra không cần,
  // nhưng để hỗ trợ test cross-origin / preview deploy)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return res.status(400).json({ error: 'Cần multipart/form-data' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return res.status(400).json({ error: 'Đọc body fail: ' + e.message });
  }

  const failures = [];
  for (const upstream of UPSTREAMS) {
    try {
      const result = await tryUpstream(upstream, contentType, body);
      return res.status(200).json({
        url: result.url,
        provider: result.provider.name,
        expiryMs: result.provider.expiryMs,
        expiryLabel: result.provider.expiryLabel,
      });
    } catch (e) {
      failures.push(upstream.name + ': ' + (e.message || 'unknown'));
    }
  }

  return res.status(502).json({
    error: 'Tất cả upstream đều fail',
    failures,
  });
}
