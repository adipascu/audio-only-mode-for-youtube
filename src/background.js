const extension = globalThis.browser ?? globalThis.chrome;

const STATE_KEY = 'enabled';
const ICON_SIZES = [16, 32, 48, 128];

const BADGES = {
  pinned: {
    text: 'AUDIO',
    background: '#ff6b35',
    foreground: '#1b1b1f',
    title:
      'Audio Only Mode for YouTube: the picture is off and the video is held at 144p. Click to play video normally.'
  },
  released: {
    text: 'VIDEO',
    background: '#5a5a63',
    foreground: '#ffffff',
    title: 'Audio Only Mode for YouTube: the video is playing normally. Click to go back to audio only.'
  }
};

const iconPaths = (enabled) =>
  Object.fromEntries(
    ICON_SIZES.map((size) => [size, `icons/${enabled ? 'icon' : 'off'}-${size}.png`])
  );

const paint = async (enabled) => {
  const badge = enabled ? BADGES.pinned : BADGES.released;
  await extension.action.setIcon({ path: iconPaths(enabled) });
  await extension.action.setBadgeText({ text: badge.text });
  await extension.action.setBadgeBackgroundColor({ color: badge.background });
  await extension.action.setBadgeTextColor({ color: badge.foreground });
  await extension.action.setTitle({ title: badge.title });
};

const readState = async () => {
  const stored = await extension.storage.local.get(STATE_KEY);
  return stored[STATE_KEY] !== false;
};

extension.action.onClicked.addListener(async () => {
  await extension.storage.local.set({ [STATE_KEY]: !(await readState()) });
});

extension.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && STATE_KEY in changes) {
    paint(changes[STATE_KEY].newValue !== false);
  }
});

const repaintFromStorage = async () => paint(await readState());

extension.runtime.onInstalled.addListener(repaintFromStorage);
extension.runtime.onStartup.addListener(repaintFromStorage);

repaintFromStorage();
