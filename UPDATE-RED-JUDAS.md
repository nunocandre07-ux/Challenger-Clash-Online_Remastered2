# Challenger Clash — Red Judas Update (2026-10-29)

## Update your existing GitHub repository

Use **Challenger-Clash-RED-JUDAS-CHANGED-FILES.zip** if your repository already contains the latest Six Eyes + button fixes. Extract the ZIP and upload its **contents** (not the outer folder) to the repository root, keeping the directory names intact.

Replace:

- `server.js`
- `public/index.html`
- `public/casino-judas.css`
- `scripts/check.js`
- `test/logic.test.js`
- `README.md`
- `CHANGELOG.md`

Add:

- `test/red-judas.test.js`
- `UPDATE-RED-JUDAS.md` (this guide, optional)

**Keep** `casino-judas-rules.js`, `gambler-rules.js`, `Dockerfile`, and all your `public` game assets. The existing Railway Dockerfile already includes both rule modules. You do not need a new repository.

If your current repository may be missing older updates, use the **FULL-GitHub** ZIP instead of the changed-files ZIP.

## Run checks

```bash
npm install
npm run check
npm test
npm start
```

Then test two online clients or phones. In particular: a Red Judas vs Blue Judas M.S./I.V. Domain Clash; a 15-CE Domain response; replay Fuga and Cleave with mobile controls; monitor Momentum gains with The Great Exception versus another champion. Verify that Railway builds and starts successfully after you commit.

## Implementation notes

- The five Dismantle/Fuga symbols are checked in their original **positions**, not by an unordered symbol count.
- Red Judas minigames share the fixed overlay with Blue Judas and Roulette; all damage and effect results are computed server-side.
- Cleave uses a deliberately irregular rhythm of three scheduled server timestamps, with a 230ms success margin for each press.
- Red Judas special cooldowns, not specified in the request, were chosen as initial balance defaults: Dismantle 3 personal turns, Cleave 3, Fuga 5. Adjust after playtesting.
- Red and Blue RCT heal 7 immediately and on each of the next two personal turns, for 21 HP maximum (subject to HP cap).
- Fuga's doubled Burn deals 6 damage per burn tick for 2 ticks, plus initial attack damage; invincibility and stored Defence remain governed by the existing combat rules.
- Domain M.S. replaces the old D6 slash damage with 5 fixed Domain damage **plus Bleed** during each of the victim's four turns; active Bleed is reapplied as needed.
- The Great Exception's +15% and other characters' −25% apply to positive Momentum gains, rounded per grant; fixed refunds and negative Momentum changes are not scaled.

Full live Socket.IO integration requires installed dev dependencies; local tests with Socket.IO clients have not been independently completed in this environment.
