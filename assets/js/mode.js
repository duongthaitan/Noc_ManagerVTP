/**
 * mode.js — Chọn chế độ cảnh báo & phân loại hàng
 * Toggle mode cards, cập nhật badge, classify từng row Excel
 */

// ================================================================
// MODE CARD TOGGLE
// ================================================================

/** Toggle chọn/bỏ chọn một mode */
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
  ['tt500', 'do9', 'do8', 'do7'].forEach(m => {
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
  document.getElementById('mode-badge-tt500').textContent = modeCounts.tt500 + ' phiếu';
  document.getElementById('mode-badge-do9').textContent   = modeCounts.do9   + ' phiếu';
  document.getElementById('mode-badge-do8').textContent   = modeCounts.do8   + ' phiếu';
  document.getElementById('mode-badge-do7').textContent   = modeCounts.do7   + ' phiếu';
}

// ================================================================
// PHÂN LOẠI ROW
// ================================================================

/**
 * Phân loại một hàng dữ liệu Excel thuộc nhóm nào
 * @returns {{ isTT500, isDO9, isDO8, isDO7 }}
 */
function classifyRow(r) {
  const tt = Number(r['TRANG_THAI']);
  const cb = String(r['LOAI_CANH_BAO'] || '').trim();
  return {
    isTT500: tt === 500,
    isDO9:   cb === 'DO_9',
    isDO8:   cb === 'DO_8',
    isDO7:   cb === 'DO_7',
  };
}
