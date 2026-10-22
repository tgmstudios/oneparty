---
name: oneparty-live
description: Drive a running oneparty hub live - write new three.js scenes, preview them with snapshots, bake them to video, switch what each display shows, set lights (HA scene presets) and Spotify playback. Use for "make a scene", "bake", "show X on the main display", "change the lights/music", or running a long agent loop during a party.
---

# oneparty live operator

Read `docs/AGENT.md` first (short). Everything goes through `node tools/op.mjs <verb>`; run it with no args for the verb list.

Loop: `state` -> write scene (start from `tools/scene-template.js`) -> `new <id> <file> --show` -> `snap` and **Read the .jpg** to judge the frame -> fix and repeat -> `bake <id>` -> `show <id> --cached`.

## Procedure (verified live)

1. **Node on Windows.** `node` may not be on PATH in the Bash or PowerShell tool. Use PowerShell and prepend it per call:
   `$env:Path += ';C:\Program Files\nodejs'; node tools/op.mjs state`
   Run from the repo root (`C:\Users\TGM\Documents\Workspaces\oneparty`).
2. **Look first.** `state` shows the hub, `track` (now playing), `channels`, `scenes` (`[baked]`/`[ERROR]`) and the GPU. Existing ids are `01`..`07`; pick the next free id. Scene source lives in `web/engine/scenes/<id>.js`; existing ones are good style references.
3. **Author outside the repo.** Write the draft to the scratchpad dir (not into `web/`), based on `tools/scene-template.js`. `op new` copies it into place and registers it in `event.json`.
   - Imports are `../lib.js` / `../lib2.js` (relative to `web/engine/scenes/`).
   - Export `build(st, C)` returning `{ update(t) }`; `t` is one seamless loop in [0,1), so all motion must be periodic (`TAU * t`, integer multiples).
   - Use `C.event.title` / `C.event.subtitle` for any text; never hard-code the event name.
4. **Create + show:** `node tools/op.mjs new 99 <file> --title "Name" --palette "#a,#b,#c" --show`. Prints `{ok:true,...}` or the build/runtime error. `created:false` just means the id already existed (replaced).
5. **See it:** `node tools/op.mjs snap` prints an `abs` path to a `.jpg` (in `cache/<event>/snapshots/<id>.jpg`). **Read that file** to judge the frame. Do this on every iteration; do not assume it looks right.
6. **Iterate:** edit the draft, re-run `new` with the same id (hot reloads), `snap`, Read again.
7. **Clean up / restore:** `op rm <id>` for throwaways, and `op show <previous-scene-id>` to put the display back to what it was (note `state.channels.main` before you start).

## Gotchas learned

- **Transient "hub not reachable".** A `new` call once failed with this while `state` worked immediately before and after. Re-run `state`, then retry the same command. The failed attempt may have partly registered the scene.
- **Overexposed bloom.** `MeshBasicMaterial` with `toneMapped:false` plus bloom `strength>1`, `threshold<=0.5` and an additive haze washes the whole frame to pastel. Start near `strength 0.6-0.9`, `radius 0.5-0.7`, `threshold 0.75-0.85`, haze opacity `<=0.08`. `threshold 0.9` kills the glow entirely on mid-bright colors. Judge by the snapshot.
- **Ultrawide frame.** Snapshots are ~2048x825 (about 2.5:1), not 16:9. Compose wide; centered ring/tunnel layouts overflow vertically, so keep the main subject within roughly +/-4 world units vertically at camera z=14.
- **Visible extent.** Camera at z=14 shows about +/-5 world units vertically at z=0 and about +/-12.5 horizontally; at z=2 only about +/-4.3 vertically. Text placed at y=-4.2, z=2 gets clipped at the bottom; use y=-3.8, z=0.
- **Fonts.** `C.fonts.script` renders as broken fragments through `extrudeText`; use `C.fonts.block` for titles. Title material: a mid orange (`0xff8a2a`) reads well; near-white blooms into a blob, near-black vanishes on the dark sea.
- **Canvas textures on circles.** Fill the whole canvas with the disc edge color before drawing the disc, otherwise a dark antialias ring shows around it.
- **Seamless rotation.** For `CircleGeometry` ray fans with `n` rays (pattern period `TAU/n`), rotate by an integer multiple of `TAU/n` per loop. Expanding rings use `u = (t*k + i/n) % 1`; waves use integer multiples of `TAU*t`.
- **Dev render is 720p/30.** Kiosk is 1440p/60; don't judge fine detail from dev snapshots.
- **Bake** is real-time (~8 s/scene) and competes for the GPU; not exercised in the first live test, so verify before relying on it.

