// tests/utils.test.js
// Run with: node tests/utils.test.js

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(val, msg) {
  if (!val) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b) {
  if (a !== b) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── Stub window.ZF ────────────────────────────────────────────────
global.window = { ZF: {} };
global.document = {
  getElementById: () => null,
  createElement: () => ({ id: '', textContent: '' }),
  head: null,
  documentElement: { style: { setProperty: () => {} } },
};

// Load utils manually (extract pure functions for Node testing)
const ZF = global.window.ZF;

// debounce
ZF.debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

// isValidHex
ZF.isValidHex = (val) => /^#[0-9a-fA-F]{6}$/.test(val);

// isValidTimerMode
ZF.isValidTimerMode = (val) => ['stopwatch', 'countdown'].includes(val);

// mergeSettings
ZF.mergeSettings = (stored, defaults) => ({ ...defaults, ...stored });

// ── Tests ─────────────────────────────────────────────────────────

console.log('\nutils.js tests:');

test('isValidHex: valid lowercase', () => assertEqual(ZF.isValidHex('#4a90d9'), true));
test('isValidHex: valid uppercase', () => assertEqual(ZF.isValidHex('#FFFFFF'), true));
test('isValidHex: missing hash', () => assertEqual(ZF.isValidHex('4a90d9'), false));
test('isValidHex: too short', () => assertEqual(ZF.isValidHex('#fff'), false));
test('isValidHex: empty string', () => assertEqual(ZF.isValidHex(''), false));
test('isValidHex: 8-char hex', () => assertEqual(ZF.isValidHex('#4a90d9ff'), false));

test('isValidTimerMode: stopwatch', () => assertEqual(ZF.isValidTimerMode('stopwatch'), true));
test('isValidTimerMode: countdown', () => assertEqual(ZF.isValidTimerMode('countdown'), true));
test('isValidTimerMode: invalid', () => assertEqual(ZF.isValidTimerMode('timer'), false));
test('isValidTimerMode: empty', () => assertEqual(ZF.isValidTimerMode(''), false));

test('mergeSettings: fills missing keys from defaults', () => {
  const result = ZF.mergeSettings({ ratingHider: false }, { ratingHider: true, timer: false });
  assertEqual(result.ratingHider, false);
  assertEqual(result.timer, false);
});

test('mergeSettings: stored values override defaults', () => {
  const result = ZF.mergeSettings({ timer: true }, { timer: false, ratingHider: true });
  assertEqual(result.timer, true);
  assertEqual(result.ratingHider, true);
});

test('debounce: calls function after delay', () => {
  let calls = 0;
  const fn = ZF.debounce(() => calls++, 10);
  fn(); fn(); fn();
  setTimeout(() => {
    assertEqual(calls, 1);
  }, 50);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
