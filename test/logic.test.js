'use strict';
// Dependency-free game logic smoke tests. They exercise the actual server.js
// handlers with a tiny in-process transport mock, not a rewritten game model.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;

const byId = new Map();
const messages = [];
const fakeIo = {
  engine:{clientsCount:0},
  sockets:{sockets:byId},
  on(type,handler){if(type==='connection')this.connect=handler;},
  to(code){return {emit(type,payload){messages.push({code,type,payload});}};}
};
function fakeExpress(){
  const app=function(_req,_res){};
  app.disable=()=>app;app.use=()=>app;app.get=()=>app;
  return app;
}
fakeExpress.static=()=>()=>{};
Module._load=function(request,parent,isMain){
  if(request==='express')return fakeExpress;
  if(request==='socket.io')return {Server:class {constructor(){return fakeIo}}};
  if(request==='http')return {createServer:()=>({listen(_port,_host,cb){cb?.();}})};
  return originalLoad.call(this,request,parent,isMain);
};
try{require('../server.js');}finally{Module._load=originalLoad;}
let nextId=0;
function player(){
  const handlers={};const id='fake-'+(++nextId);
  const sock={id,data:{},on(name,handler){handlers[name]=handler;},join(){},leave(){},disconnect(){handlers.disconnect?.();byId.delete(id);}};
  sock.send=(type,data={})=>{
    assert.equal(typeof handlers[type],'function','missing '+type);
    let answer;
    handlers[type](data,reply=>{answer=reply;});
    assert.ok(answer,'missing acknowledgement for '+type);
    return answer;
  };
  byId.set(id,sock);fakeIo.connect(sock);return sock;
}
function lastState(code){
  return messages.filter(m=>m.code===code&&m.type==='room-state').at(-1)?.payload;
}

test('core engine: rooms, setup, authentic combat, surrender and rematch',()=>{
  const host=player(),guest=player();
  const created=host.send('create-room');
  assert.equal(created.ok,true);
  assert.equal(host.send('create-room').ok,false,'cannot create orphan rooms');
  assert.equal(guest.send('join-room',{code:created.code}).ok,true);
  assert.equal(guest.send('join-room',{code:created.code}).ok,false);
  assert.equal(host.send('start-game').ok,false,'must lock in first');
  assert.equal(host.send('player-setup',{name:'Alpha',special:'berserker',hpMode:'fixed',hp:80}).ok,true);
  assert.equal(guest.send('player-setup',{name:'Beta',special:'ironwall',hpMode:'fixed',hp:90}).ok,true);
  assert.equal(host.send('start-game').ok,true);
  const battle=lastState(created.code);
  assert.equal(battle.status,'playing');
  assert.equal(battle.players[0].hp,80);
  assert.equal(battle.players[1].hp,90);
  assert.equal(battle.players[0].special,'berserker');
  const actor=battle.current===0?host:guest;
  const nonActor=battle.current===0?guest:host;
  assert.equal(nonActor.send('defend').ok,false,'opponent cannot steal a turn');
  assert.equal(actor.send('defend').ok,true,'normal battle action still works');
  assert.equal(lastState(created.code).current,1-battle.current);
  assert.equal(host.send('chat',{text:'GLHF'}).ok,true);
  assert.equal(host.send('chat',{text:'spam'}).ok,false,'chat cooldown');
  assert.equal(guest.send('claim-victory').ok,false,'no forfeit against connected opponent');
  assert.equal(guest.send('surrender').ok,true);
  assert.equal(lastState(created.code).winner,0);
  assert.deepEqual(lastState(created.code).duelScore,[1,0]);
  assert.equal(host.send('rematch').ok,true);
  assert.equal(lastState(created.code).status,'playing');
  assert.equal(host.send('end-battle').ok,true);
  assert.equal(host.send('return-lobby').ok,true);
  assert.deepEqual(lastState(created.code).duelScore,[1,0]);
  assert.equal(guest.send('leave-room').ok,true);
  assert.deepEqual(lastState(created.code).duelScore,[0,0]);
  assert.equal(host.send('leave-room').ok,true);
});

