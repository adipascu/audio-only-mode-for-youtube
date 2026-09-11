import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDomDocument, createExtensionApi, readSource, run } from './support.mjs';

const source = await readSource('content/curtain.js');

const start = ({ players = 1, stored = {} } = {}) => {
  const document = createDomDocument({ players });
  const chrome = createExtensionApi(stored);
  run(source, { document, chrome });
  return {
    document,
    chrome,
    enable: () => document.fire('audio-only:enable'),
    disable: () => document.fire('audio-only:disable'),
    panels: () => document.querySelectorAll('.audio-only-curtain'),
    style: () => document.getElementById('audio-only-curtain-style')
  };
};

test('draws nothing until it is switched on', () => {
  const page = start();
  page.document.fire('loadstart');
  assert.equal(page.panels().length, 0);
  assert.equal(page.style(), null);
});

test('covers every player once switched on', () => {
  const page = start({ players: 3 });
  page.enable();
  assert.equal(page.panels().length, 3);
});

test('hides the video and the cued thumbnail rather than showing either', () => {
  const page = start();
  page.enable();
  const css = page.style().textContent;
  assert.match(css, /\.html5-video-player video \{ visibility: hidden; \}/);
  assert.match(css, /ytp-cued-thumbnail-overlay/);
});

test('explains itself and offers a way out', () => {
  const page = start();
  page.enable();
  const [panel] = page.panels();
  assert.match(panel.text(), /Audio only/);
  assert.match(panel.text(), /holding this video at its lowest quality/);
  assert.match(panel.text(), /a small video stream still downloads/i);
  const button = panel.tree().find((node) => node.tagName === 'BUTTON');
  assert.equal(button.textContent, 'Show video');
});

test('the way out switches the extension off', async () => {
  const page = start();
  page.enable();
  const button = page
    .panels()[0]
    .tree()
    .find((node) => node.tagName === 'BUTTON');
  button.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.chrome.stored.enabled, false);
});

test('covers a player that appears later', () => {
  const page = start({ players: 0 });
  page.enable();
  assert.equal(page.panels().length, 0);
  page.document.addPlayer();
  page.document.fire('loadstart');
  assert.equal(page.panels().length, 1);
});

test('covers each player only once', () => {
  const page = start();
  page.enable();
  page.document.fire('loadstart');
  page.document.fire('yt-navigate-finish');
  assert.equal(page.panels().length, 1);
});

test('leaves no trace once switched off', () => {
  const page = start({ players: 2 });
  page.enable();
  page.disable();
  assert.equal(page.panels().length, 0);
  assert.equal(page.style(), null);
});

test('stays away after being switched off', () => {
  const page = start();
  page.enable();
  page.disable();
  page.document.fire('loadstart');
  assert.equal(page.panels().length, 0);
});
