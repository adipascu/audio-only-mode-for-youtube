import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createPlayer, readSource, run } from './support.mjs';

const source = await readSource('page/radio.js');

const start = (initialPlayers = []) => {
  const players = [...initialPlayers];
  const document = createDocument(players);
  run(source, { document });
  const fire = (name) => {
    for (const listener of document.listeners.get(name) ?? []) listener({ type: name });
  };
  return {
    document,
    fire,
    appear: (player) => players.push(player),
    enable: () => fire('audio-only:enable'),
    disable: () => fire('audio-only:disable')
  };
};

test('listens for the switch and for the events that surface a player', () => {
  const page = start();
  assert.deepEqual(
    [...page.document.listeners.keys()],
    [
      'audio-only:enable',
      'audio-only:disable',
      'loadstart',
      'canplay',
      'yt-navigate-finish',
      'yt-player-updated'
    ]
  );
});

test('leaves the player alone until it is switched on', () => {
  const player = createPlayer();
  const page = start([player]);
  page.fire('loadstart');
  page.fire('yt-navigate-finish');
  assert.deepEqual(player.qualityCalls, []);
  assert.equal(player.listenerCount('onStateChange'), 0);
});

test('pins the players that exist when it is switched on', () => {
  const player = createPlayer();
  const page = start([player]);
  page.enable();
  assert.deepEqual(player.qualityCalls, [['tiny', 'tiny']]);
});

test('pins a player that appears while it is on', () => {
  const page = start();
  page.enable();
  const player = createPlayer();
  page.appear(player);
  page.fire('loadstart');
  assert.deepEqual(player.qualityCalls, [['tiny', 'tiny']]);
});

test('re-pins the quality when the player drifts off it', () => {
  const player = createPlayer();
  const page = start([player]);
  page.enable();
  player.emit('onPlaybackQualityChange');
  assert.deepEqual(player.qualityCalls, [
    ['tiny', 'tiny'],
    ['tiny', 'tiny']
  ]);
});

test('hands the quality range back when it is switched off', () => {
  const player = createPlayer();
  const page = start([player]);
  page.enable();
  page.disable();
  assert.deepEqual(player.qualityCalls, [
    ['tiny', 'tiny'],
    ['tiny', 'highres']
  ]);
});

test('stops re-pinning once it is switched off', () => {
  const player = createPlayer();
  const page = start([player]);
  page.enable();
  page.disable();
  player.emit('onPlaybackQualityChange');
  player.emit('onStateChange');
  page.fire('loadstart');
  assert.deepEqual(player.qualityCalls, [
    ['tiny', 'tiny'],
    ['tiny', 'highres']
  ]);
});

test('ignores a repeated switch in the same direction', () => {
  const player = createPlayer();
  const page = start([player]);
  page.enable();
  page.enable();
  assert.deepEqual(player.qualityCalls, [['tiny', 'tiny']]);
});

test('subscribes to each player once across repeated scans', () => {
  const player = createPlayer();
  const page = start([player]);
  page.enable();
  page.fire('loadstart');
  page.fire('yt-navigate-finish');
  assert.equal(player.listenerCount('onPlaybackQualityChange'), 1);
  assert.equal(player.listenerCount('onStateChange'), 1);
});
