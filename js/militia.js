// ══ MILITIA — 2D Shooter ══
import { showScreen, state } from './state.js';
import { db, ref, set, onValue, off, fbGet, fbListen, fbOff } from './firebase.js';

// ══ Constants ══
const GRAVITY      = 0.38;
const JETPACK_F    = -0.72;
const MOVE_SPEED   = 2.6;
const WORLD_W      = 2400;
const WORLD_H      = 800;
const FPS_TARGET   = 60;

// ══ Weapons ══
const WEAPONS = {
  pistol:  { name:'Pistol',  emoji:'🔫', ammo:Infinity, fireRate:18, damage:28, spd:13, spread:.06, color:'#fbbf24', auto:false },
  rifle:   { name:'Rifle',   emoji:'⚡',  ammo:30,       fireRate:5,  damage:16, spd:17, spread:.04, color:'#22d3ee', auto:true  },
  shotgun: { name:'Shotgun', emoji:'💥',  ammo:8,        fireRate:32, damage:20, spd:10, spread:.28, color:'#f97316', auto:false, pellets:5 },
  rocket:  { name:'Rocket',  emoji:'🚀',  ammo:3,        fireRate:65, damage:85, spd:8,  spread:0,   color:'#f43f5e', auto:false, explosive:true },
};

// ══ State ══
let mlActive=false, mlRAF=null, mlTick=0, mlMode=null, mlRoom=null;
let cam={x:0,y:0}, player=null, bots=[], bullets=[], pickups=[], particles=[];
let platforms=[], kills=0, deaths=0;
const keys={};
let mouse={x:400,y:300,down:false};
let mlDiff=2;
let onlinePlayers={}, mlIsHost=false, mlMyTurn=true;
let mlKeyDown=null, mlKeyUp=null, mlMouseMove=null, mlMouseDown=null, mlMouseUp=null;

// ══ Map ══
function buildMap(){
  platforms=[
    // Borders
    {x:0,    y:0,    w:WORLD_W, h:30,   c:'#0a180a'},
    {x:0,    y:770,  w:WORLD_W, h:30,   c:'#0a180a'},
    {x:0,    y:0,    w:30,      h:WORLD_H,c:'#0a180a'},
    {x:2370, y:0,    w:30,      h:WORLD_H,c:'#0a180a'},
    // Left section
    {x:80,   y:630,  w:220, h:16, c:'#152415'},
    {x:60,   y:490,  w:190, h:16, c:'#152415'},
    {x:140,  y:350,  w:210, h:16, c:'#152415'},
    {x:80,   y:210,  w:170, h:16, c:'#152415'},
    // Left-center
    {x:380,  y:670,  w:240, h:16, c:'#152415'},
    {x:420,  y:530,  w:200, h:16, c:'#152415'},
    {x:370,  y:390,  w:220, h:16, c:'#152415'},
    {x:460,  y:240,  w:180, h:16, c:'#152415'},
    // Center pillar
    {x:1150, y:770,  w:100, h:180,c:'#0e1e0e'},
    {x:1090, y:620,  w:220, h:16, c:'#152415'},
    {x:1110, y:470,  w:180, h:16, c:'#152415'},
    {x:1070, y:320,  w:260, h:16, c:'#152415'},
    {x:1120, y:180,  w:160, h:16, c:'#152415'},
    // Center section
    {x:780,  y:700,  w:280, h:16, c:'#152415'},
    {x:820,  y:550,  w:200, h:16, c:'#152415'},
    {x:760,  y:400,  w:240, h:16, c:'#152415'},
    {x:840,  y:250,  w:180, h:16, c:'#152415'},
    // Right-center
    {x:1420, y:670,  w:250, h:16, c:'#152415'},
    {x:1460, y:520,  w:200, h:16, c:'#152415'},
    {x:1400, y:380,  w:220, h:16, c:'#152415'},
    {x:1480, y:230,  w:180, h:16, c:'#152415'},
    // Right section
    {x:1780, y:640,  w:240, h:16, c:'#152415'},
    {x:1820, y:490,  w:200, h:16, c:'#152415'},
    {x:1760, y:350,  w:220, h:16, c:'#152415'},
    {x:1820, y:200,  w:180, h:16, c:'#152415'},
    // Far right
    {x:2080, y:630,  w:220, h:16, c:'#152415'},
    {x:2120, y:480,  w:180, h:16, c:'#152415'},
    {x:2070, y:330,  w:210, h:16, c:'#152415'},
  ];
}

// ══ Spawns ══
const SPAWNS=[
  {x:160,y:600},{x:200,y:310},{x:460,y:460},{x:480,y:200},
  {x:870,y:480},{x:890,y:210},{x:1150,y:580},{x:1160,y:290},
  {x:1500,y:450},{x:1520,y:190},{x:1850,y:420},{x:1860,y:160},
  {x:2130,y:440},{x:2140,y:290},
];
function randSpawn(excludes=[]){
  let pool=SPAWNS.filter(s=>!excludes.some(e=>Math.hypot(e.x-s.x,e.y-s.y)<250));
  if(!pool.length)pool=SPAWNS;
  return{...pool[Math.floor(Math.random()*pool.length)]};
}

// ══ Player Factory ══
function makePlayer(id,name,color,isBot=false){
  const sp=randSpawn();
  return{
    id,name,color:color||'#00f5c4',
    x:sp.x,y:sp.y,vx:0,vy:0,
    w:28,h:34,
    hp:100,maxHp:100,
    weapon:'pistol',
    ammo:Object.fromEntries(Object.entries(WEAPONS).map(([k,v])=>[k,v.ammo===Infinity?Infinity:v.ammo])),
    fireTick:0,facingRight:true,
    onGround:false,jetFuel:100,jetMax:100,
    dead:false,respawnAt:0,
    kills:0,deaths:0,isBot,
    // bot
    bState:'patrol',bDir:1,bMoveTick:0,bAimX:0,bAimY:0,
  };
}

