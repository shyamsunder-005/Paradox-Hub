// ══ AUTH ══
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile } from './firebase.js';
import { state, showScreen, esc } from './state.js';

export function authTab(t){
  ['in','up'].forEach(x=>{
    document.getElementById('ltab-'+x).className='login-tab'+(x===t?' on':'');
    document.getElementById('auth-panel-'+x).style.display=x===t?'block':'none';
  });
  showAuthErr('');
}
export function authKey(e,p){if(e.key==='Enter')p==='in'?doSignIn():doSignUp();}
export function showAuthErr(m){const el=document.getElementById('auth-err');if(!el)return;el.textContent=m;el.className='auth-err'+(m?' on':'');}
function showAuthBusy(busy){const btns=document.querySelectorAll('.login-card .btn');btns.forEach(b=>{b.disabled=busy;b.style.opacity=busy?'.55':'1';});}
function authMsg(c){return({'auth/user-not-found':'No account found with that email.','auth/wrong-password':'Incorrect password.',
  'auth/email-already-in-use':'Email already registered — sign in instead.','auth/weak-password':'Password must be at least 6 characters.',
  'auth/invalid-email':'Please enter a valid email address.','auth/invalid-credential':'Invalid email or password.',
  'auth/too-many-requests':'Too many attempts — please wait a moment.',
  'auth/operation-not-allowed':'Email/password sign-in is not enabled. Go to Firebase Console → Authentication → Sign-in method → Enable Email/Password.',
  'auth/network-request-failed':'Network error — check your connection.'}[c]||'Error: '+c);}
export async function doSignIn(){
  const e=document.getElementById('si-email').value.trim(),p=document.getElementById('si-pass').value;
  if(!e||!p){showAuthErr('Please fill in all fields.');return;}
  showAuthBusy(true);showAuthErr('');
  try{await signInWithEmailAndPassword(auth,e,p);}
  catch(err){showAuthErr(authMsg(err.code));}
  showAuthBusy(false);
}
// onAuthStateChanged is set up in main.js and calls back into hub/blob
// doSignUp needs initHub + renderHubBg — injected via callbacks
let _initHub, _renderHubBg;
export function setAuthCallbacks(initHub, renderHubBg){_initHub=initHub;_renderHubBg=renderHubBg;}
export async function doSignUp(){
  const n=document.getElementById('su-name').value.trim();
  const e=document.getElementById('su-email').value.trim();
  const p=document.getElementById('su-pass').value;
  if(!n||!e||!p){showAuthErr('Please fill in all fields.');return;}
  if(p.length<6){showAuthErr('Password must be at least 6 characters.');return;}
  showAuthBusy(true);showAuthErr('');
  try{
    const cred=await createUserWithEmailAndPassword(auth,e,p);
    await updateProfile(cred.user,{displayName:n});
    // onAuthStateChanged fires before updateProfile completes — set manually
    state.currentUser=cred.user;
    state.myId='u_'+cred.user.uid;
    state.myDisplayName=n;
    const ni=document.getElementById('inp-name');if(ni)ni.value=n;
    document.getElementById('hub-uname').textContent=n;
    document.getElementById('hub-av').textContent=n[0].toUpperCase();
    showScreen('hub');if(_renderHubBg)_renderHubBg();if(_initHub)_initHub();
  }catch(err){showAuthErr(authMsg(err.code));showAuthBusy(false);}
}
export async function doSignOut(){await signOut(auth);showScreen('login');}
