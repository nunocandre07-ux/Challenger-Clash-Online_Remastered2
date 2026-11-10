# November 5, 2026 — Great Exception and balance update

- **Reality Manipulation:** replaces an excessively powerful permanent rewrite with an animated, server-validated, four-pulse two-player Reality Clash. Limited but meaningful HP/charge/temporary seal effects scale with the participants' timing. The Ultimate always has an effect and keeps two future turns of upgraded Magic Bag.
- **Smooth Criminal:** Green scoring zone widened from ±4° to ±5.5°; Gold from ±0.8° to ±1.2°. Gold damage doubled (Green time + 3× Gold time, with Gold counted inside Green).
- **Beat It:** one less base damage.
- **Crowd Hype:** when starting at 60+ Hype, positive gains are 33% weaker; 50/75/100 Hype adds +1/+2/+3 damage to incoming direct attacks against The Gloved One.
- **Pokémon PP:** consecutive actual moves from one Pokémon cost +1 PP until another Pokémon actually uses a move. Switching alone cannot reset the cost.
- **Team Rocket:** now steals eligible opponent offensive, effect, Pokémon, item-granting, or companion-granting moves that are currently available; the owner's stolen move is blocked by the server and indicated in UI. Original cinematic and full-team recovery remain.
- **The Great Exception items:** 5–15 extra Momentum based on actual enemy HP loss when a damaging item hits, including Magic Bag and purchased inventory items.
- **Tests:** new November 5 rule checks and existing gameplay regression tests. Live Railway multiplayer verification is still needed.

---

# November 3, 2026 — Gloved One Hype and Smooth Criminal polish

- Pitching the Voice: Perfect base damage reduced from 13 to 11; cooldown increased to 3 turns.
- Moonwalk: arrow response time changed from 1.5 to 1.0 second; cooldown increased to 2 turns; rapid next-arrow progression preserved.
- Smooth Criminal: removed iframe in battle, recreated the player's semicircular Impossible Lean as native game markup inside the same battle overlay with matching arcs, zones, buttons, HUD, and responsive layout. Client interpolates physics for smoother visual steering; all official scoring remains server-authoritative. Cooldown increased to 3 turns.
- Crowd Hype attack modifiers are now applied centrally to positive attack damage (including Dance Battle): 0–24 −2; 25–49 −1; 50–74 +1; 75–99 +2; 100 +3. Existing Thriller and Flow buffs still stack.
- Boooo added to Effects when the enemy is The Gloved One: usable at 50+ Hype, removes 25 Hype, cooldown 2 personal turns. Server enforces conditions.
- The Kid Is Not My Son!: added 4-turn cooldown while keeping its original effect cleanse.
- Regression tests cover tier thresholds, Boooo restrictions, and all modified cooldowns. Native overlay preview checked at desktop and mobile sizes without JS errors. No changes to other characters.

---

# Rhythm minigames input, countdown & Dance Battle hotfix — 2026-11-02

## Rhythm minigame hotfix — November 2, 2026

- **Beat It** is a ten-note, solo, four-lane falling-arrow rhythm game, with receptor-aligned notes and server-validated hits. Every successful note adds one damage and increases the tempo; a miss resets the streak and tempo. The existing one-turn cooldown is unchanged.
- **Dance Battle** now uses the same hit timestamp on the client and server, keeps its falling notes aligned with the receptors, and applies a capped 160 ms network-latency allowance. Early taps are ignored rather than charged as misses. Rapid consecutive inputs are no longer blocked by a global in-flight request flag.
- **Light-Up Footwork** gives one quiet second to get ready before the three-second memory sequence. The floor tiles remain mounted as replies arrive, so rapid taps are preserved.
- **Live countdowns** for Gloved One performances and Footwork update on animation frames instead of only when the server sends another state. The red-symbol keyboard and Gravity Control objects also remain mounted during responses.
- Added a more legible concert-stage interface, receptors, note glow, timer progress, touch-friendly controls, and feedback.

All hit judgments and damage remain server-authoritative. The limited latency allowance is not a guarantee on high-latency connections; test real matches after deployment.

---
## 2026-11-02 — Judas refinement, Great Exception items, Team Rocket theft, Gloved One rhythm

- Blue Judas gains +1 CE per personal turn outside Six Eyes (+5 during), gets a 3-second moving-object Gravity challenge (6 objects for Max Blue), and Max Red now uses the red timing minigame. Limitless Blue/Red baseline damage reduced by 4; Infinity slightly harder.
- Red Judas Dismantle and Fuga share a five-glyph pool; correct inputs persist and score when the timer expires; damaging Red Specials have no per-move cooldown (resource costs unchanged). Conversion 1 Positive → 2 Cursed added alongside existing reverse trade.
- Effects menu no global cooldown; time-based effects applied through it persist one extra turn; recurring status and combo damage +2.
- The Great Exception adds Kite, Penguin and Magic Mirror to Magic Bag. All damaging bag items add +2. Windblown reduces the next Defence action 20%; Distracted weakens next damaging move 20%. Umbrella redesigned as four-gust direction minigame with 25/60/80% protection, 6 damage counter on Perfect, enhanced 100% Perfect, and 2-turn cooldown.
- Team Rocket now randomly steals a specific opponent Special Attack for three turns; temporarily replaces Pokémon Trainer's Ultimate button with the stolen move and blocks only that move for the victim. Original cinematic and full-team healing/PP recovery kept; old five-turn blanket lock removed.
- The Gloved One's Beat It +3 damage, Moonwalk easier with 4+ notes causing Groovin, new Light-Up Footwork animated 3×3 memory scene (7 failure; 12 + Spotlight next-attack +4 on Perfect) with three-turn cooldown.
- Added server validation and deterministic release checks. Dockerfile still copies all rules modules.

## 2026-11-01 — Master of Presentation expansion
- Black Mamba Armor now costs 15 Momentum and adds 10–15 Defence, unlocking Mamba Strike (5/10/13/17 damage) and 3-second Targeting Systems (4 base +3 per tapped target) while active.
- Spider Bot costs 10 Momentum, adds 5 Defence, supplies one 25% dodge check, and unlocks Electricity Turret (WASD/Space, 15 invaders, 5 base +1 per hit) and Music Speakers.
- Groovin blocks a random currently available main battle button on each of the victim's next 3 turns. The server enforces the seal.
- Added responsive presentation-minigames.css overlays and server-side hit validation, plus regression tests. Preserved Team Rocket, Judas and Gambler updates.

## Team Rocket cinematic and Ultimate buff — 2026-10-30
- Replaced the Team Rocket text splash with the user-supplied 1280×720 cinematic video; the video's original soundtrack has been **removed and replaced** with the uploaded `Video Project.m4a` audio. The full animation plays; the audio ends before the last frames.
- Team Rocket now seals **both** the enemy's Special and Ultimate buttons for their next **five personal turns**; the server checks both actions, not just the UI.
- Casting Team Rocket refills **all** of Pokémon Trainer's Pokémon HP and all moves' PP, including benched/fainted Pokémon, without changing the Trainer's own HP.
- Added responsive fullscreen cinematic playback for both connected players and a replay-with-sound option for browsers that prohibit autoplay audio. The existing music setting is respected.
- Updated combat regression tests and static deployment checks, including the new `public/video/team-rocket-ultimate.mp4` asset.

## 2026-10-30 — Red Judas, combat items and Pokémon Trainer improvements

- Dismantle: seven-symbol pool, 3.5-second memorization, partial damage from independently correct positions; enhanced Cleave hit/miss feedback.
- King of Curses: +5 Cursed Energy per turn; automatic Positive Energy regeneration removed for Judas characters; both energy types reset to zero at King/Six Eyes expiration and cap reverts to 8.
- Damaging Specials grant +7 base Momentum, Heavy loses 5 base Momentum, Charge grants +7 base Momentum. Existing per-champion global Momentum scaling still applies.
- Added free once-per-turn Defensive Stance (+2–3 Defence, −3 same-turn damage), updated Guard to +4–6, Armour Break to −75% stored Defence plus one victim-turn Defence lock. Normal Attack deals 3–5 base plus timings.
- National Flag now grants +25 Momentum with a two-use-per-player cap. Shop shows four randomized current offers, server checks that purchases belong to them. Added effect glossary and gold glow to eligible King of Curses/Six Eyes.
- Pokémon Trainer picks only at first battle or after faint, switches from Pokémon Moves for free; PokéCenter restores PP to exactly two chosen Pokémon; Charizard has 1 PP per move and Volt Tackle costs 5 recoil. Added Team Rocket Ultimate, locking the victim's Special button for their next two personal turns.
- Expanded server-mocked multiplayer tests and static asset checks, kept Dockerfile compatible with Railway.

## 2026-10-29 — Red Judas, Momentum & Blue Judas polish

- Made Infinity's parry success interval 50% narrower, preserved its 3 incoming-attack uses.
- Hollow Purple deals +3 raw damage for every stored Blue and Red Charge; Blue Gravity Control has a six-second interactive countdown.
- Changed both Judas Reverse Cursed Techniques to cost 4 Positive Energy, with three 7-HP pulses.
- Rebalanced Momentum gains globally: other champions gain 75% of prior values, The Great Exception gains 115%; updated Charge labels and tests.
- Rebuilt Red Judas: Dismantle 12-symbol memory minigame (2.5s reveal / 4s input), Cleave three-hit unpredictable rhythm, Fuga timed five-flame sequence; all outcomes resolved on the server.
- Dismantle applies Scored at 4+ correct; Cleave consumes Scored (+3), and applies Bleed at 2+ slashes. Fuga applies double-strength Burn for 2 ticks on any successful score.
- Binding Vow requires King of Curses. M.S. gets I.V.'s 3-turn 4-CE charged route and 15-CE immediate preparation, with clash response window. While active, M.S. reapplies Bleed and causes 5 damage each victim turn.
- Added Red Judas multiplayer mock regressions, kept the Railway module copy, and validated the new overlay scenes in mobile Chromium.

