# Zenforces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight MV3 Chrome extension that hides Codeforces rating distractions and provides optional focus tools, with zero dependencies and near-zero page overhead.

**Architecture:** A single coordinator (`content.js`) owns one debounced MutationObserver and a feature registry. Each feature is an independent module with `init/destroy/update/onPageChange`. All visual changes go through CSS body-class toggles; only user-chosen values use inline CSS custom properties.

**Tech Stack:** Vanilla JS (ES2020 IIFEs), Chrome MV3, Chrome Storage Sync, CSS custom properties, no build tools.

---

## File Map

| File | Responsibility |
|---|---|
| `manifest.json` | Extension config, permissions, content script load order |
| `modules/utils.js` | Shared helpers: debounce, style injection, hex validation, settings merge |
| `modules/selectors.js` | Single config object mapping features → candidate DOM selectors |
| `modules/ratingHider.js` | Hide/blur ratings, ranks, rank-based colors |
| `modules/colorNeutralizer.js` | Replace username rank colors with user-chosen color |
| `modules/cleanUI.js` | Hide sidebar clutter, ads |
| `modules/timer.js` | Floating draggable stopwatch, page-change-aware only |
| `modules/submissionFeedback.js` | Poll for verdict, show toast notification |
| `modules/focusMode.js` | Hide standings, leaderboard panels |
| `content.js` | Coordinator: boots modules, owns MutationObserver, routes storage changes |
| `styles.css` | All visual rules behind `zf-*` body classes |
| `popup/popup.html` | Popup markup |
| `popup/popup.css` | Popup styles with toggle switch animations |
| `popup/popup.js` | Reads/writes storage, renders toggle states |
| `icons/` | Placeholder PNGs (16, 48, 128px) |
| `tests/utils.test.js` | Node.js-runnable tests for pure utility functions |

---

## Task 1: Project Scaffold

**Files:**
- Create: `manifest.json`
- Create: `icons/` (placeholder PNGs via Node.js script)
- Create: `modules/` (empty dir)
- Create: `popup/` (empty dir)

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/saksham/codeforce-extension
git init
echo "node_modules/" > .gitignore
```

Expected: `Initialized empty Git repository`

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p modules popup icons tests
```

- [ ] **Step 3: Create placeholder icons**

```bash
node -e "
const { createCanvas } = require('canvas');
" 2>/dev/null || echo "canvas not available, using fallback"
```

If `canvas` isn't available, create icons manually: save three files as 1×1 transparent PNGs using this one-liner per size:

```bash
# Creates valid minimal PNG files (1x1 purple pixel, will be replaced with real icons)
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > icons/icon16.png
cp icons/icon16.png icons/icon48.png
cp icons/icon16.png icons/icon128.png
```

- [ ] **Step 4: Write `manifest.json`**

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

- [ ] **Step 5: Validate manifest loads in Chrome**

Open `chrome://extensions`, enable Developer mode, click "Load unpacked", select `/Users/saksham/codeforce-extension`.

Expected: Extension appears with name "Zenforces", no errors in the extensions page.

- [ ] **Step 6: Commit**

```bash
git add manifest.json icons/ .gitignore
git commit -m "feat: scaffold project with manifest and icons"
```

---

## Task 2: `modules/utils.js` + Tests

