(function() {
  'use strict';

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

  let settings = Object.assign({}, DEFAULTS);
  let storageReady = false;

  const THEME_INLINE_STYLE_ID = 'zf-theme-inline-vars';

  const THEME_VARS = {
    'zen-dark': {
      bg: '#020617', panel: '#0f172a', alt: '#111827',
      text: '#e2e8f0', dim: '#94a3b8', accent: '#3b82f6', accent2: '#60a5fa', border: '#1f2937'
    },
    'deep-blue': {
      bg: '#020c1b', panel: '#0a192f', alt: '#112240',
      text: '#e6f1ff', dim: '#8892b0', accent: '#00e0ff', accent2: '#00bcd4', border: '#1b3a5c'
    },
    'soft-light': {
      bg: '#ffffff', panel: '#f1f5f9', alt: '#e2e8f0',
      text: '#1e293b', dim: '#64748b', accent: '#2563eb', accent2: '#3b82f6', border: '#cbd5e1'
    },
    'warm-minimal': {
      bg: '#fff7ed', panel: '#ffedd5', alt: '#fed7aa',
      text: '#3e2723', dim: '#78716c', accent: '#ea580c', accent2: '#f97316', border: '#fdba74'
    },
    'midnight-pro': {
      bg: '#000814', panel: '#001d3d', alt: '#003566',
      text: '#f8f9fa', dim: '#adb5bd', accent: '#ffd60a', accent2: '#ffc300', border: '#1a4d7c'
    },
  };

  function applyThemeInline(theme) {
    const style = document.getElementById(THEME_INLINE_STYLE_ID) || (() => {
      const s = document.createElement('style');
      s.id = THEME_INLINE_STYLE_ID;
      document.head.appendChild(s);
      return s;
    })();

    const themeData = THEME_VARS[theme];
    if (!themeData || theme === 'none') {
      style.textContent = '';
      return;
    }

    style.textContent = `
      :root {
        --zf-bg: ${themeData.bg} !important;
        --zf-bg-panel: ${themeData.panel} !important;
        --zf-bg-alt: ${themeData.alt} !important;
        --zf-text: ${themeData.text} !important;
        --zf-text-dim: ${themeData.dim} !important;
        --zf-accent: ${themeData.accent} !important;
        --zf-accent2: ${themeData.accent2} !important;
        --zf-border: ${themeData.border} !important;
      }
    `;
  }

  ZF.addStyle('zf-critical', `
    a.rated-user, .rating-link { color: inherit !important; }
    .user-rank, .rating, .max-rating-box, .userbox-rating,
    .rating-overview, .personal-sidebar .rating-badge,
    .user-rank-block, div.info .rating, .main-info .rating,
    .rating-badge, .contest-cell .rating { display: none !important; }
  `);

  function applyBodyTheme(theme) {
    const themeClasses = ['zen-dark', 'deep-blue', 'soft-light', 'warm-minimal', 'midnight-pro'];
    document.body.classList.remove(...themeClasses.map(t => `zf-theme-${t}`));
    if (theme !== 'none' && themeClasses.includes(theme)) {
      document.body.classList.add(`zf-theme-${theme}`);
    }
  }

  function initModules(node) {
    node = node || document;
    for (const key in REGISTRY) {
      if (key === 'timer') continue;
      const mod = REGISTRY[key];
      if (settings[key] && mod._active) {
        if (node === document) mod.init(settings, document);
        else mod.init(settings, node);
      }
    }
  }

  function reinitAllModules() {
    for (const key in REGISTRY) {
      if (key === 'timer') continue;
      const mod = REGISTRY[key];
      if (settings[key]) {
        mod._active = false;
        mod._processed = new WeakSet();
        mod.init(settings, document);
      }
    }
  }

  let observer;

  function setupObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          for (const key in REGISTRY) {
            if (key === 'timer') continue;
            const mod = REGISTRY[key];
            if (settings[key] && mod._active) {
              mod.init(settings, node);
            }
          }
        }
      }
    });
  }

  let lastUrl = location.href;

  function handleNavigation() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    ZF.log('Nav: ' + lastUrl);
    setupObserver();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    reinitAllModules();
    for (const key in REGISTRY) {
      const mod = REGISTRY[key];
      if (mod.onPageChange) mod.onPageChange(lastUrl);
    }
  }

  const debouncedNav = ZF.debounce(handleNavigation, 100);

  window.addEventListener('popstate', debouncedNav);
  window.addEventListener('hashchange', debouncedNav);
  setInterval(() => {
    if (location.href !== lastUrl) debouncedNav();
  }, 500);

  const origPushState = history.pushState;
  history.pushState = function() {
    origPushState.apply(history, arguments);
    debouncedNav();
  };
  const origReplaceState = history.replaceState;
  history.replaceState = function() {
    origReplaceState.apply(history, arguments);
    debouncedNav();
  };

  chrome.storage.onChanged.addListener((changes) => {
    for (const key in changes) {
      settings[key] = changes[key].newValue;
    }

    for (const key in REGISTRY) {
      if (!(key in changes)) continue;
      const mod = REGISTRY[key];
      if (settings[key]) {
        mod.init(settings, document);
      } else {
        mod.destroy();
      }
    }

    if ('usernameColor' in changes) {
      ZF.ColorNeutralizer.update(settings);
    }
    if ('timerMode' in changes) ZF.Timer.update(settings);
    if ('successSound' in changes) ZF.SubmissionFeedback.update(settings);
    if ('theme' in changes) {
      applyBodyTheme(settings.theme);
      applyThemeInline(settings.theme);
      ZF.ThemeManager.update(settings);
    }
  });

  function boot(stored) {
    settings = Object.assign({}, DEFAULTS, stored);
    storageReady = true;

    if (!settings.ratingHider) ZF.removeStyle('zf-critical');

    applyBodyTheme(settings.theme);
    applyThemeInline(settings.theme);

    setupObserver();
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    initModules(document);
    ZF.ThemeManager.init(settings);
    if (settings.timer) ZF.Timer.onPageChange(location.href);
  }

  applyThemeInline(settings.theme);

  if (document.body) {
    boot(DEFAULTS);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      boot(DEFAULTS);
    }, { once: true });
  }

  chrome.storage.sync.get(DEFAULTS, function(stored) {
    if (chrome.runtime.lastError) {
      ZF.log('Storage error: ' + chrome.runtime.lastError.message);
      return;
    }
    if (storageReady) {
      settings = Object.assign({}, DEFAULTS, stored);
      applyBodyTheme(settings.theme);
      applyThemeInline(settings.theme);
      reinitAllModules();
      ZF.ThemeManager.init(settings);
    } else {
      boot(stored);
    }
  });

})();
