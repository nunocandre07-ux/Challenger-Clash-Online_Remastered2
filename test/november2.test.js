'use strict';
// Deterministic release checks. Interactive turn simulations are covered by
// logic.test.js, october30.test.js, and the original character suites.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const server=read('server.js'),client=read('public/index.html'),css=read('public/casino-judas.css');
const CJ=require('../casino-judas-rules.js');
test('Blue Judas gains only one CE outside Six Eyes and five during Six Eyes',()=>{
  const p={special:'bluejudas',cursedEnergy:3,positiveEnergy:0,cursedMax:8,overEnergy:0,judasTurns:0,sixEyesTurns:0};
  CJ.replenish(p);assert.equal(p.cursedEnergy,4);CJ.replenish(p);assert.equal(p.cursedEnergy,5);
  p.sixEyesTurns=6;p.cursedMax=20;CJ.replenish(p);assert.equal(p.cursedEnergy,10);
});
test('Gravity challenges are timed and require three or six moving objects',()=>{
  assert.match(server,/blue\?3700:6500/);
  assert.match(server,/game\.kind==='maxblue'\?6:3/);
  assert.match(client,/cjDrift/);assert.match(css,/cjDrift/);
  assert.match(client,/g\.kind==='maxred'\?'MAX RED'/);
});
test('Red Judas has five glyph symbols, partial timeout scoring, and no offensive cooldown',()=>{
  assert.match(server,/const RED_GLYPHS=\['◆','◇','△','▽','○'\]/);
  assert.match(server,/p\[field\]=0; \/\/ Red Judas/);
  assert.match(server,/g\.pressed\[i\]===v\?1:0/);
  assert.match(client,/action:'press'/);
});
test('Status durations, reversal trade and Great Exception item bonuses are installed',()=>{
  assert.match(server,/const extraTurn=extended\?1:0/);
  assert.match(server,/direction==='positive-to-cursed'/);
  for(const item of ["case 'kite'","case 'penguin'","case 'magicmirror'"])assert.ok(server.includes(item));
  assert.match(server,/raw\+\(a\.special==='greatexception'\?2:0\)/);
  assert.match(server,/effect==='bleed'/);
});
test('Umbrella and Light-Up Footwork use server-owned sessions and playable overlay',()=>{
  for(const name of ['startUmbrellaMini','umbrellaMiniAct','resolveUmbrellaMini','startFootworkMini','footworkMiniAct','resolveFootworkMini','p.footworkCooldown=3'])assert.ok(server.includes(name),name);
  for(const name of ['umbrellaScene','footworkGrid','footworkTile','november-mini'])assert.ok(client.includes(name),name);
  assert.match(css,/\.umbrellaScene/);assert.match(css,/\.footworkGrid/);
  assert.match(server,/p\.spotlightReady=2/);
});
test('Team Rocket steals one attack for three turns and seals only that attack',()=>{
  assert.match(server,/p\.rocketStolen=\{source:victim\.special,move,label,turns:4\}/);
  assert.match(server,/victim\.rocketMoveBlocked=move/);
  assert.match(server,/if\(p\.rocketMoveBlocked&&p\.rocketMoveBlocked===String/);
  assert.match(server,/function useRocketStolenMove\(/);
  assert.match(client,/rocketStolenBlocked/);
  assert.match(client,/STOLEN SPECIAL ATTACK/);
  assert.ok(fs.existsSync(path.join(root,'public/video/team-rocket-ultimate.mp4')));
});