## Checks before acting

- `state` fails with "hub not reachable": start it (`npm start`, or `npm run party` for windowed displays). Never use `--kiosk` unless the user says it is the real party.
- `show`/`snap` say no display answered: open windows with `op launch`.
- Scene errors come back in the command result; fix the source, do not retry unchanged.

## Hype score (required)

Every new scene needs `hype: { busy, jumpy }` (0-10 each, judged honestly; score = mean): `busy` = how much is going on at once, `jumpy` = how hard it snaps to the beat. The hub rejects a new scene without it (`write_scene`/`promote_scene` `hype` param, `op.mjs new --busy N --jumpy N`). Auto-scene tracks the music's live hype (`state.hype.now`) and starts scenes whose score matches, cutting to hotter ones as the music heats up. Anchors: 2-3 calm/ambient, 5 mid, 7-8 busy party, 9-10 rave (big beat-locked floor/lights, strobes, constant motion). Aim the library at the full range so there is always something to match a lull and a drop.

## Conventions

Scene ids are short strings ("08"); palettes drive light fallback colors and control-panel swatches; light presets per scene are set in `event.json` `homeassistant.presets`. Don't touch `.env` or the HA token. Delete throwaway scenes with `op rm <id>`.

### Required Dawghouse identity for visuals

Every custom scene in this project must visibly say **DAWGHOUSE** as part of its own 3D artwork and bounce or otherwise react visibly to the music. Put the name on a diegetic sign, prop, or environmental feature designed for that scene; it must appear in live renders, previews, and bakes. Never add a fixed screen-space/camera-locked logo, corner bug, HUD watermark, or display badge. New scene art should also use `C.event.title` in-world where it fits. Design a distinctive, detailed focal composition with supporting depth; don't default unrelated scenes to the same centered platform or title treatment. Use `music(t)` to pulse a prominent object or environmental feature, not only the host's global bloom response.

## Song-tied scenes

The scene contract has no track metadata: the display host adds audio reactivity (bloom/exposure/zoom) automatically. To tie a scene to the current song, read `state.track` (e.g. "Island In The Sun - Weezer"), then author the scene's imagery/palette around the song's title and mood, and keep the event theme (Dawghouse Halloween: orange `#ff6a10`, near-black bg `#070100`, jack-o-lanterns, neon). Name the scene after the song in `--title`. Optionally set a matching light preset in `event.json` `homeassistant.presets`.

## Light shows (custom, per-song lighting)

Prefer these over Hue presets when lights should follow a specific song. A show is a program the hub runs against the live beat (`audio.beat`), loudness, tempo and Spotify song position; presets are only a static palette. Full worked example: `tools/lightshow-example.json`.

Workflow:
1. `op state` -> note `track` and which `lights` groups exist (`wled` strips are fast, ~8 updates/s; `bulb` groups update ~1/s and must never be asked to strobe).
2. Write a show JSON in the scratchpad (not the repo). Design from the song's mood/tempo, then in the event palette family unless the song calls for something else.
3. `op lightshow try <file>` runs it without saving; `op lightshow read` returns what Home Assistant reports for each light (rgb, brightness, effect). Check it matches your intent, and ask the user to look at the room if they are present. Iterate.
4. `op lightshow put <file>` saves it (`--play` to also pin it). `op lightshow bind <id> --song` binds it to the song playing now (plays whenever that track starts); `--scene 08` binds it to a scene. `unbind` removes; `auto` releases a pin and returns to bindings/presets.

