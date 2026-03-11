// ══ BOB ARENA ══
import { db, ref, set, update, fbSet, fbGet, fbListen, fbOff, fbPush } from './firebase.js';
import { state, showScreen, esc, fmt } from './state.js';

export function openBlob(){showScreen('blob');initBlobLobby();}
// (openTrivia/leaveTrivia defined in main.js)
export function leaveBlob(){
  blobActive=false;blobIntervals.forEach(clearInterval);blobIntervals=[];
  try{fbSet('players/'+state.myId+'/alive',false);fbSet('players/'+state.myId+'/ts',Date.now()-60000);fbOff('kills/'+state.myId);}catch(e){}
  fbOff('players');fbOff('chat');
  document.getElementById('blob-lobby').style.display='flex';
  document.getElementById('game').style.display='none';
  showScreen('hub');
}
// (openTrivia/leaveTrivia defined in main.js)
// (openTrivia/leaveTrivia defined in main.js)
// (openTrivia/leaveTrivia defined in main.js)

// ══════════════════════════════════════════════════
// ══ BOB ARENA ══
// ══════════════════════════════════════════════════
const WORLD=12000;
let blobCanvas,blobCtx,mmc,mmx;
let cam={x:0,y:0,z:1};
let mouse={x:0,y:0};
let keys={};
let gover=false,gulping=false,gulpEnemy=null,pVisible=true;
let zoomActive=false,zoomReady=true,turboActive=false,turboReady=true;
let blobTab='global';
let blobActive=false;
let blobIntervals=[];
let blobLoopStarted=false;   // ← only ONE raf loop ever
let blobLBInterval=null;     // ← tracked separately so it can be cleared
let inputListenersAdded=false; // ← event listeners added once only

const emojis=["😎","😈","👽","😂","🐵","🐼","🦊","🫡","😠","😁","🤣","🥲","🤔","😮","😭","😡","🤢","🤡","🥸","🤩","🥳","😤","🫠","🧐","🤖","👾","🫶","🐸","🦁","🐯"];
const blobCols=["#00f5c4","#f43f5e","#60a5fa","#f59e0b","#a855f7","#34d399","#fb923c","#e879f9","#4ade80","#38bdf8"];
const foodCols=["#55ff88","#ffdd55","#ff77aa","#66ffff","#ffaa33","#ff6655","#aaaaff","#ff9966"];
const tagCols=['#00f5c4','#f43f5e','#60a5fa','#f59e0b','#e879f9','#4ade80','#fb923c','#ffffff'];
const skinDefs=[{id:'none',label:'Clean'},{id:'stripes',label:'Stripes'},{id:'dots',label:'Dots'},{id:'gradient',label:'Dual'},{id:'diamond',label:'Geo'}];
const badges=['','★ ','👑 ','⚡ ','🔥 ','💎 ','🎯 '];

let myName='',myRoom='',myEmoji='😎',myColor=blobCols[0];
let mySkin='none',myTagColor='#00f5c4',myTagBadge='',mySymbol='';
let mySpeed=2.4;
let player={},bots=[],foods=[],viruses=[],netPlayers=[];
let bid=1,lbData={};
let myBest=0;
let recentKills=new Set();

// Interpolation targets for smooth net-player movement
let netInterp={}; // {uid: {x,y,r, tx,ty,tr, ts}}

document.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;});

// ── Lobby particles ──
(function(){
  const lc=document.getElementById('lobby-canvas'),lx=lc.getContext('2d');
  lc.width=innerWidth;lc.height=innerHeight;
  const pts=Array.from({length:80},()=>({x:Math.random()*lc.width,y:Math.random()*lc.height,
    r:Math.random()*2+.5,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4,
    c:Math.random()<.5?'rgba(0,245,196,':'rgba(96,165,250,'}));
  function draw(){lx.clearRect(0,0,lc.width,lc.height);pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;
    if(p.x<0)p.x=lc.width;if(p.x>lc.width)p.x=0;if(p.y<0)p.y=lc.height;if(p.y>lc.height)p.y=0;
    lx.beginPath();lx.arc(p.x,p.y,p.r,0,Math.PI*2);lx.fillStyle=p.c+'.5)';lx.fill();});
    requestAnimationFrame(draw);}
  draw();
})();

// ── Lobby init ──
const speedLabels={1:'SLOW',1.5:'SLOW',2:'NORMAL',2.4:'NORMAL',2.5:'FAST',3:'FAST',3.5:'FASTER',4:'TURBO',4.5:'TURBO',5:'MAX'};
function updateSpeedSlider(val){
  val=parseFloat(val);mySpeed=val;
  const sl=document.getElementById('speed-slider');
  sl.style.setProperty('--pct',((val-1)/4*100).toFixed(1)+'%');
  document.getElementById('speed-val-label').textContent=speedLabels[val]||'CUSTOM';
}

