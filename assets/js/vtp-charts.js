/**
 * vtp-charts.js — Lớp biểu đồ dùng chung (Apache ECharts)
 * ------------------------------------------------------------------
 * Mục tiêu: biểu đồ trực quan, đẹp, đồng nhất thương hiệu ViettelPost
 * cho mọi report. Thay thế Chart.js bằng ECharts (gradient, shadow,
 * animation mượt, tooltip giàu thông tin, toolbox lưu ảnh / data view).
 *
 * Ràng buộc dự án: KHÔNG bundler, chạy cả Electron offline lẫn Vercel.
 * → ECharts được vendor local tại assets/library/js/echarts.min.js,
 *   nạp bằng <script> trước file này. Mọi thứ là global (window.VTPCharts).
 *
 * API chính:
 *   VTPCharts.render(domId, option, cfg)  → tạo/instance + setOption, trả instance
 *   VTPCharts.dispose(inst)               → huỷ instance an toàn
 *   VTPCharts.toBlob(inst, cb)            → PNG Blob (cho QR/share upload)
 *   VTPCharts.download(inst, filename)    → tải PNG về máy
 *   Helpers: grad(), labelStyle(), valueAxis(), categoryAxis(),
 *            tooltip(), toolbox(), statusColor()
 */
(function (global) {
  'use strict';

  if (typeof echarts === 'undefined') {
    console.error('[VTPCharts] echarts chưa được nạp — kiểm tra thứ tự <script>.');
  }

  var FONT = "'Be Vietnam Pro', system-ui, sans-serif";

  // Bảng màu thương hiệu — đỏ VTP làm chủ đạo, các màu phụ cho trạng thái.
  var PALETTE = {
    red: '#EE0033', redDark: '#C8002A', redSoft: '#FF5C7A',
    blue: '#2563EB', blueSoft: '#60A5FA',
    green: '#16A34A', greenSoft: '#4ADE80',
    amber: '#D97706', amberSoft: '#FBBF24',
    purple: '#7C3AED', purpleSoft: '#A78BFA',
    teal: '#0D9488', tealSoft: '#2DD4BF',
    slate: '#1F2937', gridLine: 'rgba(15,23,42,.07)', axisText: '#64748B'
  };

  // Registry để auto-resize mọi instance khi cửa sổ đổi kích thước.
  var _instances = [];
  var _resizeBound = false;
  function _bindResize() {
    if (_resizeBound) return;
    _resizeBound = true;
    var t = null;
    global.addEventListener('resize', function () {
      if (t) clearTimeout(t);
      t = setTimeout(function () {
        _instances.forEach(function (inst) {
          try { if (inst && !inst.isDisposed()) inst.resize(); } catch (_) {}
        });
      }, 120);
    });
  }

  /**
   * Tạo linear gradient cho cột/đường.
   * @param {string} from màu đậm (đáy/đầu)
   * @param {string} to   màu nhạt (đỉnh/cuối)
   * @param {boolean} horizontal true nếu cột ngang (gradient theo trục X)
   */
  function grad(from, to, horizontal) {
    var coords = horizontal ? [0, 0, 1, 0] : [0, 0, 0, 1];
    return new echarts.graphic.LinearGradient(
      coords[0], coords[1], coords[2], coords[3],
      [{ offset: 0, color: from }, { offset: 1, color: to }]
    );
  }

  /** Màu theo ngưỡng % — goodHigh=true: cao là tốt (xanh); false: cao là xấu (đỏ). */
  function statusColor(v, goodHigh) {
    v = Number(v) || 0;
    if (goodHigh === false) {
      // tỉ lệ hoàn: thấp = tốt
      if (v >= 10) return PALETTE.red;
      if (v >= 5)  return PALETTE.amber;
      return PALETTE.green;
    }
    // mặc định: cao = tốt
    if (v >= 85) return PALETTE.green;
    if (v >= 70) return PALETTE.amber;
    return PALETTE.red;
  }

  /** Style nhãn dữ liệu trên cột — đậm, dễ đọc, có nền mờ nhẹ. */
  function labelStyle(extra) {
    var base = {
      show: true,
      fontFamily: FONT,
      fontWeight: 700,
      fontSize: 11,
      color: PALETTE.slate
    };
    if (extra) for (var k in extra) base[k] = extra[k];
    return base;
  }

  /** Trục giá trị (số/%) với splitLine nét đứt nhạt. */
  function valueAxis(opts) {
    opts = opts || {};
    return {
      type: 'value',
      name: opts.name || '',
      nameTextStyle: { fontFamily: FONT, fontWeight: 700, fontSize: 12, color: PALETTE.axisText },
      max: opts.max,
      min: opts.min != null ? opts.min : 0,
      axisLabel: {
        fontFamily: FONT, fontSize: 11, color: PALETTE.axisText,
        formatter: opts.percent ? '{value}%' : undefined
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: PALETTE.gridLine, type: 'dashed' } }
    };
  }

  /** Trục danh mục (tên bưu tá/tuyến). */
  function categoryAxis(data, opts) {
    opts = opts || {};
    return {
      type: 'category',
      data: data,
      axisLabel: {
        fontFamily: FONT, fontSize: opts.fontSize || 11, color: PALETTE.slate,
        fontWeight: 600,
        interval: 0,
        rotate: opts.rotate || 0,
        width: opts.width,
        overflow: opts.width ? 'truncate' : undefined
      },
      axisLine: { lineStyle: { color: PALETTE.gridLine } },
      axisTick: { show: false },
      inverse: !!opts.inverse
    };
  }

  /** Tooltip dạng axis với con trỏ bóng mờ, bo góc, đổ bóng. */
  function tooltip(extra) {
    var base = {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(238,0,51,.06)' } },
      backgroundColor: 'rgba(255,255,255,.96)',
      borderColor: 'rgba(238,0,51,.18)',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { fontFamily: FONT, color: PALETTE.slate, fontSize: 13 },
      extraCssText: 'box-shadow:0 10px 30px rgba(15,23,42,.16);border-radius:12px;',
      confine: true
    };
    if (extra) for (var k in extra) base[k] = extra[k];
    return base;
  }

  /** Toolbox: lưu ảnh PNG nền trắng + xem dữ liệu thô + reset. */
  function toolbox(filename) {
    return {
      right: 12,
      top: 6,
      itemSize: 16,
      itemGap: 10,
      iconStyle: { borderColor: PALETTE.axisText },
      emphasis: { iconStyle: { borderColor: PALETTE.red } },
      feature: {
        saveAsImage: {
          name: filename || 'BieuDo_ViettelPost',
          title: 'Lưu ảnh',
          pixelRatio: 2,
          backgroundColor: '#ffffff'
        },
        dataView: {
          title: 'Xem dữ liệu',
          readOnly: true,
          lang: ['Dữ liệu biểu đồ', 'Đóng', '']
        },
        restore: { title: 'Khôi phục' }
      }
    };
  }

  /**
   * Tạo (hoặc tái dùng) instance ECharts trên #domId rồi setOption.
   * Tự dispose instance cũ gắn với dom đó, set chiều cao nếu truyền cfg.height.
   */
  function render(domId, option, cfg) {
    cfg = cfg || {};
    var dom = (typeof domId === 'string') ? document.getElementById(domId) : domId;
    if (!dom) { console.warn('[VTPCharts] không thấy dom', domId); return null; }

    if (cfg.height) dom.style.height = cfg.height + 'px';

    var prev = echarts.getInstanceByDom(dom);
    if (prev) {
      _instances = _instances.filter(function (i) { return i !== prev; });
      prev.dispose();
    }

    var inst = echarts.init(dom, null, { renderer: 'canvas' });

    // Áp các mặc định theme nếu option chưa khai báo.
    if (option.textStyle === undefined) option.textStyle = { fontFamily: FONT };
    if (option.animation === undefined) {
      option.animation = true;
      option.animationDuration = 850;
      option.animationEasing = 'cubicOut';
      option.animationDelay = function (idx) { return idx * 28; };
    }
    if (option.tooltip === undefined) option.tooltip = tooltip();
    if (option.toolbox === undefined && cfg.toolbox !== false) {
      option.toolbox = toolbox(cfg.filename);
    }

    inst.setOption(option, true);
    _instances.push(inst);
    _bindResize();
    // Resize 1 nhịp sau khi modal hoàn tất layout (tránh width=0).
    setTimeout(function () { try { if (!inst.isDisposed()) inst.resize(); } catch (_) {} }, 60);
    return inst;
  }

  function dispose(inst) {
    if (!inst) return;
    _instances = _instances.filter(function (i) { return i !== inst; });
    try { if (!inst.isDisposed()) inst.dispose(); } catch (_) {}
  }

  function _dataURLToBlob(dataURL) {
    var parts = String(dataURL).split(',');
    var mimeMatch = parts[0].match(/:(.*?);/);
    var mime = mimeMatch ? mimeMatch[1] : 'image/png';
    var bstr = atob(parts[1]);
    var n = bstr.length;
    var u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], { type: mime });
  }

  /** Lấy dataURL PNG nền trắng, pixelRatio 2 cho ảnh nét. */
  function dataURL(inst) {
    if (!inst || inst.isDisposed()) return null;
    return inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
  }

  /** Chuyển biểu đồ hiện tại thành PNG Blob (callback style, tương thích toBlob cũ). */
  function toBlob(inst, cb) {
    try {
      var url = dataURL(inst);
      if (!url) { cb(null); return; }
      cb(_dataURLToBlob(url));
    } catch (e) {
      console.warn('[VTPCharts] toBlob fail', e);
      cb(null);
    }
  }

  /** Tải PNG về máy. */
  function download(inst, filename) {
    var url = dataURL(inst);
    if (!url) return false;
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'BieuDo_ViettelPost.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  global.VTPCharts = {
    FONT: FONT,
    C: PALETTE,
    grad: grad,
    statusColor: statusColor,
    labelStyle: labelStyle,
    valueAxis: valueAxis,
    categoryAxis: categoryAxis,
    tooltip: tooltip,
    toolbox: toolbox,
    render: render,
    dispose: dispose,
    dataURL: dataURL,
    toBlob: toBlob,
    download: download
  };
})(window);
