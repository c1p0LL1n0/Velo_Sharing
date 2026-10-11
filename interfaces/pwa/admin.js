'use strict';
/* admin.js — панель администратора 42 Campus Bike */

const BACKEND = localStorage.getItem('velo_backend_url') || 'http://localhost:3000';
const PWA_URL = 'https://velo.vercel.app';
const SVC = '42424242-1111-1111-1111-424242424242';
const BID_UUID = '42424242-4444-4444-4444-424242424242';

let token = localStorage.getItem('velo_admin_token') || '';
let bleDev = null, bleSrv = null, bikeIdChar = null;
let discoveredId = '';

function msg(id, cls, text) {
  const el = document.getElementById(id);
  el.className = 'msg ' + (cls === 'ok' ? 'm-ok' : cls === 'err' ? 'm-err' : 'm-info');
  el.textContent = text;
}

/* OAuth */
function login() {
  const uid = 'YOUR_INTRA_UID';
  const uri = encodeURIComponent(window.location.href);
  window.location.href = 'https://api.intra.42.fr/oauth/authorize?client_id=' + uid + '&redirect_uri=' + uri + '&response_type=code';
}

/* OAuth callback */
(async function() {
  const code = new URLSearchParams(window.location.search).get('code');
  if (code) {
    const r = await fetch(BACKEND + '/api/auth/callback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const d = await r.json();
    if (d.access_token) { token = d.access_token; localStorage.setItem('velo_admin_token', token); }
    window.history.replaceState({}, '', window.location.pathname);
  }
  if (token) document.getElementById('btn-login').textContent = '✅ Авторизован';
})();

/* BLE Connect */
document.getElementById('btn-ble').onclick = async () => {
  if (!navigator.bluetooth) { msg('add-msg', 'err', 'Нужен Chrome (Android/macOS)'); return; }
  const btn = document.getElementById('btn-ble');
  btn.disabled = true; btn.textContent = '⏳ Поиск...';
  try {
    bleDev = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SVC] }], optionalServices: [SVC]
    });
    bleSrv = await bleDev.gatt.connect();
    const svc = await bleSrv.getPrimaryService(SVC);
    bikeIdChar = await svc.getCharacteristic(BID_UUID);
    const val = await bikeIdChar.readValue();
    discoveredId = new TextDecoder().decode(val);
    document.getElementById('new-id').value = discoveredId;
    document.getElementById('btn-reg').disabled = false;
    btn.textContent = '🟢 ' + discoveredId;
    msg('add-msg', 'ok', '✅ Найден: ' + discoveredId);
  } catch (e) {
    btn.disabled = false; btn.textContent = '🔵 Подключить по BLE';
    msg('add-msg', 'err', '❌ ' + e.message);
  }
};

/* Register */
document.getElementById('btn-reg').onclick = async () => {
  if (!token) { alert('Сначала войдите!'); return; }
  const bid = document.getElementById('new-id').value.trim();
  if (!bid) return;
  try {
    const r = await fetch(BACKEND + '/api/admin/register-bike', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ bike_id: bid })
    });
    const d = await r.json();
    if (d.success) {
      msg('add-msg', 'ok', '✅ Зарегистрирован: ' + bid);
      document.getElementById('btn-reg').disabled = true;
      showQR(bid); loadBikes();
    } else msg('add-msg', 'err', '❌ ' + (d.error || 'Ошибка'));
  } catch (e) { msg('add-msg', 'err', '❌ ' + e.message); }
};

/* QR Popup */
function showQR(bikeId) {
  const popup = document.getElementById('qr-popup');
  const card = document.getElementById('qr-card');
  const url = PWA_URL + '?bike=' + encodeURIComponent(bikeId);
  card.innerHTML = '<h3>🚲 ' + bikeId + '</h3><p>' + url + '</p><canvas></canvas>' +
    '<br><button class="btn-c" style="width:auto;margin:10px;" onclick="window.print()">🖨️ Печать</button> ' +
    '<button class="btn-d" style="width:auto;" onclick="document.getElementById(\'qr-popup\').classList.remove(\'show\')">✖</button>';
  popup.classList.add('show');
  QRCode.toCanvas(card.querySelector('canvas'), url, { width: 200, margin: 2, color: { dark: '#000', light: '#fff' } });
}

/* Load list */
async function loadBikes() {
  const list = document.getElementById('list');
  try {
    const r = await fetch(BACKEND + '/api/bikes');
    const d = await r.json();
    if (d.bikes.length === 0) {
      list.innerHTML = '<p style="color:#888;text-align:center;padding:40px;">Нет велосипедов. Добавьте первый!</p>';
      return;
    }
    list.innerHTML = d.bikes.map(b =>
      '<div class="bike-row"><span class="n">🚲 ' + b.bike_id + '</span>' +
      '<span class="st ' + (b.status === 'free' ? 's-f' : 's-r') + '">' +
      (b.status === 'free' ? '🟢 Свободен' : '🔴 Занят') + '</span>' +
      (b.user ? '<span class="u">👤 ' + b.user + '</span>' : '') +
      '<span class="btns"><button class="btn-c" onclick="showQR(\'' + b.bike_id + '\')">📱 QR</button></span></div>'
    ).join('');
  } catch (e) { list.innerHTML = '<p style="color:#e74c3c;">❌ Ошибка</p>'; }
}

document.getElementById('btn-login').onclick = login;
loadBikes();
setInterval(loadBikes, 10000);