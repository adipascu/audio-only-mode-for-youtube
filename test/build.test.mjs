import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from '../build.mjs';
import { targets } from '../manifest.config.mjs';
import { ICON_SIZES, renderIcon } from '../src/icons.mjs';

const directory = await mkdtemp(join(tmpdir(), 'earshot-build-'));
const dist = pathToFileURL(`${directory}/`);
const built = await build(dist);

after(() => rm(directory, { recursive: true, force: true }));

test('builds every target', () => {
  assert.deepEqual(built, Object.keys(targets));
});

for (const target of Object.keys(targets)) {
  test(`${target} bundle contains every file its manifest names`, async () => {
    const manifest = JSON.parse(
      await readFile(new URL(`${target}/manifest.json`, dist), 'utf8')
    );
    const referenced = [
      ...Object.values(manifest.icons),
      ...manifest.content_scripts.flatMap((script) => script.js)
    ];
    for (const path of referenced) {
      const details = await stat(new URL(`${target}/${path}`, dist));
      assert.ok(details.size > 0, `${target}/${path} is empty`);
    }
  });

  test(`${target} manifest on disk matches the config`, async () => {
    const manifest = JSON.parse(
      await readFile(new URL(`${target}/manifest.json`, dist), 'utf8')
    );
    assert.deepEqual(manifest, targets[target]);
  });
}

test('renders icons as png at the requested size', () => {
  for (const size of ICON_SIZES) {
    const png = renderIcon(size);
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});
