# Challenger Clash — New Items & Umbrella Update

This update builds on **Challenger-Clash-Hype-Smooth-Criminal**. It keeps your existing champion rules, minigames, online matchmaking, and Railway setup.

## Updating an existing GitHub repository

Upload the following changed/new files at exactly these paths:

| File | Action |
|---|---|
| `server.js` | Replace |
| `public/index.html` | Replace |
| `public/new-items.css` | **Add** |
| `scripts/check.js` | Replace |
| `test/new-items.test.js` | **Add** |
| `README.md` | Replace |
| `CHANGELOG.md` | Replace |
| `UPDATE-ITEMS.md` | **Add**, optional documentation |

Do not delete `gambler-rules.js`, `casino-judas-rules.js`, `public/smooth-criminal-physics.js`, `Dockerfile`, music, or videos.

## Rules / implementation notes

- All six new items are in the standard Magic Bag and shop catalog. The upgraded Magic Bag's limited boosted pool has not been changed.
- Stored-item use remains a free action for everyone except The Great Exception. Minigames preserve this when they finish, even if they involve delayed actions.
- Cards are drawn from a 54-card deck, including two Jokers, and identities stay on the server until chosen. Choose from five facedown cards.
- Magic 8-Ball compares the prediction with the opponent's next main action. If the opponent picks **Action**, that also counts as a wrong prediction.
- Positive/negative candy effects are randomly determined by the server, using existing status-effect rules. The regeneration outcome gives 3 HP per turn for five turns.
- Effects awarding Momentum also award Crowd Hype instead for The Gloved One.
- Umbrella has a more animated interface and retains its existing 2-turn cooldown and defence percentages.

## Sanity checks

```bash
npm install
npm run check
npm test
npm start
```

Deploy the latest GitHub commit to Railway. Ensure the deployed `public/new-items.css` is present, and check a match using Magic 8-Ball, Deck of Cards and Umbrella on two devices. The full live online multiplayer flow still needs deployment verification.