// ══ Pickups ══
const PICKUP_SPOTS=[
  {x:245,y:325},{x:165,y:185},{x:470,y:360},{x:480,y:215},
  {x:880,y:370},{x:865,y:225},{x:1160,y:440},{x:1170,y:295},
  {x:1510,y:350},{x:1520,y:205},{x:1870,y:320},{x:1860,y:175},
  {x:2140,y:305},{x:2145,y:200},
];
const PICKUP_WEAPS=['rifle','shotgun','rocket','rifle','shotgun','rifle','rocket','shotgun','rifle','rocket','shotgun','rifle','rocket','shotgun'];
function spawnPickups(){
  pickups=PICKUP_SPOTS.map((s,i)=>({
    x:s.x,y:s.y,type:PICKUP_WEAPS[i%PICKUP_WEAPS.length],
    active:true,respawnAt:0,bobOffset:i*0.7,
  }));
}

// ══ Collision ══
function overlap(ax,ay,aw,ah,bx,by,bw,bh){
  return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;
}
function resolveCollision(p){
  p.onGround=false;
  for(const pl of platforms){
    if(!overlap(p.x,p.y,p.w,p.h,pl.x,pl.y,pl.w,pl.h))continue;
    const oL=(p.x+p.w)-pl.x, oR=(pl.x+pl.w)-p.x;
    const oT=(p.y+p.h)-pl.y, oB=(pl.y+pl.h)-p.y;
    const mH=Math.min(oL,oR), mV=Math.min(oT,oB);
    if(mV<=mH){
      if(oT<oB){p.y=pl.y-p.h;if(p.vy>0){p.vy=0;p.onGround=true;}}
      else{p.y=pl.y+pl.h;if(p.vy<0)p.vy=0;}
    }else{
      if(oL<oR){p.x=pl.x-p.w;p.vx=0;}
      else{p.x=pl.x+pl.w;p.vx=0;}
    }
  }
}

// ══ Physics ══
function updatePhysics(p,jet,mx){
  if(p.dead)return;
  p.vy+=GRAVITY;
  if(jet&&p.jetFuel>0){p.vy+=JETPACK_F;p.jetFuel=Math.max(0,p.jetFuel-1.8);}
  else if(p.onGround)p.jetFuel=Math.min(p.jetMax,p.jetFuel+1.4);
  else p.jetFuel=Math.min(p.jetMax,p.jetFuel+0.35);
  p.vx=mx*MOVE_SPEED;
  p.x+=p.vx; p.y+=p.vy;
  p.x=Math.max(30,Math.min(WORLD_W-30-p.w,p.x));
  p.y=Math.max(30,Math.min(WORLD_H-p.h-2,p.y));
  resolveCollision(p);
}

// ══ Shoot ══
function shoot(shooter,tx,ty){
  const w=WEAPONS[shooter.weapon];
  if(mlTick-shooter.fireTick<w.fireRate)return;
  if(shooter.ammo[shooter.weapon]!==Infinity&&shooter.ammo[shooter.weapon]<=0){
    // Auto switch to pistol if out of ammo
    shooter.weapon='pistol'; return;
  }
  if(shooter.dead)return;
  shooter.fireTick=mlTick;
  if(shooter.ammo[shooter.weapon]!==Infinity)shooter.ammo[shooter.weapon]--;
  const cx=shooter.x+shooter.w/2, cy=shooter.y+shooter.h/2;
  const pellets=w.pellets||1;
  for(let i=0;i<pellets;i++){
    const spd=(Math.random()-.5)*w.spread*2;
    const ang=Math.atan2(ty-cy,tx-cx)+spd;
    bullets.push({
      x:cx,y:cy,vx:Math.cos(ang)*w.spd,vy:Math.sin(ang)*w.spd,
      dmg:w.damage,color:w.color,owner:shooter.id,
      explosive:w.explosive||false,alive:true,age:0,
    });
  }
  spawnParts(cx,cy,w.color,5);
}

// ══ Particles ══
function spawnParts(x,y,color,n,big=false){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*(big?7:3.5)+1;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,color,life:1,sz:big?Math.random()*7+3:Math.random()*3+1});
  }
}

// ══ Damage / Kill ══
function dealDamage(target,dmg,shooterId){
  target.hp-=dmg;
  spawnParts(target.x+target.w/2,target.y+target.h/2,'#f43f5e',6);
  if(target.hp<=0&&!target.dead){
    target.dead=true;
    target.respawnAt=mlTick+180;
    target.deaths++;
    spawnParts(target.x+target.w/2,target.y+target.h/2,target.color,22,true);
    const killer=[player,...bots].find(p=>p&&p.id===shooterId);
    if(killer){killer.kills++;}
    if(target===player)deaths++;
    else if(killer===player)kills++;
  }
}

// ══ Bullets ══
function updateBullets(){
  bullets=bullets.filter(b=>b.alive);
  for(const b of bullets){
    b.x+=b.vx; b.y+=b.vy; b.vy+=0.07; b.age++;
    if(b.x<0||b.x>WORLD_W||b.y<0||b.y>WORLD_H||b.age>130){b.alive=false;continue;}
    // Platform hit
    let hitPlat=false;
    for(const p of platforms){
      if(b.x>p.x&&b.x<p.x+p.w&&b.y>p.y&&b.y<p.y+p.h){hitPlat=true;break;}
    }
    if(hitPlat){
      if(b.explosive)spawnParts(b.x,b.y,'#f43f5e',22,true);
      else spawnParts(b.x,b.y,b.color,5);
      b.alive=false; continue;
    }
    // Player hit
    const targets=[player,...bots].filter(t=>t&&!t.dead&&t.id!==b.owner);
    for(const t of targets){
      if(overlap(b.x-4,b.y-4,8,8,t.x,t.y,t.w,t.h)){
        if(b.explosive){
          // Splash
          for(const s of[player,...bots].filter(x=>x&&!x.dead)){
            const dd=Math.hypot(s.x-b.x,s.y-b.y);
            if(dd<110)dealDamage(s,b.dmg*(1-dd/110),b.owner);
          }
          spawnParts(b.x,b.y,'#f43f5e',30,true);
        }else{
          dealDamage(t,b.dmg,b.owner);
        }
        b.alive=false; break;
      }
    }
  }
}

