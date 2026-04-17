ZF.ColorNeutralizer = (() => {
  const USERNAME_SELECTORS = [
    'a.rated-user',
    '.rating-link',
    '[class*="rated-user"]',
    '.contestant-name a',
  ];

  function validColor(val) {
    return ZF.isValidHex(val) ? val : '#4a90d9';
  }

  function applyColor(color) {
    document.documentElement.style.setProperty('--zf-username-color', color);
  }

  function applyInlineColor(el, color) {
    el.style.setProperty('color', color, 'important');
  }

  return {
    _active: false,
    _processed: new WeakSet(),
    _currentColor: '#4a90d9',

    init(settings, node = document) {
      if (this._active) {
        if (node !== document) this._process(node);
        return;
      }
      this._active = true;
      this._currentColor = validColor(settings.usernameColor);
      document.body.classList.add('zf-neutral-colors');
      applyColor(this._currentColor);
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
      this._currentColor = validColor(settings.usernameColor);
      applyColor(this._currentColor);
    },

    onPageChange(url) {
      if (!this._active) return;
      this._processed = new WeakSet();
      this._process(document);
    },

    _process(node) {
      const root = node === document ? document : node;

      for (const sel of USERNAME_SELECTORS) {
        try {
          const els = root.querySelectorAll(sel);
          els.forEach(el => {
            if (this._processed.has(el)) return;
            this._processed.add(el);
            applyInlineColor(el, this._currentColor);
          });
        } catch (_) {}
      }

      if (root !== document) {
        try {
          const directMatch = root.matches?.(sel => USERNAME_SELECTORS.includes(sel));
          if (directMatch) {
            if (!this._processed.has(root)) {
              this._processed.add(root);
              applyInlineColor(root, this._currentColor);
            }
          }
        } catch (_) {}
      }
    },
  };
})();
