'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),fs=require('node:fs'),path=require('node:path');
const filename=path.resolve(__dirname,'../server.js'),orig=Module._load;
const sockets=new Map(),io={engine:{clientsCount:0},sockets:{sockets},on(k,fn){if(k==='connection')this.connect=fn},to(){return {emit(){}}}};let sequence=0;
function express(){const a=()=>{};for(const k of ['disable','use','get'])a[k]=()=>a;return a}express.static=()=>()=>{};
Module._load=function(k,parent,main){if(k==='express')return express;if(k==='socket.io')return{Server:class{constructor(){return io}}};if(k==='http')return{createServer:()=>({listen(){}})};return orig.call(this,k,parent,main)};
let api;try{const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports={rooms,absorbAttack,gloveHypeDamageBonus,finishBeatIt,finishGloveMini,finishDanceBattle};',filename);api=m.exports;}finally{Module._load=orig}
function socket(){const handlers={},s={id:'hype-'+(++sequence),data:{},on(k,fn){handlers[k]=fn},join(){},leave(){},disconnect(){}};s.send=(ev,data={})=>{let r;assert.ok(handlers[ev],ev);handlers[ev](data,out=>r=out);assert.ok(r,ev+' missing ack');return r};sockets.set(s.id,s);io.connect(s);return s}
function duel(aSpecial='glovedone',bSpecial='standard'){
 const a=socket(),b=socket(),created=a.send('create-room');assert.ok(created.ok);assert.ok(b.send('join-room',{code:created.code}).ok);
 for(const [s,ch,name] of [[a,aSpecial,'Dancer'],[b,bSpecial,'Opponent']])assert.ok(s.send('player-setup',{name,special:ch,hpMode:'fixed',hp:100}).ok);
 assert.ok(a.send('start-game').ok);const room=api.rooms.get(created.code),active=room.current===0?a:b,passive=room.current===0?b:a;
 room.players[room.current].special=aSpecial;room.players[1-room.current].special=bSpecial;
 return {a,b,room,active,passive,p:room.players[room.current],q:room.players[1-room.current],close(){a.send('leave-room')}};
}
test('Crowd Hype attack tier thresholds apply to all attacks exactly once',()=>{
 for(const [h,bonus] of [[0,-2],[24,-2],[25,-1],[49,-1],[50,1],[74,1],[75,2],[99,2],[100,3]]){
  assert.equal(api.gloveHypeDamageBonus(h),bonus,`hype ${h}`);
  const d=duel();d.p.gloveHype=h;d.p.momentum=h;d.q.defence=0;
  const r=api.absorbAttack(d.room,d.q,10,d.p,{normalAttack:false});assert.equal(r.damage,10+bonus,`hype ${h} must modify damage once`);d.close();
 }
 const normal=duel('standard');normal.q.defence=0;assert.equal(api.absorbAttack(normal.room,normal.q,10,normal.p).damage,10,'other characters unchanged');normal.close();
});
test('Boooo available only versus Gloved One at 50+ Hype, drains 25, 2-turn cooldown',()=>{
 const d=duel('standard','glovedone');d.q.gloveHype=49;d.q.momentum=49;
 assert.equal(d.active.send('effect',{effect:'boooo'}).ok,false,'cannot heckle under 50');
 d.q.gloveHype=75;d.q.momentum=75;assert.ok(d.active.send('effect',{effect:'boooo'}).ok);
 assert.equal(d.q.gloveHype,50);assert.equal(d.q.momentum,50);assert.equal(d.p.booooCooldown,2,'current turn ticked');
 assert.ok(d.passive.send('defend').ok);assert.equal(d.active.send('effect',{effect:'boooo'}).ok,false,'still recovering');
 assert.ok(d.active.send('defend').ok);assert.ok(d.passive.send('defend').ok);assert.equal(d.p.booooCooldown,1);
 assert.ok(d.active.send('defend').ok);assert.ok(d.passive.send('defend').ok);assert.equal(d.p.booooCooldown,0);
 assert.ok(d.active.send('effect',{effect:'boooo'}).ok);assert.equal(d.q.gloveHype,25);d.close();
});
test('Moonwalk input has 1-second window and a 2-turn cooldown',()=>{
 const d=duel();assert.ok(d.active.send('special',{move:'moonwalk'}).ok);const g=d.room.gloveMini;
 assert.equal(d.p.gloveMiniCooldowns.moon,3);assert.ok(d.active.send('glove-mini-input',{action:'ready'}).ok);
 g.beatAt=Date.now()-1100;
 assert.equal(d.active.send('glove-mini-input',{action:'press',dir:(g.sequence[0]+2)%4,index:0}).ok,false);
 g.beatAt=Date.now()-5;assert.equal(d.active.send('glove-mini-input',{action:'press',dir:(g.sequence[0]+2)%4,index:0}).correct,true);
 api.finishGloveMini(d.room);assert.equal(d.p.gloveMiniCooldowns.moon,2);d.close();
});
test('Smooth Criminal cooldown is 3 turns and renders natively',()=>{
 const d=duel();assert.ok(d.active.send('special',{move:'smooth'}).ok);assert.equal(d.p.gloveMiniCooldowns.smooth,4);
 assert.ok(d.active.send('glove-mini-input',{action:'ready'}).ok);const g=d.room.gloveMini;g.smooth.fell=true;api.finishGloveMini(d.room);
 assert.equal(d.p.gloveMiniCooldowns.smooth,3);d.close();
 const html=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');const css=fs.readFileSync(path.resolve(__dirname,'../public/arena.css'),'utf8');
 for(const marker of ['gloveSmoothNative','smoothDial','smoothNeedle','smoothArcsAndTicks','smoothLeft','smoothRight','CCSmoothPhysics.step'])assert.ok(html.includes(marker),marker);
 assert.ok(!html.includes('gloveSmoothFrame'),'no iframe inside battle minigame');assert.ok(css.includes('.gloveSmoothNative'));
});
test('Pitching the Voice perfect does 2 less damage, has 3-turn cooldown',()=>{
 const d=duel();assert.ok(d.active.send('special',{move:'pitch'}).ok);assert.equal(d.p.beatItCooldown,4);
 d.room.beatIt.hits=5;d.room.beatIt.index=5;api.finishBeatIt(d.room);
 assert.ok(d.room.logs.some(entry=>String(entry.text||entry.message||entry).includes('11 raw damage')),'5 correct letters should yield 11 raw rather than previous 13');
 assert.equal(d.p.beatItCooldown,3);d.close();
});
test('The Kid Is Not My Son has a 4-turn cooldown',()=>{
 const d=duel();assert.ok(d.active.send('special',{move:'kid'}).ok);assert.equal(d.p.gloveKidCooldown,4);
 assert.ok(d.passive.send('defend').ok);assert.equal(d.active.send('special',{move:'kid'}).ok,false);
 d.close();
});

test('Dance Battle uses the Hype modifier on outgoing damage without buffing self-damage',()=>{
 const d=duel();d.p.gloveHype=100;d.p.momentum=100;
 d.room.danceBattle={initiator:d.p.slot};
 api.finishDanceBattle(d.room,d.q.slot);
 assert.ok(d.q.hp<=96&&d.q.hp>=92,`Hype 100 should turn the 1–5 dance damage into 4–8, got ${100-d.q.hp}`);
 d.close();
});
