// ══ TRIVIA APP ══
import { fbGet, fbSet, fbListen, fbOff, fbPush } from './firebase.js';
import { state, showScreen, esc, fmt } from './state.js';

// ── Gemini API helper ──
const GEMINI_KEY = 'AIzaSyDG3F6O3_MX9viBwgXMor3fh7K1wu64o7g'; // ← paste your key here
async function callGemini(prompt) {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini error');
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.replace(/```json
?|```/g, '').trim();
}


// ══════════════════════════════════════════════════
// ══ TRIVIA APP (Vanilla JS SPA) ══
// ══════════════════════════════════════════════════
export const T={
  screen:'home',prev:'home',
  data:{},
  ivs:[],
  avColors:['#7c3aed','#ec4899','#2563eb','#059669','#d97706','#dc2626'],
  cats:['Science','History','Geography','Sports','Movies','Music','Literature','Technology','Food','Space','Art','Nature'],

  show(s,d={}){this.prev=this.screen;this.screen=s;Object.assign(this.data,d);this.render();},
  back(){this.show(this.data.backTo||this.prev||'home');delete this.data.backTo;},
  cleanup(){this.ivs.forEach(clearInterval);this.ivs=[];fbOff('trivia/chat');fbOff('trivia/room/'+this.data.roomCode);},

  av(name){const i=name.charCodeAt(0)%this.avColors.length;return'<div class="t-chat-av" style="background:'+this.avColors[i]+'">'+name[0].toUpperCase()+'</div>'},
  avLg(name,extra=''){const i=name.charCodeAt(0)%this.avColors.length;return'<div class="t-av" style="background:'+this.avColors[i]+';'+extra+'">'+name[0].toUpperCase()+'</div>'},

  render(){
    const el=document.getElementById('trivia-root');
    const fn=this['page_'+this.screen.replace(/-/g,'_')];
    if(fn)el.innerHTML=fn.call(this);
    this.bind();
  },

  bind(){
    // Back buttons
    document.querySelectorAll('[data-tback]').forEach(b=>b.onclick=()=>this.back());
    document.querySelectorAll('[data-tgo]').forEach(b=>b.onclick=()=>this.show(b.dataset.tgo));
  },

  // ── HOME ──
  page_home(){
    const u=state.myDisplayName;
    return`<div class="t-screen" style="padding-top:64px;max-width:480px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px">
        <div style="display:flex;align-items:center;gap:12px">
          ${this.avLg(u,'width:44px;height:44px;border-radius:14px;font-size:18px')}
          <div><div style="font-weight:700;font-size:16px">${esc(u)}</div><div style="font-size:12px;color:#a78bfa">${fmt(this.data.userScore||0)} PTS</div></div>
        </div>
      </div>
      <div class="t-title" style="background:linear-gradient(135deg,#a78bfa,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Paradox Trivia</div>
      <div class="t-sub">Think · Compete · Defy Logic</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${[['◈','quick-play','Quick Play','Solo AI quiz','#7c3aed'],['⋈','multiplayer','Multiplayer','Create / join rooms','#2563eb'],['◧','create-quiz','Create Quiz','Build your own','#059669'],['◎','leaderboard','Leaderboard','Global rankings','#d97706'],['◌','chat','Global Chat','Talk to everyone','#dc2626'],['◉','profile','My Profile','Stats & history','#7c3aed']].map(([ic,id,label,sub,c])=>`
          <button onclick="T.show('${id}')" style="background:#111122;border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:20px 16px;text-align:left;cursor:none;transition:all .3s;position:relative;overflow:hidden">
            <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${c};border-radius:20px 20px 0 0"></div>
            <div style="font-size:22px;font-family:Orbitron,monospace;color:${c};margin-bottom:12px;opacity:0.9;line-height:1">${ic}</div>
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${label}</div>
            <div style="font-size:11px;color:rgba(255,255,255,.3)">${sub}</div>
          </button>`).join('')}
      </div>
      <p style="text-align:center;font-size:10px;color:rgba(255,255,255,.1);margin-top:28px;letter-spacing:3px;font-family:Orbitron,monospace">BY SREE · PARADOX</p>
    </div>`;
  },

  // ── QUICK PLAY ──
  page_quick_play(){
    const selCats=this.data.selCats||['Science','History'];
    const diff=this.data.diff||'medium';const num=this.data.num||10;
    return`<div class="t-screen" style="max-width:560px;margin:0 auto;padding-top:70px">
      <button class="t-back" data-tback>← Back</button>
      <div class="t-title">⚡ Quick Play</div><div class="t-sub">AI-generated quiz</div>
      <div class="t-card" style="margin-bottom:14px">
        <span class="t-label">Categories</span>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${this.cats.map(c=>'<button class="t-chip '+(selCats.includes(c)?'on':'off')+'" onclick="T.toggleCat(\''+c+'\')">'+c+'</button>').join('')}
        </div>
      </div>
      <div class="t-card" style="margin-bottom:14px;display:flex;gap:20px">
        <div style="flex:1">
          <span class="t-label">Difficulty</span>
          <div style="display:flex;gap:8px">
            ${['easy','medium','hard'].map(d=>'<button class="t-chip '+(diff===d?'on':'off')+'" onclick="T.setDiff(\''+d+'\')" style="flex:1">'+d+'</button>').join('')}
          </div>
        </div>
        <div style="flex:1">
          <span class="t-label">Questions: <span style="color:#a78bfa">${num}</span></span>
          <input type="range" min="5" max="20" step="5" value="${num}" oninput="T.setNum(this.value)" style="width:100%;accent-color:#7c3aed;margin-top:12px"/>
        </div>
      </div>
      <button class="t-btn-p" onclick="T.startAIQuiz()" style="margin-bottom:12px">Generate AI Quiz</button>
      <div id="t-saved-quizzes"></div>
    </div>`;
  },

  toggleCat(c){const s=this.data.selCats||['Science','History'];this.data.selCats=s.includes(c)?s.filter(x=>x!==c):[...s,c];this.render();},
  setDiff(d){this.data.diff=d;this.render();},
  setNum(n){this.data.num=+n;this.render();},

  async startAIQuiz(){
    const cats=this.data.selCats||['Science','History'];
    if(!cats.length){alert('Select at least one category.');return;}
    this.show('loading',{loadText:'Generating your quiz…'});

    try{
      const txt=await callGemini(`Generate exactly ${this.data.num||10} trivia MCQ questions. Category: ${cats.join(', ')}. Difficulty: ${this.data.diff||'medium'}. Return ONLY a raw JSON object (no markdown, no explanation): {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"category":"..."}]}`);
      let parsed;try{parsed=JSON.parse(txt);}catch(e){const m=txt.match(/\{[\s\S]*\}/);parsed=JSON.parse(m?m[0]:txt);}
      this.show('game',{questions:parsed.questions,cur:0,score:0,log:[],answered:false,sel:null,backTo:'home'});
    }catch(e){
      const msg=e?.message||'Unknown error';
      alert('Quiz generation failed.\n\n'+msg);
      this.show('quick-play');
    }
  },

  // ── NO KEY SCREEN (auto-redirects) ──
  page_no_key(){this.show('home');return'';},


  // ── LOADING ──
  page_loading(){return`<div class="t-screen" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh">
    <div style="width:56px;height:56px;border-radius:50%;border:4px solid #7c3aed;border-top-color:transparent;animation:spin 1s linear infinite;margin-bottom:20px"></div>
    <div style="color:#a78bfa;font-weight:600">${this.data.loadText||'Loading…'}</div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style></div>`;},

  // ── GAME ──
  page_game(){
    const {questions=[],cur=0,score=0,answered=false,sel=null}=this.data;
    if(!questions.length)return this.page_home.call(this);
    const q=questions[cur];if(!q)return this.page_home.call(this);
    const letters=['A','B','C','D'];
    const pct=Math.round((cur/questions.length)*100);
    return`<div class="t-screen" style="max-width:600px;margin:0 auto;padding-top:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:13px;color:rgba(255,255,255,.4)">Q${cur+1} / ${questions.length}</span>
        <span style="font-family:Orbitron,monospace;color:#a78bfa;font-weight:700">${score} pts</span>
      </div>
      <div class="t-progress" style="margin-bottom:20px"><div class="t-progress-fill" style="width:${pct}%"></div></div>
      <div style="margin-bottom:20px">
        <div style="font-size:11px;color:#a78bfa;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">${esc(q.category||'')}</div>
        <div style="font-size:18px;font-weight:700;line-height:1.5">${esc(q.question)}</div>
      </div>
      ${(q.options||[]).map((opt,i)=>{
        let cls='ans-btn';
        if(answered){if(i===q.correctAnswer)cls+=' correct';else if(i===sel)cls+=' wrong';else cls+=' dim';}
        return`<button class="${cls}" ${answered?'disabled':''} onclick="T.answer(${i})">
          <span class="ans-letter">${answered&&i===q.correctAnswer?'✓':answered&&i===sel&&i!==q.correctAnswer?'✗':letters[i]}</span>
          <span>${esc(opt)}</span></button>`;
      }).join('')}
      ${answered?`<p style="text-align:center;font-size:12px;color:rgba(255,255,255,.3);margin-top:12px;animation:pulse 1.5s infinite">
        ${sel===q.correctAnswer?'Correct!':'Incorrect — moving on…'}</p>`:''}
    </div>`;
  },

  answer(idx){
    const {questions,cur,score,log}=this.data;
    if(this.data.answered)return;
    const q=questions[cur];const ok=idx===q.correctAnswer;
    const ns=score+(ok?10:0);const nl=[...log,{qi:cur,sel:idx,correct:q.correctAnswer,ok}];
    Object.assign(this.data,{answered:true,sel:idx,score:ns,log:nl});
    this.render();
    setTimeout(async()=>{
      if(cur+1<questions.length){Object.assign(this.data,{cur:cur+1,answered:false,sel:null});this.render();}
      else{
        await this.saveScore(ns,questions.length);
        this.show('results',{finalScore:ns,log:nl,questions,backTo:'home'});
      }
    },1000);
  },

  async saveScore(score,total){
    const uid=state.myId;const prev=await fbGet('trivia/users/'+uid)||{totalScore:0,gamesPlayed:0,username:state.myDisplayName};
    const ns={username:state.myDisplayName,totalScore:(prev.totalScore||0)+score,gamesPlayed:(prev.gamesPlayed||0)+1};
    await fbSet('trivia/users/'+uid,ns);
    const lb=await fbGet('trivia/lb')||{};lb[uid]=ns;await fbSet('trivia/lb',lb);
    this.data.userScore=(this.data.userScore||0)+score;
  },

  // ── RESULTS ──
  page_results(){
    const {finalScore=0,log=[],questions=[]}=this.data;
    const correct=log.filter(l=>l.ok).length,pct=Math.round((correct/Math.max(questions.length,1))*100);
    const grade=pct>=80?['★','Excellent','#a78bfa']:pct>=60?['◎','Good Job','#60a5fa']:pct>=40?['◌','Not Bad','#f59e0b']:['◈','Keep Going','#94a3b8'];
    return`<div class="t-screen" style="max-width:500px;margin:0 auto;padding-top:40px;text-align:center">
      <div style="font-size:32px;font-family:Orbitron,monospace;color:${grade[2]};margin-bottom:12px;letter-spacing:2px">${grade[0]}</div>
      <div style="font-size:42px;font-family:Orbitron,monospace;font-weight:900;background:linear-gradient(135deg,#a78bfa,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px">${finalScore} pts</div>
      <div style="color:${grade[2]};font-weight:700;font-size:18px;margin-bottom:4px">${grade[1]}</div>
      <div style="color:rgba(255,255,255,.35);font-size:13px;margin-bottom:24px">${correct}/${questions.length} correct · ${pct}%</div>
      <div style="text-align:left;max-height:260px;overflow-y:auto;margin-bottom:24px">
        ${log.map((l,i)=>`<div style="display:flex;gap:10px;padding:10px;border-radius:12px;margin-bottom:6px;background:${l.ok?'rgba(34,197,148,.08)':'rgba(244,63,94,.08)'};border:1px solid ${l.ok?'rgba(34,197,148,.2)':'rgba(244,63,94,.2)'}">
          <span style="font-size:14px">${l.ok?'✓':'✗'}</span>
          <div style="flex:1;font-size:12px;line-height:1.5">${esc(questions[i]?.question||'')}${!l.ok?'<div style="color:#4ade80;margin-top:4px;font-size:11px">Correct: '+esc(questions[i]?.options[l.correct]||'')+'</div>':''}</div>
        </div>`).join('')}
      </div>
      <button class="t-btn-p" onclick="T.show('home')">Back to Home</button>
    </div>`;
  },

  // ── MULTIPLAYER ──
  page_multiplayer(){
    return`<div class="t-screen" style="max-width:480px;margin:0 auto;padding-top:70px">
      <button class="t-back" data-tback>← Back</button>
      <div class="t-title">👥 Multiplayer</div><div class="t-sub">Play with friends in real-time</div>
      <div class="t-card" style="margin-bottom:12px">
        <div style="font-weight:700;margin-bottom:6px">Host a Room</div>
        <div style="font-size:13px;color:rgba(255,255,255,.35);margin-bottom:14px">Share your code with friends</div>
        <button class="t-btn-p" onclick="T.createTrivRoom()">Create Room</button>
      </div>
      <div class="t-card">
        <div style="font-weight:700;margin-bottom:6px">Join a Room</div>
        <div style="font-size:13px;color:rgba(255,255,255,.35);margin-bottom:14px">Enter the room code</div>
        <input class="t-inp" id="t-join-code" maxlength="6" placeholder="ABC123" style="text-align:center;font-family:Orbitron,monospace;font-size:22px;font-weight:900;text-transform:uppercase;margin-bottom:10px" oninput="this.value=this.value.toUpperCase()"/>
        <button class="t-btn-s" onclick="T.joinTrivRoom()">Join Room</button>
        <div id="t-join-err" style="color:#f87171;font-size:12px;margin-top:8px"></div>
      </div>
    </div>`;
  },

  async createTrivRoom(){
    const code=Math.random().toString(36).slice(2,8).toUpperCase();
    const room={code,host:state.myDisplayName,hostId:state.myId,players:[{id:state.myId,username:state.myDisplayName,score:0,answered:0}],questions:[],status:'waiting',createdAt:Date.now()};
    await fbSet('trivia/rooms/'+code,room);
    this.show('t-waiting',{roomCode:code,room,isHost:true,backTo:'multiplayer'});
  },

  async joinTrivRoom(){
    const code=(document.getElementById('t-join-code')?.value||'').trim().toUpperCase();
    if(!code)return;
    const room=await fbGet('trivia/rooms/'+code);
    const err=document.getElementById('t-join-err');
    if(!room){if(err)err.textContent='Room not found.';return;}
    if(room.status!=='waiting'){if(err)err.textContent='Game already started.';return;}
    const already=room.players.find(p=>p.id===state.myId);
    if(!already){room.players.push({id:state.myId,username:state.myDisplayName,score:0,answered:0});await fbSet('trivia/rooms/'+code,room);}
    this.show('t-waiting',{roomCode:code,room,isHost:false,backTo:'multiplayer'});
  },

  page_t_waiting(){
    const {roomCode='',room={},isHost=false}=this.data;
    const players=room.players||[];
    return`<div class="t-screen" style="max-width:480px;margin:0 auto;padding-top:70px">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:11px;color:rgba(255,255,255,.3);letter-spacing:3px;text-transform:uppercase;margin-bottom:10px">Share this code</div>
        <div class="t-room-code">${roomCode}</div>
      </div>
      <div class="t-card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-weight:700">Players</span>
          <span style="font-size:11px;color:rgba(255,255,255,.3);background:rgba(255,255,255,.06);padding:4px 10px;border-radius:20px">${players.length} joined</span>
        </div>
        <div id="t-players-list">
          ${players.map(p=>`<div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,.04);border-radius:12px;margin-bottom:6px">
            ${this.avLg(p.username,'width:36px;height:36px;border-radius:10px;font-size:14px')}
            <span style="flex:1;font-weight:600;font-size:14px">${esc(p.username)}</span>
            ${p.id===room.hostId?'<span style="font-size:10px;background:rgba(245,158,11,.15);color:#fbbf24;padding:3px 8px;border-radius:20px">Host</span>':''}
          </div>`).join('')}
        </div>
      </div>
      ${isHost
        ?`<button class="t-btn-p" id="t-start-btn" onclick="T.startTrivGame()">Start Game</button>`
        :`<div style="text-align:center;padding:20px;color:rgba(255,255,255,.35)"><div style="width:32px;height:32px;border-radius:50%;border:3px solid #7c3aed;border-top-color:transparent;animation:spin 1s linear infinite;margin:0 auto 12px"></div>Waiting for host to start…</div>`}
      <button class="t-btn-s" style="margin-top:10px" data-tback>Leave Room</button>
    </div>`;
  },

  async startTrivGame(){
    const {roomCode}=this.data;
    const btn=document.getElementById('t-start-btn');if(btn){btn.disabled=true;btn.textContent='Generating…';}

    try{
      const txt2=await callGemini('Generate 10 fun trivia MCQ questions on mixed topics, medium difficulty. Return ONLY a raw JSON object (no markdown, no explanation): {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"category":"..."}]}');
      let parsed;try{parsed=JSON.parse(txt2);}catch(e){const m=txt2.match(/\{[\s\S]*\}/);parsed=JSON.parse(m?m[0]:txt2);}
      const room=await fbGet('trivia/rooms/'+roomCode);
      await fbSet('trivia/rooms/'+roomCode,{...room,status:'playing',questions:(parsed||{}).questions||[]});
    }catch(e){
      alert('Failed to start.\n\n'+(e?.message||'Unknown error'));
      if(btn){btn.disabled=false;btn.textContent='Start Game';}
    }
  },

  // ── QUIZ CREATOR ──
  page_create_quiz(){
    const qs=this.data.cqs||[{question:'',options:['','','',''],correctAnswer:0,category:'General'}];
    const tab=this.data.cTab||'manual';
    return`<div class="t-screen" style="max-width:580px;margin:0 auto;padding-top:70px;padding-bottom:80px">
      <button class="t-back" data-tback>← Back</button>
      <div class="t-title">✏️ Create Quiz</div><div class="t-sub">Build your own quiz</div>
      <input class="t-inp" id="t-quiz-name" placeholder="Quiz name…" value="${esc(this.data.cName||'')}" oninput="T.data.cName=this.value" style="margin-bottom:14px;font-weight:700"/>
      <div class="t-tabs" style="margin-bottom:16px">
        ${[['manual','✏️ Manual'],['excel','📊 Excel'],['api','🔗 API/URL']].map(([id,label])=>`<button class="t-tab ${tab===id?'on':''}" onclick="T.data.cTab='${id}';T.render()">${label}</button>`).join('')}
      </div>
      ${tab==='manual'?`
        <div id="t-qs-list">
          ${qs.map((q,qi)=>`<div class="t-card" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px">
              <span style="font-size:10px;color:#a78bfa;font-family:Orbitron,monospace;letter-spacing:2px;text-transform:uppercase">Q${qi+1}</span>
              ${qs.length>1?`<button onclick="T.removeQ(${qi})" style="background:none;border:none;color:#f87171;cursor:none;font-size:13px">✕</button>`:''}
            </div>
            <input class="t-inp" placeholder="Question…" value="${esc(q.question)}" oninput="T.data.cqs[${qi}].question=this.value" style="margin-bottom:8px"/>
            <input class="t-inp" placeholder="Category" value="${esc(q.category)}" oninput="T.data.cqs[${qi}].category=this.value" style="margin-bottom:10px;font-size:13px;padding:10px 14px"/>
            <div style="font-size:11px;color:rgba(255,255,255,.3);margin-bottom:8px">Options — <span style="color:#4ade80">tap circle for correct</span></div>
            ${q.options.map((opt,oi)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <button onclick="T.data.cqs[${qi}].correctAnswer=${oi};T.render()" style="width:20px;height:20px;border-radius:50%;border:2px solid ${q.correctAnswer===oi?'#22c594':'rgba(255,255,255,.2)'};background:${q.correctAnswer===oi?'#22c594':'transparent'};cursor:none;flex-shrink:0"></button>
              <input class="t-inp" placeholder="Option ${'ABCD'[oi]}" value="${esc(opt)}" oninput="T.data.cqs[${qi}].options[${oi}]=this.value" style="font-size:13px;padding:10px 14px"/>
            </div>`).join('')}
          </div>`).join('')}
        </div>
        <button class="t-btn-s" onclick="T.addQ()" style="margin-bottom:12px">+ Add Question</button>
      `:tab==='excel'?`
        <div class="t-card" style="text-align:center">
          <div style="font-size:12px;color:rgba(255,255,255,.35);margin-bottom:14px">Required cols: <code style="color:#a78bfa;background:rgba(124,58,237,.1);padding:2px 6px;border-radius:4px">question, option1-4, correctAnswer(1-4), category</code></div>
          <label style="display:block;border:2px dashed rgba(255,255,255,.1);border-radius:16px;padding:40px;cursor:none">
            <div style="font-size:32px;margin-bottom:10px">📊</div>
            <div style="font-weight:600;color:rgba(255,255,255,.6);font-size:13px">Click to upload .xlsx / .csv</div>
            <input type="file" accept=".xlsx,.xls,.csv" onchange="T.importXLS(this)" style="display:none"/>
          </label>
          <div id="t-xls-status" style="margin-top:10px;font-size:12px;color:#4ade80"></div>
        </div>
      `:`
        <div class="t-card">
          <div style="font-size:12px;color:rgba(255,255,255,.35);margin-bottom:10px">Supports Open Trivia DB or any compatible JSON API</div>
          <input class="t-inp" id="t-api-url" value="${esc(this.data.apiUrl||'https://opentdb.com/api.php?amount=10&type=multiple')}" style="margin-bottom:10px;font-size:12px"/>
          <button class="t-btn-s" onclick="T.fetchAPI()" id="t-fetch-btn">Fetch Questions</button>
          <div id="t-api-status" style="margin-top:10px;font-size:12px;color:#4ade80"></div>
        </div>
      `}
      <button class="t-btn-p" onclick="T.saveQuiz()" id="t-save-btn" style="margin-top:16px">Save Quiz</button>
    </div>`;
  },

  addQ(){this.data.cqs=[...(this.data.cqs||[]),{question:'',options:['','','',''],correctAnswer:0,category:'General'}];this.render();},
  removeQ(i){this.data.cqs=this.data.cqs.filter((_,idx)=>idx!==i);this.render();},

  importXLS(inp){
    const f=inp.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
        const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const parsed=rows.filter(r=>r.question).map(r=>({question:String(r.question||''),
          options:[String(r.option1||''),String(r.option2||''),String(r.option3||''),String(r.option4||'')],
          correctAnswer:Math.max(0,(parseInt(r.correctAnswer)||1)-1),category:String(r.category||'General')}));
        if(parsed.length){this.data.cqs=parsed;const s=document.getElementById('t-xls-status');if(s)s.textContent='✅ '+parsed.length+' questions loaded';}
        else alert('No rows found. Check column names.');
      }catch(e){alert('Error: '+e.message);}
    };r.readAsArrayBuffer(f);
  },

  async fetchAPI(){
    const url=(document.getElementById('t-api-url')?.value||'').trim();
    const btn=document.getElementById('t-fetch-btn');if(btn){btn.disabled=true;btn.textContent='Fetching…';}
    try{
      const resp=await fetch(url);const data=await resp.json();
      const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'");
      if(data.results){
        this.data.cqs=data.results.map(r=>{const opts=[...r.incorrect_answers.map(decode),decode(r.correct_answer)];for(let i=opts.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[opts[i],opts[j]]=[opts[j],opts[i]];}return{question:decode(r.question),options:opts,correctAnswer:opts.indexOf(decode(r.correct_answer)),category:r.category};});
        const s=document.getElementById('t-api-status');if(s)s.textContent='✅ '+this.data.cqs.length+' questions loaded';
      }
    }catch(e){alert('Fetch failed: '+e.message);}
    if(btn){btn.disabled=false;btn.textContent='Fetch Questions';}
  },

  async saveQuiz(){
    const name=(this.data.cName||'').trim();if(!name){alert('Enter a quiz name.');return;}
    const valid=(this.data.cqs||[]).filter(q=>q.question.trim()&&q.options.every(o=>o.trim()));
    if(!valid.length){alert('Complete at least one full question.');return;}
    const id='qz_'+Date.now().toString(36);
    await fbSet('trivia/quizzes/'+id,{id,name,questions:valid,createdBy:state.myDisplayName,createdAt:Date.now()});
    const btn=document.getElementById('t-save-btn');if(btn){btn.textContent='Saved!';btn.style.background='#059669';setTimeout(()=>{btn.textContent='Save Quiz';btn.style.background='';},2500);}
  },

  // ── GLOBAL CHAT ──
  page_chat(){
    return`<div style="display:flex;flex-direction:column;height:100vh;background:#0a0a14">
      <div style="display:flex;align-items:center;gap:10px;padding:56px 16px 12px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0">
        <button class="t-back" data-tback style="margin:0">←</button>
        <div style="width:8px;height:8px;border-radius:50%;background:#22d3a0;animation:pulse 2s infinite"></div>
        <span style="font-weight:700;font-size:16px">Global Chat</span>
      </div>
      <div id="t-chat-list" style="flex:1;overflow-y:auto;padding:16px"></div>
      <div style="display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.06);flex-shrink:0;background:#0a0a14">
        <input class="t-inp" id="t-chat-inp" placeholder="Message…" maxlength="120" style="flex:1" onkeydown="if(event.key==='Enter')T.sendTrivChat()"/>
        <button class="t-btn-p" onclick="T.sendTrivChat()" style="width:50px;padding:0">→</button>
      </div>
    </div>`;
  },

  trivChatIds:new Set(),
  startChat(){
    fbListen('trivia/chat',snap=>{
      if(!snap)return;const el=document.getElementById('t-chat-list');if(!el)return;
      Object.values(snap).sort((a,b)=>a.ts-b.ts).filter(m=>!this.trivChatIds.has(m.id)).forEach(m=>{
        this.trivChatIds.add(m.id);
        const me=m.userId===state.myId;const d=document.createElement('div');d.className='t-chat-msg'+(me?' me':'');
        d.innerHTML=this.av(m.user)+'<div style="display:flex;flex-direction:column;'+(me?'align-items:flex-end':'')+'"><span style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:4px">'+esc(m.user)+' · '+m.time+'</span><div class="t-chat-bubble">'+esc(m.text)+'</div></div>';
        el.appendChild(d);});el.scrollTop=el.scrollHeight;
    });
  },
  async sendTrivChat(){
    const inp=document.getElementById('t-chat-inp');if(!inp)return;
    const txt=inp.value.trim();if(!txt)return;inp.value='';
    await fbPush('trivia/chat',{id:Date.now()+state.myId,userId:state.myId,user:state.myDisplayName,text:txt,
      time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),ts:Date.now()});
  },

  // ── LEADERBOARD ──
  page_leaderboard(){
    const tab=this.data.lbTab||'global';
    return`<div class="t-screen" style="max-width:480px;margin:0 auto;padding-top:70px" id="t-lb-wrap">
      <button class="t-back" data-tback>← Back</button>
      <div class="t-title">Leaderboard</div>
      <div class="t-tabs"><button class="t-tab ${tab==='global'?'on':''}" onclick="T.data.lbTab='global';T.render()">🌐 Global</button><button class="t-tab ${tab==='friends'?'on':''}" onclick="T.data.lbTab='friends';T.render()">👥 Friends</button></div>
      <div id="t-lb-content"><div style="text-align:center;padding:40px;color:rgba(255,255,255,.3)">Loading…</div></div>
    </div>`;
  },

  async loadLB(){
    const tab=this.data.lbTab||'global';
    const lb=await fbGet('trivia/lb')||{};
    const entries=Object.values(lb).sort((a,b)=>b.totalScore-a.totalScore);
    const medals=['#1','#2','#3'];
    const myRank=entries.findIndex(e=>e.username===state.myDisplayName);
    const el=document.getElementById('t-lb-content');if(!el)return;
    el.innerHTML=(myRank>=0?`<div style="background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.3);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:14px"><span>Your rank:</span><span style="font-family:Orbitron,monospace;font-weight:900">#${myRank+1}</span><span style="margin-left:auto;color:#a78bfa">${(entries[myRank]?.totalScore||0)} pts</span></div>`:'')+
    (entries.length?entries.slice(0,15).map((e,i)=>`<div class="t-lb-row ${e.username===state.myDisplayName?'me':''}">
      <div style="width:32px;text-align:center">${medals[i]||`<span style="font-family:Orbitron,monospace;font-size:11px;color:rgba(255,255,255,.3)">#${i+1}</span>`}</div>
      ${this.avLg(e.username)}
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.username)}${e.username===state.myDisplayName?' <span style="font-size:10px;color:#a78bfa">you</span>':''}</div><div style="font-size:11px;color:rgba(255,255,255,.3)">${e.gamesPlayed||0} games</div></div>
      <div style="text-align:right"><div style="font-family:Orbitron,monospace;font-weight:900;color:#fbbf24">${e.totalScore||0}</div><div style="font-size:10px;color:rgba(255,255,255,.25)">pts</div></div>
    </div>`).join(''):'<div style="text-align:center;padding:40px;color:rgba(255,255,255,.25)">No scores yet. Play some games!</div>');
  },

  // ── PROFILE ──
  page_profile(){
    return`<div class="t-screen" style="max-width:460px;margin:0 auto;padding-top:70px">
      <button class="t-back" data-tback>← Back</button>
      <div style="text-align:center;margin-bottom:28px">
        <div style="width:80px;height:80px;border-radius:24px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:900;background:linear-gradient(135deg,#7c3aed,#ec4899)">${state.myDisplayName[0].toUpperCase()}</div>
        <div style="font-size:24px;font-weight:900">${esc(state.myDisplayName)}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.3);margin-top:4px">${state.currentUser?.email||''}</div>
      </div>
      <div id="t-stats-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="text-align:center;padding:20px;color:rgba(255,255,255,.3)">Loading…</div>
      </div>
      <div class="t-card" style="margin-top:14px;text-align:center">
        <div style="font-size:10px;font-family:Orbitron,monospace;letter-spacing:2px;color:rgba(0,245,196,.5);margin-bottom:8px">AI QUIZ</div>
        <div style="font-size:11px;color:rgba(255,255,255,.25);line-height:1.6">Powered by Claude · No setup needed</div>
      </div>
    </div>`;
  },

  async loadProfile(){
    const stats=await fbGet('trivia/users/'+state.myId)||{totalScore:0,gamesPlayed:0};
    const avg=stats.gamesPlayed?Math.round(stats.totalScore/stats.gamesPlayed):0;
    const el=document.getElementById('t-stats-grid');if(!el)return;
    el.innerHTML=[['🏆','Total Points',stats.totalScore||0,'#fbbf24'],['🎮','Games Played',stats.gamesPlayed||0,'#60a5fa'],['📊','Avg / Game',avg,'#4ade80'],['⭐','Status',stats.gamesPlayed>10?'Pro':'Newcomer','#a78bfa']].map(([ic,label,val,col])=>`<div class="t-stat"><div style="font-size:24px">${ic}</div><div class="t-stat-val" style="color:${col}">${val}</div><div style="font-size:11px;color:rgba(255,255,255,.3);margin-top:4px">${label}</div></div>`).join('');
  },

  // ── BIND (post-render actions) ──
  bindExtra(){
    if(this.screen==='chat'){this.startChat();}
    if(this.screen==='leaderboard'){this.loadLB();}
    if(this.screen==='profile'){this.loadProfile();}
    if(this.screen==='t-waiting'){
      // Poll room for updates
      fbListen('trivia/rooms/'+(this.data.roomCode||'_'),snap=>{
        if(!snap)return;
        this.data.room=snap;
        if(snap.status==='playing'&&this.screen==='t-waiting'){
          fbOff('trivia/rooms/'+this.data.roomCode);
          this.show('game',{questions:snap.questions,cur:0,score:0,log:[],answered:false,sel:null,backTo:'multiplayer'});
          return;
        }
        const pl=document.getElementById('t-players-list');
        if(pl){pl.innerHTML=(snap.players||[]).map(p=>`<div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,.04);border-radius:12px;margin-bottom:6px">${this.avLg(p.username,'width:36px;height:36px;border-radius:10px;font-size:14px')}<span style="flex:1;font-weight:600;font-size:14px">${esc(p.username)}</span>${p.id===snap.hostId?'<span style="font-size:10px;background:rgba(245,158,11,.15);color:#fbbf24;padding:3px 8px;border-radius:20px">Host</span>':''}</div>`).join('');}
      });
    }
    if(this.screen==='quick-play'){
      fbGet('trivia/quizzes').then(qs=>{
        if(!qs)return;const arr=Object.values(qs);if(!arr.length)return;
        const el=document.getElementById('t-saved-quizzes');if(!el)return;
        el.innerHTML='<div class="t-card"><span class="t-label">Saved Quizzes</span><div>'+arr.map(q=>`<button onclick="T.show('game',{questions:${JSON.stringify(q.questions).replace(/"/g,'&quot;')},cur:0,score:0,log:[],answered:false,sel:null,backTo:'home'})" style="width:100%;text-align:left;padding:12px;background:rgba(255,255,255,.04);border-radius:12px;border:1px solid rgba(255,255,255,.07);cursor:none;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:600;font-size:13px">${esc(q.name)}</div><div style="font-size:11px;color:rgba(255,255,255,.3)">${q.questions.length} questions · by ${esc(q.createdBy)}</div></div><span style="color:rgba(255,255,255,.3)">▶</span></button>`).join('')+'</div></div>';
      }).catch(()=>{});
    }
  },
};

// Override render to also call bindExtra
const origRender=T.render.bind(T);
T.render=function(){origRender();this.bindExtra();};


export function openTrivia(){showScreen('trivia');T.show('home');}
export function leaveTrivia(){T.cleanup();showScreen('hub');}
