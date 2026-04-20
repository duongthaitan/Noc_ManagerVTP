/**
 * render.js — Render kết quả và thống kê
 * Lọc dữ liệu, build tab bar (tt500 / do / all), render group cards, render rows, cập nhật stats
 */

// ================================================================
// APPLY MODES & RENDER (entry point)
// ================================================================

/**
 * Lọc dữ liệu theo selectedModes {tt500, do},
 * build tab bar, render kết quả, cập nhật stats
 */
function applyModesAndRender() {
  const rowsForTab = { tt500: [], do: [], all: [] };
  const seenForAll = new Set();

  allRawRows.forEach((r, idx) => {
    const c = classifyRow(r);
    let included = false;
    if (selectedModes.tt500 && c.isTT500)                       { rowsForTab.tt500.push({ row: r, cls: c }); included = true; }
    if (selectedModes.do   && (c.isDO9 || c.isDO8 || c.isDO7)) { rowsForTab.do.push(  { row: r, cls: c }); included = true; }
    if (included && !seenForAll.has(idx)) { rowsForTab.all.push({ row: r, cls: c }); seenForAll.add(idx); }
  });

  const activeModes = ['tt500', 'do'].filter(m => selectedModes[m] && rowsForTab[m].length > 0);

  // --- Empty state ---
  if (rowsForTab.all.length === 0) {
    document.getElementById('results-body').innerHTML = `
      <div class="empty-state fade-in-up">
        <div class="big-icon">✅</div>
        <div class="empty-title">Không có phiếu nào phù hợp</div>
        <div class="empty-sub text-gray">Vui lòng chọn ít nhất một loại cảnh báo hoặc dữ liệu không tồn tại.</div>
      </div>`;
    document.getElementById('section-results').style.display = 'block';
    document.getElementById('section-stats').style.display   = 'none';
    document.getElementById('result-tab-bar').style.display  = 'none';
    return;
  }

  // --- Group theo bưu tá ---
  const groupMap = {};
  rowsForTab.all.forEach(({ row, cls }) => {
    const key = (row['BUU_TA_PHAT'] || '').trim();
    if (!groupMap[key]) groupMap[key] = { tt500: [], do: [], all: [] };
    if (cls.isTT500 && selectedModes.tt500)                       groupMap[key].tt500.push(row);
    if ((cls.isDO9 || cls.isDO8 || cls.isDO7) && selectedModes.do) groupMap[key].do.push(row);
    groupMap[key].all.push({ row, cls });
  });

  const sortedKeys = Object.keys(groupMap).sort((a, b) => a.localeCompare(b, 'vi'));
  groupedData = sortedKeys.map(k => ({
    rawName:     k,
    parsedName:  parseBuutaName(k),
    parsedPhone: parseBuutaPhone(k),
    groups: groupMap[k],
    rows: groupMap[k].all.map(x => x.row),
  }));

  syncBuutaFromFile(groupedData);

  // --- Tab bar ---
  const showTabs = activeModes.length > 1;
  const tabBar   = document.getElementById('result-tab-bar');
  tabBar.innerHTML = '';

  if (showTabs) {
    tabBar.style.display = 'flex';
    const tabDefs = [
      { id: 'tt500', label: 'TT 500',      colorClass: 'active-tt500', icon: 'fa-box-open' },
      { id: 'do',    label: 'Cảnh báo DO', colorClass: 'active-do',    icon: 'fa-triangle-exclamation' },
      { id: 'all',   label: 'Tất cả',      colorClass: 'active-all',   icon: 'fa-layer-group' },
    ];
    tabDefs.forEach(td => {
      if (td.id !== 'all' && (!selectedModes[td.id] || rowsForTab[td.id].length === 0)) return;
      const count = td.id === 'all' ? rowsForTab.all.length : rowsForTab[td.id].length;
      const btn   = document.createElement('button');
      btn.className        = 'result-tab' + (activeTab === td.id ? ' ' + td.colorClass : '');
      btn.dataset.tab        = td.id;
      btn.dataset.colorClass = td.colorClass;
      btn.innerHTML = `<i class="fa-solid ${td.icon}" style="font-size:12px;"></i>${td.label}<span class="tab-count">${count}</span>`;
      btn.onclick = () => switchResultTab(td.id);
      tabBar.appendChild(btn);
    });
  } else {
    tabBar.style.display = 'none';
    activeTab = activeModes[0] || 'all';
  }

  renderResultsForTab(activeTab, groupMap, sortedKeys, rowsForTab, showTabs);
  updateStats(rowsForTab, groupedData);

  document.getElementById('results-title').innerHTML =
    `<i class="fa-solid fa-clipboard-list"></i> KẾT QUẢ — <strong>${rowsForTab.all.length}</strong> phiếu / <strong>${sortedKeys.length}</strong> bưu tá`;
  document.getElementById('section-results').style.display = 'block';
  document.getElementById('section-stats').style.display   = 'block';
}