## 2026-10-29 — Blue Judas: Six Eyes / I.V. update

- Six Eyes: 6 following turns, 7-turn cooldown, +5 CE regeneration while active.
- Domain Expansion I.V.: 3 × 4-CE turns with regular combat still allowed, or fast 15-CE activation on the next turn.
- Domain response popup: 5-CE charged counter / 15-CE counter, clash or take the hit.
- Infinity: 7 CE, three easier damage-scaled reaction checks using the animated Parry interface, with additional support for casino/Limitless specials.
- Blackjack / Roulette cooldowns reduced to 1, Poker reduced to 2. Winning Poker showdown damage +2 before reduction.
- Domain audio playback for all clashes plus autoplay fallback.
- New focused tests and updated legacy tests.

# Animated Gambler minigames — 2026-10-28

- Replaced The Gambler's plain blackjack, poker and slot interfaces with animated casino environments, card dealing, betting controls, and staggered slot-reel stops.
- Added full-screen server-authoritative blackjack dealer reveals, multiplayer poker showdowns, sequential slot animations and a 3D coin flip for Double or Nothing.
- Moved Texas Hold'em controls directly beneath the felt table so mobile users can bet, call and fold without searching for buttons.
- Kept opponents' private hole cards hidden until a completed showdown (never revealed after a fold).
- Added live decision countdowns, mobile layouts, accessible button labels, reduced-motion support, and a new standalone minigame stylesheet.
- Added regression tests for reveal events, slot event parity and folded poker secrecy. Updated static-bundle checks for Railway.
- Preserved all existing rules, multiplayer infrastructure, champion selection, assets, and the Dockerfile deployment fix.

---

# The Gambler expansion — 2026-10-28

- Added **The Gambler** as a selectable Fun champion without changing the existing 1v1 modes.
- Added Bad Luck and Fortune 3-turn effects (server-side higher/lower die rerolls).
- Added Blackjack Bash with Hit, Stand, Split, Double Down and Surrender, plus server dealer; 5-turn cooldown.
- Added multiplayer Texas Hold’em Poker Table with private cards, betting, folding, showdown protection, hand-rank attack bonus and 5-turn cooldown.
- Added animated server-controlled Double or Nothing with up to three ×1.5 flips, cashout and all-or-zero failure; 3-turn cooldown.
- Added 5-spin Relentless Gambler domain charge (40 cumulative HP damage to interrupt), animated slots and JACKPOTT invincibility, +5 attack, healing, Dance Battle and 7s/low-health bonuses.
- Added 40-HP domain integrity bars for active Domains, plus a charging progress bar for The Gambler.
- Added deterministic blackjack/poker rules tests and mocked multiplayer regression tests. Existing game mechanics and assets retained.

---

# Combat update — 2026-10-28

- Changed Charge to a three-option menu: Prepare Beam (−15 Momentum), Unstable Beam (−10 Momentum with 4 HP recoil), and Charged Attack (+10 Momentum).
- Moved Charged Attack out of Attack; preserved original energy timing and Beam Clash.
- Added Energy Leak, Adrenaline, and four existing-effect combinations.
- Added visible cooldown chips, a 12-metric post-match scoreboard, and distinct natural-critical visuals/sound.
- Added server-side gameplay regression tests and GitHub update guide.

---

# Challenger Clash Online

This is the room-code multiplayer version of Challenger Clash.

## What changed from the local HTML version

- Two separate browsers connect to one shared server.
- Player 1 creates a 5-character room code; Player 2 joins with it.
- Each player sets up and locks in their own champion.
- The server owns HP, turns, dice rolls, Defence, effects, cooldowns, Specials, Beam state, and Beam Clash results.
- Chat is synchronized.
- Beam Clash is a server-timed 5-second contest.
- Refresh/reconnect is supported with a private token stored by the browser.
- Active rooms are currently stored in RAM. Restarting the server resets active matches.

## Rules included

- 50/50 initiative.
- Basic Attack D6.
- Defence stacks up to 3 applications / 20 total Defence, then unlocks after being attacked.
- Armour Break halves stored Defence immediately and weakens Defence.
- Individual 2-turn effect cooldowns.
- Bleed and Shock deal D4, or D6 when powered with Strengthen.
- Strengthen upgrades the next offensive die; D20 upgrades become +2.
- Armour Break and Strengthen stack.
- Charge -> Beam Charge -> Beam Ready.
- Beam Clash starting clicks = floor(abs(Beam 1 damage - Beam 2 damage) / 5), given to the stronger Beam.
- Action uses server-side D20 vs D20 with automatic stat modifiers.
- Action has a 3-turn cooldown.
- Action Attack/Defence random pool sizes: D4 1-4 dice, D6 1-3, D8 1-2, D10/D12/D20 1.
- Specials are locked at match start.
- Standard = no Special.
- Generated Specials: Berserker, Iron Wall, Arcane Surge, Trickster.
- Fun Special: Nightcrawler.
- Lights Out remains until the opponent passes Action -> Other Action and chooses to turn the lights on.
- Night Five can only be used during Lights Out; it gives two actions on each of the next two turns and has a 7-turn cooldown.

## Run it on your computer

Install Node.js 18 or newer.

From this folder:

```bash
npm install
npm start
```

Then open:

http://localhost:3000

To test two players on one computer, open the site in two different browser profiles/private windows. Create a room in one and join the room from the other.

## Put it online with Railway

### GitHub method

1. Create a new empty GitHub repository.
2. Upload all files from this folder (`server.js`, `package.json`, and `public/`).
3. Sign in to Railway and choose **New Project -> Deploy from GitHub repo**.
4. Select your Challenger Clash repository.
5. Railway will run `npm install` and `npm start` from `package.json`.
6. In the Railway service, generate a public domain.
7. Open that public HTTPS URL.
8. Create a room and send the same URL plus the room code to your friend.

The server listens on `process.env.PORT` and `0.0.0.0`, which Railway expects.

### Railway CLI method

Install the CLI:

```bash
npm i -g @railway/cli
```

Then from this folder:

```bash
railway up
```

Follow the sign-in/project prompts, then generate a public domain in the Railway dashboard.

## Important first-version limitation

Rooms are stored in the Node process memory. A Railway redeploy/restart wipes active matches. For a small game with you and a friend this is fine for testing.

If you later want multiple server instances, durable rooms, matchmaking, accounts, or match history, move room state to Redis/a database. Socket.IO's Redis adapter can then synchronize Socket.IO traffic across server instances.

## Security/fairness

The browser does not choose dice results or directly edit HP. Those are computed on the server.

Beam Clash presses are counted on the server, with a small rate limit to prevent one browser from flooding the server with synthetic key-repeat events. This is not tournament-grade anti-cheat, but it is much fairer than trusting client-side counters.


## Battle update

This update adds:

- Rematch with the exact same champions after a battle.
- Return both players to champion select after a battle.
- Leave/close room and return to the Create Room / Join Room screen.
- Shock, Bleed, and Poison now have 5-turn cooldowns.
- Beam Clashes now have a server-controlled 5-second "Get Ready" countdown before the 5-second mash phase.
- The countdown tells each player their color and key (P1 = cyan/blue + A, P2 = magenta/pink + D).
- The Beam Clash bar has animated directional arrows and a moving energy-impact effect at the collision point.

### Updating an existing Railway deployment

You only need to replace these two files in your existing GitHub repository:

- `server.js`
- `public/index.html`

Commit both changes. Railway should automatically redeploy the existing service.


## Blue Judas update

Added the Fun Special **Blue Judas**:

- **Six Eyes**: lasts 5 of the user's turns. While active, every incoming direct attack/Beam/Beam-Clash hit has a 1-in-3 chance to be completely blocked before Defence is consumed. When Six Eyes ends it enters a 7-turn cooldown.
- Each Six Eyes activation unlocks one **Domain Expansion I.V.** attempt.
- **Domain Expansion I.V.** can only be started while Six Eyes is active and not while another Domain is active.
- Domain starts at 0/2. The next two turns are restricted to Defence or skipping while charging, reaching 1/2 and then 2/2. On the following turn it activates and the user can act normally.
- A single direct hit that removes at least 15 HP while Domain is charging cancels that Domain attempt.
- When Domain activates normally, the opponent loses their next 3 turns and the game background becomes turquoise.
- If the opponent also has a Domain at 2/2 when a Domain activates, a **Domain Clash** begins: 5-second countdown, then both players race through the same random 1/2/3/4 sequence. First to finish correctly wins and their Domain takes over.
- If the other Domain is only 0/2 or 1/2 when the first Domain activates, the unfinished Domain collapses.
- **Reversal Cursed Technique** rolls D20 and heals that much HP (up to max HP), with a 2-turn cooldown.
- Strengthened server-side Beam cooldown guards prevent firing a Beam while its cooldown is still active.

