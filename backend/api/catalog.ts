import { dbGetCatalogAndStores } from '../db/database';

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { stores, products, source } = await dbGetCatalogAndStores();
  const { store, lat, lng } = req.query || {};

  let matchedStore = stores[0];

  if (lat && lng) {
    const userLat = parseFloat(String(lat));
    const userLng = parseFloat(String(lng));
    if (!isNaN(userLat) && !isNaN(userLng)) {
      let minDist = Infinity;
      for (const branch of stores) {
        const d = haversineDistanceKm(
          userLat,
          userLng,
          branch.latitude,
          branch.longitude
        );
        if (d < minDist) {
          minDist = d;
          matchedStore = branch;
        }
      }
    }
  } else if (store) {
    const found = stores.find(
      (b) => b.name === store || b.id === store || b.shortName === store
    );
    if (found) matchedStore = found;
  }

  return res.status(200).json({
    ok: true,
    dbSource: source,
    syncedAt: new Date().toISOString(),
    store: matchedStore,
    allStores: stores,
    skuCount: products.length,
    catalog: products,
  });
}

