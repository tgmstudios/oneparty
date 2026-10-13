---
name: oneparty-event
description: Set up or modify a oneparty event (party visuals). Use when the user wants a new party/event, to add or retheme scenes, map monitors, wire Home Assistant lights, add video clips, or run /setup or /new-event.
---

# oneparty event setup

oneparty is a hub (`server/`) plus browser displays (`web/`). An **event** is one folder: `events/<slug>/event.json`.
All runtime control goes through `POST /api/cmd` (see `server/index.mjs: command()`), so you can drive a running party with curl.

## Workflow

1. **Interview first** (use AskUserQuestion; skip anything already answered):
   - Event name / subtitle / theme + 2-3 accent colours (these become scene palettes and the HUD accent).
   - Monitors: how many, which one is primary, which is the laptop screen (control panel), which plays clips.
   - Audio path: laptop plays Spotify itself (`audioSource: "loopback"`) or mic/line-in (`"mic"`).
   - Spotify: has `SPOTIFY_CLIENT_ID` in `.env`? (developer.spotify.com -> create app, redirect URI `http://127.0.0.1:8787/auth/spotify/callback`).
   - Lights: Home Assistant URL + token in `.env`; entity ids for WLED strips (`kind: "wled"`) and bulbs (`kind: "bulb"`). List candidates with `GET <HA_URL>/api/states` if the user does not know them.
   - Clips: YouTube/video URLs to download into `media/<slug>/`.
2. `node tools/doctor.mjs` - fix anything MISSING (the output gives the install command).
3. `node tools/new-event.mjs <slug> --title "..." --subtitle "..." --from <closest-existing-event>`.
4. Edit `events/<slug>/event.json`: `displays` (id, role `visuals|videos|control`, monitor `primary|secondary|internal|<index>`), `scenes` (id + title + `palette`), `homeassistant.groups`.
5. Clips: `yt-dlp -S vcodec:h264,res:1080,acodec:aac --merge-output-format mp4 -o "media/<slug>/%(title).80s.%(ext)s" <url>` (or the Clips box in the control panel).
6. Start: `npm run party -- --event <slug>` (opens every display fullscreen on its monitor). Then bake loops from the control panel so weak GPUs / the clip monitor have cached video.

## Scenes

Scenes live in `web/engine/scenes/NN.js` and export `build(stage, C)` returning `{ update(t) }`, where `t` in [0,1) is one seamless loop.
`C.event.title` / `C.event.subtitle` are available for text; never hard-code event names. Motion must be periodic in `t` so scenes loop and bake cleanly.
The display host adds audio reactivity (bloom/exposure/zoom) on top of every scene, so scenes need no audio code.
To add a scene: copy the closest existing one, change geometry/materials/palette, add it to `scenes` in event.json.

## Rules

- Never commit `.env` or `.spotify-token.json`.
- Do not use third-party logos/branding in scenes without the user confirming they are authorized (the imported 02L athletics-logo scene is deliberately not included).
- Rate limits: bulbs ~1 call/s, WLED ~8/s. Do not remove the per-group `minGapMs`.
