import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExtensionApi, readSource, run, settle } from './support.mjs';

const source = await readSource('background.js');

const start = (stored = {}) => {
  const chrome = createExtensionApi(stored);
  run(source, { chrome });
  return chrome;
};

const startAndSettle = async (stored = {}) => {
  const chrome = start(stored);
  await settle();
  await settle();
  return chrome;
};

test('paints the badge as soon as the worker runs, with no event to prompt it', async () => {
  const chrome = await startAndSettle();
  assert.equal(chrome.badgeTexts.at(-1), 'AUDIO');
  assert.equal(chrome.icons.at(-1)[16], 'icons/icon-16.png');
});

test('paints the stored state, not a default, when the worker restarts', async () => {
  const chrome = await startAndSettle({ enabled: false });
  assert.equal(chrome.badgeTexts.at(-1), 'VIDEO');
  assert.equal(chrome.icons.at(-1)[16], 'icons/off-16.png');
});

test('starts pinning audio and releases the video on the first click', async () => {
  const chrome = start();
  await chrome.click();
  assert.equal(chrome.stored.enabled, false);
  assert.equal(chrome.icons.at(-1)[16], 'icons/off-16.png');
});

test('goes back to audio on a second click', async () => {
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

test('labels the badge with what you are getting, not with on or off', async () => {
  const chrome = start();
  await chrome.click();
  assert.equal(chrome.badgeTexts.at(-1), 'VIDEO');
  await chrome.click();
  assert.equal(chrome.badgeTexts.at(-1), 'AUDIO');
});

test('never labels the badge on or off', async () => {
  const chrome = start();
  await chrome.click();
  await chrome.click();
  for (const text of chrome.badgeTexts) {
    assert.doesNotMatch(text, /^(on|off)$/i);
  }
});

test('colours the badge to match the state', async () => {
  const chrome = start();
  await chrome.click();
  assert.equal(chrome.badgeBackgrounds.at(-1), '#5a5a63');
  assert.equal(chrome.badgeForegrounds.at(-1), '#ffffff');
  await chrome.click();
  assert.equal(chrome.badgeBackgrounds.at(-1), '#ff6b35');
  assert.equal(chrome.badgeForegrounds.at(-1), '#1b1b1f');
});

test('the tooltip spells out the state and what a click does', async () => {
  const chrome = start();
  await chrome.click();
  assert.match(chrome.titles.at(-1), /video is playing normally/i);
  assert.match(chrome.titles.at(-1), /click to go back to audio only/i);
  await chrome.click();
  assert.match(chrome.titles.at(-1), /audio only/i);
  assert.match(chrome.titles.at(-1), /click to play video normally/i);
});
