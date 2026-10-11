/**
 * @file bikes.ts
 * @brief GET /api/bikes — список велосипедов со статусами
 */

import { Router, Request, Response } from 'express';
import { getAllBikes } from '../store/store';

const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  const bikes = getAllBikes();
  const free = bikes.filter(b => b.status === 'free').length;
  const rented = bikes.filter(b => b.status === 'rented').length;

  res.json({ total: bikes.length, free, rented, bikes });
});

export default router;