**Files:**
- Create: `modules/utils.js`
- Create: `tests/utils.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/utils.test.js
// Run with: node tests/utils.test.js

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(val, msg) {
  if (!val) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b) {
  if (a !== b) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── Stub window.ZF ────────────────────────────────────────────────
global.window = { ZF: {} };
global.document = {
  getElementById: () => null,
  createElement: () => ({ id: '', textContent: '' }),
  head: null,
  documentElement: { style: { setProperty: () => {} } },
};

// Load utils manually (extract pure functions for Node testing)
const ZF = global.window.ZF;

// debounce
ZF.debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

// isValidHex
ZF.isValidHex = (val) => /^#[0-9a-fA-F]{6}$/.test(val);

// isValidTimerMode
ZF.isValidTimerMode = (val) => ['stopwatch', 'countdown'].includes(val);

// mergeSettings
ZF.mergeSettings = (stored, defaults) => ({ ...defaults, ...stored });

// ── Tests ─────────────────────────────────────────────────────────

console.log('\nutils.js tests:');

test('isValidHex: valid lowercase', () => assertEqual(ZF.isValidHex('#4a90d9'), true));
test('isValidHex: valid uppercase', () => assertEqual(ZF.isValidHex('#FFFFFF'), true));
test('isValidHex: missing hash', () => assertEqual(ZF.isValidHex('4a90d9'), false));
test('isValidHex: too short', () => assertEqual(ZF.isValidHex('#fff'), false));
test('isValidHex: empty string', () => assertEqual(ZF.isValidHex(''), false));
test('isValidHex: 8-char hex', () => assertEqual(ZF.isValidHex('#4a90d9ff'), false));

test('isValidTimerMode: stopwatch', () => assertEqual(ZF.isValidTimerMode('stopwatch'), true));
test('isValidTimerMode: countdown', () => assertEqual(ZF.isValidTimerMode('countdown'), true));
test('isValidTimerMode: invalid', () => assertEqual(ZF.isValidTimerMode('timer'), false));
test('isValidTimerMode: empty', () => assertEqual(ZF.isValidTimerMode(''), false));

test('mergeSettings: fills missing keys from defaults', () => {
  const result = ZF.mergeSettings({ ratingHider: false }, { ratingHider: true, timer: false });
  assertEqual(result.ratingHider, false);
  assertEqual(result.timer, false);
});

test('mergeSettings: stored values override defaults', () => {
  const result = ZF.mergeSettings({ timer: true }, { timer: false, ratingHider: true });
  assertEqual(result.timer, true);
  assertEqual(result.ratingHider, true);
});

test('debounce: calls function after delay', (done) => {
  let calls = 0;
  const fn = ZF.debounce(() => calls++, 10);
  fn(); fn(); fn();
  setTimeout(() => {
    assertEqual(calls, 1);
  }, 50);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run tests — expect failure (ZF not yet defined)**

```bash
node tests/utils.test.js
```

Expected: Tests run against inline stubs — they should PASS since we inline the implementations above. This confirms our test harness works.

- [ ] **Step 3: Write `modules/utils.js`**

```js
const ZF = window.ZF || {};
window.ZF = ZF;

ZF.DEBUG = false;

ZF.log = (msg) => {
  if (ZF.DEBUG) console.log(`[Zenforces] ${msg}`);
};

ZF.debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

// Inject or update a <style> by ID. Safe to call repeatedly.
ZF.addStyle = (id, css) => {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    (document.head || document.documentElement).appendChild(el);
  }
  el.textContent = css;
};

ZF.removeStyle = (id) => {
  const el = document.getElementById(id);
  if (el) el.remove();
};

ZF.isValidHex = (val) => /^#[0-9a-fA-F]{6}$/.test(val);

ZF.isValidTimerMode = (val) => ['stopwatch', 'countdown'].includes(val);

ZF.mergeSettings = (stored, defaults) => ({ ...defaults, ...stored });

ZF.setCSSVar = (name, value) => {
  document.documentElement.style.setProperty(name, value);
};
```

- [ ] **Step 4: Verify tests still pass**

```bash
node tests/utils.test.js
```

Expected: All tests pass, `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add modules/utils.js tests/utils.test.js
git commit -m "feat: add utils.js with debounce, style injection, validators"
```

---

## Task 3: `modules/selectors.js`

**Files:**
- Create: `modules/selectors.js`

- [ ] **Step 1: Write `modules/selectors.js`**

```js
// Single source of truth for all DOM selectors.
// Selectors are listed in priority order. Update only this file when CF changes their DOM.

ZF.SELECTORS = {

  ratings: [
    '.user-rank',
    '.rating',
    '[class*="rated-user"]',
    '.personal-sidebar .rating-badge',
  ],

  rankLabels: [
    '.user-rank',
    '.title',
    '.roundbox .title',
  ],

  usernames: [
    'a.rated-user',
    '.rating-link',
    '.contestant-name a',
  ],

  verdicts: [
    '.verdict-accepted',
    '.verdict-rejected',
    '.submissionVerdictWrapper',
    'td.status-verdict-cell',
  ],

  // Elements hidden by cleanUI
  clutter: [
    '.lang-chooser',
    '#footer',
  ],

  // Elements hidden by focusMode
  focusTargets: [
    '#standings',
    '.standings-table',
    '.contest-state-phase',
  ],

  // Selectors for latest verdict polling (submissionFeedback)
  latestVerdict: [
    '#recentActions .verdict-accepted',
    '#recentActions .verdict-rejected',
    '#status-filter-form tr:nth-child(2) td.status-verdict-cell',
    'tr.first-accepted td.status-verdict-cell',
  ],
};
```

- [ ] **Step 2: Reload extension in Chrome, verify no console errors**

Open `chrome://extensions`, click the reload icon on Zenforces.
Navigate to `https://codeforces.com`.
Open DevTools console — expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add modules/selectors.js
git commit -m "feat: add selectors config"
```

---

## Task 4: `styles.css`

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Write `styles.css`**

```css
/* All Zenforces visual rules. Activated by toggling classes on document.body.
   zf- prefix on all injected classes to avoid Codeforces conflicts. */

