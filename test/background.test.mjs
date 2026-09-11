import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExtensionApi, readSource, run } from './support.mjs';

const source = await readSource('background.js');

const start = (stored = {}) => {
  const chrome = createExtensionApi(stored);
  run(source, { chrome });
  return chrome;
};

test('starts switched on and turns off on the first click', async () => {
  const chrome = start();
  await chrome.click();
  assert.equal(chrome.stored.enabled, false);
  assert.equal(chrome.icons.at(-1)[16], 'icons/off-16.png');
});

test('turns back on with a second click', async () => {
  const chrome = start();
  await chrome.click();
  await chrome.click();
  assert.equal(chrome.stored.enabled, true);
  assert.equal(chrome.icons.at(-1)[128], 'icons/icon-128.png');
});

test('paints every icon size', async () => {
  const chrome = start();
  await chrome.click();
  assert.deepEqual(Object.keys(chrome.icons.at(-1)), ['16', '32', '48', '128']);
});

test('says what a click will do', async () => {
  const chrome = start();
  await chrome.click();
  assert.match(chrome.titles.at(-1), /click to mute the video/);
  await chrome.click();
  assert.match(chrome.titles.at(-1), /click to restore/);
});
