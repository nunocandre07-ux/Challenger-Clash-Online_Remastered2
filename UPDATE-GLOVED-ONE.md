# The Gloved One — dance-performance revamp

This update is based on **Challenger-Clash-November-2-FULL-GitHub.zip**. It preserves the rest of the game.

## Upload to your existing GitHub/Railway repository

Upload/replace these paths from the changed-files ZIP:

- `server.js` (replace)
- `public/index.html` (replace)
- `public/arena.css` (replace)
- `public/audio/gloved-thriller-night.m4a` (**add**, audio supplied by the project owner)
- `test/gloved-revamp.test.js` (**add**)
- `test/november2.test.js` (replace; updates the Footwork cooldown expectation)
- `CHANGELOG.md`, `README.md` (replace)
- `UPDATE-GLOVED-ONE.md` (optional)

Keep all existing files and folders, including `gambler-rules.js`, `casino-judas-rules.js`, `public/video/team-rocket-ultimate.mp4` and `Dockerfile`. Do **not** upload the ZIP as a single GitHub file; extract it and retain folder paths. Railway should rebuild from the new commit if auto-deployment is enabled.

## Notes

- Crowd Hype 0–100 replaces ordinary Momentum gains for The Gloved One; perform dance challenges to gain it (Perfect +20, Good +10, Miss −5).
- Feel the Flow costs 40 Hype, adds 6 damage to the next damaging move, and persists on Perfect performance.
- The Final Show costs 50 Hype, extends Thriller Night one turn, and occupies the former Ultimate button.
- Beat It is now a ten-arrow solo rhythm minigame (+1 base damage per hit), Moonwalk is a five-prompt opposite-arrow memory/reaction minigame (+3 per success), Smooth Criminal rewards precise stopping at 35° or 45°, and Pitching the Voice retains the old Beat It letter minigame with Tune Deaf on Perfect.
- Light-Up Footwork deals 5/10 instead of 7/12 and has a two-turn cooldown.
- Dance Battle adds 1–5 damage to the loser when initiated by The Gloved One.
- During Thriller Night, Zombie Dancers can force the opponent to perform a ten-note challenge; each missed note adds 1 incoming damage. Thriller Night's invincibility and end-of-duration death rule remain.
- The provided track plays during Thriller Night while music is enabled; browser autoplay policies may require prior interaction.

## Verification

Run `node scripts/check.js` and `node --test test/*.test.js` after dependencies are installed. The focused dependency-free suites can be run without installing modules. Full two-browser multiplayer and Railway playback need deployment validation.
