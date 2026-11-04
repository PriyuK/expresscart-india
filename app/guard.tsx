import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  ShieldCheck,
  Scale,
  ShoppingBag,
  QrCode,
  Check,
  RotateCcw,
  ShieldAlert,
  ScanLine,
  Users,
  AlertTriangle,
} from 'lucide-react-native';
import ScannerView from '../components/ScannerView';
import { useCartStore, ExitPassPayload } from '../store/useCartStore';
import { CATALOG_BY_BARCODE } from '../data/mockStoreCatalog';
import { callBackendApi } from '../utils/apiClient';

const DEMO_SAMPLE_EXIT_PASS: ExitPassPayload = {
  type: 'EXPRESSCART_EXIT_PASS',
  orderId: 'EXP-IN-849201',
  storeName: 'Reliance/DMart Express Pilot - Store #01',
  timestamp: new Date().toISOString(),
  upiRef: 'WALLET-992841',
  paymentMethod: 'ExpressWallet',
  customerName: 'Aarav Sharma',
  customerPhone: '9820411290',
  customerTrustScore: 98,
  signature: 'SIG-EXP-IN-849201-1104-7-3950',
  totalPrice: 1104,
  totalMrp: 1230,
  totalSavings: 126,
  totalItemCount: 7,
  cartWeightGrams: 3950,
  auditItems: [
    {
      barcode: '8904123405001',
      name: 'Organic Kolhapur Jaggery Block',
      brand: '24 Mantra',
      unit: '500 g',
      mrp: 120,
      storePrice: 100,
      weightGrams: 500,
      emoji: 'JG',
      bgColor: '#FEF3C7',
      quantity: 1,
    },
    {
      barcode: '8901262010023',
      name: 'Amul Pasteurised Table Butter',
      brand: 'Amul',
      unit: '500 g',
      mrp: 295,
      storePrice: 285,
      weightGrams: 500,
      emoji: 'AM',
      bgColor: '#F4F4F5',
      quantity: 1,
    },
    {
      barcode: '8901052014019',
      name: 'Tata Tea Gold Assam Leaf',
      brand: 'Tata Tea',
      unit: '500 g',
      mrp: 300,
      storePrice: 270,
      weightGrams: 500,
      emoji: 'TT',
      bgColor: '#F4F4F5',
      quantity: 1,
    },
  ],
  allPaidItems: [
    {
      barcode: '8904123405001',
      name: 'Organic Kolhapur Jaggery Block',
      brand: '24 Mantra',
      unit: '500 g',
      mrp: 120,
      storePrice: 100,
      weightGrams: 500,
      quantity: 1,
    },
    {
      barcode: '8901262010023',
      name: 'Amul Pasteurised Table Butter',
      brand: 'Amul',
      unit: '500 g',
      mrp: 295,
      storePrice: 285,
      weightGrams: 500,
      quantity: 1,
    },
    {
      barcode: '8901052014019',
      name: 'Tata Tea Gold Assam Leaf',
      brand: 'Tata Tea',
      unit: '500 g',
      mrp: 300,
      storePrice: 270,
      weightGrams: 500,
      quantity: 1,
    },
  ],
  securityFlags: [
    {
      id: 'SWAP-DEMO',
      type: 'BARCODE_SWAP_SUSPECTED',
      timestamp: new Date().toLocaleTimeString(),
      scannedBarcode: '8904123405001',
      scannedName: 'Organic Kolhapur Jaggery Block',
      scannedPrice: 100,
      suspectedActualBarcode: '8901262050550',
      suspectedActualName: 'Amul Pure Cow Ghee Tin',
      suspectedActualPrice: 550,
      resolved: false,
      note: 'Scanned Organic Kolhapur Jaggery Block (₹100, 500g) but drop-frame matched Red & White Metal Tin (Amul Pure Cow Ghee Tin, ₹550, 500g).',
    },
  ],
};

function getBrandMonogram(brand?: string, fallbackName?: string): string {
  const source = brand || fallbackName || 'SK';
  const cleaned = source.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase() || 'SK';
}

