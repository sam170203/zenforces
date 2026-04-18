const DEFAULTS = {
  enabled:            true,
  ratingHider:        true,
  colorNeutralizer:   true,
  cleanUI:            true,
  submissionFeedback: false,
  usernameColor:      '#4a90d9',
  theme:              'none',
};

const FEATURE_KEYS = ['enabled', 'ratingHider', 'colorNeutralizer', 'cleanUI', 'submissionFeedback'];

function applySettings(s) {
  FEATURE_KEYS.forEach(key => {
    const el = document.getElementById('toggle-' + key);
    if (el) el.checked = !!s[key];
  });

  const colorInput   = document.getElementById('username-color');
  const colorPreview = document.getElementById('color-preview');
  colorInput.value   = s.usernameColor || DEFAULTS.usernameColor;
  colorPreview.style.background = colorInput.value;
  colorInput.disabled = !s.colorNeutralizer;

  document.getElementById('theme-select').value = s.theme || 'none';

  setEnabledState(!!s.enabled);
}

function setEnabledState(on) {
  document.getElementById('zf-feature-body').classList.toggle('zf-disabled', !on);
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    if (chrome.runtime.lastError) return;
    applySettings({ ...DEFAULTS, ...stored });
  });

  // Feature toggles
  FEATURE_KEYS.forEach(key => {
    const el = document.getElementById('toggle-' + key);
    if (!el) return;
    el.addEventListener('change', () => {
      chrome.storage.sync.set({ [key]: el.checked });
      if (key === 'enabled') setEnabledState(el.checked);
      if (key === 'colorNeutralizer') {
        document.getElementById('username-color').disabled = !el.checked;
      }
    });
  });

  // Theme
  document.getElementById('theme-select').addEventListener('change', e => {
    chrome.storage.sync.set({ theme: e.target.value });
  });

  // Color picker
  const colorInput   = document.getElementById('username-color');
  const colorPreview = document.getElementById('color-preview');
  colorInput.addEventListener('input', () => {
    colorPreview.style.background = colorInput.value;
  });
  colorInput.addEventListener('change', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(colorInput.value)) {
      chrome.storage.sync.set({ usernameColor: colorInput.value });
    }
  });
});
