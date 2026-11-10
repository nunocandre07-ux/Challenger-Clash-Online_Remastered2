# Challenger Clash — November 3 patch

## What changed

1. **Moonwalk (The Gloved One):** after an arrow input is judged, the next arrow becomes playable immediately, without the old wait.
2. **Stored items:** using items from **My Attack list** does not spend a move for any champion except **The Great Exception**. Great Exception's Magic Bag and stored items still use a turn. **Shop purchases still cost the listed number of turns**, so buying and using an item are distinct actions. Free-use items that open a minigame or an enemy Parry return to the original turn after resolving.
3. **Electricity Turret (Master of Presentation):** 8.5 seconds (half of 17), 15 bullets maximum (including missed shots), smaller collision tolerance, and a clearly displayed ammo counter. Invaders spawn and descend faster to fit the shorter round. The game resolves immediately when you fire the last bullet.

## GitHub update (when your repository has the previous Smooth Criminal update)

Upload these files at exactly the same paths:

- `server.js` — replace
- `public/index.html` — replace
- `test/november3.test.js` — add (automated regression checks)
- `README.md` — replace (documentation)
- `CHANGELOG.md` — replace (release notes)
- `UPDATE-NOV03.md` — add (these instructions; optional)

Do not delete `gambler-rules.js`, `casino-judas-rules.js`, `Dockerfile`, your CSS files, audio, videos, or any other game assets. The full project ZIP is provided as a backup if your repository is missing earlier updates.

## Deployment

Commit the changes to your GitHub repository and make sure Railway deploys the newest commit. Test with two browsers and hard-refresh the game. If Railway crashes, check Deploy Logs for the first stack trace.

## Validation

- `node scripts/check.js`
- `node --test test/*.test.js` (requires all project dependencies, including `socket.io-client`)

The gameplay tests run with simulated socket handlers; a live deployed two-player test is still recommended.
