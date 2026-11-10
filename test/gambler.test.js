'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../gambler-rules');
const Module=require('node:module'),originalLoad=Module._load;
const messages=[],sockets=new Map();
const fakeIo={engine:{clientsCount:0},sockets:{sockets},on(event,fn){if(event==='connection')this.connect=fn;},to(code){return {emit(type,payload){messages.push({code,type,payload});}};}};
function fakeExpress(){const app=()=>{};for(const name of ['disable','use','get'])app[name]=()=>app;return app;}fakeExpress.static=()=>()=>{};
Module._load=function(request,parent,isMain){if(request==='express')return fakeExpress;if(request==='socket.io')return {Server:class{constructor(){return fakeIo}}};if(request==='http')return {createServer:()=>({listen(){}})};return originalLoad.call(this,request,parent,isMain);};
try{require('../server');}finally{Module._load=originalLoad;}
let id=0;
function player(){const handlers={},socket={id:'gambler-'+(++id),data:{},on(n,fn){handlers[n]=fn;},join(){},leave(){},disconnect(){}};socket.send=(n,data={})=>{let ack;handlers[n](data,response=>ack=response);assert.ok(ack,'Missing ack for '+n);return ack;};sockets.set(socket.id,socket);fakeIo.connect(socket);return socket;}
function state(code){return messages.filter(m=>m.code===code&&m.type==='room-state').at(-1).payload;}
function duel(options={}){const host=player(),guest=player(),created=host.send('create-room');assert.equal(created.ok,true);assert.equal(guest.send('join-room',{code:created.code}).ok,true);if(options.infinite)assert.equal(host.send('room-options',{infiniteUltimates:true}).ok,true);for(const [s,n] of [[host,'One'],[guest,'Two']])assert.equal(s.send('player-setup',{name:n,hp:100,hpMode:'fixed',special:'gambler'}).ok,true);assert.equal(host.send('start-game').ok,true);const actor=state(created.code).current;return {host,guest,created,actor,active:[host,guest][actor],other:[host,guest][1-actor],get:()=>state(created.code)};}
function card(rank,suit){return {rank,suit};}
test('blackjack soft Ace totals and poker hands include wheel and royal flush',()=>{
 assert.deepEqual(rules.blackjackTotal([card(14,'♠'),card(14,'♥'),card(9,'♠')]),{total:21,soft:true});
 assert.equal(rules.natural([card(14,'♠'),card(13,'♠')]),true);
 assert.equal(rules.blackjackWinDamage([card(10,'♠'),card(10,'♥')]),9);
 const royal=rules.bestPoker([card(14,'♠'),card(13,'♠'),card(12,'♠'),card(11,'♠'),card(10,'♠'),card(2,'♦'),card(3,'♣')]);
 assert.equal(royal.name,'Royal Flush');assert.equal(royal.boost,10);
 const wheel=rules.bestPoker([card(14,'♠'),card(2,'♦'),card(3,'♣'),card(4,'♠'),card(5,'♥')]);assert.equal(wheel.name,'Straight');assert.equal(wheel.score[1],5);
 const high=rules.bestPoker([card(14,'♠'),card(11,'♦'),card(9,'♣'),card(6,'♠'),card(2,'♥')]);assert.equal(high.boost,10);
 assert.equal(rules.slotResult(['7️⃣','7️⃣','7️⃣']).sevens,true);
});
test('Blackjack Bash supports splits and dealer resolution, and hides hole card',()=>{
 const match=duel();const original=rules.freshDeck;
 rules.freshDeck=()=>[card(10,'♣'),card(10,'♦'),card(7,'♦'),card(10,'♠'),card(8,'♥'),card(8,'♠')];
 try{
  assert.equal(match.active.send('special',{move:'blackjack'}).ok,true);
  assert.equal(match.get().phase,'gamblerBlackjack');
  assert.deepEqual(match.get().gamblerGame.dealer[1],'🂠');
  assert.equal(match.other.send('gambler-blackjack',{action:'split'}).ok,false);
  assert.equal(match.active.send('gambler-blackjack',{action:'split'}).ok,true);
  assert.equal(match.get().gamblerGame.hands.length,2);
  assert.equal(match.active.send('gambler-blackjack',{action:'stand'}).ok,true);
  assert.equal(match.active.send('gambler-blackjack',{action:'stand'}).ok,true);
  assert.equal(match.get().gamblerGame,null);
  const dealerReveal=messages.filter(m=>m.code===match.created.code&&m.type==='gambler-blackjack-result').at(-1)?.payload;
  assert.ok(dealerReveal,'The final dealer hand should animate at the end');
  assert.equal(dealerReveal.dealer.length>=2,true);
  assert.equal(dealerReveal.hands.length,2,'Both split hands must appear in the reveal');
  assert.equal(match.get().players[match.actor].gamblerCooldowns.blackjack,1);
 }finally{rules.freshDeck=original;match.host.send('leave-room');}
});
test('Poker Table permits damage betting, never shares hole cards in room-state, and folds',()=>{
 const match=duel();assert.equal(match.active.send('special',{move:'poker'}).ok,true);
 const game=match.get().gamblerGame;
 assert.equal(game.type,'poker');assert.equal('hands' in game,false);assert.deepEqual(game.board,[]);
 const privateCards=messages.filter(m=>m.type==='gambler-private'&&m.payload.id===game.id);
 assert.ok(privateCards.length>=2,'both players are privately dealt cards');
 assert.equal(match.active.send('gambler-poker',{action:'bet',amount:6}).ok,true);
 assert.equal(match.other.send('gambler-poker',{action:'fold'}).ok,true);
 assert.equal(match.get().gamblerGame,null);
 const foldResult=messages.filter(m=>m.code===match.created.code&&m.type==='gambler-poker-result').at(-1)?.payload;
 assert.ok(foldResult,'Folding must trigger the end-of-hand animation');
 assert.equal(foldResult.folded,true);
 assert.deepEqual(foldResult.hands,[],'Folding must never expose either player private hole cards');
 assert.equal(match.get().players[1-match.actor].hp,94);
 assert.equal(match.get().players[match.actor].gamblerCooldowns.poker,2);
 match.host.send('leave-room');
});
test('Relentless Gambler takes five-turn slot route and JACKPOTT grants timed invincibility',()=>{
 const match=duel({infinite:true}),original=rules.spinSlots;
 rules.spinSlots=()=>['7️⃣','7️⃣','7️⃣'];
 try{
   assert.equal(match.active.send('ultimate').ok,true);
   assert.equal(match.get().players[match.actor].gamblerDomainCharge,5);
   assert.equal(match.other.send('defend').ok,true);
   assert.equal(match.get().phase,'gamblerSlot');
   assert.equal(match.other.send('gambler-slot').ok,false);
   assert.equal(match.active.send('gambler-slot').ok,true);
   const p=match.get().players[match.actor];
   assert.equal(p.jackpotTurns,5);assert.equal(p.momentum,25);
   assert.equal(match.get().domain.type,'jackpot');
   const reelEvent=messages.filter(m=>m.code===match.created.code&&m.type==='gambler-slot-spin').at(-1)?.payload;
   assert.ok(reelEvent,'Both players need an event to animate the same three reels');
   assert.deepEqual(reelEvent.symbols,['7️⃣','7️⃣','7️⃣']);
   assert.equal(reelEvent.jackpot,true);
   assert.equal(reelEvent.turns,5);
   assert.equal(match.other.send('defend').ok,true);
   assert.equal(match.active.send('special',{move:'jackpottt'}).ok,true);
   const after=match.get().players[match.actor];assert.equal(after.jackpotHealUsed,true);
   assert.equal(after.jackpotTurns,4);
 }finally{rules.spinSlots=original;match.host.send('leave-room');}
});
test('Double or Nothing flip chains are server-side and can be cashed out',()=>{
 const match=duel(),orig=rules.randomInt;
 rules.randomInt=()=>0;
 try{
  assert.equal(match.active.send('special',{move:'double'}).ok,true);
  assert.equal(match.other.send('defend').ok,true);
  assert.equal(match.active.send('gambler-coin',{action:'flip'}).ok,true);
  assert.equal(match.get().players[match.actor].coinMultiplier,1.5);
  assert.equal(match.active.send('gambler-coin',{action:'flip'}).ok,true);
  assert.equal(match.get().players[match.actor].coinMultiplier,2.25);
  assert.equal(match.active.send('gambler-coin',{action:'cashout'}).ok,true);
  assert.equal(match.get().players[match.actor].doubleMultiplier,2.25);
  assert.equal(match.active.send('gambler-coin',{action:'flip'}).ok,false);
 }finally{rules.randomInt=orig;match.host.send('leave-room');}
});
test('Poker Table honors asymmetric fold damage when the Gambler folds',()=>{
 const match=duel();
 assert.equal(match.active.send('special',{move:'poker'}).ok,true);
 assert.equal(match.active.send('gambler-poker',{action:'check'}).ok,true);
 assert.equal(match.other.send('gambler-poker',{action:'bet',amount:8}).ok,true);
 assert.equal(match.active.send('gambler-poker',{action:'fold'}).ok,true);
 assert.equal(match.get().players[match.actor].hp,96,'Gambler takes half the other player’s wager');
 match.host.send('leave-room');
});
test('Relentless Gambler expires after all five unsuccessful slot turns',()=>{
 const match=duel({infinite:true}),orig=rules.spinSlots,rand=rules.randomInt;
 rules.spinSlots=()=>['🍒','🔔','🍋'];rules.randomInt=()=>99;
 try{
  assert.equal(match.active.send('ultimate').ok,true);
  for(let i=0;i<5;i++){
    assert.equal(match.other.send('defend').ok,true);
    assert.equal(match.get().phase,'gamblerSlot');
    assert.equal(match.active.send('gambler-slot').ok,true);
  }
  assert.equal(match.get().players[match.actor].gamblerDomainCharge,0);
  assert.equal(match.get().players[match.actor].jackpotTurns,0);
  assert.notEqual(match.get().phase,'gamblerSlot');
 }finally{rules.spinSlots=orig;rules.randomInt=rand;match.host.send('leave-room');}
});

