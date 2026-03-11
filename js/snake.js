// ══ SNAKE ARENA — Slither.io style ══
import { state, showScreen } from './state.js';

// ── Constants ──
const WORLD_W    = 10000;
const WORLD_H    = 10000;
const SEG_DIST   = 7;      // distance between segments
const BASE_R     = 6;      // head/body radius at score 0
const FOOD_COUNT = 4000;
const BOT_COUNT  = 50;
const BOOST_DRAIN = 0.4;   // score drained per frame while boosting

// ── Module state ──
let snakeActive = false, snakeRAF = null, snakeTick = 0;
let cam = { x: 0, y: 0 };
let player = null, bots = [], foods = [], particles = [];
let kills = 0, snakeScore = 0;
let mouse = { x: 0, y: 0 };
let boostHeld = false;

// Input handler refs for cleanup
let _onMouseMove, _onMouseDown, _onMouseUp, _onKeyDown, _onKeyUp, _onTouchMove, _onTouchStart, _onTouchEnd, _onResize;

// ── Color palettes ──
const COLORS = [
  '#f43f5e','#60a5fa','#f59e0b','#a855f7','#34d399',
  '#fb923c','#e879f9','#4ade80','#38bdf8','#fbbf24',
  '#f472b6','#22d3ee','#84cc16','#c084fc','#ff6b6b',
];
const FOOD_COLORS = [
  '#55ff88','#ffdd55','#ff77aa','#66ffff','#ffaa33',
  '#ff6655','#aaaaff','#ff9966','#00f5c4','#f43f5e',
];
const BOT_NAMES = [
  'Viper','Cobra','Mamba','Python','Adder','Noodle','Slayer',
  'Ghost','Titan','Fangs','Zephyr','Blaze','Nova','Dagger',
  'Cipher','Omen','Talon','Wraith','Specter','Jinx',
];

// ════════════════════════════════════════════════════
// ── Snake Factory ──
// ════════════════════════════════════════════════════
function makeSnake(id, name, color, x, y, isBot = false) {
  const dir = Math.random() * Math.PI * 2;
  const segs = [];
  for (let i = 0; i < 24; i++) {
    segs.push({
      x: x - Math.cos(dir) * i * SEG_DIST,
      y: y - Math.sin(dir) * i * SEG_DIST,
    });
  }
  return {
    id, name, color, isBot,
    segments: segs,
    dir,
    targetDir: dir,
    alive: true,
    score: 24,
    boost: false,
    // bot AI
    bState: 'wander',
    bWander: dir,
    bWanderTimer: 0,
  };
}

// ── Radius from score ──
function snakeR(s) {
  return Math.min(BASE_R + s.score * 0.05, 32);
}

// ── Target segment count from score ──
function targetLen(s) {
  return Math.floor(20 + s.score * 2.2);
}

// ════════════════════════════════════════════════════
// ── Food ──
// ════════════════════════════════════════════════════
function spawnFood(n) {
  for (let i = 0; i < n; i++) {
    foods.push({
      x: 80 + Math.random() * (WORLD_W - 160),
      y: 80 + Math.random() * (WORLD_H - 160),
      r: 3.5 + Math.random() * 4,
      color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
      value: 1 + Math.random() * 0.5,
    });
  }
}

function dropDeathFood(snake) {
  const step = Math.max(2, Math.floor(snake.segments.length / 120));
  for (let i = 0; i < snake.segments.length; i += step) {
    const sg = snake.segments[i];
    foods.push({
      x: sg.x + (Math.random() - 0.5) * 14,
      y: sg.y + (Math.random() - 0.5) * 14,
      r: 5 + Math.random() * 6,
      color: snake.color,
      value: 2 + Math.random(),
    });
  }
}

