ZF.RatingHider = (() => {
  const SEL = () => ZF.SELECTORS; // lazy ref — selectors loads after utils

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
      ZF.removeStyle('zf-critical');
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
