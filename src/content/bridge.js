const extension = globalThis.browser ?? globalThis.chrome;

const STATE_KEY = 'enabled';

const announce = (enabled) => {
  document.dispatchEvent(new CustomEvent(enabled ? 'earshot:enable' : 'earshot:disable'));
};

extension.storage.local.get(STATE_KEY).then((stored) => announce(stored[STATE_KEY] !== false));

extension.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && STATE_KEY in changes) {
    announce(changes[STATE_KEY].newValue !== false);
  }
});