// ── Eat nearby food ──
function eatFood(snake) {
  const head = snake.segments[0];
  const eatR = snakeR(snake) + 8;
  for (let i = foods.length - 1; i >= 0; i--) {
    const f = foods[i];
    const dx = f.x - head.x, dy = f.y - head.y;
    if (dx * dx + dy * dy < (eatR + f.r) * (eatR + f.r)) {
      snake.score += f.value;
      spawnParticle(f.x, f.y, f.color, 2);
      foods.splice(i, 1);
      if (snake === player) snakeScore = snake.score;
    }
  }
  if (foods.length < FOOD_COUNT * 0.6) spawnFood(300);
}

// ════════════════════════════════════════════════════
// ── Movement ──
// ════════════════════════════════════════════════════
function moveSnake(snake) {
  if (!snake.alive) return;

  // Turn toward targetDir (limited turn rate)
  let diff = snake.targetDir - snake.dir;
  while (diff > Math.PI)  diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxTurn = snake.isBot ? 0.07 : 0.11;
  snake.dir += Math.max(-maxTurn, Math.min(maxTurn, diff));

  // Speed — boost makes you faster but drains score
  const canBoost = snake.boost && snake.score > 12;
  const spd = canBoost ? 4.8 : 3.0;

  const head = snake.segments[0];
  let nx = head.x + Math.cos(snake.dir) * spd;
  let ny = head.y + Math.sin(snake.dir) * spd;

  // Wall bounce
  if (nx < 30)           { nx = 30;            snake.dir = Math.PI - snake.dir; }
  if (nx > WORLD_W - 30) { nx = WORLD_W - 30;  snake.dir = Math.PI - snake.dir; }
  if (ny < 30)           { ny = 30;            snake.dir = -snake.dir; }
  if (ny > WORLD_H - 30) { ny = WORLD_H - 30;  snake.dir = -snake.dir; }

  snake.segments.unshift({ x: nx, y: ny });

  // Drain size when boosting
  if (canBoost) {
    snake.score = Math.max(10, snake.score - BOOST_DRAIN);
    if (snake === player) snakeScore = snake.score;
    // Eject a food pellet occasionally as boost trail
    if (Math.random() < 0.45) {
      const tail = snake.segments[snake.segments.length - 1];
      foods.push({ x: tail.x, y: tail.y, r: 4, color: snake.color, value: 0.8 });
    }
  }

  // Trim to target length
  const tlen = targetLen(snake);
  while (snake.segments.length > tlen) snake.segments.pop();
}

// ════════════════════════════════════════════════════
// ── Collision: head hits body ──
// ════════════════════════════════════════════════════
function checkCollisions() {
  const all = [player, ...bots].filter(s => s && s.alive);

  for (const s of all) {
    if (!s.alive) continue;
    const head = s.segments[0];
    const r = snakeR(s);

    for (const other of all) {
      if (!other.alive) continue;
      const oR = snakeR(other);
      // Skip own head segments
      const startIdx = other === s ? 8 : 0;

      for (let i = startIdx; i < other.segments.length; i++) {
        const seg = other.segments[i];
        const dx = seg.x - head.x, dy = seg.y - head.y;
        // Collision threshold: head r + body r
        if (dx * dx + dy * dy < (r + oR - 3) * (r + oR - 3)) {
          killSnake(s, other);
          break;
        }
      }
      if (!s.alive) break;
    }
  }
}

function killSnake(snake, killer) {
  if (!snake.alive) return;
  snake.alive = false;
  dropDeathFood(snake);
  spawnExplosion(snake.segments[0].x, snake.segments[0].y, snake.color);

  if (killer === player) kills++;

  if (snake === player) {
    saveSnakeScore();
    setTimeout(showSnakeGameOver, 900);
    return;
  }

  // Respawn bot
  const idx = bots.indexOf(snake);
  if (idx !== -1) {
    setTimeout(() => {
      if (!snakeActive) return;
      const sp = randSpawn();
      bots[idx] = makeSnake(
        'bot_' + idx,
        BOT_NAMES[idx % BOT_NAMES.length],
        COLORS[(idx + 3) % COLORS.length],
        sp.x, sp.y, true
      );
    }, 2500 + Math.random() * 2000);
  }
}

