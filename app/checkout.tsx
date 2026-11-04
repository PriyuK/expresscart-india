import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import {
  ShieldCheck,
  Smartphone,
  Scale,
  ShoppingBag,
  ArrowLeft,
  ArrowRight,
  Receipt,
  Check,
  Wallet,
  CreditCard,
  Users,
  UserCheck,
  Plus,
  AlertTriangle,
} from 'lucide-react-native';
import { useCartStore, ExitPassPayload } from '../store/useCartStore';
import {
  CATALOG_BY_BARCODE,
  calculateOfflinePromoDiscount,
} from '../data/mockStoreCatalog';

const MERCHANT_VPA = 'expresscart.pilot@icici';
const MERCHANT_NAME = 'ExpressCart India Retail';

function getBrandMonogram(brand?: string, fallbackName?: string): string {
  const source = brand || fallbackName || 'SK';
  const cleaned = source.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase() || 'SK';
}

export default function CheckoutScreen() {
  const router = useRouter();
  const {
    userProfile,
    topUpWallet,
    deductWallet,
    activeStore,
    items,
    familySecondaryItems,
    familySession,
    getCombinedCartItems,
    generateExitPass,
    clearCart,
  } = useCartStore();

  const [exitPass, setExitPass] = useState<ExitPassPayload | null>(null);
  const [paymentTab, setPaymentTab] = useState<'wallet' | 'upi' | 'card'>('wallet');
  const [walletError, setWalletError] = useState<string | null>(null);

  const combinedItems = getCombinedCartItems();
  const cart1Count = items.reduce((sum, i) => sum + i.quantity, 0);
  const cart2Count = familySecondaryItems.reduce((sum, i) => sum + i.quantity, 0);
  const cart1Weight = items.reduce((sum, i) => sum + i.weightGrams * i.quantity, 0);
  const cart2Weight = familySecondaryItems.reduce(
    (sum, i) => sum + i.weightGrams * i.quantity,
    0
  );

  const totalItemCount = cart1Count + cart2Count;
  const rawStoreTotal = combinedItems.reduce(
    (sum, i) => sum + i.storePrice * i.quantity,
    0
  );
  const totalMrp = combinedItems.reduce((sum, i) => sum + i.mrp * i.quantity, 0);
  const promoSavings = combinedItems.reduce((sum, i) => {
    const cat = CATALOG_BY_BARCODE[i.barcode];
    const { promoDiscount } = calculateOfflinePromoDiscount(
      { storePrice: i.storePrice, offerType: i.offerType || cat?.offerType },
      i.quantity
    );
    return sum + promoDiscount;
  }, 0);

  const totalPrice = Math.max(0, rawStoreTotal - promoSavings);
  const totalSavings = totalMrp - totalPrice;
  const totalWeightGrams = cart1Weight + cart2Weight;
  const includedGst = Math.round(totalPrice * 0.09);

  const buildUpiQuery = () => {
    const tr = `EXP${Date.now().toString().slice(-8)}`;
    return `pa=${encodeURIComponent(MERCHANT_VPA)}&pn=${encodeURIComponent(
      MERCHANT_NAME
    )}&am=${totalPrice.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
      `ExpressCart ${activeStore}`
    )}&tr=${tr}`;
  };

  const handleWalletPay = () => {
    if (!userProfile) {
      router.push('/auth');
      return;
    }
    const ok = deductWallet(totalPrice);
    if (!ok) {
      setWalletError(
        `Insufficient wallet balance (₹${userProfile.walletBalance}). Tap "+ Add ₹1,000" below or pay via UPI.`
      );
      return;
    }
    setWalletError(null);
    const generated = generateExitPass('ExpressWallet');
    setExitPass(generated);
  };

  const handleUpiAppLaunch = async (appName: string, schemePrefix: string) => {
    const query = buildUpiQuery();
    const deepLink = `${schemePrefix}?${query}`;
    try {
      if (Platform.OS !== 'web') {
        const supported = await Linking.canOpenURL(deepLink);
        if (supported) {
          await Linking.openURL(deepLink);
        }
      }
    } catch {
      // Fallback to instant completion in pilot environment
    }
    const generated = generateExitPass(appName);
    setExitPass(generated);
  };

  const handleCardPay = () => {
    const generated = generateExitPass('Card Tap/DIP');
    setExitPass(generated);
  };

  if (exitPass) {
    const qrPayloadString = JSON.stringify({
      type: exitPass.type,
      orderId: exitPass.orderId,
      storeName: exitPass.storeName,
      timestamp: exitPass.timestamp,
      upiRef: exitPass.upiRef,
      paymentMethod: exitPass.paymentMethod,
      customerName: exitPass.customerName,
      customerPhone: exitPass.customerPhone,
      customerTrustScore: exitPass.customerTrustScore,
      signature: exitPass.signature,
      totalPrice: exitPass.totalPrice,
      totalItemCount: exitPass.totalItemCount,
      cartWeightGrams: exitPass.cartWeightGrams,
      isFamilyOrder: exitPass.isFamilyOrder,
      cart1ItemCount: exitPass.cart1ItemCount,
      cart1WeightGrams: exitPass.cart1WeightGrams,
      cart2ItemCount: exitPass.cart2ItemCount,
      cart2WeightGrams: exitPass.cart2WeightGrams,
      auditItems: exitPass.auditItems,
      allPaidItems: exitPass.allPaidItems,
      securityFlags: exitPass.securityFlags,
      actualPhysicalItemsInCart: exitPass.actualPhysicalItemsInCart,
    });

    return (
      <ScrollView
        style={styles.passScreen}
        contentContainerStyle={styles.passContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Clean Verified Pass Header */}
        <View style={styles.passHeaderCard}>
          <View style={styles.verifiedBadgePill}>
            <View style={styles.verifiedDot} />
            <Text style={styles.verifiedBadgeText}>
              {exitPass.isFamilyOrder
                ? 'FAMILY MULTI-CART PASS · PAID'
                : 'PAYMENT VERIFIED · GATE PASS ACTIVE'}
            </Text>
          </View>
          <Text style={styles.passTitle}>Digital Exit Pass</Text>
          <Text style={styles.passSub}>
            {exitPass.customerName} (+91 {exitPass.customerPhone}) · {exitPass.storeName}
          </Text>

          <View style={styles.qrContainer}>
            <View style={styles.qrFrame}>
              <QRCode
                value={qrPayloadString}
                size={200}
                color="#09090B"
                backgroundColor="#FFFFFF"
              />
            </View>
            <Text style={styles.orderIdText}>{exitPass.orderId}</Text>
            <Text style={styles.upiRefText}>
              {exitPass.paymentMethod || 'Paid'} · Ref {exitPass.upiRef} ·{' '}
              {new Date(exitPass.timestamp).toLocaleTimeString()}
            </Text>
          </View>

          {/* Metrics Row */}
          <View style={styles.passStatsRow}>
            <View style={styles.passStatItem}>
              <Text style={styles.passStatLabel}>AMOUNT PAID</Text>
              <Text style={styles.passStatValue}>₹{exitPass.totalPrice}</Text>
            </View>
            <View style={styles.passStatDivider} />
            <View style={styles.passStatItem}>
              <Text style={styles.passStatLabel}>TOTAL ITEMS</Text>
              <Text style={styles.passStatValue}>{exitPass.totalItemCount}</Text>
            </View>
            <View style={styles.passStatDivider} />
            <View style={styles.passStatItem}>
              <Text style={styles.passStatLabel}>EXPECTED WEIGHT</Text>
              <Text style={styles.passStatValue}>
                {(exitPass.cartWeightGrams / 1000).toFixed(2)} kg
              </Text>
            </View>
          </View>

          {/* Family Multi-Cart Physical Breakdown (if 2 carts used) */}
          {exitPass.isFamilyOrder && (
            <View style={styles.familyWeightBreakdown}>
              <Text style={styles.familyBreakdownTitle}>
                Multi-Cart Physical Gate Breakdown (Single Bill):
              </Text>
              <Text style={styles.familyBreakdownLine}>
                • Cart #1 (Host): {exitPass.cart1ItemCount} items ·{' '}
                {((exitPass.cart1WeightGrams || 0) / 1000).toFixed(2)} kg
              </Text>
              <Text style={styles.familyBreakdownLine}>
                • Cart #2 (Family): {exitPass.cart2ItemCount} items ·{' '}
                {((exitPass.cart2WeightGrams || 0) / 1000).toFixed(2)} kg
              </Text>
            </View>
          )}
        </View>

        {/* Camera Anomaly Alert Notice (if any swap/unscanned flag occurred) */}
        {exitPass.securityFlags && exitPass.securityFlags.length > 0 && (
          <View style={styles.flagNoticeCard}>
            <AlertTriangle size={16} color="#B45309" strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.flagNoticeTitle}>
                {exitPass.securityFlags.length} Camera Audit Flag Embedded in QR
              </Text>
              <Text style={styles.flagNoticeSub}>
                Open the Exit Verification Terminal below to see how the Guard&apos;s Reverse Barcode Scanner catches the swapped item!
              </Text>
            </View>
          </View>
        )}

        {/* 3-Item Security Audit Summary Embedded in QR */}
        <View style={styles.auditPreviewCard}>
          <View style={styles.auditPreviewHeader}>
            <ShieldCheck size={16} color="#18181B" strokeWidth={1.8} />
            <Text style={styles.auditPreviewTitle}>
              Offline Signed Manifest ({exitPass.allPaidItems?.length || 0} SKUs)
            </Text>
          </View>
          <Text style={styles.auditPreviewSub}>
            Encoded inside QR for 0-internet verification at the exit gate:
          </Text>
          {exitPass.auditItems.map((item, index) => {
            const catItem = CATALOG_BY_BARCODE[item.barcode];
            const monogram = getBrandMonogram(item.brand || catItem?.brand, item.name);
            return (
              <View key={item.barcode} style={styles.auditPreviewRow}>
                <View style={styles.auditMonogramBox}>
                  <Text style={styles.auditMonogramText}>{monogram}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.auditItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.auditIndexLabel}>
                    {index < 2 ? `Priority #${index + 1}` : 'Random Selection'} · Qty{' '}
                    {item.quantity}
                  </Text>
                </View>
                <Text style={styles.auditItemPrice}>
                  ₹{item.storePrice * item.quantity}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/guard')}
          activeOpacity={0.85}
        >
          <ShieldCheck size={17} color="#FFFFFF" strokeWidth={1.8} />
          <Text style={styles.primaryBtnText}>
            Proceed to Exit Gate Verification Terminal
          </Text>
          <ArrowRight size={16} color="#FFFFFF" strokeWidth={1.8} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => {
            clearCart();
            router.replace('/');
          }}
          activeOpacity={0.75}
        >
          <Text style={styles.secondaryBtnText}>Clear Basket & Return Home</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.checkoutScreen}
      contentContainerStyle={styles.checkoutContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Invoice Summary Card */}
      <View style={styles.billCard}>
        <View style={styles.billHeaderRow}>
          <View>
            <Text style={styles.billStoreName}>{activeStore}</Text>
            <Text style={styles.billTitle}>Single GST Self-Checkout Bill</Text>
          </View>
          <View style={styles.receiptIconBox}>
            <Receipt size={17} color="#18181B" strokeWidth={1.8} />
          </View>
        </View>

        {/* Verified Shopper Identity Row */}
        <View style={styles.customerIdentityBox}>
          <UserCheck size={14} color="#059669" strokeWidth={2} />
          <Text style={styles.customerIdentityText}>
            Billed to: {userProfile?.name || 'Verified Shopper'} (
            {userProfile?.phone ? `+91 ${userProfile.phone}` : 'Phone Verified'}) · Trust{' '}
            {userProfile?.trustScore ?? 95}%
          </Text>
        </View>

        {familySession?.isActive && cart2Count > 0 && (
          <View style={styles.familyBillBanner}>
            <Users size={14} color="#065F46" strokeWidth={2} />
            <Text style={styles.familyBillText}>
              Family Mode Combined: Cart #1 ({cart1Count} items,{' '}
              {(cart1Weight / 1000).toFixed(2)} kg) + Cart #2 ({cart2Count} items,{' '}
              {(cart2Weight / 1000).toFixed(2)} kg)
            </Text>
          </View>
        )}

        <View style={styles.billRow}>
          <View style={styles.rowIconLabel}>
            <ShoppingBag size={14} color="#71717A" strokeWidth={1.8} />
            <Text style={styles.billRowLabel}>Total Quantity</Text>
          </View>
          <Text style={styles.billRowValue}>{totalItemCount} units</Text>
        </View>

        <View style={styles.billRow}>
          <View style={styles.rowIconLabel}>
            <Scale size={14} color="#71717A" strokeWidth={1.8} />
            <Text style={styles.billRowLabel}>Expected Basket Weight</Text>
          </View>
          <Text style={styles.billRowValue}>
            {(totalWeightGrams / 1000).toFixed(2)} kg ({totalWeightGrams}g)
          </Text>
        </View>

        <View style={styles.billRow}>
          <Text style={styles.billRowLabel}>MRP Total</Text>
          <Text style={styles.billRowStrike}>₹{totalMrp}</Text>
        </View>

        {totalMrp - rawStoreTotal > 0 && (
          <View style={styles.billRow}>
            <Text style={[styles.billRowLabel, { color: '#059669', fontWeight: '500' }]}>
              DMart / Smart Store Price Discount
            </Text>
            <Text style={styles.billSavingsValue}>-₹{totalMrp - rawStoreTotal}</Text>
          </View>
        )}

        {promoSavings > 0 && (
          <View style={styles.billRow}>
            <Text style={[styles.billRowLabel, { color: '#059669', fontWeight: '600' }]}>
              Offline Mart Promo / BOGO Savings
            </Text>
            <Text style={styles.billSavingsValue}>-₹{promoSavings}</Text>
          </View>
        )}

        <View style={styles.billRow}>
          <Text style={styles.billRowSubLabel}>Included GST (Est.)</Text>
          <Text style={styles.billRowSubLabel}>₹{includedGst}</Text>
        </View>

        <View style={styles.billDivider} />

        <View style={styles.billTotalRow}>
          <View>
            <Text style={styles.billTotalLabel}>Total Payable</Text>
            {totalSavings > 0 && (
              <Text style={styles.totalSavedHighlight}>
                Total Saved Today: ₹{totalSavings}
              </Text>
            )}
          </View>
          <Text style={styles.billTotalAmount}>₹{totalPrice}</Text>
        </View>
      </View>

      {/* Multi-Mode Payment Selector: Express Wallet / UPI / Card */}
      <View style={styles.upiCard}>
        <View style={styles.paymentTabsRow}>
          <TouchableOpacity
            style={[
              styles.payMethodTab,
              paymentTab === 'wallet' && styles.payMethodTabActive,
            ]}
            onPress={() => setPaymentTab('wallet')}
          >
            <Wallet
              size={14}
              color={paymentTab === 'wallet' ? '#FFFFFF' : '#52525B'}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.payMethodTabText,
                paymentTab === 'wallet' && styles.payMethodTabTextActive,
              ]}
            >
              Wallet (₹{userProfile?.walletBalance ?? 1500})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.payMethodTab,
              paymentTab === 'upi' && styles.payMethodTabActive,
            ]}
            onPress={() => setPaymentTab('upi')}
          >
            <Smartphone
              size={14}
              color={paymentTab === 'upi' ? '#FFFFFF' : '#52525B'}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.payMethodTabText,
                paymentTab === 'upi' && styles.payMethodTabTextActive,
              ]}
            >
              UPI Instant
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.payMethodTab,
              paymentTab === 'card' && styles.payMethodTabActive,
            ]}
            onPress={() => setPaymentTab('card')}
          >
            <CreditCard
              size={14}
              color={paymentTab === 'card' ? '#FFFFFF' : '#52525B'}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.payMethodTabText,
                paymentTab === 'card' && styles.payMethodTabTextActive,
              ]}
            >
              Card
            </Text>
          </TouchableOpacity>
        </View>

        {paymentTab === 'wallet' ? (
          <View>
            <View style={styles.walletPayBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletPayTitle}>ExpressCart In-Store Wallet</Text>
                <Text style={styles.walletPaySub}>
                  Available Balance: ₹{userProfile?.walletBalance ?? 0} · Zero bank wait time
                </Text>
              </View>
              <TouchableOpacity
                style={styles.quickTopUpBtn}
                onPress={() => {
                  topUpWallet(1000);
                  setWalletError(null);
                }}
              >
                <Plus size={12} color="#09090B" strokeWidth={2.2} />
                <Text style={styles.quickTopUpText}>Add ₹1,000</Text>
              </TouchableOpacity>
            </View>

            {walletError && (
              <Text style={styles.walletErrorText}>{walletError}</Text>
            )}

            <TouchableOpacity
              style={styles.simulateUpiBtn}
              activeOpacity={0.85}
              onPress={handleWalletPay}
            >
              <View style={styles.simulateIconCircle}>
                <Check size={14} color="#09090B" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.simulateUpiTitle}>
                  Pay ₹{totalPrice} via Express Wallet
                </Text>
                <Text style={styles.simulateUpiSub}>
                  Instant 1-tap deduction & generate Exit Gate QR Pass
                </Text>
              </View>
              <ArrowRight size={16} color="#FFFFFF" strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        ) : paymentTab === 'upi' ? (
          <View>
            <Text style={styles.upiCardSub}>Merchant VPA: {MERCHANT_VPA}</Text>

            <View style={styles.upiGrid}>
              {[
                {
                  name: 'Google Pay',
                  code: 'GP',
                  scheme: 'tez://upi/pay',
                  sub: 'Instant UPI Intent',
                },
                {
                  name: 'PhonePe',
                  code: 'PP',
                  scheme: 'phonepe://pay',
                  sub: 'Instant UPI Intent',
                },
                {
                  name: 'Paytm UPI',
                  code: 'PT',
                  scheme: 'paytmmp://pay',
                  sub: 'Instant UPI Intent',
                },
              ].map((provider) => (
                <TouchableOpacity
                  key={provider.name}
                  style={styles.upiOptionBtn}
                  activeOpacity={0.75}
                  onPress={() => handleUpiAppLaunch(provider.name, provider.scheme)}
                >
                  <View style={styles.upiBadgeCircle}>
                    <Text style={styles.upiBadgeLetter}>{provider.code}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upiAppName}>{provider.name}</Text>
                    <Text style={styles.upiSchemeText}>{provider.sub}</Text>
                  </View>
                  <Text style={styles.upiPayArrow}>Pay ₹{totalPrice}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.walletPayBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletPayTitle}>
                  Saved Visa / RuPay Debit & Credit Card
                </Text>
                <Text style={styles.walletPaySub}>
                  HDFC Bank Millennia •••• 4821 · Tokenized RBI Compliant
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.simulateUpiBtn}
              activeOpacity={0.85}
              onPress={handleCardPay}
            >
              <View style={styles.simulateIconCircle}>
                <Check size={14} color="#09090B" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.simulateUpiTitle}>
                  Pay ₹{totalPrice} with Saved Card
                </Text>
                <Text style={styles.simulateUpiSub}>
                  Generate signed digital exit pass & gate verification QR
                </Text>
              </View>
              <ArrowRight size={16} color="#FFFFFF" strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.backToShopBtn} onPress={() => router.back()}>
        <ArrowLeft size={15} color="#71717A" strokeWidth={1.8} />
        <Text style={styles.backToShopText}>Return to Cart Scanner</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  checkoutScreen: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  checkoutContent: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 580,
    width: '100%',
    alignSelf: 'center',
  },
  billCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  billHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  billStoreName: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  billTitle: {
    color: '#09090B',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  receiptIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerIdentityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  customerIdentityText: {
    color: '#27272A',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  familyBillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  familyBillText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rowIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  billRowLabel: {
    color: '#52525B',
    fontSize: 13,
    fontWeight: '400',
  },
  billRowSubLabel: {
    color: '#A1A1AA',
    fontSize: 12,
  },
  billRowValue: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '600',
  },
  billRowStrike: {
    color: '#A1A1AA',
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  billSavingsValue: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
  },
  billDivider: {
    height: 1,
    backgroundColor: '#E4E4E7',
    marginVertical: 14,
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billTotalLabel: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '600',
  },
  totalSavedHighlight: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  billTotalAmount: {
    color: '#09090B',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  upiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginBottom: 14,
  },
  paymentTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F4F4F5',
    borderRadius: 10,
    padding: 3,
    gap: 4,
    marginBottom: 16,
  },
  payMethodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 8,
  },
  payMethodTabActive: {
    backgroundColor: '#09090B',
  },
  payMethodTabText: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '600',
  },
  payMethodTabTextActive: {
    color: '#FFFFFF',
  },
  walletPayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  walletPayTitle: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '600',
  },
  walletPaySub: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 2,
  },
  quickTopUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4D4D8',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  quickTopUpText: {
    color: '#09090B',
    fontSize: 11,
    fontWeight: '600',
  },
  walletErrorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 12,
  },
  upiCardSub: {
    color: '#71717A',
    fontSize: 12,
    marginBottom: 12,
  },
  upiGrid: {
    gap: 8,
  },
  upiOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  upiBadgeCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upiBadgeLetter: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '600',
  },
  upiAppName: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '600',
  },
  upiSchemeText: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 1,
  },
  upiPayArrow: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '600',
  },
  simulateUpiBtn: {
    backgroundColor: '#09090B',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  simulateIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulateUpiTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  simulateUpiSub: {
    color: '#A1A1AA',
    fontSize: 11,
    marginTop: 1,
  },
  backToShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  backToShopText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '500',
  },
  // Clean Digital Pass Styles
  passScreen: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  passContent: {
    padding: 20,
    paddingBottom: 44,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  passHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginBottom: 14,
  },
  verifiedBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
    marginBottom: 12,
  },
  verifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  verifiedBadgeText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  passTitle: {
    color: '#09090B',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  passSub: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 20,
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrFrame: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginBottom: 12,
  },
  orderIdText: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  upiRefText: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
  passStatsRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  passStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  passStatDivider: {
    width: 1,
    backgroundColor: '#E4E4E7',
  },
  passStatLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  passStatValue: {
    color: '#09090B',
    fontSize: 16,
    fontWeight: '600',
  },
  familyWeightBreakdown: {
    width: '100%',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  familyBreakdownTitle: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  familyBreakdownLine: {
    color: '#047857',
    fontSize: 11,
    marginTop: 2,
  },
  flagNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  flagNoticeTitle: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '700',
  },
  flagNoticeSub: {
    color: '#B45309',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  auditPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  auditPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  auditPreviewTitle: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '600',
  },
  auditPreviewSub: {
    color: '#71717A',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 17,
  },
  auditPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
    gap: 10,
  },
  auditMonogramBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditMonogramText: {
    color: '#18181B',
    fontSize: 10,
    fontWeight: '600',
  },
  auditItemName: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '500',
  },
  auditIndexLabel: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 1,
  },
  auditItemPrice: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#09090B',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#52525B',
    fontSize: 13,
    fontWeight: '500',
  },
});
