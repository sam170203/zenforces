// Timer deliberately avoids MutationObserver.
// It only reacts to page changes via onPageChange().

ZF.Timer = (() => {
  let _el = null;
  let _interval = null;
  let _seconds = 0;
  let _dragging = false;
  let _dragOffX = 0;
  let _dragOffY = 0;

  function onMouseMove(e) {
    if (!_dragging || !_el) return;
    _el.style.right = 'auto';
    _el.style.bottom = 'auto';
    _el.style.left = `${e.clientX - _dragOffX}px`;
    _el.style.top  = `${e.clientY - _dragOffY}px`;
  }

  function onMouseUp() { _dragging = false; }

  function updateDisplay() {
    if (!_el) return;
    const m = Math.floor(_seconds / 60).toString().padStart(2, '0');
    const s = (_seconds % 60).toString().padStart(2, '0');
    _el.textContent = `${m}:${s}`;
  }

  return {
    _active: false,
    _processed: new WeakSet(), // satisfies module contract, unused

    init(settings, node = document) {
      if (this._active) return;
      this._active = true;

      _el = document.createElement('div');
      _el.id = 'zf-timer';
      _el.setAttribute('aria-label', 'Problem solving timer');
      _el.textContent = '00:00';
      document.body.appendChild(_el);

      // Animate in on next two frames to trigger CSS transition
      requestAnimationFrame(() =>
        requestAnimationFrame(() => _el.classList.add('zf-visible'))
      );

      _el.addEventListener('mousedown', (e) => {
        _dragging = true;
        const rect = _el.getBoundingClientRect();
        _dragOffX = e.clientX - rect.left;
        _dragOffY = e.clientY - rect.top;
        _el.style.transition = 'none';
      });
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      _seconds = 0;
      _interval = setInterval(() => { _seconds++; updateDisplay(); }, 1000);
      ZF.log('Timer: init');
    },

    destroy() {
      if (!this._active) return;
      this._active = false;
      clearInterval(_interval);
      _interval = null;
      _seconds = 0;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (_el) { _el.remove(); _el = null; }
      ZF.log('Timer: destroyed');
    },

    update(settings) {
      // timerMode change — restart clean
      const wasActive = this._active;
      this.destroy();
      if (wasActive) this.init(settings);
    },

    onPageChange(url) {
      if (!this._active) return;
      clearInterval(_interval);
      _seconds = 0;
      updateDisplay();
      _interval = setInterval(() => { _seconds++; updateDisplay(); }, 1000);
    },
  };
})();
