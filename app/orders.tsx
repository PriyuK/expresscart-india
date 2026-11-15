import React, { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { ChevronDown, ChevronUp, ShoppingBag, Printer } from 'lucide-react-native';
import { useCartStore, ExitPassPayload } from '../store/useCartStore';
import {
  computeGstBreakdown,
  shareOrPrintGstInvoice,
} from '../utils/gstInvoice';
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

export default function OrdersScreen() {
  const router = useRouter();
  const {
    isDarkMode,
    orderHistory,
    lastExitPass,
    catalogCache,
    addItemByBarcode,
    getCombinedCartItems,
    generateExitPass,
    fetchOrderHistory,
  } = useCartStore();

  const COLORS = getThemeColors(isDarkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(
    lastExitPass?.orderId || null
  );
  const [refreshing, setRefreshing] = useState(false);
  const [sharedOrderId, setSharedOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrderHistory();
  }, [fetchOrderHistory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrderHistory();
    setRefreshing(false);
  };

  const mergedOrders: ExitPassPayload[] = [...orderHistory];
  if (
    lastExitPass &&
    !mergedOrders.some((o) => o.orderId === lastExitPass.orderId)
  ) {
    mergedOrders.unshift(lastExitPass);
  }

  const activeExpandedId =
    expandedOrderId !== null
      ? expandedOrderId
      : mergedOrders[0]?.orderId || null;

  const handleGenerateSamplePass = () => {
    if (getCombinedCartItems().length === 0) {
      (catalogCache || []).slice(0, 2).forEach((item) => {
        addItemByBarcode(item.barcode);
      });
    }
    const generated = generateExitPass('Google Pay');
    setExpandedOrderId(generated.orderId);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.introBlock}>
        <Text style={styles.pageTitle}>Passes & receipts</Text>
        <Text style={styles.pageBody}>
          Tap any order to open your exit pass QR code and receipt.
        </Text>
      </View>

      {mergedOrders.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <ShoppingBag
              size={ICON.size}
              color={COLORS.textSecondary}
              strokeWidth={ICON.strokeWidth}
            />
          </View>
          <Text style={styles.emptyTitle}>No passes yet</Text>
          <Text style={styles.emptySub}>
            Scan items in the store and pay with UPI to get your exit pass.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/shop')}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonLabel}>Start shopping</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                marginTop: SPACING.sm,
                backgroundColor: COLORS.tagBg,
              },
            ]}
            onPress={handleGenerateSamplePass}
            activeOpacity={0.88}
          >
            <Text style={[styles.primaryButtonLabel, { color: COLORS.accent }]}>
              Generate sample exit pass
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.ordersList}>
          {mergedOrders.map((order) => {
            const isExpanded = activeExpandedId === order.orderId;
            const itemsList = order.allPaidItems || order.auditItems || [];
            const qrPayloadString = buildCompactExitPassQrString(order);

            const isClearedViaPhysicalBill =
              Boolean(order.exitVerified) &&
              order.verificationMode === 'PHYSICAL_COUNTER_BILL';
            const isCounterPending =
              !order.exitVerified &&
              (Boolean(order.requiresCounterCheckout) ||
                order.counterStatus === 'SENT_TO_COUNTER');
            const statusLabel = isClearedViaPhysicalBill
              ? 'Cleared · Counter bill'
              : order.exitVerified
              ? 'Verified'
              : isCounterPending
              ? 'Counter checkout'
              : 'Active pass';

            return (
              <View key={order.orderId} style={styles.orderCard}>
                <TouchableOpacity
                  style={styles.orderHeaderTouch}
                  onPress={() =>
                    setExpandedOrderId(isExpanded ? null : order.orderId)
                  }
                  activeOpacity={0.78}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.orderTitleRow}>
                      <Text style={styles.orderStoreText} numberOfLines={1}>
                        {formatCleanStoreName(undefined, order.storeName)}
                      </Text>
                      <View style={styles.statusTag}>
                        <Text style={styles.statusTagText}>{statusLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.orderMetaText} numberOfLines={1}>
                      {order.totalItemCount}{' '}
                      {order.totalItemCount === 1 ? 'item' : 'items'} ·{' '}
                      {new Date(order.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      · {order.orderId}
                    </Text>
                  </View>

                  <View style={styles.orderRightCol}>
                    <Text style={styles.orderPriceText}>
                      ₹{order.totalPrice}
                    </Text>
                    {isExpanded ? (
                      <ChevronUp
                        size={ICON.size}
                        color={COLORS.textSecondary}
                        strokeWidth={ICON.strokeWidth}
                      />
                    ) : (
                      <ChevronDown
                        size={ICON.size}
                        color={COLORS.textSecondary}
                        strokeWidth={ICON.strokeWidth}
                      />
                    )}
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={styles.divider} />

                    <View style={styles.qrBlock}>
                      <View style={styles.qrBox}>
                        <QRCode
                          value={qrPayloadString}
                          size={156}
                          color="#111827"
                          backgroundColor="#FFFFFF"
                        />
                      </View>
                      <Text style={styles.qrHintText}>
                        {isClearedViaPhysicalBill
                          ? `Cleared via physical counter bill${
                              order.physicalBillRef
                                ? ` (${order.physicalBillRef})`
                                : ''
                            } · Digital QR closed`
                          : order.exitVerified
                          ? 'Verified at exit gate'
                          : isCounterPending
                          ? 'Show this handoff QR at the billing counter to pay and get a physical bill'
                          : 'Show this QR code at the exit gate'}
                      </Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.itemsListBlock}>
                      {itemsList.map((item, idx) => (
                        <View
                          key={item.barcode}
                          style={[
                            styles.invoiceItemRow,
                            idx > 0 && styles.invoiceItemBorder,
                          ]}
                        >
                          <Image
                            source={{ uri: getProductImage(item.barcode) }}
                            style={styles.itemThumb}
                            resizeMode="cover"
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={styles.invoiceItemName}
                              numberOfLines={1}
                            >
                              {item.name}
                            </Text>
                            <Text style={styles.invoiceItemMeta}>
                              Qty {item.quantity} · ₹{item.storePrice}
                            </Text>
                          </View>
                          <Text style={styles.invoiceItemTotal}>
                            ₹{item.storePrice * item.quantity}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.divider} />

                    {(() => {
                      const gst = computeGstBreakdown(order);
                      const isJustShared = sharedOrderId === order.orderId;
                      return (
                        <View style={styles.gstBlock}>
                          <Text style={styles.gstMetaText}>
                            GSTIN {gst.gstin} · Ref{' '}
                            {order.physicalBillRef || order.upiRef}
                          </Text>
                          <View style={styles.gstSplitRow}>
                            <Text style={styles.gstMetaText}>
                              Taxable ₹{gst.taxableValue.toFixed(2)}
                            </Text>
                            <Text style={styles.gstMetaText}>
                              CGST (4.5%) ₹{gst.cgst.toFixed(2)} · SGST (4.5%) ₹
                              {gst.sgst.toFixed(2)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.invoiceActionBtn}
                            activeOpacity={0.8}
                            onPress={async () => {
                              await shareOrPrintGstInvoice(order);
                              setSharedOrderId(order.orderId);
                              setTimeout(() => setSharedOrderId(null), 2000);
                            }}
                          >
                            <Printer
                              size={16}
                              color={COLORS.accent}
                              strokeWidth={ICON.strokeWidth}
                            />
                            <Text style={styles.invoiceActionBtnText}>
                              {isJustShared
                                ? 'GST Invoice ready'
                                : 'Share / Print GST Invoice'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })()}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (COLORS: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.page,
    paddingTop: SPACING.page,
    paddingBottom: SPACING.xl,
  },
  introBlock: {
    marginBottom: SPACING.section,
  },
  pageTitle: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.titleSize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    marginBottom: SPACING.xs,
  },
  pageBody: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.section,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  emptySub: {
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
  ordersList: {
    gap: SPACING.md,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  orderHeaderTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.page,
    gap: SPACING.md,
  },
  orderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  orderStoreText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  statusTag: {
    backgroundColor: COLORS.discountBg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.card,
  },
  statusTagText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.discountText,
  },
  orderMetaText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  orderRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  orderPriceText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  expandedContent: {
    paddingHorizontal: SPACING.page,
    paddingBottom: SPACING.page,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: SPACING.md,
  },
  qrBlock: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  qrBox: {
    padding: SPACING.page,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.card,
    marginBottom: SPACING.sm,
  },
  qrHintText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  itemsListBlock: {
    gap: SPACING.xs,
  },
  invoiceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  invoiceItemBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  itemThumb: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.background,
  },
  invoiceItemName: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
  },
  invoiceItemMeta: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  invoiceItemTotal: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  gstBlock: {
    gap: SPACING.xs,
  },
  gstSplitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  gstMetaText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
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
