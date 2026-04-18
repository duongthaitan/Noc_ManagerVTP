/**
 * upload.js — Section B: Upload & xử lý file Excel
 * Phụ thuộc: state.js, utils.js, buuta.js, render.js
 */

// ================================================================
// DRAG & DROP HANDLERS
// ================================================================
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('dragover');
}
function handleDragLeave(e) {
  document.getElementById('upload-zone').classList.remove('dragover');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}
function handleFileChange(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

// ================================================================
// PROCESS FILE — đọc Excel, lọc TT500, nhóm theo bưu tá
// ================================================================
function processFile(file) {
  if (!file.name.endsWith('.xlsx')) {
    showToast('⚠️ Vui lòng chọn file .xlsx');
    return;
  }

  document.getElementById('upload-zone').style.display = 'none';
  document.getElementById('spinner-wrap').style.display = 'flex';

  const reader = new FileReader();
  reader.onload = function(e) {
    setTimeout(() => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // Bỏ qua row 0 (header phụ), lấy từ row 1 làm tên cột thực
        const raw = XLSX.utils.sheet_to_json(ws, { range: 1, defval: '' });

        // Lọc TRANG_THAI == 500
        const filtered = raw.filter(r => {
          const tt = r['TRANG_THAI'];
          return tt == 500 || tt === '500' || Number(tt) === 500;
        });

        document.getElementById('spinner-wrap').style.display = 'none';

        if (filtered.length === 0) {
          document.getElementById('results-body').innerHTML = `
            <div class="empty-state">
              <div class="big-icon">✅</div>
              <div style="font-size:17px;font-weight:700;color:var(--green);margin-bottom:6px;">
                Không tìm thấy phiếu tồn phát
              </div>
              <div class="text-gray">Tất cả phiếu gửi đang trong trạng thái bình thường.</div>
            </div>`;
          document.getElementById('section-results').style.display = 'block';
          document.getElementById('section-stats').style.display = 'none';
        } else {
          // Nhóm theo BUU_TA_PHAT
          const groups = {};
          filtered.forEach(row => {
            const key = (row['BUU_TA_PHAT'] || '').trim();
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
          });

          // Sắp xếp A → Z
          const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'vi'));
          AppState.groupedData = sortedKeys.map(k => ({
            rawName: k,
            parsedName: parseBuutaName(k),
            parsedPhone: parseBuutaPhone(k),
            rows: groups[k]
          }));

          // Đồng bộ bảng cấu hình bưu tá từ file
          syncBuutaFromFile(AppState.groupedData);
          matchAndRender();
        }

        // Hiện nút reset
        document.getElementById('upload-reset').style.display = 'flex';
        document.getElementById('file-name-display').textContent = file.name;

      } catch (err) {
        document.getElementById('spinner-wrap').style.display = 'none';
        document.getElementById('upload-zone').style.display = 'block';
        showToast('❌ Lỗi đọc file: ' + err.message);
      }
    }, 300);
  };
  reader.readAsArrayBuffer(file);
}

// ================================================================
// RESET — trở về trạng thái ban đầu
// ================================================================
function resetUpload() {
  document.getElementById('upload-zone').style.display = 'block';
  document.getElementById('upload-reset').style.display = 'none';
  document.getElementById('file-input').value = '';
  document.getElementById('section-results').style.display = 'none';
  document.getElementById('section-stats').style.display = 'none';
  document.getElementById('file-name-display').textContent = '';
  AppState.groupedData = [];
  updateHeaderBadges(0, 0, 0);
}
