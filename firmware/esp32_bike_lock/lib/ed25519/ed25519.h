/**
 * @file ed25519.h
 * @brief Minimal Ed25519 verification-only implementation for ESP32-C3
 *
 * Implements only ed25519_verify() — no signing, no key generation.
 * Uses ESP32 hardware SHA-512 accelerator via mbedtls.
 * Memory footprint: ~4KB stack, zero heap allocation.
 *
 * Based on: SUPERCOP ref10 implementation (public domain)
 * Adapted for embedded ESP32 by removing dynamic allocation.
 */

#ifndef ED25519_H
#define ED25519_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define ED25519_PUBLIC_KEY_SIZE  32
#define ED25519_SIGNATURE_SIZE   64

/**
 * @brief Verify an Ed25519 signature
 *
 * @param signature  64-byte signature (R || S)
 * @param message    Pointer to message bytes
 * @param message_len Length of message in bytes
 * @param public_key 32-byte Ed25519 public key
 * @return 1 if signature is valid, 0 otherwise
 *
 * NOTE: Constant-time, no heap allocation, stack usage ~4KB.
 *       Input lengths are NOT validated — caller must ensure
 *       exactly 32-byte challenge and 64-byte signature.
 */
int ed25519_verify(
    const uint8_t signature[ED25519_SIGNATURE_SIZE],
    const uint8_t *message,
    size_t message_len,
    const uint8_t public_key[ED25519_PUBLIC_KEY_SIZE]
);

/**
 * @brief Convert hex string to binary (case-insensitive)
 * @param hex  Null-terminated hex string (64 chars for pubkey)
 * @param bin  Output buffer (at least len/2 bytes)
 * @param bin_len  Size of output buffer
 * @return 0 on success, -1 on invalid hex
 */
int ed25519_hex_to_bin(const char *hex, uint8_t *bin, size_t bin_len);

#ifdef __cplusplus
}
#endif

#endif /* ED25519_H */