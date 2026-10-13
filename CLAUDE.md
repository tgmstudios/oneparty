# oneparty

Party visuals hub. Node ESM server (`server/`, no build step) + browser displays (`web/`) rendering three.js scenes live.

- Run: `npm start` (hub only) or `npm run party` (hub + open fullscreen displays). Control panel: `/control.html`.
- Events: `events/<slug>/event.json`. Use `/new-event` and `/setup` (skill: `.claude/skills/oneparty-event`).
- All mutations go through `command()` in `server/index.mjs` -> broadcast over SSE (`/api/events`). Add new controls there.
- Scenes: `web/engine/scenes/*.js`, ported from the Dawghouse Halloween 2026 project (`_import/`, gitignored, source of truth for provenance).
- Spotify gives no audio analysis to new apps: reactivity comes from browser audio capture (`web/js/audio.js`).
- Untested on real hardware as of scaffold: display launching on Windows, loopback capture, HA calls, bake. Verify before the party.
