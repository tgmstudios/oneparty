# Driving oneparty live from an agent loop

Everything is one CLI against the running hub: `node tools/op.mjs <verb>` (run with no args for the list). Equivalent HTTP: `POST /api/cmd`, `GET /api/help`.

## Preconditions
- Hub running: `npm start` (hub only) or `npm run party` (hub + windowed displays; add `-- --kiosk` for fullscreen at the party).
- At least one **visuals** display window open (`node tools/op.mjs launch`). Snapshots and `show` need a live window; `bake` opens its own temporary window.

## The loop
1. **Look**: `node tools/op.mjs state` - now playing, channels, scenes ([baked]/[ERROR]), light status.
2. **Author**: copy `tools/scene-template.js`, edit, then
   `node tools/op.mjs new 09 my-scene.js --title "Name" --palette "#ff2fa0,#4a5cff,#8a2bff" --show`
   - syntax is checked before anything is written; a bad file is rejected with the error.
   - the scene is registered in `event.json` and hot-reloaded on every display that shows it.
   - `--show` puts it on `main` and waits; runtime errors (build or `update()`) come back as `{ok:false,error}`.
3. **See**: `node tools/op.mjs snap` -> prints a `.jpg` path; `Read` that file to look at the frame. Iterate step 2 until it looks right.
4. **Bake**: `node tools/op.mjs bake 09` (or `all` / `missing`). Awaits the render (~8 s/scene, real time), writes `cache/<event>/09.webm`. Rewriting a scene deletes its stale bake.
5. **Display**: `node tools/op.mjs show 09 --cached` (play the baked loop) or without `--cached` (live GPU). `--ch videos` targets another channel.
6. **Lights**: `node tools/op.mjs lights "Trick or treat"` (Hue-style preset spread across all lights), `lights loop|still`, `lights off`, `lights --color #ff6a10`.
7. **Music**: `play | pause | next | prev | vol 60` (needs Spotify Premium and a login that granted playback control).

## Rules of thumb
- Scene contract and helpers are documented at the top of `tools/scene-template.js`. Motion must be periodic in `t` (seamless loop; baking records exactly one loop).
- Never hard-code the event name; use `C.event.title` / `C.event.subtitle`.
- **Brand custom scenes in their artwork.** Every custom visual must visibly say **DAWGHOUSE** on a diegetic sign, prop, or environmental feature designed for that scene. The lettering must be part of the 3D scene so it appears in live renders, previews, and bakes. Never add a fixed screen-space/camera-locked logo, corner bug, HUD watermark, or display badge. Also work `C.event.title` into new scene art where it fits naturally.
- **Make the scene feel authored.** A scene needs a distinctive dominant subject, supporting depth/detail, and a composition that fills the display. Avoid reusing the same centered platform, title sign, and lighting layout for unrelated ideas.
- **Give the picture a musical pulse.** Use `music(t)` and make a visible part of the scene respond to beat or bass, with periodic transforms and original scales preserved. A generic host-wide bloom bump by itself is not enough.
- **Never break what's on air.** Displays can be live while you code. Error text must never reach the picture: `web/js/display.js` only logs to the console and reports to the hub (open a window with `?debug` to see errors on screen). A new scene runs a 3-frame dry run while hidden and only then replaces the one on air; if it throws, the old scene stays. A scene that throws while running is replaced by the last good one (then other library scenes), and is retried after a hot reload. This protects scene code, not shared engine code: files in `web/engine/` (`lib*.js`, `dancers.js`, `party.js`, ...) and `web/js/` load into every display that builds a scene afterwards, and open pages keep the old copy until reloaded. So keep edits to them small and complete (no half-finished states on disk), preview a scene that uses the file before promoting, and reload open displays (`{type:"display",action:"reload"}`) after a fix.
- Don't bake while the party is live on a weak GPU; bakes serialize but still compete for the GPU.
- Remove throwaway scenes with `node tools/op.mjs rm <id>`.
- Audio reactivity: the hub loops back a Windows OUTPUT device itself (WASAPI via `tools/loopback`), no browser involved. Choose the device with `{type:"audioDevice",device:"<name fragment>"|null}`; `state.audioDevices` lists outputs.
- Live settings: everything set via commands is mirrored to `events/<slug>/settings.local.json` and restored on boot; `{type:"settingsReset"}` (or deleting the file) returns to `event.json` defaults.
- Downloads: `node tools/op.mjs dl <url ...> [--start 1:20 --end 2:10] [--playlist all|first --first 5]` queues yt-dlp jobs (one at a time) into `media/<event>/`. YouTube usually needs sign-in cookies: put a `cookies.txt` (browser-extension export, git-ignored) in the project root, or pass `--cookies firefox|brave|edge` (Chromium browsers must be closed).
- **Custom light shows** (preferred over presets for tying lights to a song): `node tools/op.mjs lightshow ...`. A show is a JSON program in `events/<slug>/lightshows.json`, driven by the live beat, tempo and song position instead of a static Hue palette. Fields and a worked example: skill `oneparty-live` -> "Light shows". Precedence on the lights: pinned show > explicitly chosen preset > show bound to the playing song > show bound to the scene > the scene's preset. Fully reversible with `lightshow auto`.
- Per-scene light presets: `event.json` -> `homeassistant.presets` (`{ "05": "Vapor wave" }`, name or UUID; catalogue in `server/presets.mjs`).
- Dev windows render at 720p/30fps by default (`render`/`fps` buttons in the control panel, or `{type:"param",channel,key:"maxH"|"fps",value}`); kiosk is 1440p/60.

