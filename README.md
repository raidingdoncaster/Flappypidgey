# Flappy Pidgey

## Run Local Test Environment

From the project root, run:

```bash
npm run test:env
```

Then open:

`http://localhost:8080`

## RDAB Integration (Implemented)

`game.js` now supports RDAB-backed run sessions, score submission, and leaderboard fetch.

### 1. Host inside RDAB

Serve these files inside your RDAB app route (example: `/games/flappypidgey/`):

- `index.html`
- `game.js`
- `style.css`
- `assets/`

### 2. Configure RDAB in page before loading `game.js`

```html
<script>
  window.__RDAB_GAME_CONFIG__ = {
    enabled: true,
    apiBase: "/api/games/flappy",
    launchType: "RDAB_LAUNCH",
    allowedOrigins: ["https://app.rdab.com"],
    useCredentials: true
  };
</script>
```

Optional fields:

- `authToken`: bearer token string (if you do token auth instead of cookie session)
- `user`: `{ displayName, avatarUrl, profileUrl, userId }` for immediate identity display

### 3. Optional iframe launch handshake

The game sends:

- `FLAPPY_READY`

Parent can respond:

```js
iframe.contentWindow.postMessage(
  {
    type: "RDAB_LAUNCH",
    token: "<short-lived-jwt>",
    user: {
      userId: "u_123",
      displayName: "Ash",
      avatarUrl: "https://...",
      profileUrl: "https://app.rdab.com/profile/u_123"
    }
  },
  "https://app.rdab.com"
);
```

### 4. Backend API contract expected by game

- `POST /api/games/flappy/runs/start` -> `{ runId, startedAt }`
- `POST /api/games/flappy/runs/finish` body:
  - `{ runId, score, durationMs, mode, theme, startedAt, finishedAt }`
  response:
  - `{ accepted, rewards, personalBest }`
- `GET /api/games/flappy/leaderboard?board=<id>` -> `{ entries: LeaderboardEntry[] }`

`LeaderboardEntry` shape:

- `userId: string`
- `displayName: string`
- `avatarUrl: string`
- `profileUrl: string`
- `score: number`
- `rank: number`