test('reconnect token controls seat and stale connection cannot act',()=>{
  const host=player();const room=host.send('create-room');
  const second=player();
  const resumed=second.send('resume-room',{code:room.code,token:room.token});
  assert.equal(resumed.ok,true);
  assert.equal(resumed.slot,0);
  assert.equal(host.send('room-options',{funnyBusiness:false}).ok,false);
  assert.equal(second.send('resume-room',{code:room.code,token:'bad-token'}).ok,false);
  assert.equal(second.send('leave-room').ok,true);
});

test('solo room and CPU champion setup',()=>{
  const human=player();
  const created=human.send('create-bot-room',{botHp:100,botSpecial:'trickster'});
  assert.equal(created.ok,true);
  assert.equal(created.state.botMode,true);
  assert.equal(created.state.players[1].isBot,true);
  assert.equal(human.send('player-setup',{name:'Human',special:'nightcrawler',hp:75}).ok,true);
  assert.equal(human.send('start-game').ok,true);
  assert.equal(human.send('leave-room').ok,true);
});


test('forfeit is blocked during grace period and awarded after 90 seconds',()=>{
  const host=player(),guest=player();
  const created=host.send('create-room');
  assert.equal(guest.send('join-room',{code:created.code}).ok,true);
  assert.equal(host.send('player-setup',{name:'Leaves',hp:75}).ok,true);
  assert.equal(guest.send('player-setup',{name:'Stays',hp:75}).ok,true);
  assert.equal(host.send('start-game').ok,true);
  host.disconnect();
  assert.equal(guest.send('claim-victory').ok,false);
  const original=Date.now;
  try{Date.now=()=>original()+91_000;assert.equal(guest.send('claim-victory').ok,true);}
  finally{Date.now=original;}
  assert.equal(lastState(created.code).winner,1);
  assert.equal(guest.send('leave-room').ok,true);
});

function battlePair(){
  const a=player(),b=player(),created=a.send('create-room');
  assert.equal(created.ok,true);
  assert.equal(b.send('join-room',{code:created.code}).ok,true);
  assert.equal(a.send('player-setup',{name:'Fighter A',hp:90,special:'standard'}).ok,true);
  assert.equal(b.send('player-setup',{name:'Fighter B',hp:90,special:'standard'}).ok,true);
  assert.equal(a.send('start-game').ok,true);
  const code=created.code,actor=lastState(code).current===0?a:b,opponent=actor===a?b:a;
  return {a,b,actor,opponent,code,slot:lastState(code).current,now:()=>lastState(code),cleanup:()=>{a.send('leave-room');b.send('leave-room');}};
}
function basicStrike(p){
  const started=p.send('attack-timing-start',{style:'normal'});
  assert.equal(started.ok,true,JSON.stringify(started));
  assert.equal(p.send('attack-timing-resolve',{id:started.id,grades:['bad']}).ok,true);
}
function chargedStrike(p){
  const started=p.send('attack-timing-start',{style:'charged'});
  assert.equal(started.ok,true,JSON.stringify(started));
  assert.equal(p.send('attack-timing-resolve',{id:started.id,grades:['bad']}).ok,true);
}
function readyEnergy(pair){
  const {actor,opponent,now,slot}=pair;
  assert.equal(actor.send('charge',{choice:'start'}).ok,true);
  assert.equal(now().players[slot].charge,'charging');
  assert.equal(opponent.send('defend').ok,true);
  // Energy Charge completes at the start of the next owner turn and consumes that turn.
  assert.equal(now().players[slot].charge,'ready');
  assert.equal(opponent.send('defend').ok,true);
  assert.equal(now().current,slot);
}

test('Charge menu: Charged Attack respects the global 25% Momentum nerf and preserves normal Attack',()=>{
  const pair=battlePair();
  readyEnergy(pair);
  const before=pair.now().players[pair.slot].momentum;
  assert.equal(before,5);
  chargedStrike(pair.actor);
  const after=pair.now().players[pair.slot];
  assert.equal(after.charge,'none');
  assert.equal(after.momentum,before+8,'Charged Attack base +10 is scaled to +8 Momentum');
  assert.equal(after.stats.attacks,1);
  pair.cleanup();
});

