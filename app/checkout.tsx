import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import {
  Smartphone,
  Wallet,
  CreditCard,
  Check,
  Plus,
  Printer,
} from 'lucide-react-native';
import {
  useCartStore,
  ExitPassPayload,
  COUNTER_CHECKOUT_TRUST_THRESHOLD,
  computeInternalCheckoutTrustDelta,
} from '../store/useCartStore';
import {
  computeGstBreakdown,
  shareOrPrintGstInvoice,
} from '../utils/gstInvoice';
import {
  CATALOG_BY_BARCODE,
  calculateOfflinePromoDiscount,
} from '../data/mockStoreCatalog';
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
  formatCleanStoreName,
  buildCompactExitPassQrString,
} from '../theme/tokens';

const MERCHANT_VPA = 'expresscart.pilot@icici';
const MERCHANT_NAME = 'ExpressCart India Retail';

export default function CheckoutScreen() {
  const router = useRouter();
  const {
    isDarkMode,
    userProfile,
    topUpWallet,
    deductWallet,
    activeStore,
    catalogCache,
    items,
    familySecondaryItems,
    familySession,
    securityFlags,
    swappedUnpaidBarcodesInBasket,
    addItemByBarcode,
    getCombinedCartItems,
    generateExitPass,
    clearCart,
  } = useCartStore();

  const COLORS = getThemeColors(isDarkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [exitPass, setExitPass] = useState<ExitPassPayload | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    'Google Pay' | 'PhonePe' | 'Paytm' | 'Store Wallet' | 'Saved Card'
  >('Google Pay');
  const [walletError, setWalletError] = useState<string | null>(null);
  const [invoiceFeedback, setInvoiceFeedback] = useState(false);

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

  // Internal routing check — never displayed numerically to customer
  const effectiveTrustScore = Math.max(
    0,
    Math.min(
      100,
      (userProfile?.trustScore ?? 95) +
        computeInternalCheckoutTrustDelta(
          securityFlags,
          swappedUnpaidBarcodesInBasket.length
        )
    )
  );
  const isForcedCounterCheckout =
    effectiveTrustScore < COUNTER_CHECKOUT_TRUST_THRESHOLD;

  const buildUpiQuery = () => {
    const tr = `EXP${Date.now().toString().slice(-8)}`;
    return `pa=${encodeURIComponent(MERCHANT_VPA)}&pn=${encodeURIComponent(
      MERCHANT_NAME
    )}&am=${totalPrice.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
      `ExpressCart ${activeStore}`
    )}&tr=${tr}`;
  };

  const handleLoadSampleCart = () => {
    const sampleItems = (catalogCache || []).slice(0, 3);
    sampleItems.forEach((item) => addItemByBarcode(item.barcode));
    setWalletError(null);
  };

  const handlePayNow = async () => {
    setWalletError(null);

    if (totalItemCount === 0) {
      handleLoadSampleCart();
    }

    if (isForcedCounterCheckout) {
      const generated = generateExitPass('Pay at Counter', {
        requiresCounterCheckout: true,
      });
      setExitPass(generated);
      return;
    }

    if (paymentMethod === 'Store Wallet') {
      if (!userProfile) {
        router.push('/auth');
        return;
      }
      const ok = deductWallet(totalPrice);
      if (!ok) {
        setWalletError(
          `Not enough wallet balance (₹${userProfile.walletBalance}). Add ₹1,000 or choose UPI.`
        );
        return;
      }
      const generated = generateExitPass('ExpressWallet');
      setExitPass(generated);
      return;
    }

    if (paymentMethod === 'Saved Card') {
      const generated = generateExitPass('Card Tap/DIP');
      setExitPass(generated);
      return;
    }

    // UPI Intent (Google Pay, PhonePe, Paytm)
    const schemeMap: Record<string, string> = {
      'Google Pay': 'tez://upi/pay',
      PhonePe: 'phonepe://pay',
      Paytm: 'paytmmp://pay',
    };
    const schemePrefix = schemeMap[paymentMethod] || 'upi://pay';
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
    const generated = generateExitPass(paymentMethod);
    setExitPass(generated);
  };

  // ORDER SUCCESS / EXIT PASS OR COUNTER HANDOFF STATE
  if (exitPass) {
    const qrPayloadString = buildCompactExitPassQrString(exitPass);
    const isClearedViaCounterBill =
      exitPass.verificationMode === 'PHYSICAL_COUNTER_BILL';
    const isCounterHandoffPending =
      Boolean(exitPass.requiresCounterCheckout) && !exitPass.exitVerified;

    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successHeaderBlock}>
          <View style={styles.discountTag}>
            <Text style={styles.discountTagText}>
              {isClearedViaCounterBill
                ? `Cleared via counter bill · ${exitPass.physicalBillRef || 'POS Bill'}`
                : isCounterHandoffPending
                ? `Pay at counter · ₹${exitPass.totalPrice}`
                : `Paid · ₹${exitPass.totalPrice}`}
            </Text>
          </View>
          <Text style={styles.pageTitle}>
            {isClearedViaCounterBill
              ? 'Cleared at counter'
              : isCounterHandoffPending
              ? 'Counter handoff pass'
              : 'Your exit pass'}
          </Text>
          <Text style={styles.pageBody}>
            {isClearedViaCounterBill
              ? 'Billing was completed at the counter. Keep your physical paper bill handy at the exit.'
              : isCounterHandoffPending
              ? 'Show this QR at any manned billing counter to pay and collect your physical bill.'
              : 'Show this signed QR exit pass at the express gate.'}
          </Text>
        </View>

        <View style={styles.qrCard}>
          <View style={styles.qrBox}>
            <QRCode
              value={qrPayloadString}
              size={168}
              color="#111827"
              backgroundColor="#FFFFFF"
            />
          </View>
          <Text style={styles.orderCodeText}>{exitPass.orderId}</Text>
          <Text style={styles.orderMetaCaption}>
            {exitPass.totalItemCount}{' '}
            {exitPass.totalItemCount === 1 ? 'item' : 'items'} ·{' '}
            {(exitPass.cartWeightGrams / 1000).toFixed(2)} kg ·{' '}
            {formatCleanStoreName(undefined, exitPass.storeName)}
          </Text>
        </View>

        <View style={styles.itemsSummaryCard}>
          <Text style={styles.sectionTitle}>Items on this receipt</Text>
          {(exitPass.allPaidItems || exitPass.auditItems).map((item, idx) => (
            <View
              key={item.barcode}
              style={[
                styles.receiptItemRow,
                idx > 0 && styles.receiptItemDivider,
              ]}
            >
              <Image
                source={{ uri: getProductImage(item.barcode) }}
                style={styles.receiptThumb}
                resizeMode="cover"
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.receiptItemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.receiptItemSub}>Qty {item.quantity}</Text>
              </View>
              <Text style={styles.receiptItemPrice}>
                ₹{item.storePrice * item.quantity}
              </Text>
            </View>
          ))}

          {(() => {
            const gst = computeGstBreakdown(exitPass);
            return (
              <View style={styles.gstInvoiceFooter}>
                <View style={styles.divider} />
                <Text style={styles.billCaption}>
                  Store GSTIN: {gst.gstin} · Ref{' '}
                  {exitPass.physicalBillRef || exitPass.upiRef}
                </Text>
                <View style={styles.billRow}>
                  <Text style={styles.billCaption}>
                    Taxable ₹{gst.taxableValue.toFixed(2)}
                  </Text>
                  <Text style={styles.billCaption}>
                    CGST ₹{gst.cgst.toFixed(2)} · SGST ₹{gst.sgst.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.invoiceActionBtn}
                  activeOpacity={0.82}
                  onPress={async () => {
                    await shareOrPrintGstInvoice(exitPass);
                    setInvoiceFeedback(true);
                    setTimeout(() => setInvoiceFeedback(false), 2000);
                  }}
                >
                  <Printer
                    size={16}
                    color={COLORS.accent}
                    strokeWidth={ICON.strokeWidth}
                  />
                  <Text style={styles.invoiceActionBtnText}>
                    {invoiceFeedback
                      ? 'GST Invoice ready'
                      : 'Share / Print GST Invoice'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            clearCart();
            router.replace('/');
          }}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryButtonLabel}>Done</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryTextLink}
          onPress={() => {
            clearCart();
            router.push('/orders');
          }}
        >
          <Text style={styles.secondaryTextLinkLabel}>View all passes</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // CHECKOUT / UPI SELECTION STATE
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.introBlock}>
        <Text style={styles.pageTitle}>
          {isForcedCounterCheckout
            ? 'Assisted counter checkout'
            : 'Skip the checkout line'}
        </Text>
        <Text style={styles.pageBody}>
          {isForcedCounterCheckout
            ? 'Complete payment at a manned billing counter to collect your physical bill.'
            : 'Review your bill and pay with UPI to get your exit pass.'}
        </Text>
      </View>

      {totalItemCount === 0 && (
        <View style={[styles.surfaceCard, { gap: SPACING.sm }]}>
          <Text style={styles.billTotalLabel}>Your cart is empty</Text>
          <Text style={styles.pageBody}>
            Scan items in the aisle or load a sample cart to test UPI checkout.
          </Text>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs }}>
            <TouchableOpacity
              style={[styles.primaryButton, { flex: 1, height: 44 }]}
              onPress={() => router.push('/shop')}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonLabel}>Scan items</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  flex: 1,
                  height: 44,
                  backgroundColor: COLORS.tagBg,
                },
              ]}
              onPress={handleLoadSampleCart}
              activeOpacity={0.85}
            >
              <Text style={[styles.primaryButtonLabel, { color: COLORS.accent }]}>
                Load 3 items
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bill Summary Surface Card */}
      <View style={styles.surfaceCard}>
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>
            Items ({totalItemCount}) · {(totalWeightGrams / 1000).toFixed(2)} kg
          </Text>
          <Text style={styles.billValue}>₹{totalMrp}</Text>
        </View>

        {totalSavings > 0 && (
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Deals applied automatically</Text>
            <View style={styles.discountTag}>
              <Text style={styles.discountTagText}>-₹{totalSavings}</Text>
            </View>
          </View>
        )}

        {familySession?.isActive && cart2Count > 0 && (
          <View style={styles.billRow}>
            <Text style={styles.billCaption}>
              Includes shared family cart ({cart1Count} + {cart2Count} items)
            </Text>
          </View>
        )}

        <View style={styles.billRow}>
          <Text style={styles.billCaption}>Includes GST (₹{includedGst})</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.billTotalRow}>
          <Text style={styles.billTotalLabel}>Total to pay</Text>
          <Text style={styles.billTotalPrice}>₹{totalPrice}</Text>
        </View>
      </View>

      {/* Payment Method Selection OR Assisted Counter Checkout */}
      {isForcedCounterCheckout ? (
        <View style={styles.surfaceCard}>
          <Text style={styles.sectionTitle}>Assisted counter checkout</Text>
          <Text style={styles.pageBody}>
            Please complete billing for this cart at a manned checkout counter.
            Generate your counter handoff code below so the cashier can load your
            scanned items in one scan.
          </Text>
        </View>
      ) : (
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Pay with</Text>

          <View style={styles.surfaceListCard}>
            {(
              [
                {
                  id: 'Google Pay',
                  label: 'Google Pay',
                  sub: 'UPI instant pay',
                  icon: Smartphone,
                },
                {
                  id: 'PhonePe',
                  label: 'PhonePe',
                  sub: 'UPI instant pay',
                  icon: Smartphone,
                },
                {
                  id: 'Paytm',
                  label: 'Paytm UPI',
                  sub: 'UPI instant pay',
                  icon: Smartphone,
                },
                {
                  id: 'Store Wallet',
                  label: 'Store wallet',
                  sub: `Balance ₹${userProfile?.walletBalance ?? 1500}`,
                  icon: Wallet,
                },
                {
                  id: 'Saved Card',
                  label: 'Debit or credit card',
                  sub: 'HDFC •••• 4821',
                  icon: CreditCard,
                },
              ] as const
            ).map((option, idx) => {
              const selected = paymentMethod === option.id;
              const IconComponent = option.icon;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.paymentOptionRow,
                    idx > 0 && styles.receiptItemDivider,
                  ]}
                  onPress={() => {
                    setPaymentMethod(option.id);
                    setWalletError(null);
                  }}
                  activeOpacity={0.75}
                >
                  <IconComponent
                    size={ICON.size}
                    color={selected ? COLORS.accent : COLORS.textSecondary}
                    strokeWidth={ICON.strokeWidth}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        styles.paymentOptionLabel,
                        selected && styles.paymentOptionLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.paymentOptionSub}>{option.sub}</Text>
                  </View>

                  {option.id === 'Store Wallet' && (
                    <TouchableOpacity
                      style={styles.topUpChip}
                      onPress={() => {
                        topUpWallet(1000);
                        setWalletError(null);
                      }}
                    >
                      <Plus
                        size={14}
                        color={COLORS.accent}
                        strokeWidth={ICON.strokeWidth}
                      />
                      <Text style={styles.topUpChipText}>₹1,000</Text>
                    </TouchableOpacity>
                  )}

                  {selected && (
                    <Check
                      size={ICON.size}
                      color={COLORS.accent}
                      strokeWidth={ICON.strokeWidth}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {walletError && <Text style={styles.errorText}>{walletError}</Text>}
        </View>
      )}

      {/* Single Primary Action */}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handlePayNow}
        activeOpacity={0.88}
      >
        <Text style={styles.primaryButtonLabel}>
          {isForcedCounterCheckout
            ? 'Generate counter handoff QR'
            : `Pay ₹${totalPrice} with ${paymentMethod}`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryTextLink}
        onPress={() => router.push('/legal')}
        activeOpacity={0.75}
      >
        <Text style={[styles.billCaption, { textAlign: 'center' }]}>
          By checking out, you agree to exit gate verification rules ·{' '}
          <Text style={{ color: COLORS.accent, fontWeight: TYPOGRAPHY.weightSemibold }}>
            Terms & Privacy
          </Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = (COLORS: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.page,
    paddingTop: SPACING.page,
    paddingBottom: SPACING.xl,
  },
  introBlock: {
    marginBottom: SPACING.section,
  },
  successHeaderBlock: {
    alignItems: 'flex-start',
    marginBottom: SPACING.section,
    gap: SPACING.sm,
  },
  pageTitle: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.titleSize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  pageBody: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  surfaceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.page,
    marginBottom: SPACING.section,
    gap: SPACING.sm,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billLabel: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
  },
  billValue: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  billCaption: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  discountTag: {
    backgroundColor: COLORS.discountBg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.card,
  },
  discountTagText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.discountText,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: SPACING.xs,
  },
  billTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billTotalLabel: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  billTotalPrice: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.titleSize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  paymentSection: {
    marginBottom: SPACING.section,
  },
  sectionTitle: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  surfaceListCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.page,
  },
  paymentOptionRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  paymentOptionLabel: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
  },
  paymentOptionLabelSelected: {
    color: COLORS.accent,
    fontWeight: TYPOGRAPHY.weightSemibold,
  },
  paymentOptionSub: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  topUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.discountBg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.card,
  },
  topUpChipText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.discountText,
  },
  errorText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.danger,
    marginTop: SPACING.sm,
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
  qrCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.section,
    alignItems: 'center',
    marginBottom: SPACING.section,
  },
  qrBox: {
    padding: SPACING.page,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.card,
    marginBottom: SPACING.md,
  },
  orderCodeText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  orderMetaCaption: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  itemsSummaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.page,
    marginBottom: SPACING.section,
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  receiptItemDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  receiptThumb: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.background,
  },
  receiptItemName: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
  },
  receiptItemSub: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  receiptItemPrice: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  secondaryTextLink: {
    minHeight: TOUCH_TARGET.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  secondaryTextLinkLabel: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.accent,
  },
  gstInvoiceFooter: {
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  invoiceActionBtn: {
    marginTop: SPACING.sm,
    minHeight: TOUCH_TARGET.min,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.tagBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  invoiceActionBtnText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.accent,
  },
});