// ================================================================
// SWITCH TAB
// ================================================================

function switchResultTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.result-tab').forEach(btn => {
    btn.classList.remove('active-tt500', 'active-do', 'active-all');
    if (btn.dataset.tab === tab) btn.classList.add(btn.dataset.colorClass);
  });
  applyModesAndRenderFromSaved();
}

function applyModesAndRenderFromSaved() {
  if (!_savedRenderState) return;
  const { groupMap, sortedKeys, rowsForTab, showTabs } = _savedRenderState;
  renderResultsForTab(activeTab, groupMap, sortedKeys, rowsForTab, showTabs);
}

// ================================================================
// RENDER GROUP CARDS
// ================================================================

function renderResultsForTab(tab, groupMap, sortedKeys, rowsForTab, showTabs) {
  _savedRenderState = { tab, groupMap, sortedKeys, rowsForTab, showTabs };
  const body = document.getElementById('results-body');
  body.innerHTML = '';

  sortedKeys.forEach((key, gIdx) => {
    const gm = groupMap[key];
    const parsedName  = parseBuutaName(key);
    const parsedPhone = parseBuutaPhone(key);
    const matched     = matchBuuta(parsedName, parsedPhone);
    const configPhone = matched ? matched.phone : '';
    const displayName = parsedName || key;

    // Lấy rows cho tab hiện tại
    let tabRows = [];
    if (tab === 'tt500') {
      tabRows = gm.tt500;
    } else if (tab === 'do') {
      // Sắp xếp theo mức độ ưu tiên: DO_9 → DO_8 → DO_7
      tabRows = [
        ...gm.do.filter(r => classifyRow(r).isDO9),
        ...gm.do.filter(r => classifyRow(r).isDO8),
        ...gm.do.filter(r => classifyRow(r).isDO7),
      ];
    } else {
      tabRows = gm.all.map(x => x.row);
    }
    if (tabRows.length === 0) return;

    const showLevelCol  = tab !== 'tt500';
    const showStatusCol = tab !== 'tt500';

    const card = document.createElement('div');
    card.className = 'group-card fade-in-up';

    // Badges tóm tắt mức cảnh báo ở header group
    const tt500c = gm.tt500.length;
    const do9c   = gm.do.filter(r => classifyRow(r).isDO9).length;
    const do8c   = gm.do.filter(r => classifyRow(r).isDO8).length;
    const do7c   = gm.do.filter(r => classifyRow(r).isDO7).length;
    let levelBadgesHtml = '';
    if (selectedModes.tt500 && tt500c > 0) levelBadgesHtml += `<span class="badge-level badge-tt500">TT500: ${tt500c}</span>`;
    if (selectedModes.do    && do9c   > 0) levelBadgesHtml += `<span class="badge-level badge-do9">🔴 DO9: ${do9c}</span>`;
    if (selectedModes.do    && do8c   > 0) levelBadgesHtml += `<span class="badge-level badge-do8">🟠 DO8: ${do8c}</span>`;
    if (selectedModes.do    && do7c   > 0) levelBadgesHtml += `<span class="badge-level badge-do7">🟡 DO7: ${do7c}</span>`;

    card.innerHTML = `
      <div class="group-header">
        <div class="group-info">
          <div class="group-name"><i class="fa-solid fa-user-tie"></i> ${escHtml(displayName)}</div>
          ${configPhone
            ? `<div class="group-phone"><i class="fa-solid fa-mobile-screen"></i> ${escHtml(configPhone)}</div>`
            : `<div class="group-phone missing"><i class="fa-solid fa-circle-xmark"></i> Chưa có số điện thoại</div>`}
        </div>
        <div class="group-actions">
          ${levelBadgesHtml}
          <span class="badge-count">${tabRows.length} phiếu</span>
          <button class="btn btn-zalo btn-sm" onclick="openSingleModal(${gIdx}); addRipple(event)">
            <i class="fa-brands fa-rocketchat"></i> ${configPhone ? 'Gửi cảnh báo' : 'Xem tin nhắn'}
          </button>
        </div>
      </div>
      <div class="group-table-wrap">
        <table class="data-table">
          <thead><tr>
            <th><i class="fa-solid fa-barcode"          style="margin-right:4px;opacity:.7;"></i>Mã phiếu gửi</th>
            <th><i class="fa-solid fa-route"            style="margin-right:4px;opacity:.7;"></i>Hành trình</th>
            <th><i class="fa-solid fa-calendar-day"     style="margin-right:4px;opacity:.7;"></i>Ngày gửi BP</th>
            <th><i class="fa-solid fa-rotate"           style="margin-right:4px;opacity:.7;"></i>Lần phát</th>
            <th><i class="fa-solid fa-coins"            style="margin-right:4px;opacity:.7;"></i>Tiền COD</th>
            <th><i class="fa-solid fa-clock"            style="margin-right:4px;opacity:.7;"></i>TG quy định</th>
            <th><i class="fa-solid fa-hourglass-half"   style="margin-right:4px;opacity:.7;"></i>TG thực tế</th>
            ${showLevelCol  ? '<th><i class="fa-solid fa-layer-group" style="margin-right:4px;opacity:.7;"></i>Mức cảnh báo</th>' : ''}
            ${showStatusCol ? '<th><i class="fa-solid fa-tag"         style="margin-right:4px;opacity:.7;"></i>Trạng thái</th>' : ''}
            <th><i class="fa-solid fa-circle-dot"       style="margin-right:4px;opacity:.7;"></i>Tình trạng</th>
          </tr></thead>
          <tbody>${tabRows.map(r => renderRow(r, tab, showLevelCol, showStatusCol)).join('')}</tbody>
        </table>
      </div>`;
    body.appendChild(card);
  });
}