/* ── Rating Hider ─────────────────────────────────────────────────── */
body.zf-hide-ratings .zf-rating-hidden {
  visibility: hidden;
}

/* Remove rank-based color from username links */
body.zf-hide-ratings a.rated-user,
body.zf-hide-ratings .rating-link {
  color: inherit !important;
  font-weight: inherit !important;
}

/* Optional blur variant (future toggle — activated by zf-blur-ratings instead) */
body.zf-blur-ratings .zf-rating-hidden {
  visibility: visible;
  filter: blur(4px);
  transition: filter 0.15s ease;
}
body.zf-blur-ratings .zf-rating-hidden:hover {
  filter: blur(0);
}

/* ── Color Neutralizer ────────────────────────────────────────────── */
body.zf-neutral-colors a.rated-user,
body.zf-neutral-colors .rating-link {
  color: var(--zf-username-color, #4a90d9) !important;
  transition: opacity 0.15s ease;
}

/* ── Clean UI ─────────────────────────────────────────────────────── */
body.zf-clean-ui .zf-clutter-hidden {
  display: none !important;
}

/* ── Focus Mode ───────────────────────────────────────────────────── */
body.zf-focus-mode .zf-focus-hidden {
  display: none !important;
}

/* ── Floating Timer ───────────────────────────────────────────────── */
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

/* ── Submission Toast ─────────────────────────────────────────────── */
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
```

- [ ] **Step 2: Reload extension, navigate to codeforces.com**

Open DevTools → Elements panel. Confirm `<link>` for `styles.css` is injected.
Expected: No console errors.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: add styles.css with all zf- body-class rules"
```

---

## Task 5: `modules/ratingHider.js`

**Files:**
- Create: `modules/ratingHider.js`

- [ ] **Step 1: Write `modules/ratingHider.js`**

```js
ZF.RatingHider = (() => {
  const SEL = () => ZF.SELECTORS; // lazy ref — selectors loads after utils

  return {
    _active: false,
    _processed: new WeakSet(),

    init(settings, node = document) {
      if (this._active) {
        if (node !== document) this._process(node);
        return;
      }
      this._active = true;
      document.body.classList.add('zf-hide-ratings');
      this._process(node);
      ZF.log('RatingHider: init');
    },

    destroy() {
      if (!this._active) return;
      this._active = false;
      this._processed = new WeakSet();
      document.body.classList.remove('zf-hide-ratings');
      ZF.log('RatingHider: destroyed');
    },

    update(settings) {
      // No sub-settings — no-op
    },

    onPageChange(url) {
      if (!this._active) return;
      this._processed = new WeakSet();
      this._process(document);
    },

    _process(node) {
      const s = SEL();
      const allSelectors = [...s.ratings, ...s.rankLabels, ...s.usernames];

      allSelectors.forEach(sel => {
        let els;
        try {
          els = node === document
            ? document.querySelectorAll(sel)
            : (node.matches?.(sel) ? [node] : node.querySelectorAll(sel));
        } catch (_) {
          return; // selector may be unsupported in some CF pages
        }
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

- [ ] **Step 2: Manually test in Chrome**

Reload extension. Navigate to `https://codeforces.com/profile/<any-handle>`.

Expected:
- Rating numbers are invisible (visibility:hidden)
- Username links show no colored rank text
- No console errors

- [ ] **Step 3: Test partial update (MutationObserver path)**

In DevTools console on codeforces.com:
```js
// Simulate a mutation by injecting a fake rated-user link
const el = document.createElement('a');
el.className = 'rated-user';
el.textContent = '1800';
document.body.appendChild(el);
// After ~16ms the coordinator should call RatingHider.init(settings, el)
// Verify:
setTimeout(() => console.log(el.classList.contains('zf-rating-hidden')), 100);
```
Expected: `true`

- [ ] **Step 4: Commit**

```bash
git add modules/ratingHider.js
git commit -m "feat: add ratingHider module"
```

---

## Task 6: `modules/colorNeutralizer.js`

**Files:**
- Create: `modules/colorNeutralizer.js`

- [ ] **Step 1: Write `modules/colorNeutralizer.js`**

```js
ZF.ColorNeutralizer = (() => {
  const SEL = () => ZF.SELECTORS;

  function validColor(val) {
    return ZF.isValidHex(val) ? val : '#4a90d9';
  }

  return {
    _active: false,
    _processed: new WeakSet(),

    init(settings, node = document) {
      if (this._active) {
        if (node !== document) this._process(node);
        return;
      }
      this._active = true;
      document.body.classList.add('zf-neutral-colors');
      ZF.setCSSVar('--zf-username-color', validColor(settings.usernameColor));
      this._process(node);
      ZF.log('ColorNeutralizer: init');
    },

    destroy() {
      if (!this._active) return;
      this._active = false;
      this._processed = new WeakSet();
      document.body.classList.remove('zf-neutral-colors');
      document.documentElement.style.removeProperty('--zf-username-color');
      ZF.log('ColorNeutralizer: destroyed');
    },

    update(settings) {
      if (!this._active) return;
      ZF.setCSSVar('--zf-username-color', validColor(settings.usernameColor));
    },

    onPageChange(url) {
      if (!this._active) return;
      this._processed = new WeakSet();
      this._process(document);
    },

    _process(node) {
      SEL().usernames.forEach(sel => {
        let els;
        try {
          els = node === document
            ? document.querySelectorAll(sel)
            : (node.matches?.(sel) ? [node] : node.querySelectorAll(sel));
        } catch (_) { return; }
        els.forEach(el => {
          if (this._processed.has(el)) return;
          this._processed.add(el);
          // CSS handles the color via body class + CSS var — no inline style needed
        });
      });
    },
  };
})();
```

- [ ] **Step 2: Manually test in Chrome**

Reload extension. Navigate to `https://codeforces.com`.

Expected:
- Username links appear in the custom color (#4a90d9 blue) instead of rank colors
- No red/green/purple rated-user colors visible

- [ ] **Step 3: Commit**

```bash
git add modules/colorNeutralizer.js
git commit -m "feat: add colorNeutralizer module"
```

---

## Task 7: `modules/cleanUI.js`

**Files:**
- Create: `modules/cleanUI.js`

- [ ] **Step 1: Write `modules/cleanUI.js`**

```js
ZF.CleanUI = (() => {
  const SEL = () => ZF.SELECTORS;

  return {
    _active: false,
    _processed: new WeakSet(),

    init(settings, node = document) {
      if (this._active) {
        if (node !== document) this._process(node);
        return;
      }
      this._active = true;
      document.body.classList.add('zf-clean-ui');
      this._process(node);
      ZF.log('CleanUI: init');
    },

    destroy() {
      if (!this._active) return;
      this._active = false;
      this._processed = new WeakSet();
      document.body.classList.remove('zf-clean-ui');
      // Remove markers so elements re-show if feature toggled back on
      document.querySelectorAll('.zf-clutter-hidden')
        .forEach(el => el.classList.remove('zf-clutter-hidden'));
      ZF.log('CleanUI: destroyed');
    },

    update(settings) {},

    onPageChange(url) {
      if (!this._active) return;
      this._processed = new WeakSet();
      this._process(document);
    },

    _process(node) {
      SEL().clutter.forEach(sel => {
        let els;
        try {
          els = node === document
            ? document.querySelectorAll(sel)
            : (node.matches?.(sel) ? [node] : node.querySelectorAll(sel));
        } catch (_) { return; }
        els.forEach(el => {
          if (this._processed.has(el)) return;
          this._processed.add(el);
          el.classList.add('zf-clutter-hidden');
        });
      });
    },
  };
})();
```

- [ ] **Step 2: Manually test in Chrome**

Reload extension. Navigate to `https://codeforces.com`.

Expected: `.lang-chooser` and `#footer` are not visible.

- [ ] **Step 3: Commit**

```bash
git add modules/cleanUI.js
git commit -m "feat: add cleanUI module"
```

---

## Task 8: `modules/timer.js`

**Files:**
- Create: `modules/timer.js`

- [ ] **Step 1: Write `modules/timer.js`**

```js
// Timer deliberately avoids MutationObserver.
// It only reacts to page changes via onPageChange().

ZF.Timer = (() => {
  let _el = null;
  let _interval = null;
  let _seconds = 0;
  let _dragging = false;
  let _dragOffX = 0;
  let _dragOffY = 0;

  function onMouseMove(e) {
    if (!_dragging || !_el) return;
    _el.style.right = 'auto';
    _el.style.bottom = 'auto';
    _el.style.left = `${e.clientX - _dragOffX}px`;
    _el.style.top  = `${e.clientY - _dragOffY}px`;
  }

  function onMouseUp() { _dragging = false; }

  function updateDisplay() {
    if (!_el) return;
    const m = Math.floor(_seconds / 60).toString().padStart(2, '0');
    const s = (_seconds % 60).toString().padStart(2, '0');
    _el.textContent = `${m}:${s}`;
  }

  return {
    _active: false,
    _processed: new WeakSet(), // satisfies module contract, unused

    init(settings, node = document) {
      if (this._active) return;
      this._active = true;

      _el = document.createElement('div');
      _el.id = 'zf-timer';
      _el.setAttribute('aria-label', 'Problem solving timer');
      _el.textContent = '00:00';
      document.body.appendChild(_el);

      // Animate in on next two frames to trigger CSS transition
      requestAnimationFrame(() =>
        requestAnimationFrame(() => _el.classList.add('zf-visible'))
      );

      _el.addEventListener('mousedown', (e) => {
        _dragging = true;
        const rect = _el.getBoundingClientRect();
        _dragOffX = e.clientX - rect.left;
        _dragOffY = e.clientY - rect.top;
        _el.style.transition = 'none';
      });
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      _seconds = 0;
      _interval = setInterval(() => { _seconds++; updateDisplay(); }, 1000);
      ZF.log('Timer: init');
    },

    destroy() {
      if (!this._active) return;
      this._active = false;
      clearInterval(_interval);
      _interval = null;
      _seconds = 0;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (_el) { _el.remove(); _el = null; }
      ZF.log('Timer: destroyed');
    },

    update(settings) {
      // timerMode change — restart clean
      const wasActive = this._active;
      this.destroy();
      if (wasActive) this.init(settings);
    },

    onPageChange(url) {
      if (!this._active) return;
      clearInterval(_interval);
      _seconds = 0;
      updateDisplay();
      _interval = setInterval(() => { _seconds++; updateDisplay(); }, 1000);
    },
  };
})();
```

- [ ] **Step 2: Manually test in Chrome**

Enable Timer in the popup (it's OFF by default — toggle it on).
Navigate to `https://codeforces.com/problemset/problem/1/A`.

Expected:
- Floating timer appears bottom-right with fade-in animation
- Timer counts up from 00:00
- Timer is draggable
- Navigating to another problem resets timer to 00:00

- [ ] **Step 3: Commit**

```bash
git add modules/timer.js
git commit -m "feat: add floating timer module"
```

---

## Task 9: `modules/submissionFeedback.js`

**Files:**
- Create: `modules/submissionFeedback.js`

- [ ] **Step 1: Write `modules/submissionFeedback.js`**

```js
ZF.SubmissionFeedback = (() => {
  let _toastEl = null;
  let _pollInterval = null;
  let _lastVerdict = null;
  let _hideTimeout = null;

  function createToast() {
    _toastEl = document.createElement('div');
    _toastEl.id = 'zf-toast';
    _toastEl.setAttribute('role', 'status');
    _toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(_toastEl);
  }

  function showToast(text, cls) {
    if (!_toastEl) return;
    clearTimeout(_hideTimeout);
    _toastEl.textContent = text;
    _toastEl.className = cls; // replaces all classes
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        _toastEl.classList.add('zf-visible');
        _hideTimeout = setTimeout(() => {
          _toastEl.classList.remove('zf-visible');
        }, 3000);
      })
    );
  }

  function check() {
    const SEL = ZF.SELECTORS;
    let verdictEl = null;
    for (const sel of SEL.latestVerdict) {
      try { verdictEl = document.querySelector(sel); } catch (_) {}
      if (verdictEl) break;
    }
    if (!verdictEl) return;

    const text = verdictEl.textContent.trim();
    if (!text || text === _lastVerdict) return;
    _lastVerdict = text;

    const cls = /accepted/i.test(text)   ? 'zf-accepted'
              : /wrong answer|time limit|memory limit|runtime error|compilation/i.test(text)
                                          ? 'zf-rejected'
              :                             'zf-other';
    showToast(text, cls);
  }

  return {
    _active: false,
    _processed: new WeakSet(),

    init(settings, node = document) {
      if (this._active) return;
      this._active = true;
      createToast();
      _pollInterval = setInterval(check, 2000);
      ZF.log('SubmissionFeedback: init');
    },

    destroy() {
      if (!this._active) return;
      this._active = false;
      clearInterval(_pollInterval);
      clearTimeout(_hideTimeout);
      _pollInterval = null;
      _lastVerdict = null;
      if (_toastEl) { _toastEl.remove(); _toastEl = null; }
      ZF.log('SubmissionFeedback: destroyed');
    },

    update(settings) {},

    onPageChange(url) {
      if (this._active) _lastVerdict = null;
    },
  };
})();
```

- [ ] **Step 2: Manually test in Chrome**

Enable Submission Feedback in popup.
Submit a solution to any Codeforces problem.

Expected:
- Within ~2s of verdict appearing on page, a toast slides in from top-right
- Green toast for "Accepted", red for "Wrong answer" / TLE / MLE / RE
- Toast disappears after 3 seconds

- [ ] **Step 3: Commit**

```bash
git add modules/submissionFeedback.js
git commit -m "feat: add submission feedback toast module"
```

---

## Task 10: `modules/focusMode.js`

**Files:**
- Create: `modules/focusMode.js`

- [ ] **Step 1: Write `modules/focusMode.js`**

```js
ZF.FocusMode = (() => {
  const SEL = () => ZF.SELECTORS;

  return {
    _active: false,
    _processed: new WeakSet(),

    init(settings, node = document) {
      if (this._active) {
        if (node !== document) this._process(node);
        return;
      }
      this._active = true;
      document.body.classList.add('zf-focus-mode');
      this._process(node);
      ZF.log('FocusMode: init');
    },

    destroy() {
      if (!this._active) return;
      this._active = false;
      this._processed = new WeakSet();
      document.body.classList.remove('zf-focus-mode');
      document.querySelectorAll('.zf-focus-hidden')
        .forEach(el => el.classList.remove('zf-focus-hidden'));
      ZF.log('FocusMode: destroyed');
    },

    update(settings) {},

    onPageChange(url) {
      if (!this._active) return;
      this._processed = new WeakSet();
      this._process(document);
    },

    _process(node) {
      SEL().focusTargets.forEach(sel => {
        let els;
        try {
          els = node === document
            ? document.querySelectorAll(sel)
            : (node.matches?.(sel) ? [node] : node.querySelectorAll(sel));
        } catch (_) { return; }
        els.forEach(el => {
          if (this._processed.has(el)) return;
          this._processed.add(el);
          el.classList.add('zf-focus-hidden');
        });
      });
    },
  };
})();
```

- [ ] **Step 2: Manually test in Chrome**

Enable Focus Mode in popup.
Navigate to `https://codeforces.com/contest/<any>/standings`.

Expected: Standings table is hidden.

- [ ] **Step 3: Commit**

```bash
git add modules/focusMode.js
git commit -m "feat: add focusMode module"
```

---

## Task 11: `content.js` Coordinator

**Files:**
- Create: `content.js`

- [ ] **Step 1: Write `content.js`**

```js
(() => {
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

  const REGISTRY = {
    ratingHider:        ZF.RatingHider,
    colorNeutralizer:   ZF.ColorNeutralizer,
    cleanUI:            ZF.CleanUI,
    timer:              ZF.Timer,
    submissionFeedback: ZF.SubmissionFeedback,
    focusMode:          ZF.FocusMode,
  };

  // FOUC guard: synchronously hide ratings before async storage resolves.
  // Removed only if ratingHider is confirmed disabled after storage loads.
  ZF.addStyle('zf-critical', `
    a.rated-user, .rating-link { color: inherit !important; }
    .user-rank, .rating { visibility: hidden; }
  `);

  let settings = { ...DEFAULTS };

  const onMutation = ZF.debounce((mutations) => {
    const nodes = [];
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) nodes.push(node);
      }
    }
    if (!nodes.length) return;

    nodes.forEach(node => {
      for (const [key, mod] of Object.entries(REGISTRY)) {
        if (key === 'timer') continue; // timer never processes mutations
        if (settings[key] && mod._active) mod.init(settings, node);
      }
    });
  }, 16);

  const observer = new MutationObserver(onMutation);

  function initModules(node = document) {
    for (const [key, mod] of Object.entries(REGISTRY)) {
      if (key === 'timer') continue;
      if (settings[key]) mod.init(settings, node);
      else mod.destroy();
    }
  }

  let lastUrl = location.href;

  const detectNav = ZF.debounce(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    ZF.log(`Nav: ${lastUrl}`);
    initModules();
    for (const mod of Object.values(REGISTRY)) {
      if (mod.onPageChange) mod.onPageChange(lastUrl);
    }
  }, 100);

  window.addEventListener('popstate', detectNav);
  window.addEventListener('hashchange', detectNav);
  setInterval(detectNav, 500);

  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }

    // Feature toggles
    for (const key of Object.keys(REGISTRY)) {
      if (!(key in changes)) continue;
      const mod = REGISTRY[key];
      if (settings[key]) {
        if (key === 'timer') mod.onPageChange(location.href);
        else mod.init(settings);
      } else {
        mod.destroy();
      }
    }

    // Sub-setting live updates
    if ('usernameColor' in changes) ZF.ColorNeutralizer.update(settings);
    if ('timerMode' in changes) ZF.Timer.update(settings);
  });

  function boot(stored) {
    settings = ZF.mergeSettings(stored, DEFAULTS);
    if (!settings.ratingHider) ZF.removeStyle('zf-critical');
    observer.observe(document.body, { childList: true, subtree: true });
    initModules();
    if (settings.timer) ZF.Timer.onPageChange(location.href);
  }

  // Apply defaults immediately (prevents blocking on slow storage)
  boot(DEFAULTS);

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    if (chrome.runtime.lastError) {
      ZF.log(`Storage error: ${chrome.runtime.lastError.message}`);
      return;
    }
    // Re-boot with real stored settings
    for (const mod of Object.values(REGISTRY)) mod.destroy();
    boot(stored);
  });

})();
```

- [ ] **Step 2: Reload extension and test coordinator**

Reload extension. Navigate to `https://codeforces.com`.

Expected:
- Core features active (ratings hidden, colors neutral, clean UI)
- No console errors
- Toggling features in popup takes effect immediately without page refresh

- [ ] **Step 3: Test AJAX navigation**

While on `https://codeforces.com`, click a problem link. 
Expected: Ratings are still hidden on the new page, no stale state.

- [ ] **Step 4: Commit**

```bash
git add content.js
git commit -m "feat: add coordinator with MutationObserver, AJAX nav detection, storage sync"
```

---

## Task 12: Popup HTML + CSS

**Files:**
- Create: `popup/popup.html`
- Create: `popup/popup.css`

- [ ] **Step 1: Write `popup/popup.html`**

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
        <span class="zf-chevron" aria-hidden="true">▾</span>
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
      <div class="zf-color-row">
        <label class="zf-label" for="username-color">Username Color</label>
        <div class="zf-color-picker-wrap">
          <span class="zf-color-preview" id="color-preview" aria-hidden="true"></span>
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

- [ ] **Step 2: Write `popup/popup.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  background: #1a1a1a;
  color: #e0e0e0;
  width: 300px;
  min-height: 180px;
}

.zf-popup { padding: 0 0 4px; }

/* Header */
.zf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px 10px;
  border-bottom: 1px solid #2a2a2a;
}
.zf-logo  { font-weight: 700; font-size: 14px; letter-spacing: 0.02em; }
.zf-version { font-size: 11px; color: #555; }

/* Sections */
.zf-section { border-bottom: 1px solid #222; }

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

/* Toggle switch */
.zf-toggle {
  appearance: none;
  -webkit-appearance: none;
  width: 36px;
  height: 20px;
  background: #444;
  border-radius: 20px;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease;
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

/* Extras section */
.zf-extras-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 16px;
  background: none;
  border: none;
  color: #888;
  font-size: 11px;
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

/* Smooth expand via max-height — do NOT use [hidden] attribute */
.zf-extras-content {
  overflow: hidden;
  max-height: 150px;
  transition: max-height 0.2s ease;
}
.zf-extras-content.zf-collapsed {
  max-height: 0;
}

/* Color row */
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
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #555;
  display: inline-block;
  flex-shrink: 0;
}
#username-color {
  width: 36px;
  height: 22px;
  border: none;
  border-radius: 4px;
  padding: 0 2px;
  cursor: pointer;
  background: none;
}
#username-color:disabled { opacity: 0.35; cursor: not-allowed; }

/* Footer */
.zf-footer {
  padding: 10px 16px 6px;
  font-size: 11px;
  color: #444;
  text-align: center;
  font-style: italic;
}
```

- [ ] **Step 3: Reload extension, open popup**

Click the Zenforces toolbar icon.

Expected:
- Dark popup 300px wide
- Three ON toggles (blue), three extras hidden behind collapse
- Footer text visible
- No layout breaks

- [ ] **Step 4: Commit**

```bash
git add popup/popup.html popup/popup.css
git commit -m "feat: add popup HTML and CSS with toggle switches"
```

---

## Task 13: `popup/popup.js`

**Files:**
- Create: `popup/popup.js`

- [ ] **Step 1: Write `popup/popup.js`**

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

const FEATURE_KEYS = [
  'ratingHider', 'colorNeutralizer', 'cleanUI',
  'timer', 'submissionFeedback', 'focusMode',
];

function applySettings(settings) {
  FEATURE_KEYS.forEach(key => {
    const el = document.getElementById(`toggle-${key}`);
    if (el) el.checked = !!settings[key];
  });

  // Color picker
  const colorInput   = document.getElementById('username-color');
  const colorPreview = document.getElementById('color-preview');
  const isColorOn    = !!settings.colorNeutralizer;
  colorInput.value   = settings.usernameColor || DEFAULTS.usernameColor;
  colorPreview.style.background = colorInput.value;
  colorInput.disabled = !isColorOn;

  // Extras expand state
  const extrasToggle  = document.getElementById('extras-toggle');
  const extrasContent = document.getElementById('extras-content');
  const expanded = !!settings.extrasExpanded;
  extrasToggle.setAttribute('aria-expanded', String(expanded));
  extrasContent.classList.toggle('zf-collapsed', !expanded);
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    applySettings({ ...DEFAULTS, ...stored });
  });

  // Feature toggles
  FEATURE_KEYS.forEach(key => {
    const el = document.getElementById(`toggle-${key}`);
    if (!el) return;
    el.addEventListener('change', () => {
      chrome.storage.sync.set({ [key]: el.checked });
      if (key === 'colorNeutralizer') {
        const colorInput = document.getElementById('username-color');
        colorInput.disabled = !el.checked;
      }
    });
  });

  // Color picker — update preview + storage on every input event
  const colorInput   = document.getElementById('username-color');
  const colorPreview = document.getElementById('color-preview');
  colorInput.addEventListener('input', () => {
    colorPreview.style.background = colorInput.value;
    if (/^#[0-9a-fA-F]{6}$/.test(colorInput.value)) {
      chrome.storage.sync.set({ usernameColor: colorInput.value });
    }
  });

  // Extras expand/collapse — persists state
  const extrasToggle  = document.getElementById('extras-toggle');
  const extrasContent = document.getElementById('extras-content');
  extrasToggle.addEventListener('click', () => {
    const next = extrasToggle.getAttribute('aria-expanded') !== 'true';
    extrasToggle.setAttribute('aria-expanded', String(next));
    extrasContent.classList.toggle('zf-collapsed', !next);
    chrome.storage.sync.set({ extrasExpanded: next });
  });
});
```

- [ ] **Step 2: Test popup full flow**

Open popup. Toggle each feature on/off.

Expected:
- Every toggle change immediately reflects on the Codeforces tab (open alongside) without page refresh
- Changing username color updates the page's username colors live
- Extras section expands/collapses with smooth animation
- Expanded/collapsed state persists after closing and reopening popup

- [ ] **Step 3: Test color picker disabled state**

Turn OFF "Neutralize Username Colors".

Expected: Color picker input is greyed out and non-interactive.

- [ ] **Step 4: Commit**

```bash
git add popup/popup.js
git commit -m "feat: add popup.js with storage-driven toggle UI"
```

---

## Task 14: Integration Test & Final Polish

**Files:**
- Modify: `modules/selectors.js` (tune if needed after live testing)

- [ ] **Step 1: Full integration test on codeforces.com**

Load the extension. Open `https://codeforces.com` and verify each of the following:

