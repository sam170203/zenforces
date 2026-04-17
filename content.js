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
    theme:              'none',
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

  // FOUC guard: synchronously hide ratings before async storage resolves.
  // Removed only if ratingHider is confirmed disabled after storage loads.
  ZF.addStyle('zf-critical', `
    a.rated-user, .rating-link { color: inherit !important; }
    .user-rank, .rating, .max-rating-box, .userbox-rating,
    .rating-overview, .personal-sidebar .rating-badge,
    .user-rank-block, div.info .rating, .main-info .rating { visibility: hidden; }
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
        mod.init(settings);
      } else {
        mod.destroy();
      }
    }

    // Sub-setting live updates
    if ('usernameColor' in changes) ZF.ColorNeutralizer.update(settings);
    if ('timerMode' in changes) ZF.Timer.update(settings);
    if ('theme' in changes) ZF.ThemeManager.update(settings);
  });

  function boot(stored) {
    settings = ZF.mergeSettings(stored, DEFAULTS);
    if (!settings.ratingHider) ZF.removeStyle('zf-critical');
    observer.observe(document.body, { childList: true, subtree: true });
    initModules();
    ZF.ThemeManager.init(settings);
    if (settings.timer) ZF.Timer.onPageChange(location.href);
  }

  // Apply defaults immediately. Defer if body isn't ready yet (run_at: document_start).
  if (document.body) {
    boot(DEFAULTS);
  } else {
    document.addEventListener('DOMContentLoaded', () => boot(DEFAULTS), { once: true });
  }

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    if (chrome.runtime.lastError) {
      ZF.log(`Storage error: ${chrome.runtime.lastError.message}`);
      return;
    }
    // Re-boot with real stored settings. All module init/destroy must stay synchronous
    // for this two-phase boot to be safe.
    for (const mod of Object.values(REGISTRY)) mod.destroy();
    boot(stored);
  });

})();
