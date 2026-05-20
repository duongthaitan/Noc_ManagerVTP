// Vercel serverless proxy: upload file qua các provider không block IP datacenter
// Dùng cho user bị firewall ISP/nội bộ chặn các file-host trực tiếp.
// Client gửi multipart/form-data với field "fileToUpload"; proxy forward tới upstream và trả URL.

export const config = {
  api: {
    bodyParser: false, // tự stream raw body để giữ nguyên multipart boundary
  },
  maxDuration: 180,
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Trích file đầu tiên từ multipart body (đủ dùng vì client luôn gửi 1 file).
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) return null;
  const boundary = '--' + (m[1] || m[2]);
  const delim = Buffer.from(boundary);
  const closing = Buffer.from(boundary + '--');
  const CRLF2 = Buffer.from('\r\n\r\n');

  let start = buf.indexOf(delim);
  if (start < 0) return null;
  start += delim.length + 2; // skip CRLF after boundary

  while (start < buf.length) {
    const headerEnd = buf.indexOf(CRLF2, start);
    if (headerEnd < 0) break;
    const headers = buf.slice(start, headerEnd).toString('utf8');
    const bodyStart = headerEnd + 4;

    const next = buf.indexOf(delim, bodyStart);
    if (next < 0) break;
    const bodyEnd = next - 2; // strip trailing CRLF
    const partBody = buf.slice(bodyStart, bodyEnd);

    const dispMatch = /Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i.exec(headers);
    if (dispMatch) {
      const name = dispMatch[1];
      const filename = dispMatch[2];
      if (filename) {
        const ctMatch = /Content-Type:\s*([^\r\n;]+)/i.exec(headers);
        return {
          fieldName: name,
          filename,
          contentType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
          data: partBody,
        };
      }
    }

    if (buf.slice(next, next + closing.length).equals(closing)) break;
    start = next + delim.length + 2;
  }
  return null;
}

// === UPSTREAM PROVIDERS ===
// Mỗi upstream là 1 async function nhận {filename, contentType, data} và trả {url, provider, expiryLabel}
// Throw nếu fail; orchestrator sẽ fallback sang upstream tiếp theo.

async function uploadToGofile(file) {
  // Gofile yêu cầu lookup server trước
  const ctrl1 = new AbortController();
  const t1 = setTimeout(() => ctrl1.abort(), 15000);
  let serverName;
  try {
    const r = await fetch('https://api.gofile.io/servers', { signal: ctrl1.signal });
    const j = await r.json();
    if (j.status !== 'ok' || !j.data?.servers?.length) {
      throw new Error('không tìm được gofile server');
    }
    serverName = j.data.servers[0].name;
  } finally {
    clearTimeout(t1);
  }

  const fd = new FormData();
  fd.append('file', new Blob([file.data], { type: file.contentType }), file.filename);

  const ctrl2 = new AbortController();
  const t2 = setTimeout(() => ctrl2.abort(), 170000);
  try {
    const res = await fetch(`https://${serverName}.gofile.io/contents/uploadfile`, {
      method: 'POST',
      body: fd,
      signal: ctrl2.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 200));
    let j;
    try { j = JSON.parse(text); } catch { throw new Error('response không phải JSON'); }
    if (j.status !== 'ok' || !j.data?.downloadPage) {
      throw new Error('upload fail: ' + (j.message || JSON.stringify(j).slice(0, 200)));
    }
    return {
      url: j.data.downloadPage,
      provider: 'Gofile',
      expiryMs: 10 * 24 * 60 * 60 * 1000, // gofile xóa file không-được-tải sau 10 ngày
      expiryLabel: '~10 ngày (nếu không có lượt tải)',
    };
  } finally {
    clearTimeout(t2);
  }
}

async function uploadToFilebin(file) {
  // filebin.net dùng "bin id" — sinh random để file không trộn lẫn
  const binId = 'vtp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
  const url = `https://filebin.net/${binId}/${encodeURIComponent(safeName)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 170000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': file.contentType || 'application/octet-stream' },
      body: file.data,
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 200));
    return {
      url: `https://filebin.net/${binId}/${encodeURIComponent(safeName)}`,
      provider: 'Filebin',
      expiryMs: 6 * 24 * 60 * 60 * 1000, // filebin auto-expire sau 6 ngày
      expiryLabel: '6 ngày',
    };
  } finally {
    clearTimeout(t);
  }
}

async function uploadToCatbox(file) {
  // Backup cuối — Catbox đôi khi block IP Vercel (412 Invalid uploader) nhưng đáng thử.
  const fd = new FormData();
  fd.append('reqtype', 'fileupload');
  fd.append('fileToUpload', new Blob([file.data], { type: file.contentType }), file.filename);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 170000);
  try {
    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: fd,
      signal: ctrl.signal,
    });
    const text = (await res.text()).trim();
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 200));
    const url = text.split(/\r?\n/)[0].trim();
    if (!/^https?:\/\/\S+/i.test(url)) throw new Error('response lạ: ' + text.slice(0, 200));
    return {
      url: url.replace(/^http:\/\//i, 'https://'),
      provider: 'Catbox',
      expiryMs: 0,
      expiryLabel: 'vĩnh viễn',
    };
  } finally {
    clearTimeout(t);
  }
}

const UPSTREAMS = [
  // Filebin redirect 302 thẳng tới file → quét QR mở file luôn (không landing page)
  { name: 'Filebin', fn: uploadToFilebin },
  // Gofile có landing page nhưng đáng dùng cho file lớn / khi Filebin fail
  { name: 'Gofile', fn: uploadToGofile },
  // Catbox vĩnh viễn — fallback cuối; thường bị block IP datacenter
  { name: 'Catbox', fn: uploadToCatbox },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return res.status(400).json({ error: 'Cần multipart/form-data' });
  }

  let buf;
  try {
    buf = await readBody(req);
  } catch (e) {
    return res.status(400).json({ error: 'Đọc body fail: ' + e.message });
  }

  const file = parseMultipart(buf, contentType);
  if (!file) {
    return res.status(400).json({ error: 'Không tìm thấy file trong multipart body' });
  }

  // Vercel có giới hạn body 4.5MB cho serverless function trên Hobby tier
  if (file.data.length > 4.5 * 1024 * 1024) {
    return res.status(413).json({ error: 'File quá 4.5MB — vượt giới hạn proxy' });
  }

  const failures = [];
  for (const upstream of UPSTREAMS) {
    try {
      const result = await upstream.fn(file);
      return res.status(200).json(result);
    } catch (e) {
      failures.push(upstream.name + ': ' + (e.message || 'unknown'));
    }
  }

  return res.status(502).json({
    error: 'Tất cả upstream đều fail',
    failures,
  });
}