// ════════════════════════════════════════════════════
// ── Bot AI ──
// ════════════════════════════════════════════════════
function updateBot(bot) {
  if (!bot.alive) return;
  const head = bot.segments[0];
  const bR   = snakeR(bot);
  const detR = 500 + bR * 6;
  const detR2 = detR * detR;

  let fleeTarget = null, fleeD2 = Infinity;
  let huntTarget = null, huntD2 = Infinity;

  // Scan all live snakes
  const all = [player, ...bots].filter(s => s && s.alive && s !== bot);
  for (const other of all) {
    const oR = snakeR(other);
    const ox = other.segments[0].x, oy = other.segments[0].y;
    const dx = ox - head.x, dy = oy - head.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > detR2) continue;

    if (oR > bR * 1.15) {
      // Threat
      if (d2 < fleeD2) { fleeTarget = { x: ox, y: oy }; fleeD2 = d2; }
    } else if (bR > oR * 1.1) {
      // Prey — also attract to body segments for coiling
      if (d2 < huntD2) { huntTarget = { x: ox, y: oy }; huntD2 = d2; }
    }
  }

  // Wall avoidance
  const margin = 250;
  const nearWall = head.x < margin || head.x > WORLD_W - margin ||
                   head.y < margin || head.y > WORLD_H - margin;

  bot.boost = false;

  if (nearWall) {
    bot.targetDir = Math.atan2(WORLD_H / 2 - head.y, WORLD_W / 2 - head.x);
    bot.bState = 'wallAvoid';
  } else if (fleeTarget) {
    bot.targetDir = Math.atan2(head.y - fleeTarget.y, head.x - fleeTarget.x);
    bot.boost = bot.score > 18 && fleeD2 < 180 * 180;
    bot.bState = 'flee';
  } else if (huntTarget) {
    bot.targetDir = Math.atan2(huntTarget.y - head.y, huntTarget.x - head.x);
    // Boost to cut off prey
    bot.boost = bot.score > 22 && huntD2 < 200 * 200;
    bot.bState = 'hunt';
  } else {
    // Wander toward nearest food cluster
    bot.bState = 'wander';
    bot.bWanderTimer--;

    let nearF = null, nearFd = Infinity;
    for (let i = 0; i < foods.length; i += 6) {
      const f = foods[i];
      const fd = Math.hypot(f.x - head.x, f.y - head.y);
      if (fd < nearFd && fd < 700) { nearFd = fd; nearF = f; }
    }

    if (nearF && nearFd < 600) {
      bot.targetDir = Math.atan2(nearF.y - head.y, nearF.x - head.x);
    } else if (bot.bWanderTimer <= 0) {
      bot.bWander += (Math.random() - 0.5) * 1.6;
      bot.bWanderTimer = 50 + Math.random() * 90;
      bot.targetDir = bot.bWander;
    }
  }
}

// ════════════════════════════════════════════════════
// ── Camera ──
// ════════════════════════════════════════════════════
function updateCam(cw, ch) {
  if (!player || !player.alive || !player.segments.length) return;
  const head = player.segments[0];
  cam.x += (head.x - cw / 2 - cam.x) * 0.1;
  cam.y += (head.y - ch / 2 - cam.y) * 0.1;
  cam.x = Math.max(0, Math.min(WORLD_W - cw, cam.x));
  cam.y = Math.max(0, Math.min(WORLD_H - ch, cam.y));
}

// ════════════════════════════════════════════════════
// ── Player Input ──
// ════════════════════════════════════════════════════
function handlePlayerInput() {
  if (!player || !player.alive) return;
  const head = player.segments[0];
  player.targetDir = Math.atan2(
    (mouse.y + cam.y) - head.y,
    (mouse.x + cam.x) - head.x
  );
  player.boost = boostHeld && player.score > 12;
}

