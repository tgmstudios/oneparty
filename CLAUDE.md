# oneparty

Party visuals hub. Node ESM server (`server/`, no build step) + browser displays (`web/`) rendering three.js scenes live.

- Run: `npm start` (hub only) or `npm run party` (hub + open fullscreen displays). Control panel: `/control.html` = Vue 3 + Vite app in `control/` (built to `web/control/`, auto-built on start; `npm run control:dev` for hot reload, `npm run control:build` after edits). `web/control.html` is the old fallback, used only if the build is missing.
- Events: `events/<slug>/event.json`. Use `/new-event` and `/setup` (skill: `.claude/skills/oneparty-event`).
- All mutations go through `command()` in `server/index.mjs` -> broadcast over SSE (`/api/events`). Add new controls there.
- Scenes: `web/engine/scenes/*.js`, ported from the Dawghouse Halloween 2026 project (`_import/`, gitignored, source of truth for provenance).
- Spotify gives no audio analysis to new apps: reactivity comes from browser audio capture (`web/js/audio.js`).
- Untested on real hardware as of scaffold: display launching on Windows, loopback capture, HA calls, bake. Verify before the party.

## Live agent loop

### Dawghouse scene identity (required)

Every custom scene in the Dawghouse library must visibly carry **DAWGHOUSE** as part of its own 3D artwork and have clear motion tied to the music. Place the name on a diegetic sign, prop, or environmental feature that belongs to the scene; it must render inside the scene in live mode, previews, and bakes. Never add a fixed screen-space/camera-locked logo, corner bug, HUD watermark, or display badge. Give at least one prominent object or environmental feature a clear beat/bass response through `music(t)`. Keep the composition detailed and distinctive instead of relying on the same stage or title layout.

### Hype score (required)

Every new scene needs `hype: { busy, jumpy }` (0-10 each, judged honestly; score = mean): `busy` = how much is going on at once, `jumpy` = how hard it snaps to the beat. The hub rejects a new scene without it (`write_scene`/`promote_scene` `hype` param, `op.mjs new --busy N --jumpy N`). Auto-scene tracks the music's live hype (`state.hype.now`) and starts scenes whose score matches, cutting to hotter ones as the music heats up. Anchors: 2-3 calm/ambient, 5 mid, 7-8 busy party, 9-10 rave (big beat-locked floor/lights, strobes, constant motion). Aim the library at the full range so there is always something to match a lull and a drop.

### Never break what's on air (required)

Displays may be live while agents code. Author scenes off-air (`draft_scene` -> `preview_scene` -> `promote_scene`); never edit shared files in `web/engine/` (`lib*.js`, `dancers.js`, `party.js`, `halloween-*.js`, ...) or `web/js/` casually, because any display that loads a scene afterwards imports them. Make such edits small and finish them in one go, then preview a scene that uses the file. Displays never paint errors on screen (`?debug` to see them); a new scene must survive a 3-frame dry run before replacing the one on air, and a scene that throws later falls back to the last good one. Open pages keep old engine code until reloaded, so reload them after fixing a shared file.

A long-running agent can author scenes, bake them and drive the displays through `tools/op.mjs` (hub must be running; `npm run party` opens windowed displays, `-- --kiosk` for the party).
Lighting zones (control panel Zones page, server/zones.mjs; can be created/linked from Home Assistant areas and floors, re-synced every 5 min): a zone = lights tied to one display, matching that display's scene + beat; zoned lights are removed from the global light set.
Local displays: extra windows on this PC's monitors added from the Displays page (channel.local, `display addLocal`). Every display has overlays, per-display audio (hubAudio/hubSource/hubSink/hubBuffer params) and lyrics timing.
YouTube/yt-dlp URLs stream THROUGH the hub by default (server/ytstream.mjs: yt-dlp + ffmpeg remux to fragmented MP4 at `/api/ytstream`), so any tab just plays a video; `via:"embed"` uses the YouTube player.
Each browser tab on a remote device is its own display (device id in localStorage + tab id in sessionStorage). Remote displays can play the hub audio (param hubAudio) or a YouTube/HLS stream (`stream` command). LAN is on by default (`npm run party`; `party:local` for localhost-only); other devices open `http://<ip>:8787/join.html`, register themselves as a channel (type visuals/videos/mirror, set on the control panel Displays page).
MCP: `.mcp.json` registers `tools/mcp.mjs`. Author off-air: `draft_scene` -> `preview_scene` (headless, never a window; verdict + contact sheet) -> `promote_scene` -> `show_scene`. Other tools: state, now_playing + lyrics, audio_levels, write_scene, show_scene, snapshot, bake, lights, player, ...); approve it on next session start.
Docs: `docs/AGENT.md`, skill `oneparty-live`. Lights use the Home Assistant `scene_presets` integration (per-scene presets in `event.json` -> `homeassistant.presets`).
