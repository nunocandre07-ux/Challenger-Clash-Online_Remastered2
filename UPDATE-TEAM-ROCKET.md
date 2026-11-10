# Challenger Clash — Team Rocket video and Ultimate update

This patch is based on the **October 30** version of Challenger Clash. Use it only if you already have that version (or a matching copy of it) on GitHub. Otherwise, upload the FULL zip.

## Upload to your existing GitHub repository

Download and extract the `CHANGED-FILES` ZIP. Upload the files **inside the extracted folder** to your repository, maintaining these exact paths:

- Replace `server.js`
- Replace `public/index.html`
- Replace `public/arena.css`
- **Add `public/video/team-rocket-ultimate.mp4`** (required for the animation and the replacement soundtrack)
- Replace `scripts/check.js`
- Replace `test/october30.test.js`
- Replace `README.md` and `CHANGELOG.md`
- Optionally add `UPDATE-TEAM-ROCKET.md`

No new Node packages or Dockerfile changes are required. The existing `Dockerfile` copies the entire `public` folder and therefore includes the new MP4 automatically.

Commit your files and check the latest Railway deployment. The actual deployment must contain `public/video/team-rocket-ultimate.mp4`.

## What it does

- Team Rocket plays the supplied video in a fullscreen overlay on **both players' screens**. The video has only the replacement audio from `Video Project.m4a` (no original audio); the brief remaining portion of the longer video is silent.
- It disables the opponent's **Special** and **Ultimate** buttons for their **next five completed personal turns**.
- It restores **every Pokémon's HP and every move's PP to maximum**, including benched or fainted Pokémon. It does not heal the Trainer's personal HP.
- If the browser blocks unmuted autoplay, the video plays muted and offers a button to restart with sound. The Music Off preference is respected.

## Verification

`npm run check` validates client scripts and assets; `npm test` runs all tests after `npm install`. The core gameplay test `node --test test/october30.test.js` tests the five-turn lock on both buttons, HP/PP restoration and the synchronized cinematic event.
