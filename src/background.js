const extension = globalThis.browser ?? globalThis.chrome;

const STATE_KEY = 'enabled';
const ICON_SIZES = [16, 32, 48, 128];

const iconPaths = (enabled) =>
  Object.fromEntries(
    ICON_SIZES.map((size) => [size, `icons/${enabled ? 'icon' : 'off'}-${size}.png`])
  );

const paint = async (enabled) => {
  await extension.action.setIcon({ path: iconPaths(enabled) });
  await extension.action.setTitle({
    title: enabled ? 'Earshot: video off, click to restore' : 'Earshot: off, click to mute the video'
  });
};

const readState = async () => {
  const stored = await extension.storage.local.get(STATE_KEY);
  return stored[STATE_KEY] !== false;
};

extension.action.onClicked.addListener(async () => {
  const enabled = !(await readState());
  await extension.storage.local.set({ [STATE_KEY]: enabled });
  await paint(enabled);
});

extension.runtime.onInstalled.addListener(async () => paint(await readState()));
extension.runtime.onStartup.addListener(async () => paint(await readState()));
