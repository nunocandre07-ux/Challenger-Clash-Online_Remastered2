'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const casino=require('../casino-judas-rules');
test('European roulette wheel has every 0–36 pocket once, red/black exclude zero',()=>{
 assert.equal(casino.WHEEL.length,37);
 assert.equal(new Set(casino.WHEEL).size,37);
 for(let n=0;n<=36;n++)assert.ok(casino.WHEEL.includes(n));
 assert.equal(casino.RED.size,18);
 assert.ok(!casino.RED.has(0));
 assert.equal(casino.covers('black',0).length,18);
 assert.ok(!casino.covers('odd',0).includes(0));
});
test('Roulette supports standard inside and outside bets with stronger rare payouts',()=>{
 for(const [kind,n,count] of [['straight',0,1],['split',0,2],['trio',0,3],['street',1,3],['corner',1,4],['sixline',1,6],['dozen',1,12],['column',3,12],['red',0,18],['black',0,18],['even',0,18],['odd',0,18],['low',0,18],['high',0,18]]){
   const bet=casino.rouletteBet(kind,n);assert.ok(bet,kind);assert.equal(bet.pockets.length,count,kind);
 }
 assert.equal(casino.rouletteBet('split',36),null);
 assert.equal(casino.rouletteBet('straight',37),null);
 assert.equal(casino.rouletteBet('rouletteExploit',0),null);
 assert.ok(casino.DAMAGE.straight>casino.DAMAGE.street);
 assert.ok(casino.DAMAGE.street>casino.DAMAGE.red);
});
test('Winning green 0 grants jackpot, but any other zero outcome loses',()=>{
 const bet=casino.rouletteBet('straight',0);
 assert.deepEqual(casino.rouletteOutcome(bet,0),{won:true,landed:0,damage:30,jackpot:true});
 assert.deepEqual(casino.rouletteOutcome(casino.rouletteBet('red',0),0),{won:false,landed:0,damage:2,jackpot:false});
 assert.equal(casino.rouletteOutcome(bet,12).jackpot,false);
});
test('Shared energy regenerates only cursed energy; positive energy requires manual conversion',()=>{
 const p={special:'bluejudas',cursedEnergy:8,positiveEnergy:0,cursedMax:8,overEnergy:0,judasTurns:0};
 casino.replenish(p);assert.equal(p.cursedEnergy,8);
 casino.replenish(p);casino.replenish(p);
 assert.equal(p.positiveEnergy,0);assert.equal(p.cursedEnergy,8);assert.equal(p.overEnergy,0);
 assert.equal(casino.spend(p,3,0),true);p.positiveEnergy++;
 casino.discardOverenergy(p);
 assert.equal(p.cursedEnergy,5);assert.equal(p.positiveEnergy,1);
});
test('3 cursed to 1 positive is exact and spending is atomic',()=>{
 const p={special:'redjudas',cursedEnergy:8,positiveEnergy:0,cursedMax:8,overEnergy:0,judasTurns:0};
 assert.equal(casino.spend(p,3,0),true);
 p.positiveEnergy++;
 assert.equal(p.cursedEnergy,5);assert.equal(p.positiveEnergy,1);
 assert.equal(casino.spend(p,2,1),true);
 assert.equal(p.cursedEnergy,3);assert.equal(p.positiveEnergy,0);
 assert.equal(casino.spend(p,4,0),false);assert.equal(p.cursedEnergy,3);
 p.cursedMax=20;casino.replenish(p);assert.equal(p.cursedEnergy,5);
});
test('Six Eyes generates 5 cursed energy each personal turn, respecting the shared energy limit',()=>{
 const p={special:'bluejudas',sixEyesTurns:6,cursedEnergy:8,positiveEnergy:0,cursedMax:20,overEnergy:0,judasTurns:0};
 casino.replenish(p);assert.equal(p.cursedEnergy,13);
 casino.replenish(p);assert.equal(p.cursedEnergy,18);
 casino.replenish(p);assert.equal(p.positiveEnergy,0);assert.equal(p.cursedEnergy,20);
 casino.discardOverenergy(p);
 assert.equal(p.cursedEnergy+p.positiveEnergy,20);
 p.sixEyesTurns=0;p.cursedEnergy=6;p.positiveEnergy=0;
 casino.replenish(p);assert.equal(p.cursedEnergy,7);
});