test('Texas Hold’em reveals both private hands only at showdown',()=>{
 const match=duel();
 try{
  assert.equal(match.active.send('special',{move:'poker'}).ok,true);
  for(let street=0;street<4;street++){
   assert.equal(match.active.send('gambler-poker',{action:'check'}).ok,true);
   assert.equal(match.other.send('gambler-poker',{action:'check'}).ok,true);
  }
  const final=messages.filter(m=>m.code===match.created.code&&m.type==='gambler-poker-result').at(-1)?.payload;
  assert.ok(final,'A completed showdown needs a result cinematic');
  assert.equal(final.folded,false);
  assert.equal(final.board.length,5);
  assert.deepEqual(final.hands.map(h=>h.length),[2,2]);
  assert.equal(match.get().gamblerGame,null);
 }finally{match.host.send('leave-room');}
});

test('Relentless Gambler refunds 100 Momentum after five failed spins and raises luck by 3% per miss',()=>{
 const match=duel({infinite:true}),spin=rules.spinSlots,rand=rules.randomInt;
 rules.spinSlots=()=>['🍒','🔔','🍋'];rules.randomInt=()=>99;
 try{
   assert.equal(match.active.send('ultimate').ok,true);
   for(let i=0;i<5;i++){
     assert.equal(match.other.send('defend').ok,true);
     assert.equal(match.active.send('gambler-slot').ok,true);
     assert.equal(match.get().players[match.actor].gamblerLuckBonus,(i+1)*3);
   }
   const p=match.get().players[match.actor];
   assert.equal(p.gamblerDomainCharge,0);
   assert.equal(p.momentum,100,'A fully failed Ultimate must refill Momentum');
   assert.equal(p.gamblerMisses,5);
 }finally{rules.spinSlots=spin;rules.randomInt=rand;match.host.send('leave-room');}
});

