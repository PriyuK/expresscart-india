import {
  dbGetCatalogAndStores,
  dbUpsertProduct,
} from '../db/database';
import { BackendCatalogItem } from '../db/seedData';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};
    const { action, product } = body;

    if (action === 'upsert-product' && product && product.barcode) {
      const cleanBarcode = String(product.barcode).trim();
      const mrp = Math.max(1, Number(product.mrp) || 100);
      const storePrice = Math.min(
        mrp,
        Math.max(1, Number(product.storePrice) || mrp)
      );
      const weightGrams = Math.max(1, Number(product.weightGrams) || 250);
      const offerType = product.offerType || 'NONE';
      const offerTagMap: Record<string, string | undefined> = {
        NONE: undefined,
        BOGO: 'Buy 1 Get 1 Free',
        BUY_2_EXTRA_10_OFF: 'Buy 2+ get extra 10% off',
        BUY_3_FLAT_15_OFF: 'Buy 3+ get 15% off',
      };

      const itemToSave: BackendCatalogItem = {
        barcode: cleanBarcode,
        name: String(product.name || 'New Store Product').trim(),
        brand: String(product.brand || 'Store Brand').trim(),
        unit: String(product.unit || `${weightGrams} g`).trim(),
        category: String(product.category || 'Staples & Grains').trim(),
        mrp,
        storePrice,
        weightGrams,
        emoji:
          String(product.brand || product.name || 'SK')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 2)
            .toUpperCase() || 'SK',
        bgColor: product.bgColor || '#F4F4F5',
        accentColor: product.accentColor || '#18181B',
        aisle: String(product.aisle || 'Aisle 01').trim(),
        gstPercent: Number(product.gstPercent ?? 12),
        offerType,
        offerTag: product.offerTag || offerTagMap[offerType],
        packageColorHex: product.packageColorHex || '#10B981',
        packageColorName: String(
          product.packageColorName || 'Standard Retail Pack'
        ).trim(),
        isQuickTest: Boolean(product.isQuickTest),
        isHighValueAudit: storePrice >= 300,
      };

      const savedProduct = await dbUpsertProduct(itemToSave);
      const { products } = await dbGetCatalogAndStores();
      return res.status(200).json({
        ok: true,
        product: savedProduct,
        catalog: products,
      });
    }

    return res.status(400).json({ ok: false, error: 'Invalid catalog mutation' });
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
