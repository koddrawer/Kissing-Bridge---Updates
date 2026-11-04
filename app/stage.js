/* Kissing Bridge Live — stage (9:16 window) */
'use strict';
const API = window.api;
const WW = 941, WH = 1672;                 // world = background pixel space
const cv = document.getElementById('c');
const mainCtx = cv.getContext('2d');
let ctx = mainCtx;                        // swapped while drawing the kiss panel
const kissCv = new OffscreenCanvas(cv.width, cv.height), kissCtx = kissCv.getContext('2d');
const SC = cv.width / WW;
let cfg = null;

// ---------------------------------------------------------------- helpers
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const now = () => performance.now() / 1000;
function log(m) { try { API.log(m); } catch {} console.log(m); }
function fit() {
  const r = Math.min(innerWidth / 1080, innerHeight / 1920);
  cv.style.width = (1080 * r) + 'px'; cv.style.height = (1920 * r) + 'px';
}
addEventListener('resize', fit); fit();

async function loadLocal(rel) {
  const buf = await API.readAsset(rel);
  return createImageBitmap(new Blob([buf]));
}
function loadRemote(url) {
  return new Promise(res => {
    if (!url) return res(null);
    const im = new Image();
    im.referrerPolicy = 'no-referrer';
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = url;
    setTimeout(() => res(null), 8000);
  });
}
function shortName(n, max = 14) { n = String(n || '').trim(); return n.length > max ? n.slice(0, max - 1) + '…' : n; }
function speakName(n) { return String(n || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim() || 'bạn'; }
function tpl(s, o) { return String(s || '').replace(/\{(\w+)\}/g, (_, k) => o[k] != null ? o[k] : ''); }

// ---------------------------------------------------------------- assets
const IMG = { bridge: null, kiss: null, frames: {} };
let CHARS = [];   // {id, stand:{img,face}, kiss:{img,face}}

// Find the face hole: largest region (transparent or white) that is NOT connected to the image border
function analyzeSprite(img) {
  const w = img.width, h = img.height;
  const c = new OffscreenCanvas(w, h), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h).data;
  const bg = i => d[i * 4 + 3] < 40 || (d[i * 4] > 225 && d[i * 4 + 1] > 225 && d[i * 4 + 2] > 225);
  const lab = new Int32Array(w * h);
  const st = new Int32Array(w * h);
  let sp = 0;
  const push = i => { lab[i] = 1; st[sp++] = i; };
  for (let X = 0; X < w; X++) { if (bg(X)) push(X); const j = (h - 1) * w + X; if (!lab[j] && bg(j)) push(j); }
  for (let Y = 0; Y < h; Y++) { const a = Y * w, b = Y * w + w - 1; if (!lab[a] && bg(a)) push(a); if (!lab[b] && bg(b)) push(b); }
  const flood = (id, list) => {
    while (sp) {
      const i = st[--sp]; if (list) list.push(i);
      const X = i % w, Y = (i / w) | 0;
      if (X > 0 && !lab[i - 1] && bg(i - 1)) { lab[i - 1] = id; st[sp++] = i - 1; }
      if (X < w - 1 && !lab[i + 1] && bg(i + 1)) { lab[i + 1] = id; st[sp++] = i + 1; }
      if (Y > 0 && !lab[i - w] && bg(i - w)) { lab[i - w] = id; st[sp++] = i - w; }
      if (Y < h - 1 && !lab[i + w] && bg(i + w)) { lab[i + w] = id; st[sp++] = i + w; }
    }
  };
  flood(1);
  let best = null, id = 1;
  for (let Y = 0; Y < h * 0.65; Y++) for (let X = 0; X < w; X++) {
    const i = Y * w + X;
    if (!lab[i] && bg(i)) { id++; lab[i] = id; st[sp++] = i; const list = []; flood(id, list); if (!best || list.length > best.length) best = list; }
  }
  // opaque bbox + feet center
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 60) { const X = i % w, Y = (i / w) | 0; if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y < minY) minY = Y; if (Y > maxY) maxY = Y; }
  let fs = 0, fn = 0;
  for (let Y = maxY - Math.round((maxY - minY) * 0.06); Y <= maxY; Y++) for (let X = 0; X < w; X++) if (d[(Y * w + X) * 4 + 3] > 60) { fs += X; fn++; }
  const face = { x0: 0, y0: 0, x1: 0, y1: 0, mask: null };
  if (best && best.length > 300) {
    let a = w, b = h, cc = 0, dd = 0;
    for (const i of best) { const X = i % w, Y = (i / w) | 0; if (X < a) a = X; if (X > cc) cc = X; if (Y < b) b = Y; if (Y > dd) dd = Y; }
    const mw = cc - a + 1, mh = dd - b + 1;
    const m = new OffscreenCanvas(mw, mh), mx = m.getContext('2d');
    const id2 = mx.createImageData(mw, mh);
    for (const i of best) { const X = i % w - a, Y = ((i / w) | 0) - b; const k = (Y * mw + X) * 4; id2.data[k] = id2.data[k + 1] = id2.data[k + 2] = 255; id2.data[k + 3] = 255; }
    mx.putImageData(id2, 0, 0);
    Object.assign(face, { x0: a, y0: b, x1: cc, y1: dd, mask: m });
  }
  // "lip" point = rightmost opaque pixel within the face's row band (for kiss pose, facing right)
  let lipX = face.x1, lipY = (face.y0 + face.y1) / 2;
  if (face.mask) {
    for (let Y = Math.round(face.y0 + (face.y1 - face.y0) * .35); Y <= face.y1; Y++)
      for (let X = w - 1; X > face.x1 - 5; X--) if (d[(Y * w + X) * 4 + 3] > 80) { if (X > lipX) { lipX = X; lipY = Y; } break; }
  }
  return { w, h, face, top: minY, bottom: maxY, feetX: fn ? fs / fn : w / 2, lipX, lipY };
}

async function loadAssets() {
  IMG.bridge = await loadLocal('assets/bg/bridge.png');
  IMG.kiss = await loadLocal('assets/bg/kiss.png');
  const frames = await API.frames();
  for (const f of frames) { try { IMG.frames[f] = await loadLocal('assets/frames/' + f); } catch (e) { log('Lỗi khung ' + f); } }
  const list = await API.characters();
  CHARS = [];
  for (const c of list) {
    try {
      const s = await loadLocal(c.stand), k = await loadLocal(c.kiss);
      CHARS.push({ id: c.id, stand: { img: s, a: analyzeSprite(s) }, kiss: { img: k, a: analyzeSprite(k) } });
    } catch (e) { log('Lỗi nhân vật ' + c.id + ': ' + e.message); }
  }
  log(`Đã tải ${CHARS.length} nhân vật, ${frames.length} khung`);
}

// composite = sprite with avatar inside the face hole
function buildComposite(p, pose) {
  const ch = CHARS[p.char % CHARS.length]; if (!ch) return null;
  const sp = ch[pose], a = sp.a, f = a.face;
  const c = new OffscreenCanvas(a.w, a.h), x = c.getContext('2d');
  if (f.mask) {
    const fw = f.x1 - f.x0 + 1, fh = f.y1 - f.y0 + 1;
    const l = new OffscreenCanvas(fw, fh), lx = l.getContext('2d');
    lx.fillStyle = '#fff4ea'; lx.fillRect(0, 0, fw, fh);
    if (p.avatarImg) {
      const im = p.avatarImg, s = Math.max(fw / im.width, fh / im.height) * 1.04;
      lx.imageSmoothingQuality = 'high';
      lx.drawImage(im, (fw - im.width * s) / 2, (fh - im.height * s) / 2, im.width * s, im.height * s);
    } else {
      // simple cute fallback face
      lx.fillStyle = '#2b1a1a';
      const ex = pose === 'kiss' ? [fw * .62, fw * .62] : [fw * .33, fw * .67];
      const ey = fh * .45, r = Math.max(4, fw * .05);
      if (pose === 'kiss') { lx.fillRect(fw * .66, ey - r, r * 2.4, r * .8); }
      else ex.forEach(xx => { lx.beginPath(); lx.arc(xx, ey, r, 0, 7); lx.fill(); });
      lx.fillStyle = 'rgba(255,120,150,.6)';
      lx.beginPath(); lx.ellipse(pose === 'kiss' ? fw * .55 : fw * .22, fh * .62, fw * .08, fh * .05, 0, 0, 7); lx.fill();
      if (pose !== 'kiss') { lx.beginPath(); lx.ellipse(fw * .78, fh * .62, fw * .08, fh * .05, 0, 0, 7); lx.fill(); }
    }
    lx.globalCompositeOperation = 'destination-in';
    lx.drawImage(f.mask, 0, 0);
    x.drawImage(l, f.x0, f.y0);
  }
  x.drawImage(sp.img, 0, 0);
  return c;
}
function comp(p, pose) {
  const k = pose + (p.avatarImg ? 1 : 0);
  if (!p._comp) p._comp = {};
  if (!p._comp[k]) p._comp[k] = buildComposite(p, pose);
  return p._comp[k];
}

// ---------------------------------------------------------------- path
function makePath(pts) {
  const seg = []; let L = 0;
  for (let i = 1; i < pts.length; i++) { const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1]; const l = Math.hypot(dx, dy); seg.push({ a: pts[i - 1], b: pts[i], l, s: L }); L += l; }
  return {
    len: L,
    at(d) {
      d = clamp(d, 0, L);
      for (const s of seg) if (d <= s.s + s.l || s === seg[seg.length - 1]) { const t = s.l ? (d - s.s) / s.l : 0; return [lerp(s.a[0], s.b[0], t), lerp(s.a[1], s.b[1], t)]; }
      return pts[pts.length - 1];
    }
  };
}
let PATH = { L: null, R: null };
function rebuildPaths() { PATH.L = makePath(cfg.bridge.leftPath); PATH.R = makePath(cfg.bridge.rightPath); }

