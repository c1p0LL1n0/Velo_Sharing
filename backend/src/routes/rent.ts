/**
 * @file rent.ts
 * @brief POST /api/rent/challenge — подпись challenge для аренды велосипеда
 *
 * Процесс:
 *   1. Телефон читает 32-байтный challenge с ESP32 по BLE.
 *   2. Телефон отправляет challenge_hex (64 hex-символа) + bike_id на бэкенд.
 *   3. Бэкенд проверяет 42-авторизацию (middleware).
 *   4. Бэкенд подписывает challenge ПРИВАТНЫМ Ed25519 ключом.
 *   5. Возвращает 64-байтную подпись (128 hex-символов) телефону.
 *   6. Телефон пишет подпись в BLE-характеристику ESP32 → замок открывается.
 */

import { Router, Request, Response } from 'express';
import { KeyObject } from 'node:crypto';
import { signChallenge } from '../crypto/ed25519';
import { startRental } from '../store/store';
import { require42Auth } from '../middleware/auth';

const router = Router();

/**
 * Глобальный приватный ключ (инициализируется при старте сервера).
 * Устанавливается извне через setPrivateKey().
 */
let PRIVATE_KEY: KeyObject | null = null;

export function setPrivateKey(key: KeyObject): void {
  PRIVATE_KEY = key;
}

/* ================================================================
 * POST /api/rent/challenge
 * Body: { bike_id: string, challenge_hex: string }
 * Headers: Authorization: Bearer <42_access_token>
 * Response: { signature_hex: string, bike_id: string, expires_at: number }
 * ================================================================ */
router.post(
  '/challenge',
  require42Auth,
  async (req: Request, res: Response): Promise<void> => {
    const { bike_id, challenge_hex } = req.body;

    /* --- Валидация входных данных --- */
    if (!bike_id || typeof bike_id !== 'string') {
      res.status(400).json({
        error: 'missing_bike_id',
        message: 'Требуется bike_id (например, "42_CAMPUS_BIKE_01")',
      });
      return;
    }

    if (!challenge_hex || typeof challenge_hex !== 'string') {
      res.status(400).json({
        error: 'missing_challenge',
        message: 'Требуется challenge_hex (64 hex-символа = 32 байта)',
      });
      return;
    }

    if (challenge_hex.length !== 64) {
      res.status(400).json({
        error: 'bad_challenge_length',
        message: `Challenge должен быть 64 hex-символа, получено ${challenge_hex.length}`,
      });
      return;
    }

    /* --- Парсинг challenge --- */
    let challenge: Buffer;
    try {
      challenge = Buffer.from(challenge_hex, 'hex');
    } catch {
      res.status(400).json({
        error: 'bad_hex',
        message: 'challenge_hex содержит невалидные hex-символы',
      });
      return;
    }

    if (challenge.length !== 32) {
      res.status(400).json({
        error: 'bad_challenge_size',
        message: `Challenge должен быть 32 байта, получено ${challenge.length}`,
      });
      return;
    }

    /* --- Проверка: приватный ключ загружен --- */
    if (!PRIVATE_KEY) {
      console.error('[RENT] Приватный ключ не загружен! Проверьте ED25519_PRIVATE_KEY в .env');
      res.status(500).json({
        error: 'server_error',
        message: 'Криптографический модуль не инициализирован',
      });
      return;
    }

    /* --- Подпись challenge --- */
    let signature: Buffer;
    try {
      signature = signChallenge(PRIVATE_KEY, challenge);
    } catch (err) {
      console.error('[RENT] Ошибка подписи:', err);
      res.status(500).json({
        error: 'signing_error',
        message: 'Внутренняя ошибка криптографической подписи',
      });
      return;
    }

    /* --- Успех --- */
    const user = req.user!;

    /* Записать аренду в стор */
    const rental = startRental(bike_id, user.login);
    if (!rental) {
      res.status(409).json({
        error: 'bike_busy',
        message: `Велосипед ${bike_id} уже занят или не существует`,
      });
      return;
    }

    console.log(
      `[RENT] ✅ ${user.login} (ID:${user.id}) арендует ${bike_id}`
    );

    res.json({
      signature_hex: signature.toString('hex'),
      bike_id,
      user: {
        login: user.login,
        campus: user.campus,
      },
      rental: {
        started_at: rental.rented_at,
        return_deadline: rental.return_deadline,
      },
      expires_at: Math.floor(Date.now() / 1000) + 300, // 5 минут на передачу
    });
  }
);

export default router;