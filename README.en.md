**English** | [简体中文](./README.md)

# dsh-fans-composer-expand (fans composer expand)

An expand/collapse plugin for the DeepSeek Harness (DSH) composer. It adds an
expand/collapse button to the composer tool row — the glyph itself hints at the
composer height (collapsed: short frame + up arrow; expanded: tall frame + down
arrow), in `currentColor` so it follows the theme. One click toggles between the
default capped height and an expanded writing view, so long drafts no longer
scroll inside a small box.

> Author: fanslater. This plugin reproduces every behaviour of the third-party
> plugin [dsh-composer-expand](https://github.com/13071301808/dsh-composer-expand)
> v0.1.4 and adds two settings on top: the minimum and maximum expanded height.

## Why it exists

DSH caps composer text at a fairly small height (the seat sets
`--dsh-composer-text-max-height: 336px`, which limits the text scroll container).
Once a draft grows, you can only scroll a few lines inside that small box. This
plugin keeps the default behaviour for short drafts and switches to a large view
with a single click when you write long prompts.

## Features

- **Expand/collapse button in the composer tool row** — placed at
  `conversation.input.right`, the official clickable slot next to the send
  button. The glyph hints at the composer height: short frame + up arrow when
  collapsed, tall frame + down arrow when expanded, and `currentColor` follows
  the DSH light/dark theme.
- **Expand to the configured maximum height** — toggles a CSS class on the
  conversation scroll container and widens the composer's `max-height` to the
  maximum configured on the detail page (480px by default). Clicking again
  restores the default cap.
- **Configurable minimum/maximum expanded height (added by this plugin)** — the
  upstream plugin hard-coded "minimum 300px, maximum 70vh". This plugin offers
  two number inputs on the 「插件 → fans输入框扩展」 detail page: minimum height
  (120–2000, default 300) and maximum height (240–1200, default 480, never below
  the minimum). Changes take effect immediately after saving, with no reload.
  Once the content exceeds the maximum height the composer stops growing and a
  **native scrollbar appears inside it**, so a long draft never covers the
  conversation above.
- **Enter inserts a newline while expanded** — a plain Enter only inserts a
  newline and does not send; keyboard shortcuts with a modifier
  (`Ctrl/Cmd + Enter`) still send. When the slash or @ menu is open the
  interception steps aside and Enter picks a candidate as usual.
- **Persisted in the browser** — the expanded state is stored in
  `localStorage[fans-composer-expand:expanded]`, so it survives reloads and
  workspace switches; on first use the state key of the third-party plugin is
  migrated once.
- **Self-healing expanded state** — a DOM rebuild is observed while expanded:
  even if the harness re-creates the conversation scroll container or the input
  card (view or session switch), the expanded styles and the "Enter inserts a
  newline" behaviour are re-applied to the new composer.
- **Bilingual** — button labels and tooltips follow DSH's `locale` service.
- **Client-side only** — no custom protocol, no host command, no LLM call and
  nothing written to the session log.
- **No build-hash dependency** — the CSS anchors on stable DSH data attributes
  (`data-conversation-scroll`, `data-composer-seat`, `data-input-scroll`,
  `data-composer-input`, plus the textarea-era `data-input-mirror`), so it works
  with both the Lexical editor and the legacy textarea composer.
- **Coexists with the third-party plugin** — CSS class names, localStorage keys
  and slot registration ids are all namespaced; if both are enabled you simply
  see two buttons next to the composer.

## Configuration (plugin detail page only)

The configuration page registers on the `plugins.bundle.config` slot
(key = package name `dsh-fans-composer-expand`) and appears only in
【插件 → 已安装插件 → fans输入框扩展】, between the summary and the component rows.
It **does not appear in DSH settings**.

| Setting | Description |
| --- | --- |
| Expanded minimum height (px) | The height kept while expanded even if the content is short. Range 120–2000, default 300 |
| Expanded maximum height (px) | Beyond this the composer scrolls internally. Range 240–1200, default 480, never below the minimum (the minimum wins if lower) |

The interaction follows the shared fans "stage then submit" pattern:

- **Save configuration** — highlighted when the form is dirty; saving applies
  immediately (the stylesheet is rewritten in place, no reload). Greyed out when
  nothing changed.
- **Restore defaults** — only resets the form to the defaults (minimum 300,
  maximum 480); you still need **Save configuration** to apply them.
- Leaving the page discards unsaved edits; invalid input (out of range) is
  flagged in red and the saved value stays in effect.

The configuration is stored in the browser at
`localStorage[fans-composer-expand:settings:v1]` and is local to this machine.

## Installation

The plugin is installed into DSH **from a packed tarball** (never by linking the
source directory):

```sh
# 1) pack inside the plugin source directory (output goes to ../pack)
npm pack --pack-destination ..\pack

# 2) install/update from the file: tarball; remove the old version first
dsh plugin --profile desktop remove dsh-fans-composer-expand
dsh plugin --profile desktop add "file:D:/__workspace/__workspace_ai/20261105_DSH插件整理安装/plugins/pack/dsh-fans-composer-expand-<version>.tgz"
```

Restart the DSH client after installing (bundle changes need a restart). The
expand button appears in the composer tool row (next to the send button); you
can confirm the plugin under 【插件 → 已安装插件】.

## How it works

| Area | Mechanism |
| --- | --- |
| Button slot | `conversation.input.right` list slot (session scope); `slots.inject` registers a single React component with `order: 90` |
| Toggle state | React `useState`, initialised from `localStorage[fans-composer-expand:expanded]` and written back on change |
| Height settings | `localStorage[fans-composer-expand:settings:v1]`; applied by subscription — saving rewrites the stylesheet immediately |
| DOM hook | `document.querySelector('[data-conversation-scroll]').classList.toggle('fans-composer-expand-on', on)` — an official stable attribute on the conversation scroll container |
| CSS contract | `.fans-composer-expand-on` overrides `--dsh-composer-text-max-height` (the real 336px cap) on `[data-composer-seat]` with `var(--fans-composer-expand-max)` (the configured maximum); `[data-input-scroll]` gets the min/max height plus `overflow-y: auto` (native scrolling), `[data-input-mirror]` gets the minimum height, and `[data-composer-input]` only gets an inner minimum height (configured minimum − 40px, floored at 120px) and is never capped twice |
| Enter interception | A capture-phase keydown on the seat calls `stopPropagation()` for a plain Enter (ahead of Lexical's bubble-phase send listener); modifier keys, IME composition and open candidate menus are left alone |
| Self-healing | A document-level `MutationObserver` re-applies the class and listeners when nodes are (re)inserted |
| Hard dependencies | `exports.inject = ['slots', 'locale']` — both official harness client services |
| No host command | `lib/index.js` is an empty `apply()`; the whole plugin is client-side |

## Relationship with the third-party dsh-composer-expand

| Item | dsh-composer-expand v0.1.4 | dsh-fans-composer-expand v1.0.2 |
| --- | --- | --- |
| Expand button / Enter newline / self-healing / bilingual / client-side | ✅ | ✅ fully reproduced |
| Expanded minimum height | hard-coded 300px | configured on the detail page, 120–2000px, default 300 |
| Expanded maximum height | hard-coded 70vh | configured on the detail page, 240–1200px, default 480, native scrollbar beyond it |
| Configuration entry | none | this plugin's detail page only (`plugins.bundle.config`) |
| State storage key | `dsh-composer-expand:expanded` | `fans-composer-expand:expanded` (old value migrated automatically) |
| CSS class | `dsh-composer-expand-on` | `fans-composer-expand-on` |

Both can be enabled at the same time without interfering; once this plugin is
confirmed working, disabling or uninstalling the third-party one avoids two
buttons.

## Known limitations

- The expanded state is remembered per browser, not per session. DSH renders a
  single composer at a time, so there is no observable difference today.
- The actual expanded height is driven by the content, between the minimum and
  the maximum; beyond the maximum the composer scrolls internally with the
  browser's native scrollbar.

## License

MIT © fanslater
