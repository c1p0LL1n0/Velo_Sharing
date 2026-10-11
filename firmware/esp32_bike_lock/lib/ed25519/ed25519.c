/**
 * @file ed25519.c
 * @brief Точка интеграции Ed25519 верификации для ESP32-C3
 *
 * Верификация Ed25519 — ДВА ПУТИ (см. main.cpp, ed25519_verify()):
 *
 *   ПУТЬ A (предпочтительный): нативный mbedtls
 *     - Включить в sdkconfig: MBEDTLS_PK_HAVE_ECC_ED25519=y
 *     - Код использует mbedtls/pk.h (как требует ТЗ).
 *
 *   ПУТЬ B (fallback): библиотека orlp/ed25519 (public domain)
 *     - Запустить: ./get_deps.sh (скачает ed25519_full.c)
 *     - В main.cpp раскомментировать блок ED25519_FULL_AVAILABLE.
 *
 * ВАЖНО: не писать свою криптографию. Использовать только
 * проверенные реализации (mbedtls или orlp/ed25519).
 */
#include "ed25519.h"
#include <string.h>

static uint8_t hex_nibble(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return 0xFF;
}

int ed25519_hex_to_bin(const char *hex, uint8_t *bin, size_t bin_len) {
    size_t hex_len = strlen(hex);
    if (hex_len % 2 != 0) return -1;
    if (hex_len / 2 > bin_len) return -1;
    for (size_t i = 0; i < hex_len; i += 2) {
        uint8_t hi = hex_nibble(hex[i]);
        uint8_t lo = hex_nibble(hex[i+1]);
        if (hi > 15 || lo > 15) return -1;
        bin[i/2] = (hi << 4) | lo;
    }
    return 0;
}