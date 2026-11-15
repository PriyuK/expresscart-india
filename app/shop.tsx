import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Camera,
  CameraOff,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Search,
  X,
  WifiOff,
  Users,
} from 'lucide-react-native';
import ScannerView from '../components/ScannerView';
import { useCartStore } from '../store/useCartStore';
import {
  STORE_CATEGORIES,
  CATALOG_BY_BARCODE,
  CatalogItem,
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
} from '../theme/tokens';

const EXPRESS_BASKET_LIMIT = 25;

export default function ShopScreen() {
  const router = useRouter();
  const {
    isDarkMode,
    catalogCache,
    items,
    familySecondaryItems,
    activeCartSlot,
    setActiveCartSlot,
    familySession,
    duplicateFamilyAlert,
    clearDuplicateFamilyAlert,
    isOfflineDeadZone,
    addItemByBarcode,
    incrementItem,
    decrementItem,
    clearCart,
    getCombinedCartItems,
  } = useCartStore();

  const COLORS = getThemeColors(isDarkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [isScanning, setIsScanning] = useState(true);
  const [isRollingSleep, setIsRollingSleep] = useState(false);
  const [activeTab, setActiveTab] = useState<'cart' | 'catalog'>('cart');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [scanBanner, setScanBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const catalogByBarcode = useMemo(() => {
    const map: Record<string, CatalogItem> = { ...CATALOG_BY_BARCODE };
    catalogCache.forEach((p) => {
      map[p.barcode] = p;
    });
    return map;
  }, [catalogCache]);

  const handleBarcodeScan = (barcode: string) => {
    setIsRollingSleep(false);
    const ok = addItemByBarcode(barcode);
    if (ok) {
      const added = useCartStore.getState().lastScannedItem;
      setScanBanner({
        type: 'success',
        text: `Added ${added?.name ?? barcode} · ₹${added?.storePrice ?? ''}`,
      });
    } else {
      setScanBanner({
        type: 'error',
        text: `Item ${barcode} not found`,
      });
    }
  };

  const activeSlotItems = activeCartSlot === 1 ? items : familySecondaryItems;
  const combinedItems = getCombinedCartItems();

  const qtyByBarcode = useMemo(() => {
    const map: Record<string, number> = {};
    activeSlotItems.forEach((i) => {
      map[i.barcode] = i.quantity;
    });
    return map;
  }, [activeSlotItems]);

  const filteredCatalog = useMemo(() => {
    return catalogCache.filter((item) => {
      const matchesCat =
        selectedCategory === 'All' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesCat;
      return (
        matchesCat &&
        (item.name.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q) ||
          item.barcode.includes(q) ||
          item.category.toLowerCase().includes(q))
      );
    });
  }, [catalogCache, searchQuery, selectedCategory]);

  const cart1Count = items.reduce((sum, i) => sum + i.quantity, 0);
  const cart2Count = familySecondaryItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalItemCount = cart1Count + cart2Count;

  const rawStorePrice = combinedItems.reduce(
    (sum, i) => sum + i.storePrice * i.quantity,
    0
  );
  const totalMrp = combinedItems.reduce((sum, i) => sum + i.mrp * i.quantity, 0);
  const totalPromoDiscount = combinedItems.reduce((sum, i) => {
    const cat = catalogByBarcode[i.barcode];
    const { promoDiscount } = calculateOfflinePromoDiscount(
      { storePrice: i.storePrice, offerType: i.offerType || cat?.offerType },
      i.quantity
    );
    return sum + promoDiscount;
  }, 0);

  const totalPrice = Math.max(0, rawStorePrice - totalPromoDiscount);
  const totalSavings = totalMrp - totalPrice;
  const isOverExpressLimit = totalItemCount > EXPRESS_BASKET_LIMIT;

  return (
    <View style={styles.screen}>
      {/* Calm Offline Notice — only when offline */}
      {isOfflineDeadZone && (
        <View style={styles.offlineBanner}>
          <WifiOff
            size={ICON.size}
            color={COLORS.textSecondary}
            strokeWidth={ICON.strokeWidth}
          />
          <Text style={styles.offlineBannerText}>
            Offline mode · Prices and deals still work
          </Text>
        </View>
      )}

      {/* Top Viewfinder Section */}
      <View style={styles.scannerSection}>
        <ScannerView
          onScan={handleBarcodeScan}
          isScanning={isScanning}
          isRollingSleep={isRollingSleep}
          onWakeScanner={() => setIsRollingSleep(false)}
          cartTotalPrice={totalPrice}
          cartItemCount={totalItemCount}
        />

        <TouchableOpacity
          style={styles.cameraToggleBtn}
          onPress={() => setIsScanning((prev) => !prev)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isScanning ? 'Pause camera' : 'Resume camera'}
        >
          {isScanning ? (
            <CameraOff
              size={ICON.size}
              color={COLORS.textPrimary}
              strokeWidth={ICON.strokeWidth}
            />
          ) : (
            <Camera
              size={ICON.size}
              color={COLORS.accent}
              strokeWidth={ICON.strokeWidth}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <View style={styles.cartSection}>
        {duplicateFamilyAlert && (
          <View style={styles.noticeBar}>
            <Users
              size={ICON.size}
              color={COLORS.textSecondary}
              strokeWidth={ICON.strokeWidth}
            />
            <Text style={styles.noticeBarText} numberOfLines={2}>
              {duplicateFamilyAlert}
            </Text>
            <TouchableOpacity
              style={styles.noticeDismiss}
              onPress={clearDuplicateFamilyAlert}
            >
              <X
                size={ICON.size}
                color={COLORS.textSecondary}
                strokeWidth={ICON.strokeWidth}
              />
            </TouchableOpacity>
          </View>
        )}

        {scanBanner && (
          <View style={styles.scanToast}>
            <Text
              style={[
                styles.scanToastText,
                scanBanner.type === 'error' && { color: COLORS.danger },
              ]}
              numberOfLines={1}
            >
              {scanBanner.text}
            </Text>
            <TouchableOpacity
              style={styles.noticeDismiss}
              onPress={() => setScanBanner(null)}
            >
              <X
                size={ICON.size}
                color={COLORS.textSecondary}
                strokeWidth={ICON.strokeWidth}
              />
            </TouchableOpacity>
          </View>
        )}

        {familySession?.isActive && (
          <View style={styles.familyStrip}>
            <View style={styles.cartSlotTabs}>
              <TouchableOpacity
                style={[
                  styles.cartSlotPill,
                  activeCartSlot === 1 && styles.cartSlotPillActive,
                ]}
                onPress={() => setActiveCartSlot(1)}
              >
                <Text
                  style={[
                    styles.cartSlotText,
                    activeCartSlot === 1 && styles.cartSlotTextActive,
                  ]}
                >
                  My cart ({cart1Count})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.cartSlotPill,
                  activeCartSlot === 2 && styles.cartSlotPillActive,
                ]}
                onPress={() => setActiveCartSlot(2)}
              >
                <Text
                  style={[
                    styles.cartSlotText,
                    activeCartSlot === 2 && styles.cartSlotTextActive,
                  ]}
                >
                  Family ({cart2Count})
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.familyCodeCaption}>
              Code {familySession.pinCode}
            </Text>
          </View>
        )}

        {isOverExpressLimit && (
          <View style={styles.noticeBar}>
            <Text style={styles.noticeBarText} numberOfLines={1}>
              {totalItemCount} items in cart · Quick check at exit gate
            </Text>
          </View>
        )}

        {/* Navigation Strip: Your cart vs Browse items */}
        <View style={styles.topControlStrip}>
          <View style={styles.segmentedTabs}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'cart' && styles.tabBtnActive,
              ]}
              onPress={() => setActiveTab('cart')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'cart' && styles.tabBtnTextActive,
                ]}
              >
                Your cart ({activeSlotItems.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'catalog' && styles.tabBtnActive,
              ]}
              onPress={() => setActiveTab('catalog')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'catalog' && styles.tabBtnTextActive,
                ]}
              >
                Browse items ({catalogCache.length})
              </Text>
            </TouchableOpacity>
          </View>

          {totalItemCount > 0 && (
            <TouchableOpacity
              onPress={clearCart}
              style={styles.clearBtn}
              activeOpacity={0.7}
              accessibilityLabel="Clear cart"
            >
              <Trash2
                size={ICON.size}
                color={COLORS.textSecondary}
                strokeWidth={ICON.strokeWidth}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* TAB 1: YOUR CART */}
        {activeTab === 'cart' ? (
          activeSlotItems.length === 0 ? (
            <View style={styles.emptyCartBox}>
              <View style={styles.emptyIconCircle}>
                <ShoppingBag
                  size={ICON.size}
                  color={COLORS.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
              </View>
              <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
              <Text style={styles.emptyCartSub}>
                Scan a product barcode above or browse items in the store.
              </Text>
              <TouchableOpacity
                style={styles.browseLinkBtn}
                onPress={() => setActiveTab('catalog')}
                activeOpacity={0.75}
              >
                <Text style={styles.browseLinkText}>Browse items</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={activeSlotItems}
              keyExtractor={(item) => `${item.cartSlot || 1}-${item.barcode}`}
              contentContainerStyle={styles.cartListContent}
              renderItem={({ item }) => {
                const catalogInfo = catalogByBarcode[item.barcode];
                const unit =
                  item.unit || catalogInfo?.unit || `${item.weightGrams} g`;
                const imageUri = getProductImage(item.barcode);

                const { promoDiscount, promoAppliedText, upsellHint } =
                  calculateOfflinePromoDiscount(
                    {
                      storePrice: item.storePrice,
                      offerType: item.offerType || catalogInfo?.offerType,
                    },
                    item.quantity
                  );

                const lineTotal =
                  item.storePrice * item.quantity - promoDiscount;
                const lineMrp = item.mrp * item.quantity;
                const lineSaving = Math.max(0, lineMrp - lineTotal);

                return (
                  <View style={styles.itemCard}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.itemThumb}
                      resizeMode="cover"
                    />

                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemWeight}>{unit}</Text>

                      <View style={styles.itemPriceRow}>
                        <Text style={styles.itemPrice}>₹{lineTotal}</Text>
                        {lineMrp > lineTotal && (
                          <Text style={styles.itemOldPrice}>₹{lineMrp}</Text>
                        )}
                        {lineSaving > 0 && (
                          <View style={styles.discountTag}>
                            <Text style={styles.discountTagText}>
                              ₹{lineSaving} off
                            </Text>
                          </View>
                        )}
                      </View>

                      {(promoAppliedText || upsellHint) && (
                        <Text style={styles.dealHint} numberOfLines={1}>
                          {promoAppliedText || upsellHint}
                        </Text>
                      )}
                    </View>

                    <View style={styles.qtyStepper}>
                      <TouchableOpacity
                        style={styles.qtyTouch}
                        onPress={() =>
                          decrementItem(item.barcode, activeCartSlot)
                        }
                      >
                        <Minus
                          size={ICON.size}
                          color={COLORS.textPrimary}
                          strokeWidth={ICON.strokeWidth}
                        />
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.qtyTouch}
                        onPress={() =>
                          incrementItem(item.barcode, activeCartSlot)
                        }
                      >
                        <Plus
                          size={ICON.size}
                          color={COLORS.textPrimary}
                          strokeWidth={ICON.strokeWidth}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )
        ) : (
          /* TAB 2: BROWSE ITEMS */
          <View style={styles.catalogBrowserWrapper}>
            <View style={styles.searchBarRow}>
              <Search
                size={ICON.size}
                color={COLORS.textSecondary}
                strokeWidth={ICON.strokeWidth}
              />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search items..."
                placeholderTextColor={COLORS.textSecondary}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.noticeDismiss}
                  onPress={() => setSearchQuery('')}
                >
                  <X
                    size={ICON.size}
                    color={COLORS.textSecondary}
                    strokeWidth={ICON.strokeWidth}
                  />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.categoryScrollWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {STORE_CATEGORIES.map((cat) => {
                  const active = cat === selectedCategory;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.catPill, active && styles.catPillActive]}
                      onPress={() => setSelectedCategory(cat)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.catPillText,
                          active && styles.catPillTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <FlatList
              data={filteredCatalog}
              keyExtractor={(item) => item.barcode}
              contentContainerStyle={styles.cartListContent}
              renderItem={({ item }) => {
                const qty = qtyByBarcode[item.barcode] || 0;
                const unitSave = Math.max(0, item.mrp - item.storePrice);
                const imageUri = getProductImage(item.barcode);

                return (
                  <View style={styles.itemCard}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.itemThumb}
                      resizeMode="cover"
                    />

                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemWeight}>
                        {item.unit} · {item.aisle}
                      </Text>

                      <View style={styles.itemPriceRow}>
                        <Text style={styles.itemPrice}>
                          ₹{item.storePrice}
                        </Text>
                        {item.mrp > item.storePrice && (
                          <Text style={styles.itemOldPrice}>₹{item.mrp}</Text>
                        )}
                        {unitSave > 0 && (
                          <View style={styles.discountTag}>
                            <Text style={styles.discountTagText}>
                              ₹{unitSave} off
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {qty === 0 ? (
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => handleBarcodeScan(item.barcode)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.addBtnText}>Add</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.qtyStepper}>
                        <TouchableOpacity
                          style={styles.qtyTouch}
                          onPress={() =>
                            decrementItem(item.barcode, activeCartSlot)
                          }
                        >
                          <Minus
                            size={ICON.size}
                            color={COLORS.textPrimary}
                            strokeWidth={ICON.strokeWidth}
                          />
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{qty}</Text>
                        <TouchableOpacity
                          style={styles.qtyTouch}
                          onPress={() =>
                            incrementItem(item.barcode, activeCartSlot)
                          }
                        >
                          <Plus
                            size={ICON.size}
                            color={COLORS.textPrimary}
                            strokeWidth={ICON.strokeWidth}
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          </View>
        )}

        {/* Single Primary Action Footer */}
        <View style={styles.footerBar}>
          <View style={styles.footerSummaryRow}>
            <Text style={styles.footerSummaryText}>
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
              {totalSavings > 0 ? ` · Saving ₹${totalSavings}` : ''}
            </Text>
            <Text style={styles.footerTotalText}>₹{totalPrice}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              totalItemCount === 0 && styles.primaryButtonDisabled,
            ]}
            disabled={totalItemCount === 0}
            onPress={() => router.push('/checkout')}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonLabel}>
              {totalItemCount > 0
                ? `Continue to checkout · ₹${totalPrice}`
                : 'Scan an item to checkout'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (COLORS: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.page,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  offlineBannerText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    flex: 1,
  },
  scannerSection: {
    height: 196,
    position: 'relative',
    backgroundColor: COLORS.surface,
  },
  cameraToggleBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.page,
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartSection: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  noticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.page,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  noticeBarText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  noticeDismiss: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.discountBg,
    paddingLeft: SPACING.page,
    paddingRight: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  scanToastText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.discountText,
  },
  familyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.page,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  cartSlotTabs: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cartSlotPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  cartSlotPillActive: {
    backgroundColor: COLORS.discountBg,
  },
  cartSlotText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  cartSlotTextActive: {
    color: COLORS.accent,
    fontWeight: TYPOGRAPHY.weightSemibold,
  },
  familyCodeCaption: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  topControlStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.page,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SPACING.sm,
  },
  segmentedTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.xs,
    flex: 1,
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
  clearBtn: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.section,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyCartTitle: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  emptyCartSub: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.page,
  },
  browseLinkBtn: {
    minHeight: TOUCH_TARGET.min,
    paddingHorizontal: SPACING.page,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseLinkText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.accent,
  },
  cartListContent: {
    padding: SPACING.page,
    gap: SPACING.md,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  itemThumb: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.background,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  itemWeight: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  itemPrice: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  itemOldPrice: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
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
  dealHint: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.accent,
    marginTop: SPACING.xs,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.card,
  },
  qtyTouch: {
    width: 36,
    height: TOUCH_TARGET.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  addBtn: {
    minHeight: TOUCH_TARGET.min,
    paddingHorizontal: SPACING.page,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.accent,
  },
  catalogBrowserWrapper: {
    flex: 1,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.page,
    marginTop: SPACING.md,
    paddingLeft: SPACING.md,
    borderRadius: RADIUS.card,
    minHeight: TOUCH_TARGET.min,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.sm,
  },
  categoryScrollWrapper: {
    paddingVertical: SPACING.sm,
  },
  categoryScroll: {
    paddingHorizontal: SPACING.page,
    gap: SPACING.sm,
  },
  catPill: {
    minHeight: 36,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catPillActive: {
    backgroundColor: COLORS.discountBg,
  },
  catPillText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  catPillTextActive: {
    color: COLORS.accent,
    fontWeight: TYPOGRAPHY.weightSemibold,
  },
  footerBar: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    padding: SPACING.page,
    gap: SPACING.sm,
  },
  footerSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerSummaryText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.captionSize,
    fontWeight: TYPOGRAPHY.weightRegular,
    color: COLORS.textSecondary,
  },
  footerTotalText: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.textPrimary,
  },
  primaryButton: {
    height: TOUCH_TARGET.primaryButtonHeight,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonLabel: {
    fontFamily: FONTS.sans,
    fontSize: TYPOGRAPHY.bodySize,
    fontWeight: TYPOGRAPHY.weightSemibold,
    color: COLORS.white,
  },
});
