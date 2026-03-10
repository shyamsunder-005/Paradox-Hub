// ══ MAIN ENTRY POINT ══
import { auth, onAuthStateChanged } from './firebase.js';
import { state, showScreen } from './state.js';
import { authTab, authKey, doSignIn, doSignUp, doSignOut, setAuthCallbacks } from './auth.js';
import { hubLbTab, sendFriendReq, acceptFriendReq, declineFriendReq,
         initHub, renderHubBg } from './hub.js';
import { openBlob, leaveBlob, enterRoom, genAndFill, toggleBlobStyle,
         setTab, sendChat, chatKey, restartGame, lobbyTab, createRoom, joinRoom } from './blob.js';
import { openTrivia, leaveTrivia, T } from './trivia.js';
import { openTetris, leaveTetris } from './tetris.js';
import { open2048, leave2048, restart2048 } from './g2048.js';
import { openChess, leaveChess, chessPickAI, chessStartPass, chessShowOnline,
         chessCreateRoom, chessJoinRoom, chessStartAI, chessResign, chessPlayAgain } from './chess.js';
import { openMilitia, leaveMilitia, mlBackLobby, mlDismissInstructions,
         mlPickAI, mlPickOnline, mlBackMode, mlStartAI,
         mlCreateRoom, mlJoinRoom, mlStartOnline } from './militia.js';

// Wire auth callbacks (doSignUp needs initHub + renderHubBg)
setAuthCallbacks(initHub, renderHubBg);

// ── AUTH STATE ──
onAuthStateChanged(auth, user => {
  state.currentUser = user;
  if(user){
    state.myId = 'u_' + user.uid;
    state.myDisplayName = user.displayName || user.email.split('@')[0];
    const ni = document.getElementById('inp-name');
    if(ni && !ni.value) ni.value = state.myDisplayName;
    document.getElementById('hub-uname').textContent = state.myDisplayName;
    document.getElementById('hub-av').textContent = state.myDisplayName[0].toUpperCase();
    showScreen('hub');
    renderHubBg();
    initHub();
  } else {
    showScreen('login');
  }
});

// ── Login bg particles ──
(function(){
  const c = document.getElementById('login-bg'), x = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const pts = Array.from({length:60}, () => ({
    x: Math.random()*c.width, y: Math.random()*c.height,
    r: Math.random()*2+.5, vx: (Math.random()-.5)*.3, vy: (Math.random()-.5)*.3,
    cl: Math.random()<.5 ? 'rgba(0,245,196,' : 'rgba(124,58,237,'
  }));
  function dp(){
    x.clearRect(0,0,c.width,c.height);
    pts.forEach(p => {
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=c.width; if(p.x>c.width)p.x=0;
      if(p.y<0)p.y=c.height; if(p.y>c.height)p.y=0;
      x.beginPath(); x.arc(p.x,p.y,p.r,0,Math.PI*2);
      x.fillStyle=p.cl+'.45)'; x.fill();
    });
    requestAnimationFrame(dp);
  }
  dp();
})();

// ── EXPOSE TO WINDOW (pre-stub delegation) ──
window.__authTab = authTab;
window.__authKey = authKey;
window.__doSignIn = doSignIn;
window.__doSignUp = doSignUp;
window.__doSignOut = doSignOut;

window.__openBlob = openBlob;
window.__openTrivia = openTrivia;
window.__leaveBlob = leaveBlob;
window.__leaveTrivia = leaveTrivia;

window.__openTetris = openTetris;
window.__leaveTetris = leaveTetris;
window.__open2048 = open2048;
window.__leave2048 = leave2048;
window.__restart2048 = restart2048;

window.__openChess = openChess;
window.__leaveChess = leaveChess;
window.__chessPickAI = chessPickAI;
window.__chessStartPass = chessStartPass;
window.__chessShowOnline = chessShowOnline;
window.__chessCreateRoom = chessCreateRoom;
window.__chessJoinRoom = chessJoinRoom;
window.__chessStartAI = chessStartAI;
window.__chessResign = chessResign;
window.__chessPlayAgain = chessPlayAgain;

window.__openMilitia = openMilitia;
window.__leaveMilitia = leaveMilitia;
window.__mlBackLobby = mlBackLobby;
window.__mlDismissInstructions = mlDismissInstructions;
window.__mlPickAI = mlPickAI;
window.__mlPickOnline = mlPickOnline;
window.__mlBackMode = mlBackMode;
window.__mlStartAI = mlStartAI;
window.__mlCreateRoom = mlCreateRoom;
window.__mlJoinRoom = mlJoinRoom;
window.__mlStartOnline = mlStartOnline;

window.__hubLbTab = hubLbTab;
window.__sendFriendReq = sendFriendReq;
window.__acceptFriendReq = acceptFriendReq;
window.__declineFriendReq = declineFriendReq;
window.__lobbyTab = lobbyTab;
window.__createRoom = createRoom;
window.__joinRoom = joinRoom;
window.__enterRoom = enterRoom;
window.__genAndFill = genAndFill;
window.__toggleBlobStyle = toggleBlobStyle;

window.__setTab = setTab;
window.__sendChat = sendChat;
window.__chatKey = chatKey;
window.__restartGame = restartGame;

window.T = T;