test('Accumulated Relentless Gambler luck produces server-generated jackpot and resets after success',()=>{
 const match=duel({infinite:true}),spin=rules.spinSlots,matchSpin=rules.spinSlotsWithMatch,rand=rules.randomInt;
 rules.spinSlots=()=>['🍒','🔔','🍋'];rules.spinSlotsWithMatch=()=>['💎','💎','💎'];rules.randomInt=()=>99;
 try{
   assert.equal(match.active.send('ultimate').ok,true);
   assert.equal(match.other.send('defend').ok,true);
   assert.equal(match.active.send('gambler-slot').ok,true);
   assert.equal(match.get().players[match.actor].gamblerLuckBonus,3);
   rules.randomInt=()=>0;
   assert.equal(match.other.send('defend').ok,true);
   assert.equal(match.active.send('gambler-slot').ok,true);
   const p=match.get().players[match.actor];
   assert.ok(p.jackpotTurns>0);
   assert.equal(p.gamblerMisses,0);
   assert.equal(p.gamblerLuckBonus,0);
   const ev=messages.filter(m=>m.code===match.created.code&&m.type==='gambler-slot-spin').at(-1).payload;
   assert.deepEqual(ev.symbols,['💎','💎','💎']);
 }finally{rules.spinSlots=spin;rules.spinSlotsWithMatch=matchSpin;rules.randomInt=rand;match.host.send('leave-room');}
});

