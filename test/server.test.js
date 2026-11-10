'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const { io } = require('socket.io-client');

let child, port, origin;
const clients = new Set();
async function freePort(){
  return new Promise((resolve,reject)=>{
    const server=net.createServer();
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p));});
  });
}
async function connected(){
  const socket=io(origin,{transports:['websocket'],reconnection:false,timeout:2000,forceNew:true});
  clients.add(socket);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Socket connect timed out')),3500);
    socket.once('connect',()=>{clearTimeout(timer);resolve();});
    socket.once('connect_error',e=>{clearTimeout(timer);reject(e);});
  });
  return socket;
}
function emit(socket,event,data={}){
  return new Promise((resolve,reject)=>socket.timeout(2300).emit(event,data,(error,response)=>error?reject(error):resolve(response)));
}
before(async()=>{
  port=await freePort();origin=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.js'],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,PORT:String(port),MAX_ACTIVE_ROOMS:'10'},stdio:['ignore','pipe','pipe']});
  let errors='';child.stderr.on('data',buf=>errors+=buf.toString());
  let started=false;
  for(let i=0;i<50;i++){
    if(child.exitCode!==null)throw new Error('Server exited before healthcheck: '+errors);
    try{const r=await fetch(origin+'/health');if(r.ok){started=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,70));
  }
  if(!started)throw new Error('Server did not start: '+errors);
});
after(()=>{for(const c of clients)c.disconnect();if(child)child.kill();});

test('health check and security headers are available',async()=>{
  const r=await fetch(origin+'/health');const body=await r.json();
  assert.equal(body.ok,true);assert.equal(typeof body.rooms,'number');
  assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  assert.equal(r.headers.get('x-frame-options'),'DENY');
  const page=await fetch(origin+'/');assert.equal(page.status,200);
  assert.match(await page.text(),/CHALLENGER CLASH/);
  const styles=await fetch(origin+'/arena.css');assert.equal(styles.status,200);
});

test('two-player online lifecycle, validation, rate limit and surrender',async()=>{
  const host=await connected();const guest=await connected();
  const created=await emit(host,'create-room');
  assert.equal(created.ok,true);assert.match(created.code,/^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(created.slot,0);assert.ok(created.token);
  const duplicate=await emit(host,'create-room');assert.equal(duplicate.ok,false);
  const joined=await emit(guest,'join-room',{code:created.code});
  assert.equal(joined.ok,true);assert.equal(joined.slot,1);
  assert.equal((await emit(guest,'join-room',{code:created.code})).ok,false);
  assert.equal((await emit(guest,'start-game')).ok,false);
  assert.equal((await emit(host,'start-game')).ok,false);
  const h=await emit(host,'player-setup',{name:'Test Alpha',hp:75,hpMode:'fixed',special:'standard'});
  const g=await emit(guest,'player-setup',{name:'Test Beta',hp:80,hpMode:'fixed',special:'berserker'});
  assert.equal(h.ok,true);assert.equal(g.ok,true);
  assert.equal((await emit(host,'start-game')).ok,true);
  assert.equal((await emit(guest,'claim-victory')).ok,false);
  assert.equal((await emit(host,'chat',{text:'Hello arena!'})).ok,true);
  assert.equal((await emit(host,'chat',{text:'spam'})).ok,false);
  assert.equal((await emit(guest,'surrender')).ok,true);
  assert.equal((await emit(host,'surrender')).ok,false);
  assert.equal((await emit(host,'rematch')).ok,true);
  assert.equal((await emit(host,'end-battle')).ok,true);
  assert.equal((await emit(host,'return-lobby')).ok,true);
  assert.equal((await emit(guest,'leave-room')).ok,true);
  assert.equal((await emit(host,'leave-room')).ok,true);
});

test('reconnect reclaims player seat and replaces stale connection',async()=>{
  const host=await connected();
  const created=await emit(host,'create-room');assert.equal(created.ok,true);
  const second=await connected();
  const resumed=await emit(second,'resume-room',{code:created.code,token:created.token});
  assert.equal(resumed.ok,true);assert.equal(resumed.slot,0);
  assert.equal((await emit(second,'resume-room',{code:created.code,token:'wrong'})).ok,false);
  assert.equal((await emit(second,'leave-room')).ok,true);
});

test('solo CPU creation and leaving are supported',async()=>{
  const human=await connected();
  const r=await emit(human,'create-bot-room',{botHp:75,botSpecial:'standard'});
  assert.equal(r.ok,true);assert.equal(r.state.botMode,true);
  assert.equal(r.state.players[1].isBot,true);
  assert.equal((await emit(human,'player-setup',{name:'Solo Test',hpMode:'fixed',hp:75,special:'trickster'})).ok,true);
  assert.equal((await emit(human,'start-game')).ok,true);
  assert.equal((await emit(human,'leave-room')).ok,true);
});