function setupInput() {
  const canvas = document.getElementById('snake-canvas');
  if (!canvas) return;

  _onMouseMove = e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  };
  _onMouseDown = () => { boostHeld = true; };
  _onMouseUp   = () => { boostHeld = false; };
  _onKeyDown   = e => { if (e.code === 'Space') { e.preventDefault(); boostHeld = true; } };
  _onKeyUp     = e => { if (e.code === 'Space') boostHeld = false; };
  _onTouchMove = e => {
    e.preventDefault();
    const t = e.touches[0], r = canvas.getBoundingClientRect();
    mouse.x = (t.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (t.clientY - r.top) * (canvas.height / r.height);
    boostHeld = e.touches.length > 1;
  };
  _onTouchStart = e => { if (e.touches.length > 1) boostHeld = true; };
  _onTouchEnd   = () => { boostHeld = false; };
  _onResize = () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  canvas.addEventListener('mousemove',  _onMouseMove);
  canvas.addEventListener('mousedown',  _onMouseDown);
  canvas.addEventListener('mouseup',    _onMouseUp);
  document.addEventListener('keydown',  _onKeyDown);
  document.addEventListener('keyup',    _onKeyUp);
  canvas.addEventListener('touchmove',  _onTouchMove,  { passive: false });
  canvas.addEventListener('touchstart', _onTouchStart, { passive: true });
  canvas.addEventListener('touchend',   _onTouchEnd,   { passive: true });
  window.addEventListener('resize',     _onResize);
}

function teardownInput() {
  const canvas = document.getElementById('snake-canvas');
  if (canvas) {
    canvas.removeEventListener('mousemove',  _onMouseMove);
    canvas.removeEventListener('mousedown',  _onMouseDown);
    canvas.removeEventListener('mouseup',    _onMouseUp);
    canvas.removeEventListener('touchmove',  _onTouchMove);
    canvas.removeEventListener('touchstart', _onTouchStart);
    canvas.removeEventListener('touchend',   _onTouchEnd);
  }
  document.removeEventListener('keydown', _onKeyDown);
  document.removeEventListener('keyup',   _onKeyUp);
  window.removeEventListener('resize',    _onResize);
}

// ════════════════════════════════════════════════════
// ── Particles ──
// ════════════════════════════════════════════════════
function spawnParticle(x, y, color, n = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * 2.5 + 1;
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, color, life: 1, r: Math.random()*3+1 });
  }
}

function spawnExplosion(x, y, color) {
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * 6 + 2;
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, color, life: 1, r: Math.random()*6+2 });
  }
}

// ════════════════════════════════════════════════════
// ── Drawing ──
// ════════════════════════════════════════════════════
function drawBackground(ctx, cw, ch) {
  ctx.fillStyle = '#06091a';
  ctx.fillRect(0, 0, cw, ch);
  // Grid
  ctx.strokeStyle = 'rgba(0,245,196,.016)';
  ctx.lineWidth = 1;
  const g = 90;
  const ox = -(cam.x % g), oy = -(cam.y % g);
  ctx.beginPath();
  for (let x = ox; x < cw; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, ch); }
  for (let y = oy; y < ch; y += g) { ctx.moveTo(0, y); ctx.lineTo(cw, y); }
  ctx.stroke();
  // World border
  ctx.strokeStyle = 'rgba(0,245,196,.25)';
  ctx.lineWidth = 4;
  ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(0,245,196,.3)';
  ctx.strokeRect(-cam.x, -cam.y, WORLD_W, WORLD_H);
  ctx.shadowBlur = 0;
}