export default function GuardAuditScreen() {
  const { lastExitPass, adjustTrustScore } = useCartStore();
  const [scannedPass, setScannedPass] = useState<ExitPassPayload | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [gateApproved, setGateApproved] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [reverseScanResult, setReverseScanResult] = useState<{
    status: 'PAID_OK' | 'UNPAID_THEFT_CAUGHT';
    barcode: string;
    name: string;
    price: number;
    weightGrams: number;
    detail: string;
  } | null>(null);
  const [scaleStatus, setScaleStatus] = useState<'MATCH' | 'OVERWEIGHT'>('MATCH');

  const loadExitPass = (pass: ExitPassPayload) => {
    setScannedPass(pass);
    setGateApproved(false);
    setScanError(null);
    setReverseScanResult(null);
    setScaleStatus('MATCH');
    const initialChecks: Record<string, boolean> = {};
    pass.auditItems.forEach((item) => {
      initialChecks[item.barcode] = false;
    });
    setCheckedItems(initialChecks);
  };

  const handleScanData = (rawData: string) => {
    try {
      const parsed = JSON.parse(rawData);
      if (parsed && parsed.orderId && Array.isArray(parsed.auditItems)) {
        loadExitPass(parsed as ExitPassPayload);
        return;
      }
    } catch {
      const catalogMatch = CATALOG_BY_BARCODE[rawData.trim()];
      if (catalogMatch && lastExitPass) {
        loadExitPass(lastExitPass);
        return;
      }
      if (catalogMatch) {
        loadExitPass(DEMO_SAMPLE_EXIT_PASS);
        return;
      }
    }
    setScanError(
      'Unrecognized QR payload. Select a pass below to test exit verification.'
    );
  };

  /**
   * Reverse Guard Spot-Scan: Guard picks an item physically inside the customer's cart
   * and scans its barcode to verify if it is on the paid digital bill.
   */
  const handleReverseGuardItemScan = (barcode: string) => {
    if (!scannedPass) return;
    const catItem = CATALOG_BY_BARCODE[barcode];
    if (!catItem) return;

    const paidList = scannedPass.allPaidItems || scannedPass.auditItems;
    const paidMatch = paidList.find((i) => i.barcode === barcode);

    if (paidMatch) {
      setCheckedItems((prev) => ({ ...prev, [barcode]: true }));
      setReverseScanResult({
        status: 'PAID_OK',
        barcode: catItem.barcode,
        name: catItem.name,
        price: catItem.storePrice,
        weightGrams: catItem.weightGrams,
        detail: `Verified on Bill ${scannedPass.orderId} (Qty: ${paidMatch.quantity} paid · ₹${paidMatch.storePrice})`,
      });
    } else {
      // Caught unpaid / swapped item in cart!
      adjustTrustScore(-15);
      setReverseScanResult({
        status: 'UNPAID_THEFT_CAUGHT',
        barcode: catItem.barcode,
        name: catItem.name,
        price: catItem.storePrice,
        weightGrams: catItem.weightGrams,
        detail: `ALERT! ${catItem.name} (₹${catItem.storePrice}, ${catItem.weightGrams}g) is physically in the cart but was NEVER scanned or paid on Bill ${scannedPass.orderId}!`,
      });
    }

    // Verify with Backend Orders API & log swap penalty if online
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
  };

  const toggleCheckbox = (barcode: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [barcode]: !prev[barcode],
    }));
  };

  const verifiedCount = scannedPass
    ? scannedPass.auditItems.filter((i) => checkedItems[i.barcode]).length
    : 0;
  const totalAuditCount = scannedPass ? scannedPass.auditItems.length : 0;
  const allChecked = scannedPass !== null && verifiedCount === totalAuditCount;

  // Quick items for Guard to test Reverse Spot-Scanning (Paid item vs Swapped Unpaid Ghee/Almonds)
  const reverseTestItems = [
    CATALOG_BY_BARCODE['8901262050550'], // Amul Cow Ghee 500g ₹550 (Swapped Unpaid Item!)
    CATALOG_BY_BARCODE['8904999905801'], // California Almonds 500g ₹580 (Unpaid High-Value Item!)
    ...(scannedPass?.auditItems
      .map((i) => CATALOG_BY_BARCODE[i.barcode])
      .filter(Boolean) || []),
  ].slice(0, 5);

  return (
    <View style={styles.screen}>
      {!scannedPass ? (
        <View style={styles.scannerWrapper}>
          <View style={styles.scannerBox}>
            <ScannerView onScan={handleScanData} isScanning={true} />
          </View>

          <View style={styles.guardPromptPanel}>
            <View style={styles.guardPanelInner}>
              <View style={styles.guardBadgeRow}>
                <View style={styles.shieldBox}>
                  <ShieldCheck size={17} color="#09090B" strokeWidth={1.8} />
                </View>
                <View>
                  <Text style={styles.guardPromptTitle}>
                    Exit Gate Verification Terminal
                  </Text>
                  <Text style={styles.guardPromptMeta}>
                    Reverse Barcode Spot-Scanner · Weight Scale · Swap Fraud Catch
                  </Text>
                </View>
              </View>

              <Text style={styles.guardPromptSub}>
                Scan the customer&apos;s digital exit pass QR code, then scan any 2–3 high-value items straight from their cart to catch barcode swaps or unpaid items.
              </Text>

              {scanError && <Text style={styles.scanErrorText}>{scanError}</Text>}

              <View style={styles.demoActionsCol}>
                {lastExitPass && (
                  <TouchableOpacity
                    style={styles.primaryActionBtn}
                    onPress={() => loadExitPass(lastExitPass)}
                    activeOpacity={0.85}
                  >
                    <QrCode size={16} color="#FFFFFF" strokeWidth={1.8} />
                    <Text style={styles.primaryActionText}>
                      Load Latest Customer Pass ({lastExitPass.orderId} · ₹
                      {lastExitPass.totalPrice})
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => loadExitPass(DEMO_SAMPLE_EXIT_PASS)}
                  activeOpacity={0.75}
                >
                  <QrCode size={16} color="#09090B" strokeWidth={1.8} />
                  <Text style={styles.secondaryActionText}>
                    Load Demo Swap-Test Pass (Jaggery ₹100 vs Ghee ₹550)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.auditScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Receipt Header */}
          <View style={styles.auditHeaderBanner}>
            <View style={{ flex: 1 }}>
              <View style={styles.receiptStatusRow}>
                <View style={styles.verifiedDot} />
                <Text style={styles.auditOrderTag}>
                  SIGNED RECEIPT · {scannedPass.orderId}
                </Text>
              </View>
              <Text style={styles.auditCustomerText}>
                {scannedPass.customerName || 'Verified Shopper'} (+91{' '}
                {scannedPass.customerPhone || '9820411290'}) · Trust{' '}
                {scannedPass.customerTrustScore ?? 95}%
              </Text>
              <Text style={styles.auditStoreSub}>
                {scannedPass.storeName} · {scannedPass.paymentMethod || 'UPI'} (
                {scannedPass.upiRef})
              </Text>
            </View>
            <View style={styles.paidBadge}>
              <Text style={styles.paidBadgeText}>₹{scannedPass.totalPrice} Paid</Text>
            </View>
          </View>

          {/* 1. CAMERA ANOMALY / BARCODE-SWAP ALERT BANNER */}
          {scannedPass.securityFlags && scannedPass.securityFlags.length > 0 && (
            <View style={styles.cameraAnomalyCard}>
              <View style={styles.cameraAnomalyHeader}>
                <AlertTriangle size={16} color="#DC2626" strokeWidth={2.2} />
                <Text style={styles.cameraAnomalyTitle}>
                  HANDLEBAR CAMERA FLAGGED {scannedPass.securityFlags.length} SUSPICIOUS DROP!
                </Text>
              </View>
              {scannedPass.securityFlags.map((flag) => (
                <Text key={flag.id} style={styles.cameraAnomalyNote}>
                  • {flag.note}
                </Text>
              ))}
              <Text style={styles.cameraAnomalyInstruction}>
                👉 Guard Instruction: Use the Reverse Cart Spot-Scanner below to scan the high-value item in the cart (e.g. Amul Ghee ₹550).
              </Text>
            </View>
          )}

          {/* 2. REVERSE GUARD BARCODE SPOT-SCANNER (CATCHES BARCODE SWAPS!) */}
          <View style={styles.reverseScannerCard}>
            <View style={styles.reverseHeaderRow}>
              <ScanLine size={16} color="#09090B" strokeWidth={2} />
              <Text style={styles.reverseTitle}>
                Reverse Guard Spot-Scanner (Scan Item from Cart)
              </Text>
            </View>
            <Text style={styles.reverseSub}>
              Instead of looking for cheap items on the bill, pick any high-value item physically inside the customer&apos;s cart and scan it to verify if they actually paid for it:
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reverseChipScroll}
            >
              {reverseTestItems.map((item) => {
                if (!item) return null;
                const paidList = scannedPass.allPaidItems || scannedPass.auditItems;
                const isOnBill = paidList.some((p) => p.barcode === item.barcode);
                return (
                  <TouchableOpacity
                    key={item.barcode}
                    style={[
                      styles.reverseTestChip,
                      !isOnBill && styles.reverseTestChipSuspect,
                    ]}
                    onPress={() => handleReverseGuardItemScan(item.barcode)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.reverseChipTag,
                        !isOnBill ? { color: '#DC2626' } : { color: '#059669' },
                      ]}
                    >
                      {!isOnBill
                        ? '🚨 IN CART (SWAPPED / UNPAID TEST)'
                        : '✅ IN CART (PAID ITEM)'}
                    </Text>
                    <Text style={styles.reverseChipName} numberOfLines={1}>
                      Scan {item.name}
                    </Text>
                    <Text style={styles.reverseChipMeta}>
                      ₹{item.storePrice} · {item.unit} ({item.weightGrams}g)
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {reverseScanResult && (
              <View
                style={[
                  styles.reverseResultBanner,
                  reverseScanResult.status === 'PAID_OK'
                    ? styles.reverseResultOk
                    : styles.reverseResultTheft,
                ]}
              >
                <View style={styles.reverseResultTitleRow}>
                  {reverseScanResult.status === 'PAID_OK' ? (
                    <Check size={16} color="#065F46" strokeWidth={2.5} />
                  ) : (
                    <ShieldAlert size={17} color="#991B1B" strokeWidth={2.5} />
                  )}
                  <Text
                    style={[
                      styles.reverseResultTitle,
                      reverseScanResult.status === 'PAID_OK'
                        ? { color: '#065F46' }
                        : { color: '#991B1B' },
                    ]}
                  >
                    {reverseScanResult.status === 'PAID_OK'
                      ? `PAID ITEM VERIFIED: ${reverseScanResult.name}`
                      : `BARCODE SWAP / THEFT CAUGHT: UNPAID ITEM IN CART!`}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.reverseResultDetail,
                    reverseScanResult.status === 'PAID_OK'
                      ? { color: '#047857' }
                      : { color: '#7F1D1D' },
                  ]}
                >
                  {reverseScanResult.detail}
                </Text>
              </View>
            )}
          </View>

          {/* 3. Key Metrics Cards: Item Count & Expected Weight Scale Check */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <View style={styles.metricIconHeader}>
                <ShoppingBag size={14} color="#71717A" strokeWidth={1.8} />
                <Text style={styles.metricLabel}>TOTAL QUANTITY</Text>
              </View>
              <Text style={styles.metricValue}>{scannedPass.totalItemCount}</Text>
              <Text style={styles.metricSub}>
                {scannedPass.isFamilyOrder
                  ? `Cart #1 (${scannedPass.cart1ItemCount}) + Cart #2 (${scannedPass.cart2ItemCount})`
                  : 'Units in basket'}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricIconHeader}>
                <Scale size={14} color="#71717A" strokeWidth={1.8} />
                <Text style={styles.metricLabel}>EXIT SCALE WEIGHT</Text>
              </View>
              <Text
                style={[
                  styles.metricValue,
                  scaleStatus === 'OVERWEIGHT' && { color: '#DC2626' },
                ]}
              >
                {scaleStatus === 'MATCH'
                  ? `${(scannedPass.cartWeightGrams / 1000).toFixed(2)} kg`
                  : `${((scannedPass.cartWeightGrams + 500) / 1000).toFixed(2)} kg`}
              </Text>
              <View style={styles.scaleToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.scaleMiniBtn,
                    scaleStatus === 'MATCH' && styles.scaleMiniBtnOk,
                  ]}
                  onPress={() => setScaleStatus('MATCH')}
                >
                  <Text style={styles.scaleMiniBtnText}>±0g Match</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.scaleMiniBtn,
                    scaleStatus === 'OVERWEIGHT' && styles.scaleMiniBtnAlert,
                  ]}
                  onPress={() => setScaleStatus('OVERWEIGHT')}
                >
                  <Text style={styles.scaleMiniBtnText}>+500g Extra</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Family Multi-Cart Info (if applicable) */}
          {scannedPass.isFamilyOrder && (
            <View style={styles.familyGuardCard}>
              <Users size={15} color="#065F46" strokeWidth={2} />
              <Text style={styles.familyGuardText}>
                Family Multi-Cart Order: Verify Cart #1 (
                {((scannedPass.cart1WeightGrams || 0) / 1000).toFixed(2)} kg) and Cart #2 (
                {((scannedPass.cart2WeightGrams || 0) / 1000).toFixed(2)} kg) under single receipt.
              </Text>
            </View>
          )}

          {/* 4. 3 Items to Spot-Check */}
          <View style={styles.spotCheckCard}>
            <View style={styles.spotCheckHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.spotCheckTitle}>Spot-Check Checklist</Text>
                <Text style={styles.spotCheckSubtitle}>
                  Confirm these 3 items in the customer&apos;s bag (2 highest-value + 1 random):
                </Text>
              </View>
              <View
                style={[
                  styles.progressBadge,
                  allChecked && styles.progressBadgeDone,
                ]}
              >
                <Text
                  style={[
                    styles.progressBadgeText,
                    allChecked && styles.progressBadgeTextDone,
                  ]}
                >
                  {verifiedCount}/{totalAuditCount} Verified
                </Text>
              </View>
            </View>

            <View style={styles.spotList}>
              {scannedPass.auditItems.map((item, idx) => {
                const isChecked = !!checkedItems[item.barcode];
                const badgeLabel = idx < 2 ? `Priority #${idx + 1}` : 'Random Pick';
                const catInfo = CATALOG_BY_BARCODE[item.barcode];
                const monogram = getBrandMonogram(
                  item.brand || catInfo?.brand,
                  item.name
                );

                return (
                  <TouchableOpacity
                    key={item.barcode}
                    style={[
                      styles.spotCheckItemRow,
                      isChecked && styles.spotCheckItemRowChecked,
                    ]}
                    onPress={() => toggleCheckbox(item.barcode)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.checkboxBox,
                        isChecked && styles.checkboxBoxChecked,
                      ]}
                    >
                      {isChecked && <Check size={13} color="#FFFFFF" strokeWidth={2.5} />}
                    </View>

                    <View style={styles.spotThumbBox}>
                      <Text style={styles.spotThumbMonogram}>{monogram}</Text>
                    </View>

                    <View style={styles.spotItemDetails}>
                      <View style={styles.spotBadgeRow}>
                        <Text style={styles.spotTypeBadge}>{badgeLabel}</Text>
                        <Text style={styles.spotBarcodeText}>EAN {item.barcode}</Text>
                      </View>
                      <Text style={styles.spotItemName}>{item.name}</Text>
                      <Text style={styles.spotItemMeta}>
                        Qty {item.quantity} · ₹{item.storePrice} ·{' '}
                        {item.weightGrams * item.quantity}g
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Gate Approval State */}
          {gateApproved ? (
            <View style={styles.gateOpenedBanner}>
              <View style={styles.gateOpenedIcon}>
                <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gateOpenedTitle}>Exit Approved</Text>
                <Text style={styles.gateOpenedSub}>
                  Verification complete for {scannedPass.orderId}. Customer cleared to exit Express Lane.
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.approveGateBtn,
                reverseScanResult?.status === 'UNPAID_THEFT_CAUGHT' &&
                  styles.approveGateBtnBlocked,
              ]}
              activeOpacity={0.85}
              onPress={() => {
                const allTrue: Record<string, boolean> = {};
                scannedPass.auditItems.forEach((i) => {
                  allTrue[i.barcode] = true;
                });
                setCheckedItems(allTrue);
                setGateApproved(true);
                adjustTrustScore(1);
              }}
            >
              <Check size={17} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.approveGateBtnText}>
                {reverseScanResult?.status === 'UNPAID_THEFT_CAUGHT'
                  ? 'Override & Approve After Unpaid Item Paid'
                  : 'Approve & Open Express Exit Gate'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Scan Next Customer Button */}
          <TouchableOpacity
            style={styles.scanNextBtn}
            activeOpacity={0.75}
            onPress={() => {
              setScannedPass(null);
              setGateApproved(false);
              setReverseScanResult(null);
            }}
          >
            <RotateCcw size={14} color="#52525B" strokeWidth={1.8} />
            <Text style={styles.scanNextBtnText}>Scan Next Exit Pass</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scannerWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
  scannerBox: {
    flex: 48,
    backgroundColor: '#09090B',
  },
  guardPromptPanel: {
    flex: 52,
    backgroundColor: '#FAFAFA',
    padding: 20,
    justifyContent: 'center',
  },
  guardPanelInner: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  guardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  shieldBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardPromptTitle: {
    color: '#09090B',
    fontSize: 16,
    fontWeight: '600',
  },
  guardPromptMeta: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 1,
  },
  guardPromptSub: {
    color: '#52525B',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  scanErrorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 12,
  },
  demoActionsCol: {
    gap: 8,
  },
  primaryActionBtn: {
    backgroundColor: '#09090B',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryActionBtn: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#D4D4D8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '600',
  },
  auditScrollContent: {
    padding: 20,
    paddingBottom: 44,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },
  auditHeaderBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    gap: 10,
  },
  receiptStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  auditOrderTag: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  auditCustomerText: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  auditStoreSub: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
  paidBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  paidBadgeText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '600',
  },
  cameraAnomalyCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  cameraAnomalyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  cameraAnomalyTitle: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
  },
  cameraAnomalyNote: {
    color: '#7F1D1D',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  cameraAnomalyInstruction: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  reverseScannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  reverseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  reverseTitle: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '700',
  },
  reverseSub: {
    color: '#52525B',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  reverseChipScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  reverseTestChip: {
    width: 195,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 10,
    padding: 10,
  },
  reverseTestChipSuspect: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  reverseChipTag: {
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 3,
  },
  reverseChipName: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '600',
  },
  reverseChipMeta: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
  reverseResultBanner: {
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  reverseResultOk: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  reverseResultTheft: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  reverseResultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  reverseResultTitle: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  reverseResultDetail: {
    fontSize: 12,
    lineHeight: 17,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  metricIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metricLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  metricValue: {
    color: '#09090B',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  metricSub: {
    color: '#71717A',
    fontSize: 11,
  },
  scaleToggleRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  scaleMiniBtn: {
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  scaleMiniBtnOk: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  scaleMiniBtnAlert: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  scaleMiniBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#18181B',
  },
  familyGuardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  familyGuardText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  spotCheckCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  spotCheckHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  spotCheckTitle: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '600',
  },
  spotCheckSubtitle: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  progressBadge: {
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  progressBadgeDone: {
    backgroundColor: '#ECFDF5',
  },
  progressBadgeText: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '600',
  },
  progressBadgeTextDone: {
    color: '#059669',
  },
  spotList: {
    gap: 8,
  },
  spotCheckItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  spotCheckItemRowChecked: {
    backgroundColor: '#FFFFFF',
    borderColor: '#09090B',
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D4D4D8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#09090B',
    borderColor: '#09090B',
  },
  spotThumbBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotThumbMonogram: {
    color: '#18181B',
    fontSize: 11,
    fontWeight: '600',
  },
  spotItemDetails: {
    flex: 1,
  },
  spotBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  spotTypeBadge: {
    color: '#52525B',
    backgroundColor: '#F4F4F5',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  spotBarcodeText: {
    color: '#A1A1AA',
    fontSize: 11,
  },
  spotItemName: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '600',
  },
  spotItemMeta: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 1,
  },
  approveGateBtn: {
    backgroundColor: '#09090B',
    borderRadius: 12,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  approveGateBtnBlocked: {
    backgroundColor: '#DC2626',
  },
  approveGateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  gateOpenedBanner: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 10,
  },
  gateOpenedIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateOpenedTitle: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '600',
  },
  gateOpenedSub: {
    color: '#047857',
    fontSize: 12,
    marginTop: 1,
  },
  scanNextBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  scanNextBtnText: {
    color: '#52525B',
    fontSize: 13,
    fontWeight: '500',
  },
});
