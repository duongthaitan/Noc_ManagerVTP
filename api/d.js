// Vercel serverless: bypass Filebin "Heads up" landing page.
// Filebin trả HTML warning khi Accept: text/html, nhưng trả 302 → S3 pre-signed URL khi Accept: */*.
// Hàm này fetch upstream với Accept: */*, lấy Location, redirect browser thẳng tới S3.
// Browser khi đó nhận file với Content-Disposition: inline → render trực tiếp (ảnh hiện viewer,
// PDF mở viewer, ZIP tự tải). User bấm share native trên thanh URL = xong.
//
// Bandwidth Vercel ~ 0 byte/request (chỉ HEAD upstream rồi 302). File tải thẳng từ Hetzner S3.

export const config = {
  runtime: 'nodejs',
};

const ALLOWED_HOSTS = new Set(['filebin.net']);

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('method not allowed');
  }

  var u = req.query && req.query.u;
  if (Array.isArray(u)) u = u[0];
  if (!u || typeof u !== 'string') {
    return res.status(400).send('missing ?u=<filebin-url>');
  }

  let target;
  try {
    target = new URL(u);
  } catch (e) {
    return res.status(400).send('invalid url');
  }

  // Whitelist domain để tránh open-redirect / SSRF
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return res.status(403).send('host not allowed: ' + target.hostname);
  }

  // Fetch với Accept: */* — Filebin trả 302 Location: <S3 pre-signed URL>
  let upstream;
  try {
    upstream = await fetch(target.href, {
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'curl/8.0',
      },
    });
  } catch (e) {
    return res.status(502).send('upstream fetch failed: ' + (e && e.message));
  }

  if (upstream.status === 404) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>File đã hết hạn</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#F1F3F8;color:#1F2937;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}.box{max-width:420px;background:#fff;padding:32px 24px;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,.08)}.ico{font-size:48px;margin-bottom:12px}h1{font-size:18px;color:#EE0033;margin:0 0 8px}p{font-size:14px;color:#6B7280;margin:6px 0;line-height:1.5}</style><div class="box"><div class="ico">⏰</div><h1>File đã hết hạn</h1><p>Liên kết này không còn hợp lệ. Vui lòng yêu cầu người gửi tạo lại mã QR mới.</p></div>`);
  }

  const loc = upstream.headers.get('location');
  if (!loc) {
    return res.status(502).send('upstream did not redirect (status ' + upstream.status + ')');
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.redirect(302, loc);
}
