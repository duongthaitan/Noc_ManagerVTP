/**
 * modal.js — Modal gửi cảnh báo Zalo
 * Build tin nhắn, mở modal, switch tab bưu tá, copy & mở Zalo
 */

// ================================================================
// BUILD TIN NHẮN
// ================================================================

/**
 * Tạo nội dung tin nhắn cảnh báo cho một bưu tá
 * Tự động chọn template phù hợp (DO hoặc TT500 thuần)
 */
function buildMessage(groupName, rows) {
  const now   = new Date();
  const hhmm  = now.toTimeString().slice(0, 5);
  const date  = now.toLocaleDateString('vi-VN');

  const tt500rows = rows.filter(r => classifyRow(r).isTT500 && selectedModes.tt500);
  const do9rows   = rows.filter(r => classifyRow(r).isDO9   && selectedModes.do);
  const do8rows   = rows.filter(r => classifyRow(r).isDO8   && selectedModes.do);
  const do7rows   = rows.filter(r => classifyRow(r).isDO7   && selectedModes.do);

  const hasDO    = do9rows.length > 0 || do8rows.length > 0 || do7rows.length > 0;
  const hasTT500 = tt500rows.length > 0;

  // --- Template DO ---
  if (hasDO) {
    function doRowLine(icon, r) {
      const ma  = r['MA_PHIEUGUI'] || '';
      const cod = parseFloat(r['TIEN_COD']) || 0;
      const tqd = parseFloat(r['TG_QUYDINH'])  || 0;
      const ttt = parseFloat(r['TG_TT_LUYKE'])  || 0;
      const tt  = r['TRANG_THAI'];
      return `${icon} ${ma} | TT: ${tt} | COD: ${cod > 0 ? formatMoney(cod) + 'đ' : '0đ'} | ${ttt}h/${tqd}h`;
    }
    function tt500RowLine(r) {
      const ma     = r['MA_PHIEUGUI'] || '';
      const cod    = parseFloat(r['TIEN_COD']) || 0;
      const lp     = r['LAN_PHAT'];
      const tqd    = parseFloat(r['TG_QUYDINH'])  || 0;
      const ttt    = parseFloat(r['TG_TT_LUYKE'])  || 0;
      const status = ttt > tqd ? 'QUÁ HẠN' : 'ĐÚNG HẠN';
      const lpStr  = (lp === 0 || lp === '0' || lp === '') ? 'Chưa phát' : `Lần ${lp}`;
      return `- ${ma} | COD: ${cod > 0 ? formatMoney(cod) + 'đ' : '0đ'} | ${lpStr} | ${status}`;
    }

    const totalCount = new Set([
      ...tt500rows.map(r => r['MA_PHIEUGUI']),
      ...do9rows.map(r   => r['MA_PHIEUGUI']),
      ...do8rows.map(r   => r['MA_PHIEUGUI']),
      ...do7rows.map(r   => r['MA_PHIEUGUI']),
    ]).size;

    let body = '';
    if (hasTT500) {
      body += `⛔ TRẠNG THÁI 500 — Phiếu tồn phát (${tt500rows.length} phiếu):\n`;
      body += tt500rows.map(tt500RowLine).join('\n');
    }
    if (do9rows.length > 0) {
      if (body) body += '\n\n';
      body += `🔴 Nhóm DO_9 — Ưu tiên cao nhất (${do9rows.length} phiếu):\n`;
      body += do9rows.map(r => doRowLine('🔴', r)).join('\n');
    }
    if (do8rows.length > 0) {
      if (body) body += '\n\n';
      body += `🟠 Nhóm DO_8 — Xử lý sớm (${do8rows.length} phiếu):\n`;
      body += do8rows.map(r => doRowLine('🟠', r)).join('\n');
    }
    if (do7rows.length > 0) {
      if (body) body += '\n\n';
      body += `🟡 Nhóm DO_7 — Theo dõi (${do7rows.length} phiếu):\n`;
      body += do7rows.map(r => doRowLine('🟡', r)).join('\n');
    }

    return `⚠️ CẢNH BÁO ĐƠN HÀNG CẦN XỬ LÝ KHẨN\n\nXin chào anh/chị ${groupName},\n\nHệ thống ghi nhận anh/chị đang có ${totalCount} đơn hàng thuộc nhóm cảnh báo cần xử lý sớm:\n\n${body}\n\n📌 Vui lòng xử lý theo thứ tự ưu tiên DO_9 → DO_8 → DO_7.\n⏰ Thời gian báo cáo: ${hhmm} ${date}\n\nTrân trọng.`;
  }

  // --- Template TT500 thuần ---
  // Phân loại: TikTok/Shopee (mã VTPVN.../SHOPEEVTPVN...) hoặc Nội tỉnh (CTO) → nhóm đặc biệt
  function isSpecial(r) {
    const ma   = String(r['MA_PHIEUGUI'] || '').toUpperCase();
    const tinh = String(r['TINH_NHAN']   || '').trim().toUpperCase();
    return ma.startsWith('VTPVN') || ma.startsWith('SHOPEEVTPVN') || tinh === 'CTO';
  }

  const specialRows = tt500rows.filter(r =>  isSpecial(r));
  const normalRows  = tt500rows.filter(r => !isSpecial(r));

  function rowLine(r) {
    const ma  = r['MA_PHIEUGUI'] || '';
    const cod = parseFloat(r['TIEN_COD'])    || 0;
    const lp  = r['LAN_PHAT'];
    const tqd = parseFloat(r['TG_QUYDINH']) || 0;
    const ttt = parseFloat(r['TG_TT_LUYKE'])|| 0;
    const chuaPhat = (lp === 0 || lp === '0' || lp === '');
    const status   = ttt > tqd ? 'QUÁ HẠN' : 'ĐÚNG HẠN';

    // Ghép các phần bằng " | ", bỏ phần rỗng ở giữa
    const parts = [`- ${ma}`];
    parts.push(cod > 0 ? `COD: ${formatMoney(cod)}đ` : '');
    if (chuaPhat) parts.push('Chưa phát');
    parts.push(status);
    return parts.join(' | ');
  }

  let body = '';
  if (normalRows.length > 0) {
    body += `ĐƠN THƯỜNG\n` + normalRows.map(rowLine).join('\n');
  }
  if (specialRows.length > 0) {
    if (body) body += '\n\n';
    body += `⚡ TIKTOK - SHOPEE - NỘI TỈNH - CẦN TRẢ TRẠNG THÁI 500 SỚM\n`;
    body += specialRows.map(rowLine).join('\n');
    body += `\n\n⚠️ Các phiếu tiktok shopee và nội tỉnh CTO cần được xử lý TRẢ TT500 SỚM để đảm bảo chỉ tiêu nội tỉnh.`;
  }

  return `🚨 CẢNH BÁO TỒN PHÁT - TRẠNG THÁI 500\n\nBưu tá ${groupName}\n\n📦Tổng BIL TT500: ${tt500rows.length} bưu phẩm chưa xử lý:\n\n${body}\n\n📌 Vui lòng xử lý sớm để tránh ảnh hưởng chỉ tiêu.\n⏰ Thời gian báo cáo: ${hhmm} ${date}\n\nTrân trọng.`;
}

