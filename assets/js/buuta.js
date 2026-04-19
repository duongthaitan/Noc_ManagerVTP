/**
 * buuta.js — Quản lý danh sách Bưu tá
 * CRUD bưu tá, đồng bộ từ file Excel, lưu vào localStorage
 */

// ================================================================
// LOAD / SAVE / CLEAR
// ================================================================

/** Tải danh sách bưu tá từ localStorage khi khởi động */
function loadBuuta() {
  const saved = localStorage.getItem('buuta_list');
  const list  = saved ? JSON.parse(saved) : [];
  document.getElementById('buuta-tbody').innerHTML = '';
  list.forEach(bt => addBuutaRow(bt.name, bt.phone));
}

/** Lưu danh sách bưu tá hiện tại vào localStorage */
function saveBuuta() {
  const list = getBuutaList();
  localStorage.setItem('buuta_list', JSON.stringify(list));
  showToast('💾 Đã lưu danh sách bưu tá!', 'success');
  if (allRawRows.length > 0) applyModesAndRender();
}

/** Xóa toàn bộ danh sách bưu tá */
function clearBuuta() {
  if (!confirm('Xác nhận xóa toàn bộ danh sách bưu tá?')) return;
  document.getElementById('buuta-tbody').innerHTML = '';
  localStorage.removeItem('buuta_list');
  showToast('🗑️ Đã xóa toàn bộ danh sách bưu tá!', 'warning');
}

// ================================================================
// ĐỒNG BỘ TỪ FILE
// ================================================================

/**
 * Tự động thêm bưu tá mới từ dữ liệu Excel vào bảng
 * (chỉ thêm nếu chưa tồn tại trong danh sách)
 */
function syncBuutaFromFile(groups) {
  const existing = getBuutaList();
  let added = 0;
  groups.forEach(g => {
    const name = g.parsedName.toUpperCase();
    if (!name) return;
    const alreadyIn = existing.some(bt =>
      bt.name.toLowerCase() === name.toLowerCase() ||
      (g.parsedPhone && bt.phone && bt.phone === g.parsedPhone)
    );
    if (!alreadyIn) { addBuutaRow(name, g.parsedPhone || ''); added++; }
  });
  if (added > 0)
    showToast(`🔄 Đã đồng bộ ${added} bưu tá mới từ file! Nhấn 💾 Lưu để giữ lại.`, 'info');
}

// ================================================================
// THÊM / XÓA HÀNG
// ================================================================

/** Thêm một hàng bưu tá vào bảng */
function addBuutaRow(name = '', phone = '') {
  const tbody = document.getElementById('buuta-tbody');
  const idx   = tbody.rows.length + 1;
  const tr    = document.createElement('tr');
  tr.innerHTML = `
    <td class="stt-cell">${idx}</td>
    <td><input type="text" placeholder="Nhập tên bưu tá..." value="${escHtml(name)}"
         style="text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"></td>
    <td><input type="tel"  placeholder="0xxxxxxxxx (10 số)" value="${escHtml(phone)}" maxlength="11"></td>
    <td class="del-cell">
      <button class="btn-icon" onclick="deleteRow(this)" title="Xóa hàng này">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </td>
  `;
  tbody.appendChild(tr);
  updateStt();
}

/** Xóa một hàng bưu tá */
function deleteRow(btn) { btn.closest('tr').remove(); updateStt(); }

/** Cập nhật lại cột số thứ tự */
function updateStt() {
  document.querySelectorAll('#buuta-tbody tr').forEach((tr, i) => {
    tr.cells[0].textContent = i + 1;
  });
}

// ================================================================
// ĐỌC DỮ LIỆU TỪ BẢNG
// ================================================================

/** Lấy toàn bộ danh sách bưu tá từ bảng DOM */
function getBuutaList() {
  return Array.from(document.querySelectorAll('#buuta-tbody tr'))
    .map(tr => ({
      name:  tr.cells[1].querySelector('input').value.trim().toUpperCase(),
      phone: tr.cells[2].querySelector('input').value.trim(),
    }))
    .filter(bt => bt.name);
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
