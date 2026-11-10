# Updating your existing Challenger Clash GitHub repository — The Gambler

This is an **add-on to the previous Challenger Clash Combat Update**. It adds one new champion; your current 1v1 game, other fighters, effects, Charge menu and assets remain.

## If you already uploaded the last Combat Update

Download the **CHANGED-FILES ZIP** for The Gambler, extract it, and upload its contents into your existing GitHub repository **preserving the folder paths**.

### Replace these 5 existing files

1. `server.js` — The Gambler's complete server-controlled combat rules, poker privacy, domain and slots.
2. `public/index.html` — champion option, menu buttons, Blackjack and Poker overlays, slot and coin visual feedback, domain HP bars.
3. `public/arena.css` — responsive card table, minigame and health-bar styling.
4. `README.md` — gameplay and deployment documentation.
5. `CHANGELOG.md` — change history.

### Add these 2 new files

1. `gambler-rules.js` — blackjack deck, scoring, seven-card poker evaluation, and secure slot functions. **Required** — the server won't start without it.
2. `test/gambler.test.js` — rules and simulated multiplayer tests.

Your existing `package.json`, original character images and sounds, and all other game files are unchanged. If your repository does **not** already contain the Combat Update, use the **FULL-GitHub ZIP** instead and upload all extracted files; replace files on GitHub that have matching paths.

## Verify after uploading

In a terminal at the project root (requires Node.js 20 or newer):

```bash
npm install
npm run check
npm test
npm start
```

Visit `http://localhost:3000`, create a room, and select **The Gambler** from the **Fun** characters. For actual multiplayer poker, join with a second browser or friend: your cards stay private. Host the Node.js service with Render or Railway; **GitHub Pages alone cannot run the multiplayer server**. The GitHub update does not auto-deploy unless your hosting platform is connected to the repository.

## Notes on balance and choices

- Blackjack dealer stands at 17; split hands are independently scored; Double Down is a single-card decision with a 1.5× **winning-hand** bonus.
- Poker damage wagers are limited to 20 per player to keep combat manageable. A showdown tie deals zero damage. Losing hands reduce incoming damage from 0 (High Card) to 7 (Straight Flush/Royal Flush).
- A showdown High Card win intentionally gives **+10 next-attack bonus**, following the requested rule, even though it may be unusually powerful; change `POKER_BOOST[0]` in `gambler-rules.js` to rebalance it.
- JACKPOTT lasts for 4 personal turns, +1 for three 7s or at/below 15% HP, and another +1 for three 7s at/below 15 absolute HP. During JACKPOTT, incoming HP damage is prevented and ordinary Momentum gains are disabled.
- Jackpot's healing ability immediately heals 7 HP on use and continues with 7 HP at the start of each remaining JACKPOTT owner turn, for up to the active duration.
- Full browser-to-browser Socket.IO tests require the normal `npm install`; the included new rules and simulated multiplayer tests can also run without dependencies using `node --test test/logic.test.js test/gambler.test.js`.
