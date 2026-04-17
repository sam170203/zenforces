(() => {
  const DEFAULTS = {
    ratingHider:        true,
    colorNeutralizer:   true,
    cleanUI:            true,
    timer:              false,
    submissionFeedback: false,
    successSound:       false,
    focusMode:          false,
    usernameColor:      '#4a90d9',
    timerMode:          'stopwatch',
    extrasExpanded:     false,
    theme:              'none',
  };

  const REGISTRY = {
    ratingHider:        ZF.RatingHider,
    colorNeutralizer:   ZF.ColorNeutralizer,
    cleanUI:            ZF.CleanUI,
    timer:              ZF.Timer,
    submissionFeedback: ZF.SubmissionFeedback,
    focusMode:          ZF.FocusMode,
  };

  ZF.addStyle('zf-critical', `
    a.rated-user, .rating-link { color: inherit !important; }
    .user-rank, .rating, .max-rating-box, .userbox-rating,
    .rating-overview, .personal-sidebar .rating-badge,
    .user-rank-block, div.info .rating, .main-info .rating { display: none !important; }
  `);

  let settings = { ...DEFAULTS };
  let storageReady = false;

  function initModules(node = document) {
    for (const [key, mod] of Object.entries(REGISTRY)) {
      if (key === 'timer') continue;
      if (settings[key]) mod.init(settings, node);
      else mod.destroy();
    }
  }

  function applyTheme(theme) {
    const themeClasses = ['zen-dark', 'deep-blue', 'soft-light', 'warm-minimal', 'midnight-pro'];
    themeClasses.forEach(t => document.body.classList.remove(`zf-theme-${t}`));
    if (theme !== 'none' && themeClasses.includes(theme)) {
      document.body.classList.add(`zf-theme-${theme}`);
    }
  }

  ZF.addStyle('zf-theme-inline', '');

  function applyThemeInline(theme) {
    const themeMap = {
      'zen-dark': { bg: '#020617', panel: '#0f172a', text: '#e2e8f0', accent: '#3b82f6' },
      'deep-blue': { bg: '#020c1b', panel: '#0a192f', text: '#e6f1ff', accent: '#00e0ff' },
      'soft-light': { bg: '#ffffff', panel: '#f1f5f9', text: '#1e293b', accent: '#2563eb' },
      'warm-minimal': { bg: '#fff7ed', panel: '#ffedd5', text: '#3e2723', accent: '#ea580c' },
      'midnight-pro': { bg: '#000814', panel: '#001d3d', text: '#f8f9fa', accent: '#ffd60a' },
    };
    if (theme === 'none' || !themeMap[theme]) return;
    const t = themeMap[theme];
    document.documentElement.style.setProperty('--zf-bg', t.bg);
    document.documentElement.style.setProperty('--zf-bg-panel', t.panel);
    document.documentElement.style.setProperty('--zf-text', t.text);
    document.documentElement.style.setProperty('--zf-accent', t.accent);
  }

  function clearThemeInline() {
    document.documentElement.style.removeProperty('--zf-bg');
    document.documentElement.style.removeProperty('--zf-bg-panel');
    document.documentElement.style.removeProperty('--zf-text');
    document.documentElement.style.removeProperty('--zf-accent');
  }

  const onMutation = (mutations) => {
    const nodes = [];
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) nodes.push(node);
      }
    }
    if (!nodes.length) return;

    nodes.forEach(node => {
      for (const [key, mod] of Object.entries(REGISTRY)) {
        if (key === 'timer') continue;
        if (settings[key] && mod._active) mod.init(settings, node);
      }
    });
  };

  const observer = new MutationObserver(onMutation);

  let lastUrl = location.href;

  function handleNavigation() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    ZF.log(`Nav: ${lastUrl}`);
    initModules(document);
    for (const mod of Object.entries(REGISTRY)) {
      const [, m] = mod;
      if (m.onPageChange) m.onPageChange(lastUrl);
    }
  }

  const debouncedNav = ZF.debounce(handleNavigation, 100);

  window.addEventListener('popstate', debouncedNav);
  window.addEventListener('hashchange', debouncedNav);
  setInterval(debouncedNav, 500);

  const origPushState = history.pushState;
  history.pushState = function(...args) {
    origPushState.apply(this, args);
    debouncedNav();
  };
  const origReplaceState = history.replaceState;
  history.replaceState = function(...args) {
    origReplaceState.apply(this, args);
    debouncedNav();
  };

  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }

    for (const key of Object.keys(REGISTRY)) {
      if (!(key in changes)) continue;
      const mod = REGISTRY[key];
      if (settings[key]) {
        mod.init(settings, document);
      } else {
        mod.destroy();
      }
    }

    if ('usernameColor' in changes) ZF.ColorNeutralizer.update(settings);
    if ('timerMode' in changes) ZF.Timer.update(settings);
    if ('successSound' in changes) ZF.SubmissionFeedback.update(settings);
    if ('theme' in changes) {
      applyTheme(settings.theme);
      applyThemeInline(settings.theme);
      ZF.ThemeManager.update(settings);
    }
  });

  function boot(stored) {
    settings = ZF.mergeSettings(stored, DEFAULTS);
    storageReady = true;
    
    if (!settings.ratingHider) ZF.removeStyle('zf-critical');
    
    applyTheme(settings.theme);
    applyThemeInline(settings.theme);
    
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    
    initModules(document);
    ZF.ThemeManager.init(settings);
    if (settings.timer) ZF.Timer.onPageChange(location.href);
  }

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    if (chrome.runtime.lastError) {
      ZF.log(`Storage error: ${chrome.runtime.lastError.message}`);
      boot(DEFAULTS);
      return;
    }
    boot(stored);
  });

})();