// ================================================================
// RENDER MỘT HÀNG DỮ LIỆU
// ================================================================

function renderRow(r, tab, showLevelCol, showStatusCol) {
  const cls        = classifyRow(r);
  const ma         = r['MA_PHIEUGUI'] || '';
  const huyen_nhan = r['TEN_HUYEN_NHAN'] || '';
  const huyen_phat = r['TEN_HUYEN_PHAT'] || '';
  const tinh_nhan  = (r['TINH_NHAN'] || '').trim().toUpperCase();
  const ngay_gui   = formatDate(r['NGAY_GUI_BP'] || r['TIME_PCP'] || '');
  const lan_phat   = r['LAN_PHAT'];
  const cod        = parseFloat(r['TIEN_COD']) || 0;
  const tqd        = parseFloat(r['TG_QUYDINH'])  || 0;
  const ttt        = parseFloat(r['TG_TT_LUYKE'])  || 0;
  const trangThai  = r['TRANG_THAI'];
  const isOverdue  = ttt > tqd;
  const isNoiTinh  = tinh_nhan === 'CTO';

  const lanPhatHtml = (lan_phat === 0 || lan_phat === '0' || lan_phat === '')
    ? '<span class="lan-phat-none">Chưa phát</span>'
    : `<strong>${lan_phat}</strong>`;

  const statusBadge = isOverdue
    ? '<span class="badge-overdue"><i class="fa-solid fa-circle-xmark"></i> QUÁ HẠN</span>'
    : '<span class="badge-ontime"><i class="fa-solid fa-circle-check"></i> ĐÚNG HẠN</span>';

  const noiTinhBadge = isNoiTinh
    ? '<span class="badge-noi-tinh"><i class="fa-solid fa-house"></i> NỘI TỈNH</span>' : '';

  // Level badge & row highlight class
  let levelBadgesHtml = '';
  let rowClass = isNoiTinh ? 'row-noi-tinh' : '';

  if (tab === 'all') {
    if (cls.isTT500 && selectedModes.tt500) levelBadgesHtml += '<span class="badge-level badge-tt500">TT500</span> ';
    if (cls.isDO9   && selectedModes.do)    levelBadgesHtml += '<span class="badge-level badge-do9">🔴 DO_9</span> ';
    if (cls.isDO8   && selectedModes.do)    levelBadgesHtml += '<span class="badge-level badge-do8">🟠 DO_8</span> ';
    if (cls.isDO7   && selectedModes.do)    levelBadgesHtml += '<span class="badge-level badge-do7">🟡 DO_7</span> ';
    if      (cls.isDO9 && selectedModes.do) rowClass = (rowClass ? rowClass + ' ' : '') + 'row-do9';
    else if (cls.isDO8 && selectedModes.do) rowClass = (rowClass ? rowClass + ' ' : '') + 'row-do8';
    else if (cls.isDO7 && selectedModes.do) rowClass = (rowClass ? rowClass + ' ' : '') + 'row-do7';
  } else if (tab === 'do') {
    if      (cls.isDO9) { levelBadgesHtml = '<span class="badge-level badge-do9">🔴 DO_9</span>'; rowClass = (rowClass ? rowClass + ' ' : '') + 'row-do9'; }
    else if (cls.isDO8) { levelBadgesHtml = '<span class="badge-level badge-do8">🟠 DO_8</span>'; rowClass = (rowClass ? rowClass + ' ' : '') + 'row-do8'; }
    else if (cls.isDO7) { levelBadgesHtml = '<span class="badge-level badge-do7">🟡 DO_7</span>'; rowClass = (rowClass ? rowClass + ' ' : '') + 'row-do7'; }
  }

  return `<tr class="${rowClass}">
    <td><span class="ma-phieu">${escHtml(ma)}</span>${noiTinhBadge}</td>
    <td><span class="hanh-trinh">${escHtml(huyen_nhan)} → ${escHtml(huyen_phat)}</span></td>
    <td>${escHtml(ngay_gui)}</td>
    <td>${lanPhatHtml}</td>
    <td>${cod > 0 ? formatMoney(cod) + 'đ' : '—'}</td>
    <td>${tqd > 0 ? tqd + ' giờ' : '—'}</td>
    <td>${ttt > 0 ? ttt + ' giờ' : '—'}</td>
    ${showLevelCol  ? `<td>${levelBadgesHtml || '<span class="badge-level badge-none">—</span>'}</td>` : ''}
    ${showStatusCol ? `<td><span style="font-weight:800;color:var(--text);">${escHtml(String(trangThai))}</span></td>` : ''}
    <td>${statusBadge}</td>
  </tr>`;
}

