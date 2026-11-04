import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { URL } from 'node:url';

const PORT = process.env.PORT || 4000;
const HMAC_SECRET =
  process.env.EXPRESSCART_HMAC_SECRET || 'expresscart-india-hmac-secret-2026';
const DB_FILE = path.join(os.tmpdir(), 'expresscart-india-backend-db.json');

const PILOT_STORE_BRANCHES = [
  {
    id: 'store-mumbai-01',
    name: 'Reliance/DMart Express Pilot - Store #01',
    shortName: 'DMart Express — Lower Parel #01',
    chain: 'DMart',
    city: 'Lower Parel, Mumbai',
    lane: 'Express Gate A',
    latitude: 18.9952,
    longitude: 72.8291,
    catalogVersion: 'v2026.11.04-LP',
    catalogSizeKb: 412,
  },
  {
    id: 'store-powai-04',
    name: 'DMart Ready Express - Powai #04',
    shortName: 'DMart Ready — Powai #04',
    chain: 'DMart',
    city: 'Hiranandani, Powai',
    lane: 'Express Gate B',
    latitude: 19.1176,
    longitude: 72.906,
    catalogVersion: 'v2026.11.04-PW',
    catalogSizeKb: 388,
  },
  {
    id: 'store-blr-09',
    name: 'Reliance Smart Point - Indiranagar #09',
    shortName: 'Reliance Smart Point — Indiranagar #09',
    chain: 'Reliance Smart',
    city: '100 Ft Rd, Bengaluru',
    lane: 'Express Gate A',
    latitude: 12.9784,
    longitude: 77.6408,
    catalogVersion: 'v2026.11.04-BLR',
    catalogSizeKb: 445,
  },
];

function signExitPass({
  orderId,
  storeName,
  totalPrice,
  totalItemCount,
  cartWeightGrams,
  customerPhone,
}) {
  const canonical = `${orderId}|${storeName}|${totalPrice}|${totalItemCount}|${cartWeightGrams}|${customerPhone}`;
  const digest = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(canonical)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
  return `HMAC-SHA256-${digest}`;
}

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch {}
  const initial = {
    usersByPhone: {
      '9820411290': {
        name: 'Aarav Sharma',
        phone: '9820411290',
        isVerified: true,
        aadhaarLast4: '8492',
        trustScore: 98,
        walletBalance: 1500,
        verifiedAt: new Date().toISOString(),
      },
    },
    pendingOtps: {},
    familyRoomsByPin: {},
    ordersById: {},
    stores: PILOT_STORE_BRANCHES,
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  return initial;
}

