import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/page/radio.js', import.meta.url), 'utf8');

const createPlayer = () => {
  const listeners = new Map();
  return {
    qualityCalls: [],
    setPlaybackQualityRange(...args) {
      this.qualityCalls.push(args);
    },
    addEventListener(name, listener) {
      listeners.set(name, [...(listeners.get(name) ?? []), listener]);
    },
    listenerCount(name) {
      return (listeners.get(name) ?? []).length;
    },
    emit(name) {
      for (const listener of listeners.get(name) ?? []) listener();
    }
  };
};

const runScript = (initialPlayers = []) => {
  const players = [...initialPlayers];
  const documentListeners = new Map();
  const context = {
    document: {
      addEventListener(name, listener) {
        documentListeners.set(name, [...(documentListeners.get(name) ?? []), listener]);
      },
      querySelectorAll: () => players
    }
  };
  vm.runInNewContext(source, context);
  return {
    listenedEvents: () => [...documentListeners.keys()],
    appear: (player) => players.push(player),
    fire: (name) => {
      for (const listener of documentListeners.get(name) ?? []) listener();
    }
  };
};

test('listens for the events that surface a new player', () => {
  const page = runScript([]);
  assert.deepEqual(page.listenedEvents(), [
    'loadstart',
    'canplay',
    'yt-navigate-finish',
    'yt-player-updated'
  ]);
});

test('pins a player discovered after load to the minimum quality', () => {
  const page = runScript();
  const player = createPlayer();
  page.appear(player);
  page.fire('loadstart');
  assert.deepEqual(player.qualityCalls, [['tiny', 'tiny']]);
});

test('pins a player that already exists when the script runs', () => {
  const player = createPlayer();
  runScript([player]);
  assert.deepEqual(player.qualityCalls, [['tiny', 'tiny']]);
});

test('ignores nodes that are not players', () => {
  const page = runScript([{ tagName: 'DIV' }]);
  assert.doesNotThrow(() => page.fire('loadstart'));
});

test('re-pins the quality when the player drifts off it', () => {
  const player = createPlayer();
  runScript([player]);
  player.emit('onPlaybackQualityChange');
  player.emit('onStateChange');
  assert.deepEqual(player.qualityCalls, [
    ['tiny', 'tiny'],
    ['tiny', 'tiny'],
    ['tiny', 'tiny']
  ]);
});

test('subscribes to each player once across repeated scans', () => {
  const player = createPlayer();
  const page = runScript([player]);
  page.fire('loadstart');
  page.fire('yt-navigate-finish');
  assert.equal(player.listenerCount('onPlaybackQualityChange'), 1);
  assert.equal(player.listenerCount('onStateChange'), 1);
  assert.equal(player.qualityCalls.length, 3);
});
