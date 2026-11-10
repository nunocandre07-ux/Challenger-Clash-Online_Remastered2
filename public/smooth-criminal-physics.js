/* Smooth Criminal's 10-second balancing rules. Shared by the server and the visual client.
 * Scores and damage are finalized from the SERVER copy only. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CCSmoothPhysics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DURATION=10, GOOD_ANGLE=5.5, PERFECT_ANGLE=1.2, FALL_ANGLE=52;
  const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
  function start(angle=0,dir=1){return {angle:clamp(+angle||0,-2.5,2.5),velocity:0,dir:dir<0?-1:1,near:true,elapsed:0,goodSeconds:0,perfectSeconds:0,fell:false};}
  // Input: -1 (left), 0 (released), +1 (right).
  function step(s,dt,input=0){
    if(s.fell||s.elapsed>=DURATION)return s;
    dt=clamp(Number(dt)||0,0,0.035);
    dt=Math.min(dt,DURATION-s.elapsed);
    const near=Math.abs(s.angle)<.9;
    if(near&&!s.near)s.dir=-s.dir;
    s.near=near;
    const angle=s.angle;
    const outward=Math.abs(angle)>.9?Math.sign(angle)*(12+Math.abs(angle)*1.9+.014*angle*angle+Math.max(0,Math.abs(angle)-25)*1.5)*1.35:s.dir*16*1.35;
    const accel=outward+(clamp(input,-1,1)*144)-s.velocity*1.06;
    s.velocity=clamp(s.velocity+accel*dt,-180,180);
    s.angle+=s.velocity*dt;
    s.elapsed+=dt;
    if(Math.abs(s.angle)<=GOOD_ANGLE)s.goodSeconds+=dt;
    if(Math.abs(s.angle)<=PERFECT_ANGLE)s.perfectSeconds+=dt;
    if(Math.abs(s.angle)>=FALL_ANGLE){s.angle=clamp(s.angle,-FALL_ANGLE,FALL_ANGLE);s.fell=true;}
    return s;
  }
  function advance(s,seconds,input=0){
    let remaining=Math.max(0,Number(seconds)||0);
    while(remaining>0.000001&&!s.fell&&s.elapsed<DURATION){const dt=Math.min(.016,remaining);step(s,dt,input);remaining-=dt;}
    return s;
  }
  function result(s){const good=Math.min(DURATION,Math.max(0,s.goodSeconds||0)),perfect=Math.min(good,Math.max(0,s.perfectSeconds||0));return {goodSeconds:good,perfectSeconds:perfect,damage:Math.ceil(good+3*perfect),perfectReward:perfect>=5};}
  return {DURATION,GOOD_ANGLE,PERFECT_ANGLE,FALL_ANGLE,start,step,advance,result};
});
