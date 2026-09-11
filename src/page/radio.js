(() => {
  const MINIMUM_QUALITY = 'tiny';
  const UNRESTRICTED_RANGE = ['tiny', 'highres'];
  const PLAYER_EVENTS = ['onPlaybackQualityChange', 'onStateChange'];
  const PAGE_EVENTS = ['loadstart', 'canplay', 'yt-navigate-finish', 'yt-player-updated'];

  const managed = new WeakSet();
  let enabled = false;

  const players = () =>
    [...document.querySelectorAll('.html5-video-player')].filter(
      (node) => typeof node.setPlaybackQualityRange === 'function'
    );

  const enforce = (player) => {
    if (!enabled) {
      return;
    }
    player.setPlaybackQualityRange(MINIMUM_QUALITY, MINIMUM_QUALITY);
  };

  const release = (player) => {
    player.setPlaybackQualityRange(...UNRESTRICTED_RANGE);
  };

  const manage = (player) => {
    if (!managed.has(player)) {
      managed.add(player);
      for (const event of PLAYER_EVENTS) {
        player.addEventListener(event, () => enforce(player));
      }
    }
    enforce(player);
  };

  const scanForPlayers = () => {
    if (!enabled) {
      return;
    }
    for (const player of players()) {
      manage(player);
    }
  };

  const setEnabled = (next) => {
    if (next === enabled) {
      return;
    }
    enabled = next;
    if (enabled) {
      scanForPlayers();
    } else {
      for (const player of players()) {
        release(player);
      }
    }
  };

  document.addEventListener('audio-only:enable', () => setEnabled(true));
  document.addEventListener('audio-only:disable', () => setEnabled(false));

  for (const event of PAGE_EVENTS) {
    document.addEventListener(event, scanForPlayers, true);
  }
})();
