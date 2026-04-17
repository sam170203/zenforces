ZF.RatingHider = (() => {
  const RATING_ONLY_RE = /\b(contest\s*rating|rating\s*:|max\.?\s*(rating|)?|newbie|pupil|specialist|expert|candidate\s*master|master|international\s*grand?\s*master|grand\s*master|legendary\s*grand\s*master)\b/i;

  const RATING_CONTAINERS = [
    '.rating',
    '.user-rank',
    '.max-rating-box',
    '.userbox-rating',
    '.rating-overview',
    '.rating-badge',
    '.user-rank-block',
  ];

  const SAFE_TAGS = ['PRE', 'CODE', 'SCRIPT', 'STYLE'];

  function isSafeElement(el) {
    if (!el) return true;
    if (SAFE_TAGS.includes(el.tagName)) return true;
    if (el.closest?.('.problem-statement, .sample-tests, .input-output')) return true;
    return false;
  }

  function hasProfileLink(el) {
    return el?.querySelector?.('a[href*="/profile/"], a[href*="/contests/"]') !== null;
  }

  function findSmallestRatingContainer(textNode) {
    const PREFER_TAGS = ['SPAN', 'SMALL', 'B', 'STRONG', 'A'];
    const SKIP_TAGS = ['NAV', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE'];
    
    let el = textNode.parentElement;
    let bestTarget = null;
    let depth = 0;
    const maxDepth = 5;
    
    while (el && el !== document.body && depth < maxDepth) {
      if (SKIP_TAGS.includes(el.tagName)) return null;
      
      if (PREFER_TAGS.includes(el.tagName)) {
        const textLen = el.textContent.trim().length;
        if (textLen < 60 && !hasProfileLink(el)) {
          return el;
        }
      }
      
      if (el.classList?.contains('rating') || 
          el.classList?.contains('user-rank') ||
          el.classList?.contains('max-rating') ||
          el.tagName === 'LI') {
        const textLen = el.textContent.trim().length;
        if (textLen < 80 && !hasProfileLink(el)) {
          return el;
        }
      }
      
      bestTarget = el;
      el = el.parentElement;
      depth++;
    }
    
    if (bestTarget && !hasProfileLink(bestTarget)) {
      const textLen = bestTarget.textContent.trim().length;
      if (textLen < 100) return bestTarget;
    }
    
    return null;
  }

  function processElement(el) {
    if (isSafeElement(el)) return;
    if (hasProfileLink(el)) return;
    if (el.classList?.contains('zf-rating-hidden')) return;
    
    const text = el.textContent?.trim() || '';
    if (!text || text.length > 100) return;
    
    if (RATING_ONLY_RE.test(text)) {
      el.classList.add('zf-rating-hidden');
    }
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
      const root = node === document ? document : node;
      
      for (const sel of RATING_CONTAINERS) {
        try {
          const els = root.querySelectorAll(sel);
          els.forEach(el => {
            if (this._processed.has(el)) return;
            if (isSafeElement(el)) return;
            if (hasProfileLink(el)) return;
            this._processed.add(el);
            el.classList.add('zf-rating-hidden');
          });
        } catch (_) {}
      }
      
      const infoContainers = root.querySelectorAll(
        'div.info, .main-info, .personal-sidebar, #userbox, .profile-info'
      );
      
      infoContainers.forEach(container => {
        if (isSafeElement(container) || hasProfileLink(container)) return;
        
        const walker = document.createTreeWalker(
          container,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
              if (node.parentElement?.closest?.('a, button')) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );
        
        let textNode;
        while ((textNode = walker.nextNode())) {
          const text = textNode.textContent.trim();
          if (!text || text.length > 80) continue;
          if (RATING_ONLY_RE.test(text)) {
            const target = findSmallestRatingContainer(textNode);
            if (target && !this._processed.has(target)) {
              this._processed.add(target);
              target.classList.add('zf-rating-hidden');
            }
          }
        }
      });
    },
  };
})();
