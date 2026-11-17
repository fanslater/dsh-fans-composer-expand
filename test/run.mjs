import assert from "node:assert";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const file = new URL("../lib/client.js", import.meta.url);
const sandbox = {
  window: {
    __ModuleLoader__: {
      load(definition) {
        sandbox.__captured = definition.factory((name) => (name === "react" ? {} : {}));
      },
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
  },
  document: {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ dataset: {}, remove() {} }),
    head: { appendChild() {} },
    body: {},
  },
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  console,
};
vm.createContext(sandbox);
vm.runInContext(readFileSync(file, "utf8"), sandbox, { filename: String(file) });

const t = sandbox.__captured.__test;
assert.ok(t !== undefined, "client bundle must expose __test");

// Defaults and range clamping.
assert.deepEqual(
  { min: t.normalizeSettings({}).expandedMinHeight, max: t.normalizeSettings({}).expandedMaxHeight },
  { min: 300, max: 480 },
  "defaults must be min 300 / max 480",
);
assert.equal(t.normalizeSettings({ expandedMinHeight: 100 }).expandedMinHeight, 120, "min floor is 120");
assert.equal(t.normalizeSettings({ expandedMinHeight: 9000 }).expandedMinHeight, 2000, "min ceiling is 2000");
assert.equal(t.normalizeSettings({ expandedMaxHeight: 10 }).expandedMaxHeight, 300, "max never drops below min");
assert.equal(t.normalizeSettings({ expandedMaxHeight: 9000 }).expandedMaxHeight, 1200, "max ceiling is 1200");
assert.equal(t.normalizeSettings({ expandedMinHeight: 900, expandedMaxHeight: 300 }).expandedMaxHeight, 900, "max is raised to the configured min");
assert.equal(t.clampMaxHeight("oops", 300), 480, "non-numeric max falls back to the default");
assert.equal(t.clampMaxHeight(500, 300), 500, "numeric max is kept");

// Generated CSS caps at the configured height and delegates scrolling to the native scrollport.
const css = t.buildCss(300, 480);
assert.ok(css.includes("--fans-composer-expand-min: 300px"), "min height variable must be emitted");
assert.ok(css.includes("--fans-composer-expand-max: 480px"), "max height variable must be emitted");
assert.ok(
  css.includes("[data-composer-seat] { --dsh-composer-text-max-height: var(--fans-composer-expand-max) !important; }"),
  "seat cap must follow the configured max",
);
assert.ok(
  css.includes("[data-input-scroll] { min-height: var(--fans-composer-expand-min) !important; max-height: var(--fans-composer-expand-max) !important; overflow-y: auto !important; }"),
  "scrollport must cap at the max and scroll",
);
assert.ok(css.includes("[data-composer-input] { min-height: 260px !important; max-height: none !important; }"), "editable must not be capped twice");
assert.ok(!/70vh/.test(css), "the old fixed 70vh cap must be gone");

const cssTight = t.buildCss(120, 240);
assert.ok(cssTight.includes("--fans-composer-expand-max: 240px"), "smallest configured max must be emitted");
assert.ok(cssTight.includes("min-height: 120px !important"), "inner floor keeps the editable usable");

console.log("composer expand checks passed");
