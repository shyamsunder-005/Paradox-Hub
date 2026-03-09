// ══ HUB ══
import { db, ref, set, fbGet, fbListen } from './firebase.js';
import { state, showScreen, esc, fmt } from './state.js';

// ── Hub Leaderboard ──
let hubLbGame='arena';
let hubNotifT;

export function hubNotif(txt){
  const el=document.getElementById('hub-notif');if(!el)return;
  el.textContent=txt;el.className='hub-notif on';
  clearTimeout(hubNotifT);hubNotifT=setTimeout(()=>el.className='hub-notif',2500);
}

export function hubLbTab(game){
  hubLbGame=game;
  ['arena','trivia','chess','militia'].forEach(g=>{
    const t=document.getElementById('hlb-tab-'+g);
    if(t)t.className='hub-lb-tab'+(g===game?' on':'');
  });
  renderHubLb();
}

export async function renderHubLb(){
  const el=document.getElementById('hub-lb-list');
  if(!el)return;
  el.innerHTML='<div style="text-align:center;color:rgba(255,255,255,.15);padding:12px;font-size:11px">Loading…</div>';

  let entries=[];
  if(hubLbGame==='arena'){
    const data=await fbGet('players')||{};
    entries=Object.values(data)
      .filter(p=>p.name&&(p.best||0)>0)
      .sort((a,b)=>(b.best||0)-(a.best||0))
      .slice(0,20)
      .map(p=>({id:p.id,name:p.name,emoji:p.emoji||'😎',score:fmt(p.best||0),color:p.color||'#00f5c4'}));
  } else if(hubLbGame==='trivia'){
    const data=await fbGet('trivia/lb')||{};
    entries=Object.values(data)
      .filter(p=>p.username&&(p.score||0)>0)
      .sort((a,b)=>(b.score||0)-(a.score||0))
      .slice(0,20)
      .map(p=>({id:p.id||p.username,name:p.username,emoji:'🧠',score:fmt(p.score||0),color:'#a78bfa'}));
  } else if(hubLbGame==='chess'){
    const data=await fbGet('chess/lb')||{};
    entries=Object.values(data)
      .filter(p=>p.name&&(p.wins||0)>0)
      .sort((a,b)=>(b.wins||0)-(a.wins||0))
      .slice(0,20)
      .map(p=>({id:p.id||p.name,name:p.name,emoji:'♟️',score:(p.wins||0)+' W',color:'#4ade80'}));
  } else if(hubLbGame==='militia'){
    const data=await fbGet('militia/lb')||{};
    entries=Object.values(data)
      .filter(p=>p.name&&(p.kills||0)>0)
      .sort((a,b)=>(b.kills||0)-(a.kills||0))
      .slice(0,20)
      .map(p=>({id:p.id||p.name,name:p.name,emoji:'⚔️',score:(p.kills||0)+' K',color:'#f43f5e'}));
  }

  if(!entries.length){
    el.innerHTML='<div style="text-align:center;color:rgba(255,255,255,.15);padding:16px;font-size:11px">No records yet!</div>';
    return;
  }

  const medals=['🥇','🥈','🥉'];
  const friends=JSON.parse(localStorage.getItem('paradox_friends')||'[]');
  const sent=JSON.parse(localStorage.getItem('paradox_sent_req')||'[]');

  el.innerHTML=entries.map((e,i)=>{
    const isMe=e.id===state.myId||e.name===state.myDisplayName;
    const isFriend=friends.includes(e.id||e.name);
    const isSent=sent.includes(e.id||e.name);
    const btnHtml=isMe||isFriend?'':`<button class="hub-lb-add${isSent?' sent':''}"
      onclick="sendFriendReq('${esc(e.id||e.name)}','${esc(e.name)}','${e.emoji}')">${isSent?'Sent':'+ Add'}</button>`;
    return`<div class="hub-lb-row">
      <div class="hub-lb-rank">${medals[i]||i+1}</div>
      <div class="hub-lb-em">${e.emoji}</div>
      <div class="hub-lb-name" style="color:${isMe?'var(--c1)':e.color}">${esc(e.name)}${isMe?' ◀':''}</div>
      <div class="hub-lb-score">${e.score}</div>
      ${btnHtml}
    </div>`;
  }).join('');
}