function saveDb(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch {}
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;
  let bodyRaw = '';

  req.on('data', (chunk) => {
    bodyRaw += chunk;
  });

  req.on('end', () => {
    let body = {};
    try {
      if (bodyRaw) body = JSON.parse(bodyRaw);
    } catch {}

    const db = loadDb();

    if (pathname === '/' || pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        service: 'ExpressCart India Backend API',
        databaseMode: process.env.DATABASE_URL ? 'POSTGRESQL_CLOUD' : 'LOCAL_DISK_DB',
        usersCount: Object.keys(db.usersByPhone).length,
        ordersCount: Object.keys(db.ordersById).length,
      });
    }

    if (pathname === '/api/catalog') {
      return sendJson(res, 200, {
        ok: true,
        syncedAt: new Date().toISOString(),
        store: PILOT_STORE_BRANCHES[0],
        allStores: PILOT_STORE_BRANCHES,
      });
    }

    if (pathname === '/api/auth') {
      if (req.method === 'GET') {
        const phone = (parsedUrl.searchParams.get('phone') || '')
          .replace(/\D/g, '')
          .slice(-10);
        const user = db.usersByPhone[phone];
        return user
          ? sendJson(res, 200, { ok: true, userProfile: user })
          : sendJson(res, 404, { ok: false, error: 'Not found' });
      }
      const cleanPhone = String(body.phone || '9820411290')
        .replace(/\D/g, '')
        .slice(-10);
      if (body.action === 'verify-otp') {
        const existing = db.usersByPhone[cleanPhone];
        const profile = {
          name: String(body.name || existing?.name || 'Express Shopper').trim(),
          phone: cleanPhone,
          isVerified: true,
          aadhaarLast4: body.aadhaarLast4 || existing?.aadhaarLast4,
          trustScore: existing?.trustScore ?? 98,
          walletBalance: existing?.walletBalance ?? 1500,
          verifiedAt: new Date().toISOString(),
        };
        db.usersByPhone[cleanPhone] = profile;
        saveDb(db);
        return sendJson(res, 200, { ok: true, userProfile: profile });
      }
      if (body.action === 'topup-wallet') {
        const user = db.usersByPhone[cleanPhone];
        if (user) {
          user.walletBalance += Number(body.amount) || 0;
          saveDb(db);
        }
        return sendJson(res, 200, { ok: true, userProfile: user });
      }
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/family') {
      const cleanPin = String(
        body.pinCode || parsedUrl.searchParams.get('pinCode') || '4829'
      )
        .replace(/\D/g, '')
        .slice(0, 4);
      if (req.method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          room: db.familyRoomsByPin[cleanPin] || null,
        });
      }
      const existing = db.familyRoomsByPin[cleanPin] || {
        session: {
          sessionId: `FAM-${cleanPin}`,
          pinCode: cleanPin,
          hostName: body.hostName || 'Primary Shopper (Cart #1)',
          hostPhone: body.hostPhone || '9820411290',
          memberName: body.memberName || 'Family Member (Cart #2)',
          isActive: true,
          createdAt: new Date().toLocaleTimeString(),
        },
        cart1Items: [],
        cart2Items: [],
      };
      if (Array.isArray(body.cart1Items)) existing.cart1Items = body.cart1Items;
      if (Array.isArray(body.cart2Items)) existing.cart2Items = body.cart2Items;
      existing.updatedAt = new Date().toISOString();
      db.familyRoomsByPin[cleanPin] = existing;
      saveDb(db);
      return sendJson(res, 200, { ok: true, room: existing });
    }

    if (pathname === '/api/orders') {
      if (req.method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          orders: Object.values(db.ordersById),
        });
      }
      if (body.action === 'checkout') {
        const cart1 = body.cart1Items || [];
        const cart2 = body.cart2Items || [];
        const all = [...cart1, ...cart2];
        const totalItemCount = all.reduce((s, i) => s + (i.quantity || 1), 0);
        const totalPrice = all.reduce(
          (s, i) => s + i.storePrice * (i.quantity || 1),
          0
        );
        const totalMrp = all.reduce((s, i) => s + i.mrp * (i.quantity || 1), 0);
        const cartWeightGrams = all.reduce(
          (s, i) => s + i.weightGrams * (i.quantity || 1),
          0
        );
        const orderId = `EXP-IN-${Math.floor(100000 + Math.random() * 900000)}`;
        const signature = signExitPass({
          orderId,
          storeName: body.storeName || 'Reliance/DMart Express Pilot - Store #01',
          totalPrice,
          totalItemCount,
          cartWeightGrams,
          customerPhone: body.customerPhone || '9820411290',
        });
        const exitPass = {
          type: 'EXPRESSCART_EXIT_PASS',
          orderId,
          storeName: body.storeName || 'Reliance/DMart Express Pilot - Store #01',
          timestamp: new Date().toISOString(),
          upiRef: `SRV-${Date.now().toString().slice(-6)}`,
          paymentMethod: body.paymentMethod || 'ExpressWallet',
          customerName: body.customerName || 'Verified Shopper',
          customerPhone: body.customerPhone || '9820411290',
          customerTrustScore: 98,
          signature,
          totalPrice,
          totalMrp,
          totalSavings: totalMrp - totalPrice,
          totalItemCount,
          cartWeightGrams,
          isFamilyOrder: Boolean(body.isFamilyOrder),
          cart1ItemCount: cart1.reduce((s, i) => s + (i.quantity || 1), 0),
          cart1WeightGrams: cart1.reduce(
            (s, i) => s + i.weightGrams * (i.quantity || 1),
            0
          ),
          cart2ItemCount: cart2.reduce((s, i) => s + (i.quantity || 1), 0),
          cart2WeightGrams: cart2.reduce(
            (s, i) => s + i.weightGrams * (i.quantity || 1),
            0
          ),
          auditItems: all.slice(0, 3),
          allPaidItems: all,
          securityFlags: body.securityFlags || [],
        };
        db.ordersById[orderId] = exitPass;
        saveDb(db);
        return sendJson(res, 200, { ok: true, exitPass });
      }
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { ok: false, error: 'Route not found' });
  });
});

server.listen(PORT, () => {
  console.log(`ExpressCart India Backend API running on http://localhost:${PORT}`);
});

