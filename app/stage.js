/* Kissing Bridge Live — stage (9:16 window) */
'use strict';
const API = window.api;
const WW = 941, WH = 1672;                 // world = background pixel space
const cv = document.getElementById('c');
const mainCtx = cv.getContext('2d');
let ctx = mainCtx;
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

// ---------------------------------------------------------------- language (vi / en)
const STR = {
  vi: {
    joinYard: '👋 {name} vào sân chờ', onBridge: '🌉 {name} lên cầu {side} · thả tim để bước!', idle: '⌛ {name} rời cầu vì không thả tim',
    gift: '🎁 {name} tặng {gift}{count}{extra}', giftChain: ' → 💋 Hôn liền {n} người!', giftSpeed: ' → ⚡ tốc độ x{speed}', times: ' {n} lần',
    left: 'TRÁI', right: 'PHẢI', waitMatch: 'Chờ nửa kia 💗', likeToWalk: '❤ thả tim để bước', idleLeft: '⏳{n}s · thả tim!',
    moreYard: '+{n} người ở sân chờ', panelTitle: '💋 Nụ hôn trên cầu 💋', streak: '💋 Hôn liền {i}/{n} 💋',
    queueTitle: 'HÀNG CHỜ', queueEmpty: 'Vào live để được lên cầu hôn 💕', queueEmptyShort: 'Chưa có ai — vào live nhé!', moreQueue: '+{n} người nữa',
    joinQueue: '👋 {name} vào hàng chờ (#{pos})', giftFront: '🎁 {name} tặng {gift}{count} → {frame} · lên đầu hàng!'
  },
  en: {
    joinYard: '👋 {name} joined the plaza', onBridge: '🌉 {name} is on the {side} bridge · send likes to walk!', idle: '⌛ {name} left the bridge (no likes)',
    gift: '🎁 {name} sent {gift}{count}{extra}', giftChain: ' → 💋 Kiss {n} in a row!', giftSpeed: ' → ⚡ speed x{speed}', times: ' x{n}',
    left: 'LEFT', right: 'RIGHT', waitMatch: 'Waiting for a match 💗', likeToWalk: '❤ send likes to walk', idleLeft: '⏳{n}s · send likes!',
    moreYard: '+{n} more in the plaza', panelTitle: '💋 A Kiss on the Bridge 💋', streak: '💋 Kiss streak {i}/{n} 💋',
    queueTitle: 'QUEUE', queueEmpty: 'Join the LIVE to kiss on the bridge 💕', queueEmptyShort: 'Nobody yet — join the LIVE!', moreQueue: '+{n} more',
    joinQueue: '👋 {name} joined the queue (#{pos})', giftFront: '🎁 {name} sent {gift}{count} → {frame} · to the front!'
  }
};
const EN_DEFAULTS = {
  guideTitle: 'HOW TO PLAY',
  guideLines: ['Join the LIVE → enter the plaza', 'Comment/Follow/Share → hop on', '1 like = 1 step · {steps} steps', 'No likes for {idle}s → you leave',
    '{t1}c x{s1} · {t2}c x{s2} · {t3}c x{s3}', '{t4} coins: kiss {c4} in a row 💋'],
  tierLabels: ['Pink Heart Frame', 'Blue Diamond Frame', 'Royal Frame', 'Wedding Arch'],
  panelTitle: '',
  ticker: '💕 HOW TO PLAY: Join the LIVE to get in the kissing queue  •  The first person stands on the left, the next one appears on the right — and they KISS 💋  •  Send a gift to jump to the front of the queue  •  {t1} coins: {l1}  •  {t2} coins: {l2}  •  {t3} coins: {l3}  •  {t4} coins: {l4}',
  voice: {
    voice: 'en-GB-SoniaNeural',
    welcomeTpl: 'Welcome {name}! You are now in the kissing queue.',
    congratsTpl: 'Congratulations {a} and {b} on your kiss on the bridge!',
    giftTpl: 'Thank you {name} for the {gift}! You jump to the front of the queue.',
    chainTpl: 'Wow! Thank you {name} for the {gift}! {name} gets to kiss {n} people in a row!',
    donorTpl: 'Congratulations {a} and {b}, you earned the {frame}!'
  }
};
const VI_TICKER = '💕 CÁCH CHƠI: Vào live là được xếp hàng lên cầu hôn  •  Người trước đứng bên trái, người sau xuất hiện bên phải và hai bạn HÔN nhau 💋  •  Tặng quà để được lên đầu hàng chờ  •  {t1} xu: {l1}  •  {t2} xu: {l2}  •  {t3} xu: {l3}  •  {t4} xu: {l4}';
const isEN = () => cfg && cfg.lang === 'en';
const EN = () => Object.assign({}, EN_DEFAULTS, cfg.en || {}, { voice: Object.assign({}, EN_DEFAULTS.voice, (cfg.en || {}).voice || {}) });
function S(k, v = {}) { return tpl((isEN() ? STR.en : STR.vi)[k], v); }
function tierLabel(t) { if (!t) return ''; const i = cfg.tiers.indexOf(t); return isEN() ? (EN().tierLabels[i] || t.label) : t.label; }
function voiceCfg() { return isEN() ? Object.assign({}, cfg.voice, EN().voice) : cfg.voice; }