test('Relentless Gambler clashes with a charging Domain and a clash win guarantees the next THREE 7s',async()=>{
 const host=player(),guest=player(),created=host.send('create-room');
 assert.equal(created.ok,true);assert.equal(guest.send('join-room',{code:created.code}).ok,true);
 assert.equal(host.send('room-options',{infiniteUltimates:true}).ok,true);
 assert.equal(host.send('player-setup',{name:'Gambler',hp:100,special:'gambler'}).ok,true);
 assert.equal(guest.send('player-setup',{name:'Blue',hp:100,special:'bluejudas'}).ok,true);
 assert.equal(host.send('start-game').ok,true);
 const get=()=>state(created.code),getP=()=>get().players[0];
 const origSpin=rules.spinSlots,origRand=rules.randomInt;
 rules.spinSlots=()=>['🍒','🔔','🍋'];rules.randomInt=()=>99;
 try{
   if(get().current===0)assert.equal(host.send('defend').ok,true);
   assert.equal(guest.send('special',{move:'sixeyes'}).ok,true);
   assert.equal(host.send('defend').ok,true);
   assert.equal(guest.send('special',{move:'domain'}).ok,true);
   assert.equal(host.send('ultimate').ok,true);
   for(let i=0;i<3;i++){
     // New Blue Judas charge costs 4 CE on each of three personal turns,
     // but does not restrict actions to Defence.
     assert.equal(get().phase,'turn');
     assert.equal(get().players[1].domainChargeProgress,i+1);
     assert.equal(guest.send('defend').ok,true);
     assert.equal(get().phase,'gamblerSlot');
     assert.equal(host.send('gambler-slot').ok,true);
   }
   // Blue activates on the following turn, so the existing Gambler charge clashes.
   assert.equal(get().phase,'domainClashCountdown');
   await new Promise(resolve=>setTimeout(resolve,3130));
   assert.equal(get().phase,'domainClash');
   let prompt=get().domainClash.currentPrompt[0];
   for(let i=0;i<8;i++){
     assert.ok([1,2,3,4].includes(prompt));
     const result=host.send('domain-clash-press',{number:prompt});
     assert.equal(result.ok,true,`clash press ${i+1}`);
     const next=messages.filter(m=>m.code===created.code&&m.type==='domain-clash-update').at(-1)?.payload;
     prompt=next.currentPrompt[0];
   }
   assert.equal(getP().gamblerGuaranteedSevens,true);
   assert.equal(get().phase,'gamblerSlot');
   assert.equal(host.send('gambler-slot').ok,true);
   const result=messages.filter(m=>m.code===created.code&&m.type==='gambler-slot-spin').at(-1).payload;
   assert.deepEqual(result.symbols,['7️⃣','7️⃣','7️⃣']);
   assert.equal(getP().gamblerGuaranteedSevens,false);
   assert.ok(getP().jackpotTurns>0);
 }finally{
   rules.spinSlots=origSpin;rules.randomInt=origRand;host.send('leave-room');
 }
});

