ZF.RatingHider = (() => {
  const SEL = () => ZF.SELECTORS;

  const SCAN_ROOTS_PROFILE = [
    'div.info',
    '.main-info',
    '.personal-sidebar',
    '#userbox',
    '.userbox-rating',
    '.max-rating-box',
    '.rating-overview',
    '.user-rank-block',
    '.profile-info',
    '.contest-cell',
  ];

  const RATING_TEXT_RE = /(contest\s*rating|rating\s*:|max\.|newbie|pupil|specialist|expert|candidate master|master|grandmaster)/i;

  const SAFE_ZONES = [
    'pre',
    'code',
    '.problem-statement',
    '.sample-tests',
    '.input',
    '.output',
    '.answer',
  ];

  function isInSafeZone(el) {
    for (const sel of SAFE_ZONES) {
      if (el.closest?.(sel)) return true;
    }
    return false;
  }

  function findParentToHide(textNode) {
    const ROW_TAGS = new Set(['LI', 'TR', 'TD', 'TH', 'DIV', 'P', 'SPAN', 'TD']);
    const STOP_TAGS = new Set(['TABLE', 'TBODY', 'THEAD', 'TFOOT', 'UL', 'OL', 'SECTION', 'BODY', 'FORM']);
    let el = textNode.parentElement;
    let bestTarget = null;
    while (el && !STOP_TAGS.has(el.tagName)) {
      if (ROW_TAGS.has(el.tagName) && el.textContent.trim().length < 100) {
        bestTarget = el;
      }
      el = el.parentElement;
    }
    return bestTarget || textNode.parentElement;
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
      for (const sel of SCAN_ROOTS_PROFILE) {
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
          if (!isInSafeZone(container)) {
            this._walkContainer(container);
          }
        }
      }
    },

    _walkContainer(container) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        if (isInSafeZone(node)) continue;
        const text = node.textContent.trim();
        if (!text || text.length > 80) continue;
        if (RATING_TEXT_RE.test(text)) {
          const target = findParentToHide(node);
          if (target && !this._processed.has(target)) {
            this._processed.add(target);
            target.classList.add('zf-rating-hidden');
          }
        }
      }
    },
  };
})();
