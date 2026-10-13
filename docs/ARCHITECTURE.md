# oneparty architecture

```
Spotify Web API ─┐                         ┌─ display "main"   (live three.js scene + now-playing + lyrics + audio capture)
LRCLIB lyrics ───┤                         ├─ display "videos" (clip playlist: downloaded + baked loops, beat-reactive)
Home Assistant ◄─┤  server/index.mjs  ─SSE─┤─ control panel    (scenes, mode, tempo, lights, bake, clip download)
yt-dlp ──────────┘  state + commands       └─ bake page        (hidden, records scene loops to cache/)
                         ▲ POST /api/audio (bass/mid/high/beat) from the audio-capturing display
```

## Why live rendering instead of MP4s
The Dawghouse scenes are closed-form functions of loop time `t`. The old pipeline rendered them on CPU (SwiftShader) to JPEG to MP4.
Rendered live on a GPU they run at display refresh, can react to audio, follow the BPM (one loop = 16 beats), and any param
can change mid-party. MP4/WebM is kept only as a **cache** (weak GPUs, the clip monitor, instant replay).

## Channels and modes
Every display is a channel with a `mode`: `live` (render scene), `cached` (play baked loop, falls back to live), `video` (playlist).
Switching is a `scene`/`mode` command; the display crossfades and disposes the old GL context.

## Lighting
`homeassistant.groups[]`: each group has entities, a `kind`, and its own rate limit. Beats from the audio frames drive colour from the
active scene's `palette`. WLED groups can also select an `effect` per scene. Blackout and flash are first-class commands.

## Known limits
- No Spotify audio analysis for new apps -> beat/energy come from live capture.
- Jam: the API reflects what the account's active device plays; being in a Jam on that device works, host-only controls do not.
- Baking records in real time (8 s loop ~ 8 s) via MediaRecorder; deterministic offline rendering would need Playwright + ffmpeg (not done).
- Lyrics are LRCLIB community data; some tracks have none.
