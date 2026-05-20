// ZIP Worker — chạy JSZip ngoài main thread để UI không freeze
// Nhận: { type: 'zip', folderName, files: [{name, data}], useStore }
// Trả: { type: 'progress', percent } hoặc { type: 'done', blob } hoặc { type: 'error', message }
//
// Khi browser không hỗ trợ Worker, caller fallback chạy JSZip main thread.

importScripts('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');

self.onmessage = function(e) {
  var msg = e.data || {};
  if (msg.type !== 'zip') return;

  try {
    var zip = new JSZip();
    var folder = msg.folderName ? zip.folder(msg.folderName) : zip;

    (msg.files || []).forEach(function(f) {
      // f.data là ArrayBuffer (chuyển bằng transferable list để khỏi copy)
      folder.file(f.name, f.data);
    });

    var opts = msg.useStore
      ? { type: 'blob', compression: 'STORE' }
      : { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } };

    var lastPostedPct = -1;
    zip.generateAsync(opts, function(meta) {
      var pct = Math.round(meta.percent || 0);
      // Chỉ post message khi % thay đổi đáng kể (giảm noise)
      if (pct !== lastPostedPct) {
        lastPostedPct = pct;
        self.postMessage({ type: 'progress', percent: pct });
      }
    }).then(function(blob) {
      self.postMessage({ type: 'done', blob: blob });
    }).catch(function(err) {
      self.postMessage({ type: 'error', message: (err && err.message) || 'zip failed' });
    });
  } catch (e) {
    self.postMessage({ type: 'error', message: e.message || 'zip exception' });
  }
};