To deploy this update to the existing Railway service, replace `server.js` and `public/index.html` in the same GitHub repository and commit them.


## Blue Judas correction

- Activating **Six Eyes** does not lock the opponent or change the battle phase. The opponent continues playing normally.
- The Defence-only restriction begins only after Blue Judas uses **Domain Expansion I.V.**
- Domain starts at `0/2`.
- On the next Blue Judas turn, the only allowed move is Defence; it advances to `1/2`.
- On the following Blue Judas turn, the only allowed move is Defence again; it advances to `2/2`.
- On Blue Judas's next turn after reaching `2/2`, the Domain activates and Blue Judas may act normally.


## Domain Clash tug-of-war update

- Reversal Cursed Technique can now only be used while Six Eyes is active.
- Domain Clash no longer reveals the whole number sequence.
- Each player sees only one random number at a time.
- The numbers are keyboard-bound to `1`, `2`, `3`, and `4`.
- Correct presses advance progress and immediately reveal the next random number.
- Wrong numbers do nothing.
- During a Domain Clash the whole battlefield becomes a two-colour tug-of-war:
  - Player 1 pushes turquoise/cyan from the left.
  - Player 2 pushes violet/magenta from the right.
- Every correct number moves the collision point toward the opponent, similar to the Beam Clash bar.


## Red Judas update

Added **Red Judas** to the Fun Specials.

### King of Curses
- Activated from the Special menu.
- Lasts 5 of Red Judas's turns, then enters a 7-turn cooldown.
- While active, every offensive damage roll gets +2.
- Direct attacks and Beams ignore the target's stored Defence and block effects such as Six Eyes.
- Being hit still resets the target's stored Defence, following the normal "Defence resets after being attacked" rule.
- Each activation unlocks one Domain Expansion M.S. attempt.

### Domain Expansion M.S.
- Can only be started while King of Curses is active.
- Uses the same Domain rules as I.V.: starts at 0/2; Red Judas's next two turns are Defence-only and advance it to 1/2 and 2/2; it activates on the following turn.
- A single hit that removes 15+ HP while charging cancels the Domain.
- It cannot be started inside an already active Domain.
- It can Domain Clash with I.V. or another M.S.
- When active, the battlefield becomes Blood Red.
- The opponent takes D6 slash damage at the start of each of their next 4 turns, but can still act on those turns.
- Domain Clash colors now reflect the Domains involved: I.V. uses turquoise; M.S. uses blood red.

### Reversal Cursed Technique
- Red Judas also has Reversal Cursed Technique.
- Rolls D20 and heals that much HP up to max HP.
- 2-turn cooldown.


## Rulebook / battle control / Domain animation update

- Red Judas's Reversal Cursed Technique now requires King of Curses to be active.
- Added a global 📖 Rulebook button covering core combat, Action, Charge/Beam, effects, all current Specials, Beam Clash, Domain Clash, rooms and battle-ending rules.
- Either player can press **End Battle** during an active fight. The match ends without a winner, after which Player 1 can rematch or return to champion select.
- Domain Clash now lasts **10 seconds** after its existing 5-second ready countdown.
- The Domain Clash countdown is displayed prominently and shows the clash rules at the bottom.
- At the start of a Domain Clash, both Domain background colors animate inward from the left and right before settling into the tug-of-war background.
- When a Domain wins/activates, its background color sweeps in before becoming the persistent battlefield background instead of changing instantly.


## Funny Business / Blue Judas vs Red Judas cinematic

- Added a **Funny Business** room option in the champion lobby.
- Funny Business defaults to **ON** and is controlled by Player 1.
- Turning it OFF disables optional matchup cinematics for both players without changing combat mechanics.
- When Funny Business is ON and the battle is **Blue Judas vs Red Judas**, a special cinematic plays immediately before a Domain Clash:
  - the supplied matchup artwork is split into two diagonal pieces,
  - both pieces slide in from opposite sides and join,
  - the image has subtle edit-style movement, impact flashes, moving streaks, and pulsing border energy,
  - after the cinematic, the existing Domain colors sweep in and the normal 5-second Domain Clash countdown begins.
- The supplied artwork is stored at `public/assets/blue-red-domain-clash.webp`.


## v9 quicker Domain Expansion cinematic

- The Blue Judas vs Red Judas pre–Domain Clash cinematic is now faster.
- The intro duration was reduced from 2.8 seconds to 1.9 seconds before the normal 5-second Domain Clash countdown.
- The cinematic title now says **"Domain Expansion!"**
- The title styling was updated to a bold manga/anime-inspired display look for a JJK-style feel.


## v10 cinematic / fullscreen / Domain Clash audio

- The Blue Judas vs Red Judas pre-clash edit now uses smoother easing and gentler motion.
- Instead of one large centered caption, both sides now display their own smaller two-line **DOMAIN EXPANSION!** caption near the character, with white italic lettering and a purple/pink shadow inspired by the supplied reference image.
- Added a **Fullscreen / Window** button in the game header. It uses the browser Fullscreen API; pressing it again exits fullscreen back to the normal browser window.
- Added the supplied audio as `public/audio/domain-clash.mp3`.
- The audio starts when the Domain Clash enters the **GO / active minigame** phase, not during the 5-second countdown.
- When the Domain Clash ends, the audio fades down over about 1.8 seconds and then stops.


## v11 Domain Clash soundtrack timing correction

- The supplied Domain Clash music is now tied to the **Blue Judas vs Red Judas Funny Business cinematic**.
- The music starts the instant the animated matchup photo appears (`domainClashIntro`).
- It keeps playing through the cinematic, the 5-second countdown, and the Domain Clash itself.
- The music is no longer cut or immediately faded when the Domain Clash resolves.
- At **18 seconds after the music starts**, it begins a smooth **5-second fade-out**, then stops completely.


## v12 — The Great Exception

- Domain Clash ready countdown is now **3 seconds**. Beam Clash remains 5 seconds.
- Funny Business Blue-vs-Red music still only plays when Funny Business is ON.
- The Funny Business music now stays full volume for **15 seconds from the matchup-photo start**, then fades smoothly for **5 seconds**.

Added **The Great Exception** to Fun Specials:
- Passive drawback: all normal number-roll dice made by the champion are reduced by 2 sides (D20→D18, D12→D10, D10→D8, D8→D6, D6→D4, D4→D2). Magic Bag item rolls are exempt.
- **Umbrella**: Basic Attacks automatically miss for the opponent's next 2 attack windows; one 50/50 dodge is stored for the next other incoming attack. 7-turn cooldown.
- **Magic Bag**: server randomly selects one of 17 items and privately shows it to the player in a Use/Discard popup. Magic Bag has no cooldown; either choice consumes the action.
- Implemented all requested items: Piano, BAZOOKA, Marbles, Basketball, Football, Marble, Knife, Cupcake, Birthday Cake, Used Syringe, Dice, Garbage, Lollipop, Toy Army, Plates, Hot Head Burrito, Shield.


## v13 — Strike Timing, Heavy Attack, Momentum, persistent Defence

### Attack Styles
- **Normal Attack:** one Strike Timing bar. BAD = normal roll; GOOD = +1 damage; PERFECT = +2 damage.
- **Charged Attack:** same one-bar timing system on the charged attack die.
- Natural maximum rolls on Normal/Charged attacks are **Critical Hits** for +1 damage.
- **Heavy Attack:** four consecutive timing bars. Each BAD = 1 damage, GOOD = 2 damage, PERFECT = 3 damage. Four PERFECT bars trigger a Pan Perfect critical presentation.
- Added attack impact visuals: screen streak, fighter shake/impact, big damage/critical text.

### Momentum
- Each player has a visible 0–100% Momentum bar.
- Only Attack-button attacks and Beams build Momentum.
- 50–99% Momentum: +1 damage on those attacks/Beams.
- 100% Momentum: +2 damage on those attacks/Beams.
- Normal/Charged: BAD +5%, GOOD +8%, PERFECT +10%.
- Heavy per bar: BAD +2%, GOOD +3%, PERFECT +5%.
- Beam fired/countered: +10%.

### Defence
- Defence can be used even when the displayed marker is already 3/3.
- The marker caps at 3/3 but does not lock the Defence action.
- Stored Defence now persists after being attacked instead of resetting.
- This also prevents Domain-charge softlocks when the player is already at 3/3.

### Effect Action stats
- Weakness relevant Action disadvantage increased from 1 to 2.
- Armour Break relevant Action advantage/disadvantage increased from 1 to 2.


## v14 — Parry, Defence animations, dice presentation, Beam +6

### Parry
- The normal **Defence** button now opens a choice between **Guard** and **Parry Stance**.
- Parry Stance gives no Defence immediately and cannot stack with itself.
- The next incoming direct attack, Beam, Beam-Clash hit, Action attack, Magic Bag attack/status, or newly-thrown Effect can trigger the defender's Parry reaction bar.
- Effects already active on the defender still tick normally; ongoing Bleed/Poison/Shock/Burn/Domain damage is not retroactively parried.
- Parry difficulty scales with incoming damage:
  - higher damage = faster marker,
  - higher damage = narrower success window.
- Successful Parry: that incoming hit/effect is denied.
- Missed Parry: the move resolves and the defender takes **+1 unavoidable damage**.
- Heavy Attack triggers **four Parry reaction bars**, one for each Heavy hit. Each missed Heavy Parry adds +1 damage; successfully parried Heavy hits are removed from the attack.

