(function() {
  'use strict';

  const DEFAULTS = {
    ratingHider:        true,
    colorNeutralizer:   true,
    cleanUI:            true,
    submissionFeedback: false,
    successSound:       false,
    usernameColor:      '#4a90d9',
    extrasExpanded:     false,
    theme:              'none',
  };

  const REGISTRY = {
    ratingHider:        ZF.RatingHider,
    colorNeutralizer:   ZF.ColorNeutralizer,
    cleanUI:            ZF.CleanUI,
    submissionFeedback: ZF.SubmissionFeedback,
  };

  let settingsCache = Object.assign({}, DEFAULTS);
  let initialized = false;

  const THEME_STYLE_ID = 'zf-theme-inline';

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
    let style = document.getElementById(THEME_STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = THEME_STYLE_ID;
      document.head.appendChild(style);
    }
    const data = THEME_VARS[theme];
    if (!data || theme === 'none') {
      style.textContent = '';
      return;
    }
    style.textContent = `:root { --zf-bg: ${data.bg} !important; --zf-bg-panel: ${data.panel} !important; --zf-bg-alt: ${data.alt} !important; --zf-text: ${data.text} !important; --zf-text-dim: ${data.dim} !important; --zf-accent: ${data.accent} !important; --zf-accent2: ${data.accent2} !important; --zf-border: ${data.border} !important; }`;
  }

  function applyBodyTheme(theme) {
    const themes = ['zen-dark', 'deep-blue', 'soft-light', 'warm-minimal', 'midnight-pro'];
    themes.forEach(t => document.body.classList.remove(`zf-theme-${t}`));
    if (theme !== 'none' && themes.includes(theme)) {
      document.body.classList.add(`zf-theme-${theme}`);
    }
  }

  ZF.addStyle('zf-critical', `.user-rank, .rating, .max-rating-box, .userbox-rating, .rating-overview, .personal-sidebar .rating-badge, .user-rank-block, div.info .rating, .main-info .rating, .rating-badge { display: none !important; }`);

  function initAllModules(node) {
    node = node || document;
    for (const key in REGISTRY) {
      const mod = REGISTRY[key];
      if (settingsCache[key]) {
        mod.init(settingsCache, node);
      }
    }
  }

  function reinitAll() {
    for (const key in REGISTRY) {
      const mod = REGISTRY[key];
      mod._active = false;
      mod._processed = new WeakSet();
      if (settingsCache[key]) {
        mod.init(settingsCache, document);
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
            const mod = REGISTRY[key];
            if (settingsCache[key] && mod._active && mod.init) {
              mod.init(settingsCache, node);
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
    reinitAll();
    applyBodyTheme(settingsCache.theme);
    applyThemeInline(settingsCache.theme);
  }

  const debouncedNav = ZF.debounce(handleNavigation, 100);

  window.addEventListener('popstate', debouncedNav);
  window.addEventListener('hashchange', debouncedNav);
  setInterval(() => { if (location.href !== lastUrl) debouncedNav(); }, 500);

  const origPush = history.pushState;
  history.pushState = function() { origPush.apply(history, arguments); debouncedNav(); };
  const origReplace = history.replaceState;
  history.replaceState = function() { origReplace.apply(history, arguments); debouncedNav(); };

  function boot(data) {
    settingsCache = Object.assign({}, DEFAULTS, data);
    initialized = true;
    applyBodyTheme(settingsCache.theme);
    applyThemeInline(settingsCache.theme);
    setupObserver();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    initAllModules(document);
  }

  applyThemeInline(settingsCache.theme);

  if (document.body) {
    boot(DEFAULTS);
  } else {
    document.addEventListener('DOMContentLoaded', function() { boot(DEFAULTS); }, { once: true });
  }

  chrome.storage.sync.get(null, function(data) {
    if (chrome.runtime.lastError) {
      ZF.log('Storage error: ' + chrome.runtime.lastError.message);
      return;
    }
    if (initialized) {
      reinitAll();
    } else {
      boot(data);
    }
  });

})();