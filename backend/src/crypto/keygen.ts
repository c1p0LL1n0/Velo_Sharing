/**
 * @file keygen.ts
 * @brief Утилита генерации Ed25519 ключевой пары бэкенда
 * Запуск: npx tsx src/crypto/keygen.ts
 *
 * Выводит приватный и публичный ключи в формате для .env и platformio.ini.
 */

import { generateKeyPair, loadPrivateKey, getPublicKeyHex } from './ed25519';

const { privateKeyHex, publicKeyHex } = generateKeyPair();

console.log('╔══════════════════════════════════════════════╗');
console.log('║   Ed25519 Key Pair for Velo Backend         ║');
console.log('╠══════════════════════════════════════════════╣');
console.log('║                                              ║');
console.log('║  Скопировать в backend/.env:                 ║');
console.log('║  ED25519_PRIVATE_KEY=' + privateKeyHex);
console.log('║                                              ║');
console.log('║  Скопировать в firmware/platformio.ini:      ║');
console.log('║  -DBACKEND_PUBLIC_KEY_HEX=\\"' + publicKeyHex + '\\"');
console.log('║                                              ║');
console.log('╚══════════════════════════════════════════════╝');

// Верификация — проверяем что публичный ключ восстанавливается корректно
const privKey = loadPrivateKey(privateKeyHex);
const recoveredPubHex = getPublicKeyHex(privKey);

if (recoveredPubHex === publicKeyHex) {
  console.log('\n✅ Self-test passed: public key matches.');
} else {
  console.error('\n❌ Self-test FAILED: public key mismatch!');
  process.exit(1);
}