// ================================================================
// CẬP NHẬT THỐNG KÊ
// ================================================================

function updateStats(rowsForTab, groups) {
  const tt500Rows = rowsForTab.tt500;
  const codTT500  = tt500Rows.reduce((s, { row }) => s + (parseFloat(row['TIEN_COD']) || 0), 0);
  const quaHan    = rowsForTab.all.filter(({ row }) => {
    const tqd = parseFloat(row['TG_QUYDINH'])  || 0;
    const ttt = parseFloat(row['TG_TT_LUYKE']) || 0;
    return ttt > tqd;
  }).length;

  document.getElementById('stat-total-tt500').textContent = modeCounts.tt500;
  document.getElementById('stat-buuta').textContent       = groups.length;
  document.getElementById('stat-quahan').textContent      = quaHan;
  document.getElementById('stat-cod').textContent         = formatMoney(codTT500) + 'đ';

  // DO stats — giữ chi tiết do9/do8/do7 cho thống kê
  const doCodTotal = rowsForTab.do.reduce((s, { row }) => s + (parseFloat(row['TIEN_COD']) || 0), 0);
  document.getElementById('stat-do9').textContent    = modeCounts.do9;
  document.getElementById('stat-do8').textContent    = modeCounts.do8;
  document.getElementById('stat-do7').textContent    = modeCounts.do7;
  document.getElementById('stat-cod-do').textContent = formatMoney(doCodTotal) + 'đ';

  const hasAnyDO = selectedModes.do && (modeCounts.do9 > 0 || modeCounts.do8 > 0 || modeCounts.do7 > 0);
  document.getElementById('do-stats-row').style.display  = hasAnyDO ? 'grid' : 'none';
  document.getElementById('stat-card-do9').style.display = modeCounts.do9 > 0 ? 'flex' : 'none';
  document.getElementById('stat-card-do8').style.display = modeCounts.do8 > 0 ? 'flex' : 'none';
  document.getElementById('stat-card-do7').style.display = modeCounts.do7 > 0 ? 'flex' : 'none';

  const doTotal = modeCounts.do9 + modeCounts.do8 + modeCounts.do7;
  updateHeaderBadges(modeCounts.tt500, doTotal, quaHan);
}
