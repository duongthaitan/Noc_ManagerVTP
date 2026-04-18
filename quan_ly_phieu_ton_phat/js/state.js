/**
 * state.js — Global shared state
 * Tất cả các module đều đọc/ghi vào object này.
 */
const AppState = {
  groupedData: [],        // [{rawName, parsedName, parsedPhone, rows:[]}]
  currentModalGroups: [], // [{name, phone, rows:[]}]
  currentModalIdx: 0,
};