| Scenario | Expected |
|---|---|
| Home page | Username links in blue, no rank colors, footer hidden |
| Profile page (`/profile/<handle>`) | Rating numbers invisible, rank label invisible |
| Problemset page | Ratings in ranklist hidden |
| Problem page | No clutter elements, ratings hidden |
| Submission page | Verdict toast appears within 2s after judging |
| Contest standings | Focus mode hides standings table when enabled |
| AJAX navigation | Features persist across page changes without re-enabling |
| Toggle rapidly | No duplicate DOM elements, no memory leaks |
| Storage sync | Settings persist after browser restart |

- [ ] **Step 2: Verify no console errors on any CF page**

Open DevTools on each page type above.
Expected: Zero errors, zero uncaught exceptions.

- [ ] **Step 3: Tune selectors if needed**

If any selectors fail to match real CF elements, update `modules/selectors.js`.
The structure is flat — one edit, all modules benefit.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: zenforces v1.0 complete — all modules integrated and tested"
```

---

## Self-Review Checklist

- [x] `manifest.json` — Task 1 ✓
- [x] `utils.js` with tests — Task 2 ✓
- [x] `selectors.js` — Task 3 ✓
- [x] `styles.css` — Task 4 ✓
- [x] `ratingHider.js` — Task 5 ✓
- [x] `colorNeutralizer.js` — Task 6 ✓
- [x] `cleanUI.js` — Task 7 ✓
- [x] `timer.js` — Task 8 ✓
- [x] `submissionFeedback.js` — Task 9 ✓
- [x] `focusMode.js` — Task 10 ✓
- [x] `content.js` coordinator — Task 11 ✓
- [x] `popup.html` + `popup.css` — Task 12 ✓
- [x] `popup.js` — Task 13 ✓
- [x] Integration test — Task 14 ✓
- [x] FOUC prevention — content.js Task 11 ✓
- [x] Per-module WeakSet — all modules ✓
- [x] `zf-` prefix on all classes — styles.css + all modules ✓
- [x] `destroy()` full cleanup — all modules ✓
- [x] Timer avoids MutationObserver — Timer module, coordinator skips it ✓
- [x] Extras expand animation uses max-height not `hidden` attr — Task 12 ✓
- [x] `isValidTimerMode` uses `.includes()` not `.test()` — utils.js ✓
