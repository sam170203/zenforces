# Zenforces — Chrome Extension Design Spec
**Date:** 2026-04-17  
**Status:** Approved  
**Version:** 1.0

---

## Overview

Zenforces is a lightweight Manifest V3 Chrome extension for Codeforces that removes rating/rank distractions and provides optional focus tools. Built with vanilla JS, zero dependencies, and a CSS-first approach.

**Core philosophy:** Ship invisibly. Users should forget it's installed.

---

## Goals & Non-Goals

**Goals:**
- Hide/blur ratings, ranks, and rank-based colors by default
- Neutralize username colors to a user-chosen neutral
- Minimal clean UI mode (hide sidebar clutter, ads)
- Optional: floating timer, submission toast feedback, focus mode
- Extremely fast — zero perceptible page slowdown
- Modular — each feature is independently togglable

**Non-Goals:**
- No background service worker logic (no cross-tab state needed)
- No remote data fetching
- No frameworks or build tools
- No analytics or telemetry

---

## File Structure

```
zenforces/
├── manifest.json
├── content.js              ← coordinator: boots modules, owns MutationObserver
├── styles.css              ← all visual overrides via CSS body-class toggles
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
└── modules/
    ├── utils.js            ← debounce, DOM helpers, style injection, logging
    ├── selectors.js        ← feature → candidate selectors config object
    ├── ratingHider.js      ← reference module: blur/hide ratings, ranks, rank colors
    ├── colorNeutralizer.js ← replace username rank colors with user-chosen color
    ├── cleanUI.js          ← hide clutter (ads, sidebar noise)
    ├── timer.js            ← floating countdown/stopwatch (no MutationObserver)
    ├── submissionFeedback.js ← verdict detection, lightweight toast
    └── focusMode.js        ← hide standings, leaderboard, other users' activity
```

---

## Storage Schema

```js
// chrome.storage.sync — all keys
{
  // Core (ON by default)
  ratingHider:        true,
  colorNeutralizer:   true,
  cleanUI:            true,

  // Extras (OFF by default)
  timer:              false,
  submissionFeedback: false,
  focusMode:          false,

  // Sub-settings
  usernameColor:      "#4a90d9",   // hex, validated before apply
  timerMode:          "stopwatch", // "stopwatch" | "countdown"

  // Popup UI state
  extrasExpanded:     false,
}
```

**Validation rules:**
- `usernameColor`: must match `/^#[0-9a-fA-F]{6}$/`
- `timerMode`: must be `"stopwatch"` or `"countdown"`
- All boolean features: coerce with `!!value`

**Default merge strategy:** always `{ ...DEFAULTS, ...stored }` — never trust stored shape alone.

---

## Module Contract

Every module must implement this interface:

```js
{
  _active: false,               // idempotency guard
  _processed: new WeakSet(),    // per-module dedup, never shared

  // Called on page load and on AJAX nav for partial subtree updates.
  // node defaults to document for full-page init.
  init(settings, node = document) {},

  // Full cleanup: remove listeners, injected elements, zf- classes.
  destroy() {},

  // Live settings update without full re-init (e.g., color change).
  // Re-init only if structurally needed.
  update(settings) {},

  // Optional. Called by coordinator on URL change (AJAX nav).
  // Timer uses this instead of MutationObserver.
  onPageChange(url) {},
}
```

**Idempotency rule:** `init()` checks `this._active` — if true, calls `update()` instead of re-initializing. `destroy()` sets `_active = false` and clears `_processed`.

---

## CSS Strategy

All visual changes are driven by toggling classes on `document.body`:

```
zf-hide-ratings       → hides/blurs rating numbers and rank labels
zf-neutral-colors     → neutralizes username rank colors
zf-clean-ui           → hides sidebar clutter, ads
zf-focus-mode         → hides standings, leaderboard panels
```

- `styles.css` contains all rules behind these classes
- Inline styles only for user-chosen values (username color via CSS custom property `--zf-username-color`)
- All injected elements use `zf-` prefix: `zf-timer`, `zf-toast`, etc.
- No `!important` overuse — only where Codeforces inline styles must be overridden

**FOUC prevention:** Coordinator injects a `<style id="zf-critical">` synchronously on script load with critical hiding rules (ratings, rank colors). This style is removed only if features are confirmed disabled after async storage resolves.

