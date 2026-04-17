ZF.ThemeManager = (() => {
  const THEMES = ['dark', 'light', 'blue', 'warm'];

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
      THEMES.forEach(t => document.body.classList.remove(`zf-theme-${t}`));
      if (THEMES.includes(theme)) {
        document.body.classList.add(`zf-theme-${theme}`);
      }
    },
  };
})();
