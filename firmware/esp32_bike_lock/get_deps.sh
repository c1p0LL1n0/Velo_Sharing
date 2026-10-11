#!/bin/bash
# get_deps.sh — загружает standalone Ed25519 библиотеку для ESP32
# Источник: orlp/ed25519 (публичное достояние, ~1300 строк C, без зависимостей)

set -e
LIB_DIR="$(dirname "$0")/lib/ed25519"
mkdir -p "$LIB_DIR"

echo "==> Загрузка Ed25519 библиотеки (orlp/ed25519)..."

# Загружаем основной файл реализации
curl -sL "https://raw.githubusercontent.com/orlp/ed25519/master/src/ed25519.c" \
    -o "$LIB_DIR/ed25519_full.c"

# Загружаем заголовок
curl -sL "https://raw.githubusercontent.com/orlp/ed25519/master/src/ed25519.h" \
    -o "$LIB_DIR/ed25519_full.h"

echo "==> Готово: библиотека Ed25519 загружена в $LIB_DIR"
echo "==> Для проекта используется lib/ed25519/ed25519_full.c + ed25519_full.h"
echo "==> Альтернативно: включить MBEDTLS_ECDSA_VARIANT_ED25519 в sdkconfig ESP-IDF"

# Примечание: если компиляция через PlatformIO + Arduino framework,
# библиотека orlp/ed25519 требует хеш-функцию SHA-512.
# ESP32 предоставляет её через mbedtls/sha512.h (аппаратное ускорение).
# Нужно добавить #define ED25519_USE_MBEDTLS_SHA512 в ed25519_full.c