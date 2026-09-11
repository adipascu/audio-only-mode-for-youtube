# Privacy policy

Audio Only Mode for YouTube collects nothing.

## What is stored

One value, the on or off state of the toolbar button, kept in the browser's own
`storage.local`. It never leaves the machine it was set on. Uninstalling the
extension removes it.

## What is not done

- No personal or sensitive data is collected.
- No browsing history, page content, watch history or video identifier is read,
  recorded or transmitted.
- No analytics, telemetry, crash reporting or remote logging.
- No network requests of any kind. The extension declares no `host_permissions`
  and has no server to talk to.
- Nothing is sold or shared with anyone, because nothing is gathered.

## Permissions and why

`storage` is the only permission requested, and it exists solely to remember the
switch position across restarts.

The extension runs content scripts on `youtube.com` and `youtube-nocookie.com`.
Those scripts set the player's quality range and draw a panel over the video
area. They do not read page content or send anything anywhere.

## Source

The extension is published under the EUPL-1.2 at
https://github.com/adipascu/audio-only-mode-for-youtube and every claim above can
be checked against it.

## Contact

adrian@pascu.be
