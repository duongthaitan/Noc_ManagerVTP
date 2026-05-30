/**
 * upload.js — Xử lý upload file Excel
 * Drag & drop, FileReader, parse với SheetJS, đếm theo mode
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
// XỬ LÝ FILE
// ================================================================

/**
 * Đọc file Excel, parse dữ liệu, cập nhật state và giao diện
 */
function processFile(file) {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    showToast('⚠️ Vui lòng chọn file .xlsx', 'error');
    return;
  }

  document.getElementById('upload-zone').style.display  = 'none';
  document.getElementById('spinner-wrap').style.display = 'flex';

  const reader = new FileReader();
  reader.onload = function (e) {
    setTimeout(() => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb   = XLSX.read(data, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json(ws, { range: 1, defval: '' });

        // Lưu vào global state (xóa cache phân loại cũ)
        allRawRows = raw;
        clearClassifyCache();

        // Đếm theo mode (DO dựa trên DG_MOC_LM thuộc DO7/DO8/DO9 và TRANG_THAI thuộc {500,506,507,508})
        modeCounts.tt500 = raw.filter(r => classifyRow(r).isTT500).length;
        modeCounts.do9   = raw.filter(r => classifyRow(r).isDO9).length;
        modeCounts.do8   = raw.filter(r => classifyRow(r).isDO8).length;
        modeCounts.do7   = raw.filter(r => classifyRow(r).isDO7).length;

        document.getElementById('spinner-wrap').style.display = 'none';

        // Cập nhật badge số lượng trong panel chọn mode
        updateModeBadges();

        // Hiện panel chọn mode
        document.getElementById('section-mode-select').style.display = 'block';

        // Hiện thanh reset + tên file
        document.getElementById('upload-reset').style.display = 'flex';
        const chip = document.getElementById('file-name-display');
        chip.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${escHtml(file.name)}`;

        showToast(`✅ Đọc file thành công! ${raw.length} dòng dữ liệu.`, 'success');

        // Tự động render kết quả
        applyModesAndRender();

      } catch (err) {
        document.getElementById('spinner-wrap').style.display = 'none';
        document.getElementById('upload-zone').style.display  = 'block';
        showToast('❌ Lỗi đọc file: ' + err.message, 'error');
      }
    }, 350);
  };
  reader.readAsArrayBuffer(file);
}

// ================================================================
// RESET
// ================================================================

/** Đặt lại toàn bộ UI về trạng thái ban đầu */
function resetUpload() {
  document.getElementById('upload-zone').style.display         = 'block';
  document.getElementById('upload-reset').style.display        = 'none';
  document.getElementById('file-input').value                  = '';
  document.getElementById('section-results').style.display     = 'none';
  document.getElementById('section-stats').style.display       = 'none';
  document.getElementById('section-mode-select').style.display = 'none';
  document.getElementById('file-name-display').innerHTML       = '';

  // Reset state
  allRawRows  = [];
  groupedData = [];
  modeCounts  = { tt500: 0, do9: 0, do8: 0, do7: 0 };
  clearClassifyCache();
  updateHeaderBadges(0, 0, 0);
}