// ══ Pickups ══
function updatePickups(){
  for(const pk of pickups){
    if(!pk.active&&mlTick>=pk.respawnAt)pk.active=true;
    if(!pk.active||!player||player.dead)continue;
    if(overlap(player.x,player.y,player.w,player.h,pk.x-14,pk.y-14,28,28)){
      player.weapon=pk.type;
      player.ammo[pk.type]=WEAPONS[pk.type].ammo===Infinity?Infinity:WEAPONS[pk.type].ammo;
      pk.active=false; pk.respawnAt=mlTick+600;
      spawnParts(pk.x,pk.y,WEAPONS[pk.type].color,12);
    }
  }
}

// ══ Respawn ══
function updateRespawns(){
  for(const p of[player,...bots].filter(Boolean)){
    if(p.dead&&mlTick>=p.respawnAt){
      const sp=randSpawn([player,...bots].filter(o=>o&&o!==p&&!o.dead).map(o=>({x:o.x,y:o.y})));
      Object.assign(p,{x:sp.x,y:sp.y,vx:0,vy:0,hp:p.maxHp,dead:false,weapon:'pistol',jetFuel:p.jetMax,
        ammo:Object.fromEntries(Object.entries(WEAPONS).map(([k,v])=>[k,v.ammo===Infinity?Infinity:v.ammo]))});
    }
  }
}

// ══ Bot AI ══
const BOT_NAMES=['Alpha','Bravo','Delta','Ghost','Nova','Viper','Storm','Cipher'];
const BOT_COLS=['#f43f5e','#f97316','#a855f7','#60a5fa','#fbbf24','#ec4899','#22d3ee','#fb923c'];

// Check if a solid wall is directly ahead (horizontal)
function botWallAhead(bot, dir){
  const checkX = dir>0 ? bot.x+bot.w+6 : bot.x-6;
  for(const pl of platforms){
    if(pl.h>60) continue; // ignore border walls
    if(checkX>pl.x&&checkX<pl.x+pl.w&&bot.y+bot.h>pl.y+4&&bot.y<pl.y+pl.h) return true;
  }
  return false;
}

// Separate physics for bots using difficulty-scaled speed
function botMove(bot,jet,mx){
  if(bot.dead)return;
  bot.vy+=GRAVITY;
  if(jet&&bot.jetFuel>0){bot.vy+=JETPACK_F;bot.jetFuel=Math.max(0,bot.jetFuel-1.8);}
  else if(bot.onGround)bot.jetFuel=Math.min(bot.jetMax,bot.jetFuel+1.4);
  else bot.jetFuel=Math.min(bot.jetMax,bot.jetFuel+0.35);
  // Easy=1.4, Normal=1.8, Hard=2.2, Insane=2.5
  const spd=1.0+mlDiff*0.4;
  bot.vx=mx*spd;
  bot.x+=bot.vx; bot.y+=bot.vy;
  bot.x=Math.max(30,Math.min(WORLD_W-30-bot.w,bot.x));
  bot.y=Math.max(30,Math.min(WORLD_H-bot.h-2,bot.y));
  resolveCollision(bot);
}

