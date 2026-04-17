const DEFAULTS = {
  ratingHider:        true,
  colorNeutralizer:   true,
  cleanUI:            true,
  timer:              false,
  submissionFeedback: false,
  successSound:       false,
  focusMode:          false,
  usernameColor:      '#4a90d9',
  timerMode:          'stopwatch',
  extrasExpanded:     false,
  theme:              'none',
};

const FEATURE_KEYS = [
  'ratingHider', 'colorNeutralizer', 'cleanUI',
  'timer', 'submissionFeedback', 'successSound', 'focusMode',
];

let pendingWrite = null;
let saveTimeout = null;

function flushToStorage() {
  if (!pendingWrite) return;
  const data = pendingWrite;
  pendingWrite = null;
  chrome.storage.sync.set(data);
}

function scheduleSave(data) {
  pendingWrite = Object.assign({}, pendingWrite || {}, data);
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(flushToStorage, 500);
}

function applySettings(settings) {
  FEATURE_KEYS.forEach(key => {
    const el = document.getElementById(`toggle-${key}`);
    if (el) el.checked = !!settings[key];
  });

  const colorInput   = document.getElementById('username-color');
  const colorPreview = document.getElementById('color-preview');
  const isColorOn    = !!settings.colorNeutralizer;
  colorInput.value   = settings.usernameColor || DEFAULTS.usernameColor;
  colorPreview.style.background = colorInput.value;
  colorInput.disabled = !isColorOn;

  const themeSelect = document.getElementById('theme-select');
  themeSelect.value = settings.theme || 'none';

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

  FEATURE_KEYS.forEach(key => {
    const el = document.getElementById(`toggle-${key}`);
    if (!el) return;
    el.addEventListener('change', () => {
      scheduleSave({ [key]: el.checked });
      if (key === 'colorNeutralizer') {
        const colorInput = document.getElementById('username-color');
        colorInput.disabled = !el.checked;
      }
    });
  });

  document.getElementById('theme-select').addEventListener('change', (e) => {
    scheduleSave({ theme: e.target.value });
  });

  const colorInput   = document.getElementById('username-color');
  const colorPreview = document.getElementById('color-preview');
  colorInput.addEventListener('input', () => {
    colorPreview.style.background = colorInput.value;
  });
  colorInput.addEventListener('change', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(colorInput.value)) {
      scheduleSave({ usernameColor: colorInput.value });
    }
  });

  const extrasToggle  = document.getElementById('extras-toggle');
  const extrasContent = document.getElementById('extras-content');
  extrasToggle.addEventListener('click', () => {
    const next = extrasToggle.getAttribute('aria-expanded') !== 'true';
    extrasToggle.setAttribute('aria-expanded', String(next));
    extrasContent.classList.toggle('zf-collapsed', !next);
    scheduleSave({ extrasExpanded: next });
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;
  if ('colorNeutralizer' in changes) {
    const colorInput = document.getElementById('username-color');
    if (colorInput) colorInput.disabled = !changes.colorNeutralizer.newValue;
  }
});