// ---------------------------------------------------------------- language (vi / en)
const STR = {
  vi: {
    joinYard: '👋 {name} vào sân chờ', onBridge: '🌉 {name} lên cầu {side} · thả tim để bước!', idle: '⌛ {name} rời cầu vì không thả tim',
    gift: '🎁 {name} tặng {gift}{count}{extra}', giftChain: ' → 💋 Hôn liền {n} người!', giftSpeed: ' → ⚡ tốc độ x{speed}', times: ' {n} lần',
    left: 'TRÁI', right: 'PHẢI', waitMatch: 'Chờ nửa kia 💗', likeToWalk: '❤ thả tim để bước', idleLeft: '⏳{n}s · thả tim!',
    moreYard: '+{n} người ở sân chờ', panelTitle: '💋 Nụ hôn trên cầu 💋', streak: '💋 Hôn liền {i}/{n} 💋'
  },
  en: {
    joinYard: '👋 {name} joined the plaza', onBridge: '🌉 {name} is on the {side} bridge · send likes to walk!', idle: '⌛ {name} left the bridge (no likes)',
    gift: '🎁 {name} sent {gift}{count}{extra}', giftChain: ' → 💋 Kiss {n} in a row!', giftSpeed: ' → ⚡ speed x{speed}', times: ' x{n}',
    left: 'LEFT', right: 'RIGHT', waitMatch: 'Waiting for a match 💗', likeToWalk: '❤ send likes to walk', idleLeft: '⏳{n}s · send likes!',
    moreYard: '+{n} more in the plaza', panelTitle: '💋 A Kiss on the Bridge 💋', streak: '💋 Kiss streak {i}/{n} 💋'
  }
};
const EN_DEFAULTS = {
  guideTitle: 'HOW TO PLAY',
  guideLines: ['Join the LIVE → enter the plaza', 'Comment/Follow/Share → hop on', '1 like = 1 step · {steps} steps', 'No likes for {idle}s → you leave',
    '{t1}c x{s1} · {t2}c x{s2} · {t3}c x{s3}', '{t4} coins: kiss {c4} in a row 💋'],
  tierLabels: ['Pink Heart Frame', 'Blue Diamond Frame', 'Royal Frame', 'Wedding Arch'],
  panelTitle: '',
  ticker: '💕 HOW TO PLAY: Join the LIVE to enter the plaza  •  Comment, Follow or Share to get on the bridge  •  1 like = 1 step, {steps} steps to the middle  •  No likes for {idle}s and you leave the bridge  •  Meet your match in the middle and KISS 💋  •  Gifts boost your speed: {t1} coin x{s1} · {t2} coins x{s2} · {t3} coins x{s3}  •  {t4} coins = kiss {c4} people in a row!',
  voice: {
    voice: 'en-US-JennyNeural',
    welcomeTpl: 'Welcome {name}! Comment to get on the bridge, then send likes to walk.',
    congratsTpl: 'Congratulations {a} and {b} on your kiss on the bridge!',
    giftTpl: 'Thank you {name} for the {gift}! You are now {speed} times faster.',
    chainTpl: 'Wow! Thank you {name} for the {gift}! {name} gets to kiss {n} people in a row!',
    donorTpl: 'Congratulations {a} and {b}, you earned the {frame}!'
  }
};
const VI_TICKER = '💕 CÁCH CHƠI: Vào live để ra sân chờ  •  Comment, Follow hoặc Share để lên cầu  •  Thả tim: 1 tim = 1 bước, {steps} bước tới giữa cầu  •  {idle} giây không thả tim sẽ rời cầu  •  Gặp nửa kia ở giữa cầu và HÔN 💋  •  Tặng quà để tăng tốc: {t1} xu x{s1} · {t2} xu x{s2} · {t3} xu x{s3}  •  {t4} xu = hôn liền {c4} người!';
const isEN = () => cfg && cfg.lang === 'en';
const EN = () => Object.assign({}, EN_DEFAULTS, cfg.en || {}, { voice: Object.assign({}, EN_DEFAULTS.voice, (cfg.en || {}).voice || {}) });
function S(k, v = {}) { return tpl((isEN() ? STR.en : STR.vi)[k], v); }
function tierLabel(t) { if (!t) return ''; const i = cfg.tiers.indexOf(t); return isEN() ? (EN().tierLabels[i] || t.label) : t.label; }
function voiceCfg() { return isEN() ? Object.assign({}, cfg.voice, EN().voice) : cfg.voice; }

// ---------------------------------------------------------------- state
// Every viewer is a person. state: 'yard' (sân chờ) | 'bridge' (đang đi) | 'center' (đứng chờ giữa cầu) | 'kiss'
const PEOPLE = new Map();
const followed = new Set();         // follow chỉ tính 1 lần / người (huỷ follow rồi follow lại không tính)
let seq = 0, sideToggle = 0;
let scene = 'bridge';               // bridge | kiss
let pair = null;                    // current kiss
const chat = [];
const toasts = [];
const hearts = [];                  // particles
const sparkles = [];
let autoLikeTimer = null;

const G = () => cfg.game;
const all = () => [...PEOPLE.values()];
const onSide = (side, states) => all().filter(p => p.side === side && states.includes(p.state));
const other = s => s === 'L' ? 'R' : 'L';
const sideName = s => s === 'L' ? S('left') : S('right');
function stepLen(side) { return PATH[side].len / Math.max(1, G().steps); }
function tierFor(coins) { let t = 0; (cfg.tiers || []).forEach((x, i) => { if (coins >= x.coins) t = i + 1; }); return t; }
const tierObj = p => cfg.tiers[p.tier - 1];
const speedOf = p => { const t = tierObj(p); return t && t.speed ? t.speed : 1; };
function findPerson(id) { const p = PEOPLE.get(id); return p ? { p, side: p.side } : null; }

function newPerson(user) {
  const p = {
    id: user.id, name: user.name || user.id, avatar: user.avatar || '', avatarImg: null,
    char: Math.floor(Math.random() * Math.max(1, CHARS.length)), coins: 0, tier: 0, chain: 0, seq: ++seq,
    state: 'yard', steps: 0, d: 0, x: 0, y: 0, moving: false, phase: Math.random() * 6,
    lastLike: 0, enterT: 0, arriveSeq: 0, arriveT: 0, active: Date.now()
  };
  if (p.avatar) loadAvatar(p);
  return p;
}
function loadAvatar(p) { loadRemote(p.avatar).then(im => { if (im) { p.avatarImg = im; p._comp = null; } }); }

// find or create (new people start in the yard)
function ensurePerson(user, quiet) {
  if (!user || !user.id || !CHARS.length) return null;
  let p = PEOPLE.get(user.id);
  if (p) {
    if (user.avatar && !p.avatar) { p.avatar = user.avatar; loadAvatar(p); }
    if (user.name && user.name !== p.name) p.name = user.name;
    p.active = Date.now();
    return p;
  }
  p = newPerson(user); p.side = null;
  PEOPLE.set(p.id, p);
  pruneYard();
  if (!quiet) {
    toast(S('joinYard', { name: shortName(p.name, 18) }), '#ffe7a8', 2.2);
    if (cfg.voice.welcome) say(tpl(voiceCfg().welcomeTpl, { name: speakName(p.name), side: '' }), 'welcome');
    sfx('join');
  }
  return p;
}
function pruneYard() {
  const y = all().filter(p => p.state === 'yard');
  const max = G().maxYard || 200;
  if (y.length <= max) return;
  y.sort((a, b) => a.active - b.active).slice(0, y.length - max).forEach(p => { if (!p.coins) PEOPLE.delete(p.id); });
}

// lên cầu luân phiên 2 bên: bên nào ít người hơn thì vào bên đó, bằng nhau thì sang bên kia so với người vừa lên
let lastSide = 'R';
function pickSide() {
  const n = s => onSide(s, ['bridge', 'center']).length;
  const cL = n('L'), cR = n('R');
  lastSide = cL < cR ? 'L' : cR < cL ? 'R' : other(lastSide);
  return lastSide;
}
function toBridge(p, why, side) {
  if (!p || p.state !== 'yard') return false;
  p.side = side || pickSide();
  if (p.wx == null || !p.vis) placeInYard(p);
  p.state = 'bridge'; p.steps = 0; p.d = 0; p.enterT = now(); p.lastLike = now() + cfg.yard.flySec; p.active = Date.now();
  p.fromX = p.x; p.fromY = p.y; p.flyK = 0;
  toast(S('onBridge', { name: shortName(p.name, 16), side: sideName(p.side) }), '#bfe9ff', 2.4);
  sfx('fly');
  return true;
}
function toYard(p, reason) {
  if (!p) return;
  if (reason === 'idle') {
    for (let i = 0; i < 6; i++) spawnHeart(p.x, p.y - 40, true);
    toast(S('idle', { name: shortName(p.name, 16) }), '#ffc2c2', 2.4);
    sfx('poof');
  }
  p.state = 'yard'; p.side = null; p.steps = 0; p.d = 0; p.dash = false; p.arriveSeq = 0; p.flyK = 1;
  placeInYard(p);
  if (reason === 'kiss') { p.coins = 0; p.tier = 0; p.chain = 0; }
}
function arrive(p) {
  if (p.state !== 'bridge') return;
  p.state = 'center'; p.steps = G().steps; p.arriveSeq = ++seq; p.arriveT = now();
  sfx('arrive');
}
function addSteps(p, n) {
  if (!p || p.state !== 'bridge') return;
  p.lastLike = now();
  p.steps = Math.min(G().steps, p.steps + n * speedOf(p));
  if (p.steps >= G().steps) arrive(p);
}

// ---------------------------------------------------------------- events
function onEngage(user, kind) {
  const j = cfg.join;
  if (kind === 'chat' && !j.onComment) return;
  if (kind === 'follow' && !j.onFollow) return;
  if (kind === 'share' && !j.onShare) return;
  if (kind === 'follow') { if (followed.has(user.id)) return; followed.add(user.id); }
  const p = ensurePerson(user, true);
  if (p) toBridge(p, kind);
}
function onLike(user, count) {
  const p = ensurePerson(user, true);
  if (!p || p.state !== 'bridge') return;
  const n = Math.max(1, count || 1);
  addSteps(p, n);
  if (!p.likeFx) p.likeFx = [];
  const add = Math.min(n, 5), gain = Math.round(n * speedOf(p) * 10) / 10;
  for (let i = 0; i < add; i++) p.likeFx.push({ t: -i * .12, dx: rand(-6, 8), col: HCOLORS[(Math.random() * HCOLORS.length) | 0], label: i === 0 ? '+' + gain : '' });
  if (p.likeFx.length > 24) p.likeFx.splice(0, p.likeFx.length - 24);
}
function onGift(user, coins, giftName, count) {
  const p = ensurePerson(user, true);
  if (!p) return;
  p.coins += coins;
  const old = p.tier; p.tier = tierFor(p.coins);
  const t = tierObj(p);
  if (p.state === 'yard') toBridge(p, 'gift');
  if (p.state === 'bridge') p.lastLike = now();
  if (t && t.chain && !p.chain) {
    p.chain = t.chain;
    if (p.state === 'bridge') { p.dash = true; arrive(p); }          // chạy thẳng ra giữa cầu
  }
  if (pair && (pair.a === p || pair.b === p) && pair.phase !== 'showcase' && pair.phase !== 'out') pair.tier = Math.max(pair.a.tier, pair.b.tier);
  const extra = t ? (t.chain ? S('giftChain', { n: t.chain }) : S('giftSpeed', { speed: t.speed })) : '';
  toast(S('gift', { name: shortName(p.name, 16), gift: giftName, count: count > 1 ? ' x' + count : '', extra }), '#ffd34d', 4, true);
  const V = voiceCfg();
  say(tpl(t && t.chain ? V.chainTpl || V.giftTpl : V.giftTpl, { name: speakName(p.name), gift: giftName + (count > 1 ? S('times', { n: count }) : ''), n: t && t.chain, speed: t && t.speed }), 'gift');
  sfx('gift');
  for (let i = 0; i < 12; i++) spawnHeart(p.x || WW / 2, (p.y || 900) - 60, true);
  if (p.tier > old) log(`${p.name} đạt mức ${p.tier} (${p.coins} xu)`);
}
function onChat(user, text) {
  chat.push({ name: user.name, text, avatar: null, t: now() });
  loadRemote(user.avatar).then(im => { const m = chat.find(c => c.name === user.name && c.text === text); if (m) m.avatar = im; });
  while (chat.length > 30) chat.shift();
}
function removeId(id) { const p = PEOPLE.get(id); if (p && p.state !== 'kiss') PEOPLE.delete(id); }