function updateBot(bot){
  if(bot.dead)return;
  if(bot.bStuckTick===undefined) initBotAI(bot);
  if(bot.bJumpCooldown>0) bot.bJumpCooldown--;

  const tgt=player&&!player.dead?player:null;

  // Pick up nearby weapons
  for(const pk of pickups){
    if(pk.active&&overlap(bot.x,bot.y,bot.w,bot.h,pk.x-14,pk.y-14,28,28)){
      bot.weapon=pk.type;
      bot.ammo[pk.type]=WEAPONS[pk.type].ammo===Infinity?Infinity:WEAPONS[pk.type].ammo;
      pk.active=false; pk.respawnAt=mlTick+600;
    }
  }

  if(!tgt){
    // Patrol: walk & jump over walls
    bot.bMoveTick=(bot.bMoveTick||0)+1;
    const wAhead=botWallAhead(bot,bot.bDir);
    if(wAhead&&bot.onGround&&bot.bJumpCooldown===0){
      bot.vy=JUMP_FORCE*0.82; bot.bJumpCooldown=45;
    }
    // Reverse after a while or if stuck airborne against wall
    if(bot.bMoveTick>150||(wAhead&&!bot.onGround&&bot.bMoveTick>20)){
      bot.bDir*=-1; bot.bMoveTick=0;
    }
    botMove(bot,false,bot.bDir);
    return;
  }

  const dx=tgt.x-bot.x, dy=tgt.y-bot.y, dist=Math.hypot(dx,dy);
  const inaccuracy=Math.max(10,(5-mlDiff)*45);
  // Re-aim every 8 ticks so bots don't lock perfectly
  if(mlTick%8===0){
    bot.bAimX=tgt.x+tgt.w/2+(Math.random()-.5)*inaccuracy;
    bot.bAimY=tgt.y+tgt.h/2+(Math.random()-.5)*inaccuracy;
  }
  bot.facingRight=dx>0;

  // ── Stuck check every 28 ticks ──
  bot.bStuckTick++;
  if(bot.bStuckTick%28===0){
    if(Math.abs(bot.x-bot.bLastX)<5&&bot.onGround&&bot.bJumpCooldown===0){
      bot.vy=JUMP_FORCE*0.88; bot.bJumpCooldown=38; bot.bDir*=-1;
    }
    bot.bLastX=bot.x;
  }

  let mx=0, jet=false;
  const wantDir=dx>0?1:-1;
  const lowHp=bot.hp<30;
  const veryClose=dist<110;
  const inRange=dist<400;
  const hasRocket=bot.weapon==='rocket'&&bot.ammo.rocket>0;

  if(lowHp&&dist<320){
    // RETREAT
    bot.bState='retreat';
    mx=-wantDir;
    if(botWallAhead(bot,mx)&&bot.onGround&&bot.bJumpCooldown===0){
      bot.vy=JUMP_FORCE*0.82; bot.bJumpCooldown=40;
    }
    if(bot.jetFuel>25&&dy<-80) jet=true;
    if(bot.bShootCooldown<=0&&dist<400){
      shoot(bot,bot.bAimX,bot.bAimY);
      bot.bShootCooldown=WEAPONS[bot.weapon].fireRate+8;
    }

  } else if(veryClose&&!hasRocket){
    // STRAFE — dodge sideways
    bot.bState='strafe';
    bot.bStrafeTimer--;
    if(bot.bStrafeTimer<=0){
      bot.bStrafeDir*=-1;
      bot.bStrafeTimer=32+Math.floor(Math.random()*32);
    }
    mx=bot.bStrafeDir;
    if(botWallAhead(bot,mx)&&bot.onGround&&bot.bJumpCooldown===0){
      bot.vy=JUMP_FORCE*0.75; bot.bJumpCooldown=40; mx=-mx; bot.bStrafeDir*=-1;
    }
    if(bot.onGround&&bot.bJumpCooldown===0&&Math.random()<0.022){
      bot.vy=JUMP_FORCE*0.72; bot.bJumpCooldown=50;
    }
    if(bot.bShootCooldown<=0){
      shoot(bot,bot.bAimX,bot.bAimY);
      bot.bShootCooldown=WEAPONS[bot.weapon].fireRate;
    }

  } else if(inRange){
    // ATTACK
    bot.bState='attack';
    if(Math.abs(dx)>35) mx=wantDir;
    // Jump over wall in path
    if(mx!==0&&botWallAhead(bot,mx)&&bot.onGround&&bot.bJumpCooldown===0){
      bot.vy=JUMP_FORCE*0.92; bot.bJumpCooldown=28;
    }
    // Target is higher — jump toward them
    if(dy<-55&&bot.onGround&&bot.bJumpCooldown===0){
      bot.vy=JUMP_FORCE; bot.bJumpCooldown=26;
    }
    // Large height gap — jetpack
    if(dy<-190&&!bot.onGround&&bot.jetFuel>20) jet=true;
    // Shoot with reaction delay
    if(dist<440&&bot.bShootCooldown<=0&&mlTick%bot.bReactionDelay===0){
      if(!(bot.weapon==='rocket'&&dist<130)){
        shoot(bot,bot.bAimX,bot.bAimY);
        bot.bShootCooldown=Math.max(3,WEAPONS[bot.weapon].fireRate-(mlDiff*2));
      }
    }
    if(bot.weapon==='rifle'&&dist<360&&bot.ammo.rifle>0) shoot(bot,bot.bAimX,bot.bAimY);

  } else {
    // CHASE
    bot.bState='chase';
    mx=wantDir;
    if(botWallAhead(bot,mx)&&bot.onGround&&bot.bJumpCooldown===0){
      bot.vy=JUMP_FORCE; bot.bJumpCooldown=26;
    }
    if(dy<-75&&bot.onGround&&bot.bJumpCooldown===0){
      bot.vy=JUMP_FORCE; bot.bJumpCooldown=26;
    }
    if(dy<-190&&bot.jetFuel>30) jet=true;
    if(dist<520&&bot.bShootCooldown<=0&&mlTick%22===0){
      shoot(bot,bot.bAimX,bot.bAimY);
      bot.bShootCooldown=WEAPONS[bot.weapon].fireRate+12;
    }
  }

  if(bot.bShootCooldown>0) bot.bShootCooldown--;
  botMove(bot,jet,mx);
}

// ══ Camera ══
function updateCam(cw,ch){
  if(!player)return;
  cam.x+=(player.x+player.w/2-cw/2-cam.x)*0.1;
  cam.y+=(player.y+player.h/2-ch/2-cam.y)*0.1;
  cam.x=Math.max(0,Math.min(WORLD_W-cw,cam.x));
  cam.y=Math.max(0,Math.min(WORLD_H-ch,cam.y));
}

// ══ Input ══
function handleInput(){
  if(!player||player.dead)return;
  const mx=(keys['ArrowRight']||keys['d']||keys['D']?1:0)-(keys['ArrowLeft']||keys['a']||keys['A']?1:0);
  const jet=!!(keys['ArrowUp']||keys['w']||keys['W']||keys[' ']);
  const wmx=mouse.x+cam.x, wmy=mouse.y+cam.y;
  player.facingRight=wmx>player.x+player.w/2;
  updatePhysics(player,jet,mx);
  const w=WEAPONS[player.weapon];
  if(mouse.down&&(w.auto||mlTick-player.fireTick>=w.fireRate))shoot(player,wmx,wmy);
  if(keys['1'])player.weapon='pistol';
  if(keys['2']&&player.ammo.rifle>0)player.weapon='rifle';
  if(keys['3']&&player.ammo.shotgun>0)player.weapon='shotgun';
  if(keys['4']&&player.ammo.rocket>0)player.weapon='rocket';
}

