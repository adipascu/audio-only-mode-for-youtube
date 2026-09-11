import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint, Linter } from 'eslint';

const PROBED_RULES = [
  'no-restricted-globals',
  'no-restricted-syntax',
  'no-console',
  'curly',
  'no-undef'
];

const BUILD_PATHS = ['build.mjs', 'manifest.config.mjs', 'src/icons.mjs', 'src/zip.mjs'];
const EXTENSION_PATHS = ['src/page/radio.js', 'src/content/curtain.js', 'src/background.js'];

const NONDETERMINISM = {
  'a new Date': 'export const a = () => new Date();',
  'Date.now': 'export const a = () => Date.now();',
  'Math.random': 'export const a = () => Math.random();',
  'a localeCompare sort': 'export const a = (x, y) => x.localeCompare(y);'
};

const linter = new Linter();

const configFor = async (path) => {
  const resolved = await new ESLint().calculateConfigForFile(path);
  return [
    {
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: resolved.languageOptions?.globals ?? {}
      },
      rules: Object.fromEntries(
        PROBED_RULES.map((rule) => [rule, resolved.rules[rule]]).filter(
          ([, options]) => options !== undefined
        )
      )
    }
  ];
};

const complaints = async (path, source) =>
  linter
    .verify(source, await configFor(path), 'probe.mjs')
    .filter((message) => PROBED_RULES.includes(message.ruleId));

for (const path of BUILD_PATHS) {
  for (const [name, source] of Object.entries(NONDETERMINISM)) {
    test(`the build path ${path} rejects ${name}`, async () => {
      assert.notDeepEqual(await complaints(path, source), []);
    });
  }

  test(`the build path ${path} allows a codepoint sort`, async () => {
    assert.deepEqual(await complaints(path, 'export const a = (x, y) => (x < y ? -1 : 1);'), []);
  });
}

for (const path of EXTENSION_PATHS) {
  test(`${path} may not reach for the console`, async () => {
    assert.notDeepEqual(await complaints(path, 'export const a = () => console.log("x");'), []);
  });
}

test('the build script may log, because that is its output', async () => {
  assert.deepEqual(await complaints('build.mjs', 'console.log("built");'), []);
});

test('the publish script may log, because that is its output', async () => {
  assert.deepEqual(await complaints('scripts/publish-chrome.mjs', 'console.log("published");'), []);
});

test('the determinism bans stop at the build path', async () => {
  assert.deepEqual(
    await complaints('scripts/version.mjs', 'export const a = () => Date.now();'),
    []
  );
});

test('every file requires braces on its branches', async () => {
  for (const path of [...BUILD_PATHS, ...EXTENSION_PATHS, 'scripts/version.mjs']) {
    assert.notDeepEqual(
      await complaints(path, 'export const a = (x) => { if (x) return 1; return 2; };'),
      [],
      `${path} should require braces`
    );
  }
});

test('the background worker is held to what a service worker actually has', async () => {
  for (const source of [
    'export const a = () => document.title;',
    'export const a = () => localStorage.getItem("x");',
    'export const a = () => window.innerWidth;'
  ]) {
    assert.notDeepEqual(
      await complaints('src/background.js', source),
      [],
      `background.js should not be handed ${source}`
    );
  }
});

test('a content script still gets the document it runs against', async () => {
  assert.deepEqual(
    await complaints('src/content/curtain.js', 'export const a = () => document.title;'),
    []
  );
});

test('both worlds may reach the extension api', async () => {
  for (const path of ['src/background.js', 'src/content/bridge.js']) {
    assert.deepEqual(await complaints(path, 'export const a = () => chrome.storage;'), []);
  }
});