### Defence visuals
- Guarding now creates a shield-burst animation showing Defence gained.
- Damage blocked by stored Defence creates a BLOCK shield animation.
- Successful Parries get their own shield/impact presentation.

### Dice presentation
- Gameplay D-rolls now emit a visible die-throw overlay to both players.
- Each die is displayed for about one second before the next queued die/action visual is shown.
- Multi-die rolls are queued and displayed one at a time.
- This covers attacks, Defence, Action checks, Beams, status damage, chance checks, RCT, initiative, HP rolls, and Magic Bag item dice.

### Beam damage
- Beams now always receive a flat **+6 damage** in addition to their normal Beam die roll and other modifiers.
- Counter-Beams used to start Beam Clash also receive the same +6.


## v15 — Parry chaining, Heavy cooldown, Shop + shared item catalog

### Parry
- Successful Parry now automatically keeps **Parry Stance ready**, so successful Parries can chain indefinitely.
- If any Parry fails, Parry Stance ends and enters a **2-turn cooldown**.
- Heavy Attack still generates four separate Parry checks; all four must succeed to keep Parry ready.

### Heavy Attack
- Heavy Attack now has a **1-turn cooldown** after use.

### Shop / My Attack list
- Added **Action → Item Shop**.
- Buying has no currency price: purchasing one item **skips your entire turn**.
- Purchases are added to a private stored inventory called **My Attack list**.
- Attack now includes **Use Item** when the player owns stored items.
- The Shop and Magic Bag use the same server-side item catalog. Future additions to the item catalog can therefore appear in both systems.

### New Items
- **National Flag:** +50 Momentum percentage points, capped at 100%.
- **Health Potion:** heals 5–10 HP.
- **Box of Chocolates:** heals the opponent 5 HP; 50% chance to apply **Seduced** for D4 turns. Seduced reflects 50% (rounded up) of direct attack damage the Seduced champion deals back onto them.
- **Moustache:** applies **Confused** for the opponent's next turn; their attacks and thrown Effects miss.
- **Hot Potato:** interactive pass minigame. Every pass has a 25% chance to explode for 6–7 damage. The minigame ends when someone takes Hot Potato damage. A ready Parry can deflect an explosion back and continue the game.


## v16 — Domain UI effects + Judas techniques

### Domain visuals
- **Red Judas / M.S.**: while the Domain is active, the victim's fighter card is covered in repeated slash streaks. The trapped player also sees a full-screen layer of fast red/white cuts for the duration of the Domain.
- **Blue Judas / I.V.**: while the Domain is active, the victim's fighter card and trapped player's screen fill with drifting equations, calculus symbols and physics/math notation.
- These effects are cosmetic only and automatically disappear when the Domain ends.

### Blue Judas
- **Max Red**: 5–7 direct damage; 50% chance to inflict Bleed for 2 turns; 3-turn cooldown.
- **Max Blue**: 2–6 direct damage; 50% chance to inflict Armour Break for 3 turns; 2-turn cooldown.
- Both attacks can be Parried under the normal Parry system.

### Red Judas
- **Dismantle**: 2–15 direct damage; 50% chance to inflict Bleed for 3 turns.
- Dismantle has no cooldown because none was specified.
- While King of Curses is active, Dismantle receives the existing +2 offensive bonus and defensive bypass.
- Dismantle can be Parried under the normal Parry system.


## v17 — Red Judas: Dismantle cooldown/Weakness + Binding Vow

- **Dismantle**
  - 2–15 damage.
  - 4-turn cooldown.
  - Independent 50% chance to inflict Bleed for 3 turns.
  - Independent 50% chance to inflict the existing Weakness effect for 2 turns.
  - It may inflict neither, one, or both statuses.
  - King of Curses still gives its existing +2 damage and defensive bypass while active.

- **Binding Vow**
  - Red Judas permanently sacrifices 5 Max HP for the current battle.
  - Current HP is clamped down if it is above the new Max HP.
  - Grants +1 additional move during the current turn.
  - Binding Vow itself does **not** consume a move.
  - It can be used repeatedly in one turn. Example: using it twice turns the normal 1-move turn into a 3-move turn.
  - It cannot be used once Max HP is 5 or lower.
  - Extra Binding Vow moves expire when the turn ends; the Max HP sacrifice remains for the battle.


## v18 — Portal Gun and Companions

### Portal Gun
- Added **Portal Gun** to the single shared item catalog, so it appears in both:
  - Action → Item Shop
  - The Great Exception → Magic Bag
- Using Portal Gun summons a random Companion.
- The Companion framework supports multiple Companion types; the current pool contains **Zombie**.

### Action → Companions
- When you have an active Companion, a **yellow-dot Companions** button appears in the Action menu.
- Companion moves consume one normal move and do not use the standard Action D20 check.

### Zombie
- **Hold in Place**
  - Holds the opponent.
  - A held player cannot Attack, Guard, Parry, Charge, use Effects, Specials, Shop, Items, or other Companion actions.
  - Their only available move is **Action → Release Themselves**.
  - Releasing consumes one move and removes the restraint.
  - Hold in Place has a **2-turn cooldown**.
  - Hold in Place can be Parried.
  - An active Companion shield protects against Hold in Place as a newly applied control effect.
- **Defend Me**
  - Can be used only once per Zombie.
  - Creates a separate **5-point Companion Defence** shield.
  - This shield is expendable even though ordinary Defence is persistent.
  - Incoming attacks deplete Companion Defence before ordinary Defence.
  - While any Companion Defence remains, newly applied negative effects are blocked.
  - When the Companion Defence reaches 0, the Zombie is defeated and any opponent it was holding is immediately released.

### Dealing with an opponent's Companion
- When the opponent has a Companion, Action shows **Deal with opponent's Companion**.
- LEFT rolls D20 and RIGHT rolls D20.
- The Companion is killed only when **RIGHT > LEFT**; ties fail.
- The attempt consumes one move whether it succeeds or fails.


## v19 — balance tuning

- **Binding Vow**
  - Maximum **4 uses per battle**.
  - Maximum **2 uses in a single turn**.
  - The per-turn counter resets at the beginning of Red Judas's next personal turn.
  - Each valid use still costs 5 permanent Max HP and gives +1 move without consuming a move.
  - The UI shows both counters and disables Binding Vow when either limit is reached.

- **Dismantle**
  - Cooldown increased from 4 turns to **7 turns**.
  - Damage and independent Bleed/Weakness chances are unchanged.

- **Blue Judas**
  - Max Red damage reduced from 5–7 to **3–5**.
  - Max Blue damage reduced from 2–6 to **0–4**.
  - Their existing status chances/cooldowns are unchanged.

- **Strike Timing**
  - The green PERFECT region is narrower: about **8% of the bar** instead of 14%.
  - The actual PERFECT timing threshold now matches the smaller green area.
  - Marker speed is slightly faster: normal/charged timing duration 1180ms → **1120ms**; Heavy timing 980ms → **930ms**.


## v20 — Max Blue damage restored

- Max Blue damage restored from **0–4** back to **2–6**.
- Its 50% Armour Break chance, 3-turn Armour Break duration, and 2-turn cooldown are unchanged.
- All other v19 balance changes remain unchanged.


## v21 — Strike Timing, Momentum decay, Binding Vow HP cost, Dance Battle

- PERFECT Strike Timing zone reduced to about **2% of the bar** (±1% around center).
- Heavy Attack timing gets faster every strike: ~930ms, 815ms, 700ms, 585ms.
- Only one die animation is shown from a rapid burst of multiple rolls; all server rolls still happen.
- Domain Clash music volume reduced from 0.78 to **0.52**.
- Any non-Attack move removes **3% Momentum** (minimum 0). Attack-button attacks and Beams do not pay this penalty.
- Binding Vow still has the 4-per-battle / 2-per-turn limits, but now costs **5 current HP** instead of Max HP.
- Binding Vow can reduce Red Judas to 0 HP.
- The Great Exception gains **Dance Battle**, a synchronized accelerating falling-arrow rhythm duel with a **7-turn cooldown**.
- Both players use ← ↓ ↑ → or touch buttons. First player to **5 misses** loses.
- If both reach 5 on the same timeout sweep, the duel enters sudden death.
- Dance Battle loser receives **Exhaustion** for 3 personal turns.
- Exhaustion gives -2 to offensive/defensive combat stat totals, roll-based bonuses and Action advantage/check performance.


## v22 — Parry difficulty, music, Effects cooldown, expanded Companions, Bite of 87!?

### Parry
- Base Parry is significantly harder.
- Difficulty now changes in **3-damage tiers**.
- Every full 3 incoming damage shortens reaction duration by ~75ms and narrows each side of the success window by ~0.45%.
- Difficulty clamps at ~300ms and ±1.1% for extreme hits.
- Successful Parries still chain indefinitely; one failed Parry still starts the 2-turn cooldown.

### Audio
- Added an original procedural low-volume synth battle loop using browser Web Audio.
- Added a Music On/Off button.
- Battle music automatically pauses while special file-based audio plays and resumes afterward.
- Packaged the supplied Bite of 87!? sound at `public/audio/bite-of-87.mp3`.
- Domain Clash music volume reduced again to **0.30**.

### Effects / Beam
- The normal Effects main button now has a **1-turn button cooldown** after use, separate from individual effect cooldowns.
- Beam firing/conversion/counter paths retain server-side cooldown checks; Beam cannot be fired while its cooldown is positive.

