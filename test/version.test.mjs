import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hasPreviousCommit, versionChanged, versionOf } from '../scripts/version.mjs';

const packageJson = await readFile(new URL('../package.json', import.meta.url), 'utf8');

test('reads the version out of a package manifest', () => {
  assert.equal(versionOf('{"version":"1.2.3"}'), '1.2.3');
});

test('reads the version this repository ships', () => {
  assert.match(versionOf(packageJson), /^\d+\.\d+\.\d+$/);
});

test('publishes only when the version moved', () => {
  assert.equal(versionChanged('{"version":"0.2.0"}', '{"version":"0.1.0"}'), true);
  assert.equal(versionChanged('{"version":"0.1.0"}', '{"version":"0.1.0"}'), false);
});

test('ignores changes to the rest of the manifest', () => {
  const before = '{"version":"0.1.0","description":"one"}';
  const after = '{"version":"0.1.0","description":"two"}';
  assert.equal(versionChanged(after, before), false);
});

test('recognises a real commit to compare against', () => {
  assert.equal(hasPreviousCommit('8604c10a25e10175b174a6a39272e4e277c0c18b'), true);
});

test('treats a manual run with no previous commit as a release', () => {
  assert.equal(hasPreviousCommit(''), false);
  assert.equal(hasPreviousCommit(undefined), false);
});

test('treats the all-zero sha github sends for a new branch as no previous commit', () => {
  assert.equal(hasPreviousCommit('0'.repeat(40)), false);
});