function handleEvent(ev) {
  switch (ev.type) {
    case 'chat': onChat(ev.user, ev.text); onEngage(ev.user, 'chat'); break;
    case 'join': if (cfg.join.onMember) ensurePerson(ev.user, false); break;
    case 'like': onLike(ev.user, ev.count); break;
    case 'follow': onEngage(ev.user, 'follow'); break;
    case 'share': onEngage(ev.user, 'share'); break;
    case 'gift': onGift(ev.user, ev.coins || 1, ev.gift || 'quà', ev.count || 1); break;
  }
}

// ---------------------------------------------------------------- voice / audio
const voiceQ = []; let speaking = false; const audio = new Audio();
function say(text, kind) {
  if (!cfg.voice.enabled || !text) return;
  if (kind === 'welcome') {
    const pend = voiceQ.filter(v => v.kind === 'welcome').length;
    if (pend >= cfg.voice.welcomeMaxPending) return;
    voiceQ.push({ text, kind });
  } else {
    const idx = voiceQ.findIndex(v => v.kind === 'welcome');
    if (idx < 0) voiceQ.push({ text, kind }); else voiceQ.splice(idx, 0, { text, kind });
  }
  pumpVoice();
}
async function pumpVoice() {
  if (speaking || !voiceQ.length) return;
  speaking = true;
  const v = voiceQ.shift();
  try {
    const r = await API.tts(v.text, voiceCfg());
    if (r && r.b64) {
      audio.src = 'data:' + r.mime + ';base64,' + r.b64;
      audio.volume = clamp(cfg.voice.volume, 0, 1);
      duckMusic(true);
      await audio.play();
      await new Promise(res => { audio.onended = res; audio.onerror = res; setTimeout(res, 20000); });
    } else if (r && r.system && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(r.text); u.lang = isEN() ? 'en-US' : 'vi-VN'; u.volume = cfg.voice.volume; u.rate = 1 + (cfg.voice.rate || 0) / 100;
      const vv = speechSynthesis.getVoices().find(x => (isEN() ? /^en/i : /vi/i).test(x.lang)); if (vv) u.voice = vv;
      duckMusic(true);
      await new Promise(res => { u.onend = res; u.onerror = res; speechSynthesis.speak(u); setTimeout(res, 20000); });
    }
  } catch (e) { log('Voice lỗi: ' + e.message); }
  duckMusic(false);
  speaking = false;
  setTimeout(pumpVoice, 150);
}
const music = document.getElementById('music');
function duckMusic(on) { music.volume = clamp((cfg.music.volume || 0) * (on ? 0.4 : 1), 0, 1); }
function applyMusic() {
  const f = cfg.music.file;
  if (!f) { music.pause(); music.removeAttribute('src'); return; }
  const url = fileUrl(f);
  if (music.dataset.f !== f) { music.dataset.f = f; music.src = url; }
  duckMusic(false);
  music.play().catch(() => {});
}

let AC = null;
function ac() { if (!AC) AC = new AudioContext(); if (AC.state === 'suspended') AC.resume(); return AC; }
function tone(freq, t0, dur, type = 'square', vol = .2, slideTo) {
  const a = ac(), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime + t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + t0 + dur);
  const v = vol * cfg.sfx.volume * sfxMul;
  g.gain.setValueAtTime(0.0001, a.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), a.currentTime + t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g).connect(a.destination); o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + .05);
}
function noise(t0, dur, vol = .2, f = 2000) {
  const a = ac(), n = a.sampleRate * dur, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), flt = a.createBiquadFilter(), g = a.createGain();
  flt.type = 'bandpass'; flt.frequency.value = f; flt.Q.value = 1.2;
  g.gain.value = vol * cfg.sfx.volume * sfxMul; s.buffer = b; s.connect(flt).connect(g).connect(a.destination); s.start(a.currentTime + t0);
}
// custom sound files (set in the control panel); fall back to the built-in 8-bit sounds
let sfxMul = 1;
const sfxCache = {};
function fileUrl(f) {
  if (/^(file|https?):/i.test(f)) return f;
  const p = f.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/, '$1:');
  return 'file:///' + p.replace(/^\/+/, '');
}
function playFile(name, f, vol) {
  let a = sfxCache[name];
  if (!a || a.dataset.f !== f) { a = new Audio(fileUrl(f)); a.dataset.f = f; a.preload = 'auto'; sfxCache[name] = a; }
  const c = a.cloneNode(); c.volume = clamp(vol, 0, 1);
  c.play().catch(e => log('Không phát được âm ' + name + ': ' + e.message));
}
function sfx(name) {
  try {
    if (!cfg || cfg.sfx.volume <= 0) return;
    const S = cfg.sfx, mul = (S.vols && S.vols[name] != null) ? S.vols[name] : 1;
    if (mul <= 0) return;
    const f = S.files && S.files[name];
    if (f) { playFile(name, f, S.volume * mul); return; }
    sfxMul = mul;
    if (name === 'join') { tone(880, 0, .07, 'square', .08); tone(1320, .07, .1, 'square', .08); }
    else if (name === 'gift') { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * .07, .16, 'square', .12)); }
    else if (name === 'kiss') {   // 8-bit "mwah ~ chụt"
      tone(420, 0, .18, 'square', .14, 900); noise(0, .12, .25, 2600);
      tone(1500, .2, .06, 'square', .2, 600); noise(.2, .05, .35, 3500);
      tone(1200, .32, .25, 'triangle', .12, 1800);
    }
    else if (name === 'whoosh') { noise(0, .45, .25, 900); tone(300, 0, .45, 'sine', .08, 1200); }
    else if (name === 'sparkle') { [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, i * .06, .2, 'triangle', .1)); }
    else if (name === 'fanfare') { [[523, 0], [523, .14], [523, .28], [659, .42], [784, .7], [659, .9], [784, 1.05], [1047, 1.2]].forEach(([f, t]) => tone(f, t, .22, 'square', .12)); }
    else if (name === 'heart') { tone(1760, 0, .05, 'square', .05); }
    else if (name === 'fly') { tone(400, 0, .35, 'square', .07, 1400); [1047, 1319, 1568].forEach((f, i) => tone(f, .25 + i * .06, .1, 'triangle', .07)); }
    else if (name === 'poof') { noise(0, .25, .2, 700); tone(500, 0, .25, 'square', .06, 150); }
    else if (name === 'arrive') { [784, 988, 1175].forEach((f, i) => tone(f, i * .08, .12, 'square', .08)); }
  } catch {}
  sfxMul = 1;
}

// ---------------------------------------------------------------- particles & toasts
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const HEART_HI = ['.......', '.W.....', 'W......', '.......', '.......', '.......'];
const HCOLORS = ['#ff3b6b', '#ff6fa0', '#ff2a4f', '#ff9ec4', '#e8174f', '#ffb3d1'];
function drawPixelHeart(x, y, px, col, alpha = 1) {
  ctx.globalAlpha = alpha;
  const ox = x - 3.5 * px, oy = y - 3 * px;
  ctx.fillStyle = '#3b0716';
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (HEART[r][c] === 'X') ctx.fillRect(ox + c * px - px * .35, oy + r * px - px * .35, px * 1.7, px * 1.7);
  ctx.fillStyle = col;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (HEART[r][c] === 'X') ctx.fillRect(ox + c * px, oy + r * px, px + .5, px + .5);
  ctx.fillStyle = '#fff';
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (HEART_HI[r][c] === 'W') ctx.fillRect(ox + c * px, oy + r * px, px + .5, px + .5);
  ctx.globalAlpha = 1;
}
let heartLayer = false;                     // true = hearts belong to the kiss panel
function spawnHeart(x, y, burst, big) {
  const a = rand(0, Math.PI * 2), sp = burst ? rand(80, 260) : rand(20, 60);
  hearts.push({ x, y, vx: Math.cos(a) * sp, vy: burst ? Math.sin(a) * sp - 80 : -rand(40, 90), px: big ? rand(5, 9) : rand(3, 6),
    col: HCOLORS[(Math.random() * HCOLORS.length) | 0], life: 0, max: rand(2.2, 4), sway: rand(0, 6), orbit: null, k: heartLayer });
}
function spawnOrbitHearts(cx, cy, n) {
  for (let i = 0; i < n; i++) hearts.push({ orbit: { cx, cy, r: rand(260, 400), a: i / n * Math.PI * 2, sp: rand(.5, 1.1) * (Math.random() < .5 ? -1 : 1), ry: rand(.5, .9) },
    px: rand(4, 8), col: HCOLORS[i % HCOLORS.length], life: 0, max: 999, x: cx, y: cy, sway: rand(0, 6), k: true });
}
function updHearts(dt) {
  for (const h of hearts) {
    h.life += dt;
    if (h.orbit) { const o = h.orbit; o.a += o.sp * dt; h.x = o.cx + Math.cos(o.a) * o.r; h.y = o.cy + Math.sin(o.a) * o.r * o.ry + Math.sin(h.life * 3 + h.sway) * 10; o.cy -= dt * 6; }
    else { h.vy -= 0; h.vx *= .985; h.vy = h.vy * .985 - 25 * dt; h.x += (h.vx + Math.sin(h.life * 3 + h.sway) * 30) * dt; h.y += h.vy * dt; }
  }
  for (let i = hearts.length - 1; i >= 0; i--) if (hearts[i].life > hearts[i].max) hearts.splice(i, 1);
}
function drawHearts(layer) {
  for (const h of hearts) {
    if (!!h.k !== layer) continue;
    const a = h.orbit ? clamp(h.life * 2, 0, 1) * (h.fadeOut != null ? h.fadeOut : 1) : clamp((h.max - h.life) / .8, 0, 1);
    const blink = 1 + Math.sin(h.life * 8 + h.sway) * .08;
    drawPixelHeart(h.x, h.y, h.px * blink, h.col, a);
  }
}
function toast(text, color, dur, big) {
  toasts.push({ text, color, t: 0, dur, big });
  while (toasts.length > 4) toasts.shift();
}

