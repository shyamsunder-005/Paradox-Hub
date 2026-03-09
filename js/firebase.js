// ══ FIREBASE ══
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, off }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile, setPersistence, browserSessionPersistence }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const fbCfg={apiKey:"AIzaSyBrz3DLsSVHok4LURDGOHvpexR0IUJTl40",authDomain:"bob-paradox.firebaseapp.com",
  databaseURL:"https://bob-paradox-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:"bob-paradox",storageBucket:"bob-paradox.firebasestorage.app",
  messagingSenderId:"71912032459",appId:"1:71912032459:web:ea65aab2e3f9a0dfb0334e"};
const fbApp=initializeApp(fbCfg);
export const db=getDatabase(fbApp);
export const auth=getAuth(fbApp);
setPersistence(auth, browserSessionPersistence).catch(()=>{});

// Re-export raw Firebase functions needed by chess.js and blob.js
export { ref, set, get, update, onValue, off, push,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile, setPersistence, browserSessionPersistence };

// ── Helper wrappers (string-path based) ──
export async function fbSet(p,v){await set(ref(db,p),v);}
export async function fbGet(p){const s=await get(ref(db,p));return s.exists()?s.val():null;}
export function fbListen(p,cb){onValue(ref(db,p),s=>cb(s.exists()?s.val():null));}
export function fbOff(p){off(ref(db,p));}
export async function fbPush(p,v){await push(ref(db,p),v);}
export async function fbUpdate(p,v){await update(ref(db,p),v);}
