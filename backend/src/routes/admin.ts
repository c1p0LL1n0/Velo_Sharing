/**
 * @file admin.ts
 * @brief POST /api/admin/register — регистрация нового велосипеда админом
 */

import { Router, Request, Response } from 'express';
import { registerBike } from '../store/store';
import { require42Auth } from '../middleware/auth';

const router = Router();

router.post('/register-bike', require42Auth, (req: Request, res: Response): void => {
  const { bike_id } = req.body;
  if (!bike_id) {
    res.status(400).json({ error: 'missing_bike_id' });
    return;
  }
  const bike = registerBike(bike_id);
  res.json({ success: true, bike });
});

export default router;