// ══ Online Sync (Firebase) ══
let mlSyncInterval=null;
function mlStartOnlineSync(){
  if(!mlRoom)return;
  mlSyncInterval=setInterval(()=>{
    if(!player||!mlActive)return;
    set(ref(db,'militia/rooms/'+mlRoom+'/players/'+state.myId),{
      id:state.myId,name:player.name,color:player.color,
      x:Math.round(player.x),y:Math.round(player.y),
      hp:player.hp,dead:player.dead,facingRight:player.facingRight,
      weapon:player.weapon,kills:player.kills,deaths:player.deaths,
      ts:Date.now(),
    });
  },80);

  onValue(ref(db,'militia/rooms/'+mlRoom+'/players'),snap=>{
    if(!snap.exists())return;
    onlinePlayers=snap.val()||{};
  });

  onValue(ref(db,'militia/rooms/'+mlRoom+'/bullets'),snap=>{
    if(!snap.exists()||!mlActive)return;
    const bData=snap.val();
    if(!bData)return;
    Object.values(bData).forEach(b=>{
      if(b.owner!==state.myId&&b.ts>(Date.now()-500)){
        // Add remote bullet if not already tracked
        const existing=bullets.find(x=>x.remoteId===b.id);
        if(!existing){
          bullets.push({...b,remoteId:b.id,alive:true,age:0});
        }
      }
    });
  });
}
function mlFireRemoteBullet(b){
  if(!mlRoom||mlMode!=='online')return;
  const id=Date.now()+'_'+Math.random().toString(36).slice(2,6);
  set(ref(db,'militia/rooms/'+mlRoom+'/bullets/'+id),{...b,id,ts:Date.now()});
  setTimeout(()=>set(ref(db,'militia/rooms/'+mlRoom+'/bullets/'+id),null),3000);
}
function mlStopOnlineSync(){
  clearInterval(mlSyncInterval);
  if(mlRoom){
    set(ref(db,'militia/rooms/'+mlRoom+'/players/'+state.myId),null);
    off(ref(db,'militia/rooms/'+mlRoom+'/players'));
    off(ref(db,'militia/rooms/'+mlRoom+'/bullets'));
  }
  onlinePlayers={};
}

// ══ Draw ══
function drawBg(ctx,cw,ch){
  ctx.fillStyle='#050d05';
  ctx.fillRect(0,0,cw,ch);
  ctx.strokeStyle='rgba(74,222,128,.025)';
  ctx.lineWidth=1;
  const g=70,sx=-(cam.x%g),sy=-(cam.y%g);
  for(let x=sx;x<cw;x+=g){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,ch);ctx.stroke();}
  for(let y=sy;y<ch;y+=g){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(cw,y);ctx.stroke();}
}

function drawPlat(ctx,p){
  const px=p.x-cam.x,py=p.y-cam.y;
  if(px+p.w<0||px>ctx.canvas.width||py+p.h<0||py>ctx.canvas.height)return;
  ctx.fillStyle=p.c;
  ctx.fillRect(px,py,p.w,p.h);
  if(p.h<50){// Top glow edge on walkable platforms
    ctx.fillStyle='rgba(74,222,128,0.18)';
    ctx.fillRect(px,py,p.w,2);
  }
}

function drawPickup(ctx,pk){
  if(!pk.active)return;
  const px=pk.x-cam.x,py=pk.y-cam.y;
  if(Math.abs(px)>ctx.canvas.width||Math.abs(py)>ctx.canvas.height)return;
  const bob=Math.sin(mlTick*.05+pk.bobOffset)*4;
  const w=WEAPONS[pk.type];
  ctx.save();
  ctx.shadowColor=w.color; ctx.shadowBlur=14;
  ctx.fillStyle=w.color+'22';
  ctx.strokeStyle=w.color+'99';
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.roundRect(px-15,py-15+bob,30,30,6);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur=0;
  ctx.font='18px serif';
  ctx.textAlign='center';
  ctx.fillStyle='#fff';
  ctx.fillText(w.emoji,px,py+8+bob);
  // Ammo label
  ctx.font='7px Orbitron,monospace';
  ctx.fillStyle=w.color;
  ctx.fillText(pk.type.toUpperCase(),px,py+24+bob);
  ctx.restore();
}

