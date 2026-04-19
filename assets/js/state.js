/**
 * state.js — Global application state
 * Tất cả biến dùng chung toàn app được khai báo tại đây
 */

// Dữ liệu thô từ Excel (chưa lọc)
let allRawRows = [];

// Dữ liệu đã nhóm theo bưu tá (dùng cho modal)
let groupedData = [];

// Modal state
let currentModalGroups = [];
let currentModalIdx    = 0;

// Tab đang active trong kết quả
let activeTab = 'all';

// Chế độ cảnh báo được chọn
let selectedModes = { tt500: true, do9: true, do8: true, do7: true };

// Số lượng phiếu theo từng mode (đếm từ file gốc)
let modeCounts = { tt500: 0, do9: 0, do8: 0, do7: 0 };

// Cache trạng thái render cuối cùng (để re-render khi đổi tab)
let _savedRenderState = null;
