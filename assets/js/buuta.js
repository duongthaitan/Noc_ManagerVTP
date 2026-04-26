/**
 * buuta.js — Quản lý danh sách Bưu tá
 * Lưu trữ trong localStorage (không cần bảng DOM nữa)
 */

// ================================================================
// IN-MEMORY STATE
// ================================================================

/** Danh sách bưu tá hiện tại [{name, phone}] */
var _buutaList = [];

// ================================================================
// LOAD / SAVE / CLEAR
// ================================================================

/** Tải danh sách bưu tá từ localStorage khi khởi động */
function loadBuuta() {
  const saved = localStorage.getItem('buuta_list');
  _buutaList = saved ? JSON.parse(saved) : [];
}

/** Lưu danh sách bưu tá hiện tại vào localStorage */
function saveBuuta() {
  localStorage.setItem('buuta_list', JSON.stringify(_buutaList));
  showToast('💾 Đã lưu danh sách bưu tá!', 'success');
  if (allRawRows.length > 0) applyModesAndRender();
}

/** Xóa toàn bộ danh sách bưu tá */
function clearBuuta() {
  if (!confirm('Xác nhận xóa toàn bộ danh sách bưu tá?')) return;
  _buutaList = [];
  localStorage.removeItem('buuta_list');
  showToast('🗑️ Đã xóa toàn bộ danh sách bưu tá!', 'warning');
}

// ================================================================
// ĐỒNG BỘ TỪ FILE
// ================================================================

/**
 * Tự động thêm bưu tá mới từ dữ liệu Excel vào danh sách
 * (chỉ thêm nếu chưa tồn tại trong danh sách)
 */
function syncBuutaFromFile(groups) {
  let added = 0;
  groups.forEach(g => {
    const name = g.parsedName.toUpperCase();
    if (!name) return;
    const alreadyIn = _buutaList.some(bt =>
      bt.name.toLowerCase() === name.toLowerCase() ||
      (g.parsedPhone && bt.phone && bt.phone === g.parsedPhone)
    );
    if (!alreadyIn) {
      _buutaList.push({ name: name, phone: g.parsedPhone || '' });
      added++;
    }
  });
  if (added > 0) {
    // Tự động lưu
    localStorage.setItem('buuta_list', JSON.stringify(_buutaList));
    showToast(`🔄 Đã đồng bộ ${added} bưu tá mới từ file!`, 'info');
  }
}

// ================================================================
// ĐỌC DỮ LIỆU
// ================================================================

/** Lấy toàn bộ danh sách bưu tá */
function getBuutaList() {
  return _buutaList.filter(bt => bt.name);
}

// ================================================================
// PARSE TÊN & SỐ ĐIỆN THOẠI
// ================================================================

/**
 * Tách tên bưu tá từ cột BUU_TA_PHAT
 * VD: "NGUYỄN VĂN A (0912345678)" → "NGUYỄN VĂN A"
 */
function parseBuutaName(raw) {
  const idx = raw.indexOf('(');
  return idx >= 0 ? raw.substring(0, idx).trim() : raw.trim();
}

/**
 * Tách số điện thoại từ cột BUU_TA_PHAT
 * VD: "NGUYỄN VĂN A (84912345678)" → "0912345678"
 */
function parseBuutaPhone(raw) {
  const m = raw.match(/\((\d+)\)/);
  if (!m) return '';
  let ph = m[1];
  if (ph.startsWith('84')) ph = '0' + ph.substring(2);
  return ph;
}

/**
 * Tìm bưu tá khớp (theo tên hoặc SĐT) trong danh sách cấu hình
 */
function matchBuuta(parsedName, parsedPhone) {
  const list = getBuutaList();
  const byName = list.find(bt =>
    bt.name.trim().toLowerCase() === parsedName.trim().toLowerCase()
  );
  if (byName) return byName;
  if (parsedPhone) {
    const byPhone = list.find(bt => bt.phone.trim() === parsedPhone.trim());
    if (byPhone) return byPhone;
  }
  return null;
}

// ================================================================
// UI HELPER
// ================================================================

/** Toggle collapse/expand cho section card */
function toggleCollapse(id) {
  document.getElementById(id).classList.toggle('collapsed');
}
