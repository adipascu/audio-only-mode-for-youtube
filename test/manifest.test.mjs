import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { targets } from '../manifest.config.mjs';

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8')
);

test('builds a manifest for chrome and firefox', () => {
  assert.deepEqual(Object.keys(targets), ['chrome', 'firefox']);
});

for (const [name, manifest] of Object.entries(targets)) {
  test(`${name} manifest declares version ${packageJson.version} on manifest v3`, () => {
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.version, packageJson.version);
    assert.equal(manifest.description, packageJson.description);
  });

  test(`${name} manifest asks for no permissions`, () => {
    assert.equal(manifest.permissions, undefined);
    assert.equal(manifest.host_permissions, undefined);
  });

  test(`${name} manifest runs in the page world at document start`, () => {
    const [contentScript] = manifest.content_scripts;
    assert.equal(contentScript.world, 'MAIN');
    assert.equal(contentScript.run_at, 'document_start');
    assert.equal(contentScript.all_frames, true);
    assert.deepEqual(contentScript.matches, [
      '*://*.youtube.com/*',
      '*://*.youtube-nocookie.com/*'
    ]);
  });

}

test('only firefox carries a gecko id', () => {
  assert.equal(targets.firefox.browser_specific_settings.gecko.id, 'earshot@pascu.be');
  assert.equal(targets.chrome.browser_specific_settings, undefined);
});

test('only chrome carries a minimum chrome version', () => {
  assert.equal(targets.chrome.minimum_chrome_version, '111');
  assert.equal(targets.firefox.minimum_chrome_version, undefined);
});
