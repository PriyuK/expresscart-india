import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Check,
  QrCode,
  Search,
  RefreshCw,
  LogOut,
  X,
  Lock,
  ShieldAlert,
} from 'lucide-react-native';
import ScannerView from '../components/ScannerView';
import { useCartStore, ExitPassPayload, CartItem } from '../store/useCartStore';
import {
  CATALOG_BY_BARCODE,
  CatalogItem,
  OfferType,
  STORE_CATEGORIES,
} from '../data/mockStoreCatalog';
import { callBackendApi } from '../utils/apiClient';
import {
  ThemeColors,
  getThemeColors,
  FONTS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  ICON,
  TOUCH_TARGET,
  getProductImage,
} from '../theme/tokens';

const OFFER_OPTIONS: { value: OfferType; label: string }[] = [
  { value: 'NONE', label: 'Regular store price' },
  { value: 'BOGO', label: 'Buy 1 get 1 free' },
  { value: 'BUY_2_EXTRA_10_OFF', label: 'Buy 2, save 10%' },
  { value: 'BUY_3_GET_15_OFF', label: 'Buy 3, save ₹15' },
];

function getTrustTierMeta(trustScore?: number, flagsCount = 0) {
  const score = Math.max(0, Math.min(100, trustScore ?? 95));
  if (score < 40) {
    return {
      score,
      tierLabel: `Counter required · Score ${score}`,
      isHighRisk: true,
    };
  }
  if (score < 70 || flagsCount > 0) {
    return {
      score,
      tierLabel: `Enhanced check · Score ${score}`,
      isHighRisk: true,
    };
  }
  if (score >= 90) {
    return {
      score,
      tierLabel: `Fast-track · Score ${score}`,
      isHighRisk: false,
    };
  }
  return {
    score,
    tierLabel: `Standard check · Score ${score}`,
    isHighRisk: false,
  };
}

const COUNTER_RESOLUTION_OPTIONS: {
  id:
    | 'COUNTER_HANDOFF_PAID'
    | 'COUNTER_ADDON_PAID'
    | 'COUNTER_FULL_REBILL_REFUND';
  label: string;
}[] = [
  { id: 'COUNTER_HANDOFF_PAID', label: 'Counter handoff paid' },
  { id: 'COUNTER_ADDON_PAID', label: 'Add-on paid at counter' },
  { id: 'COUNTER_FULL_REBILL_REFUND', label: 'Full re-bill (refund app)' },
];

function playGuardAlertTone(kind: 'clean' | 'high_risk') {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(
      kind === 'high_risk'
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Success
    ).catch(() => {});
    return;
  }

  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      navigator.vibrate(kind === 'high_risk' ? [120, 60, 180] : 50);
    }

    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (kind === 'clean') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 220);
    } else {
      const now = ctx.currentTime;
      const playSegment = (freq: number, startOffset: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + startOffset);
        gain.gain.setValueAtTime(0.2, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          now + startOffset + dur
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + dur);
      };
      playSegment(440, 0, 0.16);
      playSegment(310, 0.18, 0.18);
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 450);
    }
  } catch {
    // Ignore audio context blocks in restricted browsers
  }
}

