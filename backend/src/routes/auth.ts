/**
 * @file auth.ts
 * @brief POST /api/auth/callback — 42 OAuth 2.0 колбэк
 *
 * Обменивает authorization code на access token.
 * Токен возвращается клиенту для последующих запросов.
 */

import { Router, Request, Response } from 'express';

const router = Router();

const INTRA_TOKEN_URL = 'https://api.intra.42.fr/oauth/token';

router.post('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body;

  if (!code) {
    res.status(400).json({
      error: 'missing_code',
      message: 'Требуется authorization code от 42 OAuth',
    });
    return;
  }

  const uid = process.env.INTRA_UID;
  const secret = process.env.INTRA_SECRET;
  const redirectUri = process.env.INTRA_REDIRECT_URI;

  if (!uid || !secret) {
    console.error('[AUTH] INTRA_UID и INTRA_SECRET не заданы в .env');
    res.status(500).json({
      error: 'config_error',
      message: 'OAuth не настроен на сервере',
    });
    return;
  }

  try {
    const response = await fetch(INTRA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: uid,
        client_secret: secret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[AUTH] Token exchange failed: ${response.status}`, errBody);
      res.status(401).json({
        error: 'token_exchange_failed',
        message: 'Не удалось обменять code на токен',
      });
      return;
    }

    const data = await response.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token?: string;
    };

    console.log(`[AUTH] ✅ Token issued for user (expires in ${data.expires_in}s)`);

    res.json({
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token ?? null,
    });
  } catch (err) {
    console.error('[AUTH] Ошибка обмена токена:', err);
    res.status(502).json({
      error: 'intra_api_error',
      message: 'Ошибка связи с 42 API',
    });
  }
});

export default router;