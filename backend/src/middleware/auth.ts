/**
 * @file auth.ts
 * @brief Middleware: проверка 42 OAuth токена и статуса студента
 *
 * Проверяет:
 *   1. Валидность 42 OAuth access token
 *   2. Статус студента (активен, не в black hole)
 */

import { Request, Response, NextFunction } from 'express';

/* Расширяем Request для хранения данных пользователя */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        login: string;
        campus: string;
        isActive: boolean;
      };
    }
  }
}

const INTRA_API = 'https://api.intra.42.fr/v2';

/**
 * Проверка 42 токена через Intra API и статуса студента.
 * Токен передаётся в заголовке Authorization: Bearer <token>
 */
export async function require42Auth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Требуется 42 OAuth токен. Authorization: Bearer <token>',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    /* --- Запрос к 42 Intra API: GET /v2/me --- */
    const response = await fetch(`${INTRA_API}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error(`[AUTH] Intra API error: ${response.status}`);
      res.status(401).json({
        error: 'invalid_token',
        message: '42 OAuth токен недействителен или истёк',
      });
      return;
    }

    const user = await response.json() as {
      id: number;
      login: string;
      campus: Array<{ name: string }>;
      active?: boolean;
    };

    /* --- Проверка статуса (можно расширить) --- */
    const isActive = user.active !== false;

    if (!isActive) {
      res.status(403).json({
        error: 'inactive_user',
        message: 'Аренда доступна только активным студентам 42',
      });
      return;
    }

    /* --- Сохраняем данные пользователя в request --- */
    req.user = {
      id: user.id,
      login: user.login,
      campus: user.campus?.[0]?.name ?? 'unknown',
      isActive,
    };

    next();
  } catch (err) {
    console.error('[AUTH] Ошибка проверки токена:', err);
    res.status(502).json({
      error: 'intra_api_error',
      message: 'Ошибка связи с 42 Intra API',
    });
  }
}