export default function GuardAuditScreen() {
  const router = useRouter();
  const {
    isDarkMode,
    userProfile,
    logoutUser,
    catalogCache,
    upsertCatalogProduct,
    lastExitPass,
    orderHistory,
    fetchOrderHistory,
    markOrderExitVerified,
    sendOrderToCounter,
    verifyOrderWithPhysicalBill,
    adjustTrustScore,
  } = useCartStore();

  const COLORS = getThemeColors(isDarkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [staffTab, setStaffTab] = useState<'gate' | 'inventory'>('gate');

  const [scannedPass, setScannedPass] = useState<ExitPassPayload | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [gateApproved, setGateApproved] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [orderLookupInput, setOrderLookupInput] = useState('');
  const [measuredWeightInput, setMeasuredWeightInput] = useState('');
  const [physicalBillInput, setPhysicalBillInput] = useState('');
  const [counterResolutionMode, setCounterResolutionMode] = useState<
    | 'COUNTER_HANDOFF_PAID'
    | 'COUNTER_ADDON_PAID'
    | 'COUNTER_FULL_REBILL_REFUND'
  >('COUNTER_HANDOFF_PAID');
  const [spotScanBarcodeInput, setSpotScanBarcodeInput] = useState('');
  const [showSpotCamera, setShowSpotCamera] = useState(false);
  const [reverseScanResult, setReverseScanResult] = useState<{
    status: 'PAID_OK' | 'UNPAID_THEFT_CAUGHT';
    barcode: string;
    name: string;
    price: number;
    weightGrams: number;
    detail: string;
  } | null>(null);

  const [invSearch, setInvSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<CatalogItem | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [formBarcode, setFormBarcode] = useState('');
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formCategory, setFormCategory] = useState('Staples & Grains');
  const [formMrp, setFormMrp] = useState('');
  const [formStorePrice, setFormStorePrice] = useState('');
  const [formWeightGrams, setFormWeightGrams] = useState('');
  const [formAisle, setFormAisle] = useState('');
  const [formOfferType, setFormOfferType] = useState<OfferType>('NONE');
  const [invFeedback, setInvFeedback] = useState<string | null>(null);

  const isStaff = userProfile?.role === 'STORE_STAFF';

  useEffect(() => {
    if (isStaff) {
      fetchOrderHistory();
    }
  }, [isStaff, fetchOrderHistory]);

  const catalogByBarcode = useMemo(() => {
    const map: Record<string, CatalogItem> = { ...CATALOG_BY_BARCODE };
    catalogCache.forEach((p) => {
      map[p.barcode] = p;
    });
    return map;
  }, [catalogCache]);

  const liveOrders = useMemo(() => {
    const list: ExitPassPayload[] = [...orderHistory];
    if (
      lastExitPass &&
      !list.some((o) => o.orderId === lastExitPass.orderId)
    ) {
      list.unshift(lastExitPass);
    }
    return list;
  }, [orderHistory, lastExitPass]);

  const loadExitPass = (
    pass: ExitPassPayload,
    options?: { onlyAlertIfHighRisk?: boolean }
  ) => {
    const isHighRiskPass =
      (pass.customerTrustScore ?? 95) < 70 ||
      (pass.securityFlags || []).length > 0 ||
      Boolean(pass.requiresCounterCheckout);
    if (!options?.onlyAlertIfHighRisk || isHighRiskPass) {
      playGuardAlertTone(isHighRiskPass ? 'high_risk' : 'clean');
    }

    setScannedPass(pass);
    setGateApproved(Boolean(pass.exitVerified));
    setScanError(null);
    setReverseScanResult(null);
    setMeasuredWeightInput(String(pass.cartWeightGrams || 0));
    setPhysicalBillInput(pass.physicalBillRef || '');
    setCounterResolutionMode(
      pass.counterResolutionType || 'COUNTER_HANDOFF_PAID'
    );
    const initialChecks: Record<string, boolean> = {};
    (pass.auditItems || []).forEach((item) => {
      initialChecks[item.barcode] = Boolean(pass.exitVerified);
    });
    setCheckedItems(initialChecks);
  };

  const handleScanData = (rawData: string) => {
    const trimmed = rawData.trim();
    try {
      const parsed = JSON.parse(trimmed);
      const parsedOrderId = String(parsed?.id || parsed?.orderId || '').trim();
      if (parsedOrderId) {
        const existingFullPass = liveOrders.find(
          (o) => o.orderId.toUpperCase() === parsedOrderId.toUpperCase()
        );
        if (existingFullPass) {
          loadExitPass(existingFullPass);
          return;
        }

        if (Array.isArray(parsed.auditItems)) {
          loadExitPass(parsed as ExitPassPayload);
          return;
        }

        if (Array.isArray(parsed.a) || parsed.v === 1) {
          const reconstructedAudit: CartItem[] = (parsed.a || []).map(
            (entry: string) => {
              const [barcode, qtyStr] = String(entry).split(':');
              const cat = catalogByBarcode[barcode];
              return {
                barcode,
                name: cat?.name || `Item (${barcode})`,
                brand: cat?.brand,
                unit: cat?.unit,
                mrp: cat?.mrp || 0,
                storePrice: cat?.storePrice || 0,
                weightGrams: cat?.weightGrams || 250,
                quantity: Math.max(1, Number(qtyStr) || 1),
              };
            }
          );

          const offlinePass: ExitPassPayload = {
            type: 'EXPRESSCART_EXIT_PASS',
            orderId: parsedOrderId,
            storeName: parsed.s || 'DMart Express',
            timestamp: parsed.ts || new Date().toISOString(),
            upiRef: parsed.ref || 'UPI-OFFLINE',
            signature: parsed.sig || '',
            totalPrice: Number(parsed.p || 0),
            totalMrp: Number(parsed.p || 0),
            totalSavings: 0,
            totalItemCount: Number(parsed.c || reconstructedAudit.length),
            cartWeightGrams: Number(parsed.w || 0),
            auditItems: reconstructedAudit,
            exitVerified: false,
            verificationMode: parsed.m,
            counterStatus: parsed.cs,
            requiresCounterCheckout:
              parsed.m === 'COUNTER_HANDOFF' || parsed.cs === 'SENT_TO_COUNTER',
          };
          loadExitPass(offlinePass);

          callBackendApi('/api/orders', {
            method: 'GET',
            query: { orderId: parsedOrderId },
          }).then((res) => {
            if (res?.ok && res.exitPass) {
              loadExitPass(res.exitPass as ExitPassPayload, {
                onlyAlertIfHighRisk: true,
              });
            }
          });
          return;
        }
      }
    } catch {
      const matchedOrder = liveOrders.find(
        (o) =>
          o.orderId.toUpperCase() === trimmed.toUpperCase() ||
          o.customerPhone === trimmed
      );
      if (matchedOrder) {
        loadExitPass(matchedOrder);
        return;
      }
    }
    setScanError(`No order found matching "${trimmed}".`);
  };

  const handleOrderLookup = () => {
    const q = orderLookupInput.trim();
    if (!q) return;
    const match = liveOrders.find(
      (o) =>
        o.orderId.toUpperCase().includes(q.toUpperCase()) ||
        (o.customerPhone && o.customerPhone.includes(q))
    );
    if (match) {
      loadExitPass(match);
      setOrderLookupInput('');
    } else {
      setScanError(`No order found matching "${q}".`);
    }
  };

  const handleReverseGuardItemScan = (barcodeInput: string) => {
    const barcode = barcodeInput.trim();
    if (!scannedPass || !barcode) return;
    const catItem = catalogByBarcode[barcode];

    const paidList = scannedPass.allPaidItems || scannedPass.auditItems || [];
    const paidMatch = paidList.find((i) => i.barcode === barcode);

    if (paidMatch) {
      playGuardAlertTone('clean');
      setCheckedItems((prev) => ({ ...prev, [barcode]: true }));
      setReverseScanResult({
        status: 'PAID_OK',
        barcode,
        name: paidMatch.name,
        price: paidMatch.storePrice,
        weightGrams: paidMatch.weightGrams,
        detail: `Verified on ${scannedPass.orderId} (Qty ${paidMatch.quantity} · ₹${paidMatch.storePrice})`,
      });
    } else {
      playGuardAlertTone('high_risk');
      adjustTrustScore(-15);
      setReverseScanResult({
        status: 'UNPAID_THEFT_CAUGHT',
        barcode,
        name: catItem?.name || `Item (${barcode})`,
        price: catItem?.storePrice || 0,
        weightGrams: catItem?.weightGrams || 0,
        detail: `${
          catItem?.name || barcode
        } is in the cart but was not paid on ${scannedPass.orderId}.`,
      });
    }

    callBackendApi('/api/orders', {
      method: 'POST',
      body: {
        action: 'reverse-spot-scan',
        orderId: scannedPass.orderId,
        scannedBarcode: barcode,
        fallbackPass: scannedPass,
      },
    }).then((res) => {
      if (res?.ok && res.detail) {
        setReverseScanResult({
          status: res.status,
          barcode: res.barcode,
          name: res.name,
          price: res.price,
          weightGrams: res.weightGrams,
          detail: res.detail,
        });
      }
    });

    setSpotScanBarcodeInput('');
    setShowSpotCamera(false);
  };

  const toggleCheckbox = (barcode: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [barcode]: !prev[barcode],
    }));
  };

  const openEditModal = (product?: CatalogItem) => {
    if (product) {
      setEditingProduct(product);
      setFormBarcode(product.barcode);
      setFormName(product.name);
      setFormBrand(product.brand);
      setFormUnit(product.unit);
      setFormCategory(product.category);
      setFormMrp(String(product.mrp));
      setFormStorePrice(String(product.storePrice));
      setFormWeightGrams(String(product.weightGrams));
      setFormAisle(product.aisle);
      setFormOfferType(product.offerType || 'NONE');
    } else {
      setEditingProduct(null);
      setFormBarcode(`890${Math.floor(1000000000 + Math.random() * 8999999999)}`);
      setFormName('');
      setFormBrand('');
      setFormUnit('500 g');
      setFormCategory('Staples & Grains');
      setFormMrp('');
      setFormStorePrice('');
      setFormWeightGrams('500');
      setFormAisle('Aisle 01');
      setFormOfferType('NONE');
    }
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    if (!formBarcode.trim() || !formName.trim()) return;
    const mrpNum = Number(formMrp) || 100;
    const storePriceNum = Number(formStorePrice) || mrpNum;
    const weightNum = Number(formWeightGrams) || 250;

    const saved = await upsertCatalogProduct({
      barcode: formBarcode.trim(),
      name: formName.trim(),
      brand: formBrand.trim() || 'Express Retail',
      unit: formUnit.trim() || `${weightNum} g`,
      category: formCategory,
      mrp: mrpNum,
      storePrice: storePriceNum,
      weightGrams: weightNum,
      aisle: formAisle.trim() || 'Aisle 01',
      offerType: formOfferType,
    });

    setShowProductModal(false);
    setInvFeedback(`Saved ${saved.name} (₹${saved.storePrice})`);
  };

  const filteredInventory = useMemo(() => {
    const q = invSearch.trim().toLowerCase();
    if (!q) return catalogCache;
    return catalogCache.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.brand.toLowerCase().includes(q) ||
        i.barcode.includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [catalogCache, invSearch]);

  if (!isStaff) {
    return (
      <View style={styles.authGateScreen}>
        <View style={styles.authGateCard}>
          <View style={styles.authGateIcon}>
            <Lock
              size={ICON.size}
              color={COLORS.textPrimary}
              strokeWidth={ICON.strokeWidth}
            />
          </View>
          <Text style={styles.authGateTitle}>Staff sign in required</Text>
          <Text style={styles.authGateSub}>
            Sign in with your employee ID and store passcode to verify exit
            passes and manage store items.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/auth?mode=staff')}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonLabel}>Sign in as staff</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryLink}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.secondaryLinkText}>Back to home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const expectedWeight = scannedPass?.cartWeightGrams || 0;
  const physicalWeight = Number(measuredWeightInput) || expectedWeight;
  const weightDiffGrams = Math.abs(physicalWeight - expectedWeight);
  const isWeightMismatch = weightDiffGrams > 75;

  const verifiedCount = scannedPass
    ? (scannedPass.auditItems || []).filter((i) => checkedItems[i.barcode]).length
    : 0;
  const totalAuditCount = scannedPass ? (scannedPass.auditItems || []).length : 0;

  return (
    <View style={styles.screen}>
      {/* Staff Top Bar */}
      <View style={styles.staffTopBar}>
        <View style={styles.staffIdentityRow}>
          <Text style={styles.staffIdentityText} numberOfLines={1}>
            {userProfile?.name} · {userProfile?.employeeId}
          </Text>

          <TouchableOpacity
            style={styles.signOutTouch}
            onPress={() => {
              logoutUser();
              router.replace('/');
            }}
          >
            <LogOut
              size={ICON.size}
              color={COLORS.danger}
              strokeWidth={ICON.strokeWidth}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.segmentedTabs}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              staffTab === 'gate' && styles.tabBtnActive,
            ]}
            onPress={() => setStaffTab('gate')}
          >
            <Text
              style={[
                styles.tabBtnText,
                staffTab === 'gate' && styles.tabBtnTextActive,
              ]}
            >
              Exit gate check
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              staffTab === 'inventory' && styles.tabBtnActive,
            ]}
            onPress={() => setStaffTab('inventory')}
          >
            <Text
              style={[
                styles.tabBtnText,
                staffTab === 'inventory' && styles.tabBtnTextActive,
              ]}
            >
              Store items ({catalogCache.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {staffTab === 'gate' ? (
        !scannedPass ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.gateHomeContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.scannerBox}>
              <ScannerView
                onScan={handleScanData}
                isScanning={true}
                manualPlaceholder="Enter order ID (EXP-IN-...)"
              />
            </View>

            <View style={styles.panelSection}>
              <Text style={styles.sectionTitle}>Find order</Text>
              <View style={styles.lookupBarRow}>
                <TextInput
                  style={styles.lookupInput}
                  value={orderLookupInput}
                  onChangeText={setOrderLookupInput}
                  placeholder="Order ID or mobile number"
                  placeholderTextColor={COLORS.textSecondary}
                  onSubmitEditing={handleOrderLookup}
                />
                <TouchableOpacity
                  style={styles.lookupBtn}
                  onPress={handleOrderLookup}
                >
                  <Text style={styles.lookupBtnText}>Find</Text>
                </TouchableOpacity>
              </View>

              {scanError && <Text style={styles.errorText}>{scanError}</Text>}

              <View style={styles.queueHeader}>
                <Text style={styles.sectionTitle}>
                  Recent orders ({liveOrders.length})
                </Text>
                <TouchableOpacity
                  style={styles.refreshTouch}
                  onPress={fetchOrderHistory}
                >
                  <RefreshCw
                    size={ICON.size}
                    color={COLORS.accent}
                    strokeWidth={ICON.strokeWidth}
                  />
                </TouchableOpacity>
              </View>

              {liveOrders.length === 0 ? (
                <Text style={styles.emptyQueueText}>No orders yet.</Text>
              ) : (
                <View style={styles.queueList}>
                  {liveOrders.slice(0, 8).map((order) => {
                    const trustMeta = getTrustTierMeta(
                      order.customerTrustScore,
                      (order.securityFlags || []).length
                    );
                    return (
                      <TouchableOpacity
                        key={order.orderId}
                        style={styles.queueOrderCard}
                        onPress={() => loadExitPass(order)}
                        activeOpacity={0.78}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.queueTopRow}>
                            <Text style={styles.queueOrderId} numberOfLines={1}>
                              {order.orderId}
                            </Text>
                            <View style={styles.queueBadgesRow}>
                              <View
                                style={[
                                  styles.discountTag,
                                  trustMeta.isHighRisk && styles.riskTag,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.discountTagText,
                                    trustMeta.isHighRisk && styles.riskTagText,
                                  ]}
                                >
                                  {trustMeta.tierLabel}
                                </Text>
                              </View>
                              <View style={styles.discountTag}>
                                <Text style={styles.discountTagText}>
                                  {order.exitVerified &&
                                  order.verificationMode ===
                                    'PHYSICAL_COUNTER_BILL'
                                    ? 'Counter bill'
                                    : order.exitVerified
                                    ? 'Verified'
                                    : order.requiresCounterCheckout ||
                                      order.counterStatus === 'SENT_TO_COUNTER'
                                    ? 'At counter'
                                    : 'Waiting'}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <Text style={styles.queueSubText} numberOfLines={1}>
                            {order.customerName || 'Shopper'} ·{' '}
                            {order.totalItemCount} items ·{' '}
                            {((order.cartWeightGrams || 0) / 1000).toFixed(2)} kg
                          </Text>
                        </View>
                        <Text style={styles.queueOrderPrice}>
                          ₹{order.totalPrice}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.panelSection}
            showsVerticalScrollIndicator={false}
          >
            {/* Order Summary Header (Staff-only internal trust tier & security checks) */}
            {(() => {
              const scannedTrustMeta = getTrustTierMeta(
                scannedPass.customerTrustScore,
                (scannedPass.securityFlags || []).length
              );
              return (
                <>
                  <View style={styles.surfaceCard}>
                    <View style={styles.queueTopRow}>
                      <Text style={styles.queueOrderId}>{scannedPass.orderId}</Text>
                      <View style={styles.discountTag}>
                        <Text style={styles.discountTagText}>
                          {scannedPass.verificationMode ===
                          'PHYSICAL_COUNTER_BILL'
                            ? `Counter bill · ${
                                scannedPass.physicalBillRef || 'POS'
                              }`
                            : scannedPass.requiresCounterCheckout &&
                              !scannedPass.exitVerified
                            ? `Pay at counter · ₹${scannedPass.totalPrice}`
                            : `Paid · ₹${scannedPass.totalPrice}`}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.queueSubText}>
                      {scannedPass.customerName || 'Shopper'} (+91{' '}
                      {scannedPass.customerPhone || 'Verified'}) ·{' '}
                      {scannedPass.totalItemCount} items
                    </Text>
                    <View style={styles.internalTrustRow}>
                      <View
                        style={[
                          styles.discountTag,
                          scannedTrustMeta.isHighRisk && styles.riskTag,
                        ]}
                      >
                        <Text
                          style={[
                            styles.discountTagText,
                            scannedTrustMeta.isHighRisk && styles.riskTagText,
                          ]}
                        >
                          {scannedTrustMeta.tierLabel}
                        </Text>
                      </View>
                      <Text style={styles.queueSubText}>
                        Internal trust {scannedTrustMeta.score}/100 · Spot-check{' '}
                        {totalAuditCount}{' '}
                        {totalAuditCount === 1 ? 'item' : 'items'}
                      </Text>
                    </View>
                    <View style={styles.staffTrustToolsRow}>
                      <TouchableOpacity
                        style={[styles.choiceChip, styles.riskTag]}
                        onPress={() => {
                          const targetPhone =
                            scannedPass.customerPhone || '9820411290';
                          const currentScore =
                            scannedPass.customerTrustScore ?? 95;
                          const nextScore = Math.max(0, currentScore - 30);
                          setScannedPass((prev) =>
                            prev
                              ? { ...prev, customerTrustScore: nextScore }
                              : prev
                          );
                          callBackendApi('/api/auth', {
                            method: 'POST',
                            body: {
                              action: 'adjust-trust',
                              phone: targetPhone,
                              trustDelta: -30,
                            },
                          });
                        }}
                      >
                        <Text style={[styles.choiceChipText, styles.riskTagText]}>
                          -30 trust penalty
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.choiceChip}
                        onPress={() => {
                          const targetPhone =
                            scannedPass.customerPhone || '9820411290';
                          const currentScore =
                            scannedPass.customerTrustScore ?? 95;
                          const resetDelta = 95 - currentScore;
                          setScannedPass((prev) =>
                            prev ? { ...prev, customerTrustScore: 95 } : prev
                          );
                          callBackendApi('/api/auth', {
                            method: 'POST',
                            body: {
                              action: 'adjust-trust',
                              phone: targetPhone,
                              trustDelta: resetDelta,
                            },
                          });
                        }}
                      >
                        <Text style={styles.choiceChipText}>Reset 95</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {scannedPass.securityFlags &&
                    scannedPass.securityFlags.length > 0 && (
                      <View style={styles.securityAlertCard}>
                        <View style={styles.securityAlertHeader}>
                          <ShieldAlert
                            size={ICON.size}
                            color={COLORS.danger}
                            strokeWidth={ICON.strokeWidth}
                          />
                          <Text style={styles.securityAlertTitle}>
                            Internal security flags (
                            {scannedPass.securityFlags.length})
                          </Text>
                        </View>
                        {scannedPass.securityFlags.map((flag, idx) => (
                          <View
                            key={flag.id || `${flag.type}-${idx}`}
                            style={[
                              styles.securityFlagItem,
                              idx > 0 && styles.checkRowDivider,
                            ]}
                          >
                            <Text style={styles.securityFlagType}>
                              {flag.type} ·{' '}
                              {flag.resolved ? 'Resolved' : 'Unresolved'}
                            </Text>
                            <Text style={styles.securityFlagNote}>
                              {flag.note}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                </>
              );
            })()}

            {/* Spot-check item barcode */}
            <View style={styles.surfaceCard}>
              <Text style={styles.sectionTitle}>Check an item in cart</Text>
              <View style={styles.lookupBarRow}>
                <TextInput
                  style={styles.lookupInput}
                  value={spotScanBarcodeInput}
                  onChangeText={setSpotScanBarcodeInput}
                  placeholder="Enter item barcode"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  onSubmitEditing={() =>
                    handleReverseGuardItemScan(spotScanBarcodeInput)
                  }
                />
                <TouchableOpacity
                  style={styles.lookupBtn}
                  onPress={() =>
                    handleReverseGuardItemScan(spotScanBarcodeInput)
                  }
                >
                  <Text style={styles.lookupBtnText}>Check</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cameraIconBtn}
                  onPress={() => setShowSpotCamera((prev) => !prev)}
                >
                  <QrCode
                    size={ICON.size}
                    color={COLORS.textPrimary}
                    strokeWidth={ICON.strokeWidth}
                  />
                </TouchableOpacity>
              </View>

              {showSpotCamera && (
                <View style={styles.inlineSpotScannerBox}>
                  <ScannerView
                    onScan={handleReverseGuardItemScan}
                    isScanning={true}
                  />
                </View>
              )}

              {reverseScanResult && (
                <View
                  style={[
                    styles.resultBox,
                    reverseScanResult.status === 'PAID_OK'
                      ? styles.resultBoxOk
                      : styles.resultBoxAlert,
                  ]}
                >
                  <Text
                    style={[
                      styles.resultTitle,
                      reverseScanResult.status === 'UNPAID_THEFT_CAUGHT' && {
                        color: COLORS.danger,
                      },
                    ]}
                  >
                    {reverseScanResult.status === 'PAID_OK'
                      ? `Paid: ${reverseScanResult.name}`
                      : `Unpaid item: ${reverseScanResult.name}`}
                  </Text>
                  <Text style={styles.resultDetail}>
                    {reverseScanResult.detail}
                  </Text>
                </View>
              )}
            </View>

            {/* Weight Verification */}
            <View style={styles.surfaceCard}>
              <View style={styles.queueTopRow}>
                <Text style={styles.sectionTitle}>Cart weight (grams)</Text>
                <Text style={styles.queueSubText}>
                  Expected {expectedWeight} g
                </Text>
              </View>
              <TextInput
                style={styles.lookupInput}
                value={measuredWeightInput}
                onChangeText={setMeasuredWeightInput}
                keyboardType="numeric"
                placeholder="Scale reading (g)"
              />
              <Text
                style={[
                  styles.queueSubText,
                  isWeightMismatch && { color: COLORS.danger },
                ]}
              >
                {isWeightMismatch
                  ? `Difference: ${weightDiffGrams} g`
                  : `Within tolerance (${weightDiffGrams} g difference)`}
              </Text>
            </View>

            {/* Items Checklist */}
            <View style={styles.surfaceCard}>
              <View style={styles.queueTopRow}>
                <Text style={styles.sectionTitle}>Items to check</Text>
                <Text style={styles.queueSubText}>
                  {verifiedCount}/{totalAuditCount} checked
                </Text>
              </View>

              {(scannedPass.auditItems || []).map((item, idx) => {
                const isChecked = Boolean(checkedItems[item.barcode]);
                return (
                  <TouchableOpacity
                    key={item.barcode}
                    style={[
                      styles.checkRow,
                      idx > 0 && styles.checkRowDivider,
                    ]}
                    onPress={() => toggleCheckbox(item.barcode)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isChecked && styles.checkboxChecked,
                      ]}
                    >
                      {isChecked && (
                        <Check
                          size={14}
                          color={COLORS.white}
                          strokeWidth={ICON.strokeWidth}
                        />
                      )}
                    </View>
                    <Image
                      source={{ uri: getProductImage(item.barcode) }}
                      style={styles.itemThumb}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.checkItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.queueSubText}>
                        Qty {item.quantity} · ₹{item.storePrice}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Counter Handoff & Physical Bill Gate Clearance */}
            <View style={styles.surfaceCard}>
              <Text style={styles.sectionTitle}>
                Counter handoff & physical bill clearance
              </Text>
              <Text style={styles.queueSubText}>
                If the customer was redirected to a billing counter or leaves
                with a physical paper bill instead of using the QR pass, resolve
                this order below to lock the digital QR against reuse.
              </Text>

              <TextInput
                style={styles.lookupInput}
                value={physicalBillInput}
                onChangeText={setPhysicalBillInput}
                placeholder="Physical POS bill # (e.g. POS-4821)"
                placeholderTextColor={COLORS.textSecondary}
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: SPACING.sm }}
              >
                {COUNTER_RESOLUTION_OPTIONS.map((opt) => {
                  const active = counterResolutionMode === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.choiceChip,
                        active && styles.choiceChipActive,
                      ]}
                      onPress={() => setCounterResolutionMode(opt.id)}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          active && styles.choiceChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.twoColRow}>
                <TouchableOpacity
                  style={styles.secondaryOutlineBtn}
                  activeOpacity={0.85}
                  onPress={async () => {
                    setScannedPass((prev) =>
                      prev
                        ? {
                            ...prev,
                            requiresCounterCheckout: true,
                            verificationMode: 'COUNTER_HANDOFF',
                            counterStatus: 'SENT_TO_COUNTER',
                          }
                        : prev
                    );
                    await sendOrderToCounter(
                      scannedPass.orderId,
                      userProfile?.employeeId
                    );
                  }}
                >
                  <Text style={styles.secondaryOutlineBtnText}>
                    Send to billing counter
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryOutlineBtn, styles.accentFillBtn]}
                  activeOpacity={0.85}
                  onPress={async () => {
                    const billRef =
                      physicalBillInput.trim() ||
                      `POS-${Date.now().toString().slice(-4)}`;
                    setPhysicalBillInput(billRef);
                    setGateApproved(true);
                    setScannedPass((prev) =>
                      prev
                        ? {
                            ...prev,
                            exitVerified: true,
                            requiresCounterCheckout: true,
                            verificationMode: 'PHYSICAL_COUNTER_BILL',
                            counterStatus: 'CLEARED_PHYSICAL_BILL',
                            physicalBillRef: billRef,
                            counterResolutionType: counterResolutionMode,
                          }
                        : prev
                    );
                    await verifyOrderWithPhysicalBill({
                      orderId: scannedPass.orderId,
                      physicalBillRef: billRef,
                      resolutionType: counterResolutionMode,
                      staffId: userProfile?.employeeId,
                    });
                  }}
                >
                  <Text style={styles.accentFillBtnText}>
                    Clear via physical bill
                  </Text>
                </TouchableOpacity>
              </View>

              {scannedPass.counterStatus === 'SENT_TO_COUNTER' &&
                !scannedPass.exitVerified && (
                  <View style={styles.resultBoxAlert}>
                    <Text style={[styles.resultTitle, { color: COLORS.danger }]}>
                      Redirected to billing counter · Digital QR locked
                    </Text>
                  </View>
                )}

              {scannedPass.counterStatus === 'CLEARED_PHYSICAL_BILL' && (
                <View style={styles.resultBoxOk}>
                  <Text style={styles.resultTitle}>
                    Cleared via physical bill{' '}
                    {scannedPass.physicalBillRef || 'POS'} · Digital QR closed
                  </Text>
                  <Text style={styles.resultDetail}>
                    Mode: {scannedPass.counterResolutionType}
                  </Text>
                </View>
              )}
            </View>

            {/* Primary Action: Approve Gate */}
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.88}
              disabled={scannedPass.verificationMode === 'PHYSICAL_COUNTER_BILL'}
              onPress={async () => {
                const allTrue: Record<string, boolean> = {};
                (scannedPass.auditItems || []).forEach((i) => {
                  allTrue[i.barcode] = true;
                });
                setCheckedItems(allTrue);
                setGateApproved(true);
                adjustTrustScore(1);
                await markOrderExitVerified(
                  scannedPass.orderId,
                  userProfile?.employeeId
                );
              }}
            >
              <Text style={styles.primaryButtonLabel}>
                {scannedPass.verificationMode === 'PHYSICAL_COUNTER_BILL'
                  ? 'Cleared · Physical counter bill'
                  : gateApproved
                  ? 'Approved · Gate open'
                  : 'Approve exit pass'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryLink}
              onPress={() => {
                setScannedPass(null);
                setGateApproved(false);
                setReverseScanResult(null);
              }}
            >
              <Text style={styles.secondaryLinkText}>Scan next pass</Text>
            </TouchableOpacity>
          </ScrollView>
        )
      ) : (
        /* STORE ITEMS & OFFERS */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.panelSection}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => openEditModal()}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonLabel}>Add new item</Text>
          </TouchableOpacity>

          {invFeedback && (
            <View style={styles.feedbackBar}>
              <Text style={styles.feedbackText}>{invFeedback}</Text>
              <TouchableOpacity onPress={() => setInvFeedback(null)}>
                <X
                  size={ICON.size}
                  color={COLORS.accent}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.searchBarRow}>
            <Search
              size={ICON.size}
              color={COLORS.textSecondary}
              strokeWidth={ICON.strokeWidth}
            />
            <TextInput
              style={styles.searchInput}
              value={invSearch}
              onChangeText={setInvSearch}
              placeholder="Search items..."
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.queueList}>
            {filteredInventory.map((item) => (
              <TouchableOpacity
                key={item.barcode}
                style={styles.queueOrderCard}
                onPress={() => openEditModal(item)}
                activeOpacity={0.78}
              >
                <Image
                  source={{ uri: getProductImage(item.barcode) }}
                  style={styles.itemThumb}
                  resizeMode="cover"
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.checkItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.queueSubText} numberOfLines={1}>
                    {item.unit} · ₹{item.storePrice} (MRP ₹{item.mrp})
                  </Text>
                </View>
                <Text style={styles.editLinkText}>Edit</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Add / Edit Item Modal */}
      <Modal
        visible={showProductModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowProductModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'Edit item' : 'Add item'}
              </Text>
              <TouchableOpacity
                style={styles.signOutTouch}
                onPress={() => setShowProductModal(false)}
              >
                <X
                  size={ICON.size}
                  color={COLORS.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formList}>
                <View>
                  <Text style={styles.fieldLabel}>Barcode</Text>
                  <TextInput
                    style={styles.lookupInput}
                    value={formBarcode}
                    onChangeText={setFormBarcode}
                    editable={!editingProduct}
                    keyboardType="numeric"
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Item name</Text>
                  <TextInput
                    style={styles.lookupInput}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder="Tata Sampann Toor Dal"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>

                <View style={styles.twoColRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Brand</Text>
                    <TextInput
                      style={styles.lookupInput}
                      value={formBrand}
                      onChangeText={setFormBrand}
                      placeholder="Tata"
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Weight / unit</Text>
                    <TextInput
                      style={styles.lookupInput}
                      value={formUnit}
                      onChangeText={setFormUnit}
                      placeholder="1 kg"
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </View>
                </View>

                <View style={styles.twoColRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>MRP (₹)</Text>
                    <TextInput
                      style={styles.lookupInput}
                      value={formMrp}
                      onChangeText={setFormMrp}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Store price (₹)</Text>
                    <TextInput
                      style={styles.lookupInput}
                      value={formStorePrice}
                      onChangeText={setFormStorePrice}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: SPACING.sm }}
                  >
                    {STORE_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.choiceChip,
                          formCategory === cat && styles.choiceChipActive,
                        ]}
                        onPress={() => setFormCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.choiceChipText,
                            formCategory === cat && styles.choiceChipTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Offer</Text>
                  <View style={{ gap: SPACING.sm }}>
                    {OFFER_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.offerRow,
                          formOfferType === opt.value && styles.offerRowActive,
                        ]}
                        onPress={() => setFormOfferType(opt.value)}
                      >
                        <Text
                          style={[
                            styles.offerRowText,
                            formOfferType === opt.value &&
                              styles.offerRowTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSaveProduct}
                  activeOpacity={0.88}
                >
                  <Text style={styles.primaryButtonLabel}>Save item</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  authGateScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.page,
  },
  authGateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.section,
    width: '100%',
    alignItems: 'center',
  },
  authGateIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  authGateTitle: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.titleSize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  authGateSub: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.section,
  },
  primaryButton: {
    height: TOUCH_TARGET.primaryButtonHeight,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonLabel: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.white,
  },
  secondaryLink: {
    minHeight: TOUCH_TARGET.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  secondaryLinkText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.accent,
  },
  staffTopBar: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.page,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SPACING.sm,
  },
  staffIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  staffIdentityText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    flex: 1,
  },
  signOutTouch: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  segmentedTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.xs,
  },
  tabBtn: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SPACING.sm,
  },
  tabBtnActive: {
    backgroundColor: COLORS.background,
  },
  tabBtnText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  tabBtnTextActive: {
    color: COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.weightSemibold,
  },
  gateHomeContent: {
    paddingBottom: SPACING.xl,
  },
  scannerBox: {
    height: 196,
    backgroundColor: COLORS.surface,
  },
  panelSection: {
    padding: SPACING.page,
    gap: SPACING.page,
  },
  sectionTitle: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  lookupBarRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  lookupInput: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.page,
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
  },
  lookupBtn: {
    height: 44,
    paddingHorizontal: SPACING.page,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupBtnText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.white,
  },
  cameraIconBtn: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.danger,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  refreshTouch: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  emptyQueueText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  queueList: {
    gap: SPACING.sm,
  },
  queueOrderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.page,
    gap: SPACING.md,
  },
  queueTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: 2,
  },
  queueOrderId: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  discountTag: {
    backgroundColor: COLORS.discountBg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.card,
  },
  discountTagText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.discountText,
  },
  queueBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  riskTag: {
    backgroundColor: COLORS.dangerBg,
  },
  riskTagText: {
    color: COLORS.danger,
  },
  internalTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: 2,
  },
  staffTrustToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
    flexWrap: 'wrap',
  },
  secondaryOutlineBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  secondaryOutlineBtnText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  accentFillBtn: {
    backgroundColor: COLORS.tagBg,
    borderColor: COLORS.tagBg,
  },
  accentFillBtnText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.accent,
    textAlign: 'center',
  },
  securityAlertCard: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.card,
    padding: SPACING.page,
    gap: SPACING.sm,
  },
  securityAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  securityAlertTitle: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.danger,
  },
  securityFlagItem: {
    paddingTop: SPACING.xs,
    gap: 2,
  },
  securityFlagType: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.danger,
  },
  securityFlagNote: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  queueSubText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  queueOrderPrice: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  surfaceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.page,
    gap: SPACING.sm,
  },
  inlineSpotScannerBox: {
    height: 184,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  resultBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.card,
  },
  resultBoxOk: {
    backgroundColor: COLORS.discountBg,
  },
  resultBoxAlert: {
    backgroundColor: COLORS.dangerBg,
  },
  resultTitle: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.discountText,
    marginBottom: 2,
  },
  resultDetail: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  checkRowDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  itemThumb: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.background,
  },
  checkItemName: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
  },
  feedbackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.discountBg,
    borderRadius: RADIUS.card,
    padding: SPACING.md,
  },
  feedbackText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.discountText,
    flex: 1,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.page,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
  },
  editLinkText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.accent,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.button,
    borderTopRightRadius: RADIUS.button,
    padding: SPACING.page,
    maxHeight: '88%',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.titleSize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  formList: {
    gap: SPACING.page,
    paddingBottom: SPACING.section,
  },
  fieldLabel: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  choiceChip: {
    minHeight: 36,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceChipActive: {
    backgroundColor: COLORS.discountBg,
  },
  choiceChipText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  choiceChipTextActive: {
    color: COLORS.accent,
    fontWeight: TYPOGRAPHY.weightSemibold,
  },
  offerRow: {
    minHeight: 44,
    paddingHorizontal: SPACING.page,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
  },
  offerRowActive: {
    backgroundColor: COLORS.discountBg,
  },
  offerRowText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
  },
  offerRowTextActive: {
    color: COLORS.accent,
    fontWeight: TYPOGRAPHY.weightSemibold,
  },
});
