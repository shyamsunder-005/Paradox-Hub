// ══ 2048 ══
import { showScreen } from './state.js';

// ══ 2048 ══
// ══════════════════════════════════════════════════
let g2048_cells=[];
let g2048_score=0;
let g2048_best=parseInt(localStorage.getItem('paradox_2048_best')||'0');
let g2048_over=false;
let g2048_won=false;

const G2048_COLORS={
  0:'rgba(255,255,255,0)',2:'#1a1a2e',4:'#16213e',8:'#0f3460',16:'#533483',
  32:'#7c3aed',64:'#a855f7',128:'#f59e0b',256:'#f97316',
  512:'#ef4444',1024:'#ec4899',2048:'#fbbf24'};
const G2048_BORDER={0:'transparent',2:'rgba(255,255,255,.08)',4:'rgba(255,255,255,.1)',
  8:'rgba(96,165,250,.4)',16:'rgba(139,92,246,.4)',32:'rgba(124,58,237,.5)',
  64:'rgba(168,85,247,.5)',128:'rgba(245,158,11,.5)',256:'rgba(249,115,22,.5)',
  512:'rgba(239,68,68,.5)',1024:'rgba(236,72,153,.5)',2048:'rgba(251,191,36,.7)'};
const G2048_TEXT={0:'transparent',2:'rgba(255,255,255,.5)',4:'rgba(255,255,255,.6)',
  8:'#93c5fd',16:'#c4b5fd',32:'#ddd6fe',64:'#f5d0fe',
  128:'#fde68a',256:'#fed7aa',512:'#fecaca',1024:'#fbcfe8',2048:'#fef08a'};

function g2048_init(){
  // build grid cells
  const grid=document.getElementById('g2048-grid');
  if(grid)grid.innerHTML=Array(16).fill('<div class="g2048-cell"></div>').join('');
  g2048_cells=Array(16).fill(0);
  g2048_over=false;g2048_won=false;
  g2048_score=0;
  document.getElementById('g2048-over').classList.remove('on');
  document.getElementById('g2048-win').classList.remove('on');
  document.getElementById('g2048-score').textContent='0';
  document.getElementById('g2048-best').textContent=g2048_best;
  g2048_addRandom();g2048_addRandom();g2048_render();
}

function g2048_cellSize(){
  const b=document.getElementById('g2048-board');
  if(!b)return 80;
  return Math.floor((b.offsetWidth-24-30)/4);
}

function g2048_render(){
  const container=document.getElementById('g2048-tiles');if(!container)return;
  container.innerHTML='';
  const sz=g2048_cellSize();const gap=10;
  g2048_cells.forEach((val,i)=>{
    if(!val)return;
    const r=Math.floor(i/4),col=i%4;
    const x=col*(sz+gap),y=r*(sz+gap);
    const div=document.createElement('div');
    div.className='g2048-tile';
    const bdr=G2048_BORDER[val]||'rgba(255,255,255,.15)';
    const glow=val>=128?`box-shadow:0 0 ${val>=512?20:10}px ${bdr};`:'' ;
    div.style.cssText=`left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;background:${G2048_COLORS[val]||'#3c3a32'};color:${G2048_TEXT[val]||'#f9f6f2'};font-size:${val>999?sz*.26:val>99?sz*.32:sz*.40}px;border:1px solid ${bdr};${glow}`;
    div.textContent=val;
    container.appendChild(div);
  });
}

function g2048_addRandom(){
  const empty=g2048_cells.map((v,i)=>v===0?i:-1).filter(i=>i>=0);
  if(!empty.length)return;
  const i=empty[Math.floor(Math.random()*empty.length)];
  g2048_cells[i]=Math.random()<0.9?2:4;
}

function g2048_slide(row){
  let arr=row.filter(v=>v);
  for(let i=0;i<arr.length-1;i++){
    if(arr[i]===arr[i+1]){
      const merged=arr[i]*2;arr[i]=merged;arr.splice(i+1,1);
      g2048_score+=merged;
      if(merged===2048&&!g2048_won)g2048_won=true;
    }
  }
  while(arr.length<4)arr.push(0);
  return arr;
}

function g2048_move(dir){
  if(g2048_over)return;
  let moved=false;
  const prev=g2048_cells.slice();
  if(dir==='left'||dir==='right'){
    for(let r=0;r<4;r++){
      let row=g2048_cells.slice(r*4,r*4+4);
      if(dir==='right')row.reverse();
      const slid=g2048_slide(row);
      if(dir==='right')slid.reverse();
      for(let c=0;c<4;c++)g2048_cells[r*4+c]=slid[c];
    }
  }else{
    for(let col=0;col<4;col++){
      let row=[0,1,2,3].map(r=>g2048_cells[r*4+col]);
      if(dir==='down')row.reverse();
      const slid=g2048_slide(row);
      if(dir==='down')slid.reverse();
      slid.forEach((v,r)=>g2048_cells[r*4+col]=v);
    }
  }
  moved=prev.some((v,i)=>v!==g2048_cells[i]);
  if(moved){
    if(g2048_score>g2048_best){g2048_best=g2048_score;localStorage.setItem('paradox_2048_best',g2048_best);}
    document.getElementById('g2048-score').textContent=g2048_score;
    document.getElementById('g2048-best').textContent=g2048_best;
    g2048_addRandom();g2048_render();
    if(g2048_won){document.getElementById('g2048-win').classList.add('on');g2048_won=false;}
    else if(g2048_checkOver()){g2048_over=true;document.getElementById('g2048-over').classList.add('on');}
  }
}

function g2048_checkOver(){
  if(g2048_cells.includes(0))return false;
  for(let r=0;r<4;r++)for(let c=0;c<4;c++){
    const i=r*4+c;
    if(c<3&&g2048_cells[i]===g2048_cells[i+1])return false;
    if(r<3&&g2048_cells[i]===g2048_cells[i+4])return false;
  }
  return true;
}

function g2048_setupInput(){
  if(window.__g2048KeyHandler)document.removeEventListener('keydown',window.__g2048KeyHandler);
  window.__g2048KeyHandler=function(e){
    if(document.getElementById('g2048-screen').classList.contains('on')){
      const map={'ArrowLeft':'left','ArrowRight':'right','ArrowUp':'up','ArrowDown':'down'};
      if(map[e.key]){e.preventDefault();g2048_move(map[e.key]);}
    }
  };
  document.addEventListener('keydown',window.__g2048KeyHandler);
  // touch
  const board=document.getElementById('g2048-board');if(!board)return;
  let tx=0,ty=0;
  board.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
  board.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
    if(Math.abs(dx)<20&&Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy))g2048_move(dx<0?'left':'right');
    else g2048_move(dy<0?'up':'down');
  });
}

export function open2048(){showScreen('g2048');setTimeout(()=>{g2048_init();g2048_setupInput();},50);}
export function leave2048(){showScreen('hub');}
export function restart2048(){g2048_init();}


// ══════════════════════════════════════════════════════
// ══ CHESS ENGINE ══
// ══════════════════════════════════════════════════════
