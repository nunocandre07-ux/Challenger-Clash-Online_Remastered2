'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const filename=path.resolve(__dirname,'../server.js'),old=Module._load;
const clients=new Map(),effects=[];let nextId=0;
const io={engine:{clientsCount:0},sockets:{sockets:clients},on(name,cb){if(name==='connection')this.connect=cb},to(){return{emit(name,payload){effects.push({name,payload})}}}};
function express(){const app=()=>{};for(const name of ['disable','use','get'])app[name]=()=>app;return app;}express.static=()=>()=>{};
Module._load=function(name,parent,main){if(name==='express')return express;if(name==='socket.io')return {Server:class{constructor(){return io;}}};if(name==='http')return {createServer:()=>({listen(){}})};return old.call(this,name,parent,main)};
let api;try{const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports={rooms,beginRealityManipulationChoice,beginRealityContest,pressRealityPulse,finishRealityContest,applyHypeGain,absorbAttack,awardGreatExceptionItemMomentum,pokemonSpendPP,choosePokemonForTurn,availableRocketMoves,applyMagicBagAttack,finishGloveMini};',filename);api=mod.exports;}finally{Module._load=old;}
function socket(){const hooks={},s={id:'n5-'+(++nextId),data:{},on(name,cb){hooks[name]=cb},join(){},leave(){},disconnect(){}};s.send=(event,data={})=>{let reply;assert.ok(hooks[event],event);hooks[event](data,r=>{reply=r});assert.ok(reply,`${event}: missing ACK`);return reply};clients.set(s.id,s);io.connect(s);return s;}
function duel(aSpecial='greatexception',bSpecial='standard'){
 const a=socket(),b=socket(),cr=a.send('create-room');assert.ok(cr.ok);assert.ok(b.send('join-room',{code:cr.code}).ok);
 assert.ok(a.send('player-setup',{name:'A',special:aSpecial,hpMode:'fixed',hp:100}).ok);
 assert.ok(b.send('player-setup',{name:'B',special:bSpecial,hpMode:'fixed',hp:100}).ok);
 assert.ok(a.send('start-game').ok);
 const room=api.rooms.get(cr.code);room.current=0;room.phase='turn';return {room,a,b,p:room.players[0],q:room.players[1],close(){a.send('leave-room')}};
}
test('Reality Ultimate selection enters shared four-pulse timing contest instead of an immediate unfair rewrite',()=>{
 const d=duel(); d.p.momentum=100;
 assert.ok(d.a.send('ultimate').ok);const rm=d.room.realityManipulation;assert.ok(rm);
 api.beginRealityManipulationChoice(d.room,rm.id);
 assert.ok(d.a.send('reality-manipulation-choice',{choice:'hp'}).ok);
 assert.equal(rm.stage,'contest');assert.equal(rm.pulses.length,4);
 assert.ok(d.room.phase==='ultimateRealityManipulation');
 rm.pulses[0]=Date.now();assert.ok(d.a.send('reality-clash-pulse').ok);
 const once=rm.scores[0];assert.ok(once>=1);
 assert.equal(d.a.send('reality-clash-pulse').hit,false,'cannot score the same pulse twice');assert.equal(rm.scores[0],once);
 assert.ok(rm.scores[1]===0);
 api.finishRealityContest(d.room);
 assert.equal(d.q.hp,78,'attack-winning clash deals strong but nonlethal 22 HP');
 assert.equal(d.room.phase,'turn');d.close();
});
test('Reality resistance weakens the Ultimate but never nullifies it',()=>{
 const d=duel();d.room.realityManipulation={id:'test',slot:0,stage:'contest',choice:'momentum',scores:[0,8]};
 d.q.momentum=70;api.finishRealityContest(d.room);
 assert.equal(d.q.momentum,50,'successful defence cuts 70 Momentum down by only 20');d.close();
});
test('Reality seals expire after the correct number of opponent turns and do not permanently remove Special',()=>{
 const d=duel();d.room.realityManipulation={id:'seal',slot:0,stage:'contest',choice:'seal',value:'Attack',scores:[4,4]};
 api.finishRealityContest(d.room);
 assert.equal(d.q.realitySealTurns.Attack,2);
 assert.equal(d.q.realitySealedButtons.length,0);
 // One completed opponent turn should reduce the remaining seal.
 d.room.current=1;d.room.phase='turn';d.q.actionsRemaining=1;assert.ok(d.b.send('defend').ok);
 assert.equal(d.q.realitySealTurns.Attack,1);d.close();
});
test('Smooth Criminal keeps both zones nested, widened and double gold scoring',()=>{
 const SM=require('../public/smooth-criminal-physics.js');
 assert.equal(SM.GOOD_ANGLE,5.5);assert.equal(SM.PERFECT_ANGLE,1.2);
 assert.equal(SM.result({goodSeconds:6,perfectSeconds:2}).damage,12);
 assert.equal(SM.result({goodSeconds:6,perfectSeconds:5}).perfectReward,true);
});
test('High Crowd Hype reduces Hype gain by 33 percent and increases incoming attack damage by tiers',()=>{
 const d=duel('standard','glovedone');d.q.gloveHype=60;assert.equal(api.applyHypeGain(d.q,20),13);assert.equal(d.q.gloveHype,73);
 d.q.gloveHype=75;assert.equal(api.absorbAttack(d.room,d.q,10,d.p).damage,12);
 d.q.gloveHype=100;assert.equal(api.absorbAttack(d.room,d.q,10,d.p).damage,13);
 d.q.gloveHype=49;assert.equal(api.absorbAttack(d.room,d.q,10,d.p).damage,10);
 d.close();
});
test('Repeated Pokémon move costs +1 PP until an actual move by another Pokémon',()=>{
 const d=duel('pokemontrainer');d.p.activePokemon='pikachu';d.p.pokemonLastMove=null;
 assert.equal(api.pokemonSpendPP(d.room,d.p,'quickattack').cost,1);
 assert.equal(api.pokemonSpendPP(d.room,d.p,'thunderbolt').cost,2);
 d.p.activePokemon='gengar';assert.equal(api.pokemonSpendPP(d.room,d.p,'shadowball').cost,1);
 d.p.activePokemon='pikachu';assert.equal(api.pokemonSpendPP(d.room,d.p,'quickattack').cost,1);
 d.close();
});
test('Team Rocket can steal available damaging, debuff and item/companion specials',()=>{
 const d=duel('pokemontrainer','greatexception');
 const bag=api.availableRocketMoves(d.q).map(x=>x[0]);assert.ok(bag.includes('magicbag'));
 d.q.special='redjudas';d.q.kingTurns=0;
 assert.ok(!api.availableRocketMoves(d.q).some(x=>x[0]==='fuga'));
 d.q.kingTurns=3;assert.ok(api.availableRocketMoves(d.q).some(x=>x[0]==='fuga'));
 d.q.special='masterpresentation';d.q.spiderTurns=3;
 const items=api.availableRocketMoves(d.q).map(x=>x[0]);assert.ok(items.includes('brainbotswarm')&&items.includes('musicspeakers'));
 d.close();
});
test('Great Exception item damage awards 5–15 additional momentum based on actual HP loss',()=>{
 const d=duel();d.p.momentum=0;
 api.awardGreatExceptionItemMomentum(d.room,d.p,1,'Knife');assert.ok(d.p.momentum>=5&&d.p.momentum<=15);
 d.p.momentum=0;api.awardGreatExceptionItemMomentum(d.room,d.p,25,'Truck');assert.equal(d.p.momentum,15);
 d.p.momentum=0;api.awardGreatExceptionItemMomentum(d.room,d.p,0,'Miss');assert.equal(d.p.momentum,0);
 d.close();
});
test('Beat It now deals exactly one less raw damage before buffs',()=>{
 const d=duel('glovedone');d.p.gloveHype=0;d.room.gloveMini={kind:'beat',owner:0,actor:0,hits:10,misses:0,sequence:Array(10).fill(0)};
 d.q.defence=0;
 api.finishGloveMini(d.room);
 assert.equal(d.q.hp,93,'ten hits give 9 base, minus 2 low-Hype penalty = 7');d.close();
});

test('Circuit retries a loss, advances on wins, heals the champion and loops after Flux',()=>{
 const human=socket(), created=human.send('create-bot-room',{mode:'circuit',botHp:100});
 assert.ok(created.ok);const room=api.rooms.get(created.code);
 assert.equal(created.state.circuit.stage,1);
 assert.ok(human.send('player-setup',{name:'Ace',special:'nightcrawler',hp:75}).ok);
 assert.ok(human.send('start-game').ok);
 for(const [winner,index,name,hp] of [[1,0,'Knuckle',60],[0,1,'Bulwark',80],[0,2,'Flux',100],[0,0,'Knuckle',60]]){
   room.status='finished';room.phase='finished';room.winner=winner;room.players[0].hp=1;
   assert.ok(human.send('rematch').ok);assert.equal(room.circuitIndex,index);
   assert.equal(room.players[1].name,name);assert.equal(room.players[1].hp,hp);
   assert.equal(room.players[0].hp,75);assert.equal(room.players[0].special,'nightcrawler');
   assert.equal(human.send('rematch').ok,false);
 }
 assert.ok(human.send('leave-room').ok);
});