// ---------------------------------------------------------------- state
// Một hàng chờ duy nhất. Người đầu hàng đứng bên trái, người kế tiếp xuất hiện bên phải → hôn → lượt kế tiếp.
const QUEUE = [];                    // people waiting
const KNOWN = new Map();             // id -> person (queue + on stage)
const doneAt = new Map();            // id -> ms when they finished kissing
const followed = new Set();          // follow chỉ tính 1 lần / người
let seq = 0, kissCount = 0;
let cur = null;                      // { a, b, phase: enter|kiss|showcase|exit, t, aT, bT, tier }
const chat = [];
const toasts = [];
const hearts = [];
const sparkles = [];

function tierFor(coins) { let t = 0; (cfg.tiers || []).forEach((x, i) => { if (coins >= x.coins) t = i + 1; }); return t; }
const tierObj = p => cfg.tiers[p.tier - 1];
function newPerson(user) {
  const p = { id: user.id, name: user.name || user.id, avatar: user.avatar || '', avatarImg: null,
    char: Math.floor(Math.random() * Math.max(1, CHARS.length)), coins: 0, tier: 0, seq: ++seq, prio: 0, donorSeq: 0 };
  if (p.avatar) loadAvatar(p);
  return p;
}
let avFail = 0, avOk = 0;
function altUrls(u) {                       // TikTok CDN serves the same picture as webp / jpeg / heic
  const out = [u];
  if (/\.heic/i.test(u)) out.push(u.replace(/\.heic/i, '.jpeg'), u.replace(/\.heic/i, '.webp'));
  else if (/\.webp/i.test(u)) out.push(u.replace(/\.webp/i, '.jpeg'));
  else if (/\.jpe?g/i.test(u)) out.push(u.replace(/\.jpe?g/i, '.webp'));
  return out;
}
async function loadAvatar(p) {
  const src = p.avatar;
  for (const u of /^data:/.test(src) ? [src] : altUrls(src)) {
    const im = await loadRemote(u);
    if (im && im.width) {
      if (p.avatar !== src) return;
      p.avatarImg = im; p._comp = null;
      if (!/^data:/.test(src) && avOk++ === 0) log('✅ Đã tải avatar TikTok đầu tiên (' + p.name + ')');
      return;
    }
  }
  if (!/^data:/.test(src) && (avFail++ < 3 || avFail % 50 === 0)) log('⚠️ Không tải được avatar của ' + p.name + ': ' + String(src).slice(0, 90));
}
function sortQueue() {
  QUEUE.sort((a, b) => (b.prio - a.prio) || ((b.coins > 0) - (a.coins > 0)) || (b.coins - a.coins) || ((a.donorSeq || a.seq) - (b.donorSeq || b.seq)));
}
function onStage(p) { return cur && (cur.a === p || cur.b === p); }

function enqueue(user, reason) {
  if (!user || !user.id || !CHARS.length) return null;
  let p = KNOWN.get(user.id);
  if (p) {
    if (user.avatar && !p.avatar) { p.avatar = user.avatar; loadAvatar(p); }
    if (user.name && user.name !== p.name) p.name = user.name;
    return p;
  }
  if (reason !== 'gift') {
    const t = doneAt.get(user.id);
    if (t && Date.now() - t < (cfg.join.rejoinMinutes || 0) * 60000) return null;
    if (QUEUE.length >= (cfg.join.maxQueue || 300)) return null;
  }
  p = newPerson(user);
  KNOWN.set(p.id, p); QUEUE.push(p); sortQueue();
  if (reason !== 'gift') {
    toast(S('joinQueue', { name: shortName(p.name, 18), pos: QUEUE.indexOf(p) + 1 + (cur ? (cur.b ? 2 : 1) : 0) }), '#ffe7a8', 2.2);
    if (cfg.voice.welcome) say(tpl(voiceCfg().welcomeTpl, { name: speakName(p.name), side: '' }), 'welcome');
    sfx('join');
  }
  return p;
}