test('Charge menu: Prepare Beam spends 15 Momentum and uses normal beam preparation',()=>{
  const pair=battlePair();
  basicStrike(pair.actor);
  assert.equal(pair.opponent.send('defend').ok,true);
  basicStrike(pair.actor);
  assert.equal(pair.opponent.send('defend').ok,true);
  readyEnergy(pair);
  const before=pair.now().players[pair.slot].momentum;
  assert.ok(before>=15);
  assert.equal(pair.actor.send('charge',{choice:'prepare'}).ok,true);
  const after=pair.now().players[pair.slot];
  assert.equal(after.momentum,before-15);
  assert.equal(after.stats.momentumSpent,15);
  assert.equal(after.beamCharge,'charging');
  pair.cleanup();
});

test('Charge menu: Unstable Beam costs 10 Momentum, fires immediately and applies recoil',()=>{
  const pair=battlePair();
  basicStrike(pair.actor);
  assert.equal(pair.opponent.send('defend').ok,true);
  readyEnergy(pair);
  const before=pair.now().players[pair.slot].momentum;
  const hp=pair.now().players[pair.slot].hp;
  assert.equal(pair.actor.send('charge',{choice:'unstable'}).ok,true);
  const after=pair.now().players[pair.slot];
  assert.equal(after.momentum,before-10+14,'Beam base +18 is scaled to +14 after the 10 cost');
  assert.equal(after.hp,hp-5,'Unstable Beam has 5 recoil');
  assert.equal(after.stats.momentumSpent,10);
  assert.equal(after.stats.beams,1);
  assert.equal(pair.now().phase,'beamResponse');
  pair.cleanup();
});

test('Energy Leak removes 8 Momentum on two of the target’s turns',()=>{
  const pair=battlePair();
  basicStrike(pair.actor);
  const before=pair.now().players[pair.slot].momentum;
  assert.equal(before,10);
  assert.equal(pair.opponent.send('effect',{effect:'energyleak'}).ok,true);
  const after=pair.now().players[pair.slot];
  assert.equal(after.momentum,before-8);
  assert.equal(after.energyLeak,2);
  assert.equal(pair.now().players[1-pair.slot].stats.effectsUsed,1);
  pair.cleanup();
});

test('Adrenaline buffs next attack and is visible in the post-match stat state',()=>{
  const pair=battlePair();
  assert.equal(pair.actor.send('effect',{effect:'adrenaline'}).ok,true);
  assert.equal(pair.now().players[pair.slot].adrenaline,true);
  assert.equal(pair.opponent.send('effect',{effect:'strengthen'}).ok,true);
  basicStrike(pair.actor);
  const p=pair.now().players[pair.slot];
  assert.equal(p.adrenaline,false);
  assert.equal(p.stats.attacks,1);
  assert.ok(p.stats.damageDealt>=4,'D6 strike with +3 Adrenaline deals at least 4 damage');
  assert.equal(p.stats.effectsUsed,1);
  assert.equal(p.stats.damageTaken,2,'recoil is recorded');
  pair.cleanup();
});

test('Effect combo: Weakness + Heavy Attack consumes Weakness for Crushing Blow',()=>{
  const pair=battlePair();
  assert.equal(pair.actor.send('effect',{effect:'weakness'}).ok,true);
  assert.equal(pair.now().players[1-pair.slot].weakness,3);
  assert.equal(pair.opponent.send('defend').ok,true);
  const started=pair.actor.send('attack-timing-start',{style:'heavy'});
  assert.equal(started.ok,true);
  assert.equal(pair.actor.send('attack-timing-resolve',{id:started.id,grades:['bad','bad','bad','bad']}).ok,true);
  assert.equal(pair.now().players[1-pair.slot].weakness,0);
  assert.ok(pair.now().logs.some(l=>l.text.includes('CRUSHING BLOW')));
  pair.cleanup();
});

test('Effect combo: Armour Break + Charged Attack shatters additional Defence',()=>{
  const pair=battlePair();
  readyEnergy(pair);
  assert.equal(pair.actor.send('effect',{effect:'armourbreak'}).ok,true);
  assert.equal(pair.opponent.send('defend').ok,false,'Armour Break blocks Defence moves on the next turn');
  assert.equal(pair.opponent.send('charge',{choice:'start'}).ok,true);
  chargedStrike(pair.actor);
  assert.equal(pair.now().players[1-pair.slot].armourBreak,0);
  assert.ok(pair.now().logs.some(l=>l.text.includes('SHATTERED ARMOUR')));
  pair.cleanup();
});
