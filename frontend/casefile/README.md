# CASEFILE — Evidence / Analysis / Timeline

Three pages built to match your existing dark forensic dashboard (same sidebar, topbar,
teal accent, mono data labels). Open any file directly in a browser — no build step needed.

## Files
- `evidence.html` — drag-and-drop evidence ingest with a scanning-line dropzone,
  accepted file-type chips, and a live ingest queue (verified / hashing / error states).
- `analysis.html` — per-camera video panel with a CRT-textured player frame, a scrubber
  with color-coded event ticks (motion / person / scene change / anomaly), transport
  controls, and a clickable detected-events log.
- `timeline.html` — vertical forensic timeline (acquisition → import → SHA-256 verification
  → analysis → detections → report) with filter chips for custody / analysis / detections.
- `css/base.css` — shared design tokens (color, type, sidebar/topbar shell) reused by all three.
- `css/evidence.css`, `css/analysis.css`, `css/timeline.css` — page-specific styles.
- `js/evidence.js`, `js/analysis.js`, `js/timeline.js` — interactivity (drag/drop, scrub/play, filters).

## Notes
- The sidebar links to `dashboard.html`, `cases.html`, `custody.html`, `reports.html` to match
  your nav — point those at your existing pages, or rename the files to match.
- `evidence.js` has a `handleFiles()` stub where you'd wire in your real upload endpoint.
- All colors/fonts live in `css/base.css` as CSS variables (`--teal`, `--bg`, `--mono`, etc.)
  so the whole set restyles from one place if your brand shifts.
- Built with keyboard focus states and `prefers-reduced-motion` support.
