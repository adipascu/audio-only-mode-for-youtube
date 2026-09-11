import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

export const readSource = (relativePath) =>
  readFile(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');

export const createDocument = (players = []) => {
  const listeners = new Map();
  return {
    listeners,
    dispatched: [],
    addEventListener(name, listener) {
      listeners.set(name, [...(listeners.get(name) ?? []), listener]);
    },
    dispatchEvent(event) {
      this.dispatched.push(event.type);
      for (const listener of listeners.get(event.type) ?? []) listener(event);
      return true;
    },
    querySelectorAll: () => players
  };
};

export const createExtensionApi = (stored = {}) => {
  const changeListeners = [];
  const clickListeners = [];
  const icons = [];
  const titles = [];
  const badgeTexts = [];
  const badgeBackgrounds = [];
  const badgeForegrounds = [];
  return {
    icons,
    titles,
    badgeTexts,
    badgeBackgrounds,
    badgeForegrounds,
    stored,
    action: {
      setIcon: async (details) => {
        icons.push(details.path);
      },
      setTitle: async (details) => {
        titles.push(details.title);
      },
      setBadgeText: async (details) => {
        badgeTexts.push(details.text);
      },
      setBadgeBackgroundColor: async (details) => {
        badgeBackgrounds.push(details.color);
      },
      setBadgeTextColor: async (details) => {
        badgeForegrounds.push(details.color);
      },
      onClicked: {
        addListener: (listener) => clickListeners.push(listener)
      }
    },
    storage: {
      local: {
        get: async () => ({ ...stored }),
        set: async (values) => {
          Object.assign(stored, values);
          const changes = Object.fromEntries(
            Object.entries(values).map(([key, newValue]) => [key, { newValue }])
          );
          for (const listener of changeListeners) listener(changes, 'local');
        }
      },
      onChanged: {
        addListener: (listener) => changeListeners.push(listener)
      }
    },
    runtime: {
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} }
    },
    click: async () => {
      await Promise.all(clickListeners.map((listener) => listener()));
      await new Promise((resolve) => setImmediate(resolve));
    },
    changeStorage: (changes, area) => changeListeners.forEach((listener) => listener(changes, area))
  };
};

export const createPlayer = () => {
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

export const run = (source, context) => vm.runInNewContext(source, context);

export const settle = () => new Promise((resolve) => setImmediate(resolve));

class FakeNode {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parent = null;
    this.className = '';
    this.id = '';
    this.type = '';
    this.textContent = '';
    this.listeners = new Map();
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  addEventListener(name, listener) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  click() {
    for (const listener of this.listeners.get('click') ?? []) listener();
  }

  hasClass(name) {
    return this.className.split(' ').includes(name);
  }

  tree() {
    return [this, ...this.children.flatMap((child) => child.tree())];
  }

  querySelector(selector) {
    const name = selector.replace(':scope > .', '');
    return this.children.find((child) => child.hasClass(name)) ?? null;
  }

  text() {
    return this.tree()
      .map((node) => node.textContent)
      .filter(Boolean)
      .join(' ');
  }
}

export const createDomDocument = ({ players = 1 } = {}) => {
  const head = new FakeNode('head');
  const body = new FakeNode('body');
  const listeners = new Map();
  const playerNodes = Array.from({ length: players }, () => {
    const player = new FakeNode('div');
    player.className = 'html5-video-player';
    body.append(player);
    return player;
  });
  const everything = () => [...head.tree(), ...body.tree()];
  return {
    head,
    body,
    players: playerNodes,
    createElement: (tag) => new FakeNode(tag),
    getElementById: (id) => everything().find((node) => node.id === id) ?? null,
    querySelectorAll: (selector) =>
      everything().filter((node) => node.hasClass(selector.replace('.', ''))),
    addEventListener(name, listener) {
      listeners.set(name, [...(listeners.get(name) ?? []), listener]);
    },
    fire(name) {
      for (const listener of listeners.get(name) ?? []) listener({ type: name });
    },
    dispatchEvent(event) {
      this.fire(event.type);
      return true;
    },
    addPlayer() {
      const player = new FakeNode('div');
      player.className = 'html5-video-player';
      body.append(player);
      playerNodes.push(player);
      return player;
    }
  };
};
