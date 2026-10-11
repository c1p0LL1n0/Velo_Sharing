/**
 * @file store.ts
 * @brief In-Memory хранилище. Велосипеды регистрируются АВТОМАТИЧЕСКИ
 *        при первой аренде. Никакого предзаполнения.
 */

export interface BikeStatus {
  bike_id: string;
  status: 'free' | 'rented';
  user: string | null;
  rented_at: number | null;
  return_deadline: number | null;
}

const bikes: Map<string, BikeStatus> = new Map();

export function registerBike(bikeId: string): BikeStatus {
  const bike: BikeStatus = { bike_id: bikeId, status: 'free', user: null, rented_at: null, return_deadline: null };
  bikes.set(bikeId, bike);
  console.log(`[STORE] 🚲 Новый велосипед: ${bikeId}`);
  return bike;
}

export function getAllBikes(): BikeStatus[] { return Array.from(bikes.values()); }
export function getBike(bikeId: string): BikeStatus | undefined { return bikes.get(bikeId); }

export function startRental(bikeId: string, userLogin: string, durationMin = 120): BikeStatus | null {
  let bike = bikes.get(bikeId);
  if (!bike) bike = registerBike(bikeId);
  if (bike.status !== 'free') return null;
  const now = Math.floor(Date.now() / 1000);
  bike.status = 'rented'; bike.user = userLogin;
  bike.rented_at = now; bike.return_deadline = now + durationMin * 60;
  return { ...bike };
}

export function endRental(bikeId: string): BikeStatus | null {
  const bike = bikes.get(bikeId);
  if (!bike || bike.status !== 'rented') return null;
  bike.status = 'free'; bike.user = null;
  bike.rented_at = null; bike.return_deadline = null;
  return { ...bike };
}