// ══ SHARED STATE ══
// Use an object so any module can mutate properties freely
export const state = {
  currentUser: null,
  myDisplayName: 'Player',
  myId: 'anon',
};

// ══ SCREEN MANAGER ══
export function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>{
    s.classList.remove('on','block-on');
  });
  const el=document.getElementById(id+'-screen');
  if(el) el.classList.add(id==='blob'?'block-on':'on');
}

// ══ UTIL ══
export function esc(t){return(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
export function fmt(n){n=Math.floor(n||0);return n>=1000?(n/1000).toFixed(1)+'k':n;}
