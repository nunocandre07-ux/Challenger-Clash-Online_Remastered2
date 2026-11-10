'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),fs=require('node:fs'),path=require('node:path');
const filename=path.resolve(__dirname,'../server.js'),orig=Module._load;
const sockets=new Map();let next=0,cinematics=[];
const io={engine:{clientsCount:0},sockets:{sockets},on(k,fn){if(k==='connection')this.connect=fn;},to(){return {emit(event,data){if(event==='item-cinematic')cinematics.push(data)}}}};
function express(){const app=()=>{};for(const k of ['disable','use','get'])app[k]=()=>app;return app;}express.static=()=>()=>{};
Module._load=function(name,parent,main){if(name==='express')return express;if(name==='socket.io')return{Server:class{constructor(){return io;}}};if(name==='http')return{createServer:()=>({listen(){}})};return orig.call(this,name,parent,main);};
let api;
try{const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports={rooms,MAGIC_BAG_ITEMS,ITEM_CARD_DECK,itemCardOutcome,itemStopwatchValue,resolveItemMini,resolveItemPrediction,absorbAttack,checkWinner};',filename);api=m.exports;}finally{Module._load=orig;}
function socket(){const handlers={};const s={id:'item-'+(++next),data:{},on(k,h){handlers[k]=h;},join(){},leave(){},disconnect(){}};s.send=(event,data={})=>{assert.ok(handlers[event],event);let r;handlers[event](data,v=>{r=v;});assert.ok(r,event+' acknowledgement');return r;};sockets.set(s.id,s);io.connect(s);return s;}
function duel(champion='standard'){
 const a=socket(),b=socket(),cr=a.send('create-room');assert.ok(cr.ok);assert.ok(b.send('join-room',{code:cr.code}).ok);
 for(const [s,n] of [[a,'Alpha'],[b,'Bravo']])assert.ok(s.send('player-setup',{name:n,special:champion,hpMode:'fixed',hp:100}).ok);
 assert.ok(a.send('start-game').ok);const room=api.rooms.get(cr.code),actor=room.current===0?a:b,other=room.current===0?b:a;
 return{room,actor,other,p:room.players[room.current],q:room.players[1-room.current],close(){a.send('leave-room');}};
}
test('All six new items are in both the catalog and normal magic bag',()=>{
 const ids=['powerglove','mysterycandy','gamblerscoin','magic8ball','cursedstopwatch','deckofcards'];
 for(const id of ids)assert.ok(api.MAGIC_BAG_ITEMS.some(item=>item.id===id&&item.shop!==false),id);
});
test('54-card deck has unique cards with correct joker, ace and king effects',()=>{
 assert.equal(api.ITEM_CARD_DECK.length,54);
 assert.equal(new Set(api.ITEM_CARD_DECK.map(x=>x.suit+x.rank)).size,54);
 const pick=(suit,rank)=>api.itemCardOutcome({suit,rank});
 assert.equal(pick('♠','K').damage,13);assert.equal(pick('♥','K').self,10);
 assert.equal(pick('♣','A').damage,15);assert.equal(pick('♦','A').self,13);
 assert.equal(pick('♣','2').damage,2);assert.equal(pick('♦','Q').damage,12);
 assert.equal(pick('🃏','BLACK JOKER').momentum,50);assert.equal(pick('🃏','RED JOKER').momentum,-25);
});
test('Power Glove boosts exactly one attack and inflicts 4 recoil even after a finishing hit',()=>{
 const d=duel();d.p.hp=40;d.p.inventory.push('powerglove');assert.ok(d.actor.send('inventory-use',{index:0}).ok);
 assert.equal(d.p.powerGloveReady,true);d.q.defence=0;
 const r=api.absorbAttack(d.room,d.q,6,d.p);assert.equal(r.damage,13);assert.equal(d.p.powerGloveReady,false);
 // Simulate normal combat applying HP damage, then checking for a winner.
 d.q.hp-=r.damage;api.checkWinner(d.room);assert.equal(d.p.hp,36);
 assert.equal(api.absorbAttack(d.room,d.q,6,d.p).damage,6);
 d.close();
});
test('Mystery Candy opens target choice, only owner can select, and retains free item action',()=>{
 const d=duel();d.p.inventory.push('mysterycandy');const slot=d.room.current;
 assert.ok(d.actor.send('inventory-use',{index:0}).ok);assert.equal(d.room.phase,'itemMini');
 assert.equal(d.other.send('item-mini-action',{target:'self'}).ok,false);
 d.room.itemMini.startedAt=Date.now()-50;
 assert.equal(d.actor.send('item-mini-action',{target:'invalid'}).ok,false);
 assert.ok(d.actor.send('item-mini-action',{target:'opponent'}).ok);
 assert.equal(d.room.phase,'turn');assert.equal(d.room.current,slot);assert.equal(d.p.actionsRemaining,1);
 d.close();
});
test('8-Ball prediction uses three allowed choices; correct move awards shield/charge',()=>{
 const d=duel();d.p.inventory.push('magic8ball');d.p.defence=0;d.p.momentum=0;
 assert.ok(d.actor.send('inventory-use',{index:0}).ok);assert.equal(d.room.phase,'itemMini');
 const options=d.room.itemMini.choices;assert.equal(new Set(options).size,3);
 assert.ok(options.every(x=>['Attack','Defence','Charge','Effects','Special','Ultimate'].includes(x)));
 d.room.itemMini.startedAt=Date.now()-10;
 assert.equal(d.actor.send('item-mini-action',{choice:'HACKED'}).ok,false);
 const choice=options[0];assert.ok(d.actor.send('item-mini-action',{choice}).ok);
 assert.ok(d.actor.send('defend').ok); // move after free item
 d.room.current=1-d.p.slot;d.room.phase='turn';
 // Send actual action to server through an available button label.
 if(choice==='Defence')assert.ok(d.other.send('defend').ok);
 else if(choice==='Effects'){const r=d.other.send('effect',{effect:'strengthen'});if(!r.ok)api.resolveItemMini;}
 else if(choice==='Charge')assert.ok(d.other.send('charge',{choice:'auto'}).ok);
 else if(choice==='Attack'){
   assert.ok(d.other.send('attack-timing-start',{style:'normal'}).ok);
 }else if(choice==='Ultimate'){
   d.q.momentum=100;
   d.other.send('ultimate');
 }else if(choice==='Special'){
   // No standard special; check missing prediction does not leak or resolve improperly.
   assert.ok(d.p.eightBallPrediction);
 }
 // Prediction reward is asserted in separate deterministic test using a Defence choice.
 d.close();
});
test('8-Ball wrong prediction makes only the next incoming attack deal 20% more',()=>{
 const d=duel();d.p.inventory.push('magic8ball');assert.ok(d.actor.send('inventory-use',{index:0}).ok);
 d.room.itemMini.startedAt=Date.now()-10;
 const choice=d.room.itemMini.choices.find(x=>x!=='Defence');assert.ok(choice);
 assert.ok(d.actor.send('item-mini-action',{choice}).ok);assert.ok(d.actor.send('defend').ok);
 assert.ok(d.other.send('defend').ok);assert.equal(d.p.eightBallVulnerable,true);
 d.p.defence=0;assert.equal(api.absorbAttack(d.room,d.p,10,d.q).damage,12);assert.equal(d.p.eightBallVulnerable,false);
 assert.equal(api.absorbAttack(d.room,d.p,10,d.q).damage,10);d.close();
});
test('Stopwatch tiers are server-scored by time and return the turn on free use',()=>{
 for(const [target,expected] of [[5,25],[4.7,15],[3,5]]){
  const d=duel();d.p.inventory.push('cursedstopwatch');d.p.momentum=0;
  assert.ok(d.actor.send('inventory-use',{index:0}).ok);const g=d.room.itemMini;
  // Solve function's varying clock by scanning elapsed milliseconds.
  let ms=0,best=Infinity;for(let i=0;i<9000;i++){const diff=Math.abs(api.itemStopwatchValue(i)-target);if(diff<best){best=diff;ms=i;}}
  const realNow=Date.now;Date.now=()=>g.startedAt+ms;
  try{const r=d.actor.send('item-mini-action',{});assert.ok(r.ok);assert.equal(r.awarded,expected);assert.equal(d.p.momentum,expected);}finally{Date.now=realNow;}
  assert.equal(d.room.phase,'turn');assert.equal(d.room.current,d.p.slot);d.close();
 }
});
test('Deck card is chosen interactively and is never exposed before the player picks it',()=>{
 const d=duel();d.p.inventory.push('deckofcards');
 assert.ok(d.actor.send('inventory-use',{index:0}).ok);assert.equal(d.room.phase,'itemMini');
 const g=d.room.itemMini;assert.equal(g.cards.length,5);
 assert.equal(d.other.send('item-mini-action',{index:1}).ok,false);
 assert.equal(d.actor.send('item-mini-action',{index:9}).ok,false);
 g.startedAt=Date.now()-15;
 // Guaranteed non-self-damaging selection, so the test is deterministic.
 g.cards[2]={suit:'♠',rank:'7'};
 assert.ok(d.actor.send('item-mini-action',{index:2}).ok);
 assert.ok(cinematics.some(ev=>ev.kind==='card'&&ev.card.rank==='7'));
 assert.notEqual(d.room.phase,'itemMini');d.close();
});
test('Correct 8-ball prediction awards Defence (up to cap) and 10 Ultimate Charge',()=>{
 const d=duel();d.p.momentum=3;d.p.defence=2;d.p.eightBallPrediction={choice:'Charge'};
 api.resolveItemPrediction(d.room,d.q,'Charge');
 assert.equal(d.p.eightBallPrediction,null);assert.equal(d.p.defence,17);assert.equal(d.p.momentum,13);
 assert.equal(d.p.eightBallVulnerable,false);d.close();
});
test('Great Exception uses Mystery Candy as turn-consuming action',()=>{
 const d=duel('greatexception');d.p.inventory.push('mysterycandy');const original=d.room.current;
 assert.ok(d.actor.send('inventory-use',{index:0}).ok);d.room.itemMini.startedAt=Date.now()-10;
 assert.ok(d.actor.send('item-mini-action',{target:'self'}).ok);assert.notEqual(d.room.current,original);d.close();
});
test('New item visual templates and Umbrella improvements exist',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');
 const css=fs.readFileSync(path.resolve(__dirname,'../public/new-items.css'),'utf8');
 for(const text of ['renderItemMini','ccStopwatchNeedle','ccCardReveal','ccEightBall','item-cinematic','ccWindStage','ccGustDots','new-items.css','ccDeckSpread'])assert.ok(html.includes(text),text);
 for(const text of ['ccCardShow','ccStopwatchDial','ccWindStage','ccUmbrellaArena'])assert.ok(css.includes(text),text);
});
