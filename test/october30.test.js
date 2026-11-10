'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const oldLoad=Module._load,oldTimeout=global.setTimeout;
// Socket.IO-free transport test. Timers won't hold the Node test process open.
global.setTimeout=(fn,ms,...args)=>{const t=oldTimeout(fn,ms,...args);t.unref?.();return t;};
const sockets=new Map(),messages=[];let next=0;
const io={engine:{clientsCount:0},sockets:{sockets},on(k,cb){if(k==='connection')this.connect=cb},to(room){return{emit(type,payload){messages.push({room,type,payload})}}}};
function express(){const app=()=>{};['disable','use','get'].forEach(k=>app[k]=()=>app);return app;}express.static=()=>()=>{};
Module._load=function(mod,parent,main){if(mod==='express')return express;if(mod==='socket.io')return {Server:class{constructor(){return io}}};if(mod==='http')return {createServer:()=>({listen(){}})};return oldLoad.call(this,mod,parent,main);};
try{require('../server.js');}finally{Module._load=oldLoad;}
function socket(){const handlers={},s={id:'oct'+(++next),data:{},on(k,h){handlers[k]=h},join(){},leave(){},disconnect(){}};
s.send=(event,payload={})=>{let answer;assert.ok(handlers[event],'handler: '+event);handlers[event](payload,r=>answer=r);assert.ok(answer,'ack '+event);return answer;};sockets.set(s.id,s);io.connect(s);return s;}
function duel(A='standard',B='standard',infinite=false){let a=socket(),b=socket();let made=a.send('create-room');assert.equal(made.ok,true);let code=made.code;assert.equal(b.send('join-room',{code}).ok,true);
if(infinite)assert.equal(a.send('room-options',{infiniteUltimates:true}).ok,true);
for(const [s,name,sp] of [[a,'Alice',A],[b,'Bob',B]])assert.equal(s.send('player-setup',{name,special:sp,hp:100,hpMode:'fixed'}).ok,true);
assert.equal(a.send('start-game').ok,true);
const get=()=>messages.filter(x=>x.room===code&&x.type==='room-state').at(-1)?.payload;
const turn=get().current;return{get,actor:[a,b][turn],other:[a,b][1-turn],slot:turn,a,b,close:()=>a.send('leave-room')};}
const p=d=>d.get().players[d.slot];
function pokemonDuel(B='standard',infinite=false){const d=duel('pokemontrainer',B,infinite);let owner=d.get().players.findIndex(p=>p.special==='pokemontrainer');d.actor=owner===0?d.a:d.b;d.other=owner===0?d.b:d.a;d.slot=owner;if(d.get().current!==owner)assert.equal(d.other.send('defend').ok,true);return d;}
test('Defensive Stance adds 2–3 Defence without consuming a move and cannot be repeated',()=>{const d=duel();const before=d.get().current;const r=d.actor.send('defensive-stance');assert.equal(r.ok,true);assert.equal(d.get().current,before);assert.ok(p(d).defence>=2&&p(d).defence<=3);assert.equal(p(d).defensiveStancePenalty,3);assert.equal(d.actor.send('defensive-stance').ok,false);assert.equal(d.actor.send('defend').ok,true);assert.equal(d.get().current,1-before);d.close();});
test('Armour Break removes 75% stored Defence, blocks one Defence turn, then unlocks',()=>{const d=duel();assert.equal(d.actor.send('defend').ok,true);assert.equal(d.other.send('defend').ok,true);const before=d.get().players[1-d.slot].defence;assert.ok(before>0);assert.equal(d.actor.send('effect',{effect:'armourbreak'}).ok,true);const broken=d.get().players[1-d.slot];assert.equal(broken.defence,Math.floor(before*.25));assert.equal(broken.armourDefenceLock,1);assert.equal(d.other.send('defend').ok,false);assert.equal(d.other.send('charge',{choice:'start'}).ok,true);assert.equal(d.get().players[1-d.slot].armourDefenceLock,0);d.close();});
test('Shop sells only its four current random offers',()=>{const d=duel();const r=d.actor.send('shop-list');assert.equal(r.ok,true);assert.equal(r.items.length,4);assert.equal(new Set(r.items.map(x=>x.id)).size,4);assert.deepEqual(d.actor.send('shop-list').items.map(x=>x.id),r.items.map(x=>x.id));assert.equal(d.actor.send('shop-buy',{id:'fake-unknown'}).ok,false);const next=d.actor.send('shop-buy',{id:r.items[0].id});assert.equal(next.ok,true);d.close();});
test('Pokémon Trainer selects once, can switch for free, Charizard has one PP per move',()=>{const d=pokemonDuel('standard');assert.equal(d.get().phase,'pokemonChoose');const roster=d.get().pokemonRoster;for(const move of Object.values(roster.charizard.moves))assert.equal(move.pp,1);assert.equal(d.actor.send('pokemon-choose',{pokemon:'pikachu'}).ok,true);assert.equal(p(d).activePokemon,'pikachu');assert.equal(d.actor.send('pokemon-choose',{pokemon:'charizard'}).ok,true);assert.equal(p(d).activePokemon,'charizard');assert.equal(d.get().current,d.slot);assert.equal(d.actor.send('pokemon-choose',{pokemon:'charizard'}).ok,false);d.close();});
test('PokéCenter PP restoration requires exactly two different Pokémon',()=>{const d=pokemonDuel('standard');assert.equal(d.actor.send('pokemon-choose',{pokemon:'pikachu'}).ok,true);assert.equal(d.actor.send('pokemon-center',{mode:'pp',pokemonIds:['pikachu']}).ok,false);assert.equal(d.actor.send('pokemon-center',{mode:'pp',pokemonIds:['pikachu','pikachu']}).ok,false);assert.equal(d.actor.send('pokemon-center',{mode:'pp',pokemonIds:['pikachu','charizard']}).ok,true);d.close();});
test('Team Rocket restores Pokémon and steals one enemy Special for three turns',()=>{
  const d=pokemonDuel('redjudas',true);
  assert.equal(d.actor.send('pokemon-choose',{pokemon:'pikachu'}).ok,true);
  // Spend PP first and let an opposing move damage Pikachu, then cast the Ultimate.
  assert.equal(d.actor.send('pokemon-move',{move:'volttackle'}).ok,true);
  const before=d.get().players[d.slot];
  assert.ok(before.pokemonPP.pikachu.volttackle<d.get().pokemonRoster.pikachu.moves.volttackle.pp);
  // Volt Tackle recoil damages the active Pokémon as well; let the opponent finish its turn.
  assert.equal(d.other.send('defend').ok,true);
  const beforeHealth=d.get().players[d.slot].pokemonHP.pikachu;
  assert.ok(beforeHealth<d.get().pokemonRoster.pikachu.maxHp);
  assert.equal(d.actor.send('ultimate').ok,true);
  const restored=d.get().players[d.slot],roster=d.get().pokemonRoster;
  for(const [id,mon] of Object.entries(roster)){
    assert.equal(restored.pokemonHP[id],mon.maxHp,`${id} HP fully restored`);
    for(const move of Object.values(mon.moves))assert.equal(restored.pokemonPP[id][move.id],move.pp,`${id}.${move.id} PP fully restored`);
  }
  const stolen=p(d).rocketStolen;
  assert.ok(stolen&&['dismantle','cleave','effect:bleed','effect:poison','effect:weakness','effect:armourbreak','effect:energyleak'].includes(stolen.move),'Team Rocket stole a currently available Red Judas attack or harmful effect');
  assert.equal(stolen.turns,3,'three future turn opportunities');
  assert.equal(d.get().players[1-d.slot].rocketMoveBlocked,stolen.move);
  assert.ok(messages.some(x=>x.type==='team-rocket-fx'&&x.payload.slot===d.slot));
  for(let turns=3;turns>0;turns--){
    assert.equal((stolen.move.startsWith('effect:')?d.other.send('effect',{effect:stolen.move.slice(7)}):d.other.send('special',{move:stolen.move})).ok,false,'specific stolen attack or effect is blocked');
    assert.equal(d.other.send('defend').ok,true);
    assert.equal(d.actor.send('defend').ok,true);
    assert.equal(p(d).rocketStolen?.turns||0,turns-1);
  }
  assert.equal(d.get().players[1-d.slot].rocketMoveBlocked,null,'the stolen move is returned');
  d.close();
});
test('Dismantle gives partial damage for each correct symbol despite wrong symbols',()=>{const d=duel('redjudas','redjudas');assert.equal(d.actor.send('special',{move:'dismantle'}).ok,true);const g=d.get().judasMini;assert.equal(g.revealEndsAt-g.startedAt,3500);assert.equal(g.deadline-g.revealEndsAt,4000);assert.ok(g.sequence.every(x=>x>=0&&x<5));const entered=g.sequence.map((v,i)=>i<3?v:(v+1)%5);const old=Date.now;Date.now=()=>g.revealEndsAt+250;try{assert.equal(d.actor.send('judas-mini',{action:'submit',sequence:entered}).ok,true);}finally{Date.now=old;}assert.ok(d.get().players[1-d.slot].hp<100);d.close();});
test('King of Curses grants +5 Cursed Energy per owner turn but never automatically creates Positive Energy',()=>{const d=duel('redjudas','redjudas',true);assert.equal(d.actor.send('special',{move:'king'}).ok,true);assert.equal(d.other.send('defend').ok,true);assert.equal(p(d).cursedEnergy,13);assert.equal(p(d).positiveEnergy,0);d.close();});
test('Pikachu Volt Tackle costs 5 HP recoil',()=>{const d=pokemonDuel();assert.equal(d.actor.send('pokemon-choose',{pokemon:'pikachu'}).ok,true);const before=p(d).hp;assert.equal(d.actor.send('pokemon-move',{move:'volttackle'}).ok,true);assert.equal(p(d).hp,before-5);d.close();});
