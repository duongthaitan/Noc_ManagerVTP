/**
 * buuta.js — Quản lý danh sách bưu tá (Section A)
 * Phụ thuộc: state.js, utils.js
 */

// ================================================================
// LOAD — đọc từ localStorage khi khởi động
// ================================================================
function loadBuuta() {
  const saved = localStorage.getItem('buuta_list');
  const list = saved ? JSON.parse(saved) : [];
  const tbody = document.getElementById('buuta-tbody');
  tbody.innerHTML = '';
  list.forEach(bt => addBuutaRow(bt.name, bt.phone));
}

// ================================================================
// SYNC — đồng bộ bưu tá từ file Excel vào bảng cấu hình
// Bưu tá đã có → giữ nguyên (kể cả SĐT)
// Bưu tá mới từ file → thêm dòng trống SĐT
// ================================================================
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
    if (!alreadyIn) {
      addBuutaRow(name, g.parsedPhone || '');
      added++;
    }
  });

  // KHÔNG tự động lưu localStorage — người dùng phải bấm "💾 Lưu danh sách"
  if (added > 0) {
    showToast(`🔄 Đã đồng bộ ${added} bưu tá mới từ file! Nhấn 💾 Lưu để giữ lại.`);
  }
}

// ================================================================
// CRUD ROWS
// ================================================================
function addBuutaRow(name = '', phone = '') {
  const tbody = document.getElementById('buuta-tbody');
  const idx = tbody.rows.length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="stt-cell">${idx}</td>
    <td><input type="text" placeholder="Nhập tên bưu tá..." value="${escHtml(name)}"
         style="text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"></td>
    <td><input type="tel" placeholder="0xxxxxxxxx (10 số)" value="${escHtml(phone)}" maxlength="11"></td>
    <td class="del-cell"><button class="btn-icon" onclick="deleteRow(this)" title="Xóa">🗑️</button></td>
  `;
  tbody.appendChild(tr);
  updateStt();
}

function deleteRow(btn) {
  btn.closest('tr').remove();
  updateStt();
}

function updateStt() {
  document.querySelectorAll('#buuta-tbody tr').forEach((tr, i) => {
    tr.cells[0].textContent = i + 1;
  });
}

// ================================================================
// GET LIST — lấy dữ liệu hiện tại từ bảng DOM
// ================================================================
function getBuutaList() {
  return Array.from(document.querySelectorAll('#buuta-tbody tr')).map(tr => ({
    name: tr.cells[1].querySelector('input').value.trim().toUpperCase(),
    phone: tr.cells[2].querySelector('input').value.trim()
  })).filter(bt => bt.name);
}

// ================================================================
// SAVE — lưu vào localStorage, re-render nếu đã có dữ liệu
// ================================================================
function saveBuuta() {
  const list = getBuutaList();
  localStorage.setItem('buuta_list', JSON.stringify(list));
  showToast('💾 Đã lưu danh sách bưu tá!');
  if (AppState.groupedData.length > 0) {
    matchAndRender();
  }
}

// ================================================================
// PARSE — tách tên và SĐT từ chuỗi Excel
// VD: "LÊ HỮU NGOAN(84397262726)" → { name, phone }
// ================================================================
function parseBuutaName(raw) {
  const idx = raw.indexOf('(');
  return idx >= 0 ? raw.substring(0, idx).trim() : raw.trim();
}

function parseBuutaPhone(raw) {
  const m = raw.match(/\((\d+)\)/);
  if (!m) return '';
  let ph = m[1];
  if (ph.startsWith('84')) ph = '0' + ph.substring(2);
  return ph;
}

// ================================================================
// MATCH — tìm bưu tá trong config theo tên hoặc SĐT
// ================================================================
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
