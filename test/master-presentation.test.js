'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),fs=require('node:fs'),path=require('node:path');
const filename=path.resolve(__dirname,'../server.js');
const oldLoad=Module._load;const sockets=new Map(),messages=[];let counter=0;
const io={engine:{clientsCount:0},sockets:{sockets},on(k,fn){if(k==='connection')this.connect=fn;},to(code){return{emit(type,payload){messages.push({code,type,payload});}}}};
function express(){const app=()=>{};for(const key of ['disable','use','get'])app[key]=()=>app;return app;}express.static=()=>()=>{};
Module._load=function(name,parent,main){if(name==='express')return express;if(name==='socket.io')return{Server:class{constructor(){return io;}}};if(name==='http')return{createServer:()=>({listen(){}})};return oldLoad.call(this,name,parent,main);};
let api;
try{const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports={rooms,mambaStrikeDamage,finishPresentationMini,battleButtonGuard,absorbAttack};',filename);api=m.exports;}finally{Module._load=oldLoad;}
function socket(){const handlers={};const s={id:'presentation-'+(++counter),data:{},on(k,h){handlers[k]=h},join(){},leave(){},disconnect(){}};s.send=(ev,data={})=>{assert.ok(handlers[ev],ev);let value;handlers[ev](data,r=>{value=r});assert.ok(value,`${ev} acknowledgment`);return value;};sockets.set(s.id,s);io.connect(s);return s;}
function duel(){const a=socket(),b=socket(),created=a.send('create-room');assert.ok(created.ok);const code=created.code;assert.ok(b.send('join-room',{code}).ok);for(const [s,n] of [[a,'Alex'],[b,'Blair']])assert.ok(s.send('player-setup',{name:n,special:'masterpresentation',hpMode:'fixed',hp:100}).ok);assert.ok(a.send('start-game').ok);const room=api.rooms.get(code),actor=room.current===0?a:b,other=room.current===0?b:a;return{room,actor,other,p:room.players[room.current],q:room.players[1-room.current],close(){a.send('leave-room');}};}
test('Black Mamba costs exactly 15 Momentum, grants 10–15 armor, and unlocks 5/10/13/17 strike zones',()=>{
  const d=duel();d.p.momentum=15;assert.equal(d.actor.send('special',{move:'blackmamba'}).ok,true);assert.equal(d.p.momentum,0);assert.ok(d.p.defence>=10&&d.p.defence<=15);assert.equal(d.p.mambaTurns,3);assert.equal(d.p.mambaDefenceRemaining,d.p.defence);
  assert.deepEqual([0,.27,.55,.83].map(api.mambaStrikeDamage),[5,10,13,17]);
  assert.equal(d.other.send('defend').ok,true);assert.equal(d.actor.send('special',{move:'targetingsystems'}).ok,true);
  const g=d.room.presentationMini;assert.equal(g.deadline-g.startedAt,3000);assert.equal(d.room.phase,'presentationMini');assert.equal(g.targets.length,24);
  // Only the current target can be claimed, and the server owns the target positions.
  const now=Date.now;Date.now=()=>g.startedAt+200;
  try{assert.equal(d.actor.send('presentation-hit',{index:4}).ok,false);assert.equal(d.actor.send('presentation-hit',{index:0}).ok,true);}finally{Date.now=now;}
  assert.equal(g.hits,1);
  api.finishPresentationMini(d.room);assert.equal(d.room.phase,'turn');assert.equal(d.q.hp<100,true);
  d.close();
});
test('Spider Bot costs 10 Momentum, adds Defence, validates turret shooting, and Groovin seals buttons',()=>{
  const d=duel();d.p.momentum=10;assert.equal(d.actor.send('special',{move:'spiderbot'}).ok,true);assert.equal(d.p.momentum,0);assert.equal(d.p.spiderTurns,3);assert.equal(d.p.spiderDodgeReady,true);assert.equal(d.p.defence,5);
  assert.equal(d.other.send('defend').ok,true);
  assert.equal(d.actor.send('special',{move:'electricityturret'}).ok,true);
  const g=d.room.presentationMini;assert.equal(g.targets.length,15);assert.equal(d.actor.send('presentation-shoot').ok,false); // pre-start shot
  const realNow=Date.now;Date.now=()=>g.startedAt+600;
  try{
    assert.equal(d.actor.send('presentation-ship',{x:120,y:88}).ok,false);
    g.shipX=g.targets[0].x;
    assert.equal(d.actor.send('presentation-shoot').ok,true);assert.equal(g.hits,1);
    assert.equal(d.actor.send('presentation-shoot').ok,false);
  }finally{Date.now=realNow;}
  api.finishPresentationMini(d.room);
  assert.equal(d.other.send('defend').ok,true);
  assert.equal(d.actor.send('special',{move:'musicspeakers'}).ok,true);
  assert.equal(d.q.groovinTurns,3);assert.ok(d.q.groovinBlocked);assert.match(api.battleButtonGuard(d.q,d.q.groovinBlocked),/Groovin/);
  assert.match(api.battleButtonGuard(d.q,d.q.groovinBlocked),/Groovin/); // blocked even if an eligible move is attempted
  d.close();
});
test('Spider Bot dodge is consumed by the next incoming damaging attack',()=>{
  const d=duel();d.q.spiderDodgeReady=true;
  api.absorbAttack(d.room,d.q,10,d.p);assert.equal(d.q.spiderDodgeReady,false);
  d.close();
});
