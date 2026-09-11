# Earshot

Listen to YouTube without paying for the video. Earshot pins the player to its
lowest video quality, so a tab you are only listening to stops pulling megabytes
of pictures nobody is looking at.

## What it costs to watch a video you are not watching

Sizes for one 3:33 video, taken from the `contentLength` YouTube publishes for each
format on 11 September 2026. Auto quality picked 1080p AV1 on a normal window.

| Track | Default | Earshot |
| --- | --- | --- |
| Video | 29.01 MB (1080p AV1, itag 399) | 1.44 MB (144p AV1, itag 394) |
| Audio | 3.27 MB (Opus, itag 251) | 3.27 MB (Opus, itag 251) |
| Total | 32.3 MB | 4.7 MB |

95% off the video, 85% off the download as a whole, and audio is untouched: the
same Opus stream plays either way. The saving grows with whatever your default
quality would have been, since the 1440p and 2160p formats of that same video are
144 MB and 342 MB.

Measure it live rather than taking the table on trust. With Earshot loaded,
`document.querySelector('#movie_player').getPlaybackQuality()` returns `tiny` and
the `<video>` element reports 256x144. Byte counters sampled over a few seconds
will not agree with the table, because the player buffers far ahead of playback.

## Why it is not literally audio-only

It cannot be, on today's web player. YouTube moved desktop playback to server-side
ABR, and the consequences are easy to verify in a console on any watch page:

- `streamingData.adaptiveFormats` entries no longer carry a `url` or a
  `signatureCipher`. There is only a `serverAbrStreamingUrl`, so the trick the
  older extensions use, lifting the audio stream URL and assigning it to the
  `<video>` element, has nothing left to lift.
- Filtering every `video/*` entry out of the player response makes the player give
  up with "Your browser can't play this video".
- So does making `MediaSource.isTypeSupported` reject every video codec.

The player will not start without a video track. The smallest one is 144p, so that
is what Earshot asks for, and what is left is the audio you wanted plus a 144p
video stream that YouTube will not let a client decline. On the video above that
residue is 1.44 MB against 3.27 MB of audio.

## Install

Earshot is not on any store. Build it and load it unpacked.

```sh
node build.mjs
```

Chrome: `chrome://extensions`, turn on Developer mode, Load unpacked, pick
`dist/chrome`.

Firefox: `about:debugging#/runtime/this-firefox`, Load Temporary Add-on, pick
`dist/firefox/manifest.json`.

## Layout

```
src/page/radio.js    the whole behaviour, injected into the page world
src/icons.mjs        draws the icons at build time, no image dependencies
manifest.config.mjs  one manifest, two targets
build.mjs            emits dist/chrome and dist/firefox
test/                node:test, no runner to install
```

Nothing generated is committed. The icons are drawn into `dist` on every build,
so there is no binary in the tree to drift out of sync with the code that made it.

The extension asks for no permissions at all. It declares no host permissions, no
`storage`, no `webRequest`. A content script with `world: "MAIN"` reaches the
player object directly, which is all the behaviour needs.

## Findings worth writing down

- `world: "MAIN"` in the manifest removes the usual `web_accessible_resources`
  dance for talking to a page's own JavaScript. Chrome 111, Firefox 128.
- `setPlaybackQualityRange('tiny', 'tiny')` is the only quality API that sticks.
  Setting it once is not enough, because adaptive bitrate raises the quality again,
  so Earshot re-applies it on the player's own `onPlaybackQualityChange`.
- YouTube Music is a different story from YouTube. Tracks with an art track play
  with `videoWidth === 0`, genuinely audio-only, but only for catalogue music, and
  the web player has no global switch for it.

## License

[EUPL-1.2](LICENSE).
