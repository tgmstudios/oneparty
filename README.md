# oneparty

Live party visuals driven by Spotify, with Home Assistant lighting, on 1+ monitors.

## Quick start (Windows)
```
npm run doctor            # lists what to install (Chrome, yt-dlp, ffmpeg)
copy .env.example .env    # add SPOTIFY_CLIENT_ID, HA_URL, HA_TOKEN
npm run party             # hub + fullscreen windows on every configured monitor
```
Open `http://127.0.0.1:8787/auth/spotify/login` once to connect Spotify.

In Claude Code: `/setup` for first-time setup, `/new-event` for each new party. See `docs/ARCHITECTURE.md`.
