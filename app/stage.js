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
const sideName = s => s === 'L' ? 'TRÁI' : 'PHẢI';
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
  const cL = all().filter(x => x.side === 'L').length, cR = all().filter(x => x.side === 'R').length;
  const side = cL !== cR ? (cL < cR ? 'L' : 'R') : ((sideToggle++ % 2) ? 'R' : 'L');
  p = newPerson(user); p.side = side;
  PEOPLE.set(p.id, p);
  pruneYard(side);
  if (!quiet) {
    toast('👋 ' + shortName(p.name, 18) + ' vào sân chờ ' + sideName(side), '#ffe7a8', 2.2);
    if (cfg.voice.welcome) say(tpl(cfg.voice.welcomeTpl, { name: speakName(p.name), side: side === 'L' ? 'trái' : 'phải' }), 'welcome');
    sfx('join');
  }
  return p;
}
function pruneYard(side) {
  const y = onSide(side, ['yard']);
  const max = G().maxYard || 200;
  if (y.length <= max) return;
  y.sort((a, b) => a.active - b.active).slice(0, y.length - max).forEach(p => { if (!p.coins) PEOPLE.delete(p.id); });
}

function toBridge(p, why) {
  if (!p || p.state !== 'yard') return false;
  p.state = 'bridge'; p.steps = 0; p.d = 0; p.lastLike = now(); p.enterT = now(); p.active = Date.now();
  p.fromX = p.x; p.fromY = p.y;
  toast('🌉 ' + shortName(p.name, 16) + ' lên cầu ' + sideName(p.side) + ' · thả tim để bước!', '#bfe9ff', 2.4);
  sfx('join');
  return true;
}
function toYard(p, reason) {
  if (!p) return;
  if (reason === 'idle') {
    for (let i = 0; i < 6; i++) spawnHeart(p.x, p.y - 40, true);
    toast('⌛ ' + shortName(p.name, 16) + ' rời cầu vì không thả tim', '#ffc2c2', 2.4);
    sfx('poof');
  }
  p.state = 'yard'; p.steps = 0; p.d = 0; p.dash = false; p.arriveSeq = 0;
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
  if (p && p.state === 'bridge') addSteps(p, Math.max(1, count || 1));
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
  const extra = t ? (t.chain ? ' → 💋 Hôn liền ' + t.chain + ' người!' : ' → ⚡ tốc độ x' + t.speed) : '';
  toast('🎁 ' + shortName(p.name, 16) + ' tặng ' + giftName + (count > 1 ? ' x' + count : '') + extra, '#ffd34d', 4, true);
  say(tpl(t && t.chain ? cfg.voice.chainTpl || cfg.voice.giftTpl : cfg.voice.giftTpl, { name: speakName(p.name), gift: giftName + (count > 1 ? ' ' + count + ' lần' : ''), n: t && t.chain, speed: t && t.speed }), 'gift');
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
    const r = await API.tts(v.text, cfg.voice);
    if (r && r.b64) {
      audio.src = 'data:' + r.mime + ';base64,' + r.b64;
      audio.volume = clamp(cfg.voice.volume, 0, 1);
      duckMusic(true);
      await audio.play();
      await new Promise(res => { audio.onended = res; audio.onerror = res; setTimeout(res, 20000); });
    } else if (r && r.system && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(r.text); u.lang = 'vi-VN'; u.volume = cfg.voice.volume; u.rate = 1 + (cfg.voice.rate || 0) / 100;
      const vv = speechSynthesis.getVoices().find(x => /vi/i.test(x.lang)); if (vv) u.voice = vv;
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
  const url = 'file:///' + f.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/^\/?([A-Za-z])%3A/, '$1:');
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
  const v = vol * cfg.sfx.volume;
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
  g.gain.value = vol * cfg.sfx.volume; s.buffer = b; s.connect(flt).connect(g).connect(a.destination); s.start(a.currentTime + t0);
}
function sfx(name) {
  try {
    if (!cfg || cfg.sfx.volume <= 0) return;
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
    else if (name === 'poof') { noise(0, .25, .2, 700); tone(500, 0, .25, 'square', .06, 150); }
    else if (name === 'arrive') { [784, 988, 1175].forEach((f, i) => tone(f, i * .08, .12, 'square', .08)); }
  } catch {}
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
  const p = cfg.bridge, near = 1250, far = 882;
  return lerp(p.farScale, 1, clamp((y - far) / (near - far), 0, 1));
}
function yardRect(side) { return (cfg.yard || {})[side]; }
function layoutYard(side) {
  const Y = cfg.yard, R = yardRect(side);
  const list = onSide(side, ['yard']).sort((a, b) => b.active - a.active);
  const show = list.slice(0, Y.maxShow);
  const perRow = Math.max(1, Math.ceil(show.length / 2));
  const cols = Math.max(perRow, Math.floor(Y.maxShow / 2));
  show.forEach((p, i) => {
    const row = i % 2, col = (i / 2) | 0;
    const sp = (R.w - 30) / cols;
    p.x = R.x + 15 + sp * (col + .5) + (row ? sp * .5 : 0) - sp * .25;
    if (p.x > R.x + R.w - 12) p.x -= sp;
    p.y = R.y + R.h - 10 - (row ? Y.rowGap : 0);
    p.vis = true; p.yRow = row;
  });
  list.slice(Y.maxShow).forEach(p => { p.vis = false; p.x = R.x + R.w / 2; p.y = R.y + R.h - 8; });
  return { list, show };
}
function updBridge(dt) {
  const T = cfg.timing, g = G(), tnow = now();
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
      const diff = p.tgt - p.d;
      const sp = T.walkSpeed * (p.dash ? 5 : 1) * (diff > 120 ? 1.8 : 1);
      if (Math.abs(diff) > .5) { p.d += Math.sign(diff) * Math.min(Math.abs(diff), sp * dt); p.moving = true; }
      else { p.moving = false; if (p.dash && p.state === 'center') p.dash = false; }
      let [x, y] = PATH[side].at(p.d);
      const e = clamp((tnow - p.enterT) / .6, 0, 1);
      if (e < 1 && p.fromX != null) { x = lerp(p.fromX, x, ease(e)); y = lerp(p.fromY, y, ease(e)); p.moving = true; }
      p.x = x; p.y = y; p.vis = true;
    }
    layoutYard(side);
  }
  if (scene === 'bridge' && !pair) tryPair();
}
function readyAtCenter(p) { return p.state === 'center' && now() - p.arriveT >= cfg.timing.waitAtEndSec && Math.abs(p.d - p.tgt) < 3; }
function pickPartners(side, n) {
  const c = onSide(side, ['center']).sort((a, b) => a.arriveSeq - b.arriveSeq);
  const b = onSide(side, ['bridge']).sort((a, b) => b.steps - a.steps);
  const y = onSide(side, ['yard']).sort((a, b) => b.active - a.active);
  return [...c, ...b, ...y].slice(0, n);
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
function drawNameTag(p, x, y, size) {
  const name = fitText(shortName(p.name, 16), size, 220);
  if (p.tier) {
    ctx.font = '800 ' + size + 'px B2, sans-serif'; const w = ctx.measureText(name).width + size * 1.4;
    rrect(x - w / 2, y - size * .75, w, size * 1.5, size * .5);
    ctx.fillStyle = TIER_COL[(p.tier - 1) % 4]; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff3c4'; ctx.stroke();
    txt(name, x, y + 1, size, '#fff', 'center', '#2a0712', size * .18);
  } else txt(name, x, y, size, '#fff', 'center', '#2a0712');
}
function drawYardPlaque(side) {
  const R = yardRect(side), n = onSide(side, ['yard']).length;
  ctx.fillStyle = 'rgba(70,12,36,.55)'; rrect(R.x, R.y, R.w, R.h, 16); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,211,77,.85)'; ctx.stroke();
  const label = '🏖 SÂN CHỜ ' + sideName(side) + ' · ' + n;
  ctx.font = '800 17px B2, sans-serif';
  const w = ctx.measureText(label).width + 22, lx = R.x + (R.w - w) / 2;
  ctx.fillStyle = '#b3123f'; rrect(lx, R.y - 26, w, 26, 13); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#ffd34d'; ctx.stroke();
  txt(label, lx + w / 2, R.y - 12, 17, '#ffe066', 'center', '#4a0f24', 4);
}
function drawBridge() {
  ctx.drawImage(IMG.bridge, 0, 0, WW, WH);
  const t = now(), g = G(), Y = cfg.yard;
  drawYardPlaque('L'); drawYardPlaque('R');
  const list = all().filter(p => p.vis && (p.state === 'bridge' || p.state === 'center' || p.state === 'yard'));
  list.sort((a, b) => a.y - b.y);
  for (const p of list) {
    const inYard = p.state === 'yard';
    const s = inYard ? Y.charH / cfg.bridge.charH : scaleAtY(p.y), h = cfg.bridge.charH * s;
    const bob = p.moving ? Math.abs(Math.sin(t * 9 + p.phase)) * 5 * s : Math.sin(t * 2 + p.phase) * 1.2 * s;
    const tilt = p.moving ? Math.sin(t * 9 + p.phase) * 0.06 : 0;
    let alpha = 1;
    if (p.state === 'bridge') { const left = g.idleSec - (t - p.lastLike); if (left < 3) alpha = .45 + .55 * Math.abs(Math.sin(t * 8)); }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(tilt); ctx.translate(-p.x, -p.y);
    ctx.fillStyle = 'rgba(40,10,20,.28)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 20 * s, 6 * s, 0, 0, 7); ctx.fill();
    drawPerson(p, p.x, p.y - bob, h, 'stand', false, alpha);
    ctx.restore();
    if (inYard) {
      txt(fitText(shortName(p.name, 10), 13, 50), p.x, p.y - h - 8, 13, p.coins ? '#ffe066' : '#fff', 'center', '#2a0712', 3.5);
      continue;
    }
    const nameY = p.y - h - bob - 10 * s;
    drawNameTag(p, p.x, nameY, Math.round(cfg.bridge.nameSize * clamp(s * 1.1, .75, 1.2)));
    // progress bar (bước chân)
    const bw = 46, bx = p.x - bw / 2, by = nameY + 12;
    ctx.fillStyle = 'rgba(40,6,20,.75)'; rrect(bx - 1, by - 1, bw + 2, 7, 3); ctx.fill();
    ctx.fillStyle = p.state === 'center' ? '#ffd34d' : '#ff6fa0'; rrect(bx, by, bw * clamp(p.steps / g.steps, 0, 1), 5, 2); ctx.fill();
    // badges
    const tob = tierObj(p);
    if (tob && p.state === 'bridge') txt(tob.chain ? '💋x' + tob.chain : '⚡x' + tob.speed, p.x + 34, nameY - 16, 15, '#ffe066', 'center', '#4a0f24', 4);
    if (p.state === 'bridge') {
      const left = g.idleSec - (t - p.lastLike);
      if (left < 5) txt('⏳' + Math.ceil(left) + 's · thả tim!', p.x, nameY - 20, 15, '#ffb0b0', 'center', '#4a0f24', 4);
      else if (t - p.enterT < 3 && p.steps === 0) txt('❤ thả tim để bước', p.x, nameY - 20, 15, '#ffe0ec', 'center', '#4a0f24', 4);
    }
    if (p.state === 'center' && p.cIdx === 0 && !onSide(other(p.side), ['center']).length && !p.chain) {
      ctx.globalAlpha = .9 + Math.sin(t * 4) * .1;
      txt('Chờ nửa kia 💗', p.x + (p.side === 'L' ? -10 : 10), nameY - 20, 16, '#ffe0ec', 'center', '#4a0f24', 4);
      ctx.globalAlpha = 1;
    }
  }
  for (const side of ['L', 'R']) {
    const hidden = onSide(side, ['yard']).length - Y.maxShow;
    if (hidden > 0) { const R = yardRect(side); txt('+' + hidden + ' người', R.x + R.w - 36, R.y + 16, 15, '#ffe066', 'center', '#4a0f24', 4); }
  }
  if (cfg.bridge.showPath) {
    for (const side of ['L', 'R']) {
      ctx.strokeStyle = side === 'L' ? '#0f0' : '#0ff'; ctx.lineWidth = 3; ctx.beginPath();
      cfg.bridge[side === 'L' ? 'leftPath' : 'rightPath'].forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]));
      ctx.stroke();
      cfg.bridge[side === 'L' ? 'leftPath' : 'rightPath'].forEach((pt, i) => txt(String(i), pt[0], pt[1], 14, '#ff0', 'center', '#000'));
    }
  }
  drawBoards();
}

