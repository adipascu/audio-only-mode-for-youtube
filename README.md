# Audio Only Mode for YouTube

Listen to YouTube without the video. A browser extension for Chrome and Firefox
that pins the player to its lowest quality and covers the picture, so a tab you
are only listening to stops pulling megabytes of images nobody is looking at. On
the video measured below, that is 85% less data.

## What it costs to watch a video you are not watching

Sizes for one 3:33 video, taken from the `contentLength` YouTube publishes for each
format on 11 September 2026. Auto quality picked 1080p AV1 on a normal window.

| Track | Default | Audio only mode |
| --- | --- | --- |
| Video | 29.01 MB (1080p AV1, itag 399) | 1.44 MB (144p AV1, itag 394) |
| Audio | 3.27 MB (Opus, itag 251) | 3.27 MB (Opus, itag 251) |
| Total | 32.3 MB | 4.7 MB |

95% off the video, 85% off the download as a whole, and audio is untouched: the
same Opus stream plays either way. The saving grows with whatever your default
quality would have been, since the 1440p and 2160p formats of that same video are
144 MB and 342 MB.

Measure it live rather than taking the table on trust. With the extension loaded,
`document.querySelector('#movie_player').getPlaybackQuality()` returns `tiny` and
the `<video>` element reports 256x144. Byte counters sampled over a few seconds
will not agree with the table, because the player buffers far ahead of playback.

## Why it is not literally audio-only

It cannot be, on today's web player. YouTube moved desktop playback to server-side
ABR, and the consequences are easy to verify in a console on any watch page:

- `streamingData.adaptiveFormats` entries no longer carry a `url` or a
  `signatureCipher`. There is only a `serverAbrStreamingUrl`, so an approach that
  lifts the audio stream URL and assigns it to the `<video>` element has nothing
  left to lift.
- Filtering every `video/*` entry out of the player response makes the player give
  up with "Your browser can't play this video".
- So does making `MediaSource.isTypeSupported` reject every video codec.

The player will not start without a video track. The smallest one is 144p, so that
is what this asks for, and what is left is the audio you wanted plus a 144p video
stream that YouTube will not let a client decline. On the video above that residue
is 1.44 MB against 3.27 MB of audio.

## How this compares

The Firefox field, measured from the AMO API on 11 September 2026:

| Add-on | Users | Rating | Last updated |
| --- | --- | --- | --- |
| Music Mode for YouTube | 3,010 | 4.3 | July 2026 |
| Youtube audio_only | 1,174 | 3.5 | January 2024 |
| Audio Only for YouTube | 1,165 | 3.4 | May 2025 |
| YouTube Audio Mode | 209 | 4.1 | August 2026 |
| Tube Audio Options+ | 136 | 4.1 | September 2026 |
| Stream Audio Only | 133 | 3.4 | September 2024 |

This extension sets a quality range on the player object and re-applies it when
adaptive bitrate drifts off it, so it never needs a stream URL from the player
response. An approach that reads the audio stream URL directly depends on a field
the SABR player response no longer carries.

Which approach each add-on above takes was not checked, so read the table as a map
of the field rather than a verdict on any of them. Each has its own feature set,
and Music Mode covers YouTube Music as well, which this does not.

## What you see instead of the video

The player area goes flat black with a line saying the audio is playing without the
picture, and a **Show video** button. That button switches the extension off, which
brings the picture back everywhere until you turn it on again from the toolbar.

The original thumbnail is not used as a backdrop. YouTube's own cued-thumbnail
overlay is hidden along with the video, so a paused tab shows the same plain panel
rather than a still from the video.

The panel sits inside the player at `z-index: 1`, below YouTube's control bar at
`z-index: 59`, so play, pause, seek and volume keep working behind it. Everything
outside the player is untouched: the feed, the sidebar and the thumbnails
elsewhere on the page look exactly as they did. An inline hover preview in the feed
is a player too, so it gets the same panel while it is running.

## The switch

The toolbar button is the whole interface, and it is labelled with what you are
getting rather than with a switch position:

| Badge | Means |
| --- | --- |
| **AUDIO** on orange | The picture is off and the video is held at 144p |
| **VIDEO** on grey | The video is playing normally |

"On" and "off" are deliberately avoided. For an extension whose job is to disable
something, "off" is ambiguous: it could mean the extension is off, or the video is.
Naming the outcome avoids that. The tooltip says the same thing in a sentence,
names the extension, and states what a click will do.

Clicking swaps between the two. There is no popup, no options page and no
settings. The state is global rather than per site, it starts on audio, it
survives a restart, and flipping it takes effect on open tabs immediately without
a reload.

