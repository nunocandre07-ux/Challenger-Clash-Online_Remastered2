# November 5 — Challenger Clash GitHub update

## What changed

Reality Manipulation now launches a fair, animated four-pulse Reality Clash. The Great Exception chooses HP rupture, Momentum drain or a temporary button seal. Both players can time the pulses; defending well weakens the Ultimate but does not cancel it. The permanent lock has been removed. Smooth Criminal scoring zones are wider and Gold-time damage is doubled; Beat It does one less base damage. Crowd Hype gains slow down above 60 and high Hype increases incoming attack damage. Pokémon repeat PP costs are enforced across free switches, Team Rocket steals a wider class of currently eligible moves, and The Great Exception earns 5–15 Momentum when a damaging item hits enemy HP.

## Update your existing GitHub repository

Use `Challenger-Clash-November-5-CHANGED-FILES.zip`. Extract it locally, then upload the *contents* to your existing repository, preserving folders. Replace `server.js`, `public/index.html`, `public/smooth-criminal-physics.js`, `scripts/check.js`, `test/smooth-criminal.test.js`, `README.md`, and `CHANGELOG.md`. Add `test/november5.test.js` and this instruction file. Commit and check Railway's deployment status.

If you're not sure which earlier updates are present, use `Challenger-Clash-November-5-FULL-GitHub.zip` instead. It includes the required `gambler-rules.js`, `casino-judas-rules.js`, `Dockerfile`, audio, video, HTML and styles. Upload the extracted **contents**, not the enclosing folder or ZIP.

## Verification

After the deploy turns healthy, open the `/health` route and try a new two-player room. Verify Reality Clash opens for both players; the defender can press its four beats; all seals expire; Smooth Criminal shows the new target widths; Pokémon PP is taxed after consecutive actual moves; and Team Rocket can copy an eligible move. Keep `gambler-rules.js`, `casino-judas-rules.js` and `public/smooth-criminal-physics.js` at their proper locations.

To run focused tests locally (Node.js 22): `node --test test/*.test.js` after `npm install`. The integration test needs `socket.io-client`, which is a dev dependency.

This update has not been tested on your live Railway service.