function drawPlayer(ctx,p,isMe=false){
  if(p.dead)return;
  const px=p.x-cam.x,py=p.y-cam.y;
  if(px+p.w<-20||px>ctx.canvas.width+20||py+p.h<-20||py>ctx.canvas.height+20)return;
  ctx.save();
  ctx.shadowColor=p.color; ctx.shadowBlur=isMe?14:8;
  // Body
  ctx.fillStyle=p.color;
  ctx.beginPath();
  ctx.roundRect(px,py,p.w,p.h,5);
  ctx.fill();
  // Visor
  ctx.fillStyle='rgba(0,0,0,.55)';
  ctx.beginPath();
  ctx.roundRect(px+4,py+4,p.w-8,12,3);
  ctx.fill();
  // Eye
  const eyeOx=p.facingRight?p.w*.55:p.w*.2;
  ctx.fillStyle='#fff';
  ctx.shadowBlur=6; ctx.shadowColor='#fff';
  ctx.beginPath();
  ctx.arc(px+eyeOx,py+10,2.5,0,Math.PI*2);
  ctx.fill();
  ctx.shadowBlur=0;
  // Gun
  const wc=WEAPONS[p.weapon].color;
  ctx.fillStyle=wc; ctx.shadowColor=wc; ctx.shadowBlur=8;
  const gx=p.facingRight?px+p.w:px-14;
  ctx.fillRect(gx,py+p.h/2-2.5,14,5);
  ctx.shadowBlur=0;
  // Jetpack glow when fueling
  if(p.jetFuel<p.jetMax*.6){
    ctx.fillStyle='rgba(96,165,250,.35)';
    ctx.beginPath();
    ctx.arc(px+p.w/2,py+p.h,6,0,Math.PI*2);
    ctx.fill();
  }
  // Name
  ctx.shadowBlur=0;
  ctx.font='bold 8px Orbitron,monospace';
  ctx.textAlign='center';
  ctx.fillStyle=isMe?'#00f5c4':p.color;
  ctx.fillText((p.name||'Bot').substring(0,8),px+p.w/2,py-12);
  // HP bar
  const hbW=p.w+6,hbX=px-3,hbY=py-7;
  ctx.fillStyle='rgba(0,0,0,.5)';
  ctx.fillRect(hbX,hbY,hbW,4);
  const hpc=p.hp>60?'#4ade80':p.hp>30?'#fbbf24':'#f43f5e';
  ctx.fillStyle=hpc; ctx.shadowColor=hpc; ctx.shadowBlur=4;
  ctx.fillRect(hbX,hbY,hbW*Math.max(0,p.hp/p.maxHp),4);
  ctx.shadowBlur=0;
  ctx.restore();
}

function drawOnlinePlayers(ctx){
  if(!onlinePlayers)return;
  Object.values(onlinePlayers).forEach(pd=>{
    if(pd.id===state.myId||pd.dead)return;
    const px=pd.x-cam.x,py=pd.y-cam.y;
    ctx.save();
    ctx.fillStyle=pd.color||'#a855f7';
    ctx.shadowColor=pd.color||'#a855f7'; ctx.shadowBlur=10;
    ctx.beginPath();
    ctx.roundRect(px,py,28,34,5);
    ctx.fill();
    ctx.shadowBlur=0;
    ctx.font='bold 8px Orbitron,monospace';
    ctx.textAlign='center';
    ctx.fillStyle=pd.color||'#a855f7';
    ctx.fillText((pd.name||'?').substring(0,8),px+14,py-12);
    ctx.restore();
  });
}

function drawBulletFn(ctx,b){
  const bx=b.x-cam.x,by=b.y-cam.y;
  ctx.save();
  ctx.fillStyle=b.color; ctx.shadowColor=b.color; ctx.shadowBlur=8;
  if(b.explosive){
    ctx.beginPath();ctx.arc(bx,by,5,0,Math.PI*2);ctx.fill();
  }else{
    const angle=Math.atan2(b.vy,b.vx);
    ctx.translate(bx,by); ctx.rotate(angle);
    ctx.fillRect(-6,-2,12,4);
  }
  ctx.shadowBlur=0;ctx.restore();
}

function drawParticlesFn(ctx){
  particles=particles.filter(p=>p.life>0);
  for(const p of particles){
    ctx.save();
    ctx.globalAlpha=p.life;
    ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=6;
    ctx.beginPath();ctx.arc(p.x-cam.x,p.y-cam.y,p.sz*p.life,0,Math.PI*2);ctx.fill();
    ctx.restore();
    p.x+=p.vx; p.y+=p.vy; p.vy+=.12; p.life-=.038;
  }
}

function drawHUD(ctx,cw,ch){
  if(!player)return;
  const w=WEAPONS[player.weapon];
  ctx.save();
  // Bottom bar
  ctx.fillStyle='rgba(5,13,5,.9)';
  ctx.fillRect(0,ch-66,cw,66);
  ctx.strokeStyle='rgba(74,222,128,.15)';
  ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,ch-66);ctx.lineTo(cw,ch-66);ctx.stroke();

  // HP
  ctx.fillStyle='rgba(255,255,255,.3)';
  ctx.font='7px Orbitron,monospace';
  ctx.textAlign='left';
  ctx.fillText('HP',18,ch-48);
  ctx.fillStyle='rgba(0,0,0,.5)';
  ctx.fillRect(18,ch-43,144,11);
  const hpc=player.hp>60?'#4ade80':player.hp>30?'#fbbf24':'#f43f5e';
  ctx.fillStyle=hpc; ctx.shadowColor=hpc; ctx.shadowBlur=6;
  ctx.fillRect(18,ch-43,144*Math.max(0,player.hp/player.maxHp),11);
  ctx.shadowBlur=0;
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 8px Orbitron,monospace';
  ctx.fillText(Math.ceil(Math.max(0,player.hp)),90,ch-33);

  // Fuel bar
  ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,.3)'; ctx.font='7px Orbitron,monospace';
  ctx.fillText('FUEL',18,ch-18);
  ctx.fillStyle='rgba(0,0,0,.5)';
  ctx.fillRect(52,ch-24,110,7);
  ctx.fillStyle='#60a5fa'; ctx.shadowColor='#60a5fa'; ctx.shadowBlur=5;
  ctx.fillRect(52,ch-24,110*(player.jetFuel/player.jetMax),7);
  ctx.shadowBlur=0;

  // Weapon slots
  const slotW=46,slotH=46,startX=cw/2-((slotW+4)*4)/2;
  Object.entries(WEAPONS).forEach(([wk,wv],i)=>{
    const sx=startX+i*(slotW+4),sy=ch-slotH-4;
    const active=player.weapon===wk;
    const hasA=player.ammo[wk]===Infinity||player.ammo[wk]>0;
    ctx.globalAlpha=hasA?1:.3;
    ctx.fillStyle=active?wv.color+'22':'rgba(255,255,255,.04)';
    ctx.strokeStyle=active?wv.color+'bb':'rgba(255,255,255,.12)';
    ctx.lineWidth=active?1.5:1;
    ctx.beginPath();ctx.roundRect(sx,sy,slotW,slotH,6);ctx.fill();ctx.stroke();
    ctx.font='20px serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.shadowBlur=0;
    ctx.fillText(wv.emoji,sx+slotW/2,sy+slotH/2+6);
    ctx.font='7px Orbitron,monospace';
    ctx.fillStyle=active?wv.color:'rgba(255,255,255,.2)';
    ctx.fillText(i+1,sx+slotW/2,sy+slotH-4);
    ctx.globalAlpha=1;
  });

  // Kills / Deaths
  ctx.textAlign='right';
  ctx.fillStyle='#4ade80'; ctx.shadowColor='#4ade80'; ctx.shadowBlur=8;
  ctx.font='bold 26px Orbitron,monospace';
  ctx.fillText(kills,cw-20,ch-38);
  ctx.shadowBlur=0;
  ctx.fillStyle='rgba(255,255,255,.25)'; ctx.font='7px Orbitron,monospace';
  ctx.fillText('KILLS',cw-20,ch-26);
  ctx.fillStyle='#f43f5e'; ctx.font='bold 16px Orbitron,monospace';
  ctx.fillText(deaths,cw-20,ch-10);
  ctx.fillStyle='rgba(255,255,255,.2)'; ctx.font='7px Orbitron,monospace';
  ctx.fillText('DEATHS',cw-20,ch-1);

  // Respawn msg
  if(player.dead){
    const secs=Math.max(0,Math.ceil((player.respawnAt-mlTick)/60));
    ctx.textAlign='center';
    ctx.fillStyle='rgba(0,0,0,.6)';
    ctx.fillRect(cw/2-180,ch/2-50,360,70);
    ctx.fillStyle='#f43f5e'; ctx.font='bold 20px Orbitron,monospace';
    ctx.shadowColor='#f43f5e'; ctx.shadowBlur=10;
    ctx.fillText('KILLED',cw/2,ch/2-22);
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,.6)'; ctx.font='13px Orbitron,monospace';
    ctx.fillText('RESPAWNING IN '+secs+'s',cw/2,ch/2+6);
  }

  ctx.restore();
}

