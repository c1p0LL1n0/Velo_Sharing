/**
 * app.js — PWA для 42 Campus Bike Sharing (часть 1)
 * Web Bluetooth API + Challenge-Response + 42 OAuth.
 *
 * Цикл аренды:
 *   1. BLE подключение к ESP32
 *   2. Чтение 32-байтного challenge
 *   3. Отправка challenge на бэкенд (с 42 OAuth токеном)
 *   4. Получение 64-байтной Ed25519 подписи
 *   5. Запись подписи в BLE → замок открывается
 *
 * Требуется: Chrome на Android/macOS (Web Bluetooth API)
 */

'use strict';

/* ===== UUIDs ===== */
const SERVICE_UUID = '42424242-1111-1111-1111-424242424242';
const CHALLENGE_CHAR_UUID = '42424242-2222-2222-2222-424242424242';
const SIGNATURE_CHAR_UUID = '42424242-3333-3333-3333-424242424242';
const BIKEID_CHAR_UUID = '42424242-4444-4444-4444-424242424242';
const BACKEND_URL = localStorage.getItem('velo_backend_url') || 'http://localhost:3000';

/* ===== Состояние ===== */
let bleDevice = null, bleServer = null;
let challengeChar = null, signatureChar = null, bikeIdChar = null;
let bikeId = 'Unknown', isConnected = false;
let accessToken = localStorage.getItem('velo_42_token') || null;

/* ===== DOM ===== */
const $ = id => document.getElementById(id);
const statusText = $('status-text'), progressText = $('progress-text');
const progressBar = $('progress-bar'), progressFill = $('progress-fill');
const btnConnect = $('btn-connect'), btnRent = $('btn-rent'), btnReset = $('btn-reset');
const bikeIdDisplay = $('bike-id-display'), connIndicator = $('connection-indicator');

/* ===== UI хелперы ===== */
function updateStatus(type, msg) {
    statusText.textContent = msg;
    const card = $('status-card');
    card.className = 'bg-gray-800 rounded-2xl p-6 mb-6 text-center';
    if (type === 'success') card.classList.add('border-2', 'border-green-500');
    if (type === 'error') card.classList.add('border-2', 'border-red-500');
    if (type === 'info') card.classList.add('border-2', 'border-42cyan');
}
function setProgress(pct, msg) {
    progressBar.classList.remove('hidden');
    progressFill.style.width = pct + '%';
    if (msg) progressText.textContent = msg;
}
function showRentBtn(v) {
    btnRent.classList.toggle('hidden', !v);
    btnReset.classList.toggle('hidden', !v);
    $('instructions').classList.toggle('hidden', v);
}
/* ===== BLE: Подключение — фильтруем ПО ТОЧНОМУ ИМЕНИ если есть в QR ===== */
async function connectToBike() {
    if (!navigator.bluetooth) {
        updateStatus('error', 'Web Bluetooth не поддерживается. Нужен Chrome на Android/macOS.');
        return;
    }

    /* Если PWA открыта из QR (?bike=42_CAMPUS_BIKE_A1B2) — фильтруем по имени */
    const params = new URLSearchParams(window.location.search);
    const targetBikeId = params.get('bike');

    updateStatus('info', targetBikeId
        ? '🔍 Ищу: ' + targetBikeId
        : '🔍 Поиск ближайшего велосипеда...');
    btnConnect.disabled = true;
    btnConnect.textContent = 'Поиск...';
    try {
        /* Фильтр: если знаем имя из QR — только этот велосипед.
         * Если QR нет (просто открыли PWA) — показываем все рядом. */
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: targetBikeId
                ? [{ name: targetBikeId }]           /* точное совпадение по имени */
                : [{ services: [SERVICE_UUID] }],    /* все велосипеды рядом */
            optionalServices: [SERVICE_UUID]
        });
        bikeId = targetBikeId || bleDevice.name || 'Unknown';
        bikeIdDisplay.textContent = 'ID: ' + bikeId;
        updateStatus('info', 'Найден: ' + bikeId + '. Подключаемся...');
        bleServer = await bleDevice.gatt.connect();
        setProgress(25, 'GATT подключен');
        const svc = await bleServer.getPrimaryService(SERVICE_UUID);
        setProgress(40, 'Сервис получен');
        challengeChar = await svc.getCharacteristic(CHALLENGE_CHAR_UUID);
        signatureChar = await svc.getCharacteristic(SIGNATURE_CHAR_UUID);

        /* Если нет QR — читаем ID из BLE характеристики */
        if (!targetBikeId) {
            bikeIdChar = await svc.getCharacteristic(BIKEID_CHAR_UUID);
            const idVal = await bikeIdChar.readValue();
            bikeId = new TextDecoder().decode(idVal);
            bikeIdDisplay.textContent = 'ID: ' + bikeId;
        }

        setProgress(60, 'ID: ' + bikeId);
        isConnected = true;
        connIndicator.classList.remove('hidden');
        btnConnect.textContent = 'Подключено';
        btnConnect.classList.add('bg-green-600');
        updateStatus('success', 'Велосипед готов к аренде!');
        showRentBtn(true);
        bleDevice.addEventListener('gattserverdisconnected', onDisconnect);
    } catch (e) {
        console.error('BLE error:', e);
        updateStatus('error', 'Ошибка: ' + e.message);
        btnConnect.disabled = false;
        btnConnect.textContent = 'Подключиться к велосипеду';
    }
}

