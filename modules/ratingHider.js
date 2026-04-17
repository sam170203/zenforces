ZF.RatingHider = (() => {
  const SEL = () => ZF.SELECTORS;

  // Containers scoped for text-based scanning — profile/sidebar/userbox only.
  // Never includes problem content or submission tables.
  const SCAN_ROOTS = [
    'div.info',
    '.main-info',
    '.personal-sidebar',
    '#userbox',
    '.userbox-rating',
    '.max-rating-box',
    '.rating-overview',
    '.user-rank-block',
  ];

  // Matches standalone rank name text nodes (full match only).
  const RANK_RE = /^(newbie|pupil|specialist|expert|candidate\s+master|master|international\s+(grand)?master|legendary\s+grandmaster|grandmaster)$/i;

  // Matches rows/cells that label rating values.
  const RATING_LABEL_RE = /\b(contest\s+rating|max\.?\s*rating|current\s+rating|global\s+rating)\s*[:\d]/i;

  // Prefer hiding at row-level (<li>/<tr>) to avoid collateral damage.
  function findTarget(textNode) {
    const ROW_TAGS  = new Set(['LI', 'TR']);
    const STOP_TAGS = new Set(['TABLE', 'TBODY', 'UL', 'OL', 'SECTION', 'BODY']);
    let el = textNode.parentElement;
    let rowTarget = null;
    while (el && !STOP_TAGS.has(el.tagName)) {
      if (ROW_TAGS.has(el.tagName)) rowTarget = el;
      el = el.parentElement;
    }
    return rowTarget || textNode.parentElement;
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
      document.body.classList.add('zf-hide-ratings');
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

    update(settings) {},

    onPageChange(url) {
      if (!this._active) return;
      this._processed = new WeakSet();
      this._process(document);
    },

    _process(node) {
      // ── Pass 1: selector-based tagging ──────────────────────────────
      const s = SEL();
      const allSelectors = [...s.ratings, ...s.rankLabels, ...s.usernames];

      allSelectors.forEach(sel => {
        let els;
        try {
          els = node === document
            ? document.querySelectorAll(sel)
            : (node.matches?.(sel) ? [node] : node.querySelectorAll(sel));
        } catch (_) { return; }
        els.forEach(el => {
          if (this._processed.has(el)) return;
          this._processed.add(el);
          el.classList.add('zf-rating-hidden');
        });
      });

      // ── Pass 2: text-based scan inside scoped containers ────────────
      this._textScan(node);
    },

    _textScan(root) {
      for (const sel of SCAN_ROOTS) {
        let containers;
        try {
          if (root === document) {
            containers = [...document.querySelectorAll(sel)];
          } else if (root.matches?.(sel)) {
            containers = [root];
          } else {
            containers = [...(root.querySelectorAll?.(sel) ?? [])];
          }
        } catch (_) { continue; }

        for (const container of containers) {
          this._walkContainer(container);
        }
      }
    },

    _walkContainer(container) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (!text) continue;
        if (RANK_RE.test(text) || RATING_LABEL_RE.test(text)) {
          const target = findTarget(node);
          if (target && !this._processed.has(target)) {
            this._processed.add(target);
            target.classList.add('zf-rating-hidden');
          }
        }
      }
    },
  };
})();