// ---------------------------------------------------------------- text helpers
function txt(s, x, y, size, fill = '#fff', align = 'center', stroke = '#2a0712', sw, font = 'B2') {
  ctx.font = (font === 'PX' ? '' : '800 ') + size + 'px ' + font + ', "Segoe UI", sans-serif';
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw || Math.max(3, size * .22); ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function fitText(s, size, maxW, font = 'B2') {
  ctx.font = '800 ' + size + 'px ' + font + ', sans-serif';
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// ---------------------------------------------------------------- bridge scene
function scaleAtY(y) {
  const b = cfg.bridge, near = b.nearY || 1228, far = b.farY || 556;
  return lerp(b.farScale, 1, clamp((y - far) / (near - far), 0, 1));
}
// ---- yard (sân chờ = quảng trường phía dưới), people wander around
function yardX(y, side) {               // x range of the plaza at height y, for one side
  const Y = cfg.yard, k = clamp((y - Y.topY) / (Y.bottomY - Y.topY), 0, 1);
  const x0 = lerp(Y.topX0, Y.bottomX0, k), x1 = lerp(Y.topX1, Y.bottomX1, k), mid = (x0 + x1) / 2, gap = Y.midGap / 2;
  return side === 'L' ? [x0, mid - gap] : side === 'R' ? [mid + gap, x1] : [x0, x1];
}
function yardScale(y) { const Y = cfg.yard; return lerp(Y.charTop, Y.charBottom, clamp((y - Y.topY) / (Y.bottomY - Y.topY), 0, 1)) / cfg.bridge.charH; }
function randYardPoint(side) {
  const Y = cfg.yard, y = rand(Y.topY + 25, Y.bottomY), [a, b] = yardX(y, side);
  return [rand(a + 15, b - 15), y];
}
function placeInYard(p) { const [x, y] = randYardPoint(p.side); p.x = p.wx = x; p.y = p.wy = y; p.wait = rand(.3, 3); }
function updYard(dt) {
  const Y = cfg.yard;
  {
    const list = all().filter(p => p.state === 'yard').sort((a, b) => b.active - a.active);
    list.forEach((p, i) => {
      p.vis = i < Y.maxShow;
      if (p.wx == null) placeInYard(p);
      if (p.wait > 0) { p.wait -= dt; p.moving = false; return; }
      const dx = p.wx - p.x, dy = p.wy - p.y, d = Math.hypot(dx, dy);
      if (d < 2) { p.wait = rand(1, 4.5); const [x, y] = randYardPoint(null); p.wx = x; p.wy = y; p.moving = false; return; }
      const sp = (p.walkSp || (p.walkSp = rand(.75, 1.25) * Y.walkSpeed)) * yardScale(p.y);
      p.x += dx / d * Math.min(d, sp * dt); p.y += dy / d * Math.min(d, sp * dt); p.moving = true;
    });
  }
}
function updBridge(dt) {
  const T = cfg.timing, g = G(), tnow = now(), fly = cfg.yard.flySec;
  for (const p of PEOPLE.values()) if (p.likeFx && p.likeFx.length) { p.likeFx.forEach(f => f.t += dt); p.likeFx = p.likeFx.filter(f => f.t < 1.2); }
  for (const side of ['L', 'R']) {
    const len = PATH[side].len, stepPx = stepLen(side);
    const centers = onSide(side, ['center']).sort((a, b) => a.arriveSeq - b.arriveSeq);
    centers.forEach((p, i) => { p.tgt = len - i * T.slotSpacing; p.cIdx = i; });
    const backLimit = len - centers.length * T.slotSpacing;
    for (const p of onSide(side, ['bridge'])) {
      p.tgt = Math.min(p.steps * stepPx, Math.max(0, backLimit - 4));
      if (tnow - p.lastLike > g.idleSec) { toYard(p, 'idle'); continue; }
    }
    for (const p of onSide(side, ['bridge', 'center'])) {
      const e = (tnow - p.enterT) / fly;
      if (e < 1 && p.fromX != null) {                                  // bay từ sân chờ tới chân cầu
        const [x1, y1] = PATH[side].at(0), k = ease(clamp(e, 0, 1));
        p.x = lerp(p.fromX, x1, k); p.y = lerp(p.fromY, y1, k); p.lift = Math.sin(clamp(e, 0, 1) * Math.PI) * cfg.yard.flyHeight;
        p.flyK = k; p.moving = false; p.vis = true;
        if (Math.random() < dt * 30) sparkles.push({ x: p.x + rand(-10, 10), y: p.y - p.lift - rand(10, 60), t: 0, w: true });
        continue;
      }
      p.lift = 0; p.flyK = 1;
      const diff = p.tgt - p.d;
      const sp = T.walkSpeed * (p.dash ? 5 : 1) * (diff > 120 ? 1.8 : 1);
      if (Math.abs(diff) > .5) { p.d += Math.sign(diff) * Math.min(Math.abs(diff), sp * dt); p.moving = true; }
      else { p.moving = false; if (p.dash && p.state === 'center') p.dash = false; }
      const [x, y] = PATH[side].at(p.d);
      p.x = x; p.y = y; p.vis = true;
    }
  }
  updYard(dt);
  for (let i = sparkles.length - 1; i >= 0; i--) if (sparkles[i].w) { sparkles[i].t += dt; if (sparkles[i].t > .8) sparkles.splice(i, 1); }
  if (scene === 'bridge' && !pair) tryPair();
}
function readyAtCenter(p) { return p.state === 'center' && now() - p.arriveT >= cfg.timing.waitAtEndSec && Math.abs(p.d - p.tgt) < 3 && (p.flyK ?? 1) >= 1; }
function pickPartners(side, n, exclude = []) {
  const c = onSide(side, ['center']).sort((a, b) => a.arriveSeq - b.arriveSeq);
  const b = onSide(side, ['bridge']).sort((a, b) => b.steps - a.steps);
  const y = all().filter(p => p.state === 'yard' && !exclude.includes(p)).sort((a, b) => b.active - a.active);
  const out = [...c, ...b, ...y].filter(p => !exclude.includes(p)).slice(0, n);
  out.forEach(p => { if (p.state === 'yard') p.side = side; });
  return out;
}
function tryPair() {
  const centers = all().filter(p => p.state === 'center').sort((a, b) => a.arriveSeq - b.arriveSeq);
  const owner = centers.find(p => p.chain > 0 && readyAtCenter(p));
  if (owner) {
    const partners = pickPartners(other(owner.side), owner.chain);
    if (partners.length) return startKiss(owner, partners);
  }
  const a = centers.find(p => p.side === 'L'), b = centers.find(p => p.side === 'R');
  if (a && b && readyAtCenter(a) && readyAtCenter(b)) startKiss(a, [b]);
}
function drawPerson(p, x, y, h, pose, flip, alpha = 1) {
  const c = comp(p, pose); if (!c) return;
  const sp = CHARS[p.char % CHARS.length][pose].a;
  const s = h / (sp.bottom - sp.top);
  const w = sp.w * s;
  const dx = x - sp.feetX * s, dy = y - sp.bottom * s;
  ctx.save(); ctx.globalAlpha = alpha;
  if (flip) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
  ctx.drawImage(c, dx, dy, w, sp.h * s);
  ctx.restore();
  return { top: y - h, s };
}
const TIER_COL = ['#ff6fa0', '#3aa0ff', '#e8343c', '#f5b400'];
const AV_COL = ['#ff6fa0', '#5ab0ff', '#ffb347', '#7ed957', '#c58cff', '#ff7b7b'];
function drawAvatar(p, x, y, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r + Math.max(1.5, r * .16), 0, 7);
  ctx.fillStyle = p.tier ? TIER_COL[(p.tier - 1) % 4] : '#fff6e8'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.closePath();
  if (p.avatarImg) {
    ctx.clip();
    const im = p.avatarImg, k = Math.max(2 * r / im.width, 2 * r / im.height);
    ctx.drawImage(im, x - im.width * k / 2, y - im.height * k / 2, im.width * k, im.height * k);
  } else {
    let h = 0; for (const c of String(p.id)) h = (h * 31 + c.charCodeAt(0)) | 0;
    ctx.fillStyle = AV_COL[Math.abs(h) % AV_COL.length]; ctx.fill();
    txt((String(p.name).trim()[0] || '?').toUpperCase(), x, y + 1, r * 1.15, '#fff', 'center', null);
  }
  ctx.restore();
}
// name with avatar on the left; returns the right edge (for like-hearts)
function drawNameTag(p, x, y, size, opts = {}) {
  const name = fitText(shortName(p.name, opts.max || 16), size, opts.maxW || 220);
  ctx.font = '800 ' + size + 'px B2, sans-serif';
  const nw = ctx.measureText(name).width, r = size * .78, gap = size * .3, pad = p.tier ? size * .55 : 0;
  const total = 2 * r + gap + pad * 2 + nw, left = x - total / 2, nx = left + 2 * r + gap + pad;
  if (p.tier) {
    rrect(nx - pad, y - size * .72, nw + pad * 2, size * 1.44, size * .5);
    ctx.fillStyle = TIER_COL[(p.tier - 1) % 4]; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff3c4'; ctx.stroke();
  }
  drawAvatar(p, left + r, y, r);
  txt(name, nx, y + 1, size, opts.color || '#fff', 'left', '#2a0712', p.tier ? size * .18 : Math.max(3, size * .22));
  return left + total;
}
function drawLikeFx(p, rx, y, s) {
  if (!p.likeFx || !p.likeFx.length) return;
  for (const f of p.likeFx) {
    if (f.t < 0) continue;
    const k = f.t / 1.2, a = k < .15 ? k / .15 : 1 - (k - .15) / .85;
    const hx = rx + 10 + f.dx + Math.sin(f.t * 7 + f.dx) * 4, hy = y - k * 55 * s;
    drawPixelHeart(hx, hy, (2.4 + (1 - k) * .9) * clamp(s * 1.2, .8, 1.3), f.col, clamp(a, 0, 1));
    if (f.label && k < .8) txt(f.label, hx + 16, hy - 4, 13, '#ffd6e4', 'left', '#4a0f24', 3.5);
  }
}
function drawBridge() {
  ctx.drawImage(IMG.bridge, 0, 0, WW, WH);
  const t = now(), g = G(), Y = cfg.yard;
  drawGuide();
  const list = all().filter(p => p.vis && (p.state === 'bridge' || p.state === 'center' || p.state === 'yard'));
  const flying = list.filter(p => p.state !== 'yard' && (p.flyK ?? 1) < 1);
  const ground = list.filter(p => !flying.includes(p)).sort((a, b) => a.y - b.y);
  for (const p of [...ground, ...flying]) {
    const inYard = p.state === 'yard', fl = !inYard && (p.flyK ?? 1) < 1;
    const s = inYard ? yardScale(p.y) : fl ? lerp(yardScale(p.fromY), scaleAtY(p.y), p.flyK) : scaleAtY(p.y);
    const h = cfg.bridge.charH * s, lift = fl ? p.lift : 0;
    const bob = p.moving ? Math.abs(Math.sin(t * 9 + p.phase)) * 5 * s : Math.sin(t * 2 + p.phase) * 1.2 * s;
    const tilt = p.moving ? Math.sin(t * 9 + p.phase) * 0.06 : fl ? Math.sin(t * 14) * .08 : 0;
    let alpha = 1;
    if (p.state === 'bridge' && !fl) { const left = g.idleSec - (t - p.lastLike); if (left < 3) alpha = .45 + .55 * Math.abs(Math.sin(t * 8)); }
    ctx.fillStyle = 'rgba(40,10,20,.28)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 20 * s * (1 - lift / 400), 6 * s, 0, 0, 7); ctx.fill();
    const fy = p.y - bob - lift;
    ctx.save(); ctx.translate(p.x, fy); ctx.rotate(tilt); ctx.translate(-p.x, -fy);
    if (fl) { ctx.shadowColor = 'rgba(255,230,120,.95)'; ctx.shadowBlur = 25; }
    drawPerson(p, p.x, fy, h, 'stand', false, alpha);
    ctx.restore();
    if (fl) { drawPixelHeart(p.x - 26 * s, fy - h * .5, 2.5, '#ff6fa0'); drawPixelHeart(p.x + 26 * s, fy - h * .5, 2.5, '#ff6fa0'); }
    const nameY = fy - h - 10 * s;
    if (inYard) {
      const fs = Math.round(clamp(14 * s * 1.25, 12, 18));
      drawNameTag(p, p.x, nameY + 2, fs, { max: 12, maxW: 90, color: p.coins ? '#ffe066' : '#fff' });
      continue;
    }
    const nsz = Math.round(cfg.bridge.nameSize * clamp(s * 1.1, .7, 1.2));
    const nameRight = drawNameTag(p, p.x, nameY, nsz);
    drawLikeFx(p, nameRight, nameY, s);
    if (fl) continue;
    const bw = 46, bx = p.x - bw / 2, by = nameY + 12;
    ctx.fillStyle = 'rgba(40,6,20,.75)'; rrect(bx - 1, by - 1, bw + 2, 7, 3); ctx.fill();
    ctx.fillStyle = p.state === 'center' ? '#ffd34d' : '#ff6fa0'; rrect(bx, by, bw * clamp(p.steps / g.steps, 0, 1), 5, 2); ctx.fill();
    const tob = tierObj(p);
    if (tob && p.state === 'bridge') txt(tob.chain ? '💋x' + tob.chain : '⚡x' + tob.speed, p.x + 34, nameY - 16, 15, '#ffe066', 'center', '#4a0f24', 4);
    if (p.state === 'bridge') {
      const left = g.idleSec - (t - p.lastLike);
      if (left < 5) txt(S('idleLeft', { n: Math.ceil(left) }), p.x, nameY - 20, 15, '#ffb0b0', 'center', '#4a0f24', 4);
      else if (t - p.enterT < 3 + Y.flySec && p.steps === 0) txt(S('likeToWalk'), p.x, nameY - 20, 15, '#ffe0ec', 'center', '#4a0f24', 4);
    }
    if (p.state === 'center' && p.cIdx === 0 && !onSide(other(p.side), ['center']).length && !p.chain) {
      ctx.globalAlpha = .9 + Math.sin(t * 4) * .1;
      txt(S('waitMatch'), p.x + (p.side === 'L' ? -10 : 10), nameY - 20, 16, '#ffe0ec', 'center', '#4a0f24', 4);
      ctx.globalAlpha = 1;
    }
  }
  for (const s of sparkles) if (s.w) drawSparkle(s.x, s.y, 8 * Math.sin(s.t / .8 * Math.PI), Math.sin(s.t / .8 * Math.PI));
  { const hidden = all().filter(p => p.state === 'yard').length - Y.maxShow;
    if (hidden > 0) txt(S('moreYard', { n: hidden }), WW / 2, Y.bottomY + 10, 18, '#ffe066', 'center', '#4a0f24', 4); }
  if (cfg.bridge.showPath) {
    for (const side of ['L', 'R']) {
      ctx.strokeStyle = side === 'L' ? '#0f0' : '#0ff'; ctx.lineWidth = 3; ctx.beginPath();
      cfg.bridge[side === 'L' ? 'leftPath' : 'rightPath'].forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]));
      ctx.stroke();
      cfg.bridge[side === 'L' ? 'leftPath' : 'rightPath'].forEach((pt, i) => txt(String(i), pt[0], pt[1], 14, '#ff0', 'center', '#000'));
    }
    ctx.strokeStyle = '#ff0'; ctx.setLineDash([8, 6]); ctx.beginPath();
    ctx.moveTo(Y.topX0, Y.topY); ctx.lineTo(Y.topX1, Y.topY); ctx.lineTo(Y.bottomX1, Y.bottomY); ctx.lineTo(Y.bottomX0, Y.bottomY); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
  }
}