function drawFoodLayer(ctx, cw, ch) {
  ctx.save();
  for (const f of foods) {
    const fx = f.x - cam.x, fy = f.y - cam.y;
    if (fx < -12 || fx > cw + 12 || fy < -12 || fy > ch + 12) continue;
    ctx.shadowBlur = 7; ctx.shadowColor = f.color;
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.arc(fx, fy, f.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function lighten(hex) {
  try {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgb(${Math.min(255,r+70)},${Math.min(255,g+70)},${Math.min(255,b+70)})`;
  } catch { return '#fff'; }
}

function drawSnake(ctx, snake, isPlayer = false) {
  if (!snake.alive || snake.segments.length < 2) return;
  const segs = snake.segments;
  const r = snakeR(snake);
  const cw = ctx.canvas.width, ch = ctx.canvas.height;

  ctx.save();

  // ── Outer body ──
  ctx.shadowBlur  = isPlayer ? 14 : 7;
  ctx.shadowColor = snake.color;
  ctx.strokeStyle = snake.color;
  ctx.lineWidth   = r * 2;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  let started = false;
  ctx.beginPath();
  for (let i = 0; i < segs.length; i++) {
    const sx = segs[i].x - cam.x, sy = segs[i].y - cam.y;
    if (sx < -r*5 || sx > cw + r*5 || sy < -r*5 || sy > ch + r*5) {
      started = false; continue;
    }
    if (!started) { ctx.moveTo(sx, sy); started = true; }
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // ── Inner highlight stripe ──
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = lighten(snake.color);
  ctx.lineWidth   = r * 0.75;
  ctx.globalAlpha = 0.45;
  started = false;
  ctx.beginPath();
  for (let i = 0; i < segs.length; i++) {
    const sx = segs[i].x - cam.x, sy = segs[i].y - cam.y;
    if (sx < -r*5 || sx > cw + r*5 || sy < -r*5 || sy > ch + r*5) {
      started = false; continue;
    }
    if (!started) { ctx.moveTo(sx, sy); started = true; }
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── Head ──
  const hx = segs[0].x - cam.x, hy = segs[0].y - cam.y;
  ctx.shadowBlur  = isPlayer ? 18 : 10;
  ctx.shadowColor = snake.color;
  ctx.fillStyle   = snake.color;
  ctx.beginPath(); ctx.arc(hx, hy, r * 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur  = 0;

  // Lighter snout cap
  ctx.fillStyle   = lighten(snake.color);
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(hx + Math.cos(snake.dir)*r*0.6, hy + Math.sin(snake.dir)*r*0.6, r*0.7, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // ── Eyes ──
  const er = Math.max(3, r * 0.42);
  const ed = r * 0.8;
  [1, -1].forEach(side => {
    const ea  = snake.dir + side * Math.PI * 0.48;
    const ex  = hx + Math.cos(ea) * ed;
    const ey  = hy + Math.sin(ea) * ed;
    // Sclera
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
    // Pupil (looks toward direction)
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(
      ex + Math.cos(snake.dir) * er * 0.45,
      ey + Math.sin(snake.dir) * er * 0.45,
      er * 0.55, 0, Math.PI * 2
    ); ctx.fill();
    // Glint
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(
      ex + Math.cos(snake.dir - 0.5) * er * 0.2,
      ey + Math.sin(snake.dir - 0.5) * er * 0.2,
      er * 0.22, 0, Math.PI * 2
    ); ctx.fill();
  });

  // ── Boost aura ──
  if (snake.boost && snake.score > 12) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth   = r * 0.5;
    ctx.shadowBlur  = 22; ctx.shadowColor = '#fff';
    ctx.beginPath(); ctx.arc(hx, hy, r * 2.2, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  // ── Name tag ──
  const fs = Math.max(9, Math.min(r * 1.3, 16));
  ctx.font      = `bold ${fs}px Orbitron, monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = isPlayer ? '#00f5c4' : snake.color;
  ctx.shadowBlur = 6; ctx.shadowColor = snake.color;
  ctx.fillText((snake.name || '').slice(0, 9), hx, hy - r * 2.2 - 3);
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawParticlesLayer(ctx) {
  particles = particles.filter(p => p.life > 0);
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha  = p.life;
    ctx.fillStyle    = p.color;
    ctx.shadowColor  = p.color;
    ctx.shadowBlur   = 5;
    ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
    p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 0.038;
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.restore();
}

function drawHUD(ctx, cw, ch) {
  ctx.save();
  // Bottom bar
  ctx.fillStyle = 'rgba(6,9,26,.92)';
  ctx.fillRect(0, ch - 58, cw, 58);
  ctx.strokeStyle = 'rgba(0,245,196,.12)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, ch - 58); ctx.lineTo(cw, ch - 58); ctx.stroke();

  // Score
  ctx.fillStyle = '#00f5c4'; ctx.shadowColor = '#00f5c4'; ctx.shadowBlur = 10;
  ctx.font = 'bold 24px Orbitron, monospace'; ctx.textAlign = 'left';
  ctx.fillText('⬡ ' + Math.floor(snakeScore), 18, ch - 28);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.font = '8px Orbitron, monospace';
  ctx.fillText('SCORE', 18, ch - 12);

  // Kills
  ctx.fillStyle = '#f43f5e'; ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 8;
  ctx.font = 'bold 20px Orbitron, monospace'; ctx.textAlign = 'center';
  ctx.fillText('⚔ ' + kills, cw / 2, ch - 28);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.font = '8px Orbitron, monospace';
  ctx.fillText('KILLS', cw / 2, ch - 12);

  // Length
  ctx.fillStyle = '#a855f7'; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 8;
  ctx.font = 'bold 18px Orbitron, monospace'; ctx.textAlign = 'right';
  ctx.fillText('⟡ ' + (player ? player.segments.length : 0), cw - 18, ch - 28);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.font = '8px Orbitron, monospace';
  ctx.fillText('LENGTH', cw - 18, ch - 12);

  // Boost status
  if (player && player.alive) {
    const boosting = player.boost;
    ctx.textAlign = 'center';
    ctx.fillStyle = boosting ? '#fffde4' : 'rgba(255,255,255,.14)';
    ctx.shadowBlur = boosting ? 8 : 0; ctx.shadowColor = '#fff';
    ctx.font = '9px Orbitron, monospace';
    ctx.fillText(boosting ? '⚡ BOOSTING — draining size' : '[ SPACE / CLICK ] = BOOST', cw / 2, ch - 46);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawMinimap(ctx, cw, ch) {
  const MW = 130, MH = 130;
  const MX = cw - MW - 10, MY = 10;
  const SX = MW / WORLD_W, SY = MH / WORLD_H;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.72)';
  ctx.strokeStyle = 'rgba(0,245,196,.22)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 4); ctx.fill(); ctx.stroke();
  ctx.clip();

  // Food scatter
  ctx.fillStyle = 'rgba(85,255,136,.22)';
  for (let i = 0; i < foods.length; i += 25) {
    ctx.fillRect(MX + foods[i].x * SX, MY + foods[i].y * SY, 1.2, 1.2);
  }

  // Bots
  for (const b of bots) {
    if (!b.alive || !b.segments.length) continue;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(MX + b.segments[0].x * SX, MY + b.segments[0].y * SY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player
  if (player && player.alive && player.segments.length) {
    ctx.fillStyle = '#00f5c4'; ctx.shadowColor = '#00f5c4'; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(MX + player.segments[0].x * SX, MY + player.segments[0].y * SY, 3.5, 0, Math.PI * 2);
    ctx.fill(); ctx.shadowBlur = 0;
  }

  // Viewport box
  const c = document.getElementById('snake-canvas');
  if (c) {
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(MX + cam.x * SX, MY + cam.y * SY, c.width * SX, c.height * SY);
  }

  ctx.restore();
}

// ════════════════════════════════════════════════════
// ── Game Over ──
// ════════════════════════════════════════════════════
function showSnakeGameOver() {
  const el = document.getElementById('snake-gameover');
  if (!el) return;
  const sc = document.getElementById('sgo-score');
  const kl = document.getElementById('sgo-kills');
  if (sc) sc.textContent = Math.floor(snakeScore);
  if (kl) kl.textContent = kills;
  el.style.display = 'flex';
}

function saveSnakeScore() {
  if (!state.myId) return;
  let lb = {}; try { lb = JSON.parse(localStorage.getItem('pdx_lb_snake') || '{}'); } catch {}
  const prev = lb[state.myId] || {};
  if (snakeScore > (prev.score || 0)) {
    lb[state.myId] = {
      id: state.myId,
      name: state.myDisplayName || 'Player',
      score: Math.floor(snakeScore),
      kills,
    };
    localStorage.setItem('pdx_lb_snake', JSON.stringify(lb));
  }
}

function randSpawn() {
  return { x: 300 + Math.random() * (WORLD_W - 600), y: 300 + Math.random() * (WORLD_H - 600) };
}

// ════════════════════════════════════════════════════
// ── Main Loop ──
// ════════════════════════════════════════════════════
function snakeLoop() {
  if (!snakeActive) { cancelAnimationFrame(snakeRAF); return; }
  snakeRAF = requestAnimationFrame(snakeLoop);
  snakeTick++;

  const canvas = document.getElementById('snake-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cw = canvas.width, ch = canvas.height;

  // Update
  if (player && player.alive) {
    handlePlayerInput();
    moveSnake(player);
    eatFood(player);
  }

  for (const b of bots) {
    if (!b.alive) continue;
    updateBot(b);
    moveSnake(b);
    eatFood(b);
  }

  checkCollisions();
  updateCam(cw, ch);

  // Draw
  drawBackground(ctx, cw, ch);
  drawFoodLayer(ctx, cw, ch);
  drawParticlesLayer(ctx);

  // Draw bots back-to-front (bigger snakes behind smaller)
  const drawOrder = bots.filter(b => b.alive).sort((a, b) => b.score - a.score);
  for (const b of drawOrder) drawSnake(ctx, b, false);
  if (player) drawSnake(ctx, player, true);

  drawHUD(ctx, cw, ch);
  drawMinimap(ctx, cw, ch);
}

// ════════════════════════════════════════════════════
// ── Public Exports ──
// ════════════════════════════════════════════════════
export function openSnake() {
  showScreen('snake');
  document.getElementById('snake-lobby').style.display = 'flex';
  document.getElementById('snake-game').style.display = 'none';
  document.getElementById('snake-gameover').style.display = 'none';
  // Pre-fill name
  const ni = document.getElementById('snake-name-inp');
  if (ni && !ni.value) ni.value = state.myDisplayName || '';
}

export function snakeStartGame() {
  const ni   = document.getElementById('snake-name-inp');
  const name = (ni && ni.value.trim()) || state.myDisplayName || 'You';

  // Reset
  snakeScore = 0; kills = 0; snakeTick = 0;
  foods = []; bots = []; particles = [];
  boostHeld = false;

  // Player
  const sp = randSpawn();
  player = makeSnake(state.myId || 'local', name, '#00f5c4', sp.x, sp.y, false);
  snakeScore = player.score;

  // Bots
  for (let i = 0; i < BOT_COUNT; i++) {
    const bsp = randSpawn();
    bots.push(makeSnake(
      'bot_' + i,
      BOT_NAMES[i % BOT_NAMES.length],
      COLORS[i % COLORS.length],
      bsp.x, bsp.y, true
    ));
  }

  spawnFood(FOOD_COUNT);

  // Show game, hide lobby/gameover
  document.getElementById('snake-lobby').style.display = 'none';
  document.getElementById('snake-game').style.display  = 'block';
  document.getElementById('snake-gameover').style.display = 'none';

  // Canvas
  const canvas = document.getElementById('snake-canvas');
  if (canvas) {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // Center camera
  cam.x = player.segments[0].x - window.innerWidth  / 2;
  cam.y = player.segments[0].y - window.innerHeight / 2;

  setupInput();

  snakeActive = true;
  cancelAnimationFrame(snakeRAF);
  snakeLoop();
}

export function snakeRestartGame() {
  teardownInput();
  snakeStartGame();
}

export function leaveSnake() {
  snakeActive = false;
  cancelAnimationFrame(snakeRAF);
  teardownInput();
  showScreen('hub');
}
