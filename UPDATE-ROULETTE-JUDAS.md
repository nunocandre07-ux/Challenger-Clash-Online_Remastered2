# Challenger Clash — Fortune Roulette + Judas Energy (GitHub update)

## Update an existing repository

Extract **Challenger-Clash-Roulette-Judas-CHANGED-FILES.zip** and replace the files at exactly the paths in the ZIP. The two new runtime files must be added:

- `casino-judas-rules.js` at the repository root, next to `server.js`
- `public/casino-judas.css` inside `public`

Replace `server.js`, `public/index.html`, `Dockerfile`, `scripts/check.js`, `test/gambler.test.js`, `README.md`, `CHANGELOG.md`, `UPDATE-TO-GITHUB.md`. Add `test/casino-judas.test.js` and this note. Commit to GitHub and confirm Railway deploys the latest commit. **Do not delete** `gambler-rules.js`, `public/gambler-minigames.css`, or your game assets. These remain essential.

For a new GitHub repository use **Challenger-Clash-Roulette-Judas-FULL-GitHub.zip** and upload all its extracted contents.

### Important: Railway deployment

The Dockerfile is updated to copy both `gambler-rules.js` and `casino-judas-rules.js` into the Node image. If using a custom Docker build, make sure both are present or startup will fail with `Cannot find module`.

## New content

### The Gambler: Fortune Roulette

- Opens a full-screen animated European 0–36 roulette table over the fight.
- Choose one standard bet type (straight, split, trio, street, corner, six-line, dozen, column, red/black, even/odd, low/high), then a number where applicable.
- Server draws from the 37 possible wheel pockets fairly; a five-second animated spin plays for **both** players. No real-money gambling, coins, wagers, or purchases.
- Winning payouts (damage, before Defence): straight 30, split 22, trio 20, street 18, corner 16, six-line 13, dozen/column 10, outside even-money 7. Losing bet: 2 damage. Personal cooldown: 5 turns.
- If a **winning** bet includes green zero and the wheel stops there, The Gambler gains the standard 4-turn JACKPOTT without slot pulls. Losing on zero does **not** trigger JACKPOTT.
- Gambling Dance Battle deals an extra 10 damage to the losing fighter (normal invincibility applies).

### Blue and Red Judas: shared energy

- Start each match with 8/8 Cursed Energy (purple) and zero Positive Energy (blue).
- +2 Cursed Energy per personal turn, +1 Positive Energy every third personal turn. Positive takes capacity priority; at most one overcap point may remain until the end of the turn.
- **Convert 3 Cursed → 1 Positive** from Special without using an action. The server validates both energy balances.
- Six Eyes / King of Curses are now 50-Momentum semi-Ultimates and increase total capacity to 20. Their existing temporary passive/domain unlocks remain.

### Blue Judas abilities

- **Limitless: Blue** (3 CE): interactive Gravity Control; drag three drifting objects onto the glowing orb within 10 seconds. Miss: 5 damage and −7 Momentum. Good: 12 damage + Pulled. Perfect: 15 damage + Pulled +1 Blue Charge.
- **Limitless: Red** (2 CE +1 PE): release a pulsing red sphere near a matching ring. Miss: 6; Good: 13 + Off-Balance; Perfect: 17 + Off-Balance +1 Red Charge.
- **Pulled:** the next Red attack can consume it for +3 damage, or it reduces the target's next Guard by 20%. Expires after the opponent's next personal action.
- **Off-Balance:** the opponent's next direct damaging move deals 20% less damage; expires after their next personal action.
- **Reverse Cursed Technique** (3 PE): heals up to 7 HP immediately and at the start of the next two personal turns, for three pulses total. Existing RCT cooldown retained.
- During **Six Eyes**, Limitless Blue becomes **Max Blue** (5 CE), using the same Gravity Control minigame with +4 base damage. The player can spend 0–2 Blue Charges: +2 damage per charge; spending two inflicts a randomly selected existing debuff.
- **Max Red is not fully specified yet.** For now, it retains its previous damage, effects and cooldown, is available under Six Eyes, and can spend 0–2 Red Charges for the same +2 per charge / two-charge random-debuff rule. Its energy cost and redesigned behavior will be updated when you provide the remaining instructions.

### Red Judas

- Has the same Cursed / Positive Energy bar, passive generation and free conversion. King of Curses now costs 50 Momentum and raises capacity to 20. Other Red Judas moves are otherwise preserved until you supply their new designs.

## Testing

Run `npm install`, then `npm run check` and `npm test` locally, or review your GitHub Actions CI. The new pure-rules and simulated multiplayer tests passed in our build. The full live Socket.IO integration tests require `socket.io-client`; dependency installation was unavailable in the build environment here.