function initBlobLobby(){
  myName=state.myDisplayName;
  const ni=document.getElementById('inp-name');if(ni)ni.value=myName;
  const rd=document.getElementById('room-display');if(rd)rd.style.display='none';
  document.getElementById('inp-room').value='';
  const sl=document.getElementById('speed-slider');if(sl){sl.value=mySpeed;updateSpeedSlider(mySpeed);}

  const ep=document.getElementById('emoji-pick');
  if(ep.children.length===0){
    emojis.forEach((em,i)=>{
      const b=document.createElement('button');
      b.className='ep-btn'+(i===0?' sel':'');b.textContent=em;
      b.onclick=()=>{myEmoji=em;mySymbol='';
        document.querySelectorAll('.ep-btn').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');updatePreviews();};
      ep.appendChild(b);
    });
    // Colors
    const cr=document.getElementById('blob-color-row');
    blobCols.forEach((col,i)=>{
      const d=document.createElement('div');d.className='col-swatch'+(i===0?' sel':'');
      d.style.background=col;d.onclick=()=>{myColor=col;document.querySelectorAll('.col-swatch').forEach(x=>x.classList.remove('sel'));d.classList.add('sel');updatePreviews();};
      cr.appendChild(d);
    });
    // Skins
    const sr=document.getElementById('skin-row');
    skinDefs.forEach((sk,i)=>{
      const btn=document.createElement('button');btn.className='skin-btn'+(i===0?' sel':'');
      const cv=document.createElement('canvas');cv.width=56;cv.height=40;
      drawSkinThumb(cv.getContext('2d'),sk.id,56,40);btn.appendChild(cv);
      const lbl=document.createElement('div');lbl.style.cssText='font-size:7px;color:rgba(255,255,255,.4);text-align:center;font-family:Orbitron,monospace;letter-spacing:1px;';
      lbl.textContent=sk.label;btn.appendChild(lbl);
      btn.onclick=()=>{mySkin=sk.id;document.querySelectorAll('.skin-btn').forEach(x=>x.classList.remove('sel'));btn.classList.add('sel');updatePreviews();};
      sr.appendChild(btn);
    });
    // Tag colors
    const tc=document.getElementById('tag-color-row');
    tagCols.forEach((col,i)=>{
      const d=document.createElement('div');d.className='tag-col'+(i===0?' sel':'');d.style.background=col;
      d.onclick=()=>{myTagColor=col;document.querySelectorAll('.tag-col').forEach(x=>x.classList.remove('sel'));d.classList.add('sel');updatePreviews();};
      tc.appendChild(d);
    });
    // Badges
    const tb=document.getElementById('tag-badge-row');
    badges.forEach((b,i)=>{
      const btn=document.createElement('button');btn.className='tag-badge'+(i===0?' sel':'');
      btn.textContent=i===0?'None':b+(myName||'Name');
      btn.onclick=()=>{myTagBadge=b;document.querySelectorAll('.tag-badge').forEach(x=>x.classList.remove('sel'));btn.classList.add('sel');updatePreviews();};
      tb.appendChild(btn);
    });
    document.addEventListener('input',e=>{if(e.target.id==='inp-name')updatePreviews();},{once:false});
  }
  myColor=blobCols[0];updatePreviews();
  // Track this interval so we can clear it
  if(blobLBInterval)clearInterval(blobLBInterval);
  loadBlobLB();
  blobLBInterval=setInterval(loadBlobLB,8000);
}

function drawSkinThumb(cx,skin,w,h){
  cx.clearRect(0,0,w,h);cx.save();cx.beginPath();cx.arc(w/2,h/2,Math.min(w,h)/2-2,0,Math.PI*2);cx.clip();
  applySkin(cx,skin,'#00f5c4',w/2,h/2,Math.min(w,h)/2-2);cx.restore();
  cx.strokeStyle='rgba(0,245,196,.4)';cx.lineWidth=1.5;
  cx.beginPath();cx.arc(w/2,h/2,Math.min(w,h)/2-2,0,Math.PI*2);cx.stroke();
}

function applySkin(cx,skin,col,bx,by,r){
  if(skin==='none'){cx.fillStyle=col;cx.beginPath();cx.arc(bx,by,r,0,Math.PI*2);cx.fill();return;}
  if(skin==='stripes'){cx.fillStyle=col+'bb';cx.fillRect(bx-r,by-r,r*2,r*2);
    cx.strokeStyle='rgba(255,255,255,.22)';cx.lineWidth=r*.18;
    for(let i=-r*2;i<r*2;i+=r*.32){cx.beginPath();cx.moveTo(bx+i,by-r*2);cx.lineTo(bx+i+r*2,by+r*2);cx.stroke();}return;}
  if(skin==='dots'){cx.fillStyle=col+'cc';cx.fillRect(bx-r,by-r,r*2,r*2);cx.fillStyle='rgba(255,255,255,.25)';
    const sp=r*.36;for(let dx=-r;dx<r;dx+=sp)for(let dy=-r;dy<r;dy+=sp){
      if(Math.hypot(dx,dy)<r*.9){cx.beginPath();cx.arc(bx+dx,by+dy,r*.07,0,Math.PI*2);cx.fill();}}return;}
  if(skin==='gradient'){const g2=cx.createLinearGradient(bx-r,by-r,bx+r,by+r);
    g2.addColorStop(0,col);g2.addColorStop(1,'#7c3aed');cx.fillStyle=g2;cx.fillRect(bx-r,by-r,r*2,r*2);return;}
  if(skin==='diamond'){cx.fillStyle=col+'aa';cx.fillRect(bx-r,by-r,r*2,r*2);cx.strokeStyle='rgba(255,255,255,.18)';cx.lineWidth=1;
    const ds=r*.38;for(let dx=-r;dx<r;dx+=ds)for(let dy=-r;dy<r;dy+=ds){
      cx.beginPath();cx.moveTo(bx+dx+ds/2,by+dy);cx.lineTo(bx+dx+ds,by+dy+ds/2);
      cx.lineTo(bx+dx+ds/2,by+dy+ds);cx.lineTo(bx+dx,by+dy+ds/2);cx.closePath();cx.stroke();}return;}
}

function lc2(hex,a){try{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return'rgb('+Math.min(255,r+a)+','+Math.min(255,g+a)+','+Math.min(255,b+a)+')';}catch{return hex;}}
function dc2(hex,a){try{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return'rgb('+Math.max(0,r-a)+','+Math.max(0,g-a)+','+Math.max(0,b-a)+')';}catch{return hex;}}

function updatePreviews(){
  ['blob-preview','blob-preview2'].forEach(id=>{
    const cv=document.getElementById(id);if(!cv)return;
    const cx=cv.getContext('2d'),r=38,bx=45,by=45;
    cx.clearRect(0,0,90,90);
    cx.shadowBlur=18;cx.shadowColor=myColor;
    const g=cx.createRadialGradient(bx-r*.3,by-r*.35,r*.05,bx,by,r);
    g.addColorStop(0,lc2(myColor,55));g.addColorStop(.55,myColor);g.addColorStop(1,dc2(myColor,50));
    cx.beginPath();cx.arc(bx,by,r,0,Math.PI*2);cx.fillStyle=g;cx.fill();cx.shadowBlur=0;
    if(mySkin!=='none'){cx.save();cx.beginPath();cx.arc(bx,by,r,0,Math.PI*2);cx.clip();applySkin(cx,mySkin,myColor,bx,by,r);cx.restore();}
    const sh=cx.createRadialGradient(bx-r*.38,by-r*.4,0,bx-r*.2,by-r*.25,r*.52);
    sh.addColorStop(0,'rgba(255,255,255,.38)');sh.addColorStop(1,'rgba(255,255,255,0)');
    cx.beginPath();cx.arc(bx,by,r,0,Math.PI*2);cx.fillStyle=sh;cx.fill();
    const face=mySymbol||(myEmoji||'😎');
    const isT=(typeof face==='string'&&face.length<=2&&!/\p{Emoji}/u.test(face));
    cx.font=isT?'bold 28px Orbitron,monospace':'30px Arial';cx.textAlign='center';cx.textBaseline='middle';
    cx.fillStyle=isT?myTagColor:'#fff';cx.fillText(face,bx,by+1);
    const nm=document.getElementById('inp-name')?.value||'You';
    cx.font='bold 9px Orbitron,monospace';cx.fillStyle=myTagColor;cx.shadowBlur=8;cx.shadowColor=myTagColor;
    cx.fillText((myTagBadge||'')+nm,bx,by+r+12);cx.shadowBlur=0;
  });
}

async function loadBlobLB(){
  const lb=await fbGet('players')||{};
  const rows=Object.values(lb).sort((a,b)=>(b.best||0)-(a.best||0)).slice(0,6);
  const medals=['#1','#2','#3'];
  document.getElementById('lobby-lb').innerHTML=rows.length?rows.map((r,i)=>
    '<div class="lobby-lb-row"><span class="lr-rank">'+(medals[i]||i+1)+'</span><span class="lr-emoji">'+(r.emoji||'🫧')+'</span><span class="lr-name">'+esc(r.name)+'</span><span class="lr-score">'+fmt(r.best||0)+'</span></div>'
  ).join(''):'<div style="text-align:center;color:rgba(255,255,255,.18);padding:16px;font-size:12px">No records yet!</div>';
}

function genCode(){return Math.random().toString(36).slice(2,8).toUpperCase();}

export function enterRoom(){
  const n=document.getElementById('inp-name').value.trim();
  if(!n){flashInp('inp-name');return;}
  let r=document.getElementById('inp-room').value.trim().toUpperCase();
  if(!r){r=genCode();document.getElementById('inp-room').value=r;}
  document.getElementById('room-display-code').textContent=r;
  document.getElementById('room-display').style.display='block';
  setTimeout(()=>startBlobGame(n,r),900);
}
export function genAndFill(){
  const code=genCode();
  document.getElementById('inp-room').value=code;
  document.getElementById('room-display-code').textContent=code;
  document.getElementById('room-display').style.display='block';
}
export function toggleBlobStyle(el){
  const body=el.nextElementSibling;
  const open=body.style.display==='none';
  body.style.display=open?'block':'none';
  el.querySelector('.lstyle-arrow').classList.toggle('open',open);
  if(open)updatePreviews();
}
export function createRoom(){enterRoom();}
export function joinRoom(){enterRoom();}
export function lobbyTab(){}
function flashInp(id){const el=document.getElementById(id);if(!el)return;el.style.borderColor='rgba(244,63,94,.7)';setTimeout(()=>el.style.borderColor='',1200);}

async function startBlobGame(name,room){
  myName=name;myRoom=room;
  // Reset all game state cleanly
  gover=false;gulping=false;gulpEnemy=null;pVisible=true;
  turboActive=false;turboReady=true;zoomActive=false;zoomReady=true;
  recentKills=new Set();netInterp={};
  bots=[];foods=[];viruses=[];
  keys={};

  document.getElementById('blob-lobby').style.display='none';
  document.getElementById('game').style.display='block';
  document.getElementById('room-code').textContent=room;

  blobCanvas=document.getElementById('canvas');
  blobCtx=blobCanvas.getContext('2d');
  blobCanvas.width=innerWidth;blobCanvas.height=innerHeight;
  mmc=document.getElementById('minimap');mmx=mmc.getContext('2d');

  initPlayer();spawnFood(4320);spawnBots(67);spawnViruses(43);
  setupBlobInput(); // safe - only registers once

  blobActive=true;

  // Clear old intervals
  blobIntervals.forEach(clearInterval);blobIntervals=[];

  // HUD update interval
  blobIntervals.push(setInterval(()=>{
    if(gover)return;
    document.getElementById('h-score').textContent=fmt(player.score);
    document.getElementById('h-lvl').textContent=player.level;
    const hs=document.getElementById('h-speed');if(hs)hs.textContent=player.speed.toFixed(1)+'x';
  },300));

  await blobSyncStart();
  blobSeenIds=new Set(); // reset so old chat messages don't replay
  blobChatStart();

  blobSysMsg(esc(myName)+' entered the arena!');

  // Start single game loop if not already running
  if(!blobLoopStarted){blobLoopStarted=true;blobGameLoop();}
}

function initPlayer(){
  const spawn=findClearSpawn();
  player={x:spawn.x,y:spawn.y,r:30,score:0,speed:mySpeed,
    emoji:myEmoji,symbol:mySymbol,color:myColor,skin:mySkin,
    tagColor:myTagColor,tagBadge:myTagBadge,name:myName,isPlayer:true,level:1};
  cam={x:player.x-innerWidth/2,y:player.y-innerHeight/2,z:0.72};
}

function findClearSpawn(){
  // Try to spawn away from other players
  for(let attempt=0;attempt<20;attempt++){
    const x=WORLD*0.1+Math.random()*WORLD*0.8;
    const y=WORLD*0.1+Math.random()*WORLD*0.8;
    const tooClose=netPlayers.some(p=>Math.hypot(p.x-x,p.y-y)<300);
    if(!tooClose)return{x,y};
  }
  return{x:WORLD/2+(Math.random()-.5)*800,y:WORLD/2+(Math.random()-.5)*800};
}

// ── Input — registered ONCE ──
function setupBlobInput(){
  if(inputListenersAdded)return;
  inputListenersAdded=true;

  window.addEventListener('resize',()=>{
    if(blobCanvas){blobCanvas.width=innerWidth;blobCanvas.height=innerHeight;}
  });

  document.addEventListener('keydown',e=>{
    // Don't capture keys when typing in inputs
    if(document.activeElement&&(document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='TEXTAREA'))return;
    keys[e.code]=true;
    if(e.code==='Space')e.preventDefault(); // prevent page scroll
    if(gover&&e.code==='Enter')restartGame();
    if(e.code==='KeyQ'&&zoomReady&&!gover)doZoom();
  });

  document.addEventListener('keyup',e=>{
    keys[e.code]=false;
  });
}

function doZoom(){
  zoomActive=true;zoomReady=false;setSk('sk-q','act');
  setTimeout(()=>{zoomActive=false;setSk('sk-q','cd');},5000);
  setTimeout(()=>{zoomReady=true;setSk('sk-q','rdy');},30000);
  blobNotif('Zoom active!');
}
function setSk(id,cls){const el=document.getElementById(id);if(el)el.className='sk '+cls;}

// ── Sync ──
let blobSeenIds=new Set();

async function blobSyncStart(){
  // Clear any stale kill event first
  try{await set(ref(db,'kills/'+state.myId),null);}catch(e){}

  // Write full profile
  await fbSet('players/'+state.myId,{
    id:state.myId,name:myName,emoji:myEmoji,symbol:mySymbol||'',color:myColor,
    skin:mySkin,tagColor:myTagColor,tagBadge:myTagBadge||'',room:myRoom,
    score:0,best:myBest,
    x:Math.round(player.x),y:Math.round(player.y),r:30,
    ts:Date.now(),alive:true
  });

  // Listen for all players
  fbListen('players',snap=>{
    if(!snap)return;
    const now=Date.now();
    lbData=snap;
    const rawPlayers=Object.values(snap).filter(p=>
      p.id&&p.id!==state.myId&&p.room===myRoom&&p.alive===true&&(now-p.ts)<8000
    );

    // Update interpolation targets
    rawPlayers.forEach(p=>{
      if(!netInterp[p.id]){
        netInterp[p.id]={x:p.x,y:p.y,r:p.r||30,tx:p.x,ty:p.y,tr:p.r||30,...p};
      } else {
        netInterp[p.id].tx=p.x;
        netInterp[p.id].ty=p.y;
        netInterp[p.id].tr=p.r||30;
        // Copy non-pos fields
        netInterp[p.id].name=p.name;netInterp[p.id].emoji=p.emoji;
        netInterp[p.id].color=p.color;netInterp[p.id].tagColor=p.tagColor;
        netInterp[p.id].tagBadge=p.tagBadge;netInterp[p.id].score=p.score;
      }
    });
    // Remove players who left
    const activeIds=new Set(rawPlayers.map(p=>p.id));
    Object.keys(netInterp).forEach(id=>{if(!activeIds.has(id))delete netInterp[id];});

    netPlayers=Object.values(netInterp);
    const rc=netPlayers.length+1;
    document.getElementById('h-players').textContent=rc;
    document.getElementById('room-players').textContent=rc;
    updateBlobLB();
  });

  // Listen for kill events (being eaten by another player)
  fbListen('kills/'+state.myId,data=>{
    if(data&&data.ts&&(Date.now()-data.ts)<6000&&!gover&&!gulping){
      blobSysMsg(esc(myName)+' was eaten by '+esc(data.killer||'someone')+'!');
      doGulp({x:data.kx||player.x+60,y:data.ky||player.y+60});
    }
  });

  // Fast position sync: batch all fields in one update()
  blobIntervals.push(setInterval(async()=>{
    if(gover||!blobActive)return;
    try{
      await update(ref(db,'players/'+state.myId),{
        x:Math.round(player.x),y:Math.round(player.y),
        r:Math.round(player.r),ts:Date.now()
      });
    }catch(e){}
  },150));

  // Score sync every 3s
  blobIntervals.push(setInterval(async()=>{
    if(gover||!blobActive)return;
    myBest=Math.max(myBest,player.score);
    try{
      await update(ref(db,'players/'+state.myId),{
        score:Math.round(player.score),best:myBest
      });
    }catch(e){}
  },3000));
}

function blobChatStart(){
  fbListen('chat',snap=>{
    if(!snap)return;const el=document.getElementById('chat-msgs');
    Object.values(snap).sort((a,b)=>a.ts-b.ts).filter(m=>!blobSeenIds.has(m.id)).forEach(m=>{
      blobSeenIds.add(m.id);const d=document.createElement('div');
      d.className='cmsg'+(m.sys?' sys':'');
      if(m.sys)d.innerHTML='<span class="ct">'+esc(m.text)+'</span>';
      else d.innerHTML='<span class="cn" style="color:'+(m.color||'#fff')+'">'+esc(m.user)+'</span> <span class="ct">'+esc(m.text)+'</span>';
      el.appendChild(d);});el.scrollTop=el.scrollHeight;
  });
}
export async function sendChat(){
  const inp=document.getElementById('chat-inp'),txt=inp.value.trim();if(!txt)return;inp.value='';
  await fbPush('chat',{id:Date.now()+state.myId,user:myName,text:txt,color:myColor,sys:false,ts:Date.now()});
}
async function blobSysMsg(txt){await fbPush('chat',{id:Date.now()+'sys'+state.myId,text:txt,sys:true,ts:Date.now()});}
export function chatKey(e){e.stopPropagation();if(e.key==='Enter')sendChat();}

// ── Leaderboard ──
export function setTab(t){blobTab=t;['global','room','friends'].forEach(x=>{document.getElementById('tab-'+x).className='sp-tab'+(x===t?' on':'');});updateBlobLB();}
function updateBlobLB(){
  const el=document.getElementById('lb-list');
  if(blobTab==='friends'){el.innerHTML=renderFriendsBlob();return;}
  const now=Date.now();
  let entries=Object.values(lbData).filter(p=>(now-p.ts)<10000&&p.alive===true);
  if(blobTab==='room')entries=entries.filter(p=>p.room===myRoom);
  const botEnt=bots.sort((a,b)=>b.score-a.score).slice(0,4).map(b=>({id:'b'+b.id,name:'Bot',emoji:b.emoji,color:b.color||'#888',score:b.score,room:myRoom}));
  entries=[...entries,...botEnt].sort((a,b)=>b.score-a.score);
  let myIdx=entries.findIndex(e=>e.id===state.myId);
  if(myIdx<0){entries.push({id:state.myId,name:myName,emoji:myEmoji,color:myColor,score:player.score,room:myRoom});entries.sort((a,b)=>b.score-a.score);myIdx=entries.findIndex(e=>e.id===state.myId);}
  document.getElementById('h-rank').textContent='#'+(myIdx+1);
  const medals=['🥇','🥈','🥉'];
  el.innerHTML=entries.slice(0,50).map((e,i)=>{const me=e.id===state.myId;
    return'<div class="lbe'+(me?' mine':'')+'"><div class="lbe-num">'+(medals[i]||i+1)+'</div><div class="lbe-em">'+(e.emoji||'○')+'</div><div class="lbe-info"><div class="lbe-name" style="color:'+(me?'var(--c1)':e.color||'#fff')+'">'+esc(e.name)+(me?' ◀':'')+'</div>'+(blobTab==='global'?'<div class="lbe-tag">'+(e.room||'')+'</div>':'')+'</div><div class="lbe-pts">'+fmt(e.score)+'</div></div>';
  }).join('');
}
function renderFriendsBlob(){
  return'<div style="padding:20px;text-align:center;color:rgba(255,255,255,.2);font-size:12px">Friends coming soon!</div>';
}

// ── Spawn ──
function spawnFood(n=300){for(let i=0;i<n;i++)foods.push({x:Math.random()*WORLD,y:Math.random()*WORLD,r:2+Math.random()*3.5,color:foodCols[Math.random()*foodCols.length|0]});}
function spawnViruses(n=18){for(let i=0;i<n;i++)viruses.push({x:100+Math.random()*(WORLD-200),y:100+Math.random()*(WORLD-200),r:62});}
function spawnBots(n=67){for(let i=bots.length;i<n;i++){const s=14+Math.random()*26;bots.push({x:100+Math.random()*(WORLD-200),y:100+Math.random()*(WORLD-200),r:s,speed:0.9+Math.random()*1.1,emoji:emojis[Math.floor(Math.random()*emojis.length)],color:blobCols[Math.floor(Math.random()*blobCols.length)],id:bid++,score:s*8,name:'Bot',wander:Math.random()*Math.PI*2,wanderTimer:0,heading:Math.random()*Math.PI*2});}}

// ── Game Logic ──
function movePlayer(){
  if(gulping)return;
  const spd=Math.max(1.2,player.speed*Math.pow(30/Math.max(player.r,30),0.45));
  let kdx=0,kdy=0;
  if(keys.ArrowLeft||keys.KeyA)kdx-=1;
  if(keys.ArrowRight||keys.KeyD)kdx+=1;
  if(keys.ArrowUp||keys.KeyW)kdy-=1;
  if(keys.ArrowDown||keys.KeyS)kdy+=1;
  // Mouse direction (world coords)
  const wx=mouse.x/cam.z+cam.x,wy=mouse.y/cam.z+cam.y;
  const mdx=wx-player.x,mdy=wy-player.y,md=Math.hypot(mdx,mdy);
  let dx,dy,d;
  if(kdx!==0||kdy!==0){dx=kdx;dy=kdy;d=Math.hypot(dx,dy)||1;}
  else if(md>3){dx=mdx;dy=mdy;d=md;}
  else{clamp(player);checkLvl();return;}

  const spawnR=30;
  if(keys.Space&&player.r>spawnR+2){
    if(!turboActive){turboActive=true;setSk('sk-sp','act');blobNotif('TURBO!');}
    player.x+=dx/d*spd*3.2;player.y+=dy/d*spd*3.2;
    player.r=Math.max(spawnR,player.r-0.45);
    player.score=Math.max(0,player.score-3);
    if(Math.random()<.55)foods.push({
      x:player.x-(dx/d)*player.r*.9+(Math.random()*12-6),
      y:player.y-(dy/d)*player.r*.9+(Math.random()*12-6),
      r:5,color:player.color||'#00f5c4'});
    if(player.r<=spawnR+1){turboActive=false;setSk('sk-sp','rdy');blobNotif('Turbo exhausted!');}
  } else {
    if(turboActive){turboActive=false;setSk('sk-sp','rdy');}
    player.x+=dx/d*spd;player.y+=dy/d*spd;
  }
  clamp(player);checkLvl();
}

function checkLvl(){
  if(player.score>=player.level*400){
    player.level++;
    bots.forEach(b=>b.speed=Math.min(2.5,b.speed+.015));
    const p=document.createElement('div');p.className='lvl-popup';p.textContent='LVL '+player.level;
    document.getElementById('game').appendChild(p);setTimeout(()=>p.remove(),2100);
  }
}

function moveBots(){
  for(let i=0;i<bots.length;i++){
    const b=bots[i];

    // ── Wander: nudge direction smoothly rather than snapping ──
    b.wanderTimer=(b.wanderTimer||0)-1;
    if(b.wanderTimer<=0){
      b.wander=(b.wander||0)+(Math.random()-.5)*1.8;
      b.wanderTimer=90+Math.random()*120;
    }

    let desiredAngle=b.wander||0;
    let speedMul=1;
    let flee=false;

    // ── Flee: player very close AND much bigger — run AWAY ──
    const pd=Math.hypot(player.x-b.x,player.y-b.y);
    if(player.r>b.r*1.5&&pd<200){
      flee=true;
      desiredAngle=Math.atan2(b.y-player.y,b.x-player.x);
      speedMul=0.7;
    }

    // ── Hunt: player is smaller AND nearby ──
    if(!flee&&player.r<b.r*0.88&&pd<450){
      desiredAngle=Math.atan2(player.y-b.y,player.x-b.x);
    }

    // ── Bot vs bot: flee bigger, hunt smaller ──
    for(let j=0;j<bots.length;j++){
      if(i===j)continue;
      const o=bots[j],dd=Math.hypot(o.x-b.x,o.y-b.y);
      if(o.r>b.r*1.5&&dd<200){
        flee=true;desiredAngle=Math.atan2(b.y-o.y,b.x-o.x);speedMul=0.7;break;
      }
      if(!flee&&o.r<b.r*0.88&&dd<350){
        desiredAngle=Math.atan2(o.y-b.y,o.x-b.x);
      }
    }

    // ── Seek nearest food when idle ──
    if(!flee&&pd>400){
      let bf=Infinity,fx=0,fy=0;
      for(let k=0;k<foods.length;k+=6){
        const fd=Math.hypot(foods[k].x-b.x,foods[k].y-b.y);
        if(fd<bf){bf=fd;fx=foods[k].x;fy=foods[k].y;}
      }
      if(bf<Infinity)desiredAngle=Math.atan2(fy-b.y,fx-b.x);
    }

    // ── Flee viruses if large ──
    for(const v of viruses){
      if(b.r>v.r*0.9&&Math.hypot(v.x-b.x,v.y-b.y)<220){
        desiredAngle=Math.atan2(b.y-v.y,b.x-v.x);flee=false;speedMul=1;break;
      }
    }

    // ── Soft wall push: gradually steer inward near edges ──
    const margin=600;
    if(b.x<margin)           desiredAngle=lerpAngle(desiredAngle,0,           0.4);
    else if(b.x>WORLD-margin)desiredAngle=lerpAngle(desiredAngle,Math.PI,     0.4);
    if(b.y<margin)           desiredAngle=lerpAngle(desiredAngle,Math.PI*0.5, 0.4);
    else if(b.y>WORLD-margin)desiredAngle=lerpAngle(desiredAngle,-Math.PI*0.5,0.4);

    // ── Smooth turn: interpolate heading toward desired direction ──
    const turnRate=flee?0.18:0.07;
    b.heading=lerpAngle(b.heading!=null?b.heading:desiredAngle,desiredAngle,turnRate);

    b.x+=Math.cos(b.heading)*b.speed*speedMul;
    b.y+=Math.sin(b.heading)*b.speed*speedMul;
    clamp(b);
  }
}

// Shortest-path angle lerp (handles 0/2π wrap)
function lerpAngle(a,b,t){
  let d=b-a;
  while(d>Math.PI)d-=Math.PI*2;
  while(d<-Math.PI)d+=Math.PI*2;
  return a+d*t;
}

function eatFood(){
  for(let i=foods.length-1;i>=0;i--){
    const f=foods[i];
    if(Math.hypot(f.x-player.x,f.y-player.y)<player.r+f.r){
      player.r+=.2;player.score+=8;foods.splice(i,1);continue;
    }
    let eaten=false;
    for(const b of bots){
      if(Math.hypot(f.x-b.x,f.y-b.y)<b.r+f.r){b.r+=.16;b.score+=4;foods.splice(i,1);eaten=true;break;}
    }
  }
  if(foods.length<2880)spawnFood(480);
}

function checkViruses(e){
  if(e.r<=60)return;
  for(let i=viruses.length-1;i>=0;i--){
    const v=viruses[i];
    if(Math.hypot(e.x-v.x,e.y-v.y)<e.r+v.r*.35){
      e.r*=.6;e.score*=.6;
      for(let j=0;j<12;j++)foods.push({x:e.x+(Math.random()*80-40),y:e.y+(Math.random()*80-40),r:5,color:'#00ff88'});
      viruses.splice(i,1);
      setTimeout(()=>viruses.push({x:100+Math.random()*(WORLD-200),y:100+Math.random()*(WORLD-200),r:62}),5000);
      if(e.isPlayer)blobNotif('Hit a virus!');
      break;
    }
  }
}

function collisions(){
  if(gulping)return;
  checkViruses(player);
  bots.forEach(b=>checkViruses(b));

  // Player vs bots
  for(let i=bots.length-1;i>=0;i--){
    const b=bots[i];
    const d=Math.hypot(b.x-player.x,b.y-player.y);
    if(d<player.r+b.r-4){
      if(player.r>b.r*1.05){
        player.r+=b.r*.28;player.score+=b.score;
        rmBot(b);
      } else if(b.r>player.r*1.05&&!gulping){
        doGulp({x:b.x,y:b.y});
      }
    }
  }

  // Bot vs bot
  for(let i=0;i<bots.length;i++){
    for(let j=i+1;j<bots.length;j++){
      const a=bots[i],b=bots[j],d=Math.hypot(b.x-a.x,b.y-a.y);
      if(d<a.r+b.r-8){
        if(a.r>b.r*1.12){a.r+=b.r*.28;a.score+=b.score;bots.splice(j,1);spawnBots(67);break;}
        else if(b.r>a.r*1.12){b.r+=a.r*.28;b.score+=a.score;bots.splice(i,1);spawnBots(67);break;}
      }
    }
  }

  // Player vs net players
  for(const np of netPlayers){
    if(!np.id)continue;
    const nr=np.r||30;
    const d=Math.hypot(player.x-np.x,player.y-np.y);
    if(d<player.r+nr-10){
      if(player.r>nr*1.05&&!recentKills.has(np.id)){
        recentKills.add(np.id);
        player.r+=nr*.22;player.score+=Math.round(nr*15);
        blobNotif('Ate '+esc(np.name||'player')+'! +'+ Math.round(nr*15));
        blobSysMsg(esc(myName)+' ate '+esc(np.name||'player')+'!');
        // Notify them
        fbSet('kills/'+np.id,{killer:myName,kx:Math.round(player.x),ky:Math.round(player.y),ts:Date.now()});
        update(ref(db,'players/'+np.id),{alive:false,ts:Date.now()-10000});
        setTimeout(()=>recentKills.delete(np.id),8000);
      } else if(nr>player.r*1.05&&!gulping){
        doGulp({x:np.x,y:np.y});
      }
    }
  }
}

function doGulp(enemy){
  gulping=true;
  gulpEnemy={x:enemy.x,y:enemy.y};
}

function procGulp(){
  if(!gulping||!gulpEnemy)return;
  player.x+=(gulpEnemy.x-player.x)*.13;
  player.y+=(gulpEnemy.y-player.y)*.13;
  if(Math.hypot(player.x-gulpEnemy.x,player.y-gulpEnemy.y)<20){
    pVisible=false;gover=true;gulping=false;gulpEnemy=null;
    document.getElementById('go-score').textContent=fmt(player.score);
    document.getElementById('gameover').className='on';
    saveFinal();
  }
}

async function saveFinal(){
  myBest=Math.max(myBest,player.score);
  try{
    await update(ref(db,'players/'+state.myId),{
      score:0,alive:false,best:myBest,ts:Date.now()-30000
    });
  }catch(e){}
}

function rmBot(b){bots=bots.filter(x=>x!==b);spawnBots(67);}
function clamp(o){o.x=Math.max(o.r+2,Math.min(WORLD-o.r-2,o.x));o.y=Math.max(o.r+2,Math.min(WORLD-o.r-2,o.y));}

export function restartGame(){
  player.x=findClearSpawn().x;player.y=findClearSpawn().y;
  player.r=30;player.score=0;player.level=1;
  pVisible=true;gover=false;gulping=false;gulpEnemy=null;
  turboActive=false;turboReady=true;zoomActive=false;zoomReady=true;
  recentKills=new Set();keys={};
  bots=[];foods=[];viruses=[];
  spawnFood(4320);spawnBots(67);spawnViruses(43);
  document.getElementById('gameover').className='';
  setSk('sk-q','rdy');setSk('sk-sp','rdy');
  // Re-register as alive, clear kill event
  update(ref(db,'players/'+state.myId),{alive:true,x:Math.round(player.x),y:Math.round(player.y),r:30,ts:Date.now()});
  set(ref(db,'kills/'+state.myId),null);
  blobSysMsg(esc(myName)+' is back!');
}

// ── Camera ──
function camFollow(){
  const tz=zoomActive?Math.min(0.18,blobCanvas.width/WORLD*2):Math.max(0.10,0.82-player.r/320);
  cam.z+=(tz-cam.z)*.07;
  cam.x=player.x-blobCanvas.width/(2*cam.z);
  cam.y=player.y-blobCanvas.height/(2*cam.z);
}
const sx=x=>(x-cam.x)*cam.z;
const sy=y=>(y-cam.y)*cam.z;

// ── Draw ──
function drawBg(){
  const g=blobCtx.createRadialGradient(blobCanvas.width/2,blobCanvas.height/2,0,blobCanvas.width/2,blobCanvas.height/2,blobCanvas.width*.8);
  g.addColorStop(0,'#14142a');g.addColorStop(1,'#070711');
  blobCtx.fillStyle=g;blobCtx.fillRect(0,0,blobCanvas.width,blobCanvas.height);
}

function drawGrid(){
  const gs=100*cam.z,ox=-(cam.x*cam.z)%gs,oy=-(cam.y*cam.z)%gs;
  blobCtx.strokeStyle='rgba(255,255,255,.02)';blobCtx.lineWidth=1;blobCtx.beginPath();
  for(let x=ox;x<blobCanvas.width;x+=gs){blobCtx.moveTo(x,0);blobCtx.lineTo(x,blobCanvas.height);}
  for(let y=oy;y<blobCanvas.height;y+=gs){blobCtx.moveTo(0,y);blobCtx.lineTo(blobCanvas.width,y);}
  blobCtx.stroke();
  // World border
  blobCtx.strokeStyle='rgba(0,245,196,.15)';blobCtx.lineWidth=3;
  blobCtx.shadowBlur=16;blobCtx.shadowColor='rgba(0,245,196,.4)';
  blobCtx.strokeRect(sx(0),sy(0),WORLD*cam.z,WORLD*cam.z);blobCtx.shadowBlur=0;
}

function drawFoods(){
  foods.forEach(f=>{
    const cx=sx(f.x),cy=sy(f.y),r=f.r*cam.z;
    if(cx<-r||cx>blobCanvas.width+r||cy<-r||cy>blobCanvas.height+r)return;
    blobCtx.shadowBlur=5;blobCtx.shadowColor=f.color;
    blobCtx.beginPath();blobCtx.arc(cx,cy,Math.max(.5,r),0,Math.PI*2);
    blobCtx.fillStyle=f.color;blobCtx.fill();blobCtx.shadowBlur=0;
  });
}

function drawViruses(){
  viruses.forEach(v=>{
    const cx=sx(v.x),cy=sy(v.y),r=v.r*cam.z;
    if(cx<-r*2||cx>blobCanvas.width+r*2||cy<-r*2||cy>blobCanvas.height+r*2)return;
    blobCtx.save();blobCtx.translate(cx,cy);
    blobCtx.shadowBlur=18;blobCtx.shadowColor='rgba(0,200,100,.6)';
    blobCtx.beginPath();
    const sp=12;
    for(let i=0;i<sp;i++){
      const a=(i/sp)*Math.PI*2,sr=i%2?r:r*.65;
      i===0?blobCtx.moveTo(Math.cos(a)*sr,Math.sin(a)*sr):blobCtx.lineTo(Math.cos(a)*sr,Math.sin(a)*sr);
    }
    blobCtx.closePath();
    const vg=blobCtx.createRadialGradient(0,0,r*.2,0,0,r);
    vg.addColorStop(0,'rgba(50,240,130,.85)');vg.addColorStop(1,'rgba(0,120,60,.8)');
    blobCtx.fillStyle=vg;blobCtx.fill();
    blobCtx.strokeStyle='rgba(0,255,100,.9)';blobCtx.lineWidth=2;blobCtx.stroke();
    blobCtx.shadowBlur=0;
    blobCtx.font='bold '+Math.round(r*.65)+'px Orbitron,monospace';
    blobCtx.textAlign='center';blobCtx.textBaseline='middle';
    blobCtx.fillStyle='rgba(0,255,100,.85)';blobCtx.fillText('✕',0,1);
    blobCtx.restore();
  });
}

function drawBlob(e,alpha=1){
  const cx=sx(e.x),cy=sy(e.y),r=e.r*cam.z;
  if(cx<-r*2.5||cx>blobCanvas.width+r*2.5||cy<-r*2.5||cy>blobCanvas.height+r*2.5)return;
  blobCtx.save();blobCtx.globalAlpha=alpha;
  const col=e.color||'#00f5c4';
  // Glow
  blobCtx.shadowBlur=r*.8;blobCtx.shadowColor=col;
  // Body
  const g=blobCtx.createRadialGradient(cx-r*.3,cy-r*.35,r*.05,cx,cy,r);
  g.addColorStop(0,lc2(col,55));g.addColorStop(.55,col);g.addColorStop(1,dc2(col,50));
  blobCtx.beginPath();blobCtx.arc(cx,cy,r,0,Math.PI*2);blobCtx.fillStyle=g;blobCtx.fill();
  blobCtx.shadowBlur=0;
  // Skin
  if(e.skin&&e.skin!=='none'){
    blobCtx.save();blobCtx.beginPath();blobCtx.arc(cx,cy,r,0,Math.PI*2);blobCtx.clip();
    applySkin(blobCtx,e.skin,col,cx,cy,r);blobCtx.restore();
  }
  // Highlight
  const sh=blobCtx.createRadialGradient(cx-r*.38,cy-r*.4,0,cx-r*.2,cy-r*.25,r*.52);
  sh.addColorStop(0,'rgba(255,255,255,.36)');sh.addColorStop(1,'rgba(255,255,255,0)');
  blobCtx.beginPath();blobCtx.arc(cx,cy,r,0,Math.PI*2);blobCtx.fillStyle=sh;blobCtx.fill();
  // Face
  const face=e.emoji||'😎';
  blobCtx.font=Math.round(r*1.2)+'px Arial';
  blobCtx.textAlign='center';blobCtx.textBaseline='middle';
  blobCtx.fillText(face,cx,cy+1);
  // Name tag
  if(r>12){
    const fs=Math.max(8,Math.round(12*cam.z));
    const tc=e.tagColor||(e.isPlayer?'#00f5c4':'rgba(255,255,255,.6)');
    blobCtx.font='700 '+fs+'px Orbitron,monospace';
    blobCtx.fillStyle=tc;blobCtx.shadowBlur=6;blobCtx.shadowColor=tc;
    blobCtx.fillText((e.tagBadge||'')+(e.name||''),cx,cy+r+fs+3);
    blobCtx.shadowBlur=0;
  }
  blobCtx.restore();
}

function interpolateNetPlayers(){
  // Smoothly move net players toward their target positions each frame
  const lerp=0.18;
  Object.values(netInterp).forEach(np=>{
    np.x+=(np.tx-np.x)*lerp;
    np.y+=(np.ty-np.y)*lerp;
    np.r+=(np.tr-np.r)*lerp;
  });
}

function drawMinimap(){
  const MW=160,s=MW/WORLD;
  if(mmc.width!==MW){mmc.width=MW;mmc.height=MW;}
  mmx.clearRect(0,0,MW,MW);
  mmx.fillStyle='rgba(4,4,16,.95)';mmx.fillRect(0,0,MW,MW);
  for(let i=0;i<foods.length;i+=4){const f=foods[i];mmx.fillStyle=f.color;mmx.fillRect(f.x*s,f.y*s,2,2);}
  bots.forEach(b=>{mmx.fillStyle=b.color||'#aaa';mmx.beginPath();mmx.arc(b.x*s,b.y*s,2.5,0,Math.PI*2);mmx.fill();});
  netPlayers.forEach(p=>{mmx.fillStyle=p.color||'#fff';mmx.shadowBlur=4;mmx.shadowColor=p.color||'#fff';mmx.beginPath();mmx.arc(p.x*s,p.y*s,3.5,0,Math.PI*2);mmx.fill();mmx.shadowBlur=0;});
  mmx.fillStyle='#00f5c4';mmx.shadowColor='#00f5c4';mmx.shadowBlur=10;
  mmx.beginPath();mmx.arc(player.x*s,player.y*s,4,0,Math.PI*2);mmx.fill();mmx.shadowBlur=0;
  const vx=cam.x*s,vy=cam.y*s,vw=(blobCanvas.width/cam.z)*s,vh=(blobCanvas.height/cam.z)*s;
  mmx.strokeStyle='rgba(0,245,196,.7)';mmx.lineWidth=1.5;mmx.strokeRect(vx,vy,vw,vh);
  mmx.strokeStyle='rgba(0,245,196,.25)';mmx.lineWidth=1;mmx.strokeRect(0,0,MW,MW);
}

function blobUpdate(){
  if(!gover){
    movePlayer();moveBots();eatFood();collisions();procGulp();
  }
  interpolateNetPlayers();
  camFollow();
}

function blobDraw(){
  if(!blobCtx)return;
  blobCtx.clearRect(0,0,blobCanvas.width,blobCanvas.height);
  drawBg();drawGrid();drawFoods();drawViruses();
  bots.forEach(b=>drawBlob(b));
  netPlayers.forEach(p=>drawBlob(p,1));
  if(pVisible)drawBlob(player);
  drawMinimap();
}

// Single RAF loop — always running once started
function blobGameLoop(){
  if(blobActive){blobUpdate();blobDraw();}
  requestAnimationFrame(blobGameLoop);
}

let blobNotifT;
function blobNotif(txt){
  const el=document.getElementById('notif');if(!el)return;
  el.textContent=txt;el.className='on';
  clearTimeout(blobNotifT);blobNotifT=setTimeout(()=>el.className='',2800);
}