// ---------------------------------------------------------------- events
function onGift(user, coins, giftName, count) {
  const p = enqueue(user, 'gift');
  if (!p) return;
  p.coins += coins; p.donorSeq = p.donorSeq || ++seq;
  const old = p.tier; p.tier = tierFor(p.coins);
  if (QUEUE.includes(p)) sortQueue();
  if (cur && onStage(p) && cur.phase !== 'showcase' && cur.phase !== 'exit') cur.tier = Math.max(cur.a.tier, cur.b ? cur.b.tier : 0);
  const t = tierObj(p);
  toast(S('giftFront', { name: shortName(p.name, 16), gift: giftName, count: count > 1 ? ' x' + count : '', frame: t ? tierLabel(t) : '' }), '#ffd34d', 4, true);
  const V = voiceCfg();
  say(tpl(V.giftTpl, { name: speakName(p.name), gift: giftName + (count > 1 ? S('times', { n: count }) : ''), frame: t ? tierLabel(t) : '' }), 'gift');
  sfx('gift');
  for (let i = 0; i < 12; i++) spawnHeart(WW / 2, 1100, true);
  if (p.tier > old) log(`${p.name} đạt mức ${p.tier} (${p.coins} xu)`);
}
function onChat(user, text) {
  chat.push({ name: user.name, text, avatar: null, t: now() });
  loadRemote(user.avatar).then(im => { const m = chat.find(c => c.name === user.name && c.text === text); if (m) m.avatar = im; });
  while (chat.length > 30) chat.shift();
}
let diagN = 0;
function handleEvent(ev) {
  const j = cfg.join;
  if (ev.user && !String(ev.user.id || '').startsWith('test_') && diagN < 5) {
    diagN++;
    log(`👤 [${ev.type}] ${ev.user.name} — link avatar: ${ev.user.avatar ? 'CÓ' : 'KHÔNG CÓ (exe cũ hoặc TikTok không gửi)'}`);
  }
  switch (ev.type) {
    case 'chat': onChat(ev.user, ev.text); if (j.onComment) enqueue(ev.user, 'chat'); break;
    case 'join': if (j.onMember) enqueue(ev.user, 'join'); break;
    case 'like': if (j.onLike) enqueue(ev.user, 'like'); break;
    case 'follow': if (j.onFollow && !followed.has(ev.user.id)) { followed.add(ev.user.id); enqueue(ev.user, 'follow'); } break;
    case 'share': if (j.onShare) enqueue(ev.user, 'share'); break;
    case 'gift': onGift(ev.user, ev.coins || 1, ev.gift || 'quà', ev.count || 1); break;
  }
}

