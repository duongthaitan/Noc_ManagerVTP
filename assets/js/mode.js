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
// PHÂN LOẠI ROW
// ================================================================

/** Ngưỡng (ngày) để coi TT505 là "tồn quá lâu" và đưa vào cảnh báo DO */
var TT505_EXPIRED_DAYS = 3;

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
  const d = new Date(raw);
  if (isNaN(d.getTime())) return true; // Không parse được → coi như quá hạn
  const diffMs = Date.now() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > TT505_EXPIRED_DAYS;
}

/**
 * Phân loại một hàng dữ liệu Excel thuộc nhóm nào
 * - TT500: TRANG_THAI = 500
 * - DO_9:  DG_MOC_LM thuộc nhóm DO9 VÀ TRANG_THAI thuộc {500, 506, 507, 508}
 *          HOẶC TRANG_THAI = 505 quá 3 ngày không tác động
 * - DO_8:  DG_MOC_LM thuộc nhóm DO8 VÀ (tương tự)
 * - DO_7:  DG_MOC_LM thuộc nhóm DO7 VÀ (tương tự)
 * @returns {{ isTT500, isDO9, isDO8, isDO7, is505Expired }}
 */
function classifyRow(r) {
  const tt = Number(r['TRANG_THAI']);
  const dg = String(r['DG_MOC_LM'] || '').trim().toUpperCase().replace(/[\s_\-]+/g, '');
  const isDOStatus = (tt === 500 || tt === 506 || tt === 507 || tt === 508);
  const expired505 = is505Expired(r);
  const isDOEligible = isDOStatus || expired505;
  return {
    isTT500:      tt === 500,
    isDO9:        dg === 'DO9' && isDOEligible,
    isDO8:        dg === 'DO8' && isDOEligible,
    isDO7:        dg === 'DO7' && isDOEligible,
    is505Expired: expired505,
  };
}
