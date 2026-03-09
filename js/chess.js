// ══ CHESS ══
import { db, ref, set, get, update, fbListen, fbSet } from './firebase.js';
import { state, showScreen, esc } from './state.js';

// ══ CHESS ENGINE ══
// ══════════════════════════════════════════════════════

// Pieces: uppercase=white, lowercase=black
// K=king Q=queen R=rook B=bishop N=knight P=pawn

const CH = {
  PIECES: {
    K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',
    k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'
  },
  VALS: {p:100,n:320,b:330,r:500,q:900,k:20000},
  // PST for positional bonuses (white, flip for black)
  PST: {
    p:[0,0,0,0,0,0,0,0,
       50,50,50,50,50,50,50,50,
       10,10,20,30,30,20,10,10,
       5,5,10,25,25,10,5,5,
       0,0,0,20,20,0,0,0,
       5,-5,-10,0,0,-10,-5,5,
       5,10,10,-20,-20,10,10,5,
       0,0,0,0,0,0,0,0],
    n:[-50,-40,-30,-30,-30,-30,-40,-50,
       -40,-20,0,0,0,0,-20,-40,
       -30,0,10,15,15,10,0,-30,
       -30,5,15,20,20,15,5,-30,
       -30,0,15,20,20,15,0,-30,
       -30,5,10,15,15,10,5,-30,
       -40,-20,0,5,5,0,-20,-40,
       -50,-40,-30,-30,-30,-30,-40,-50],
    b:[-20,-10,-10,-10,-10,-10,-10,-20,
       -10,0,0,0,0,0,0,-10,
       -10,0,5,10,10,5,0,-10,
       -10,5,5,10,10,5,5,-10,
       -10,0,10,10,10,10,0,-10,
       -10,10,10,10,10,10,10,-10,
       -10,5,0,0,0,0,5,-10,
       -20,-10,-10,-10,-10,-10,-10,-20],
    r:[0,0,0,0,0,0,0,0,
       5,10,10,10,10,10,10,5,
       -5,0,0,0,0,0,0,-5,
       -5,0,0,0,0,0,0,-5,
       -5,0,0,0,0,0,0,-5,
       -5,0,0,0,0,0,0,-5,
       -5,0,0,0,0,0,0,-5,
       0,0,0,5,5,0,0,0],
    q:[-20,-10,-10,-5,-5,-10,-10,-20,
       -10,0,0,0,0,0,0,-10,
       -10,0,5,5,5,5,0,-10,
       -5,0,5,5,5,5,0,-5,
       0,0,5,5,5,5,0,-5,
       -10,5,5,5,5,5,0,-10,
       -10,0,5,0,0,0,0,-10,
       -20,-10,-10,-5,-5,-10,-10,-20],
    k:[-30,-40,-40,-50,-50,-40,-40,-30,
       -30,-40,-40,-50,-50,-40,-40,-30,
       -30,-40,-40,-50,-50,-40,-40,-30,
       -30,-40,-40,-50,-50,-40,-40,-30,
       -20,-30,-30,-40,-40,-30,-30,-20,
       -10,-20,-20,-20,-20,-20,-20,-10,
       20,20,0,0,0,0,20,20,
       20,30,10,0,0,10,30,20]
  }
};

// Chess state
let chessBoard=[], chessTurn='w', chessMode='', chessDiff=2;
let chessSelected=null, chessLegal=[], chessMoveLog=[];
let chessLastFrom=-1, chessLastTo=-1;
let chessCapturedW=[], chessCapturedB=[];
let chessKingMoved={w:false,b:false}, chessRookMoved={w0:false,w7:false,b0:false,b7:false};
let chessEnPassant=-1;
let chessOnlineRoom='', chessOnlineColor='w', chessOnlineListener=null;
let chessActive=false, chessAIthinking=false;

// Init board to start position
function chessInitBoard(){
  const start = 'rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR';
  chessBoard = start.split('').map((p,i)=>({p:p==='.'?'':p,i}));
  chessTurn='w';chessMoveLog=[];chessLastFrom=-1;chessLastTo=-1;
  chessCapturedW=[];chessCapturedB=[];chessEnPassant=-1;chessSelected=null;chessLegal=[];
  chessKingMoved={w:false,b:false};chessRookMoved={w0:false,w7:false,b0:false,b7:false};
}

