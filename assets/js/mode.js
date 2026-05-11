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

/**
 * Phân loại một hàng dữ liệu Excel thuộc nhóm nào
 * - TT500: TRANG_THAI = 500
 * - DO_9:  DG_MOC_LM thuộc nhóm DO9 VÀ TRANG_THAI thuộc {500, 506, 507, 508}
 * - DO_8:  DG_MOC_LM thuộc nhóm DO8 VÀ TRANG_THAI thuộc {500, 506, 507, 508}
 * - DO_7:  DG_MOC_LM thuộc nhóm DO7 VÀ TRANG_THAI thuộc {500, 506, 507, 508}
 * @returns {{ isTT500, isDO9, isDO8, isDO7 }}
 */
function classifyRow(r) {
  const tt = Number(r['TRANG_THAI']);
  const dg = String(r['DG_MOC_LM'] || '').trim().toUpperCase().replace(/[\s_\-]+/g, '');
  const isDOStatus = (tt === 500 || tt === 506 || tt === 507 || tt === 508);
  return {
    isTT500: tt === 500,
    isDO9:   dg === 'DO9' && isDOStatus,
    isDO8:   dg === 'DO8' && isDOStatus,
    isDO7:   dg === 'DO7' && isDOStatus,
  };
}