Fields (all optional but `palette` and `id`): `palette` (1-12 `#rrggbb`), `brightness` 1-255 base, `motion` = `chase|alternate|same|random|static|drift|breathe`, `step` = `beat|time` with `every` beats or `period` s, `spread` (drift phase between lights), `beat` = `none|pulse|flash` with `depth` 0-1, `decay` s, `flashColor`, `level` (loudness lift 0-1), `effect` (WLED effect name; strips otherwise reset to Solid).
- `groups`: per-group overrides keyed by group name (`strips`, `bulbs`, ...) or kind (`wled`, `bulb`). Use this to let strips punch while bulbs glide.
- `cues`: `[{at: seconds, label, ...overrides, groups?}]`, latest cue at or before the song position applies. Only author cues from real knowledge of the song's structure (or from the lyrics timing in `state.lyrics`); never invent drop times.
- Beats come from the loopback audio; if none are detected for 1.5 s while a song plays, the show keeps time from `state.bpm`.
- Precedence: pinned show > explicit preset > song-bound show > scene-bound show > scene preset. `blackout`, `lights mode off|manual` and `--color` stop the show.

### Beat clock and realtime strips
- Shows read a **predictive beat clock** (`server/beatclock.mjs`): the song tempo as a metronome, phase-locked to detected onsets, so it survives breaks and half/double-time hats and corrects a database tempo that is a few BPM off. Each group is read ahead by its latency (`lead` ms in the group config; default 40 for wled, 300 for bulbs) so lights land on the beat. `op lightshow read` / `op state` show `running.beat` = `{bpm, locked, conf, errMs}`; `locked:false` for long means the audio device or tempo is wrong, check those before blaming the show.
- **Realtime strips (DDP).** Add `"realtime":[{"entity":"light.bed_led_strip","ip":"192.168.x.x","leds":60}]` to a wled group in `event.json` `homeassistant.profiles.<profile>[]`. Those strips are then driven over UDP :4048 at ~30 fps with no Home Assistant round-trip (WLED reverts to its own state ~2.5 s after the show stops). Without `realtime` they use HA as before. Needs the strip's LAN IP and LED count; ask the user, they are not discoverable via the HA API.

### Autopilot (default on)
With no pinned show, chosen preset, or song/scene-bound show, the hub **generates a show automatically** (`generateShow` in `server/lightshow.mjs`) from the current scene's palette and the song's tempo, and adapts it to live energy: `calm` (quiet), `build` (rising), `drop` (peak), else `groove`. `op state`/`lightshow read` show `running.energy`. Authoring is only needed when a song deserves better than that. `op lightshow keep [id]` saves the running autopilot show, binds it to the current song, and you can then edit its JSON in `events/<slug>/lightshows.json` (add `cues`, tweak `levels`) and `put` it back. Turn autopilot off with `{type:"lights",autopilot:false}` (falls back to scene presets).

## Party scenes (themeable)
Dance-party scenes are configs, not code: copy `tools/party-template.js` (options documented in `web/engine/party.js`) and `op new <id> file.js --show`. Casts, stage sets and palettes are reusable assets from `web/engine/dancers.js`; the floor is a music spectrogram; dancers/lights follow `window.oneAudio` (beat phase, level, bass, bands). After editing `dancers.js`/`party.js` run `op launch --force` (modules are cached per page), then snap and Read the jpg. Scenes 13-21 are the examples. A `0xff...` hex sign colour set via `sign:{color,emis,sub,subEmis}`; empty cast slots are `null`.
