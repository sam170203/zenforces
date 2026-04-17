ZF.ThemeManager = (() => {
  const THEMES = ['zen-dark', 'deep-blue', 'soft-light', 'warm-minimal', 'midnight-pro'];

  return {
    _active: false,

    init(settings) {
      this._active = true;
      this._apply(settings.theme || 'none');
    },

    destroy() {
      this._active = false;
      this._apply('none');
    },

    update(settings) {
      this._apply(settings.theme || 'none');
    },

    onPageChange() {},

    _apply(theme) {
      document.body.classList.remove(...THEMES.map(t => `zf-theme-${t}`));
      if (THEMES.includes(theme)) {
        document.body.classList.add(`zf-theme-${theme}`);
      }
    },
  };
})();
