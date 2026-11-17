# Changelog

## [1.0.2] — 2026-11-10

- Added **展开后最高高度** (expanded maximum height) to the plugin detail page:
  range 240–1200px, default 480px, and never below the configured minimum
  height. The fixed `70vh` cap is gone.
- The composer now stops growing at that maximum and scrolls inside the input
  with the browser's native scrollbar, so long drafts no longer cover the
  conversation above.
- Let the scrollport own both bounds (`min-height` / `max-height` +
  `overflow-y: auto`) and stopped double-capping the editable surface, which
  previously could clip content instead of scrolling.
- Existing settings keep working: the minimum height and the expanded state
  keep their `localStorage` keys.

---

## [1.0.1] — 2026-11-10

- Renamed the package to `dsh-fans-composer-expand`: the client bundle
  registration id and the config-page key follow the new name. The
  `localStorage` keys, CSS class names and slot ids are unchanged, so saved
  settings and the expanded state carry over.
- Installed from a packed tarball (`file:`) instead of a link to the source
  directory.

---

## [1.0.0] — 2026-11-09

- First release as a standalone plugin, split out of `dsh-composer-expand`
  v0.1.4: an expand/collapse button in the composer tool row, a ~70vh writing
  view, a configurable minimum height (default 300px) on the plugin details
  page, Enter-to-newline while expanded, and state that survives a reload.
