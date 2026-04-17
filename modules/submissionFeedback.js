ZF.SubmissionFeedback = (() => {
  let _toastEl = null;
  let _confettiEl = null;
  let _pollInterval = null;
  let _lastVerdict = null;
  let _hideTimeout = null;
  let _settings = {};

  function createToast() {
    _toastEl = document.createElement('div');
    _toastEl.id = 'zf-toast';
    _toastEl.setAttribute('role', 'status');
    _toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(_toastEl);
  }

  function removeConfetti() {
    if (_confettiEl) {
      _confettiEl.remove();
      _confettiEl = null;
    }
  }

  function createConfetti() {
    removeConfetti();
    _confettiEl = document.createElement('div');
    _confettiEl.id = 'zf-confetti';
    _confettiEl.innerHTML = Array.from({ length: 20 }, (_, i) => {
      const color = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'][i % 5];
      const x = Math.random() * 100;
      const delay = Math.random() * 0.5;
      const size = 6 + Math.random() * 6;
      return `<div class="zf-confetti-piece" style="
        left: ${x}%;
        background: ${color};
        width: ${size}px;
        height: ${size}px;
        animation-delay: ${delay}s;
      "></div>`;
    }).join('');
    document.body.appendChild(_confettiEl);
    
    setTimeout(removeConfetti, 2000);
  }

  function playSuccessSound() {
    if (!_settings.successSound) return;
    
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, ctx.currentTime);
      oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } catch (_) {}
  }

  function showToast(text, cls) {
    if (!_toastEl) return;
    clearTimeout(_hideTimeout);
    
    _toastEl.className = cls;
    _toastEl.textContent = text;
    
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        _toastEl.classList.add('zf-visible');
        _hideTimeout = setTimeout(() => {
          _toastEl.classList.remove('zf-visible');
        }, 3000);
      })
    );
    
    if (cls === 'zf-accepted') {
      createConfetti();
      playSuccessSound();
    } else if (cls === 'zf-rejected') {
      _toastEl.classList.add('zf-shake');
      setTimeout(() => _toastEl.classList.remove('zf-shake'), 500);
    }
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

    const isAccepted = /accepted/i.test(text);
    const isRejected = /wrong answer|time limit|memory limit|runtime error|compilation/i.test(text);
    const isTLE = /time limit exceeded/i.test(text);

    const cls = isAccepted ? 'zf-accepted'
              : isRejected ? 'zf-rejected'
              : isTLE ? 'zf-tle'
              : 'zf-other';
    
    showToast(text, cls);
  }

  return {
    _active: false,
    _processed: new WeakSet(),

    init(settings, node = document) {
      if (this._active) return;
      this._active = true;
      _settings = settings;
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
      _hideTimeout = null;
      _lastVerdict = null;
      removeConfetti();
      if (_toastEl) { _toastEl.remove(); _toastEl = null; }
      ZF.log('SubmissionFeedback: destroyed');
    },

    update(settings) {
      _settings = settings;
    },

    onPageChange(url) {
      if (this._active) {
        _lastVerdict = null;
        removeConfetti();
      }
    },
  };
})();