## Install

Not published yet. The pipeline below is ready, but the listing itself still has
to be created by hand. Until then, build it and load it unpacked.

```sh
npm run build
```

Chrome: `chrome://extensions`, turn on Developer mode, Load unpacked, pick
`dist/chrome`.

Firefox: `about:debugging#/runtime/this-firefox`, Load Temporary Add-on, pick
`dist/firefox/manifest.json`.

The same build also writes `dist/chrome.zip` and `dist/firefox.zip`, which are the
packages a store wants.

## Releasing

`.github/workflows/publish.yml` publishes to the Chrome Web Store on a push to
`main`, but only when the `version` in `package.json` differs from the previous
commit. The store rejects a package whose version it already holds, so an
unchanged version means the job does nothing rather than fails. A release is
therefore a version bump, merged like any other change:

```sh
npm version patch --no-git-tag-version
```

It talks to version 2 of the Chrome Web Store API, since version 1 stops working
on 15 October 2026, and authenticates as a service account so there is no refresh
token to expire. The listing itself is entered by hand once, because V2 cannot
create items and publishing fails until the dashboard's listing and privacy tabs
are filled in. The copy to paste is in `store/listing.md` and the credentials the
workflow needs are set up in `store/SETUP.md`.

A manual run from the Actions tab skips the version comparison and publishes
anyway, which is the retry path when a publish fails for a transient reason.

## Layout

```
src/page/radio.js      holds the player at 144p, runs in the page world
src/content/curtain.js replaces the picture with the panel
src/content/bridge.js  relays the on/off state into both worlds
src/background.js      owns the toolbar button and the stored state
src/icons.mjs          draws the icons at build time, no image dependencies
src/zip.mjs            packs a built target, no archiver dependency
src/crc32.mjs          the checksum both the png and the zip writer need
manifest.config.mjs    one manifest, two targets
build.mjs              emits dist/chrome and dist/firefox, zipped
scripts/publish-chrome.mjs  uploads and publishes to the Chrome Web Store
scripts/version.mjs    tells the workflow whether the version moved
store/                 the listing copy and the one-time setup
test/                  node:test, no runner to install
```

Nothing generated is committed. The icons are drawn into `dist` on every build,
so there is no binary in the tree to drift out of sync with the code that made it.

`storage` is the only permission, for remembering whether the switch is on. The
manifest declares no `host_permissions`, because a content script with
`world: "MAIN"` reaches the player object directly, so nothing needs `webRequest`
or `web_accessible_resources`. The content scripts still match YouTube pages, and
the store surfaces those match patterns as host access. The
two worlds talk through bare `audio-only:enable` and `audio-only:disable` DOM
events, which carry no payload and so need no cross-world cloning.

## Findings worth writing down

- `world: "MAIN"` in the manifest removes the usual `web_accessible_resources`
  dance for talking to a page's own JavaScript. Chrome 111, Firefox 128.
- `setPlaybackQualityRange('tiny', 'tiny')` is the only quality API that sticks.
  Setting it once is not enough, because adaptive bitrate raises the quality again,
  so it is re-applied on the player's own `onPlaybackQualityChange`.
- Two content scripts in the same isolated world share one global lexical scope, so
  a top-level `const` of the same name in both is a hard `SyntaxError` that kills
  the second script silently. Wrap every content script in an IIFE. A test runs the
  isolated scripts into one context to keep that from coming back.
- Chrome ignores `--load-extension` on recent versions, with or without
  `--disable-features=DisableLoadExtensionCommandLineSwitch`, so an automated clean
  profile cannot load an unpacked build. Injecting the built files with
  `Page.addScriptToEvaluateOnNewDocument` exercises the same code instead.
- YouTube Music is a different story from YouTube. Tracks with an art track play
  with `videoWidth === 0`, genuinely audio-only, but only for catalogue music, and
  the web player has no global switch for it.
- A Google OAuth consent screen left in Testing hands out refresh tokens that die
  after seven days, so a publish pipeline built on one breaks every week. A service
  account sidesteps the whole problem, which is why this uses one. Its JSON key
  signs an RS256 assertion that `node:crypto` can produce with no dependency.
- A zip is a short enough format to write by hand when the only alternative is a
  dependency. Local header, deflate-raw body, central directory, end record. Fixing
  the timestamps to the 1980 DOS epoch makes the archive reproducible, so the same
  tree always packs to the same bytes.

## Privacy

Nothing is collected. One boolean lives in `storage.local` and never leaves the
machine. [PRIVACY.md](PRIVACY.md) spells it out.

## License

[EUPL-1.2](LICENSE).
