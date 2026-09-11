import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createExtensionApi, readSource, run, settle } from './support.mjs';

const source = await readSource('content/bridge.js');

const start = async (stored) => {
  const document = createDocument();
  const chrome = createExtensionApi(stored);
  run(source, { document, chrome, CustomEvent });
  await settle();
  return { document, chrome };
};

test('switches on when nothing has been stored yet', async () => {
  const { document } = await start({});
  assert.deepEqual(document.dispatched, ['audio-only:enable']);
});

test('switches on when the stored state says so', async () => {
  const { document } = await start({ enabled: true });
  assert.deepEqual(document.dispatched, ['audio-only:enable']);
});

test('switches off when the stored state says so', async () => {
  const { document } = await start({ enabled: false });
  assert.deepEqual(document.dispatched, ['audio-only:disable']);
});

test('follows the stored state when it changes', async () => {
  const { document, chrome } = await start({});
  chrome.changeStorage({ enabled: { newValue: false } }, 'local');
  chrome.changeStorage({ enabled: { newValue: true } }, 'local');
  assert.deepEqual(document.dispatched, ['audio-only:enable', 'audio-only:disable', 'audio-only:enable']);
});

test('ignores changes to other keys and other storage areas', async () => {
  const { document, chrome } = await start({});
  chrome.changeStorage({ somethingElse: { newValue: false } }, 'local');
  chrome.changeStorage({ enabled: { newValue: false } }, 'sync');
  assert.deepEqual(document.dispatched, ['audio-only:enable']);
});
