// ══ TETRIS ══
import { showScreen } from './state.js';

// ══════════════════════════════════════════════════
// ══ TETRIS ══
// ══════════════════════════════════════════════════
let tetActive=false;
let tetRAF=null;
let tetCtx=null,tetNextCtx=null;
let tetGameOver=false;

const TETGRID=32;
const tetColors={
  'I':'#22d3ee','O':'#fbbf24','T':'#a855f7','S':'#4ade80','Z':'#f87171','J':'#60a5fa','L':'#fb923c'};
const tetGlow={
  'I':'rgba(34,211,238,.6)','O':'rgba(251,191,36,.6)','T':'rgba(168,85,247,.6)',
  'S':'rgba(74,222,128,.6)','Z':'rgba(248,113,113,.6)','J':'rgba(96,165,250,.6)','L':'rgba(251,146,60,.6)'};
const tetrominos={
  'I':[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  'J':[[1,0,0],[1,1,1],[0,0,0]],
  'L':[[0,0,1],[1,1,1],[0,0,0]],
  'O':[[1,1],[1,1]],
  'S':[[0,1,1],[1,1,0],[0,0,0]],
  'Z':[[1,1,0],[0,1,1],[0,0,0]],
  'T':[[0,1,0],[1,1,1],[0,0,0]]
};

let tetSeq=[],tetField=[],tetPiece=null,tetCount=0,tetScore=0,tetLevel=1,tetLines=0;

function tetRandInt(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function tetGenSeq(){
  const s=['I','J','L','O','S','T','Z'];
  while(s.length){const i=tetRandInt(0,s.length-1);tetSeq.push(s.splice(i,1)[0]);}
}
function tetNextPiece(){
  if(!tetSeq.length)tetGenSeq();
  const name=tetSeq.pop();
  const mat=tetrominos[name].map(r=>[...r]);
  const col=Math.floor(10/2)-Math.ceil(mat[0].length/2);
  const row=name==='I'?-1:-2;
  return{name,matrix:mat,row,col};
}
function tetRotate(m){const N=m.length-1;return m.map((row,i)=>row.map((v,j)=>m[N-j][i]));}
function tetValid(mat,r,col){
  for(let row=0;row<mat.length;row++)for(let c=0;c<mat[row].length;c++){
    if(mat[row][c]&&(col+c<0||col+c>=10||r+row>=20||tetField[r+row]?.[col+c]))return false;}
  return true;
}
function tetPlace(){
  for(let r=0;r<tetPiece.matrix.length;r++)for(let c=0;c<tetPiece.matrix[r].length;c++){
    if(tetPiece.matrix[r][c]){
      if(tetPiece.row+r<0){tetEndGame();return;}
      tetField[tetPiece.row+r][tetPiece.col+c]=tetPiece.name;}}
  let cleared=0;
  for(let r=tetField.length-1;r>=0;){
    if(tetField[r].every(c=>!!c)){
      tetField.splice(r,1);tetField.unshift(new Array(10).fill(0));cleared++;}
    else r--;
  }
  if(cleared){
    const pts=[0,100,300,500,800];
    tetScore+=pts[cleared]*tetLevel;
    tetLines+=cleared;
    tetLevel=Math.floor(tetLines/10)+1;
    document.getElementById('tet-score').textContent=tetScore;
    document.getElementById('tet-level').textContent=tetLevel;
    document.getElementById('tet-lines').textContent=tetLines;
  }
  tetPiece=tetNextPiece();
}
function tetEndGame(){
  tetGameOver=true;cancelAnimationFrame(tetRAF);
  tetCtx.fillStyle='rgba(0,0,0,.75)';
  tetCtx.fillRect(0,tetCtx.canvas.height/2-40,tetCtx.canvas.width,80);
  tetCtx.fillStyle='#22d3ee';tetCtx.font='bold 28px Orbitron,monospace';
  tetCtx.textAlign='center';tetCtx.textBaseline='middle';
  tetCtx.fillText('GAME OVER',tetCtx.canvas.width/2,tetCtx.canvas.height/2-10);
  tetCtx.font='14px Orbitron,monospace';tetCtx.fillStyle='rgba(255,255,255,.6)';
  tetCtx.fillText('Press R to restart',tetCtx.canvas.width/2,tetCtx.canvas.height/2+20);
}
function tetDrawNext(){
  const nc=tetNextCtx;if(!nc)return;
  nc.clearRect(0,0,120,80);nc.fillStyle='#111';nc.fillRect(0,0,120,80);
  if(!tetSeq.length)return;
  const name=tetSeq[tetSeq.length-1];const mat=tetrominos[name];
  const sz=16;const ox=(120-mat[0].length*sz)/2,oy=(80-mat.length*sz)/2;
  mat.forEach((row,r)=>row.forEach((v,c)=>{if(v){
    nc.fillStyle=tetColors[name];nc.fillRect(ox+c*sz,oy+r*sz,sz-1,sz-1);}}));
}
function tetDraw(){
  const ctx=tetCtx;
  // dark grid background
  ctx.fillStyle='#060612';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
  ctx.strokeStyle='rgba(255,255,255,.03)';ctx.lineWidth=1;
  for(let r=0;r<=20;r++){ctx.beginPath();ctx.moveTo(0,r*TETGRID);ctx.lineTo(ctx.canvas.width,r*TETGRID);ctx.stroke();}
  for(let cc=0;cc<=10;cc++){ctx.beginPath();ctx.moveTo(cc*TETGRID,0);ctx.lineTo(cc*TETGRID,ctx.canvas.height);ctx.stroke();}
  // ghost
  if(tetPiece){
    let gr=tetPiece.row;
    while(tetValid(tetPiece.matrix,gr+1,tetPiece.col))gr++;
    ctx.fillStyle='rgba(255,255,255,.08)';
    tetPiece.matrix.forEach((row,r)=>row.forEach((v,c)=>{if(v)ctx.fillRect((tetPiece.col+c)*TETGRID,(gr+r)*TETGRID,TETGRID-1,TETGRID-1);}));
  }
  // field
  for(let r=0;r<20;r++)for(let c=0;c<10;c++){
    if(tetField[r][c]){
      const n=tetField[r][c];
      ctx.shadowBlur=8;ctx.shadowColor=tetGlow[n]||'transparent';
      ctx.fillStyle=tetColors[n];ctx.fillRect(c*TETGRID,r*TETGRID,TETGRID-2,TETGRID-2);
      // inner highlight
      ctx.fillStyle='rgba(255,255,255,.15)';ctx.fillRect(c*TETGRID+1,r*TETGRID+1,TETGRID-4,4);
      ctx.shadowBlur=0;
    }
  }
  // active
  if(tetPiece){
    const n=tetPiece.name;
    ctx.shadowBlur=14;ctx.shadowColor=tetGlow[n]||'transparent';
    ctx.fillStyle=tetColors[n];
    tetPiece.matrix.forEach((row,r)=>row.forEach((v,c)=>{
      if(v){ctx.fillRect((tetPiece.col+c)*TETGRID,(tetPiece.row+r)*TETGRID,TETGRID-2,TETGRID-2);
        ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect((tetPiece.col+c)*TETGRID+1,(tetPiece.row+r)*TETGRID+1,TETGRID-4,4);
        ctx.fillStyle=tetColors[n];}
    }));
    ctx.shadowBlur=0;
  }
  tetDrawNext();
}
function tetLoop(){
  if(!tetActive)return;
  tetRAF=requestAnimationFrame(tetLoop);
  if(tetGameOver)return;
  const speed=Math.max(5,35-tetLevel*2);
  if(++tetCount>speed){
    tetPiece.row++;tetCount=0;
    if(!tetValid(tetPiece.matrix,tetPiece.row,tetPiece.col)){tetPiece.row--;tetPlace();}
  }
  tetDraw();
}
function tetInitField(){tetField=[];for(let r=0;r<20;r++)tetField.push(new Array(10).fill(0));}
function tetInitInput(){
  // Remove old listener if any
  if(window.__tetKeyHandler)document.removeEventListener('keydown',window.__tetKeyHandler);
  window.__tetKeyHandler=function(e){
    if(!tetActive)return;
    if(tetGameOver){if(e.key==='r'||e.key==='R'){restartTetris();}return;}
    if(e.key==='ArrowLeft'){if(tetValid(tetPiece.matrix,tetPiece.row,tetPiece.col-1))tetPiece.col--;}
    if(e.key==='ArrowRight'){if(tetValid(tetPiece.matrix,tetPiece.row,tetPiece.col+1))tetPiece.col++;}
    if(e.key==='ArrowUp'){const m=tetRotate(tetPiece.matrix);if(tetValid(m,tetPiece.row,tetPiece.col))tetPiece.matrix=m;}
    if(e.key==='ArrowDown'){
      tetPiece.row++;
      if(!tetValid(tetPiece.matrix,tetPiece.row,tetPiece.col)){tetPiece.row--;tetPlace();}
    }
    if(e.key===' '){
      while(tetValid(tetPiece.matrix,tetPiece.row+1,tetPiece.col))tetPiece.row++;
      tetPlace();
    }
  };
  document.addEventListener('keydown',window.__tetKeyHandler);
}
export function openTetris(){
  showScreen('tetris');
  tetActive=true;tetGameOver=false;tetScore=0;tetLevel=1;tetLines=0;tetCount=0;tetSeq=[];
  document.getElementById('tet-score').textContent='0';
  document.getElementById('tet-level').textContent='1';
  document.getElementById('tet-lines').textContent='0';
  tetCtx=document.getElementById('tetris-canvas').getContext('2d');
  tetNextCtx=document.getElementById('tet-next').getContext('2d');
  tetInitField();tetGenSeq();tetPiece=tetNextPiece();
  tetInitInput();
  cancelAnimationFrame(tetRAF);tetLoop();
}
export function leaveTetris(){
  tetActive=false;cancelAnimationFrame(tetRAF);showScreen('hub');}
function restartTetris(){
  tetGameOver=false;tetScore=0;tetLevel=1;tetLines=0;tetCount=0;tetSeq=[];
  document.getElementById('tet-score').textContent='0';
  document.getElementById('tet-level').textContent='1';
  document.getElementById('tet-lines').textContent='0';
  tetInitField();tetGenSeq();tetPiece=tetNextPiece();
  cancelAnimationFrame(tetRAF);tetLoop();
}

// ══════════════════════════════════════════════════
// ══ 2048 ══
