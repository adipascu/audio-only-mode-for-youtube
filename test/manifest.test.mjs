import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { targets } from '../manifest.config.mjs';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const MATCHES = ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*'];
const CHROME_NAME_LIMIT = 75;
const CHROME_DESCRIPTION_LIMIT = 132;

test('builds a manifest for chrome and firefox', () => {
  assert.deepEqual(Object.keys(targets), ['chrome', 'firefox']);
});

for (const [name, manifest] of Object.entries(targets)) {
  test(`${name} manifest declares version ${packageJson.version} on manifest v3`, () => {
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.version, packageJson.version);
    assert.equal(manifest.description, packageJson.description);
  });

  test(`${name} manifest stays inside the store limits on name and description`, () => {
    assert.ok(
      manifest.description.length <= CHROME_DESCRIPTION_LIMIT,
      `description is ${manifest.description.length} characters, over the ${CHROME_DESCRIPTION_LIMIT} the stores accept`
    );
    assert.ok(
      manifest.name.length <= CHROME_NAME_LIMIT,
      `name is ${manifest.name.length} characters, over the ${CHROME_NAME_LIMIT} the stores accept`
    );
  });

  test(`${name} manifest asks only for storage`, () => {
    assert.deepEqual(manifest.permissions, ['storage']);
    assert.equal(manifest.host_permissions, undefined);
  });

  test(`${name} manifest has a toolbar button and no popup`, () => {
    assert.deepEqual(manifest.action.default_icon, manifest.icons);
    assert.equal(manifest.action.default_popup, undefined);
    assert.equal(manifest.options_page, undefined);
    assert.equal(manifest.options_ui, undefined);
  });

  test(`${name} manifest pairs a page-world script with isolated ones`, () => {
    const [pageScript, isolated] = manifest.content_scripts;
    assert.deepEqual(pageScript.js, ['page/radio.js']);
    assert.equal(pageScript.world, 'MAIN');
    assert.deepEqual(isolated.js, ['content/curtain.js', 'content/bridge.js']);
    assert.equal(isolated.world, undefined);
    for (const script of manifest.content_scripts) {
      assert.equal(script.run_at, 'document_start');
      assert.equal(script.all_frames, true);
      assert.deepEqual(script.matches, MATCHES);
    }
  });
}

test('each browser gets the background flavour it supports', () => {
  assert.deepEqual(targets.chrome.background, { service_worker: 'background.js' });
  assert.deepEqual(targets.firefox.background, { scripts: ['background.js'] });
});

test('only firefox carries a gecko id', () => {
  assert.equal(targets.firefox.browser_specific_settings.gecko.id, 'audio-only-mode@pascu.be');
  assert.equal(targets.chrome.browser_specific_settings, undefined);
});

test('only chrome carries a minimum chrome version', () => {
  assert.equal(targets.chrome.minimum_chrome_version, '111');
  assert.equal(targets.firefox.minimum_chrome_version, undefined);
});
