# AnimePahe Worker API

Cloudflare Worker that wraps AnimePahe endpoints and resolves KwiK stream and download links.

## Deploy
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Arise-in/Animepahe-cf)

Notes:
- Deploy buttons require a public GitHub/GitLab repo.
- If you keep this as a monorepo, Cloudflare supports subdirectory URLs only when the Worker is fully isolated in that subdirectory. Use a repo URL that points at `worker/` if you want to deploy just the Worker.

## Project Layout
- `worker/` Cloudflare Worker source and config
- `worker/src/worker.ts` main request router and API responses
- `worker/src/reqeusts.ts` AnimePahe scraping and KwiK resolution helpers
- `pages/` frontend (optional)
- `animepahe-api-cf/` older worker variant
- `Animepahe-main/` reference project used for logic parity

## Quick Start (Local)
- `cd worker`
- `npm install`
- `npx wrangler dev`

Default local base URL is usually `http://127.0.0.1:8787`.

## Base URL
Set a base URL and use it in all requests:
```
<WORKER_URL>
```
Examples:
- Local dev: `http://127.0.0.1:8787`
- Deployed: `https://<your-worker>.<your-account>.workers.dev`

## Endpoints

### Airing
Request:
```
GET <WORKER_URL>/?m=airing&page=1
```
Response:
```
{
  "paginationInfo": { "total": 0, "perPage": 0, "currentPage": 1, "lastPage": 1, "nextPageUrl": null, "from": 0, "to": 0 },
  "data": [ { "id": 0, "anime_id": 0, "title": "", "episode": 0, "episode2": null, "edition": null, "fansub": "", "image": "", "disc": null, "session": "", "link": "", "filler": null, "created_at": "", "completed": 0 } ]
}
```

### Search
Request:
```
GET <WORKER_URL>/?m=search&q=naruto
```
Response:
```
{
  "paginationInfo": { "total": 0, "perPage": 0, "currentPage": 1, "lastPage": 1, "from": 0, "to": 0 },
  "data": [ { "id": 0, "title": "", "status": "", "type": "", "episodes": 0, "score": 0, "year": 0, "season": "", "poster": "", "session": "", "link": "" } ]
}
```

### Release (Episode List)
Request:
```
GET <WORKER_URL>/?m=release&id=<anime_session>&page=1
```
Optional query params:
- `sort=episode_asc` (default)
- `session=<episode_session>` (filter by episode session)

Response:
```
{
  "paginationInfo": { "total": 0, "perPage": 0, "currentPage": 1, "lastPage": 1, "from": 0, "to": 0 },
  "data": [ { "id": 0, "anime_id": 0, "episode": 0, "episode2": null, "edition": null, "title": null, "snapshot": "", "disc": null, "audio": "jpn", "duration": "", "session": "", "link": "", "filler": null, "created_at": "" } ]
}
```

### Episode (Play)
This is the main endpoint that returns streams and downloads.

Supported formats:
```
GET <WORKER_URL>/?m=episode&id=<anime_session>&episodeId=<episode_session>
GET <WORKER_URL>/?method=episode&session=<anime_session>&ep=<episode_session>
GET <WORKER_URL>/play/<anime_session>/<episode_session>
```

Response:
```
{
  "ids": {
    "animepahe_id": 0,
    "mal_id": 0,
    "anilist_id": 0,
    "anime_planet_id": null,
    "ann_id": 0,
    "anilist": "0",
    "anime_planet": "",
    "ann": "0",
    "kitsu": "",
    "myanimelist": "0"
  },
  "session": "<episode_session>",
  "provider": "kwik",
  "episode": "1",
  "anime_title": "",
  "sources": [
    {
      "url": "https://.../uwu.m3u8",
      "isM3U8": true,
      "embed": "https://kwik.cx/e/...",
      "resolution": "1080",
      "isDub": false,
      "fanSub": "Amazon",
      "download": "https://...mp4?file=Aniflix_..._1080p.mp4"
    }
  ],
  "downloads": [
    {
      "fansub": "Amazon",
      "quality": "Amazon - 1080p (213MB)",
      "resolution": "1080",
      "filesize": "213MB",
      "isDub": false,
      "pahe": "https://pahe.win/....",
      "download": "https://...mp4?file=Aniflix_..._1080p.mp4"
    }
  ]
}
```

## Debug and Trace

### Debug
```
GET <WORKER_URL>/?m=episode&id=<anime_session>&episodeId=<episode_session>&debug=1
```
Returns raw KwiK link metadata:
```
{
  "ids": { ... },
  "session": "<episode_session>",
  "links": [
    {
      "link": "https://kwik.cx/f/....",
      "name": "Amazon - 360p (54MB)",
      "pahe": "https://pahe.win/....",
      "quality": "Amazon - 360p (54MB)",
      "fansub": "Amazon",
      "resolution": "360",
      "filesize": "54MB",
      "isDub": false
    }
  ]
}
```

### Trace
```
GET <WORKER_URL>/?m=episode&id=<anime_session>&episodeId=<episode_session>&trace=1
```
Adds a `trace` field that shows KwiK resolution steps and HTTP status from the resolver.

## ID Resolution
- IDs are extracted from AnimePahe page when available.
- Missing IDs are filled via:
  - Jikan (MAL search)
  - AniList GraphQL (by MAL ID first, then title search)
  - AniList external links to fill ANN, Anime-Planet, and Kitsu

## Environment Variables
Set in `worker/wrangler.toml` or your Cloudflare dashboard:
- `RESOLVER_PLAY_BASE` optional fallback API base (used when KwiK resolution fails)
- `RESOLVER_API_KEY` optional API key sent as `x-api-key`

## Notes
- KwiK resolution uses `/f/` links and a POST resolver API.
- If you hit rate limits, the worker uses a short delay between KwiK requests.
- Download URLs are normalized to use `Aniflix_` in the `file=` parameter.