---

## `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "Zenforces",
  "version": "1.0.0",
  "description": "Focus on solving, not rating.",
  "permissions": ["storage"],
  "host_permissions": [
    "https://codeforces.com/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://codeforces.com/*"],
      "js": [
        "modules/utils.js",
        "modules/selectors.js",
        "modules/ratingHider.js",
        "modules/colorNeutralizer.js",
        "modules/cleanUI.js",
        "modules/timer.js",
        "modules/submissionFeedback.js",
        "modules/focusMode.js",
        "content.js"
      ],
      "css": ["styles.css"],
      "run_at": "document_start"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "Zenforces"
  },
  "icons": {
    "16":  "icons/icon16.png",
    "48":  "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

## `modules/utils.js`

```js
// Shared utilities. No module-level side effects.

const ZF = window.ZF || {};
window.ZF = ZF;

ZF.DEBUG = false;

ZF.log = (msg) => {
  if (ZF.DEBUG) console.log(`[Zenforces] ${msg}`);
};

// Standard debounce — returns a function that delays fn by ms.
ZF.debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

// Inject or update a <style> tag by ID.
// Safe to call repeatedly — updates textContent if tag exists.
ZF.addStyle = (id, css) => {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    (document.head || document.documentElement).appendChild(el);
  }
  el.textContent = css;
};

// Remove a <style> tag by ID.
ZF.removeStyle = (id) => {
  const el = document.getElementById(id);
  if (el) el.remove();
};

// Validate a hex color string.
ZF.isValidHex = (val) => /^#[0-9a-fA-F]{6}$/.test(val);

// Validate timerMode enum.
ZF.isValidTimerMode = (val) => ['stopwatch', 'countdown'].includes(val);

// Merge stored settings with defaults — always safe shape.
ZF.mergeSettings = (stored, defaults) => ({ ...defaults, ...stored });

// Apply CSS custom property to document root.
ZF.setCSSVar = (name, value) => {
  document.documentElement.style.setProperty(name, value);
};
```

---

## `modules/selectors.js`

```js
// Selector config — single source of truth for all DOM queries.
// Each feature lists candidate selectors in priority order.
// Coordinator and modules import from ZF.SELECTORS.
// When Codeforces updates their DOM, only this file changes.

ZF.SELECTORS = {

  // Rating numbers: profile pages, ranklist, submission pages
  ratings: [
    '.user-rank',                       // profile sidebar rank label
    '.rating',                          // inline rating spans
    '[class*="rated-user"]',            // dynamically generated rank classes
    '.personal-sidebar .rating-badge',
  ],

  // Rank label text (Newbie, Pupil, Expert, etc.)
  rankLabels: [
    '.user-rank',
    '.title',                           // rank title on profile
    '.roundbox .title',
  ],

  // Username elements that carry rank color via class
  usernames: [
    'a.rated-user',                     // standard username links
    '.rating-link',
    '.contestant-name a',
  ],

  // Verdict elements on submission pages and status tables
  verdicts: [
    '.verdict-accepted',
    '.verdict-rejected',
    '.submissionVerdictWrapper',
    'td.status-verdict-cell',
  ],

  // Clutter elements hidden by cleanUI
  clutter: [
    '#sidebar .roundbox:not(.status-frame)',  // sidebar widgets except status
    '.lang-chooser',
    '#footer',                                // optional — can disable
    '.score-distribution',
  ],

  // Focus mode: hide competitive context
  focusTargets: [
    '#standings',
    '.standings-table',
    '.contest-state-phase',
    '#pageContent .roundbox:has(.standings)',
  ],

  // Submission result row (for submissionFeedback polling)
  latestVerdict: [
    '#recentActions .verdict-accepted',
    '#recentActions .verdict-rejected',
    'tr.first-accepted',
    '#status-filter-form tr:nth-child(2) td.status-verdict-cell',
  ],
};
```

---

## `content.js` (Coordinator)

```js
// Coordinator — bootstraps modules, owns single MutationObserver,
// handles AJAX navigation, routes settings changes to modules.

(() => {
  const DEFAULTS = {
    ratingHider:       true,
    colorNeutralizer:  true,
    cleanUI:           true,
    timer:             false,
    submissionFeedback: false,
    focusMode:         false,
    usernameColor:     '#4a90d9',
    timerMode:         'stopwatch',
    extrasExpanded:    false,
  };

  // Feature registry — maps key → module object
  const REGISTRY = {
    ratingHider:        ZF.RatingHider,
    colorNeutralizer:   ZF.ColorNeutralizer,
    cleanUI:            ZF.CleanUI,
    timer:              ZF.Timer,
    submissionFeedback: ZF.SubmissionFeedback,
    focusMode:          ZF.FocusMode,
  };

  // FOUC guard: inject critical CSS synchronously before async storage resolves.
  // Hides ratings immediately — removed if features are disabled after load.
  ZF.addStyle('zf-critical', `
    .rated-user { color: inherit !important; }
    .user-rank, .rating { visibility: hidden; }
  `);

  let settings = { ...DEFAULTS };

  // Debounced observer callback — 16ms (one animation frame)
  const onMutation = ZF.debounce((mutations) => {
    const nodes = new Set();
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) nodes.add(node);
      }
    }
    if (!nodes.size) return;
    nodes.forEach(node => {
      for (const [key, mod] of Object.entries(REGISTRY)) {
        if (settings[key] && mod._active && mod.init) {
          mod.init(settings, node);
        }
      }
    });
  }, 16);

  const observer = new MutationObserver(onMutation);

  function startObserver() {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function initModules(node = document) {
    for (const [key, mod] of Object.entries(REGISTRY)) {
      if (key === 'timer') continue; // Timer uses onPageChange only
      if (settings[key]) {
        mod.init(settings, node);
      } else {
        mod.destroy();
      }
    }
  }

  // AJAX navigation detection — Codeforces uses hash/pushState inconsistently
  let lastUrl = location.href;
  const detectNavigation = ZF.debounce(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    ZF.log(`Nav: ${lastUrl}`);
    initModules(); // re-scan full document on nav
    for (const mod of Object.values(REGISTRY)) {
      if (mod.onPageChange) mod.onPageChange(lastUrl);
    }
  }, 100);

  window.addEventListener('popstate', detectNavigation);
  window.addEventListener('hashchange', detectNavigation);
  // Polling fallback for CF's non-standard navigation
  setInterval(detectNavigation, 500);

  // Live settings updates from popup
  chrome.storage.onChanged.addListener((changes) => {
    const changedKeys = Object.keys(changes);
    changedKeys.forEach(key => {
      const newVal = changes[key].newValue;
      settings[key] = newVal;

      if (!(key in REGISTRY)) return; // sub-settings handled via update()

      const mod = REGISTRY[key];
      if (newVal) {
        mod.init(settings);
      } else {
        mod.destroy();
      }
    });

    // If a sub-setting changed (color, timerMode), call update() on affected module
    if ('usernameColor' in changes) ZF.ColorNeutralizer.update(settings);
    if ('timerMode' in changes) ZF.Timer.update(settings);
  });

  // Bootstrap
  function boot(stored) {
    settings = ZF.mergeSettings(stored, DEFAULTS);

    // Remove critical FOUC guard only if ratingHider is off
    if (!settings.ratingHider) ZF.removeStyle('zf-critical');

    startObserver();
    initModules();

    // Timer init via onPageChange pattern
    if (settings.timer) ZF.Timer.onPageChange(location.href);
  }

  // Load from storage with in-memory defaults as immediate fallback
  // (prevents blocking if storage is slow)
  boot(DEFAULTS); // apply defaults immediately
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    if (chrome.runtime.lastError) {
      ZF.log('Storage error, using defaults');
      return;
    }
    boot(stored);
  });

})();
```

---

## `modules/ratingHider.js` (Reference Module)

```js
// RatingHider — hides/blurs rating numbers, rank labels, and rank-based colors.
// Reference implementation for all other modules.

ZF.RatingHider = (() => {
  const SEL = ZF.SELECTORS;

  return {
    _active: false,
    _processed: new WeakSet(),

    init(settings, node = document) {
      if (this._active) {
        // Already running — just process new node if partial update
        if (node !== document) this._process(node);
        return;
      }
      this._active = true;

      // CSS-first: toggle body class to activate stylesheet rules
      document.body.classList.add('zf-hide-ratings');

      // Process existing DOM
      this._process(node);
      ZF.log('RatingHider: init');
    },

    destroy() {
      if (!this._active) return;
      this._active = false;
      this._processed = new WeakSet();
      document.body.classList.remove('zf-hide-ratings');
      ZF.removeStyle('zf-rating-hider');
      ZF.log('RatingHider: destroyed');
    },

    update(settings) {
      // No sub-settings for this module — no-op
    },

    onPageChange(url) {
      if (!this._active) return;
      // Re-process full document on nav
      this._processed = new WeakSet();
      this._process(document);
    },

    _process(node) {
      const allSelectors = [
        ...SEL.ratings,
        ...SEL.rankLabels,
        ...SEL.usernames,
      ];

      allSelectors.forEach(sel => {
        const els = node === document
          ? document.querySelectorAll(sel)
          : (node.matches?.(sel) ? [node] : node.querySelectorAll(sel));

        els.forEach(el => {
          if (this._processed.has(el)) return;
          this._processed.add(el);
          el.classList.add('zf-rating-hidden');
        });
      });
    },
  };
})();
```

---

## `styles.css`

```css
/* All Zenforces visual overrides. Rules activate via body class toggles.
   zf- prefix on all injected classes to avoid conflicts. */

/* ── Rating Hider ─────────────────────────────────────────── */
body.zf-hide-ratings .zf-rating-hidden {
  visibility: hidden;
}

/* Hide rank-colored usernames' color override */
body.zf-hide-ratings a.rated-user,
body.zf-hide-ratings .rating-link {
  color: inherit !important;
  font-weight: inherit !important;
}

/* ── Color Neutralizer ────────────────────────────────────── */
body.zf-neutral-colors a.rated-user,
body.zf-neutral-colors .rating-link {
  color: var(--zf-username-color, #4a90d9) !important;
  transition: opacity 0.15s ease;
}

/* ── Clean UI ─────────────────────────────────────────────── */
body.zf-clean-ui .lang-chooser { display: none; }

/* ── Focus Mode ───────────────────────────────────────────── */
body.zf-focus-mode #standings,
body.zf-focus-mode .standings-table { display: none; }

/* ── Floating Timer ───────────────────────────────────────── */
#zf-timer {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: rgba(20, 20, 20, 0.88);
  color: #f0f0f0;
  font-family: 'Courier New', monospace;
  font-size: 18px;
  padding: 8px 16px;
  border-radius: 8px;
  z-index: 9999;
  cursor: move;
  user-select: none;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  backdrop-filter: blur(4px);
}
#zf-timer.zf-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Submission Toast ─────────────────────────────────────── */
#zf-toast {
  position: fixed;
  top: 24px;
  right: 24px;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  z-index: 9999;
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  pointer-events: none;
}
#zf-toast.zf-visible {
  opacity: 1;
  transform: translateY(0);
}
#zf-toast.zf-accepted { background: #2e7d32; }
#zf-toast.zf-rejected { background: #c62828; }
#zf-toast.zf-other    { background: #555; }

/* ── Rating blur (alternative to hide — future toggle) ────── */
body.zf-blur-ratings .zf-rating-hidden {
  visibility: visible;
  filter: blur(4px);
  transition: filter 0.15s ease;
}
body.zf-blur-ratings .zf-rating-hidden:hover {
  filter: blur(0);
}
```

---

## `popup/popup.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zenforces</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="zf-popup">

    <header class="zf-header">
      <span class="zf-logo">⚡ Zenforces</span>
      <span class="zf-version">v1.0</span>
    </header>

    <section class="zf-section" id="core-section">
      <div class="zf-toggle-row" data-key="ratingHider">
        <label class="zf-label" for="toggle-ratingHider">Hide Ratings &amp; Ranks</label>
        <input type="checkbox" id="toggle-ratingHider" class="zf-toggle"
               role="switch" aria-label="Hide Ratings and Ranks">
      </div>
      <div class="zf-toggle-row" data-key="colorNeutralizer">
        <label class="zf-label" for="toggle-colorNeutralizer">Neutralize Username Colors</label>
        <input type="checkbox" id="toggle-colorNeutralizer" class="zf-toggle"
               role="switch" aria-label="Neutralize Username Colors">
      </div>
      <div class="zf-toggle-row" data-key="cleanUI">
        <label class="zf-label" for="toggle-cleanUI">Clean UI Mode</label>
        <input type="checkbox" id="toggle-cleanUI" class="zf-toggle"
               role="switch" aria-label="Clean UI Mode">
      </div>
    </section>

    <section class="zf-section" id="extras-section">
      <button class="zf-extras-toggle" id="extras-toggle" aria-expanded="false">
        <span>Optional Enhancements</span>
        <span class="zf-chevron">▾</span>
      </button>
      <div class="zf-extras-content zf-collapsed" id="extras-content">
        <div class="zf-toggle-row" data-key="timer">
          <label class="zf-label" for="toggle-timer">Floating Timer</label>
          <input type="checkbox" id="toggle-timer" class="zf-toggle"
                 role="switch" aria-label="Floating Timer">
        </div>
        <div class="zf-toggle-row" data-key="submissionFeedback">
          <label class="zf-label" for="toggle-submissionFeedback">Submission Feedback</label>
          <input type="checkbox" id="toggle-submissionFeedback" class="zf-toggle"
                 role="switch" aria-label="Submission Feedback Toasts">
        </div>
        <div class="zf-toggle-row" data-key="focusMode">
          <label class="zf-label" for="toggle-focusMode">Focus Mode</label>
          <input type="checkbox" id="toggle-focusMode" class="zf-toggle"
                 role="switch" aria-label="Focus Mode">
        </div>
      </div>
    </section>

    <section class="zf-section" id="color-section">
      <div class="zf-color-row" id="color-row">
        <label class="zf-label" for="username-color">Username Color</label>
        <div class="zf-color-picker-wrap">
          <span class="zf-color-preview" id="color-preview"></span>
          <input type="color" id="username-color"
                 aria-label="Custom username color">
        </div>
      </div>
    </section>

    <footer class="zf-footer">
      Focus on solving, not rating.
    </footer>

  </div>
  <script src="popup.js"></script>
</body>
</html>
```

---

## `popup/popup.css`

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  background: #1a1a1a;
  color: #e0e0e0;
  width: 300px;
  min-height: 200px;
}

.zf-popup { padding: 0 0 8px; }

/* Header */
.zf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px 10px;
  border-bottom: 1px solid #2a2a2a;
}
.zf-logo { font-weight: 700; font-size: 14px; letter-spacing: 0.02em; }
.zf-version { font-size: 11px; color: #666; }

/* Sections */
.zf-section { padding: 4px 0; border-bottom: 1px solid #222; }

/* Toggle rows */
.zf-toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 16px;
  transition: background 0.1s;
}
.zf-toggle-row:hover { background: #222; }
.zf-label { cursor: pointer; }

/* Checkbox styled as toggle switch */
.zf-toggle {
  appearance: none;
  width: 36px;
  height: 20px;
  background: #444;
  border-radius: 20px;
  position: relative;
  cursor: pointer;
  transition: background 0.15s ease;
  flex-shrink: 0;
}
.zf-toggle::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  top: 3px;
  left: 3px;
  transition: transform 0.15s ease;
}
.zf-toggle:checked { background: #4a90d9; }
.zf-toggle:checked::after { transform: translateX(16px); }
.zf-toggle:focus-visible {
  outline: 2px solid #4a90d9;
  outline-offset: 2px;
}

/* Extras expandable section */
.zf-extras-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 16px;
  background: none;
  border: none;
  color: #aaa;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: color 0.1s, background 0.1s;
}
.zf-extras-toggle:hover { color: #e0e0e0; background: #222; }

.zf-chevron {
  display: inline-block;
  transition: transform 0.2s ease;
}
.zf-extras-toggle[aria-expanded="true"] .zf-chevron {
  transform: rotate(180deg);
}

/* max-height animation for smooth expand.
   Do NOT use [hidden] attribute — it sets display:none and breaks transitions.
   Instead use .zf-collapsed class to control visibility. */
.zf-extras-content {
  overflow: hidden;
  max-height: 200px;
  transition: max-height 0.2s ease;
}
.zf-extras-content.zf-collapsed {
  max-height: 0;
}

/* Color picker row */
.zf-color-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 16px;
}
.zf-color-picker-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.zf-color-preview {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid #444;
  display: inline-block;
  flex-shrink: 0;
}
#username-color {
  width: 36px;
  height: 24px;
  border: none;
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
  background: none;
}
#username-color:disabled { opacity: 0.35; cursor: not-allowed; }

/* Color section hidden when colorNeutralizer off */
#color-section { display: none; }
#color-section.zf-visible { display: block; }

/* Footer */
.zf-footer {
  padding: 10px 16px 4px;
  font-size: 11px;
  color: #555;
  text-align: center;
  font-style: italic;
}
```

---

## `popup/popup.js`

```js
const DEFAULTS = {
  ratingHider:        true,
  colorNeutralizer:   true,
  cleanUI:            true,
  timer:              false,
  submissionFeedback: false,
  focusMode:          false,
  usernameColor:      '#4a90d9',
  timerMode:          'stopwatch',
  extrasExpanded:     false,
};

const FEATURE_KEYS = ['ratingHider', 'colorNeutralizer', 'cleanUI', 'timer', 'submissionFeedback', 'focusMode'];

function applySettings(settings) {
  // Apply toggle states
  FEATURE_KEYS.forEach(key => {
    const el = document.getElementById(`toggle-${key}`);
    if (el) el.checked = !!settings[key];
  });

  // Color picker state
  const colorInput = document.getElementById('username-color');
  const colorPreview = document.getElementById('color-preview');
  const colorSection = document.getElementById('color-section');
  const isColorEnabled = settings.colorNeutralizer;

  colorInput.value = settings.usernameColor || DEFAULTS.usernameColor;
  colorPreview.style.background = colorInput.value;
  colorInput.disabled = !isColorEnabled;
  colorSection.classList.toggle('zf-visible', true); // always show section
  colorInput.style.opacity = isColorEnabled ? '1' : '0.35';

  // Extras expand state
  const extrasToggle = document.getElementById('extras-toggle');
  const extrasContent = document.getElementById('extras-content');
  const expanded = !!settings.extrasExpanded;
  extrasToggle.setAttribute('aria-expanded', String(expanded));
  extrasContent.classList.toggle('zf-collapsed', !expanded);
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(DEFAULTS, (settings) => {
    applySettings({ ...DEFAULTS, ...settings });
  });

  // Feature toggles
  FEATURE_KEYS.forEach(key => {
    const el = document.getElementById(`toggle-${key}`);
    if (!el) return;
    el.addEventListener('change', () => {
      const update = { [key]: el.checked };
      chrome.storage.sync.set(update);

      // Show/disable color picker based on colorNeutralizer state
      if (key === 'colorNeutralizer') {
        const colorInput = document.getElementById('username-color');
        colorInput.disabled = !el.checked;
        colorInput.style.opacity = el.checked ? '1' : '0.35';
      }
    });
  });

  // Color picker
  const colorInput = document.getElementById('username-color');
  const colorPreview = document.getElementById('color-preview');
  colorInput.addEventListener('input', () => {
    const val = colorInput.value;
    colorPreview.style.background = val;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      chrome.storage.sync.set({ usernameColor: val });
    }
  });

  // Extras expand/collapse
  const extrasToggle = document.getElementById('extras-toggle');
  const extrasContent = document.getElementById('extras-content');
  extrasToggle.addEventListener('click', () => {
    const isExpanded = extrasToggle.getAttribute('aria-expanded') === 'true';
    const next = !isExpanded;
    extrasToggle.setAttribute('aria-expanded', String(next));
    extrasContent.classList.toggle('zf-collapsed', !next);
    chrome.storage.sync.set({ extrasExpanded: next });
  });
});
```

---

## Performance Guarantees

| Concern | Solution |
|---|---|
| FOUC on load | Synchronous `<style id="zf-critical">` injected before async storage |
| DOM thrash | MutationObserver debounced at 16ms; batch reads before writes |
| Repeated processing | Per-module `WeakSet` — each node processed once |
| AJAX nav | URL polling at 500ms + `popstate`/`hashchange` listeners |
| Timer overhead | No MutationObserver; pure `setInterval` + `onPageChange` |
| CSS transitions | All ≤ 0.2s, `transform`/`opacity` only (GPU composited) |

---

## Naming

**Zenforces** — final name. Tagline: *"Focus on solving, not rating."*

---

## Out of Scope (v1.0)

- Background service worker
- Cross-tab state sync
- Contest countdown from CF API
- Per-problem notes or bookmarks
- Dark mode (CF has its own)
