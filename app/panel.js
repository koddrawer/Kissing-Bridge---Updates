'use strict';
const API = window.api;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
let S = null, frames = [];

const get = (o, k) => k.split('.').reduce((a, p) => a == null ? a : a[p], o);
function patchOf(k, v) { const o = {}; let c = o; const ps = k.split('.'); ps.forEach((p, i) => { if (i === ps.length - 1) c[p] = v; else c = c[p] = {}; }); return o; }
async function set(k, v) { S = await API.setSettings(patchOf(k, v)); }
function log(m) { const el = $('#log'); const t = new Date().toLocaleTimeString('vi-VN'); el.textContent += `[${t}] ${m}\n`; if (el.textContent.length > 20000) el.textContent = el.textContent.slice(-15000); el.scrollTop = el.scrollHeight; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// tabs
$$('#nav button').forEach(b => b.onclick = () => {
  $$('#nav button').forEach(x => x.classList.toggle('on', x === b));
  $$('section').forEach(s => s.classList.toggle('on', s.id === 't-' + b.dataset.t));
});

function fill() {
  $$('[data-k]').forEach(el => {
    const v = get(S, el.dataset.k);
    if (document.activeElement === el) return;
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
  });
  $$('[data-show]').forEach(el => el.textContent = get(S, el.dataset.show));
  if (document.activeElement !== $('#user')) $('#user').value = S.tiktokUser || '';
  if (document.activeElement !== $('#guide')) $('#guide').value = (S.boards.guideLines || []).join('\n');
  if (document.activeElement !== $('#pathL')) $('#pathL').value = JSON.stringify(S.bridge.leftPath);
  if (document.activeElement !== $('#pathR')) $('#pathR').value = JSON.stringify(S.bridge.rightPath);
  $('#musicName').textContent = S.music.file ? S.music.file.split(/[\\/]/).pop() : '(không có)';
  renderTiers();
  renderGiftBtns();
  renderSounds();
}
$$('[data-k]').forEach(el => {
  const ev = el.tagName === 'TEXTAREA' || el.type === 'text' ? 'change' : 'input';
  el.addEventListener(ev, () => {
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number' || el.type === 'range') v = parseFloat(v) || 0;
    set(el.dataset.k, v).then(() => $$(`[data-show="${el.dataset.k}"]`).forEach(x => x.textContent = v));
  });
});

function renderTiers() {
  const t = $('#tiers'); if (t.contains(document.activeElement)) return;
  t.innerHTML = '<tr><td class="hint">Mức</td><td class="hint">Từ (xu)</td><td class="hint">Tốc độ x</td><td class="hint">Hôn liền</td><td class="hint">Tên</td><td class="hint">Khung</td></tr>' +
    S.tiers.map((x, i) => `<tr><td>${i + 1}</td><td><input type="number" min="1" data-ti="${i}" data-f="coins" value="${x.coins}" style="width:60px"></td>
      <td><input type="number" min="1" step="0.5" data-ti="${i}" data-f="speed" value="${x.speed || 1}" style="width:55px"></td>
      <td><input type="number" min="0" data-ti="${i}" data-f="chain" value="${x.chain || 0}" style="width:50px" title="0 = không"></td>
      <td><input type="text" data-ti="${i}" data-f="label" value="${esc(x.label)}"></td>
      <td><select data-ti="${i}" data-f="frame">${frames.map(f => `<option ${f === x.frame ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></td></tr>`).join('');
  t.querySelectorAll('[data-ti]').forEach(el => el.onchange = () => {
    const tiers = JSON.parse(JSON.stringify(S.tiers));
    const f = el.dataset.f;
    tiers[el.dataset.ti][f] = f === 'coins' ? Math.max(1, parseInt(el.value) || 1) : f === 'speed' ? Math.max(1, parseFloat(el.value) || 1) : f === 'chain' ? Math.max(0, parseInt(el.value) || 0) : el.value;
    API.setSettings({ tiers }).then(s => S = s);
  });
}
const SOUNDS = [['join', '🔔 Tiếng vào (sân chờ)'], ['fly', '🕊 Bay lên cầu'], ['kiss', '💋 Tiếng hôn'], ['gift', '🎁 Tiếng nhận quà'], ['fanfare', '🖼 Tiếng khung'], ['poof', '💨 Rời cầu']];
function renderSounds() {
  const t = $('#sounds'); if (!t || t.contains(document.activeElement)) return;
  const F = (S.sfx && S.sfx.files) || {}, V = (S.sfx && S.sfx.vols) || {};
  t.innerHTML = SOUNDS.map(([k, label]) => `<tr><td style="min-width:150px">${label}</td>
    <td class="hint" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(F[k] || '')}">${F[k] ? esc(F[k].split(/[\\/]/).pop()) : 'mặc định'}</td>
    <td><button class="b s" data-snd-pick="${k}">Chọn file</button> <button class="b s" data-snd-def="${k}">Mặc định</button> <button class="b s" data-cmd='{"type":"sfx","name":"${k}"}'>▶</button></td>
    <td><input type="range" min="0" max="1.5" step="0.05" value="${V[k] ?? 1}" data-snd-vol="${k}" style="width:80px"></td></tr>`).join('');
  t.querySelectorAll('[data-snd-pick]').forEach(b => b.onclick = async () => { const f = await API.pickMusic(); if (f) { await set('sfx.files.' + b.dataset.sndPick, f); renderSounds(); } });
  t.querySelectorAll('[data-snd-def]').forEach(b => b.onclick = async () => { await set('sfx.files.' + b.dataset.sndDef, ''); renderSounds(); });
  t.querySelectorAll('[data-snd-vol]').forEach(r => r.onchange = () => set('sfx.vols.' + r.dataset.sndVol, parseFloat(r.value)));
}
function renderGiftBtns() {
  const mk = (ex) => S.tiers.map(t => `<button class="b" data-cmd='${JSON.stringify({ type: 'fakeGift', coins: t.coins, toExisting: ex })}'>🎁 ${t.coins} xu</button>`).join('');
  $('#giftBtns').innerHTML = mk(false); $('#giftBtns2').innerHTML = mk(true);
}

$('#guide').onchange = () => API.setSettings({ boards: { guideLines: $('#guide').value.split('\n').map(s => s.trim()).filter(Boolean) } }).then(s => S = s);
$('#btnPath').onclick = () => {
  try { const L = JSON.parse($('#pathL').value), R = JSON.parse($('#pathR').value); API.setSettings({ bridge: { leftPath: L, rightPath: R } }).then(s => { S = s; log('Đã lưu đường đi'); }); }
  catch (e) { alert('Sai định dạng JSON: ' + e.message); }
};
$$('[data-reset]').forEach(b => b.onclick = () => API.resetSettings(b.dataset.reset).then(s => { S = s; fill(); }));

// commands (delegated so dynamic buttons work)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cmd]'); if (!b) return;
  const c = b.dataset.cmd; API.cmd(c.startsWith('{') ? JSON.parse(c) : { type: c });
});
$('#btnSay').onclick = () => API.cmd({ type: 'say', text: $('#sayText').value });

// live
$('#btnConnect').onclick = () => API.connect($('#user').value.trim());
$('#btnDisconnect').onclick = () => API.disconnect();
$('#user').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnConnect').click(); });
API.onLiveStatus(st => { const el = $('#status'); el.textContent = st.text; el.className = 'status ' + st.state; log(st.text); });

// window
$$('[data-size]').forEach(b => b.onclick = () => { const [w, h] = b.dataset.size.split('x').map(Number); API.setSettings({ window: { width: w, height: h } }).then(s => S = s); });
$('#btnFull').onclick = () => API.fullscreen();
$('#btnReload').onclick = () => API.reloadStage();

// music
$('#btnMusic').onclick = async () => { const f = await API.pickMusic(); if (f) set('music.file', f).then(fill); };
$('#btnMusicOff').onclick = () => set('music.file', '').then(fill);

// update
$('#btnUpd').onclick = () => API.checkUpdate(false);
$('#btnUpdForce').onclick = () => { if (confirm('Tải lại toàn bộ file từ GitHub?')) API.checkUpdate(true); };
$('#btnUpdReset').onclick = () => { if (confirm('Xoá bản cập nhật, quay về bản gốc trong file cài?')) API.resetHot(); };
API.onUpdateStatus(m => { const el = $('#updStatus'); el.textContent = m.text; el.className = 'status ' + (m.error ? 'error' : m.ok ? 'connected' : ''); if (m.ok || m.error) log(m.text); });
$('#btnUD').onclick = () => API.openUserData();
$('#btnAD').onclick = () => API.openAppDir();

// queue view
function qList(el, arr, side) {
  const ic = { yard: '🏖', bridge: '🌉', center: '💗' };
  el.innerHTML = arr.slice(0, 80).map((p, i) => `<div class="${p.coins ? 'don' : ''}"><b>${ic[p.state] || ''}</b><span title="${esc(p.id)}">${esc(p.name)}${p.state === 'bridge' ? ' · ' + p.steps + ' bước' : ''}${p.coins ? ' · ' + p.coins + 'xu' : ''}${p.chain ? ' · 💋x' + p.chain : ''}</span>
    <button class="b s" data-cmd='${esc(JSON.stringify({ type: 'promote', id: p.id }))}'>⬆</button>
    <button class="b s" data-cmd='${esc(JSON.stringify({ type: 'move', id: p.id }))}'>⇄</button>
    <button class="b s" data-cmd='${esc(JSON.stringify({ type: 'remove', id: p.id }))}'>✕</button></div>`).join('') + (arr.length > 80 ? `<div class="hint">… và ${arr.length - 80} người nữa</div>` : '');
}
let lastQ = '';
API.onStageState(st => {
  $('#cL').textContent = st.L.length; $('#cR').textContent = st.R.length;
  if (st.counts) { $('#cYard').textContent = st.counts.yard; $('#cBridge').textContent = st.counts.bridge; $('#cCenter').textContent = st.counts.center; }
  $('#btnAutoLike').textContent = '❤ Tự thả tim: ' + (st.autoLike ? 'BẬT' : 'TẮT');
  $('#qLn').textContent = st.L.length; $('#qRn').textContent = st.R.length;
  $('#cDone').textContent = st.done; $('#cVoice').textContent = st.voiceQ;
  $('#pairNow').textContent = st.pair ? `💋 ${st.pair[0].name}  ❤  ${st.pair[1].name}${st.chain ? '  (hôn liền ' + st.chain[0] + '/' + st.chain[1] + ')' : ''}  (${st.phase})` : 'Đang chờ cặp tiếp theo…';
  const sig = JSON.stringify([st.L.map(p => p.id + p.state + p.steps + p.coins), st.R.map(p => p.id + p.state + p.steps + p.coins), (st.Y || []).map(p => p.id)]);
  if (sig !== lastQ && !$('#t-queue').matches(':hover')) { lastQ = sig; qList($('#qL'), st.L, 'L'); qList($('#qR'), st.R, 'R'); if (st.Y) { qList($('#qY'), st.Y, 'Y'); $('#qYn').textContent = st.counts ? st.counts.yard : st.Y.length; } }
});
// ---- kho avatar (thu nhỏ còn 96px, lưu localStorage dùng chung với màn live)
const AV_KEY = 'kbl.avatars', AV_MAX = 400;
function avList() { try { return JSON.parse(localStorage.getItem(AV_KEY) || '[]'); } catch { return []; } }
function avRender() {
  const l = avList();
  $('#avInfo').textContent = l.length ? `Đang có ${l.length} avatar — mỗi người chơi thử lấy ngẫu nhiên 1 ảnh (không trùng cho tới khi dùng hết).` : 'Chưa có avatar — người chơi thử sẽ dùng avatar vẽ sẵn.';
  $('#avThumbs').innerHTML = l.slice(0, 60).map(u => `<img src="${u}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid #5a3344">`).join('') + (l.length > 60 ? `<span class="hint">+${l.length - 60}</span>` : '');
}
function shrink(file) {
  return new Promise(res => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
      const k = Math.max(S / im.width, S / im.height), x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(im, (S - im.width * k) / 2, (S - im.height * k) / 2, im.width * k, im.height * k);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .85));
    };
    im.onerror = () => { URL.revokeObjectURL(url); res(null); };
    im.src = url;
  });
}
async function avAdd(files) {
  const imgs = [...files].filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name));
  if (!imgs.length) { log('Không tìm thấy ảnh trong lựa chọn'); return; }
  const cur = avList(), room = AV_MAX - cur.length;
  if (room <= 0) { log(`Kho đã đầy (${AV_MAX} ảnh) — xoá bớt trước`); return; }
  $('#avInfo').textContent = `Đang xử lý ${Math.min(imgs.length, room)} ảnh…`;
  const out = [];
  for (const f of imgs.slice(0, room)) { const d = await shrink(f); if (d) out.push(d); }
  try { localStorage.setItem(AV_KEY, JSON.stringify(cur.concat(out))); log(`Đã thêm ${out.length} avatar vào kho`); }
  catch (e) { log('Không lưu được kho avatar (quá lớn): ' + e.message); }
  avRender();
}
$('#btnAvDir').onclick = () => $('#avDir').click();
$('#btnAvFiles').onclick = () => $('#avFiles').click();
$('#avDir').onchange = e => { avAdd(e.target.files); e.target.value = ''; };
$('#avFiles').onchange = e => { avAdd(e.target.files); e.target.value = ''; };
$('#btnAvClear').onclick = () => { if (confirm('Xoá toàn bộ kho avatar?')) { localStorage.removeItem(AV_KEY); avRender(); } };
avRender();

API.onLog(log);
API.onSettings(s => { S = s; fill(); });

(async () => {
  S = await API.getSettings();
  frames = await API.frames();
  const info = await API.appInfo();
  $('#ver').textContent = `exe v${info.version} · nội dung v${info.appVersion}`;
  $('#paths').textContent = 'Dữ liệu: ' + info.userData + '\nApp: ' + info.appDir;
  fill();
  log('Bảng điều khiển sẵn sàng');
})();
