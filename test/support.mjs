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
  return {
    icons,
    titles,
    stored,
    action: {
      setIcon: async (details) => {
        icons.push(details.path);
      },
      setTitle: async (details) => {
        titles.push(details.title);
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
    click: () => Promise.all(clickListeners.map((listener) => listener())),
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
