/**
 * @file ed25519.ts
 * @brief Криптографический модуль бэкенда (Ed25519, нативный node:crypto)
 *
 * Приватный ключ бэкенда хранится СТРОГО в переменной окружения.
 * Никогда не логируется, никогда не передаётся клиенту.
 *
 * Публичный ключ (32 байта) зашивается в прошивку ESP32.
 */

import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign as ed25519_sign,
  verify as ed25519_verify,
  KeyObject,
} from 'node:crypto';

/* ================================================================
 * Типы
 * ================================================================ */
export interface KeyPair {
  /** 32-байтный приватный ключ (seed) в hex */
  privateKeyHex: string;
  /** 32-байтный публичный ключ в hex */
  publicKeyHex: string;
}

/* ================================================================
 * Генерация ключевой пары Ed25519 (для npm run keygen)
 * ================================================================ */
export function generateKeyPair(): KeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');

  return {
    privateKeyHex: privateKey
      .export({ format: 'der', type: 'pkcs8' })
      .subarray(-32) // Ed25519: последние 32 байта PKCS8 = seed
      .toString('hex'),
    publicKeyHex: publicKey
      .export({ format: 'der', type: 'spki' })
      .subarray(-32) // Ed25519: последние 32 байта SPKI = public key
      .toString('hex'),
  };
}

/* ================================================================
 * Загрузка приватного ключа из hex-строки (ED25519_PRIVATE_KEY)
 * ================================================================ */
export function loadPrivateKey(privateKeyHex: string): KeyObject {
  if (!privateKeyHex || privateKeyHex.length !== 64) {
    throw new Error(
      `ED25519_PRIVATE_KEY должен быть 64 hex-символа (32 байта), получено: ${privateKeyHex?.length ?? 0}`
    );
  }

  const seed = Buffer.from(privateKeyHex, 'hex');
  if (seed.length !== 32) {
    throw new Error('Невалидный Ed25519 seed: ожидалось 32 байта');
  }

  // PKCS8 DER-обёртка для Ed25519 (RFC 8410)
  const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
  const der = Buffer.concat([PKCS8_PREFIX, seed]);

  return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

/* ================================================================
 * Получение публичного ключа (hex) из приватного
 * ================================================================ */
export function getPublicKeyHex(privateKey: KeyObject): string {
  const publicKey = createPublicKey(privateKey);
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  return spki.subarray(-32).toString('hex');
}

/* ================================================================
 * Подпись 32-байтного challenge → 64-байтная подпись
 * ================================================================ */
export function signChallenge(
  privateKey: KeyObject,
  challenge: Buffer
): Buffer {
  if (challenge.length !== 32) {
    throw new Error(
      `Challenge должен быть ровно 32 байта, получено: ${challenge.length}`
    );
  }

  // node:crypto автоматически применяет SHA-512 для Ed25519
  const signature = ed25519_sign(null, challenge, privateKey);
  if (signature.length !== 64) {
    throw new Error(`Ошибка подписи: ожидалось 64 байта, получено ${signature.length}`);
  }

  return signature;
}

/* ================================================================
 * Верификация (для тестов / самопроверки)
 * ================================================================ */
export function verifySignature(
  publicKeyHex: string,
  challenge: Buffer,
  signature: Buffer
): boolean {
  const publicKey = createPublicKey({
    key: Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'), // SPKI prefix Ed25519
      Buffer.from(publicKeyHex, 'hex'),
    ]),
    format: 'der',
    type: 'spki',
  });

  return ed25519_verify(null, challenge, publicKey, signature);
}
