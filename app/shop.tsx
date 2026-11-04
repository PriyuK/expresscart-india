import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Camera,
  CameraOff,
  Plus,
  Minus,
  Trash2,
  Scale,
  AlertCircle,
  ShoppingBag,
  Search,
  LayoutGrid,
  ArrowRight,
  MapPin,
  X,
  BatteryCharging,
  WifiOff,
  Wifi,
  ShieldAlert,
  Users,
  Sparkles,
  CheckCircle2,
} from 'lucide-react-native';
import ScannerView from '../components/ScannerView';
import { useCartStore } from '../store/useCartStore';
import {
  STORE_CATALOG,
  STORE_CATEGORIES,
  CATALOG_BY_BARCODE,
  calculateOfflinePromoDiscount,
} from '../data/mockStoreCatalog';

const EXPRESS_BASKET_LIMIT = 25;

function getBrandMonogram(brand?: string, fallbackName?: string): string {
  const source = brand || fallbackName || 'SK';
  const cleaned = source.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase() || 'SK';
}

export default function ShopScreen() {
  const router = useRouter();
  const {
    userProfile,
    activeStore,
    items,
    familySecondaryItems,
    activeCartSlot,
    setActiveCartSlot,
    familySession,
    startFamilySession,
    simulateFamilyMemberScan,
    duplicateFamilyAlert,
    clearDuplicateFamilyAlert,
    isOfflineDeadZone,
    toggleOfflineDeadZone,
    unscannedDropAlert,
    securityFlags,
    triggerUnscannedDropAlert,
    resolveUnscannedDropAlert,
    simulateBarcodeSwapAttempt,
    addItemByBarcode,
    incrementItem,
    decrementItem,
    clearCart,
    getCombinedCartItems,
  } = useCartStore();

  const [isScanning, setIsScanning] = useState(true);
  const [isRollingSleep, setIsRollingSleep] = useState(false);
  const [activeTab, setActiveTab] = useState<'cart' | 'catalog' | 'security'>('cart');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [scanBanner, setScanBanner] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  const handleBarcodeScan = (barcode: string) => {
    setIsRollingSleep(false);
    const ok = addItemByBarcode(barcode);
    if (ok) {
      const added = useCartStore.getState().lastScannedItem;
      const cat = CATALOG_BY_BARCODE[barcode];
      setScanBanner({
        type: 'success',
        text: `Drop Verified (${cat?.packageColorName || 'Matched'}): ${added?.name ?? barcode} · ₹${added?.storePrice ?? ''}`,
      });
    } else {
      setScanBanner({
        type: 'error',
        text: `Barcode ${barcode} not found in cached store catalog`,
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
    return STORE_CATALOG.filter((item) => {
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
  }, [searchQuery, selectedCategory]);

  // Calculate combined totals across Cart #1 + Cart #2 (if Family Mode active)
  const cart1Count = items.reduce((sum, i) => sum + i.quantity, 0);
  const cart2Count = familySecondaryItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalItemCount = cart1Count + cart2Count;

  const rawStorePrice = combinedItems.reduce(
    (sum, i) => sum + i.storePrice * i.quantity,
    0
  );
  const totalMrp = combinedItems.reduce((sum, i) => sum + i.mrp * i.quantity, 0);
  const totalPromoDiscount = combinedItems.reduce((sum, i) => {
    const cat = CATALOG_BY_BARCODE[i.barcode];
    const { promoDiscount } = calculateOfflinePromoDiscount(
      { storePrice: i.storePrice, offerType: i.offerType || cat?.offerType },
      i.quantity
    );
    return sum + promoDiscount;
  }, 0);

  const totalPrice = Math.max(0, rawStorePrice - totalPromoDiscount);
  const totalSavings = totalMrp - totalPrice;
  const totalWeightGrams = combinedItems.reduce(
    (sum, i) => sum + i.weightGrams * i.quantity,
    0
  );
  const totalWeightKg = (totalWeightGrams / 1000).toFixed(2);
  const isOverExpressLimit = totalItemCount > EXPRESS_BASKET_LIMIT;

  return (
    <View style={styles.screen}>
      {/* TOP 35%: Cart Handlebar Scanner + Eco Standby Engine */}
      <View style={styles.scannerSection}>
        <ScannerView
          onScan={handleBarcodeScan}
          isScanning={isScanning}
          isRollingSleep={isRollingSleep}
          onWakeScanner={() => setIsRollingSleep(false)}
          cartTotalPrice={totalPrice}
          cartItemCount={totalItemCount}
        />

        {/* Floating Handlebar HUD: Store + Offline Status + Eco Rolling Toggle */}
        <View style={styles.scannerTopHud}>
          <TouchableOpacity
            style={[
              styles.storeTag,
              isOfflineDeadZone && styles.storeTagOffline,
            ]}
            onPress={toggleOfflineDeadZone}
            activeOpacity={0.8}
          >
            {isOfflineDeadZone ? (
              <WifiOff size={11} color="#FBBF24" strokeWidth={2.2} />
            ) : (
              <Wifi size={11} color="#10B981" strokeWidth={2.2} />
            )}
            <Text style={styles.storeTagText} numberOfLines={1}>
              {isOfflineDeadZone
                ? '0-Signal Aisle · Offline Cache Active'
                : activeStore.split('-')[0].trim()}
            </Text>
          </TouchableOpacity>

          <View style={styles.hudRightBtns}>
            <TouchableOpacity
              style={[
                styles.ecoModeBtn,
                isRollingSleep && styles.ecoModeBtnActive,
              ]}
              onPress={() => setIsRollingSleep((prev) => !prev)}
              activeOpacity={0.8}
            >
              <BatteryCharging
                size={12}
                color={isRollingSleep ? '#09090B' : '#10B981'}
                strokeWidth={2.2}
              />
              <Text
                style={[
                  styles.ecoModeBtnText,
                  isRollingSleep && styles.ecoModeBtnTextActive,
                ]}
              >
                {isRollingSleep ? 'Wake 5s' : 'Rolling Eco'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cameraToggleBtn,
                isScanning ? styles.cameraActiveBtn : styles.cameraPausedBtn,
              ]}
              onPress={() => setIsScanning((prev) => !prev)}
              activeOpacity={0.8}
            >
              {isScanning ? (
                <CameraOff size={12} color="#D4D4D8" strokeWidth={2} />
              ) : (
                <Camera size={12} color="#09090B" strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* BOTTOM 65%: Multi-Cart, Anti-Theft Watch & Shelf Browser */}
      <View style={styles.cartSection}>
        {/* 1. UNSCANNED DROP WHILE ROLLING ALERT (1 FPS Basket Watch) */}
        {unscannedDropAlert && (
          <View style={styles.unscannedAlertBox}>
            <View style={styles.unscannedAlertHeader}>
              <ShieldAlert size={16} color="#DC2626" strokeWidth={2.2} />
              <Text style={styles.unscannedAlertTitle}>
                1 FPS Basket-Watch: Unscanned Item Dropped in Cart!
              </Text>
            </View>
            <Text style={styles.unscannedAlertDesc}>
              Motion in basket detected while rolling without a barcode scan. Please scan the item or remove it to unlock checkout.
            </Text>
            <View style={styles.unscannedActionRow}>
              <TouchableOpacity
                style={styles.resolveScanBtn}
                onPress={() => {
                  resolveUnscannedDropAlert('8901058851298');
                  setScanBanner({
                    type: 'success',
                    text: 'Resolved: Scanned Maggi 2-Minute Noodles (₹14)',
                  });
                }}
              >
                <Text style={styles.resolveScanBtnText}>
                  Scan Dropped Item Now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resolveRemoveBtn}
                onPress={() => resolveUnscannedDropAlert()}
              >
                <Text style={styles.resolveRemoveBtnText}>
                  Item Removed from Cart
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 2. DUPLICATE ITEM ACROSS FAMILY CARTS WARNING */}
        {duplicateFamilyAlert && (
          <View style={styles.duplicateFamilyBar}>
            <Users size={14} color="#B45309" strokeWidth={2} />
            <Text style={styles.duplicateFamilyText} numberOfLines={2}>
              {duplicateFamilyAlert}
            </Text>
            <TouchableOpacity onPress={clearDuplicateFamilyAlert}>
              <X size={14} color="#92400E" />
            </TouchableOpacity>
          </View>
        )}

        {/* 3. Subtle Scan / Security Feedback Bar */}
        {scanBanner && (
          <View
            style={[
              styles.scanToast,
              scanBanner.type === 'success'
                ? styles.scanToastSuccess
                : scanBanner.type === 'warning'
                ? styles.scanToastWarning
                : styles.scanToastError,
            ]}
          >
            <Text
              style={[
                styles.scanToastText,
                scanBanner.type === 'success'
                  ? styles.scanToastTextSuccess
                  : scanBanner.type === 'warning'
                  ? styles.scanToastTextWarning
                  : styles.scanToastTextError,
              ]}
              numberOfLines={2}
            >
              {scanBanner.text}
            </Text>
          </View>
        )}

        {/* 4. FAMILY / MULTI-CART SWITCHER STRIP */}
        <View style={styles.familyStrip}>
          {familySession?.isActive ? (
            <View style={styles.familyActiveRow}>
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
                    Cart #1 ({cart1Count})
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
                    Cart #2 · Priya ({cart2Count})
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.simFamilyAddBtn}
                onPress={() => {
                  const added = simulateFamilyMemberScan();
                  if (added) {
                    setScanBanner({
                      type: 'success',
                      text: `Family Cart #2 scanned ${added.name} (₹${added.storePrice})`,
                    });
                  }
                }}
              >
                <Plus size={11} color="#065F46" strokeWidth={2.5} />
                <Text style={styles.simFamilyAddText}>Sim Cart #2 Scan</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.familyInactiveRow}>
              <View style={styles.familyHintLeft}>
                <Users size={13} color="#52525B" strokeWidth={1.8} />
                <Text style={styles.familyHintText}>
                  Need 2 carts under 1 bill? Enable Family Multi-Cart
                </Text>
              </View>
              <TouchableOpacity
                style={styles.enableFamilyMiniBtn}
                onPress={() => startFamilySession('Priya (Cart #2)')}
              >
                <Text style={styles.enableFamilyMiniText}>+ Link Cart #2</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Express Lane Limit Warning */}
        {isOverExpressLimit && (
          <View style={styles.limitWarningBar}>
            <AlertCircle size={14} color="#B45309" strokeWidth={2} />
            <Text style={styles.limitWarningText}>
              Large basket ({totalItemCount} items). Guard will perform a 3-item reverse spot-scan at exit.
            </Text>
          </View>
        )}

        {/* Control Bar: Segmented Tabs (Basket / Catalog / Anti-Theft Lab) + Weight & Clear */}
        <View style={styles.topControlStrip}>
          <View style={styles.segmentedTabs}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'cart' && styles.tabBtnActive]}
              onPress={() => setActiveTab('cart')}
              activeOpacity={0.8}
            >
              <ShoppingBag
                size={13}
                color={activeTab === 'cart' ? '#09090B' : '#71717A'}
                strokeWidth={1.8}
              />
              <Text
                style={[styles.tabBtnText, activeTab === 'cart' && styles.tabBtnTextActive]}
              >
                Cart #{activeCartSlot} ({activeSlotItems.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'catalog' && styles.tabBtnActive]}
              onPress={() => setActiveTab('catalog')}
              activeOpacity={0.8}
            >
              <LayoutGrid
                size={13}
                color={activeTab === 'catalog' ? '#09090B' : '#71717A'}
                strokeWidth={1.8}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'catalog' && styles.tabBtnTextActive,
                ]}
              >
                Catalog ({STORE_CATALOG.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'security' && styles.tabBtnActive]}
              onPress={() => setActiveTab('security')}
              activeOpacity={0.8}
            >
              <ShieldAlert
                size={13}
                color={
                  securityFlags.length > 0
                    ? '#DC2626'
                    : activeTab === 'security'
                    ? '#09090B'
                    : '#71717A'
                }
                strokeWidth={1.8}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'security' && styles.tabBtnTextActive,
                  securityFlags.length > 0 && { color: '#DC2626', fontWeight: '700' },
                ]}
              >
                Anti-Theft ({securityFlags.length})
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rightStatsRow}>
            <View style={styles.weightBadge}>
              <Scale size={12} color="#52525B" strokeWidth={1.8} />
              <Text style={styles.weightBadgeText}>{totalWeightKg} kg</Text>
            </View>
            {totalItemCount > 0 && (
              <TouchableOpacity
                onPress={clearCart}
                style={styles.clearBtn}
                activeOpacity={0.7}
              >
                <Trash2 size={14} color="#71717A" strokeWidth={1.8} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* TAB 1: LIVE CART VIEW */}
        {activeTab === 'cart' ? (
          activeSlotItems.length === 0 ? (
            <View style={styles.emptyCartBox}>
              <View style={styles.emptyIconCircle}>
                <ShoppingBag size={22} color="#18181B" strokeWidth={1.6} />
              </View>
              <Text style={styles.emptyCartTitle}>
                Cart #{activeCartSlot} is empty
              </Text>
              <Text style={styles.emptyCartSub}>
                Pass any product over the cart handlebar camera, tap a sample SKU in the quick-scan bar, or test Barcode Swap detection in the Anti-Theft tab.
              </Text>
              <View style={styles.emptyBtnRow}>
                <TouchableOpacity
                  style={styles.browseShelfCta}
                  onPress={() => setActiveTab('catalog')}
                  activeOpacity={0.8}
                >
                  <Search size={14} color="#09090B" strokeWidth={1.8} />
                  <Text style={styles.browseShelfCtaText}>Browse Catalog</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.browseShelfCta}
                  onPress={() => setActiveTab('security')}
                  activeOpacity={0.8}
                >
                  <ShieldAlert size={14} color="#DC2626" strokeWidth={1.8} />
                  <Text style={styles.browseShelfCtaText}>Test Swap Fraud</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <FlatList
              data={activeSlotItems}
              keyExtractor={(item) => `${item.cartSlot || 1}-${item.barcode}`}
              contentContainerStyle={styles.cartListContent}
              renderItem={({ item }) => {
                const catalogInfo = CATALOG_BY_BARCODE[item.barcode];
                const brand = item.brand || catalogInfo?.brand || 'Express';
                const monogram = getBrandMonogram(brand, item.name);
                const unit = item.unit || catalogInfo?.unit || `${item.weightGrams}g`;
                const aisle = item.aisle || catalogInfo?.aisle || 'In-Store';
                const pkgColor =
                  item.packageColorHex || catalogInfo?.packageColorHex || '#E4E4E7';
                const { promoDiscount, promoAppliedText, upsellHint } =
                  calculateOfflinePromoDiscount(
                    {
                      storePrice: item.storePrice,
                      offerType: item.offerType || catalogInfo?.offerType,
                    },
                    item.quantity
                  );

                const lineTotal = item.storePrice * item.quantity - promoDiscount;
                const lineMrp = item.mrp * item.quantity;
                const lineSaving = lineMrp - lineTotal;

                return (
                  <View style={styles.cartItemCard}>
                    <View
                      style={[
                        styles.thumbBox,
                        { borderColor: pkgColor, borderWidth: 2 },
                      ]}
                    >
                      <Text style={styles.thumbMonogram}>{monogram}</Text>
                    </View>

                    <View style={styles.cartItemInfo}>
                      <View style={styles.brandVerifyRow}>
                        <Text style={styles.cartItemBrand}>
                          {brand} · {aisle}
                        </Text>
                        <View style={styles.dropVerifiedBadge}>
                          <CheckCircle2 size={10} color="#059669" strokeWidth={2.2} />
                          <Text style={styles.dropVerifiedText}>Drop OK</Text>
                        </View>
                      </View>
                      <Text style={styles.cartItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.cartItemMetaRow}>
                        <Text style={styles.cartItemUnit}>{unit}</Text>
                        <Text style={styles.cartItemPrice}>· ₹{item.storePrice}</Text>
                        {item.mrp > item.storePrice && (
                          <Text style={styles.cartItemMrp}>₹{item.mrp}</Text>
                        )}
                        {lineSaving > 0 && (
                          <View style={styles.saveTagPill}>
                            <Text style={styles.saveTagText}>Save ₹{lineSaving}</Text>
                          </View>
                        )}
                      </View>
                      {promoAppliedText && (
                        <Text style={styles.promoAppliedLabel}>{promoAppliedText}</Text>
                      )}
                      {upsellHint && (
                        <Text style={styles.upsellHintLabel}>
                          <Sparkles size={10} color="#B45309" /> {upsellHint}
                        </Text>
                      )}
                    </View>

                    <View style={styles.cartItemRight}>
                      <View style={styles.qtyStepper}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => decrementItem(item.barcode, activeCartSlot)}
                        >
                          <Minus size={12} color="#FFFFFF" strokeWidth={2.2} />
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => incrementItem(item.barcode, activeCartSlot)}
                        >
                          <Plus size={12} color="#FFFFFF" strokeWidth={2.2} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.lineTotalText}>₹{lineTotal}</Text>
                    </View>
                  </View>
                );
              }}
            />
          )
        ) : activeTab === 'catalog' ? (
          /* TAB 2: SEARCH & BROWSE OFFLINE CACHED CATALOG VIEW */
          <View style={styles.catalogBrowserWrapper}>
            <View style={styles.searchBarRow}>
              <Search size={15} color="#71717A" strokeWidth={1.8} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search offline cached catalog, brand, or EAN-13..."
                placeholderTextColor="#A1A1AA"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={15} color="#71717A" />
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
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[styles.catPillText, active && styles.catPillTextActive]}
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
                const unitSave = item.mrp - item.storePrice;
                const monogram = getBrandMonogram(item.brand, item.name);

                return (
                  <View style={styles.cartItemCard}>
                    <View
                      style={[
                        styles.thumbBox,
                        { borderColor: item.packageColorHex, borderWidth: 2 },
                      ]}
                    >
                      <Text style={styles.thumbMonogram}>{monogram}</Text>
                    </View>

                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemBrand}>
                        {item.brand} · {item.aisle} · {item.packageColorName}
                      </Text>
                      <Text style={styles.cartItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.cartItemMetaRow}>
                        <Text style={styles.cartItemUnit}>{item.unit}</Text>
                        <Text style={styles.cartItemPrice}>· ₹{item.storePrice}</Text>
                        {item.mrp > item.storePrice && (
                          <Text style={styles.cartItemMrp}>₹{item.mrp}</Text>
                        )}
                        {unitSave > 0 && (
                          <View style={styles.saveTagPill}>
                            <Text style={styles.saveTagText}>Save ₹{unitSave}</Text>
                          </View>
                        )}
                        {item.offerTag && (
                          <View style={styles.offerPromoPill}>
                            <Text style={styles.offerPromoText}>{item.offerTag}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {qty === 0 ? (
                      <TouchableOpacity
                        style={styles.addBtnOutline}
                        onPress={() => handleBarcodeScan(item.barcode)}
                        activeOpacity={0.75}
                      >
                        <Plus size={12} color="#09090B" strokeWidth={2} />
                        <Text style={styles.addBtnOutlineText}>Scan</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.qtyStepper}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => decrementItem(item.barcode, activeCartSlot)}
                        >
                          <Minus size={12} color="#FFFFFF" strokeWidth={2.2} />
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{qty}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => incrementItem(item.barcode, activeCartSlot)}
                        >
                          <Plus size={12} color="#FFFFFF" strokeWidth={2.2} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          </View>
        ) : (
          /* TAB 3: ANTI-THEFT "CART WATCH" & BARCODE-SWAP LAB */
          <ScrollView contentContainerStyle={styles.securityLabContainer}>
            <View style={styles.secLabCard}>
              <Text style={styles.secLabTitle}>
                1. Test 500g Barcode Swap Attack (Jaggery ₹100 → Ghee ₹550)
              </Text>
              <Text style={styles.secLabDesc}>
                Simulates a shopper scanning a 500g Jaggery packet (₹100, Golden Brown Pouch) over the handlebar, pulling it back, and dropping a 500g Amul Ghee Tin (₹550, Red & White Metal Tin) into the basket.
              </Text>
              <TouchableOpacity
                style={styles.secSwapTriggerBtn}
                onPress={() => {
                  const flag = simulateBarcodeSwapAttempt(
                    '8904123405001',
                    '8901262050550'
                  );
                  if (flag) {
                    setScanBanner({
                      type: 'warning',
                      text: `⚠️ Visual Drop Mismatch Flagged! Scanned Jaggery (₹100) vs Dropped Ghee (₹550). Proceed to Checkout & Guard to see how Exit Catch works!`,
                    });
                  }
                }}
                activeOpacity={0.85}
              >
                <ShieldAlert size={15} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.secSwapTriggerText}>
                  Simulate Scan ₹100 Jaggery → Drop ₹550 Ghee (Both 500g)
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.secLabCard}>
              <Text style={styles.secLabTitle}>
                2. Test Sneaking Item While Cart is Rolling (1 FPS Basket Diff)
              </Text>
              <Text style={styles.secLabDesc}>
                Even when the phone screen is in OLED Eco Sleep mode while pushing the cart, a 1 FPS low-res basket snapshot compares before/after frames and catches unscanned drops.
              </Text>
              <TouchableOpacity
                style={styles.secSneakTriggerBtn}
                onPress={() => {
                  setIsRollingSleep(true);
                  triggerUnscannedDropAlert();
                }}
                activeOpacity={0.85}
              >
                <AlertCircle size={15} color="#09090B" strokeWidth={2} />
                <Text style={styles.secSneakTriggerText}>
                  Simulate Dropping Item While Rolling Without Scan
                </Text>
              </TouchableOpacity>
            </View>

            {securityFlags.length > 0 && (
              <View style={styles.secLabCard}>
                <Text style={styles.secLabTitle}>
                  Recorded Session Security Flags ({securityFlags.length})
                </Text>
                {securityFlags.map((flag) => (
                  <View key={flag.id} style={styles.flagItemRow}>
                    <Text style={styles.flagItemType}>
                      {flag.type} · {flag.timestamp}
                    </Text>
                    <Text style={styles.flagItemNote}>{flag.note}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Sticky Bottom Checkout Bar */}
        <View style={styles.stickyFooter}>
          <View style={styles.footerPriceCol}>
            <Text style={styles.footerLabel}>
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} · {totalWeightKg} kg
              {totalSavings > 0 ? ` · Saved ₹${totalSavings}` : ''}
              {familySession?.isActive ? ' · 2 Carts' : ''}
            </Text>
            <View style={styles.footerPriceRow}>
              <Text style={styles.footerTotalAmount}>₹{totalPrice}</Text>
              {totalSavings > 0 && (
                <Text style={styles.footerMrpStrike}>₹{totalMrp}</Text>
              )}
              {userProfile && (
                <Text style={styles.walletHintPill}>
                  Wallet ₹{userProfile.walletBalance}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.payUpiBtn,
              (totalItemCount === 0 || unscannedDropAlert) && styles.payUpiBtnDisabled,
            ]}
            disabled={totalItemCount === 0 || unscannedDropAlert}
            onPress={() => router.push('/checkout')}
            activeOpacity={0.85}
          >
            <Text style={styles.payUpiBtnText}>
              {unscannedDropAlert ? 'Scan Alert' : 'Self-Checkout'}
            </Text>
            <ArrowRight size={16} color="#FFFFFF" strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scannerSection: {
    flex: 36,
    position: 'relative',
    backgroundColor: '#09090B',
  },
  scannerTopHud: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  storeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(24, 24, 27, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: '54%',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  storeTagOffline: {
    borderColor: '#B45309',
    backgroundColor: 'rgba(69, 26, 3, 0.9)',
  },
  storeTagText: {
    color: '#E4E4E7',
    fontSize: 11,
    fontWeight: '600',
  },
  hudRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ecoModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(24, 24, 27, 0.88)',
    borderWidth: 1,
    borderColor: '#065F46',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ecoModeBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  ecoModeBtnText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  ecoModeBtnTextActive: {
    color: '#09090B',
    fontWeight: '700',
  },
  cameraToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cameraActiveBtn: {
    backgroundColor: 'rgba(24, 24, 27, 0.85)',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  cameraPausedBtn: {
    backgroundColor: '#FAFAFA',
  },
  cartSection: {
    flex: 64,
    backgroundColor: '#FAFAFA',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  unscannedAlertBox: {
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  unscannedAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  unscannedAlertTitle: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
  },
  unscannedAlertDesc: {
    color: '#7F1D1D',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  unscannedActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resolveScanBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  resolveScanBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  resolveRemoveBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  resolveRemoveBtnText: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '600',
  },
  duplicateFamilyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 8,
  },
  duplicateFamilyText: {
    flex: 1,
    color: '#92400E',
    fontSize: 11,
    fontWeight: '600',
  },
  scanToast: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  scanToastSuccess: {
    backgroundColor: '#ECFDF5',
    borderBottomColor: '#A7F3D0',
  },
  scanToastWarning: {
    backgroundColor: '#FFFBEB',
    borderBottomColor: '#FDE68A',
  },
  scanToastError: {
    backgroundColor: '#FEF2F2',
    borderBottomColor: '#FECACA',
  },
  scanToastText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  scanToastTextSuccess: {
    color: '#065F46',
  },
  scanToastTextWarning: {
    color: '#92400E',
  },
  scanToastTextError: {
    color: '#991B1B',
  },
  familyStrip: {
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
  },
  familyActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartSlotTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  cartSlotPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E4E4E7',
  },
  cartSlotPillActive: {
    backgroundColor: '#09090B',
  },
  cartSlotText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#52525B',
  },
  cartSlotTextActive: {
    color: '#FFFFFF',
  },
  simFamilyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  simFamilyAddText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '600',
  },
  familyInactiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  familyHintLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  familyHintText: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '500',
  },
  enableFamilyMiniBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4D4D8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  enableFamilyMiniText: {
    color: '#09090B',
    fontSize: 11,
    fontWeight: '600',
  },
  limitWarningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
  },
  limitWarningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 11,
    fontWeight: '500',
  },
  topControlStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
  },
  segmentedTabs: {
    flexDirection: 'row',
    backgroundColor: '#F4F4F5',
    borderRadius: 9,
    padding: 3,
    gap: 2,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
    gap: 5,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  tabBtnText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  tabBtnTextActive: {
    color: '#09090B',
    fontWeight: '600',
  },
  rightStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    gap: 4,
  },
  weightBadgeText: {
    color: '#3F3F46',
    fontSize: 11,
    fontWeight: '600',
  },
  clearBtn: {
    padding: 6,
    borderRadius: 7,
    backgroundColor: '#F4F4F5',
  },
  emptyCartBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyCartTitle: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyCartSub: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14,
    maxWidth: 340,
  },
  emptyBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  browseShelfCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4D4D8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
  },
  browseShelfCtaText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '600',
  },
  cartListContent: {
    padding: 12,
    paddingBottom: 20,
    gap: 8,
  },
  cartItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    gap: 12,
  },
  thumbBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMonogram: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  cartItemInfo: {
    flex: 1,
  },
  brandVerifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cartItemBrand: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dropVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  dropVerifiedText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '700',
  },
  cartItemName: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 2,
  },
  cartItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  cartItemUnit: {
    color: '#71717A',
    fontSize: 12,
  },
  cartItemPrice: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '600',
  },
  cartItemMrp: {
    color: '#A1A1AA',
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  saveTagPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  saveTagText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '600',
  },
  offerPromoPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  offerPromoText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '600',
  },
  promoAppliedLabel: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  upsellHintLabel: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  cartItemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090B',
    borderRadius: 8,
  },
  qtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  qtyValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
  },
  lineTotalText: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '600',
  },
  addBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#D4D4D8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnOutlineText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '600',
  },
  catalogBrowserWrapper: {
    flex: 1,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#09090B',
    fontSize: 13,
    paddingVertical: 0,
  },
  categoryScrollWrapper: {
    marginBottom: 4,
  },
  categoryScroll: {
    paddingHorizontal: 12,
    gap: 6,
  },
  catPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  catPillActive: {
    backgroundColor: '#09090B',
    borderColor: '#09090B',
  },
  catPillText: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '500',
  },
  catPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Security Lab Tab
  securityLabContainer: {
    padding: 12,
    gap: 10,
  },
  secLabCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  secLabTitle: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  secLabDesc: {
    color: '#52525B',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  secSwapTriggerBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 9,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secSwapTriggerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  secSneakTriggerBtn: {
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#D4D4D8',
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secSneakTriggerText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '600',
  },
  flagItemRow: {
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
    paddingTop: 8,
    marginTop: 8,
  },
  flagItemType: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  flagItemNote: {
    color: '#52525B',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  stickyFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerPriceCol: {
    flex: 1,
  },
  footerLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  footerPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
    marginTop: 1,
  },
  footerTotalAmount: {
    color: '#09090B',
    fontSize: 20,
    fontWeight: '700',
  },
  footerMrpStrike: {
    color: '#A1A1AA',
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  walletHintPill: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
  },
  payUpiBtn: {
    backgroundColor: '#09090B',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  payUpiBtnDisabled: {
    backgroundColor: '#D4D4D8',
  },
  payUpiBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