function drawMinimap(ctx,cw,ch){
  const mw=110,mh=55,mx=cw-mw-10,my=10;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.65)';
  ctx.strokeStyle='rgba(74,222,128,.2)';
  ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(mx,my,mw,mh,4);ctx.fill();ctx.stroke();
  ctx.clip();
  // Platforms
  for(const p of platforms){
    if(p.h>60)continue;
    ctx.fillStyle='rgba(74,222,128,.2)';
    ctx.fillRect(mx+p.x/WORLD_W*mw,my+p.y/WORLD_H*mh,Math.max(1,p.w/WORLD_W*mw),1);
  }
  // Players
  for(const p of[player,...bots].filter(Boolean)){
    if(p.dead)continue;
    ctx.fillStyle=p===player?'#00f5c4':p.color;
    ctx.shadowColor=p===player?'#00f5c4':p.color;
    ctx.shadowBlur=4;
    ctx.beginPath();ctx.arc(mx+p.x/WORLD_W*mw,my+p.y/WORLD_H*mh,p===player?3:2,0,Math.PI*2);ctx.fill();
  }
  // Online players
  if(onlinePlayers){
    Object.values(onlinePlayers).forEach(pd=>{
      if(pd.id===state.myId)return;
      ctx.fillStyle=pd.color||'#a855f7';
      ctx.shadowColor=pd.color||'#a855f7'; ctx.shadowBlur=4;
      ctx.beginPath();ctx.arc(mx+pd.x/WORLD_W*mw,my+pd.y/WORLD_H*mh,2,0,Math.PI*2);ctx.fill();
    });
  }
  ctx.shadowBlur=0;ctx.restore();
}

