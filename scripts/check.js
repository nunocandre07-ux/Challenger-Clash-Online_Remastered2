'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const inlineScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
assert.ok(inlineScripts.length,'Expected the browser game script');
for(const script of inlineScripts)new vm.Script(script,{filename:'public/index.html'});
const markup=html.slice(0,html.indexOf('<script src="/socket.io/socket.io.js">'));
const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Every HTML id must be unique');
for(const file of ['server.js','gambler-rules.js','casino-judas-rules.js','public/casino-judas.css','public/arena.css','public/gambler-minigames.css','public/audio/domain-clash.mp3','public/assets/hollow-purple-still.png']){
  assert.ok(fs.existsSync(path.join(__dirname,'..',file)),`Missing runtime resource: ${file}`);
}
console.log(`Client scripts compile; ${ids.length} unique HTML IDs; core assets present.`);

// The production Docker image must contain the Gambler's rule module.
const dockerfile=fs.readFileSync(path.join(__dirname,'../Dockerfile'),'utf8');
assert.match(dockerfile,/COPY\s+server\.js\s+gambler-rules\.js\s+casino-judas-rules\.js\s+\.\//, 'Dockerfile must copy gambler-rules.js beside server.js');

// Every playable fighter must appear in the player's main Special selector.
// The Gambler used to be available only as a CPU character, not to players.
for (const selector of ['special', 'botSpecial']) {
  const select=html.match(new RegExp(`<select id="${selector}">([\\s\\S]*?)<\\/select>`));
  assert.ok(select, `Missing ${selector} selector`);
  assert.match(select[1], /<option value="gambler">[^<]*The Gambler<\/option>/, `The Gambler must be selectable in ${selector}`);
}
console.log('The Gambler is selectable for players and CPU opponents.');

// Animated Gambler minigames must be bundled for Railway deployments.
assert.match(html,/href="\/gambler-minigames\.css"/, 'Animated minigame CSS must be linked');
for(const symbol of ['gamblerPokerSteps','gamblerSlotCabinet','gamblerCinematic','animateGamblerSlots','animateGamblerCoin','gamblerShowdown']){
 assert.ok(html.includes(symbol), `Missing interactive Gambler presentation: ${symbol}`);
}

// The casino minigames and coin choices must be viewport overlays, not below battle actions.
const casinoCSS=fs.readFileSync(path.join(__dirname,'../public/gambler-minigames.css'),'utf8');
assert.match(casinoCSS,/\.gamblerOverlay\{position:fixed!important;/);
assert.match(html,/gamblerCoinOverlayOpen=true/);
assert.match(html,/document\.body\.classList\.add\('gambler-modal-active'\)/);
// Dance Battle must accelerate well below its previous 300ms minimum.
const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
assert.match(source,/Math\.max\(160,Math\.round\(790\*Math\.pow\(\.95,i\)\)\)/);
console.log('Gambler overlays, coin UI and faster Dance Battle checked.');

assert.match(source,/p\.special==='gambler'\?GR\.randomInt\(2\)===0/,'Gambler should have a 50% comeback chance');
assert.match(source,/p\.gamblerGuaranteedSevens=true/,'Guaranteed triple-sevens reward missing');
assert.match(source,/failRelentlessGambler/,'Failed Ultimate refund helper missing');

// Roulette + Blue Judas scenes must remain true battle overlays with server validation.
assert.match(html,/id="casinoJudasOverlay"/);
assert.match(html,/Fortune Roulette/);
assert.match(html,/Gravity Control/);
assert.match(html,/Reverse Cursed Technique/);
assert.match(html,/href="\/casino-judas\.css"/);
assert.match(source,/socket\.on\('gambler-roulette'/);
assert.match(source,/socket\.on\('judas-mini'/);
console.log('Roulette, Judas minigames, and server-validated actions checked.');

// Six Eyes / I.V. / Gambler update regression checks.
for(const fragment of ["id=\"domainResponseOverlay\"","id=\"domainIvFast\"","id=\"infinityBlue\"","renderDomainResponse()"]){
 assert.ok(html.includes(fragment),`Missing Six Eyes UI: ${fragment}`);
}
for(const fragment of ["socket.on('domain-response'","p.infinityHits=3","p.sixEyesTurns=7","p.gamblerCooldowns.blackjack=2","p.gamblerCooldowns.poker=3","actor.gamblerCooldowns.roulette=2"]){
 assert.ok(source.includes(fragment),`Missing server mechanic: ${fragment}`);
}
console.log('Six Eyes, Domain responses, Infinity and Gambler cooldowns checked.');

// Red Judas upgrade and the Blue Judas balance changes must ship together.
for(const fragment of ['startRedJudasMini','resolveRedJudasMini','redJudasMiniAct',"move==='fuga'", "move==='cleave'",'chargeBonus=3*',"p.special==='greatexception'?1.15:.75"]){assert.ok(source.includes(fragment),`Missing Red Judas / Momentum upgrade: ${fragment}`)}
for(const fragment of ['redMemoryDisplay','redRhythmCursor','redSymbolKeyboard','domainMsFast','cjBlueFill']){assert.ok(html.includes(fragment),`Missing live minigame UI: ${fragment}`)}
const judasCSS=fs.readFileSync(path.join(__dirname,'../public/casino-judas.css'),'utf8');
assert.match(judasCSS,/\.redRhythmBar/);assert.match(judasCSS,/\.redGlyphCell/);
console.log('Red Judas memory, rhythm, Fuga and Domain UI checks passed.');

// Oct 30 release: the new menus must remain wired into both browser and server.
const newServerMarkers=["socket.on('defensive-stance'","function shopCatalog(p)","pokemonRestoreCenter(room,p,selected)","ult.id==='teamrocket'","p.nationalFlagUses>=2","p.armourDefenceLock=1","GR.randomInt(5)","const after=Math.floor(before*.25)","addDamagingSpecialMomentum(room,a,g.kind.toUpperCase())"];
for(const fragment of newServerMarkers)assert.ok(source.includes(fragment),`Missing Oct 30 server mechanic: ${fragment}`);
const newUiMarkers=['id="defensiveStanceMove"','id="pokemonPpChooserGrid"','id="kingCurses"','id="sixEyes"','teamRocketCinematic','judasGoldReady','const glyphs=[\'◆\',\'◇\',\'△\',\'▽\',\'○\']'];
for(const fragment of newUiMarkers)assert.ok(html.includes(fragment),`Missing Oct 30 battle UI: ${fragment}`);
console.log('Oct 30 defensive stance, Team Rocket, updated Judas and Pokémon interfaces checked.');

// Team Rocket cinematic must ship inside the deployed public directory.
assert.ok(fs.existsSync(path.join(__dirname,'../public/video/team-rocket-ultimate.mp4')),'Missing Team Rocket video asset');
assert.ok(source.includes('victim.rocketMoveBlocked=move'),'Team Rocket must block the selected stolen Special');
assert.ok(source.includes('p.pokemonHP=initialPokemonHP()')&&source.includes('p.pokemonPP=initialPokemonPP()'),'Team Rocket must restore every Pokémon');
assert.ok(source.includes('function useRocketStolenMove('),'The stolen move must be usable from Ultimate');
assert.ok(html.includes('/video/team-rocket-ultimate.mp4'),'Team Rocket cinematic must play its replacement-audio MP4');
console.log('Team Rocket video, 3-turn move theft, and all-Pokémon recovery checked.');

// Master of Presentation equipment and animated special minigames.
assert.ok(fs.existsSync(path.join(__dirname,'../public/presentation-minigames.css')), 'Presentation minigames CSS must be deployed');
for(const marker of ["id=\"presentationOverlay\"", "function syncPresentationMini()", "presentation-shoot", "targetingsystems", "musicspeakers", "electricityturret"]){assert.ok(html.includes(marker),`Missing Master of Presentation UI: ${marker}`)}
for(const marker of ["socket.on('presentation-hit'", "socket.on('presentation-shoot'", "socket.on('presentation-ship'", "function finishPresentationMini", "p.groovinBlocked===button", "p.momentum<15", "p.momentum<10"]){assert.ok(source.includes(marker),`Missing server-side presentation mechanic: ${marker}`)}
console.log('Master of Presentation minigames and server-side unlocks checked.');

// Smooth Criminal must be a first-party overlay with a server-owned 10-second score.
const smoothPagePath=path.join(__dirname,'../public/smooth-criminal.html');
const smoothPhysicsPath=path.join(__dirname,'../public/smooth-criminal-physics.js');
assert.ok(fs.existsSync(smoothPagePath),'Smooth Criminal page must be deployed');
assert.ok(fs.existsSync(smoothPhysicsPath),'Smooth Criminal physics must be deployed');
const smoothPage=fs.readFileSync(smoothPagePath,'utf8');
for(const marker of ['THE IMPOSSIBLE LEAN','id="perfectTime"','cc-smooth-state','cc-smooth-action','<script src="smooth-criminal-physics.js">'])assert.ok(smoothPage.includes(marker),`Missing Smooth Criminal UI: ${marker}`);
assert.ok(html.includes('gloveSmoothNative')&&html.includes('smoothMarkup(g,mine)')&&!html.includes('gloveSmoothFrame'),'Smooth Criminal must render natively in the existing overlay, not in an iframe');
assert.ok(source.includes('SM.result(')&&source.includes('advanceSmoothCriminal('),'Smooth Criminal must be scored on the server');
const inlineSmooth=smoothPage.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inlineSmooth,'Smooth Criminal UI script is missing');
new Function(inlineSmooth[1]);
console.log('Smooth Criminal markup, client script and server-owned physics verified.');
// New item overlays must be shipped with the server and Docker image.
assert.ok(html.includes('href="/new-items.css"'));
assert.ok(html.includes("socket.on('item-cinematic',showItemCinematic)"));
assert.ok(html.includes('function renderItemMini()'));
assert.ok(html.includes('ccDeckSpread'));
assert.ok(source.includes("socket.on('item-mini-action'"));
assert.ok(source.includes('itemCardOutcome(card)'));
assert.ok(fs.existsSync(path.join(__dirname,'../public/new-items.css')),'Missing new item minigame visuals');
console.log('New Magic Bag items, deck interaction, umbrella animation and deployment assets checked.');

// November 5: prevent a half-uploaded two-player Reality Clash or broken Hype/PP features.
for(const marker of [
  'function beginRealityContest(', 'function pressRealityPulse(', 'function finishRealityContest(',
  "socket.on('reality-clash-pulse'", 'function availableRocketMoves(',
  'function awardGreatExceptionItemMomentum(', 'function applyHypeGain(',
  'p.rocketMoveBlocked===`pokemon:${p.activePokemon}:${moveId}`'
])assert.ok(source.includes(marker),`Missing November 5 server code: ${marker}`);
for(const marker of ['id="realityDuelPanel"','function pressRealityClash(', 'reality-clash-pulse',
  'rocketStolenBlocked','pokemonMoveBtn'])assert.ok(html.includes(marker),`Missing November 5 UI: ${marker}`);
const smoothRules=require('../public/smooth-criminal-physics.js');
assert.equal(smoothRules.GOOD_ANGLE,5.5);
assert.equal(smoothRules.PERFECT_ANGLE,1.2);
assert.equal(smoothRules.result({goodSeconds:6,perfectSeconds:2}).damage,12);
console.log('November 5 Reality Clash, broader Team Rocket theft, Crowd Hype and Smooth Criminal update checked.');
