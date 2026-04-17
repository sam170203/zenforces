const DEFAULTS = {
  ratingHider:        true,
  colorNeutralizer:   true,
  cleanUI:            true,
  timer:              false,
  submissionFeedback: false,
  focusMode:          false,
  usernameColor:      '#4a90d9',
  timerMode:          'stopwatch',
  extrasExpanded:     false,
};

const FEATURE_KEYS = [
  'ratingHider', 'colorNeutralizer', 'cleanUI',
  'timer', 'submissionFeedback', 'focusMode',
];

function applySettings(settings) {
  FEATURE_KEYS.forEach(key => {
    const el = document.getElementById(`toggle-${key}`);
    if (el) el.checked = !!settings[key];
  });

  // Color picker
  const colorInput   = document.getElementById('username-color');
  const colorPreview = document.getElementById('color-preview');
  const isColorOn    = !!settings.colorNeutralizer;
  colorInput.value   = settings.usernameColor || DEFAULTS.usernameColor;
  colorPreview.style.background = colorInput.value;
  colorInput.disabled = !isColorOn;

  // Extras expand state
  const extrasToggle  = document.getElementById('extras-toggle');
  const extrasContent = document.getElementById('extras-content');
  const expanded = !!settings.extrasExpanded;
  extrasToggle.setAttribute('aria-expanded', String(expanded));
  extrasContent.classList.toggle('zf-collapsed', !expanded);
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    if (chrome.runtime.lastError) return;
    applySettings({ ...DEFAULTS, ...stored });
  });

  // Feature toggles
  FEATURE_KEYS.forEach(key => {
    const el = document.getElementById(`toggle-${key}`);
    if (!el) return;
    el.addEventListener('change', () => {
      chrome.storage.sync.set({ [key]: el.checked });
      if (key === 'colorNeutralizer') {
        const colorInput = document.getElementById('username-color');
        colorInput.disabled = !el.checked;
      }
    });
  });

  // Color picker — update preview + storage on every input event
  const colorInput   = document.getElementById('username-color');
  const colorPreview = document.getElementById('color-preview');
  colorInput.addEventListener('input', () => {
    colorPreview.style.background = colorInput.value;
    if (/^#[0-9a-fA-F]{6}$/.test(colorInput.value)) {
      chrome.storage.sync.set({ usernameColor: colorInput.value });
    }
  });

  // Extras expand/collapse — persists state
  const extrasToggle  = document.getElementById('extras-toggle');
  const extrasContent = document.getElementById('extras-content');
  extrasToggle.addEventListener('click', () => {
    const next = extrasToggle.getAttribute('aria-expanded') !== 'true';
    extrasToggle.setAttribute('aria-expanded', String(next));
    extrasContent.classList.toggle('zf-collapsed', !next);
    chrome.storage.sync.set({ extrasExpanded: next });
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;
  if ('colorNeutralizer' in changes) {
    const colorInput = document.getElementById('username-color');
    if (colorInput) colorInput.disabled = !changes.colorNeutralizer.newValue;
  }
});
