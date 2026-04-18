const ZF = window.ZF || {};
window.ZF = ZF;

ZF.DEBUG = false;

ZF.log = (msg) => {
  if (ZF.DEBUG) console.log(`[Zenforces] ${msg}`);
};

ZF.debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

// Inject or update a <style> by ID. Safe to call repeatedly.
ZF.addStyle = (id, css) => {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    (document.head || document.documentElement).appendChild(el);
  }
  el.textContent = css;
};

ZF.removeStyle = (id) => {
  const el = document.getElementById(id);
  if (el) el.remove();
};

ZF.isValidHex = (val) => /^#[0-9a-fA-F]{6}$/.test(val);

