# Smooth Criminal — Perfect Spot update

This update replaces **only** The Gloved One's Smooth Criminal minigame with the user-supplied **The Impossible Lean** balance minigame. All other characters, rhythm games, abilities, and multiplayer systems remain unchanged.

## Rules

- The performer has **10 seconds** (unless they fall over the ±52° limit earlier).
- Hold **Left/Right** or **A/D** (or the large touch buttons) to steer the needle.
- **Green** is ±4°. **Gold** is ±0.8° and is *inside* the green zone.
- Damage = **ceil(seconds in green + seconds in gold)**. Gold time counts toward both.
- At **5.0 or more seconds in gold**, Smooth Criminal additionally applies **Tune Deaf** to the opponent (two turns), restores up to **5 HP** to The Gloved One, and grants **Adrenaline** for their next eligible attack.
- The original game's Gloved One Hype grading and other attack modifiers still apply. Falling ends the minigame early, but damage earned up to that point still counts.
- Server determines the movement, timing, damage and rewards. The browser controls the direction and renders a locally predicted needle, which is regularly synchronized with the authoritative state.

## Update an existing GitHub repository

Extract the changed-files ZIP. Replace or add the files at the *same paths*, without deleting anything else:

- Replace `server.js`
- Replace `public/index.html`
- Replace `public/arena.css`
- **Add** `public/smooth-criminal.html`
- **Add** `public/smooth-criminal-physics.js`
- Replace `scripts/check.js`
- **Add** `test/smooth-criminal.test.js`
- Optionally update `README.md`, `CHANGELOG.md` and add this file.

**Important:** both new files in `public/` are required. The server loads `public/smooth-criminal-physics.js` at startup. Failing to upload it will crash Railway with `MODULE_NOT_FOUND`.

The existing `Dockerfile` already includes `COPY public ./public`, so it needs no change. Once your commit deploys on Railway, start a match as **The Gloved One** and select **Smooth Criminal**. A full, real-network Socket.IO match on Railway should still be tested.
