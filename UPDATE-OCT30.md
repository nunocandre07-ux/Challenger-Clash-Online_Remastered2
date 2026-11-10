# October 30 update — upload to GitHub and Railway

This release builds on the **Red Judas** release and keeps all previous Gambler, Blue Judas, minigame overlay, and Railway work.

## If your existing repository is already on the Red Judas build

1. Download the **CHANGED-FILES** ZIP.
2. Extract the ZIP.
3. In your existing GitHub repository, choose **Add file → Upload files**.
4. Drag all extracted contents, preserving paths. `public/index.html` must remain under `public/`; `test/october30.test.js` under `test/`.
5. Commit the update. Railway should redeploy the connected branch if auto-deployment is enabled.
6. Verify Railway's service logs and open your `/health` endpoint. Hard-refresh the game, test with **two browser sessions**, and validate Team Rocket and the Judas minigames.

**Never delete `gambler-rules.js`, `casino-judas-rules.js`, or your `Dockerfile`.** The Node server needs both modules; the Dockerfile copies them into the running Railway container.

## What changed

This ZIP contains updated server logic, browser menus and stylesheet, game checks, regression tests, README and CHANGELOG, plus this instruction file. No game media files were deleted or replaced.

## Rules worth knowing

- Team Rocket uses 100 Momentum and blocks enemy Specials for **two of their turns** (a duration chosen as an initial balance value because it wasn't specified).
- Defensive Stance is available only once each of your turns and **does not spend** your main move. Its same-turn -3 attack penalty affects your later damaging moves.
- The Shop offers four server-chosen random items, refreshing after a purchase; National Flag can be used at most twice per player.
- Positive Energy is conversion-only for Blue and Red Judas, and both energy pools are emptied on transformation expiry.
- +7 Momentum from damaging Specials and Charge means **before** the existing champion-wide multiplier; actual displayed gains may be lower or higher.
- Pokémon switching is free while your Pokémon is alive; after fainting, selecting a new Pokémon is required.

## Validation

JavaScript and static bundle checks plus server-mocked combat regression tests were run. The full live Socket.IO test needs dependencies (`npm install`) and two browser clients in a running environment.
