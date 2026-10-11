/**
 * @file index.ts
 * @brief Slack Bolt Bot — интерфейс аренды велосипедов через Slack
 *
 * Команды:
 *   /rent [bike_id]  — Начать аренду велосипеда
 *
 * Переменные окружения:
 *   SLACK_BOT_TOKEN=xoxb-...
 *   SLACK_SIGNING_SECRET=...
 *   SLACK_APP_TOKEN=xapp-...    (для Socket Mode)
 *   BACKEND_URL=http://localhost:3000
 */

import 'dotenv/config';
import { App, LogLevel } from '@slack/bolt';

/* ---- Конфигурация ---- */
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: LogLevel.INFO,
});

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';
const PWA_URL = process.env.PWA_URL ?? 'https://velo.example.com';

/* ================================================================
 * Команда: /rent <bike_id>
 * ================================================================ */
app.command('/rent', async ({ command, ack, client, respond }) => {
  await ack();

  const bikeId = command.text.trim();
  if (!bikeId) {
    await respond({
      text: '❌ Укажите ID велосипеда.\nПример: `/rent 42_CAMPUS_BIKE_01`',
      response_type: 'ephemeral',
    });
    return;
  }

  await respond({
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚲 *Аренда велосипеда ${bikeId}*\n\nНажмите кнопку ниже, чтобы открыть интерфейс аренды.`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔓 Арендовать',
              emoji: true,
            },
            style: 'primary',
            action_id: `rent_bike_${bikeId}`,
            value: bikeId,
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📱 Открыть PWA',
              emoji: true,
            },
            url: `${PWA_URL}?bike=${encodeURIComponent(bikeId)}`,
            action_id: 'open_pwa',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '⚡ Кнопка "Арендовать" требует Web Bluetooth (откройте в мобильном браузере).',
          },
        ],
      },
    ],
  });
});

/* ================================================================
 * Кнопка "Арендовать" (интерактивный ответ)
 * ================================================================ */
app.action(/rent_bike_.*/, async ({ action, ack, body, client }) => {
  await ack();

  const bikeId = (action as any).value as string;
  const userId = body.user.id;

  /* Отправляем инструкцию пользователю в DM */
  try {
    await client.chat.postEphemeral({
      channel: body.channel?.id ?? '',
      user: userId,
      text: '',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🔑 *Аренда ${bikeId}: Инструкция*\n\n` +
              `1. Подойдите к велосипеду\n` +
              `2. Отсканируйте QR-код на велосипеде\n` +
              `3. Или откройте в браузере: ${PWA_URL}?bike=${encodeURIComponent(bikeId)}\n\n` +
              `⚠️ *Требуется Chrome на Android* для Web Bluetooth.`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '📱 Открыть PWA', emoji: true },
              url: `${PWA_URL}?bike=${encodeURIComponent(bikeId)}`,
              action_id: 'pwa_deeplink',
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error('[Slack] Ошибка отправки DM:', err);
  }
});

/* ================================================================
 * Запуск
 * ================================================================ */
(async () => {
  const port = parseInt(process.env.PORT ?? '4000', 10);
  await app.start(port);
  console.log(`🤖 Slack Bot запущен на порту ${port}`);
  console.log(`   Backend URL: ${BACKEND_URL}`);
  console.log(`   PWA URL:     ${PWA_URL}`);
})();