// ---------------------------------------------------------------- voice / audio
const voiceQ = []; let speaking = false; const audio = new Audio();
function say(text, kind) {
  if (!cfg.voice.enabled || !text) return;
  const lang = isEN() ? 'en' : 'vi';
  if (kind === 'welcome') {
    const pend = voiceQ.filter(v => v.kind === 'welcome').length;
    if (pend >= cfg.voice.welcomeMaxPending) return;
    voiceQ.push({ text, kind, lang });
  } else {
    const idx = voiceQ.findIndex(v => v.kind === 'welcome');
    if (idx < 0) voiceQ.push({ text, kind, lang }); else voiceQ.splice(idx, 0, { text, kind, lang });
  }
  pumpVoice();
}
async function pumpVoice() {
  if (speaking || !voiceQ.length) return;
  speaking = true;
  const v = voiceQ.shift();
  try {
    if (v.lang && v.lang !== (isEN() ? 'en' : 'vi')) throw new Error('skip');      // queued before the language switch
    const vc = voiceCfg();
    const r = await API.tts(v.text, vc);
    const used = r ? (r.engine === 'edge' ? 'Microsoft ' + vc.voice : r.engine === 'google' ? (isEN() ? 'Google English' : 'Google Tiếng Việt') : (isEN() ? 'Windows English' : 'Windows')) : '-';
    if (used !== lastVoiceUsed) { lastVoiceUsed = used; log('🔊 Giọng đang đọc: ' + used); }
    if (isEN() && r && r.engine && r.engine !== 'edge') {
      // exe's Google fallback is hard-wired to Vietnamese → speak English via Google en / system en voice instead
      duckMusic(true);
      if (!(await playGoogleEN(v.text))) await speakSystem(v.text);
    } else if (r && r.b64) {
      audio.src = 'data:' + r.mime + ';base64,' + r.b64;
      audio.volume = clamp(cfg.voice.volume, 0, 1);
      duckMusic(true);
      await audio.play();
      await new Promise(res => { audio.onended = res; audio.onerror = res; setTimeout(res, 20000); });
    } else if (r && r.system) {
      duckMusic(true);
      if (!(isEN() && await playGoogleEN(r.text))) await speakSystem(r.text);
    }
  } catch (e) { if (e.message !== 'skip') log('Voice lỗi: ' + e.message); }
  duckMusic(false);
  speaking = false;
  setTimeout(pumpVoice, 150);
}
let lastVoiceUsed = '';
function speakSystem(text) {
  if (!('speechSynthesis' in window)) return Promise.resolve(false);
  const u = new SpeechSynthesisUtterance(text); u.lang = isEN() ? 'en-US' : 'vi-VN'; u.volume = cfg.voice.volume; u.rate = 1 + (cfg.voice.rate || 0) / 100;
  const vv = speechSynthesis.getVoices().find(x => (isEN() ? /^en/i : /vi/i).test(x.lang)); if (vv) u.voice = vv;
  return new Promise(res => { u.onend = () => res(true); u.onerror = () => res(false); speechSynthesis.speak(u); setTimeout(() => res(true), 20000); });
}
async function playGoogleEN(text) {
  const parts = []; let cur = '';
  for (const w of String(text).replace(/[^\p{L}\p{N}\s.,!?'-]/gu, ' ').split(/\s+/)) { if (!w) continue; if ((cur + ' ' + w).length > 180) { parts.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) parts.push(cur);
  for (const p of parts) {
    const ok = await new Promise(res => {
      audio.src = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=' + encodeURIComponent(p);
      audio.volume = clamp(cfg.voice.volume, 0, 1);
      audio.onended = () => res(true); audio.onerror = () => res(false);
      audio.play().catch(() => res(false)); setTimeout(() => res(true), 20000);
    });
    if (!ok) return false;
  }
  return parts.length > 0;
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
// ---------------------------------------------------------------- scene (ảnh cận cảnh)
function kissLayout(p, side) {
  const K = cfg.kiss, ch = CHARS[p.char % CHARS.length];
  const ak = ch.kiss.a, s = K.charH / (ak.bottom - ak.top);
  const cx = WW / 2;
  const lipOff = (ak.lipX - ak.feetX) * s;
  const lipYoff = (ak.bottom - ak.lipY) * s;
  const feetX = side === 'L' ? cx - K.lipGap / 2 - lipOff : cx + K.lipGap / 2 + lipOff;
  return { feetX, lipY: K.feetY - lipYoff, s };
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
function guideVars() {
  const v = {};
  cfg.tiers.forEach((t, i) => { v['t' + (i + 1)] = t.coins; v['l' + (i + 1)] = tierLabel(t); });
  return v;
}

function updScene(dt) {
  const T = cfg.timing, K = cfg.kiss;
  if (!cur) {
    if (!QUEUE.length) return;
    cur = { a: QUEUE.shift(), b: null, phase: 'enter', t: 0, aT: 0, bT: 0, tier: 0 };
    sfx('fly');
  }
  const C = cur; C.t += dt;
  if (C.phase === 'enter') {
    C.aT += dt; if (C.b) C.bT += dt;
    if (!C.b && QUEUE.length && C.aT > .35) { C.b = QUEUE.shift(); C.bT = 0; sfx('fly'); }
    if (C.b && C.aT >= T.approachSec && C.bT >= T.approachSec + (T.pauseSec ?? .5)) {
      C.phase = 'kiss'; C.t = 0; C.k2 = false; C.tier = Math.max(C.a.tier, C.b.tier);
      sfx('kiss');
      heartLayer = true;
      const la = kissLayout(C.a, 'L');
      for (let i = 0; i < 10; i++) spawnHeart(WW / 2, la.lipY, true, true);
      spawnOrbitHearts(WW / 2, la.lipY + 120, K.hearts);
      heartLayer = false;
      say(tpl(voiceCfg().congratsTpl, { a: speakName(C.a.name), b: speakName(C.b.name) }), 'congrats');
    }
  } else if (C.phase === 'kiss') {
    if (C.t > 1.6 && !C.k2) { C.k2 = true; sfx('kiss'); }
    if (Math.random() < dt * 3) { const la = kissLayout(C.a, 'L'); spawnHeart(WW / 2 + rand(-30, 30), la.lipY - 20, false, Math.random() < .3); }
    if (C.t >= T.kissSec) {
      const tier = cfg.tiers[C.tier - 1];
      for (let i = hearts.length - 1; i >= 0; i--) if (hearts[i].orbit) hearts.splice(i, 1);
      if (C.tier && tier) {
        C.phase = 'showcase'; C.t = 0; C.sp = false; sfx('fanfare');
        say(tpl(voiceCfg().donorTpl, { a: speakName(C.a.name), b: speakName(C.b.name), frame: tierLabel(tier) }), 'congrats');
      } else { C.phase = 'exit'; C.t = 0; C.from = 'kiss'; }
    }
  } else if (C.phase === 'showcase') {
    if (C.t > .9 && !C.sp) { C.sp = true; sfx('sparkle'); for (let i = 0; i < 12; i++) spawnHeart(WW / 2, K.frameY - 260, true, true); }
    if (Math.random() < dt * 10) sparkles.push({ x: WW / 2 + rand(-K.frameW / 2, K.frameW / 2), y: K.frameY + rand(-280, 280), t: 0 });
    if (C.t >= T.showcaseSec) { C.phase = 'exit'; C.t = 0; C.from = 'showcase'; }
  } else if (C.phase === 'exit') {
    if (C.t >= (T.exitSec || .9)) {
      for (const p of [C.a, C.b]) { doneAt.set(p.id, Date.now()); KNOWN.delete(p.id); }
      kissCount++; cur = null; sparkles.length = 0;
      for (let i = hearts.length - 1; i >= 0; i--) if (hearts[i].orbit) hearts.splice(i, 1);
    }
  }
  for (let i = sparkles.length - 1; i >= 0; i--) { sparkles[i].t += dt; if (sparkles[i].t > .8) sparkles.splice(i, 1); }
}

function standX(p, side) { return kissLayout(p, side).feetX + (side === 'L' ? -(cfg.kiss.standGap || 40) : (cfg.kiss.standGap || 40)); }
function drawStanding(p, side, k, t) {
  const K = cfg.kiss, sx = side === 'L' ? K.leftStartX : K.rightStartX;
  const x = lerp(sx, standX(p, side), ease(clamp(k, 0, 1)));
  const walking = k < 1, bob = walking ? Math.abs(Math.sin(t * 9 + (side === 'L' ? 0 : 1))) * 10 : Math.sin(t * 2) * 2;
  const alpha = clamp(k * 3, 0, 1);
  ctx.fillStyle = `rgba(40,10,20,${.25 * alpha})`; ctx.beginPath(); ctx.ellipse(x, K.feetY, 70, 14, 0, 0, 7); ctx.fill();
  drawPerson(p, x, K.feetY - bob, K.charH * 0.95, 'stand', false, alpha);
  ctx.globalAlpha = alpha; drawNameTag(p, x, K.feetY - K.charH - 30, 30); ctx.globalAlpha = 1;
}
// ---- camera zoom vào 2 khuôn mặt khi hôn
let zoomK = 0;                                        // 0 = toàn cảnh, 1 = zoom hết cỡ
function zoomCfg() { return Object.assign({ enable: true, scale: 1.8, inSec: .8, outSec: .7, screenY: 760 }, (cfg.kiss || {}).zoom || {}); }
function updZoom(dt) {
  const Z = zoomCfg(), T = cfg.timing;
  let target = 0;
  if (Z.enable && cur && cur.phase === 'kiss') target = cur.t < T.kissSec - Z.outSec ? 1 : 0;
  const sp = 1 / Math.max(.1, target > zoomK ? Z.inSec : Z.outSec);
  zoomK = target > zoomK ? Math.min(target, zoomK + dt * sp) : Math.max(target, zoomK - dt * sp);
}
function drawScene() {
  const Z = zoomCfg(), e = ease(zoomK);
  ctx.save();
  if (e > 0 && cur && cur.b) {
    const la = kissLayout(cur.a, 'L'), lb = kissLayout(cur.b, 'R');
    const fx = WW / 2, fy = (la.lipY + lb.lipY) / 2, s = lerp(1, Z.scale, e), sy = lerp(fy, Z.screenY, e);
    ctx.translate(WW / 2, sy); ctx.scale(s, s); ctx.translate(-fx, -fy);
  }
  drawSceneWorld();
  drawHearts(true); drawHearts(false);
  ctx.restore();
  drawQueueBoard();
  drawRibbon();
}
function drawSceneWorld() {
  ctx.drawImage(IMG.kiss, 0, 0, WW, WH);
  const t = now(), K = cfg.kiss, T = cfg.timing;
  if (!cur) {
    ctx.globalAlpha = .75 + Math.sin(t * 2) * .2;
    drawPixelHeart(WW / 2, 960, 9, '#ff6fa0');
    txt(S('queueEmpty'), WW / 2, 1060, 34, '#fff', 'center', '#4a0f24', 7);
    ctx.globalAlpha = 1;
    return;
  }
  const C = cur;
  if (C.phase === 'enter') {
    drawStanding(C.a, 'L', C.aT / T.approachSec, t);
    if (C.b) drawStanding(C.b, 'R', C.bT / T.approachSec, t);
    else {                                                           // ô trống bên phải: chờ người tiếp theo
      const x = WW - standX(C.a, 'L'), pulse = .55 + Math.sin(t * 3) * .25;
      ctx.globalAlpha = pulse;
      drawPixelHeart(x, K.feetY - K.charH * .55, 10, '#ffb3d1');
      txt('?', x, K.feetY - K.charH * .55 + 4, 54, '#fff', 'center', '#4a0f24', 6);
      ctx.globalAlpha = 1;
      if (C.aT > T.approachSec) {
        ctx.globalAlpha = .9 + Math.sin(t * 4) * .1;
        txt(S('waitMatch'), WW / 2, K.feetY - K.charH - 110, 34, '#ffe0ec', 'center', '#4a0f24', 7);
        ctx.globalAlpha = 1;
      }
    }
  } else if (C.phase === 'kiss' || (C.phase === 'exit' && C.from === 'kiss')) {
    const ex = C.phase === 'exit' ? ease(clamp(C.t / (T.exitSec || .9), 0, 1)) : 0;
    const lean = (1 - easeOutBack(clamp(C.t / .45, 0, 1))) * 24 * (C.phase === 'kiss' ? 1 : 0);
    const pulse = C.phase === 'kiss' ? Math.sin(C.t * 5) * 2 : 0;
    for (const [p, side] of [[C.a, 'L'], [C.b, 'R']]) {
      const lay = kissLayout(p, side);
      const off = (side === 'L' ? -1 : 1) * (lean + pulse + ex * 500);
      ctx.fillStyle = `rgba(40,10,20,${.25 * (1 - ex)})`; ctx.beginPath(); ctx.ellipse(lay.feetX + off, K.feetY, 70, 14, 0, 0, 7); ctx.fill();
      drawPerson(p, lay.feetX + off, K.feetY, K.charH, 'kiss', side === 'R', 1 - ex);
    }
    ctx.globalAlpha = 1 - ex; drawPairNames(C, K.feetY + 28, 720); ctx.globalAlpha = 1;
  } else {                                                            // showcase (+ exit from showcase)
    const ex = C.phase === 'exit' ? ease(clamp(C.t / (T.exitSec || .9), 0, 1)) : 0;
    const st = C.phase === 'showcase' ? C.t : 99;
    const tier = cfg.tiers[C.tier - 1], fr = tier && IMG.frames[tier.frame];
    const k = clamp(st / 1.1, 0, 1), e = easeOutBack(k);
    ctx.globalAlpha = 1 - ex;
    if (fr) {
      const fw = K.frameW * lerp(.3, 1, e), fh = fw * fr.height / fr.width;
      const fy = lerp(-300, K.frameY, ease(k)) + Math.sin(t * 2) * 6;
      ctx.save(); ctx.globalAlpha = 1 - ex; ctx.translate(WW / 2, fy); ctx.rotate((1 - k) * -0.5);
      ctx.shadowColor = 'rgba(255,220,120,.8)'; ctx.shadowBlur = 40 * k;
      ctx.drawImage(fr, -fw / 2, -fh / 2, fw, fh);
      ctx.restore();
    }
    const hk = clamp(st / .6, 0, 1), hop = Math.sin(hk * Math.PI) * 60, H = K.showcaseCharH;
    const pa = CHARS[C.a.char % CHARS.length].stand.a, pb = CHARS[C.b.char % CHARS.length].stand.a;
    const wa = (H / (pa.bottom - pa.top)) * (pa.w / 2), wb = (H / (pb.bottom - pb.top)) * (pb.w / 2);
    const xa = WW / 2 - K.showcaseGap / 2 - wa * .8, xb = WW / 2 + K.showcaseGap / 2 + wb * .8;
    const la = kissLayout(C.a, 'L'), lb = kissLayout(C.b, 'R');
    for (const [p, x0, x1] of [[C.a, la.feetX, xa], [C.b, lb.feetX, xb]]) {
      const x = lerp(x0, x1, ease(hk)), y = lerp(K.feetY, K.showcaseFeetY, ease(hk)) - hop;
      ctx.fillStyle = `rgba(40,10,20,${.25 * (1 - ex)})`; ctx.beginPath(); ctx.ellipse(x, K.showcaseFeetY, 60, 12, 0, 0, 7); ctx.fill();
      drawPerson(p, x, y + Math.sin(t * 3 + x) * 3, H, 'stand', false, 1 - ex);
    }
    ctx.globalAlpha = 1 - ex;
    drawPairNames(C, K.showcaseFeetY + 56, 740);
    ctx.globalAlpha = 1;
    for (const s of sparkles) drawSparkle(s.x, s.y, 10 * Math.sin(s.t / .8 * Math.PI), Math.sin(s.t / .8 * Math.PI));
  }
}
function drawRibbon() {
  const C = cur, K = cfg.kiss;
  if (!C) return;
  const tier = C.tier && cfg.tiers[C.tier - 1];
  const title = (C.phase === 'showcase' || (C.phase === 'exit' && C.from === 'showcase')) && tier ? '🎉 ' + tierLabel(tier) + ' 🎉' : ((isEN() ? EN().panelTitle : K.panelTitle) || S('panelTitle'));
  const R = cfg.ribbon || {}, ty = R.y ?? 92;
  ctx.font = '800 34px B2, sans-serif';
  const tw = Math.min(WW - 80, ctx.measureText(title).width + 70), cx = WW / 2;
  ctx.fillStyle = '#4a0f24'; rrect(cx - tw / 2 - 4, ty - 30, tw + 8, 60, 30); ctx.fill();
  ctx.fillStyle = '#b3123f'; rrect(cx - tw / 2, ty - 26, tw, 52, 26); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffd34d'; ctx.stroke();
  txt(fitText(title, 32, tw - 30), cx, ty + 1, 32, '#ffe066', 'center', '#4a0f24', 7);
}

// bảng hàng chờ nhỏ (góc trên trái)
function drawQueueBoard() {
  const B = cfg.queueBoard || {}; if (B.show === false) return;
  const x = B.x ?? 16, y = B.y ?? 140, w = B.w ?? 330, rows = B.rows ?? 7, rh = B.rowH ?? 40, fs = B.fontSize ?? 22;
  const n = Math.min(rows, QUEUE.length), h = 52 + Math.max(1, n) * rh + (QUEUE.length > rows ? rh * .8 : 0) + 10;
  ctx.fillStyle = 'rgba(60,8,30,.62)'; rrect(x, y, w, h, 16); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,211,77,.85)'; ctx.stroke();
  txt(S('queueTitle') + ' · ' + QUEUE.length, x + w / 2, y + 26, 24, '#ffe066', 'center', '#4a0f24', 5);
  if (!QUEUE.length) { txt(S('queueEmptyShort'), x + w / 2, y + 52 + rh / 2, fs * .9, 'rgba(255,240,230,.75)', 'center', '#2a0712', 3); return; }
  for (let i = 0; i < n; i++) {
    const p = QUEUE[i], ry = y + 52 + i * rh + rh / 2;
    txt(String(i + 1), x + 20, ry, fs * .9, '#ffd36b', 'center', '#2a0712', 3);
    drawAvatar(p, x + 50, ry, rh * .38);
    const col = p.tier ? ['#ff9ec4', '#8fd0ff', '#ff8a8a', '#ffd34d'][(p.tier - 1) % 4] : '#fff6e0';
    txt(fitText(shortName(p.name, 18), fs, w - 120), x + 74, ry + 1, fs, col, 'left', '#2a0712', 3.5);
    if (p.coins) txt('💎' + p.coins, x + w - 12, ry + 1, fs * .8, '#ffe066', 'right', '#2a0712', 3);
  }
  if (QUEUE.length > rows) txt(S('moreQueue', { n: QUEUE.length - rows }), x + w / 2, y + 52 + n * rh + rh * .4, fs * .85, '#ffd36b', 'center', '#2a0712', 3);
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
  const C = C0;
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
  const h = T.h || 44, fs = T.fontSize || 24, y = T.y || 0;
  const text = tpl(raw, guideVars());
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
  let y = (cfg.toastY || 1400);
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
  updScene(dt);
  updHearts(dt);
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  updZoom(dt);
  drawScene();
  drawChat();
  drawToasts(dt);
  drawTicker(dt);
  stateT += dt; persistT += dt;
  if (stateT > .5) { stateT = 0; pushState(); }
  if (persistT > 3) { persistT = 0; persist(); }
  requestAnimationFrame(frame);
}
const lite = p => ({ id: p.id, name: p.name, avatar: p.avatar, coins: p.coins, tier: p.tier, char: p.char, prio: p.prio || 0 });
function pushState() {
  API.sendState({ phase: cur && cur.phase, pair: cur ? [lite(cur.a), cur.b ? lite(cur.b) : null] : null, Q: QUEUE.slice(0, 200).map(lite), queueLen: QUEUE.length,
    done: kissCount, voiceQ: voiceQ.length });
}
function persist() {
  const q = (cur ? [cur.a, cur.b].filter(Boolean) : []).concat(QUEUE);    // the pair on stage goes back to the front on restart
  API.persistState({ v: 3, queue: q.map(lite), done: [...doneAt.entries()].filter(([, t]) => Date.now() - t < 6 * 3600e3), followed: [...followed].slice(-5000), seq, kissCount });
}
function restore(st) {
  if (!st || st.v !== 3) return;
  for (const o of st.queue || []) {
    const p = newPerson(o);
    Object.assign(p, { char: o.char ?? p.char, coins: o.coins || 0, prio: o.prio || 0 });
    p.tier = tierFor(p.coins); if (p.coins) p.donorSeq = p.seq;
    KNOWN.set(p.id, p); QUEUE.push(p);
  }
  (st.done || []).forEach(([k, v]) => doneAt.set(k, v));
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
  const used = new Set([...KNOWN.values()].map(p => p.name));
  let n = fakeName(), tries = 0;
  while (used.has(n) && tries++ < 20) n = fakeName();
  if (used.has(n)) n = n + ' ' + fakeN;
  return { id: 'test_' + fakeN + '_' + Date.now(), name: n, avatar: fakeAvatarFromStore() || fakeAvatar(n) };
}
const pick = arr => arr[(Math.random() * arr.length) | 0];
const asUser = p => ({ id: p.id, name: p.name, avatar: p.avatar });
function handleCmd(c) {
  switch (c.type) {
    case 'fake': for (let i = 0; i < (c.n || 1); i++) setTimeout(() => handleEvent({ type: 'join', user: fakeUser() }), i * 150); break;
    case 'fakeChat': for (let i = 0; i < (c.n || 1); i++) handleEvent({ type: 'chat', user: fakeUser(), text: c.text || pick(isEN() ? ['Let me kiss on the bridge 😍', 'So pretty!', 'Me next!', 'Who wants to match with me?', 'Kissing Island 💕'] : ['Cho mình lên cầu với 😍', 'Đẹp quá', 'Tới lượt mình chưa', 'Ai ghép với mình đi', 'Phú Quốc đỉnh quá']) }); break;
    case 'fakeFollow': handleEvent({ type: 'follow', user: fakeUser() }); break;
    case 'fakeShare': handleEvent({ type: 'share', user: fakeUser() }); break;
    case 'fakeGift': {
      const u = c.toExisting && QUEUE.length ? asUser(QUEUE[QUEUE.length - 1]) : fakeUser();
      handleEvent({ type: 'gift', user: u, coins: c.coins || 1, gift: isEN() ? (c.coins >= 100 ? 'Wedding Ring' : c.coins >= 10 ? 'Bouquet' : c.coins >= 5 ? 'Cotton Candy' : 'Rose') : (c.coins >= 100 ? 'Nhẫn cưới' : c.coins >= 10 ? 'Bó hoa' : c.coins >= 5 ? 'Kẹo bông' : 'Hoa hồng'), count: 1 });
      break;
    }
    case 'remove': { const i = QUEUE.findIndex(p => p.id === c.id); if (i >= 0) { KNOWN.delete(c.id); QUEUE.splice(i, 1); } break; }
    case 'promote': { const p = QUEUE.find(p => p.id === c.id); if (p) { p.prio = ++seq; sortQueue(); } break; }
    case 'clear': QUEUE.forEach(p => KNOWN.delete(p.id)); QUEUE.length = 0; break;
    case 'clearDone': doneAt.clear(); followed.clear(); break;
    case 'skip':
      if (!cur) break;
      if (!cur.b) { KNOWN.delete(cur.a.id); cur = null; }
      else if (cur.phase !== 'exit') { cur.from = cur.phase === 'showcase' ? 'showcase' : 'kiss'; cur.phase = 'exit'; cur.t = 0; }
      break;
    case 'say': say(c.text || (isEN() ? 'Congratulations Bella and Kevin, you two look perfect together!' : 'Chúc mừng Ngọc Anh và Minh Tuấn, chúc hai bạn trăm năm hạnh phúc!'), 'congrats'); break;
    case 'sfx': sfx(c.name); break;
    case 'event': handleEvent(c.ev); break;
  }
}

// v9: bản đơn giản — chỉ cảnh cận, 1 hàng chờ, cặp đôi lần lượt
const OLD_TEXT = [
  'Chào mừng {name}! Bình luận để lên cầu, thả tim để bước tới nhé', 'Chào mừng {name} đến cầu hôn Phú Quốc, bạn xếp hàng bên {side}', 'Chào mừng {name} đến cầu hôn Phú Quốc',
  'Cảm ơn {name} đã tặng {gift}! Tốc độ tăng gấp {speed} lần.', 'Cảm ơn {name} đã tặng {gift}! Bạn được lên đầu hàng chờ.',
  'Welcome {name}! Comment to get on the bridge, then send likes to walk.', 'Thank you {name} for the {gift}! You are now {speed} times faster.'
];
const RULES_V9 = {
  schema: 9,
  join: { onMember: true, onComment: true, onFollow: true, onShare: true, onLike: false, rejoinMinutes: 10, maxQueue: 300 },
  timing: { approachSec: 1.4, pauseSec: .5, kissSec: 5, showcaseSec: 6, exitSec: .9 },
  kiss: { standGap: 40 },
  ticker: { y: 0 },
  ribbon: { y: 92 },
  queueBoard: { show: true, x: 16, y: 140, w: 330, rows: 7, rowH: 40, fontSize: 22 },
  chat: { x: 610, y: 140, w: 320, h: 360 }
};
async function migrateV9() {
  const patch = JSON.parse(JSON.stringify(RULES_V9));
  const v = cfg.voice || {}, ev = (cfg.en && cfg.en.voice) || {};
  patch.voice = {};
  if (!v.welcomeTpl || OLD_TEXT.includes(v.welcomeTpl)) patch.voice.welcomeTpl = 'Chào mừng {name}! Bạn đã vào hàng chờ lên cầu hôn.';
  if (!v.giftTpl || OLD_TEXT.includes(v.giftTpl)) patch.voice.giftTpl = 'Cảm ơn {name} đã tặng {gift}! Bạn được lên đầu hàng chờ.';
  patch.en = { voice: {} };
  if (!ev.welcomeTpl || OLD_TEXT.includes(ev.welcomeTpl)) patch.en.voice.welcomeTpl = EN_DEFAULTS.voice.welcomeTpl;
  if (!ev.giftTpl || OLD_TEXT.includes(ev.giftTpl)) patch.en.voice.giftTpl = EN_DEFAULTS.voice.giftTpl;
  if (!cfg.en || !cfg.en.ticker || /HOW TO PLAY: Join the LIVE to enter the plaza/.test(cfg.en.ticker)) patch.en.ticker = EN_DEFAULTS.ticker;
  cfg = await API.setSettings(patch);
  log('Đã chuyển sang bản đơn giản: chỉ cảnh cận + 1 hàng chờ');
}

// ---------------------------------------------------------------- boot
(async function boot() {
  cfg = await API.getSettings();
  if ((cfg.schema || 0) < 9) await migrateV9();
  if ((cfg.schema || 0) < 10) cfg = await API.setSettings({ schema: 10, kiss: { zoom: { enable: true, scale: 1.8, inSec: .8, outSec: .7, screenY: 760 } } });
  await Promise.all(['800 20px B2', '20px PX'].map(f => document.fonts.load(f, 'Aàáạ')));
  await loadAssets();
  restore(await API.restoreState());
  API.onSettings(s => { if ((s.lang || 'vi') !== (cfg.lang || 'vi')) { voiceQ.length = 0; tickerX = null; } cfg = s; QUEUE.forEach(p => p.tier = tierFor(p.coins)); applyMusic(); });
  API.onLiveEvent(handleEvent);
  API.onCmd(handleCmd);
  applyMusic();
  document.getElementById('loading').remove();
  addEventListener('click', () => { ac(); music.play().catch(() => {}); });
  requestAnimationFrame(frame);
  log('Màn hình live đã sẵn sàng');
})().catch(e => { document.getElementById('loading').textContent = 'Lỗi: ' + e.message; log('Lỗi khởi động: ' + e.stack); });
