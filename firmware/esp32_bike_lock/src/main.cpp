/**
 * @file main.cpp
 * @brief Прошивка велосипедного замка "42 Campus Bike" — ESP32-C3
 *
 * Фаза 1: BLE-сервер + HW RNG challenge + Ed25519 верификация
 *         + MOSFET-замок (GPIO12) + Deep Sleep.
 *
 * Zero-Trust: приватный ключ ТОЛЬКО на бэкенде.
 * ES32 хранит ТОЛЬКО публичный ключ (32 байта).
 *
 * ID велосипеда = последние 4 байта BLE MAC (авто-генерация).
 * Одна прошивка на ВСЕ платы без изменений.
 *
 * BLE профиль:
 *   Device Name:    42_CAMPUS_BIKE_A1B2  (A1B2 = suffix MAC)
 *   Service UUID:   42424242-1111-1111-1111-424242424242
 *   Challenge CHAR: 42424242-2222-... (READ, 32 bytes)
 *   Signature CHAR: 42424242-3333-... (WRITE, 64 bytes)
 *   BikeID CHAR:    42424242-4444-... (READ, строка с ID велосипеда)
 */

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <NimBLEServer.h>
#include <esp_random.h>
#include <esp_sleep.h>
#include <esp_mac.h>
#include <mbedtls/pk.h>
#include <mbedtls/md.h>
#include <string.h>

/* ============ КОНФИГУРАЦИЯ ============ */
#ifndef BACKEND_PUBLIC_KEY_HEX
  #define BACKEND_PUBLIC_KEY_HEX "deadbeef00000000000000000000000000000000000000000000000000000000"
#endif

#define SERVICE_UUID          "42424242-1111-1111-1111-424242424242"
#define CHALLENGE_CHAR_UUID   "42424242-2222-2222-2222-424242424242"
#define SIGNATURE_CHAR_UUID   "42424242-3333-3333-3333-424242424242"
#define BIKEID_CHAR_UUID      "42424242-4444-4444-4444-424242424242"

#define LOCK_PIN              GPIO_NUM_12
#define LED_PIN               GPIO_NUM_8
#define LOCK_DURATION_MS      5000
#define CHALLENGE_TIMEOUT_MS  60000
#define MAX_FAILED_ATTEMPTS   3

#define CHALLENGE_SIZE  32
#define SIGNATURE_SIZE  64
#define PUBKEY_SIZE     32
#define BIKED_ID_LEN    17   /* "42_CAMPUS_BIKE_" + 4 hex = 16 + null */

/* ============ ГЛОБАЛЬНЫЕ ============ */
static NimBLEServer*         pServer = nullptr;
static NimBLECharacteristic* pChallengeChar = nullptr;
static NimBLECharacteristic* pSignatureChar = nullptr;
static NimBLECharacteristic* pBikeIdChar = nullptr;

static uint8_t  current_challenge[CHALLENGE_SIZE];
static bool     challenge_generated = false;
static uint8_t  backend_pubkey[PUBKEY_SIZE];
static unsigned long challenge_ts = 0;
static uint8_t  failed_attempts = 0;
static char     bike_id_str[BIKED_ID_LEN];  /* "42_CAMPUS_BIKE_A1B2" */

/* ============ АВТО-ID из MAC адреса ============ */
static void generate_bike_id_from_mac() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_BT);

    /* Последние 2 байта MAC → 4 hex-символа = уникальный ID */
    snprintf(bike_id_str, BIKED_ID_LEN, "42_CAMPUS_BIKE_%02X%02X",
             mac[4], mac[5]);
}
/* ============ HEX → BINARY ============ */
static inline uint8_t hex_nibble(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return 0;
}

static bool hex_to_bin(const char* hex, uint8_t* out, size_t out_len) {
    size_t len = strlen(hex);
    if (len != out_len * 2) return false;
    for (size_t i = 0; i < out_len; i++)
        out[i] = (hex_nibble(hex[2*i]) << 4) | hex_nibble(hex[2*i+1]);
    return true;
}

/* ============ HARDWARE RNG CHALLENGE (TRNG ESP32-C3) ============ */
static void generate_challenge(uint8_t* buf, size_t len) {
    for (size_t i = 0; i < len; i += 4) {
        uint32_t r = esp_random();
        size_t rem = len - i;
        for (size_t j = 0; j < (rem < 4 ? rem : 4); j++)
            buf[i+j] = (r >> (8*j)) & 0xFF;
    }
}

