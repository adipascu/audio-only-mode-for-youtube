import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { targets } from './manifest.config.mjs';
import { ICON_SIZES, ICON_VARIANTS, renderIcon } from './src/icons.mjs';
import { zip } from './src/zip.mjs';

const root = new URL('./', import.meta.url);

export const build = async (dist) => {
  await rm(dist, { recursive: true, force: true });
  for (const [target, manifest] of Object.entries(targets)) {
    const out = new URL(`${target}/`, dist);
    await mkdir(new URL('icons/', out), { recursive: true });
    await cp(new URL('src/page/', root), new URL('page/', out), { recursive: true });
    await cp(new URL('src/content/', root), new URL('content/', out), { recursive: true });
    await cp(new URL('src/background.js', root), new URL('background.js', out));
    for (const variant of Object.keys(ICON_VARIANTS)) {
      for (const size of ICON_SIZES) {
        await writeFile(new URL(`icons/${variant}-${size}.png`, out), renderIcon(size, variant));
      }
    }
    await writeFile(new URL('manifest.json', out), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return Object.keys(targets);
};

export const packageTargets = async (dist) => {
  const packaged = [];
  for (const target of Object.keys(targets)) {
    await writeFile(new URL(`${target}.zip`, dist), await zip(new URL(`${target}/`, dist)));
    packaged.push(target);
  }
  return packaged;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dist = new URL('dist/', root);
  const built = await build(dist);
  for (const target of built) console.log(`built dist/${target}`);
  for (const target of await packageTargets(dist)) console.log(`packaged dist/${target}.zip`);
}
