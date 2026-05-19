/**
 * mode.js — Chọn chế độ cảnh báo & phân loại hàng
 * Toggle mode cards (tt500 / do), cập nhật badge, classify từng row Excel
 */

// ================================================================
// MODE CARD TOGGLE
// ================================================================

/** Toggle chọn/bỏ chọn một mode ('tt500' hoặc 'do') */
function toggleMode(mode) {
  selectedModes[mode] = !selectedModes[mode];
  const card  = document.getElementById('mode-card-' + mode);
  const check = document.getElementById('mode-check-' + mode);
  if (selectedModes[mode]) {
    card.classList.add('selected');
    check.innerHTML = '<i class="fa-solid fa-check" style="font-size:11px;"></i>';
  } else {
    card.classList.remove('selected');
    check.innerHTML = '';
  }
}

/** Chọn hoặc bỏ chọn tất cả mode */
function selectAllModes(val) {
  ['tt500', 'do'].forEach(m => {
    selectedModes[m] = val;
    const card  = document.getElementById('mode-card-' + m);
    const check = document.getElementById('mode-check-' + m);
    if (val) {
      card.classList.add('selected');
      check.innerHTML = '<i class="fa-solid fa-check" style="font-size:11px;"></i>';
    } else {
      card.classList.remove('selected');
      check.innerHTML = '';
    }
  });
}

/** Cập nhật số lượng phiếu hiển thị trong từng mode card */
function updateModeBadges() {
  const doTotal = modeCounts.do9 + modeCounts.do8 + modeCounts.do7;
  document.getElementById('mode-badge-tt500').textContent = modeCounts.tt500 + ' phiếu';
  document.getElementById('mode-badge-do').textContent    = doTotal + ' phiếu';
}

// ================================================================
// PHÂN LOẠI ROW (có cache để tối ưu performance)
// ================================================================

/** Ngưỡng (ngày) để coi TT505 là "tồn quá lâu" và đưa vào cảnh báo DO */
var TT505_EXPIRED_DAYS = 3;

/**
 * Cache kết quả classifyRow() — dùng WeakMap để tự GC khi row bị xóa.
 * Tránh gọi classifyRow() 5-10 lần/row trên cùng dữ liệu (render, modal, upload).
 */
var _classifyCache = new WeakMap();

/** Xóa cache phân loại (gọi khi upload file mới hoặc reset) */
function clearClassifyCache() {
  _classifyCache = new WeakMap();
}

/**
 * Parse giá trị thời gian từ Excel sang Date.
 * Hỗ trợ: serial number (Excel date), chuỗi dd/mm/yyyy[ HH:MM[:SS]], ISO.
 * @returns {Date|null}
 */
function parseExcelDateTime(raw) {
  if (raw == null || raw === '') return null;
  // Excel serial date (number)
  if (typeof raw === 'number' && typeof XLSX !== 'undefined' && XLSX.SSF) {
    const o = XLSX.SSF.parse_date_code(raw);
    if (o) return new Date(o.y, o.m - 1, o.d, o.H || 0, o.M || 0, o.S || 0);
  }
  const s = String(raw).trim();
  // dd/mm/yyyy hoặc dd/mm/yyyy HH:MM[:SS]
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m) {
    const dt = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return isNaN(dt.getTime()) ? null : dt;
  }
  // Fallback: thử parse mặc định (ISO, yyyy-mm-dd...)
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Kiểm tra phiếu TT505 đã quá N ngày không tác động
 * So sánh TIME_TAC_DONG với thời điểm hiện tại
 * @returns {boolean}
 */
function is505Expired(r) {
  const tt = Number(r['TRANG_THAI']);
  if (tt !== 505) return false;
  const raw = r['TIME_TAC_DONG'];
  if (!raw) return true; // Không có TIME_TAC_DONG → coi như quá hạn
  const d = parseExcelDateTime(raw);
  if (!d) return true; // Không parse được → coi như quá hạn
  const diffMs = Date.now() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > TT505_EXPIRED_DAYS;
}

/**
 * Phân loại một hàng dữ liệu Excel thuộc nhóm nào (có cache)
 * - TT500: TRANG_THAI = 500
 * - DO_9:  DG_MOC_LM thuộc nhóm DO9 VÀ TRANG_THAI thuộc {500, 506, 507, 508}
 *          HOẶC TRANG_THAI = 505 quá 3 ngày không tác động
 * - DO_8:  DG_MOC_LM thuộc nhóm DO8 VÀ (tương tự)
 * - DO_7:  DG_MOC_LM thuộc nhóm DO7 VÀ (tương tự)
 * @returns {{ isTT500, isDO9, isDO8, isDO7, is505Expired }}
 */
function classifyRow(r) {
  // Kiểm tra cache trước — tránh tính lại nhiều lần cho cùng row object
  if (_classifyCache.has(r)) return _classifyCache.get(r);

  const tt = Number(r['TRANG_THAI']);
  const dg = String(r['DG_MOC_LM'] || '').trim().toUpperCase().replace(/[\s_\-]+/g, '');
  const isDOStatus = (tt === 500 || tt === 506 || tt === 507 || tt === 508);
  const expired505 = is505Expired(r);
  const isDOEligible = isDOStatus || expired505;
  const result = {
    isTT500:      tt === 500,
    isDO9:        dg === 'DO9' && isDOEligible,
    isDO8:        dg === 'DO8' && isDOEligible,
    isDO7:        dg === 'DO7' && isDOEligible,
    is505Expired: expired505,
  };

  // Lưu vào cache
  _classifyCache.set(r, result);
  return result;
}
