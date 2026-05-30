/**
 * common.js — Tiện ích dùng chung cho mọi report
 * Load trước mọi script khác để các file embedded có thể dùng escHtml/debounce
 * mà không cần định nghĩa lại trong từng <script>.
 *
 * Globals exposed:
 *   - escHtml(s)      → escape & < > " ' (đầy đủ, chống XSS qua attribute)
 *   - debounce(fn, ms) → trả về hàm hoãn fn trong ms (mặc định 200ms)
 */
(function (g) {
  'use strict';

  // Escape đầy đủ: bao gồm cả `"` và `'` để an toàn khi dùng trong attribute.
  // 6 file report cũ chỉ escape & < >, dễ vỡ DOM nếu Excel chứa dấu nháy.
  function escHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Debounce trailing-edge: gọi `fn` sau khi ngừng trigger `delay` ms.
  // Dùng cho search input để khỏi filter+render mỗi keystroke.
  function debounce(fn, delay) {
    var t = null;
    var d = (delay == null) ? 200 : delay;
    return function () {
      var ctx = this, args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, d);
    };
  }

  g.escHtml = escHtml;
  g.debounce = debounce;
})(window);