// ── Friend Requests ──
export function sendFriendReq(toId,toName,toEmoji){
  // Write request to firebase (toEmoji comes from leaderboard — myEmoji from blob state via window)
  const myEmoji=window.__myEmoji||'😎';
  set(ref(db,'friendReqs/'+toId+'/'+state.myId),{
    from:state.myId,fromName:state.myDisplayName,fromEmoji:myEmoji,
    toId,toName,ts:Date.now()
  });
  // Mark as sent locally
  const sent=JSON.parse(localStorage.getItem('paradox_sent_req')||'[]');
  if(!sent.includes(toId)){sent.push(toId);localStorage.setItem('paradox_sent_req',JSON.stringify(sent));}
  hubNotif('Friend request sent to '+toName+'!');
  renderHubLb();
}

export function acceptFriendReq(fromId,fromName,fromEmoji){
  // Add to friends list
  const friends=JSON.parse(localStorage.getItem('paradox_friends')||'[]');
  if(!friends.includes(fromId)){friends.push(fromId);localStorage.setItem('paradox_friends',JSON.stringify(friends));}
  // Store friend details
  const friendData=JSON.parse(localStorage.getItem('paradox_friend_data')||'{}');
  friendData[fromId]={id:fromId,name:fromName,emoji:fromEmoji,since:Date.now()};
  localStorage.setItem('paradox_friend_data',JSON.stringify(friendData));
  // Remove request from firebase
  set(ref(db,'friendReqs/'+state.myId+'/'+fromId),null);
  hubNotif(fromName+' is now your friend! 🎉');
  renderHubFriends();
  renderHubReqs();
}

export function declineFriendReq(fromId){
  set(ref(db,'friendReqs/'+state.myId+'/'+fromId),null);
  renderHubReqs();
}

export function renderHubFriends(){
  const el=document.getElementById('hub-fr-list');if(!el)return;
  const friendData=JSON.parse(localStorage.getItem('paradox_friend_data')||'{}');
  const friends=Object.values(friendData);
  if(!friends.length){
    el.innerHTML='<div class="hub-fr-empty">No friends yet.<br>Add from the leaderboard!</div>';
    return;
  }
  el.innerHTML=friends.map(f=>`
    <div class="hub-fr-row">
      <div class="hub-fr-dot off"></div>
      <div class="hub-lb-em">${f.emoji||'😎'}</div>
      <div class="hub-fr-name">${esc(f.name)}</div>
    </div>`).join('');
}

export function renderHubReqs(){
  const el=document.getElementById('hub-fr-reqs');if(!el)return;
  fbListen('friendReqs/'+state.myId,snap=>{
    if(!snap){el.innerHTML='';return;}
    const reqs=Object.values(snap).filter(r=>r&&r.from);
    if(!reqs.length){el.innerHTML='';return;}
    el.innerHTML=reqs.map(r=>`
      <div class="hub-fr-req">
        <div class="hub-fr-req-name">${r.fromEmoji||'😎'} <b>${esc(r.fromName)}</b> wants to be friends</div>
        <div class="hub-fr-req-btns">
          <button class="hub-fr-req-btn acc" onclick="acceptFriendReq('${r.from}','${esc(r.fromName)}','${r.fromEmoji||'😎'}')">Accept</button>
          <button class="hub-fr-req-btn dec" onclick="declineFriendReq('${r.from}')">Decline</button>
        </div>
      </div>`).join('');
  });
}

export function initHub(){
  renderHubLb();
  renderHubFriends();
  renderHubReqs();
  setInterval(renderHubLb,15000);
}

export function renderHubBg(){
  const c=document.getElementById('hub-bg'),x=c.getContext('2d');
  c.width=innerWidth;c.height=innerHeight;
  const pts=Array.from({length:70},()=>({x:Math.random()*c.width,y:Math.random()*c.height,
    r:Math.random()*2+.4,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25,
    cl:['rgba(0,245,196,','rgba(124,58,237,','rgba(236,72,153,'][Math.floor(Math.random()*3)]}));
  function dp(){x.clearRect(0,0,c.width,c.height);pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;
    if(p.x<0)p.x=c.width;if(p.x>c.width)p.x=0;if(p.y<0)p.y=c.height;if(p.y>c.height)p.y=0;
    x.beginPath();x.arc(p.x,p.y,p.r,0,Math.PI*2);x.fillStyle=p.cl+'.4)';x.fill();});
    requestAnimationFrame(dp);}
  dp();
}