// ================================================================
// MỞ MODAL
// ================================================================

/** Mở modal cho 1 bưu tá cụ thể */
function openSingleModal(groupIdx) {
  const group = groupedData[groupIdx];
  if (!group) return;
  const matched = matchBuuta(group.parsedName, group.parsedPhone);
  const phone   = matched ? matched.phone : '';
  const name    = group.parsedName || group.rawName;
  if (!phone) showToast('⚠️ Chưa có số điện thoại, vui lòng thêm ở phần ⚙️ Cấu hình', 'warning');
  currentModalGroups = [{ name, phone, rows: group.rows }];
  currentModalIdx = 0;
  renderModal(false);
  openModal();
}

/** Mở modal cho tất cả bưu tá */
function openAllModal() {
  currentModalGroups = groupedData.map(g => {
    const matched = matchBuuta(g.parsedName, g.parsedPhone);
    return { name: g.parsedName || g.rawName, phone: matched ? matched.phone : '', rows: g.rows };
  });

  if (currentModalGroups.length === 0) {
    showToast('⚠️ Không có bưu tá nào.', 'warning');
    return;
  }
  const noPhone = currentModalGroups.filter(g => !g.phone).length;
  if (noPhone > 0) {
    showToast(`⚠️ Có ${noPhone} bưu tá chưa có SĐT — không thể gửi Zalo`, 'warning');
  }
  currentModalIdx = 0;
  renderModal(true);
  openModal();
}

// ================================================================
// RENDER MODAL
// ================================================================

function renderModal(multiTab) {
  const tabsEl = document.getElementById('modal-tabs');
  tabsEl.innerHTML = '';
  if (multiTab && currentModalGroups.length > 1) {
    currentModalGroups.forEach((g, i) => {
      const tab = document.createElement('button');
      tab.className = 'modal-tab' + (i === 0 ? ' active' : '') + (!g.phone ? ' no-phone' : '');
      tab.innerHTML = (!g.phone ? '<i class="fa-solid fa-circle-exclamation" style="color:#F59E0B;font-size:10px;"></i> ' : '') + escHtml(g.name);
      tab.onclick = () => switchTab(i);
      tabsEl.appendChild(tab);
    });
    tabsEl.style.display = 'flex';
  } else {
    tabsEl.style.display = 'none';
  }
  loadTabContent(currentModalIdx);
}

function switchTab(idx) {
  currentModalIdx = idx;
  document.querySelectorAll('.modal-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  loadTabContent(idx);
}

function loadTabContent(idx) {
  const group = currentModalGroups[idx];
  document.getElementById('modal-title').innerHTML =
    `<i class="fa-brands fa-rocketchat" style="color:var(--zalo);"></i> Gửi cảnh báo Zalo — ${escHtml(group.name)}`;
  document.getElementById('modal-textarea').value  = buildMessage(group.name, group.rows);
  document.getElementById('btn-open-zalo').disabled = !group.phone;
}

// ================================================================
// ACTIONS
// ================================================================

function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

function copyModal() {
  const ta = document.getElementById('modal-textarea');
  navigator.clipboard.writeText(ta.value)
    .then(() => showToast('✅ Đã copy nội dung vào clipboard!', 'success'))
    .catch(() => {
      ta.select();
      document.execCommand('copy');
      showToast('✅ Đã copy nội dung!', 'success');
    });
}

function openZalo() {
  const group = currentModalGroups[currentModalIdx];
  if (!group.phone) { showToast('⚠️ Bưu tá này chưa có số điện thoại', 'warning'); return; }
  window.open('https://zalo.me/' + group.phone, '_blank');
}