/* ============ УПРАВЛЕНИЕ ЗАМКОМ ============ */
static void unlock_lock() {
    Serial.println("[HW] MOSFET HIGH - lock open");
    digitalWrite(LOCK_PIN, HIGH);
    digitalWrite(LED_PIN, HIGH);
    delay(LOCK_DURATION_MS);
    digitalWrite(LOCK_PIN, LOW);
    digitalWrite(LED_PIN, LOW);
    Serial.println("[HW] MOSFET LOW - lock closed");
}

/* ============ DEEP SLEEP ============ */
static void go_deep_sleep(uint64_t us) {
    Serial.printf("[PWR] Deep Sleep %llu sec...\n", us / 1000000ULL);
    esp_sleep_enable_timer_wakeup(us);
    esp_deep_sleep_start();
}
/* ============ Ed25519 ВЕРИФИКАЦИЯ (mbedtls) ============ */
static bool ed25519_verify(
    const uint8_t signature[SIGNATURE_SIZE],
    const uint8_t* message, size_t msg_len,
    const uint8_t pubkey[PUBKEY_SIZE]
) {
#if defined(MBEDTLS_PK_HAVE_ECC_ED25519)
    mbedtls_pk_context pk;
    mbedtls_pk_init(&pk);
    int ret = mbedtls_pk_setup(&pk,
        mbedtls_pk_info_from_type(MBEDTLS_PK_ED25519));
    if (ret != 0) { mbedtls_pk_free(&pk); goto fallback; }
    ret = mbedtls_ecp_point_read_binary(
        &mbedtls_pk_ec(pk)->Q, &mbedtls_pk_ec(pk)->grp,
        pubkey, PUBKEY_SIZE);
    if (ret != 0) { mbedtls_pk_free(&pk); goto fallback; }
    ret = mbedtls_pk_verify(&pk, MBEDTLS_MD_SHA512,
        nullptr, 0, message, msg_len, signature, SIGNATURE_SIZE);
    mbedtls_pk_free(&pk);
    return (ret == 0);
#endif
fallback:
    Serial.println("[CRYPTO] Ed25519 not in mbedtls. Enable in sdkconfig or run get_deps.sh");
    return false;
}
/* ====================================================================
 * BLE CALLBACK: Challenge Characteristic (READ-ONLY, 32 bytes)
 * Генерирует новый случайный challenge при каждом чтении.
 * ==================================================================== */
class ChallengeCallbacks : public NimBLECharacteristicCallbacks {
    void onRead(NimBLECharacteristic* pChar) override {
        generate_challenge(current_challenge, CHALLENGE_SIZE);
        challenge_generated = true;
        challenge_ts = millis();
        failed_attempts = 0;
        pChar->setValue(current_challenge, CHALLENGE_SIZE);
        Serial.println("[BLE] Challenge generated (READ)");
    }
};

/* ====================================================================
 * BLE CALLBACK: Signature Characteristic (WRITE-ONLY, 64 bytes)
 * Получает подпись → верифицирует Ed25519 → отпирает замок.
 * GUARDRAILS: ровно 64 байта, активный challenge, брутфорс-защита.
 * ==================================================================== */
class SignatureCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pChar) override {
        std::string val = pChar->getValue();
        size_t len = val.length();
        Serial.printf("[BLE] Signature received: %d bytes\n", len);

        /* GUARDRAIL 1: ровно 64 байта */
        if (len != SIGNATURE_SIZE) {
            Serial.printf("[SEC] ABORT: bad sig length %d != 64\n", len);
            pChar->setValue("ERR_BAD_LEN");
            return;
        }
        /* GUARDRAIL 2: активный challenge */
        if (!challenge_generated) {
            Serial.println("[SEC] ABORT: no active challenge");
            pChar->setValue("ERR_NO_CHALLENGE");
            return;
        }
        /* GUARDRAIL 3: таймаут challenge */
        if (millis() - challenge_ts > CHALLENGE_TIMEOUT_MS) {
            Serial.println("[SEC] ABORT: challenge expired");
            pChar->setValue("ERR_TIMEOUT");
            challenge_generated = false;
            return;
        }

