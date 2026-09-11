import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

const CONTENT_SOURCES = ['src/page/**', 'src/content/**'];
const WORKER_SOURCES = ['src/background.js'];
const BUILD_SOURCES = ['build.mjs', 'manifest.config.mjs', 'src/icons.mjs', 'src/zip.mjs'];
const NODE_SOURCES = [
  'build.mjs',
  'manifest.config.mjs',
  'eslint.config.mjs',
  'scripts/**',
  'src/*.mjs',
  'test/**'
];

const DETERMINISM =
  'The build has to be byte-reproducible, so the same tree always packs to the same zip.';

const RESTRICTED_BUILD_GLOBALS = [
  {
    name: 'Date',
    message: `Do not stamp a build with the current time. ${DETERMINISM} Zip entries use the fixed DOS epoch instead.`
  }
];

const RESTRICTED_BUILD_SYNTAX = [
  {
    selector: "MemberExpression[object.name='Math'][property.name='random']",
    message: `Randomness makes two builds of one tree differ. ${DETERMINISM}`
  },
  {
    selector: "CallExpression[callee.property.name='localeCompare']",
    message: `Collation depends on the machine's locale, so ordering changes between runs. ${DETERMINISM} Compare codepoints instead.`
  }
];

export default [
  {
    ignores: ['.claude/**', 'dist/**', 'coverage/**']
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
      'no-void': 'error',
      curly: ['error', 'all'],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'no-param-reassign': 'error'
    }
  },
  {
    files: CONTENT_SOURCES,
    languageOptions: {
      globals: { ...globals.browser, chrome: 'readonly', browser: 'readonly' }
    }
  },
  {
    files: WORKER_SOURCES,
    languageOptions: {
      globals: { ...globals.serviceworker, chrome: 'readonly', browser: 'readonly' }
    }
  },
  {
    files: NODE_SOURCES,
    languageOptions: { globals: globals.node }
  },
  {
    files: BUILD_SOURCES,
    rules: {
      'no-restricted-globals': ['error', ...RESTRICTED_BUILD_GLOBALS],
      'no-restricted-syntax': ['error', ...RESTRICTED_BUILD_SYNTAX]
    }
  },
  {
    files: ['build.mjs', 'scripts/**'],
    rules: { 'no-console': 'off' }
  },
  prettier,
  {
    rules: { curly: ['error', 'all'] }
  }
];