### Kebab
- Added shared item **Kebab**: heals 4 HP.
- It is available through Shop, Magic Bag, Adult Groceries, and Kebab Stand generation.

### Companion pool
Portal Gun now randomly summons:
- Zombie
- Kebab Stand
- Baby
- Dog
- Cat
- Vaporeon

Baby grows into Teen; Teen grows into Adult.

### Zombie
- Hold in Place: unchanged 2-turn cooldown.
- Defend Me: 5 Companion Defence.
- Bite: inflicts Poison for 3 turns (D4 Poison ticks).

### Kebab Stand
- Produces one Kebab every 2 owner turns.
- Claiming is free from Action → Companions.
- If Item Bag is empty: store it or use immediately.
- If occupied: Kebab must be used immediately.

### Baby → Teen → Adult
- Baby: Defend Me for 3; grows to Teen after 3 owner turns.
- Teen: Defend Me for 5; grows to Adult after 4 owner turns.
- Teen Gooning: applies Armour Break, Weakness, and PTSD for 3 turns; 6-turn cooldown.
- PTSD prevents repeating the same main battle button twice in a row while active.
- Adult Depression: consumes a move and does nothing.
- Adult Overtime: free +1 move, limited to once per turn to prevent infinite action generation.
- Adult Groceries: random shared item, 2-turn cooldown. If the Item Bag already has an item, choose which one to use now and store the other.
- Adult Defend Me: 7 Companion Defence.

### Dog / Cat
- Bite: 3 direct damage, 33% chance to inflict Bleed for 2 turns.
- Bite is free but can only be used once per owner turn.
- Pet: no gameplay effect; plays generated clapping sounds.

### Vaporeon
- Water Gun: 3 Water damage, 2-turn cooldown.
- Nightcrawler is weak to Water; ×1.5 rounds up to 5 damage.
- Seduce: 4-turn cooldown. Reuses the existing Seduced mechanic: 50% success, then D4 duration.

### Nightcrawler — Bite of 87!?
- Four Heavy-style timing checks.
- The four results combine into **one 4–12 raw-damage hit**, so the defender gets only **one Parry reaction**.
- Inflicts Bleed for 6 turns if the status is not protected.
- 6-turn cooldown.
- Plays the supplied Bite sound when the attack fires.

### Dance Battle polish
- Hit and miss flashes/text now appear immediately.
- Both players have five visible X miss markers at the top throughout the minigame.


## v23 — harder Parry, tighter Strike Timing, rebuilt music

### Parry
- Base sweep reduced from 620ms? v22's previous 880ms-era setup to **620ms maximum**.
- Every full 3 incoming damage reduces the sweep by another **62ms**, down to a 210ms floor.
- Base success area is only **5% total** (±2.5% around center).
- Every 3 damage tightens that by another ±0.32%, down to a ±0.55% floor.
- Existing success/failure behavior is unchanged.

### Strike Timing
- PERFECT remains ±1% around center.
- GOOD is reduced from ±20% to **±10%**.
- Visual yellow GOOD regions now match the smaller scoring window.

### Music
- Replaced the simple pulse loop with a structured original arcade/synthwave battle loop:
  - D-minor/Bb/F/C progression
  - kick, snare and hi-hat rhythm
  - layered bass
  - arcade arpeggio
  - chord stabs and occasional lead notes
- Added a real Web Audio **master gain** for music.
- Music Off now hard-mutes the music channel instead of only clearing the timer.
- Music preference is stored in localStorage.
- Music Off also prevents/stops Domain Clash music.
- Bite of 87 and pet-clap sounds remain SFX and still play with Music Off.


## v24 — The Gloved One

### New Lobby Special/Trait
- Added **The Gloved One** to the Fun Special/Trait list and Random Special pool.

### Dance Battle trait
- Base Dance Battle miss limit remains 5.
- A player using The Gloved One gets **+1 miss allowance** (6).
- Their opponent gets **-1 miss allowance** (4).
- If both players are The Gloved One, the modifiers cancel and both use 5.
- The UI renders the correct number of X miss markers for each player.

### Moon Walk
- Five-note solo rhythm minigame.
- Considerably faster/tighter than normal Dance Battle: ~560ms note travel, ~72ms timing window.
- Each correct note adds **2 raw damage**.
- Each missed note subtracts **1 raw damage**.
- Final raw damage cannot go below 0.
- The completed Moon Walk resolves as one attack and can be Parried.
- **5-turn cooldown**.

### The Kid Is Not My Son!
- Clears current negative status effects:
  - Shock
  - Bleed
  - Poison
  - Burn
  - damaging Syringe status
  - Marbles skip
  - Seduced
  - Confused
  - Weakness
  - Armour Break
  - Exhaustion
  - PTSD
- Uses a normal move and has no separate cooldown because none was specified.

### Beat It
- Generates five random alphabet letters.
- Total timer: **3.5 seconds**.
- Only the current required letter is revealed; the next appears only after the correct key.
- Each completed letter is worth 1 raw damage.
- Completing all five adds **+2 bonus damage** for a 7-damage perfect result.
- The final combined hit can be Parried.
- No separate cooldown because none was specified.

### Thriller Night
- Passive, once per battle.
- The first time The Gloved One reaches 0 HP, death is intercepted and HP is held at 1.
- They become functionally invincible for their next **3 full personal turns**.
- Direct attacks and normal damage sources cannot reduce HP during Thriller Night.
- Their existing Companion is replaced by **Zombie Dancers**.
- At the end of their third full personal turn, Thriller Night ends and The Gloved One dies instantly.

### Zombie Dancers
- Zombie Dancer moves are a separate Companion allowance and do not consume ordinary move points unless the allowance is exhausted.
- Starts with **3 Zombie Dancer moves per turn**.
- Using the full current allowance immediately ends the turn.
- **Hold in Place** stacks. Every stack requires a separate Release Themselves move.
- Stacked Hold can still be Parried and Companion protection can block it.
- **Defend Me** adds +5 stackable Companion Defence.
- Defend Me can be used up to 3 times:
  - first use lowers future Dancer allowance from 3 to 2;
  - second use lowers it from 2 to 1;
  - third use destroys the Zombie Dancers.
- If their Companion Defence is depleted normally, the Zombie Dancers are also lost under the existing Companion Defence rule.


## v25 — rhythm receptor forgiveness, Defence fix, Beat It polish, revival cinematic

### Dance Battle / Moon Walk
- Notes no longer need to reach the old full target point.
- The server shifts the valid timing target earlier by ~12% of note travel time, corresponding to roughly **20% entry into the bottom receptor box**.
- This applies to both normal Dance Battle and Moon Walk.
- Automatic misses use the same shifted timing target.

### Beat It
- New **1-second READY phase**; the full Beat It UI and first letter are visible during prep, but keys are ignored until GO.
- Active input time increased from 3.5s to **4.0s**.
- Added a **1-turn cooldown**.
- Beat It total screen time is therefore about 5 seconds: 1s prep + 4s play.

### Defence
- Fixed normal Defence to behave as true **secondary HP**.
- Companion Defence is still consumed first.
- Normal Defence is then consumed point-for-point before HP takes damage.
- Example: 6 incoming damage vs 5 Defence → Defence becomes 0 and HP loses exactly 1.
- King of Curses and other explicit bypass/block rules keep their existing special behavior.

### Shock
- Shock is now exclusive to **Nightcrawler**.
- Other champions cannot use Shock through the normal Effects menu or Action → Effect.
- Nightcrawler keeps the existing Shock mechanics/cooldowns.

### First-death revival
- The first time a non–Gloved One fighter reaches 0 HP, the server performs one hidden **25% revival chance**.
- Uses the raw randomizer and emits **no dice animation**.
- Success: fighter returns with **5 HP** (or max HP if max HP is below 5).
- Failure: normal defeat continues.
- The chance is checked only once per fighter per battle.
- The Gloved One is excluded because Thriller Night is their death passive.
- Added a short dramatic cinematic that reveals success/failure after the fighter falls.

### Thriller Night visuals
- While Thriller Night is active, the arena is darkened.
- Large animated purple/cyan/white stage lights flash and sweep behind the UI.
- The effect persists for the full three-turn Thriller Night and clears automatically afterward.

### Domain Clash audio
- Domain Clash file music lowered again from **0.30 to 0.18** volume.


## v26 — Shock menu move, Magic Bag anti-repeat, Momentum boost, Master of Presentation

### Nightcrawler Shock
- Shock no longer appears in the Effects button or Action → Effect.
- Shock is now a button inside Nightcrawler's Special menu.
- Existing Shock effect behavior and its individual cooldown are unchanged.
- Because it is a damaging Special, using Shock grants +4 Momentum and avoids the generic -3 non-Attack Momentum loss.

### Magic Bag
- Magic Bag continues to use the **entire shared item catalog**.
- Whenever an item is actually used from any shared-item source, that item is marked unavailable to that player's Magic Bag for the next **two personal turns**.
- The current turn's cooldown tick is accounted for internally by seeding the lockout at 3.
- Discarding a Magic Bag item does not lock it out.
- After two personal turns, the item automatically returns to the full Magic Bag pool.

### Momentum
- Every Attack-button strike gets **+5 additional Momentum** on top of its existing timing gain.
  - Normal/Charged BAD: 10%
  - GOOD: 13%
  - PERFECT: 15%
  - Heavy: existing per-bar total + 5% once for the whole Heavy Attack.
