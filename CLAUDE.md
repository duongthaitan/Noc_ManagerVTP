# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

Internal reporting dashboard for **ViettelPost HBCTVT** (Vietnamese postal/logistics ops). All UI text and code comments are in Vietnamese — preserve Vietnamese when editing user-facing strings.

Static frontend only — **no build step, no tests, no package scripts**. `package.json` exists solely to vendor `xlsx` into `node_modules` for offline reference; the runtime loads SheetJS from CDN. Deploys to Vercel (default static config; no `vercel.json`).

For local development just open the HTML files in a browser, or serve the directory with any static server (e.g. `npx serve`, `python -m http.server`).

## Architecture

The repo has **two coexisting architectures** — recognize which you're editing before making changes.

### 1. Hub + iframe shell (`index.html`)
The dashboard. Renders the sidebar/topbar/clock and loads each report tool inside `<iframe id="content-frame">` via `loadPage(url, navId, title)`. The iframe approach keeps each report fully isolated — they don't share JS state with the hub or each other.

### 2. Report tools (the seven `*.html` files)
Each report is a **self-contained single-file app** of 1000–1800 lines: embedded `<style>`, embedded `<script>`, drag-and-drop Excel upload, parsing via SheetJS, render to a table or Chart.js view, then export (Excel/PNG) or send Zalo messages. Six of the seven follow this pattern with all JS inlined.

**The exception**: [quan_ly_phieu_ton_phat.html](quan_ly_phieu_ton_phat.html) is the **only** page that uses the modular files in [assets/js/](assets/js/). It loads them as plain `<script>` tags in this order at the bottom of the body — **the order matters** because every file relies on globals declared earlier:

```
state.js  →  utils.js  →  buuta.js  →  mode.js  →  upload.js  →  render.js  →  modal.js  →  app.js
```

There are no ES modules, no bundler, no `import/export`. Everything is global functions and `let`/`var` at the top level. [assets/js/state.js](assets/js/state.js) is the canonical place where shared mutable state lives (`allRawRows`, `groupedData`, `selectedModes`, `modeCounts`, `activeTab`, `_savedRenderState`).

## Domain logic worth knowing

The TT500/DO classification in [assets/js/mode.js](assets/js/mode.js) is the heart of the tồn-phát workflow and is non-obvious from the field names alone:

- **TT500**: `TRANG_THAI === 500`
- **DO_7 / DO_8 / DO_9**: row's `DG_MOC_LM` matches the bucket name (after stripping spaces/underscores/dashes and uppercasing) **AND** `TRANG_THAI ∈ {500, 506, 507, 508}` — OR the row is `TRANG_THAI === 505` aged past `TT505_EXPIRED_DAYS = 3` days (computed from `TIME_TAC_DONG`). Missing or unparseable `TIME_TAC_DONG` is treated as expired.
- Results of `classifyRow(r)` are memoized via a `WeakMap` keyed on the row object. Call `clearClassifyCache()` whenever `allRawRows` is replaced (already done in `processFile` and `resetUpload`).

`selectedModes` only has two keys — `tt500` and `do` (DO_7/8/9 are toggled together). Tab IDs in the results UI are `tt500`, `do`, and `all`.

Bưu tá (delivery staff name + phone) list persists in `localStorage` under `buuta_list`, managed in [assets/js/buuta.js](assets/js/buuta.js). `parseBuutaName` / `parseBuutaPhone` extract from the `BUU_TA_PHAT` Excel column formatted like `"NGUYỄN VĂN A (84912345678)"` (the `84` country prefix is rewritten to `0`). `syncBuutaFromFile` adds new bưu tá from uploaded Excel files automatically.

Zalo "send" actions don't actually send — they `window.open('https://zalo.me/' + phone)` and rely on the user pasting clipboard content. `buildMessage` in [assets/js/modal.js](assets/js/modal.js) chooses between a DO template and a TT500-only template based on what's present.

## Shared third-party libraries (loaded from CDN)

- **SheetJS** (`xlsx.full.min.js`) — Excel parsing/export, used by every report
- **Chart.js 4.x + chartjs-plugin-datalabels** — used by report pages with charts (sản lượng, tỉ lệ hoàn, khẩu phát theo ca)
- **qrcodejs** — generates QR codes for the file-transfer feature in [upload_file_qrcode.html](upload_file_qrcode.html) and the QR widget on the hub
- **html2canvas-pro** — used to export chart/report sections as PNG
- **JSZip** — used in upload_file_qrcode.html

The QR file-transfer feature uploads to **Litterbox** (`litterbox.catbox.moe`, 1-hour expiry) — public, supports CORS, max 1GB/file. Field names are `reqtype=fileupload`, `time=1h`, `fileToUpload=<file>`; the response is the **plain-text URL** (not JSON). Don't route confidential files through it. Previously used `tmpfiles.org` but that endpoint blocks browser CORS from production origins.

## Conventions

- Vietnamese for all user-facing text, code comments, and toast messages.
- Brand red `#EE0033` is the dominant ViettelPost red; CSS tokens live at the top of each page's `<style>` block and in [assets/css/style.css](assets/css/style.css).
- Page-specific CSS is embedded in each HTML file (look in the leading `<style>` block); only [quan_ly_phieu_ton_phat.html](quan_ly_phieu_ton_phat.html) relies on shared `assets/css/style.css` exclusively.
- When editing one of the six embedded-JS reports, edit the script block in that single HTML file — there is no shared module to update.
- When editing logic touched by [quan_ly_phieu_ton_phat.html](quan_ly_phieu_ton_phat.html), prefer changes inside `assets/js/*.js` and remember to consider the script load order if introducing new globals.
