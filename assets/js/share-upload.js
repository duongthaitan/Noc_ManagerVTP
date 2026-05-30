// Shared upload helper cho các trang report
// Cách dùng:
//   vtpUploadBlob(blob, 'BaoCao.png').then(function(shareUrl) {
//     // tạo QR với shareUrl
//   }).catch(function(errMsg) { /* show error */ });
//
// Strategy:
//   1. Browser PUT trực tiếp Filebin (CORS *) — nhanh nhất, không qua Vercel
//   2. Fallback /api/upload?format=text nếu Filebin direct fail (firewall, CORS)
// URL trả về luôn wrap qua /api/d để bypass landing "Heads up" khi quét QR.
(function(global) {
  'use strict';

  function safeName(name) {
    return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
  }
  function buildShareUrl(directUrl) {
    return location.origin + '/api/d?u=' + encodeURIComponent(directUrl);
  }
  function blobToFile(blob, filename) {
    if (typeof File === 'function') {
      try { return new File([blob], filename, { type: blob.type || 'application/octet-stream' }); }
      catch (_) {}
    }
    blob.name = filename;
    return blob;
  }

  function uploadFilebinDirect(blob, filename) {
    return new Promise(function(resolve, reject) {
      var binId = 'vtp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      var url = 'https://filebin.net/' + binId + '/' + encodeURIComponent(safeName(filename));
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.timeout = 120000;
      xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var obj = JSON.parse(xhr.responseText);
            if (obj && obj.bin && obj.file) {
              var direct = 'https://filebin.net/' + obj.bin.id + '/' + encodeURIComponent(obj.file.filename);
              resolve(buildShareUrl(direct));
              return;
            }
          } catch (_) {}
          reject('response không hợp lệ');
        } else {
          reject('HTTP ' + xhr.status);
        }
      };
      xhr.onerror = function() { reject('lỗi mạng'); };
      xhr.ontimeout = function() { reject('timeout'); };
      xhr.send(blob);
    });
  }

  function uploadViaProxy(blob, filename) {
    return new Promise(function(resolve, reject) {
      var fd = new FormData();
      fd.append('fileToUpload', blobToFile(blob, filename), filename);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.timeout = 120000;
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var obj = JSON.parse(xhr.responseText);
            if (obj && obj.url) { resolve(obj.url); return; }
          } catch (_) {}
          reject('response lạ');
        } else {
          reject('HTTP ' + xhr.status);
        }
      };
      xhr.onerror = function() { reject('lỗi mạng'); };
      xhr.ontimeout = function() { reject('timeout'); };
      xhr.send(fd);
    });
  }

  global.vtpUploadBlob = function(blob, filename) {
    // Thử direct trước (nhanh ~30-50%); fallback proxy nếu fail
    return uploadFilebinDirect(blob, filename).catch(function(directErr) {
      console.warn('[vtpUploadBlob] Filebin direct fail:', directErr, '→ thử /api/upload');
      return uploadViaProxy(blob, filename);
    });
  };

  // Race guard: khi user spam mở/đóng modal QR/Screenshot, nhiều upload song song
  // có thể fire .then() lệch nhau, ghi đè container của upload mới bằng QR cũ.
  // vtpUploadBlobScoped(blob, name, scope) sinh token mỗi lần gọi cùng scope —
  // callback nào không khớp token mới nhất sẽ throw 'cancelled' để caller silent.
  // Cách dùng:
  //   vtpUploadBlobScoped(blob, 'BieuDo.png', 'chart')
  //     .then(url => render QR)
  //     .catch(err => { if (err === 'cancelled') return; show error });
  var _scopeTokens = {};
  global.vtpUploadBlobScoped = function(blob, filename, scope) {
    scope = scope || 'default';
    var token = (_scopeTokens[scope] = (_scopeTokens[scope] || 0) + 1);
    return global.vtpUploadBlob(blob, filename).then(function(url) {
      if (token !== _scopeTokens[scope]) {
        throw 'cancelled';
      }
      return url;
    });
  };
})(window);