- Beams and Counter-Beams now gain **15%** instead of 10%.
- Direct damaging Special-menu moves grant **+4% Momentum** and do not lose the usual 3% non-Attack Momentum:
  - Dismantle
  - Max Red
  - Max Blue
  - Bite of 87!?
  - Moon Walk
  - Beat It
  - Nightcrawler Shock
  - Black Mamba Strike

### Master of Presentation
- New Fun Special/Trait and Random Special option.

#### Brainbot Swarm
- Summons/replaces the current Companion with **Brainbot**.
- No separate cooldown was specified.
- Brainbot abilities:
  - Hold in Place
  - Bite: uses the existing Zombie-style Poison interpretation, D4 Poison ticks for 3 turns
  - Defend Me: one use per Brainbot, 3 Companion Defence

#### Black Mamba Armor
- 1-turn cooldown.
- Adds a random **3–8 Defence**, capped at 20.
- The contribution belongs to the armor and lasts **3 personal turns**; any remaining armor-granted Defence disappears when the armor powers down.
- Starts a fast shrinking-ring target minigame.
- Ring automatically restarts from the outside whenever it reaches the center without input.
- Damage by target accuracy:
  - outer edge: 0
  - outer-middle: 3
  - middle: 6
  - inner: 8
  - bullseye: 10
- The completed strike can be Parried.
- As a damaging Special, the strike adds +4 Momentum.

#### Death Ray
- 1-turn cooldown.
- Always primes **+1 damage on the next Beam attack**, including a Counter-Beam if that is the next Beam used.
- Hidden 20% chance to immediately set Beam Charge to READY.
- The 20% charge may succeed even while Beam cooldown is active, but the cooldown still prevents firing until it reaches 0.

#### The Difference Is Presentation
- Tracks Master of Presentation Special abilities and Brainbot abilities.
- Repeating an ability already in the current chain resets the chain to that ability.
- Completing a sequence of **3 different abilities** grants **+10 Momentum** and resets the chain.


### v26 final consistency notes
- Magic Bag's temporary lockout filters the **full item catalog** rather than using a reduced bag-only list.
- Black Mamba Armor's tracked Defence contribution now adjusts correctly if Armour Break halves Defence while the armor is active.
- Attack menu copy now shows the new post-v26 Momentum gains.


## v27 — Companion Move economy, separate Mamba Strike, Decoy, Death Ray skill check

### Companion Moves
- Normal Companions no longer consume the fighter's normal move.
- Each normal Companion gets **1 separate Companion Move per owner turn**.
- A fighter can therefore use one Companion ability and still use Attack / Defence / Charge / Effects / Special / Action.
- If the fighter spends the normal move first while a Companion Move remains, the turn enters a **Companion-only window** instead of immediately ending.
- The player can use the remaining Companion Move or choose End Turn.
- If the Companion Move is used first, the fighter remains free to spend the normal move afterward.
- Zombie Dancers preserve their special variable allowance (3 → 2 → 1) and their existing rule that exhausting the full Dancer allowance ends the turn.
- Companion moves still count as non-Attack activity for the existing -3 Momentum rule.
- Adult Overtime now cleanly uses the Companion Move and grants +1 **normal** move.

### Black Mamba Armor / Mamba Strike
- Black Mamba Armor now only equips the armor:
  - random 3–8 Defence, capped at 20;
  - armor contribution lasts 3 personal turns.
- The melee attack is now a separate Special-menu ability named **Mamba Strike**.
- Mamba Strike requires active Black Mamba Armor.
- Mamba Strike has a **1-turn cooldown**.
- The shrinking ring is much faster: **360ms** per full collapse/restart instead of 780ms.
- Damage remains 0 / 3 / 6 / 8 / 10 based on how close the ring is to the center.
- Mamba Strike participates in Decoy targeting.

### Decoy
- New Master of Presentation ability with no separate cooldown specified.
- Each use adds **1 Decoy stack**.
- The stacks persist until the opponent makes a protected attack.
- The next Attack-button attack, Beam, or Mamba Strike opens a target-choice minigame for the attacker.
- Every Decoy stack adds one fake UI:
  - 1 stack = 2 identical fighter panels
  - 2 stacks = 3 panels
  - 3 stacks = 4 panels
  - etc.
- The server secretly chooses which panel is real.
- Correct choice: attack continues normally.
- Wrong choice: the attack misses completely and all stacked Decoys are consumed.

### Death Ray
- Rebuilt as a circular rotating-needle skill check based on the supplied reference.
- Starts with a green wedge smaller than the reference image.
- Needle reverses direction after every successful green hit.
- The next green wedge moves to a new position and becomes **half the previous size**.
- Maximum 5 successful hits.
- Every hit permanently banks **+1 damage on the next Beam**.
- Missing ends Death Ray but keeps already-earned Beam bonus.
- Hitting all 5:
  - sets Beam Charge to READY;
  - grants a one-use Beam cooldown bypass;
  - allows immediate Beam firing even if the normal Beam cooldown is still above 0.
- The stored +damage is consumed by the next Beam / Counter-Beam.
- Death Ray cooldown increased to **2 turns**.


### v27 final integration notes
- Decoy also protects against Dismantle, Max Red, Max Blue, Bite of 87!?, Moon Walk and Beat It.
- Companion item popups remember whether they came from a normal turn or Companion-only window, so Kebab Stand/Groceries cannot accidentally reopen normal actions.
- Parry now returns to the phase that launched it; this is required so a parried Companion Move still completes correctly inside the Companion-only window.


### Companion-item delayed resolution
- Adult Groceries and Kebab Stand item choices now preserve their **Companion Move** identity even when the chosen item opens a delayed Parry or Hot Potato flow.
- The eventual resolution consumes only the Companion Move and never steals the fighter's normal move.

### Decoy coverage
- Decoy currently gates:
  - Normal / Heavy / Charged Attack-button attacks
  - Beam attacks
  - Black Mamba Mamba Strike
  - Dismantle
  - Max Red
  - Max Blue
  - Bite of 87!?
  - Moon Walk
  - Beat It
- The target's entire Decoy stack is consumed when that protected attack begins its target-choice challenge.


## v28 — clearer Death Ray, earlier Dance acceleration, Seduced FX, more Momentum

### Death Ray readability
- Server hit tolerance now accepts the entire green wedge **plus 10% of the current wedge width beyond each side**.
- The rotating needle becomes bright green and thicker while it is inside that accepted zone.
- The circular dial also receives a strong green glow.
- Status text changes to **IN RANGE!** while a press will count.
- The green wedge itself is visually brighter/thicker.

### Dance Battle pacing
- Acceleration now begins earlier:
  - initial note spacing changed from 860ms to 820ms;
  - spacing now decreases by 8ms/note instead of 6ms;
  - travel time starts at 1400ms instead of 1500ms;
  - travel time decreases by 11ms/note instead of 9ms.
- Late-game minimums remain capped so the ending does not become infinitely fast.

### Seduced presentation
- While the local player has Seduced, their screen gets a soft pink vignette plus continuously floating hearts and kiss emojis.
- The effect automatically disappears as soon as Seduced expires.

### Momentum increase
- Main Attack-button attack bonus increased from +5% extra to **+8% extra**.
  - Normal/Charged BAD: 13%
  - GOOD: 16%
  - PERFECT: 18%
  - Heavy: normal per-bar gain + 8% for the whole attack
- Beam / Counter-Beam gain increased from 15% to **18%**.
- Damaging Special-menu moves increased from +4% to **+6%**.
- Direct damaging Companion attacks now add **+3%** Momentum and no longer pay the -3 non-Attack penalty.
- Damaging/status Companion attacks add **+2%** Momentum and no longer pay the -3 non-Attack penalty.


### v28 final UI consistency
- Death Ray's **IN RANGE!** text now clears immediately once the needle leaves the valid zone.
- The client-side glow calculation uses the same 10%-per-side tolerance rule as the server.


## v29 — Guided Tutorial Popups + Parry preparation cue

### Tutorial Popups
- Added a **🎓 Tutorial Popups** switch to the top-right of the Rulebook.
- Preference persists in localStorage.
- Default is OFF until the player enables it.
- While enabled during a battle:
  - pressing a gameplay button is intercepted before the action executes;
  - a compact popup explains what the action does;
  - it explains the relevant input/control when the action launches a minigame;
  - **Continue** replays the original button press;
  - **Cancel** returns without spending the action.
- Dynamic battle/menu buttons use specific explanations when recognized and a safe generic explanation otherwise.
- Time-critical controls are exempt once their minigame is already running:
  - Strike Timing HIT
  - Parry HIT
  - Dance arrows
  - Domain Clash number buttons
  - Mamba Strike HIT
  - Death Ray HIT
  - Decoy target panels
  - Hot Potato PASS
- This prevents the tutorial itself from consuming a reaction/timing window.

### Parry preparation
- Every Parry reaction now has a **900ms GET READY phase** before the marker starts moving.
- During the warning:
  - the marker and green success window are hidden;
  - the UI explicitly says to prepare and use SPACE / PARRY;
  - input is ignored until the actual reaction bar begins.
