# Challenger Clash — Rhythm Hotfix (GitHub / Railway)

This update builds on `Challenger-Clash-Gloved-One-CHANGED-FILES.zip` / the complete Gloved One edition.

## Upload changed files

Upload the **contents** of the changed-files ZIP to the root of your existing GitHub repository. Keep the folders and filenames unchanged.

Replace:
- `server.js`
- `public/index.html`
- `public/arena.css`
- `README.md`
- `CHANGELOG.md`

Add:
- `test/rhythm-hotfix.test.js`
- `UPDATE-RHYTHM.md` (documentation; optional)

Do not delete `gambler-rules.js`, `casino-judas-rules.js`, the `public/audio`/`public/video` assets, or the Dockerfile.

After committing, verify Railway deploys the newest commit. Refresh your game using Ctrl+Shift+R. Test Beat It, Light-Up Footwork and a real two-player Dance Battle.

## Local checks

Run `npm install`, `npm run check`, and `npm test` (the full Socket.IO integration test requires `socket.io-client`).

## What changed

- Beat It: real solo ten-note falling-arrow rhythm game with streak-based acceleration; every hit adds one damage.
- Dance Battle: note/receptor alignment, input queueing, and limited server-checked latency compensation.
- Light-Up Footwork: one quiet preparation second, resilient rapid-tap input and live clock.
- Gloved One + Red Judas minigame UIs: stable controls and continuous clocks/visual feedback.
- No character balances, damage rules, shop items, or domain mechanics changed.
