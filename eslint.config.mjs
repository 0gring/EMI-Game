// Lint config for the game and its tools.
//
// Deliberately narrow: this catches the mistakes that actually bite in a
// no-build, no-types project - a typo'd identifier, a duplicate key, a variable
// left behind by a refactor - and stays out of the way on style.

const browser = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', screen: 'readonly',
  location: 'readonly', localStorage: 'readonly', performance: 'readonly',
  requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly',
  clearInterval: 'readonly', console: 'readonly', fetch: 'readonly', atob: 'readonly',
  btoa: 'readonly', Image: 'readonly', caches: 'readonly', self: 'readonly',
  AudioContext: 'readonly', OfflineAudioContext: 'readonly', PointerEvent: 'readonly',
  URL: 'readonly', globalThis: 'readonly', Path2D: 'readonly',
  SpeechSynthesisUtterance: 'readonly',
};

const node = {
  process: 'readonly', Buffer: 'readonly', console: 'readonly', URL: 'readonly',
  setTimeout: 'readonly', globalThis: 'readonly',
};

const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
  'no-dupe-keys': 'error',
  'no-dupe-class-members': 'error',
  'no-unreachable': 'error',
  'no-self-assign': 'error',
  'no-constant-condition': 'error',
  'no-fallthrough': 'error',
  'no-sparse-arrays': 'error',
  'no-cond-assign': 'error',
  'no-dupe-else-if': 'error',
  'no-unsafe-negation': 'error',
  'valid-typeof': 'error',
};

export default [
  {
    files: ['src/**/*.js', 'sw.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: browser },
    rules,
  },
  {
    // The tools run in node, but several of them evaluate code inside a page,
    // so they need both sets of globals.
    files: ['tools/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...node, ...browser } },
    rules,
  },
];
