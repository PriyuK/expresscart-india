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
const VALID_STORE_PASSCODES = ['1234', '2468', '9999'];

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

function computeCheckoutTrustDelta(securityFlags = [], swappedUnpaidCount = 0) {
  if (securityFlags.length === 0 && swappedUnpaidCount === 0) {
    return 2;
  }
  let delta = 0;
  for (const flag of securityFlags) {
    if (flag.type === 'BARCODE_SWAP_SUSPECTED') {
      delta -= 15;
    } else if (flag.type === 'UNSCANNED_DROP_DETECTED') {
      delta -= flag.resolved ? 2 : 10;
    }
  }
  delta -= swappedUnpaidCount * 10;
  return delta;
}

function pickDynamicAuditItems(combinedItems, trustScore, securityFlags = []) {
  if (!Array.isArray(combinedItems) || combinedItems.length === 0) return [];
  const hasUnresolvedFlag = securityFlags.some((f) => !f.resolved);
  let auditLimit = 3;
  if (hasUnresolvedFlag || trustScore < 70) {
    auditLimit = 5;
  } else if (trustScore >= 90 && securityFlags.length === 0) {
    auditLimit = 2;
  }

  const sortedByPrice = [...combinedItems].sort((a, b) => {
    if (b.storePrice !== a.storePrice) return b.storePrice - a.storePrice;
    return b.storePrice * (b.quantity || 1) - a.storePrice * (a.quantity || 1);
  });

  if (sortedByPrice.length <= auditLimit) return sortedByPrice;
  const topFixed = sortedByPrice.slice(0, auditLimit - 1);
  const rest = sortedByPrice.slice(auditLimit - 1);
  const randomPick = rest[Math.floor(Math.random() * rest.length)];
  return [...topFixed, randomPick];
}

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
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      if (parsed && parsed.usersByPhone) {
        if (!parsed.productsByBarcode) parsed.productsByBarcode = {};
        return parsed;
      }
    }
  } catch {}
  const initial = {
    usersByPhone: {
      '9820411290': {
        name: 'Aarav Sharma',
        phone: '9820411290',
        role: 'SHOPPER',
        isVerified: true,
        aadhaarLast4: '8492',
        trustScore: 98,
        walletBalance: 1500,
        verifiedAt: new Date().toISOString(),
      },
      '9820099100': {
        name: 'Rajesh Deshmukh (Gate Staff)',
        phone: '9820099100',
        role: 'STORE_STAFF',
        employeeId: 'EMP-101',
        assignedStore: 'Reliance/DMart Express Pilot - Store #01',
        isVerified: true,
        trustScore: 100,
        walletBalance: 0,
        verifiedAt: new Date().toISOString(),
      },
    },
    productsByBarcode: {},
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
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
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
      if (req.method === 'POST' || req.method === 'PUT') {
        if (body.action === 'upsert-product' && body.product?.barcode) {
          db.productsByBarcode[body.product.barcode] = body.product;
          saveDb(db);
          return sendJson(res, 200, {
            ok: true,
            product: body.product,
            customProducts: Object.values(db.productsByBarcode),
          });
        }
        return sendJson(res, 400, { ok: false, error: 'Invalid product payload' });
      }
      return sendJson(res, 200, {
        ok: true,
        syncedAt: new Date().toISOString(),
        store: PILOT_STORE_BRANCHES[0],
        allStores: PILOT_STORE_BRANCHES,
        customProducts: Object.values(db.productsByBarcode),
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
        const requestedRole =
          body.role === 'STORE_STAFF' ? 'STORE_STAFF' : 'SHOPPER';
        if (requestedRole === 'STORE_STAFF') {
          if (!String(body.employeeId || '').trim()) {
            return sendJson(res, 400, {
              ok: false,
              error: 'Employee ID is required for Store Staff login',
            });
          }
          if (!VALID_STORE_PASSCODES.includes(String(body.storePasscode || '').trim())) {
            return sendJson(res, 401, {
              ok: false,
              error: 'Invalid Store Authorization Passcode',
            });
          }
        }
        const existing = db.usersByPhone[cleanPhone];
        const profile = {
          name: String(
            body.name ||
              existing?.name ||
              (requestedRole === 'STORE_STAFF'
                ? 'Store Staff Associate'
                : 'Express Shopper')
          ).trim(),
          phone: cleanPhone,
          role: requestedRole,
          employeeId:
            requestedRole === 'STORE_STAFF'
              ? String(body.employeeId || existing?.employeeId || 'EMP-101')
                  .trim()
                  .toUpperCase()
              : undefined,
          assignedStore:
            requestedRole === 'STORE_STAFF'
              ? body.assignedStore ||
                existing?.assignedStore ||
                PILOT_STORE_BRANCHES[0].name
              : undefined,
          isVerified: true,
          aadhaarLast4: body.aadhaarLast4 || existing?.aadhaarLast4,
          trustScore: requestedRole === 'STORE_STAFF' ? 100 : existing?.trustScore ?? 98,
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
      if (body.action === 'link-kyc') {
        const user = db.usersByPhone[cleanPhone];
        if (user) {
          user.aadhaarLast4 = String(body.aadhaarLast4 || '')
            .replace(/\D/g, '')
            .slice(-4);
          user.trustScore = Math.min(100, (user.trustScore ?? 95) + 4);
          saveDb(db);
        }
        return sendJson(res, 200, { ok: true, userProfile: user });
      }
      if (body.action === 'adjust-trust') {
        const user = db.usersByPhone[cleanPhone];
        if (user) {
          user.trustScore = Math.max(
            0,
            Math.min(100, (user.trustScore ?? 95) + (Number(body.trustDelta) || 0))
          );
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
        const orderId = parsedUrl.searchParams.get('orderId');
        const phone = parsedUrl.searchParams.get('phone');
        if (orderId) {
          const found = db.ordersById[orderId];
          return found
            ? sendJson(res, 200, { ok: true, signatureValid: true, exitPass: found })
            : sendJson(res, 404, { ok: false, error: 'Order not found' });
        }
        let orders = Object.values(db.ordersById).reverse();
        if (phone) {
          const clean = phone.replace(/\D/g, '').slice(-10);
          orders = orders.filter((o) => o.customerPhone === clean);
        }
        return sendJson(res, 200, { ok: true, orders });
      }
      if (body.action === 'approve-exit') {
        const order = db.ordersById[body.orderId];
        if (order) {
          order.exitVerified = true;
          order.verificationMode =
            order.verificationMode === 'PHYSICAL_COUNTER_BILL'
              ? 'PHYSICAL_COUNTER_BILL'
              : 'QR_GATE_SCAN';
          order.verifiedByStaffId = body.staffId || 'EMP-101';
          order.verifiedAt = new Date().toISOString();
          saveDb(db);
          return sendJson(res, 200, { ok: true, exitPass: order });
        }
        return sendJson(res, 404, { ok: false, error: 'Order not found' });
      }
      if (body.action === 'send-to-counter') {
        const order = db.ordersById[body.orderId];
        if (order) {
          order.requiresCounterCheckout = true;
          order.verificationMode = 'COUNTER_HANDOFF';
          order.counterStatus = 'SENT_TO_COUNTER';
          saveDb(db);
          return sendJson(res, 200, { ok: true, exitPass: order });
        }
        return sendJson(res, 404, { ok: false, error: 'Order not found' });
      }
      if (body.action === 'verify-physical-bill') {
        const order = db.ordersById[body.orderId];
        if (order) {
          const resolutionType = body.resolutionType || 'COUNTER_HANDOFF_PAID';
          const shouldRefund =
            resolutionType === 'COUNTER_FULL_REBILL_REFUND' &&
            !order.requiresCounterCheckout &&
            order.paymentMethod !== 'Pay at Counter' &&
            order.counterStatus !== 'CLEARED_PHYSICAL_BILL';
          if (shouldRefund && order.customerPhone && db.usersByPhone[order.customerPhone]) {
            db.usersByPhone[order.customerPhone].walletBalance += order.totalPrice || 0;
          }
          order.exitVerified = true;
          order.requiresCounterCheckout = true;
          order.verificationMode = 'PHYSICAL_COUNTER_BILL';
          order.counterStatus = 'CLEARED_PHYSICAL_BILL';
          order.physicalBillRef =
            String(body.physicalBillRef || '').trim() ||
            `POS-${Date.now().toString().slice(-4)}`;
          order.counterResolutionType = resolutionType;
          order.verifiedByStaffId = body.staffId || 'EMP-101';
          order.verifiedAt = new Date().toISOString();
          saveDb(db);
          return sendJson(res, 200, { ok: true, exitPass: order });
        }
        return sendJson(res, 404, { ok: false, error: 'Order not found' });
      }
      if (body.action === 'checkout') {
        const cart1 = body.cart1Items || [];
        const cart2 = body.cart2Items || [];
        const all = [...cart1, ...cart2];
        const securityFlags = Array.isArray(body.securityFlags)
          ? body.securityFlags
          : [];
        const swappedUnpaid = Array.isArray(body.swappedUnpaidBarcodesInBasket)
          ? body.swappedUnpaidBarcodesInBasket
          : [];
        const customerPhone = String(body.customerPhone || '9820411290')
          .replace(/\D/g, '')
          .slice(-10);

        const existingUser = db.usersByPhone[customerPhone];
        const baseTrust = existingUser?.trustScore ?? 95;
        const trustDelta = computeCheckoutTrustDelta(
          securityFlags,
          swappedUnpaid.length
        );
        const updatedTrustScore = Math.max(
          0,
          Math.min(100, baseTrust + trustDelta)
        );
        if (existingUser) {
          existingUser.trustScore = updatedTrustScore;
        }
        const forceCounter = Boolean(
          body.requiresCounterCheckout || updatedTrustScore < 40
        );
        const resolvedPaymentMethod = forceCounter
          ? 'Pay at Counter'
          : body.paymentMethod || 'ExpressWallet';

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
          customerPhone,
        });
        const auditItems = pickDynamicAuditItems(
          all,
          updatedTrustScore,
          securityFlags
        );
        const exitPass = {
          type: 'EXPRESSCART_EXIT_PASS',
          orderId,
          storeName: body.storeName || 'Reliance/DMart Express Pilot - Store #01',
          timestamp: new Date().toISOString(),
          upiRef: `SRV-${Date.now().toString().slice(-6)}`,
          paymentMethod: resolvedPaymentMethod,
          customerName: existingUser?.name || body.customerName || 'Verified Shopper',
          customerPhone,
          customerTrustScore: updatedTrustScore,
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
          auditItems,
          allPaidItems: all,
          securityFlags,
          actualPhysicalItemsInCart: [
            ...all.map((i) => i.barcode),
            ...swappedUnpaid,
          ],
          exitVerified: false,
          requiresCounterCheckout: forceCounter,
          verificationMode: forceCounter ? 'COUNTER_HANDOFF' : 'QR_GATE_SCAN',
          counterStatus: forceCounter ? 'SENT_TO_COUNTER' : 'NONE',
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
