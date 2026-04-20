/**
 * utils.js — Helper functions
 * Các hàm tiện ích dùng chung: format, escape, toast, ripple
 */

// ================================================================
// FORMAT HELPERS
// ================================================================

/**
 * Format số serial Excel hoặc chuỗi thành ngày giờ dd/mm/yyyy HH:MM
 */
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
    if (!isNaN(d.getTime()))
      return padZ(d.getDate()) + '/' + padZ(d.getMonth() + 1) + '/' + d.getFullYear()
        + ' ' + padZ(d.getHours()) + ':' + padZ(d.getMinutes());
  } catch (e) {}
  return str;
}

/** Pad số với 0 phía trước (2 chữ số) */
function padZ(n) { return String(n).padStart(2, '0'); }

/** Format tiền VND: 1234567 → "1.234.567" */
function formatMoney(n) { return Math.round(n).toLocaleString('vi-VN'); }

/** Escape HTML để tránh XSS */
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
// RIPPLE EFFECT
// ================================================================

/**
 * Tạo hiệu ứng ripple tại vị trí click trên button
 * Dùng: onclick="...; addRipple(event)"
 */
function addRipple(e) {
  const btn    = e.currentTarget;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const size   = Math.max(btn.offsetWidth, btn.offsetHeight);
  const rect   = btn.getBoundingClientRect();
  ripple.style.width  = ripple.style.height = size + 'px';
  ripple.style.left   = (e.clientX - rect.left  - size / 2) + 'px';
  ripple.style.top    = (e.clientY - rect.top   - size / 2) + 'px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

// ================================================================
// TOAST — Multi-type notification system
// ================================================================

let _toastId = 0;

/**
 * Hiển thị toast notification
 * @param {string} msg   - Nội dung hiển thị
 * @param {string} type  - 'success' | 'error' | 'warning' | 'info'
 */
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const id  = ++_toastId;
  const el  = document.createElement('div');
  const iconMap = {
    success: 'fa-circle-check',
    error:   'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info:    'fa-circle-info',
  };
  el.className = `toast-item toast-${type}`;
  el.id        = 'toast-' + id;
  el.innerHTML = `<i class="fa-solid ${iconMap[type] || iconMap.info} toast-icon"></i><span>${msg}</span>`;
  container.appendChild(el);
  // Double rAF để trigger transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { el.classList.add('show'); });
  });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 3500);
}

// ================================================================
// HEADER BADGE UPDATE
// ================================================================

/**
 * Cập nhật các badge số lượng ở header
 */
function updateHeaderBadges(tt500, doTotal, quahan) {
  document.getElementById('h-total-tt500').textContent  = tt500;
  document.getElementById('h-total-do').textContent     = doTotal;
  document.getElementById('h-total-quahan').textContent = quahan;
}