test('Fortune Roulette is server-rolled, animates for both players, and a winning green zero grants JACKPOTT',async()=>{
 const match=duel(),previous=rules.randomInt;
 try{
  assert.equal(match.active.send('special',{move:'roulette'}).ok,true);
  assert.equal(match.get().phase,'gamblerRoulette');
  assert.equal(match.other.send('gambler-roulette',{kind:'straight',number:0}).ok,false);
  assert.equal(match.active.send('gambler-roulette',{kind:'madeup',number:0}).ok,false);
  rules.randomInt=()=>0; // first European roulette pocket is 0
  assert.equal(match.active.send('gambler-roulette',{kind:'straight',number:0}).ok,true);
  assert.equal(match.get().phase,'gamblerRouletteSpin');
  const ev=messages.filter(m=>m.code===match.created.code&&m.type==='gambler-roulette-spin').at(-1)?.payload;
  assert.ok(ev);assert.equal(ev.landed,0);assert.equal(ev.jackpot,true);assert.equal(ev.damage,30);
  await new Promise(resolve=>setTimeout(resolve,5270));
  const latest=match.get();
  assert.equal(latest.players[match.actor].jackpotTurns,4);
  assert.equal(latest.players[match.actor].gamblerCooldowns.roulette,1);
  assert.equal(latest.phase,'turn');
 }finally{rules.randomInt=previous;match.host.send('leave-room');}
});

test('Blue Judas has server-owned energy conversion, gravity skill and Six Eyes capacity boost',async()=>{
 const host=player(),guest=player(),created=host.send('create-room');
 assert.equal(created.ok,true);assert.equal(guest.send('join-room',{code:created.code}).ok,true);
 assert.equal(host.send('room-options',{infiniteUltimates:true}).ok,true);
 assert.equal(host.send('player-setup',{name:'Blue',hp:100,special:'bluejudas'}).ok,true);
 assert.equal(guest.send('player-setup',{name:'Other',hp:100,special:'redjudas'}).ok,true);
 assert.equal(host.send('start-game').ok,true);
 const get=()=>state(created.code);
 try{
  if(get().current!==0)assert.equal(guest.send('defend').ok,true);
  assert.equal(get().players[0].cursedEnergy,8);
  assert.equal(host.send('judas-convert').ok,true);
  assert.equal(get().players[0].cursedEnergy,5);
  assert.equal(get().players[0].positiveEnergy,1);
  assert.equal(host.send('special',{move:'blue'}).ok,true);
  assert.equal(get().phase,'judasMinigame');
  assert.equal(get().players[0].cursedEnergy,2);
  assert.equal(guest.send('judas-mini',{action:'drop',index:0}).ok,false);
  await new Promise(resolve=>setTimeout(resolve,960));
  for(let i=0;i<3;i++){
   assert.equal(host.send('judas-mini',{action:'drop',index:i}).ok,true);
   if(i<2)await new Promise(resolve=>setTimeout(resolve,255));
  }
  assert.equal(get().phase,'turn');
  assert.equal(get().players[0].blueCharges,1);
  assert.equal(get().players[1].pulled,1);
  assert.equal(guest.send('defend').ok,true);
  assert.equal(host.send('special',{move:'sixeyes'}).ok,true);
  assert.equal(get().players[0].cursedMax,20);
 }finally{host.send('leave-room');}
});

