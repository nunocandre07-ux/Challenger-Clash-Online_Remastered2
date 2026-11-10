'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const fs=require('node:fs');
const path=require('node:path');
const filename=path.resolve(__dirname,'../server.js');
const orig=Module._load;
const sockets=new Map();let next=0;
const io={engine:{clientsCount:0},sockets:{sockets},on(k,fn){if(k==='connection')this.connect=fn;},to(){return {emit(){}}}};
function express(){const app=()=>{};for(const k of ['disable','use','get'])app[k]=()=>app;return app;}express.static=()=>()=>{};
Module._load=function(name,parent,main){if(name==='express')return express;if(name==='socket.io')return{Server:class{constructor(){return io;}}};if(name==='http')return{createServer:()=>({listen(){}})};return orig.call(this,name,parent,main);};
let api;
try{const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports={rooms,finishPresentationMini,resolveAnvilTiming,gloveMiniInput};',filename);api=m.exports;}finally{Module._load=orig;}
function socket(){const handlers={};const s={id:'nov3-'+(++next),data:{},on(k,h){handlers[k]=h;},join(){},leave(){},disconnect(){}};s.send=(event,data={})=>{assert.ok(handlers[event],event);let r;handlers[event](data,v=>{r=v;});assert.ok(r,event+' acknowledgement');return r;};sockets.set(s.id,s);io.connect(s);return s;}
function duel(champion='standard'){
 const a=socket(),b=socket(),cr=a.send('create-room');assert.ok(cr.ok);assert.ok(b.send('join-room',{code:cr.code}).ok);
 for(const [s,n] of [[a,'Alpha'],[b,'Bravo']])assert.ok(s.send('player-setup',{name:n,special:champion,hpMode:'fixed',hp:100}).ok);
 assert.ok(a.send('start-game').ok);const room=api.rooms.get(cr.code),actor=room.current===0?a:b,other=room.current===0?b:a;
 return{room,actor,other,p:room.players[room.current],q:room.players[1-room.current],close(){a.send('leave-room');}};
}
test('Moonwalk immediately advances to the next arrow after a correct opposite-direction input',()=>{
 const d=duel('glovedone');assert.ok(d.actor.send('special',{move:'moonwalk'}).ok);assert.ok(d.actor.send('glove-mini-input',{action:'ready'}).ok);
 const g=d.room.gloveMini;g.beatAt=Date.now()-25;
 const r=d.actor.send('glove-mini-input',{action:'press',dir:(g.sequence[0]+2)%4,index:0,clientTime:Date.now()});
 assert.equal(r.correct,true);assert.equal(g.index,1);assert.ok(Math.abs(g.beatAt-Date.now())<150, 'next prompt should not wait 350ms');
 const second=d.actor.send('glove-mini-input',{action:'press',dir:(g.sequence[1]+2)%4,index:1,clientTime:Date.now()});
 assert.equal(second.correct,true);assert.equal(g.hits,2);d.close();
});
test('Stored items are free for other champions, including repeated uses on the same turn',()=>{
 const d=duel();d.p.hp=50;d.p.inventory.push('cupcake','lollipop');const current=d.room.current;
 assert.ok(d.actor.send('inventory-use',{index:0}).ok);assert.equal(d.p.hp,55);assert.equal(d.room.current,current);assert.equal(d.p.actionsRemaining,1);
 assert.ok(d.actor.send('inventory-use',{index:0}).ok);assert.equal(d.p.hp,57);assert.equal(d.room.current,current);assert.equal(d.p.actionsRemaining,1);
 // Still allowed to take normal move afterward.
 assert.ok(d.actor.send('defend').ok);assert.notEqual(d.room.current,current);d.close();
});
test('The Great Exception still spends their turn on a stored item',()=>{
 const d=duel('greatexception');d.p.inventory.push('cupcake');const first=d.room.current;
 assert.ok(d.actor.send('inventory-use',{index:0}).ok);assert.notEqual(d.room.current,first);d.close();
});
test('Free Anvil uses resume the original turn after the timed minigame resolves',()=>{
 const d=duel();d.p.inventory.push('anvil');const current=d.room.current;
 assert.ok(d.actor.send('inventory-use',{index:0}).ok);assert.equal(d.room.phase,'anvilTiming');
 const g=d.room.anvilTiming;api.resolveAnvilTiming(d.room,g.id,'good');
 assert.equal(d.room.current,current);assert.equal(d.room.phase,'turn');assert.equal(d.p.actionsRemaining,1);d.close();
});
test('Electricity Turret runs 8.5s with 15 bullets and narrow hitboxes',()=>{
 const d=duel('masterpresentation');d.p.momentum=10;assert.ok(d.actor.send('special',{move:'spiderbot'}).ok);
 assert.ok(d.other.send('defend').ok);assert.ok(d.actor.send('special',{move:'electricityturret'}).ok);
 const g=d.room.presentationMini;assert.equal(g.deadline-g.startedAt,8500);assert.equal(g.targets.length,15);
 let clock=Date.now;Date.now=()=>g.startedAt+300;
 try{
  // Narrow hitbox: 7 percent apart misses, despite previous 9-percent tolerance.
  g.shipX=g.targets[0].x+7;let r=d.actor.send('presentation-shoot');assert.ok(r.ok);assert.equal(r.hit,false);assert.equal(g.shotsFired,1);
  // Moving within ±4% of an invader hits; a valid hit still costs ammo.
  g.shipX=g.targets[0].x+3;g.lastHitAt=0;let closeShot=d.actor.send('presentation-shoot');assert.ok(closeShot.ok);assert.equal(closeShot.hit,true);assert.equal(g.hits,1);
  // All valid shots consume one bullet, including misses.
  for(let i=2;i<15;i++){g.lastHitAt=0;let next=d.actor.send('presentation-shoot');assert.ok(next.ok);}
  assert.equal(g.shotsFired,15);g.lastHitAt=0;
  assert.equal(d.room.presentationMini,null,'round should finish when the magazine runs dry');
  assert.equal(d.actor.send('presentation-shoot').ok,false);
  assert.equal(g.hits,1);
 }finally{Date.now=clock;}
 d.close();
});
test('Turret bullet indicator and free-item explanation are present in the UI',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');
 for(const token of ['presLocalShots','15-Math.max(g.shotsFired||0,presLocalShots)','only 15 bullets!','free actions for everyone except The Great Exception'])assert.ok(html.includes(token),token);
});
