/**
 * modal.js — Modal gửi cảnh báo Zalo
 * Phụ thuộc: state.js, utils.js, buuta.js, render.js
 */

// ================================================================
// BUILD MESSAGE — tạo nội dung tin nhắn Zalo
// Tự động tách nội tỉnh (TINH_NHAN=CTO) thành section riêng
// ================================================================
function buildMessage(groupName, rows) {
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  const date = now.toLocaleDateString('vi-VN');

  // Phân loại phiếu nội tỉnh (TINH_NHAN = CTO) và liên tỉnh
  const noiTinhRows = rows.filter(r =>
    (r['TINH_NHAN'] || '').trim().toUpperCase() === 'CTO'
  );
  const bienTinhRows = rows.filter(r =>
    (r['TINH_NHAN'] || '').trim().toUpperCase() !== 'CTO'
  );

  function rowLine(r) {
    const ma = r['MA_PHIEUGUI'] || '';
    const cod = parseFloat(r['TIEN_COD']) || 0;
    const lp = r['LAN_PHAT'];
    const tqd = parseFloat(r['TG_QUYDINH']) || 0;
    const ttt = parseFloat(r['TG_TT_LUYKE']) || 0;
    const status = ttt > tqd ? 'QUÁ HẠN' : 'ĐÚNG HẠN';
    const lpStr = (lp === 0 || lp === '0' || lp === '') ? 'Chưa phát' : `Lần ${lp}`;
    return `- ${ma} | COD: ${cod > 0 ? formatMoney(cod) + 'đ' : '0đ'} | ${lpStr} | ${status}`;
  }

  let body = '';

  if (bienTinhRows.length > 0) {
    body += `📦 DANH SÁCH PHIẾU TỒN (${bienTinhRows.length} phiếu):\n`;
    body += bienTinhRows.map(rowLine).join('\n');
  }

  if (noiTinhRows.length > 0) {
    if (body) body += '\n\n';
    body += `⚡ NỘI TỈNH - CẦN TRẢ TRẠNG THÁI 500 SỚM (${noiTinhRows.length} phiếu):\n`;
    body += noiTinhRows.map(rowLine).join('\n');
    body += `\n\n⚠️ Các phiếu nội tỉnh CTO cần được xử lý TRẢ SỚM để đảm bảo chỉ tiêu nội tỉnh.`;
  }

  return `🚨 CẢNH BÁO TỒN PHÁT - TRẠNG THÁI 500

Xin chào anh/chị ${groupName},

Hiện tại anh/chị đang có ${rows.length} phiếu tồn phát chưa xử lý:

${body}

📌 Vui lòng xử lý sớm để tránh ảnh hưởng chỉ tiêu.
⏰ Thời gian báo cáo: ${hhmm} ${date}

Trân trọng.`;
}

// ================================================================
// OPEN SINGLE MODAL — mở modal cho 1 bưu tá (theo index)
// Dùng index thay vì string để tránh lỗi escaping onclick
// ================================================================
function openSingleModal(groupIdx) {
  const group = AppState.groupedData[groupIdx];
  if (!group) return;

  const matched = matchBuuta(group.parsedName, group.parsedPhone);
  const phone = matched ? matched.phone : '';
  const name = group.parsedName || group.rawName;

  if (!phone) {
    showToast('⚠️ Chưa có số điện thoại, vui lòng thêm ở phần ⚙️ Cấu hình');
    return;
  }

  AppState.currentModalGroups = [{ name, phone, rows: group.rows }];
  AppState.currentModalIdx = 0;
  renderModal(false);
  openModal();
}

// ================================================================
// OPEN ALL MODAL — mở modal dạng tab cho tất cả bưu tá có SĐT
// ================================================================
function openAllModal() {
  AppState.currentModalGroups = AppState.groupedData.map(g => {
    const matched = matchBuuta(g.parsedName, g.parsedPhone);
    return {
      name: g.parsedName || g.rawName,
      phone: matched ? matched.phone : '',
      rows: g.rows
    };
  }).filter(g => g.phone);

  if (AppState.currentModalGroups.length === 0) {
    showToast('⚠️ Không có bưu tá nào có số điện thoại. Vui lòng thêm ở phần ⚙️ Cấu hình');
    return;
  }

  AppState.currentModalIdx = 0;
  renderModal(true);
  openModal();
}

// ================================================================
// RENDER MODAL — build tabs + load nội dung tab đầu
// ================================================================
function renderModal(multiTab) {
  const tabsEl = document.getElementById('modal-tabs');
  tabsEl.innerHTML = '';

  if (multiTab && AppState.currentModalGroups.length > 1) {
    AppState.currentModalGroups.forEach((g, i) => {
      const tab = document.createElement('button');
      tab.className = 'modal-tab' + (i === 0 ? ' active' : '');
      tab.textContent = g.name;
      tab.onclick = () => switchTab(i);
      tabsEl.appendChild(tab);
    });
    tabsEl.style.display = 'flex';
  } else {
    tabsEl.style.display = 'none';
  }

  loadTabContent(AppState.currentModalIdx);
}

function switchTab(idx) {
  AppState.currentModalIdx = idx;
  document.querySelectorAll('.modal-tab').forEach((t, i) =>
    t.classList.toggle('active', i === idx)
  );
  loadTabContent(idx);
}

function loadTabContent(idx) {
  const group = AppState.currentModalGroups[idx];
  document.getElementById('modal-title').textContent =
    `📤 Gửi cảnh báo Zalo — ${group.name}`;
  document.getElementById('modal-textarea').value =
    buildMessage(group.name, group.rows);
  document.getElementById('btn-open-zalo').disabled = !group.phone;
}

// ================================================================
// OPEN / CLOSE MODAL
// ================================================================
function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}
function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

// ================================================================
// COPY & MỞ ZALO
// ================================================================
function copyModal() {
  const ta = document.getElementById('modal-textarea');
  navigator.clipboard.writeText(ta.value).then(() => {
    showToast('✅ Đã copy nội dung!');
  }).catch(() => {
    ta.select();
    document.execCommand('copy');
    showToast('✅ Đã copy nội dung!');
  });
}

function openZalo() {
  const group = AppState.currentModalGroups[AppState.currentModalIdx];
  if (!group.phone) {
    showToast('⚠️ Bưu tá này chưa có số điện thoại');
    return;
  }
  window.open('https://zalo.me/' + group.phone, '_blank');
}
