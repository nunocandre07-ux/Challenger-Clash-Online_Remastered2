# November 2 combat update — GitHub and Railway

## Existing GitHub repository

1. Download `Challenger-Clash-November-2-CHANGED-FILES.zip`.
2. Extract it and open the existing GitHub repository.
3. Upload the extracted contents to the repository **root**, keeping the `public/`, `scripts/`, and `test/` subfolders intact. Do not upload the ZIP as a single file or put the extracted parent folder inside the repository.
4. Commit the changes. If Railway is connected to your repository, confirm the new deployment succeeds.
5. Hard-refresh the game (`Ctrl+Shift+R`) and create a new room to test the updates.

Changed files include `server.js`, `casino-judas-rules.js`, `public/index.html`, `public/casino-judas.css`, `scripts/check.js`, updated tests, `README.md`, and `CHANGELOG.md`.

**Keep** these pre-existing runtime files: `gambler-rules.js`, `Dockerfile`, `package.json`, `public/video/team-rocket-ultimate.mp4`, and the other assets. Do not delete them.

## Local validation

```sh
npm install
npm run check
npm test
npm start
```

The deployment's working directory must be the repository root. Railway's Dockerfile copies `server.js`, `gambler-rules.js`, and `casino-judas-rules.js`; all three must exist next to `package.json`.

## What changed

- Blue Judas: +1 CE/turn, three-second gravity scene, Max Blue six objects; Max Red has a proper timing minigame, slightly harder Infinity.
- Red Judas: five symbols, partial timeout scoring, no offensive move cooldowns.
- Judas energy can trade 1 Positive → 2 Cursed.
- Effects: no button cooldown, +1 turn for timed Effects-menu statuses; status damage +2.
- Great Exception: Kite, Penguin, Magic Mirror, four-gust Umbrella minigame and adjusted defensive effects.
- Team Rocket: steals an enemy Special for 3 turns, displayed in Ultimate, disables only the stolen move.
- Gloved One: Beat It +3, easier Moonwalk + Groovin, Light-Up Footwork 3×3 memory challenge.

## Testing note

The dependency-free, server-mocked gameplay and static checks pass in the build environment. A real two-browser Socket.IO game on Railway still needs to be played after deploying. If Railway fails to start, inspect Deploy Logs and verify that the two rules modules exist next to `server.js`.
