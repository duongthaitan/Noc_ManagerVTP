/**
 * utils.js — Helper functions dùng chung toàn ứng dụng
 * Phụ thuộc: XLSX (CDN)
 */

// ================================================================
// FORMAT DATE — hỗ trợ cả serial Excel lẫn string
// ================================================================
function formatDate(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return '';
    const dt = new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0);
    return padZ(dt.getDate()) + '/' + padZ(dt.getMonth() + 1) + '/' + dt.getFullYear()
      + ' ' + padZ(dt.getHours()) + ':' + padZ(dt.getMinutes());
  }
  const str = String(val);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) return str;
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return padZ(d.getDate()) + '/' + padZ(d.getMonth() + 1) + '/' + d.getFullYear()
        + ' ' + padZ(d.getHours()) + ':' + padZ(d.getMinutes());
    }
  } catch (e) {}
  return str;
}

function padZ(n) {
  return String(n).padStart(2, '0');
}

// ================================================================
// FORMAT MONEY
// ================================================================
function formatMoney(n) {
  return Math.round(n).toLocaleString('vi-VN');
}

// ================================================================
// ESCAPE HTML — chống XSS khi nhúng vào innerHTML
// ================================================================
function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ================================================================
// HEADER BADGES
// ================================================================
function updateHeaderBadges(total, buuta, quahan) {
  document.getElementById('h-total-phieu').textContent = total;
  document.getElementById('h-total-buuta').textContent = buuta;
  document.getElementById('h-total-quahan').textContent = quahan;
}

// ================================================================
// TOAST NOTIFICATION
// ================================================================
let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ================================================================
// COLLAPSIBLE PANEL
// ================================================================
function toggleCollapse(id) {
  document.getElementById(id).classList.toggle('collapsed');
}
