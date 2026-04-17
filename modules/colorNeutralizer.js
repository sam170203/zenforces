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
