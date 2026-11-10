# Gloved One Hype update — GitHub instructions

This update is based on `Challenger-Clash-November-3-FULL-GitHub.zip` (the Moonwalk / free items / Electricity Turret release). It contains **no changes to other character abilities**.

## Updated gameplay

| Feature | New rule |
|---|---|
| Pitching the Voice | Perfect deals 11 base damage (2 less); cooldown 3 turns |
| Moonwalk | 1 second per arrow; cooldown 2 turns |
| Smooth Criminal | Recreated directly inside the normal battle minigame overlay, 10-second Impossible Lean, cooldown 3 turns |
| Crowd Hype | Damage modifiers: 0–24: −2; 25–49: −1; 50–74: +1; 75–99: +2; 100: +3 |
| Boooo | Effects menu move against Gloved One at ≥50 Hype; drains 25 Hype; cooldown 2 turns |
| The Kid Is Not My Son! | Cooldown 4 turns |

The native Smooth Criminal continues to count Gold time toward both Green and Gold seconds; reaching 5 Gold seconds still grants Tune Deaf, 5 HP healing, and Adrenaline. Its authoritative physics remain in `public/smooth-criminal-physics.js` **which already exists in the previous project and must be kept**.

## Files to replace (CHANGED-FILES ZIP)

- `server.js` — replace
- `public/index.html` — replace
- `public/arena.css` — replace
- `scripts/check.js` — replace
- `test/smooth-criminal.test.js` — replace
- `test/hype-update.test.js` — add new
- `README.md` — replace
- `CHANGELOG.md` — replace
- `UPDATE-HYPE.md` — add new instructions, optional for the game

Upload extracted *contents* into the repository root, preserving the `public`, `scripts` and `test` folder paths. **Do not delete** `public/smooth-criminal-physics.js`, `casino-judas-rules.js`, `gambler-rules.js`, `Dockerfile`, or any audio/video assets.

After committing on GitHub, confirm that Railway deploys the newest commit. Test with two browsers, and hard refresh the game page to clear cached JavaScript/CSS.

## Checks performed

- `node --check server.js` and inline JS compilation
- `node scripts/check.js`
- `node --test` on every focused test file except `test/server.test.js`: **89/89 passed**
- Standalone native scene rendered on 1280×900 desktop and 390×844 phone without browser JS errors

The full live Socket.IO integration test requires `socket.io-client` to be installed; it wasn't installed in this environment. The live Railway multiplayer session remains unverified.