function guideVars() {
  const v = { steps: G().steps, idle: G().idleSec };
  cfg.tiers.forEach((t, i) => { v['t' + (i + 1)] = t.coins; v['s' + (i + 1)] = t.speed; v['c' + (i + 1)] = t.chain || ''; });
  return v;
}
function drawGuide() {
  const B = cfg.boards, R = B.guide || { x: 346, y: 898, w: 252, h: 160 };
  ctx.fillStyle = B.guideBg || '#6a1222';
  rrect(R.x, R.y, R.w, R.h, 6); ctx.fill();
  const title = isEN() ? EN().guideTitle : B.guideTitle;
  if (title) {
    const TR = B.guideTitleRect || { x: 340, y: 821, w: 262, h: 80 };
    ctx.fillStyle = B.guideBg || '#6e101c'; rrect(TR.x, TR.y, TR.w, TR.h, 8); ctx.fill();
    let fs = 44; ctx.font = '800 ' + fs + 'px B2, sans-serif';
    while (fs > 20 && ctx.measureText(title).width > TR.w - 10) { fs--; ctx.font = '800 ' + fs + 'px B2, sans-serif'; }
    txt(title, TR.x + TR.w / 2, TR.y + TR.h / 2 + 2, fs, '#ffd84a', 'center', '#3a0610', 7);
  }
  const vars = guideVars();
  const lines = ((isEN() ? EN().guideLines : B.guideLines) || []).map(l => tpl(l, vars));
  const n = lines.length || 1, h = R.h / n, tw = R.w - 34;
  lines.forEach((l, i) => {
    const y = R.y + h * i + h / 2;
    if (i) { ctx.fillStyle = 'rgba(255,190,120,.18)'; ctx.fillRect(R.x + 6, y - h / 2, R.w - 12, 1.5); }
    const r = Math.min(14, h * .34), cx = R.x + r + 4;
    ctx.fillStyle = '#ffcf3d'; ctx.beginPath(); ctx.arc(cx, y, r, 0, 7); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#7a3a00'; ctx.stroke();
    txt(String(i + 1), cx, y + 1, r * 1.4, '#5a1530', 'center', null);
    let fsz = Math.min(24, Math.floor(h * .56)); ctx.font = '800 ' + fsz + 'px B2, sans-serif';
    while (fsz > 10 && ctx.measureText(l).width > R.w - r * 2 - 18) { fsz--; ctx.font = '800 ' + fsz + 'px B2, sans-serif'; }
    txt(fitText(l, fsz, R.w - r * 2 - 18), R.x + r * 2 + 12, y + 1, fsz, '#fff3dc', 'left', '#2a0712', 3);
  });
}

// ---------------------------------------------------------------- kiss scene
// Kiss scene plays in a framed panel over the top of the screen; the bridge + queues keep running below.
let panelA = 0, panelTo = 0;
function startKiss(owner, partners) {
  sfx('whoosh');
  const first = partners[0];
  for (let i = 0; i < 14; i++) spawnHeart((owner.x + first.x) / 2, (owner.y + first.y) / 2 - 30, true);
  [owner, ...partners].forEach(p => { p.state = 'kiss'; p.dash = false; });
  const a = owner.side === 'L' ? owner : first, b = owner.side === 'L' ? first : owner;
  const chain = partners.length > 1 || owner.chain > 0;
  pair = { a, b, owner, partnerKey: owner.side === 'L' ? 'b' : 'a', queue: partners.slice(1), idx: 1, total: chain ? partners.length : 1,
    chain, tier: Math.max(a.tier, b.tier), t: 0, phase: 'approach' };
  if (chain) owner.chain = 0;
  scene = 'kiss'; panelTo = 1;
}
function endKiss() {
  if (!pair) return;
  toYard(pair.a, 'kiss'); toYard(pair.b, 'kiss');
  pair.queue.forEach(p => toYard(p, 'kiss'));
  pair.queue = [];
  pair.phase = 'out'; panelTo = 0;
}
function updPanel(dt) {
  const sp = 1 / Math.max(.15, cfg.timing.fadeSec);
  panelA = panelTo ? Math.min(1, panelA + dt * sp) : Math.max(0, panelA - dt * sp);
  if (!panelTo && panelA <= 0 && pair) {
    scene = 'bridge'; pair = null;
    for (let i = hearts.length - 1; i >= 0; i--) if (hearts[i].k) hearts.splice(i, 1);
    sparkles.length = 0;
  }
}
function camOf() { return Object.assign({ split: 836, camTop: 520, scale: 1, kissCropY: 520, toastY: 1560 }, cfg.kiss.cam || {}); }
function camE() { return ease(clamp(panelA, 0, 1)); }
function drawKissPanel() {
  if (panelA <= 0) return;
  const K = cfg.kiss, C = camOf(), t = now(), e = camE();
  ctx = kissCtx;                                   // render kiss world offscreen
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  drawKiss(); drawHearts(true);
  ctx = mainCtx;
  const H = C.split, y0 = lerp(-H, 0, e);
  ctx.drawImage(kissCv, 0, C.kissCropY * SC, WW * SC, H * SC, 0, y0, WW, H);
  // divider between close-up (top) and bridge overview (bottom)
  const dy = y0 + H;
  const g = ctx.createLinearGradient(0, dy - 6, 0, dy + 6);
  g.addColorStop(0, '#fff1a8'); g.addColorStop(.5, '#ffc93a'); g.addColorStop(1, '#c86a0c');
  ctx.fillStyle = '#4a0f24'; ctx.fillRect(0, dy - 8, WW, 16);
  ctx.fillStyle = g; ctx.fillRect(0, dy - 6, WW, 12);
  for (let x = 40; x < WW; x += 110) drawPixelHeart(x, dy, 3 + Math.sin(t * 4 + x) * .4, '#ff3b6b');
  // ribbon title
  const tier = pair && pair.tier && cfg.tiers[pair.tier - 1];
  const title = pair && (pair.phase === 'showcase' || (pair.phase === 'out' && tier)) && tier ? '🎉 ' + tierLabel(tier) + ' 🎉'
    : pair && pair.chain ? S('streak', { i: pair.idx, n: pair.total }) : ((isEN() ? EN().panelTitle : K.panelTitle) || S('panelTitle'));
  ctx.font = '800 34px B2, sans-serif';
  const tw = Math.min(WW - 80, ctx.measureText(title).width + 70), ty = y0 + 40 + ((cfg.ticker || {}).show === false ? 0 : ((cfg.ticker || {}).h || 44) + 4), cx = WW / 2;
  ctx.fillStyle = '#4a0f24'; rrect(cx - tw / 2 - 4, ty - 30, tw + 8, 60, 30); ctx.fill();
  ctx.fillStyle = '#b3123f'; rrect(cx - tw / 2, ty - 26, tw, 52, 26); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffd34d'; ctx.stroke();
  txt(fitText(title, 32, tw - 30), cx, ty + 1, 32, '#ffe066', 'center', '#4a0f24', 7);
}

