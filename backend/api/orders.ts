import {
  dbGetOrder,
  dbGetRecentOrders,
  dbSaveOrder,
  dbMarkOrderVerified,
  dbSendOrderToCounter,
  dbVerifyOrderWithPhysicalBill,
  dbGetProductByBarcode,
  dbGetUser,
  dbUpsertUser,
  signExitPassPayload,
  verifyExitPassSignature,
  SEED_PRODUCTS_BY_BARCODE,
  computeBackendPromoDiscount,
  BackendExitPass,
} from '../db/database';

function computeCheckoutTrustDelta(
  securityFlags: any[] = [],
  swappedUnpaidCount = 0
): number {
  if (securityFlags.length === 0 && swappedUnpaidCount === 0) {
    return 2;
  }
  let delta = 0;
  for (const flag of securityFlags) {
    if (flag?.type === 'BARCODE_SWAP_SUSPECTED') {
      delta -= 15;
    } else if (flag?.type === 'UNSCANNED_DROP_DETECTED') {
      delta -= flag?.resolved ? 2 : 10;
    }
  }
  delta -= swappedUnpaidCount * 10;
  return delta;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const orderId = String(req.query?.orderId || '').trim();
    const phone = String(req.query?.phone || '').trim();

    if (orderId) {
      const pass = await dbGetOrder(orderId);
      if (pass) {
        return res.status(200).json({
          ok: true,
          signatureValid: verifyExitPassSignature(pass),
          exitPass: pass,
        });
      }
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    const recentOrders = await dbGetRecentOrders(phone || undefined);
    return res.status(200).json({ ok: true, orders: recentOrders });
  }

  const body =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
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

    const cart1ItemCount = cart1Items.reduce(
      (s: number, i: any) => s + i.quantity,
      0
    );
    const cart1WeightGrams = cart1Items.reduce(
      (s: number, i: any) => s + i.weightGrams * i.quantity,
      0
    );
    const cart2ItemCount = cart2Items.reduce(
      (s: number, i: any) => s + i.quantity,
      0
    );
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

    const flagsList = Array.isArray(securityFlags) ? securityFlags : [];
    const swappedList = Array.isArray(swappedUnpaidBarcodesInBasket)
      ? swappedUnpaidBarcodesInBasket
      : [];
    const trustDelta = computeCheckoutTrustDelta(flagsList, swappedList.length);
    const updatedTrustScore = Math.max(
      0,
      Math.min(100, (user?.trustScore ?? 95) + trustDelta)
    );
    const forceCounter = Boolean(
      body.requiresCounterCheckout || updatedTrustScore < 40
    );
    const resolvedPaymentMethod = forceCounter ? 'Pay at Counter' : paymentMethod;

    if (!forceCounter && resolvedPaymentMethod === 'ExpressWallet' && user) {
      if (user.walletBalance < totalPrice) {
        return res.status(400).json({
          ok: false,
          error: `Insufficient wallet balance (₹${user.walletBalance})`,
        });
      }
      user.walletBalance -= totalPrice;
    }

    if (user) {
      user.trustScore = updatedTrustScore;
      await dbUpsertUser(user);
    }

    const hasUnresolvedFlag = flagsList.some((f: any) => !f?.resolved);
    let auditLimit = 3;
    if (hasUnresolvedFlag || updatedTrustScore < 70) {
      auditLimit = 5;
    } else if (updatedTrustScore >= 90 && flagsList.length === 0) {
      auditLimit = 2;
    }

    const sortedByPrice = [...combinedItems].sort((a, b) => {
      if (b.storePrice !== a.storePrice) return b.storePrice - a.storePrice;
      return b.storePrice * b.quantity - a.storePrice * a.quantity;
    });
    let auditItems = sortedByPrice;
    if (sortedByPrice.length > auditLimit) {
      const topFixed = sortedByPrice.slice(0, auditLimit - 1);
      const rest = sortedByPrice.slice(auditLimit - 1);
      const randPick = rest[Math.floor(Math.random() * rest.length)];
      auditItems = [...topFixed, randPick];
    }

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderId = `EXP-IN-${randomSuffix}`;
    const upiRef = `${String(resolvedPaymentMethod)
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
      paymentMethod: resolvedPaymentMethod,
      customerName: user?.name || customerName,
      customerPhone: cleanPhone,
      customerTrustScore: updatedTrustScore,
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
      securityFlags: flagsList,
      actualPhysicalItemsInCart: [
        ...combinedItems.map((i: any) => i.barcode),
        ...swappedList,
      ],
      exitVerified: false,
      requiresCounterCheckout: forceCounter,
      verificationMode: forceCounter ? 'COUNTER_HANDOFF' : 'QR_GATE_SCAN',
      counterStatus: forceCounter ? 'SENT_TO_COUNTER' : 'NONE',
    };

    await dbSaveOrder(exitPass);

    return res.status(200).json({
      ok: true,
      exitPass,
      walletBalance: user?.walletBalance,
    });
  }

  if (action === 'approve-exit') {
    const { orderId, staffId = 'EMP-101' } = body;
    const updated = await dbMarkOrderVerified(String(orderId || ''), String(staffId));
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }
    return res.status(200).json({ ok: true, exitPass: updated });
  }

  if (action === 'send-to-counter') {
    const { orderId } = body;
    const updated = await dbSendOrderToCounter(String(orderId || ''));
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }
    return res.status(200).json({ ok: true, exitPass: updated });
  }

  if (action === 'verify-physical-bill') {
    const {
      orderId,
      physicalBillRef,
      resolutionType = 'COUNTER_HANDOFF_PAID',
      staffId = 'EMP-101',
    } = body;
    const updated = await dbVerifyOrderWithPhysicalBill({
      orderId: String(orderId || ''),
      physicalBillRef:
        String(physicalBillRef || '').trim() ||
        `POS-${Date.now().toString().slice(-4)}`,
      resolutionType,
      staffId: String(staffId),
    });
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }
    return res.status(200).json({ ok: true, exitPass: updated });
  }

  if (action === 'reverse-spot-scan') {
    const { orderId, scannedBarcode, fallbackPass } = body;
    const pass = (await dbGetOrder(orderId)) || fallbackPass;
    const catItem = await dbGetProductByBarcode(String(scannedBarcode || '').trim());

    if (!pass || !catItem) {
      return res
        .status(404)
        .json({ ok: false, error: 'Order or product barcode not found in store catalog' });
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
        detail: `Verified on Bill ${pass.orderId} (Qty: ${paidMatch.quantity} paid · ₹${paidMatch.storePrice})`,
      });
    } else {
      if (pass.customerPhone) {
        const user = await dbGetUser(pass.customerPhone);
        if (user) {
          user.trustScore = Math.max(0, user.trustScore - 15);
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
        detail: `ALERT! ${catItem.name} (₹${catItem.storePrice}, ${catItem.weightGrams}g) is physically in the cart but was NOT paid on Bill ${pass.orderId}!`,
      });
    }
  }

  return res.status(400).json({ ok: false, error: 'Unsupported order action' });
}