function guideVars() {
  const v = { steps: G().steps, idle: G().idleSec };
  cfg.tiers.forEach((t, i) => { v['t' + (i + 1)] = t.coins; v['s' + (i + 1)] = t.speed; v['c' + (i + 1)] = t.chain || ''; });
  return v;
}
function drawBoards() {
  const B = cfg.boards;
  for (const side of ['L', 'R']) {
    const cx = side === 'L' ? B.leftX : B.rightX, x0 = cx - B.rowW / 2;
    const q = onSide(side, ['center', 'bridge']).sort((a, b) => (b.state === 'center') - (a.state === 'center') || (a.arriveSeq - b.arriveSeq) || (b.steps - a.steps));
    const nYard = onSide(side, ['yard']).length;
    const showN = Math.min(q.length, B.rows - 1);
    for (let i = 0; i < showN; i++) {
      const p = q[i], y = B.firstRowY + i * B.rowH;
      const col = p.tier ? ['#ff9ec4', '#8fd0ff', '#ff8a8a', '#ffd34d'][(p.tier - 1) % 4] : '#fff6e0';
      txt(String(i + 1), x0 + 14, y, B.fontSize * .9, '#ffd36b', 'center', '#2a0712');
      txt(fitText(p.name, B.fontSize, B.rowW - 82), x0 + 30, y, B.fontSize, col, 'left', '#2a0712');
      const st = p.state === 'center' ? '💗' : Math.floor(p.steps) + '';
      txt(st, x0 + B.rowW - 8, y, B.fontSize * .85, p.state === 'center' ? '#ff9ec4' : '#bfe9ff', 'right', '#2a0712');
    }
    if (!q.length) txt('Cầu đang trống', cx, B.firstRowY, B.fontSize * .9, 'rgba(255,240,220,.6)', 'center', null);
    const more = q.length - showN;
    const ly = B.firstRowY + (B.rows - 1) * B.rowH;
    txt(fitText('🏖 Sân chờ: ' + nYard + (more > 0 ? ' · +' + more + ' trên cầu' : ''), B.fontSize * .85, B.rowW - 10), cx, ly, B.fontSize * .85, '#ffd36b');
  }
  // guide (center board) — cover the baked text and draw ours
  ctx.fillStyle = '#5a1530';
  rrect(324, 1380, 297, 214, 10); ctx.fill();
  if (B.guideTitle) { ctx.fillStyle = '#5a1530'; rrect(340, 1308, 262, 70, 8); ctx.fill(); txt(B.guideTitle, 471, 1342, 30, '#ffd36b'); }
  const vars = guideVars();
  const lines = (B.guideLines || []).map(l => tpl(l, vars));
  const n = lines.length || 1, h = 206 / n;
  lines.forEach((l, i) => {
    const y = 1385 + h * i + h / 2;
    if (i) { ctx.fillStyle = 'rgba(255,190,120,.18)'; ctx.fillRect(338, y - h / 2, 270, 2); }
    const r = Math.min(12, h * .36);
    ctx.fillStyle = '#ffcf3d'; ctx.beginPath(); ctx.arc(347, y, r, 0, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#7a3a00'; ctx.stroke();
    txt(String(i + 1), 347, y + 1, r * 1.4, '#5a1530', 'center', null);
    let fsz = Math.min(19, Math.floor(h * .55)); ctx.font = '800 ' + fsz + 'px B2, sans-serif';
    while (fsz > 12 && ctx.measureText(l).width > 252) { fsz--; ctx.font = '800 ' + fsz + 'px B2, sans-serif'; }
    txt(fitText(l, fsz, 252), 366, y + 1, fsz, '#fff3dc', 'left', '#2a0712', 3);
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
function drawKissPanel() {
  if (panelA <= 0) return;
  const K = cfg.kiss, PN = K.panel || { x: 16, y: 36, w: 909, h: 720, cropY: 585 }, t = now();
  // render kiss world into offscreen
  ctx = kissCtx;
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  drawKiss(); drawHearts(true);
  ctx = mainCtx;
  const k = panelTo ? easeOutBack(panelA) : ease(panelA);
  const cx = PN.x + PN.w / 2, cy = PN.y + PN.h / 2;
  ctx.save();
  ctx.globalAlpha = clamp(panelA * 2, 0, 1);
  ctx.translate(cx, cy); ctx.scale(lerp(.25, 1, k), lerp(.25, 1, k)); ctx.translate(-cx, -cy);
  const r = 26, bw = 10;
  // outer gold frame
  ctx.fillStyle = '#4a0f24'; rrect(PN.x - bw - 4, PN.y - bw - 4, PN.w + (bw + 4) * 2, PN.h + (bw + 4) * 2, r + 12); ctx.fill();
  const g = ctx.createLinearGradient(0, PN.y, 0, PN.y + PN.h);
  g.addColorStop(0, '#fff1a8'); g.addColorStop(.5, '#ffc93a'); g.addColorStop(1, '#e08a12');
  ctx.fillStyle = g; rrect(PN.x - bw, PN.y - bw, PN.w + bw * 2, PN.h + bw * 2, r + 8); ctx.fill();
  ctx.fillStyle = '#ff6fa0'; rrect(PN.x - 3, PN.y - 3, PN.w + 6, PN.h + 6, r + 2); ctx.fill();
  // scene (cropped)
  const srcH = WW * PN.h / PN.w;
  ctx.save(); rrect(PN.x, PN.y, PN.w, PN.h, r); ctx.clip();
  ctx.drawImage(kissCv, 0, PN.cropY * SC, WW * SC, srcH * SC, PN.x, PN.y, PN.w, PN.h);
  ctx.restore();
  // corner hearts
  [[PN.x, PN.y], [PN.x + PN.w, PN.y], [PN.x, PN.y + PN.h], [PN.x + PN.w, PN.y + PN.h]].forEach(([x, y], i) => drawPixelHeart(x, y, 5 + Math.sin(t * 4 + i) * .6, '#ff3b6b'));
  // ribbon title
  const tier = pair && pair.tier && cfg.tiers[pair.tier - 1];
  const title = pair && (pair.phase === 'showcase' || (pair.phase === 'out' && tier)) && tier ? '🎉 ' + tier.label + ' 🎉'
    : pair && pair.chain ? '💋 Hôn liền ' + pair.idx + '/' + pair.total + ' 💋' : (K.panelTitle || '💋 Nụ hôn trên cầu 💋');
  ctx.font = '800 34px B2, sans-serif';
  const tw = Math.min(PN.w - 80, ctx.measureText(title).width + 70), ty = PN.y + 2;
  ctx.fillStyle = '#4a0f24'; rrect(cx - tw / 2 - 4, ty - 30, tw + 8, 60, 30); ctx.fill();
  ctx.fillStyle = '#b3123f'; rrect(cx - tw / 2, ty - 26, tw, 52, 26); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffd34d'; ctx.stroke();
  txt(fitText(title, 32, tw - 30), cx, ty + 1, 32, '#ffe066', 'center', '#4a0f24', 7);
  ctx.restore();
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
    if (!P.chain || P.idx === 1) say(tpl(cfg.voice.congratsTpl, { a: speakName(P.a.name), b: speakName(P.b.name) }), 'congrats');
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
        say(tpl(cfg.voice.donorTpl, { a: speakName(P.a.name), b: speakName(P.b.name), frame: tier.label }), 'congrats');
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
    const y = K.feetY + 28;
    ctx.fillStyle = 'rgba(60,8,30,.55)'; rrect(WW / 2 - 330, y - 30, 660, 60, 30); ctx.fill();
    txt(fitText(shortName(P.a.name, 16), 34, 270), WW / 2 - 40, y, 34, '#fff', 'right');
    txt(fitText(shortName(P.b.name, 16), 34, 270), WW / 2 + 40, y, 34, '#fff', 'left');
    drawPixelHeart(WW / 2, y, 5 + Math.sin(t * 6), '#ff3b6b');
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
    const ny = K.showcaseFeetY + 56;
    ctx.fillStyle = 'rgba(60,8,30,.6)'; rrect(WW / 2 - 340, ny - 30, 680, 60, 30); ctx.fill();
    txt(fitText(shortName(P.a.name, 16), 34, 270), WW / 2 - 40, ny, 34, '#fff', 'right');
    txt(fitText(shortName(P.b.name, 16), 34, 270), WW / 2 + 40, ny, 34, '#fff', 'left');
    drawPixelHeart(WW / 2, ny, 5 + Math.sin(t * 6), '#ff3b6b');
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
function drawToasts(dt) {
  let y = lerp(530, 905, ease(clamp(panelA, 0, 1)));
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
  drawBridge();
  drawHearts(false);
  drawKissPanel();
  drawChat();
  drawToasts(dt);
  stateT += dt; persistT += dt;
  if (stateT > .5) { stateT = 0; pushState(); }
  if (persistT > 3) { persistT = 0; persist(); }
  requestAnimationFrame(frame);
}
const lite = p => ({ id: p.id, name: p.name, avatar: p.avatar, coins: p.coins, tier: p.tier, char: p.char, side: p.side, state: p.state, steps: Math.floor(p.steps), chain: p.chain });
function pushState() {
  const ls = s => all().filter(p => p.side === s && p.state !== 'kiss')
    .sort((a, b) => ({ center: 0, bridge: 1, yard: 2 }[a.state] - { center: 0, bridge: 1, yard: 2 }[b.state]) || (a.arriveSeq - b.arriveSeq) || (b.steps - a.steps) || (b.active - a.active)).map(lite);
  const cnt = st => all().filter(p => p.state === st).length;
  API.sendState({ scene, phase: pair && pair.phase, pair: pair ? [lite(pair.a), lite(pair.b)] : null, chain: pair && pair.chain ? [pair.idx, pair.total] : null,
    L: ls('L'), R: ls('R'), counts: { yard: cnt('yard'), bridge: cnt('bridge'), center: cnt('center') }, done: kissCount, voiceQ: voiceQ.length, autoLike: !!autoLikeTimer });
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
    if (p.state === 'bridge') { p.steps = o.steps || 0; p.lastLike = now(); p.d = p.steps * stepLen(p.side); p.enterT = -9; }
    if (p.state === 'center') { p.steps = G().steps; p.arriveSeq = ++seq; p.arriveT = now(); p.d = PATH[p.side].len; }
    PEOPLE.set(p.id, p);
  }
  (st.followed || []).forEach(id => followed.add(id));
  seq = Math.max(seq, st.seq || 0); kissCount = st.kissCount || 0;
}

// ---------------------------------------------------------------- panel commands
const FAKE = ['Ngọc Anh', 'Minh Tuấn', 'Thu Hà', 'Hoàng Nam', 'Bảo Ngọc', 'Quốc Huy', 'Lan Chi', 'Đức Anh', 'Mai Phương', 'Gia Bảo', 'Khánh Linh', 'Trung Kiên', 'Phương Thảo', 'Tiến Dũng', 'Hải Yến'];
let fakeN = 0;
function fakeAvatar(n) {
  const hue = (Math.random() * 360) | 0, ch = n.trim()[0] || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="hsl(${hue},70%,62%)"/><circle cx="64" cy="52" r="26" fill="hsl(${hue},60%,85%)"/><rect x="24" y="84" width="80" height="60" rx="30" fill="hsl(${hue},60%,85%)"/><text x="64" y="62" font-size="30" font-family="Arial" font-weight="bold" text-anchor="middle" fill="hsl(${hue},60%,35%)">${ch}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function fakeUser() { fakeN++; const n = FAKE[(Math.random() * FAKE.length) | 0] + ' ' + fakeN; return { id: 'test_' + fakeN + '_' + Date.now(), name: n, avatar: fakeAvatar(n) }; }
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
    case 'move': { const p = PEOPLE.get(c.id); if (p && (p.state === 'yard' || p.state === 'bridge')) { toYard(p); p.side = other(p.side); p.active = Date.now(); } break; }
    case 'clear': all().forEach(p => { if (p.state === 'bridge' || p.state === 'center') toYard(p); }); break;
    case 'clearAll': all().forEach(p => { if (p.state !== 'kiss') PEOPLE.delete(p.id); }); break;
    case 'clearDone': followed.clear(); break;
    case 'skip': if (pair && pair.phase !== 'out') endKiss(); break;
    case 'forcePair': {
      if (pair) break;
      const top = s => pickPartners(s, 1)[0];
      const a = top('L'), b = top('R');
      if (a && b) { a.state = 'center'; b.state = 'center'; startKiss(a, [b]); }
      break;
    }
    case 'say': say(c.text, 'congrats'); break;
    case 'sfx': sfx(c.name); break;
    case 'event': handleEvent(c.ev); break;
  }
}

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
