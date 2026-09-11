(() => {
  const MINIMUM_QUALITY = 'tiny';
  const PLAYER_EVENTS = ['onPlaybackQualityChange', 'onStateChange'];
  const PAGE_EVENTS = ['loadstart', 'canplay', 'yt-navigate-finish', 'yt-player-updated'];

  const managed = new WeakSet();

  const enforce = (player) => {
    player.setPlaybackQualityRange(MINIMUM_QUALITY, MINIMUM_QUALITY);
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
    for (const node of document.querySelectorAll('.html5-video-player')) {
      if (typeof node.setPlaybackQualityRange === 'function') {
        manage(node);
      }
    }
  };

  for (const event of PAGE_EVENTS) {
    document.addEventListener(event, scanForPlayers, true);
  }

  scanForPlayers();
})();
