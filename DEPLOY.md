# 🚀 DEPLOY.md — Полный гайд по развёртыванию 42 Campus Bike Sharing

> **Для кого:** для новичка. Каждый шаг расписан с командами и скриншотами того, что должно получиться.
> **Время:** ~4-6 часов на полное развёртывание с нуля.
> **Стоимость:** $0/мес (Free Tier Firebase + Railway/Render) + ~$10 на железо одного велосипеда.

---

## 📋 Оглавление

- [0. Что нужно иметь перед началом](#0-что-нужно-иметь-перед-началом)
- [1. Регистрация в облачных сервисах (бесплатно)](#1-регистрация-в-облачных-сервисах-бесплатно)
- [2. Клонирование проекта и установка зависимостей](#2-клонирование-проекта-и-установка-зависимостей)
- [3. Генерация Ed25519 ключей и настройка .env](#3-генерация-ed25519-ключей-и-настройка-env)
- [4. Настройка и деплой бэкенда](#4-настройка-и-деплой-бэкенда)
- [5. Настройка Slack-бота](#5-настройка-slack-бота)
- [6. Настройка и деплой PWA](#6-настройка-и-деплой-pwa)
- [7. Прошивка ESP32-C3 (железо велосипеда)](#7-прошивка-esp32-c3-железо-велосипеда)
- [8. Сборка железа (физический прототип)](#8-сборка-железа-физический-прототип)
- [9. Интеграционное тестирование (end-to-end)](#9-интеграционное-тестирование-end-to-end)
- [10. Часто задаваемые вопросы (FAQ)](#10-часто-задаваемые-вопросы-faq)

---

## 0. Что нужно иметь перед началом

### Железо (для прототипа)
| Позиция | Комментарий |
|---------|-------------|
| Компьютер (Windows/Mac/Linux) | Для разработки и прошивки ESP32 |
| ESP32-C3 DevKit | ~$3 на AliExpress |
| USB-C кабель (data-кабель!) | Обязательно с передачей данных, не только зарядка |
| Макетная плата + провода | Для прототипа (финальную плату — позже) |

### Аккаунты (все бесплатные)
| Сервис | Зачем | Ссылка |
|--------|-------|--------|
| **GitHub** | Хранение кода, деплой | [github.com](https://github.com) |
| **Railway** или **Render** | Хостинг бэкенда (бесплатно) | [railway.app](https://railway.app) / [render.com](https://render.com) |
| **Firebase** (Google) | Бесплатная NoSQL база данных | [console.firebase.google.com](https://console.firebase.google.com) |
| **42 Intra** | OAuth приложение для авторизации студентов | [profile.intra.42.fr](https://profile.intra.42.fr/oauth/applications) |
| **Slack** (опционально) | Slack Bot для аренды через чат | [api.slack.com/apps](https://api.slack.com/apps) |
| **Vercel** или **Netlify** | Хостинг PWA (бесплатно) | [vercel.com](https://vercel.com) / [netlify.com](https://netlify.com) |

### Софт (установить на компьютер)
| Программа | Версия | Как проверить |
|-----------|--------|---------------|
| **Node.js** | 18+ | `node -v` |
| **npm** | 9+ | `npm -v` |
| **Git** | любая | `git --version` |
| **VS Code** | любая | (или любой редактор) |
| **PlatformIO** (расширение VS Code) | последняя | Расширения → "PlatformIO IDE" |
| **nRF Connect** (на телефоне) | последняя | Для проверки BLE (Android/iOS)
---

## 1. Регистрация в облачных сервисах (бесплатно)

### 1.1 GitHub
1. Идите на [github.com](https://github.com) → Sign Up
2. Создайте аккаунт (email + пароль)
3. Создайте **новый репозиторий**: кнопка "+" → New Repository
4. Название: `velo-bike-sharing`
5. **НЕ** ставьте галочку "Private"
6. Нажмите "Create repository"
7. **Пока не клонируйте** — мы загрузим код позже.

### 1.2 Railway (хостинг бэкенда)
1. Идите на [railway.app](https://railway.app)
2. Нажмите "Start a New Project" → "Deploy from GitHub repo"
3. Авторизуйтесь через GitHub
4. Выберите репозиторий `velo-bike-sharing`
5. Railway автоматически найдёт `backend/package.json` и развернёт Node.js
6. Бесплатный лимит: 500 часов/мес + $5 кредита. Для нашего проекта хватает.

> Альтернатива (Render): [render.com](https://render.com) → New Web Service → Connect GitHub

### 1.3 Firebase (база данных)
1. Идите на [console.firebase.google.com](https://console.firebase.google.com)
2. "Add project" → название: `velo-bikes`
3. Выключите Google Analytics (нам не нужно)
4. Build → Firestore Database → "Create database"
5. Режим: "Start in test mode" (для MVP; потом переключите)
6. Регион: выберите ближайший (например, `europe-west3`)

### 1.4 42 Intra (OAuth приложение)
1. Идите на [profile.intra.42.fr/oauth/applications](https://profile.intra.42.fr/oauth/applications)
2. "Register a new application"
3. Заполните:
   - **Name:** Velo Bike Sharing
   - **Redirect URI:** `https://ВАШ-БЭКЕНД.railway.app/api/auth/callback`
     *(Пока напишите `http://localhost:3000/api/auth/callback` для тестов)*
4. Нажмите "Submit"
5. **Сохраните UID и SECRET!**

### 1.5 Slack (опционально)
1. [api.slack.com/apps](https://api.slack.com/apps) → "Create New App" → "From scratch"
2. Название: Velo Bike
3. Socket Mode → Enable Socket Mode
4. OAuth & Permissions → добавьте scope: `commands`, `chat:write`
5. Slash Commands → Create: `/rent`
6. Install to Workspace → сохраните токены

### 1.6 Vercel (хостинг PWA)
1. [vercel.com](https://vercel.com) → Sign up with GitHub
2. New Project → импортируйте репозиторий
3. Root Directory: `interfaces/pwa`
4. Framework: Other
5. Deploy → PWA будет доступен по URL типа `velo.vercel.app`

---

## 2. Клонирование проекта и установка зависимостей

Откройте терминал (PowerShell/Terminal/Bash) и выполните:

```bash
# Склонировать репозиторий (замените на свой URL)
git clone https://github.com/ВАШ-АККАУНТ/velo-bike-sharing.git
cd velo-bike-sharing

# Установить зависимости бэкенда
cd backend
npm install
cd ..

# Установить зависимости Slack-бота (опционально)
cd interfaces/slack-bot
npm install
cd ../..
```

**Проверка:** после `npm install` в папке `backend` должна появиться папка `node_modules`.

---

### 3.1 Сгенерировать ключи Ed25519

```bash
cd backend

# Создать .env из шаблона
cp .env.example .env

# Сгенерировать Ed25519 ключи
npx tsx src/crypto/keygen.ts
```

**Что вы увидите:**
```
╔══════════════════════════════════════════════╗
║   Ed25519 Key Pair for Velo Backend         ║
╠══════════════════════════════════════════════╣
║                                              ║
║  Скопировать в backend/.env:                 ║
║  ED25519_PRIVATE_KEY=a1b2c3d4e5f6...        ║
║                                              ║
║  Скопировать в firmware/platformio.ini:      ║
║  -DBACKEND_PUBLIC_KEY_HEX="e5f6a1b2..."     ║
║                                              ║
╚══════════════════════════════════════════════╝

✅ Self-test passed: public key matches.
```

### 3.2 Заполнить .env

Откройте `backend/.env` в редакторе и заполните:

```env
# === Порт ===
PORT=3000

# === Ed25519 (скопировать из вывода keygen!) ===
ED25519_PRIVATE_KEY=a1b2c3d4e5f6...   # ← ВАШ 64-символьный HEX

# === 42 Intra OAuth ===
INTRA_UID=u-s4t2ud-...                # ← UID из шага 1.4
INTRA_SECRET=s-s4t2ud-...             # ← SECRET из шага 1.4
INTRA_REDIRECT_URI=http://localhost:3000/api/auth/callback

# === JWT (сгенерировать случайный) ===
# Выполнить в терминале: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=ваш_128_символьный_hex
```

### 3.3 Обновить публичный ключ в прошивке ESP32

Откройте `firmware/esp32_bike_lock/platformio.ini` и замените строку:

```ini
; БЫЛО:
-DBACKEND_PUBLIC_KEY_HEX=\"deadbeef00000000000000000000000000000000000000000000000000000000\"

; СТАЛО (скопировать из вывода keygen):
-DBACKEND_PUBLIC_KEY_HEX=\"e5f6a1b2c3d4...\"    ; ← ВАШ 64-символьный HEX
```

Также обновите номер велосипеда (менять для каждого физического экземпляра):

```ini
-DBIKE_ID=\"01\"    ; ← 01, 02, 03... для каждого велосипеда
```

> ⚠️ **Критично:** Публичный ключ в прошивке ДОЛЖЕН соответствовать приватному ключу в .env.
> Если они не совпадают — замок НИКОГДА не откроется.

---

## 4. Настройка и деплой бэкенда

### 4.1 Локальный запуск (проверка)

```bash
cd backend
npm run dev
```

**Ожидаемый вывод:**
```
╔══════════════════════════════════════════════╗
║  🔐 Ed25519 Crypto Module Loaded            ║
║  Public Key: e5f6a1b2c3d4...                ║
╚══════════════════════════════════════════════╝

🚲 Velo Backend running on http://localhost:3000
   Endpoints:
   GET  /api/health
   POST /api/auth/callback
   POST /api/rent/challenge  [42 OAuth required]
```

**Проверка здоровья:**
```bash
curl http://localhost:3000/api/health
# Ответ: {"status":"ok","service":"velo-backend","version":"1.0.0",...}
```

### 4.2 Деплой на Railway

#### Способ A: Автоматический деплой через Git

```bash
cd /путь/к/velo-bike-sharing

# Инициализировать Git (если ещё нет)
git init
git add .
git commit -m "Initial commit: Velo Bike Sharing v1.0"

# Подключить свой GitHub репозиторий
git remote add origin https://github.com/ВАШ-АККАУНТ/velo-bike-sharing.git
git branch -M main
git push -u origin main
```

Railway автоматически подхватит коммит и развернёт бэкенд.

#### Настройка Railway:

1. Откройте проект в Railway
2. Выберите сервис (он создался автоматически)
3. Перейдите во вкладку **Variables**
4. Добавьте ВСЕ переменные из `.env`:
   - `PORT` = `3000`
   - `ED25519_PRIVATE_KEY` = ваш ключ
   - `INTRA_UID` = ваш UID
   - `INTRA_SECRET` = ваш SECRET
   - `INTRA_REDIRECT_URI` = `https://ВАШ-ПРОЕКТ.railway.app/api/auth/callback`
   - `JWT_SECRET` = ваш секрет
5. Перейдите во вкладку **Settings**:
   - Root Directory: `backend`
   - Start Command: `npm start`
   - Build Command: `npm run build`
6. Railway автоматически пересоберёт проект

#### Способ B: Railway CLI (если предпочитаете терминал)

```bash
# Установить Railway CLI
npm i -g @railway/cli

# Авторизоваться
railway login

# Линковать проект
railway link

# Загрузить переменные из .env
railway variables set < backend/.env

# Деплой
railway up
```

### 4.3 Проверка удалённого бэкенда

```bash
# Замените URL на ваш Railway URL
curl https://velo-bike-sharing-production.up.railway.app/api/health
```

**Ожидаемый ответ:** `{"status":"ok","service":"velo-backend","version":"1.0.0",...}`

> ✅ Если получили JSON — бэкенд работает в облаке!

### 4.4 Обновить Redirect URI в 42 Intra

1. Вернитесь на [profile.intra.42.fr/oauth/applications](https://profile.intra.42.fr/oauth/applications)
2. Найдите своё приложение → Edit
3. Обновите **Redirect URI** на `https://ВАШ-ПРОЕКТ.railway.app/api/auth/callback`
4. Сохраните

---

## 5. Настройка Slack-бота
Создайте файл `.env` в `interfaces/slack-bot/`:

```bash
cd interfaces/slack-bot
cp .env.example .env   # если есть, иначе создайте вручную
```

Заполните (значения из шага 1.5):

```env
SLACK_BOT_TOKEN=xoxb-...          # Bot User OAuth Token
SLACK_SIGNING_SECRET=...          # Signing Secret
SLACK_APP_TOKEN=xapp-...          # App-Level Token (Socket Mode)
BACKEND_URL=https://ВАШ-ПРОЕКТ.railway.app
PWA_URL=https://velo.vercel.app   # URL вашей PWA из шага 1.6
```

Локальный запуск:

```bash
npm run dev
# → 🤖 Slack Bot запущен на порту 4000
```

Деплой — так же как бэкенд (через Railway или Render, указав root: `interfaces/slack-bot`).

---

## 6. Настройка и деплой PWA

### 6.1 Актуализировать URL бэкенда

Откройте `interfaces/pwa/app.js` и в строке 7 замените:

```js
// БЫЛО:
const BACKEND_URL = localStorage.getItem('velo_backend_url') ||
                    'http://localhost:3000';

// СТАЛО (укажите ваш Railway URL):
const BACKEND_URL = 'https://velo-bike-sharing-production.up.railway.app';
```

### 6.2 Актуализировать 42 Intra UID

В том же файле, функция `redirectTo42OAuth()`, замените:

```js
const uid = 'YOUR_INTRA_UID';  // ← заменить на реальный UID из шага 1.4!
```

### 6.3 Деплой на Vercel

```bash
cd interfaces/pwa
npm install -g vercel    # если ещё не установлен
vercel                    # первый запуск — авторизация
vercel --prod             # деплой в production
```

**Результат:** PWA будет доступна по URL типа `https://velo.vercel.app`

> Альтернатива: залейте папку `interfaces/pwa` на Netlify через drag-and-drop в браузере.

### 6.4 Открыть PWA на телефоне

1. Откройте Chrome на Android (или macOS)
2. Перейдите по URL: `https://velo.vercel.app`
3. Нажмите "Добавить на главный экран" → установится как PWA
4. Для теста с конкретным велосипедом: `https://velo.vercel.app?bike=42_CAMPUS_BIKE_01`

---

## 7. Прошивка ESP32-C3 (железо велосипеда)

### 7.1 Установить PlatformIO

1. Откройте **VS Code**
2. Extensions (Ctrl+Shift+X) → поиск "PlatformIO IDE" → Install
3. После установки перезагрузите VS Code
4. Слева появится иконка муравья 🐜 — это PlatformIO

### 7.2 Драйверы для ESP32-C3

| ОС | Что делать |
|----|-----------|
| **Windows** | Скачать драйвер: [CP210x USB-to-UART](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers). Установить, перезагрузить ПК. |
| **Mac** | Драйвер встроен в macOS. Ничего не требуется. |
| **Linux** | `sudo apt install linux-modules-extra-$(uname -r)` или драйвер уже в ядре. |

**Проверка:** подключите ESP32-C3 по USB-кабелю.

```bash
# Windows (PowerShell):
wmic path Win32_SerialPort get Name

# Mac/Linux:
ls /dev/tty* | grep -i usb
# → /dev/ttyUSB0  или  /dev/ttyACM0  или  /dev/cu.usbserial-*
```

### 7.3 Публичный ключ в прошивке

Откройте `firmware/esp32_bike_lock/platformio.ini` и убедитесь, что публичный ключ совпадает с `.env`:

    -DBACKEND_PUBLIC_KEY_HEX="e5f6a1b2c3d4..."   ; ваш ключ из шага 3.1

> **BIKE_ID больше не нужен!** ID генерируется автоматически из BLE MAC-адреса.
> Одна прошивка на все платы без изменений.

### 7.4 Открыть проект в VS Code

**Способ A (рекомендуемый) — Workspace:**
1. **File → Open Workspace from File** → выберите `velo.code-workspace`
2. VS Code откроет две папки: `Velo (root)` + `ESP32 Firmware`
3. PlatformIO авто-конфиг в `firmware/.vscode/` заработает → IntelliSense видит `#include`
4. TypeScript в `backend/` и `interfaces/` тоже работает

**Способ B — только прошивка:**
1. **PlatformIO (🐜) → Open → Open Project** → выберите `firmware/esp32_bike_lock`

> ⚠️ `velo.code-workspace` нужен **ТОЛЬКО для локальной разработки в VS Code**.
> На сервере он не используется — там только `npm run dev` и `pio run`.

### 7.5 Скомпилировать прошивку

В нижней панели VS Code (PlatformIO toolbar) нажмите **✓ (Build)**.

**Ожидаемый вывод:**
```
Building in release mode
Compiling .pio/build/esp32-c3-devkitm-1/src/main.cpp.o
...
Linking .pio/build/esp32-c3-devkitm-1/firmware.elf
Building .pio/build/esp32-c3-devkitm-1/firmware.bin
========================= [SUCCESS] =========================
```

### 7.6 Прошить ESP32

1. Подключите ESP32-C3 по USB
2. В PlatformIO нажмите **→ (Upload)**
3. Дождитесь надписи `Writing at 0x00000000... (100%)`
4. Нажмите **🔌 (Monitor)** — откроется Serial Monitor (115200 бод)

**Ожидаемый вывод в мониторе:**
```
======================================
|  42_CAMPUS_BIKE_A1B2             |
|  ESP32-C3 BLE Lock v2.0          |
======================================
[INIT] Backend Public Key: e5f6a1b2c3d4...
[BLE] Advertising as '42_CAMPUS_BIKE_A1B2'
[BLE] Waiting for connections...
```

> ID велосипеда (A1B2) будет разным для каждой платы — зависит от MAC-адреса.

### 7.7 Проверка BLE с телефона

1. Установите **nRF Connect** (Android/iOS)
2. Откройте приложение → нажмите "Scan"
3. Найдите устройство **"42_CAMPUS_BIKE_"** (например `42_CAMPUS_BIKE_A1B2`)
4. Нажмите "Connect"
5. Найдите сервис `42424242-1111-1111-1111-424242424242`
6. Найдите характеристику `42424242-2222-...` (Challenge) → нажмите "Read" (стрелка вниз)
7. **Вы должны увидеть 32 случайных байта!**
8. Характеристика `42424242-3333-...` (Signature) — Write

> ✅ Если видите устройство и можете прочитать 32 байта — прошивка работает!

---

> ⚠️ **Безопасность:** Работаете с Li-Ion (3.7V) и 12V. Не закорачивайте контакты. Паяльник 300-350°C. Если нет опыта — попросите помощи.

### 8.1 Инструменты

| Инструмент | Назначение |
|-----------|------------|
| Паяльник + припой + флюс | Соединения |
| Мультиметр | Проверка напряжений |
| Макетная плата | Прототипирование |
| Термоусадка / изолента | Изоляция |

### 8.2 Пошаговая сборка

#### Шаг 1: Питание ESP32
```
18650 (+) → TP4056 BAT+
18650 (-) → TP4056 BAT-
TP4056 OUT+ → AMS1117 IN
TP4056 OUT- → AMS1117 GND
AMS1117 OUT → ESP32 3.3V  |  AMS1117 GND → ESP32 GND
```
**Проверка:** мультиметр на выходе AMS1117 → **3.3V ± 0.1V**.

#### Шаг 2: Повышающий преобразователь 12V
```
TP4056 OUT+ → MT3608 IN+
TP4056 OUT- → MT3608 IN-
```
**Настройка:** крутите синий потенциометр MT3608, мультиметр на выходе → **12.0V ± 0.2V**. Не подключайте ESP32 к 12V!

#### Шаг 3: MOSFET и соленоид
```
MT3608 12V ─── СОЛЕНОИД (+) 
MT3608 GND ─── 1N4007 (анод) ─── СОЛЕНОИД (-) ─── DRAIN (IRLZ44N)
              1N4007 (катод-полоска) → 12V
ESP32 GPIO12 ─── GATE (IRLZ44N)
ESP32 GPIO12 ─── 10kΩ ─── GND (pull-down)
ESP32 GND ─── SOURCE (IRLZ44N) ─── GND (ОБЩАЯ!)
```

**Критично:**
- GND аккумулятора, ESP32, MT3608 и IRLZ44N — **ОБЩАЯ ЗЕМЛЯ**
- Диод 1N4007 **ОБЯЗАТЕЛЕН** (без него — индуктивный выброс ~100V убьёт всё)
- Резистор 10kΩ Gate→GND — замок не откроется сам при старте

#### Шаг 4: Конденсатор + LED + Кнопка
```
100µF: (+) → 12V, (-) → GND
LED: GPIO8 → 220Ω → LED анод → LED катод → GND
Кнопка: GPIO9 → кнопка → GND
```

#### Шаг 5: Финальная проверка (от аккумулятора, без USB!)
1. Отключите USB, подключите 18650
2. Нажмите кнопку GPIO9 → ESP32 загружается
3. nRF Connect → видно "42_CAMPUS_BIKE_01" ✅

### 8.3 Корпусирование
- **Быстро:** пластиковый контейнер + герметик
- **Правильно:** 3D-печать + силиконовые прокладки
- **Крепление:** хомуты-стяжки к раме
---

## 9. Интеграционное тестирование (end-to-end)

### 9.1 Подготовка

```bash
# 1. Бэкенд в облаке
curl https://ВАШ-ПРОЕКТ.railway.app/api/health    # → {"status":"ok",...}

# 2. ESP32 вещает BLE (nRF Connect → "42_CAMPUS_BIKE_01")
```

### 9.2 Тест криптографии

```bash
cd backend
CHALLENGE=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "Challenge: $CHALLENGE"
npx tsx -e "
const{loadPrivateKey,signChallenge}=require('./src/crypto/ed25519');
const pk=loadPrivateKey(process.env.ED25519_PRIVATE_KEY);
const ch=Buffer.from('$CHALLENGE','hex');
const sig=signChallenge(pk,ch);
console.log('Sig:',sig.toString('hex'),'Len:',sig.length);
"   # → Len: 64 ✅
```

### 9.3 Полный цикл (Postman/curl)

1. nRF Connect → прочитать Challenge (UUID ...2222...) → 64 hex символов
2. Выполнить запрос:

```bash
curl -X POST https://ВАШ-ПРОЕКТ.railway.app/api/rent/challenge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ВАШ_42_ТОКЕН" \
  -d '{"bike_id":"42_CAMPUS_BIKE_01","challenge_hex":"ПОЛУЧЕННЫЙ_HEX"}'
```

3. Ожидаемый ответ: `{"signature_hex":"a1b2c3...128hex...","bike_id":"...","user":{...}}`
4. nRF Connect → записать signature_hex в характеристику (...3333...)
5. ESP32 Serial Monitor: `[SEC] ✅ VALID SIGNATURE - UNLOCKING!`
6. **Соленоид дёргается!** 🔓

### 9.4 Полный цикл (PWA)

1. Chrome на Android → `https://velo.vercel.app?bike=42_CAMPUS_BIKE_01`
2. "Подключиться" → выбрать устройство в диалоге BLE
3. Авторизоваться 42 Intra (первый раз)
4. "Арендовать" → прогресс: 30% → 50% → 75% → 100%
5. **Замок открыт** 🔓🚲

### 9.5 Негативные тесты безопасности

| Тест | Ожидаемый результат |
|------|-------------------|
| Подпись 63 байта (не 64) | `ABORT: bad sig length` |
| Подпись без challenge | `ABORT: no active challenge` |
| Невалидная подпись | `INVALID (attempt 1/3)` |
| 3 ошибки подряд | `BRUTE FORCE! Deep sleep 5 min.` |
| Ждать >60 сек | `ABORT: challenge expired` |
---

## 10. FAQ — Часто задаваемые вопросы

**Q: Ничего не работает, с чего начать?**
A: По порядку: (1) бэкенд локально → `curl localhost:3000/api/health`. (2) прошить ESP32, проверить в nRF Connect. (3) подписать challenge вручную через curl. Только потом PWA.

**Q: ESP32 не виден в nRF Connect?**
A: Проверьте Serial Monitor (115200 бод) — есть ли `[BLE] Advertising`? Попробуйте другую ESP32-C3. Проверьте питание (3.3V стабильно). Нажмите EN/RST.

**Q: PlatformIO: "mbedtls/pk.h: No such file"?**
A: Убедитесь, что `board = esp32-c3-devkitm-1` в platformio.ini. Для ESP32-C3 mbedtls доступен из коробки.

**Q: PWA не находит устройство по Bluetooth?**
A: Web Bluetooth API работает только в Chrome (Android/macOS) и Edge. НЕ в Safari (iOS) и Firefox. Откройте `chrome://flags` → включите `Experimental Web Platform features`.

**Q: Как получить 42 OAuth токен для тестов?**
A: Откройте в браузере: `https://api.intra.42.fr/oauth/authorize?client_id=ВАШ_UID&redirect_uri=http://localhost:3000/api/auth/callback&response_type=code`. После авторизации редирект с `?code=...`. Отправьте POST на `/api/auth/callback` с этим code.

**Q: Можно ли тестировать без 42 Intra?**
A: Да. Закомментируйте `require42Auth` в `rent.ts`. **Но в production обязательно верните!**

**Q: Соленоид не дёргается?**
A: Проверьте: (1) 12V на MT3608 выходе? (2) GPIO12 → HIGH при валидной подписи? (3) MOSFET: Drain к соленоиду, Source к GND. (4) Диод 1N4007 не перепутан?

**Q: Аккумулятор быстро садится?**
A: Проверьте Deep Sleep. ESP32 должен спать после таймаута. LED и BLE не должны гореть постоянно.

**Q: Как добавить второй велосипед?**
A: Измените `-DBIKE_ID=\"02\"` в platformio.ini, прошейте вторую ESP32. Публичный ключ тот же (сервер один на все).

**Q: Что делать при краже велосипеда?**
A: На борту нет приватного ключа. Вор получит ESP32 (~$3) + соленоид (~$2). Данные в безопасности.

---

## ✅ Production Readiness Checklist

- [ ] Бэкенд деплоен на Railway/Render (24/7)
- [ ] Ed25519: приватный в .env, публичный в прошивке
- [ ] 42 OAuth настроен с правильным Redirect URI
- [ ] PWA задеплоена на Vercel/Netlify
- [ ] HTTPS работает (SSL авто)
- [ ] Slack Bot установлен (опционально)
- [ ] ESP32 прошита, BLE виден в nRF Connect
- [ ] Железо: MOSFET + соленоид + диод + аккумулятор
- [ ] Интеграционный тест: PWA → BLE → бэкенд → замок ✅
- [ ] Негативные тесты безопасности пройдены
- [ ] Корпус влагозащищён
- [ ] QR-код приклеен на велосипед

---

## 📞 Поддержка

- **Код:** `github.com/ВАШ-АККАУНТ/velo-bike-sharing`
- **Баги:** Issues в репозитории
- **42 Slack:** `#velo-bike-sharing`

---

> 🚲 **Удачи!** Следуйте шагам по порядку, не пропускайте проверки мультиметром.
> *Stupid-simple architecture wins.*