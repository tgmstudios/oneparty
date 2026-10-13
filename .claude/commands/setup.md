---
description: First-time oneparty setup - doctor checks, .env, Spotify and Home Assistant connection
---
Load the `oneparty-event` skill. First run `node tools/doctor.mjs`, help the user fix every MISSING item, create `.env` from `.env.example` (ask for values, never echo secrets back), start the server, confirm `/api/state` shows Spotify and Home Assistant status, then offer to run /new-event.
