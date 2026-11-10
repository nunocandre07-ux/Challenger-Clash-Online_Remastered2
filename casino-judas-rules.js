'use strict';
// Server-validated, single-zero (European) roulette and shared Cursed Energy rules.
const WHEEL=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const inRange=n=>Number.isInteger(n)&&n>=1&&n<=36;
function covers(kind,number){
  const n=Number(number),set=[];
  switch(kind){
    case 'straight': if(Number.isInteger(n)&&n>=0&&n<=36)set.push(n);break;
    case 'split':
      if(n===0)set.push(0,1); // zero/one neighbour
      else if(inRange(n)) {if(n%3!==0&&n+1<=36)set.push(n,n+1);else if(n<=33)set.push(n,n+3);}break;
    case 'trio':if(n===0)set.push(0,1,2);else if(n===1)set.push(0,2,3);break;
    case 'street':if(inRange(n)){const start=3*Math.floor((n-1)/3)+1;set.push(start,start+1,start+2);}break;
    case 'corner':if(inRange(n)&&n<=32&&n%3!==0)set.push(n,n+1,n+3,n+4);break;
    case 'sixline':if(inRange(n)&&n<=33){const start=3*Math.floor((n-1)/3)+1;if(start<=31)set.push(start,start+1,start+2,start+3,start+4,start+5);}break;
    case 'dozen':if([1,2,3].includes(n))for(let v=(n-1)*12+1;v<=n*12;v++)set.push(v);break;
    case 'column':if([1,2,3].includes(n))for(let v=n;v<=36;v+=3)set.push(v);break;
    case 'red':return [...RED];
    case 'black':return Array.from({length:36},(_,i)=>i+1).filter(x=>!RED.has(x));
    case 'odd':return Array.from({length:18},(_,i)=>2*i+1);
    case 'even':return Array.from({length:18},(_,i)=>2*i+2);
    case 'low':return Array.from({length:18},(_,i)=>i+1);
    case 'high':return Array.from({length:18},(_,i)=>i+19);
  }
  return [...new Set(set)];
}
const DAMAGE={straight:30,split:22,trio:20,street:18,corner:16,sixline:13,dozen:10,column:10,red:7,black:7,odd:7,even:7,low:7,high:7};
function rouletteBet(kind,number){
  if(!Object.hasOwn(DAMAGE,kind))return null;
  const pockets=covers(kind,number);
  if(!pockets.length)return null;
  return {kind,number:Number(number)||0,pockets,winDamage:DAMAGE[kind],odds:Math.round(36/pockets.length)-1};
}
function rouletteOutcome(bet,landed){
  if(!bet||!Number.isInteger(landed)||landed<0||landed>36)throw Error('Invalid roulette outcome');
  const won=bet.pockets.includes(landed);
  return {won,landed,damage:won?bet.winDamage:2,jackpot:won&&landed===0};
}
function maxEnergy(p){return p.cursedMax||8;}
function replenish(p){
  if(!['bluejudas','redjudas'].includes(p.special))return;
  p.judasTurns=(p.judasTurns||0)+1;
  const gainPositive=0,capacity=maxEnergy(p);
  // Positive always fills before cursed, even when capacity is already full.
  p.positiveEnergy+=gainPositive;
  // Do not discard pre-existing cursed energy until turn end. If full,
  // the one new positive point temporarily overfills and takes priority.
  p.positiveEnergy=Math.min(capacity+1,p.positiveEnergy);
  const roomForCursed=Math.max(0,capacity-p.cursedEnergy-p.positiveEnergy);
  p.cursedEnergy+=Math.min((p.special==='bluejudas' && p.sixEyesTurns>0)||(p.special==='redjudas' && p.kingTurns>0)?5:p.special==='bluejudas'?1:2,roomForCursed);
  p.overEnergy=Math.max(0,p.cursedEnergy+p.positiveEnergy-capacity);
}
function discardOverenergy(p){
  if(!['bluejudas','redjudas'].includes(p.special))return;
  const excess=Math.max(0,p.cursedEnergy+p.positiveEnergy-maxEnergy(p));
  p.cursedEnergy=Math.max(0,p.cursedEnergy-excess);
  const remaining=Math.max(0,p.cursedEnergy+p.positiveEnergy-maxEnergy(p));
  p.positiveEnergy=Math.max(0,p.positiveEnergy-remaining);
  p.overEnergy=0;
}
function spend(p,cursed=0,positive=0){
  if(!Number.isInteger(cursed)||cursed<0||!Number.isInteger(positive)||positive<0)return false;
  if(p.cursedEnergy<cursed||p.positiveEnergy<positive)return false;
  p.cursedEnergy-=cursed;p.positiveEnergy-=positive;return true;
}
module.exports={WHEEL,RED,DAMAGE,covers,rouletteBet,rouletteOutcome,maxEnergy,replenish,discardOverenergy,spend};