- Heavy Attack's four separate Parry checks each receive their own short preparation cue.
- Parry difficulty, speed scaling, success windows, failure damage and cooldown rules are otherwise unchanged.
\n\n## v30 — guided tutorial retry / obvious Parry countdown\n- Rebuilt directly from the actual v29 deployment files.\n- Added an always-visible `BUILD v30` badge beside the game title so deployment can be verified immediately.\n- Tutorial Popups now default ON when the player has never chosen a preference.\n- The Rulebook switch visibly says `Tutorial Popups: ON` or `OFF`.\n- Battle buttons are intercepted before they execute, showing an ACTION PREVIEW with Continue/Cancel.\n- Continue uses a one-shot bypass marker so the original action always executes instead of reopening the tutorial.\n- Parry preparation increased to about 1.3 seconds and now displays a live countdown.\n- During preparation the actual timing marker/success window are hidden behind a `WAIT FOR GO!` state.\n- After the countdown the UI flashes `GO!`, then starts the original fast Parry bar.\n

## v31 — Ultimate system + Blue Judas Hollow Purple + 50–100 HP

### Ultimate system
- Momentum is now directly connected to Ultimates.
- At **100% Momentum**, the fighter's Ultimate becomes READY.
- Using an Ultimate immediately spends Momentum back to **0%**.
- The system uses a server-side `ULTIMATES` registry so new character Ultimates can be added progressively.
- Specials/Traits without an implemented Ultimate currently show **Ultimate — Coming Soon**.
- Blue Judas is the first completed Ultimate.
- Ultimate is treated as its own main battle button for PTSD repeat-button rules.

### Blue Judas Ultimate — Hollow Purple
- Requires 100% Momentum.
- Starting it spends the full Momentum bar.
- Full-screen two-orb minigame:
  - Max Red and Max Blue appear side-by-side.
  - SPACE presses alternate charge between Red and Blue.
  - Each successful server input adds 10% to the current orb.
  - Unfinished orbs regress at 8% per second.
  - Once either orb reaches 100%, it locks permanently and stops regressing.
- When both are complete:
  - Red and Blue animate together into a purple orb.
  - The screen darkens around the edges.
  - The scene zooms toward the caster / purple power ball.
  - Purple rays build for roughly 1.5 seconds.
  - Hollow Purple fires across the screen and explodes on the opponent.
- Damage is chosen server-side from **15–35** with `roll()` rather than `rollShown()`, so there is **no damage-die animation**.
- Existing Defence / defensive protection continues to interact with the resulting hit.
- The Ultimate completes the user's normal move after the cinematic.

### HP setup
- Champion HP setup range changed from **1–50** to **50–100**.
- Fixed HP input now accepts 50–100 and defaults to 75.
- Random HP now rolls **50–100** at battle start.


## v32 — Hollow Purple cinematic ordering update
- Blue Judas Hollow Purple now uses a three-step sequence:
  1. Hollow Purple charge minigame
  2. Fade to black and show the provided Hollow Purple still image for 1.5s
  3. New orb-charging / firing animation
- The fired purple orb was redesigned to look more like the provided swirling Hollow Purple reference image, with a bright core, glowing rings, and lightning-like energy.
- Hollow Purple cinematic duration was extended on the server so damage resolves after the longer presentation.
- Added public asset files `assets/hollow-purple-still.png` and `assets/hollow-purple-orb-ref.png` (reference image kept in project assets).


## v33 — Hollow Purple timing / projectile update
- Extended the Hollow Purple transition: the fade-to-black now lasts 1 second longer, and the still-image stage now lasts 2 seconds longer.
- Removed the separate purple-orb charging stage from the cinematic.
- Replaced the fired Hollow Purple energy with a projectile that visually matches the newly provided reference image, using `public/assets/hollow-purple-projectile.png`.
- Adjusted server-side Hollow Purple timing so the damage resolves after the longer cinematic.


## v34 — Hollow Purple animation repair + Infinite Ultimates
- Rebuilt the Hollow Purple projectile as a live animated effect (rings, swirls, halo, trail, and impact) instead of simply showing the reference PNG.
- Fixed the Hollow Purple cinematic flow so it no longer gets stuck on a black screen after the still image.
- Adjusted the Hollow Purple still-image hold to be 0.3 seconds shorter.
- Added a new lobby room option: **Infinite Ultimates** (default OFF). When enabled, implemented Ultimates can be used anytime without needing 100% Momentum.


## v35 — Red Judas Ultimate: World Cutting Slash
- Added **Red Judas Ultimate — World Cutting Slash**.
- Ultimate can be used at 100% Momentum, or anytime when **Infinite Ultimates** is enabled.
- Added a dark-screen chant sequence using the three speech bubbles: **Scale of the Dragon...**, **Recoil...**, **Twin Meteors.**
- Added separate client-side finishing visuals: the user sees the opponent UI split diagonally, while the opponent sees their whole screen split diagonally and then reform.
- World Cutting Slash deals hidden **15–35** damage.


## v36 — World Cutting Slash visibility/timing fix
- Fixed the malformed World Cutting Slash speech-bubble keyframe declaration.
- Speech bubbles are now explicitly centered on top of the black screen with a high stacking layer, and the slash scene does not appear until all three bubbles finish.
- Both perspectives now use the exact same 2.4-second diagonal split/rejoin timing.
- Extended server-side World Cutting Slash resolution so damage resolves after the longer shared cut animation.


## v37 — Exact World Cutting Slash speech bubbles
- Replaced the CSS-drawn speech bubbles with the exact uploaded bubble images for World Cutting Slash.
- Bubbles now use the exact provided font/art style and are displayed slightly larger, centered over the black screen.


## v38 — World Cutting Slash bubble styling
- Replaced the image-based chant bubbles with hand-built speech bubbles styled to match the reference bubble look more closely.
- The chant bubbles now use only the bubble shape and text styling, not the full reference images.
- Increased bubble size slightly and kept them centered over the black screen.


## v39 — World Cutting Slash chant bubbles
- Replaced the reconstructed chant bubbles with art assets based directly on the provided speech-bubble references.
- Bubbles are displayed slightly larger and centered over the black screen during the World Cutting Slash cinematic.


## v40 — World Cutting Slash bubble asset replacement
- Removed the previous three World Cutting Slash bubble image assets/copies.
- Replaced them, in order, with the three newly uploaded bubble images.
- The chant sequence and timing are unchanged.


## v41 — World Cutting Slash speech-bubble motion from reference video
- Rebuilt each chant bubble animation from the supplied 3.17-second reference clip.
- Each bubble now has a full ~3.16s sequence: pop-in, exaggerated whip/tilt/zoom, settle/bounce, slow push-in, then a dramatic zoom-out/fade.
- The bubbles still appear strictly one at a time.
- The slash scene was delayed until all three longer bubble animations finish.
- Server World Cutting Slash timing was extended so damage resolves after the full cinematic.


## v45 — Solo / Offline vs Bot mode (branched from v43)
- v45 intentionally uses **v43 as its base**, discarding the v44 speech-bubble animation change.
- Added **Play Offline vs Bot** to the main menu.
- Before creating the solo match, Player 1 chooses:
  - Bot HP (50–100)
  - Bot Special/Trait, including Standard, Generated, Fun, or Random
- The CPU occupies Player 2 and is already locked in when the solo lobby opens.
- Player 1 still chooses their own champion through the normal lobby setup.
- The bot is server-controlled and does not require a second browser/client connection.
- Bot AI can use Normal/Heavy/Charged attacks, Guard, Parry, Charge/Beam, selected safe Special abilities, and implemented Ultimates.
- Bot reactions automatically handle Parry, incoming Beams, Decoy choices, Hot Potato, Dance Battle notes, Beam Clash tapping, Domain Defence charge turns, and Blue Judas Hollow Purple charging.
- Rematch works against the same bot. Returning to champion select keeps the bot locked in.

### v45 cleanup
- Bot players do not count as live human connections for stale-room garbage collection.
- Solo lobby clearly labels the CPU seat and keeps it locked between solo champion-select rounds.


## v46 — World Cutting Slash cleanup + synchronized skip
- Built from v45.
- Removed rotation, skew and sideways shaking from the World Cutting Slash chant bubbles.
- The three bubble animations now run slightly faster while preserving the smooth pop/zoom presentation.
- Added a **Skip Ultimate** button visible only to the Red Judas player who activated World Cutting Slash.
- Skipping is server-authoritative: when the attacker skips, both players immediately leave the cinematic and the attack resolves together.


## v47 — World Cutting Slash Attack Timing
- Speech bubbles now fade upward faster with a darker/redder menacing presentation and no shake.
- Bubble timing: each chant lasts 1.35s; the final bubble ends at 4.35s.
- Exactly 0.5s later, the attacker receives a World Cutting Slash timing bar.
- Damage by timing grade:
  - PERFECT: fixed 35 raw damage
  - GOOD: hidden 15–35 roll (original behavior)
  - BAD: fixed 15 raw damage
- Skip Ultimate now skips the chant for both players and jumps directly to the timing bar instead of resolving damage immediately.
- The opponent sees a short aiming message while the attacker performs the timing bar.
- Solo CPU Red Judas automatically resolves the timing bar using its normal bot timing-grade distribution.

## v48 — The Great Exception Ultimate: Reality Manipulation

- Added **Reality Manipulation** as The Great Exception's Ultimate.
- At 100% Momentum (or anytime with Infinite Ultimates), it plays a short distortion cinematic, then the user rewrites exactly one opponent stat:
  - HP: set anywhere from 25% to 100% of the opponent's max HP;
  - Momentum: set anywhere from 0–100%;
  - Seal one normal battle button for the rest of the battle: Attack, Defence, Charge, Effects, Action, or Ultimate. Special cannot be sealed.
