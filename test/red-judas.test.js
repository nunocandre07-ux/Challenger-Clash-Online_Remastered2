'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module'),realLoad=Module._load;
const sockets=new Map(),messages=[];
const io={engine:{clientsCount:0},sockets:{sockets},on(event,fn){if(event==='connection')this.connect=fn},to(code){return {emit(type,payload){messages.push({code,type,payload})}}}};
function express(){const app=()=>{};for(const method of ['disable','use','get'])app[method]=()=>app;return app;}
express.static=()=>()=>{};
Module._load=function(req,parent,main){if(req==='express')return express;if(req==='socket.io')return {Server:class{constructor(){return io}}};if(req==='http')return {createServer:()=>({listen(){}})};return realLoad.call(this,req,parent,main)};
try{require('../server')}finally{Module._load=realLoad}
let next=0;
function socket(){const handlers={},sock={id:'redtest'+(++next),data:{},on(k,fn){handlers[k]=fn},join(){},leave(){},disconnect(){}};
 sock.send=(name,data={})=>{let a;handlers[name](data,r=>a=r);assert.ok(a,'ack '+name);return a};sockets.set(sock.id,sock);io.connect(sock);return sock;}
function duel(aSpecial='redjudas',bSpecial=aSpecial,options={}){
 const a=socket(),b=socket(),created=a.send('create-room');assert.equal(created.ok,true);assert.equal(b.send('join-room',{code:created.code}).ok,true);if(options.infinite)assert.equal(a.send('room-options',{infiniteUltimates:true}).ok,true);
 for(const [s,n,sp] of [[a,'Red',aSpecial],[b,'Opponent',bSpecial]])assert.equal(s.send('player-setup',{name:n,special:sp,hp:100,hpMode:'fixed'}).ok,true);
 assert.equal(a.send('start-game').ok,true);
 const get=()=>messages.filter(m=>m.code===created.code&&m.type==='room-state').at(-1)?.payload;
 const turn=get().current;return {a,b,actor:[a,b][turn],other:[a,b][1-turn],slot:turn,get,close:()=>a.send('leave-room')};
}
test('Red Judas Dismantle has a 3.5-second reveal, 4-second entry and 7 symbols',()=>{
 const d=duel();const r=d.actor.send('special',{move:'dismantle'});assert.equal(r.ok,true);
 const g=d.get().judasMini;assert.equal(g.kind,'dismantle');assert.equal(g.sequence.length,5);
 assert.ok(g.sequence.every(n=>n>=0&&n<7));assert.equal(g.revealEndsAt-g.startedAt,3500);assert.equal(g.deadline-g.revealEndsAt,4000);
 assert.equal(d.actor.send('judas-mini',{action:'submit',sequence:[0,0,0,0,0]}).ok,false,'cannot submit while symbols are revealed');
 const realNow=Date.now;Date.now=()=>g.revealEndsAt+250;
 try{assert.equal(d.actor.send('judas-mini',{action:'submit',sequence:[...g.sequence]}).ok,true);}finally{Date.now=realNow;}
 assert.equal(d.get().players[1-d.slot].scored,2,'five accurate glyphs apply Scored');
 assert.ok(d.get().players[1-d.slot].hp<=85,'five accurate glyphs deal 15 raw damage');
 d.close();
});
test('Cleave uses three server-timed hits and costs two positive energy',()=>{
 const d=duel();assert.equal(d.actor.send('judas-convert').ok,true);assert.equal(d.actor.send('judas-convert').ok,true);
 assert.equal(d.actor.send('special',{move:'cleave'}).ok,true);
 const g=d.get().judasMini;assert.equal(g.kind,'cleave');assert.equal(g.slashes.length,3);assert.ok(g.slashes[2]-g.slashes[1]>g.slashes[1]-g.slashes[0]);
 assert.equal(d.get().players[d.slot].positiveEnergy,0);
 const realNow=Date.now;try{for(const moment of g.slashes){Date.now=()=>moment;assert.equal(d.actor.send('judas-mini',{action:'slash'}).ok,true);}}finally{Date.now=realNow;}
 assert.equal(d.get().players[1-d.slot].bleed,1,'Bleed immediately ticks on the defender turn after three hits');
 d.close();
});
test('Fuga cannot activate without King of Curses',()=>{
 const d=duel();assert.equal(d.actor.send('special',{move:'fuga'}).ok,false);d.close();
});
test('Blue Judas RCT costs four PE and Infinity target window is halved',()=>{
 const d=duel('bluejudas');const p=d.get().players[d.slot];assert.equal(p.positiveEnergy,0);
 assert.equal(d.actor.send('special',{move:'rct'}).ok,false);
 d.close();
});
test('Red Judas Binding Vow is locked until King of Curses',()=>{
 const d=duel();assert.equal(d.actor.send('special',{move:'bindingvow'}).ok,false);d.close();
});

test('Fuga reveals five distinct flames, costs 10 CE and 2 PE, and applies doubled Burn',()=>{
 const d=duel('redjudas','redjudas',{infinite:true});
 assert.equal(d.actor.send('special',{move:'king'}).ok,true);
 assert.equal(d.other.send('defend').ok,true);
 // King raised the capacity to 20; this is the first replenishing turn.
 assert.equal(d.actor.send('judas-convert').ok,true);
 assert.equal(d.actor.send('judas-convert').ok,true);
 for(let n=0;n<3;n++){
   assert.equal(d.actor.send('defend').ok,true);
   assert.equal(d.other.send('defend').ok,true);
 }
 assert.ok(d.get().players[d.slot].cursedEnergy>=10);
 assert.ok(d.get().players[d.slot].positiveEnergy>=2);
 assert.equal(d.actor.send('special',{move:'fuga'}).ok,true);
 const g=d.get().judasMini;assert.equal(g.kind,'fuga');assert.equal(new Set(g.sequence).size,5);
 const realNow=Date.now;Date.now=()=>g.revealEndsAt+200;
 try{assert.equal(d.actor.send('judas-mini',{action:'submit',sequence:[...g.sequence]}).ok,true);}finally{Date.now=realNow;}
 assert.equal(d.get().players[1-d.slot].burnMultiplier,2);
 d.close();
});
test('Red Judas M.S. charges for 3 turns without locking normal moves and inflicts 5 + Bleed per victim turn',()=>{
 const d=duel('redjudas','redjudas',{infinite:true});
 assert.equal(d.actor.send('special',{move:'king'}).ok,true);
 assert.equal(d.other.send('defend').ok,true);
 assert.equal(d.actor.send('special',{move:'domain',mode:'charge'}).ok,true);
 for(let n=1;n<=3;n++){
   assert.equal(d.other.send('defend').ok,true);
   assert.equal(d.get().players[d.slot].domainChargeProgress,n,'progress automatically grows each personal turn');
   assert.equal(d.get().phase,'turn','normal moves are allowed during charging');
   assert.equal(d.actor.send('defend').ok,true);
 }
 assert.equal(d.other.send('defend').ok,true);
 assert.equal(d.get().domain.type,'ms');
 assert.equal(d.actor.send('defend').ok,true);
 assert.ok(d.get().players[1-d.slot].hp<=95,'M.S. deals damage and Bleed when victim turn begins');
 d.close();
});

test('Global Momentum grants are reduced 25%, except Great Exception gains 15% more',()=>{
 for(const [special,expected] of [['standard',5],['greatexception',8]]){
   const d=duel(special,special);
   assert.equal(d.actor.send('charge',{choice:'start'}).ok,true);
   assert.equal(d.get().players[d.slot].momentum,expected);
   d.close();
 }
});