## Music in scenes

Display hosts expose `window.oneAudio` each frame; scenes should call `music(t)` from `../lib2.js` (falls back to a synthetic 16-beat grid in bakes/previews).
Fields: `bass mid high level` (live levels), `beat` (0..1 pulse on the beat), `phase` (0..1 within the beat), `anticipate` (0..1 ramp over the 30% before the next beat),
`bar` (0..3), `hue` (turns; steps a quarter turn per bar and lands exactly on the downbeat; use `offsetHSL(hue, 0, 0)` on base colours), `locked`/`conf` (tracker state), `until` (ms to next beat).
The clock is `web/js/beat.js`: a phase-locked tracker over the onset stream (tempo hint = Deezer/audio BPM, +-6%) that predicts future beats and the downbeat; falls back to the loop grid when it has no lock. Tests: `node --test server/beat.test.mjs`.
- **Auto scenes** (music-driven cuts on the main channel): `{type:"autoscene",on:true,bars:8}` via `POST /api/cmd` (also the *Auto scenes* button in the control panel). Cuts on the beat every N bars, on a drop (level surges after a quiet stretch) and on a new song; `pool:["02","05"]` limits which scenes, `shuffle:false` goes in order, `minSec` is the minimum time between cuts. Without audio it falls back to the tempo clock. Scenes that errored are skipped. Persisted in `settings.local.json`.

## Party scenes (themeable dance-party family)
Scenes 13-21 (Monster Mash, Ghost Disco, Zombie Thriller, Mummy Mosh, Monster Ball, Witches' Coven, Frankenstein's Lab, Dracula's Disco, Harvest Hoedown) are ~20-line configs on one engine: `web/engine/party.js` (theme engine) over the shared assets in `web/engine/dancers.js` (rigged dancers, stage parts, beat-locked dance engine, spectrum floor). New one: copy `tools/party-template.js`, change the cast / stage parts / palettes, `op new <id> file.js --show`. To add a character, write a maker in `dancers.js` (and a `MOVES` style if it needs its own dance), then use its name in `cast`. Everything reads the event title from `C.event`, so it re-themes per event.
- The **floor is a live spectrogram**: columns = frequency bands (bass in the centre), rows = the last ~1 s flowing back. It uses `window.oneAudio.bands` from the display host (synthetic in bakes).
- Gotcha: browsers cache imported modules per page. After editing `dancers.js`/`party.js`, run `op launch --force` (reopens the displays) before judging a change; scene files themselves hot-reload.
- **Per-channel reactivity** (`window.oneAudio`, read via `music(t)` in `lib2.js`): analysis runs at 40 Hz end to end. Besides `bass/mid/high/level/beat`: `env[16]` fast per-band envelope (instant attack, ~100 ms release), `hit[16]` per-band onsets (spike when a band jumps over its own baseline, ~130 ms tail), and `kick` (bands 0-2) / `snare` (4-9) / `hat` (11-15) onset envelopes. In party scenes each dancer follows the band for its stage position (bass centre, highs edges), spots follow kick/snare/hat, garland bulbs and sign letters each follow a band. Bakes get synthetic equivalents.

## Lyrics in scenes, and per-scene overlay hiding

`window.oneLyrics` (set by the HUD each frame): `{ title, artist, lines: [{t ms, text}], idx (current line, -1 before the first), pos ms, plain, playing }`, or `null` with no track. Scene 22 (Lyric Flight) is the reference use; it falls back to chant lines when there are no synced lyrics.
Scenes that draw their own lyrics can hide the HUD blocks: `{type:"sceneOpts", scene:"22", hideOverlays:["lyrics"]}` (any of nowplaying|lyrics|bubbles|announcements|motion; `[]` clears). Saved in `settings.local.json`; also a "Hide lyrics block on this scene" switch in the control panel. `scenes[].hideOverlays` in event.json works as an authored default.

## Hype scores

Every scene in `event.json` carries `hype: { busy, jumpy, score }` (0-10, judged by the authoring agent; `score` = mean). `busy` = how much is going on at once (objects, particles, lights, dancers); `jumpy` = how hard it snaps to the beat (camera shake, hops, flashes, strobes). Set it when you write/promote a scene (`hype` param on the scene POST); it survives rewrites. Auto-scene tracks the song's live hype (`state.hype.now`, 0-10) and picks scenes whose score is near it (`hypeMatch`, `hypeSpread`), biases up after drops, and cuts when a scene's hype is >3 away from the music's. Scenes without a score count as 5. **New scenes must be created with a score** (the hub refuses otherwise; `hype:{busy,jumpy}` on `write_scene`/`promote_scene`, `--busy/--jumpy` on `op.mjs new`). Auto-scene now also cuts early when the music runs more than 2 above the current scene.