// ══ Game Loop ══
function mlLoop(){
  if(!mlActive){cancelAnimationFrame(mlRAF);return;}
  mlRAF=requestAnimationFrame(mlLoop);
  mlTick++;

  const canvas=document.getElementById('militia-canvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const cw=canvas.width,ch=canvas.height;

  handleInput();
  for(const b of bots)updateBot(b);
  updateBullets();
  updatePickups();
  updateRespawns();
  updateCam(cw,ch);

  drawBg(ctx,cw,ch);
  for(const p of platforms)drawPlat(ctx,p);
  for(const pk of pickups)drawPickup(ctx,pk);
  for(const b of bullets)drawBulletFn(ctx,b);
  drawParticlesFn(ctx);

  // Draw all actors
  for(const bot of bots)drawPlayer(ctx,bot,false);
  if(mlMode==='online')drawOnlinePlayers(ctx);
  if(player)drawPlayer(ctx,player,true);

  drawHUD(ctx,cw,ch);
  drawMinimap(ctx,cw,ch);
}

// ══ Resize ══
function resizeCanvas(){
  const c=document.getElementById('militia-canvas');
  if(!c)return;
  c.width=window.innerWidth;
  c.height=window.innerHeight;
}

// ══ Input Wiring ══
function setupInput(){
  const canvas=document.getElementById('militia-canvas');
  if(mlKeyDown){document.removeEventListener('keydown',mlKeyDown);document.removeEventListener('keyup',mlKeyUp);}
  if(mlMouseMove&&canvas){canvas.removeEventListener('mousemove',mlMouseMove);canvas.removeEventListener('mousedown',mlMouseDown);canvas.removeEventListener('mouseup',mlMouseUp);}

  mlKeyDown=e=>{
    keys[e.key]=true;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
  };
  mlKeyUp=e=>{keys[e.key]=false;};
  mlMouseMove=e=>{
    const r=canvas.getBoundingClientRect();
    mouse.x=(e.clientX-r.left)*(canvas.width/r.width);
    mouse.y=(e.clientY-r.top)*(canvas.height/r.height);
  };
  mlMouseDown=()=>{mouse.down=true;};
  mlMouseUp=()=>{mouse.down=false;};

  document.addEventListener('keydown',mlKeyDown);
  document.addEventListener('keyup',mlKeyUp);
  if(canvas){
    canvas.addEventListener('mousemove',mlMouseMove);
    canvas.addEventListener('mousedown',mlMouseDown);
    canvas.addEventListener('mouseup',mlMouseUp);
  }

  // Touch controls
  if(canvas){
    let touchFireInterval=null;
    canvas.addEventListener('touchstart',e=>{
      e.preventDefault();
      const t=e.touches[0];
      const r=canvas.getBoundingClientRect();
      const tx=(t.clientX-r.left)*(canvas.width/r.width);
      const ty=(t.clientY-r.top)*(canvas.height/r.height);
      if(tx<canvas.width/2){
        // Left half = movement
        if(ty<canvas.height/2)keys['w']=true;
        else keys[ty>canvas.height*.75?'a':'a']=true;
      }else{
        // Right half = shoot/jet
        mouse.x=tx;mouse.y=ty;mouse.down=true;
        keys[' ']=ty<canvas.height/2;
      }
    },{passive:false});
    canvas.addEventListener('touchend',e=>{
      e.preventDefault();
      keys['w']=false;keys['a']=false;keys['d']=false;keys[' ']=false;
      mouse.down=false;
    },{passive:false});
    canvas.addEventListener('touchmove',e=>{
      e.preventDefault();
      const t=e.touches[0];
      const r=canvas.getBoundingClientRect();
      const tx=(t.clientX-r.left)*(canvas.width/r.width);
      const ty=(t.clientY-r.top)*(canvas.height/r.height);
      if(tx>canvas.width/2){mouse.x=tx;mouse.y=ty;}
    },{passive:false});
  }
}

// ══ Start Game ══
function startGame(mode,botCount,difficulty,room){
  mlMode=mode;mlRoom=room||null;mlDiff=difficulty;
  mlTick=0;kills=0;deaths=0;bullets=[];particles=[];onlinePlayers={};
  buildMap();spawnPickups();

  player=makePlayer(state.myId||'local','You','#00f5c4');

  bots=[];
  if(mode==='ai'){
    for(let i=0;i<botCount;i++){
      bots.push(makePlayer('bot_'+i,BOT_NAMES[i%BOT_NAMES.length],BOT_COLS[i%BOT_COLS.length],true));
    }
  }

  resizeCanvas();
  document.getElementById('militia-lobby').style.display='none';
  document.getElementById('militia-game').style.display='block';
  setupInput();

  if(mode==='online')mlStartOnlineSync();

  mlActive=true;
  cancelAnimationFrame(mlRAF);
  mlLoop();

  window.addEventListener('resize',resizeCanvas);
}

// ══ UI State ══
function showMlPanel(id){
  ['ml-mode-select','ml-ai-panel','ml-online-panel'].forEach(x=>{
    const el=document.getElementById(x);
    if(el)el.style.display=x===id?'flex':'none';
  });
}

// ══ Exports ══
export function openMilitia(){
  showScreen('militia');
  document.getElementById('militia-lobby').style.display='flex';
  document.getElementById('militia-game').style.display='none';
  showMlPanel('ml-mode-select');
}

export function leaveMilitia(){
  mlActive=false;
  cancelAnimationFrame(mlRAF);
  mlStopOnlineSync();
  if(mlKeyDown){document.removeEventListener('keydown',mlKeyDown);document.removeEventListener('keyup',mlKeyUp);}
  window.removeEventListener('resize',resizeCanvas);
  showScreen('hub');
}

export function mlBackLobby(){
  mlActive=false;
  cancelAnimationFrame(mlRAF);
  mlStopOnlineSync();
  window.removeEventListener('resize',resizeCanvas);
  document.getElementById('militia-lobby').style.display='flex';
  document.getElementById('militia-game').style.display='none';
  showMlPanel('ml-mode-select');
}

export function mlPickAI(){showMlPanel('ml-ai-panel');}
export function mlPickOnline(){showMlPanel('ml-online-panel');}
export function mlBackMode(){showMlPanel('ml-mode-select');}

export function mlStartAI(bots,diff){
  startGame('ai',bots,diff,null);
}

export async function mlCreateRoom(){
  const code=Math.random().toString(36).slice(2,6).toUpperCase();
  mlRoom=code;mlIsHost=true;
  const statusEl=document.getElementById('ml-online-status');
  if(statusEl)statusEl.textContent='Room created: '+code+' — waiting for players…';
  const codeEl=document.getElementById('ml-room-code-disp');
  if(codeEl)codeEl.textContent=code;
  await set(ref(db,'militia/rooms/'+code+'/meta'),{host:state.myId,created:Date.now()});
}

export async function mlJoinRoom(){
  const inp=document.getElementById('ml-join-input');
  if(!inp||!inp.value.trim())return;
  const code=inp.value.trim().toUpperCase();
  const meta=await fbGet('militia/rooms/'+code+'/meta');
  const statusEl=document.getElementById('ml-online-status');
  if(!meta){if(statusEl)statusEl.textContent='Room not found.';return;}
  mlRoom=code;mlIsHost=false;
  if(statusEl)statusEl.textContent='Joined room '+code+'!';
  setTimeout(()=>startGame('online',0,2,code),800);
}

export function mlStartOnline(){
  if(!mlRoom){const el=document.getElementById('ml-online-status');if(el)el.textContent='Create or join a room first.';return;}
  startGame('online',0,2,mlRoom);
}
