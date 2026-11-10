# Master of Presentation — GitHub/Railway update

This ZIP is an incremental update to the **Team Rocket** release of Challenger Clash. Do not use its changed-files ZIP on much older repositories; use the full ZIP instead.

## Replace these existing files (keep their paths)
- `server.js`
- `public/index.html`
- `scripts/check.js`
- `README.md`
- `CHANGELOG.md`

## Add these new files
- `public/presentation-minigames.css`
- `test/master-presentation.test.js`

Optional documentation: `UPDATE-PRESENTATION.md`.

Make sure the repository still has `gambler-rules.js`, `casino-judas-rules.js`, and `Dockerfile` in its root. The existing Dockerfile's `COPY public ./public` includes the new stylesheet automatically.

After committing, let Railway deploy the new commit. Check the `/health` endpoint and create a fresh game to test the Master of Presentation menu. **Only Black Mamba unlocks Mamba Strike and Targeting Systems; only Spider Bot unlocks Electricity Turret and Music Speakers.** The unlocks disappear when their power expires.

Tests: `npm install && npm test`; static checks: `npm run check`. The tests use server-side validations, while a live online multiplayer match should still be tested on Railway.
