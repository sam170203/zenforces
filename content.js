(() => {
  'use strict';

  const DEFAULTS = {
    enabled:            true,
    ratingHider:        true,
    colorNeutralizer:   true,
    cleanUI:            true,
    submissionFeedback: false,
    usernameColor:      '#4a90d9',
    theme:              'none',
  };

  const REGISTRY = {
    ratingHider:        ZF.RatingHider,
    colorNeutralizer:   ZF.ColorNeutralizer,
    cleanUI:            ZF.CleanUI,
    submissionFeedback: ZF.SubmissionFeedback,
  };

  const THEME_NAMES = [
    'zen-dark', 'deep-blue', 'soft-light', 'warm-minimal', 'midnight-pro',
    'twilight', 'noir', 'oceanic', 'solar',
  ];

  let settings = { ...DEFAULTS };
  let observer = null;

  // ── FOUC guard: runs synchronously at document_start ────────────────
  // Hides rating elements before the async storage read resolves.
  // Removed by ratingHider.destroy() if the feature is disabled.
  ZF.addStyle('zf-critical',
    '.user-rank,.rating,.max-rating-box,.userbox-rating,' +
    '.rating-overview,.personal-sidebar .rating-badge,' +
    '.user-rank-block,div.info .rating,.main-info .rating,' +
    '.rating-badge{visibility:hidden!important;}'
  );

  // ── Theme ────────────────────────────────────────────────────────────
  function applyTheme(theme) {
    THEME_NAMES.forEach(t => document.body.classList.remove('zf-theme-' + t));
    if (THEME_NAMES.includes(theme)) document.body.classList.add('zf-theme-' + theme);
  }

  // ── Module management ────────────────────────────────────────────────
  function initAll(node) {
    node = node || document;
    for (const [key, mod] of Object.entries(REGISTRY)) {
      if (settings[key]) mod.init(settings, node);
      else if (mod._active) mod.destroy();
    }
  }

  function destroyAll() {
    for (const mod of Object.values(REGISTRY)) {
      if (mod._active) mod.destroy();
    }
  }

  // ── MutationObserver ─────────────────────────────────────────────────
  // Debounced so burst DOM mutations don't thrash; processes only element nodes.
  const onMutation = ZF.debounce((mutations) => {
    const nodes = [];
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1) nodes.push(n);
      }
    }
    if (!nodes.length) return;
    for (const node of nodes) {
      for (const [key, mod] of Object.entries(REGISTRY)) {
        if (settings[key] && mod._active) mod.init(settings, node);
      }
    }
  }, 16);

  function startObserver() {
    if (!observer) observer = new MutationObserver(onMutation);
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── SPA navigation detection ─────────────────────────────────────────
  let lastUrl = location.href;

  const onNav = ZF.debounce(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    ZF.log('Nav: ' + lastUrl);
    for (const [key, mod] of Object.entries(REGISTRY)) {
      if (settings[key] && mod._active && mod.onPageChange) mod.onPageChange(lastUrl);
    }
    initAll(document);
  }, 100);

  window.addEventListener('popstate', onNav);
  window.addEventListener('hashchange', onNav);
  setInterval(() => { if (location.href !== lastUrl) onNav(); }, 500);
  ['pushState', 'replaceState'].forEach(m => {
    const orig = history[m];
    history[m] = function () { orig.apply(history, arguments); onNav(); };
  });

  // ── Enable / Disable ─────────────────────────────────────────────────
  function enable() {
    applyTheme(settings.theme);
    startObserver();
    initAll(document);
  }

  function disable() {
    destroyAll();
    applyTheme('none');
    ZF.removeStyle('zf-critical');
    if (observer) { observer.disconnect(); observer = null; }
  }

  // ── Live storage updates ──────────────────────────────────────────────
  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }

    if ('enabled' in changes) {
      settings.enabled ? enable() : disable();
      return;
    }

    if (!settings.enabled) return;

    for (const key of Object.keys(REGISTRY)) {
      if (!(key in changes)) continue;
      const mod = REGISTRY[key];
      if (settings[key]) mod.init(settings);
      else mod.destroy();
    }

    if ('usernameColor' in changes) ZF.ColorNeutralizer.update(settings);
    if ('theme' in changes) applyTheme(settings.theme);
  });

  // ── Boot — single execution after storage resolves ───────────────────
  function boot(stored) {
    settings = { ...DEFAULTS, ...stored };
    if (!settings.enabled) {
      ZF.removeStyle('zf-critical');
      return;
    }
    enable();
  }

  function run() {
    chrome.storage.sync.get(DEFAULTS, (stored) => {
      if (chrome.runtime.lastError) {
        ZF.log('Storage error: ' + chrome.runtime.lastError.message);
        boot({});
        return;
      }
      boot(stored);
    });
  }

  // document_start: body may not exist yet. DOMContentLoaded is the safe
  // fallback; by then storage will also have resolved.
  if (document.body) {
    run();
  } else {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }
})();