        /* === ВЕРИФИКАЦИЯ Ed25519 === */
        const uint8_t* sig = (const uint8_t*)val.data();
        bool valid = ed25519_verify(sig, current_challenge,
                                     CHALLENGE_SIZE, backend_pubkey);
        challenge_generated = false; /* одноразовый */

        if (valid) {
            Serial.println("[SEC] VALID SIGNATURE - UNLOCKING!");
            failed_attempts = 0;
            pChar->setValue("OK_UNLOCKED");
            unlock_lock();
        } else {
            failed_attempts++;
            Serial.printf("[SEC] INVALID (attempt %d/%d)\n",
                          failed_attempts, MAX_FAILED_ATTEMPTS);
            pChar->setValue("ERR_INVALID_SIG");
            if (failed_attempts >= MAX_FAILED_ATTEMPTS) {
                Serial.println("[SEC] BRUTE FORCE! Deep sleep 5 min.");
                go_deep_sleep(5 * 60 * 1000000ULL);
            }
        }
    }
};
/* ====================================================================
 * SETUP — инициализация BLE-сервера, GPIO, Ed25519 публичного ключа
 * ==================================================================== */
void setup() {
    Serial.begin(115200);
    delay(300);

    /* Авто-генерация ID из BLE MAC адреса */
    generate_bike_id_from_mac();

    Serial.println("\n======================================");
    Serial.printf("|  %s  |\n", bike_id_str);
    Serial.println("|  ESP32-C3 BLE Lock v2.0          |");
    Serial.println("======================================");

    /* Парсинг публичного ключа бэкенда */
    if (!hex_to_bin(BACKEND_PUBLIC_KEY_HEX, backend_pubkey, PUBKEY_SIZE)) {
        Serial.println("[FATAL] Invalid BACKEND_PUBLIC_KEY_HEX!");
        while (1) { delay(1000); }
    }
    Serial.print("[INIT] Backend Public Key: ");
    for (int i = 0; i < PUBKEY_SIZE; i++)
        Serial.printf("%02x", backend_pubkey[i]);
    Serial.println();

    /* GPIO */
    pinMode(LOCK_PIN, OUTPUT);
    digitalWrite(LOCK_PIN, LOW);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    /* ---- BLE Server ---- */
    NimBLEDevice::init(bike_id_str);
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);
    NimBLEDevice::setSecurityAuth(false, false, false);

    pServer = NimBLEDevice::createServer();

    NimBLEService* pService = pServer->createService(NimBLEUUID(SERVICE_UUID));

    /* Challenge Characteristic: READ */
    pChallengeChar = pService->createCharacteristic(
        NimBLEUUID(CHALLENGE_CHAR_UUID), NIMBLE_PROPERTY::READ);
    pChallengeChar->setCallbacks(new ChallengeCallbacks());

    /* Signature Characteristic: WRITE */
    pSignatureChar = pService->createCharacteristic(
        NimBLEUUID(SIGNATURE_CHAR_UUID), NIMBLE_PROPERTY::WRITE);
    pSignatureChar->setCallbacks(new SignatureCallbacks());

    /* BikeID Characteristic: READ — возвращает строку с ID велосипеда */
    pBikeIdChar = pService->createCharacteristic(
        NimBLEUUID(BIKEID_CHAR_UUID), NIMBLE_PROPERTY::READ);
    pBikeIdChar->setValue((uint8_t*)bike_id_str, strlen(bike_id_str));

    pService->start();

    /* Advertising */
    NimBLEAdvertising* pAdv = NimBLEDevice::getAdvertising();
    pAdv->addServiceUUID(NimBLEUUID(SERVICE_UUID));
    pAdv->setScanResponse(true);
    pAdv->start();

    Serial.printf("[BLE] Advertising as '%s'\n", bike_id_str);
    Serial.println("[BLE] Waiting for connections...");
    Serial.println("--------------------------------------");
}

/* ====================================================================
 * LOOP — обработка таймаутов (NimBLE работает асинхронно)
 * ==================================================================== */
void loop() {
    if (challenge_generated &&
        (millis() - challenge_ts > CHALLENGE_TIMEOUT_MS)) {
        Serial.println("[BLE] Challenge timeout - reset");
        challenge_generated = false;
    }
    delay(100);
}