test('Six Eyes fast I.V. produces an opponent response and a server-authoritative clash',()=>{
 const host=player(),guest=player(),created=host.send('create-room');
 assert.equal(created.ok,true);assert.equal(guest.send('join-room',{code:created.code}).ok,true);
 assert.equal(host.send('room-options',{infiniteUltimates:true}).ok,true);
 for(const [s,n] of [[host,'Blue One'],[guest,'Blue Two']])assert.equal(s.send('player-setup',{name:n,hp:100,special:'bluejudas'}).ok,true);
 assert.equal(host.send('start-game').ok,true);
 const sockets=[host,guest],get=()=>state(created.code);
 const a=sockets[get().current],b=sockets[1-get().current];
 try{
  assert.equal(a.send('special',{move:'sixeyes'}).ok,true);
  assert.equal(b.send('special',{move:'sixeyes'}).ok,true);
  for(let i=0;i<2;i++){
   assert.equal(a.send('defend').ok,true);
   assert.equal(b.send('defend').ok,true);
  }
  assert.equal(get().players[0].sixEyesTurns>0,true);
  assert.equal(get().players[1].sixEyesTurns>0,true);
  const caster=get().current;
  assert.ok(get().players[caster].cursedEnergy>=15);
  const initiator=sockets[caster],defender=sockets[1-caster];
  assert.equal(initiator.send('special',{move:'domain',mode:'fast'}).ok,true);
  assert.equal(get().phase,'domainResponse');
  assert.equal(get().domainOffer.cost,15);
  assert.equal(initiator.send('domain-response',{choice:'clash'}).ok,false);
  assert.equal(defender.send('domain-response',{choice:'clash'}).ok,true);
  assert.equal(get().phase,'domainClashCountdown');
  assert.equal(get().domainOffer,null);
  assert.equal(get().players[1-caster].cursedEnergy>=0,true);
 }finally{host.send('leave-room');}
});

test('Infinity consumes CE and produces a halved-window three-attack timing defence',()=>{
 const host=player(),guest=player(),created=host.send('create-room');
 assert.equal(created.ok,true);assert.equal(guest.send('join-room',{code:created.code}).ok,true);
 assert.equal(host.send('player-setup',{name:'Blue',hp:100,special:'bluejudas'}).ok,true);
 assert.equal(guest.send('player-setup',{name:'Enemy',hp:100,special:'standard'}).ok,true);
 assert.equal(host.send('start-game').ok,true);
 const get=()=>state(created.code);
 try{
  if(get().current===1)assert.equal(guest.send('defend').ok,true);
  assert.equal(host.send('special',{move:'infinity'}).ok,true);
  assert.equal(get().players[0].infinityHits,3);
  assert.equal(get().players[0].cursedEnergy,1);
  const start=guest.send('attack-timing-start',{style:'normal'});
  assert.equal(start.ok,true);
  assert.equal(guest.send('attack-timing-resolve',{id:start.id,grades:['perfect']}).ok,true);
  assert.equal(get().phase,'parryResponse');
  assert.equal(get().parryPending.infinity,true);
  assert.equal(get().players[0].infinityHits,2);
  assert.ok(get().parryPending.difficulties[0].window>=10);
  assert.equal(host.send('parry-resolve',{id:get().parryPending.id,positions:[50]}).ok,true);
  assert.equal(get().players[0].hp,100);
  assert.equal(get().players[0].infinityHits,2);
 }finally{host.send('leave-room');}
});
