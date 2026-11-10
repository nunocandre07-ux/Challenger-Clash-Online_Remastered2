'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const fs=require('node:fs');
const path=require('node:path');
const filename=path.resolve(__dirname,'../server.js');
const original=Module._load;
let n=0;
const sockets=new Map();
const io={engine:{clientsCount:0},sockets:{sockets},on(k,cb){if(k==='connection')this.connect=cb;},to(){return{emit(){}}}};
function express(){const app=()=>{};for(const k of ['disable','use','get'])app[k]=()=>app;return app;}express.static=()=>()=>{};
Module._load=function(name,parent,main){if(name==='express')return express;if(name==='socket.io')return {Server:class{constructor(){return io;}}};if(name==='http')return {createServer:()=>({listen(){}})};return original.call(this,name,parent,main);};
let api;
try {const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports={rooms,startDanceBattle,buildDanceNotes,rhythmTargetTime,rhythmNoteHit,startFootworkMini,gloveMiniInput};',filename);api=m.exports;}finally{Module._load=original;}
function socket(){const handlers={},s={id:'rhythm'+(++n),data:{},on(k,f){handlers[k]=f},join(){},leave(){},disconnect(){}};s.send=(name,data={})=>{let reply;assert.ok(handlers[name],name);handlers[name](data,r=>reply=r);assert.ok(reply,name+' ack');return reply;};sockets.set(s.id,s);io.connect(s);return s;}
function duel(){const a=socket(),b=socket();const c=a.send('create-room');assert.ok(c.ok);assert.ok(b.send('join-room',{code:c.code}).ok);for(const [s,name] of [[a,'Rhythm'],[b,'Guest']])assert.ok(s.send('player-setup',{name,special:'glovedone',hpMode:'fixed',hp:100}).ok);assert.ok(a.send('start-game').ok);const room=api.rooms.get(c.code);const actor=room.current===0?a:b;return {room,actor,other:room.current===0?b:a,p:room.players[room.current]};}
test('Falling Dance Battle notes reach receptor at server hitAt (no early offset)',()=>{const note={hitAt:10000,travel:1200,window:170};assert.equal(api.rhythmTargetTime(note),10000);assert.equal(api.rhythmNoteHit(note,10000),true);assert.equal(api.rhythmNoteHit(note,9800),false);});
test('Two consecutive Dance Battle keys can be judged without extra turn delay',()=>{const d=duel();assert.ok(api.startDanceBattle(d.room,d.p.slot).ok);const db=d.room.danceBattle,slot=d.p.slot;db.notes[0].hitAt=Date.now();db.notes[1].hitAt=Date.now();let r=d.actor.send('dance-hit',{dir:db.notes[0].dir,index:0,clientTime:Date.now()});assert.equal(r.hit,true);r=d.actor.send('dance-hit',{dir:db.notes[1].dir,index:1,clientTime:Date.now()});assert.equal(r.hit,true);assert.equal(db.index[slot],2);});
test('Presses far too early do not punish a dancer',()=>{const d=duel();assert.ok(api.startDanceBattle(d.room,d.p.slot).ok);const db=d.room.danceBattle;db.notes[0].hitAt=Date.now()+950;const r=d.actor.send('dance-hit',{dir:db.notes[0].dir,index:0,clientTime:Date.now()});assert.equal(r.early,true);assert.equal(db.index[d.p.slot],0);assert.equal(db.misses[d.p.slot],0);});
test('Footwork has one full second of silent preparation before the memorization',()=>{const d=duel();assert.ok(api.startFootworkMini(d.room,d.p).ok);const g=d.room.footworkMini;assert.equal(g.preparationEndsAt-g.startedAt,1000);assert.equal(g.revealEndsAt-g.preparationEndsAt,3000);assert.equal(d.actor.send('november-mini',{tile:g.sequence[0]}).ok,false);});
test('Beat It accepts adjacent fast inputs once their hit times arrive',()=>{const d=duel();assert.ok(d.actor.send('special',{move:'beatit'}).ok);assert.ok(d.actor.send('glove-mini-input',{action:'ready'}).ok);const g=d.room.gloveMini;assert.equal(g.sequence.length,10);g.beatAt=Date.now();let r=d.actor.send('glove-mini-input',{action:'press',dir:g.sequence[0],index:0,clientTime:Date.now()});assert.equal(r.correct,true);g.beatAt=Date.now();r=d.actor.send('glove-mini-input',{action:'press',dir:g.sequence[1],index:1,clientTime:Date.now()});assert.equal(r.correct,true);assert.equal(g.hits,2);});
test('Live clocks, durable keys, and falling-note overlay remain bundled',()=>{const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');for(const token of ['renderGloveClock','requestAnimationFrame(renderGloveClock)','gloveLiveNote','footworkBanner','serverClockOffset','glovePress','dancePending','footwork-${session}'])assert.ok(html.includes(token),token);});