function kissLayout(p, side) {
  const K = cfg.kiss, ch = CHARS[p.char % CHARS.length];
  const ak = ch.kiss.a, s = K.charH / (ak.bottom - ak.top);
  const cx = WW / 2;
  // lips meet at center; derive feet x
  const lipOff = (ak.lipX - ak.feetX) * s;
  const lipYoff = (ak.bottom - ak.lipY) * s;
  const feetX = side === 'L' ? cx - K.lipGap / 2 - lipOff : cx + K.lipGap / 2 + lipOff;
  return { feetX, lipY: K.feetY - lipYoff, s };
}
function updKiss(dt) {
  if (!pair) return;
  const P = pair, T = cfg.timing, K = cfg.kiss;
  if (P.phase === 'out' || panelA < 1) return;          // wait for the panel to open
  heartLayer = true;
  P.t += dt;
  if (P.phase === 'approach' && P.t >= T.approachSec) {
    P.phase = 'kiss'; P.t = 0;
    sfx('kiss');
    const la = kissLayout(P.a, 'L');
    for (let i = 0; i < 10; i++) spawnHeart(WW / 2, la.lipY, true, true);
    spawnOrbitHearts(WW / 2, la.lipY + 120, K.hearts);
    if (!P.chain || P.idx === 1) say(tpl(voiceCfg().congratsTpl, { a: speakName(P.a.name), b: speakName(P.b.name) }), 'congrats');
  } else if (P.phase === 'kiss') {
    if (P.t > 1.6 && !P.k2) { P.k2 = true; sfx('kiss'); }
    if (Math.random() < dt * 3) { const la = kissLayout(P.a, 'L'); spawnHeart(WW / 2 + rand(-30, 30), la.lipY - 20, false, Math.random() < .3); }
    if (P.t >= (P.chain ? (T.chainKissSec || 3) : T.kissSec)) {
      if (P.queue.length) {                                   // hôn liền: đổi người tiếp theo
        const done1 = P[P.partnerKey];
        toYard(done1, 'kiss'); kissCount++;
        P[P.partnerKey] = P.queue.shift();
        P.idx++; P.phase = 'approach'; P.t = 0; P.k2 = false; P.ownerFixed = true;
        P.tier = Math.max(P.a.tier, P.b.tier, P.tier);
        for (let i = hearts.length - 1; i >= 0; i--) if (hearts[i].orbit) hearts.splice(i, 1);
        sfx('whoosh'); heartLayer = false; return;
      }
      kissCount++;
      const tier = cfg.tiers[P.tier - 1];
      if (P.tier && tier) {
        P.phase = 'showcase'; P.t = 0; sfx('fanfare');
        for (let i = hearts.length - 1; i >= 0; i--) if (hearts[i].orbit) hearts.splice(i, 1);
        say(tpl(voiceCfg().donorTpl, { a: speakName(P.a.name), b: speakName(P.b.name), frame: tierLabel(tier) }), 'congrats');
      } else { P.phase = 'out'; endKiss(); }
    }
  } else if (P.phase === 'showcase') {
    if (P.t > .9 && !P.sp) { P.sp = true; sfx('sparkle'); for (let i = 0; i < 12; i++) spawnHeart(WW / 2, K.frameY - 260, true, true); }
    if (Math.random() < dt * 10) sparkles.push({ x: WW / 2 + rand(-K.frameW / 2, K.frameW / 2), y: K.frameY + rand(-280, 280), t: 0 });
    if (P.t >= T.showcaseSec) { P.phase = 'out'; endKiss(); }
  }
  heartLayer = false;
  for (let i = sparkles.length - 1; i >= 0; i--) { sparkles[i].t += dt; if (sparkles[i].t > .8) sparkles.splice(i, 1); }
}
function drawSparkle(x, y, r, a) {
  ctx.globalAlpha = a; ctx.fillStyle = '#fff7c2';
  ctx.fillRect(x - r, y - 1.5, r * 2, 3); ctx.fillRect(x - 1.5, y - r, 3, r * 2);
  ctx.fillStyle = '#ffd34d'; ctx.fillRect(x - 3, y - 3, 6, 6); ctx.globalAlpha = 1;
}
function drawPairNames(P, y, w) {
  const t = now();
  ctx.fillStyle = 'rgba(60,8,30,.58)'; rrect(WW / 2 - w / 2, y - 32, w, 64, 32); ctx.fill();
  const r = 22;
  drawAvatar(P.a, WW / 2 - w / 2 + 34, y, r); drawAvatar(P.b, WW / 2 + w / 2 - 34, y, r);
  txt(fitText(shortName(P.a.name, 16), 32, w / 2 - 110), WW / 2 - 34, y, 32, '#fff', 'right');
  txt(fitText(shortName(P.b.name, 16), 32, w / 2 - 110), WW / 2 + 34, y, 32, '#fff', 'left');
  drawPixelHeart(WW / 2, y, 5 + Math.sin(t * 6), '#ff3b6b');
}
function drawKiss() {
  ctx.drawImage(IMG.kiss, 0, 0, WW, WH);
  if (!pair) return;
  const P = pair, K = cfg.kiss, T = cfg.timing, t = now();
  if (P.phase === 'approach' || P.phase === 'in') {
    const k = ease(clamp(P.t / T.approachSec, 0, 1));
    for (const [p, side] of [[P.a, 'L'], [P.b, 'R']]) {
      const lay = kissLayout(p, side);
      const sx = side === 'L' ? K.leftStartX : K.rightStartX;
      const fixed = P.ownerFixed && p === P.owner;
      const x = fixed ? lay.feetX : lerp(sx, lay.feetX, k);
      const bob = k < 1 && !fixed ? Math.abs(Math.sin(t * 9)) * 10 : 0;
      ctx.fillStyle = 'rgba(40,10,20,.25)'; ctx.beginPath(); ctx.ellipse(x, K.feetY, 70, 14, 0, 0, 7); ctx.fill();
      drawPerson(p, x, K.feetY - bob, K.charH * 0.95, 'stand', false);
      drawNameTag(p, x, K.feetY - K.charH - 30, 30);
    }
  } else if (P.phase === 'kiss' || P.phase === 'out' && !P.tier) {
    const lean = (1 - easeOutBack(clamp(P.t / .45, 0, 1))) * 24;
    const pulse = Math.sin(P.t * 5) * 2;
    for (const [p, side] of [[P.a, 'L'], [P.b, 'R']]) {
      const lay = kissLayout(p, side);
      const off = side === 'L' ? -lean - pulse : lean + pulse;
      ctx.fillStyle = 'rgba(40,10,20,.25)'; ctx.beginPath(); ctx.ellipse(lay.feetX + off, K.feetY, 70, 14, 0, 0, 7); ctx.fill();
      drawPerson(p, lay.feetX + off, K.feetY, K.charH, 'kiss', side === 'R');
    }
    // names
    drawPairNames(P, K.feetY + 28, 720);
  } else if (P.phase === 'showcase' || P.phase === 'out') {
    const tier = cfg.tiers[P.tier - 1], fr = tier && IMG.frames[tier.frame];
    // frame flies in from the top, settles behind them
    const k = clamp(P.t / 1.1, 0, 1), e = easeOutBack(k);
    if (fr) {
      const fw = K.frameW * lerp(.3, 1, e), fh = fw * fr.height / fr.width;
      const fy = lerp(-300, K.frameY, ease(k)) + Math.sin(t * 2) * 6;
      ctx.save(); ctx.translate(WW / 2, fy); ctx.rotate((1 - k) * -0.5);
      ctx.shadowColor = 'rgba(255,220,120,.8)'; ctx.shadowBlur = 40 * k;
      ctx.drawImage(fr, -fw / 2, -fh / 2, fw, fh);
      ctx.restore();
    }
    // the two stand side by side (hop into place)
    const hk = clamp(P.t / .6, 0, 1);
    const hop = Math.sin(hk * Math.PI) * 60;
    const H = K.showcaseCharH;
    const pa = CHARS[P.a.char % CHARS.length].stand.a, pb = CHARS[P.b.char % CHARS.length].stand.a;
    const wa = (H / (pa.bottom - pa.top)) * (pa.w / 2), wb = (H / (pb.bottom - pb.top)) * (pb.w / 2);
    const xa = WW / 2 - K.showcaseGap / 2 - wa * .8, xb = WW / 2 + K.showcaseGap / 2 + wb * .8;
    const la = kissLayout(P.a, 'L'), lb = kissLayout(P.b, 'R');
    for (const [p, x0, x1] of [[P.a, la.feetX, xa], [P.b, lb.feetX, xb]]) {
      const x = lerp(x0, x1, ease(hk)), y = lerp(K.feetY, K.showcaseFeetY, ease(hk)) - hop;
      ctx.fillStyle = 'rgba(40,10,20,.25)'; ctx.beginPath(); ctx.ellipse(x, K.showcaseFeetY, 60, 12, 0, 0, 7); ctx.fill();
      drawPerson(p, x, y + Math.sin(t * 3 + x) * 3, H, 'stand', false);
    }
    drawPairNames(P, K.showcaseFeetY + 56, 740);
    for (const s of sparkles) drawSparkle(s.x, s.y, 10 * Math.sin(s.t / .8 * Math.PI), Math.sin(s.t / .8 * Math.PI));
  }
}

