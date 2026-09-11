import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const NO_PREVIOUS_COMMIT = '0'.repeat(40);

export const versionOf = (text) => JSON.parse(text).version;

export const versionChanged = (currentText, previousText) =>
  versionOf(currentText) !== versionOf(previousText);

export const hasPreviousCommit = (ref) => Boolean(ref) && ref !== NO_PREVIOUS_COMMIT;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , previousRef] = process.argv;
  const current = await readFile(new URL('../package.json', import.meta.url), 'utf8');
  const changed = hasPreviousCommit(previousRef)
    ? versionChanged(current, execFileSync('git', ['show', `${previousRef}:package.json`], { encoding: 'utf8' }))
    : true;
  console.log(`version=${versionOf(current)}`);
  console.log(`changed=${changed}`);
}
