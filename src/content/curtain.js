(() => {
  const extension = globalThis.browser ?? globalThis.chrome;

  const STYLE_ID = 'earshot-curtain-style';
  const PANEL_CLASS = 'earshot-curtain';
  const PAGE_EVENTS = ['loadstart', 'canplay', 'yt-navigate-finish', 'yt-player-updated'];

  const STYLE = `
  .html5-video-player video { visibility: hidden; }
  .html5-video-player .ytp-cued-thumbnail-overlay,
  .html5-video-player .ytp-storyboard-framepreview { display: none !important; }
  .${PANEL_CLASS} {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1em;
    padding: 1.5em;
    box-sizing: border-box;
    background: #0f0f0f;
    color: #f1f1f1;
    font-family: Roboto, Arial, sans-serif;
    font-size: clamp(10px, 1.6cqw, 15px);
    container-type: inline-size;
    text-align: center;
    line-height: 1.5;
  }
  .${PANEL_CLASS} p { margin: 0; max-width: 42em; }
  .${PANEL_CLASS} .earshot-curtain-lead { font-size: 1.5em; font-weight: 500; }
  .${PANEL_CLASS} .earshot-curtain-note { color: #aaa; font-size: 0.9em; }
  .${PANEL_CLASS} button {
    font: inherit;
    font-weight: 500;
    color: #0f0f0f;
    background: #f1f1f1;
    border: 0;
    border-radius: 999px;
    padding: 0.7em 1.6em;
    cursor: pointer;
  }
  .${PANEL_CLASS} button:hover { background: #fff; }
  .${PANEL_CLASS} button:focus-visible { outline: 2px solid #ff6b35; outline-offset: 3px; }
  `;

  const players = () => document.querySelectorAll('.html5-video-player');

  const buildPanel = () => {
    const panel = document.createElement('div');
    panel.className = PANEL_CLASS;

    const lead = document.createElement('p');
    lead.className = 'earshot-curtain-lead';
    lead.textContent = 'Audio only';

    const body = document.createElement('p');
    body.textContent =
      'Earshot is holding this video at its lowest quality and keeping the picture off, so the tab downloads sound instead of pictures.';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Show video';
    button.addEventListener('click', () => {
      extension.storage.local.set({ enabled: false });
    });

    const note = document.createElement('p');
    note.className = 'earshot-curtain-note';
    note.textContent = 'That switches Earshot off everywhere until you turn it back on from the toolbar.';

    panel.append(lead, body, button, note);
    return panel;
  };

  const draw = () => {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = STYLE;
      document.head.append(style);
    }
    for (const player of players()) {
      if (!player.querySelector(`:scope > .${PANEL_CLASS}`)) {
        player.append(buildPanel());
      }
    }
  };

  const erase = () => {
    document.getElementById(STYLE_ID)?.remove();
    for (const panel of document.querySelectorAll(`.${PANEL_CLASS}`)) panel.remove();
  };

  let enabled = false;

  document.addEventListener('earshot:enable', () => {
    enabled = true;
    draw();
  });

  document.addEventListener('earshot:disable', () => {
    enabled = false;
    erase();
  });

  for (const event of PAGE_EVENTS) {
    document.addEventListener(
      event,
      () => {
        if (enabled) draw();
      },
      true
    );
  }
})();
