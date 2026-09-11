import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { targets } from './manifest.config.mjs';
import { ICON_SIZES, renderIcon } from './src/icons.mjs';

const root = new URL('./', import.meta.url);

export const build = async (dist) => {
  await rm(dist, { recursive: true, force: true });
  for (const [target, manifest] of Object.entries(targets)) {
    const out = new URL(`${target}/`, dist);
    await mkdir(new URL('icons/', out), { recursive: true });
    await cp(new URL('src/page/', root), new URL('page/', out), { recursive: true });
    for (const size of ICON_SIZES) {
      await writeFile(new URL(`icons/icon-${size}.png`, out), renderIcon(size));
    }
    await writeFile(new URL('manifest.json', out), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return Object.keys(targets);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const built = await build(new URL('dist/', root));
  for (const target of built) console.log(`built dist/${target}`);
}
