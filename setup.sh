#!/usr/bin/env bash
# ================================================================
# setup.sh — Автоматическая установка и запуск 42 Campus Bike
# Linux / macOS / Windows (Git Bash)
# ================================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok() { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${CYAN}📌 $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err() { echo -e "${RED}❌ $1${NC}"; }

echo ""
echo "🚲 =========================================="
echo "   42 Campus Bike Sharing — Setup Wizard"
echo "   Zero-Trust · Ed25519 · ESP32"
echo "=============================================="
echo ""

# ─── 1. Проверка системных зависимостей ───
info "Проверка зависимостей..."

MISSING=0
for cmd in node npm git bash; do
    if command -v "$cmd" &>/dev/null; then
        ok "$cmd — $(command -v "$cmd")"
    else
        err "$cmd НЕ НАЙДЕН! Установите:"
        case "$cmd" in
            node|npm) echo "     apt: sudo apt install nodejs npm" ;;
            git)      echo "     apt: sudo apt install git" ;;
        esac
        MISSING=1
    fi
done

if [ "$MISSING" -eq 1 ]; then
    echo ""
    err "Установите недостающие программы и перезапустите: bash setup.sh"
    exit 1
fi

NODE_V=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_V" -lt 18 ]; then
    err "Node.js >= 18. Сейчас: $(node -v)"
    exit 1
fi

# ─── 2. Корень проекта ───
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "task.md" ]; then
    err "Запустите скрипт из корня проекта Velo!"
    exit 1
fi

# ─── 3. Установка npm зависимостей ───
info "Установка backend зависимостей..."
cd "$SCRIPT_DIR/backend"
npm install --silent 2>/dev/null || npm install
ok "Backend: готово"

info "Установка slack-bot зависимостей..."
cd "$SCRIPT_DIR/interfaces/slack-bot"
npm install --silent 2>/dev/null || npm install
ok "Slack Bot: готово"

# ─── 4. Генерация Ed25519 ключей ───
info "Генерация Ed25519 ключей..."
cd "$SCRIPT_DIR/backend"

PRIVATE_KEY=$(node -e "
const c=require('crypto');
const k=c.generateKeyPairSync('ed25519');
console.log(k.privateKey.export({format:'der',type:'pkcs8'}).subarray(-32).toString('hex'));
")
PUBLIC_KEY=$(node -e "
const c=require('crypto');
const k=c.generateKeyPairSync('ed25519');
console.log(k.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex'));
")
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

ok "Ключи сгенерированы"
# ─── 5. Создание .env ───
info "Создание backend/.env..."
cat > .env << ENVEOF
PORT=3000
ED25519_PRIVATE_KEY=${PRIVATE_KEY}
INTRA_UID=
INTRA_SECRET=
INTRA_REDIRECT_URI=http://localhost:3000/api/auth/callback
JWT_SECRET=${JWT_SECRET}
ENVEOF
ok "backend/.env создан"

# ─── 6. Обновление platformio.ini ───
info "Обновление публичного ключа в прошивке..."
PLATFORMIO_INI="$SCRIPT_DIR/firmware/esp32_bike_lock/platformio.ini"
if [ -f "$PLATFORMIO_INI" ]; then
    if grep -q "deadbeef00000000000000000000000000000000000000000000000000000000" "$PLATFORMIO_INI"; then
        sed -i "s/deadbeef00000000000000000000000000000000000000000000000000000000/${PUBLIC_KEY}/" "$PLATFORMIO_INI"
        ok "Публичный ключ обновлён в platformio.ini"
    else
        warn "platformio.ini уже содержит ключ. Проверьте совпадение с .env!"
    fi
fi

# ─── 7. Итог ───
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        🎉 УСТАНОВКА ЗАВЕРШЕНА!           ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                          ║"
echo "║  🔐 Приватный ключ:  ${PRIVATE_KEY:0:16}...     ║"
echo "║  🔓 Публичный ключ:  ${PUBLIC_KEY:0:16}...     ║"
echo "║                                          ║"
echo "╠══════════════════════════════════════════╣"
echo "║  ⚙️  ОСТАЛОСЬ ВРУЧНУЮ:                   ║"
echo "║  1. Заполнить INTRA_UID/INTRA_SECRET    ║"
echo "║     в backend/.env                       ║"
echo "║  2. VS Code → PlatformIO → прошить ESP  ║"
echo "║  3. Запустить: cd backend && npm run dev║"
echo "╚══════════════════════════════════════════╝"
echo ""

echo -n "Запустить бэкенд сейчас? [Y/n]: "
read -r answer
if [[ "$answer" =~ ^[YyДд]?$|^$ ]]; then
    info "Запуск бэкенда..."
    cd "$SCRIPT_DIR/backend"
    npm run dev
else
    info "Готово. Запустите: cd backend && npm run dev"
fi