function chessIsWhite(p){return p===p.toUpperCase()&&p!=='';}
function chessIsBlack(p){return p===p.toLowerCase()&&p!=='';}
function chessSide(p){return chessIsWhite(p)?'w':'b';}
function chessOpp(side){return side==='w'?'b':'w';}
function chessIdx(r,c){return r*8+c;}
function chessRC(idx){return{r:Math.floor(idx/8),c:idx%8};}

// Generate pseudo-legal moves for a square
function chessMoves(board, sq, enPassant, rookMoved, kingMoved){
  const {p} = board[sq];
  if(!p) return [];
  const side = chessSide(p);
  const {r,c} = chessRC(sq);
  const moves = [];
  const pt = p.toLowerCase();
  const add = (to)=>{ if(to>=0&&to<64) moves.push(to); };
  const slide = (dr,dc)=>{
    let nr=r+dr,nc=c+dc;
    while(nr>=0&&nr<8&&nc>=0&&nc<8){
      const ti=chessIdx(nr,nc);
      if(board[ti].p){
        if(chessSide(board[ti].p)!==side) moves.push(ti);
        break;
      }
      moves.push(ti); nr+=dr; nc+=dc;
    }
  };
  if(pt==='p'){
    const dir=side==='w'?-1:1;
    const start=side==='w'?6:1;
    const fwd=chessIdx(r+dir,c);
    if(r+dir>=0&&r+dir<8&&!board[fwd].p){
      moves.push(fwd);
      if(r===start&&!board[chessIdx(r+2*dir,c)].p) moves.push(chessIdx(r+2*dir,c));
    }
    for(const dc of[-1,1]){
      if(c+dc>=0&&c+dc<8){
        const cap=chessIdx(r+dir,c+dc);
        if(board[cap].p&&chessSide(board[cap].p)!==side) moves.push(cap);
        if(cap===enPassant) moves.push(cap);
      }
    }
  } else if(pt==='n'){
    for(const[dr,dc] of[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){
      const nr=r+dr,nc=c+dc;
      if(nr>=0&&nr<8&&nc>=0&&nc<8){
        const ti=chessIdx(nr,nc);
        if(!board[ti].p||chessSide(board[ti].p)!==side) moves.push(ti);
      }
    }
  } else if(pt==='b'){
    for(const[dr,dc] of[[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr,dc);
  } else if(pt==='r'){
    for(const[dr,dc] of[[-1,0],[1,0],[0,-1],[0,1]]) slide(dr,dc);
  } else if(pt==='q'){
    for(const[dr,dc] of[[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) slide(dr,dc);
  } else if(pt==='k'){
    for(const[dr,dc] of[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]){
      const nr=r+dr,nc=c+dc;
      if(nr>=0&&nr<8&&nc>=0&&nc<8){
        const ti=chessIdx(nr,nc);
        if(!board[ti].p||chessSide(board[ti].p)!==side) moves.push(ti);
      }
    }
    // Castling
    const kr=side==='w'?7:0;
    if(!kingMoved[side]&&r===kr){
      if(!rookMoved[side+'7']&&!board[chessIdx(kr,5)].p&&!board[chessIdx(kr,6)].p&&board[chessIdx(kr,7)].p==='R'||board[chessIdx(kr,7)].p==='r'){
        if(!chessInCheck(board,side)&&!chessSquareAttacked(board,chessIdx(kr,5),side)&&!chessSquareAttacked(board,chessIdx(kr,6),side))
          moves.push(chessIdx(kr,6));
      }
      if(!rookMoved[side+'0']&&!board[chessIdx(kr,1)].p&&!board[chessIdx(kr,2)].p&&!board[chessIdx(kr,3)].p&&(board[chessIdx(kr,0)].p==='R'||board[chessIdx(kr,0)].p==='r')){
        if(!chessInCheck(board,side)&&!chessSquareAttacked(board,chessIdx(kr,3),side)&&!chessSquareAttacked(board,chessIdx(kr,2),side))
          moves.push(chessIdx(kr,2));
      }
    }
  }
  return moves;
}

function chessSquareAttacked(board,sq,side){
  for(let i=0;i<64;i++){
    if(!board[i].p||chessSide(board[i].p)===side) continue;
    const pm = chessMoves(board,i,-1,{w0:true,w7:true,b0:true,b7:true},{w:true,b:true});
    if(pm.includes(sq)) return true;
  }
  return false;
}

function chessKingSquare(board,side){
  const k=side==='w'?'K':'k';
  return board.findIndex(s=>s.p===k);
}

function chessInCheck(board,side){
  const ks=chessKingSquare(board,side);
  return ks>=0&&chessSquareAttacked(board,ks,side);
}

function chessApplyMove(board,from,to,enPassant,rookMoved,kingMoved,turn){
  const nb=board.map(s=>({...s}));
  const p=nb[from].p; const pt=p.toLowerCase();
  const tgt=nb[to].p;
  // En passant capture
  if(pt==='p'&&to===enPassant&&!tgt){
    const capR=chessRC(to).r+(turn==='w'?1:-1);
    nb[chessIdx(capR,chessRC(to).c)].p='';
  }
  // Castling rook move
  if(pt==='k'){
    const kr=turn==='w'?7:0;
    if(from===chessIdx(kr,4)&&to===chessIdx(kr,6)){nb[chessIdx(kr,5)].p=nb[chessIdx(kr,7)].p;nb[chessIdx(kr,7)].p='';}
    if(from===chessIdx(kr,4)&&to===chessIdx(kr,2)){nb[chessIdx(kr,3)].p=nb[chessIdx(kr,0)].p;nb[chessIdx(kr,0)].p='';}
  }
  nb[to].p=p; nb[from].p='';
  // Pawn promotion auto to queen
  if(pt==='p'&&(chessRC(to).r===0||chessRC(to).r===7)) nb[to].p=turn==='w'?'Q':'q';
  return nb;
}

function chessLegalMoves(board,sq,enPassant,rookMoved,kingMoved,turn){
  const side=chessSide(board[sq].p);
  if(side!==turn) return [];
  return chessMoves(board,sq,enPassant,rookMoved,kingMoved).filter(to=>{
    const nb=chessApplyMove(board,sq,to,enPassant,rookMoved,kingMoved,turn);
    return !chessInCheck(nb,side);
  });
}

function chessAllLegal(board,turn,enPassant,rookMoved,kingMoved){
  const moves=[];
  for(let i=0;i<64;i++){
    if(!board[i].p||chessSide(board[i].p)!==turn) continue;
    const lm=chessLegalMoves(board,i,enPassant,rookMoved,kingMoved,turn);
    lm.forEach(to=>moves.push({from:i,to}));
  }
  return moves;
}

// ── Evaluation ──
function chessEval(board){
  let score=0;
  for(let i=0;i<64;i++){
    const p=board[i].p;if(!p) continue;
    const pt=p.toLowerCase();
    const val=CH.VALS[pt]||0;
    const pst=CH.PST[pt]||[];
    const pstV=pst[chessIsWhite(p)?i:63-i]||0;
    score+=(chessIsWhite(p)?1:-1)*(val+pstV);
  }
  return score;
}

// ── Minimax with alpha-beta ──
function chessMinimax(board,depth,alpha,beta,maxing,turn,enPassant,rookMoved,kingMoved){
  const moves=chessAllLegal(board,turn,enPassant,rookMoved,kingMoved);
  if(depth===0||moves.length===0){
    if(moves.length===0) return chessInCheck(board,turn)?(maxing?-99999:99999):0;
    return chessEval(board);
  }
  // Move ordering: captures first
  moves.sort((a,b)=>(board[b.to].p?1:0)-(board[a.to].p?1:0));
  if(maxing){
    let best=-Infinity;
    for(const mv of moves){
      const nb=chessApplyMove(board,mv.from,mv.to,enPassant,rookMoved,kingMoved,turn);
      const nrm={...rookMoved};const nkm={...kingMoved};
      if(board[mv.from].p.toLowerCase()==='k') nkm[turn]=true;
      if(mv.from===0||mv.to===0) nrm.b0=true;
      if(mv.from===7||mv.to===7) nrm.b7=true;
      if(mv.from===56||mv.to===56) nrm.w0=true;
      if(mv.from===63||mv.to===63) nrm.w7=true;
      let nep=-1;
      if(board[mv.from].p.toLowerCase()==='p'&&Math.abs(mv.from-mv.to)===16)
        nep=(mv.from+mv.to)/2;
      best=Math.max(best,chessMinimax(nb,depth-1,alpha,beta,false,chessOpp(turn),nep,nrm,nkm));
      alpha=Math.max(alpha,best);
      if(beta<=alpha) break;
    }
    return best;
  } else {
    let best=Infinity;
    for(const mv of moves){
      const nb=chessApplyMove(board,mv.from,mv.to,enPassant,rookMoved,kingMoved,turn);
      const nrm={...rookMoved};const nkm={...kingMoved};
      if(board[mv.from].p.toLowerCase()==='k') nkm[turn]=true;
      if(mv.from===0||mv.to===0) nrm.b0=true;
      if(mv.from===7||mv.to===7) nrm.b7=true;
      if(mv.from===56||mv.to===56) nrm.w0=true;
      if(mv.from===63||mv.to===63) nrm.w7=true;
      let nep=-1;
      if(board[mv.from].p.toLowerCase()==='p'&&Math.abs(mv.from-mv.to)===16)
        nep=(mv.from+mv.to)/2;
      best=Math.min(best,chessMinimax(nb,depth-1,alpha,beta,true,chessOpp(turn),nep,nrm,nkm));
      beta=Math.min(beta,best);
      if(beta<=alpha) break;
    }
    return best;
  }
}

function chessAIMove(){
  const depth=[0,1,2,3,4][chessDiff]||2;
  chessAIthinking=true;
  document.getElementById('chess-turn-label').textContent='AI thinking…';
  setTimeout(()=>{
    const moves=chessAllLegal(chessBoard,chessTurn,chessEnPassant,chessRookMoved,chessKingMoved);
    if(!moves.length){chessAIthinking=false;chessCheckEnd();return;}
    let best=null,bestScore=-Infinity;
    for(const mv of moves){
      const nb=chessApplyMove(chessBoard,mv.from,mv.to,chessEnPassant,chessRookMoved,chessKingMoved,chessTurn);
      const score=-chessMinimax(nb,depth-1,-Infinity,Infinity,false,chessOpp(chessTurn),-1,{...chessRookMoved},{...chessKingMoved});
      if(score>bestScore){bestScore=score;best=mv;}
    }
    if(best){chessDoMove(best.from,best.to);}
    chessAIthinking=false;
  }, depth>=3?80:20);
}

// ── Render board ──
function chessRender(){
  const bd=document.getElementById('chess-board');if(!bd)return;
  bd.innerHTML='';
  // Determine board orientation (always white bottom unless online black)
  const flip=chessMode==='online'&&chessOnlineColor==='b';
  for(let ri=0;ri<8;ri++){
    for(let ci=0;ci<8;ci++){
      const r=flip?7-ri:ri;
      const c_=flip?7-ci:ci;
      const sq=chessIdx(r,c_);
      const div=document.createElement('div');
      div.className='cs '+((r+c_)%2===0?'light':'dark');
      // Highlights
      if(sq===chessSelected) div.classList.add('sel');
      if(chessLegal.includes(sq)){
        div.classList.add('legal');
        if(chessBoard[sq].p) div.classList.add('occ');
      }
      if(sq===chessLastFrom||sq===chessLastTo) div.classList.add('lastmove');
      // Check highlight
      if(chessInCheck(chessBoard,chessTurn)){
        const ks=chessKingSquare(chessBoard,chessTurn);
        if(sq===ks) div.classList.add('check');
      }
      // Piece
      if(chessBoard[sq].p){
        const sp=document.createElement('span');
        sp.className='cp '+(chessIsWhite(chessBoard[sq].p)?'w':'b');
        sp.textContent=CH.PIECES[chessBoard[sq].p]||'';
        div.appendChild(sp);
      }
      // Coords label
      if(c_===0){const lbl=document.createElement('span');lbl.style.cssText='position:absolute;top:2px;left:3px;font-size:9px;font-family:Orbitron,monospace;font-weight:700;color:rgba(255,255,255,.55);pointer-events:none;z-index:3;line-height:1;';lbl.textContent=8-r;div.appendChild(lbl);}
      if(r===7){const lbl=document.createElement('span');lbl.style.cssText='position:absolute;bottom:2px;right:3px;font-size:9px;font-family:Orbitron,monospace;font-weight:700;color:rgba(255,255,255,.55);pointer-events:none;z-index:3;line-height:1;';lbl.textContent='abcdefgh'[c_];div.appendChild(lbl);}
      div.addEventListener('click',()=>chessClickSquare(sq));
      bd.appendChild(div);
    }
  }
  // Turn label
  const tl=document.getElementById('chess-turn-label');
  if(tl&&!chessAIthinking){
    const inChk=chessInCheck(chessBoard,chessTurn);
    let label='';
    if(chessMode==='ai'){
      label=chessTurn==='w'?'Your Move':'AI Thinking…';
    } else if(chessMode==='online'){
      label=chessTurn===chessOnlineColor?'Your Move':"Opponent's Turn";
    } else {
      label=(chessTurn==='w'?'White':'Black')+' to Move';
    }
    if(inChk) label='Check! '+label;
    tl.textContent=label;
    tl.style.background=inChk?'rgba(244,63,94,.15)':chessTurn===(chessOnlineColor||'w')&&chessMode!=='pass'?'rgba(74,222,128,.1)':'rgba(255,255,255,.05)';
    tl.style.color=inChk?'#f43f5e':chessTurn===(chessOnlineColor||'w')&&chessMode!=='pass'?'#4ade80':'rgba(255,255,255,.5)';
  }
  // Captured
  const capTop=document.getElementById('chess-cap-top');
  const capBot=document.getElementById('chess-cap-bot');
  const bottomSide=chessMode==='online'?chessOnlineColor:'w';
  const topSide=chessOpp(bottomSide);
  if(capTop) capTop.innerHTML=(topSide==='w'?chessCapturedW:chessCapturedB).map(p=>`<span class="chess-cap-piece">${CH.PIECES[p]||''}</span>`).join('');
  if(capBot) capBot.innerHTML=(bottomSide==='w'?chessCapturedW:chessCapturedB).map(p=>`<span class="chess-cap-piece">${CH.PIECES[p]||''}</span>`).join('');
}

function chessClickSquare(sq){
  if(!chessActive) return;
  // Online: only move if it's your color's turn
  if(chessMode==='online'&&chessTurn!==chessOnlineColor) return;
  if(chessMode==='ai'&&chessTurn!=='w') return;// player is always white vs AI
  if(chessAIthinking) return;

  if(chessSelected===null){
    if(chessBoard[sq].p&&chessSide(chessBoard[sq].p)===chessTurn){
      chessSelected=sq;
      chessLegal=chessLegalMoves(chessBoard,sq,chessEnPassant,chessRookMoved,chessKingMoved,chessTurn);
      chessRender();
    }
  } else {
    if(chessLegal.includes(sq)){
      chessDoMove(chessSelected,sq);
    } else if(chessBoard[sq].p&&chessSide(chessBoard[sq].p)===chessTurn){
      chessSelected=sq;
      chessLegal=chessLegalMoves(chessBoard,sq,chessEnPassant,chessRookMoved,chessKingMoved,chessTurn);
      chessRender();
    } else {
      chessSelected=null;chessLegal=[];chessRender();
    }
  }
}

function chessDoMove(from,to){
  const p=chessBoard[from].p;
  const tgt=chessBoard[to].p;
  // Track captures
  if(tgt){(chessTurn==='w'?chessCapturedW:chessCapturedB).push(tgt);}
  // En passant capture
  const pt=p.toLowerCase();
  let nEP=-1;
  if(pt==='p'&&Math.abs(from-to)===16) nEP=(from+to)/2;
  if(pt==='p'&&to===chessEnPassant&&!tgt){
    const capR=chessRC(to).r+(chessTurn==='w'?1:-1);
    const capSq=chessIdx(capR,chessRC(to).c);
    (chessTurn==='w'?chessCapturedW:chessCapturedB).push(chessBoard[capSq].p);
  }
  chessBoard=chessApplyMove(chessBoard,from,to,chessEnPassant,chessRookMoved,chessKingMoved,chessTurn);
  // Update rook/king moved flags
  if(pt==='k') chessKingMoved[chessTurn]=true;
  if(from===0||to===0) chessRookMoved.b0=true;
  if(from===7||to===7) chessRookMoved.b7=true;
  if(from===56||to===56) chessRookMoved.w0=true;
  if(from===63||to===63) chessRookMoved.w7=true;
  chessEnPassant=nEP;
  chessLastFrom=from;chessLastTo=to;
  // Log
  const files='abcdefgh';
  const {r:fr,c:fc}=chessRC(from);const {r:tr,c:tc}=chessRC(to);
  chessMoveLog.push(files[fc]+(8-fr)+files[tc]+(8-tr));
  const ml=document.getElementById('chess-move-log');
  if(ml) ml.textContent=chessMoveLog.slice(-8).join(' ');
  chessSelected=null;chessLegal=[];
  chessTurn=chessOpp(chessTurn);
  // Online: push to Firebase
  if(chessMode==='online') chessPushOnlineMove(from,to);
  chessRender();
  chessCheckEnd();
  // AI responds
  if(chessMode==='ai'&&chessTurn==='b'&&chessActive) setTimeout(chessAIMove,200);
}

function chessCheckEnd(){
  const moves=chessAllLegal(chessBoard,chessTurn,chessEnPassant,chessRookMoved,chessKingMoved);
  if(moves.length===0){
    const inCheck=chessInCheck(chessBoard,chessTurn);
    const winner=chessOpp(chessTurn);
    chessShowResult(inCheck?'Checkmate':'Stalemate',inCheck?(winner==='w'?'White wins':'Black wins'):'Draw — Stalemate');
  }
}

function chessShowResult(title,sub){
  chessActive=false;
  document.getElementById('chess-result-title').textContent=title;
  document.getElementById('chess-result-sub').textContent=sub;
  document.getElementById('chess-result').classList.add('on');
}

// ── Navigation helpers ──
export function openChess(){
  showScreen('chess');chessActive=false;
  document.getElementById('chess-lobby').classList.add('on');
  document.getElementById('chess-game').style.display='none';
  document.getElementById('chess-result').classList.remove('on');
  document.getElementById('chess-diff-picker').classList.remove('on');
  document.getElementById('chess-online-panel').classList.remove('on');
}
export function leaveChess(){
  chessActive=false;
  if(chessOnlineListener){chessOnlineListener();chessOnlineListener=null;}
  showScreen('hub');
}
export function chessPickAI(back){
  if(back){document.getElementById('chess-diff-picker').classList.remove('on');return;}
  document.getElementById('chess-diff-picker').classList.add('on');
  document.getElementById('chess-online-panel').classList.remove('on');
}
export function chessShowOnline(back){
  if(back){document.getElementById('chess-online-panel').classList.remove('on');return;}
  document.getElementById('chess-online-panel').classList.add('on');
  document.getElementById('chess-diff-picker').classList.remove('on');
  document.getElementById('chess-room-code').textContent='----';
  document.getElementById('chess-onl-status').textContent='';
}
function chessStartGame(mode){
  chessMode=mode;chessInitBoard();chessActive=true;
  document.getElementById('chess-lobby').classList.remove('on');
  document.getElementById('chess-game').style.display='flex';
  document.getElementById('chess-result').classList.remove('on');
  // Player name labels
  const isOnline=mode==='online';
  const botName=mode==='ai'?['Novice','Easy','Medium','Hard'][chessDiff-1]+' AI':'Player 2';
  document.getElementById('chess-name-top').textContent=isOnline?(chessOnlineColor==='w'?'Opponent':'You'):botName;
  const nb=document.getElementById('chess-name-top');
  const dotTop=document.getElementById('chess-dot-top');
  const bottomColor=mode==='online'?chessOnlineColor:'w';
  dotTop.style.background=bottomColor==='w'?'#4ade80':'rgba(255,255,255,.4)';
  chessRender();
  if(mode==='ai'&&chessTurn==='b') setTimeout(chessAIMove,400);
}
export function chessStartAI(diff){chessDiff=diff;chessStartGame('ai');}
export function chessStartPass(){chessStartGame('pass');}
export function chessResign(){
  const winner=chessOpp(chessTurn);
  chessShowResult('Resigned',(winner==='w'?'White':'Black')+' wins by resignation');
}
export function chessPlayAgain(){
  document.getElementById('chess-result').classList.remove('on');
  if(chessMode==='ai') chessStartAI(chessDiff);
  else if(chessMode==='pass') chessStartPass();
  else openChess();
}

// ── Online / Firebase ──
function chessGenCode(){return Math.random().toString(36).substring(2,6).toUpperCase();}
export function chessCreateRoom(){
  const code=chessGenCode();
  document.getElementById('chess-room-code').textContent=code;
  document.getElementById('chess-onl-status').textContent='Waiting for opponent…';
  chessOnlineRoom=code;chessOnlineColor='w';
  const roomRef=ref(db,'chess/'+code);
  set(roomRef,{board:JSON.stringify(chessBoard.map(s=>s.p||'')),turn:'w',move:null,white:state.myDisplayName||'Player',black:''});
  // Listen for opponent join + moves
  if(chessOnlineListener){chessOnlineListener();chessOnlineListener=null;}
  chessOnlineListener=fbListen('chess/'+code,d=>{
    if(!d)return;
    if(d.black&&d.black!==''&&document.getElementById('chess-game').style.display==='none'){
      document.getElementById('chess-onl-status').textContent='';
      chessStartGame('online');
    }
    if(d.move&&d.move.from!==undefined&&chessTurn!==chessOnlineColor&&chessActive){
      chessBoard=JSON.parse(d.board).map((p,i)=>({p,i}));
      chessTurn=d.turn;
      chessLastFrom=d.move.from;chessLastTo=d.move.to;
      chessSelected=null;chessLegal=[];
      chessRender();chessCheckEnd();
    }
  });
}
export function chessJoinRoom(){
  const code=document.getElementById('chess-join-input').value.trim().toUpperCase();
  if(code.length!==4){document.getElementById('chess-onl-status').textContent='Enter 4-letter code';return;}
  document.getElementById('chess-onl-status').textContent='Joining…';
  chessOnlineRoom=code;chessOnlineColor='b';
  get(ref(db,'chess/'+code)).then(snap=>{
    const d=snap.val();
    if(!d){document.getElementById('chess-onl-status').textContent='Room not found';return;}
    update(ref(db,'chess/'+code),{black:state.myDisplayName||'Player 2'});
    chessBoard=JSON.parse(d.board).map((p,i)=>({p,i}));
    chessTurn=d.turn||'w';
    if(chessOnlineListener){chessOnlineListener();chessOnlineListener=null;}
    chessOnlineListener=fbListen('chess/'+code,d2=>{
      if(!d2) return;
      if(d2.move&&d2.move.from!==undefined&&chessTurn!==chessOnlineColor&&chessActive){
        chessBoard=JSON.parse(d2.board).map((p,i)=>({p,i}));
        chessTurn=d2.turn;
        chessLastFrom=d2.move.from;chessLastTo=d2.move.to;
        chessSelected=null;chessLegal=[];
        chessRender();chessCheckEnd();
      }
    });
    chessStartGame('online');
  }).catch(()=>{document.getElementById('chess-onl-status').textContent='Error — check code';});
}
function chessPushOnlineMove(from,to){
  const gameState={
    board:JSON.stringify(chessBoard.map(s=>s.p||'')),
    turn:chessTurn,
    move:{from,to}
  };
  update(ref(db,'chess/'+chessOnlineRoom),gameState);
}

// ══ UTIL ══
