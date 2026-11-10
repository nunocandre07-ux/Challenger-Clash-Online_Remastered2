'use strict';
// Pure, server-side card and slot rules. Neither client chooses random outcomes.
const crypto=require('crypto');
function randomInt(max){return crypto.randomInt(max);}
function freshDeck(){const deck=[];for(let rank=2;rank<=14;rank++)for(const suit of ['♠','♥','♦','♣'])deck.push({rank,suit});for(let i=deck.length-1;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}return deck;}
function cardText(c){return `${({11:'J',12:'Q',13:'K',14:'A'})[c.rank]||c.rank}${c.suit}`;}
function blackjackTotal(cards){let sum=0,aces=0;for(const c of cards){sum+=c.rank===14?11:Math.min(10,c.rank);if(c.rank===14)aces++;}while(sum>21&&aces>0){sum-=10;aces--;}return {total:sum,soft:aces>0};}
function natural(cards){return cards.length===2&&blackjackTotal(cards).total===21;}
function blackjackWinDamage(cards){return Math.min(10,Math.max(5,blackjackTotal(cards).total-11));}
const POKER_NAMES=['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush','Royal Flush'];
const POKER_BOOST=[10,1,2,3,4,5,6,8,9,10];
const POKER_REDUCTION=[0,1,1,2,2,3,4,5,7,7];
function scoreFive(cards){
 const ranks=cards.map(c=>c.rank).sort((a,b)=>b-a), counts=new Map();ranks.forEach(x=>counts.set(x,(counts.get(x)||0)+1));
 const groups=[...counts].map(([rank,count])=>({rank,count})).sort((a,b)=>b.count-a.count||b.rank-a.rank);
 const unique=[...new Set(ranks)];if(unique.includes(14))unique.push(1);
 let straight=0;for(let i=0;i<=unique.length-5;i++){if(unique[i]-unique[i+4]===4){straight=unique[i];break;}}
 const flush=cards.every(c=>c.suit===cards[0].suit);
 if(flush&&straight)return [straight===14?9:8,straight];
 if(groups[0].count===4)return [7,groups[0].rank,groups[1].rank];
 if(groups[0].count===3&&groups[1]?.count===2)return [6,groups[0].rank,groups[1].rank];
 if(flush)return [5,...ranks];
 if(straight)return [4,straight];
 if(groups[0].count===3)return [3,groups[0].rank,...groups.slice(1).map(g=>g.rank).sort((a,b)=>b-a)];
 if(groups[0].count===2&&groups[1]?.count===2)return [2,Math.max(groups[0].rank,groups[1].rank),Math.min(groups[0].rank,groups[1].rank),groups[2].rank];
 if(groups[0].count===2)return [1,groups[0].rank,...groups.slice(1).map(g=>g.rank).sort((a,b)=>b-a)];
 return [0,...ranks];
}
function compareScores(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0)?1:-1;}return 0;}
function bestPoker(cards){if(!Array.isArray(cards)||cards.length<5||cards.length>7)throw Error('Poker requires 5–7 cards');let best=null;for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){const hand=[cards[a],cards[b],cards[c],cards[d],cards[e]],score=scoreFive(hand);if(!best||compareScores(score,best.score)>0)best={score,cards:hand};}return {...best,name:POKER_NAMES[best.score[0]],boost:POKER_BOOST[best.score[0]],reduction:POKER_REDUCTION[best.score[0]]};}
const SLOT_SYMBOLS=['🍒','🔔','🍋','💎','7️⃣'];
function spinSlots(){return Array.from({length:3},()=>SLOT_SYMBOLS[randomInt(SLOT_SYMBOLS.length)]);}
function spinSlotsWithMatch(){const symbol=SLOT_SYMBOLS[randomInt(SLOT_SYMBOLS.length)];return [symbol,symbol,symbol];}
function slotResult(symbols){const counts=new Map();for(const s of symbols)counts.set(s,(counts.get(s)||0)+1);const matches=Math.max(...counts.values());return {matches,sevens:symbols.every(s=>s==='7️⃣')};}
module.exports={randomInt,freshDeck,cardText,blackjackTotal,natural,blackjackWinDamage,POKER_NAMES,POKER_BOOST,POKER_REDUCTION,scoreFive,compareScores,bestPoker,spinSlots,spinSlotsWithMatch,slotResult};
