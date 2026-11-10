# Challenger Clash — Animated Gambler Minigame Update

## Updating an existing GitHub repository

Use the **CHANGED-FILES** ZIP if you already installed the Gambler Selection Fix (which also includes the Railway Docker fix).

### Replace these existing files (same paths)

1. `server.js` (repository root)
2. `public/index.html`
3. `scripts/check.js`
4. `test/gambler.test.js`
5. `README.md` (documentation)
6. `CHANGELOG.md` (documentation)

### Add these new files

- `public/gambler-minigames.css` — **required** for the animated tables, cards, reels and coin.
- `GAMBLER-ANIMATED-UPDATE.md` — optional upload instructions.

**Don't remove `gambler-rules.js`, `Dockerfile`, `package.json`, `public/arena.css`, or your assets.** The game needs them to start. When uploading to GitHub, keep nested file paths; do not put everything in the root.

If you are unsure which version your repository has, use the **FULL-GitHub** ZIP instead, which contains the existing game plus the update.

## Deploying on Railway

Commit your changes and check Railway > Deployments. If auto-deploy is connected to your repository, the new commit should deploy. The existing Dockerfile copies `public/` and includes `gambler-rules.js`; no new environment variables or packages are required.

## Check it in a match

1. Select **The Gambler** in the Fun section and start a fight.
2. Open Special > Blackjack Bash: verify the dealer, hole card, animated hands, Hit / Stand / Split and end reveal.
3. Open Special > Poker Table: verify opponent's facedown cards, your two private cards, community reveal, bets and showdown.
4. Use Double or Nothing, then start an attack: the coin visibly flips, with a server-determined result.
5. Use Relentless Gambler: the three slot reels spin and stop in sequence before displaying the result.
6. Try a match on a phone screen to verify the poker Call / Raise / Fold controls are visible.

## Tests run

`node scripts/check.js` and `node --test test/gambler.test.js test/logic.test.js` passed. Browser-rendered desktop/mobile visuals were tested with simulated room states. The full Socket.IO integration suite requires installing the repository's npm dependencies (`npm install`); a live Railway match still needs confirmation after deployment.
