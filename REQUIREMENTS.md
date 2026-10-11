# 📋 REQUIREMENTS.md — Требования для развёртывания 42 Campus Bike Sharing

## 🖥️ Системные требования

| Компонент | Минимальная версия | Проверка |
|-----------|-------------------|----------|
| **ОС** | Linux (Ubuntu 20.04+), macOS 12+, Windows 10+ | — |
| **Node.js** | 18.x или выше | `node -v` |
| **npm** | 9.x или выше | `npm -v` |
| **Git** | любая | `git --version` |
| **bash** | 4.0+ (Linux/macOS) / Git Bash (Windows) | `bash --version` |

### Железо (для прототипа велосипеда)

| Компонент | Модель | ≈ Цена |
|-----------|--------|--------|
| Микроконтроллер | ESP32-C3-DevKitM-1 | $2.50 |
| USB-кабель | USB-C data cable | $2.00 |
| Замок | 12V Solenoid Lock | $2.00 |
| MOSFET | IRLZ44N | $0.50 |
| Flyback диод | 1N4007 | $0.05 |
| Аккумулятор | 18650 2500mAh | $2.00 |
| Держатель 18650 | Single cell | $0.30 |
| Зарядка | TP4056 | $0.30 |
| Boost DC-DC | MT3608 | $0.50 |
| LDO 3.3V | AMS1117-3.3 | $0.20 |
| Резисторы | 10kΩ, 220Ω | $0.02 |
| LED | 5mm | $0.05 |
| Кнопка | Тактовая | $0.10 |
| Конденсатор | 100µF электролит | $0.10 |
| Провода, клеммы | — | $0.50 |
| **Итого** | | **≈ $11** |

### Cloud (бесплатно)

| Сервис | Free Tier | Назначение |
|--------|-----------|------------|
| Railway / Render | 500 часов/мес | Хостинг бэкенда |
| Vercel / Netlify | ∞ статика | Хостинг PWA |
| 42 Intra API | ∞ (для студентов) | OAuth авторизация |

### Десктопный софт

| Программа | Назначение |
|-----------|-----------|
| VS Code | Редактор кода |
| PlatformIO IDE (расширение VS Code) | Прошивка ESP32 |
| nRF Connect (телефон) | Проверка BLE |

### Node.js пакеты (устанавливаются автоматически)

**Backend:**
```
express ^4.19
cors ^2.8
dotenv ^16.4
```

**Dev (backend):**
```
typescript ^5.4
tsx ^4.15
@types/node ^20
@types/express ^4.17
@types/cors ^2.8
```

**Slack Bot:**
```
@slack/bolt ^3.19
dotenv ^16.4
```

---

## 🌐 Необходимые аккаунты

| # | Сервис | Ссылка |
|---|--------|--------|
| 1 | GitHub | https://github.com |
| 2 | Railway | https://railway.app |
| 3 | 42 Intra OAuth | https://profile.intra.42.fr/oauth/applications |
| 4 | Vercel | https://vercel.com |
| 5 | Slack API (опционально) | https://api.slack.com/apps |

---

## 🔐 Переменные окружения (backend/.env)

```env
PORT=3000
ED25519_PRIVATE_KEY=      # ← генерируется setup.sh
INTRA_UID=                # ← UID приложения 42 Intra
INTRA_SECRET=             # ← SECRET приложения 42 Intra
INTRA_REDIRECT_URI=http://localhost:3000/api/auth/callback
JWT_SECRET=               # ← генерируется setup.sh
```

---

## 🚀 Быстрый старт (одна команда)

```bash
# Linux / macOS / Windows (Git Bash):
bash setup.sh
```

Скрипт автоматически:
1. Проверит Node.js, npm, Git
2. Установит все зависимости
3. Сгенерирует Ed25519 ключи
4. Создаст .env
5. Запустит бэкенд локально