// ---------------------------------------------------------------- chat + toasts overlay
function wrap(s, size, maxW) {
  ctx.font = '800 ' + size + 'px B2, sans-serif';
  const words = String(s).split(/\s+/), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines.slice(0, 2).map((l, i, a) => i === 1 && lines.length > 2 ? fitText(l + '…', size, maxW) : fitText(l, size, maxW));
}
function drawChat() {
  const C0 = cfg.chat; if (!C0.show) return;
  const m = ease(clamp(panelA, 0, 1));            // slide chat into the sea area while the kiss panel is open
  const C = { ...C0, x: lerp(C0.x, C0.kissX ?? 318, m), y: lerp(C0.y, C0.kissY ?? 930, m), w: lerp(C0.w, C0.kissW ?? 305, m), h: lerp(C0.h, C0.kissH ?? 330, m) };
  if (C.bgAlpha > 0) { ctx.fillStyle = `rgba(30,5,20,${C.bgAlpha})`; rrect(C.x, C.y, C.w, C.h, 14); ctx.fill(); }
  const fs = C.fontSize, lh = fs * 1.25;
  const items = chat.slice(-C.lines);
  // layout bottom-up
  let y = C.y + C.h - 8;
  ctx.save(); ctx.beginPath(); ctx.rect(C.x, C.y, C.w, C.h); ctx.clip();
  for (let i = items.length - 1; i >= 0; i--) {
    const m = items[i];
    const nm = fitText(shortName(m.name, 18) + ':', fs, C.w - 40);
    const lines = wrap(m.text, fs, C.w - 40);
    const blockH = lh * (1 + lines.length) + 4;
    y -= blockH;
    if (y < C.y - blockH) break;
    const age = now() - m.t, a = clamp(age * 4, 0, 1);
    ctx.globalAlpha = a;
    const ax = C.x + 14, ay = y + lh / 2;
    ctx.save(); ctx.beginPath(); ctx.arc(ax, ay, fs * .62, 0, 7); ctx.closePath();
    if (m.avatar) { ctx.clip(); ctx.drawImage(m.avatar, ax - fs * .62, ay - fs * .62, fs * 1.24, fs * 1.24); }
    else { ctx.fillStyle = '#ff6fa0'; ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(ax, ay, fs * .62, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    txt(nm, C.x + 32, ay, fs, '#ffd36b', 'left', '#2a0712', 4);
    lines.forEach((l, k) => txt(l, C.x + 32, ay + lh * (k + 1), fs, '#ffffff', 'left', '#2a0712', 4));
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
// ---- dải chữ hướng dẫn chạy ngang ở mép trên
let tickerX = null;
function drawTicker(dt) {
  const T = cfg.ticker || {}; if (T.show === false) return;
  const raw = isEN() ? EN().ticker : (T.text || VI_TICKER);
  const text = tpl(raw, guideVars()), h = T.h || 44, fs = T.fontSize || 24, y = T.y || 0;
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(90,10,40,.82)'); g.addColorStop(1, 'rgba(60,6,28,.82)');
  ctx.fillStyle = g; ctx.fillRect(0, y, WW, h);
  ctx.fillStyle = '#ffc93a'; ctx.fillRect(0, y + h - 3, WW, 3);
  ctx.font = '800 ' + fs + 'px B2, sans-serif';
  const w = ctx.measureText(text).width, gap = 120;
  if (tickerX == null || tickerX < -w - gap) tickerX = tickerX == null ? WW : tickerX + w + gap;
  tickerX -= (T.speed || 90) * dt;
  ctx.beginPath(); ctx.rect(0, y, WW, h); ctx.clip();
  for (let x = tickerX; x < WW; x += w + gap) txt(text, x, y + h / 2 + 1, fs, '#ffe9a8', 'left', '#2a0712', 4);
  ctx.restore();
}
function drawToasts(dt) {
  let y = lerp(530, camOf().toastY, camE());
  for (let i = toasts.length - 1; i >= 0; i--) {
    const t = toasts[i]; t.t += dt;
    if (t.t > t.dur) { toasts.splice(i, 1); continue; }
  }
  const visible = toasts.slice(-3);
  for (const t of visible) {
    const a = clamp(Math.min(t.t * 5, (t.dur - t.t) * 3), 0, 1);
    const size = t.big ? 26 : 22;
    const s = fitText(t.text, size, 560);
    ctx.font = '800 ' + size + 'px B2, sans-serif';
    const w = ctx.measureText(s).width + 40;
    ctx.globalAlpha = a;
    const x = WW / 2 - (1 - a) * 40;
    ctx.fillStyle = t.big ? 'rgba(120,10,45,.85)' : 'rgba(60,8,30,.7)';
    rrect(x - w / 2, y - size * .8, w, size * 1.6, size * .8); ctx.fill();
    if (t.big) { ctx.lineWidth = 3; ctx.strokeStyle = '#ffd34d'; ctx.stroke(); }
    txt(s, x, y + 1, size, t.color, 'center', '#2a0712', 4);
    ctx.globalAlpha = 1;
    y += size * 1.9;
  }
}

// ---------------------------------------------------------------- loop
let last = now(), stateT = 0, persistT = 0;
function frame() {
  const t = now(), dt = Math.min(.05, t - last); last = t;
  updBridge(dt);
  if (scene === 'kiss') updKiss(dt);
  updHearts(dt); updPanel(dt);
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  {                                                // camera: bridge overview slides into the bottom half while kissing
    const C = camOf(), e = camE(), sc = lerp(1, C.scale, e), ty = lerp(0, C.split - C.camTop * C.scale, e);
    ctx.save(); ctx.translate(WW / 2 * (1 - sc), ty); ctx.scale(sc, sc);
    drawBridge(); drawHearts(false);
    ctx.restore();
  }
  drawKissPanel();
  drawChat();
  drawToasts(dt);
  drawTicker(dt);
  stateT += dt; persistT += dt;
  if (stateT > .5) { stateT = 0; pushState(); }
  if (persistT > 3) { persistT = 0; persist(); }
  requestAnimationFrame(frame);
}
const lite = p => ({ id: p.id, name: p.name, avatar: p.avatar, coins: p.coins, tier: p.tier, char: p.char, side: p.side, state: p.state, steps: Math.floor(p.steps), chain: p.chain });
function pushState() {
  const ls = s => all().filter(p => (s === 'Y' ? p.state === 'yard' : p.side === s && p.state !== 'kiss' && p.state !== 'yard'))
    .sort((a, b) => ({ center: 0, bridge: 1, yard: 2 }[a.state] - { center: 0, bridge: 1, yard: 2 }[b.state]) || (a.arriveSeq - b.arriveSeq) || (b.steps - a.steps) || (b.active - a.active)).map(lite);
  const cnt = st => all().filter(p => p.state === st).length;
  API.sendState({ scene, phase: pair && pair.phase, pair: pair ? [lite(pair.a), lite(pair.b)] : null, chain: pair && pair.chain ? [pair.idx, pair.total] : null,
    L: ls('L'), R: ls('R'), Y: ls('Y').slice(0, 150), counts: { yard: cnt('yard'), bridge: cnt('bridge'), center: cnt('center') }, done: kissCount, voiceQ: voiceQ.length, autoLike: !!autoLikeTimer });
}
let kissCount = 0;
function persist() {
  API.persistState({ v: 2, people: all().map(p => ({ ...lite(p), active: p.active })), followed: [...followed].slice(-5000), seq, kissCount });
}
function restore(st) {
  if (!st || st.v !== 2) return;            // old queue format → start fresh
  for (const o of st.people || []) {
    const p = newPerson(o);
    Object.assign(p, { char: o.char ?? p.char, coins: o.coins || 0, side: o.side, chain: o.chain || 0, active: o.active || Date.now() });
    p.tier = tierFor(p.coins);
    p.state = o.state === 'kiss' ? 'center' : (o.state || 'yard');
    if (p.state === 'yard') p.side = null; else if (!p.side) p.side = pickSide();
    if (p.state === 'bridge') { p.steps = o.steps || 0; p.lastLike = now(); p.d = p.steps * stepLen(p.side); p.enterT = -9; }
    if (p.state === 'center') { p.steps = G().steps; p.arriveSeq = ++seq; p.arriveT = now(); p.d = PATH[p.side].len; }
    PEOPLE.set(p.id, p);
  }
  (st.followed || []).forEach(id => followed.add(id));
  seq = Math.max(seq, st.seq || 0); kissCount = st.kissCount || 0;
}

// ---------------------------------------------------------------- panel commands
// tên người chơi thử kiểu nick TikTok thật
const FAKE_NAMES = [
  'Ngọc Hân', 'Minh Thư', 'Tuấn Anh', 'Bảo Ngọc 🌸', 'Hoàng Long', 'Thảo Vy', 'Gia Huy', 'Khánh Linh', 'Quỳnh Anh', 'Đức Minh',
  'Phương Thảo', 'Trà My', 'Nhật Nam', 'Yến Nhi', 'Thanh Tâm', 'Mai Anh', 'Hải Đăng', 'Kim Ngân', 'Anh Khoa', 'Thu Trang',
  'Bé Mèo Ú', 'Cún Con 🐶', 'Hồng Nhung', 'Văn Tài', 'Diễm My', 'Tiểu Bảo', 'Ngân Hà', 'Lan Hương', 'Hữu Phước', 'Như Ý',
  'minhthu_2k3', 'tuananh.98', 'ngocanh.hp', 'linhh.chii', 'huy.gaming', 'baoanh_08', 'thao.vy99', 'nam.nguyen', 'trang.bui02', 'khoa.dev',
  'hanhee 🍑', 'dieulinh.06', 'phuc.lee', 'vy.cutee', 'anhthu.ng', 'hoang.dz', 'mylinh_ht', 'quan.tran97', 'chau.sgg', 'long.ka',
  'Ốc Nhỏ 🐚', 'Mây Lang Thang', 'Gấu Bông', 'Trà Sữa Trân Châu', 'Nắng Hạ', 'Chill Cùng Tui', 'Bé Bơ 🥑', 'Kẹo Ngọt', 'Mèo Lười', 'Sóc Nâu',
  'Anh Ba Sài Gòn', 'Chị Hai Miền Tây', 'Thằng Cu Tèo', 'Cô Ba Đà Lạt', 'Hai Lúa', 'Út Cưng', 'Tí Nị', 'Bông Bé Bỏng', 'Bin Bin', 'Su Su',
  'Nguyễn Văn Hùng', 'Trần Thị Hoa', 'Lê Minh Quân', 'Phạm Ngọc Ánh', 'Vũ Đức Thắng', 'Đặng Thu Hà', 'Bùi Anh Tuấn', 'Đỗ Thùy Linh', 'Hồ Văn Hiếu', 'Ngô Thanh Bình',
  'Linh Kute 💕', 'Huy Đẹp Trai', 'Vy Vy 🎀', 'Tùng Lâm', 'My Mèo', 'Đạt Nè', 'Hiền Thục', 'Phong Bụi', 'Hải Bóng Đá', 'Trinh Bé',
  'Rose 🌹', 'Jenny', 'Kevin Trần', 'Tony Phạm', 'Lily Nguyễn', 'Sunny', 'Mochi 🍡', 'Bella', 'Daniel', 'Coco'
];
let nameBag = [], fakeN = 0;
function fakeName() {
  if (!nameBag.length) nameBag = FAKE_NAMES.slice().sort(() => Math.random() - .5);
  return nameBag.pop();
}
// kho avatar của người dùng (chọn trong bảng điều khiển, lưu ở localStorage dùng chung 2 cửa sổ)
let avatarBag = [];
function storedAvatars() { try { return JSON.parse(localStorage.getItem('kbl.avatars') || '[]'); } catch { return []; } }
function fakeAvatarFromStore() {
  if (!avatarBag.length) avatarBag = storedAvatars().sort(() => Math.random() - .5);
  return avatarBag.pop() || null;
}
addEventListener('storage', e => { if (e.key === 'kbl.avatars') avatarBag = []; });
function fakeAvatar(n) {
  const hue = (Math.random() * 360) | 0, ch = n.trim()[0] || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="hsl(${hue},70%,62%)"/><circle cx="64" cy="52" r="26" fill="hsl(${hue},60%,85%)"/><rect x="24" y="84" width="80" height="60" rx="30" fill="hsl(${hue},60%,85%)"/><text x="64" y="62" font-size="30" font-family="Arial" font-weight="bold" text-anchor="middle" fill="hsl(${hue},60%,35%)">${ch}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function fakeUser() {
  fakeN++;
  const used = new Set(all().map(p => p.name));
  let n = fakeName(), tries = 0;
  while (used.has(n) && tries++ < 20) n = fakeName();
  if (used.has(n)) n = n + ' ' + fakeN;
  return { id: 'test_' + fakeN + '_' + Date.now(), name: n, avatar: fakeAvatarFromStore() || fakeAvatar(n) };
}
const pick = arr => arr[(Math.random() * arr.length) | 0];
const asUser = p => ({ id: p.id, name: p.name, avatar: p.avatar });
function fakeLikes(n) {
  const b = all().filter(p => p.state === 'bridge');
  for (let i = 0; i < n && b.length; i++) handleEvent({ type: 'like', user: asUser(pick(b)), count: 1 + ((Math.random() * 3) | 0) });
}
function handleCmd(c) {
  switch (c.type) {
    case 'fake': for (let i = 0; i < (c.n || 1); i++) setTimeout(() => handleEvent({ type: 'join', user: fakeUser() }), i * 120); break;
    case 'fakeChat': {
      for (let i = 0; i < (c.n || 1); i++) {
        const y = all().filter(p => p.state === 'yard');
        const u = y.length ? asUser(pick(y)) : fakeUser();
        handleEvent({ type: 'chat', user: u, text: c.text || pick(['Cho mình lên cầu với 😍', 'Đẹp quá', 'Lên cầu nào!', 'Ai ghép với mình đi', 'Phú Quốc đỉnh quá']) });
      }
      break;
    }
    case 'fakeFollow': { const y = all().filter(p => p.state === 'yard'); handleEvent({ type: 'follow', user: y.length ? asUser(pick(y)) : fakeUser() }); break; }
    case 'fakeShare': { const y = all().filter(p => p.state === 'yard'); handleEvent({ type: 'share', user: y.length ? asUser(pick(y)) : fakeUser() }); break; }
    case 'fakeLike': fakeLikes(c.n || 10); break;
    case 'autoLike':
      if (autoLikeTimer) { clearInterval(autoLikeTimer); autoLikeTimer = null; }
      else autoLikeTimer = setInterval(() => fakeLikes(1), c.ms || 220);
      break;
    case 'fakeGift': {
      const b = all().filter(p => p.state === 'bridge' || p.state === 'center');
      const u = c.toExisting && b.length ? asUser(pick(b)) : fakeUser();
      handleEvent({ type: 'gift', user: u, coins: c.coins || 1, gift: c.coins >= 100 ? 'Nhẫn cưới' : c.coins >= 10 ? 'Bó hoa' : c.coins >= 5 ? 'Kẹo bông' : 'Hoa hồng', count: 1 });
      break;
    }
    case 'remove': removeId(c.id); break;
    case 'promote': { const p = PEOPLE.get(c.id); if (!p) break; if (p.state === 'yard') toBridge(p); else if (p.state === 'bridge') { p.lastLike = now(); arrive(p); } break; }
    case 'move': { const p = PEOPLE.get(c.id); if (p && p.state === 'bridge') { p.fromX = p.x; p.fromY = p.y; p.side = other(p.side); p.steps = 0; p.d = 0; p.enterT = now(); p.lastLike = now() + cfg.yard.flySec; p.flyK = 0; } break; }
    case 'clear': all().forEach(p => { if (p.state === 'bridge' || p.state === 'center') toYard(p); }); break;
    case 'clearAll': all().forEach(p => { if (p.state !== 'kiss') PEOPLE.delete(p.id); }); break;
    case 'clearDone': followed.clear(); break;
    case 'skip': if (pair && pair.phase !== 'out') endKiss(); break;
    case 'forcePair': {
      if (pair) break;
      const a = pickPartners('L', 1)[0], b = a && pickPartners('R', 1, [a])[0];
      if (a && b) { a.state = 'center'; b.state = 'center'; startKiss(a, [b]); }
      break;
    }
    case 'say': say(c.text, 'congrats'); break;
    case 'sfx': sfx(c.name); break;
    case 'event': handleEvent(c.ev); break;
  }
}

const RULES_V3 = {
  schema: 3,
  bridge: {
    leftPath: [[215, 1228], [190, 1190], [150, 1120], [110, 1050], [90, 1000], [100, 950], [125, 900], [172, 850], [212, 800], [212, 760], [178, 720], [128, 680], [95, 640], [100, 605], [150, 585], [250, 575], [350, 563], [420, 557], [452, 556]],
    rightPath: [[730, 1228], [745, 1185], [765, 1130], [790, 1070], [818, 1010], [841, 950], [816, 900], [769, 850], [729, 800], [729, 760], [763, 720], [813, 680], [846, 640], [841, 605], [791, 585], [691, 575], [591, 563], [521, 557], [489, 556]],
    nearY: 1228, farY: 556, farScale: 0.32, charH: 100, nameSize: 19
  },
  yard: { topY: 1245, bottomY: 1640, topX0: 230, topX1: 711, bottomX0: 120, bottomX1: 821, midGap: 30, charTop: 82, charBottom: 138, maxShow: 14, walkSpeed: 40, flySec: 1, flyHeight: 170 },
  boards: { guide: { x: 346, y: 898, w: 252, h: 160 }, guideBg: '#6a1222', guideLines: [
    'Vào live → ra sân chờ',
    'Comment/Follow/Share → lên cầu',
    '1 tim = 1 bước · {steps} bước',
    '{idle}s không thả tim → rời cầu',
    '{t1}xu x{s1} · {t2}xu x{s2} · {t3}xu x{s3}',
    '{t4} xu: hôn liền {c4} người 💋'
  ] },
  kiss: { cam: { split: 836, camTop: 520, scale: 1, kissCropY: 520, toastY: 1560 } },
  chat: { x: 620, y: 240, w: 310, h: 280, kissX: 300, kissY: 900, kissW: 340, kissH: 205 }
};
const RULES_V4 = {
  schema: 4,
  yard: { maxShow: 28 },
  boards: { guide: { x: 298, y: 902, w: 348, h: 234 }, guideBg: '#6c0f1e' },
  sfx: { files: { join: '', fly: '', kiss: '', gift: '', fanfare: '', poof: '' }, vols: { join: 1, fly: 1, kiss: 1, gift: 1, fanfare: 1, poof: 1 } }
};
const RULES_V5 = { schema: 5, boards: { guide: { x: 286, y: 903, w: 366, h: 242 }, guideBg: '#6e101c' } };
const RULES_V6 = { schema: 6, lang: 'vi', ticker: { show: true, text: '', speed: 90, h: 44, fontSize: 24, y: 0 }, en: JSON.parse(JSON.stringify(EN_DEFAULTS)), boards: { guideTitleRect: { x: 340, y: 821, w: 262, h: 80 } } };
// one-time settings migration for the new rules (runs inside hot-updated content, no new exe needed)
const NEW_RULES = {
  schema: 2,
  game: { steps: 100, idleSec: 10, maxYard: 200 },
  yard: { charH: 70, maxShow: 10, rowGap: 58, L: { x: 6, y: 1132, w: 296, h: 158 }, R: { x: 639, y: 1132, w: 296, h: 158 } },
  tiers: [
    { coins: 1, speed: 1.5, chain: 0, frame: 'frame1.png', label: 'Khung Tim Hồng' },
    { coins: 5, speed: 2, chain: 0, frame: 'frame2.png', label: 'Khung Kim Cương Xanh' },
    { coins: 10, speed: 3, chain: 0, frame: 'frame3.png', label: 'Khung Hoàng Gia' },
    { coins: 100, speed: 3, chain: 5, frame: 'frame4.png', label: 'Cổng Cưới' }
  ],
  timing: { walkSpeed: 120, slotSpacing: 40, chainKissSec: 3 },
  bridge: { rightPath: [[786, 1100], [822, 1055], [870, 1015], [903, 976], [914, 946], [888, 928], [820, 912], [720, 899], [620, 892], [540, 889], [490, 890]],
    leftPath: [[170, 1105], [142, 1070], [95, 1040], [52, 1005], [36, 966], [62, 942], [130, 928], [220, 914], [320, 902], [410, 894], [452, 890]] },
  boards: { guideLines: [
    'Vào live → đứng ở sân chờ',
    'Bình luận / Follow / Share để lên cầu',
    'Thả tim: 1 tim = 1 bước · {steps} bước',
    '{idle}s không thả tim sẽ rời cầu',
    'Tặng {t1}xu x{s1} · {t2}xu x{s2} · {t3}xu x{s3}',
    '{t4} xu: hôn liền {c4} người 💋'
  ] },
  voice: {
    welcomeTpl: 'Chào mừng {name}! Bình luận để lên cầu, thả tim để bước tới nhé',
    giftTpl: 'Cảm ơn {name} đã tặng {gift}! Tốc độ tăng gấp {speed} lần.',
    chainTpl: 'Wow! Cảm ơn {name} đã tặng {gift}! {name} được hôn liền {n} người!'
  }
};

// ---------------------------------------------------------------- boot
(async function boot() {
  cfg = await API.getSettings();
  if ((cfg.schema || 0) < 2) { cfg = await API.setSettings(NEW_RULES); log('Đã chuyển sang luật chơi mới (sân chờ + thả tim)'); }
  if ((cfg.schema || 0) < 3) { cfg = await API.setSettings(RULES_V3); log('Đã chuyển sang bối cảnh mới (quảng trường + camera chia đôi)'); }
  if ((cfg.schema || 0) < 4) {
    const patch = JSON.parse(JSON.stringify(RULES_V4));
    if (/\{side\}|bên \{side\}/.test(cfg.voice.welcomeTpl || '')) patch.voice = { welcomeTpl: cfg.voice.welcomeTpl.replace(/,?\s*bạn xếp hàng bên \{side\}/, '').replace('{side}', '') };
    cfg = await API.setSettings(patch); log('Đã cập nhật: sân chờ chung, âm thanh tuỳ chỉnh, bảng hướng dẫn lớn');
  }
  if ((cfg.schema || 0) < 5) {
    const patch = JSON.parse(JSON.stringify(RULES_V5));
    if ((cfg.chat.y || 0) < 300) patch.chat = { y: 305 };            // tiêu đề "Kissing Island" cao hơn
    cfg = await API.setSettings(patch); log('Đã đổi ảnh nền Kissing Island');
  }
  if ((cfg.schema || 0) < 6) { cfg = await API.setSettings(RULES_V6); log('Đã thêm: màn live tiếng Anh + dải chữ hướng dẫn chạy'); }
  rebuildPaths();
  await Promise.all(['800 20px B2', '20px PX'].map(f => document.fonts.load(f, 'Aàáạ')));
  await loadAssets();
  restore(await API.restoreState());
  API.onSettings(s => { cfg = s; rebuildPaths(); all().forEach(p => p.tier = tierFor(p.coins)); applyMusic(); });
  API.onLiveEvent(handleEvent);
  API.onCmd(handleCmd);
  applyMusic();
  document.getElementById('loading').remove();
  addEventListener('click', () => { ac(); music.play().catch(() => {}); });
  requestAnimationFrame(frame);
  log('Màn hình live đã sẵn sàng');
})().catch(e => { document.getElementById('loading').textContent = 'Lỗi: ' + e.message; log('Lỗi khởi động: ' + e.stack); });
