'use strict';

const express = require('express');
const http = require('http');
const crypto = require('crypto');
const GR = require('./gambler-rules');
const CJ = require('./casino-judas-rules');
const SM = require('./public/smooth-criminal-physics.js');
const { Server } = require('socket.io');

// Server-owned timeout callbacks should not keep completed smoke-test processes alive.
// The live HTTP/Socket.IO server keeps the process running in production.
function scheduleGameTimer(callback,ms,...args){const t=setTimeout(callback,ms,...args);t.unref?.();return t;}

const app = express();
app.disable('x-powered-by');
app.use((_req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options',_req.path==='/smooth-criminal.html'?'SAMEORIGIN':'DENY'); // Only the first-party Smooth Criminal minigame may be framed
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  next();
});
const server = http.createServer(app);
const io = new Server(server, {
  transports: ['polling', 'websocket'],
  maxHttpBufferSize: 100_000
});

app.use(express.static('public'));
app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, connections: io.engine.clientsCount });
});

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const MAX_ACTIVE_ROOMS = Math.max(1,Number.parseInt(process.env.MAX_ACTIVE_ROOMS||'300',10)||300);
const DISCONNECT_FORFEIT_MS = 90_000;


const SPECIALS = {
  standard: { name: 'Standard — No Special', category: 'standard', move: '' },
  berserker: { name: 'Berserker', category: 'generated', move: 'Rage' },
  ironwall: { name: 'Iron Wall', category: 'generated', move: 'Fortify' },
  arcanesurge: { name: 'Arcane Surge', category: 'generated', move: 'Channel' },
  trickster: { name: 'Trickster', category: 'generated', move: 'Loaded Dice' },
  nightcrawler: { name: 'Nightcrawler', category: 'fun', move: 'Lights Out' },
  bluejudas: { name: 'Blue Judas', category: 'fun', move: 'Six Eyes' },
  redjudas: { name: 'Red Judas', category: 'fun', move: 'King of Curses' },
  greatexception: { name: 'The Great Exception', category: 'fun', move: 'Umbrella / Magic Bag' },
  glovedone: { name: 'The Gloved One', category: 'fun', move: 'Dance Battle / Moon Walk / Beat It' },
  masterpresentation: { name: 'Master of Presentation', category: 'fun', move: 'Brainbot / Black Mamba / Spider Bot / Death Ray' },
  pokemontrainer: { name: 'Pokémon Trainer', category: 'fun', move: 'Pokémon Rotation / Pokémon Center' },
  gambler: { name: 'The Gambler', category: 'fun', move: 'Blackjack Bash / Poker Table / Double or Nothing' }
};
const RANDOM_SPECIALS = ['berserker','ironwall','arcanesurge','trickster','nightcrawler','bluejudas','redjudas','greatexception','glovedone','masterpresentation','pokemontrainer','gambler'];
const ULTIMATES = {
  bluejudas: {id:'hollowpurple',name:'Hollow Purple'},
  redjudas: {id:'worldcuttingslash',name:'World Cutting Slash'},
  pokemontrainer: {id:'teamrocket',name:'Team Rocket'},
  greatexception: {id:'realitymanipulation',name:'Reality Manipulation'},
  gambler: {id:'relentlessgambler',name:'Relentless Gambler'}
};
const POKEMON_ROSTER = {
  pikachu:{
    id:'pikachu',name:'Pikachu',role:'Offensive pressure',icon:'⚡',maxHp:12,passive:'Fast, low-cost moves that build Momentum and keep pressure.',
    moves:{
      quickattack:{id:'quickattack',name:'Quick Attack',pp:5,cost:1,kind:'damage',min:3,max:5,momentum:10,desc:'3–5 damage and +10 Momentum.'},
      thunderbolt:{id:'thunderbolt',name:'Thunderbolt',pp:3,cost:1,kind:'damage',min:6,max:9,momentum:8,effect:'shock',effectChance:50,effectTurns:2,desc:'6–9 damage, +8 Momentum, 50% Shock for 2 turns.'},
      volttackle:{id:'volttackle',name:'Volt Tackle',pp:2,cost:1,kind:'damage',min:8,max:12,momentum:10,recoil:5,desc:'8–12 damage, +10 Momentum, but 5 recoil damage.'}
    }
  },
  snorlax:{
    id:'snorlax',name:'Snorlax',role:'Defense',icon:'🛡️',maxHp:20,passive:'While active, incoming direct damage is reduced by 2.',
    moves:{
      bodyslam:{id:'bodyslam',name:'Body Slam',pp:4,cost:1,kind:'damage',min:6,max:9,momentum:6,desc:'6–9 damage.'},
      block:{id:'block',name:'Block',pp:3,cost:1,kind:'self',desc:'+8 Defence and the next direct attacker takes 3 retaliation damage.'},
      rest:{id:'rest',name:'Rest',pp:2,cost:1,kind:'self',desc:'Heal 10 HP and gain 3 Defence.'}
    }
  },
  gengar:{
    id:'gengar',name:'Gengar',role:'Disruption',icon:'👻',maxHp:15,passive:'Debuffs and interferes with the opponent’s plan.',
    moves:{
      shadowball:{id:'shadowball',name:'Shadow Ball',pp:3,cost:1,kind:'damage',min:5,max:8,momentum:6,effect:'weakness',effectChance:50,effectTurns:2,desc:'5–8 damage, 50% Weakness for 2 turns.'},
      hypnosis:{id:'hypnosis',name:'Hypnosis',pp:2,cost:1,kind:'status',difficulty:8,desc:'Parryable disruption; 50% chance the opponent loses their next turn.'},
      toxictrick:{id:'toxictrick',name:'Toxic Trick',pp:3,cost:1,kind:'damage',min:3,max:5,momentum:5,effect:'poison',effectChance:100,effectTurns:3,desc:'3–5 damage and Poison for 3 turns.'}
    }
  },
  charizard:{
    id:'charizard',name:'Charizard',role:'Heavy damage',icon:'🔥',maxHp:17,passive:'Limited PP, high damage, rewards rotating away and setting up.',
    moves:{
      flamethrower:{id:'flamethrower',name:'Flamethrower',pp:1,cost:1,kind:'damage',min:8,max:12,momentum:6,effect:'burn',effectChance:50,effectTurns:2,desc:'8–12 damage, 50% Burn for 2 turns.'},
      fireblast:{id:'fireblast',name:'Fire Blast',pp:1,cost:1,kind:'damage',min:12,max:18,momentum:6,effect:'burn',effectChance:100,effectTurns:2,desc:'12–18 damage and Burn for 2 turns.'},
      dragonrush:{id:'dragonrush',name:'Dragon Rush',pp:1,cost:1,kind:'damage',min:10,max:14,momentum:6,effect:'armourbreak',effectChance:50,effectTurns:2,desc:'10–14 damage, 50% Armour Break for 2 turns.'}
    }
  },
  vaporeon:{
    id:'vaporeon',name:'Vaporeon',role:'Water control',icon:'💧',maxHp:15,passive:'Water pressure plus charm/disruption. Nightcrawler is weak to Water.',
    moves:{
      watergun:{id:'watergun',name:'Water Gun',pp:4,cost:1,kind:'damage',min:1,max:6,momentum:5,water:true,effect:'wet',effectChance:100,effectTurns:2,desc:'1–6 Water damage and Wet for 2 turns. Nightcrawler takes ×1.5 Water damage.'},
      seduce:{id:'seduce',name:'Seduce',pp:2,cost:1,kind:'status',difficulty:7,desc:'Parryable. 50% chance to Seduce for D4 turns.'}
    }
  }
};
const POKEMON_PUBLIC = Object.fromEntries(Object.entries(POKEMON_ROSTER).map(([id,p])=>[id,{
  id:p.id,name:p.name,role:p.role,icon:p.icon,maxHp:p.maxHp,passive:p.passive,
  moves:Object.fromEntries(Object.entries(p.moves).map(([mid,m])=>[mid,{id:m.id,name:m.name,pp:m.pp,cost:m.cost,kind:m.kind,desc:m.desc}]))
}]));
function initialPokemonPP(){
  const out={};
  for(const [pid,p] of Object.entries(POKEMON_ROSTER)){
    out[pid]={};for(const [mid,m] of Object.entries(p.moves))out[pid][mid]=m.pp;
  }
  return out;
}
function initialPokemonHP(){
  return Object.fromEntries(Object.entries(POKEMON_ROSTER).map(([id,p])=>[id,p.maxHp]));
}
const EFFECTS = ['shock','bleed','poison','weakness','armourbreak','strengthen','energyleak','adrenaline','badluck','fortune'];
const ACTION_TYPES = ['attack','defence','charge','effect','other'];
const DAMAGE_DICE = [4,6,8,10,12,20];
const STEP_LADDER = [4,6,8,10,12,20,100];

const NEW_ITEM_BUTTONS=['Attack','Defence','Charge','Effects','Special','Ultimate'];
const ITEM_8BALL_TIMEOUT_MS=18000;
const ITEM_STOPWATCH_TIMEOUT_MS=11000;
const itemStopwatchValue = ms => {
  // Deterministic changing clock rate: both players see the same accelerated/slowed dial.
  const t=Math.max(0,ms/1000);
  return Math.max(0,t+0.36*Math.sin(t*2.4)+0.19*Math.sin(t*6.7));
};
const itemCardDeck=()=>{
  const suits=['♠','♣','♥','♦'];const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  return [...suits.flatMap(suit=>ranks.map(rank=>({suit,rank}))),{suit:'🃏',rank:'BLACK JOKER'},{suit:'🃏',rank:'RED JOKER'}];
};
const ITEM_CARD_DECK=itemCardDeck();
function itemCardOutcome(card){
  if(card.rank==='BLACK JOKER')return {damage:15,self:0,momentum:50,fortune:2};
  if(card.rank==='RED JOKER')return {damage:0,self:15,momentum:-25,badluck:2};
  if(card.rank==='A')return {damage:['♠','♣'].includes(card.suit)?15:0,self:['♥','♦'].includes(card.suit)?13:0};
  if(card.rank==='K')return {damage:['♠','♣'].includes(card.suit)?13:0,self:['♥','♦'].includes(card.suit)?10:0};
  return {damage:card.rank==='Q'?12:card.rank==='J'?11:Number(card.rank),self:0};
}
const MAGIC_BAG_ITEMS = [
  {id:'powerglove',name:'Power Glove',desc:'Next damaging attack +7 damage; then take 4 recoil.'},
  {id:'mysterycandy',name:'Mystery Candy',desc:'Choose yourself or your opponent: a randomly selected helpful or harmful status for 5 turns.'},
  {id:'gamblerscoin',name:"Gambler’s Coin",desc:'Heads: next attack ×2 and Fortune (2 turns). Tails: 7 damage to yourself and Bad Luck (2 turns).'},
  {id:'magic8ball',name:'Magic 8-Ball',desc:'Predict the opponent’s next main move from three options. Correct: +15 Defence and +10 Ultimate Charge. Wrong: next hit +20%.'},
  {id:'cursedstopwatch',name:'Cursed Stopwatch',desc:'Stop a wildly changing clock at 5.00 seconds: +5 / +15 / +25 Ultimate Charge.'},
  {id:'deckofcards',name:'Deck of Cards',desc:'Draw a card from a 54-card deck. Numbers, face cards and jokers have different damage and side effects.'},
  {id:'kite',name:'Kite',desc:'10 damage and Windblown: next Defence action is 20% weaker.'},
  {id:'penguin',name:'Penguin',desc:'12 damage and Distracted: next damaging action deals 20% less.'},
  {id:'magicmirror',name:'Magic Mirror',desc:'Reflect up to 10 damage from the next incoming attack.'},
  {id:'piano',name:'A Piano',desc:'Deals 6–8 damage.'},
  {id:'bazooka',name:'A BAZOOKA',desc:'Deals 10–15 damage.'},
  {id:'marbles',name:'Marbles',desc:'50% chance to make the opponent skip their next turn.'},
  {id:'basketball',name:'A Basketball',desc:'Deals D6 damage.'},
  {id:'football',name:'A Football',desc:'Deals D6 damage.'},
  {id:'marble',name:'A Marble',desc:'Deals D4 damage.'},
  {id:'knife',name:'A Knife',desc:'Deals 2–4 damage and Bleed. 50% chance it hits you instead.'},
  {id:'cupcake',name:'A Cupcake',desc:'Heals you for 5 HP.'},
  {id:'birthdaycake',name:'A Birthday Cake',desc:'Heals you 10 HP and the opponent 5 HP.'},
  {id:'syringe',name:'Used Syringe',desc:'50% chance of 2–4 damage for 3 turns, or 2–4 healing for 3 turns.'},
  {id:'dice',name:'A Dice',desc:'Adds an extra D6 to your next Attack or Defence roll.'},
  {id:'garbage',name:'Garbage',desc:'Does absolutely nothing.'},
  {id:'lollipop',name:'A Lollipop',desc:'Heals you for 2 HP.'},
  {id:'toyarmy',name:'Toy Army',desc:'Deals D20 damage and inflicts Armour Break.'},
  {id:'plates',name:'Plates',desc:'Attacks with a random 1–4 D4 dice.'},
  {id:'burrito',name:'Hot Head Burrito',desc:'Heals D20 HP, but inflicts Burn: 3 damage for 2 turns.'},
  {id:'shield',name:'Shield',desc:'Gives you 10 Defence, up to the normal 20 Defence cap.'},
  {id:'nationalflag',name:'National Flag',desc:'Adds 25 percentage points of Momentum. Limit two uses per fighter per battle.'},
  {id:'healthpotion',name:'Health Potion',desc:'Heals 5–10 HP.'},
  {id:'chocolates',name:'Box of Chocolates',desc:'Heals the opponent 5 HP, then has a 50% chance to Seduce them for D4 turns. While Seduced, 50% of direct attack damage they deal is reflected back onto them.'},
  {id:'moustache',name:'Moustache',desc:'Confuses the opponent so their attacks/effect throws miss during their next turn.'},
  {id:'hotpotato',name:'Hot Potato',desc:'Starts Hot Potato. The holder passes it back and forth; every pass has a 25% explosion chance for 6–7 damage. The game ends when someone is damaged.'},
  {id:'portalgun',name:'Portal Gun',desc:'Opens a portal and summons a random Companion. The Companion becomes available from Action → Companions.'},
  {id:'kebab',name:'Kebab',desc:'Heals 4 HP.'},
  {id:'truck',name:'Truck',desc:'Deals 15–20 damage. Magic Bag only; cannot be bought from the Shop.',shop:false},
  {id:'lion',name:'Lion',desc:'Summons a Lion Companion with 1 Companion Move per turn: Defend Me (10) or Big Bite (10 damage + Bleed).'},
  {id:'goldenapple',name:'Golden Apple',desc:'Regenerates 10 HP at the start of each of your next 3 turns. Buying it from the Shop costs 2 turns.',shopTurns:2},
  {id:'anvil',name:'Anvil',desc:'Starts a horizontal timing minigame: BAD 5 damage, GOOD 10, PERFECT 17.'}
];
const UPGRADED_MAGIC_BAG_IDS = ['piano','toyarmy','truck','lion','bazooka','goldenapple','anvil'];

const COMPANIONS = {
  zombie: {id:'zombie',name:'Zombie',desc:'Hold in Place, Defend Me, and Bite.'},
  kebabstand: {id:'kebabstand',name:'Kebab Stand',desc:'Produces a Kebab every two owner turns.'},
  baby: {id:'baby',name:'Baby',desc:'Can Defend Me for 3 protection. Grows into Teen after 3 owner turns.'},
  dog: {id:'dog',name:'Dog',desc:'Free Bite once per turn, plus Pet the Dog.'},
  cat: {id:'cat',name:'Cat',desc:'Free Bite once per turn, plus Pet the Cat.'},
  vaporeon: {id:'vaporeon',name:'Vaporeon',desc:'Water Gun and Seduce.'},
  teen: {id:'teen',name:'Teen',desc:'Defend Me and Gooning. Grows into Adult after 4 owner turns.'},
  adult: {id:'adult',name:'Adult',desc:'Depression, Overtime, Groceries, and Defend Me.'},
  zombiedancers: {id:'zombiedancers',name:'Zombie Dancers',desc:'Thriller Night companion. Stackable Hold in Place and Defend Me.'},
  brainbot: {id:'brainbot',name:'Brainbot',desc:'Master of Presentation companion. Hold in Place, Bite, and Defend Me.'},
  lion: {id:'lion',name:'Lion',desc:'Reality Manipulation companion. One Companion Move per turn: Defend Me (10) or Big Bite (10 + Bleed).'}
};
const COMPANION_POOL = ['zombie','kebabstand','baby','dog','cat','vaporeon'];

const roll = sides => Math.floor(Math.random() * sides) + 1;
const clamp = (n,a,b) => Math.max(a, Math.min(b,n));
const clean = (v,max=40) => String(v ?? '').replace(/[<>]/g,'').trim().slice(0,max);

const rollRange = (a,b) => a + roll(b-a+1) - 1;

function exhaustionPenalty(p){ return p?.exhaustion>0 ? 2 : 0; }
function thrillerDamage(p,amount){ return p?.thrillerNightActive ? 0 : Math.max(0,Number(amount)||0); }
function newBattleStats(){return {damageDealt:0,damageTaken:0,damageBlocked:0,attacks:0,criticalHits:0,perfectTimings:0,parries:0,beams:0,effectsUsed:0,momentumSpent:0,turns:0,bestHit:0};}
function spendMomentum(p,amount){
  const cost=Math.max(0,Number(amount)||0);
  if((p.momentum||0)<cost)return false;
  p.momentum-=cost;
  if(p.stats)p.stats.momentumSpent+=cost;
  return true;
}
function consumeAdrenaline(room,p){
  if(!p.adrenaline)return 0;
  p.adrenaline=false;
  logRoom(room,`💪 ${p.name}'s Adrenaline powers up the strike (+3 damage, 2 recoil if it deals HP damage).`,'special');
  return 3;
}
function adrenalineRecoil(room,p,boost,hpDamage){
  if(boost>0&&hpDamage>0){hurtFighter(room,p,2,'Adrenaline recoil');logRoom(room,`💢 ${p.name} takes 2 Adrenaline recoil damage.`,'bad');}
}
function resolveStatusCombos(room,p){
  // Combos use existing effects instead of adding unnecessary extra attacks or status buttons.
  if(p.burn>0&&p.poison>0){
    p.burn=0;
    const damage=hurtFighter(room,p,5,'Toxic Flames');
    logRoom(room,`🔥☠️ TOXIC FLAMES! Burn + Poison ignites for ${damage} damage. Burn is consumed; Poison remains.`,'special');
  }
  if(p.wet>0&&p.shock>0&&!p.conductiveUsed){
    p.conductiveUsed=true;
    const damage=hurtFighter(room,p,4,'Conductive');
    logRoom(room,`💧⚡ CONDUCTIVE! Wet + Shock zaps ${p.name} for ${damage} bonus damage once per Shock application.`,'special');
  }
}
function failRelentlessGambler(room,p,reason){
  if(!p||p.special!=='gambler'||p.gamblerDomainCharge<=0)return false;
  p.gamblerDomainCharge=0;
  p.gamblerDomainDamage=0;
  // A broken charge or lost Domain Clash is also a loss, even without a spin.
  p.gamblerMisses=Math.min(10,(p.gamblerMisses||0)+1);
  p.momentum=100; // Always refund the entire Ultimate cost when it fails.
  logRoom(room,`🎰 ${p.name}'s Relentless Gambler fails (${reason}). Momentum restored to 100%! Each missed spin raises the next jackpot odds.`, 'special');
  return true;
}
function hurtFighter(room,p,amount,label='damage'){
  if(!p)return 0;
  const actual=p.jackpotTurns>0?0:thrillerDamage(p,amount),before=p.hp;
  p.hp=clamp(p.hp-actual,0,p.maxHp);
  const lost=Math.max(0,before-p.hp);
  if(lost&&p.stats){
    p.stats.damageTaken+=lost;
    const attacker=room?.players?.[room.current];
    // Damage dealt is explicitly direct-turn damage; DoT on the victim's turn is not falsely attributed.
    if(attacker&&attacker!==p&&attacker.stats){
      attacker.stats.damageDealt+=lost;
      attacker.stats.bestHit=Math.max(attacker.stats.bestHit,lost);
    }
  }
  if(lost>0&&p.special==='gambler'&&p.gamblerDomainCharge>0&&room?.current!==p.slot){
    p.gamblerDomainDamage+=lost;
    if(p.gamblerDomainDamage>=40){failRelentlessGambler(room,p,'40 damage interrupted the charge');}
  }
  if(lost>0&&room?.domain?.owner===p.slot&&room.domain.integrity!==undefined&&room.current!==p.slot){
    room.domain.integrity=Math.max(0,room.domain.integrity-lost);
    if(room.domain.integrity===0){logRoom(room,`💥 ${p.name}'s Domain shatters!`,'bad');room.domain=null;}
  }
  if(lost>0&&p.special==='pokemontrainer'&&p.activePokemon){
    const id=p.activePokemon,mon=POKEMON_ROSTER[id];
    if(mon){
      if(!p.pokemonHP)p.pokemonHP=initialPokemonHP();
      const monBefore=clamp(Number(p.pokemonHP[id]??mon.maxHp),0,mon.maxHp);
      const shared=actual,monAfter=Math.max(0,monBefore-shared);p.pokemonHP[id]=monAfter;
      logRoom(room,`${mon.icon} ${mon.name} shares the ${shared}-damage hit with ${p.name}: ${monBefore} → ${monAfter}/${mon.maxHp}.`,monAfter<=0?'bad':'info');
      if(monAfter<=0){
        logRoom(room,`💫 ${mon.name} FAINTS! It cannot be selected again until PokéCenter heals it.`,'bad');
        p.activePokemon=null;p.pokemonRepeatTax=0;p.snorlaxCounter=0;
      }
    }
  }
  return lost;
}
function loseMomentumForNonAttack(room,p,label='non-attack action'){
  const before=clamp(Number(p?.momentum)||0,0,100);
  if(before<=0)return 0;
  if(p.special==='glovedone')return 0;
  p.momentum=Math.max(0,before-3);
  const lost=before-p.momentum;
  if(lost>0)logRoom(room,`📉 ${p.name} loses ${lost}% Momentum for ${label}. Momentum ${before}% → ${p.momentum}%.`,'info');
  return lost;
}
function battleButtonGuard(p,button){
  if(!p)return null;
  if(button==='Defence'&&p.armourDefenceLock>0)return 'Armour Break prevents Defence moves until the end of your next turn.';
  if(p.groovinTurns>0&&p.groovinBlocked===button)return `🎵 Groovin has blocked your ${button} button this turn!`;
  if((button==='Special'||button==='Ultimate')&&p.teamRocketTurns>0)return `🚀 Team Rocket has sealed your ${button} button for ${p.teamRocketTurns} more turn(s)!`;
  if((p.realitySealTurns?.[button]||0)>0)return `Reality Manipulation has sealed ${button} for ${p.realitySealTurns[button]} more turn(s).`;
  if(Array.isArray(p.realitySealedButtons)&&p.realitySealedButtons.includes(button))return `Reality Manipulation has sealed your ${button} button for this battle.`;
  if(p.ptsd>0&&p.lastBattleButton===button)return `PTSD prevents you from using ${button} twice in a row. Choose a different main button first.`;
  return null;
}
function markBattleButton(p,button,room=null){
  if(room)resolveItemPrediction(room,p,button);
  if(p?.ptsd>0)p.lastBattleButton=button;
}
function momentumBonus(p){
  if(p?.special==='glovedone')return 0;
  const m=clamp(Number(p?.momentum)||0,0,100);
  if(m>=100)return 2;
  if(m>=50)return 1;
  return 0;
}
function addMomentum(p,amount){
  const before=clamp(Number(p.momentum)||0,0,100);
  if(p.special==='glovedone' && amount>0)return {before,after:before,gained:0};
  const adjusted=Number(amount)>0?Math.max(1,Math.round(Number(amount)*(p.special==='greatexception'?1.15:.75)*(p.tuneDeafTurns>0?.5:1))):(Number(amount)||0);
  p.momentum=p.jackpotTurns>0&&amount>0?before:clamp(before+adjusted,0,100);
  return {before,after:p.momentum,gained:p.momentum-before};
}

function addDamagingSpecialMomentum(room,p,label){
  const mom=addMomentum(p,7);
  if(mom.gained>0)logRoom(room,`🎯 ${label} adds ${mom.gained}% Momentum. Momentum ${mom.before}% → ${mom.after}%.`,'good');
  return mom;
}
function notePresentationAbility(room,p,key,label){
  if(p?.special!=='masterpresentation')return;
  if(!Array.isArray(p.presentationChain))p.presentationChain=[];
  if(p.presentationChain.includes(key)){
    p.presentationChain=[key];
  }else{
    p.presentationChain.push(key);
  }
  if(p.presentationChain.length>=3){
    const mom=addMomentum(p,10);
    logRoom(room,`🎬 THE DIFFERENCE IS PRESENTATION! ${p.name} chains three different abilities and gains ${mom.gained}% bonus Momentum (${mom.before}% → ${mom.after}%).`,'special');
    p.presentationChain=[];
  }else{
    logRoom(room,`🎬 Presentation chain ${p.presentationChain.length}/3: ${label}.`,'info');
  }
}
function timingGradeValue(g){
  return g==='perfect'?'perfect':g==='good'?'good':'bad';
}
function singleBarMomentum(g){
  g=timingGradeValue(g);
  return g==='perfect'?10:g==='good'?8:5;
}
function heavyBarMomentum(g){
  g=timingGradeValue(g);
  return g==='perfect'?5:g==='good'?3:2;
}
function heavyBarDamage(g){
  g=timingGradeValue(g);
  return g==='perfect'?3:g==='good'?2:1;
}
function emitCombatFx(room,payload){
  io.to(room.code).emit('combat-fx',{at:Date.now(),...payload});
}
function emitDefenceFx(room,payload){
  io.to(room.code).emit('defence-fx',{at:Date.now(),...payload});
}
function emitDiceRoll(room,sides,result,label='Dice Roll'){
  if(!room)return;
  io.to(room.code).emit('dice-roll',{at:Date.now(),sides:+sides,result:+result,label:String(label||'Dice Roll')});
}
function rollShown(room,sides,label='Dice Roll'){
  const result=roll(+sides);
  emitDiceRoll(room,+sides,result,label);
  return result;
}
function rollRangeShown(room,a,b,label='Range Roll'){
  const sides=b-a+1;
  const r=rollShown(room,sides,`${label} — D${sides}${a!==1?` + ${a-1}`:''}`);
  return a+r-1;
}
function parryDifficulty(damage){
  const d=Math.max(0,Number(damage)||0);
  const tier=Math.floor(d/3);
  return {
    // Still intentionally difficult, but v50 gives a VERY small readability/reaction cushion.
    duration:clamp(Math.round(635-tier*61),218,635),
    // Window is one side of center. This is only a tiny increase from v49.
    window:clamp(2.65-tier*.31,.62,2.65)
  };
}

function maybeStartDecoy(room,{attacker,defender,label,onSuccess,onMiss}){
  const target=room.players[defender];
  const stacks=Math.max(0,target?.decoyStacks||0);
  if(stacks<=0)return false;
  target.decoyStacks=0;
  const choices=stacks+1;
  const id=crypto.randomBytes(6).toString('hex');
  room.decoyPending={
    id,attacker,defender,label:String(label||'Incoming Attack'),choices,
    realIndex:roll(choices)-1,onSuccess,onMiss
  };
  room.phase='decoyChoice';
  logRoom(room,`🎭 ${target.name}'s ${stacks} stacked Decoy${stacks===1?'':'s'} split the target into ${choices} identical UI panels! ${room.players[attacker].name} must find the real one.`,'special');
  emitState(room);
  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    if(live?.decoyPending?.id===id&&live.phase==='decoyChoice')resolveDecoyChoice(live,-1);
  },20000);
  return true;
}
function resolveDecoyChoice(room,index){
  const dc=room.decoyPending;if(!dc)return;
  const correct=Number(index)===dc.realIndex;
  room.decoyPending=null;
  room.phase='turn';
  if(correct){
    logRoom(room,`🎯 ${room.players[dc.attacker].name} identifies the real ${room.players[dc.defender].name}! The attack continues.`,'good');
    dc.onSuccess?.();
  }else{
    logRoom(room,`🎭 DECOY! ${room.players[dc.attacker].name} attacks the wrong UI and completely misses ${room.players[dc.defender].name}.`,'special');
    emitCombatFx(room,{kind:'decoy-miss',attacker:dc.attacker,defender:dc.defender,damage:0,blocked:0,dodged:true,critical:false,label:'DECOY MISS!'});
    dc.onMiss?.();
  }
}

function maybeStartParry(room,{attacker,defender,label,hits,onResolve}){
  const d=room.players[defender];
  const infinity=!!(d?.special==='bluejudas' && d.infinityHits>0);
  if(!d?.parryReady&&!infinity)return false;
  if(infinity)d.infinityHits--;else d.parryReady=false;
  const cleanHits=(Array.isArray(hits)&&hits.length?hits:[6]).map(x=>Math.max(0,Number(x)||0));
  const id=crypto.randomBytes(6).toString('hex');
  const difficulties=cleanHits.map(h=>infinity?{duration:Math.max(720,1350-Math.min(550,h*19)),window:Math.max(5,Math.min(12,(26-Math.ceil(h*.65))/2))}:parryDifficulty(h));
  const returnPhase=room.phase;
  room.parryPending={id,attacker,defender,label:String(label||'Incoming Attack'),hits:cleanHits,difficulties,onResolve,returnPhase,infinity};
  room.phase='parryResponse';
  logRoom(room,infinity?`♾️ ${d.name} activates Infinity against ${label}! ${d.infinityHits} reaction(s) remain.`:`🗡️ ${d.name} attempts to Parry ${label}!`,'special');
  emitState(room);
  const timeout=30000; // generous fallback so queued dice animations never hide a Parry window.
  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    if(!live?.parryPending||live.parryPending.id!==id||live.phase!=='parryResponse')return;
    resolveParryPending(live,Array(cleanHits.length).fill(100));
  },timeout);
  return true;
}
function resolveParryPending(room,positions){
  const p=room.parryPending;if(!p)return;
  const results=p.difficulties.map((diff,i)=>{
    const pos=clamp(Number(positions?.[i])||100,0,100);
    return Math.abs(pos-50)<=diff.window;
  });
  const defender=room.players[p.defender];
  const perfectSet=results.length>0&&results.every(Boolean);
  room.parryPending=null;
  room.phase=p.returnPhase||'turn';

  if(perfectSet){
    if(p.infinity){logRoom(room,`♾️ ${defender.name} stops the attack with Infinity!`,'good');}
    if(defender.stats)defender.stats.parries+=results.length;
    if(!p.infinity){defender.parryReady=true;logRoom(room,`🗡️ ${defender.name}'s successful Parry keeps Parry Stance ready.`,'good');}
  }else{
    if(!p.infinity){defender.parryReady=false;defender.parryCooldown=2;}
    logRoom(room,p.infinity?`♾️ ${defender.name} misses Infinity: the attack continues.`:`🗡️ ${defender.name} misses a Parry. Parry enters a 2-turn cooldown.`,'bad');
  }
  p.onResolve(results);
}



function rhythmTargetTime(note){
  const travel=Math.max(1,Number(note?.travel)||1000);
  return Number(note?.hitAt||Date.now()); // The arrow center reaches its receptor at hitAt.
}
function rhythmNoteHit(note,now=Date.now()){
  return Math.abs(now-rhythmTargetTime(note))<=Math.max(1,Number(note?.window)||80);
}
function boundedRhythmPressTime(raw,now=Date.now()){
  const candidate=Number(raw);
  // Compensate for real network transit, never accept arbitrary browser timestamps.
  return Number.isFinite(candidate)&&candidate>=now-160&&candidate<=now+30?candidate:now;
}
function rhythmNoteExpired(note,now=Date.now()){
  return now>rhythmTargetTime(note)+Math.max(1,Number(note?.window)||80);
}

function danceMissLimit(room,slot){
  let limit=5;
  const p=room.players[slot],other=room.players[1-slot];
  if(p?.special==='glovedone')limit+=1;
  if(other?.special==='glovedone')limit-=1;
  return clamp(limit,1,9);
}

function buildDanceNotes(){
  const notes=[];
  let hitAt=Date.now()+3100;
  for(let i=0;i<100;i++){
    // A genuine progressive speed ramp: notes begin readable and then build
    // toward a frantic 175ms rhythm. Travel and hit windows tighten too.
    const interval=Math.max(160,Math.round(790*Math.pow(.95,i)));
    const travel=Math.max(470,1350-i*28);
    const window=Math.max(78,170-Math.round(i*3.2));
    notes.push({i,dir:roll(4)-1,hitAt,travel,window});
    hitAt+=interval;
  }
  return notes;
}
function applyDanceMiss(room,slot,label='MISS'){
  const db=room.danceBattle;if(!db)return;
  db.misses[slot]++;
  logRoom(room,`🎵 ${room.players[slot].name} ${label}! (${db.misses[slot]}/${db.limits[slot]} misses)`,'bad');
}
function finishDanceBattle(room,loserSlot){
  const db=room.danceBattle;if(!db)return;
  const winner=1-loserSlot,loser=room.players[loserSlot];
  loser.exhaustion=Math.max(loser.exhaustion||0,loserSlot===db.initiator?4:3);
  logRoom(room,`💃 ${room.players[winner].name} wins the Dance Battle! ${loser.name} suffers Exhaustion (-2) for 3 personal turns.`,'special');
  if(room.players[db.initiator].special==='glovedone'){
    const performer=room.players[db.initiator],won=loserSlot!==db.initiator;
    awardGloveHype(room,performer,won?'perfect':'miss');
    // Dance Battle used to deal direct HP damage (bypassing stored Defence),
    // so apply Hype here instead of routing through absorbAttack and changing
    // the move's existing defence interaction. Losing never buffs self-damage.
    const base=roll(5),amount=won?Math.max(0,base+gloveHypeDamageBonus(performer.gloveHype)):base;
    const dmg=hurtFighter(room,loser,amount);
    logRoom(room,`🕺 Dance Battle hits ${loser.name} for ${dmg} damage${won?' (including Crowd Hype)':''}.`,'special');
  }
  if(room.players[db.initiator].special==='gambler'){
    const dmg=hurtFighter(room,loser,10);
    logRoom(room,`🎰 The Gambler's Dance Battle deals ${dmg} bonus damage to ${loser.name}!`,'special');
    emitCombatFx(room,{kind:'dance',attacker:winner,defender:loserSlot,damage:dmg,blocked:0,label:'DANCE BATTLE'});
  }
  room.danceBattle=null;
  room.phase='turn';
  room.current=db.initiator;
  if(checkWinner(room)){emitState(room);return;}
  finishAction(room,false);
}
function resolveDanceMisses(room,id){
  const db=room.danceBattle;
  if(!db||db.id!==id||room.phase!=='danceBattle')return;
  const now=Date.now(),before=[db.misses[0],db.misses[1]];
  for(let slot=0;slot<2;slot++){
    while(db.index[slot]<db.notes.length){
      const note=db.notes[db.index[slot]];
      if(!rhythmNoteExpired(note,now))break;
      applyDanceMiss(room,slot,'misses a note');
      db.index[slot]++;
      if(db.misses[slot]>=db.limits[slot])break;
    }
  }
  if(db.misses[0]>=db.limits[0]&&db.misses[1]>=db.limits[1]){
    db.misses=[db.limits[0]-1,db.limits[1]-1];
    logRoom(room,'🎵 DOUBLE MISS at the limit! Sudden death — next miss loses.','special');
  }else if(db.misses[0]>=db.limits[0]){finishDanceBattle(room,0);return;}
  else if(db.misses[1]>=db.limits[1]){finishDanceBattle(room,1);return;}

  if(db.index[0]>=db.notes.length&&db.index[1]>=db.notes.length){
    if(db.misses[0]!==db.misses[1]){
      finishDanceBattle(room,db.misses[0]>db.misses[1]?0:1);return;
    }
    const i=db.notes.length,hitAt=Date.now()+850;
    db.notes.push({i,dir:roll(4)-1,hitAt,travel:600,window:100});
    logRoom(room,'🎵 Perfect tie! One sudden-death note is added.','special');
  }
  if(before[0]!==db.misses[0]||before[1]!==db.misses[1])emitState(room);
  scheduleGameTimer(()=>resolveDanceMisses(room,id),45);
}
function startDanceBattle(room,initiatorSlot){
  const p=room.players[initiatorSlot];
  if(p.danceBattleCooldown>0)return {error:`Dance Battle is on cooldown for ${p.danceBattleCooldown} more turn(s).`};
  const id=crypto.randomBytes(6).toString('hex');
  p.danceBattleCooldown=p.special==='glovedone'?4:8;
  room.danceBattle={
    id,initiator:initiatorSlot,startsAt:Date.now()+1500,
    notes:buildDanceNotes(),misses:[0,0],index:[0,0],
    limits:[danceMissLimit(room,0),danceMissLimit(room,1)]
  };
  room.phase='danceBattle';
  logRoom(room,`💃 ${p.name} starts DANCE BATTLE! Miss limits: ${room.players[0].name} ${room.danceBattle.limits[0]}, ${room.players[1].name} ${room.danceBattle.limits[1]}. Hit ← ↓ ↑ → as the arrows reach the receptors.`,'special');
  emitState(room);
  scheduleGameTimer(()=>resolveDanceMisses(room,id),45);
  return {ok:true,deferred:true};
}


function buildMoonWalkNotes(){
  const notes=[];
  let hitAt=Date.now()+1500;
  for(let i=0;i<5;i++){
    notes.push({i,dir:roll(4)-1,hitAt,travel:560,window:150});
    hitAt+=390;
  }
  return notes;
}
function finishMoonWalk(room){
  const mw=room.moonWalk;if(!mw)return;
  const a=room.players[mw.slot],d=room.players[1-mw.slot];
  const hits=mw.hits,misses=5-hits,raw=Math.max(0,hits*2-misses);
  if(hits>=4){d.groovinTurns=Math.max(d.groovinTurns,3);logRoom(room,`🎶 ${a.name} lands ${hits} Moonwalk notes! ${d.name} starts Groovin for three turns.`,'special');}
  addDamagingSpecialMomentum(room,a,'Moon Walk');
  room.moonWalk=null;room.phase='turn';room.current=mw.slot;
  const finalize=(parryResults=null)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🕺 ${d.name} PARRIES ${a.name}'s Moon Walk finish!`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY MOON WALK!',amount:0,perfect:true});
      finishAction(room,false,true);return;
    }
    const res=absorbAttack(room,d,raw,a,{normalAttack:false});
    const damage=res.damage+(attempted?1:0);
    hurtFighter(room,d,damage);
    reflectSeduced(room,a,damage,'Moon Walk');
    logRoom(room,`🕺 ${a.name}'s Moon Walk ends with ${hits}/5 notes hit: ${hits}×2 - ${misses} misses = ${raw} raw damage. ${d.name} takes ${damage}.`,'special');
    emitCombatFx(room,{kind:'moonwalk',attacker:a.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:!!(res.umbrellaDodge||res.sixEyes),critical:hits===5,label:hits===5?'PERFECT MOON WALK!':'MOON WALK!'});
    if(checkWinner(room)){emitState(room);return;}
    finishAction(room,false,true);
  };
  if(raw>0&&maybeStartParry(room,{attacker:a.slot,defender:d.slot,label:'Moon Walk',hits:[raw],onResolve:finalize}))return;
  finalize(null);
}
function resolveMoonWalkMisses(room,id){
  const mw=room.moonWalk;
  if(!mw||mw.id!==id||room.phase!=='moonWalk')return;
  const now=Date.now();
  while(mw.index<mw.notes.length){
    const note=mw.notes[mw.index];
    if(!rhythmNoteExpired(note,now))break;
    mw.misses++;mw.index++;
    logRoom(room,`🕺 ${room.players[mw.slot].name} misses Moon Walk note ${mw.index}.`,'bad');
  }
  if(mw.index>=5){finishMoonWalk(room);return;}
  emitState(room);
  scheduleGameTimer(()=>resolveMoonWalkMisses(room,id),35);
}
function startMoonWalk(room,slot,skipDecoy=false){
  const p=room.players[slot],d=room.players[1-slot];
  if(p.moonWalkCooldown>0)return {error:`Moon Walk is on cooldown for ${p.moonWalkCooldown} more turn(s).`};
  if(!skipDecoy&&maybeStartDecoy(room,{
    attacker:slot,defender:d.slot,label:'Moon Walk',
    onSuccess:()=>startMoonWalk(room,slot,true),
    onMiss:()=>{
      p.moonWalkCooldown=6;
      addDamagingSpecialMomentum(room,p,'Moon Walk');
      logRoom(room,`🎭 ${p.name} Moon Walks straight into a Decoy. The attack misses.`,'special');
      finishAction(room,false,true);
    }
  }))return {ok:true,deferred:true};
  p.moonWalkCooldown=6;
  const id=crypto.randomBytes(6).toString('hex');
  room.moonWalk={id,slot,startsAt:Date.now()+1100,notes:buildMoonWalkNotes(),index:0,hits:0,misses:0};
  room.phase='moonWalk';
  logRoom(room,`🕺 ${p.name} starts Moon Walk! Five very fast notes: +2 damage per hit, -1 damage per miss.`,'special');
  emitState(room);
  scheduleGameTimer(()=>resolveMoonWalkMisses(room,id),35);
  return {ok:true,deferred:true};
}


const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function buildBeatItSequence(){
  return Array.from({length:5},()=>LETTERS[roll(LETTERS.length)-1]);
}
function finishBeatIt(room){
  const bi=room.beatIt;if(!bi)return;
  const a=room.players[bi.slot],d=room.players[1-bi.slot];
  const raw=bi.hits+6; // Perfect Pitching the Voice is 2 damage lower than the former version.
  if(a.special==='glovedone'){awardGloveHype(room,a,bi.hits===5?'perfect':bi.hits>=3?'good':'miss');a.flowPerfectThisMove=bi.hits===5;if(bi.hits===5){d.tuneDeafTurns=2;logRoom(room,`🎧 ${d.name} is Tune Deaf for 2 turns.`,'special');}}
  addDamagingSpecialMomentum(room,a,'Beat It');
  room.beatIt=null;room.phase='turn';room.current=bi.slot;
  const finalize=(parryResults=null)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🎤 ${d.name} PARRIES ${a.name}'s Beat It combo!`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY BEAT IT!',amount:0,perfect:true});
      finishAction(room,false,true);return;
    }
    const res=absorbAttack(room,d,raw,a,{normalAttack:false});
    const damage=res.damage+(attempted?1:0);
    hurtFighter(room,d,damage);
    reflectSeduced(room,a,damage,'Beat It');
    logRoom(room,`🎤 ${a.name} finishes Beat It with ${bi.hits}/5 letters: ${raw} raw damage${bi.hits===5?' (PERFECT!)':''}. ${d.name} takes ${damage}.`,'special');
    emitCombatFx(room,{kind:'beatit',attacker:a.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:!!(res.umbrellaDodge||res.sixEyes),critical:bi.hits===5,label:bi.hits===5?'BEAT IT PERFECT!':'BEAT IT!'});
    if(checkWinner(room)){emitState(room);return;}
    finishAction(room,false,true);
  };
  if(raw>0&&maybeStartParry(room,{attacker:a.slot,defender:d.slot,label:'Beat It',hits:[raw],onResolve:finalize}))return;
  finalize(null);
}
function startBeatIt(room,slot,skipDecoy=false){
  const p=room.players[slot],d=room.players[1-slot];
  if(p.beatItCooldown>0)return {error:`Beat It is on cooldown for ${p.beatItCooldown} more turn(s).`};
  if(!skipDecoy&&maybeStartDecoy(room,{
    attacker:slot,defender:d.slot,label:'Beat It',
    onSuccess:()=>startBeatIt(room,slot,true),
    onMiss:()=>{
      p.beatItCooldown=4;
      addDamagingSpecialMomentum(room,p,'Beat It');
      logRoom(room,`🎭 ${p.name}'s Beat It combo targets a Decoy and misses.`,'special');
      finishAction(room,false,true);
    }
  }))return {ok:true,deferred:true};
  p.beatItCooldown=4; // Three subsequent personal turns on cooldown (current turn ticks once).
  const id=crypto.randomBytes(6).toString('hex');
  const startsAt=Date.now()+1000;
  room.beatIt={id,slot,sequence:buildBeatItSequence(),index:0,hits:0,startsAt,deadline:startsAt+4000};
  room.phase='beatIt';
  logRoom(room,`🎙️ ${p.name} starts Pitching the Voice! 1 second READY phase, then 4.0 seconds for five letters.`,'special');
  emitState(room);
  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    if(live?.beatIt?.id===id&&live.phase==='beatIt')finishBeatIt(live);
  },5025);
  return {ok:true,deferred:true};
}

function greatExceptionSides(p,sides){
  sides=+sides;
  return p?.special==='greatexception' ? Math.max(2,sides-2) : sides;
}
function magicItemById(id){ return MAGIC_BAG_ITEMS.find(x=>x.id===id)||null; }
function publicMagicItem(item){ return item ? {id:item.id,name:item.name,desc:item.desc,shop:item.shop!==false,shopTurns:Math.max(1,Number(item.shopTurns)||1)} : null; }
function magicBagPoolFor(p=null){
  if(p?.upgradedMagicBagTurns>0){
    return UPGRADED_MAGIC_BAG_IDS.map(magicItemById).filter(Boolean);
  }
  return MAGIC_BAG_ITEMS;
}
function drawMagicItem(p=null){
  const blocked=p?.magicBagRecent||{},base=magicBagPoolFor(p);
  const available=base.filter(item=>!(blocked[item.id]>0));
  const pool=available.length?available:base;
  return pool[roll(pool.length)-1];
}
function markMagicBagItemUsed(p,item){
  if(!p||!item)return;
  if(!p.magicBagRecent||typeof p.magicBagRecent!=='object')p.magicBagRecent={};
  // This turn's end ticks 3 → 2, so the item remains blocked for the next
  // two full personal turns, then becomes eligible again.
  p.magicBagRecent[item.id]=3;
}
function itemCatalog(){ return MAGIC_BAG_ITEMS.map(publicMagicItem); }
function shopCatalog(p){
  if(!Array.isArray(p.shopOffers)||!p.shopOffers.length){
    const eligible=MAGIC_BAG_ITEMS.filter(item=>item.shop!==false&&(item.id!=='nationalflag'||p.nationalFlagUses<2));
    for(let i=eligible.length-1;i>0;i--){const j=GR.randomInt(i+1);[eligible[i],eligible[j]]=[eligible[j],eligible[i]];}
    p.shopOffers=eligible.slice(0,4).map(item=>item.id);
  }
  return p.shopOffers.map(id=>magicItemById(id)).filter(Boolean).map(publicMagicItem);
}
function publicCompanion(c){
  if(!c)return null;
  return {
    type:c.type,name:c.name,guard:c.guard||0,guardMax:c.guardMax||0,
    holdCooldown:c.holdCooldown||0,defendUsed:!!c.defendUsed,holdingSlot:Number.isInteger(c.holdingSlot)?c.holdingSlot:null,
    growIn:Number.isFinite(c.growIn)?c.growIn:null,
    gooningCooldown:c.gooningCooldown||0,groceriesCooldown:c.groceriesCooldown||0,
    waterGunCooldown:c.waterGunCooldown||0,seduceCooldown:c.seduceCooldown||0,
    biteUsedThisTurn:!!c.biteUsedThisTurn,overtimeUsedThisTurn:!!c.overtimeUsedThisTurn,
    dancerMovesUsedThisTurn:c.dancerMovesUsedThisTurn||0,dancerMovesLimit:Number.isFinite(c.dancerMovesLimit)?c.dancerMovesLimit:3,
    dancerMovePenalty:c.dancerMovePenalty||0,dancerDefendsUsed:c.dancerDefendsUsed||0,
    kebabReady:!!c.kebabReady,produceIn:Number.isFinite(c.produceIn)?c.produceIn:null
  };
}
function companionEffectShieldActive(p){
  return !!(p?.companion && p.companion.guard>0);
}
function clearHeldByOwner(room,ownerSlot){
  room.players.forEach(p=>{
    if(p && p.heldByCompanionOwner===ownerSlot){
      p.heldByCompanionOwner=null;p.heldStacks=0;
      logRoom(room,`🧟 ${p.name} is released because the holding Companion is gone.`,'info');
    }
  });
}
function removeCompanion(room,slot,reason='is defeated'){
  const p=room.players[slot];
  if(!p?.companion)return false;
  const name=p.companion.name||'Companion';
  clearHeldByOwner(room,slot);
  p.companion=null;
  logRoom(room,`💨 ${p.name}'s ${name} ${reason}.`,'bad');
  return true;
}

function spawnBrainbot(room,p){
  if(p.companion?.type==='brainbot')return {error:'Brainbot is already active.'};
  if(p.companion)removeCompanion(room,p.slot,'is replaced by the Brainbot Swarm');
  p.companion={
    type:'brainbot',name:'Brainbot',guard:0,guardMax:0,defendUsed:false,holdingSlot:null,
    holdCooldown:0,biteUsedThisTurn:false
  };
  p.companionMovesUsedThisTurn=0;p.companionMovesLimit=1;p.companionCooldown=0;
  logRoom(room,`🤖 ${p.name} releases the Brainbot Swarm! Brainbot joins the fight.`,'special');
  return {ok:true};
}
function spawnLion(room,p){
  if(p.companion)removeCompanion(room,p.slot,'is replaced by the Lion');
  p.companion={type:'lion',name:'Lion',guard:0,guardMax:0,defendUsed:false,holdingSlot:null,biteUsedThisTurn:false};
  p.companionMovesUsedThisTurn=0;p.companionMovesLimit=1;p.companionCooldown=0;
  logRoom(room,`🦁 ${p.name} summons a Lion! It gets 1 Companion Move per turn: Defend Me (10) or Big Bite (10 + Bleed).`,'special');
  return p.companion;
}
function spawnCompanion(room,p){
  if(p.companion)removeCompanion(room,p.slot,'vanishes as a new portal opens');
  const type=COMPANION_POOL.length===1
    ? COMPANION_POOL[0]
    : COMPANION_POOL[rollShown(room,COMPANION_POOL.length,'Portal Gun Companion')-1];
  const def=COMPANIONS[type];
  const c={
    type,name:def.name,guard:0,guardMax:0,defendUsed:false,holdingSlot:null,
    holdCooldown:0,gooningCooldown:0,groceriesCooldown:0,waterGunCooldown:0,seduceCooldown:0,
    biteUsedThisTurn:false,overtimeUsedThisTurn:false,kebabReady:false,produceIn:null,growIn:null
  };
  if(type==='kebabstand')c.produceIn=3;
  if(type==='baby')c.growIn=4;
  p.companion=c;
  p.companionMovesUsedThisTurn=0;p.companionMovesLimit=1;p.companionCooldown=0;
  logRoom(room,`🌀 ${p.name} fires the Portal Gun and summons a ${def.name}! Action → Companions is now available.`,'special');
  return c;
}
function beginCompanionItemChoice(room,p,itemId,source,consumesMove=false){
  const item=magicItemById(itemId);
  if(!item)return {error:'Unknown Companion item.'};
  p.pendingCompanionItem=item.id;
  p.pendingCompanionItemSource=String(source||'Companion');
  p.pendingCompanionConsumesMove=consumesMove;
  p.pendingCompanionReturnPhase=room.phase;
  room.phase='companionItemChoice';
  emitState(room);
  return {ok:true,item:publicMagicItem(item)};
}
function companionBlocksEffect(room,target,label='effect'){
  if(!companionEffectShieldActive(target))return false;
  logRoom(room,`🧟🛡️ ${target.name}'s ${target.companion.name} shield blocks ${label}.`,'special');
  emitDefenceFx(room,{slot:target.slot,label:'COMPANION BLOCK!',amount:0,perfect:true});
  return true;
}
function reflectSeduced(room,attacker,damage,label='attack'){
  const dealt=Math.max(0,Number(damage)||0);
  if(!attacker||attacker.seduced<=0||dealt<=0)return 0;
  const reflected=Math.max(1,Math.ceil(dealt/2));
  hurtFighter(room,attacker,reflected);
  logRoom(room,`💘 ${attacker.name} is Seduced: ${reflected} reflected damage from ${label} hits them too.`,'bad');
  emitCombatFx(room,{kind:'seduced',attacker:1-attacker.slot,defender:attacker.slot,damage:reflected,blocked:0,dodged:false,critical:false,label:'SEDUCED!'});
  return reflected;
}
function consumeMagicDice(room,p,label='Magic Dice bonus'){
  if(!p?.magicDiceBonus)return 0;
  p.magicDiceBonus=false;
  return rollShown(room,6,label); // item die is intentionally exempt from Great Exception's -2 sides.
}

function makeCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(let tries=0; tries<100; tries++){
    let code = '';
    for(let i=0;i<5;i++) code += chars[crypto.randomInt(chars.length)];
    if(!rooms.has(code)) return code;
  }
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}
function makeToken(){ return crypto.randomBytes(18).toString('base64url'); }
function canEnterRoom(socket,ack){
  if(getRoomForSocket(socket)){fail(ack,'You are already in a room. Leave it before creating or joining another.');return false;}
  return true;
}
function canCreateRoom(socket,ack){
  if(!canEnterRoom(socket,ack))return false;
  if(rooms.size>=MAX_ACTIVE_ROOMS){fail(ack,'The server is at room capacity. Please try again later.');return false;}
  return true;
}
function disposeRoom(room){
  if(room?.botTimer){clearTimeout(room.botTimer);room.botTimer=null;}
  rooms.delete(room.code);
}

function stepDown(s){
  const i = STEP_LADDER.indexOf(+s);
  return i <= 0 ? 4 : STEP_LADDER[i-1];
}
function stepUpDamage(s){
  s=+s;
  if(s<=4)return 6;
  if(s<=6)return 8;
  if(s<=10)return 12;
  if(s<=12)return 20;
  return 20;
}
function randomPoolCount(room,sides,label='Pool count'){
  sides=+sides;
  if(sides===4)return rollShown(room,4,`${label} — number of dice`);
  if(sides===6)return rollShown(room,3,`${label} — number of dice`);
  if(sides===8)return rollShown(room,2,`${label} — number of dice`);
  return 1;
}
function newPlayer(slot, token, socketId){
  return {
    slot, token, socketId, connected: true, disconnectedAt: null, ready: false, isBot: false,
    setup: { name: '', hpMode: 'fixed', hp: 75, special: 'standard' },
    name: `Player ${slot+1}`, hp: 75, maxHp: 75,
    defence: 0, defenceUses: 0, momentum: 0, defensiveStanceUsed:false, defensiveStancePenalty:0, armourDefenceLock:0, nationalFlagUses:0, shopOffers:[], teamRocketTurns:0, powerGloveReady:false,coinAttackMultiplier:0,eightBallPrediction:null,eightBallVulnerable:false,candyRegen:0,
    charge: 'none', beamCharge: 'none', beamCooldown: 0,
    energyLeak:0, adrenaline:false, conductiveUsed:false, stats:newBattleStats(),
    shock: 0, shockDie: 4, bleed: 0, bleedDie: 4, poison: 0, poisonDie: 4,
    burn: 0, syringeDamageTurns: 0, syringeHealTurns: 0, forcedSkip: 0,
    seduced: 0, wet: 0, confusedMissTurns: 0,
    exhaustion: 0, ptsd: 0, lastBattleButton: null,
    weakness: 0, armourBreak: 0, strengthen: false,
    effectCooldowns: {shock:0,bleed:0,poison:0,weakness:0,armourbreak:0,strengthen:0,energyleak:0,adrenaline:0},
    effectsButtonCooldown: 0,
    actionCooldown: 0, actionBonus: 0,
    special: 'standard', specialCooldown: 0,
    nightFiveCooldown: 0, nightFiveTurns: 0, bite87Cooldown: 0,
    tuneDeafTurns:0,offBeatTurns:0,moonWalkCooldown: 0, beatItCooldown: 0,gloveHype:0,flowReady:false,flowPerfectThisMove:false,finalShowBonus:0,gloveMiniCooldowns:{},gloveKidCooldown:0,booooCooldown:0,thrillerUsedThisTurn:false,
    thrillerNightUsed: false, thrillerNightActive: false, thrillerNightTurns: 0,
    revivalChecked: false,
    nightFiveActiveThisTurn: false, actionsRemaining: 1,
    lightsOut: false,
    sixEyesTurns: 0, sixEyesCooldown: 0, infinityHits: 0,
    cursedEnergy:8,positiveEnergy:0,cursedMax:8,overEnergy:0,judasTurns:0,blueCharges:0,redCharges:0,rctHealTurns:0,pulled:0,offBalance:0,judasMiniCooldown:0,
    maxRedCooldown: 0, maxBlueCooldown: 0,
    dismantleCooldown: 0,cleaveCooldown:0,fugaCooldown:0,scored:0,burnMultiplier:1,
    bindingVowUses: 0, bindingVowUsesThisTurn: 0,
    kingTurns: 0, kingCooldown: 0,
    domainAvailable: false, domainCharging: false, domainChargeProgress: 0, domainKind: null, domainChargeMode: null, domainOfferHandled: false,
    rctCooldown: 0,
    umbrellaCooldown: 0, umbrellaFarTurns: 0, umbrellaDodgeReady: false,umbrellaGuardPct:0,umbrellaCounter:0,magicMirrorReady:false,windblown:false,distracted:false,spotlightReady:0,footworkCooldown:0,rocketStolen:null,rocketMoveBlocked:null,
    danceBattleCooldown: 0,
    mambaCooldown: 0, mambaStrikeCooldown: 0, mambaTurns: 0, mambaDefenceRemaining: 0,
    spiderTurns:0, spiderDodgeReady:false,groovinTurns:0,groovinBlocked:null,
    deathRayCooldown: 0, deathRayBeamBonus: 0, beamCooldownBypass: false,
    decoyStacks: 0,
    presentationChain: [],
    upgradedMagicBagTurns: 0, goldenAppleTurns: 0, shopSkipTurns: 0, realitySealedButtons: [], realitySealTurns:{},
    magicBagItem: null, magicDiceBonus: false, inventory: [], magicBagRecent: {},
    pendingCompanionItem: null, pendingCompanionItemSource: null, pendingCompanionConsumesMove: false, pendingCompanionReturnPhase: null,
    deferredCompanionItem: false,
    companion: null, heldByCompanionOwner: null, heldStacks: 0,
    companionMovesUsedThisTurn: 0, companionMovesLimit: 0, companionCooldown: 0,
    activePokemon: null, pokemonLast: null, pokemonLastMove: null, pokemonRepeatTax: 0, pokemonPP: initialPokemonPP(), pokemonHP: initialPokemonHP(), snorlaxCounter: 0,
    parryReady: false, parryCooldown: 0, heavyCooldown: 0,
    gamblerCooldowns:{blackjack:0,poker:0,double:0,roulette:0},badLuck:0,fortune:0,doubleOrNothing:false,coinFlips:0,coinMultiplier:1,
    pokerAttackBonus:0,jackpotTurns:0,jackpotHealTurns:0,jackpotHealUsed:false,jackpotDanceUsed:false,
    gamblerDomainCharge:0,gamblerDomainDamage:0,gamblerMisses:0,gamblerGuaranteedSevens:false,
    lastClashPressAt: 0
  };
}
function resetBattlePlayer(p,room=null){
  const hp = p.setup.hpMode === 'roll' ? 49+rollShown(room,51,'Champion HP roll — 50–100') : clamp(Number(p.setup.hp)||75,50,100);
  const special = p.setup.special === 'random'
    ? RANDOM_SPECIALS[rollShown(room,RANDOM_SPECIALS.length,'Random Special selection')-1]
    : (SPECIALS[p.setup.special] ? p.setup.special : 'standard');

  p.name = clean(p.setup.name || `Player ${p.slot+1}`, 32) || `Player ${p.slot+1}`;
  p.hp = hp; p.maxHp = hp;
  p.defence = 0; p.defenceUses = 0; p.momentum = 0; p.defensiveStanceUsed=false; p.defensiveStancePenalty=0; p.armourDefenceLock=0; p.nationalFlagUses=0; p.shopOffers=[]; p.teamRocketTurns=0;p.powerGloveReady=false;p.powerGloveRecoilPending=false;p.coinAttackMultiplier=0;p.eightBallPrediction=null;p.eightBallVulnerable=false;p.candyRegen=0;
  p.charge = 'none'; p.beamCharge = 'none'; p.beamCooldown = 0;
  p.energyLeak=0; p.adrenaline=false; p.conductiveUsed=false; p.stats=newBattleStats();
  p.shock = 0; p.shockDie = 4; p.bleed = 0; p.bleedDie = 4; p.poison = 0; p.poisonDie = 4;
  p.burn = 0; p.syringeDamageTurns = 0; p.syringeHealTurns = 0; p.forcedSkip = 0;
  p.seduced = 0; p.wet = 0; p.confusedMissTurns = 0; p.exhaustion = 0; p.ptsd = 0; p.lastBattleButton = null;
  p.weakness = 0; p.armourBreak = 0; p.strengthen = false;
  p.effectCooldowns = {shock:0,bleed:0,poison:0,weakness:0,armourbreak:0,strengthen:0,energyleak:0,adrenaline:0};
  p.effectsButtonCooldown = 0;
  p.actionCooldown = 0; p.actionBonus = 0;
  p.special = special; p.specialCooldown = 0;
  p.nightFiveCooldown = 0; p.nightFiveTurns = 0; p.bite87Cooldown = 0;
  p.tuneDeafTurns=0;p.offBeatTurns=0;p.moonWalkCooldown = 0; p.beatItCooldown = 0;p.gloveHype=0;p.flowReady=false;p.flowPerfectThisMove=false;p.finalShowBonus=0;p.gloveMiniCooldowns={};p.gloveKidCooldown=0;p.booooCooldown=0;p.thrillerUsedThisTurn=false;
  p.thrillerNightUsed = false; p.thrillerNightActive = false; p.thrillerNightTurns = 0;
  p.revivalChecked = false;
  p.nightFiveActiveThisTurn = false; p.actionsRemaining = 1;
  p.lightsOut = false;
  p.sixEyesTurns = 0; p.sixEyesCooldown = 0; p.infinityHits = 0;
  p.cursedEnergy=8;p.positiveEnergy=0;p.cursedMax=8;p.overEnergy=0;p.judasTurns=0;p.blueCharges=0;p.redCharges=0;p.rctHealTurns=0;p.pulled=0;p.offBalance=0;p.judasMiniCooldown=0;
  p.maxRedCooldown = 0; p.maxBlueCooldown = 0;
  p.dismantleCooldown = 0;p.cleaveCooldown=0;p.fugaCooldown=0;p.scored=0;p.burnMultiplier=1;
  p.bindingVowUses = 0; p.bindingVowUsesThisTurn = 0;
  p.kingTurns = 0; p.kingCooldown = 0;
  p.domainAvailable = false; p.domainCharging = false; p.domainChargeProgress = 0; p.domainKind = null; p.domainChargeMode = null; p.domainOfferHandled = false;
  p.rctCooldown = 0;
  p.umbrellaCooldown = 0; p.umbrellaFarTurns = 0; p.umbrellaDodgeReady = false;p.umbrellaGuardPct=0;p.umbrellaCounter=0;p.magicMirrorReady=false;p.windblown=false;p.distracted=false;p.spotlightReady=0;p.footworkCooldown=0;p.rocketStolen=null;p.rocketMoveBlocked=null;
  p.danceBattleCooldown = 0;
  p.mambaCooldown = 0; p.mambaStrikeCooldown = 0; p.mambaTurns = 0; p.mambaDefenceRemaining = 0;
  p.spiderTurns=0;p.spiderDodgeReady=false;p.groovinTurns=0;p.groovinBlocked=null;
  p.deathRayCooldown = 0; p.deathRayBeamBonus = 0; p.beamCooldownBypass = false;
  p.decoyStacks = 0;
  p.presentationChain = [];
  p.upgradedMagicBagTurns = 0; p.goldenAppleTurns = 0; p.shopSkipTurns = 0; p.realitySealedButtons = []; p.realitySealTurns = {};
  p.magicBagItem = null; p.magicDiceBonus = false; p.inventory = []; p.magicBagRecent = {};
  p.pendingCompanionItem = null; p.pendingCompanionItemSource = null; p.pendingCompanionConsumesMove = false;
  p.companion = null; p.heldByCompanionOwner = null; p.heldStacks = 0;
  p.companionMovesUsedThisTurn = 0; p.companionMovesLimit = 0; p.companionCooldown = 0;
  p.activePokemon = null; p.pokemonLast = null; p.pokemonLastMove = null; p.pokemonRepeatTax = 0; p.pokemonPP = initialPokemonPP(); p.pokemonHP = initialPokemonHP(); p.snorlaxCounter = 0;
  p.parryReady = false; p.parryCooldown = 0; p.heavyCooldown = 0;
  p.gamblerCooldowns={blackjack:0,poker:0,double:0,roulette:0};p.badLuck=0;p.fortune=0;p.doubleOrNothing=false;p.coinFlips=0;p.coinMultiplier=1;
  p.pokerAttackBonus=0;p.jackpotTurns=0;p.jackpotHealTurns=0;p.jackpotHealUsed=false;p.jackpotDanceUsed=false;
  p.gamblerDomainCharge=0;p.gamblerDomainDamage=0;p.gamblerMisses=0;p.gamblerGuaranteedSevens=false;
  p.lastClashPressAt = 0;
}

function resetBattlePlayerExact(p, snapshot){
  const keepSetup = {...p.setup};
  resetBattlePlayer(p);
  p.setup = keepSetup;
  p.name = snapshot.name;
  p.hp = snapshot.maxHp;
  p.maxHp = snapshot.maxHp;
  p.special = snapshot.special;
}
function prepareLobbyFromCurrent(room){
  room.status='lobby';room.phase='lobby';room.winner=null;room.endedBy=null;
  room.pendingAction=null;room.beamPending=null;room.clash=null;room.attackTiming=null;room.parryPending=null;room.hotPotato=null;room.danceBattle=null;room.moonWalk=null;room.beatIt=null;room.gloveMini=null;room.mambaTarget=null;room.presentationMini=null;room.deathRayGame=null;room.decoyPending=null;room.domain=null;room.domainClash=null;room.worldCutSlash=null;room.realityManipulation=null;room.anvilTiming=null;room.gamblerGame=null;room.roulette=null;room.judasMini=null;room.domainOffer=null;room.itemMini=null;room.itemReveal=null;
  room.players.forEach(p=>{
    if(!p)return;
    p.setup={name:p.name,hpMode:'fixed',hp:p.maxHp,special:p.special};
    p.ready=!!p.isBot;
  });
}
function makeRoom(code){
  return {
    code, createdAt: Date.now(), touchedAt: Date.now(),
    status: 'lobby', phase: 'lobby',
    players: [null,null], current: 0, winner: null, endedBy: null,
    funnyBusiness: true,
    infiniteUltimates: false,
    botMode: false, botSlot: null, botTimer: null,
    pendingAction: null, beamPending: null, clash: null, attackTiming: null, parryPending: null,
    hotPotato: null, danceBattle: null, moonWalk: null, beatIt: null, mambaTarget: null, presentationMini:null, deathRayGame: null, decoyPending: null, hollowPurple: null, worldCutSlash: null, realityManipulation: null, anvilTiming: null,
    domain: null, domainClash: null, domainOffer:null, gamblerGame:null,roulette:null,judasMini:null,itemMini:null,itemReveal:null,
    logs: [], chat: [], eventSeq: 0
  };
}
function logRoom(room, text, kind='info'){
  room.logs.push({id: ++room.eventSeq, text, kind, at: Date.now()});
  if(room.logs.length > 100) room.logs.splice(0, room.logs.length-100);
  room.touchedAt = Date.now();
}
function publicPlayer(p){
  if(!p) return null;
  return {
    slot:p.slot, connected:p.connected, disconnectedAt:p.disconnectedAt||null, ready:p.ready, isBot:!!p.isBot,
    setup:{name:p.setup.name,hpMode:p.setup.hpMode,hp:p.setup.hp,special:p.setup.special},
    name:p.name,hp:p.hp,maxHp:p.maxHp,defence:p.defence,defenceUses:p.defenceUses,momentum:p.momentum||0,defensiveStanceUsed:!!p.defensiveStanceUsed,defensiveStancePenalty:p.defensiveStancePenalty||0,armourDefenceLock:p.armourDefenceLock||0,nationalFlagUses:p.nationalFlagUses||0,teamRocketTurns:p.teamRocketTurns||0,
    charge:p.charge,beamCharge:p.beamCharge,beamCooldown:p.beamCooldown,
    energyLeak:p.energyLeak||0,adrenaline:!!p.adrenaline,
    gamblerCooldowns:{...p.gamblerCooldowns},badLuck:p.badLuck||0,fortune:p.fortune||0,doubleOrNothing:!!p.doubleOrNothing,coinFlips:p.coinFlips||0,coinMultiplier:p.coinMultiplier||1,
    pokerAttackBonus:p.pokerAttackBonus||0,doubleMultiplier:p.doubleMultiplier||1,doubleFail:!!p.doubleFail,jackpotTurns:p.jackpotTurns||0,jackpotHealTurns:p.jackpotHealTurns||0,jackpotHealUsed:!!p.jackpotHealUsed,jackpotDanceUsed:!!p.jackpotDanceUsed,
    gamblerDomainCharge:p.gamblerDomainCharge||0,gamblerDomainDamage:p.gamblerDomainDamage||0,
    gamblerMisses:p.gamblerMisses||0,gamblerLuckBonus:Math.min(30,(p.gamblerMisses||0)*3),
    gamblerGuaranteedSevens:!!p.gamblerGuaranteedSevens,
    stats:{...(p.stats||newBattleStats())},
    shock:p.shock,shockDie:p.shockDie,bleed:p.bleed,bleedDie:p.bleedDie,poison:p.poison,poisonDie:p.poisonDie,
    burn:p.burn,syringeDamageTurns:p.syringeDamageTurns,syringeHealTurns:p.syringeHealTurns,forcedSkip:p.forcedSkip,
    seduced:p.seduced,wet:p.wet||0,confusedMissTurns:p.confusedMissTurns,exhaustion:p.exhaustion||0,ptsd:p.ptsd||0,lastBattleButton:p.lastBattleButton||null,
    weakness:p.weakness,armourBreak:p.armourBreak,strengthen:p.strengthen,
    effectCooldowns:{...p.effectCooldowns},effectsButtonCooldown:p.effectsButtonCooldown||0,
    actionCooldown:p.actionCooldown,
    special:p.special,specialCooldown:p.specialCooldown,
    nightFiveCooldown:p.nightFiveCooldown,nightFiveTurns:p.nightFiveTurns,bite87Cooldown:p.bite87Cooldown||0,
    tuneDeafTurns:p.tuneDeafTurns||0,offBeatTurns:p.offBeatTurns||0,moonWalkCooldown:p.moonWalkCooldown||0,beatItCooldown:p.beatItCooldown||0,gloveHype:p.gloveHype||0,flowReady:!!p.flowReady,finalShowBonus:p.finalShowBonus||0,gloveMiniCooldowns:p.gloveMiniCooldowns||{},gloveKidCooldown:p.gloveKidCooldown||0,booooCooldown:p.booooCooldown||0,thrillerUsedThisTurn:!!p.thrillerUsedThisTurn,
    thrillerNightUsed:!!p.thrillerNightUsed,thrillerNightActive:!!p.thrillerNightActive,thrillerNightTurns:p.thrillerNightTurns||0,
    nightFiveActiveThisTurn:p.nightFiveActiveThisTurn,actionsRemaining:p.actionsRemaining,
    lightsOut:p.lightsOut,
    sixEyesTurns:p.sixEyesTurns,sixEyesCooldown:p.sixEyesCooldown,infinityHits:p.infinityHits||0,
    cursedEnergy:p.cursedEnergy||0,positiveEnergy:p.positiveEnergy||0,cursedMax:p.cursedMax||8,overEnergy:p.overEnergy||0,blueCharges:p.blueCharges||0,redCharges:p.redCharges||0,rctHealTurns:p.rctHealTurns||0,pulled:p.pulled||0,offBalance:p.offBalance||0,judasMiniCooldown:p.judasMiniCooldown||0,
    maxRedCooldown:p.maxRedCooldown||0,maxBlueCooldown:p.maxBlueCooldown||0,
    dismantleCooldown:p.dismantleCooldown||0,cleaveCooldown:p.cleaveCooldown||0,fugaCooldown:p.fugaCooldown||0,scored:p.scored||0,burnMultiplier:p.burnMultiplier||1,
    bindingVowUses:p.bindingVowUses||0,bindingVowUsesThisTurn:p.bindingVowUsesThisTurn||0,
    kingTurns:p.kingTurns,kingCooldown:p.kingCooldown,
    domainAvailable:p.domainAvailable,domainCharging:p.domainCharging,domainChargeProgress:p.domainChargeProgress,domainKind:p.domainKind,domainChargeMode:p.domainChargeMode,
    rctCooldown:p.rctCooldown,
    umbrellaCooldown:p.umbrellaCooldown,umbrellaFarTurns:p.umbrellaFarTurns,umbrellaDodgeReady:p.umbrellaDodgeReady,umbrellaGuardPct:p.umbrellaGuardPct||0,magicMirrorReady:!!p.magicMirrorReady,windblown:!!p.windblown,distracted:!!p.distracted,spotlightReady:p.spotlightReady||0,footworkCooldown:p.footworkCooldown||0,rocketStolen:p.rocketStolen?{move:p.rocketStolen.move,label:p.rocketStolen.label,turns:p.rocketStolen.turns}:null,rocketMoveBlocked:p.rocketMoveBlocked||null,
    danceBattleCooldown:p.danceBattleCooldown||0,
    mambaCooldown:p.mambaCooldown||0,mambaStrikeCooldown:p.mambaStrikeCooldown||0,mambaTurns:p.mambaTurns||0,mambaDefenceRemaining:p.mambaDefenceRemaining||0,
    spiderTurns:p.spiderTurns||0,spiderDodgeReady:!!p.spiderDodgeReady,groovinTurns:p.groovinTurns||0,groovinBlocked:p.groovinBlocked||null,
    deathRayCooldown:p.deathRayCooldown||0,deathRayBeamBonus:p.deathRayBeamBonus||0,beamCooldownBypass:!!p.beamCooldownBypass,
    decoyStacks:p.decoyStacks||0,
    presentationChain:Array.isArray(p.presentationChain)?[...p.presentationChain]:[],
    upgradedMagicBagTurns:p.upgradedMagicBagTurns||0,goldenAppleTurns:p.goldenAppleTurns||0,shopSkipTurns:p.shopSkipTurns||0,realitySealedButtons:Array.isArray(p.realitySealedButtons)?[...p.realitySealedButtons]:[],realitySealTurns:{...(p.realitySealTurns||{})},
    magicBagPending:!!p.magicBagItem,powerGloveReady:!!p.powerGloveReady,coinAttackMultiplier:p.coinAttackMultiplier||0,eightBallPrediction:p.eightBallPrediction?{choice:p.eightBallPrediction.choice}:null,eightBallVulnerable:!!p.eightBallVulnerable,candyRegen:p.candyRegen||0,magicDiceBonus:p.magicDiceBonus,inventoryCount:Array.isArray(p.inventory)?p.inventory.length:0,
    companionItemPending:!!p.pendingCompanionItem,
    companion:publicCompanion(p.companion),heldByCompanionOwner:Number.isInteger(p.heldByCompanionOwner)?p.heldByCompanionOwner:null,heldStacks:p.heldStacks||0,
    companionMovesUsedThisTurn:p.companionMovesUsedThisTurn||0,companionMovesLimit:p.companionMovesLimit||0,companionCooldown:p.companionCooldown||0,
    activePokemon:p.activePokemon||null,pokemonLast:p.pokemonLast||null,pokemonRepeatTax:p.pokemonRepeatTax||0,pokemonPP:p.pokemonPP||initialPokemonPP(),pokemonHP:p.pokemonHP||initialPokemonHP(),snorlaxCounter:p.snorlaxCounter||0,
    parryReady:!!p.parryReady,parryCooldown:p.parryCooldown||0,heavyCooldown:p.heavyCooldown||0
  };
}
const CIRCUIT = [
  {name:'Knuckle', hp:60, special:'berserker', guard:10, charge:8, heavy:58, tip:'Knuckle swings heavy. Build Defence before trading hits.'},
  {name:'Bulwark', hp:80, special:'ironwall', guard:76, charge:12, heavy:24, tip:'Bulwark stacks Defence. Use Armour Break to open a gap.'},
  {name:'Flux', hp:100, special:'arcanesurge', guard:23, charge:62, heavy:40, tip:'Flux builds charge for Beams. Watch the charge gauge and prepare your response.'}
];
function circuitRival(room){
  return CIRCUIT[room.circuitIndex];
}
function duelScore(room){
  const score=[...(room.duelScore||[0,0])];
  if(room.status==='finished'&&Number.isInteger(room.winner))score[room.winner]++;
  return score;
}
function publicRoom(room){
  return {
    code:room.code,serverTime:Date.now(),status:room.status,phase:room.phase,current:room.current,winner:room.winner,endedBy:room.endedBy,
    funnyBusiness:room.funnyBusiness!==false,
    infiniteUltimates:!!room.infiniteUltimates,
    duelScore:room.botMode?null:duelScore(room),
    circuit:circuitRival(room)?{stage:room.circuitIndex+1,total:CIRCUIT.length,tip:circuitRival(room).tip,next:CIRCUIT[room.circuitIndex+1]?.name||null}:null,
    botMode:!!room.botMode,botSlot:Number.isInteger(room.botSlot)?room.botSlot:null,
    pokemonRoster:POKEMON_PUBLIC,
    roulette:room.roulette?{id:room.roulette.id,owner:room.roulette.owner,startedAt:room.roulette.startedAt,deadline:room.roulette.deadline}:null,
    domainOffer:room.domainOffer?{id:room.domainOffer.id,initiator:room.domainOffer.initiator,defender:room.domainOffer.defender,cost:room.domainOffer.cost,deadline:room.domainOffer.deadline,fast:room.domainOffer.fast}:null,
    judasMini:room.judasMini?{id:room.judasMini.id,owner:room.judasMini.owner,kind:room.judasMini.kind,startedAt:room.judasMini.startedAt,deadline:room.judasMini.deadline,objects:room.judasMini.objects?[...room.judasMini.objects]:[],revealEndsAt:room.judasMini.revealEndsAt||0,sequence:room.judasMini.sequence?[...room.judasMini.sequence]:[],slashes:room.judasMini.slashes?[...room.judasMini.slashes]:[],pressed:room.judasMini.pressed?[...room.judasMini.pressed]:[]}:null,
    players:room.players.map(publicPlayer),
    itemMini:room.itemMini?{id:room.itemMini.id,owner:room.itemMini.owner,kind:room.itemMini.kind,startedAt:room.itemMini.startedAt,deadline:room.itemMini.deadline,choices:room.itemMini.choices||[],target:room.itemMini.target??null}:null,
    itemReveal:room.itemReveal&&room.itemReveal.until>Date.now()?{...room.itemReveal}:null,
    umbrellaMini:room.umbrellaMini?{id:room.umbrellaMini.id,owner:room.umbrellaMini.owner,startedAt:room.umbrellaMini.startedAt,deadline:room.umbrellaMini.deadline,interval:room.umbrellaMini.interval,step:Math.max(0,Math.min(3,Math.floor((Date.now()-room.umbrellaMini.startedAt)/room.umbrellaMini.interval))),direction:room.umbrellaMini.sequence[Math.max(0,Math.min(3,Math.floor((Date.now()-room.umbrellaMini.startedAt)/room.umbrellaMini.interval)))]}:null,
    gloveMini:room.gloveMini?{id:room.gloveMini.id,kind:room.gloveMini.kind,owner:room.gloveMini.owner,actor:room.gloveMini.actor,ready:room.gloveMini.ready,startedAt:room.gloveMini.startedAt,deadline:room.gloveMini.deadline,index:room.gloveMini.index,hits:room.gloveMini.hits,misses:room.gloveMini.misses,sequence:room.gloveMini.kind==='moon'?room.gloveMini.sequence:[],dir:room.gloveMini.sequence?.[room.gloveMini.index]??0,beatAt:room.gloveMini.beatAt||0,streak:room.gloveMini.streak||0,tilt:room.gloveMini.tilt||0,lean:room.gloveMini.lean||0,balance:room.gloveMini.balance||0,smooth:room.gloveMini.kind==='smooth'&&room.gloveMini.smooth?{...room.gloveMini.smooth}:null,feedback:room.gloveMini.feedback||'',feedbackAt:room.gloveMini.feedbackAt||0}:null,
    footworkMini:room.footworkMini?{id:room.footworkMini.id,owner:room.footworkMini.owner,startedAt:room.footworkMini.startedAt,preparationEndsAt:room.footworkMini.preparationEndsAt,revealEndsAt:room.footworkMini.revealEndsAt,deadline:room.footworkMini.deadline,sequence:room.footworkMini.sequence,pressed:[...room.footworkMini.pressed]}:null,
    pendingAction: room.pendingAction ? {
      slot:room.pendingAction.slot,type:room.pendingAction.type,
      check:{...room.pendingAction.check}
    } : null,
    attackTiming: room.attackTiming ? {id:room.attackTiming.id,slot:room.attackTiming.slot,style:room.attackTiming.style} : null,
    parryPending: room.parryPending ? {
      id:room.parryPending.id,attacker:room.parryPending.attacker,defender:room.parryPending.defender,
      label:room.parryPending.label,infinity:!!room.parryPending.infinity,bars:room.parryPending.difficulties.length,
      difficulties:room.parryPending.difficulties.map(x=>({duration:x.duration,window:x.window}))
    } : null,
    hotPotato: room.hotPotato ? {id:room.hotPotato.id,holder:room.hotPotato.holder,origin:room.hotPotato.origin,passes:room.hotPotato.passes} : null,
    danceBattle: room.danceBattle ? {
      id:room.danceBattle.id,
      initiator:room.danceBattle.initiator,
      startsAt:room.danceBattle.startsAt,
      misses:[...room.danceBattle.misses],
      limits:[...room.danceBattle.limits],
      index:[...room.danceBattle.index],
      notes:room.danceBattle.notes.map(n=>({i:n.i,dir:n.dir,hitAt:n.hitAt,travel:n.travel,window:n.window}))
    } : null,
    moonWalk: room.moonWalk ? {
      id:room.moonWalk.id,slot:room.moonWalk.slot,startsAt:room.moonWalk.startsAt,
      index:room.moonWalk.index,hits:room.moonWalk.hits,misses:room.moonWalk.misses,
      notes:room.moonWalk.notes.map(n=>({i:n.i,dir:n.dir,hitAt:n.hitAt,travel:n.travel,window:n.window}))
    } : null,
    beatIt: room.beatIt ? {
      id:room.beatIt.id,slot:room.beatIt.slot,index:room.beatIt.index,hits:room.beatIt.hits,
      startsAt:room.beatIt.startsAt,deadline:room.beatIt.deadline,currentLetter:room.beatIt.sequence[room.beatIt.index]||null
    } : null,
    mambaTarget: room.mambaTarget ? {
      id:room.mambaTarget.id,slot:room.mambaTarget.slot,startedAt:room.mambaTarget.startedAt,cycleMs:room.mambaTarget.cycleMs
    } : null,
    presentationMini:room.presentationMini?{id:room.presentationMini.id,slot:room.presentationMini.slot,kind:room.presentationMini.kind,startedAt:room.presentationMini.startedAt,deadline:room.presentationMini.deadline,hits:room.presentationMini.hits,shotsFired:room.presentationMini.shotsFired||0,shotsRemaining:15-(room.presentationMini.shotsFired||0),targets:room.presentationMini.targets?.map((t,i)=>({i,x:t.x,y:t.y,hit:!!t.hit,spawn:t.spawn}))||[],shipX:room.presentationMini.shipX||50,shipY:room.presentationMini.shipY||88}:null,
    deathRayGame: room.deathRayGame ? {
      id:room.deathRayGame.id,slot:room.deathRayGame.slot,hits:room.deathRayGame.hits,
      center:room.deathRayGame.center,width:room.deathRayGame.width,direction:room.deathRayGame.direction,
      startAngle:room.deathRayGame.startAngle,startedAt:room.deathRayGame.startedAt,rotationMs:room.deathRayGame.rotationMs
    } : null,
    decoyPending: room.decoyPending ? {
      id:room.decoyPending.id,attacker:room.decoyPending.attacker,defender:room.decoyPending.defender,
      choices:room.decoyPending.choices,label:room.decoyPending.label
    } : null,
    hollowPurple: room.hollowPurple ? {
      id:room.hollowPurple.id,slot:room.hollowPurple.slot,
      red:room.hollowPurple.red,blue:room.hollowPurple.blue,
      redLocked:!!room.hollowPurple.redLocked,blueLocked:!!room.hollowPurple.blueLocked,
      nextOrb:room.hollowPurple.nextOrb,lastUpdate:room.hollowPurple.lastUpdate,
      decayPerSec:room.hollowPurple.decayPerSec,phase:room.hollowPurple.phase,
      cinematicStartedAt:room.hollowPurple.cinematicStartedAt||null,
      resolveAt:room.hollowPurple.resolveAt||null
    } : null,
    worldCutSlash: room.worldCutSlash ? {
      id:room.worldCutSlash.id,slot:room.worldCutSlash.slot,startedAt:room.worldCutSlash.startedAt,
      stage:room.worldCutSlash.stage||'chant',timingStartedAt:room.worldCutSlash.timingStartedAt||null,
      slashStartedAt:room.worldCutSlash.slashStartedAt||null,grade:room.worldCutSlash.grade||null,
      resolveAt:room.worldCutSlash.resolveAt||null
    } : null,
    realityManipulation: room.realityManipulation ? {
      id:room.realityManipulation.id,slot:room.realityManipulation.slot,stage:room.realityManipulation.stage,
      startedAt:room.realityManipulation.startedAt,choiceAt:room.realityManipulation.choiceAt||null,
      choice:room.realityManipulation.choice||null,value:room.realityManipulation.value||null,deadline:room.realityManipulation.deadline||null,
      pulses:room.realityManipulation.pulses||[],scores:room.realityManipulation.scores||[0,0],pressed:room.realityManipulation.pressed?.map(a=>a.length)||[0,0]
    } : null,
    anvilTiming: room.anvilTiming ? {id:room.anvilTiming.id,slot:room.anvilTiming.slot,startedAt:room.anvilTiming.startedAt} : null,
    beamPending: room.beamPending ? {...room.beamPending} : null,
    clash: room.clash ? {
      id:room.clash.id,startsAt:room.clash.startsAt,endsAt:room.clash.endsAt,
      p1:room.clash.p1,p2:room.clash.p2,
      p1Roll:room.clash.p1Roll,p2Roll:room.clash.p2Roll,
      attacker:room.clash.attacker,defender:room.clash.defender
    } : null,
    domain: room.domain ? {...room.domain} : null,
    gamblerGame:room.gamblerGame?publicGamblerGame(room):null,
    domainClash: room.domainClash ? {
      id:room.domainClash.id,startsAt:room.domainClash.startsAt,endsAt:room.domainClash.endsAt,
      introEndsAt:room.domainClash.introEndsAt||null,
      matchupIntro:!!room.domainClash.matchupIntro,
      progress:[...room.domainClash.progress],
      target:room.domainClash.sequence.length,
      currentPrompt:room.phase==='domainClash'?[
        room.domainClash.sequence[room.domainClash.progress[0]] ?? null,
        room.domainClash.sequence[room.domainClash.progress[1]] ?? null
      ]:[null,null],
      initiator:room.domainClash.initiator,opponent:room.domainClash.opponent,
      types:[...room.domainClash.types]
    } : null,
    logs:room.logs.slice(-60),chat:room.chat.slice(-50)
  };
}
function emitState(room){
  room.touchedAt = Date.now();
  io.to(room.code).emit('room-state', publicRoom(room));
  if(room.gamblerGame?.type==='poker'){
    for(const player of room.players){if(player?.socketId&&!player.isBot)io.to(player.socketId).emit('gambler-private',{id:room.gamblerGame.id,cards:room.gamblerGame.hands[player.slot].map(GR.cardText)});}
  }
  if(room.gamblerGame&&room.gamblerGame.deadline&&!room.gamblerGame.timeoutScheduled){
    const game=room.gamblerGame,deadline=game.deadline;
    game.timeoutScheduled=true;
    scheduleGameTimer(()=>{
      const live=rooms.get(room.code),g=live?.gamblerGame;
      if(!g||g.id!==game.id||live.status!=='playing')return;
      g.timeoutScheduled=false;
      if(Date.now()<g.deadline-10){emitState(live);return;}
      if(g.type==='blackjack'){
        logRoom(live,'⌛ Blackjack decision timed out — standing on remaining hands.','info');
        g.hands.forEach(h=>h.finished=true);finishGamblerBlackjack(live);
      }else if(g.type==='poker'){
        logRoom(live,'⌛ Poker decision timed out — the inactive player folds.','info');
        finishGamblerPoker(live,1-g.acting,true);
      }
    },Math.max(300,deadline-Date.now()+50)).unref?.();
  }
  maybeScheduleBot(room);
}


function pokemonMoveInfo(p,moveId){
  const mon=POKEMON_ROSTER[p?.activePokemon];
  const move=mon?.moves?.[moveId];
  return mon&&move?{mon,move}:null;
}
function pokemonMoveCost(p,move){return (move?.cost||1)+(p?.pokemonLastMove===p?.activePokemon?1:0);}
function pokemonSpendPP(room,p,moveId){
  const info=pokemonMoveInfo(p,moveId);if(!info)return {error:'That move is not available from your active Pokémon.'};
  if(p.rocketMoveBlocked===`pokemon:${p.activePokemon}:${moveId}`)return {error:'🚀 Team Rocket stole this Pokémon move for three turns.'};
  const {move}=info,cost=pokemonMoveCost(p,move),current=Number(p.pokemonPP?.[p.activePokemon]?.[moveId]||0);
  if(current<cost)return {error:`${move.name} needs ${cost} PP this turn, but only ${current} PP remain.`};
  p.pokemonPP[p.activePokemon][moveId]=current-cost;
  p.pokemonLastMove=p.activePokemon;p.pokemonRepeatTax=1;
  logRoom(room,`🎒 ${p.name}'s ${info.mon.name} spends ${cost} PP on ${move.name} (${current} → ${current-cost}).${p.pokemonRepeatTax?' Repeat Pokémon tax is active.':''}`,'info');
  return {info,cost};
}
function pokemonRestoreCenter(room,p,selected){
  if(!Array.isArray(selected)||selected.length!==2||new Set(selected).size!==2||selected.some(id=>!Object.hasOwn(POKEMON_ROSTER,id)))return {error:'Choose exactly two different Pokémon to restore PP.'};
  let restored=0;
  for(const [pid,mon] of Object.entries(POKEMON_ROSTER).filter(([id])=>selected.includes(id))){
    for(const [mid,m] of Object.entries(mon.moves)){
      const before=Number(p.pokemonPP?.[pid]?.[mid]||0),after=Math.min(m.pp,before+1);
      if(!p.pokemonPP[pid])p.pokemonPP[pid]={};
      p.pokemonPP[pid][mid]=after;restored+=after-before;
    }
  }
  logRoom(room,`🏥 PokéCenter restores ${restored} total PP to ${selected.map(id=>POKEMON_ROSTER[id].name).join(' and ')} and costs the entire turn.`,'good');
  loseMomentumForNonAttack(room,p,'PokéCenter');fullEndTurn(room);
  return {ok:true};
}
function pokemonHealCenter(room,p,id){
  const mon=POKEMON_ROSTER[id];if(!mon)return {error:'Choose a valid Pokémon to heal.'};
  if(!p.pokemonHP)p.pokemonHP=initialPokemonHP();
  const before=clamp(Number(p.pokemonHP[id]??mon.maxHp),0,mon.maxHp);
  if(before>=mon.maxHp)return {error:`${mon.name} is already at full HP.`};
  p.pokemonHP[id]=mon.maxHp;
  logRoom(room,`🏥 PokéCenter heals ${mon.name} from ${before} → ${mon.maxHp}/${mon.maxHp} HP. This costs ${p.name}'s entire turn.`,'good');
  loseMomentumForNonAttack(room,p,'PokéCenter');fullEndTurn(room);
  return {ok:true};
}
function choosePokemonForTurn(room,p,id){
  const mon=POKEMON_ROSTER[id];if(!mon)return {error:'Unknown Pokémon.'};
  if(!p.pokemonHP)p.pokemonHP=initialPokemonHP();
  if(Number(p.pokemonHP[id]||0)<=0)return {error:`${mon.name} has fainted. Use PokéCenter to heal it before selecting it again.`};
  if(p.activePokemon===id&&room.phase==='turn')return {error:'That Pokémon is already active.'};
  p.activePokemon=id;p.pokemonRepeatTax=p.pokemonLastMove===id?1:0;p.pokemonLast=id;
  room.phase='turn';
  logRoom(room,`${mon.icon} ${p.name} switches to ${mon.name} — ${mon.role}, without spending a move.`,'special');
  emitState(room);return {ok:true};
}
function applyPokemonEffect(room,p,d,move,effectProtected){
  if(!move.effect)return;
  const lands=move.effectChance>=100||rollShown(room,2,`${move.name} effect check`)===1;
  if(!lands){logRoom(room,`✨ ${move.name}'s ${move.effect} rider does not trigger.`,'info');return;}
  if(effectProtected){logRoom(room,`🛡️ ${d.name}'s Companion shield blocks ${move.name}'s ${move.effect} effect.`,'special');return;}
  if(move.effect==='shock'){
    d.shock=Math.max(d.shock,move.effectTurns||2);d.conductiveUsed=false;
    resolveStatusCombos(room,d);d.shockDie=4;
    logRoom(room,`⚡ ${move.name} inflicts Shock for ${move.effectTurns||2} turns.`,'bad');
  }else if(move.effect==='poison'){
    d.poison=Math.max(d.poison,move.effectTurns||2);d.poisonDie=4;
    resolveStatusCombos(room,d);
    logRoom(room,`☠️ ${move.name} inflicts Poison for ${move.effectTurns||2} turns.`,'bad');
  }else if(move.effect==='burn'){
    d.burn=Math.max(d.burn,move.effectTurns||2);
    resolveStatusCombos(room,d);
    logRoom(room,`🔥 ${move.name} inflicts Burn for ${move.effectTurns||2} turns.`,'bad');
  }else if(move.effect==='weakness'){
    d.weakness=Math.max(d.weakness,move.effectTurns||2);
    logRoom(room,`📉 ${move.name} inflicts Weakness for ${move.effectTurns||2} turns.`,'bad');
  }else if(move.effect==='wet'){
    d.wet=Math.max(d.wet||0,move.effectTurns||2);
    resolveStatusCombos(room,d);
    logRoom(room,`💧 ${move.name} inflicts Wet for ${move.effectTurns||2} turns. Wet reduces Defence gained from rolls by 2.`,'bad');
  }else if(move.effect==='armourbreak'){
    d.armourBreak=Math.max(d.armourBreak,move.effectTurns||2);d.armourDefenceLock=1;
    const {before}=halveDefenceForArmourBreak(d);
    logRoom(room,`💔 ${move.name} inflicts Armour Break for ${move.effectTurns||2} turns; Defence ${before} → ${d.defence}.`,'bad');
  }
}
function executePokemonDamageMove(room,p,info){
  const d=room.players[1-room.current],move=info.move;
  let raw=rollRangeShown(room,move.min,move.max,`${info.mon.name} — ${move.name}`);
  if(move.water&&d.special==='nightcrawler'){const before=raw;raw=Math.ceil(raw*1.5);logRoom(room,`💧 Nightcrawler is weak to Water: ${move.name} ${before} → ${raw} damage.`,'special');}
  const effectProtected=companionEffectShieldActive(d);
  if(move.momentum){const mom=addMomentum(p,move.momentum);if(mom.gained)logRoom(room,`⚡ ${move.name} builds ${mom.gained}% Momentum (${mom.before}% → ${mom.after}%).`,'good');}
  const finalize=(parryResults=null)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🗡️ ${d.name} PARRIES ${info.mon.name}'s ${move.name}!`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY POKÉMON!',amount:0,perfect:true});
      finishAction(room,false,true);return;
    }
    const res=absorbAttack(room,d,raw,p,{normalAttack:false});
    const damage=res.damage+(attempted?1:0);
    hurtFighter(room,d,damage);
    reflectSeduced(room,p,damage,move.name);
    if(attempted)logRoom(room,`💢 ${d.name} misses the Parry and takes +1 extra damage.`,'bad');
    const landed=!res.confusedMiss&&!res.umbrellaDodge&&!res.sixEyes&&!res.umbrellaDistance;
    if(landed)applyPokemonEffect(room,p,d,move,effectProtected);
    if(move.recoil){const before=p.hp;hurtFighter(room,p,move.recoil);logRoom(room,`⚡ Volt Tackle recoil costs ${p.name} ${before-p.hp} HP.`,'bad');}
    logRoom(room,`${info.mon.icon} ${p.name}'s ${info.mon.name} uses ${move.name}: ${raw} raw; ${d.name} takes ${damage}.`,'special');
    if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`BLOCK ${res.blocked}`,amount:res.blocked});
    emitCombatFx(room,{kind:'pokemon',attacker:p.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:!landed,critical:false,label:move.name});
    interruptDomainCharge(room,d,damage);
    if(checkWinner(room)){emitState(room);return;}
    finishAction(room,false,true);
  };
  if(p.confusedMissTurns<=0&&maybeStartParry(room,{attacker:p.slot,defender:d.slot,label:move.name,hits:[raw],onResolve:finalize}))return {ok:true,deferred:true};
  finalize(null);return {ok:true};
}
function usePokemonMove(room,p,moveId){
  if(p.special!=='pokemontrainer')return {error:'Only Pokémon Trainer can use Pokémon moves.'};
  if(!p.activePokemon)return {error:'Choose a Pokémon for this turn first.'};
  const spent=pokemonSpendPP(room,p,moveId);if(spent.error)return spent;
  const {info}=spent,move=info.move,d=room.players[1-room.current];
  if(move.kind==='damage')return executePokemonDamageMove(room,p,info);
  if(moveId==='block'){
    const before=p.defence;p.defence=clamp(p.defence+8,0,20);p.snorlaxCounter=3;
    logRoom(room,`🛡️ Snorlax uses Block: Defence ${before} → ${p.defence}/20. The next direct attacker will take 3 retaliation damage.`,'special');
    finishAction(room,false);return {ok:true};
  }
  if(moveId==='rest'){
    const before=p.hp;p.hp=clamp(p.hp+10,0,p.maxHp);const db=p.defence;p.defence=clamp(p.defence+3,0,20);
    logRoom(room,`💤 Snorlax uses Rest: HP ${before} → ${p.hp}; Defence ${db} → ${p.defence}.`,'good');
    finishAction(room,false);return {ok:true};
  }
  if(moveId==='seduce'){
    if(companionBlocksEffect(room,d,'Vaporeon Seduce')){finishAction(room,false,true);return {ok:true};}
    const finalize=(parryResults=null)=>{
      const attempted=Array.isArray(parryResults);
      if(attempted&&parryResults[0]){logRoom(room,`🗡️ ${d.name} PARRIES Vaporeon's Seduce!`,'special');finishAction(room,false,true);return;}
      if(attempted){hurtFighter(room,d,1);logRoom(room,`💢 ${d.name} misses the Seduce Parry and takes +1 damage.`,'bad');}
      if(rollShown(room,2,'Vaporeon Seduce check')===1){const turns=rollShown(room,4,'Seduced duration');d.seduced=Math.max(d.seduced,turns);logRoom(room,`💘 Vaporeon's Seduce works! ${d.name} is Seduced for ${turns} turn(s).`,'special');}
      else logRoom(room,`💧 Vaporeon's Seduce fails to affect ${d.name}.`,'info');
      if(checkWinner(room)){emitState(room);return;}finishAction(room,false,true);
    };
    if(maybeStartParry(room,{attacker:p.slot,defender:d.slot,label:'Vaporeon Seduce',hits:[7],effectOnly:true,onResolve:finalize}))return {ok:true,deferred:true};
    finalize(null);return {ok:true};
  }
  if(moveId==='hypnosis'){
    if(companionBlocksEffect(room,d,'Hypnosis')){finishAction(room,false,true);return {ok:true};}
    const finalize=(parryResults=null)=>{
      const attempted=Array.isArray(parryResults);
      if(attempted&&parryResults[0]){logRoom(room,`🗡️ ${d.name} PARRIES Hypnosis!`,'special');finishAction(room,false,true);return;}
      if(attempted){hurtFighter(room,d,1);logRoom(room,`💢 ${d.name} misses the Hypnosis Parry and takes +1 damage.`,'bad');}
      if(rollShown(room,2,'Hypnosis sleep check')===1){d.forcedSkip=Math.max(d.forcedSkip,1);logRoom(room,`😵‍💫 Gengar's Hypnosis succeeds — ${d.name} will lose their next turn.`,'bad');}
      else logRoom(room,`👻 Hypnosis fails to fully take hold.`,'info');
      if(checkWinner(room)){emitState(room);return;}finishAction(room,false,true);
    };
    if(maybeStartParry(room,{attacker:p.slot,defender:d.slot,label:'Hypnosis',hits:[8],onResolve:finalize}))return {ok:true,deferred:true};
    finalize(null);return {ok:true};
  }
  return {error:'Unknown Pokémon move.'};
}
function botGrade(){
  const n=roll(100);
  return n<=20?'perfect':n<=66?'good':'bad';
}
function botButtonAllowed(p,name){
  return !battleButtonGuard(p,name);
}
function botReleaseHold(room,p){
  const ownerSlot=p.heldByCompanionOwner;
  if(!Number.isInteger(ownerSlot))return false;
  const owner=room.players[ownerSlot];
  p.heldStacks=Math.max(0,(p.heldStacks||1)-1);
  if(p.heldStacks<=0){
    if(owner?.companion?.holdingSlot===p.slot)owner.companion.holdingSlot=null;
    p.heldByCompanionOwner=null;
    logRoom(room,`🤖 ${p.name} uses Release Themselves and breaks free.`,'good');
  }else{
    logRoom(room,`🤖 ${p.name} breaks one Hold; ${p.heldStacks} remain.`,'good');
  }
  finishAction(room,false);
  return true;
}
function botAttack(room,p){
  if(!botButtonAllowed(p,'Attack'))return false;
  let style='normal';
  if(p.charge==='ready'&&botButtonAllowed(p,'Charge')&&roll(100)<=42)style='charged';
  else if(p.heavyCooldown<=0&&roll(100)<=(circuitRival(room)?.heavy??30))style='heavy';
  if(style==='heavy')p.heavyCooldown=2;
  markBattleButton(p,style==='charged'?'Charge':'Attack',room);
  const target=room.players[1-p.slot];
  const begin=()=>{
    const grades=style==='heavy'?Array.from({length:4},botGrade):[botGrade()];
    logRoom(room,`🤖 ${p.name} chooses ${style==='heavy'?'Heavy Attack':style==='charged'?'Charged Attack':'Normal Attack'}.`,'info');
    resolveTimingAttack(room,style,grades);
  };
  if(maybeStartDecoy(room,{
    attacker:p.slot,defender:target.slot,label:style==='heavy'?'Heavy Attack':style==='charged'?'Charged Attack':'Normal Attack',
    onSuccess:begin,
    onMiss:()=>{
      if(style==='charged')p.charge='none';
      const mom=addMomentum(p,8);
      logRoom(room,`🎭 ${p.name}'s attack hits a Decoy and misses. Momentum ${mom.before}% → ${mom.after}%.`,'special');
      finishAction(room,false,true);
    }
  }))return true;
  begin();return true;
}
function botTrySpecial(room,p){
  if(!botButtonAllowed(p,'Special'))return false;
  let move=null;
  if(['berserker','ironwall','arcanesurge','trickster'].includes(p.special)){
    if(p.specialCooldown<=0)move='generic';
  }else if(p.special==='nightcrawler'){
    if(!p.lightsOut&&p.specialCooldown<=0)move='lightsout';
    else if(p.effectCooldowns.shock<=0)move='shock';
  }else if(p.special==='bluejudas'){
    if(p.hp<p.maxHp*.42&&p.sixEyesTurns>0&&p.rctCooldown<=0)move='rct';
    else if(p.sixEyesTurns<=0&&p.sixEyesCooldown<=0)move='sixeyes';
    else if(p.maxBlueCooldown<=0&&roll(2)===1)move='maxblue';
    else if(p.maxRedCooldown<=0)move='maxred';
  }else if(p.special==='redjudas'){
    if(p.hp<p.maxHp*.42&&p.kingTurns>0&&p.rctCooldown<=0)move='rct';
    else if(p.kingTurns<=0&&p.kingCooldown<=0)move='king';
    else if(p.dismantleCooldown<=0)move='dismantle';
  }else if(p.special==='greatexception'){
    if(p.upgradedMagicBagTurns>0&&!p.magicBagItem&&roll(100)<=70)move='magicbag';
    else if(p.umbrellaCooldown<=0)move='umbrella';
  }else if(p.special==='glovedone'){
    const hasBad=p.shock||p.bleed||p.poison||p.burn||p.seduced||p.confusedMissTurns||p.weakness||p.armourBreak||p.exhaustion||p.ptsd;
    if(hasBad)move='kid';
  }else if(p.special==='masterpresentation'){
    move='decoy';
  }else if(p.special==='pokemontrainer'){
    const mon=POKEMON_ROSTER[p.activePokemon];
    if(mon){
      const usable=Object.values(mon.moves).filter(m=>Number(p.pokemonPP?.[p.activePokemon]?.[m.id]||0)>=pokemonMoveCost(p,m));
      if(usable.length)move=usable[roll(usable.length)-1].id;
      else move='pokemoncenter';
    }
  }
  if(!move)return false;
  const r=doSpecial(room,move==='generic'?'':move);
  if(r?.error)return false;
  markBattleButton(p,'Special',room);
  logRoom(room,`🤖 ${p.name} uses a Special ability.`,'info');
  return true;
}
function botTryUltimate(room,p){
  if(!['bluejudas','redjudas','greatexception'].includes(p.special))return false;
  if(!botButtonAllowed(p,'Ultimate'))return false;
  if(!room.infiniteUltimates&&(p.momentum||0)<100)return false;
  if(roll(100)>28)return false;
  const r=startUltimate(room,p);
  if(r?.error)return false;
  markBattleButton(p,'Ultimate',room);
  return true;
}
function botTakeTurn(room){
  if(!room?.botMode||room.status!=='playing'||room.winner!==null)return;
  const p=room.players[room.current];
  if(!p?.isBot||room.phase!=='turn')return;
  if(botReleaseHold(room,p))return;

  // Ready Beams are tempting and keep the bot's Charge path meaningful.
  if(p.beamCharge==='ready'&&(p.beamCooldown===0||p.beamCooldownBypass)&&botButtonAllowed(p,'Charge')&&roll(100)<=58){
    markBattleButton(p,'Charge',room);
    const r=fireBeam(room,false,20);
    if(!r?.error){emitState(room);return;}
  }
  if(botTryUltimate(room,p))return;
  if(roll(100)<=28&&botTrySpecial(room,p))return;

  if(p.defence<5&&botButtonAllowed(p,'Defence')&&roll(100)<=(circuitRival(room)?.guard??38)){
    markBattleButton(p,'Defence',room);doDefend(room,6,false);return;
  }
  if(p.parryCooldown<=0&&!p.parryReady&&botButtonAllowed(p,'Defence')&&roll(100)<=16){
    markBattleButton(p,'Defence',room);doParry(room);return;
  }
  if(botButtonAllowed(p,'Charge')&&roll(100)<=(circuitRival(room)?.charge??18)){
    const r=doCharge(room,false);
    if(!r?.error){markBattleButton(p,'Charge',room);return;}
  }
  if(botAttack(room,p))return;
  // PTSD or unusual state can block Attack; fall back to Guard, then Charge.
  if(botButtonAllowed(p,'Defence')){markBattleButton(p,'Defence',room);doDefend(room,6,false);return;}
  if(botButtonAllowed(p,'Charge')){const r=doCharge(room,false);if(!r?.error){markBattleButton(p,'Charge',room);return;}}
  fullEndTurn(room);
}
function botDanceStep(room,slot){
  const db=room.danceBattle;if(!db||room.phase!=='danceBattle')return;
  const idx=db.index[slot],note=db.notes[idx];if(!note)return;
  const hit=roll(100)<=82;
  if(hit){db.index[slot]++;logRoom(room,`🤖🎵 ${room.players[slot].name} hits dance note ${idx+1}.`,'good');}
  else{applyDanceMiss(room,slot,'misses a dance note');db.index[slot]++;}
  if(db.misses[slot]>=db.limits[slot]){finishDanceBattle(room,slot);return;}
  emitState(room);
}
function botClashPress(room,slot){
  const c=room.clash;if(!c||room.phase!=='clash'||Date.now()>=c.endsAt)return;
  if(slot===0)c.p1++;else c.p2++;
  io.to(room.code).emit('clash-update',{id:c.id,p1:c.p1,p2:c.p2,endsAt:c.endsAt});
  maybeScheduleBot(room);
}
function runBot(room){
  if(!room?.botMode||room.status!=='playing'||room.winner!==null)return;
  const slot=room.botSlot,bot=room.players[slot];if(!bot?.isBot)return;
  if(room.phase==='itemMini'&&room.itemMini?.owner===slot){const mini=room.itemMini;if(Date.now()<mini.startedAt){scheduleGameTimer(()=>{if(rooms.get(room.code)?.itemMini?.id===mini.id)runBot(room);},mini.startedAt-Date.now()+10);return;}resolveItemMini(room,slot,mini.kind==='candy'?{target:'self'}:mini.kind==='eightball'?{choice:mini.choices[0]}:mini.kind==='deck'?{index:crypto.randomInt(5)}:{});return;}
  if(room.phase==='umbrellaMini'&&room.umbrellaMini?.owner===slot){room.umbrellaMini.pressed={0:true,1:true};resolveUmbrellaMini(room);return;}
  if(room.phase==='footworkMini'&&room.footworkMini?.owner===slot){room.footworkMini.pressed=[...room.footworkMini.sequence];resolveFootworkMini(room);return;}
  if(room.phase==='judasMinigame'&&room.judasMini?.owner===slot){if(['dismantle','cleave','fuga'].includes(room.judasMini.kind)){room.judasMini.pressed=room.judasMini.kind==='cleave'?[true,true,false]:[...room.judasMini.sequence];resolveRedJudasMini(room);}else resolveJudasMini(room,roll(3)===1?'perfect':'good');return;}
  if(room.phase==='gamblerRoulette'&&room.roulette?.owner===slot){roulettePlaceBet(room,slot,'red',0);return;}
  if(room.phase==='gamblerPoker'&&room.gamblerGame?.acting===slot){
    const g=room.gamblerGame;
    pokerAct(room,slot,g.lastBet>g.streetBets[slot]?'call':'check');return;
  }
  if(room.phase==='gamblerBlackjack'&&room.gamblerGame?.owner===slot){
    const g=room.gamblerGame,h=g.hands[g.turn];
    blackjackAct(room,GR.blackjackTotal(h.cards).total<17?'hit':'stand');return;
  }
  if(room.phase==='gamblerSlot'&&room.current===slot){spinGamblerDomain(room,bot);return;}
  if(room.phase==='pokemonChoose'&&room.current===slot&&bot.special==='pokemontrainer'){
    if(!bot.pokemonHP)bot.pokemonHP=initialPokemonHP();
    const living=Object.keys(POKEMON_ROSTER).filter(id=>Number(bot.pokemonHP[id]||0)>0);
    if(!living.length){pokemonHealCenter(room,bot,'snorlax');return;}
    const target=room.players[1-slot];
    const preferred=bot.hp<bot.maxHp*.4?'snorlax':target.hp<target.maxHp*.38?'charizard':bot.momentum<50?'pikachu':['pikachu','gengar','charizard','snorlax','vaporeon'][roll(5)-1];
    const pick=living.includes(preferred)?preferred:living[roll(living.length)-1];
    choosePokemonForTurn(room,bot,pick);return;
  }
  if(room.phase==='domainResponse'&&room.domainOffer?.defender===slot){resolveDomainOffer(room,slot,bot.cursedEnergy>=room.domainOffer.cost&&roll(100)<=45?'clash':'take');return;}
  if(room.phase==='parryResponse'&&room.parryPending?.defender===slot){
    const positions=room.parryPending.difficulties.map(()=>roll(100)<=58?50:0);
    resolveParryPending(room,positions);return;
  }
  if(room.phase==='beamResponse'&&room.beamPending?.defender===slot){resolveBeamHit(room);return;}
  if(room.phase==='decoyChoice'&&room.decoyPending?.attacker===slot){resolveDecoyChoice(room,roll(room.decoyPending.choices)-1);return;}
  if(room.phase==='hotPotato'&&room.hotPotato?.holder===slot){passHotPotato(room,slot);return;}
  if(room.phase==='danceBattle'&&room.danceBattle){botDanceStep(room,slot);return;}
  if(room.phase==='clash'&&room.clash&&(room.clash.attacker===slot||room.clash.defender===slot)){botClashPress(room,slot);return;}
  if(room.phase==='domainChargeTurn'&&room.current===slot){completeDomainChargeTurn(room);return;}
  if(room.phase==='companionOnly'&&room.current===slot){fullEndTurn(room);return;}
  if(room.phase==='ultimateHollowPurple'&&room.hollowPurple?.slot===slot){
    const hp=room.hollowPurple;updateHollowPurpleDecay(hp);
    if(!hp.redLocked){hp.red=Math.min(100,hp.red+20);if(hp.red>=100){hp.red=100;hp.redLocked=true;}hp.nextOrb='blue';}
    else if(!hp.blueLocked){hp.blue=Math.min(100,hp.blue+20);if(hp.blue>=100){hp.blue=100;hp.blueLocked=true;}hp.nextOrb='red';}
    hp.lastUpdate=Date.now();
    if(hp.redLocked&&hp.blueLocked){beginHollowPurpleCinematic(room);return;}
    emitState(room);return;
  }
  if(room.phase==='ultimateWorldCuttingSlash'&&room.worldCutSlash?.slot===slot&&room.worldCutSlash.stage==='timing'){
    beginWorldSlashStrike(room,room.worldCutSlash.id,botGrade());return;
  }
  if(room.phase==='ultimateRealityManipulation'&&room.realityManipulation?.stage==='choice'&&room.realityManipulation.slot===slot){
    beginRealityContest(room,bot,'hp');return;
  }
  if(room.phase==='ultimateRealityManipulation'&&room.realityManipulation?.stage==='contest'){
    const rm=room.realityManipulation,now=Date.now();
    if(rm.pulses.some((time,i)=>Math.abs(now-time)<220&&!rm.pressed[slot].includes(i)))pressRealityPulse(room,slot);
    return;
  }
  if(room.phase==='magicBagChoice'&&room.current===slot&&bot.magicBagItem){
    const item=magicItemById(bot.magicBagItem);bot.magicBagItem=null;room.phase='turn';
    const result=useMagicBagItem(room,bot,item)||{deferred:false};
    if(!result.deferred){if(checkWinner(room)){emitState(room);return;}finishAction(room,false);}
    return;
  }
  if(room.phase==='anvilTiming'&&room.anvilTiming?.slot===slot){resolveAnvilTiming(room,room.anvilTiming.id,botGrade());return;}
  if(room.phase==='turn'&&room.current===slot){botTakeTurn(room);return;}
}
function maybeScheduleBot(room){
  if(!room?.botMode||room.status!=='playing'||room.winner!==null||room.botTimer)return;
  const slot=room.botSlot,bot=room.players[slot];if(!bot?.isBot)return;
  let involved=false,delay=620;
  if(room.phase==='turn'&&room.current===slot)involved=true;
  else if(room.phase==='gamblerPoker'&&room.gamblerGame?.acting===slot){involved=true;delay=850;}
  else if(room.phase==='judasMinigame'&&room.judasMini?.owner===slot){involved=true;delay=1500;}
  else if(room.phase==='gamblerRoulette'&&room.roulette?.owner===slot){involved=true;delay=900;}
  else if(room.phase==='gamblerBlackjack'&&room.gamblerGame?.owner===slot){involved=true;delay=850;}
  else if(room.phase==='gamblerSlot'&&room.current===slot){involved=true;delay=850;}
  else if(room.phase==='pokemonChoose'&&room.current===slot){involved=true;delay=450;}
  else if(room.phase==='domainChargeTurn'&&room.current===slot)involved=true;
  else if(room.phase==='companionOnly'&&room.current===slot)involved=true;
  else if(room.phase==='parryResponse'&&room.parryPending?.defender===slot){involved=true;delay=850;}
  else if(room.phase==='beamResponse'&&room.beamPending?.defender===slot){involved=true;delay=700;}
  else if(room.phase==='decoyChoice'&&room.decoyPending?.attacker===slot){involved=true;delay=700;}
  else if(room.phase==='hotPotato'&&room.hotPotato?.holder===slot){involved=true;delay=650;}
  else if(room.phase==='ultimateHollowPurple'&&room.hollowPurple?.slot===slot){involved=true;delay=120;}
  else if(room.phase==='ultimateWorldCuttingSlash'&&room.worldCutSlash?.slot===slot&&room.worldCutSlash.stage==='timing'){involved=true;delay=520;}
  else if(room.phase==='ultimateRealityManipulation'&&room.realityManipulation?.stage==='choice'&&room.realityManipulation.slot===slot){involved=true;delay=650;}
  else if(room.phase==='ultimateRealityManipulation'&&room.realityManipulation?.stage==='contest'){const rm=room.realityManipulation,next=rm.pulses.find((t,i)=>!rm.pressed[slot].includes(i)&&t>Date.now()-220);if(next){involved=true;delay=Math.max(80,next-Date.now());}}
  else if(room.phase==='magicBagChoice'&&room.current===slot){involved=true;delay=650;}
  else if(room.phase==='anvilTiming'&&room.anvilTiming?.slot===slot){involved=true;delay=700;}
  else if(room.phase==='itemMini'&&room.itemMini?.owner===slot){involved=true;delay=Math.max(700,room.itemMini.startedAt-Date.now()+50);}
  else if(room.phase==='clash'&&room.clash&&(room.clash.attacker===slot||room.clash.defender===slot)){involved=true;delay=95;}
  else if(room.phase==='danceBattle'&&room.danceBattle){
    const note=room.danceBattle.notes[room.danceBattle.index[slot]];
    if(note){involved=true;delay=Math.max(30,rhythmTargetTime(note)-Date.now());}
  }
  if(!involved)return;
  room.botTimer=scheduleGameTimer(()=>{
    room.botTimer=null;
    const live=rooms.get(room.code);if(live)runBot(live);
  },delay);
}

function fail(ack, message){ if(typeof ack==='function') ack({ok:false,error:message}); }
function ok(ack, extra={}){ if(typeof ack==='function') ack({ok:true,...extra}); }

function getRoomForSocket(socket){
  const code = socket.data.roomCode;
  const slot = socket.data.slot;
  const room = code && rooms.get(code);
  if(!room || !Number.isInteger(slot) || !room.players[slot]) return null;
  if(room.players[slot].token !== socket.data.token || room.players[slot].socketId !== socket.id) return null;
  return room;
}
function requireTurn(socket, ack){
  const room = getRoomForSocket(socket);
  if(!room) { fail(ack,'You are not in a room.'); return null; }
  if(room.status!=='playing' || room.phase!=='turn') { fail(ack,'The game is not accepting turn actions right now.'); return null; }
  if(room.current!==socket.data.slot) { fail(ack,'It is not your turn.'); return null; }
  if(room.winner!==null) { fail(ack,'The battle is over.'); return null; }
  const p=room.players[socket.data.slot];
  if(Number.isInteger(p?.heldByCompanionOwner)){
    fail(ack,'You are being held by a Companion. Use Action → Release Themselves.');
    return null;
  }
  return room;
}
function requireResolve(socket, ack, type=null){
  const room = getRoomForSocket(socket);
  if(!room || room.status!=='playing' || room.phase!=='actionResolve' || !room.pendingAction) {
    fail(ack,'There is no Action result waiting to be resolved.'); return null;
  }
  if(room.pendingAction.slot!==socket.data.slot) { fail(ack,'That Action belongs to the other player.'); return null; }
  if(type && room.pendingAction.type!==type) { fail(ack,'That is not the selected Action type.'); return null; }
  return room;
}

function spawnZombieDancers(room,p){
  if(p.companion)removeCompanion(room,p.slot,'is replaced as Thriller Night begins');
  p.companion={
    type:'zombiedancers',name:'Zombie Dancers',guard:0,guardMax:0,
    dancerMovesUsedThisTurn:0,dancerMovesLimit:3,dancerMovePenalty:0,dancerDefendsUsed:0,
    defendUsed:false,holdingSlot:null
  };
  p.companionCooldown=0;
  logRoom(room,`🧟‍♂️🕺 Zombie Dancers rise beside ${p.name}!`,'special');
}
function triggerThrillerNight(room,p){
  p.thrillerNightUsed=true;p.thrillerNightActive=true;p.thrillerNightTurns=3+(p.finalShowBonus||0);p.finalShowBonus=0;
  p.hp=1;
  spawnZombieDancers(room,p);p.gloveHype=Math.min(100,p.gloveHype||0);
  logRoom(room,`🌙 THRILLER NIGHT! ${p.name} refuses death and becomes invincible for the next 3 personal turns. When those turns end, they die instantly.`,'special');
  emitState(room);
}

function checkWinner(room){
  // Pay recoil even if the attack knocked out the opponent before finishAction.
  for(const p of room.players){if(p?.powerGloveRecoilPending){p.powerGloveRecoilPending=false;hurtFighter(room,p,4);logRoom(room,`🥊 ${p.name} takes 4 recoil from Power Glove after attacking.`,'bad');}}
  for(let i=0;i<2;i++){
    const p=room.players[i];
    if(p && p.hp<=0){
      // The Gloved One uses Thriller Night instead of the normal revival chance.
      if(p.special==='glovedone'&&!p.thrillerNightUsed){
        triggerThrillerNight(room,p);
        continue;
      }
      if(p.thrillerNightActive){
        p.hp=1;
        logRoom(room,`🌙 Thriller Night keeps ${p.name} standing at 1 HP.`,'special');
        continue;
      }

      // One hidden comeback check: The Gambler has a 50% chance, other
      // non-Gloved fighters keep their existing 25% chance.
      if(p.special!=='glovedone'&&!p.revivalChecked){
        p.revivalChecked=true;
        const revived=p.special==='gambler'?GR.randomInt(2)===0:roll(4)===1;
        io.to(room.code).emit('revival-cinematic',{slot:i,name:p.name,success:revived,at:Date.now()});
        if(revived){
          if(p.special==='gambler'){
            p.gamblerGuaranteedSevens=true;
            logRoom(room,`🍀 ${p.name}'s comeback rigs the next Relentless Gambler spin: THREE 7s!`,'special');
          }
          p.hp=Math.min(5,p.maxHp);
          logRoom(room,`✨ ${p.name} refuses to stay down and returns with ${p.hp} HP!`,'special');
          emitState(room);
          continue;
        }
        logRoom(room,`🕯️ ${p.name}'s last chance fades away...`,'bad');
      }

      room.winner = 1-i;
      room.status = 'finished';
      room.phase = 'finished';
      logRoom(room, `🏆 ${room.players[1-i].name} wins!`, 'good');
      return true;
    }
  }
  return false;
}

function previewOffence(attacker,target,base){
  let sides=+base, bonus=0, boosts=[];
  if(attacker.weakness>0){ sides=stepDown(sides); boosts.push('Weakness'); }
  if(target.armourBreak>0){
    boosts.push('Armour Break');
    if(sides>=20) bonus+=2; else sides=stepUpDamage(sides);
  }
  if(attacker.strengthen){
    boosts.push('Strengthen');
    if(sides>=20) bonus+=2; else sides=stepUpDamage(sides);
  }
  if(attacker.lightsOut){ bonus+=1; boosts.push('Lights Out +1'); }
  if(attacker.special==='berserker' && attacker.hp<=attacker.maxHp/2){ bonus+=1; boosts.push('Berserker +1'); }
  if(attacker.special==='arcanesurge' && +base>=12){ bonus+=1; boosts.push('Arcane Surge +1'); }
  if(attacker.special==='redjudas' && attacker.kingTurns>0){ bonus+=2; boosts.push('King of Curses +2'); }
  if(attacker.special==='greatexception'){
    const before=sides;sides=greatExceptionSides(attacker,sides);
    boosts.push(`Great Exception D${before}→D${sides}`);
  }
  if(attacker.exhaustion>0){bonus-=2;boosts.push('Exhaustion -2');}
  if(attacker.defensiveStancePenalty>0){bonus-=3;boosts.push('Defensive Stance -3');}
  if(attacker.pokerAttackBonus>0){bonus+=attacker.pokerAttackBonus;boosts.push(`Poker winner +${attacker.pokerAttackBonus}`);}
  return {sides,bonus,boosts};
}
function offence(attacker,target,base){
  const p=previewOffence(attacker,target,base);
  if(attacker.strengthen) attacker.strengthen=false;
  if(attacker.pokerAttackBonus>0)attacker.pokerAttackBonus=0;
  return p;
}
function defenceDie(p,base){
  const sides=p.armourBreak>0 ? stepDown(base) : +base;
  return greatExceptionSides(p,sides);
}
function defenceBonus(p){
  let bonus=0, parts=[];
  if(p.lightsOut){bonus+=2;parts.push('Lights Out +2');}
  if(p.special==='ironwall'){bonus+=1;parts.push('Iron Wall +1');}
  if(p.exhaustion>0){bonus-=2;parts.push('Exhaustion -2');}
  if(p.wet>0){bonus-=2;parts.push('Wet -2');}
  return {bonus,parts};
}
function applyHypeGain(p,amount){
  const before=clamp(Number(p.gloveHype)||0,0,100);
  const gain=amount>0&&before>=60?Math.round(amount*.67):amount;
  p.gloveHype=clamp(before+gain,0,100);p.momentum=p.gloveHype;
  return p.gloveHype-before;
}
function gloveHypeDamageBonus(hype){
  const h=clamp(Number(hype)||0,0,100);
  return h>=100?3:h>=75?2:h>=50?1:h>=25?-1:-2;
}
function absorbAttack(room,target, raw, attacker=null, options={}){
  // Crowd Hype changes attack damage, not recurring status ticks or healing.
  // Centralized here so attacks from Specials, minigames, and regular attacks agree.
  if(attacker?.special==='glovedone'&&raw>0){
    const bonus=gloveHypeDamageBonus(attacker.gloveHype);
    raw=Math.max(0,raw+bonus);
    logRoom(room,`🎤 Crowd Hype ${Math.floor(attacker.gloveHype||0)}: ${bonus>=0?'+':''}${bonus} attack damage.`,'special');
  }
  if(attacker?.powerGloveReady&&raw>0){raw+=7;attacker.powerGloveReady=false;attacker.powerGloveRecoilPending=true;logRoom(room,`🥊 Power Glove adds 7 damage to ${attacker.name}'s attack. 4 recoil follows.`, 'special');}
  if(attacker?.coinAttackMultiplier>0&&raw>0){raw*=attacker.coinAttackMultiplier;attacker.coinAttackMultiplier=0;logRoom(room,`🪙 Gambler's Coin DOUBLES the attack!`,'special');}
  if(target?.special==='glovedone'&&attacker&&attacker!==target&&raw>0){
    const h=target.gloveHype||0,extra=h>=100?3:h>=75?2:h>=50?1:0;
    if(extra){raw+=extra;logRoom(room,`🎤 High Crowd Hype leaves ${target.name} exposed: +${extra} incoming attack damage.`,'bad');}
  }
  if(target?.eightBallVulnerable&&raw>0){raw=Math.ceil(raw*1.2);target.eightBallVulnerable=false;logRoom(room,`🎱 Wrong prediction! ${target.name} takes 20% more damage.`, 'bad');}
  if(attacker?.defensiveStancePenalty>0 && !options.offenceAlreadyApplied)raw=Math.max(0,raw-3);
  raw=applyGamblerAttackModifier(room,attacker,raw);
  if(attacker?.offBalance>0 && raw>0){raw=Math.max(0,Math.floor(raw*.8));attacker.offBalance=0;logRoom(room,`🔴 ${attacker.name}'s next damaging move is weakened by Off-Balance (−20%).`,'bad');}
  if(attacker?.jackpotTurns>0&&raw>0)raw+=5;
  if(attacker?.offBeatTurns>0 && raw>0)raw=Math.floor(raw*.8);
  if(attacker?.special==='glovedone'&&attacker.flowReady&&raw>0){raw+=6;if(!attacker.flowPerfectThisMove)attacker.flowReady=false;attacker.flowPerfectThisMove=false;logRoom(room,`✨ Feel the Flow adds +6 damage!`,'special');}
  if(attacker?.special==='glovedone'&&attacker.thrillerNightActive&&raw>0)raw+=5;
  if(attacker?.special==='glovedone'&&attacker.spotlightReady>0&&raw>0){raw+=4;attacker.spotlightReady=0;logRoom(room,`🌟 Spotlight! ${attacker.name}'s attack deals +4 damage.`,'special');}
  if(attacker?.distracted&&raw>0){raw=Math.floor(raw*.8);attacker.distracted=false;logRoom(room,`🐧 Distracted reduces ${attacker.name}'s damage by 20%.`,'bad');}
  if(target?.umbrellaGuardPct>0&&raw>0){const before=raw;raw=Math.ceil(raw*(100-target.umbrellaGuardPct)/100);target.umbrellaGuardPct=0;if(target.umbrellaCounter>0&&attacker){hurtFighter(room,attacker,target.umbrellaCounter);logRoom(room,`☂️ Perfect Umbrella counters for ${target.umbrellaCounter} damage.`,'special');target.umbrellaCounter=0;}logRoom(room,`☂️ Umbrella reduces incoming damage ${before} → ${raw}.`,'good');}
  if(attacker?.confusedMissTurns>0){
    return {oldDef:target.defence,blocked:raw,damage:0,sixEyes:false,kingBypass:false,umbrellaDodge:false,umbrellaDistance:false,confusedMiss:true};
  }
  if(target?.thrillerNightActive){
    return {oldDef:target.defence,blocked:raw,damage:0,sixEyes:false,kingBypass:false,umbrellaDodge:false,umbrellaDistance:false,confusedMiss:false,thrillerNight:true};
  }
  if(target.spiderDodgeReady && raw>0){
    target.spiderDodgeReady=false;
    if(crypto.randomInt(4)===0){
      logRoom(room,`🕷️ Spider Bot intercepts the attack! ${target.name} dodges all ${raw} damage!`,'good');
      return {oldDef:target.defence,blocked:raw,damage:0,spiderDodge:true};
    }
    logRoom(room,`🕷️ ${target.name}'s Spider Bot fails the dodge check.`, 'info');
  }
  const kingActive=attacker?.special==='redjudas' && attacker.kingTurns>0;

  // King of Curses ignores defensive buffs/blocks while attacking.
  if(kingActive){
    const oldDef=target.defence;
    // King bypasses normal Defence, but a prepared Magic Mirror still reflects
    // HP damage from the next attack. Reflection does not reduce his hit.
    if(target.magicMirrorReady&&attacker&&raw>0){
      target.magicMirrorReady=false;
      const reflect=Math.min(10,raw);
      hurtFighter(room,attacker,reflect);
      logRoom(room,`🪞 Magic Mirror reflects ${reflect} damage to ${attacker.name}!`,'special');
    }
    return {oldDef,blocked:0,damage:raw,sixEyes:false,kingBypass:true,umbrellaDodge:false,umbrellaDistance:false,confusedMiss:false};
  }

  if(target.special==='pokemontrainer' && target.activePokemon==='snorlax'){
    const cut=Math.min(2,Math.max(0,raw));
    if(cut>0){raw=Math.max(0,raw-cut);logRoom(room,`🛡️ Snorlax reduces incoming direct damage by ${cut}.`,'special');}
  }

  // Umbrella's "too far away" clause makes Basic Attacks automatically miss
  // for two opponent attack windows. This does not consume the separate 50/50 dodge.
  if(target.special==='greatexception' && options.normalAttack && target.umbrellaFarTurns>0){
    return {oldDef:target.defence,blocked:raw,damage:0,sixEyes:false,kingBypass:false,umbrellaDodge:false,umbrellaDistance:true};
  }

  // Umbrella also gives one 50/50 chance to dodge the next non-auto-missed attack.
  if(target.special==='greatexception' && target.umbrellaDodgeReady){
    target.umbrellaDodgeReady=false;
    if(rollShown(room,2,'Umbrella dodge check')===1){
      return {oldDef:target.defence,blocked:raw,damage:0,sixEyes:false,kingBypass:false,umbrellaDodge:true,umbrellaDistance:false};
    }
  }

  // Six Eyes checks before normal Defence. On a successful 1-in-3 block,
  // the hit is completely negated and stored Defence is not consumed.
  if(target.special==='bluejudas' && target.sixEyesTurns>0 && rollShown(room,3,'Six Eyes block check')===1){
    return {oldDef:target.defence,blocked:raw,damage:0,sixEyes:true,kingBypass:false,umbrellaDodge:false,umbrellaDistance:false,confusedMiss:false};
  }
  let remaining=raw,companionBlocked=0;
  if(target.companion?.guard>0){
    companionBlocked=Math.min(target.companion.guard,remaining);
    target.companion.guard-=companionBlocked;
    remaining-=companionBlocked;
    if(companionBlocked>0){
      logRoom(room,`🧟🛡️ ${target.name}'s ${target.companion.name} shield absorbs ${companionBlocked} damage (${target.companion.guard}/${target.companion.guardMax||target.companion.guard} shield remains).`,'special');
    }
    if(target.companion.guard<=0){
      removeCompanion(room,target.slot,'loses all of its Companion Defence and is defeated');
    }
  }
  const oldDef = target.defence;
  const regularBlocked = Math.min(oldDef,remaining);
  if(target.mambaDefenceRemaining>0){
    const mambaSpent=Math.min(target.mambaDefenceRemaining,regularBlocked);
    target.mambaDefenceRemaining=Math.max(0,target.mambaDefenceRemaining-mambaSpent);
  }
  target.defence=Math.max(0,target.defence-regularBlocked);
  remaining-=regularBlocked;
  const blocked = companionBlocked+regularBlocked;
  if(blocked>0&&target.stats)target.stats.damageBlocked+=blocked;
  const damage = Math.max(0,remaining);
  if(regularBlocked>0){
    logRoom(room,`🛡️ ${target.name}'s Defence absorbs ${regularBlocked} damage (${oldDef} → ${target.defence} Defence).`,'special');
  }
  if(target.special==='pokemontrainer'&&target.activePokemon==='snorlax'&&target.snorlaxCounter>0&&attacker&&attacker!==target&&raw>0){
    const retaliation=Math.min(3,target.snorlaxCounter);target.snorlaxCounter=0;
    hurtFighter(room,attacker,retaliation);
    logRoom(room,`💢 Snorlax punishes the attack: ${attacker.name} takes ${retaliation} retaliation damage.`,'bad');
  }
  if(target.magicMirrorReady&&attacker&&raw>0){target.magicMirrorReady=false;const reflect=Math.min(10,damage);if(reflect>0){hurtFighter(room,attacker,reflect);logRoom(room,`🪞 Magic Mirror reflects ${reflect} damage to ${attacker.name}!`,'special');}}
  // Normal Defence is secondary HP: it is consumed before real HP.
  return {oldDef,blocked,companionBlocked,damage,sixEyes:false,kingBypass:false,umbrellaDodge:false,umbrellaDistance:false,confusedMiss:false};
}
function halveDefenceForArmourBreak(p){
  p.armourDefenceLock=1; // next personal turn only
  const before=p.defence;
  const after=Math.floor(before*.25);
  const lost=before-after;
  if(p.mambaDefenceRemaining>0){
    p.mambaDefenceRemaining=Math.max(0,p.mambaDefenceRemaining-Math.min(p.mambaDefenceRemaining,lost));
  }
  p.defence=after;
  return {before,after,lost};
}
function domainTypeForPlayer(p){
  if(p.special==='redjudas')return 'ms';
  if(p.special==='bluejudas')return 'iv';
  return p.domainKind||null;
}
function domainName(type){
  return type==='ms'?'Domain Expansion M.S.':type==='jackpot'?'Relentless Gambler':'Domain Expansion I.V.';
}
function domainUnlockName(p){
  return p.special==='redjudas'?'King of Curses':'Six Eyes';
}
function interruptDomainCharge(room,target,damage){
  if(damage<15 || !target.domainCharging)return false;
  const kind=target.domainKind||domainTypeForPlayer(target);
  target.domainCharging=false;
  target.domainChargeProgress=0;
  target.domainChargeMode=null;
  target.domainKind=null;
  logRoom(room,`💥 ${target.name} takes ${damage} damage in one hit and loses ${domainName(kind)} while charging. They must use ${domainUnlockName(target)} again before attempting another Domain.`,'bad');
  return true;
}
function actionMods(p,type,enemy,consume=false){
  let adv=0,dis=0,advParts=[],disParts=[];
  if(p.special==='trickster'){adv+=1;advParts.push('Trickster +1');}
  if(p.actionBonus){
    adv+=p.actionBonus; advParts.push(`Loaded Dice +${p.actionBonus}`);
    if(consume)p.actionBonus=0;
  }
  if(type==='attack'){
    if(p.lightsOut){adv+=1;advParts.push('Lights Out +1');}
    if(enemy.armourBreak>0){adv+=2;advParts.push('Target Armour Break +2');}
    if(p.weakness>0){dis+=2;disParts.push('Weakness -2');}
  }
  if(type==='defence'){
    if(p.lightsOut){adv+=2;advParts.push('Lights Out +2');}
    if(p.armourBreak>0){dis+=2;disParts.push('Armour Break -2');}
  }
  if(p.exhaustion>0){dis+=2;disParts.push('Exhaustion -2');}
  return {adv,dis,advParts,disParts};
}
function tickCooldowns(room,p){
  if(p.ptsd>0){
    p.ptsd--;
    if(p.ptsd===0){p.lastBattleButton=null;logRoom(room,`🧠 ${p.name}'s PTSD effect ends.`,'good');}
  }
  if(p.tuneDeafTurns>0)p.tuneDeafTurns--;
  if(p.offBeatTurns>0)p.offBeatTurns--;
  if(p.effectsButtonCooldown>0)p.effectsButtonCooldown--;
  if(p.bite87Cooldown>0)p.bite87Cooldown--;
  if(p.moonWalkCooldown>0)p.moonWalkCooldown--;
  if(p.gloveKidCooldown>0)p.gloveKidCooldown--;
  if(p.booooCooldown>0)p.booooCooldown--;
  for(const k of Object.keys(p.gloveMiniCooldowns||{}))if(p.gloveMiniCooldowns[k]>0)p.gloveMiniCooldowns[k]--;
  if(p.beatItCooldown>0)p.beatItCooldown--;
  if(p.exhaustion>0){
    p.exhaustion--;
    if(p.exhaustion===0)logRoom(room,`😮‍💨 ${p.name} recovers from Exhaustion.`,'good');
  }
  if(p.danceBattleCooldown>0)p.danceBattleCooldown--;
  if(p.judasMiniCooldown>0)p.judasMiniCooldown--;
  if(p.pulled>0)p.pulled--;if(p.scored>0)p.scored--;
  if(p.offBalance>0)p.offBalance--;
  if(p.mambaCooldown>0)p.mambaCooldown--;
  if(p.mambaStrikeCooldown>0)p.mambaStrikeCooldown--;
  if(p.deathRayCooldown>0)p.deathRayCooldown--;
  if(p.upgradedMagicBagTurns>0){p.upgradedMagicBagTurns--;if(p.upgradedMagicBagTurns===0)logRoom(room,`👜✨ ${p.name}'s Upgraded Magic Bag returns to normal.`,'info');}
  if(p.magicBagRecent&&typeof p.magicBagRecent==='object'){
    for(const id of Object.keys(p.magicBagRecent)){
      p.magicBagRecent[id]--;
      if(p.magicBagRecent[id]<=0)delete p.magicBagRecent[id];
    }
  }
  if(p.spiderTurns>0){p.spiderTurns--;if(p.spiderTurns===0)logRoom(room,`🕷️ ${p.name}'s Spider Bot powers down.`,'info');}
  if(p.mambaTurns>0){
    p.mambaTurns--;
    if(p.mambaTurns===0){
      const remove=Math.min(p.defence,p.mambaDefenceRemaining||0);
      if(remove>0){
        p.defence=Math.max(0,p.defence-remove);
        logRoom(room,`🐍 ${p.name}'s Black Mamba Armor powers down and ${remove} remaining armor Defence disappears.`,'info');
      }else{
        logRoom(room,`🐍 ${p.name}'s Black Mamba Armor powers down.`,'info');
      }
      p.mambaDefenceRemaining=0;
    }
  }
  if(p.weakness>0 && --p.weakness===0) {}
  if(p.armourBreak>0 && --p.armourBreak===0) {}
  for(const k of EFFECTS) if(p.effectCooldowns[k]>0)p.effectCooldowns[k]--;
  if(p.beamCooldown>0)p.beamCooldown--;
  if(p.actionCooldown>0)p.actionCooldown--;
  if(p.specialCooldown>0)p.specialCooldown--;
  if(p.gamblerCooldowns)for(const key of Object.keys(p.gamblerCooldowns))if(p.gamblerCooldowns[key]>0)p.gamblerCooldowns[key]--;
  if(p.badLuck>0)p.badLuck--;
  if(p.fortune>0)p.fortune--;
  if(p.nightFiveCooldown>0)p.nightFiveCooldown--;
  if(p.rctCooldown>0)p.rctCooldown--;
  if(p.parryCooldown>0)p.parryCooldown--;
  if(p.heavyCooldown>0)p.heavyCooldown--;
  if(p.companionCooldown>0)p.companionCooldown--;
  if(p.companion){
    const c=p.companion;
    if(c.holdCooldown>0)c.holdCooldown--;
    if(c.gooningCooldown>0)c.gooningCooldown--;
    if(c.groceriesCooldown>0)c.groceriesCooldown--;
    if(c.waterGunCooldown>0)c.waterGunCooldown--;
    if(c.seduceCooldown>0)c.seduceCooldown--;
    if(c.type==='kebabstand'&&!c.kebabReady&&Number.isFinite(c.produceIn)){
      c.produceIn--;
      if(c.produceIn<=0){c.kebabReady=true;c.produceIn=2;logRoom(room,`🥙 ${p.name}'s Kebab Stand has a fresh Kebab ready to claim.`,'good');}
    }
    if((c.type==='baby'||c.type==='teen')&&Number.isFinite(c.growIn)){
      c.growIn--;
      if(c.growIn<=0){
        if(c.type==='baby'){
          c.type='teen';c.name='Teen';c.growIn=4;c.defendUsed=false;c.guard=0;c.guardMax=0;c.gooningCooldown=0;
          logRoom(room,`🍼➡️🧑 ${p.name}'s Baby grows into a Teen!`,'special');
        }else{
          c.type='adult';c.name='Adult';c.growIn=null;c.defendUsed=false;c.guard=0;c.guardMax=0;c.groceriesCooldown=0;c.overtimeUsedThisTurn=false;
          logRoom(room,`🧑➡️🧔 ${p.name}'s Teen grows into an Adult!`,'special');
        }
      }
    }
  }
  if(p.seduced>0)p.seduced--;
  if(p.wet>0)p.wet--;
  if(p.confusedMissTurns>0)p.confusedMissTurns--;
  if(p.umbrellaCooldown>0)p.umbrellaCooldown--;
  if(p.footworkCooldown>0)p.footworkCooldown--;
  if(p.spotlightReady>0)p.spotlightReady--;
  if(p.umbrellaFarTurns>0)p.umbrellaFarTurns--;

  if(p.maxRedCooldown>0)p.maxRedCooldown--;
  if(p.maxBlueCooldown>0)p.maxBlueCooldown--;
  if(p.dismantleCooldown>0)p.dismantleCooldown--;
  if(p.cleaveCooldown>0)p.cleaveCooldown--;if(p.fugaCooldown>0)p.fugaCooldown--;

  if(p.sixEyesTurns>0){
    p.sixEyesTurns--;
    if(p.sixEyesTurns===0){
      p.sixEyesCooldown=7;
      p.cursedMax=8;p.cursedEnergy=0;p.positiveEnergy=0;p.overEnergy=0;
      logRoom(room,`👁️ ${p.name}'s Six Eyes expires. Six Eyes enters a 7-turn cooldown.`,'info');
    }
  }else if(p.sixEyesCooldown>0){
    p.sixEyesCooldown--;
  }

  if(p.kingTurns>0){
    p.kingTurns--;
    if(p.kingTurns===0){
      p.kingCooldown=7;
      p.cursedMax=8;p.cursedEnergy=0;p.positiveEnergy=0;p.overEnergy=0;
      logRoom(room,`👑 ${p.name}'s King of Curses expires. King of Curses enters a 7-turn cooldown.`,'info');
    }
  }else if(p.kingCooldown>0){
    p.kingCooldown--;
  }
}
function fullEndTurn(room){
  room.freeItemAction=null;
  const p=room.players[room.current];
  if(p.teamRocketTurns>0)p.teamRocketTurns--;
  if(p.rocketStolen?.turns>0){p.rocketStolen.turns--;if(p.rocketStolen.turns===0){const victim=room.players[1-p.slot];if(victim?.rocketMoveBlocked===p.rocketStolen.move)victim.rocketMoveBlocked=null;p.rocketStolen=null;}}
  const other=room.players[1-p.slot];if(other?.umbrellaGuardPct){other.umbrellaGuardPct=0;other.umbrellaCounter=0;}
  if(p.groovinTurns>0){p.groovinTurns--;p.groovinBlocked=null;}
  if(p.armourDefenceLock>0)p.armourDefenceLock--;
  if(p.realitySealTurns)for(const key of Object.keys(p.realitySealTurns)){if(--p.realitySealTurns[key]<=0)delete p.realitySealTurns[key];}
  p.defensiveStanceUsed=false;p.defensiveStancePenalty=0;
  CJ.discardOverenergy(p);
  if(p.stats)p.stats.turns++;
  if(p.jackpotTurns>0){p.jackpotTurns--;if(room.domain?.type==='jackpot'&&room.domain.owner===p.slot)room.domain.turnsRemaining=Math.max(0,p.jackpotTurns);if(p.jackpotTurns===0){p.jackpotHealTurns=0;if(room.domain?.type==='jackpot'&&room.domain.owner===p.slot)room.domain=null;logRoom(room,`🎰 ${p.name}'s JACKPOTT expires.`,'info');}}
  if(p.nightFiveActiveThisTurn && p.nightFiveTurns>0) p.nightFiveTurns--;
  p.nightFiveActiveThisTurn=false;
  p.actionsRemaining=0;
  if(p.thrillerNightActive){
    p.thrillerNightTurns--;
    if(p.thrillerNightTurns<=0){
      p.thrillerNightActive=false;p.hp=0;
      room.winner=1-room.current;room.status='finished';room.phase='finished';
      logRoom(room,`🌙 Thriller Night ends. ${p.name} dies instantly. ${room.players[1-room.current].name} wins!`,'good');
      emitState(room);return;
    }
  }
  tickCooldowns(room,p);
  room.pendingAction=null;
  room.attackTiming=null;
  room.phase='turn';
  room.current=1-room.current;
  startTurn(room);
}
function finishAction(room, forceFull=false, countsAsAttack=false){
  const p=room.players[room.current];
  if(p?.powerGloveRecoilPending){p.powerGloveRecoilPending=false;hurtFighter(room,p,4);logRoom(room,`🥊 ${p.name} takes 4 Power Glove recoil damage.`,'bad');if(checkWinner(room)){emitState(room);return;}}
  if(room.freeItemAction===p?.slot){
    room.freeItemAction=null;
    room.pendingAction=null;room.phase='turn';
    logRoom(room,`🎒 ${p.name} finishes a free item use and may still choose their move.`, 'info');
    emitState(room);
    return;
  }
  if(p?.deferredCompanionItem){
    p.deferredCompanionItem=false;
    room.pendingAction=null;
    if(room.phase!=='companionOnly')room.phase=p.actionsRemaining>0?'turn':'companionOnly';
    finishCompanionMove(room,p,'Companion item');
    return;
  }
  room.pendingAction=null;
  room.phase='turn';
  if(!countsAsAttack)loseMomentumForNonAttack(room,p,'a non-Attack move');
  if(!forceFull && p.actionsRemaining>1){
    p.actionsRemaining--;
    logRoom(room, `⚡ ${p.name} has ${p.actionsRemaining} move${p.actionsRemaining===1?'':'s'} left this turn.`, 'special');
    emitState(room);
    return;
  }
  p.actionsRemaining=0;
  if(!Number.isInteger(p.heldByCompanionOwner)&&canUseCompanionMove(p)){
    room.phase='companionOnly';
    logRoom(room,`🟡 ${p.name}'s normal move is spent, but a Companion Move is still available.`,'info');
    emitState(room);
    return;
  }
  fullEndTurn(room);
}

function setActiveDomain(room,ownerSlot,type){
  const victim=1-ownerSlot,owner=room.players[ownerSlot],other=room.players[victim];
  if(type==='jackpot'){
    // A Domain Clash victory rigs the *next* Slot roll, not the current reel.
    owner.gamblerGuaranteedSevens=true;
    owner.gamblerDomainCharge=Math.max(1,owner.gamblerDomainCharge);
    owner.gamblerDomainDamage=0;
    room.domain=null;
    logRoom(room,`🎰 ${owner.name} wins the Domain Clash! Their next Relentless Gambler spin is GUARANTEED THREE 7s!`,'special');
    room.phase='turn';
    return;
  }
  if(type==='ms'){
    room.domain={type:'ms',owner:ownerSlot,victim,turnsRemaining:4,integrity:40,startedAt:Date.now()};
    logRoom(room,`🩸 ${owner.name} activates Domain Expansion M.S.! ${other.name} is permanently Bleeding and suffers 5 Domain damage at the start of each of their next 4 turns.`,'special');
  }else{
    room.domain={type:'iv',owner:ownerSlot,victim,skipsRemaining:3,integrity:40,startedAt:Date.now()};
    logRoom(room,`🩵 ${owner.name} activates Domain Expansion I.V.! ${other.name} will lose their next 3 turns.`,'special');
  }
  room.phase='turn';
}
function openDomainOffer(room,initiator,fast){
  const defender=1-initiator,p=room.players[defender];
  // For instant casts, the opponent may challenge from an existing domain charge
  // for 5 CE; otherwise they must be eligible to cast and pay the full 15 CE.
  if(fast && p.special!=='bluejudas' && p.special!=='redjudas')return false;
  const cost=p.domainCharging?5:15;
  const eligible=p.domainCharging ? p.cursedEnergy>=5 :
    ['bluejudas','redjudas'].includes(p.special) &&
    (p.special==='bluejudas'?p.sixEyesTurns>0:p.kingTurns>0) && p.domainAvailable && p.cursedEnergy>=15;
  if(!eligible)return false;
  const id=crypto.randomBytes(6).toString('hex');
  room.domainOffer={id,initiator,defender,cost,fast,deadline:Date.now()+20000};
  room.phase='domainResponse';
  logRoom(room,`🌀 ${p.name} may spend ${cost} Cursed Energy to DOMAIN CLASH, or take the incoming Domain head-on.`,'special');
  emitState(room);
  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    if(live?.domainOffer?.id===id)resolveDomainOffer(live,defender,'take');
  },20050);
  return true;
}
function resolveDomainOffer(room,slot,answer){
  const offer=room.domainOffer;
  if(!offer||slot!==offer.defender)return {error:'No Domain response is waiting for you.'};
  if(!['clash','take'].includes(answer))return {error:'Choose Domain Clash or Take Head-On.'};
  const p=room.players[slot],caster=room.players[offer.initiator];
  if(answer==='clash' && !CJ.spend(p,offer.cost,0))return {error:`You need ${offer.cost} Cursed Energy.`};
  room.domainOffer=null;
  if(answer==='clash'){
    const ownKind=p.domainKind||domainTypeForPlayer(p),castingKind=caster.domainKind||domainTypeForPlayer(caster);
    p.domainCharging=false;p.domainChargeProgress=0;p.domainChargeMode=null;p.domainKind=null;
    p.domainAvailable=false;
    caster.domainCharging=false;caster.domainChargeProgress=0;caster.domainChargeMode=null;caster.domainKind=null;
    const types=[null,null];types[slot]=ownKind;types[offer.initiator]=castingKind;
    logRoom(room,`⚡ ${p.name} spends ${offer.cost} CE to force a Domain Clash!`,'special');
    startDomainClash(room,offer.initiator,slot,types);
  }else if(offer.fast){
    caster.domainOfferHandled=true;
    room.phase='turn';
    logRoom(room,`🌀 ${p.name} declines the clash. The incoming Domain will activate on ${caster.name}'s next turn.`,'info');
    emitState(room);
  }else{
    caster.domainOfferHandled=true;
    room.phase='turn';
    activateDomain(room,offer.initiator);
    emitState(room);
  }
  return {ok:true};
}
function activateDomain(room,ownerSlot){
  const owner=room.players[ownerSlot],otherSlot=1-ownerSlot,other=room.players[otherSlot];
  const ownerKind=owner.domainKind||domainTypeForPlayer(owner);
  // When another Blue Judas can challenge an incoming Domain with Cursed Energy,
  // show a server-authoritative choice before resolving it.
  if(!owner.domainOfferHandled && ['bluejudas','redjudas'].includes(other.special) && (other.domainCharging||other.sixEyesTurns>0||other.kingTurns>0) &&
     (other.domainCharging?other.cursedEnergy>=5:other.domainAvailable&&other.cursedEnergy>=15)){
    openDomainOffer(room,ownerSlot,false);return {clash:true,pending:true};
  }
  owner.domainCharging=false;
  owner.domainChargeProgress=0;
  owner.domainChargeMode=null;
  owner.domainOfferHandled=false;

  if(other.special==='gambler'&&other.gamblerDomainCharge>0){
    owner.domainKind=null;
    const types=[null,null];types[ownerSlot]=ownerKind;types[otherSlot]='jackpot';
    startDomainClash(room,ownerSlot,otherSlot,types);
    return {clash:true};
  }
  if(other.domainCharging){
    const otherKind=other.domainKind||domainTypeForPlayer(other);
    if(other.domainChargeProgress>=3){
      other.domainCharging=false;
      other.domainChargeProgress=0;
      owner.domainKind=null;
      other.domainKind=null;
      const types=[null,null];
      types[ownerSlot]=ownerKind;
      types[otherSlot]=otherKind;
      startDomainClash(room,ownerSlot,otherSlot,types);
      return {clash:true};
    }
    const lostProgress=other.domainChargeProgress;
    other.domainCharging=false;
    other.domainChargeProgress=0;
    other.domainKind=null;
    logRoom(room,`🌀 ${other.name}'s ${domainName(otherKind)} was only at ${lostProgress}/3 and collapses before it can clash.`,'bad');
  }

  owner.domainKind=null;
  setActiveDomain(room,ownerSlot,ownerKind);
  return {clash:false};
}
function startDomainClash(room,initiator,opponent,types){
  const sequence=Array.from({length:8},()=>roll(4));
  const id=crypto.randomBytes(6).toString('hex');

  const specials=room.players.map(p=>p?.special);
  const judasMatchup=room.funnyBusiness!==false &&
    specials.includes('bluejudas') && specials.includes('redjudas');

  // Funny Business adds a short matchup splash BEFORE the normal 3-second
  // Domain Clash countdown. Combat rules are unchanged.
  const introMs=judasMatchup?1900:0;
  const introEndsAt=Date.now()+introMs;
  const startsAt=introEndsAt+3000;
  const endsAt=startsAt+10000;

  room.domainClash={
    id,initiator,opponent,types,sequence,progress:[0,0],
    introEndsAt,startsAt,endsAt,matchupIntro:judasMatchup
  };
  room.phase=judasMatchup?'domainClashIntro':'domainClashCountdown';

  if(judasMatchup){
    logRoom(room,'🎬 Funny Business: Blue Judas vs Red Judas — Domain Clash cinematic!','special');
  }
  logRoom(room,`🌀 DOMAIN CLASH incoming: ${domainName(types[0])} vs ${domainName(types[1])}! After the countdown, each player will see one random number at a time. Press the matching 1–4 key to push your Domain forward.`,'special');
  emitState(room);

  if(judasMatchup){
    scheduleGameTimer(()=>{
      const live=rooms.get(room.code);
      if(!live?.domainClash || live.domainClash.id!==id || live.phase!=='domainClashIntro')return;
      live.phase='domainClashCountdown';
      emitState(live);
    },introMs);
  }

  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    if(!live?.domainClash || live.domainClash.id!==id || live.phase!=='domainClashCountdown')return;
    live.phase='domainClash';
    logRoom(live,'🌀 DOMAIN CLASH — GO! Hit each correct number as it appears and push your Domain forward.','special');
    emitState(live);

    scheduleGameTimer(()=>{
      const still=rooms.get(room.code);
      if(!still?.domainClash || still.domainClash.id!==id || still.phase!=='domainClash')return;
      const dc=still.domainClash;
      if(dc.progress[0]===dc.progress[1]){
        logRoom(still,'🌀 Domain Clash times out tied. Both Domains collapse.','info');
        still.domainClash=null;still.phase='turn';
        let gamblerInterrupted=false;
        for(const player of still.players)if(player?.special==='gambler'&&player.gamblerDomainCharge>0)gamblerInterrupted=failRelentlessGambler(still,player,'a tied Domain Clash')||gamblerInterrupted;
        // Unchanged domain tie path for other characters.
        if(gamblerInterrupted)startTurn(still);else emitState(still);
      }else{
        resolveDomainClash(still,dc.progress[0]>dc.progress[1]?0:1);
      }
    },10050);
  },introMs+3000);
}
function resolveDomainClash(room,winner){
  const dc=room.domainClash;if(!dc)return;
  const loser=1-winner,type=dc.types[winner]||domainTypeForPlayer(room.players[winner]);
  room.domainClash=null;
  const losingGambler=room.players[loser];
  if(losingGambler.special==='gambler'&&losingGambler.gamblerDomainCharge>0){
    failRelentlessGambler(room,losingGambler,'losing the Domain Clash');
  }
  setActiveDomain(room,winner,type);
  logRoom(room,`🌀 ${room.players[winner].name} wins the Domain Clash! ${domainName(type)} takes over.`,'special');
  if(room.current!==winner||type==='jackpot'){
    room.current=winner;
    startTurn(room);
  }else{
    emitState(room);
  }
}
function completeDomainChargeTurn(room){
  const p=room.players[room.current];
  if(!p.domainCharging)return {error:'You are not charging a Domain.'};
  const sides=defenceDie(p,6),r=rollAttackDie(room,p,room.players[1-p.slot],sides,'Domain Defence'),sp=defenceBonus(p),itemDie=consumeMagicDice(room,p),raw=Math.max(0,r+sp.bonus+itemDie),before=p.defence;
  p.defence=clamp(p.defence+raw,0,20);p.defenceUses=Math.min(3,p.defenceUses+1);
  const kind=p.domainKind||domainTypeForPlayer(p);
  logRoom(room,`🛡️ ${p.name} defends while charging ${domainName(kind)}: D${sides} ${r}${sp.bonus?` + ${sp.bonus}`:''}${itemDie?` + item D6 ${itemDie}`:''}; Defence ${before} → ${p.defence}/20.`,'special');
  emitDefenceFx(room,{slot:p.slot,label:`GUARD +${p.defence-before}`,amount:p.defence-before,total:p.defence});

  p.domainChargeProgress=clamp(p.domainChargeProgress+1,0,2);
  logRoom(room,`🌀 ${p.name}'s ${domainName(kind)} charge advances to ${p.domainChargeProgress}/2.`,'special');
  loseMomentumForNonAttack(room,p,'Domain Defence');
  fullEndTurn(room);
  return {ok:true};
}
function startTurn(room){
  if(room.status!=='playing' || room.winner!==null) { emitState(room); return; }
  const p=room.players[room.current];
  p.nightFiveActiveThisTurn = p.nightFiveTurns>0;
  p.actionsRemaining = p.nightFiveActiveThisTurn ? 2 : 1;
  p.bindingVowUsesThisTurn = 0;p.thrillerUsedThisTurn=false;
  p.companionMovesUsedThisTurn=0;
  const companionCooling=!!(p.companion&&p.companionCooldown>0);
  p.companionMovesLimit=p.companion&&p.companion.type!=='zombiedancers'&&!companionCooling?1:0;
  if(p.companion){
    p.companion.biteUsedThisTurn=false;p.companion.overtimeUsedThisTurn=false;
    if(p.companion.type==='zombiedancers'){
      p.companion.dancerMovesUsedThisTurn=0;
      p.companion.dancerMovesLimit=companionCooling?0:Math.max(1,3-(p.companion.dancerMovePenalty||0));
    }
    if(companionCooling)logRoom(room,`🟡 ${p.name}'s ${p.companion.name} is recovering and cannot use a Companion Move this turn.`,'info');
  }
  room.phase='turn';
  if(p.groovinTurns>0){
    const buttons=['Attack','Defence','Charge','Effects','Special','Ultimate','Action'].filter(button=>{
      if(button==='Defence'&&p.armourDefenceLock>0)return false;
      if(button==='Effects'&&p.effectsButtonCooldown>0)return false;
      if((button==='Special'||button==='Ultimate')&&p.teamRocketTurns>0)return false;
      if(button==='Ultimate'&&(!ULTIMATES[p.special]||(!room.infiniteUltimates&&p.momentum<100)))return false;
      if((p.realitySealTurns?.[button]||0)>0)return false;
      if(Array.isArray(p.realitySealedButtons)&&p.realitySealedButtons.includes(button))return false;
      return true;
    });
    p.groovinBlocked=buttons[crypto.randomInt(buttons.length)];
    logRoom(room,`🎵 ${p.name} is GROOVIN! ${p.groovinBlocked} is disabled this turn (${p.groovinTurns} affected turns left).`,'bad');
  }else p.groovinBlocked=null;
  if(['bluejudas','redjudas'].includes(p.special)){
    CJ.replenish(p);
    if(p.rctHealTurns>0){const healed=Math.min(7,p.maxHp-p.hp);p.hp+=healed;p.rctHealTurns--;logRoom(room,`♻️ ${p.name} regenerates ${healed} HP with Reverse Cursed Technique (${p.rctHealTurns} ticks left).`,'good');}
    logRoom(room,`💜 ${p.name}: ${p.cursedEnergy} Cursed / ${p.positiveEnergy} Positive Energy (${p.cursedMax} capacity).`,'info');
  }

  // Active Domain effects apply at the beginning of the victim's turns.
  const msBleedThisTurn=room.domain?.type==='ms'&&room.domain.victim===room.current;
  if(room.domain && room.domain.victim===room.current){
    if(room.domain.type==='iv' && room.domain.skipsRemaining>0){
      room.domain.skipsRemaining--;
      logRoom(room,`🩵 ${p.name} loses a turn inside Domain Expansion I.V. (${room.domain.skipsRemaining} skips remain).`,'bad');
      if(room.domain.skipsRemaining===0){
        logRoom(room,'🩵 Domain Expansion I.V. ends.','info');
        room.domain=null;
      }
      fullEndTurn(room);
      return;
    }

    if(room.domain.type==='ms' && room.domain.turnsRemaining>0){
      p.bleed=Math.max(p.bleed,1); // cannot be cleared during active M.S.
      hurtFighter(room,p,5);
      room.domain.turnsRemaining--;
      logRoom(room,`🩸 Domain Expansion M.S. deals 5 unavoidable Domain damage and maintains Bleed on ${p.name} (${room.domain.turnsRemaining} turns remain).`,'bad');
      if(checkWinner(room)){emitState(room);return;}
      if(room.domain.turnsRemaining===0){logRoom(room,'🩸 Domain Expansion M.S. ends.','info');room.domain=null;}
    }
  }

  // Start-of-turn effect ticks run on the server so both clients see the same results.
  if(p.jackpotHealTurns>0){const h=Math.min(7,p.maxHp-p.hp);p.hp+=h;p.jackpotHealTurns--;logRoom(room,`💚 JACKPOTTT heals ${p.name} for ${h} HP (${p.jackpotHealTurns} pulses left).`,'good');}
  if(p.energyLeak>0){
    const before=p.momentum||0;
    p.momentum=Math.max(0,before-8);
    p.energyLeak--;
    logRoom(room,`🔋 Energy Leak drains ${before-p.momentum}% Momentum from ${p.name}. (${p.energyLeak} turn(s) left)`, 'bad');
  }
  resolveStatusCombos(room,p);
  if(msBleedThisTurn)p.bleed=Math.max(p.bleed,1); // The Domain overrides combinations that consume Bleed.
  if(checkWinner(room)){emitState(room);return;}
  if(p.candyRegen>0){const before=p.hp;p.hp=clamp(p.hp+3,0,p.maxHp);p.candyRegen--;logRoom(room,`🍬 Mystery Candy regenerates ${p.hp-before} HP (${p.candyRegen} turns remain).`,'good');}
  if(p.goldenAppleTurns>0){
    const before=p.hp;p.hp=clamp(p.hp+10,0,p.maxHp);p.goldenAppleTurns--;
    logRoom(room,`🍏 Golden Apple regenerates ${p.name} for ${p.hp-before} HP. (${p.goldenAppleTurns} regeneration turn(s) remain)`, 'good');
  }
  if(p.shopSkipTurns>0){
    p.shopSkipTurns--;
    logRoom(room,`🛒 ${p.name} pays the second turn cost for the Golden Apple and loses this turn.`, 'info');
    fullEndTurn(room);return;
  }

  if(p.syringeDamageTurns>0){
    const d=rollRangeShown(room,2,4,'Used Syringe damage')+2;hurtFighter(room,p,d);p.syringeDamageTurns--;
    logRoom(room,`💉 Used Syringe hurts ${p.name} for ${d} damage. (${p.syringeDamageTurns} turns remain)`, 'bad');
    if(checkWinner(room)){emitState(room);return;}
  }
  if(p.syringeHealTurns>0){
    const h=rollRangeShown(room,2,4,'Used Syringe heal'),before=p.hp;p.hp=clamp(p.hp+h,0,p.maxHp);p.syringeHealTurns--;
    logRoom(room,`💉 Used Syringe heals ${p.name} for ${p.hp-before}. (${p.syringeHealTurns} turns remain)`, 'good');
  }
  if(p.burn>0){
    const burnDamage=3*(p.burnMultiplier||1)+2;hurtFighter(room,p,burnDamage);p.burn--;if(p.burn===0)p.burnMultiplier=1;
    logRoom(room,`🔥 Burn deals ${burnDamage} damage to ${p.name}. (${p.burn} turns remain)`, 'bad');
    if(checkWinner(room)){emitState(room);return;}
  }

  if(p.bleed>0){
    const d=rollShown(room,p.bleedDie||4,'Bleed damage')+2; hurtFighter(room,p,d); p.bleed--;
    logRoom(room, `🩸 ${p.name} takes ${d} Bleed damage (D${p.bleedDie||4}).`, 'bad');
    if(checkWinner(room)){emitState(room);return;}
  }
  if(p.poison>0){
    const d=rollShown(room,p.poisonDie||4,'Poison damage')+2; hurtFighter(room,p,d); p.poison--;
    logRoom(room, `☠️ ${p.name} takes ${d} Poison damage (D${p.poisonDie||4}).`, 'bad');
    if(checkWinner(room)){emitState(room);return;}
  }
  if(p.shock>0){
    const d=rollShown(room,p.shockDie||4,'Shock damage')+2; hurtFighter(room,p,d); p.shock--;
    logRoom(room, `⚡ ${p.name} takes ${d} Shock damage (D${p.shockDie||4}).`, 'bad');
    if(checkWinner(room)){emitState(room);return;}
    const check=rollShown(room,2,'Shock skip check');
    if(check===1){
      logRoom(room, `⚡ ${p.name} fails the Shock 50/50 and loses the turn.`, 'bad');
      fullEndTurn(room); return;
    }
    logRoom(room, `⚡ ${p.name} passes the Shock 50/50.`, 'good');
  }
  if(p.forcedSkip>0){
    p.forcedSkip--;
    logRoom(room,`🔵 ${p.name} slips on the Marbles and loses the turn.`, 'bad');
    fullEndTurn(room);return;
  }

  if(p.gamblerDomainCharge>0){room.phase='gamblerSlot';emitState(room);return;}
  if(p.domainCharging){
    if(['bluejudas','redjudas'].includes(p.special)&&['iv','ms'].includes(p.domainKind)){
      if(p.domainChargeProgress>=3){
        const result=activateDomain(room,room.current);
        if(result.clash)return;
      }else{
        if(!CJ.spend(p,4,0)){
          p.domainCharging=false;p.domainChargeProgress=0;p.domainChargeMode=null;p.domainKind=null;
          logRoom(room,`💔 ${p.name}'s Domain charge fails: 4 Cursed Energy is required per charge turn.`,'bad');
        }else{
          p.domainChargeProgress++;
          logRoom(room,`🩵 ${p.name} pays 4 Cursed Energy for Domain charge ${p.domainChargeProgress}/3. Normal moves are still allowed.`,'special');
        }
      }
    }else if(p.domainChargeProgress>=2){
      const result=activateDomain(room,room.current);
      if(result.clash)return;
    }else{
      room.phase='domainChargeTurn';emitState(room);return;
    }
  }
  if(p.charge==='charging'){
    p.charge='ready';
    logRoom(room, `🔥 ${p.name} spends the turn completing Energy Charge.`, 'special');
    fullEndTurn(room); return;
  }
  if(p.beamCharge==='charging'){
    p.beamCharge='ready';
    logRoom(room, `☄️ ${p.name} spends the turn completing Beam Charge.`, 'special');
    fullEndTurn(room); return;
  }
  if(p.special==='pokemontrainer'&&!p.activePokemon){
    room.phase='pokemonChoose';
    logRoom(room,`🔄 ${p.name} must select a conscious Pokémon before fighting.`,'info');
    emitState(room);return;
  }
  emitState(room);
}


function resolveTimingAttack(room,style,grades){
  const a=room.players[room.current],d=room.players[1-room.current];
  style=String(style||'normal');
  grades=Array.isArray(grades)?grades.map(timingGradeValue):[];

  if(style==='bite87'){
    if(grades.length!==4)return {error:'Bite of 87!? needs four timing results.'};
    const raw=grades.reduce((n,g)=>n+heavyBarDamage(g),0);
    addDamagingSpecialMomentum(room,a,'Bite of 87!?');
    const effectProtectedAtImpact=companionEffectShieldActive(d);
    io.to(room.code).emit('special-audio',{name:'bite87'});
    const finalize=(parryResults=null)=>{
      const attempted=Array.isArray(parryResults);
      if(attempted&&parryResults[0]){
        logRoom(room,`🗡️ ${d.name} PARRIES the entire Bite of 87!? as one huge hit!`,'special');
        emitDefenceFx(room,{slot:d.slot,label:'PARRY BITE!',amount:0,perfect:true});
        emitCombatFx(room,{kind:'parry',attacker:a.slot,defender:d.slot,damage:0,blocked:0,dodged:true,critical:true,label:'PARRY BITE!'});
        finishAction(room,false,true);return;
      }
      const res=absorbAttack(room,d,raw,a,{normalAttack:false});
      const damage=res.damage+(attempted?1:0);
      hurtFighter(room,d,damage);
      reflectSeduced(room,a,damage,'Bite of 87!?');
      if(attempted)logRoom(room,`💢 ${d.name} misses the Bite of 87!? Parry and takes +1 extra damage.`,'bad');
      const landed=!res.confusedMiss&&!res.umbrellaDodge&&!res.sixEyes&&!res.umbrellaDistance;
      if(landed){
        if(effectProtectedAtImpact)logRoom(room,`🛡️ ${d.name}'s Companion shield blocks the Bite of 87!?'s Bleed.`,'special');
        else{
          d.bleed=Math.max(d.bleed,6);d.bleedDie=4;
          logRoom(room,`🩸 Bite of 87!? inflicts Bleed for 6 turns.`,'bad');
        }
      }
      logRoom(room,`🐻 ${a.name} uses Bite of 87!?: ${grades.join(' / ')} = ${raw}. ${d.name} takes ${damage} damage.`,'special');
      if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`BLOCK ${res.blocked}`,amount:res.blocked});
      emitCombatFx(room,{kind:'bite87',attacker:a.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:!landed,critical:grades.every(g=>g==='perfect'),label:'BITE OF 87!?'});
      interruptDomainCharge(room,d,damage);
      if(checkWinner(room)){emitState(room);return;}
      finishAction(room,false,true);
    };
    if(a.confusedMissTurns<=0&&maybeStartParry(room,{attacker:a.slot,defender:d.slot,label:'Bite of 87!?',hits:[raw],onResolve:finalize}))return {ok:true,deferred:true};
    finalize(null);return {ok:true};
  }

  if(style==='heavy'){
    if(a.stats){a.stats.attacks++;a.stats.perfectTimings+=grades.filter(g=>g==='perfect').length;}
    if(grades.length!==4)return {error:'Heavy Attack needs four timing results.'};
    const hits=grades.map(heavyBarDamage);
    const momGain=Math.max(0,grades.reduce((n,g)=>n+heavyBarMomentum(g),0)+8-5);
    const momBonus=momentumBonus(a);
    if(momBonus)hits[hits.length-1]+=momBonus;
    const adrenaline=consumeAdrenaline(room,a);
    if(adrenaline)hits[hits.length-1]+=adrenaline;
    const crushing=d.weakness>0?3:0;
    if(crushing){hits[hits.length-1]+=crushing;d.weakness=0;logRoom(room,`💥 CRUSHING BLOW! Heavy Attack consumes Weakness for +3 damage.`,'special');}
    const allPerfect=grades.every(g=>g==='perfect');
    const mom=addMomentum(a,momGain);

    const finalize=(parryResults=null)=>{
      const attempted=Array.isArray(parryResults);
      const failed=attempted ? parryResults.map((ok,i)=>ok?null:i).filter(i=>i!==null) : hits.map((_,i)=>i);
      const parried=attempted?parryResults.filter(Boolean).length:0;
      if(attempted && parried===hits.length){
        logRoom(room,`🗡️ ${d.name} PERFECTLY PARRIES all four hits of ${a.name}'s Heavy Attack! No damage is dealt.`,'special');
        emitDefenceFx(room,{slot:d.slot,label:'PARRY x4!',amount:0,perfect:true});
        emitCombatFx(room,{kind:'parry',attacker:a.slot,defender:d.slot,damage:0,blocked:0,dodged:true,critical:true,label:'PARRY x4!'});
        finishAction(room,false,true);return;
      }

      const raw=failed.reduce((n,i)=>n+hits[i],0);
      const missPenalty=attempted?failed.length:0;
      const res=absorbAttack(room,d,raw,a,{normalAttack:false,offenceAlreadyApplied:true});
      const damage=res.damage+missPenalty;
      const hpDamage=hurtFighter(room,d,damage);
      adrenalineRecoil(room,a,adrenaline,hpDamage);
      reflectSeduced(room,a,damage,'Heavy Attack');

      if(attempted)logRoom(room,`🗡️ ${d.name} Parries ${parried}/4 Heavy hits. ${failed.length} missed Parries add ${missPenalty} unavoidable damage.`,'special');
      if(res.confusedMiss)logRoom(room,`🥸 ${a.name} is Confused and misses ${d.name} with the Heavy Attack.`,'special');
      else if(res.kingBypass)logRoom(room,`👑 ${a.name}'s Heavy Attack ignores ${d.name}'s defensive protection and deals ${damage} damage.`,'special');
      else if(res.umbrellaDodge)logRoom(room,`☂️ ${d.name} wins Umbrella's 50/50 and dodges the un-parried Heavy damage${missPenalty?`, but still takes ${missPenalty} missed-Parry damage`:''}.`,'special');
      else if(res.sixEyes)logRoom(room,`👁️ ${d.name}'s Six Eyes blocks the un-parried Heavy damage${missPenalty?`, but missed Parries still deal ${missPenalty}`:''}.`,'special');
      else logRoom(room,`🔨 ${a.name} uses Heavy Attack: timing ${grades.join(' / ')}${momBonus?` + Momentum ${momBonus}`:''}. ${d.name} takes ${damage} damage. Momentum ${mom.before}% → ${mom.after}%.`,'good');

      if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`BLOCK ${res.blocked}`,amount:res.blocked});
      emitCombatFx(room,{kind:'heavy',attacker:a.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:false,critical:allPerfect,label:allPerfect?'PAN PERFECT!':'HEAVY HIT!',grades});
      interruptDomainCharge(room,d,damage);
      if(checkWinner(room)){emitState(room);return;}
      finishAction(room,false,true);
    };

    if(a.confusedMissTurns<=0&&maybeStartParry(room,{attacker:a.slot,defender:d.slot,label:'Heavy Attack',hits,onResolve:finalize}))return {ok:true,deferred:true};
    finalize(null);return {ok:true};
  }

  if(!['normal','charged'].includes(style))return {error:'Unknown Attack style.'};
  if(grades.length!==1)return {error:'This Attack needs one timing result.'};
  if(a.stats){a.stats.attacks++;a.stats.perfectTimings+=grades.filter(g=>g==='perfect').length;}
  const charged=style==='charged';
  if(charged&&a.charge!=='ready')return {error:'No stored Energy Charge.'};
  const base=charged?12:6,label=charged?'Charged Attack':'Normal Attack';
  const profile=offence(a,d,base),rolled=rollAttackDie(room,a,d,profile.sides,label),r=!charged?clamp(rolled,3,5):rolled,itemDie=consumeMagicDice(room,a);
  const grade=grades[0],timingBonus=grade==='perfect'?2:grade==='good'?1:0;
  const crit=rolled===profile.sides,critBonus=crit?1:0,momBonus=momentumBonus(a);
  const adrenaline=consumeAdrenaline(room,a);
  const total=r+profile.bonus+itemDie+timingBonus+critBonus+momBonus+adrenaline;
  if(crit&&a.stats)a.stats.criticalHits++;
  if(charged)a.charge='none';
  const mom=addMomentum(a,charged?10:singleBarMomentum(grade)+8);

  const finalize=(parryResults=null)=>{
    const attempted=Array.isArray(parryResults),parried=attempted&&parryResults[0];
    if(parried){
      logRoom(room,`🗡️ ${d.name} PARRIES ${a.name}'s ${label}! The hit deals no damage.`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY!',amount:0,perfect:true});
      emitCombatFx(room,{kind:'parry',attacker:a.slot,defender:d.slot,damage:0,blocked:0,dodged:true,critical:true,label:'PARRY!'});
      finishAction(room,false,true);return;
    }

    if(charged&&d.armourBreak>0){
      d.armourBreak=0;
      const shattered=Math.min(3,d.defence);d.defence-=shattered;
      if(shattered)logRoom(room,`💥 SHATTERED ARMOUR! Charged Attack consumes Armour Break and shatters ${shattered} Defence.`,'special');
    }
    const res=absorbAttack(room,d,total,a,{normalAttack:style==='normal',offenceAlreadyApplied:true});
    const damage=res.damage+(attempted?1:0);
    const hpDamage=hurtFighter(room,d,damage);
    adrenalineRecoil(room,a,adrenaline,hpDamage);
    reflectSeduced(room,a,damage,label);
    if(attempted)logRoom(room,`💢 ${d.name} misses the Parry and takes +1 extra damage.`,'bad');

    if(res.confusedMiss)logRoom(room,`🥸 ${a.name} is Confused and misses ${d.name} with ${label}.`,'special');
    else if(res.kingBypass)logRoom(room,`👑 ${a.name}'s King of Curses ignores ${d.name}'s defensive protection. ${label} deals ${damage} damage.`,'special');
    else if(res.umbrellaDistance)logRoom(room,`☂️ ${a.name}'s Normal Attack misses because ${d.name} is too far away under Umbrella${attempted?' — but the missed Parry still deals 1 damage':''}.`,'special');
    else if(res.umbrellaDodge)logRoom(room,`☂️ ${d.name} wins Umbrella's 50/50 and dodges ${a.name}'s ${label}${attempted?' — missed Parry damage: 1':''}.`,'special');
    else if(res.sixEyes)logRoom(room,`👁️ ${d.name}'s Six Eyes blocks ${a.name}'s ${label}${attempted?' — missed Parry damage: 1':''}.`,'special');
    else logRoom(room,`⚔️ ${a.name} uses ${label}: D${profile.sides} ${r}${profile.bonus?` + ${profile.bonus}`:''}${itemDie?` + item D6 ${itemDie}`:''}${timingBonus?` + timing ${timingBonus}`:''}${critBonus?' + CRIT 1':''}${adrenaline?' + Adrenaline 3':''}${momBonus?` + Momentum ${momBonus}`:''}${attempted?' + missed Parry 1':''} = ${total+(attempted?1:0)}. ${d.name} takes ${damage} damage. Momentum ${mom.before}% → ${mom.after}%.`,'good');

    if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`BLOCK ${res.blocked}`,amount:res.blocked});
    emitCombatFx(room,{kind:charged?'charged':'normal',attacker:a.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:!!(res.umbrellaDistance||res.umbrellaDodge||res.sixEyes),critical:crit||grade==='perfect',naturalCrit:crit,label:crit?'CRITICAL!':grade==='perfect'?'PERFECT STRIKE!':grade==='good'?'GOOD STRIKE!':'HIT!',grades:[grade]});
    interruptDomainCharge(room,d,damage);
    if(checkWinner(room)){emitState(room);return;}
    finishAction(room,false,true);
  };

  if(a.confusedMissTurns<=0&&maybeStartParry(room,{attacker:a.slot,defender:d.slot,label,hits:[total],onResolve:finalize}))return {ok:true,deferred:true};
  finalize(null);return {ok:true};
}
function doAttack(room, base, label='Basic Attack', charged=false){
  const a=room.players[room.current], d=room.players[1-room.current];
  if(charged && a.charge!=='ready') return {error:'No stored Energy Charge.'};
  const profile=offence(a,d,base), r=rollAttackDie(room,a,d,profile.sides,label),itemDie=consumeMagicDice(room,a),total=r+profile.bonus+itemDie;
  const res=absorbAttack(room,d,total,a,{normalAttack:label==='Basic Attack'&&!charged});
  hurtFighter(room,d,res.damage);
  reflectSeduced(room,a,res.damage,label);
  if(charged)a.charge='none';
  if(res.confusedMiss)logRoom(room,`🥸 ${a.name} is Confused and misses ${d.name} with ${label}.`,'special');
  else if(res.kingBypass)logRoom(room,`👑 ${a.name}'s King of Curses ignores ${d.name}'s defensive protection${res.oldDef?` (${res.oldDef} stored Defence)`:''}. ${label} deals ${res.damage} damage.`,'special');
  else if(res.umbrellaDistance)logRoom(room,`☂️ ${a.name}'s Basic Attack misses because ${d.name} is too far away under Umbrella.`,'special');
  else if(res.umbrellaDodge)logRoom(room,`☂️ ${d.name} wins Umbrella's 50/50 and dodges ${a.name}'s ${label}.`,'special');
  else if(res.sixEyes)logRoom(room,`👁️ ${d.name}'s Six Eyes blocks ${a.name}'s ${label} completely!`,'special');
  else logRoom(room, `⚔️ ${a.name} uses ${label}: ${r}${profile.bonus?` + ${profile.bonus}`:''}${itemDie?` + item D6 ${itemDie}`:''} = ${total}; ${d.name} takes ${res.damage}${res.oldDef?` after ${res.blocked} Defence`:''}.`, 'good');
  interruptDomainCharge(room,d,res.damage);
  if(checkWinner(room)){emitState(room);return {ok:true};}
  finishAction(room,false,true); return {ok:true};
}
function doPoolAttack(room, base, label='Action Attack'){
  if(!DAMAGE_DICE.includes(+base))return {error:'Invalid attack die.'};
  const a=room.players[room.current],d=room.players[1-room.current];
  const count=randomPoolCount(room,base,label),profile=offence(a,d,base),rs=[];
  for(let i=0;i<count;i++)rs.push(rollAttackDie(room,a,d,profile.sides,`${label} ${i+1}/${count}`));
  const itemDie=consumeMagicDice(room,a),total=rs.reduce((x,y)=>x+y,0)+profile.bonus+itemDie;

  const finalize=(parryResults=null)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🗡️ ${d.name} PARRIES ${a.name}'s ${label}!`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY!',amount:0,perfect:true});
      emitCombatFx(room,{kind:'parry',attacker:a.slot,defender:d.slot,damage:0,blocked:0,dodged:true,critical:true,label:'PARRY!'});
      finishAction(room,true);return;
    }
    const res=absorbAttack(room,d,total,a,{normalAttack:false});
    const damage=res.damage+(attempted?1:0);
    const itemHpDamage=hurtFighter(room,d,damage);
    awardGreatExceptionItemMomentum(room,a,itemHpDamage,label);
    reflectSeduced(room,a,damage,label);
    if(attempted)logRoom(room,`💢 ${d.name} misses the Parry and takes +1 extra damage.`,'bad');
    if(res.confusedMiss)logRoom(room,`🥸 ${a.name} is Confused and misses ${d.name} with ${label}.`,'special');
    else if(res.kingBypass)logRoom(room,`👑 ${a.name}'s King of Curses ignores ${d.name}'s defensive protection. ${label} deals ${damage} damage.`,'special');
    else if(res.umbrellaDodge)logRoom(room,`☂️ ${d.name} dodges ${a.name}'s ${label}${attempted?' but still takes 1 missed-Parry damage':''}.`,'special');
    else if(res.sixEyes)logRoom(room,`👁️ ${d.name}'s Six Eyes blocks ${a.name}'s ${label}${attempted?' but still takes 1 missed-Parry damage':''}.`,'special');
    else logRoom(room,`🎲 ${a.name}'s ${label} becomes ${count}D${profile.sides}; rolled ${rs.join(' + ')}${profile.bonus?` + ${profile.bonus}`:''}${itemDie?` + item D6 ${itemDie}`:''}${attempted?' + missed Parry 1':''} = ${total+(attempted?1:0)}. ${d.name} takes ${damage}.`,'good');
    if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`BLOCK ${res.blocked}`,amount:res.blocked});
    emitCombatFx(room,{kind:'action-attack',attacker:a.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:false,critical:false,label:'ACTION HIT!'});
    interruptDomainCharge(room,d,damage);
    if(checkWinner(room)){emitState(room);return;}
    finishAction(room,true);
  };

  if(a.confusedMissTurns<=0&&maybeStartParry(room,{attacker:a.slot,defender:d.slot,label,hits:[total],onResolve:finalize}))return {ok:true,deferred:true};
  finalize(null);return {ok:true};
}
function doDefend(room, base=6, actionMode=false){
  const p=room.players[room.current];
  if(p.armourDefenceLock>0)return {error:'Armour Break blocks Defence moves.'};
  if(!DAMAGE_DICE.includes(+base))return {error:'Invalid Defence die.'};
  const count=actionMode?randomPoolCount(room,base):1;
  const sides=defenceDie(p,base),rs=[];
  for(let i=0;i<count;i++)rs.push(rollAttackDie(room,p,room.players[1-p.slot],sides,'Defence roll'));
  const sp=defenceBonus(p),itemDie=consumeMagicDice(room,p),baseRaw=Math.max(0,Math.max(4,Math.min(6,rs[0]))+sp.bonus+itemDie),raw=(p.pulled>0||p.windblown)?Math.floor(baseRaw*.8):baseRaw,before=p.defence;
  if(p.pulled>0||p.windblown){p.pulled=0;p.windblown=false;logRoom(room,`🌬️ ${p.name}'s Guard is 20% weaker while Pulled/Windblown.`,'bad');}
  p.defence=clamp(p.defence+raw,0,20);p.defenceUses=Math.min(3,p.defenceUses+1);
  logRoom(room, `🛡️ ${p.name} rolls ${count}D${sides}: ${rs.join(' + ')}${sp.bonus?` + ${sp.bonus}`:''}${itemDie?` + item D6 ${itemDie}`:''}; Defence ${before} → ${p.defence}/20 (${p.defenceUses}/3 marker).`, 'special');
  emitDefenceFx(room,{slot:p.slot,label:`GUARD +${p.defence-before}`,amount:p.defence-before,total:p.defence});
  finishAction(room,actionMode);return {ok:true};
}
function doDefensiveStance(room){
  const p=room.players[room.current];
  if(p.armourDefenceLock>0)return {error:'Armour Break blocks Defence moves.'};
  if(p.defensiveStanceUsed)return {error:'Defensive Stance can only be used once per turn.'};
  p.defensiveStanceUsed=true;
  let gained=rollRangeShown(room,2,3,'Defensive Stance');if(p.windblown){gained=Math.floor(gained*.8);p.windblown=false;}
  const before=p.defence;p.defence=clamp(before+gained,0,20);
  p.defensiveStancePenalty=3;
  logRoom(room,`🛡️ ${p.name} uses Defensive Stance: +${p.defence-before} Defence; remaining damaging moves this turn deal −3 damage.`,'special');
  emitDefenceFx(room,{slot:p.slot,label:'DEFENSIVE STANCE',amount:p.defence-before,total:p.defence});
  emitState(room);return {ok:true}; // Free action, player's regular move is still available.
}
function doParry(room){
  const p=room.players[room.current];
  if(p.armourDefenceLock>0)return {error:'Armour Break blocks Defence moves.'};
  if(p.parryCooldown>0)return {error:`Parry is on cooldown for ${p.parryCooldown} more turn(s).`};
  if(p.parryReady)return {error:'Parry Stance is already ready.'};
  p.parryReady=true;
  logRoom(room,`🗡️ ${p.name} enters Parry Stance. The next incoming attack/effect can trigger a reaction check.`,'special');
  emitDefenceFx(room,{slot:p.slot,label:'PARRY READY',amount:0,perfect:true});
  finishAction(room,false);return {ok:true};
}
function doCharge(room, actionMode=false, choice='auto'){
  const p=room.players[room.current];
  if(p.charge==='charging'||p.beamCharge==='charging')return {error:'Energy is already charging.'};
  if(p.beamCharge==='ready')return {needsBeamDie:true};
  if(p.charge==='ready'){
    if(choice==='charged')return {error:'Choose Charged Attack from the Charge menu timing button.'};
    if(!['auto','prepare','unstable'].includes(choice))return {error:'Unknown Charge choice.'};
    if(p.beamCooldown>0&&!p.beamCooldownBypass)return {error:`Beam is on cooldown for ${p.beamCooldown} more turn(s). Charged Attack remains available.`};
    if(choice==='unstable'){
      if(!spendMomentum(p,10))return {error:'Unstable Beam costs 10% Momentum.'};
      p.charge='none';p.beamCharge='ready';
      logRoom(room,`⚠️ ${p.name} unleashes UNSTABLE BEAM! -10% Momentum, D12 +6 Beam, 5 recoil HP; skips Beam preparation.`,'special');
      return fireBeam(room,actionMode,12,false,true);
    }
    if(!spendMomentum(p,15))return {error:'Prepare Beam costs 15% Momentum.'};
    p.charge='none';p.beamCharge='charging';
    logRoom(room,`☄️ ${p.name} prepares a stable Beam for -15% Momentum. The Beam will become ready after its usual charge turn.`,'special');
    finishAction(room,actionMode,true);return {ok:true};
  }
  if(choice!=='auto'&&choice!=='start')return {error:'Build Energy Charge first.'};
  if(p.charge==='none'&&p.beamCharge==='none'){
    p.charge='charging';
    const mom=addMomentum(p,7);
    logRoom(room,`🔥 ${p.name} begins Energy Charge. +${mom.gained}% Momentum (${mom.before}% → ${mom.after}%).`,'special');
    finishAction(room,actionMode,true);return {ok:true};
  }
  return {error:'No Charge/Beam action is available.'};
}
function applyThrownEffect(room,a,d,effect,boosted=false,extended=false){
  const extraTurn=extended?1:0;
  let extra='';
  if(effect==='shock'){
    d.shock=2+extraTurn;d.shockDie=greatExceptionSides(a,boosted?6:4);d.conductiveUsed=false;
    extra=`Shock will deal D${d.shockDie} damage and make a 50/50 skip check for ${2+extraTurn} turns.`;
  } else if(effect==='bleed'){
    d.bleed=2+extraTurn;d.bleedDie=greatExceptionSides(a,boosted?6:4);
    extra=`Bleed will deal D${d.bleedDie} damage for ${2+extraTurn} turns.`;
  } else if(effect==='poison'){
    d.poison=2+extraTurn;d.poisonDie=greatExceptionSides(a,4);extra=`Poison deals D${d.poisonDie} damage for ${2+extraTurn} turns.`;
  } else if(effect==='energyleak'){
    d.energyLeak=2+extraTurn;extra=`Drains 8 Momentum at the start of each of the target’s next ${2+extraTurn} turns.`;
  } else if(effect==='weakness'){
    d.weakness=2+extraTurn;extra=`Attack dice are weakened for ${2+extraTurn} turns.`;
  } else if(effect==='armourbreak'){
    d.armourBreak=2+extraTurn;
    const cut=halveDefenceForArmourBreak(d),before=cut.before;
    extra=before?`Armour Break destroys 75% of stored Defence (${before} → ${d.defence}) and locks Defence moves for the next turn.`:'Defence moves are locked for the next turn.';
  }
  return extra;
}
function doEffect(room, effect, actionMode=false, fromSpecial=false){
  if(effect==='boooo'){
    const a=room.players[room.current],d=room.players[1-room.current];
    if(d.special!=='glovedone')return {error:'Boooo can only target The Gloved One.'};
    if((a.booooCooldown||0)>0)return {error:`Boooo cooldown: ${a.booooCooldown} turn(s).`};
    if((d.gloveHype||0)<50)return {error:'Boooo requires the opponent to have at least 50 Crowd Hype.'};
    d.gloveHype=Math.max(0,d.gloveHype-25);d.momentum=d.gloveHype;
    a.booooCooldown=3; // Current turn ticks once; 2 complete future turns.
    if(a.stats)a.stats.effectsUsed++;
    logRoom(room,`👎 BOOOO! ${a.name} heckles ${d.name}, removing 25 Crowd Hype (${d.gloveHype}/100 remains).`,'special');
    finishAction(room,actionMode);return {ok:true};
  }
  if(!EFFECTS.includes(effect))return {error:'Unknown effect.'};
  const a=room.players[room.current],d=room.players[1-room.current];
  if(['badluck','fortune'].includes(effect)&&a.special!=='gambler')return {error:'Only The Gambler can use this effect.'};
  if(effect==='shock'&&!fromSpecial)return {error:'Shock is only available from Nightcrawler’s Special menu.'};
    if(a.effectCooldowns[effect]>0)return {error:`${effect} is on cooldown.`};
  
  if(effect==='badluck'){
    if(a.stats)a.stats.effectsUsed++;
    d.badLuck=Math.max(d.badLuck,3);a.effectCooldowns.badluck=4;
    logRoom(room,`🎲 ${a.name} curses ${d.name} with Bad Luck: their next attack or Defence roll takes the lower of two dice.`,'special');
    finishAction(room,actionMode);return {ok:true};
  }
  if(effect==='fortune'){
    if(a.stats)a.stats.effectsUsed++;
    a.fortune=3;a.effectCooldowns.fortune=4;
    logRoom(room,`🍀 ${a.name} gains Fortune: the next attack or Defence roll takes the higher of two dice.`,'special');
    finishAction(room,actionMode);return {ok:true};
  }
  if(effect==='adrenaline'){
    a.adrenaline=true;
    a.effectCooldowns.adrenaline=4; // 3-turn recovery, current turn counts down
    if(a.stats)a.stats.effectsUsed++;
    logRoom(room,`💪 ${a.name} activates Adrenaline. Next Normal, Heavy or Charged Attack gets +3 damage and deals 2 recoil if it wounds HP. (3-turn cooldown)`, 'special');
    finishAction(room,actionMode);return {ok:true};
  }
  if(effect==='strengthen'){
    a.strengthen=true;
    if(a.stats)a.stats.effectsUsed++;
    const cooldownTurns=2;a.effectCooldowns[effect]=cooldownTurns+1;
    logRoom(room,`🧪 ${a.name} uses Strengthen. Next offensive roll gains one damage tier, or +2 at D20. Strengthen now has a 2-turn cooldown.`,'special');
    finishAction(room,actionMode,fromSpecial&&effect==='shock');return {ok:true};
  }

  const boosted=(effect==='shock'||effect==='bleed')&&a.strengthen;
  if(boosted)a.strengthen=false;
  const cooldownTurns=['shock','bleed','poison'].includes(effect)?5:effect==='energyleak'?4:2;
  a.effectCooldowns[effect]=cooldownTurns+1;

  if(companionBlocksEffect(room,d,`${effect} effect`)){
    logRoom(room,`🧪 ${a.name}'s ${effect} is stopped by the Companion shield. ${effect} still enters its ${cooldownTurns}-turn cooldown.`,'info');
    finishAction(room,actionMode,fromSpecial&&effect==='shock');return {ok:true};
  }

  const difficultyDamage=effect==='shock'||effect==='bleed'?(boosted?6:4):effect==='poison'?4:effect==='weakness'?7:effect==='energyleak'?8:10;
  if(a.confusedMissTurns>0){
    logRoom(room,`🥸 ${a.name} is Confused and misses ${d.name} with ${effect}. The effect is not applied.`,'bad');
    finishAction(room,actionMode,fromSpecial&&effect==='shock');return {ok:true};
  }
  const finalize=(parryResults=null)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🗡️ ${d.name} PARRIES ${a.name}'s ${effect}! The effect is denied.`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY EFFECT!',amount:0,perfect:true});
      finishAction(room,actionMode,fromSpecial&&effect==='shock');return;
    }

    const extra=applyThrownEffect(room,a,d,effect,boosted,!fromSpecial);
    if(a.stats)a.stats.effectsUsed++;
    resolveStatusCombos(room,d);
    if(attempted){
      hurtFighter(room,d,1);
      logRoom(room,`💢 ${d.name} misses the Parry and takes +1 damage as ${effect} lands.`,'bad');
    }
    logRoom(room,`🧪 ${a.name} uses ${effect} on ${d.name}. ${extra} ${effect} now has a ${cooldownTurns}-turn cooldown.`,'special');
    if(checkWinner(room)){emitState(room);return;}
    finishAction(room,actionMode,fromSpecial&&effect==='shock');
  };

  if(maybeStartParry(room,{attacker:a.slot,defender:d.slot,label:`${effect} effect`,hits:[difficultyDamage],onResolve:finalize}))return {ok:true,deferred:true};
  finalize(null);return {ok:true};
}
function awardGreatExceptionItemMomentum(room,p,actualDamage,label='Item'){
  if(p?.special!=='greatexception'||actualDamage<=0)return;
  const gain=clamp(5+Math.round(actualDamage*.5),5,15);
  const before=p.momentum||0;p.momentum=clamp(before+gain,0,100);
  logRoom(room,`👜 ${label} gives ${p.name} +${p.momentum-before}% Momentum from ${actualDamage} HP damage.`, 'good');
}
function applyMagicBagAttack(room,a,d,raw,label,{bleed=false,armourBreak=false,windblown=false,distracted=false}={}){
  const effectProtectedAtImpact=companionEffectShieldActive(d);
  const finalize=(parryResults=null,deferred=false)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🗡️ ${d.name} PARRIES ${label} from Magic Bag!`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY ITEM!',amount:0,perfect:true});
      emitCombatFx(room,{kind:'parry',attacker:a.slot,defender:d.slot,damage:0,blocked:0,dodged:true,critical:true,label:'PARRY ITEM!'});
      if(deferred)finishAction(room,false);
      return;
    }

    if(armourBreak){
      if(effectProtectedAtImpact){
        logRoom(room,`🧟🛡️ ${d.name}'s Companion shield blocks Toy Army's Armour Break.`,'special');
      }else{
        d.armourBreak=2;
        const {before}=halveDefenceForArmourBreak(d);
        logRoom(room,`💔 Toy Army inflicts Armour Break on ${d.name}; Defence ${before} → ${d.defence}.`,'special');
      }
    }
    const res=absorbAttack(room,d,raw+(a.special==='greatexception'?2:0),a,{normalAttack:false});
    if(!res.confusedMiss&&!res.umbrellaDodge&&!res.sixEyes){if(windblown)d.windblown=true;if(distracted)d.distracted=true;}
    const damage=res.damage+(attempted?1:0);
    hurtFighter(room,d,damage);
    reflectSeduced(room,a,damage,label);
    if(attempted)logRoom(room,`💢 ${d.name} misses the Parry and takes +1 extra damage.`,'bad');
    if(res.confusedMiss)logRoom(room,`🥸 ${a.name} is Confused and misses ${d.name} with ${label}.`,'special');
    else if(res.umbrellaDodge)logRoom(room,`☂️ ${d.name}'s Umbrella dodge avoids ${label}${attempted?' but missed-Parry damage still deals 1':''}!`,'special');
    else if(res.sixEyes)logRoom(room,`👁️ ${d.name}'s Six Eyes blocks ${label}${attempted?' but missed-Parry damage still deals 1':''}!`,'special');
    else logRoom(room,`👜 ${a.name} uses ${label} from Magic Bag for ${raw}; ${d.name} takes ${damage} damage.`,'special');
    if(bleed && damage>0){
      if(effectProtectedAtImpact)logRoom(room,`🧟🛡️ ${d.name}'s Companion shield blocks the Knife's Bleed effect.`,'special');
      else {d.bleed=2;d.bleedDie=4;logRoom(room,`🩸 ${d.name} is Bleeding from the Knife.`,'bad');}
    }
    if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`BLOCK ${res.blocked}`,amount:res.blocked});
    emitCombatFx(room,{kind:'item',attacker:a.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:false,critical:false,label});
    interruptDomainCharge(room,d,damage);
    if(checkWinner(room)){emitState(room);return;}
    if(deferred)finishAction(room,false);
  };

  if(a.confusedMissTurns<=0&&maybeStartParry(room,{attacker:a.slot,defender:d.slot,label,hits:[raw],onResolve:r=>finalize(r,true)}))return {deferred:true};
  finalize(null,false);return {deferred:false};
}

function applyParryableStatusItem(room,p,d,{label,difficulty=6,onLand}){
  if(companionBlocksEffect(room,d,label)){
    return {deferred:false};
  }
  if(p.confusedMissTurns>0){
    logRoom(room,`🥸 ${p.name} is Confused and misses ${d.name} with ${label}.`,'bad');
    return {deferred:false};
  }
  const finalize=(parryResults=null,deferred=false)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🗡️ ${d.name} PARRIES ${label}! The item effect is denied.`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY ITEM!',amount:0,perfect:true});
      if(deferred)finishAction(room,false);
      return;
    }
    if(attempted){
      hurtFighter(room,d,1);
      logRoom(room,`💢 ${d.name} misses the Parry and takes +1 damage as ${label} lands.`,'bad');
    }
    onLand();
    if(checkWinner(room)){emitState(room);return;}
    if(deferred)finishAction(room,false);
  };
  if(maybeStartParry(room,{attacker:p.slot,defender:d.slot,label,hits:[difficulty],onResolve:r=>finalize(r,true)}))return {deferred:true};
  finalize(null,false);return {deferred:false};
}
function finishHotPotato(room,holderSlot,raw,parryResults=null){
  const hp=room.hotPotato;if(!hp)return;
  const holder=room.players[holderSlot];
  const attempted=Array.isArray(parryResults);
  if(attempted&&parryResults[0]){
    const next=1-holderSlot;
    hp.holder=next;hp.passes++;
    room.phase='hotPotato';
    logRoom(room,`🗡️ ${holder.name} PARRIES the Hot Potato explosion and deflects it to ${room.players[next].name}!`,'special');
    emitState(room);return;
  }
  const damage=raw+(attempted?1:0)+(hp.origin!==holderSlot&&room.players[hp.origin]?.special==='greatexception'?2:0);
  const hpHit=hurtFighter(room,holder,damage);
  if(hp.origin!==holderSlot)awardGreatExceptionItemMomentum(room,room.players[hp.origin],hpHit,'Hot Potato');
  if(attempted)logRoom(room,`💢 ${holder.name} misses the Hot Potato Parry and takes +1 extra damage.`,'bad');
  logRoom(room,`🥔💥 Hot Potato explodes on ${holder.name} for ${damage} damage! The Hot Potato game ends.`,'bad');
  emitCombatFx(room,{kind:'item',attacker:1-holderSlot,defender:holderSlot,damage,blocked:0,dodged:false,critical:false,label:'HOT POTATO!'});
  room.hotPotato=null;room.phase='turn';
  if(checkWinner(room)){emitState(room);return;}
  finishAction(room,false);
}
function passHotPotato(room,slot){
  const hp=room.hotPotato;if(!hp||hp.holder!==slot)return {error:'You are not holding the Hot Potato.'};
  const holder=room.players[slot];
  const explosion=rollShown(room,4,'Hot Potato explosion check')===1;
  if(explosion){
    const raw=rollRangeShown(room,6,7,'Hot Potato explosion damage');
    const onResolve=r=>finishHotPotato(room,slot,raw,r);
    if(maybeStartParry(room,{attacker:1-slot,defender:slot,label:'Hot Potato explosion',hits:[raw],onResolve}))return {ok:true,deferred:true};
    finishHotPotato(room,slot,raw,null);return {ok:true};
  }
  const next=1-slot;
  hp.holder=next;hp.passes++;
  logRoom(room,`🥔 ${holder.name} safely passes Hot Potato to ${room.players[next].name}.`,'special');
  emitState(room);return {ok:true};
}
function startHotPotato(room,p){
  const target=1-p.slot,id=crypto.randomBytes(6).toString('hex');
  room.hotPotato={id,origin:p.slot,holder:target,passes:0};
  room.phase='hotPotato';
  logRoom(room,`🥔 ${p.name} starts Hot Potato and tosses it to ${room.players[target].name}. Pass it before it explodes!`,'special');
  emitState(room);
  return {deferred:true};
}
function useMagicBagItem(room,p,item){
  if(item.id!=='__hidden_card_resolution__')markMagicBagItemUsed(p,item);
  const d=room.players[1-p.slot];
  const offensiveItems=new Set(['deckofcards','powerglove','gamblerscoin','kite','penguin','piano','bazooka','marbles','basketball','football','marble','knife','toyarmy','plates','chocolates','moustache','hotpotato','truck','anvil']);
  if(p.confusedMissTurns>0&&offensiveItems.has(item.id)){
    logRoom(room,`🥸 ${p.name} is Confused and misses ${d.name} with ${item.name}.`,'bad');
    return {deferred:false};
  }
  switch(item.id){
    case 'powerglove':p.powerGloveReady=true;logRoom(room,`🥊 ${p.name} equips Power Glove! Next damaging attack +7, then 4 recoil.`,'good');return {deferred:false};
    case 'gamblerscoin':{
      const heads=crypto.randomInt(2)===0;
      if(heads){p.coinAttackMultiplier=2;p.fortune=Math.max(p.fortune||0,3);logRoom(room,`🪙 HEADS! ${p.name}'s next attack deals double damage and gains Fortune for 2 turns.`,'good');}
      else{hurtFighter(room,p,7);p.badLuck=Math.max(p.badLuck||0,3);logRoom(room,`🪙 TAILS! ${p.name} takes 7 damage and gains Bad Luck for 2 turns.`,'bad');}
      io.to(room.code).emit('item-cinematic',{kind:'coin',owner:p.slot,heads,at:Date.now()});
      return {deferred:false};
    }
    case 'deckofcards':return startNewItemMini(room,p,'deck');
    case '__hidden_card_resolution__':{
      const card=item.hiddenCard,outcome=itemCardOutcome(card);
      io.to(room.code).emit('item-cinematic',{kind:'card',owner:p.slot,card,at:Date.now()});
      if(outcome.momentum){
        if(p.special==='glovedone'){applyHypeGain(p,outcome.momentum);}
        else p.momentum=clamp((p.momentum||0)+outcome.momentum,0,100);
      }
      if(outcome.fortune)p.fortune=Math.max(p.fortune||0,outcome.fortune+1);
      if(outcome.badluck)p.badLuck=Math.max(p.badLuck||0,outcome.badluck+1);
      if(outcome.self){hurtFighter(room,p,outcome.self);logRoom(room,`🃏 ${card.rank} ${card.suit} backfires: ${p.name} takes ${outcome.self} damage!`,'bad');return {deferred:false};}
      logRoom(room,`🃏 ${p.name} draws ${card.rank} ${card.suit} for ${outcome.damage} damage${outcome.momentum?`, and ${outcome.momentum>0?'+':''}${outcome.momentum} charge`:''}.`,'special');
      if(outcome.damage)return applyMagicBagAttack(room,p,d,outcome.damage,`Card ${card.rank} ${card.suit}`);
      return {deferred:false};
    }
    case 'mysterycandy':return startNewItemMini(room,p,'candy');
    case 'magic8ball':return startNewItemMini(room,p,'eightball');
    case 'cursedstopwatch':return startNewItemMini(room,p,'stopwatch');
    case 'kite':return applyMagicBagAttack(room,p,d,10,'Kite',{windblown:true});
    case 'penguin':return applyMagicBagAttack(room,p,d,12,'Penguin',{distracted:true});
    case 'magicmirror':p.magicMirrorReady=true;logRoom(room,`🪞 ${p.name} prepares Magic Mirror: reflect up to 10 HP damage from the next attack.`,'good');return {deferred:false};
    case 'piano': return applyMagicBagAttack(room,p,d,rollRangeShown(room,6,8,'Piano damage'),'A Piano');
    case 'bazooka': return applyMagicBagAttack(room,p,d,rollRangeShown(room,10,15,'BAZOOKA damage'),'A BAZOOKA');
    case 'truck': return applyMagicBagAttack(room,p,d,rollRangeShown(room,15,20,'Truck damage'),'Truck');
    case 'marbles': {
      if(companionBlocksEffect(room,d,'Marbles'))return {deferred:false};
      const applyMarbles=(parryResults=null,deferred=false)=>{
        const attempted=Array.isArray(parryResults);
        if(attempted&&parryResults[0]){
          logRoom(room,`🗡️ ${d.name} PARRIES the incoming Marbles. No slip effect is applied.`,'special');
          emitDefenceFx(room,{slot:d.slot,label:'PARRY MARBLES!',amount:0,perfect:true});
          if(deferred)finishAction(room,false);
          return;
        }
        if(attempted){
          hurtFighter(room,d,1);
          logRoom(room,`💢 ${d.name} misses the Marbles Parry and takes +1 damage.`,'bad');
          if(checkWinner(room)){emitState(room);return;}
        }
        if(rollShown(room,2,'Marbles slip check')===1){d.forcedSkip=Math.max(d.forcedSkip,1);logRoom(room,`🔵 ${p.name}'s Marbles work! ${d.name} will skip their next turn.`,'special');}
        else logRoom(room,`🔵 ${p.name} scatters Marbles, but ${d.name} avoids them.`,'info');
        if(deferred)finishAction(room,false);
      };
      if(maybeStartParry(room,{attacker:p.slot,defender:d.slot,label:'Marbles',hits:[5],onResolve:r=>applyMarbles(r,true)}))return {deferred:true};
      applyMarbles(null,false);return {deferred:false};
    }
    case 'basketball': return applyMagicBagAttack(room,p,d,rollShown(room,6,'Basketball damage'),'A Basketball');
    case 'football': return applyMagicBagAttack(room,p,d,rollShown(room,6,'Football damage'),'A Football');
    case 'marble': return applyMagicBagAttack(room,p,d,rollShown(room,4,'Marble damage'),'A Marble');
    case 'knife': {
      const raw=rollRangeShown(room,2,4,'Knife damage');
      if(rollShown(room,2,'Knife backfire check')===1){
        hurtFighter(room,p,raw);p.bleed=2;p.bleedDie=4;
        logRoom(room,`🔪 The Knife backfires! ${p.name} hits themself for ${raw} damage and starts Bleeding.`,'bad');
        return {deferred:false};
      }
      return applyMagicBagAttack(room,p,d,raw,'A Knife',{bleed:true});
    }
    case 'cupcake': {
      const before=p.hp;p.hp=clamp(p.hp+5,0,p.maxHp);
      logRoom(room,`🧁 ${p.name} eats A Cupcake and heals ${p.hp-before} HP.`,'good');return {deferred:false};
    }
    case 'birthdaycake': {
      const beforeP=p.hp,beforeD=d.hp;p.hp=clamp(p.hp+10,0,p.maxHp);d.hp=clamp(d.hp+5,0,d.maxHp);
      logRoom(room,`🎂 Birthday Cake heals ${p.name} for ${p.hp-beforeP} HP and ${d.name} for ${d.hp-beforeD} HP.`,'good');return {deferred:false};
    }
    case 'syringe':
      if(rollShown(room,2,'Used Syringe outcome')===1){p.syringeDamageTurns=3;logRoom(room,`💉 The Used Syringe is bad: ${p.name} will take 2–4 damage for 3 turns.`,'bad');}
      else {p.syringeHealTurns=3;logRoom(room,`💉 The Used Syringe is helpful: ${p.name} will heal 2–4 HP for 3 turns.`,'good');}
      return {deferred:false};
    case 'dice': p.magicDiceBonus=true;logRoom(room,`🎲 ${p.name}'s next Attack or Defence roll gains an extra D6 from A Dice.`,'good');return {deferred:false};
    case 'garbage': logRoom(room,`🗑️ ${p.name} uses Garbage. It does absolutely nothing.`,'info');return {deferred:false};
    case 'lollipop': {
      const before=p.hp;p.hp=clamp(p.hp+2,0,p.maxHp);logRoom(room,`🍭 ${p.name} eats A Lollipop and heals ${p.hp-before} HP.`,'good');return {deferred:false};
    }
    case 'toyarmy': return applyMagicBagAttack(room,p,d,rollShown(room,20,'Toy Army damage'),'Toy Army',{armourBreak:true});
    case 'plates': {
      const count=rollShown(room,4,'Plates — number of D4 dice'),rs=[];for(let i=0;i<count;i++)rs.push(rollShown(room,4,`Plates D4 ${i+1}/${count}`));
      return applyMagicBagAttack(room,p,d,rs.reduce((x,y)=>x+y,0),`Plates (${count}D4: ${rs.join(' + ')})`);
    }
    case 'burrito': {
      const h=rollShown(room,20,'Hot Head Burrito heal'),before=p.hp;p.hp=clamp(p.hp+h,0,p.maxHp);p.burn=2;
      logRoom(room,`🌯 Hot Head Burrito heals ${p.name} for ${p.hp-before} HP (D20 ${h}), but inflicts Burn for 2 turns.`,'special');return {deferred:false};
    }
    case 'shield': {
      const before=p.defence;p.defence=clamp(p.defence+10,0,20);
      logRoom(room,`🛡️ Shield raises ${p.name}'s Defence ${before} → ${p.defence}/20.`,'good');
      emitDefenceFx(room,{slot:p.slot,label:`SHIELD +${p.defence-before}`,amount:p.defence-before,total:p.defence});
      return {deferred:false};
    }
    case 'nationalflag': {
      if(p.nationalFlagUses>=2){logRoom(room,`🏳️ ${p.name} has already used National Flag twice this match.`,'bad');return {deferred:false};}
      p.nationalFlagUses++;
      const before=p.momentum;p.momentum=clamp((p.momentum||0)+25,0,100);
      logRoom(room,`🏳️ National Flag raises ${p.name}'s Momentum ${before}% → ${p.momentum}%.`,'good');
      return {deferred:false};
    }
    case 'healthpotion': {
      const heal=rollRangeShown(room,5,10,'Health Potion heal'),before=p.hp;p.hp=clamp(p.hp+heal,0,p.maxHp);
      logRoom(room,`🧪 Health Potion heals ${p.name} for ${p.hp-before} HP.`,'good');
      return {deferred:false};
    }
    case 'chocolates': {
      return applyParryableStatusItem(room,p,d,{label:'Box of Chocolates',difficulty:6,onLand:()=>{
        const before=d.hp;d.hp=clamp(d.hp+5,0,d.maxHp);
        logRoom(room,`🍫 ${d.name} accepts the chocolates and heals ${d.hp-before} HP.`,'good');
        if(rollShown(room,2,'Seduced success check')===1){
          const turns=rollShown(room,4,'Seduced duration');d.seduced=turns;
          logRoom(room,`💘 ${d.name} is Seduced for ${turns} turn(s)! Half of direct attack damage they deal will reflect back onto them.`,'special');
        }else logRoom(room,`🍫 The chocolates fail to Seduce ${d.name}.`,'info');
      }});
    }
    case 'moustache': {
      return applyParryableStatusItem(room,p,d,{label:'Moustache',difficulty:5,onLand:()=>{
        d.confusedMissTurns=Math.max(d.confusedMissTurns,1);
        logRoom(room,`🥸 ${d.name} is Confused. Their attacks and thrown effects will miss during their next turn.`,'special');
      }});
    }
    case 'hotpotato': return startHotPotato(room,p);
    case 'portalgun': {
      spawnCompanion(room,p);
      return {deferred:false};
    }
    case 'lion': {spawnLion(room,p);return {deferred:false};}
    case 'goldenapple': {
      p.goldenAppleTurns=3;
      logRoom(room,`🍏 ${p.name} eats the Golden Apple. It will regenerate 10 HP at the start of the next 3 personal turns.`,'good');
      return {deferred:false};
    }
    case 'anvil': return startAnvilTiming(room,p);
    case 'kebab': {
      const before=p.hp;p.hp=clamp(p.hp+4,0,p.maxHp);
      logRoom(room,`🥙 ${p.name} eats a Kebab and heals ${p.hp-before} HP.`,'good');
      return {deferred:false};
    }
  }
  return {deferred:false};
}




function resolveAnvilTiming(room,id,grade='bad'){
  const at=room?.anvilTiming;if(!at||at.id!==id)return;
  const p=room.players[at.slot],d=room.players[1-at.slot];
  grade=['perfect','good','bad'].includes(grade)?grade:'bad';
  const damage=grade==='perfect'?17:grade==='good'?10:5;
  room.anvilTiming=null;room.phase='turn';room.current=p.slot;
  logRoom(room,`⚒️ Anvil timing: ${grade.toUpperCase()} — ${damage} raw damage.`,'special');
  const result=applyMagicBagAttack(room,p,d,damage,'Anvil');
  if(!result?.deferred){
    if(checkWinner(room)){emitState(room);return;}
    finishAction(room,false);
  }
}
function startAnvilTiming(room,p){
  const id=crypto.randomBytes(6).toString('hex');
  room.anvilTiming={id,slot:p.slot,startedAt:Date.now()+500};
  room.phase='anvilTiming';
  logRoom(room,`⚒️ ${p.name} drops the Anvil — hit the vertical timing bar! BAD 5 / GOOD 10 / PERFECT 17.`,'special');
  emitState(room);
  scheduleGameTimer(()=>{const live=rooms.get(room.code);if(live?.anvilTiming?.id===id&&live.phase==='anvilTiming')resolveAnvilTiming(live,id,'bad');},4200);
  return {deferred:true};
}

function companionMovesRemaining(p){
  if(!p?.companion||(p.companionCooldown||0)>0)return 0;
  if(p.companion.type==='zombiedancers'){
    return Math.max(0,Number(p.companion.dancerMovesLimit||0)-(p.companion.dancerMovesUsedThisTurn||0));
  }
  return Math.max(0,Number(p.companionMovesLimit||0)-(p.companionMovesUsedThisTurn||0));
}
function canUseCompanionMove(p){
  return !!p?.companion && (p.companionCooldown||0)<=0 && companionMovesRemaining(p)>0;
}
function finishCompanionMove(room,p,label='Companion move',countsAsAttack=false){
  if(!p?.companion){emitState(room);return;}
  if(p.companion.type==='zombiedancers'){
    finishZombieDancerMove(room,p);
    return;
  }
  p.companionMovesUsedThisTurn=(p.companionMovesUsedThisTurn||0)+1;
  if(p.companionMovesUsedThisTurn>=Math.max(1,p.companionMovesLimit||1)){
    p.companionCooldown=Math.max(p.companionCooldown||0,2);
    logRoom(room,`🟡 ${p.name}'s ${p.companion.name} uses all of its Companion Moves and will recover for the next personal turn.`,'info');
  }
  if(!countsAsAttack)loseMomentumForNonAttack(room,p,label);
  if(room.phase==='companionOnly'){
    if(p.actionsRemaining>0){
      room.phase='turn';
      emitState(room);
      return;
    }
    if(!canUseCompanionMove(p)){
      fullEndTurn(room);
      return;
    }
  }
  emitState(room);
}
function requireCompanionTurn(socket,ack){
  const room=getRoomForSocket(socket);
  if(!room){fail(ack,'You are not in a room.');return null;}
  if(room.status!=='playing'||!['turn','companionOnly'].includes(room.phase)){fail(ack,'Companion moves are not available right now.');return null;}
  if(room.current!==socket.data.slot){fail(ack,'It is not your turn.');return null;}
  if(room.winner!==null){fail(ack,'The battle is over.');return null;}
  const p=room.players[socket.data.slot];
  if(Number.isInteger(p?.heldByCompanionOwner)){fail(ack,'You cannot use a Companion while Held in Place.');return null;}
  if(!p?.companion){fail(ack,'You do not have an active Companion.');return null;}
  if((p.companionCooldown||0)>0){fail(ack,`Your Companion is recovering for ${p.companionCooldown} more turn(s).`);return null;}
  if(!canUseCompanionMove(p)){fail(ack,'You already used your Companion Move this turn.');return null;}
  return room;
}

function finishZombieDancerMove(room,p){
  const c=p.companion;
  if(!c||c.type!=='zombiedancers'){emitState(room);return;}
  c.dancerMovesUsedThisTurn=(c.dancerMovesUsedThisTurn||0)+1;
  loseMomentumForNonAttack(room,p,'Zombie Dancers move');
  if(c.dancerMovesUsedThisTurn>=Math.max(1,c.dancerMovesLimit||3)){
    p.companionCooldown=Math.max(p.companionCooldown||0,2);
    logRoom(room,`🧟‍♂️🕺 ${p.name} uses all ${c.dancerMovesLimit||3} Zombie Dancer move(s). The dancers recover next personal turn and the current turn ends.`,'special');
    fullEndTurn(room);
  }else{
    emitState(room);
  }
}

function finishFreeCompanionMove(room){
  emitState(room);
}
function companionDirectAttack(room,p,d,raw,label,{consumeMove=true,bleedChance=0,bleedTurns=2}={}){
  const protectedAtImpact=companionEffectShieldActive(d);
  const companionMom=addMomentum(p,3);
  if(companionMom.gained>0)logRoom(room,`🐾 ${label} adds ${companionMom.gained}% Momentum (${companionMom.before}% → ${companionMom.after}%).`,'good');
  const finalize=(parryResults=null)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🗡️ ${d.name} PARRIES ${label}!`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY COMPANION!',amount:0,perfect:true});
      if(consumeMove)finishCompanionMove(room,p,label,true);else finishFreeCompanionMove(room);
      return;
    }
    const res=absorbAttack(room,d,raw,p,{normalAttack:false});
    const damage=res.damage+(attempted?1:0);
    hurtFighter(room,d,damage);
    reflectSeduced(room,p,damage,label);
    if(attempted)logRoom(room,`💢 ${d.name} misses the Parry and takes +1 extra damage.`,'bad');
    const landed=!res.confusedMiss&&!res.umbrellaDodge&&!res.sixEyes&&!res.umbrellaDistance;
    if(landed&&bleedChance>0&&(bleedChance>=1||rollShown(room,Math.max(2,Math.round(1/bleedChance)),`${label} Bleed check`)===1)){
      if(protectedAtImpact)logRoom(room,`🛡️ ${d.name}'s Companion shield blocks ${label}'s Bleed.`,'special');
      else{d.bleed=Math.max(d.bleed,bleedTurns);d.bleedDie=4;logRoom(room,`🩸 ${label} inflicts Bleed for ${bleedTurns} turns.`,'bad');}
    }
    logRoom(room,`🐾 ${p.name}'s companion uses ${label}. ${d.name} takes ${damage} damage.`,'special');
    if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`BLOCK ${res.blocked}`,amount:res.blocked});
    emitCombatFx(room,{kind:'companion',attacker:p.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:!landed,critical:false,label});
    if(landed&&/bite/i.test(label))io.to(room.code).emit('companion-fx',{type:'bite',slot:p.slot,target:d.slot,big:/big bite/i.test(label),label});
    if(checkWinner(room)){emitState(room);return;}
    if(consumeMove)finishCompanionMove(room,p,label,true);else finishFreeCompanionMove(room);
  };
  if(p.confusedMissTurns<=0&&maybeStartParry(room,{attacker:p.slot,defender:d.slot,label,hits:[raw],onResolve:finalize}))return {deferred:true};
  finalize(null);return {deferred:false};
}
function companionStatusAttack(room,p,d,label,difficulty,onLand,{consumeMove=true}={}){
  const companionMom=addMomentum(p,2);
  if(companionMom.gained>0)logRoom(room,`🐾 ${label} adds ${companionMom.gained}% Momentum (${companionMom.before}% → ${companionMom.after}%).`,'good');
  if(companionBlocksEffect(room,d,label)){
    if(consumeMove)finishCompanionMove(room,p,label,true);else finishFreeCompanionMove(room);
    return {deferred:false};
  }
  const finalize=(parryResults=null)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🗡️ ${d.name} PARRIES ${label}!`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY COMPANION!',amount:0,perfect:true});
      if(consumeMove)finishCompanionMove(room,p,label,true);else finishFreeCompanionMove(room);
      return;
    }
    if(attempted){
      hurtFighter(room,d,1);
      logRoom(room,`💢 ${d.name} misses the Parry and takes +1 damage as ${label} lands.`,'bad');
      if(checkWinner(room)){emitState(room);return;}
    }
    onLand();
    if(/bite/i.test(label))io.to(room.code).emit('companion-fx',{type:'bite',slot:p.slot,target:d.slot,big:/big bite/i.test(label),label});
    if(consumeMove)finishCompanionMove(room,p,label,true);else finishFreeCompanionMove(room);
  };
  if(maybeStartParry(room,{attacker:p.slot,defender:d.slot,label,hits:[difficulty],onResolve:finalize}))return {deferred:true};
  finalize(null);return {deferred:false};
}
function setCompanionGuard(room,p,amount,label){
  const c=p.companion;if(!c)return {error:'No active Companion.'};
  if(c.defendUsed)return {error:'Defend Me has already been used by this Companion stage.'};
  c.defendUsed=true;c.guard=amount;c.guardMax=amount;
  logRoom(room,`🛡️ ${p.name}'s ${c.name} uses Defend Me for ${amount} Companion Defence.`,'special');
  emitDefenceFx(room,{slot:p.slot,label:`${label||c.name.toUpperCase()} +${amount}`,amount,total:p.defence});
  finishCompanionMove(room,p,'Defend Me');
  return {ok:true};
}

function judasDirectSpecial(room,p,{
  label,
  minDamage,
  maxDamage,
  bleedTurns=0,
  armourBreakTurns=0,
  weaknessTurns=0,
  cooldownField=null,
  cooldownTurns=0,
  kingBonus=false,
  chargeBoost=0,chargeDebuff=false,
  skipDecoy=false
}){
  const d=room.players[1-room.current];

  if(!skipDecoy&&maybeStartDecoy(room,{
    attacker:p.slot,defender:d.slot,label,
    onSuccess:()=>judasDirectSpecial(room,p,{label,minDamage,maxDamage,bleedTurns,armourBreakTurns,weaknessTurns,cooldownField,cooldownTurns,kingBonus,chargeBoost,chargeDebuff,skipDecoy:true}),
    onMiss:()=>{
      addDamagingSpecialMomentum(room,p,label);
      if(cooldownField)p[cooldownField]=cooldownTurns+1;
      logRoom(room,`🎭 ${p.name}'s ${label} strikes a Decoy and misses ${d.name}.`,'special');
      finishAction(room,false,true);
    }
  }))return {ok:true,deferred:true};

  addDamagingSpecialMomentum(room,p,label);
  let raw=rollRangeShown(room,minDamage,maxDamage,`${label} damage`)+chargeBoost;
  if(kingBonus && p.special==='redjudas' && p.kingTurns>0){
    raw+=2;
    logRoom(room,`👑 King of Curses adds +2 damage to ${label}.`,'special');
  }

  if(cooldownField){
    // Current turn cooldown tick happens as the action ends.
    p[cooldownField]=cooldownTurns+1;
  }

  // If the Zombie shield existed when the move hit, it protects against the
  // status rider even if the direct damage breaks the last shield point.
  const effectProtectedAtImpact=companionEffectShieldActive(d);

  const finalize=(parryResults=null)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🗡️ ${d.name} PARRIES ${p.name}'s ${label}! No damage or status is applied.`,'special');
      emitDefenceFx(room,{slot:d.slot,label:`PARRY ${label.toUpperCase()}!`,amount:0,perfect:true});
      emitCombatFx(room,{kind:'parry',attacker:p.slot,defender:d.slot,damage:0,blocked:0,dodged:true,critical:true,label:'PARRY!'});
      finishAction(room,false,true);
      return;
    }

    const res=absorbAttack(room,d,raw,p,{normalAttack:false});
    const damage=res.damage+(attempted?1:0);
    hurtFighter(room,d,damage);
    reflectSeduced(room,p,damage,label);

    if(attempted)logRoom(room,`💢 ${d.name} misses the Parry and takes +1 extra damage.`,'bad');

    if(res.confusedMiss){
      logRoom(room,`🥸 ${p.name} is Confused and misses ${d.name} with ${label}.`,'bad');
    }else if(res.umbrellaDodge){
      logRoom(room,`☂️ ${d.name}'s Umbrella dodge avoids ${label}.`,'special');
    }else if(res.sixEyes){
      logRoom(room,`👁️ ${d.name}'s Six Eyes blocks ${label} completely.`,'special');
    }else if(res.kingBypass){
      logRoom(room,`👑 ${p.name}'s ${label} ignores ${d.name}'s defensive protection and deals ${damage} damage.`,'special');
    }else{
      logRoom(room,`💥 ${p.name} uses ${label} for ${raw}; ${d.name} takes ${damage} damage${res.blocked?` after ${res.blocked} Defence`:''}.`,'special');
    }

    const landed=!res.confusedMiss&&!res.umbrellaDodge&&!res.sixEyes&&!res.umbrellaDistance;

    if(landed&&chargeDebuff){
      const effects=['weakness','armourBreak','poison'];const effect=effects[GR.randomInt(effects.length)];
      if(effect==='weakness')d.weakness=Math.max(2,d.weakness);
      else if(effect==='armourBreak')d.armourBreak=Math.max(2,d.armourBreak);
      else d.poison=Math.max(2,d.poison);
      logRoom(room,`🔴 Two Red Charges apply ${effect} to ${d.name}!`,'special');
    }
    if(landed && bleedTurns>0 && rollShown(room,2,`${label} Bleed check`)===1){
      if(effectProtectedAtImpact)logRoom(room,`🧟🛡️ ${d.name}'s Companion shield blocks ${label}'s Bleed.`,'special');
      else{
        d.bleed=Math.max(d.bleed,bleedTurns);
        d.bleedDie=4;
        logRoom(room,`🩸 ${label} inflicts Bleed for ${bleedTurns} turn(s).`,'bad');
      }
    }

    if(landed && armourBreakTurns>0 && rollShown(room,2,`${label} Armour Break check`)===1){
      if(effectProtectedAtImpact)logRoom(room,`🧟🛡️ ${d.name}'s Companion shield blocks ${label}'s Armour Break.`,'special');
      else{
        d.armourBreak=Math.max(d.armourBreak,armourBreakTurns);d.armourDefenceLock=1;
        const {before}=halveDefenceForArmourBreak(d);
        logRoom(room,`💔 ${label} inflicts Armour Break for ${armourBreakTurns} turn(s); Defence ${before} → ${d.defence}.`,'bad');
      }
    }

    if(landed && weaknessTurns>0 && rollShown(room,2,`${label} Weakness check`)===1){
      if(effectProtectedAtImpact)logRoom(room,`🧟🛡️ ${d.name}'s Companion shield blocks ${label}'s Weakness.`,'special');
      else{
        d.weakness=Math.max(d.weakness,weaknessTurns);
        logRoom(room,`🫥 ${label} inflicts Weakness for ${weaknessTurns} turn(s).`,'bad');
      }
    }

    if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`BLOCK ${res.blocked}`,amount:res.blocked});
    emitCombatFx(room,{kind:'judas-special',attacker:p.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:!!(res.confusedMiss||res.umbrellaDodge||res.sixEyes),critical:false,label});

    interruptDomainCharge(room,d,damage);
    if(checkWinner(room)){emitState(room);return;}
    finishAction(room,false,true);
  };

  if(p.confusedMissTurns<=0 && maybeStartParry(room,{
    attacker:p.slot,
    defender:d.slot,
    label,
    hits:[raw],
    onResolve:finalize
  })) return {ok:true,deferred:true};

  finalize(null);
  return {ok:true};
}



function normalizeAngle(a){a=Number(a)||0;return ((a%360)+360)%360;}
function angleDistance(a,b){
  const d=Math.abs(normalizeAngle(a)-normalizeAngle(b));
  return Math.min(d,360-d);
}
function chooseDeathRayCenter(fromAngle){
  for(let i=0;i<12;i++){
    const c=roll(360)-1;
    if(angleDistance(c,fromAngle)>55)return c;
  }
  return normalizeAngle(fromAngle+120);
}
function finishDeathRayGame(room,reason='finished'){
  const dr=room.deathRayGame;if(!dr)return;
  const p=room.players[dr.slot];
  room.deathRayGame=null;room.phase='turn';room.current=dr.slot;
  if(dr.hits>=5){
    p.beamCharge='ready';
    p.beamCooldownBypass=true;
    logRoom(room,`☄️ PERFECT DEATH RAY! ${p.name} hits all 5 green bars. Beam is READY and may be fired even through its current cooldown.`,'special');
  }else{
    logRoom(room,`☄️ Death Ray ${reason}. ${p.name} banks +${dr.hits} damage for the next Beam.`,'info');
  }
  finishAction(room,false);
}
function startDeathRayGame(room,p){
  if(p.deathRayCooldown>0)return {error:`Death Ray is on cooldown for ${p.deathRayCooldown} more turn(s).`};
  p.deathRayCooldown=3; // after turn end -> 2-turn cooldown.
  notePresentationAbility(room,p,'deathray','Death Ray');
  const id=crypto.randomBytes(6).toString('hex');
  const startAngle=270,center=chooseDeathRayCenter(startAngle);
  room.deathRayGame={
    id,slot:p.slot,hits:0,center,width:40,direction:1,startAngle,
    startedAt:Date.now()+650,rotationMs:700
  };
  room.phase='deathRayGame';
  logRoom(room,`☄️ ${p.name} starts Death Ray calibration! Hit the green wedge five times. Each success gives +1 next-Beam damage; every green wedge becomes half as large and the needle reverses direction.`,'special');
  emitState(room);
  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    if(live?.deathRayGame?.id===id&&live.phase==='deathRayGame')finishDeathRayGame(live,'times out');
  },16000);
  return {ok:true,deferred:true};
}


function updateHollowPurpleDecay(hp,now=Date.now()){
  if(!hp||hp.phase!=='charge')return;
  const dt=Math.max(0,now-(hp.lastUpdate||now))/1000;
  hp.lastUpdate=now;
  if(!hp.redLocked)hp.red=Math.max(0,hp.red-dt*hp.decayPerSec);
  if(!hp.blueLocked)hp.blue=Math.max(0,hp.blue-dt*hp.decayPerSec);
}
function resolveHollowPurple(room,id){
  const hp=room.hollowPurple;
  if(!hp||hp.id!==id||hp.phase!=='cinematic')return;
  const a=room.players[hp.slot],d=room.players[1-hp.slot];
  const chargeBonus=3*((a.blueCharges||0)+(a.redCharges||0));
  const raw=15+roll(21)-1+chargeBonus; // +3 for EACH earned Blue / Red Charge.
  const res=absorbAttack(room,d,raw,a,{normalAttack:false});
  const damage=res.damage;
  hurtFighter(room,d,damage);

  logRoom(room,`🟣 HOLLOW PURPLE! ${a.name} fires the merged Red + Blue sphere for ${raw} raw damage (including +${chargeBonus} from charges). ${d.name} takes ${damage} damage.`,'special');
  if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`HOLLOW PURPLE BLOCK ${res.blocked}`,amount:res.blocked});
  emitCombatFx(room,{kind:'hollow-purple',attacker:a.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:!!(res.sixEyes||res.umbrellaDodge),critical:true,label:'HOLLOW PURPLE!'});

  room.hollowPurple=null;
  room.phase='turn';
  room.current=a.slot;
  interruptDomainCharge(room,d,damage);
  if(checkWinner(room)){emitState(room);return;}
  finishAction(room,false,true);
}
function beginHollowPurpleCinematic(room){
  const hp=room.hollowPurple;if(!hp||hp.phase!=='charge')return;
  hp.phase='cinematic';
  hp.red=100;hp.blue=100;hp.redLocked=true;hp.blueLocked=true;
  hp.cinematicStartedAt=Date.now();
  hp.resolveAt=hp.cinematicStartedAt+6050;
  room.phase='ultimateHollowPurpleCinematic';
  logRoom(room,`🟣 MAX RED + MAX BLUE — ${room.players[hp.slot].name} creates HOLLOW PURPLE!`,'special');
  emitState(room);
  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    resolveHollowPurple(live,hp.id);
  },6075);
}
function startHollowPurple(room,p){
  if(p.special!=='bluejudas')return {error:'Hollow Purple belongs to Blue Judas.'};
  const infUlt=!!room.infiniteUltimates;
  if(!infUlt&&(p.momentum||0)<100)return {error:'Ultimate requires 100% Momentum.'};
  if(!infUlt)p.momentum=0;

  const id=crypto.randomBytes(6).toString('hex');
  room.hollowPurple={
    id,slot:p.slot,red:0,blue:0,redLocked:false,blueLocked:false,
    nextOrb:'red',lastUpdate:Date.now(),decayPerSec:8,phase:'charge',
    cinematicStartedAt:null,resolveAt:null
  };
  room.phase='ultimateHollowPurple';
  logRoom(room,`🟣 ${p.name} spends 100% Momentum and begins charging Hollow Purple! Mash SPACE to create Max Red and Max Blue.`,'special');
  emitState(room);
  return {ok:true,deferred:true};
}

function finalizeWorldCuttingSlash(room,id){
  const ws=room?.worldCutSlash;
  if(!ws||ws.id!==id||ws.stage!=='slash')return;
  const a=room.players[ws.slot],d=room.players[1-ws.slot];
  const raw=clamp(Number(ws.raw)||15,15,35);
  const res=absorbAttack(room,d,raw,a,{normalAttack:false});
  const damage=res.damage;
  hurtFighter(room,d,damage);

  logRoom(room,`✂️ WORLD CUTTING SLASH — ${String(ws.grade||'bad').toUpperCase()}! ${a.name} carves through space for ${raw} raw damage. ${d.name} takes ${damage} damage.`,'special');
  if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`WORLD SLASH BLOCK ${res.blocked}`,amount:res.blocked});
  emitCombatFx(room,{kind:'world-cutting-slash',attacker:a.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:!!(res.sixEyes||res.umbrellaDodge),critical:ws.grade==='perfect',label:`WORLD CUTTING SLASH — ${String(ws.grade||'bad').toUpperCase()}!`});

  room.worldCutSlash=null;
  room.phase='turn';
  room.current=a.slot;
  interruptDomainCharge(room,d,damage);
  if(checkWinner(room)){emitState(room);return;}
  finishAction(room,false,true);
}
function beginWorldSlashStrike(room,id,grade='bad'){
  const ws=room?.worldCutSlash;
  if(!ws||ws.id!==id||ws.stage!=='timing')return;
  grade=['perfect','good','bad'].includes(grade)?grade:'bad';
  ws.grade=grade;
  ws.raw=grade==='perfect'?35:grade==='good'?(15+roll(21)-1):15;
  ws.stage='slash';
  ws.slashStartedAt=Date.now();
  ws.resolveAt=ws.slashStartedAt+2500;
  logRoom(room,grade==='perfect'?`🎯 PERFECT WORLD SLASH! ${room.players[ws.slot].name} locks in MAX DAMAGE.`:grade==='good'?`⚔️ GOOD WORLD SLASH! Damage will roll from 15–35.`:`⚠️ BAD WORLD SLASH! The slash lands at minimum power.`,'special');
  emitState(room);
  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    finalizeWorldCuttingSlash(live,id);
  },2525);
}
function beginWorldSlashTiming(room,id){
  const ws=room?.worldCutSlash;
  if(!ws||ws.id!==id||ws.stage!=='chant')return;
  ws.stage='timing';
  ws.timingStartedAt=Date.now();
  ws.resolveAt=ws.timingStartedAt+1900;
  logRoom(room,`🎯 ${room.players[ws.slot].name} must time the World Cutting Slash! PERFECT = 35, GOOD = hidden 15–35, BAD = 15.`,'info');
  emitState(room);
  scheduleGameTimer(()=>{
    const live=rooms.get(room.code),cur=live?.worldCutSlash;
    if(cur?.id===id&&cur.stage==='timing')beginWorldSlashStrike(live,id,'bad');
  },1925);
}
function startWorldCuttingSlash(room,p){
  if(p.special!=='redjudas')return {error:'World Cutting Slash belongs to Red Judas.'};
  const infUlt=!!room.infiniteUltimates;
  if(!infUlt&&(p.momentum||0)<100)return {error:'Ultimate requires 100% Momentum.'};
  if(!infUlt)p.momentum=0;

  const id=crypto.randomBytes(6).toString('hex'),now=Date.now();
  room.worldCutSlash={id,slot:p.slot,startedAt:now,stage:'chant',timingStartedAt:null,slashStartedAt:null,grade:null,raw:null,resolveAt:now+4850};
  room.phase='ultimateWorldCuttingSlash';
  logRoom(room,`✂️ ${p.name} tears through space — WORLD CUTTING SLASH!`,'special');
  emitState(room);
  // Bubbles: 0.10–1.45, 1.55–2.90, 3.00–4.35. Timing appears exactly 0.5s later.
  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    beginWorldSlashTiming(live,id);
  },4850);
  return {ok:true,deferred:true};
}
// Reality Clash: four shared pulses, server-verified on each participant's clock.
// Even perfect resistance reduces -- it never cancels -- The Great Exception's Ultimate.
const REALITY_PULSE_OFFSETS=[1100,2250,3400,4550];
function beginRealityContest(room,p,choice,value=null){
  const rm=room?.realityManipulation;
  if(!rm||rm.slot!==p.slot||rm.stage!=='choice')return {error:'The Ultimate is not waiting for a rewrite.'};
  const allowed=['Attack','Defence','Charge','Effects','Action','Ultimate'];
  if(!['hp','momentum','seal'].includes(choice))return {error:'Choose a valid reality rewrite.'};
  if(choice==='seal'&&!allowed.includes(value))return {error:'Choose a normal button to seal (Special cannot be sealed).'};
  rm.choice=choice;rm.value=choice==='seal'?String(value):null;
  rm.stage='contest';rm.startedAt=Date.now();rm.deadline=rm.startedAt+5900;
  rm.pulses=REALITY_PULSE_OFFSETS.map(ms=>rm.startedAt+ms);
  rm.pressed=[[],[]];rm.scores=[0,0];
  room.phase='ultimateRealityManipulation';
  logRoom(room,`🌀 REALITY CLASH! ${p.name} distorts the rules; ${room.players[1-p.slot].name} can resist. Both players: hit the four pulses when the moving marker reaches the center!`,'special');
  emitState(room);
  const id=rm.id;
  scheduleGameTimer(()=>{const live=rooms.get(room.code);if(live?.realityManipulation?.id===id&&live.realityManipulation.stage==='contest')finishRealityContest(live);},6050);
  return {ok:true,deferred:true};
}
function pressRealityPulse(room,slot){
  const rm=room?.realityManipulation;
  if(room?.phase!=='ultimateRealityManipulation'||!rm||rm.stage!=='contest')return {error:'No Reality Clash pulse is active.'};
  if(![0,1].includes(slot))return {error:'Not a participant.'};
  const now=Date.now(),i=rm.pulses.findIndex((at,index)=>Math.abs(now-at)<=350&&!rm.pressed[slot].includes(index));
  if(i<0)return {ok:true,hit:false}; // An early tap never burns a future note.
  rm.pressed[slot].push(i);
  const diff=Math.abs(now-rm.pulses[i]),score=diff<=115?2:diff<=245?1:0;
  rm.scores[slot]+=score;
  io.to(room.code).emit('reality-pulse-fx',{slot,index:i,score,at:now});
  emitState(room);
  return {ok:true,hit:score>0,perfect:score===2,score:rm.scores[slot]};
}
function finishRealityContest(room){
  const rm=room?.realityManipulation;
  if(!rm||rm.stage!=='contest')return;
  const a=room.players[rm.slot],d=room.players[1-rm.slot];
  const attacker=rm.scores[a.slot]||0,defender=rm.scores[d.slot]||0;
  // Attacker advantage = strong, tied = moderate, defender advantage = reduced.
  const tier=attacker>defender?'strong':defender>attacker?'resisted':'standard';
  const hpDamage={strong:22,standard:16,resisted:10}[tier];
  const momentumDrain={strong:50,standard:35,resisted:20}[tier];
  const sealTurns={strong:3,standard:2,resisted:1}[tier];
  let summary='';
  if(rm.choice==='hp'){
    const actual=Math.min(hpDamage,Math.max(0,d.hp-1));
    d.hp-=actual;summary=`${actual} HP removed (cannot defeat the opponent outright)`;
  }else if(rm.choice==='momentum'){
    const before=d.special==='glovedone'?(d.gloveHype||0):(d.momentum||0),after=Math.max(0,before-momentumDrain);
    if(d.special==='glovedone'){d.gloveHype=after;d.momentum=after;}else d.momentum=after;
    summary=`${before-after} Momentum${d.special==='glovedone'?'/Hype':''} drained`;
  }else{
    if(!d.realitySealTurns)d.realitySealTurns={};
    d.realitySealTurns[rm.value]=Math.max(d.realitySealTurns[rm.value]||0,sealTurns); // active for N opponent turns
    summary=`${rm.value} sealed for ${sealTurns} opponent turn${sealTurns===1?'':'s'}`;
  }
  a.upgradedMagicBagTurns=Math.max(a.upgradedMagicBagTurns||0,3); // 2 complete future personal turns after activation
  logRoom(room,`🌀 REALITY ${tier.toUpperCase()}! Distortion ${attacker} vs Resistance ${defender}: ${summary}. Upgraded Magic Bag for 2 turns.`,'special');
  io.to(room.code).emit('reality-result',{attacker:a.slot,scores:[...rm.scores],tier,summary,at:Date.now()});
  room.realityManipulation=null;room.phase='turn';room.current=a.slot;
  if(checkWinner(room)){emitState(room);return;}
  finishAction(room,false,true);
}
function beginRealityManipulationChoice(room,id){
  const rm=room?.realityManipulation;if(!rm||rm.id!==id||rm.stage!=='cinematic')return;
  rm.stage='choice';rm.choiceAt=Date.now();
  logRoom(room,`🌀 ${room.players[rm.slot].name} must choose a limited rewrite. Both players will then contest it in a rhythm clash!`,'special');
  emitState(room);
  scheduleGameTimer(()=>{const live=rooms.get(room.code);if(live?.realityManipulation?.id===id&&live.realityManipulation.stage==='choice')beginRealityContest(live,live.players[rm.slot],'momentum');},14000);
}
function startRealityManipulation(room,p){
  if(p.special!=='greatexception')return {error:'Reality Manipulation belongs to The Great Exception.'};
  const infUlt=!!room.infiniteUltimates;
  if(!infUlt&&(p.momentum||0)<100)return {error:'Ultimate requires 100% Momentum.'};
  if(!infUlt)p.momentum=0;
  const id=crypto.randomBytes(6).toString('hex'),now=Date.now();
  room.realityManipulation={id,slot:p.slot,stage:'cinematic',startedAt:now,choiceAt:null};
  room.phase='ultimateRealityManipulation';
  logRoom(room,`🌀 ${p.name} activates REALITY MANIPULATION! Both players prepare for a REALITY CLASH.`,'special');
  emitState(room);
  scheduleGameTimer(()=>{const live=rooms.get(room.code);beginRealityManipulationChoice(live,id);},1750);
  return {ok:true,deferred:true};
}

// -----------------------------------------------------------------------------
// THE GAMBLER — server-authoritative blackjack, Texas Hold'em, coin and Domain.
// -----------------------------------------------------------------------------
function publicGamblerGame(room){
  const g=room.gamblerGame;if(!g)return null;
  if(g.type==='blackjack')return {type:g.type,id:g.id,owner:g.owner,turn:g.turn,
    hands:g.hands.map(h=>({cards:h.cards.map(GR.cardText),finished:h.finished,split:h.split,doubled:h.doubled})),
    dealer:g.complete?g.dealer.map(GR.cardText):[GR.cardText(g.dealer[0]),'🂠'],complete:g.complete||false,results:g.results||null,deadline:g.deadline};
  if(g.type==='poker')return {type:g.type,id:g.id,owner:g.owner,acting:g.acting,street:g.street,
    board:g.board.map(GR.cardText),wagers:[...g.wagers],streetBets:[...g.streetBets],
    lastBet:g.lastBet,acted:[...g.acted],deadline:g.deadline};
  return null;
}
function rollAttackDie(room,a,d,sides,label){
  let result=rollShown(room,sides,label);
  const fortune=a.fortune>0,badLuck=a.badLuck>0;
  // Opposing Fortune and Bad Luck cancel one another.
  if(fortune&&badLuck){a.fortune=0;a.badLuck=0;logRoom(room,'🎲 Fortune and Bad Luck cancel one another.','info');}
  else if(fortune||badLuck){
    const second=rollShown(room,sides,`${label} — ${fortune?'Fortune':'Bad Luck'} reroll`);
    result=fortune?Math.max(result,second):Math.min(result,second);
    if(fortune)a.fortune=0;else a.badLuck=0;
    logRoom(room,`${fortune?'🍀 Fortune':'💀 Bad Luck'} uses the ${fortune?'higher':'lower'} roll: ${result}.`,'special');
  }
  return result;
}
function applyGamblerAttackModifier(room,attacker,raw){
  if(!attacker)return raw;
  if(attacker.doubleFail){attacker.doubleFail=false;attacker.doubleMultiplier=1;return 0;}
  if((attacker.doubleMultiplier||1)>1){const factor=attacker.doubleMultiplier;attacker.doubleMultiplier=1;return Math.floor(raw*factor);}
  return raw;
}
// European single-zero roulette: every submitted bet is validated by the server.
function startGamblerRoulette(room,p){
 if(p.gamblerCooldowns.roulette>0)return {error:'Fortune Roulette is on cooldown.'};
 if(room.roulette)return {error:'Roulette is already running.'};
 const id=crypto.randomBytes(6).toString('hex');
 room.roulette={id,owner:p.slot,startedAt:Date.now(),deadline:Date.now()+25000};
 room.phase='gamblerRoulette';
 logRoom(room,`🎡 ${p.name} opens FORTUNE ROULETTE! Place a European wheel bet (0–36) to determine damage.`,'special');
 emitState(room);
 scheduleGameTimer(()=>{const live=rooms.get(room.code);if(live?.roulette?.id===id&&live.phase==='gamblerRoulette')roulettePlaceBet(live,p.slot,'red',0);},25500);
 return {ok:true,deferred:true};
}
function roulettePlaceBet(room,slot,kind,number){
 const game=room.roulette;
 if(room.phase!=='gamblerRoulette'||!game||game.owner!==slot)return {error:'No Roulette bet is waiting for you.'};
 const bet=CJ.rouletteBet(kind,Number(number));
 if(!bet)return {error:'Invalid roulette bet. Choose a valid number and bet type.'};
 const landed=CJ.WHEEL[GR.randomInt(37)],outcome=CJ.rouletteOutcome(bet,landed);
 const id=game.id;room.phase='gamblerRouletteSpin';room.roulette={...game,bet:{kind:bet.kind,number:bet.number},landed,outcome};
 const startedAt=Date.now();
 io.to(room.code).emit('gambler-roulette-spin',{id,slot,kind:bet.kind,number:bet.number,landed,win:outcome.won,damage:outcome.damage,jackpot:outcome.jackpot,startedAt});
 logRoom(room,`🎡 ${room.players[slot].name} bets ${kind}${['straight','split','street','corner','sixline','trio','dozen','column'].includes(kind)?` (${number})`:''}. The roulette wheel spins...`,'special');
 emitState(room);
 scheduleGameTimer(()=>{
   const live=rooms.get(room.code);
   if(!live?.roulette||live.roulette.id!==id||live.phase!=='gamblerRouletteSpin'||live.status!=='playing')return;
   const actor=live.players[slot],target=live.players[1-slot];
   live.roulette=null;live.phase='turn';live.current=slot;
   actor.gamblerCooldowns.roulette=2; // ticks to 1 at turn end
   addDamagingSpecialMomentum(live,actor,'Fortune Roulette');
   const finish=(hits=null)=>{
     let amount=0,blocked=0;
     if(!hits?.[0]){
       const res=absorbAttack(live,target,outcome.damage,actor,{normalAttack:false});hurtFighter(live,target,res.damage);
       amount=res.damage;blocked=res.blocked||0;
     }
     logRoom(live,`🎡 ${landed===0?'GREEN ZERO':landed} — ${outcome.won?'WIN':'LOSS'}! ${actor.name} deals ${amount} Roulette damage${outcome.jackpot?' and hits a GREEN JACKPOTT!':''}.`,'special');
     emitCombatFx(live,{kind:'attack',attacker:slot,defender:1-slot,damage:amount,blocked,critical:outcome.jackpot,label:outcome.jackpot?'GREEN JACKPOTT!':'FORTUNE ROULETTE'});
     if(outcome.jackpot){grantGamblerJackpot(live,actor,4,false,'GREEN ZERO ROULETTE');}
     if(checkWinner(live)){emitState(live);return;}
     finishAction(live,false,true);
   };
   if(target.infinityHits>0 && maybeStartParry(live,{attacker:slot,defender:1-slot,label:'Fortune Roulette',hits:[outcome.damage],onResolve:finish}))return;
   finish();
 },5200);
 return {ok:true};
}
function grantGamblerJackpot(room,p,turns,momentumBonus=false,source='SLOTS'){
 p.gamblerDomainCharge=0;p.gamblerDomainDamage=0;p.gamblerMisses=0;
 p.jackpotTurns=turns+1;p.jackpotHealUsed=false;p.jackpotDanceUsed=false;p.jackpotHealTurns=0;
 if(momentumBonus)p.momentum=Math.min(100,p.momentum+25); // Explicit Three 7s JACKPOTT reward bypasses the normal Momentum lock and gain scaling.
 room.domain={type:'jackpot',owner:p.slot,victim:1-p.slot,turnsRemaining:turns,integrity:40,startedAt:Date.now()};
 logRoom(room,`🎰💥 ${source}: JACKPOTT! ${p.name} gains ${turns} turns of invincibility, +5 attack, JACKPOTTT and Dance Battle!`,'special');
}
function startGamblerBlackjack(room,p){
  if(p.gamblerCooldowns.blackjack>0)return {error:`Blackjack Bash cooldown: ${p.gamblerCooldowns.blackjack} turns.`};
  if(room.gamblerGame)return {error:'A gambling minigame is already in progress.'};
  const deck=GR.freshDeck(),take=()=>deck.pop();
  const cards=[take(),take()],dealer=[take(),take()];
  p.gamblerCooldowns.blackjack=2;
  room.gamblerGame={type:'blackjack',id:crypto.randomBytes(6).toString('hex'),owner:p.slot,deck,
    hands:[{cards,split:false,doubled:false,finished:false}],dealer,turn:0,complete:false,deadline:Date.now()+50_000};
  room.phase='gamblerBlackjack';
  logRoom(room,`🃏 ${p.name} starts Blackjack Bash against the dealer.`,'special');
  emitState(room);return {ok:true,deferred:true};
}
function blackjackAct(room,choice){
 const g=room.gamblerGame;if(!g||g.type!=='blackjack')return {error:'No blackjack hand is active.'};
 const h=g.hands[g.turn];if(!h)return {error:'No active blackjack hand.'};
 const total=GR.blackjackTotal(h.cards).total;
 if(choice==='split'){
  if(g.hands.length!==1||h.cards.length!==2||Math.min(10,h.cards[0].rank) !== Math.min(10,h.cards[1].rank))return {error:'Splitting requires two cards of equal rank and no previous split.'};
  const second=h.cards.pop();h.cards.push(g.deck.pop());
  const other={cards:[second,g.deck.pop()],finished:false,split:true,doubled:false};
  h.split=true;g.hands.push(other);
  if(h.cards[0].rank===14){h.finished=true;other.finished=true;}
 }else if(choice==='hit'){
  if(total>=21)return {error:'This hand cannot Hit.'};
  h.cards.push(g.deck.pop());if(GR.blackjackTotal(h.cards).total>=21)h.finished=true;
 }else if(choice==='stand'){h.finished=true;}
 else if(choice==='double'){
  if(h.cards.length!==2)return {error:'Double Down is available only on the first two cards.'};
  h.cards.push(g.deck.pop());h.doubled=true;h.finished=true;
 }else if(choice==='surrender'){
  if(h.cards.length!==2||g.hands.length!==1)return {error:'Surrender is available only before taking another action.'};
  h.surrendered=true;h.finished=true;
 }else return {error:'Unknown blackjack choice.'};
 while(g.hands[g.turn]?.finished&&g.turn<g.hands.length-1)g.turn++;
 if(g.hands.every(x=>x.finished))return finishGamblerBlackjack(room);
 g.deadline=Date.now()+50_000;emitState(room);return {ok:true};
}
function finishGamblerBlackjack(room){
 const g=room.gamblerGame;if(!g)return {error:'No blackjack game.'};
 const p=room.players[g.owner],enemy=room.players[1-g.owner];
 const naturalPlayer=g.hands.length===1&&GR.natural(g.hands[0].cards);
 const dealerNatural=GR.natural(g.dealer);
 while(GR.blackjackTotal(g.dealer).total<17)g.dealer.push(g.deck.pop());
 const dealerTotal=GR.blackjackTotal(g.dealer).total;
 let totalDamage=0;const descriptions=[];
 for(const h of g.hands){const value=GR.blackjackTotal(h.cards).total;
  let damage=0,result='PUSH';
  if(h.surrendered){damage=2;result='SURRENDER';}
  else if(value>21){damage=2;result='BUST';}
  else if(dealerNatural&&!naturalPlayer){damage=2;result='DEALER BLACKJACK';}
  else if(naturalPlayer&&!dealerNatural){damage=15;result='NATURAL BLACKJACK';}
  else if(value>dealerTotal||dealerTotal>21){damage=GR.blackjackWinDamage(h.cards);result='WIN';}
  else if(value<dealerTotal){damage=2;result='LOSE';}
  // Double Down increases a winning hand by 50%, but never doubles its consolation damage.
  if(h.doubled&&result==='WIN')damage=Math.ceil(damage*1.5);
  if(g.hands.length>1&&['BUST','LOSE','DEALER BLACKJACK','SURRENDER'].includes(result))damage=0;
  totalDamage+=damage;descriptions.push(`${result} (${value} vs dealer ${dealerTotal}): ${damage} damage`);
 }
 if(g.hands.length>1&&totalDamage===0)totalDamage=2;
 const raw=totalDamage;
 // Reveal the dealer's hand and individual outcomes to BOTH players before exiting the minigame.
 io.to(room.code).emit('gambler-blackjack-result',{
   type:'blackjack',owner:g.owner,dealer:g.dealer.map(GR.cardText),dealerTotal,
   hands:g.hands.map((h,i)=>({cards:h.cards.map(GR.cardText),result:descriptions[i].split(' (')[0],damage:Number(descriptions[i].match(/: (\d+) damage/)?.[1]||0)})),
   summary:`Blackjack Bash scores ${raw} raw damage. ${descriptions.join('; ')}`,
   at:Date.now()
 });
 room.gamblerGame=null;room.phase='turn';room.current=p.slot;
 addDamagingSpecialMomentum(room,p,'Blackjack Bash');
 const finish=(hits=null)=>{
   if(hits?.[0]){logRoom(room,`♾️ ${enemy.name} blocks Blackjack Bash with Infinity!`,'good');finishAction(room,false,true);return;}
   const res=absorbAttack(room,enemy,raw,p,{normalAttack:false});hurtFighter(room,enemy,res.damage);
   logRoom(room,`🃏 BLACKJACK BASH! Dealer ${g.dealer.map(GR.cardText).join(' ')} (${dealerTotal}). ${descriptions.join('; ')}. ${enemy.name} loses ${res.damage} HP.`,'special');
   emitCombatFx(room,{kind:'attack',attacker:p.slot,defender:enemy.slot,damage:res.damage,blocked:res.blocked||0,label:'BLACKJACK BASH'});
   if(checkWinner(room)){emitState(room);return;}
   finishAction(room,false,true);
 };
 if(enemy.infinityHits>0 && maybeStartParry(room,{attacker:p.slot,defender:enemy.slot,label:'Blackjack Bash',hits:[raw],onResolve:finish}))return {ok:true,deferred:true};
 finish();return {ok:true};
}
function startGamblerPoker(room,p){
 if(p.gamblerCooldowns.poker>0)return {error:`Poker Table cooldown: ${p.gamblerCooldowns.poker} turns.`};
 if(room.gamblerGame)return {error:'A gambling minigame is already active.'};
 const deck=GR.freshDeck(),hands=[[deck.pop(),deck.pop()],[deck.pop(),deck.pop()]];
 p.gamblerCooldowns.poker=3;
 room.gamblerGame={type:'poker',id:crypto.randomBytes(6).toString('hex'),owner:p.slot,deck,hands,board:[],
   street:0,acting:p.slot,wagers:[0,0],streetBets:[0,0],lastBet:0,acted:[false,false],deadline:Date.now()+50_000};
 room.phase='gamblerPoker';logRoom(room,`♠️ ${p.name} challenges ${room.players[1-p.slot].name} to Poker Table! Bet damage, call, check or fold.`,'special');
 emitState(room);return {ok:true,deferred:true};
}
function pokerAct(room,slot,action,amount){
 const g=room.gamblerGame;if(!g||g.type!=='poker')return {error:'No Poker Table is active.'};
 if(g.acting!==slot&&action!=='fold')return {error:'It is not your turn to act in poker.'};
 const other=1-slot,toCall=g.lastBet-g.streetBets[slot];
 if(action==='fold')return finishGamblerPoker(room,other,true);
 if(action==='check'){
   if(toCall>0)return {error:'You must Call, Raise or Fold this bet.'};
   g.acted[slot]=true;
 }else if(action==='call'){
   if(toCall<=0)return {error:'Nothing to call; choose Check.'};
   if(g.wagers[slot]+toCall>20)return {error:'Calling would exceed the 20-damage wager limit.'};
   g.streetBets[slot]+=toCall;g.wagers[slot]+=toCall;g.acted[slot]=true;
 }else if(action==='bet'){
   const n=Number(amount);
   if(!Number.isInteger(n)||n<1||n>20)return {error:'Enter a wager from 1 to 20 damage.'};
   if(n<=g.lastBet)return {error:'Your bet must raise the current street bet.'};
   if(g.wagers[slot]+n-g.streetBets[slot]>20)return {error:'You cannot wager over 20 total damage.'};
   const extra=n-g.streetBets[slot];g.wagers[slot]+=extra;g.streetBets[slot]=n;g.lastBet=n;
   g.acted=[false,false];g.acted[slot]=true;
 }else return {error:'Unknown poker action.'};
 g.acting=other;
 if(g.acted.every(Boolean)&&g.streetBets[0]===g.streetBets[1]){
   g.street++;
   if(g.street===1){g.board.push(g.deck.pop(),g.deck.pop(),g.deck.pop());}
   else if(g.street===2||g.street===3){g.board.push(g.deck.pop());}
   else return finishGamblerPoker(room,null,false);
   g.acting=g.owner;g.acted=[false,false];g.streetBets=[0,0];g.lastBet=0;
   logRoom(room,`♠️ ${['','FLOP','TURN','RIVER'][g.street]} — ${g.board.map(GR.cardText).join(' ')}.`,'special');
 }
 g.deadline=Date.now()+50_000;emitState(room);return {ok:true};
}
function finishGamblerPoker(room,foldWinner,folded){
 const g=room.gamblerGame;if(!g)return {error:'No poker game.'};
 addDamagingSpecialMomentum(room,room.players[g.owner],'Poker Table');
 const evals=folded?null:g.hands.map((h,i)=>GR.bestPoker([...h,...g.board]));
 const cmp=folded?0:GR.compareScores(evals[0].score,evals[1].score);
 const winner=folded?foldWinner:cmp===0?null:cmp>0?0:1;
 const loser=winner===null?null:1-winner;
 // No hole cards are broadcast until the actual showdown. Folding preserves private hands.
 io.to(room.code).emit('gambler-poker-result',{
   type:'poker',folded,winner,board:g.board.map(GR.cardText),
   hands:folded?[]:g.hands.map(h=>h.map(GR.cardText)),
   names:room.players.map(p=>p.name),
   summary:folded?`${room.players[winner].name} wins — opponent folded.`:
     winner===null?'Split pot! Both players have equally strong hands.':
     `${room.players[winner].name} wins with ${evals[winner].name} against ${evals[loser].name}!`,
   at:Date.now()
 });
 if(winner!==null){
   const a=room.players[winner],d=room.players[loser];
   const stake=g.wagers[winner];
   const base=folded?(loser===g.owner?Math.ceil(stake/2):stake):Math.max(0,stake+2-evals[loser].reduction);
   const bonus=folded?0:evals[winner].boost;
   if(bonus){a.pokerAttackBonus=Math.max(a.pokerAttackBonus||0,bonus);}
   const finish=(hits=null)=>{
     const res=hits?.[0]?{damage:0,blocked:base}:(()=>{const r=absorbAttack(room,d,base,a,{normalAttack:false});hurtFighter(room,d,r.damage);return r;})();
     logRoom(room,`♠️ POKER TABLE: ${a.name} wins${folded?' by FOLD':` with ${evals[winner].name} over ${evals[loser].name}`}! Wager ${stake}, defence-by-hand ${folded?0:evals[loser].reduction}; ${d.name} takes ${res.damage} HP. ${bonus?`Next attack +${bonus}.`:''}`,'special');
     emitCombatFx(room,{kind:'attack',attacker:winner,defender:loser,damage:res.damage,blocked:res.blocked||0,label:'POKER TABLE'});
     if(checkWinner(room)){emitState(room);return;}
     finishAction(room,false,true);
   };
   if(d.infinityHits>0){
     room.gamblerGame=null;room.phase='turn';room.current=g.owner;
     if(maybeStartParry(room,{attacker:winner,defender:loser,label:'Poker Table',hits:[base],onResolve:finish}))return {ok:true,deferred:true};
   }
   // Immediate result uses the existing end-of-hand path below.
   if(!room.gamblerGame){finish();return {ok:true};}
   const res=absorbAttack(room,d,base,a,{normalAttack:false});hurtFighter(room,d,res.damage);
   logRoom(room,`♠️ POKER TABLE: ${a.name} wins for ${res.damage} HP.`,'special');
   emitCombatFx(room,{kind:'attack',attacker:winner,defender:loser,damage:res.damage,blocked:res.blocked||0,label:'POKER TABLE'});
 }else logRoom(room,`♠️ POKER TABLE ends in a tie — no damage and no attack boost.`,'info');
 room.gamblerGame=null;room.phase='turn';room.current=g.owner;
 if(checkWinner(room)){emitState(room);return {ok:true};}
 finishAction(room,false,true);return {ok:true};
}
function spinGamblerDomain(room,p){
 if(!p.gamblerDomainCharge||room.phase!=='gamblerSlot')return {error:'No Domain slot spin is pending.'};
 // Server alone decides the reels. A win in Domain Clash or a successful
 // deathblow comeback guarantees exactly one THREE-7 spin.
 const guaranteed=!!p.gamblerGuaranteedSevens;
 const luckBonus=Math.min(30,(p.gamblerMisses||0)*3);
 const boosted=!guaranteed&&GR.randomInt(100)<luckBonus;
 const symbols=guaranteed?['7️⃣','7️⃣','7️⃣']:boosted?GR.spinSlotsWithMatch():GR.spinSlots();
 const result=GR.slotResult(symbols),enemy=room.players[1-p.slot];
 if(guaranteed)p.gamblerGuaranteedSevens=false;
 const slotNumber=6-p.gamblerDomainCharge;
 logRoom(room,`🎰 RELENTLESS GAMBLER slot ${slotNumber}/5: ${symbols.join('  ')}!`,'special');
 const bonusTurns=(result.sevens||p.hp<=p.maxHp*.15?1:0)+(result.sevens&&p.hp<=15?1:0);
 io.to(room.code).emit('gambler-slot-spin',{symbols,at:Date.now(),slot:p.slot,
   jackpot:result.matches===3,sevens:result.sevens,turns:result.matches===3?4+bonusTurns:0});
 p.gamblerDomainCharge--;
 if(result.matches===3){
   const lowPercent=p.hp<=p.maxHp*.15,lowHp=p.hp<=15;
   const bonus=(result.sevens||lowPercent?1:0)+(result.sevens&&lowHp?1:0);
   const turns=4+bonus;
   grantGamblerJackpot(room,p,turns,result.sevens||lowPercent,'RELENTLESS GAMBLER');
 }else{
   p.gamblerMisses=Math.min(10,(p.gamblerMisses||0)+1);
   const sides=result.matches===2?6:4;
   const raw=rollShown(room,sides,`Slot ${result.matches===2?'two-match':'no-match'} damage`);
   const res=absorbAttack(room,enemy,raw,p,{normalAttack:false});hurtFighter(room,enemy,res.damage);
   logRoom(room,`🎰 ${result.matches===2?'TWO MATCHES':'NO MATCH'}: D${sides} ${raw}, ${enemy.name} takes ${res.damage} damage.`,'special');
   if(!p.gamblerDomainCharge){
     // All five attempts were consumed. A failed Ultimate refunds the cost.
     p.momentum=100;p.gamblerDomainDamage=0;
     logRoom(room,`🎰 ${p.name} runs out of Slot attempts. Relentless Gambler fails! 100% Momentum restored; next spin luck +${Math.min(30,p.gamblerMisses*3)}%.`,'special');
   }
 }
 room.phase='turn';room.current=p.slot;
 if(checkWinner(room)){emitState(room);return {ok:true};}
 fullEndTurn(room);return {ok:true};
}
function gamblerCoin(room,p,action){
 if(!p.doubleOrNothing)return {error:'Double or Nothing is not ready.'};
 if(!['flip','cashout'].includes(action))return {error:'Choose flip or cashout.'};
 if(action==='cashout'){
   p.doubleOrNothing=false;p.doubleMultiplier=p.coinMultiplier||1;
   logRoom(room,`🪙 ${p.name} cashes out at ×${+(p.coinMultiplier||1).toFixed(3)} for the next attack.`,'special');
   emitState(room);return {ok:true,done:true,multiplier:p.doubleMultiplier};
 }
 if((p.coinFlips||0)>=3)return {error:'The three-coin limit is reached. Cash out.'};
 const heads=GR.randomInt(2)===0;
 p.coinFlips++;if(heads)p.coinMultiplier*=1.5;
 else{p.doubleOrNothing=false;p.doubleFail=true;p.doubleMultiplier=1;}
 io.to(room.code).emit('gambler-coins',{slot:p.slot,results:[heads?'HEADS':'TAILS'],at:Date.now()});
 logRoom(room,`🪙 ${p.name} flips ${heads?'HEADS':'TAILS'}! ${heads?`Current damage multiplier ×${+p.coinMultiplier.toFixed(3)}.`:'Next attack deals zero damage.'}`,'special');
 if(heads&&p.coinFlips===3){p.doubleOrNothing=false;p.doubleMultiplier=p.coinMultiplier;}
 emitState(room);return {ok:true,done:!p.doubleOrNothing,heads,multiplier:p.doubleMultiplier};
}


function giveItemUltimateCharge(room,p,amount){
  if(p.special==='glovedone'){
    const before=p.gloveHype||0;applyHypeGain(p,amount);
    logRoom(room,`🎤 ${p.name} gains ${p.gloveHype-before} Crowd Hype from an item.`,'good');
  }else{
    const before=p.momentum||0;p.momentum=clamp(before+amount,0,100);
    logRoom(room,`⚡ ${p.name} gains ${p.momentum-before} Ultimate Charge from an item.`,'good');
  }
}
function startNewItemMini(room,p,kind){
  const startedAt=Date.now()+650,id=crypto.randomBytes(7).toString('hex');
  const shuffled=[...NEW_ITEM_BUTTONS];for(let i=shuffled.length-1;i>0;i--){const j=crypto.randomInt(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  const choices=kind==='eightball'?shuffled.slice(0,3):[];
  // Server shuffles five cards, but clients see only their face-down backs.
  const cardPool=[...ITEM_CARD_DECK];for(let i=cardPool.length-1;i>0;i--){const j=crypto.randomInt(i+1);[cardPool[i],cardPool[j]]=[cardPool[j],cardPool[i]];}
  room.itemMini={id,kind,owner:p.slot,startedAt,deadline:startedAt+(kind==='stopwatch'?ITEM_STOPWATCH_TIMEOUT_MS:ITEM_8BALL_TIMEOUT_MS),choices,cards:kind==='deck'?cardPool.slice(0,5):null};
  room.phase='itemMini';logRoom(room,`🎁 ${p.name} starts ${kind==='candy'?'Mystery Candy':kind==='eightball'?'Predict the Future!':kind==='deck'?'Pick a Card!':'Stop Time!'}!`,'special');emitState(room);
  scheduleGameTimer(()=>{const live=rooms.get(room.code);if(live?.itemMini?.id===id)resolveItemMini(live,null,null,true);},room.itemMini.deadline-Date.now()+120);
  return {deferred:true};
}
function resolveItemPrediction(room,p,button){
  const opponent=room.players[1-p.slot];if(!opponent?.eightBallPrediction)return;
  const prediction=opponent.eightBallPrediction;opponent.eightBallPrediction=null;
  if(prediction.choice===button){opponent.defence=clamp((opponent.defence||0)+15,0,20);giveItemUltimateCharge(room,opponent,10);logRoom(room,`🎱 CORRECT! ${opponent.name} predicted ${button} and gains +15 Defence (up to cap) and +10 charge.`,'good');}
  else {opponent.eightBallVulnerable=true;logRoom(room,`🎱 WRONG! ${p.name} chose ${button}, not ${prediction.choice}. ${opponent.name} will take +20% damage from their next incoming attack.`,'bad');}
  io.to(room.code).emit('item-cinematic',{kind:'8ball-result',owner:opponent.slot,correct:prediction.choice===button,actual:button,predicted:prediction.choice,at:Date.now()});
}
function resolveItemMini(room,slot,payload={},expired=false){
  const g=room.itemMini;if(!g)return {error:'No item minigame is active.'};
  if(!expired&&slot!==g.owner)return {error:'Not your minigame.'};
  const p=room.players[g.owner],d=room.players[1-g.owner],now=Date.now();
  if(!expired && now<g.startedAt)return {error:'The challenge has not started yet.'};
  if(!expired && now>g.deadline+100)return {error:'This challenge has expired.'};
  let outcome={kind:g.kind};
  if(g.kind==='candy'){
    const target=expired?p:(payload?.target==='opponent'?d:p);
    if(!expired&&!['self','opponent'].includes(payload?.target))return {error:'Choose yourself or opponent.'};
    const picks=['fortune','badluck','regen','poison','strengthen','weakness','bleed','energyleak'];
    const effect=picks[crypto.randomInt(picks.length)];
    if(effect==='fortune')target.fortune=Math.max(target.fortune||0,6);
    else if(effect==='badluck')target.badLuck=Math.max(target.badLuck||0,6);
    else if(effect==='regen')target.candyRegen=Math.max(target.candyRegen||0,5);
    else if(effect==='poison')target.poison=Math.max(target.poison||0,5);
    else if(effect==='bleed'){target.bleed=Math.max(target.bleed||0,5);target.bleedDie=4;}
    else if(effect==='energyleak')target.energyLeak=Math.max(target.energyLeak||0,5);
    else if(effect==='strengthen')target.strengthen=Math.max(target.strengthen||0,5);
    else target.weakness=Math.max(target.weakness||0,5);
    outcome={kind:'candy',effect,target:target.slot};logRoom(room,`🍬 ${target.name} gets ${effect.toUpperCase()} from Mystery Candy for 5 turns!`,'special');
  }else if(g.kind==='deck'){
    const index=expired?0:Number(payload?.index);
    if(!Number.isInteger(index)||index<0||index>=g.cards.length)return {error:'Pick a face-down card.'};
    outcome={kind:'card',card:g.cards[index],index};
    logRoom(room,`🃏 ${p.name} chooses card ${index+1} from the deck.`,'special');
  }else if(g.kind==='eightball'){
    if(!expired&&!g.choices.includes(payload?.choice))return {error:'Predict one of the three possible buttons.'};
    const choice=expired?g.choices[0]:payload.choice;
    p.eightBallPrediction={choice};outcome={kind:'eightball',choice};
    logRoom(room,`🎱 ${p.name} predicts the opponent's next action will be ${choice}!`,'special');
  }else if(g.kind==='stopwatch'){
    const elapsed=Math.max(0,(now-g.startedAt));
    const stoppedAt=itemStopwatchValue(elapsed),diff=Math.abs(stoppedAt-5);
    const awarded=diff<=0.1?25:diff<=0.5?15:5;
    giveItemUltimateCharge(room,p,awarded);outcome={kind:'stopwatch',stoppedAt,diff,awarded};
    logRoom(room,`⏱️ ${p.name} stops the Cursed Stopwatch at ${stoppedAt.toFixed(2)}s (Δ${diff.toFixed(2)}s): +${awarded} Ultimate Charge!`,'special');
  }
  room.itemMini=null;room.phase='turn';room.current=p.slot;
  let result=null;
  if(g.kind==='deck'){
    // Reveal only the selected server-owned card and apply its effect once.
    result=useMagicBagItem(room,p,{id:'__hidden_card_resolution__',name:'Deck of Cards',hiddenCard:outcome.card});
  }else io.to(room.code).emit('item-cinematic',{...outcome,owner:p.slot,at:Date.now()});
  if(result?.deferred)return {ok:true,deferred:true,...outcome};
  if(checkWinner(room)){emitState(room);return {ok:true,...outcome};}
  finishAction(room,false);return {ok:true,...outcome};
}
function startUmbrellaMini(room,p){
  if(p.special!=='greatexception')return {error:'Only The Great Exception uses Umbrella.'};
  if(p.umbrellaCooldown>0)return {error:`Umbrella is on cooldown for ${p.umbrellaCooldown} turn(s).`};
  const id=crypto.randomBytes(6).toString('hex'),startedAt=Date.now()+650,interval=880;
  room.umbrellaMini={id,owner:p.slot,startedAt,interval,deadline:startedAt+4*interval,sequence:Array.from({length:4},()=>crypto.randomInt(4)),pressed:{}};
  room.phase='umbrellaMini';logRoom(room,`☂️ ${p.name} opens Umbrella! Face four gusts in rapid succession.`,'special');emitState(room);
  for(let i=1;i<4;i++)scheduleGameTimer(()=>{const live=rooms.get(room.code);if(live?.umbrellaMini?.id===id)emitState(live);},startedAt+i*interval-Date.now());
  scheduleGameTimer(()=>{const live=rooms.get(room.code);if(live?.umbrellaMini?.id===id)resolveUmbrellaMini(live);},room.umbrellaMini.deadline-Date.now()+150);
  return {ok:true,deferred:true};
}
function umbrellaMiniAct(room,slot,direction){
  const g=room.umbrellaMini;if(room.phase!=='umbrellaMini'||!g||g.owner!==slot)return {error:'No Umbrella challenge active.'};
  const i=Math.floor((Date.now()-g.startedAt)/g.interval);
  if(i<0||i>=4)return {error:'The gust is not ready.'};
  if(Object.hasOwn(g.pressed,i))return {error:'This gust has already been answered.'};
  if(!Number.isInteger(direction)||direction<0||direction>3)return {error:'Choose a direction.'};
  g.pressed[i]=g.sequence[i]===direction;
  if(Object.keys(g.pressed).length===4)return resolveUmbrellaMini(room);
  emitState(room);return {ok:true,hit:g.pressed[i]};
}
function resolveUmbrellaMini(room){
  const g=room.umbrellaMini;if(!g)return {error:'No Umbrella challenge active.'};
  const p=room.players[g.owner],hits=Object.values(g.pressed).filter(Boolean).length,enhanced=p.upgradedMagicBagTurns>0;
  const grade=hits===4?'perfect':hits>=2?'good':'miss';
  p.umbrellaGuardPct=grade==='perfect'?(enhanced?100:80):grade==='good'?60:25;
  p.umbrellaCounter=grade==='perfect'?6:0;
  p.umbrellaCooldown=3; // first count ticks on the current turn; 2 full turns remain
  room.umbrellaMini=null;room.phase='turn';room.current=p.slot;
  logRoom(room,`☂️ Umbrella ${grade.toUpperCase()}: ${hits}/4 gusts. Next damaging attack reduced ${p.umbrellaGuardPct}%${grade==='perfect'?' plus 6 counter damage':''}.`,'special');
  finishAction(room,false);return {ok:true,grade,hits};
}
function startFootworkMini(room,p){
  if(p.special!=='glovedone')return {error:'Only The Gloved One uses Light-Up Footwork.'};
  if(p.footworkCooldown>0)return {error:`Light-Up Footwork cooldown: ${p.footworkCooldown} turns.`};
  p.footworkCooldown=3; // two personal turns after this action
  const id=crypto.randomBytes(6).toString('hex'),now=Date.now(),sequence=Array.from({length:4},()=>crypto.randomInt(9));
  room.footworkMini={id,owner:p.slot,startedAt:now,preparationEndsAt:now+1000,revealEndsAt:now+4000,deadline:now+9500,sequence,pressed:[]};
  room.phase='footworkMini';logRoom(room,`🪩 ${p.name} starts Light-Up Footwork! Memorize four lit floor tiles then repeat the pattern.`,'special');emitState(room);
  scheduleGameTimer(()=>{const live=rooms.get(room.code);if(live?.footworkMini?.id===id)resolveFootworkMini(live);},9550);
  return {ok:true,deferred:true};
}
function footworkMiniAct(room,slot,tile){
  const g=room.footworkMini;if(room.phase!=='footworkMini'||!g||g.owner!==slot)return {error:'No Light-Up Footwork active.'};
  if(Date.now()<g.revealEndsAt)return {error:'Memorize the pattern first.'};
  if(Date.now()>g.deadline)return resolveFootworkMini(room);
  if(!Number.isInteger(tile)||tile<0||tile>8)return {error:'Choose one of the nine tiles.'};
  g.pressed.push(tile);
  if(g.pressed.length===4)return resolveFootworkMini(room);
  emitState(room);return {ok:true};
}
function resolveFootworkMini(room){
  const g=room.footworkMini;if(!g)return {error:'No Light-Up Footwork active.'};
  const p=room.players[g.owner],d=room.players[1-p.slot];
  const perfect=g.pressed.length===4&&g.sequence.every((v,i)=>v===g.pressed[i]),raw=perfect?10:5;
  awardGloveHype(room,p,perfect?'perfect':'miss');p.flowPerfectThisMove=perfect;
  room.footworkMini=null;room.phase='turn';room.current=p.slot;
  addDamagingSpecialMomentum(room,p,'Light-Up Footwork');
  const finish=(hits=null)=>{
    if(hits?.[0]){logRoom(room,`🗡️ ${d.name} counters Light-Up Footwork!`,'good');finishAction(room,false,true);return;}
    const res=absorbAttack(room,d,raw,p,{normalAttack:false});hurtFighter(room,d,res.damage);
    if(perfect)p.spotlightReady=2; // tick to one when this turn finishes
    emitCombatFx(room,{kind:'beatit',attacker:p.slot,defender:d.slot,damage:res.damage,blocked:res.blocked||0,critical:perfect,label:perfect?'SPOTLIGHT PERFECT!':'FOOTWORK'});
    logRoom(room,`🪩 ${p.name} ${perfect?'perfectly repeats the pattern and gains Spotlight':'misses the pattern'}: ${res.damage} damage.`,'special');
    if(checkWinner(room)){emitState(room);return;}finishAction(room,false,true);
  };
  if(d.infinityHits>0&&maybeStartParry(room,{attacker:p.slot,defender:d.slot,label:'Light-Up Footwork',hits:[raw],onResolve:finish}))return {ok:true,deferred:true};
  finish();return {ok:true};
}


// The Gloved One: all scores, timing and damage resolve on the server.
function awardGloveHype(room,p,grade){
 if(p.special!=='glovedone')return;
 const delta=grade==='perfect'?20:grade==='good'?10:-5;
 const gained=applyHypeGain(p,delta);
 logRoom(room,`🎤 Crowd ${grade.toUpperCase()}! ${gained>0?'+':''}${gained} Hype (${p.gloveHype}/100)${delta>0&&gained<delta?' — gains reduced by 33% above 60 Hype':''}.`,'special');
}
function startGloveMini(room,p,kind){
 const costs={beat:2,moon:3,smooth:4,pitch:4}; // Moon 2 / Smooth 3 subsequent turns
 if(!['beat','moon','smooth','thriller'].includes(kind))return {error:'Unknown performance.'};
 if(kind==='thriller'){
   if(!p.thrillerNightActive||p.thrillerUsedThisTurn)return {error:'Thriller can be used once per personal turn during Thriller Night.'};
   p.thrillerUsedThisTurn=true;
 }else{
   if((p.gloveMiniCooldowns?.[kind]||0)>0)return {error:`${kind} is on cooldown.`};
   p.gloveMiniCooldowns[kind]=costs[kind]||2;
 }
 const now=Date.now(),id=crypto.randomBytes(6).toString('hex');
 const actor=kind==='thriller'?1-p.slot:p.slot;
 const duration=kind==='moon'?9000:kind==='smooth'?30000:kind==='thriller'?22000:22000;
 room.gloveMini={id,kind,owner:p.slot,actor,ready:false,startedAt:now,deadline:now+duration,index:0,hits:0,misses:0,sequence:Array.from({length:kind==='moon'?5:10},()=>crypto.randomInt(4)),beatAt:0,lean:0,balance:0,tilt:0,feedback:'',feedbackAt:0,streak:0};
 room.phase='gloveMini';emitState(room);
 scheduleGameTimer(()=>{const r=rooms.get(room.code);if(r)tickGloveMini(r,id);},85);
 // The recurring deadline monitor also handles players who never press Ready.
 return {ok:true,deferred:true};
}
function finishGloveMini(room,failed=false){
 const g=room.gloveMini;if(!g)return;
 const p=room.players[g.owner],d=room.players[1-g.owner];
 room.gloveMini=null;room.phase='turn';room.current=g.owner;
 let raw=0,grade='miss',target=d;
 if(g.kind==='thriller'){
   raw=g.misses;target=d;grade=g.misses===0?'miss':g.misses>=5?'perfect':'good';
 }else if(g.kind==='smooth'){
   const score=SM.result(g.smooth||SM.start());
   raw=score.damage;grade=score.perfectReward?'perfect':score.goodSeconds>=2?'good':'miss';
   if(score.perfectReward){
     d.tuneDeafTurns=Math.max(d.tuneDeafTurns||0,2);
     const healed=Math.min(5,Math.max(0,p.maxHp-p.hp));p.hp+=healed;
     p.adrenaline=true;
     logRoom(room,`🌟 PERFECT SPOT! ${p.name} held gold for ${score.perfectSeconds.toFixed(2)}s: Tune Deaf (2 turns), +${healed} HP and Adrenaline!`,'special');
   }
   logRoom(room,`🕴️ Smooth Criminal: green ${score.goodSeconds.toFixed(2)}s + 3×gold ${score.perfectSeconds.toFixed(2)}s = ${raw} damage (rounded up)${g.smooth?.fell?' — fell before the final bell':''}.`,'special');
 }else{
   raw=g.kind==='moon'?g.hits*3:Math.max(0,g.hits-1); // Beat It deals one less damage than previously
   grade=g.hits===(g.kind==='moon'?5:10)?'perfect':g.hits>=(g.kind==='moon'?3:6)?'good':'miss';
 }
 if(g.kind!=='thriller'){awardGloveHype(room,p,grade);p.flowPerfectThisMove=grade==='perfect';}
 if(raw>0){const res=absorbAttack(room,target,raw,p,{normalAttack:false});hurtFighter(room,target,res.damage);emitCombatFx(room,{kind:'dance',attacker:p.slot,defender:target.slot,damage:res.damage,blocked:res.blocked||0,label:`${g.kind.toUpperCase()} ${grade.toUpperCase()}`});}
 if(g.kind==='smooth'){
   const score=SM.result(g.smooth||SM.start());
   io.to(room.code).emit('glove-smooth-result',{
     performer:p.slot,goodSeconds:score.goodSeconds,perfectSeconds:score.perfectSeconds,
     baseDamage:raw,perfectReward:score.perfectReward,fell:!!g.smooth?.fell
   });
   logRoom(room,`🎼 ${p.name}'s Smooth Criminal: ${raw} base damage from time in the scoring zones.`,'special');
 }else logRoom(room,`🎼 ${p.name}'s ${g.kind}: ${g.hits} successful prompts, ${raw} base damage${failed?' — fell!':''}.`,'special');
 if(checkWinner(room)){emitState(room);return;}
 if(g.kind==='thriller'){emitState(room);return;}
 finishAction(room,false,true);
}
function advanceSmoothCriminal(g,now){
 if(!g?.ready||g.kind!=='smooth'||!g.smooth)return;
 const end=Math.min(now,g.deadline),from=g.smoothLastAt||end;
 if(end<=from)return;
 const expires=g.smoothHoldUntil||0;
 // Process time before and after control expiry separately. Lost browser focus can't hold forever.
 const split=Math.min(end,Math.max(from,expires));
 if(split>from)SM.advance(g.smooth,(split-from)/1000,g.smoothControl||0);
 if(end>split)SM.advance(g.smooth,(end-split)/1000,0);
 g.smoothLastAt=end;
}
function tickGloveMini(room,id){
 const g=room.gloveMini;if(!g||g.id!==id||room.phase!=='gloveMini')return;
 const now=Date.now();
 if(g.ready&&g.kind==='smooth'){
   advanceSmoothCriminal(g,now);
   if(g.smooth.fell||g.smooth.elapsed>=SM.DURATION||now>=g.deadline){finishGloveMini(room);return;}
   // Send the spectator and performer the authoritative needle and score at ~12fps.
   emitState(room);
 }
 if(g.ready && g.kind!=='smooth'){
   const len=g.kind==='moon'?1000:Math.max(150,230-g.streak*9);
   if(now>g.beatAt+len && g.index<g.sequence.length){
     g.misses++;g.streak=0;g.index++;g.feedback='✖ MISS';g.feedbackAt=now;
     g.beatAt=now+(g.kind==='moon'?0:1050);
     if(g.index>=g.sequence.length){finishGloveMini(room);return;}
     emitState(room);
   }
 }
 if(now>=g.deadline){finishGloveMini(room,g.kind==='smooth');return;}
 scheduleGameTimer(()=>{const r=rooms.get(room.code);if(r)tickGloveMini(r,id);},85);
}
function gloveMiniInput(room,slot,data){
 const g=room.gloveMini;if(!g||room.phase!=='gloveMini'||slot!==g.actor)return {error:'No performance waiting for you.'};
 const action=String(data?.action||''),now=Date.now();
 if(action==='ready'){
   if(g.ready)return {ok:true};
   g.ready=true;g.beatAt=now+(g.kind==='smooth'?0:g.kind==='moon'?450:1500);
   g.deadline=now+(g.kind==='smooth'?SM.DURATION*1000:g.kind==='moon'?9000:22000);
   if(g.kind==='smooth'){
     g.smooth=SM.start((crypto.randomInt(5001)-2500)/1000,crypto.randomInt(2)?1:-1);
     g.smoothLastAt=now;g.smoothControl=0;g.smoothHoldUntil=now;
   }
   emitState(room);return {ok:true};
 }
 if(!g.ready)return {error:'Press Ready to begin.'};
 if(g.kind==='smooth'){
   if(action!=='smooth-control')return {error:'Use the left and right balance controls.'};
   advanceSmoothCriminal(g,now);
   if(g.smooth.fell||g.smooth.elapsed>=SM.DURATION){finishGloveMini(room);return {ok:true};}
   const direction=Number(data?.direction);
   if(!Number.isInteger(direction)||![-1,0,1].includes(direction))return {error:'Invalid balance control.'};
   g.smoothControl=direction;
   g.smoothHoldUntil=now+(direction===0?0:450); // Safety release if a keyup/connection drops.
   return {ok:true};
 }
 if(g.index>=g.sequence.length)return {error:'Performance completed.'};
 const window=g.kind==='moon'?1000:Math.max(145,230-g.streak*9),expectedAt=g.beatAt;
 const pressTime=boundedRhythmPressTime(data?.clientTime,now);
 if(pressTime<expectedAt-(g.kind==='moon'?160:window)||pressTime>expectedAt+window)return {error:'Wait for the note to reach the target.'};
 if(Number.isInteger(data?.index)&&data.index!==g.index)return {error:'That note is no longer active.'};
 const correct=Number(data?.dir)===(g.kind==='moon'?(g.sequence[g.index]+2)%4:g.sequence[g.index]);
 if(correct){g.hits++;g.streak++;}else{g.misses++;g.streak=0;}
 g.feedback=correct?['GOOD!','NICE!','AMAZING!'][g.hits%3]:'✖ MISS';g.feedbackAt=now;
 g.index++;g.beatAt=now+(g.kind==='moon'?0:Math.max(420,1050-g.streak*85));
 if(g.index>=g.sequence.length){finishGloveMini(room);return {ok:true,correct};}
 emitState(room);return {ok:true,correct};
}
// Team Rocket can copy any eligible offensive, effect-inflicting, companion or item-granting
// Special the victim currently has access to, not just an old hard-coded short list.
const ROCKET_STEALABLE={
  bluejudas:[['blue','Limitless: Blue'],['red','Limitless: Red'],['maxblue','Max Blue'],['maxred','Max Red']],
  redjudas:[['dismantle','Dismantle'],['cleave','Cleave'],['fuga','Fuga']],
  gambler:[['blackjack','Blackjack Bash'],['poker','Poker Table'],['roulette','Fortune Roulette'],['dancebattle','JACKPOTT Dance Battle']],
  glovedone:[['beatit','Beat It'],['moonwalk','Moonwalk'],['pitch','Pitching the Voice'],['footwork','Light-Up Footwork'],['smooth','Smooth Criminal'],['dancebattle','Dance Battle']],
  masterpresentation:[['brainbotswarm','Brainbot Swarm'],['spiderbot','Spider Bot'],['mambastrike','Mamba Strike'],['targetingsystems','Targeting Systems'],['electricityturret','Electricity Turret'],['musicspeakers','Music Speakers'],['deathray','Death Ray']],
  nightcrawler:[['bite87','Bite of 87'],['shock','Shock']],
  greatexception:[['magicbag','Magic Bag'],['dancebattle','Dance Battle']],
  pokemontrainer:[]
};
function availableRocketMoves(victim){
  const pool=(ROCKET_STEALABLE[victim.special]||[]).filter(([move])=>{
    if(['maxblue','maxred'].includes(move))return victim.sixEyesTurns>0;
    if(move==='fuga')return victim.kingTurns>0;
    if(move==='mambastrike'||move==='targetingsystems')return victim.mambaTurns>0;
    if(['electricityturret','musicspeakers'].includes(move))return victim.spiderTurns>0;
    if(move==='dancebattle'&&victim.special==='gambler')return victim.jackpotTurns>0&&!victim.jackpotDanceUsed;
    if(move==='magicbag')return !victim.magicBagItem;
    if(move==='shock'&&victim.special==='nightcrawler')return (victim.effectCooldowns?.shock||0)===0;
    if(move==='bite87')return (victim.bite87Cooldown||0)===0;
    if(move==='dancebattle')return (victim.danceBattleCooldown||0)===0;
    if(move==='beatit')return (victim.gloveMiniCooldowns?.beat||0)===0;
    if(move==='moonwalk')return (victim.gloveMiniCooldowns?.moon||0)===0;
    if(move==='smooth')return (victim.gloveMiniCooldowns?.smooth||0)===0;
    if(move==='pitch')return (victim.beatItCooldown||0)===0;
    if(move==='footwork')return (victim.footworkCooldown||0)===0;
    if(move==='roulette')return (victim.gamblerCooldowns?.roulette||0)===0;
    if(move==='blackjack')return (victim.gamblerCooldowns?.blackjack||0)===0;
    if(move==='poker')return (victim.gamblerCooldowns?.poker||0)===0;
    return true;
  });
  // Offensive Effects are also moves the opponent currently has available.
  for(const effect of ['bleed','poison','weakness','armourbreak','energyleak',...(victim.special==='nightcrawler'?['shock']:[])]){
    if((victim.effectCooldowns?.[effect]||0)===0&&!pool.some(x=>x[0]===`effect:${effect}`))
      pool.push([`effect:${effect}`,`${effect.replace(/(^|\s)\w/g,t=>t.toUpperCase())} Effect`]);
  }
  if(victim.special==='pokemontrainer'&&victim.activePokemon){
    const mon=POKEMON_ROSTER[victim.activePokemon];
    for(const [id,move] of Object.entries(mon?.moves||{})){
      if(Number(victim.pokemonPP?.[victim.activePokemon]?.[id]||0)>=pokemonMoveCost(victim,move))
        pool.push([`pokemon:${victim.activePokemon}:${id}`,`${mon.name} — ${move.name}`]);
    }
  }
  return pool;
}
function useRocketStolenMove(room,p){
 const theft=p.rocketStolen;
 if(p.special!=='pokemontrainer'||!theft||theft.turns<=0)return {error:'No stolen move is active.'};
 const original=p.special,ce=p.cursedEnergy,pe=p.positiveEnergy,spider=p.spiderTurns,armor=p.mambaTurns,
       six=p.sixEyesTurns,king=p.kingTurns,mom=p.momentum,active=p.activePokemon,pp=p.pokemonPP,lastMove=p.pokemonLastMove,
       dance=p.jackpotTurns;
 let result;
 try{
   if(theft.move.startsWith('effect:')){
     const effect=theft.move.slice(7);
     p.special=theft.source;
     result=doEffect(room,effect,false,false);
   }else if(theft.move.startsWith('pokemon:')){
     const [,mon,move]=theft.move.split(':');
     p.activePokemon=mon;
     p.pokemonPP={...p.pokemonPP,[mon]:{...p.pokemonPP[mon],[move]:Math.max(4,p.pokemonPP?.[mon]?.[move]||0)}};
     p.pokemonLastMove=null;p.pokemonRepeatTax=0;
     result=usePokemonMove(room,p,move);
   }else{
     p.special=theft.source;
     // This is a copied ability. Resource & temporary unlock requirements do not
     // consume the Trainer's real Cursed Energy, Hype or equipment state.
     p.cursedEnergy=Math.max(ce,20);p.positiveEnergy=Math.max(pe,5);p.momentum=Math.max(mom,100);
     p.sixEyesTurns=Math.max(six,1);p.kingTurns=Math.max(king,1);
     p.spiderTurns=Math.max(spider,3);p.mambaTurns=Math.max(armor,3);
     p.jackpotTurns=Math.max(dance,3);
     if(theft.move==='bite87')result=startBite87Timing(room,p);
     else result=doSpecial(room,theft.move,{move:theft.move});
   }
 }finally{
   p.special=original;p.cursedEnergy=ce;p.positiveEnergy=pe;p.spiderTurns=spider;p.mambaTurns=armor;
   p.sixEyesTurns=six;p.kingTurns=king;p.momentum=mom;p.activePokemon=active;
   p.pokemonPP=pp;p.pokemonLastMove=lastMove;p.pokemonRepeatTax=lastMove===active?1:0;
   p.jackpotTurns=dance;
 }
 if(!result?.error)logRoom(room,`🚀 ${p.name} uses stolen ${theft.label}! (${theft.turns} remaining before this action.)`,'special');
 return result;
}

function startUltimate(room,p){
  if(p.special==='pokemontrainer'&&p.rocketStolen?.turns>0)return useRocketStolenMove(room,p);
  const ult=ULTIMATES[p.special];
  if(!ult)return {error:'This Special/Trait does not have an Ultimate implemented yet.'};
  if(!room.infiniteUltimates&&(p.momentum||0)<100)return {error:'Ultimate is not ready. Reach 100% Momentum first.'};
  if(ult.id==='relentlessgambler'){
    if(p.gamblerDomainCharge>0||p.jackpotTurns>0)return {error:'Relentless Gambler is already active.'};
    if(room.domain)return {error:'A Domain is already active.'};
    if(!room.infiniteUltimates)p.momentum=0;
    p.gamblerDomainCharge=5;p.gamblerDomainDamage=0;
    logRoom(room,`🎰 ${p.name} starts RELENTLESS GAMBLER! Five Slot turns to hit a triple. Opponent must deal 40 HP damage to break the charge. Luck bonus: +${Math.min(30,(p.gamblerMisses||0)*3)}%.`,'special');
    const opponent=room.players[1-p.slot];
    const contest=!!(opponent.domainCharging&&opponent.domainChargeProgress>=2);
    const contestType=contest?opponent.domainKind||domainTypeForPlayer(opponent):null;
    if(contest){opponent.domainCharging=false;opponent.domainChargeProgress=0;opponent.domainKind=null;}
    finishAction(room,false);
    if(contest){
      const types=[null,null];types[p.slot]='jackpot';types[opponent.slot]=contestType;
      startDomainClash(room,p.slot,opponent.slot,types);
    }
    return {ok:true};
  }
  if(ult.id==='teamrocket'){
    const victim=room.players[1-p.slot];
    if(!room.infiniteUltimates)p.momentum=0;
    // Original cinematic and full-team recovery remain. The new sabotage steals
    // one specific Special Attack, not the opponent's entire Special menu.
    p.pokemonHP=initialPokemonHP();
    p.pokemonPP=initialPokemonPP();p.pokemonLastMove=null;p.pokemonRepeatTax=0;
    const pool=availableRocketMoves(victim);
    if(pool.length){
      const [move,label]=pool[crypto.randomInt(pool.length)];
      p.rocketStolen={source:victim.special,move,label,turns:4}; // leaves three future turns
      victim.rocketMoveBlocked=move;
      logRoom(room,`🚀 TEAM ROCKET steals ${victim.name}'s ${label}! The Trainer can use it from Ultimate for three turns, while ${victim.name} cannot.`,'special');
    }else logRoom(room,`🚀 TEAM ROCKET finds no Special Attack to steal from ${victim.name}.`,'info');
    logRoom(room,`🚀 Every Pokémon's HP and PP are fully restored!`,'special');
    io.to(room.code).emit('team-rocket-fx',{slot:p.slot,target:victim.slot,at:Date.now()});
    finishAction(room,false,true);return {ok:true};
  }
  if(ult.id==='hollowpurple')return startHollowPurple(room,p);
  if(ult.id==='worldcuttingslash')return startWorldCuttingSlash(room,p);
  if(ult.id==='realitymanipulation')return startRealityManipulation(room,p);
  return {error:'Ultimate is not implemented yet.'};
}

function mambaStrikeDamage(phase){
  phase=clamp(Number(phase)||0,0,1);
  if(phase<.25)return 5;
  if(phase<.50)return 10;
  if(phase<.75)return 13;
  return 17;
}
function resolveMambaStrike(room,slot,damage,phase){
  const p=room.players[slot],d=room.players[1-slot];
  addDamagingSpecialMomentum(room,p,'Black Mamba Strike');
  const finalize=(parryResults=null)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🐍 ${d.name} PARRIES ${p.name}'s Black Mamba Strike!`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY MAMBA!',amount:0,perfect:true});
      finishAction(room,false,true);return;
    }
    const res=absorbAttack(room,d,damage,p,{normalAttack:false});
    const actual=res.damage+(attempted?1:0);
    hurtFighter(room,d,actual);
    reflectSeduced(room,p,actual,'Black Mamba Strike');
    logRoom(room,`🐍 ${p.name}'s Black Mamba target score lands for ${damage} raw damage. ${d.name} takes ${actual}.`,'special');
    if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`BLOCK ${res.blocked}`,amount:res.blocked});
    emitCombatFx(room,{kind:'mamba',attacker:p.slot,defender:d.slot,damage:actual,blocked:res.blocked||0,dodged:false,critical:damage===17,label:damage===17?'MAMBA BULLSEYE!':'MAMBA STRIKE!'});
    interruptDomainCharge(room,d,actual);
    if(checkWinner(room)){emitState(room);return;}
    finishAction(room,false,true);
  };
  if(damage>0&&maybeStartParry(room,{attacker:p.slot,defender:d.slot,label:'Black Mamba Strike',hits:[damage],onResolve:finalize}))return;
  finalize(null);
}
function equipBlackMambaArmor(room,p){
  if(p.mambaTurns>0)return {error:`Black Mamba Armor is already active for ${p.mambaTurns} more turn(s).`};
  if(p.momentum<15)return {error:'Black Mamba Armor costs 15 Momentum.'};
  p.momentum-=15;
  p.mambaTurns=4; // turn end leaves 3 personal turns active.
  const add=rollRangeShown(room,10,15,'Black Mamba Armor Defence');
  const before=p.defence;
  p.defence=clamp(p.defence+add,0,20);
  const gained=p.defence-before;
  p.mambaDefenceRemaining=(p.mambaDefenceRemaining||0)+gained;
  notePresentationAbility(room,p,'blackmamba','Black Mamba Armor');
  logRoom(room,`🐍 ${p.name} spends 15 Momentum on Black Mamba Armor: +${gained} Defence (${before} → ${p.defence}), Mamba Strike and Targeting Systems unlocked for 3 turns.`,'special');
  finishAction(room,false,true);
  return {ok:true};
}

// Master of Presentation's new unlockable minigames use server-owned results.
function deploySpiderBot(room,p){
  if(p.spiderTurns>0)return {error:'Spider Bot is already deployed.'};
  if(p.momentum<10)return {error:'Spider Bot costs 10 Momentum.'};
  p.momentum-=10;p.spiderTurns=4; // three full subsequent personal turns
  p.spiderDodgeReady=true;
  const before=p.defence;p.defence=clamp(before+5,0,20);
  notePresentationAbility(room,p,'spiderbot','Spider Bot');
  logRoom(room,`🕷️ ${p.name} deploys SPIDER BOT for 10 Momentum, gains ${p.defence-before} Defence and a one-use 25% dodge chance! Turret and Music Speakers unlocked.`, 'special');
  finishAction(room,false,true);
  return {ok:true};
}
function activateMusicSpeakers(room,p){
  if(p.spiderTurns<=0)return {error:'Deploy Spider Bot first.'};
  const d=room.players[1-p.slot];
  d.groovinTurns=3;d.groovinBlocked=null;
  notePresentationAbility(room,p,'speakers','Music Speakers');
  logRoom(room,`🔊 ${p.name} starts Music Speakers! ${d.name} is GROOVIN for the next 3 personal turns: a random main button will be disabled each turn.`, 'special');
  finishAction(room,false);
  return {ok:true};
}
function generatePresentationTargets(n){
  const out=[];
  for(let i=0;i<n;i++){
    let x,y,tries=0;
    do{x=10+crypto.randomInt(81);y=14+crypto.randomInt(67);tries++;}
    while(out.length&&Math.hypot(x-out.at(-1).x,y-out.at(-1).y)<38&&tries<30);
    out.push({x,y,hit:false,spawn:0});
  }
  return out;
}
function startPresentationMini(room,p,kind){
  if(kind==='targeting'&&p.mambaTurns<=0)return {error:'Black Mamba Armor must be active for Targeting Systems.'};
  if(kind==='turret'&&p.spiderTurns<=0)return {error:'Spider Bot must be active for Electricity Turret.'};
  if(room.presentationMini)return {error:'A minigame is already active.'};
  const now=Date.now();
  const targets=kind==='targeting'?generatePresentationTargets(24):Array.from({length:15},(_,i)=>({x:15+(i%5)*17+crypto.randomInt(7)-3,y:-10,spawn:i*240,hit:false}));
  const minigame={id:crypto.randomBytes(8).toString('hex'),slot:p.slot,kind,startedAt:now+300,deadline:now+(kind==='targeting'?3300:8800),hits:0,shotsFired:0,targets,lastHitAt:0,shipX:50,shipY:88,lastShipAt:now};
  room.presentationMini=minigame;
  room.phase='presentationMini';
  notePresentationAbility(room,p,kind,kind==='targeting'?'Targeting Systems':'Electricity Turret');
  logRoom(room,kind==='targeting'?`🎯 ${p.name} activates TARGETING SYSTEMS: 3 seconds to hit distant targets!`:`🛸 ${p.name} activates ELECTRICITY TURRET: 15 invaders approaching!`,'special');
  emitState(room);
  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    if(live?.presentationMini?.id!==minigame.id||live.status!=='playing')return;
    finishPresentationMini(live);
  },Math.max(0,minigame.deadline-Date.now()+40));
  return {ok:true,deferred:true};
}
function finishPresentationMini(room){
  const mini=room.presentationMini;if(!mini)return;
  room.presentationMini=null;room.phase='turn';room.current=mini.slot;
  const p=room.players[mini.slot],d=room.players[1-mini.slot];
  const damage=(mini.kind==='targeting'?4+mini.hits*3:5+mini.hits);
  addDamagingSpecialMomentum(room,p,mini.kind==='targeting'?'Targeting Systems':'Electricity Turret');
  const apply=(parries=null)=>{
    if(Array.isArray(parries)&&parries[0]){
      logRoom(room,`🛡️ ${d.name} parries ${p.name}'s ${mini.kind==='targeting'?'Targeting Systems':'Electricity Turret'}!`,'special');
      finishAction(room,false,true);return;
    }
    const res=absorbAttack(room,d,damage,p,{normalAttack:false});
    const actual=res.damage;
    hurtFighter(room,d,actual);
    reflectSeduced(room,p,actual,mini.kind==='targeting'?'Targeting Systems':'Electricity Turret');
    logRoom(room,`🎯 ${p.name} hit ${mini.hits}/${mini.targets.length} targets: ${damage} raw damage; ${d.name} takes ${actual}.`,'special');
    emitCombatFx(room,{kind:'special',attacker:p.slot,defender:d.slot,damage:actual,blocked:res.blocked||0,critical:false,label:mini.kind==='targeting'?'TARGET LOCK!':'TURRET STRIKE!'});
    interruptDomainCharge(room,d,actual);
    if(checkWinner(room)){emitState(room);return;}
    finishAction(room,false,true);
  };
  if(damage>0&&maybeStartParry(room,{attacker:mini.slot,defender:d.slot,label:mini.kind==='targeting'?'Targeting Systems':'Electricity Turret',hits:[damage],onResolve:apply}))return;
  apply(null);
}

function startBlackMambaStrike(room,p,skipDecoy=false){
  if(p.mambaTurns<=0)return {error:'Equip Black Mamba Armor before using Mamba Strike.'};
  if(p.mambaStrikeCooldown>0)return {error:`Mamba Strike is on cooldown for ${p.mambaStrikeCooldown} more turn(s).`};

  const d=room.players[1-p.slot];
  if(!skipDecoy&&maybeStartDecoy(room,{
    attacker:p.slot,defender:d.slot,label:'Black Mamba Strike',
    onSuccess:()=>startBlackMambaStrike(room,p,true),
    onMiss:()=>{
      p.mambaStrikeCooldown=2;
      addDamagingSpecialMomentum(room,p,'Black Mamba Strike');
      notePresentationAbility(room,p,'mambastrike','Mamba Strike');
      finishAction(room,false,true);
    }
  }))return {ok:true,deferred:true};

  p.mambaStrikeCooldown=2; // turn end leaves 1-turn cooldown.
  notePresentationAbility(room,p,'mambastrike','Mamba Strike');
  const id=crypto.randomBytes(6).toString('hex'),cycleMs=360;
  room.mambaTarget={id,slot:p.slot,startedAt:Date.now()+350,cycleMs};
  room.phase='mambaTarget';
  logRoom(room,`🐍 ${p.name} launches Mamba Strike! The targeting ring now collapses much faster.`,'special');
  emitState(room);

  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    if(!live?.mambaTarget||live.mambaTarget.id!==id||live.phase!=='mambaTarget')return;
    live.mambaTarget=null;live.phase='turn';live.current=p.slot;
    logRoom(live,`🐍 ${p.name} waits too long on the Black Mamba target. The strike deals 0 damage.`,'bad');
    resolveMambaStrike(live,p.slot,0,0);
  },15000);
  return {ok:true,deferred:true};
}

function startBite87Timing(room,p,skipDecoy=false){
  if(p.bite87Cooldown>0)return {error:`Bite of 87!? is on cooldown for ${p.bite87Cooldown} more turn(s).`};
  const d=room.players[1-p.slot];
  if(!skipDecoy&&maybeStartDecoy(room,{
    attacker:p.slot,defender:d.slot,label:'Bite of 87!?',
    onSuccess:()=>startBite87Timing(room,p,true),
    onMiss:()=>{
      p.bite87Cooldown=7;
      addDamagingSpecialMomentum(room,p,'Bite of 87!?');
      logRoom(room,`🎭 Bite of 87!? chomps a Decoy and misses ${d.name}.`,'special');
      finishAction(room,false,true);
    }
  }))return {ok:true,deferred:true};
  p.bite87Cooldown=7; // this attack ends the turn; tick leaves the requested 6-turn cooldown.
  const id=crypto.randomBytes(6).toString('hex');
  room.attackTiming={id,slot:room.current,style:'bite87',startedAt:Date.now()};
  room.phase='attackTiming';
  logRoom(room,`🐻 ${p.name} winds up Bite of 87!? — hit all four timing bars!`,'special');
  emitState(room);
  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    if(!live?.attackTiming||live.attackTiming.id!==id||live.phase!=='attackTiming')return;
    live.attackTiming=null;live.phase='turn';
    resolveTimingAttack(live,'bite87',['bad','bad','bad','bad']);
  },12000);
  return {ok:true,timing:{id,style:'bite87',bars:4}};
}

// Blue Judas's interactive accuracy minigames. Damage and timing grades live on
// the server; the browser never chooses damage, effects, charges, or grades.
function startJudasMinigame(room,p,kind,charges=0){
 if(p.special!=='bluejudas')return {error:'Only Blue Judas uses Limitless.'};
 const blue=kind==='blue'||kind==='maxblue',max=['maxblue','maxred'].includes(kind);
 if(!['blue','red','maxblue','maxred'].includes(kind))return {error:'Unknown Limitless attack.'};
 if(max&&p.sixEyesTurns<=0)return {error:'Activate Six Eyes first.'};
 const ce=blue?(max?5:3):2,pe=blue?0:1;
 const amount=Number(charges);
 if(max&&(!Number.isInteger(amount)||amount<0||amount>2||amount>(blue?p.blueCharges:p.redCharges||0)))return {error:'Choose 0–2 available matching Charges.'};
 if(p.judasMiniCooldown>0)return {error:`Limitless is recovering for ${p.judasMiniCooldown} turn(s).`};
 if(p.cursedEnergy<ce||p.positiveEnergy<pe)return {error:`Requires ${ce} Cursed Energy${pe?' and 1 Positive Energy':''}.`};
 CJ.spend(p,ce,pe);
 const id=crypto.randomBytes(6).toString('hex'),now=Date.now();
 room.judasMini={id,owner:p.slot,kind,boost:max?amount:0,startedAt:now+700,deadline:now+(blue?3700:6500),objects:[],lastAt:0};
 room.phase='judasMinigame';
 logRoom(room,`🌀 ${p.name} initiates ${kind.toUpperCase()}! ${blue?`Drag all ${max?6:3} moving objects into the gravity orb!`:'Release the red sphere exactly at the target ring!'}`,'special');
 emitState(room);
 scheduleGameTimer(()=>{const live=rooms.get(room.code);if(live?.judasMini?.id===id&&live.phase==='judasMinigame')resolveJudasMini(live,'miss');},blue?3900:7000);
 return {ok:true,deferred:true};
}
function judasMiniAct(room,slot,action,index){
 const game=room.judasMini;if(room.phase!=='judasMinigame'||!game||game.owner!==slot)return {error:'No Limitless minigame is active.'};
 const now=Date.now();if(now<game.startedAt)return {error:'Wait for the minigame to begin.'};
 if(now>game.deadline)return {error:'The time limit is over.'};
 if(game.kind==='red'||game.kind==='maxred'){
   if(action!=='release')return {error:'Release the sphere.'};
   // 55–117px radius; target 85px; server clock decides the result.
   const radius=86+31*Math.sin((now-game.startedAt)/360);
   const error=Math.abs(radius-86);
   return resolveJudasMini(room,error<=4?'perfect':error<=13?'good':'miss');
 }
 if(action!=='drop'||!Number.isInteger(index)||index<0||index>=(game.kind==='maxblue'?6:3))return {error:'Drag a valid object into the orb.'};
 if(game.objects.includes(index))return {error:'That object was already captured.'};
 if(game.lastAt&&now-game.lastAt<110)return {error:'Move the objects individually.'};
 game.objects.push(index);game.lastAt=now;
 if(game.objects.length===(game.kind==='maxblue'?6:3))return resolveJudasMini(room,now-game.startedAt<=(game.kind==='maxblue'?2650:1650)?'perfect':'good');
 emitState(room);return {ok:true};
}
function resolveJudasMini(room,grade){
 const game=room.judasMini;if(!game)return {error:'No game.'};
 const p=room.players[game.owner],target=room.players[1-game.owner];
 const blue=game.kind==='blue'||game.kind==='maxblue',max=['maxblue','maxred'].includes(game.kind);
 if(blue&&grade==='miss'&&game.objects.length>=(max?5:2))grade='good';
 const damage=blue?(grade==='perfect'?11:grade==='good'?8:5):(grade==='perfect'?13:grade==='good'?9:6);
 let raw=damage+(max?4:0);
 if(!blue&&target.pulled>0){raw+=3;target.pulled=0;logRoom(room,'💙🔴 PULLED COMBO: +3 Red damage!','special');}
 // Max Blue may consume one or two Blue Charges: each is +2 damage;
 // two consumed charges also inflict one existing negative status.
 if(max){const used=game.boost||0;if(blue)p.blueCharges-=used;else p.redCharges-=used;raw+=used*2;
   if(used===2){const effects=['weakness','armourBreak','poison'];const effect=effects[GR.randomInt(effects.length)];
     if(effect==='weakness')target.weakness=Math.max(target.weakness,2);
     else if(effect==='armourBreak'){target.armourBreak=Math.max(target.armourBreak,2);target.armourDefenceLock=1;}
     else target.poison=Math.max(target.poison,2);
     logRoom(room,`💫 Two ${blue?'Blue':'Red'} Charges trigger ${effect}!`,'special');}
 }
 if(grade==='miss'&&blue){p.momentum=Math.max(0,p.momentum-7);}
 if(grade!=='miss'){
   if(blue)target.pulled=Math.max(target.pulled,1);else target.offBalance=Math.max(target.offBalance,1);
   if(grade==='perfect'){if(blue)p.blueCharges=Math.min(5,(p.blueCharges||0)+1);else p.redCharges=Math.min(5,(p.redCharges||0)+1);}
 }
 room.judasMini=null;room.phase='turn';room.current=p.slot;
 addDamagingSpecialMomentum(room,p,blue?'Limitless Blue':'Limitless Red');
 const finish=(hits=null)=>{
  if(hits?.[0]){logRoom(room,`♾️ ${target.name} blocks ${game.kind.toUpperCase()} with Infinity!`,'good');finishAction(room,false,true);return;}
  const res=absorbAttack(room,target,raw,p,{normalAttack:false});hurtFighter(room,target,res.damage);
  emitCombatFx(room,{kind:'judas-special',attacker:p.slot,defender:target.slot,damage:res.damage,blocked:res.blocked||0,critical:grade==='perfect',label:`${game.kind.toUpperCase()} — ${grade.toUpperCase()}`});
  logRoom(room,`🔵 ${p.name}'s ${game.kind.toUpperCase()} scores ${grade.toUpperCase()}: ${res.damage} damage${grade==='perfect'?', gains a charge':''}.`,'special');
  if(checkWinner(room)){emitState(room);return;}
  finishAction(room,false,true);
 };
 if(target.infinityHits>0 && maybeStartParry(room,{attacker:p.slot,defender:target.slot,label:game.kind.toUpperCase(),hits:[raw],onResolve:finish}))return {ok:true,deferred:true};
 finish();return {ok:true};
}
// RED JUDAS: the server owns each sequence, timing window, damage and status.
// Five colourless glyph possibilities; displayed for 3.5 seconds, then 4 seconds to enter.
const RED_GLYPHS=['◆','◇','△','▽','○'];
function startRedJudasMini(room,p,kind){
  if(p.special!=='redjudas'||!['dismantle','cleave','fuga'].includes(kind))return {error:'Not a Red Judas attack.'};
  if(kind==='fuga'&&p.kingTurns<=0)return {error:'Fuga requires King of Curses.'};
  const field=kind+'Cooldown';
  if((p[field]||0)>0)return {error:`${kind} is on cooldown for ${p[field]} turns.`};
  const ce=kind==='dismantle'?4:kind==='fuga'?10:0,pe=kind==='cleave'?2:kind==='fuga'?2:0;
  if(!CJ.spend(p,ce,pe))return {error:`Requires ${ce} Cursed and ${pe} Positive Energy.`};
  p[field]=0; // Red Judas's damaging Specials have no individual cooldowns.
  const now=Date.now(),id=crypto.randomBytes(6).toString('hex');
  const revealEndsAt=now+(kind==='fuga'?4000:3500);
  const deadline=kind==='cleave'?now+7000:revealEndsAt+(kind==='fuga'?6500:4000);
  const sequence=kind==='cleave'?[]:kind==='fuga'?(()=>{const a=[0,1,2,3,4];for(let i=4;i>0;i--){const j=GR.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;})():Array.from({length:5},()=>GR.randomInt(5));
  const slashes=kind==='cleave'?[now+1550,now+2750,now+4400]:[]; // slow, fast, fake-out
  room.judasMini={id,owner:p.slot,kind,startedAt:now,deadline,revealEndsAt,sequence,slashes,pressed:[],objects:[]};
  room.phase='judasMinigame';
  logRoom(room,`🩸 ${p.name} begins ${kind.toUpperCase()}! ${kind==='cleave'?'Time the three unpredictable slashes!':'Memorize the five symbols, then enter them in order!'} `,'special');
  emitState(room);
  scheduleGameTimer(()=>{const live=rooms.get(room.code);if(live?.judasMini?.id===id&&live.phase==='judasMinigame')resolveRedJudasMini(live);},deadline-now+200);
  return {ok:true,deferred:true};
}
function redJudasMiniAct(room,slot,action,data){
  const g=room.judasMini;
  if(room.phase!=='judasMinigame'||!g||g.owner!==slot)return {error:'No Red Judas minigame is active.'};
  if(!['dismantle','cleave','fuga'].includes(g.kind))return {error:'Wrong minigame.'};
  const now=Date.now();
  if(now>g.deadline)return resolveRedJudasMini(room);
  if(g.kind==='cleave'){
    if(action!=='slash')return {error:'Press SLASH on the rhythm.'};
    const i=g.pressed.length;if(i>=3)return {error:'All slashes resolved.'};
    if(now<g.slashes[i]-580)return {error:'Too early: wait for the slash.'};
    const hit=Math.abs(now-g.slashes[i])<=230;g.pressed.push(hit);
    if(g.pressed.length===3){resolveRedJudasMini(room);return {ok:true,hit,index:i};}
    emitState(room);return {ok:true,hit,index:i};
  }
  if(!['submit','press','undo'].includes(action))return {error:'Enter the five symbols.'};
  if(now<g.revealEndsAt)return {error:'Watch the sequence first.'};
  if(action==='undo'){g.pressed.pop();emitState(room);return {ok:true};}
  if(action==='press'){const symbol=Number(data);if(!Number.isInteger(symbol)||symbol<0||symbol>=5||g.pressed.length>=5)return {error:'Invalid symbol.'};g.pressed.push(symbol);emitState(room);if(g.pressed.length===5)return resolveRedJudasMini(room);return {ok:true};}
  if(!Array.isArray(data))data=g.pressed;
  if(!Array.isArray(data)||data.length>5||data.some(n=>!Number.isInteger(n)||n<0||n>=5))return {error:'Select up to five valid symbols; each correct slot counts independently.'};
  g.pressed=data;return resolveRedJudasMini(room);
}
function resolveRedJudasMini(room){
  const g=room.judasMini;if(!g)return {error:'No minigame active.'};
  const a=room.players[g.owner],d=room.players[1-g.owner];
  const hits=g.kind==='cleave'?g.pressed.filter(Boolean).length:g.sequence.reduce((acc,v,i)=>acc+(g.pressed[i]===v?1:0),0);
  const raw=g.kind==='dismantle'?[0,3,5,8,12,15][hits]:g.kind==='cleave'?[2,5,7,10][hits]:[3,5,7,10,15,20][hits];
  room.judasMini=null;room.phase='turn';room.current=a.slot;
  addDamagingSpecialMomentum(room,a,g.kind.toUpperCase());
  const finish=(parried=null)=>{
    if(parried?.[0]){logRoom(room,`♾️ ${d.name} blocks ${g.kind} with Infinity.`,'good');finishAction(room,false,true);return;}
    if(g.kind==='dismantle'&&hits>=4)d.scored=Math.max(d.scored||0,2);
    if(g.kind==='cleave'&&hits>=2)d.bleed=Math.max(d.bleed,2);
    if(g.kind==='fuga'&&hits>0){d.burn=Math.max(d.burn,2);d.burnMultiplier=2;}
    let attackRaw=raw;
    if(g.kind==='cleave'&&d.scored>0){attackRaw+=3;d.scored=0;logRoom(room,'✂️ SCORED! Cleave deals +3 damage.','special');}
    const res=absorbAttack(room,d,attackRaw,a,{normalAttack:false});hurtFighter(room,d,res.damage);
    logRoom(room,`🩸 ${a.name}'s ${g.kind.toUpperCase()}: ${hits}/${g.kind==='cleave'?3:5} correct, ${res.damage} damage.`,'special');
    emitCombatFx(room,{kind:'judas-special',attacker:a.slot,defender:d.slot,damage:res.damage,blocked:res.blocked||0,critical:hits===(g.kind==='cleave'?3:5),label:g.kind.toUpperCase()});
    interruptDomainCharge(room,d,res.damage);
    if(checkWinner(room)){emitState(room);return;}
    finishAction(room,false,true);
  };
  if(d.infinityHits>0&&maybeStartParry(room,{attacker:a.slot,defender:d.slot,label:g.kind,hits:[raw],onResolve:finish}))return {ok:true,deferred:true};
  finish();return {ok:true};
}
function doSpecial(room, move, options={}){
  const p=room.players[room.current];
  if(p.special==='standard')return {error:'This champion has no Special.'};

  if(p.special==='gambler'){
    if(move==='roulette')return startGamblerRoulette(room,p);
    if(move==='blackjack')return startGamblerBlackjack(room,p);
    if(move==='poker')return startGamblerPoker(room,p);
    if(move==='double'){
      if(p.gamblerCooldowns.double>0)return {error:'Double or Nothing is on cooldown.'};
      p.doubleOrNothing=true;p.coinFlips=0;p.coinMultiplier=1;p.gamblerCooldowns.double=4;
      logRoom(room,`🪙 ${p.name} arms Double or Nothing for the next attack (up to three 50/50 flips).`,'special');
      finishAction(room,false);return {ok:true};
    }
    if(move==='jackpottt'){
      if(p.jackpotTurns<=0||p.jackpotHealUsed)return {error:'JACKPOTTT is only available once during JACKPOTT.'};
      p.jackpotHealUsed=true;p.jackpotHealTurns=p.jackpotTurns;
      const h=Math.min(7,p.maxHp-p.hp);p.hp+=h;
      logRoom(room,`💚 ${p.name} activates JACKPOTTT: healed ${h} HP now, and will heal 7 HP each remaining JACKPOTT turn.`,'good');
      finishAction(room,false);return {ok:true};
    }
    if(move==='dancebattle'){
      if(p.jackpotTurns<=0||p.jackpotDanceUsed)return {error:'Dance Battle is only available once during JACKPOTT.'};
      const danceResult=startDanceBattle(room,room.current);
      if(danceResult.ok)p.jackpotDanceUsed=true;
      return danceResult;
    }
    return {error:'Unknown Gambler move.'};
  }

  if(p.special==='pokemontrainer'){
    if(move==='pokemoncenter'||move==='pokemoncenterpp')return pokemonRestoreCenter(room,p);
    return usePokemonMove(room,p,move);
  }

  if(p.special==='greatexception'){
    if(move==='umbrella')return startUmbrellaMini(room,p);
    if(move==='dancebattle')return startDanceBattle(room,room.current);
    if(move==='magicbag'){
      if(p.magicBagItem)return {error:'You already have a Magic Bag item waiting for a choice.'};
      const item=drawMagicItem(p);
      p.magicBagItem=item.id;
      room.phase='magicBagChoice';
      logRoom(room,`👜 ${p.name} reaches into Magic Bag and draws an item...`,'special');
      emitState(room);
      return {ok:true,item:publicMagicItem(item)};
    }
    return {error:'Unknown Great Exception move.'};
  }


  if(p.special==='glovedone'){
    if(move==='dancebattle')return startDanceBattle(room,room.current);
    if(move==='moonwalk')return startGloveMini(room,p,'moon');
    if(move==='smooth')return startGloveMini(room,p,'smooth');
    if(move==='thriller')return startGloveMini(room,p,'thriller');
    if(move==='feel'){if((p.gloveHype||0)<40)return {error:'Need 40 Crowd Hype.'};p.gloveHype-=40;p.momentum=p.gloveHype;p.flowReady=true;logRoom(room,'✨ Feel the Flow! Next damaging attack +6; Perfect preserves the buff.','special');finishAction(room,false);return {ok:true};}
    if(move==='kid'){
      if(p.gloveKidCooldown>0)return {error:`The Kid Is Not My Son! is on cooldown (${p.gloveKidCooldown} turn(s)).`};
      p.gloveKidCooldown=5; // Four future personal turns; current turn ticks at end.
      const removed=[];
      const clear=(key,label)=>{if(p[key]>0){p[key]=0;removed.push(label)}};
      clear('shock','Shock');clear('bleed','Bleed');clear('poison','Poison');clear('burn','Burn');
      clear('syringeDamageTurns','Syringe Damage');clear('forcedSkip','Marbles');clear('seduced','Seduced');
      clear('confusedMissTurns','Confused');clear('weakness','Weakness');clear('armourBreak','Armour Break');
      clear('exhaustion','Exhaustion');clear('ptsd','PTSD');
      p.lastBattleButton=null;
      logRoom(room,`🧤 ${p.name} uses "The Kid Is Not My Son!" and clears ${removed.length?removed.join(', '):'no active bad effects'}.`,'special');
      finishAction(room,false);return {ok:true};
    }
    if(move==='beatit')return startGloveMini(room,p,'beat');
    if(move==='pitch')return startBeatIt(room,room.current);
    if(move==='footwork')return startFootworkMini(room,p);
    return {error:'Unknown Gloved One move.'};
  }


  if(p.special==='masterpresentation'){
    if(move==='brainbotswarm'){
      const r=spawnBrainbot(room,p);if(r.error)return r;
      notePresentationAbility(room,p,'brainbotswarm','Brainbot Swarm');
      finishAction(room,false);return {ok:true};
    }
    if(move==='blackmamba')return equipBlackMambaArmor(room,p);
    if(move==='spiderbot')return deploySpiderBot(room,p);
    if(move==='targetingsystems')return startPresentationMini(room,p,'targeting');
    if(move==='electricityturret')return startPresentationMini(room,p,'turret');
    if(move==='musicspeakers')return activateMusicSpeakers(room,p);
    if(move==='mambastrike')return startBlackMambaStrike(room,p);
    if(move==='decoy'){
      p.decoyStacks=(p.decoyStacks||0)+1;
      notePresentationAbility(room,p,'decoy','Decoy');
      logRoom(room,`🎭 ${p.name} prepares Decoy stack ${p.decoyStacks}. The next incoming Attack/Beam will show ${p.decoyStacks+1} identical target UIs.`,'special');
      finishAction(room,false);return {ok:true};
    }
    if(move==='deathray')return startDeathRayGame(room,p);
    return {error:'Unknown Master of Presentation move.'};
  }

  if(p.special==='redjudas'){
    if(move==='dismantle'||move==='cleave'||move==='fuga')return startRedJudasMini(room,p,move);
    if(move==='bindingvow'){
      if(p.kingTurns<=0)return {error:'Binding Vow requires King of Curses.'};
      if((p.bindingVowUses||0)>=4)return {error:'Binding Vow has reached its 4-use battle limit.'};
      if((p.bindingVowUsesThisTurn||0)>=2)return {error:'Binding Vow can only be used twice per turn.'};
      const oldHp=p.hp;
      hurtFighter(room,p,5);
      p.bindingVowUses=(p.bindingVowUses||0)+1;
      p.bindingVowUsesThisTurn=(p.bindingVowUsesThisTurn||0)+1;
      p.actionsRemaining=Math.max(1,p.actionsRemaining)+1;
      loseMomentumForNonAttack(room,p,'Binding Vow');
      logRoom(room,`⛓️ ${p.name} uses Binding Vow (${p.bindingVowUses}/4 battle uses, ${p.bindingVowUsesThisTurn}/2 this turn): HP ${oldHp} → ${p.hp}. They gain +1 extra move this turn (${p.actionsRemaining} moves available).`,'special');
      if(checkWinner(room)){emitState(room);return {ok:true};}
      emitState(room);
      return {ok:true};
    }
    if(move==='king'){
      if(p.kingTurns>0)return {error:'King of Curses is already active.'};
      if(p.kingCooldown>0)return {error:`King of Curses is on cooldown for ${p.kingCooldown} more turn(s).`};
      if(p.momentum<50&&!room.infiniteUltimates)return {error:'King of Curses requires 50 Momentum.'};
      if(!room.infiniteUltimates)p.momentum-=50;
      p.cursedMax=20;
      p.kingTurns=6; // current turn ticks immediately, leaving 5 full turns active.
      p.domainAvailable=true;
      logRoom(room,`👑 ${p.name} activates King of Curses for 5 turns. Their attacks gain +2 damage and ignore the opponent's stored Defence and block effects such as Six Eyes. Domain Expansion M.S. is unlocked once for this activation.`,'special');
      finishAction(room,false);return {ok:true};
    }
    if(move==='domain'){
      if(room.domain)return {error:'A Domain is already active.'};
      if(p.domainCharging)return {error:'M.S. is already charging.'};
      if(p.kingTurns<=0||!p.domainAvailable)return {error:'Domain Expansion M.S. requires an unused King of Curses Domain.'};
      const mode=String(options.mode||'charge');
      if(!['charge','fast'].includes(mode))return {error:'Choose Charge Domain or Instant Domain.'};
      if(mode==='fast'&&!CJ.spend(p,15,0))return {error:'Instant Domain requires 15 Cursed Energy.'};
      p.domainAvailable=false;p.domainCharging=true;p.domainChargeProgress=mode==='fast'?3:0;
      p.domainChargeMode=mode;p.domainOfferHandled=false;p.domainKind='ms';
      logRoom(room,mode==='fast'?`🩸 ${p.name} spends 15 CE to unleash M.S. next turn.`:`🩸 ${p.name} starts a 3-turn M.S. charge. Each personal turn costs 4 CE; other moves remain available.`,'special');
      finishAction(room,false);
      if(mode==='fast')openDomainOffer(room,p.slot,true);
      return {ok:true};
    }
    if(move==='rct'){
      if(p.rctCooldown>0)return {error:`Reversal Cursed Technique is on cooldown for ${p.rctCooldown} turns.`};
      if(!CJ.spend(p,0,4))return {error:'Reversal Cursed Technique requires 4 Positive Energy.'};
      p.rctHealTurns=2;p.rctCooldown=5;
      const heal=Math.min(7,p.maxHp-p.hp);p.hp+=heal;
      logRoom(room,`♻️ ${p.name} activates Reversal Cursed Technique for 7 HP now and for two further turns.`,'good');
      finishAction(room,false);return {ok:true};
    }
    return {error:'Unknown Red Judas move.'};
  }

  if(p.special==='bluejudas'){
    if(move==='infinity'){
      if(p.infinityHits>0)return {error:'Infinity already protects your next attacks.'};
      if(!CJ.spend(p,7,0))return {error:'Infinity requires 7 Cursed Energy.'};
      p.infinityHits=3;
      logRoom(room,`♾️ ${p.name} activates Infinity for the next three incoming attacks. Time each reaction to negate the hit; heavy blows have tighter timing windows.`,'special');
      finishAction(room,false);return {ok:true};
    }
    if(move==='blue')return startJudasMinigame(room,p,'blue');
    if(move==='red')return startJudasMinigame(room,p,'red');
    if(move==='maxblue'){
      if(p.sixEyesTurns<=0)return {error:'Max Blue requires Six Eyes.'};
      return startJudasMinigame(room,p,'maxblue',options.charges);
    }
    if(move==='maxred'){
      if(p.sixEyesTurns<=0)return {error:'Max Red requires Six Eyes.'};
      return startJudasMinigame(room,p,'maxred',options.charges);
    }
    if(move==='sixeyes'){
      if(p.sixEyesTurns>0)return {error:'Six Eyes is already active.'};
      if(p.sixEyesCooldown>0)return {error:`Six Eyes is on cooldown for ${p.sixEyesCooldown} more turn(s).`};
      if(p.momentum<50&&!room.infiniteUltimates)return {error:'Six Eyes requires 50 Momentum.'};
      if(!room.infiniteUltimates)p.momentum-=50;
      p.cursedMax=20;
      p.sixEyesTurns=7; // activation tick leaves six complete personal turns.
      p.domainAvailable=true;
      // Six Eyes is only a defensive passive + Domain unlock. It does not
      // create a special phase and never restricts the opponent's actions.
      logRoom(room,`👁️ ${p.name} activates Six Eyes for 6 turns. Incoming attacks now have a 1-in-3 chance to be completely blocked. Domain Expansion I.V. is unlocked once for this Six Eyes activation.`,'special');
      finishAction(room,false);return {ok:true};
    }
    if(move==='domain'){
      if(room.domain)return {error:'A Domain is already active. You cannot use Domain Expansion inside another Domain.'};
      if(p.domainCharging)return {error:'Domain Expansion I.V. is already charging.'};
      if(p.sixEyesTurns<=0)return {error:'Domain Expansion I.V. can only be started while Six Eyes is active.'};
      if(!p.domainAvailable)return {error:'You already used your Domain for this Six Eyes activation. Use Six Eyes again before another Domain.'};
      const mode=String(options.mode||'charge');
      if(!['charge','fast'].includes(mode))return {error:'Choose Charge Domain or Instant Domain.'};
      if(mode==='fast'&&!CJ.spend(p,15,0))return {error:'Instant Domain requires 15 Cursed Energy.'};
      p.domainAvailable=false;p.domainCharging=true;p.domainChargeProgress=mode==='fast'?3:0;
      p.domainChargeMode=mode;p.domainOfferHandled=false;p.domainKind='iv';
      logRoom(room,mode==='fast'?`🌀 ${p.name} spends 15 Cursed Energy to launch I.V. on their next turn!`:`🌀 ${p.name} begins a three-turn I.V. charge. Each personal turn costs 4 Cursed Energy and normal actions remain available.`,'special');
      finishAction(room,false);
      if(mode==='fast')openDomainOffer(room,p.slot,true);
      return {ok:true};
    }
    if(move==='rct'){
      if(p.rctCooldown>0)return {error:`Reverse Cursed Technique is on cooldown for ${p.rctCooldown} turns.`};
      if(!CJ.spend(p,0,4))return {error:'Reverse Cursed Technique needs 4 Positive Energy.'};
      p.rctHealTurns=3;p.rctCooldown=5;
      const heal=Math.min(7,p.maxHp-p.hp);p.hp+=heal;
      p.rctHealTurns--; // first pulse now, next two at turn starts
      logRoom(room,`♻️ ${p.name} starts Reverse Cursed Technique for 3 healing pulses (7 HP each). +${heal} HP now.`,'good');
      finishAction(room,false);return {ok:true};
    }
    return {error:'Unknown Blue Judas move.'};
  }

  if(p.special==='nightcrawler'){
    if(move==='shock'){
      if(p.effectCooldowns.shock>0)return {error:`Shock is on cooldown for ${p.effectCooldowns.shock} more turn(s).`};
      addDamagingSpecialMomentum(room,p,'Shock');
      return doEffect(room,'shock',false,true);
    }
    if(move==='bite87')return startBite87Timing(room,p);
    if(move==='lightsout'){
      if(p.specialCooldown>0)return {error:'Lights Out is on cooldown.'};
      if(p.lightsOut)return {error:'Lights Out is already active.'};
      p.lightsOut=true;p.specialCooldown=6;
      logRoom(room, `🌑 ${p.name} uses Lights Out. +1 attack damage and +2 Defence until the opponent passes Action → Other Action.`, 'special');
      finishAction(room,false);return {ok:true};
    }
    if(move==='nightfive'){
      if(!p.lightsOut)return {error:'Night Five can only be used during Lights Out.'};
      if(p.nightFiveCooldown>0)return {error:'Night Five is on cooldown.'};
      p.nightFiveTurns=2;p.nightFiveCooldown=8;
      logRoom(room, `🌙 ${p.name} uses Night Five. Their next two turns have two actions each.`, 'special');
      finishAction(room,false);return {ok:true};
    }
    return {error:'Unknown Nightcrawler move.'};
  }

  if(p.specialCooldown>0)return {error:'Your Special is on cooldown.'};
  if(p.special==='berserker')p.strengthen=true;
  else if(p.special==='ironwall')p.defence=clamp(p.defence+5,0,20);
  else if(p.special==='arcanesurge'){p.charge='ready';p.beamCharge='none';}
  else if(p.special==='trickster')p.actionBonus=4;
  p.specialCooldown=6;
  logRoom(room, `⭐ ${p.name} uses ${SPECIALS[p.special].move}.`, 'special');
  finishAction(room,false);return {ok:true};
}
function startBeam(room, total, description, attackerSlot, forceFull=false){
  const a=room.players[attackerSlot],defender=1-attackerSlot;
  a.beamCooldown=3;a.beamCooldownBypass=false;
  room.beamPending={attacker:attackerSlot,defender,roll:total,description,forceFull};
  room.phase='beamResponse';
  logRoom(room, `☄️ ${a.name} fires a Beam for ${total}.`, 'special');
  emitState(room);
}
function fireBeam(room, actionMode=false, base=20, skipDecoy=false,unstable=false){
  const a=room.players[room.current],d=room.players[1-room.current];
  const bypass=!!a.beamCooldownBypass;
  if(a.beamCharge!=='ready'||(a.beamCooldown>0&&!bypass))return {error:'Beam is not ready.'};

  if(!skipDecoy&&maybeStartDecoy(room,{
    attacker:a.slot,defender:d.slot,label:'Beam',
    onSuccess:()=>fireBeam(room,actionMode,base,true,unstable),
    onMiss:()=>{
      const banked=Number(a.deathRayBeamBonus)||0;
      a.deathRayBeamBonus=0;a.beamCooldownBypass=false;a.beamCharge='none';a.beamCooldown=3;
      if(unstable){hurtFighter(room,a,5,'Unstable Beam recoil');logRoom(room,`⚠️ ${a.name} takes 5 Unstable Beam recoil even though the shot hit a Decoy.`,'bad');}
      const mom=addMomentum(a,18);
      logRoom(room,`🎭 ${a.name}'s Beam${banked?` (+${banked} Death Ray damage banked)`:''} blasts a Decoy and misses completely. Momentum ${mom.before}% → ${mom.after}%.`,'special');
      if(checkWinner(room)){emitState(room);return;}
      finishAction(room,actionMode,true);
    }
  }))return {ok:true,deferred:true};
  if(!DAMAGE_DICE.includes(+base))return {error:'Invalid Beam die.'};
  const count=actionMode?randomPoolCount(room,base,'Beam pool'):1,profile=offence(a,d,base),rs=[];
  for(let i=0;i<count;i++)rs.push(rollAttackDie(room,a,d,profile.sides,`Beam roll ${i+1}/${count}`));
  const itemDie=consumeMagicDice(room,a),crit=rs.some(x=>x===profile.sides),critBonus=crit?1:0,momBonus=momentumBonus(a);
  const deathRayBonus=Math.max(0,Number(a.deathRayBeamBonus)||0);
  a.deathRayBeamBonus=0;a.beamCooldownBypass=false;
  const total=6+rs.reduce((x,y)=>x+y,0)+profile.bonus+itemDie+critBonus+momBonus+deathRayBonus;
  if(a.stats){a.stats.attacks++;a.stats.beams++;if(crit)a.stats.criticalHits++;}
  const mom=addMomentum(a,18);
  a.beamCharge='none';
  if(unstable){hurtFighter(room,a,5,'Unstable Beam recoil');logRoom(room,`⚠️ Unstable Beam deals 5 recoil damage to ${a.name}.`,'bad');}
  if(checkWinner(room)){emitState(room);return {ok:true};}
  const desc=`Beam base +6 + ${count}D${profile.sides}: ${rs.join(' + ')}${profile.bonus?` + ${profile.bonus}`:''}${itemDie?` + item D6 ${itemDie}`:''}${critBonus?' + CRIT 1':''}${momBonus?` + Momentum ${momBonus}`:''}${deathRayBonus?' + Death Ray 1':''} = ${total}; Momentum ${mom.before}% → ${mom.after}%`;
  emitCombatFx(room,{kind:'beam-fire',attacker:a.slot,defender:d.slot,damage:total,blocked:0,dodged:false,critical:crit,naturalCrit:crit,label:crit?'CRITICAL BEAM!':'BEAM FIRED!'});
  startBeam(room,total,unstable?'UNSTABLE '+desc:desc,room.current,actionMode);
  return {ok:true};
}
function resolveBeamHit(room){
  const b=room.beamPending;if(!b)return;
  const attacker=room.players[b.attacker],d=room.players[b.defender];

  const finalize=(parryResults=null)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🗡️ ${d.name} PARRIES ${attacker.name}'s Beam! No damage is dealt.`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY BEAM!',amount:0,perfect:true});
      emitCombatFx(room,{kind:'parry',attacker:attacker.slot,defender:d.slot,damage:0,blocked:0,dodged:true,critical:true,label:'PARRY BEAM!'});
    }else{
      const res=absorbAttack(room,d,b.roll,attacker);
      const damage=res.damage+(attempted?1:0);
      hurtFighter(room,d,damage);
      reflectSeduced(room,attacker,damage,'Beam');
      if(attempted)logRoom(room,`💢 ${d.name} misses the Beam Parry and takes +1 extra damage.`,'bad');
      if(res.confusedMiss)logRoom(room,`🥸 ${attacker.name} is Confused and the Beam misses ${d.name}.`,'special');
      else if(res.kingBypass)logRoom(room,`👑 ${attacker.name}'s King of Curses punches the Beam through ${d.name}'s defensive protection${res.oldDef?` (${res.oldDef} stored Defence)`:''}, dealing ${damage}.`,'special');
      else if(res.umbrellaDodge)logRoom(room,`☂️ ${d.name} wins Umbrella's 50/50 and dodges the Beam${attempted?' but still takes 1 missed-Parry damage':''}!`,'special');
      else if(res.sixEyes)logRoom(room,`👁️ ${d.name}'s Six Eyes blocks the Beam${attempted?' but missed Parry damage still deals 1':''}!`,'special');
      else logRoom(room,`☄️ ${d.name} takes ${damage} Beam damage${res.oldDef?` after ${res.blocked} Defence`:''}.`,'bad');
      if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`BLOCK ${res.blocked}`,amount:res.blocked});
      emitCombatFx(room,{kind:'beam-hit',attacker:attacker.slot,defender:d.slot,damage,blocked:res.blocked||0,dodged:!!(res.umbrellaDodge||res.sixEyes),critical:false,label:damage>0?'BEAM HIT!':'BLOCKED!'});
      interruptDomainCharge(room,d,damage);
      if(checkWinner(room)){room.beamPending=null;emitState(room);return;}
    }

    const attackerSlot=b.attacker;
    room.beamPending=null;room.phase='turn';
    room.current=attackerSlot;
    finishAction(room,!!b.forceFull,true);
  };

  if(attacker.confusedMissTurns<=0&&maybeStartParry(room,{attacker:attacker.slot,defender:d.slot,label:'Beam',hits:[b.roll],onResolve:finalize}))return;
  finalize(null);
}
function startClash(room){
  const b=room.beamPending;
  if(!b)return {error:'No incoming Beam.'};
  const defender=room.players[b.defender],attacker=room.players[b.attacker];
  if((defender.beamCooldown>0&&!defender.beamCooldownBypass) || !['ready','charging'].includes(defender.beamCharge))return {error:'Counter-Beam is not available.'};

  defender.beamCharge='none';
  const profile=offence(defender,attacker,20),r=rollShown(room,profile.sides,'Counter-Beam roll'),itemDie=consumeMagicDice(room,defender),crit=r===profile.sides,critBonus=crit?1:0,momBonus=momentumBonus(defender),deathRayBonus=Math.max(0,Number(defender.deathRayBeamBonus)||0),counterTotal=6+r+profile.bonus+itemDie+critBonus+momBonus+deathRayBonus;
  defender.deathRayBeamBonus=0;defender.beamCooldownBypass=false;
  addMomentum(defender,18);
  defender.beamCooldown=2;

  const p1Roll=b.attacker===0?b.roll:counterTotal;
  const p2Roll=b.attacker===1?b.roll:counterTotal;
  const clicks=Math.floor(Math.abs(p1Roll-p2Roll)/5);
  let p1=0,p2=0;
  if(p1Roll>p2Roll)p1=clicks; else if(p2Roll>p1Roll)p2=clicks;

  const id=crypto.randomBytes(6).toString('hex');
  const startsAt=Date.now()+5000;
  const endsAt=startsAt+5000;
  room.clash={id,attacker:b.attacker,defender:b.defender,p1Roll,p2Roll,p1,p2,startsAt,endsAt,forceFull:!!b.forceFull};
  room.phase='clashCountdown';
  logRoom(room, `⚡ Beam Clash incoming! P1 Beam ${p1Roll} vs P2 Beam ${p2Roll}. Get ready — clash starts in 5 seconds.`, 'special');
  emitState(room);

  scheduleGameTimer(()=>{
    const live=rooms.get(room.code);
    if(!live || !live.clash || live.clash.id!==id || live.phase!=='clashCountdown')return;
    live.phase='clash';
    logRoom(live,'⚡ BEAM CLASH — GO!','special');
    emitState(live);

    scheduleGameTimer(()=>{
      const stillLive=rooms.get(room.code);
      if(stillLive && stillLive.clash && stillLive.clash.id===id && stillLive.phase==='clash'){
        resolveClash(stillLive);
      }
    },5050);
  },5000);

  return {ok:true};
}
function resolveClash(room){
  const c=room.clash;if(!c)return;
  room.clash=null;room.beamPending=null;room.phase='turn';
  if(c.p1===c.p2){
    logRoom(room,`⚡ Beam Clash ties ${c.p1}-${c.p2}; both Beams cancel.`,'special');
    room.current=c.attacker;
    finishAction(room,!!c.forceFull,true);
    return;
  }

  const winner=c.p1>c.p2?0:1,loser=1-winner,raw=winner===0?c.p1Roll:c.p2Roll;
  const a=room.players[winner],d=room.players[loser];

  const finalize=(parryResults=null)=>{
    const attempted=Array.isArray(parryResults);
    if(attempted&&parryResults[0]){
      logRoom(room,`🗡️ ${d.name} PARRIES the winning Beam Clash blast from ${a.name}!`,'special');
      emitDefenceFx(room,{slot:d.slot,label:'PARRY CLASH!',amount:0,perfect:true});
      emitCombatFx(room,{kind:'parry',attacker:winner,defender:loser,damage:0,blocked:0,dodged:true,critical:true,label:'PARRY CLASH!'});
    }else{
      const res=absorbAttack(room,d,raw,a);
      const damage=res.damage+(attempted?1:0);
      hurtFighter(room,d,damage);
      reflectSeduced(room,a,damage,'Beam Clash hit');
      if(attempted)logRoom(room,`💢 ${d.name} misses the Beam Clash Parry and takes +1 extra damage.`,'bad');
      if(res.confusedMiss)logRoom(room,`🥸 ${a.name} is Confused and the winning Beam Clash blast misses ${d.name}.`,'special');
      else if(res.kingBypass)logRoom(room,`👑 ${a.name}'s King of Curses makes the winning Beam ignore ${d.name}'s defensive protection and deal ${damage} damage.`,'special');
      else if(res.umbrellaDodge)logRoom(room,`☂️ ${d.name} dodges the winning Beam Clash hit${attempted?' but still takes 1 missed-Parry damage':''}!`,'special');
      else if(res.sixEyes)logRoom(room,`👁️ ${d.name}'s Six Eyes blocks the winning Beam Clash hit${attempted?' but missed Parry damage still deals 1':''}!`,'special');
      else logRoom(room,`⚡ ${a.name} wins the Beam Clash ${c.p1}-${c.p2} and deals ${damage} damage.`,'special');
      if(res.blocked>0)emitDefenceFx(room,{slot:d.slot,label:`BLOCK ${res.blocked}`,amount:res.blocked});
      emitCombatFx(room,{kind:'beam-clash-hit',attacker:winner,defender:loser,damage,blocked:res.blocked||0,dodged:!!(res.umbrellaDodge||res.sixEyes),critical:false,label:'CLASH HIT!'});
      interruptDomainCharge(room,d,damage);
      if(checkWinner(room)){emitState(room);return;}
    }
    room.current=c.attacker;
    finishAction(room,!!c.forceFull,true);
  };

  if(a.confusedMissTurns<=0&&maybeStartParry(room,{attacker:winner,defender:loser,label:'Beam Clash hit',hits:[raw],onResolve:finalize}))return;
  finalize(null);
}
io.on('connection', socket => {
  socket.on('rhythm-clock',(_data,ack)=>{if(typeof ack==='function')ack({serverTime:Date.now()});});
  socket.on('create-room', (_data, ack)=>{
    if(!canCreateRoom(socket,ack))return;
    const code=makeCode(),token=makeToken(),room=makeRoom(code);
    room.players[0]=newPlayer(0,token,socket.id);
    rooms.set(code,room);
    socket.join(code);
    socket.data={roomCode:code,slot:0,token};
    logRoom(room,'Room created. Waiting for Player 2.','info');
    ok(ack,{code,slot:0,token,state:publicRoom(room)});
    emitState(room);
  });


  socket.on('create-bot-room',(data,ack)=>{
    if(!canCreateRoom(socket,ack))return;
    const code=makeCode(),token=makeToken(),room=makeRoom(code);
    if(data?.mode==='circuit')room.circuitIndex=0;
    const rival=circuitRival(room);
    const botHp=rival?.hp??clamp(Number(data?.botHp)||75,50,100);
    const rawSpecial=String(rival?.special||data?.botSpecial||'standard');
    const botSpecial=(Object.prototype.hasOwnProperty.call(SPECIALS,rawSpecial)||rawSpecial==='random')?rawSpecial:'standard';
    room.botMode=true;room.botSlot=1;
    room.players[0]=newPlayer(0,token,socket.id);
    const bot=newPlayer(1,`BOT-${makeToken()}`,null);
    bot.isBot=true;bot.connected=true;bot.ready=true;
    bot.setup={name:rival?.name||'CPU Challenger',hpMode:'fixed',hp:botHp,special:botSpecial};
    bot.name=bot.setup.name;bot.hp=botHp;bot.maxHp=botHp;
    room.players[1]=bot;
    rooms.set(code,room);
    socket.join(code);socket.data={roomCode:code,slot:0,token};
    logRoom(room,`🤖 Solo match created. ${bot.name} is locked in with ${botHp} HP and ${SPECIALS[botSpecial]?.name||'Random Special'}.`,'info');
    ok(ack,{code,slot:0,token,state:publicRoom(room)});
    emitState(room);
  });

  socket.on('join-room', (data,ack)=>{
    if(!canEnterRoom(socket,ack))return;
    const code=clean(data?.code,8).toUpperCase(),room=rooms.get(code);
    if(!room)return fail(ack,'Room not found.');
    if(room.status!=='lobby')return fail(ack,'This match has already started. Use reconnect if this is your room.');
    if(room.players[1])return fail(ack,'Room is full.');
    const token=makeToken();
    room.duelScore=[0,0];
    room.players[1]=newPlayer(1,token,socket.id);
    socket.join(code);socket.data={roomCode:code,slot:1,token};
    logRoom(room,'Player 2 joined the room.','info');
    ok(ack,{code,slot:1,token,state:publicRoom(room)});
    emitState(room);
  });

  socket.on('resume-room',(data,ack)=>{
    const existing=getRoomForSocket(socket);
    if(existing && existing.code!==clean(data?.code,8).toUpperCase())return fail(ack,'Leave your current room before reconnecting to another.');
    const code=clean(data?.code,8).toUpperCase(),token=String(data?.token||''),room=rooms.get(code);
    if(!room)return fail(ack,'Room no longer exists (the server may have restarted).');
    const slot=room.players.findIndex(p=>p&&p.token===token);
    if(slot<0)return fail(ack,'Reconnect token was not accepted.');
    const p=room.players[slot];
    if(p.socketId && p.socketId!==socket.id){
      const old=io.sockets.sockets.get(p.socketId);
      if(old)old.disconnect(true);
    }
    p.socketId=socket.id;p.connected=true;p.disconnectedAt=null;
    socket.join(code);socket.data={roomCode:code,slot,token};
    logRoom(room,`${p.name||`Player ${slot+1}`} reconnected.`,'info');
    ok(ack,{code,slot,token,state:publicRoom(room)});
    emitState(room);
  });


  socket.on('room-options',(data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    if(room.status!=='lobby')return fail(ack,'Room options can only be changed in the lobby.');
    if(socket.data.slot!==0)return fail(ack,'Only Player 1 can change room options.');
    if(typeof data?.funnyBusiness==='boolean')room.funnyBusiness=data.funnyBusiness;
    if(typeof data?.infiniteUltimates==='boolean')room.infiniteUltimates=data.infiniteUltimates;
    logRoom(room,`🎭 Funny Business ${room.funnyBusiness?'ON':'OFF'}.`,'info');
    logRoom(room,`♾️ Infinite Ultimates ${room.infiniteUltimates?'ON':'OFF'}.`,'info');
    ok(ack,{funnyBusiness:room.funnyBusiness,infiniteUltimates:room.infiniteUltimates});
    emitState(room);
  });

  socket.on('player-setup',(data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    if(room.status!=='lobby')return fail(ack,'Setup is locked after the battle starts.');
    const p=room.players[socket.data.slot];
    const name=clean(data?.name,32);
    if(!name)return fail(ack,'Enter a champion name.');
    const hpMode=data?.hpMode==='roll'?'roll':'fixed';
    const hp=clamp(Number(data?.hp)||75,50,100);
    const special=Object.prototype.hasOwnProperty.call(SPECIALS,data?.special)||data?.special==='random'?data.special:'standard';
    p.setup={name,hpMode,hp,special};p.ready=true;
    logRoom(room,`${name} is locked in for Player ${p.slot+1}.`,'good');
    ok(ack);emitState(room);
  });

  socket.on('start-game',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    if(socket.data.slot!==0)return fail(ack,'Only Player 1 can start the match.');
    if(room.status!=='lobby')return fail(ack,'The match already started.');
    if(!room.players[0]?.ready||!room.players[1]?.ready)return fail(ack,'Both players must lock in first.');
    room.players.forEach(p=>resetBattlePlayer(p,room));
    room.status='playing';room.phase='turn';room.winner=null;room.endedBy=null;room.current=rollShown(room,2,'Initiative')-1;
    room.domain=null;room.domainClash=null;room.worldCutSlash=null;room.realityManipulation=null;room.anvilTiming=null;room.gamblerGame=null;room.roulette=null;room.judasMini=null;
    room.logs=[];room.eventSeq=0;
    logRoom(room,`🎲 50/50 initiative: ${room.players[room.current].name} goes first.`,'special');
    logRoom(room,`⭐ Specials: ${room.players[0].name} — ${SPECIALS[room.players[0].special].name}; ${room.players[1].name} — ${SPECIALS[room.players[1].special].name}.`,'info');
    ok(ack);startTurn(room);
  });


  socket.on('leave-room',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    const slot=socket.data.slot,code=room.code;
    socket.leave(code);

    // Player 2 may freely leave a waiting lobby without destroying Player 1's room.
    if(room.status==='lobby' && slot===1){
      room.players[1]=null;room.duelScore=[0,0];
      socket.data={};
      logRoom(room,'Player 2 left the room. Waiting for another player.','info');
      ok(ack,{closed:false});
      emitState(room);
      return;
    }

    // The host closing the room, or anyone leaving after a match has started,
    // closes the shared room so nobody is left in a broken match.
    socket.data={};
    io.to(code).emit('room-closed',{message:'The room was closed. You can create or join another room.'});
    disposeRoom(room);
    ok(ack,{closed:true});
  });


  // Voluntary surrender awards a normal win. Disconnects never do so automatically.
  socket.on('surrender',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    if(room.status!=='playing')return fail(ack,'There is no active battle to surrender.');
    const loser=socket.data.slot;
    room.status='finished';room.phase='finished';room.winner=1-loser;room.endedBy=null;
    room.pendingAction=null;room.beamPending=null;room.clash=null;room.attackTiming=null;room.parryPending=null;
    room.hotPotato=null;room.danceBattle=null;room.moonWalk=null;room.beatIt=null;room.gloveMini=null;room.mambaTarget=null;room.presentationMini=null;
    room.deathRayGame=null;room.decoyPending=null;room.hollowPurple=null;room.domainClash=null;room.worldCutSlash=null;
    room.realityManipulation=null;room.anvilTiming=null;
    logRoom(room,`🏳️ ${room.players[loser].name} surrendered. ${room.players[1-loser].name} wins!`,'special');
    ok(ack);emitState(room);
  });

  // Give a disconnected player 90 seconds to resume before an opponent can claim a win.
  socket.on('claim-victory',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    if(room.status!=='playing'||room.botMode)return fail(ack,'No abandoned online battle to claim.');
    const opponent=room.players[1-socket.data.slot];
    if(!opponent||opponent.connected||!opponent.disconnectedAt)return fail(ack,'The opponent is connected.');
    const remaining=DISCONNECT_FORFEIT_MS-(Date.now()-opponent.disconnectedAt);
    if(remaining>0)return fail(ack,`Give your opponent ${Math.ceil(remaining/1000)} more seconds to reconnect.`);
    room.status='finished';room.phase='finished';room.winner=socket.data.slot;room.endedBy=null;
    room.pendingAction=null;room.beamPending=null;room.clash=null;room.attackTiming=null;room.parryPending=null;
    room.hotPotato=null;room.danceBattle=null;room.moonWalk=null;room.beatIt=null;room.gloveMini=null;room.mambaTarget=null;room.presentationMini=null;
    room.deathRayGame=null;room.decoyPending=null;room.hollowPurple=null;room.domainClash=null;room.worldCutSlash=null;
    room.realityManipulation=null;room.anvilTiming=null;
    logRoom(room,`🏆 ${room.players[socket.data.slot].name} won by disconnection forfeit.`,'special');
    ok(ack);emitState(room);
  });

  socket.on('end-battle',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    if(room.status!=='playing')return fail(ack,'There is no active battle to end.');

    room.status='finished';
    room.phase='finished';
    room.winner=null;
    room.endedBy=socket.data.slot;
    room.pendingAction=null;
    room.beamPending=null;
    room.clash=null;
    room.attackTiming=null;
    room.parryPending=null;
    room.hotPotato=null;
    room.danceBattle=null;
    room.moonWalk=null;
    room.beatIt=null;
    room.mambaTarget=null;room.presentationMini=null;
    room.deathRayGame=null;
    room.decoyPending=null;
    room.hollowPurple=null;
    room.domain=null;
    room.domainClash=null;room.worldCutSlash=null;room.realityManipulation=null;room.anvilTiming=null;

    logRoom(room,`🛑 ${room.players[socket.data.slot].name} ended the battle early.`,'info');
    ok(ack);
    emitState(room);
  });

  socket.on('rematch',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    if(socket.data.slot!==0)return fail(ack,'Only Player 1 can start the rematch.');
    if(room.status!=='finished')return fail(ack,'The battle is not finished yet.');
    if(!room.players[0]?.connected||!room.players[1]?.connected)return fail(ack,'Both players must be connected for a rematch.');

    if(!room.botMode)room.duelScore=duelScore(room);
    const snapshots=room.players.map(p=>({name:p.name,maxHp:p.maxHp,special:p.special}));
    if(circuitRival(room)){
      if(room.winner===0)room.circuitIndex=(room.circuitIndex+1)%CIRCUIT.length;
      const rival=circuitRival(room);
      room.players[1].setup={name:rival.name,hpMode:'fixed',hp:rival.hp,special:rival.special};
      snapshots[1]={name:rival.name,maxHp:rival.hp,special:rival.special};
    }
    room.players.forEach((p,i)=>resetBattlePlayerExact(p,snapshots[i]));
    room.status='playing';room.phase='turn';room.winner=null;room.endedBy=null;room.current=rollShown(room,2,'Initiative')-1;
    room.pendingAction=null;room.beamPending=null;room.clash=null;room.attackTiming=null;room.parryPending=null;room.hotPotato=null;room.danceBattle=null;room.moonWalk=null;room.beatIt=null;room.gloveMini=null;room.mambaTarget=null;room.presentationMini=null;room.deathRayGame=null;room.decoyPending=null;room.domain=null;room.domainClash=null;room.worldCutSlash=null;room.realityManipulation=null;room.anvilTiming=null;room.worldCutSlash=null;
    room.roulette=null;room.judasMini=null;room.domainOffer=null;room.gamblerGame=null;room.logs=[];room.eventSeq=0;
    logRoom(room,`${circuitRival(room)?'Rival Circuit · Stage '+(room.circuitIndex+1):'🔁 Rematch! Same champions, fresh battle.'} ${room.players[room.current].name} wins the 50/50 initiative.`,'special');
    ok(ack);startTurn(room);
  });

  socket.on('return-lobby',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    if(socket.data.slot!==0)return fail(ack,'Only Player 1 can return the room to champion select.');
    if(room.status!=='finished')return fail(ack,'The battle is not finished yet.');
    if(!room.botMode)room.duelScore=duelScore(room);
    prepareLobbyFromCurrent(room);
    room.logs=[];room.eventSeq=0;
    logRoom(room,room.botMode?'Back to champion select. The CPU remains locked in; choose your champion and start again.':'Back to champion select. Both players can choose and lock in again.','info');
    ok(ack);emitState(room);
  });


  socket.on('domain-charge-step',(_data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='domainChargeTurn')return fail(ack,'You are not on a Domain charge turn.');
    if(room.current!==socket.data.slot)return fail(ack,'It is not your turn.');
    const r=completeDomainChargeTurn(room);
    if(r.error)return fail(ack,r.error);
    ok(ack);
  });

  socket.on('domain-response',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='domainResponse')return fail(ack,'No Domain response is active.');
    const r=resolveDomainOffer(room,socket.data.slot,String(data?.choice||''));
    if(r.error)return fail(ack,r.error);ok(ack);
  });

  socket.on('domain-clash-press',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='domainClash'||!room.domainClash)return fail(ack,'No active Domain Clash.');
    const n=Number(data?.number);
    if(![1,2,3,4].includes(n))return fail(ack,'Press 1, 2, 3, or 4.');
    const slot=socket.data.slot,dc=room.domainClash;
    if(Date.now()<dc.startsAt)return fail(ack,'Wait for the countdown.');
    if(Date.now()>=dc.endsAt)return fail(ack,'The Domain Clash is over.');

    const expected=dc.sequence[dc.progress[slot]];
    if(n===expected)dc.progress[slot]++;
    io.to(room.code).emit('domain-clash-update',{
      id:dc.id,
      progress:[...dc.progress],
      target:dc.sequence.length,
      currentPrompt:[
        dc.sequence[dc.progress[0]] ?? null,
        dc.sequence[dc.progress[1]] ?? null
      ]
    });

    if(dc.progress[slot]>=dc.sequence.length){
      ok(ack,{correct:true,finished:true});
      resolveDomainClash(room,slot);
      return;
    }
    ok(ack,{correct:n===expected,finished:false});
  });

  socket.on('attack-timing-start',(data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const style=String(data?.style||'normal');
    if(!['normal','heavy','charged'].includes(style))return fail(ack,'Unknown Attack style.');
    const p=room.players[room.current],d=room.players[1-room.current];
    const buttonError=battleButtonGuard(p,style==='charged'?'Charge':'Attack');
    if(buttonError)return fail(ack,buttonError);
    if(style==='charged'&&p.charge!=='ready')return fail(ack,'No stored Energy Charge.');
    if(style==='heavy'&&p.heavyCooldown>0)return fail(ack,`Heavy Attack is on cooldown for ${p.heavyCooldown} more turn(s).`);

    if(style==='heavy')p.heavyCooldown=2;
    markBattleButton(p,style==='charged'?'Charge':'Attack',room);

    const begin=()=>{
      const id=crypto.randomBytes(6).toString('hex');
      room.attackTiming={id,slot:room.current,style,startedAt:Date.now()};
      room.phase='attackTiming';
      ok(ack,{id,style,bars:style==='heavy'?4:1});
      emitState(room);
      scheduleGameTimer(()=>{
        const live=rooms.get(room.code);
        if(!live?.attackTiming||live.attackTiming.id!==id||live.phase!=='attackTiming')return;
        const bars=style==='heavy'?4:1;
        logRoom(live,`⏱️ ${live.players[live.current].name} runs out of time on ${style==='heavy'?'Heavy':'Strike'} Timing.`, 'bad');
        const grades=Array.from({length:bars},()=> 'bad');
        live.attackTiming=null;live.phase='turn';
        resolveTimingAttack(live,style,grades);
      },12000);
    };

    if(maybeStartDecoy(room,{
      attacker:p.slot,defender:d.slot,label:style==='heavy'?'Heavy Attack':style==='charged'?'Charged Attack':'Normal Attack',
      onSuccess:begin,
      onMiss:()=>{
        if(style==='charged')p.charge='none';
        const mom=addMomentum(p,8);
        ok(ack,{decoyMiss:true});
        logRoom(room,`🎭 ${p.name}'s ${style} Attack hits a Decoy. Momentum ${mom.before}% → ${mom.after}%.`,'special');
        finishAction(room,false,true);
      }
    }))return;

    begin();
  });

  socket.on('attack-timing-resolve',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='attackTiming'||!room.attackTiming)return fail(ack,'No Strike Timing attack is waiting.');
    if(room.attackTiming.slot!==socket.data.slot||room.current!==socket.data.slot)return fail(ack,'That timing attack belongs to the other player.');
    if(String(data?.id)!==room.attackTiming.id)return fail(ack,'That Strike Timing session is no longer active.');
    const style=room.attackTiming.style,grades=Array.isArray(data?.grades)?data.grades.map(timingGradeValue):[];
    if(grades.length!==((style==='heavy'||style==='bite87')?4:1))return fail(ack,'Invalid timing results.');
    room.attackTiming=null;room.phase='turn';
    const r=resolveTimingAttack(room,style,grades);
    if(r.error)return fail(ack,r.error);
    ok(ack);
  });

  socket.on('defensive-stance',(_data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current],err=battleButtonGuard(p,'Defence');if(err)return fail(ack,err);
    const r=doDefensiveStance(room);if(r.error)return fail(ack,r.error);
    ok(ack);
  });

  socket.on('defend',(_data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current],buttonError=battleButtonGuard(p,'Defence');
    if(buttonError)return fail(ack,buttonError);
    markBattleButton(p,'Defence',room);
    const r=doDefend(room,6,false);if(r.error)return fail(ack,r.error);ok(ack);
  });





  socket.on('presentation-hit',(data,ack)=>{
    const room=getRoomForSocket(socket),g=room?.presentationMini;
    if(!g||room.phase!=='presentationMini'||g.kind!=='targeting'||g.slot!==socket.data.slot)return fail(ack,'No Targeting Systems minigame is active.');
    const now=Date.now(),index=Number(data?.index);
    if(now<g.startedAt||now>=g.deadline)return fail(ack,'Targeting time has expired.');
    if(!Number.isInteger(index)||index!==g.hits||!g.targets[index]||g.targets[index].hit)return fail(ack,'Wrong target.');
    if(now-g.lastHitAt<115)return fail(ack,'Target lock needs a moment to acquire.');
    g.lastHitAt=now;g.targets[index].hit=true;g.hits++;
    ok(ack,{hits:g.hits});emitState(room);
  });
  socket.on('presentation-ship',(data,ack)=>{
    const room=getRoomForSocket(socket),g=room?.presentationMini;
    if(!g||room.phase!=='presentationMini'||g.kind!=='turret'||g.slot!==socket.data.slot)return fail(ack,'No Electricity Turret minigame is active.');
    const now=Date.now();if(now<g.startedAt||now>=g.deadline)return fail(ack,'Turret time expired.');
    const x=Number(data?.x),y=Number(data?.y);
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<4||x>96||y<50||y>96)return fail(ack,'Invalid ship position.');
    const maxMove=(now-g.lastShipAt)*.095+8;
    const dist=Math.hypot(x-g.shipX,y-g.shipY);
    if(dist>maxMove)return fail(ack,'Ship moved too far too fast.');
    g.shipX=x;g.shipY=y;g.lastShipAt=now;ok(ack,{x,y});
  });
  socket.on('presentation-shoot',(data,ack)=>{
    const room=getRoomForSocket(socket),g=room?.presentationMini;
    if(!g||room.phase!=='presentationMini'||g.kind!=='turret'||g.slot!==socket.data.slot)return fail(ack,'No Electricity Turret minigame is active.');
    const now=Date.now(),elapsed=now-g.startedAt;
    if(elapsed<0||now>=g.deadline)return fail(ack,'Turret time expired.');
    if(now-g.lastHitAt<190)return fail(ack,'Turret is reloading.');
    if(g.shotsFired>=15)return fail(ack,'No bullets remaining (15/15 used).');
    g.lastHitAt=now;g.shotsFired++;
    // Only server-known invaders that have spawned and have not passed the player may be shot.
    const target=g.targets.find(t=>!t.hit&&elapsed>=t.spawn&&Math.abs(g.shipX-t.x)<=4&&(5+(elapsed-t.spawn)*.020)<g.shipY&&(5+(elapsed-t.spawn)*.020)>-5);
    if(target){target.hit=true;g.hits++;}
    ok(ack,{hit:!!target,hits:g.hits,shotsFired:g.shotsFired,shotsRemaining:15-g.shotsFired});
    // No waiting on an empty magazine: the round resolves on the final shot.
    if(g.hits===15||g.shotsFired===15){finishPresentationMini(room);return;}
    emitState(room);
  });

  socket.on('mamba-strike',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='mambaTarget'||!room.mambaTarget)return fail(ack,'No Black Mamba target is active.');
    const mt=room.mambaTarget,slot=socket.data.slot;
    if(slot!==mt.slot)return fail(ack,'That Black Mamba target belongs to the other player.');
    const elapsed=Math.max(0,Date.now()-mt.startedAt);
    const phase=(elapsed%mt.cycleMs)/mt.cycleMs;
    const damage=mambaStrikeDamage(phase);
    room.mambaTarget=null;room.phase='turn';room.current=slot;
    ok(ack,{damage,phase});
    resolveMambaStrike(room,slot,damage,phase);
  });


  socket.on('decoy-choice',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='decoyChoice'||!room.decoyPending)return fail(ack,'No Decoy choice is waiting.');
    const dc=room.decoyPending;
    if(dc.attacker!==socket.data.slot)return fail(ack,'Only the attacker can choose a Decoy target.');
    const index=Number(data?.index);
    if(!Number.isInteger(index)||index<0||index>=dc.choices)return fail(ack,'Invalid Decoy target.');
    const correct=index===dc.realIndex;
    ok(ack,{correct});
    resolveDecoyChoice(room,index);
  });


  socket.on('ultimate',(_data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current],buttonError=battleButtonGuard(p,'Ultimate');
    if(buttonError)return fail(ack,buttonError);
    if(p.special==='glovedone'){if((p.gloveHype||0)<50)return fail(ack,'The Final Show needs 50 Crowd Hype.');p.gloveHype-=50;p.momentum=p.gloveHype;if(p.thrillerNightActive)p.thrillerNightTurns++;else p.finalShowBonus++;logRoom(room,`🌟 THE FINAL SHOW! Thriller Night gains one extra personal turn.`,'special');markBattleButton(p,'Ultimate',room);ok(ack,{ok:true});finishAction(room,false);return;}
    const r=startUltimate(room,p);if(r.error)return fail(ack,r.error);
    markBattleButton(p,'Ultimate',room);
    ok(ack,r);
    emitState(room);
  });

  socket.on('reality-manipulation-choice',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='ultimateRealityManipulation'||!room.realityManipulation)return fail(ack,'Reality Manipulation is not active.');
    if(room.realityManipulation.slot!==socket.data.slot)return fail(ack,'Only the Ultimate user can rewrite reality.');
    const p=room.players[socket.data.slot];
    const r=beginRealityContest(room,p,String(data?.choice||''),data?.value);
    if(r.error)return fail(ack,r.error);ok(ack,r);
  });

  socket.on('reality-clash-pulse',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room||room.status!=='playing')return fail(ack,'No active battle.');
    const r=pressRealityPulse(room,socket.data.slot);if(r.error)return fail(ack,r.error);ok(ack,r);
  });

  socket.on('anvil-timing',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='anvilTiming'||!room.anvilTiming)return fail(ack,'No Anvil timing challenge is active.');
    const at=room.anvilTiming;if(at.slot!==socket.data.slot)return fail(ack,'That Anvil belongs to the other player.');
    const pos=clamp(Number(data?.position)||0,0,100),dist=Math.abs(pos-50);
    const grade=dist<=2?'perfect':dist<=11?'good':'bad';
    ok(ack,{grade});resolveAnvilTiming(room,at.id,grade);
  });

  socket.on('world-slash-skip',(_data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='ultimateWorldCuttingSlash'||!room.worldCutSlash)return fail(ack,'World Cutting Slash is not active.');
    if(room.worldCutSlash.slot!==socket.data.slot)return fail(ack,'Only the player who used World Cutting Slash can skip it.');
    if(room.worldCutSlash.stage!=='chant')return fail(ack,'The chant has already finished.');
    const id=room.worldCutSlash.id;
    logRoom(room,`⏭️ ${room.players[socket.data.slot].name} skips the chant for both players and jumps to World Slash timing.`,'info');
    ok(ack);
    beginWorldSlashTiming(room,id);
  });

  socket.on('world-slash-timing',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='ultimateWorldCuttingSlash'||!room.worldCutSlash)return fail(ack,'World Cutting Slash is not active.');
    const ws=room.worldCutSlash;
    if(ws.slot!==socket.data.slot)return fail(ack,'Only the Ultimate user can time the slash.');
    if(ws.stage!=='timing')return fail(ack,'The World Slash timing bar is not active.');
    const pos=clamp(Number(data?.position)||0,0,100),dist=Math.abs(pos-50);
    const grade=dist<=2?'perfect':dist<=11?'good':'bad';
    ok(ack,{grade});
    beginWorldSlashStrike(room,ws.id,grade);
  });

  socket.on('hollow-purple-mash',(_data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='ultimateHollowPurple'||!room.hollowPurple)return fail(ack,'Hollow Purple is not charging.');
    const hp=room.hollowPurple,slot=socket.data.slot;
    if(slot!==hp.slot)return fail(ack,'Only the Ultimate user can charge Hollow Purple.');
    updateHollowPurpleDecay(hp);

    let orb=hp.nextOrb;
    if(orb==='red'&&hp.redLocked)orb='blue';
    if(orb==='blue'&&hp.blueLocked)orb='red';

    if(orb==='red'&&!hp.redLocked){
      hp.red=Math.min(100,hp.red+10);
      if(hp.red>=100){hp.red=100;hp.redLocked=true;logRoom(room,'🔴 Max Red is fully charged and LOCKED!','good');}
      hp.nextOrb='blue';
    }else if(orb==='blue'&&!hp.blueLocked){
      hp.blue=Math.min(100,hp.blue+10);
      if(hp.blue>=100){hp.blue=100;hp.blueLocked=true;logRoom(room,'🔵 Max Blue is fully charged and LOCKED!','good');}
      hp.nextOrb='red';
    }

    hp.lastUpdate=Date.now();
    ok(ack,{red:hp.red,blue:hp.blue,redLocked:hp.redLocked,blueLocked:hp.blueLocked});
    if(hp.redLocked&&hp.blueLocked){beginHollowPurpleCinematic(room);return;}
    emitState(room);
  });

  socket.on('death-ray-hit',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='deathRayGame'||!room.deathRayGame)return fail(ack,'No Death Ray calibration is active.');
    const dr=room.deathRayGame,slot=socket.data.slot;
    if(slot!==dr.slot)return fail(ack,'That Death Ray calibration belongs to the other player.');
    if(Date.now()<dr.startedAt)return fail(ack,'Death Ray is still getting ready.');
    const angle=normalizeAngle(Number(data?.angle));
    const edgeTolerance=dr.width*.10;
    const success=angleDistance(angle,dr.center)<=dr.width/2+edgeTolerance;
    if(!success){
      ok(ack,{success:false,hits:dr.hits});
      finishDeathRayGame(room,'misses the green bar');
      return;
    }

    dr.hits++;
    const p=room.players[slot];
    p.deathRayBeamBonus=(p.deathRayBeamBonus||0)+1;
    logRoom(room,`☄️ Death Ray HIT ${dr.hits}/5! Next Beam bonus is now +${p.deathRayBeamBonus}.`,'good');

    if(dr.hits>=5){
      ok(ack,{success:true,hits:5,perfect:true});
      finishDeathRayGame(room,'is completed');
      return;
    }

    dr.direction*=-1;
    dr.startAngle=angle;
    dr.startedAt=Date.now()+220;
    dr.center=chooseDeathRayCenter(angle);
    dr.width=Math.max(2.5,dr.width/2);
    ok(ack,{success:true,hits:dr.hits});
    emitState(room);
  });

  socket.on('companion-skip',(_data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='companionOnly'||room.current!==socket.data.slot)return fail(ack,'There is no Companion-only window to skip.');
    ok(ack);
    fullEndTurn(room);
  });

  socket.on('glove-mini-input',(data,ack)=>{const room=getRoomForSocket(socket);if(!room||room.status!=='playing')return fail(ack,'No battle.');const r=gloveMiniInput(room,socket.data.slot,data);if(r.error)return fail(ack,r.error);ok(ack,r);});
  socket.on('moonwalk-hit',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='moonWalk'||!room.moonWalk)return fail(ack,'No Moon Walk is active.');
    const mw=room.moonWalk,slot=socket.data.slot;
    if(slot!==mw.slot)return fail(ack,'That Moon Walk belongs to the other player.');
    const note=mw.notes[mw.index];if(!note)return fail(ack,'No Moon Walk note is waiting.');
    const dir=Number(data?.dir),now=Date.now();
    if(Number.isInteger(data?.index)&&data.index!==idx)return fail(ack,'Note already judged.');
    const pressedAt=boundedRhythmPressTime(data?.clientTime,now);
    if(pressedAt<rhythmTargetTime(note)-note.window)return ok(ack,{hit:false,early:true});
    if(pressedAt>rhythmTargetTime(note)+note.window)return ok(ack,{hit:false,late:true});
    const hit=dir===note.dir&&rhythmNoteHit(note,pressedAt);
    if(hit){mw.hits++;logRoom(room,`🕺 ${room.players[slot].name} hits Moon Walk note ${mw.index+1}.`,'good');}
    else {mw.misses++;logRoom(room,`🕺 ${room.players[slot].name} misses Moon Walk note ${mw.index+1}.`,'bad');}
    mw.index++;
    ok(ack,{hit,hits:mw.hits,misses:mw.misses});
    if(mw.index>=5){finishMoonWalk(room);return;}
    emitState(room);
  });

  socket.on('beat-it-key',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='beatIt'||!room.beatIt)return fail(ack,'No Beat It challenge is active.');
    const bi=room.beatIt,slot=socket.data.slot;
    if(slot!==bi.slot)return fail(ack,'Beat It belongs to the other player.');
    if(Date.now()<bi.startsAt)return fail(ack,'Beat It is still in the READY countdown.');
    if(Date.now()>bi.deadline){finishBeatIt(room);return fail(ack,'Time is up.');}
    const key=String(data?.key||'').toUpperCase().slice(0,1);
    const expected=bi.sequence[bi.index];
    if(key!==expected)return ok(ack,{correct:false,index:bi.index,currentLetter:expected});
    bi.index++;bi.hits++;
    if(bi.index>=5){ok(ack,{correct:true,index:5,done:true});finishBeatIt(room);return;}
    ok(ack,{correct:true,index:bi.index,currentLetter:bi.sequence[bi.index]});
    emitState(room);
  });

  socket.on('dance-hit',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='danceBattle'||!room.danceBattle)return fail(ack,'No Dance Battle is active.');
    const db=room.danceBattle,slot=socket.data.slot;
    if(slot!==0&&slot!==1)return fail(ack,'Invalid dancer.');
    const idx=db.index[slot],note=db.notes[idx];
    if(!note)return fail(ack,'No note is waiting.');
    const dir=Number(data?.dir),now=Date.now();
    if(Number.isInteger(data?.index)&&data.index!==idx)return fail(ack,'Note already judged.');
    const pressedAt=boundedRhythmPressTime(data?.clientTime,now);
    if(pressedAt<rhythmTargetTime(note)-note.window)return ok(ack,{hit:false,early:true});
    if(pressedAt>rhythmTargetTime(note)+note.window)return ok(ack,{hit:false,late:true});
    const hit=dir===note.dir&&rhythmNoteHit(note,pressedAt);
    if(hit){
      db.index[slot]++;
      logRoom(room,`🎵 ${room.players[slot].name} hits note ${idx+1}!`,'good');
    }else{
      applyDanceMiss(room,slot,dir===note.dir?'times a note badly':'hits the wrong arrow');
      db.index[slot]++;
    }
    if(db.misses[slot]>=db.limits[slot]){
      finishDanceBattle(room,slot);
      return ok(ack,{hit,misses:db.limits[slot]});
    }
    ok(ack,{hit,misses:db.misses[slot]});
    emitState(room);
  });

  socket.on('parry',(_data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current],buttonError=battleButtonGuard(p,'Defence');
    if(buttonError)return fail(ack,buttonError);
    const r=doParry(room);if(r.error)return fail(ack,r.error);
    markBattleButton(p,'Defence',room);ok(ack);emitState(room);
  });

  socket.on('parry-resolve',(data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='parryResponse'||!room.parryPending)return fail(ack,'No Parry reaction is waiting.');
    if(room.parryPending.defender!==socket.data.slot)return fail(ack,'That Parry belongs to the other player.');
    if(String(data?.id)!==room.parryPending.id)return fail(ack,'That Parry window is no longer active.');
    const positions=Array.isArray(data?.positions)?data.positions.map(x=>clamp(Number(x)||100,0,100)):[];
    if(positions.length!==room.parryPending.difficulties.length)return fail(ack,'Invalid Parry timing results.');
    ok(ack);
    resolveParryPending(room,positions);
  });

  socket.on('charge',(data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current],buttonError=battleButtonGuard(p,'Charge');
    if(buttonError)return fail(ack,buttonError);
    const choice=String(data?.choice||'auto');
    if(p.beamCharge==='ready'){
      if(choice!=='fire'&&choice!=='auto')return fail(ack,'Choose Fire Beam for your ready Beam.');
      const r=fireBeam(room,false,20);if(r.error)return fail(ack,r.error);
      markBattleButton(p,'Charge',room);ok(ack);emitState(room);return;
    }
    if(choice==='charged')return fail(ack,'Use the Charged Attack timing button.');
    const r=doCharge(room,false,choice);if(r.error)return fail(ack,r.error);
    markBattleButton(p,'Charge',room);ok(ack);emitState(room);
  });

  socket.on('effect',(data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current],buttonError=battleButtonGuard(p,'Effects');
    if(buttonError)return fail(ack,buttonError);
    
    if(p.rocketMoveBlocked===`effect:${String(data?.effect||'')}`)return fail(ack,'🚀 Team Rocket stole this Effect for three turns!');
    const r=doEffect(room,String(data?.effect||''),false);if(r.error)return fail(ack,r.error);
    markBattleButton(p,'Effects',room);ok(ack);emitState(room);
  });

  socket.on('pokemon-choose',(data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'You are not in a room.');
    if(room.status!=='playing'||!['pokemonChoose','turn'].includes(room.phase)||room.current!==socket.data.slot)return fail(ack,'It is not time to choose a Pokémon.');
    const p=room.players[socket.data.slot];if(p.special!=='pokemontrainer')return fail(ack,'This fighter is not a Pokémon Trainer.');
    const r=choosePokemonForTurn(room,p,String(data?.pokemon||''));if(r.error)return fail(ack,r.error);
    ok(ack,{pokemon:p.activePokemon,repeatTax:p.pokemonRepeatTax});
  });

  socket.on('pokemon-center',(data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'You are not in a room.');
    if(room.status!=='playing'||room.current!==socket.data.slot||!['turn','pokemonChoose'].includes(room.phase))return fail(ack,'PokéCenter can only be used on your normal turn or Pokémon selection step.');
    const p=room.players[socket.data.slot];if(p.special!=='pokemontrainer')return fail(ack,'Only Pokémon Trainer can use PokéCenter.');
    const buttonError=battleButtonGuard(p,'Special');if(buttonError)return fail(ack,buttonError);
    const mode=String(data?.mode||'');let r;
    if(mode==='pp')r=pokemonRestoreCenter(room,p,data?.pokemonIds);
    else if(mode==='heal')r=pokemonHealCenter(room,p,String(data?.pokemon||''));
    else return fail(ack,'Choose Heal Pokémon or Recover PP.');
    if(r?.error)return fail(ack,r.error);
    markBattleButton(p,'Special',room);ok(ack,r||{});emitState(room);
  });

  socket.on('pokemon-move',(data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current];if(p.special!=='pokemontrainer')return fail(ack,'Only Pokémon Trainer can use Pokémon moves.');
    const buttonError=battleButtonGuard(p,'Attack');if(buttonError)return fail(ack,buttonError);
    const r=usePokemonMove(room,p,String(data?.move||''));if(r.error)return fail(ack,r.error);
    markBattleButton(p,'Attack',room);ok(ack,r);emitState(room);
  });

  socket.on('judas-convert',(data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current];
    if(!['bluejudas','redjudas'].includes(p.special))return fail(ack,'Only Judas can convert energy.');
    if(data?.direction==='positive-to-cursed'){
      if(p.positiveEnergy<1)return fail(ack,'You need 1 Positive Energy.');
      if(p.cursedEnergy+p.positiveEnergy+1>p.cursedMax)return fail(ack,'Not enough shared energy capacity.');
      p.positiveEnergy--;p.cursedEnergy+=2;
      logRoom(room,`💙💜 ${p.name} trades 1 Positive Energy for 2 Cursed Energy for free.`,'special');
    }else{
      if(!CJ.spend(p,3,0))return fail(ack,'You need 3 Cursed Energy.');
      p.positiveEnergy++;
      logRoom(room,`💜💙 ${p.name} converts 3 Cursed Energy to 1 Positive Energy for free.`, 'special');
    }
    ok(ack);emitState(room);
  });
  socket.on('november-mini',(data,ack)=>{
    const room=getRoomForSocket(socket);if(!room||room.status!=='playing')return fail(ack,'No active battle.');
    const slot=socket.data.slot;let result;
    if(room.phase==='umbrellaMini')result=umbrellaMiniAct(room,slot,Number(data?.direction));
    else if(room.phase==='footworkMini')result=footworkMiniAct(room,slot,Number(data?.tile));
    else return fail(ack,'No minigame is waiting.');
    if(result?.error)return fail(ack,result.error);ok(ack,result);emitState(room);
  });

  socket.on('judas-mini',(data,ack)=>{
    const room=getRoomForSocket(socket);if(!room||room.status!=='playing')return fail(ack,'No active battle.');
    const g=room.judasMini;const r=g&&['dismantle','cleave','fuga'].includes(g.kind)?redJudasMiniAct(room,socket.data.slot,String(data?.action||''),data?.sequence):judasMiniAct(room,socket.data.slot,String(data?.action||''),data?.index);
    if(r.error)return fail(ack,r.error);ok(ack,r);
  });
  socket.on('gambler-roulette',(data,ack)=>{
    const room=getRoomForSocket(socket);if(!room||room.status!=='playing')return fail(ack,'No active match.');
    const r=roulettePlaceBet(room,socket.data.slot,String(data?.kind||''),data?.number);if(r.error)return fail(ack,r.error);ok(ack,r);
  });
  socket.on('gambler-blackjack',(data,ack)=>{
    const room=getRoomForSocket(socket),g=room?.gamblerGame;
    if(!room||room.status!=='playing'||room.phase!=='gamblerBlackjack'||g?.type!=='blackjack'||g.owner!==socket.data.slot)return fail(ack,'No blackjack decision is waiting for you.');
    const r=blackjackAct(room,String(data?.action||''));if(r.error)return fail(ack,r.error);ok(ack,r);
  });
  socket.on('gambler-poker',(data,ack)=>{
    const room=getRoomForSocket(socket),g=room?.gamblerGame;
    if(!room||room.status!=='playing'||room.phase!=='gamblerPoker'||g?.type!=='poker')return fail(ack,'No poker round is active.');
    const r=pokerAct(room,socket.data.slot,String(data?.action||''),data?.amount);if(r.error)return fail(ack,r.error);ok(ack,r);
  });
  socket.on('gambler-coin',(data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current];if(p.special!=='gambler')return fail(ack,'Only The Gambler can toss this coin.');
    const r=gamblerCoin(room,p,String(data?.action||''));if(r.error)return fail(ack,r.error);ok(ack,r);
  });
  socket.on('gambler-slot',(_data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='gamblerSlot'||room.current!==socket.data.slot)return fail(ack,'No Domain slot spin is waiting.');
    const r=spinGamblerDomain(room,room.players[room.current]);if(r.error)return fail(ack,r.error);ok(ack,r);
  });

  socket.on('special',(data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current],buttonError=battleButtonGuard(p,'Special');
    if(buttonError)return fail(ack,buttonError);
    if(p.rocketMoveBlocked&&p.rocketMoveBlocked===String(data?.move||''))return fail(ack,'🚀 Team Rocket has stolen this Special Attack for three turns!');
    const r=doSpecial(room,String(data?.move||''),data||{});if(r.error)return fail(ack,r.error);
    markBattleButton(p,'Special',room);ok(ack,r);emitState(room);
  });

  socket.on('magic-bag-peek',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    const p=room.players[socket.data.slot];
    if(room.status!=='playing'||room.phase!=='magicBagChoice'||room.current!==socket.data.slot||!p.magicBagItem)return fail(ack,'No Magic Bag item is waiting.');
    ok(ack,{item:publicMagicItem(magicItemById(p.magicBagItem))});
  });

  socket.on('magic-bag-resolve',(data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    const p=room.players[socket.data.slot];
    if(room.status!=='playing'||room.phase!=='magicBagChoice'||room.current!==socket.data.slot||!p.magicBagItem)return fail(ack,'No Magic Bag item is waiting.');
    const item=magicItemById(p.magicBagItem);
    p.magicBagItem=null;
    room.phase='turn';
    let itemResult={deferred:false};
    if(data?.use){
      logRoom(room,`👜 ${p.name} chooses to use ${item.name}.`,'special');
      itemResult=useMagicBagItem(room,p,item)||{deferred:false};
    }else{
      logRoom(room,`👜 ${p.name} discards ${item.name}.`,'info');
    }
    if(itemResult.deferred){ok(ack);return;}
    if(checkWinner(room)){ok(ack);emitState(room);return;}
    ok(ack);
    finishAction(room,false);
  });


  socket.on('item-mini-action',(data,ack)=>{
    const room=getRoomForSocket(socket);if(!room||room.status!=='playing'||room.phase!=='itemMini'||!room.itemMini)return fail(ack,'No item challenge is active.');
    const r=resolveItemMini(room,socket.data.slot,data||{});if(r.error)return fail(ack,r.error);ok(ack,r);
  });

  socket.on('shop-list',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room||room.status!=='playing')return fail(ack,'No active battle.');
    ok(ack,{items:shopCatalog(room.players[socket.data.slot])});
  });

  socket.on('shop-buy',(data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current],buttonError=battleButtonGuard(p,'Action');
    if(buttonError)return fail(ack,buttonError);
    const item=magicItemById(String(data?.id||''));
    if(!item||item.shop===false)return fail(ack,'That item cannot be bought from the Shop.');
    if(!p.shopOffers.includes(item.id))return fail(ack,'That item is not in your current four-item shop offer.');
    if(item.id==='nationalflag'&&p.nationalFlagUses>=2)return fail(ack,'National Flag has a limit of two uses per battle.');
    p.shopOffers=[];
    const shopTurns=Math.max(1,Number(item.shopTurns)||1);
    p.inventory.push(item.id);
    if(shopTurns>1)p.shopSkipTurns=Math.max(p.shopSkipTurns||0,shopTurns-1);
    markBattleButton(p,'Action',room);
    logRoom(room,`🛒 ${p.name} buys ${item.name} for ${shopTurns} turn${shopTurns===1?'':'s'}. It is added to My Attack list.`,'special');
    ok(ack,{item:publicMagicItem(item),inventoryCount:p.inventory.length,shopTurns});
    loseMomentumForNonAttack(room,p,'shopping');
    fullEndTurn(room);
  });

  socket.on('inventory-list',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room||room.status!=='playing')return fail(ack,'No active battle.');
    const p=room.players[socket.data.slot];
    ok(ack,{items:(p.inventory||[]).map((id,index)=>({index,item:publicMagicItem(magicItemById(id))})).filter(x=>x.item)});
  });

  socket.on('inventory-use',(data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current],buttonError=battleButtonGuard(p,'Attack');
    if(buttonError)return fail(ack,buttonError);
    const index=Number(data?.index);
    if(!Number.isInteger(index)||index<0||index>=p.inventory.length)return fail(ack,'That stored item is not available.');
    const id=p.inventory[index],item=magicItemById(id);
    if(!item)return fail(ack,'Unknown stored item.');
    p.inventory.splice(index,1);
    const costsTurn=p.special==='greatexception';
    if(costsTurn)markBattleButton(p,'Attack',room);
    else room.freeItemAction=p.slot; // Also covers a delayed Parry / Anvil resolution.
    logRoom(room,`🎒 ${p.name} uses stored item ${item.name}${costsTurn?' (turn-consuming)':' (free action)'}.`,'special');
    const result=useMagicBagItem(room,p,item)||{deferred:false};
    ok(ack,{item:publicMagicItem(item),freeAction:!costsTurn});
    if(result.deferred)return;
    if(checkWinner(room)){room.freeItemAction=null;emitState(room);return;}
    if(costsTurn)finishAction(room,false);
    else{room.freeItemAction=null;room.phase='turn';emitState(room);} 
  });

  socket.on('hot-potato-pass',(_data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='hotPotato'||!room.hotPotato)return fail(ack,'No Hot Potato game is active.');
    if(room.hotPotato.holder!==socket.data.slot)return fail(ack,'You are not holding the Hot Potato.');
    const r=passHotPotato(room,socket.data.slot);if(r.error)return fail(ack,r.error);ok(ack);
  });


  socket.on('companion-move',(data,ack)=>{
    const room=requireCompanionTurn(socket,ack);if(!room)return;
    const p=room.players[room.current],d=room.players[1-room.current],c=p.companion;
    const move=String(data?.move||'');

    // BRAINBOT ------------------------------------------------
    if(c.type==='brainbot'&&move==='hold'){
      notePresentationAbility(room,p,'brainbot-hold','Brainbot Hold in Place');
      if(companionBlocksEffect(room,d,'Brainbot Hold in Place')){
        logRoom(room,`🤖 ${p.name}'s Brainbot cannot grab ${d.name} through Companion protection.`,'info');
        ok(ack);finishCompanionMove(room,p);return;
      }
      const finishBrainHold=(parryResults=null)=>{
        const attempted=Array.isArray(parryResults);
        if(attempted&&parryResults[0]){
          logRoom(room,`🗡️ ${d.name} PARRIES Brainbot's Hold in Place!`,'special');
          emitDefenceFx(room,{slot:d.slot,label:'PARRY BRAINBOT!',amount:0,perfect:true});
          finishCompanionMove(room,p);return;
        }
        if(attempted){
          hurtFighter(room,d,1);
          if(checkWinner(room)){emitState(room);return;}
        }
        d.heldByCompanionOwner=p.slot;d.heldStacks=1;c.holdingSlot=d.slot;
        logRoom(room,`🤖 Brainbot uses Hold in Place! ${d.name} must use Release Themselves.`,'special');
        finishCompanionMove(room,p);
      };
      if(maybeStartParry(room,{attacker:p.slot,defender:d.slot,label:'Brainbot Hold in Place',hits:[6],onResolve:finishBrainHold})){ok(ack);return;}
      finishBrainHold(null);ok(ack);return;
    }
    if(c.type==='brainbot'&&move==='bite'){
      notePresentationAbility(room,p,'brainbot-bite','Brainbot Bite');
      companionStatusAttack(room,p,d,'Brainbot Bite',6,()=>{
        d.poison=Math.max(d.poison,3);d.poisonDie=4;
        logRoom(room,`🤖🦷 Brainbot bites ${d.name}. Poison will deal D4 damage for 3 turns.`,'bad');
      });
      ok(ack);return;
    }
    if(c.type==='brainbot'&&move==='defend'){
      notePresentationAbility(room,p,'brainbot-defend','Brainbot Defend Me');
      const r=setCompanionGuard(room,p,3,'BRAINBOT SHIELD');
      if(r.error)return fail(ack,r.error);ok(ack);return;
    }

    // ZOMBIE DANCERS -----------------------------------------
    if(c.type==='zombiedancers'&&move==='hold'){
      if(companionBlocksEffect(room,d,'Zombie Dancers Hold in Place')){
        logRoom(room,`🧟‍♂️ ${p.name}'s Zombie Dancers cannot grab ${d.name} through Companion protection.`,'info');
        ok(ack);finishZombieDancerMove(room,p);return;
      }
      const finishDancerHold=(parryResults=null)=>{
        const attempted=Array.isArray(parryResults);
        if(attempted&&parryResults[0]){
          logRoom(room,`🗡️ ${d.name} PARRIES the Zombie Dancers' Hold in Place!`,'special');
          emitDefenceFx(room,{slot:d.slot,label:'PARRY DANCERS!',amount:0,perfect:true});
          finishZombieDancerMove(room,p);return;
        }
        if(attempted){
          hurtFighter(room,d,1);
          logRoom(room,`💢 ${d.name} misses the Parry against Zombie Dancers and takes +1 damage.`,'bad');
          if(checkWinner(room)){emitState(room);return;}
        }
        d.heldByCompanionOwner=p.slot;d.heldStacks=(d.heldStacks||0)+1;c.holdingSlot=d.slot;
        logRoom(room,`🧟‍♂️🕺 Zombie Dancers stack Hold in Place on ${d.name}. ${d.name} now needs ${d.heldStacks} Release move(s).`,'special');
        finishZombieDancerMove(room,p);
      };
      if(maybeStartParry(room,{attacker:p.slot,defender:d.slot,label:'Zombie Dancers Hold in Place',hits:[7],onResolve:finishDancerHold})){
        ok(ack);return;
      }
      finishDancerHold(null);ok(ack);return;
    }
    if(c.type==='zombiedancers'&&move==='defend'){
      if((c.dancerDefendsUsed||0)>=3)return fail(ack,'Zombie Dancers have already used Defend Me three times.');
      c.dancerDefendsUsed=(c.dancerDefendsUsed||0)+1;
      c.guard=(c.guard||0)+5;c.guardMax=(c.guardMax||0)+5;
      c.dancerMovePenalty=Math.min(2,c.dancerDefendsUsed);
      logRoom(room,`🧟‍♂️🛡️ Zombie Dancers add +5 Companion Defence (${c.guard}/${c.guardMax}). Defend Me uses: ${c.dancerDefendsUsed}/3. Future Zombie Dancer move limit becomes ${Math.max(1,3-c.dancerMovePenalty)}.`,'special');
      if(c.dancerDefendsUsed>=3){
        const shouldEnd=(c.dancerMovesUsedThisTurn||0)+1>=Math.max(1,c.dancerMovesLimit||3);
        logRoom(room,`💀 The Zombie Dancers collapse after their third Defend Me.`,'bad');
        removeCompanion(room,p.slot,'collapse after using Defend Me three times');
        loseMomentumForNonAttack(room,p,'Zombie Dancers Defend Me');
        ok(ack);
        if(shouldEnd||room.phase==='companionOnly')fullEndTurn(room);else emitState(room);
        return;
      }
      ok(ack);finishZombieDancerMove(room,p);return;
    }

    // ZOMBIE -------------------------------------------------
    if(c.type==='zombie'&&move==='hold'){
      if(c.holdCooldown>0)return fail(ack,`Hold in Place is on cooldown for ${c.holdCooldown} more turn(s).`);
      if(Number.isInteger(d.heldByCompanionOwner))return fail(ack,'The opponent is already being held.');
      c.holdCooldown=3;

      if(companionBlocksEffect(room,d,'Zombie Hold in Place')){
        logRoom(room,`🧟 ${p.name}'s Zombie tries Hold in Place, but ${d.name}'s Companion shield protects them.`,'info');
        ok(ack);finishCompanionMove(room,p);return;
      }

      const finishHold=(parryResults=null)=>{
        const attempted=Array.isArray(parryResults);
        if(attempted&&parryResults[0]){
          logRoom(room,`🗡️ ${d.name} PARRIES the Zombie's Hold in Place!`,'special');
          emitDefenceFx(room,{slot:d.slot,label:'PARRY HOLD!',amount:0,perfect:true});
          finishCompanionMove(room,p);return;
        }
        if(attempted){
          hurtFighter(room,d,1);
          logRoom(room,`💢 ${d.name} misses the Parry against Hold in Place and takes +1 damage.`,'bad');
          if(checkWinner(room)){emitState(room);return;}
        }
        d.heldByCompanionOwner=p.slot;d.heldStacks=1;c.holdingSlot=d.slot;
        logRoom(room,`🧟 ${p.name}'s Zombie uses Hold in Place! ${d.name} can do nothing on their turn except Action → Release Themselves.`,'special');
        finishCompanionMove(room,p);
      };

      if(maybeStartParry(room,{attacker:p.slot,defender:d.slot,label:'Zombie Hold in Place',hits:[6],onResolve:finishHold})){
        ok(ack);return;
      }
      finishHold(null);ok(ack);return;
    }

    if(c.type==='zombie'&&move==='defend'){
      const r=setCompanionGuard(room,p,5,'ZOMBIE SHIELD');
      if(r.error)return fail(ack,r.error);ok(ack);return;
    }

    if(c.type==='zombie'&&move==='bite'){
      const r=companionStatusAttack(room,p,d,'Zombie Bite',6,()=>{
        d.poison=Math.max(d.poison,3);d.poisonDie=4;
        logRoom(room,`🧟🦷 ${p.name}'s Zombie bites ${d.name}. Poison will deal D4 damage for 3 turns.`,'bad');
      });
      ok(ack);return;
    }

    // LION ---------------------------------------------------
    if(c.type==='lion'&&move==='defend'){
      const r=setCompanionGuard(room,p,10,'LION SHIELD');
      if(r.error)return fail(ack,r.error);ok(ack);return;
    }
    if(c.type==='lion'&&move==='bigbite'){
      companionDirectAttack(room,p,d,10,'Lion Big Bite',{consumeMove:true,bleedChance:1,bleedTurns:2});
      ok(ack);return;
    }

    // KEBAB STAND -------------------------------------------
    if(c.type==='kebabstand'&&move==='claimkebab'){
      if(!c.kebabReady)return fail(ack,'The Kebab Stand does not have a Kebab ready yet.');
      c.kebabReady=false;
      const r=beginCompanionItemChoice(room,p,'kebab','Kebab Stand','companion');
      if(r.error)return fail(ack,r.error);
      logRoom(room,`🥙 ${p.name} claims a fresh Kebab from the Kebab Stand.`,'good');
      ok(ack,r);return;
    }

    // BABY / TEEN / ADULT DEFEND ME -------------------------
    if(c.type==='baby'&&move==='defend'){
      const r=setCompanionGuard(room,p,3,'BABY SHIELD');
      if(r.error)return fail(ack,r.error);ok(ack);return;
    }
    if(c.type==='teen'&&move==='defend'){
      const r=setCompanionGuard(room,p,5,'TEEN SHIELD');
      if(r.error)return fail(ack,r.error);ok(ack);return;
    }
    if(c.type==='adult'&&move==='defend'){
      const r=setCompanionGuard(room,p,7,'ADULT SHIELD');
      if(r.error)return fail(ack,r.error);ok(ack);return;
    }

    // TEEN ---------------------------------------------------
    if(c.type==='teen'&&move==='gooning'){
      if(c.gooningCooldown>0)return fail(ack,`Gooning is on cooldown for ${c.gooningCooldown} more turn(s).`);
      c.gooningCooldown=7;
      companionStatusAttack(room,p,d,'Gooning',10,()=>{
        d.armourBreak=Math.max(d.armourBreak,3);
        const {before}=halveDefenceForArmourBreak(d);
        d.weakness=Math.max(d.weakness,3);
        d.ptsd=Math.max(d.ptsd,3);d.lastBattleButton=null;
        logRoom(room,`😵 ${p.name}'s Teen uses Gooning: ${d.name} gets Armour Break, Weakness and PTSD for 3 turns. Defence ${before} → ${d.defence}.`,'bad');
      });
      ok(ack);return;
    }

    // ADULT --------------------------------------------------
    if(c.type==='adult'&&move==='depression'){
      logRoom(room,`😔 ${p.name}'s Adult uses Depression. He does absolutely nothing because he is depressed.`,'info');
      ok(ack);finishCompanionMove(room,p);return;
    }
    if(c.type==='adult'&&move==='overtime'){
      if(c.overtimeUsedThisTurn)return fail(ack,'Overtime can only be used once per turn.');
      c.overtimeUsedThisTurn=true;
      p.actionsRemaining=Math.max(0,p.actionsRemaining)+1;
      logRoom(room,`🕒 ${p.name}'s Adult works Overtime and grants +1 normal move this turn (${p.actionsRemaining} moves available).`,'special');
      ok(ack);finishCompanionMove(room,p,'Overtime');return;
    }
    if(c.type==='adult'&&move==='groceries'){
      if(c.groceriesCooldown>0)return fail(ack,`Groceries is on cooldown for ${c.groceriesCooldown} more turn(s).`);
      c.groceriesCooldown=3;
      const item=drawMagicItem();
      const r=beginCompanionItemChoice(room,p,item.id,'Adult Groceries','companion');
      if(r.error)return fail(ack,r.error);
      logRoom(room,`🛍️ ${p.name}'s Adult comes home with ${item.name}. Choose which item to use/store.`,'special');
      ok(ack,r);return;
    }

    // DOG / CAT ---------------------------------------------
    if((c.type==='dog'||c.type==='cat')&&move==='bite'){
      if(c.biteUsedThisTurn)return fail(ack,'Bite can only be used once per turn.');
      c.biteUsedThisTurn=true;
      companionDirectAttack(room,p,d,3,`${c.name} Bite`,{consumeMove:true,bleedChance:1/3,bleedTurns:2});
      ok(ack);return;
    }
    if((c.type==='dog'||c.type==='cat')&&move==='pet'){
      logRoom(room,`🐾 ${p.name} pets the ${c.name}. Nothing happens. Worth it. :D`,'good');
      io.to(room.code).emit('companion-fx',{type:'pet',slot:p.slot,companion:c.type});
      ok(ack);finishCompanionMove(room,p,`Pet ${c.name}`);return;
    }

    // VAPOREON ----------------------------------------------
    if(c.type==='vaporeon'&&move==='watergun'){
      if(c.waterGunCooldown>0)return fail(ack,`Water Gun is on cooldown for ${c.waterGunCooldown} more turn(s).`);
      c.waterGunCooldown=3;
      const raw=d.special==='nightcrawler'?Math.ceil(3*1.5):3;
      if(d.special==='nightcrawler')logRoom(room,`💧 Nightcrawler is weak to Water: Water Gun gets ×1.5 damage (${raw}).`,'special');
      companionDirectAttack(room,p,d,raw,'Water Gun',{consumeMove:true});
      ok(ack);return;
    }
    if(c.type==='vaporeon'&&move==='seduce'){
      if(c.seduceCooldown>0)return fail(ack,`Seduce is on cooldown for ${c.seduceCooldown} more turn(s).`);
      c.seduceCooldown=5;
      companionStatusAttack(room,p,d,'Vaporeon Seduce',7,()=>{
        if(rollShown(room,2,'Vaporeon Seduce check')===1){
          const turns=rollShown(room,4,'Seduced duration');
          d.seduced=Math.max(d.seduced,turns);
          logRoom(room,`💘 Vaporeon's Seduce works! ${d.name} is Seduced for ${turns} turn(s).`,'special');
        }else{
          logRoom(room,`💧 Vaporeon's Seduce fails to affect ${d.name}.`,'info');
        }
      });
      ok(ack);return;
    }

    fail(ack,'Unknown Companion move.');
  });

  socket.on('companion-item-peek',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    const p=room.players[socket.data.slot];
    if(room.status!=='playing'||room.phase!=='companionItemChoice'||room.current!==socket.data.slot||!p.pendingCompanionItem)return fail(ack,'No Companion item choice is waiting.');
    ok(ack,{
      item:publicMagicItem(magicItemById(p.pendingCompanionItem)),
      source:p.pendingCompanionItemSource,
      consumesMove:!!p.pendingCompanionConsumesMove,
      stored:(p.inventory||[]).map((id,index)=>({index,item:publicMagicItem(magicItemById(id))})).filter(x=>x.item)
    });
  });

  socket.on('companion-item-resolve',(data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    const p=room.players[socket.data.slot];
    if(room.status!=='playing'||room.phase!=='companionItemChoice'||room.current!==socket.data.slot||!p.pendingCompanionItem)return fail(ack,'No Companion item choice is waiting.');

    const newItem=magicItemById(p.pendingCompanionItem),choice=String(data?.choice||'');
    const consumesMove=p.pendingCompanionConsumesMove;
    const returnPhase=p.pendingCompanionReturnPhase||'turn';
    p.pendingCompanionItem=null;p.pendingCompanionItemSource=null;p.pendingCompanionConsumesMove=false;p.pendingCompanionReturnPhase=null;
    room.phase=returnPhase;
    let result={deferred:false};

    if(choice==='store'){
      p.deferredCompanionItem=false;
      if(p.inventory.length>0)return fail(ack,'Your Item Bag already contains an item. Use one of the items instead.');
      p.inventory.push(newItem.id);
      logRoom(room,`🎒 ${p.name} stores ${newItem.name} in the Item Bag.`,'good');
    }else if(choice==='use-new'){
      logRoom(room,`🎒 ${p.name} uses the new ${newItem.name} immediately.`,'special');
      if(consumesMove==='companion')p.deferredCompanionItem=true;
      result=useMagicBagItem(room,p,newItem)||{deferred:false};
      if(!result.deferred)p.deferredCompanionItem=false;
    }else if(choice==='use-stored'){
      if(!p.inventory.length)return fail(ack,'There is no stored item to use.');
      const oldId=p.inventory.shift(),oldItem=magicItemById(oldId);
      p.inventory.unshift(newItem.id);
      logRoom(room,`🔁 ${p.name} stores ${newItem.name} and uses ${oldItem.name} from the Item Bag.`,'special');
      if(consumesMove==='companion')p.deferredCompanionItem=true;
      result=useMagicBagItem(room,p,oldItem)||{deferred:false};
      if(!result.deferred)p.deferredCompanionItem=false;
    }else{
      return fail(ack,'Choose an item resolution.');
    }

    ok(ack,{inventoryCount:p.inventory.length});
    if(result.deferred)return;
    if(checkWinner(room)){emitState(room);return;}
    if(consumesMove==='companion')finishCompanionMove(room,p,'Companion item');
    else if(consumesMove)finishAction(room,false);
    else emitState(room);
  });

  socket.on('companion-release',(_data,ack)=>{
    const room=getRoomForSocket(socket);
    if(!room||room.status!=='playing'||room.phase!=='turn'||room.current!==socket.data.slot)return fail(ack,'You cannot release yourself right now.');
    const p=room.players[socket.data.slot],ownerSlot=p.heldByCompanionOwner;
    if(!Number.isInteger(ownerSlot))return fail(ack,'You are not being held by a Companion.');
    const owner=room.players[ownerSlot];
    p.heldStacks=Math.max(0,(p.heldStacks||1)-1);
    if(p.heldStacks<=0){
      if(owner?.companion?.holdingSlot===p.slot)owner.companion.holdingSlot=null;
      p.heldByCompanionOwner=null;
      logRoom(room,`💪 ${p.name} completes the final Release and is free again.`,'good');
    }else{
      logRoom(room,`💪 ${p.name} breaks one stacked Hold, but ${p.heldStacks} Release move(s) remain.`,'good');
    }
    ok(ack);
    finishAction(room,false);
  });

  socket.on('companion-deal',(data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current],enemy=room.players[1-room.current],buttonError=battleButtonGuard(p,'Action');
    if(buttonError)return fail(ack,buttonError);
    if(!enemy.companion)return fail(ack,'The opponent does not have a Companion.');
    markBattleButton(p,'Action',room);
    const left=rollShown(room,20,'Companion Deal — LEFT D20');
    const right=Math.max(0,rollShown(room,20,'Companion Deal — RIGHT D20')-exhaustionPenalty(p));
    const killed=right>left;
    if(killed){
      const name=enemy.companion.name;
      removeCompanion(room,enemy.slot,'is defeated by the Companion Deal check');
      logRoom(room,`✅ ${p.name} deals with ${enemy.name}'s ${name}: RIGHT ${right} > LEFT ${left}.`,'good');
    }else{
      logRoom(room,`❌ ${p.name} fails to deal with ${enemy.name}'s ${enemy.companion.name}: RIGHT ${right} is not greater than LEFT ${left}.`,'bad');
    }
    ok(ack,{left,right,killed});
    finishAction(room,false);
  });

  socket.on('action-preview',(data,ack)=>{
    const room=getRoomForSocket(socket);if(!room||room.status!=='playing')return fail(ack,'No active game.');
    const type=String(data?.type||'');
    if(!ACTION_TYPES.includes(type))return fail(ack,'Unknown Action type.');
    const p=room.players[socket.data.slot],enemy=room.players[1-socket.data.slot];
    ok(ack,{mods:actionMods(p,type,enemy,false),leftDie:20,rightDie:greatExceptionSides(p,20)});
  });

  socket.on('action-check',(data,ack)=>{
    const room=requireTurn(socket,ack);if(!room)return;
    const p=room.players[room.current],enemy=room.players[1-room.current],buttonError=battleButtonGuard(p,'Action');
    if(buttonError)return fail(ack,buttonError);
    if(p.actionCooldown>0)return fail(ack,'Action is on cooldown.');
    const type=String(data?.type||'');
    if(!ACTION_TYPES.includes(type))return fail(ack,'Unknown Action type.');
    p.actionCooldown=4;
    markBattleButton(p,'Action',room);
    const leftSides=20,rightSides=greatExceptionSides(p,20);
    const left=rollShown(room,leftSides,'Action LEFT'),right=rollShown(room,rightSides,'Action RIGHT'),mods=actionMods(p,type,enemy,true);
    const final=right+mods.adv-mods.dis,passed=final>left;
    const check={left,right,leftSides,rightSides,final,passed,adv:mods.adv,dis:mods.dis,advParts:mods.advParts,disParts:mods.disParts};
    logRoom(room,`🎲 ${p.name} ${passed?'passes':'fails'} Action → ${type}: RIGHT ${right} +${mods.adv} -${mods.dis} = ${final} vs LEFT ${left}.`,passed?'good':'bad');

    if(!passed){
      ok(ack,{check});
      loseMomentumForNonAttack(room,p,'a failed Action check');
      fullEndTurn(room);
      return;
    }
    room.pendingAction={slot:room.current,type,check};
    room.phase='actionResolve';
    ok(ack,{check});
    emitState(room);
  });

  socket.on('action-resolve',(data,ack)=>{
    const room=requireResolve(socket,ack);if(!room)return;
    const type=room.pendingAction.type;
    let r;
    if(type==='attack'){
      r=doPoolAttack(room,+data?.die,'Action Attack');
    } else if(type==='defence'){
      r=doDefend(room,+data?.die,true);
    } else if(type==='effect'){
      r=doEffect(room,String(data?.effect||''),true);
    } else if(type==='charge'){
      const p=room.players[room.current];
      if(p.beamCharge==='ready'&&p.beamCooldown>0&&!p.beamCooldownBypass){
        r={error:`Beam is on cooldown for ${p.beamCooldown} more turn(s).`};
      }else if(p.beamCharge==='ready'&&(p.beamCooldown===0||p.beamCooldownBypass)){
        r=fireBeam(room,true,+data?.die);
        // Beam resolution itself will end the Action turn.
      }else{
        r=doCharge(room,true);
      }
    } else if(type==='other'){
      const enemy=room.players[1-room.current];
      if(data?.choice==='lights-on'&&enemy.lightsOut){
        enemy.lightsOut=false;
        logRoom(room,`💡 ${room.players[room.current].name} turns the lights back on. Lights Out ends.`,'good');
      } else {
        logRoom(room,`🎭 ${room.players[room.current].name} completes a successful Other Action.`,'info');
      }
      finishAction(room,true);r={ok:true};
    }
    if(r?.error)return fail(ack,r.error);
    if(r?.needsBeamDie)return fail(ack,'Choose a Beam die.');
    ok(ack);
  });

  socket.on('beam-take',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room||room.phase!=='beamResponse'||!room.beamPending)return fail(ack,'No incoming Beam.');
    if(room.beamPending.defender!==socket.data.slot)return fail(ack,'Only the target can answer this Beam.');
    ok(ack);resolveBeamHit(room);
  });

  socket.on('beam-counter',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room||room.phase!=='beamResponse'||!room.beamPending)return fail(ack,'No incoming Beam.');
    if(room.beamPending.defender!==socket.data.slot)return fail(ack,'Only the target can counter.');
    const r=startClash(room);if(r.error)return fail(ack,r.error);ok(ack);
  });

  socket.on('clash-press',(_data,ack)=>{
    const room=getRoomForSocket(socket);if(!room||room.phase!=='clash'||!room.clash)return fail(ack,'The Beam Clash has not started yet.');
    const slot=socket.data.slot,p=room.players[slot];
    if(Date.now()<room.clash.startsAt)return fail(ack,'Wait for the countdown.');
    if(Date.now()>=room.clash.endsAt)return fail(ack,'The clash is over.');
    const now=Date.now();
    if(now-p.lastClashPressAt<35)return ok(ack,{accepted:false});
    p.lastClashPressAt=now;
    if(slot===0)room.clash.p1++;else room.clash.p2++;
    io.to(room.code).emit('clash-update',{id:room.clash.id,p1:room.clash.p1,p2:room.clash.p2,endsAt:room.clash.endsAt});
    ok(ack,{accepted:true});
  });

  socket.on('chat',(data,ack)=>{
    const room=getRoomForSocket(socket);if(!room)return fail(ack,'Not in a room.');
    const text=clean(data?.text,300);if(!text)return fail(ack,'Message is empty.');
    if(Date.now()-(socket.data.lastChatAt||0)<850)return fail(ack,'You are sending messages too quickly.');
    socket.data.lastChatAt=Date.now();
    const p=room.players[socket.data.slot];
    room.chat.push({id:crypto.randomBytes(6).toString('hex'),slot:p.slot,name:p.name||`Player ${p.slot+1}`,text,at:Date.now()});
    if(room.chat.length>50)room.chat.shift();
    ok(ack);emitState(room);
  });

  socket.on('disconnect',()=>{
    const room=getRoomForSocket(socket);
    if(!room)return;
    const p=room.players[socket.data.slot];
    if(p.socketId===socket.id){
      p.connected=false;p.socketId=null;p.disconnectedAt=Date.now();
      logRoom(room,`${p.name||`Player ${p.slot+1}`} disconnected. They can reconnect with the same browser.`, 'bad');
      emitState(room);
    }
  });
});

setInterval(()=>{
  const cutoff=Date.now()-6*60*60*1000;
  for(const [code,room] of rooms){
    if(room.touchedAt<cutoff && room.players.every(p=>!p||p.isBot||!p.connected)) disposeRoom(room);
  }
},10*60*1000).unref();

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`Challenger Clash Online listening on http://0.0.0.0:${PORT}`);
});
