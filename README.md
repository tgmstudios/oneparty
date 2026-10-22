# oneparty

Live party visuals driven by Spotify, with Home Assistant lighting, on 1+ monitors.

## Quick start (Windows)
```
npm run doctor            # lists what to install (Chrome, yt-dlp, ffmpeg)
copy .env.example .env    # add SPOTIFY_CLIENT_ID, HA_URL, HA_TOKEN
npm run party             # hub + fullscreen windows on every configured monitor
```
Open `http://127.0.0.1:8787/auth/spotify/login` once to connect Spotify.

For a separate Bluetooth speaker, open `http://127.0.0.1:8787/control/#/audio` in Chrome or Edge on the PC.
Under **Separate speaker output**, click **Discover / refresh speakers**, allow the browser permission to reveal device names, and choose **Headphones (SoundCore 2)** (or your speaker).
Paste a YouTube video or live stream link and click **Play on speaker**. The panel streams just its audio to that speaker, with play/pause, stop, and its own volume. Long videos start from a small buffer while audio continues downloading, without waiting for the full video. Playback continues when navigating to other control screens or putting the tab in the background; keep the tab open. Use **Test tone** to check the selected output. yt-dlp and ffmpeg must be installed on the hub (`npm run doctor`). YouTube sign-in, when required, is available under Media.
For other PC audio, choose **Windows audio source**, then select a source such as a Voicemeeter bus. Do not capture the speaker you are playing to. Adjust **Audio buffer** from 60 to 15,000 ms: **Live** selects 80 ms, **Smooth** 300 ms, and **Buffered** 3,000 ms. Changes immediately discard the old audio queue. Bluetooth adds its own delay; this is separate from the configured buffer. Both modes are independent of the Windows default output and the visuals' analysis source.

In Claude Code: `/setup` for first-time setup, `/new-event` for each new party. See `docs/ARCHITECTURE.md`.
