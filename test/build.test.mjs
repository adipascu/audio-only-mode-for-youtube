import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from '../build.mjs';
import { targets } from '../manifest.config.mjs';
import { ICON_SIZES, ICON_VARIANTS, renderIcon } from '../src/icons.mjs';

const filesNamedBy = (manifest) => [
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
  ...manifest.content_scripts.flatMap((script) => script.js),
  ...(manifest.background.scripts ?? [manifest.background.service_worker])
];

const directory = await mkdtemp(join(tmpdir(), 'audio-only-mode-build-'));
const dist = pathToFileURL(`${directory}/`);
const built = await build(dist);

after(() => rm(directory, { recursive: true, force: true }));

test('builds every target', () => {
  assert.deepEqual(built, Object.keys(targets));
});

for (const target of Object.keys(targets)) {
  test(`${target} bundle contains every file its manifest names`, async () => {
    const manifest = JSON.parse(await readFile(new URL(`${target}/manifest.json`, dist), 'utf8'));
    for (const path of filesNamedBy(manifest)) {
      const details = await stat(new URL(`${target}/${path}`, dist));
      assert.ok(details.size > 0, `${target}/${path} is empty`);
    }
  });

  test(`${target} manifest on disk matches the config`, async () => {
    const manifest = JSON.parse(await readFile(new URL(`${target}/manifest.json`, dist), 'utf8'));
    assert.deepEqual(manifest, targets[target]);
  });
}

test('renders every icon variant as png at the requested size', () => {
  for (const variant of Object.keys(ICON_VARIANTS)) {
    for (const size of ICON_SIZES) {
      const png = renderIcon(size, variant);
      assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      assert.equal(png.readUInt32BE(16), size);
      assert.equal(png.readUInt32BE(20), size);
    }
  }
});

test('the off icon differs from the on icon', () => {
  assert.notDeepEqual(renderIcon(48, 'icon'), renderIcon(48, 'off'));
});

test('ships the off icons the background script switches to', async () => {
  for (const target of Object.keys(targets)) {
    for (const size of ICON_SIZES) {
      const details = await stat(new URL(`${target}/icons/off-${size}.png`, dist));
      assert.ok(details.size > 0);
    }
  }
});
