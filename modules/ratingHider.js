ZF.RatingHider = (() => {
  const RATING_TEXT_RE = /(contest\s*rating|rating\s*:|max\.?)/i;

  const RATING_CLASSES = [
    '.rating',
    '.user-rank',
    '.max-rating-box',
    '.userbox-rating',
    '.rating-overview',
    '.rating-badge',
    '.user-rank-block',
    '.contest-cell .rating',
  ];

  const PROFILE_CONTAINERS = [
    'div.info',
    '.main-info',
    '.personal-sidebar',
    '#userbox',
    '.userbox-rating',
    '.max-rating-box',
    '.rating-overview',
    '.user-rank-block',
    '.profile-info',
  ];

  function isSafeZone(el) {
    if (!el) return false;
    const safe = el.closest?.('.problem-statement, .sample-tests, .input-output, pre, code, script, style');
    return !!safe;
  }

  function hasMainContent(el) {
    return el?.querySelector?.('a[href*="/profile/"]') !== null && 
           !el?.classList?.contains('rating') &&
           !el?.classList?.contains('user-rank');
  }

  function findHideTarget(textNode) {
    const CONTAINER_TAGS = ['LI', 'TD', 'SPAN', 'SMALL', 'DIV', 'P'];
    let el = textNode.parentElement;
    let depth = 0;
    
    while (el && el !== document.body && depth < 8) {
      if (['NAV', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE'].includes(el.tagName)) return null;
      if (el.classList?.contains('rated-user') || el.classList?.contains('username')) return null;
      
      if (CONTAINER_TAGS.includes(el.tagName)) {
        const text = el.textContent?.trim() || '';
        if (text.length < 120 && !hasMainContent(el)) {
          return el;
        }
      }
      el = el.parentElement;
      depth++;
    }
    return null;
  }

  function hideElement(el) {
    if (!el || el.classList?.contains('zf-rating-hidden')) return false;
    if (isSafeZone(el)) return false;
    if (el.querySelector?.('a[href*="/contests/"], a[href*="/problemset/"]')) return false;
    el.classList.add('zf-rating-hidden');
    return true;
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

      for (const sel of RATING_CLASSES) {
        try {
          root.querySelectorAll(sel).forEach(el => {
            if (!this._processed.has(el)) {
              this._processed.add(el);
              hideElement(el);
            }
          });
        } catch (_) {}
      }

      for (const sel of PROFILE_CONTAINERS) {
        try {
          root.querySelectorAll(sel).forEach(container => {
            if (isSafeZone(container)) return;
            
            const walker = document.createTreeWalker(
              container,
              NodeFilter.SHOW_TEXT,
              null
            );
            
            let textNode;
            while ((textNode = walker.nextNode())) {
              if (textNode.parentElement?.closest?.('a, button, script')) continue;
              
              const text = textNode.textContent?.trim() || '';
              if (!text || text.length > 150) continue;
              
              if (RATING_TEXT_RE.test(text)) {
                const target = findHideTarget(textNode);
                if (target && !this._processed.has(target)) {
                  this._processed.add(target);
                  hideElement(target);
                }
              }
            }
          });
        } catch (_) {}
      }
    },
  };
})();
