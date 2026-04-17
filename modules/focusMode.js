ZF.FocusMode = (() => {
  const SEL = () => ZF.SELECTORS;

  return {
    _active: false,
    _processed: new WeakSet(),

    init(settings, node = document) {
      if (this._active) {
        if (node !== document) this._process(node);
        return;
      }
      this._active = true;
      document.body.classList.add('zf-focus-mode');
      this._process(node);
      ZF.log('FocusMode: init');
    },

    destroy() {
      if (!this._active) return;
      this._active = false;
      this._processed = new WeakSet();
      document.body.classList.remove('zf-focus-mode');
      document.querySelectorAll('.zf-focus-hidden')
        .forEach(el => el.classList.remove('zf-focus-hidden'));
      ZF.log('FocusMode: destroyed');
    },

    update(settings) {},

    onPageChange(url) {
      if (!this._active) return;
      this._processed = new WeakSet();
      this._process(document);
    },

    _process(node) {
      SEL().focusTargets.forEach(sel => {
        let els;
        try {
          els = node === document
            ? document.querySelectorAll(sel)
            : (node.matches?.(sel) ? [node] : node.querySelectorAll(sel));
        } catch (_) { return; }
        els.forEach(el => {
          if (this._processed.has(el)) return;
          this._processed.add(el);
          el.classList.add('zf-focus-hidden');
        });
      });
    },
  };
})();