- After the rewrite, The Great Exception receives **Upgraded Magic Bag** for the next 3 personal turns.
- Upgraded Magic Bag draws only: Piano, Toy Army, Truck, Lion, A BAZOOKA, Golden Apple, or Anvil.
- Added **Truck**: 15–20 damage, Magic Bag only and not sold in Shop.
- Added **Lion** item/Companion: one Companion Move per turn; Defend Me = 10 protection, Big Bite = 10 damage + 2-turn Bleed.
- Added **Golden Apple**: heals 10 HP at the start of each of the next 3 owner turns. It is sold in Shop for a 2-turn cost.
- Added **Anvil**: horizontal timing minigame; BAD = 5, GOOD = 10, PERFECT = 17.
- Offline Bot support was extended for Reality Manipulation, Upgraded Magic Bag, and Anvil timing.
\n\n## v49 — Reality soft-lock fix, Charge Momentum, Bite FX, vertical Anvil\n- Fixed Reality Manipulation choice UI layering: distortion/cinematic layers no longer intercept clicks, while the rewrite panel/buttons render above them.\n- Energy Charge and Beam Charge conversion now give +5 Momentum and are exempt from the normal -3 non-Attack Momentum loss.\n- Bite / Big Bite companion moves now trigger a red jaw-closing impact animation on the target. Big Bite uses the larger/heavier version.\n- Anvil timing is now vertical (top to bottom) while keeping BAD 5 / GOOD 10 / PERFECT 17.\n

## v50 — World Slash glass break, Companion recovery, tiny Parry easing
- Fixed World Cutting Slash chant ordering: delayed speech bubbles remain fully hidden until their own animation begins, so Bubble 3 cannot cover Bubble 1/2 early.
- World Cutting Slash no longer rejoins the two cut halves. During the slash, the cinematic background becomes transparent so the real battle UI is already behind it; cut pieces fly away and a glass-shard burst reveals the battle screen.
- Companions now enter a one-personal-turn recovery cooldown after consuming all of their Companion Moves. This also applies to Zombie Dancers after exhausting their available dancer moves.
- Parry remains hard but is very slightly easier: a tiny increase to the center window and a tiny reduction in marker speed.


## v51 — Pokémon Trainer / Pokémon Rotation
- New Character (Special/Trait): **Pokémon Trainer**.
- At the start of every personal turn the Trainer must choose a Pokémon; the selection itself is free.
- Initial roster is centralized in the server `POKEMON_ROSTER`, making future roster expansion straightforward:
  - Pikachu — offensive pressure / Momentum.
  - Snorlax — Defence / damage reduction / retaliation.
  - Gengar — disruption / Weakness / Hypnosis / Poison.
  - Charizard — high PP-cost heavy damage / Burn / Armour Break.
- Limited PP replaces ordinary cooldowns for Pokémon moves.
- Repeating the same Pokémon on consecutive turns applies a **+1 PP Repeat Tax** to every Pokémon move for that turn.
- Pokémon Center restores +1 PP to every move across the entire roster and costs the full turn.
- Offline Bot supports the Pokémon-choice phase and can use the Pokémon Trainer playstyle.


## v52 — Pokémon shared HP, PokéCenter rework, Vaporeon
- Pokémon now have their own HP pools while still sharing damage with the Trainer: Pikachu 12, Snorlax 20, Gengar 15, Charizard 17, Vaporeon 15.
- Any damage that reaches the Pokémon Trainer's real HP also removes the same amount from the active Pokémon's HP. A Pokémon that reaches 0 faints and cannot be selected until healed.
- Pokémon Trainer's Attack button becomes Pokémon Moves; Special becomes PokéCenter.
- PokéCenter costs the full turn and can either heal one Pokémon to full HP or restore +1 PP to every move across the roster.
- PokéCenter is also accessible from the mandatory rotation screen, preventing a soft-lock if every Pokémon has fainted.
- Added Vaporeon: Water Gun (1–6 Water damage, Wet 2 turns, Nightcrawler ×1.5 weakness) and Seduce (50% Seduced for D4 turns).
- Wet reduces Defence gained from rolls by 2 for its duration.


## The Gambler — Overlay & Lucky Streak Update (2026-10-28)
- Casino minigames display above the battle in a fixed, responsive viewport overlay. Compact layouts keep controls accessible without scrolling the whole fight.
- Dance Battle ramps from 800ms notes to 175ms notes with tighter reaction windows.
- Every unsuccessful Relentless Gambler slot increases the next spin's bonus triple probability by 3 percentage points (maximum 30%), until JACKPOTT resets the streak.
- A five-spin failure, 40-damage interruption, or Domain Clash defeat refunds 100 Momentum.
- Relentless Gambler can challenge a fully charging opposing Domain. Winning the Domain Clash guarantees three sevens on the next Slot spin.
- The Gambler's successful 50% deathblow comeback guarantees three sevens on their next Slot spin; other fighters' existing comeback chance is unchanged.
- Slots, bonus probability and guarantees are validated on the server.

## The Gambler Roulette & Judas Energy Expansion (October 2026)
- New Gambler Fortune Roulette minigame, full-screen animated European wheel, server-authoritative bets and payouts, green-zero JACKPOTT.
- Gambler Dance Battle now deals 10 HP damage to the loser.
- Shared Blue/Red Judas Cursed and Positive Energy resource, overflow handling, conversion and 50-Momentum semi-Ultimates.
- Blue Judas Limitless: Blue Gravity Control and Limitless: Red pulsing-sphere skill minigames, Pulled / Off-Balance, healing RCT, and optional charge-boosted Max Blue.
- Existing Max Red retains its base mechanics pending full specifications and can spend earned Red Charges for +2 damage apiece.
- Updated Railway Docker dependencies, frontend CSS, tests and upload instructions.

## 2026-11-02 — The Gloved One: Crowd Hype
- New Crowd Hype performance resource, Feel the Flow and The Final Show.
- Revamped Beat It and Moonwalk timing challenges, Smooth Criminal leaning challenge, Pitching the Voice Tune Deaf effect, updated Footwork and Dance Battle.
- Thriller Night +5 damage, Zombie Dancers' Thriller minigame and owner-supplied continuous audio track.

## Smooth Criminal — Perfect Spot update (2026-11-03)

- Replaced Smooth Criminal's old lean/Stop minigame with the project owner's original **Impossible Lean** gold/green balancing interface, embedded over the arena.
- Fixed duration to **10 seconds**; crossing the ±52° fall limit ends it early.
- Damage is `ceil(green seconds + perfect/gold seconds)`; gold time continues counting in green.
- At 5 seconds in gold, applies **Tune Deaf** for two turns, restores 5 HP (up to max) and grants **Adrenaline**.
- Added a server-side movement simulation, shared balance physics, responsive controls, synchronized live scoring, and a results reveal for both players.
- Added checks for the two new public files and focused integration-style rules tests.

## November 3 — Moonwalk, free items, and Electricity Turret

- **The Gloved One / Moonwalk:** the next opposite-arrow prompt is available immediately after the previous input is judged, instead of waiting an extra 350 ms. Rapid consecutive correct inputs work.
- **Stored items:** using an inventory item is a **free action** for every character except **The Great Exception**. Items that start a delayed interaction, such as an Anvil minigame or a Parry response, return the player to the same turn when complete. The Great Exception's Magic Bag and stored items remain turn-consuming. Buying from the shop retains its listed turn cost.
- **Master of Presentation / Electricity Turret:** the play window is **8.5 seconds** (previously 17), invaders spawn sooner and move faster so all 15 can enter play, the server-side horizontal hit tolerance is reduced from ±9% to ±4%, and the player receives **exactly 15 bullets**. Each valid shot uses one bullet even if it misses. The game shows remaining bullets and ends when the magazine is empty or the round timer expires.
- Added six regression tests for sequential Moonwalk inputs, free versus turn-consuming items, delayed-item resolution, turret shots and UI labels.

## New Item Collection & Umbrella Refresh — 2026-11-03

- Added six server-authoritative items to the regular Magic Bag pool and four-offer Shop: Power Glove, Mystery Candy, Gambler's Coin, Magic 8-Ball, Cursed Stopwatch and Deck of Cards.
- Power Glove grants +7 to the next damaging attack and inflicts 4 recoil after it resolves.
- Mystery Candy asks which fighter to target and applies a random helpful or harmful effect (five-turn duration).
- Gambler's Coin uses a true server-side 50/50 flip, with Fortune and double-damage on heads or recoil and Bad Luck on tails.
- Magic 8-Ball offers three possible button predictions and resolves against the actual next main action; correct predictions gain up to 15 Defence and +10 charge, wrong predictions make the next incoming attack deal 20% more.
- Cursed Stopwatch animates an uneven time flow and awards +5/+15/+25 charge based on proximity to 5.00 seconds. The server determines the official elapsed time.
- Deck of Cards now lets the player choose one of five hidden cards, server-shuffled from a 54-card deck. Jokers, face cards and red/black outcomes are validated by the server.
- Rebuilt Umbrella's visual presentation as a storm arena with directional gusts, animated clouds and a four-hit progress indicator; retained its protection values and cooldown.
- Added focused tests covering item rules, hidden card selection, item phases, scoring, recoil and asset bundling.
