import {
  dbGetOrder,
  dbGetRecentOrders,
  dbSaveOrder,
  dbGetUser,
  dbUpsertUser,
  signExitPassPayload,
  verifyExitPassSignature,
  SEED_PRODUCTS_BY_BARCODE,
  computeBackendPromoDiscount,
  BackendExitPass,
} from '../db/database';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const orderId = String(req.query?.orderId || '').trim();
    if (orderId) {
      const pass = await dbGetOrder(orderId);
      if (pass) {
        return res.status(200).json({
          ok: true,
          signatureValid: verifyExitPassSignature(pass),
          exitPass: pass,
        });
      }
    }
    const recentOrders = await dbGetRecentOrders();
    return res.status(200).json({ ok: true, orders: recentOrders });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { action } = body;

  if (action === 'checkout') {
    const {
      storeName,
      paymentMethod = 'ExpressWallet',
      customerName = 'Verified Shopper',
      customerPhone = '9820411290',
      cart1Items = [],
      cart2Items = [],
      isFamilyOrder = false,
      familySessionCode,
      securityFlags = [],
      swappedUnpaidBarcodesInBasket = [],
    } = body;

    const cleanPhone = String(customerPhone).replace(/\D/g, '').slice(-10);

    const combinedMap: Record<string, any> = {};
    [...cart1Items, ...cart2Items].forEach((item: any) => {
      if (combinedMap[item.barcode]) {
        combinedMap[item.barcode] = {
          ...combinedMap[item.barcode],
          quantity: combinedMap[item.barcode].quantity + item.quantity,
        };
      } else {
        combinedMap[item.barcode] = { ...item };
      }
    });
    const combinedItems = Object.values(combinedMap);

    const cart1ItemCount = cart1Items.reduce((s: number, i: any) => s + i.quantity, 0);
    const cart1WeightGrams = cart1Items.reduce(
      (s: number, i: any) => s + i.weightGrams * i.quantity,
      0
    );
    const cart2ItemCount = cart2Items.reduce((s: number, i: any) => s + i.quantity, 0);
    const cart2WeightGrams = cart2Items.reduce(
      (s: number, i: any) => s + i.weightGrams * i.quantity,
      0
    );

    const totalItemCount = cart1ItemCount + cart2ItemCount;
    const rawStoreTotal = combinedItems.reduce(
      (s: number, i: any) => s + i.storePrice * i.quantity,
      0
    );
    const totalMrp = combinedItems.reduce(
      (s: number, i: any) => s + i.mrp * i.quantity,
      0
    );
    const promoSavings = combinedItems.reduce((s: number, i: any) => {
      const cat = SEED_PRODUCTS_BY_BARCODE[i.barcode];
      return (
        s +
        computeBackendPromoDiscount(
          { storePrice: i.storePrice, offerType: i.offerType || cat?.offerType },
          i.quantity
        )
      );
    }, 0);

    const totalPrice = Math.max(0, rawStoreTotal - promoSavings);
    const totalSavings = totalMrp - totalPrice;
    const cartWeightGrams = cart1WeightGrams + cart2WeightGrams;

    const user = await dbGetUser(cleanPhone);
    if (paymentMethod === 'ExpressWallet' && user) {
      if (user.walletBalance < totalPrice) {
        return res.status(400).json({
          ok: false,
          error: `Insufficient backend wallet balance (₹${user.walletBalance})`,
        });
      }
      user.walletBalance -= totalPrice;
      await dbUpsertUser(user);
    }

    const sortedByPrice = [...combinedItems].sort((a, b) => b.storePrice - a.storePrice);
    let auditItems = sortedByPrice;
    if (sortedByPrice.length > 3) {
      const topTwo = sortedByPrice.slice(0, 2);
      const rest = sortedByPrice.slice(2);
      const randThird = rest[Math.floor(Math.random() * rest.length)];
      auditItems = [...topTwo, randThird];
    }

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderId = `EXP-IN-${randomSuffix}`;
    const upiRef = `${String(paymentMethod)
      .replace(/\s+/g, '')
      .toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const timestamp = new Date().toISOString();

    const signature = signExitPassPayload({
      orderId,
      storeName: storeName || 'Reliance/DMart Express Pilot - Store #01',
      totalPrice,
      totalItemCount,
      cartWeightGrams,
      customerPhone: cleanPhone,
    });

    const exitPass: BackendExitPass = {
      type: 'EXPRESSCART_EXIT_PASS',
      orderId,
      storeName: storeName || 'Reliance/DMart Express Pilot - Store #01',
      timestamp,
      upiRef,
      paymentMethod,
      customerName: user?.name || customerName,
      customerPhone: cleanPhone,
      customerTrustScore: user?.trustScore ?? 95,
      signature,
      totalPrice,
      totalMrp,
      totalSavings,
      promoSavings,
      totalItemCount,
      cartWeightGrams,
      isFamilyOrder: Boolean(isFamilyOrder && cart2ItemCount > 0),
      familySessionCode,
      cart1ItemCount,
      cart1WeightGrams,
      cart2ItemCount,
      cart2WeightGrams,
      auditItems,
      allPaidItems: combinedItems,
      securityFlags,
      actualPhysicalItemsInCart: [
        ...combinedItems.map((i: any) => i.barcode),
        ...swappedUnpaidBarcodesInBasket,
      ],
    };

    await dbSaveOrder(exitPass);

    return res.status(200).json({
      ok: true,
      exitPass,
      walletBalance: user?.walletBalance,
    });
  }

  if (action === 'reverse-spot-scan') {
    const { orderId, scannedBarcode, fallbackPass } = body;
    const pass = (await dbGetOrder(orderId)) || fallbackPass;
    const catItem = SEED_PRODUCTS_BY_BARCODE[String(scannedBarcode || '').trim()];

    if (!pass || !catItem) {
      return res.status(404).json({ ok: false, error: 'Order or product SKU not found' });
    }

    const signatureValid = verifyExitPassSignature(pass);
    const paidList = pass.allPaidItems || pass.auditItems || [];
    const paidMatch = paidList.find((i: any) => i.barcode === catItem.barcode);

    if (paidMatch) {
      return res.status(200).json({
        ok: true,
        signatureValid,
        status: 'PAID_OK',
        barcode: catItem.barcode,
        name: catItem.name,
        price: catItem.storePrice,
        weightGrams: catItem.weightGrams,
        detail: `Database Verified on Bill ${pass.orderId} (Qty: ${paidMatch.quantity} paid · ₹${paidMatch.storePrice} · ${pass.signature})`,
      });
    }

    const cleanPhone = String(pass.customerPhone || '').replace(/\D/g, '').slice(-10);
    if (cleanPhone) {
      const user = await dbGetUser(cleanPhone);
      if (user) {
        user.trustScore = Math.max(40, user.trustScore - 15);
        await dbUpsertUser(user);
      }
    }

    return res.status(200).json({
      ok: true,
      signatureValid,
      status: 'UNPAID_THEFT_CAUGHT',
      barcode: catItem.barcode,
      name: catItem.name,
      price: catItem.storePrice,
      weightGrams: catItem.weightGrams,
      detail: `DATABASE ALERT! ${catItem.name} (₹${catItem.storePrice}, ${catItem.weightGrams}g) is physically in the cart but was NEVER scanned or paid on Bill ${pass.orderId}! Shopper Trust Score penalized by -15 pts.`,
    });
  }

  return res.status(400).json({ ok: false, error: 'Unsupported orders action' });
}

