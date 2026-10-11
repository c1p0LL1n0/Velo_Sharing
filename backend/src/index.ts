/**
 * @file index.ts
 * @brief Точка входа облачного бэкенда Velo (Express + TypeScript)
 *
 * Запуск:
 *   npm run dev    → разработка с hot-reload (tsx watch)
 *   npm run build && npm start → production
 *
 * Переменные окружения: см. .env.example
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { loadPrivateKey, getPublicKeyHex } from './crypto/ed25519';
import { setPrivateKey } from './routes/rent';
import authRoutes from './routes/auth';
import rentRoutes from './routes/rent';
import bikesRoutes from './routes/bikes';
import adminRoutes from './routes/admin';

/* ================================================================
 * Инициализация
 * ================================================================ */
const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

/* ---- Middleware ---- */
app.use(cors());
app.use(express.json());

/* ---- Здоровье ---- */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'velo-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/* ---- Роуты ---- */
app.use('/api/auth', authRoutes);
app.use('/api/rent', rentRoutes);
app.use('/api/bikes', bikesRoutes);
app.use('/api/admin', adminRoutes);

/* ---- 404 ---- */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found' });
});

/* ================================================================
 * Загрузка Ed25519 приватного ключа
 * ================================================================ */
function initCrypto(): void {
  const privateKeyHex = process.env.ED25519_PRIVATE_KEY;

  if (!privateKeyHex) {
    console.error('╔══════════════════════════════════════════════╗');
    console.error('║ ❌ ED25519_PRIVATE_KEY не задан в .env!     ║');
    console.error('║    Запустите: npm run keygen               ║');
    console.error('║    И скопируйте ключ в .env                ║');
    console.error('╚══════════════════════════════════════════════╝');
    process.exit(1);
  }

  try {
    const privateKey = loadPrivateKey(privateKeyHex);
    setPrivateKey(privateKey);

    const publicKeyHex = getPublicKeyHex(privateKey);
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  🔐 Ed25519 Crypto Module Loaded            ║');
    console.log(`║  Public Key: ${publicKeyHex.slice(0, 16)}...  ║`);
    console.log('╚══════════════════════════════════════════════╝');
  } catch (err) {
    console.error('[FATAL] Ошибка загрузки Ed25519 ключа:', err);
    process.exit(1);
  }
}

/* ================================================================
 * Запуск
 * ================================================================ */
initCrypto();

app.listen(PORT, () => {
  console.log(`\n🚲 Velo Backend running on http://localhost:${PORT}`);
  console.log('   Endpoints:');
  console.log(`   GET  /api/health`);
  console.log(`   POST /api/auth/callback`);
  console.log(`   POST /api/rent/challenge  [42 OAuth required]`);
  console.log(`   GET  /api/bikes             [список + статусы]`);
  console.log('\n   Ожидаю запросы аренды...\n');
});

export default app;