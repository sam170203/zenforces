ZF.SubmissionFeedback = (() => {
  let _toastEl = null;
  let _pollInterval = null;
  let _lastVerdict = null;
  let _hideTimeout = null;

  function createToast() {
    _toastEl = document.createElement('div');
    _toastEl.id = 'zf-toast';
    _toastEl.setAttribute('role', 'status');
    _toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(_toastEl);
  }

  function showToast(text, cls) {
    if (!_toastEl) return;
    clearTimeout(_hideTimeout);
    _toastEl.textContent = text;
    _toastEl.className = cls; // replaces all classes
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        _toastEl.classList.add('zf-visible');
        _hideTimeout = setTimeout(() => {
          _toastEl.classList.remove('zf-visible');
        }, 3000);
      })
    );
  }

  function check() {
    const SEL = ZF.SELECTORS;
    let verdictEl = null;
    for (const sel of SEL.latestVerdict) {
      try { verdictEl = document.querySelector(sel); } catch (_) {}
      if (verdictEl) break;
    }
    if (!verdictEl) return;

    const text = verdictEl.textContent.trim();
    if (!text || text === _lastVerdict) return;
    _lastVerdict = text;

    const cls = /accepted/i.test(text)   ? 'zf-accepted'
              : /wrong answer|time limit|memory limit|runtime error|compilation/i.test(text)
                                          ? 'zf-rejected'
              :                             'zf-other';
    showToast(text, cls);
  }

  return {
    _active: false,
    _processed: new WeakSet(),

    init(settings, node = document) {
      if (this._active) return;
      this._active = true;
      createToast();
      _pollInterval = setInterval(check, 2000);
      ZF.log('SubmissionFeedback: init');
    },

    destroy() {
      if (!this._active) return;
      this._active = false;
      clearInterval(_pollInterval);
      clearTimeout(_hideTimeout);
      _pollInterval = null;
      _lastVerdict = null;
      if (_toastEl) { _toastEl.remove(); _toastEl = null; }
      ZF.log('SubmissionFeedback: destroyed');
    },

    update(settings) {},

    onPageChange(url) {
      if (this._active) _lastVerdict = null;
    },
  };
})();
