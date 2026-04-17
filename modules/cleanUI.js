ZF.CleanUI = (() => {
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
      document.body.classList.add('zf-clean-ui');
      this._process(node);
      ZF.log('CleanUI: init');
    },

    destroy() {
      if (!this._active) return;
      this._active = false;
      this._processed = new WeakSet();
      document.body.classList.remove('zf-clean-ui');
      // Remove markers so elements re-show if feature toggled back on
      document.querySelectorAll('.zf-clutter-hidden')
        .forEach(el => el.classList.remove('zf-clutter-hidden'));
      ZF.log('CleanUI: destroyed');
    },

    update(settings) {},

    onPageChange(url) {
      if (!this._active) return;
      this._processed = new WeakSet();
      this._process(document);
    },

    _process(node) {
      SEL().clutter.forEach(sel => {
        let els;
        try {
          els = node === document
            ? document.querySelectorAll(sel)
            : (node.matches?.(sel) ? [node] : node.querySelectorAll(sel));
        } catch (_) { return; }
        els.forEach(el => {
          if (this._processed.has(el)) return;
          this._processed.add(el);
          el.classList.add('zf-clutter-hidden');
        });
      });
    },
  };
})();
