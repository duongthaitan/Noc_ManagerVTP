/**
 * render.js — Section C & D: Render bảng kết quả + cập nhật thống kê
 * Phụ thuộc: state.js, utils.js, buuta.js
 */

// ================================================================
// MATCH & RENDER — nhóm theo bưu tá, render toàn bộ kết quả
// ================================================================
function matchAndRender() {
  const body = document.getElementById('results-body');
  body.innerHTML = '';

  let totalPhieu = 0;
  let totalQuahan = 0;
  let totalCod = 0;

  AppState.groupedData.forEach((group, idx) => {
    const matched = matchBuuta(group.parsedName, group.parsedPhone);
    const configPhone = matched ? matched.phone : '';
    const displayName = group.parsedName || group.rawName;
    const rows = group.rows;

    totalPhieu += rows.length;

    const card = document.createElement('div');
    card.className = 'group-card';

    const sent = matched && configPhone;

    card.innerHTML = `
      <div class="group-header">
        <div>
          <div class="group-name">👤 ${escHtml(displayName)}</div>
          ${configPhone
            ? `<div class="group-phone">📞 ${escHtml(configPhone)}</div>`
            : '<div class="group-phone" style="opacity:0.7">⚠️ Chưa có số điện thoại</div>'}
        </div>
        <div class="flex items-center gap-2" style="flex-wrap:wrap;">
          <span class="badge-count">${rows.length} phiếu</span>
          <button class="btn btn-zalo btn-sm" onclick="openSingleModal(${idx})">
            ${sent ? '📤' : '⚠️'} Gửi cảnh báo Zalo
          </button>
        </div>
      </div>
      <div class="group-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã phiếu gửi</th>
              <th>Hành trình</th>
              <th>Ngày gửi BP</th>
              <th>Lần phát</th>
              <th>Tiền COD</th>
              <th>TG quy định</th>
              <th>TG thực tế (lũy kế)</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>${rows.map(r => renderRow(r)).join('')}</tbody>
        </table>
      </div>
    `;

    body.appendChild(card);

    // Tích lũy thống kê
    rows.forEach(r => {
      const cod = parseFloat(r['TIEN_COD']) || 0;
      totalCod += cod;
      const tqd = parseFloat(r['TG_QUYDINH']) || 0;
      const ttt = parseFloat(r['TG_TT_LUYKE']) || 0;
      if (ttt > tqd) totalQuahan++;
    });
  });

  // Cập nhật tiêu đề kết quả
  const groupCount = AppState.groupedData.length;
  document.getElementById('results-title').textContent =
    `📋 KẾT QUẢ — ${totalPhieu} phiếu / ${groupCount} bưu tá`;
  document.getElementById('section-results').style.display = 'block';
  document.getElementById('section-stats').style.display = 'block';

  // Cập nhật thẻ thống kê
  document.getElementById('stat-total').textContent = totalPhieu;
  document.getElementById('stat-buuta').textContent = groupCount;
  document.getElementById('stat-quahan').textContent = totalQuahan;
  document.getElementById('stat-cod').textContent = formatMoney(totalCod) + 'đ';

  // Cập nhật header badges
  updateHeaderBadges(totalPhieu, groupCount, totalQuahan);
}

// ================================================================
// RENDER ROW — render một dòng phiếu
// Hỗ trợ badge nội tỉnh (TINH_NHAN = CTO)
// ================================================================
function renderRow(r) {
  const ma = r['MA_PHIEUGUI'] || '';
  const huyen_nhan = r['TEN_HUYEN_NHAN'] || '';
  const huyen_phat = r['TEN_HUYEN_PHAT'] || '';
  const tinh_nhan = (r['TINH_NHAN'] || '').trim().toUpperCase();
  const ngay_gui = formatDate(r['NGAY_GUI_BP'] || r['TIME_PCP'] || '');
  const lan_phat = r['LAN_PHAT'];
  const cod = parseFloat(r['TIEN_COD']) || 0;
  const tqd = parseFloat(r['TG_QUYDINH']) || 0;
  const ttt = parseFloat(r['TG_TT_LUYKE']) || 0;
  const isOverdue = ttt > tqd;
  const isNoiTinh = tinh_nhan === 'CTO';

  const lanPhatHtml = (lan_phat === 0 || lan_phat === '0' || lan_phat === '')
    ? '<span class="lan-phat-none">Chưa phát</span>'
    : `<strong>${lan_phat}</strong>`;

  const statusBadge = isOverdue
    ? '<span class="badge-overdue">🔴 QUÁ HẠN</span>'
    : '<span class="badge-ontime">🟢 ĐÚNG HẠN</span>';

  const noiTinhBadge = isNoiTinh
    ? '<span class="badge-noi-tinh">🏠 NỘI TỈNH</span>'
    : '';

  return `<tr class="${isNoiTinh ? 'row-noi-tinh' : ''}">
    <td><span class="ma-phieu">${escHtml(ma)}</span>${noiTinhBadge}</td>
    <td><span class="hanh-trinh">${escHtml(huyen_nhan)} → ${escHtml(huyen_phat)}</span></td>
    <td>${escHtml(ngay_gui)}</td>
    <td>${lanPhatHtml}</td>
    <td>${cod > 0 ? formatMoney(cod) + 'đ' : '—'}</td>
    <td>${tqd > 0 ? tqd + ' giờ' : '—'}</td>
    <td>${ttt > 0 ? ttt + ' giờ' : '—'}</td>
    <td>${statusBadge}</td>
  </tr>`;
}