function onDisconnect() {
    isConnected = false; bleServer = null;
    challengeChar = null; signatureChar = null;
    connIndicator.classList.add('hidden');
    btnConnect.textContent = 'Подключиться к велосипеду';
    btnConnect.disabled = false;
    btnConnect.classList.remove('bg-green-600');
    showRentBtn(false);
    setProgress(0, '');
    updateStatus('warn', 'Соединение потеряно. Подключитесь заново.');
}
/* ===== Цикл аренды: Challenge → Бэкенд → Signature → Замок ===== */
async function startRental() {
    if (!isConnected || !challengeChar || !signatureChar) {
        updateStatus('error', 'Нет соединения с велосипедом!'); return;
    }
    if (!accessToken) {
        updateStatus('warn', 'Требуется авторизация 42.'); redirectTo42OAuth(); return;
    }
    btnRent.disabled = true; btnRent.textContent = 'Аренда...';
    updateStatus('info', 'Читаю challenge...');
    setProgress(30, 'Чтение challenge');
    try {
        const cv = await challengeChar.readValue();
        const cb = new Uint8Array(cv.buffer);
        if (cb.length !== 32) throw new Error('Challenge не 32 байта: ' + cb.length);
        const chHex = Array.from(cb).map(b => b.toString(16).padStart(2,'0')).join('');
        setProgress(50, 'Challenge получен');
        updateStatus('info', 'Отправляю на сервер...');
        const resp = await fetch(BACKEND_URL + '/api/rent/challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
            body: JSON.stringify({ bike_id: bikeId, challenge_hex: chHex })
        });
        if (!resp.ok) {
            if (resp.status === 401) { redirectTo42OAuth(); return; }
            const err = await resp.json();
            throw new Error(err.message || 'HTTP ' + resp.status);
        }
        const data = await resp.json();
        setProgress(75, 'Подпись получена');
        updateStatus('info', 'Передаю подпись велосипеду...');
        const sigHex = data.signature_hex;
        if (sigHex.length !== 128) throw new Error('Подпись не 128 hex');
        const sigBytes = new Uint8Array(64);
        for (let i = 0; i < 64; i++) sigBytes[i] = parseInt(sigHex.substring(i*2,i*2+2), 16);
        await signatureChar.writeValue(sigBytes);
        setProgress(100, 'Передано!');
        updateStatus('success', 'ЗАМОК ОТКРЫТ! Можете ехать!');
        setTimeout(() => { btnRent.textContent = 'Арендовать'; btnRent.disabled = false; }, 3000);
    } catch (e) {
        console.error('Rental error:', e);
        updateStatus('error', 'Ошибка: ' + e.message);
        setProgress(0, ''); btnRent.textContent = 'Арендовать'; btnRent.disabled = false;
    }
}
/* ===== 42 OAuth ===== */
function redirectTo42OAuth() {
    const uid = 'YOUR_INTRA_UID'; /* Заменить! */
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    localStorage.setItem('velo_return_url', window.location.href);
    window.location.href = 'https://api.intra.42.fr/oauth/authorize?' +
        'client_id=' + uid + '&redirect_uri=' + redirectUri + '&response_type=code';
}

function handleOAuthCallback() {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) return false;
    fetch(BACKEND_URL + '/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
    }).then(r => r.json()).then(data => {
        if (data.access_token) {
            accessToken = data.access_token;
            localStorage.setItem('velo_42_token', accessToken);
            window.location.href = localStorage.getItem('velo_return_url') || '/';
        }
    }).catch(e => updateStatus('error', 'OAuth error: ' + e.message));
    return true;
}

function resetAll() {
    if (bleDevice && bleDevice.gatt.connected) bleDevice.gatt.disconnect();
    bleDevice = null; bleServer = null; challengeChar = null; signatureChar = null;
    isConnected = false; connIndicator.classList.add('hidden');
    btnConnect.textContent = 'Подключиться к велосипеду'; btnConnect.disabled = false;
    btnConnect.classList.remove('bg-green-600'); showRentBtn(false);
    setProgress(0, ''); updateStatus('info', 'Нажмите "Подключиться" для начала');
}

/* ===== Старт ===== */
if (!handleOAuthCallback()) {
    const p = new URLSearchParams(window.location.search);
    if (p.has('bike')) bikeId = p.get('bike');
    bikeIdDisplay.textContent = 'ID: ' + bikeId;
    btnConnect.addEventListener('click', connectToBike);
    btnRent.addEventListener('click', startRental);
    btnReset.addEventListener('click', resetAll);
    updateStatus('info', accessToken ? 'Авторизованы. Нажмите "Подключиться"' : 'Нужна авторизация 42');
}