import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronRight,
  User,
  Users,
  Check,
  Receipt,
  Wallet,
  HelpCircle,
  LogOut,
  X,
  Navigation,
  ScanLine,
  Smartphone,
  QrCode,
  Lock,
  WifiOff,
  Moon,
  Sun,
  FileText,
} from 'lucide-react-native';
import { useCartStore } from '../store/useCartStore';
import {
  PILOT_STORE_BRANCHES,
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
  getBrandMonogram,
  getOfferDealLine,
  formatCleanStoreName,
} from '../theme/tokens';

export default function LandingScreen() {
  const router = useRouter();
  const {
    isDarkMode,
    toggleDarkMode,
    userProfile,
    logoutUser,
    activeStore,
    setActiveStore,
    setCheckedIn,
    catalogCache,
    isOfflineDeadZone,
    syncStoreCatalogApi,
    familySession,
    startFamilySession,
    joinFamilySession,
    leaveFamilySession,
    addItemByBarcode,
    getCombinedCartItems,
  } = useCartStore();

  const COLORS = getThemeColors(isDarkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFamilySheet, setShowFamilySheet] = useState(false);
  const [showHelpSheet, setShowHelpSheet] = useState(false);
  const [isSyncingGps, setIsSyncingGps] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [browserOffline, setBrowserOffline] = useState(false);

  // Mobile web viewport, overscroll background, 100dvh, and reduced-motion rules
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.backgroundColor = COLORS.pageBg;
      document.body.style.backgroundColor = COLORS.pageBg;

      let viewportMeta = document.querySelector(
        'meta[name="viewport"]'
      ) as HTMLMetaElement | null;
      if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.name = 'viewport';
        document.head.appendChild(viewportMeta);
      }
      if (!viewportMeta.content.includes('viewport-fit=cover')) {
        viewportMeta.content =
          'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover';
      }

      const styleId = 'expresscart-mobile-web-rules';
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        html, body, #root {
          background-color: ${COLORS.pageBg} !important;
          min-height: 100dvh;
          overscroll-behavior-y: none;
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `;

      const updateOnline = () => setBrowserOffline(!window.navigator.onLine);
      updateOnline();
      window.addEventListener('online', updateOnline);
      window.addEventListener('offline', updateOnline);
      return () => {
        window.removeEventListener('online', updateOnline);
        window.removeEventListener('offline', updateOnline);
      };
    }
  }, [COLORS.pageBg]);

  const isOffline = isOfflineDeadZone || browserOffline;
  const isSignedIn = Boolean(userProfile?.isVerified);

  const combinedItems = getCombinedCartItems();
  const totalItemsInCart = combinedItems.reduce((sum, i) => sum + i.quantity, 0);

  const totalCartSavings = useMemo(() => {
    return combinedItems.reduce((sum, item) => {
      const cat =
        catalogCache.find((c) => c.barcode === item.barcode) ||
        CATALOG_BY_BARCODE[item.barcode];
      const mrpDiff = Math.max(0, (item.mrp - item.storePrice) * item.quantity);
      const { promoDiscount } = calculateOfflinePromoDiscount(
        {
          storePrice: item.storePrice,
          offerType: item.offerType || cat?.offerType,
        },
        item.quantity
      );
      return sum + mrpDiff + promoDiscount;
    }, 0);
  }, [combinedItems, catalogCache]);

  const activeStoreBranch = PILOT_STORE_BRANCHES.find(
    (b) => b.name === activeStore
  );
  const hasStoreSelected = Boolean(activeStore && activeStore.trim().length > 0);

  const storeHeaderLabel = hasStoreSelected
    ? activeStoreBranch
      ? formatCleanStoreName(activeStoreBranch.shortName, activeStoreBranch.name)
      : formatCleanStoreName(undefined, activeStore)
    : 'Choose a store';

  // Show 5 offer cards + 1 bordered "See all offers >" tile = 6 tiles in 2-col grid (or all when expanded)
  const featuredOffers = useMemo(() => {
    const list = catalogCache || [];
    return showAllOffers ? list : list.slice(0, 5);
  }, [catalogCache, showAllOffers]);

  const hasOffers = isLoadingOffers || featuredOffers.length > 0;

  const userInitial =
    isSignedIn && userProfile?.name
      ? userProfile.name.trim().charAt(0).toUpperCase()
      : null;

  const ensureStoreCheckedIn = () => {
    if (!hasStoreSelected) {
      setActiveStore(PILOT_STORE_BRANCHES[0].name, false);
    }
    setCheckedIn(true);
  };

  const handleStartShopping = () => {
    if (!hasStoreSelected) {
      setShowStorePicker(true);
      return;
    }
    setCheckedIn(true);
    router.push('/shop');
  };

  const handleScanItems = () => {
    ensureStoreCheckedIn();
    router.push('/shop');
  };

  const handlePayWithUpi = () => {
    ensureStoreCheckedIn();
    router.push('/checkout');
  };

  const handleShowExitPass = () => {
    ensureStoreCheckedIn();
    router.push('/orders');
  };

  const handleSelectOffer = (barcode: string) => {
    ensureStoreCheckedIn();
    addItemByBarcode(barcode);
    router.push('/shop');
  };

  const handleSelectStore = (storeName: string) => {
    setIsLoadingOffers(true);
    setActiveStore(storeName, false);
    setCheckedIn(true);
    setShowStorePicker(false);
    setTimeout(() => {
      setIsLoadingOffers(false);
    }, 280);
  };

  const handleGpsAutoDetectAndSync = () => {
    setIsSyncingGps(true);
    setIsLoadingOffers(true);
    setTimeout(() => {
      syncStoreCatalogApi();
      setActiveStore(PILOT_STORE_BRANCHES[0].name, true);
      setIsSyncingGps(false);
      setShowStorePicker(false);
      setIsLoadingOffers(false);
    }, 320);
  };

  return (
    <SafeAreaView style={styles.pageRoot}>
      {/* 1. Header strip (64px, white, bottom hairline, 16px side padding) */}
      <View style={styles.headerStrip}>
        <TouchableOpacity
          style={styles.headerStoreButton}
          onPress={() => setShowStorePicker(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Select store branch"
        >
          <View style={styles.storeTitleRow}>
            <Text style={styles.storeNameText} numberOfLines={1}>
              {storeHeaderLabel}
            </Text>
            <ChevronDown
              size={ICON.size}
              color={COLORS.text}
              strokeWidth={ICON.strokeWidth}
            />
          </View>

          <View style={styles.storeSubRow}>
            <View
              style={[
                styles.statusDot,
                !hasStoreSelected && styles.statusDotMuted,
              ]}
            />
            <Text style={styles.storeCaptionText} numberOfLines={1}>
              {isOffline
                ? 'Offline mode. Scans still work.'
                : hasStoreSelected
                ? 'Checked in · Works without signal'
                : 'Select a store to start'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.profileTouchTarget}
            onPress={() => setShowProfileMenu(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Account menu"
          >
            <View style={styles.profileCircle}>
              {userInitial ? (
                <Text style={styles.profileInitial}>{userInitial}</Text>
              ) : (
                <User
                  size={ICON.size}
                  color={COLORS.text}
                  strokeWidth={ICON.strokeWidth}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Banner State (shown when actually offline) */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <WifiOff
            size={ICON.size}
            color={COLORS.accent}
            strokeWidth={ICON.strokeWidth}
          />
          <Text style={styles.offlineBannerText} numberOfLines={1}>
            Offline mode. Scans still work.
          </Text>
        </View>
      )}

      {/* Main Scrollable Level-0 Canvas */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Start block (Level 1 white block, radius 16, padding 20px 16px) */}
        <View style={styles.startBlock}>
          <Text style={styles.startTitle}>Scan as you shop</Text>
          <Text style={styles.startBody}>
            Add items by scanning. Pay with UPI. Skip the checkout line.
          </Text>

          {/* 3 equal interactive step buttons: 40px circle (#E7F4EE) + accent icon + 12px label */}
          <View style={styles.stepsRow}>
            <TouchableOpacity
              style={styles.stepItem}
              onPress={handleScanItems}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Scan items"
            >
              <View style={styles.stepIconCircle}>
                <ScanLine
                  size={ICON.size}
                  color={COLORS.accent}
                  strokeWidth={ICON.strokeWidth}
                />
              </View>
              <Text style={styles.stepLabel}>Scan items</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stepItem}
              onPress={handlePayWithUpi}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Pay with UPI"
            >
              <View style={styles.stepIconCircle}>
                <Smartphone
                  size={ICON.size}
                  color={COLORS.accent}
                  strokeWidth={ICON.strokeWidth}
                />
              </View>
              <Text style={styles.stepLabel}>Pay with UPI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stepItem}
              onPress={handleShowExitPass}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Show exit pass"
            >
              <View style={styles.stepIconCircle}>
                <QrCode
                  size={ICON.size}
                  color={COLORS.accent}
                  strokeWidth={ICON.strokeWidth}
                />
              </View>
              <Text style={styles.stepLabel}>Show exit pass</Text>
            </TouchableOpacity>
          </View>

          {totalItemsInCart > 0 && (
            /* Resume cart summary tile */
            <TouchableOpacity
              style={[styles.resumeCartTile, { marginTop: SPACING.page }]}
              onPress={handleStartShopping}
              activeOpacity={0.8}
            >
              <View style={styles.resumeCartLeft}>
                <View style={styles.stepIconCircle}>
                  <ScanLine
                    size={ICON.size}
                    color={COLORS.accent}
                    strokeWidth={ICON.strokeWidth}
                  />
                </View>
                <Text style={styles.resumeCartText} numberOfLines={1}>
                  {totalItemsInCart}{' '}
                  {totalItemsInCart === 1 ? 'item' : 'items'} · ₹
                  {totalCartSavings} saved so far
                </Text>
              </View>
              <ChevronRight
                size={ICON.size}
                color={COLORS.textSecondary}
                strokeWidth={ICON.strokeWidth}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* 3. Offers block (Level 1 white block, radius 16, padding 16) */}
        {hasOffers && (
          <View style={styles.offersBlock}>
            <View style={styles.offersHeaderRow}>
              <Text style={styles.sectionHeading}>Offers today</Text>
              <TouchableOpacity
                style={styles.seeAllHeaderTouch}
                onPress={() => setShowAllOffers((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllHeaderLink}>
                  {showAllOffers ? 'Show less' : 'See all'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.offersGrid}>
              {isLoadingOffers ? (
                [1, 2, 3, 4, 5, 6].map((n) => (
                  <View key={n} style={styles.offerCard}>
                    <View style={styles.monogramTileSkeleton} />
                    <View style={styles.skeletonTextWide} />
                    <View style={styles.skeletonTextShort} />
                    <View style={styles.skeletonPrice} />
                  </View>
                ))
              ) : (
                <>
                  {featuredOffers.map((item) => {
                    const discount = Math.max(0, item.mrp - item.storePrice);
                    const monogram = getBrandMonogram(item.brand, item.name);
                    const dealLine = getOfferDealLine(item.offerType);

                    return (
                      <TouchableOpacity
                        key={item.barcode}
                        style={styles.offerCard}
                        onPress={() => handleSelectOffer(item.barcode)}
                        activeOpacity={0.82}
                      >
                        {/* Monogram tile: 84px high, #E9ECEF, radius 12, 26px semibold in accent green */}
                        <View style={styles.monogramTile}>
                          <Text style={styles.monogramLetters}>{monogram}</Text>
                          {discount > 0 && (
                            <View style={styles.discountTagPill}>
                              <Text style={styles.discountTagText}>
                                ₹{discount} off
                              </Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.offerName} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={styles.offerWeight} numberOfLines={1}>
                          {item.unit}
                        </Text>

                        <View style={styles.offerPriceRow}>
                          <Text style={styles.offerPrice}>
                            ₹{item.storePrice}
                          </Text>
                          {item.mrp > item.storePrice && (
                            <Text style={styles.offerOldPrice}>
                              ₹{item.mrp}
                            </Text>
                          )}
                        </View>

                        {dealLine && (
                          <Text style={styles.offerDealLine} numberOfLines={1}>
                            {dealLine}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* Last grid tile: bordered "See all offers >" link (the ONLY bordered element) */}
                  <TouchableOpacity
                    style={styles.seeAllGridTile}
                    onPress={() => setShowAllOffers((prev) => !prev)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.seeAllGridInner}>
                      <Text style={styles.seeAllGridText}>
                        {showAllOffers ? 'Show fewer' : 'See all offers'}
                      </Text>
                      <ChevronRight
                        size={ICON.size}
                        color={COLORS.accent}
                        strokeWidth={ICON.strokeWidth}
                      />
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 4. Bottom action bar (white, top hairline, padding 12px 16px, sticky/fixed bottom 0) */}
      <View style={styles.bottomActionBar}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            !hasStoreSelected && styles.primaryButtonDisabled,
          ]}
          disabled={!hasStoreSelected}
          onPress={handleStartShopping}
          activeOpacity={0.88}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonLabel}>
            {totalItemsInCart > 0 ? 'Resume cart' : 'Start shopping'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.familyLinkRow}
          onPress={() => setShowFamilySheet(true)}
          activeOpacity={0.7}
        >
          <Users
            size={ICON.size}
            color={COLORS.accent}
            strokeWidth={ICON.strokeWidth}
          />
          <Text style={styles.familyLinkText} numberOfLines={1}>
            {familySession?.isActive
              ? `Shopping with family · Code ${familySession.pinCode}`
              : 'Shopping with family? Link a 2nd cart'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.securityCaptionRow}
          onPress={() => router.push('/auth')}
          activeOpacity={0.7}
        >
          <Lock
            size={ICON.lockSize}
            color={COLORS.captionText}
            strokeWidth={ICON.strokeWidth}
          />
          <Text style={styles.securityCaptionText} numberOfLines={1}>
            Secure exit pass · verified by your mobile number
          </Text>
        </TouchableOpacity>
      </View>

      {/* Store Picker Modal */}
      <Modal
        visible={showStorePicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowStorePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a store</Text>
              <TouchableOpacity
                style={styles.iconTouch}
                onPress={() => setShowStorePicker(false)}
              >
                <X
                  size={ICON.size}
                  color={COLORS.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.locationDetectTile}
              onPress={handleGpsAutoDetectAndSync}
              activeOpacity={0.75}
            >
              <Navigation
                size={ICON.size}
                color={COLORS.accent}
                strokeWidth={ICON.strokeWidth}
              />
              <Text style={styles.locationDetectText}>
                {isSyncingGps
                  ? 'Finding nearest store...'
                  : 'Use current location'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalListGroup}>
              {PILOT_STORE_BRANCHES.map((branch, idx) => {
                const selected = branch.name === activeStore;
                return (
                  <TouchableOpacity
                    key={branch.id}
                    style={[
                      styles.modalListRow,
                      idx > 0 && styles.modalListRowDivider,
                    ]}
                    onPress={() => handleSelectStore(branch.name)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          styles.modalListRowTitle,
                          selected && styles.modalListRowTitleSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {formatCleanStoreName(branch.shortName, branch.name)}
                      </Text>
                      <Text style={styles.modalListRowSub} numberOfLines={1}>
                        {branch.city}
                      </Text>
                    </View>
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

            {hasStoreSelected && (
              <TouchableOpacity
                style={styles.clearStoreTouch}
                onPress={() => {
                  setActiveStore('', false);
                  setShowStorePicker(false);
                }}
              >
                <Text style={styles.clearStoreText}>Clear selected store</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Profile Menu Modal: Sign in, Passes, Wallet, Help */}
      <Modal
        visible={showProfileMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowProfileMenu(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {isSignedIn ? userProfile?.name : 'Account'}
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {isSignedIn
                    ? `+91 ${userProfile?.phone}`
                    : 'Sign in with your mobile number'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.iconTouch}
                onPress={() => setShowProfileMenu(false)}
              >
                <X
                  size={ICON.size}
                  color={COLORS.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalListGroup}>
              <TouchableOpacity
                style={styles.modalListRow}
                onPress={() => {
                  setShowProfileMenu(false);
                  router.push('/auth');
                }}
                activeOpacity={0.7}
              >
                <User
                  size={ICON.size}
                  color={COLORS.text}
                  strokeWidth={ICON.strokeWidth}
                />
                <Text style={styles.menuItemLabel}>
                  {isSignedIn ? 'Account' : 'Sign in'}
                </Text>
                <ChevronRight
                  size={ICON.size}
                  color={COLORS.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalListRow, styles.modalListRowDivider]}
                onPress={() => {
                  setShowProfileMenu(false);
                  router.push('/orders');
                }}
                activeOpacity={0.7}
              >
                <Receipt
                  size={ICON.size}
                  color={COLORS.text}
                  strokeWidth={ICON.strokeWidth}
                />
                <Text style={styles.menuItemLabel}>Passes</Text>
                <ChevronRight
                  size={ICON.size}
                  color={COLORS.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalListRow, styles.modalListRowDivider]}
                onPress={() => {
                  setShowProfileMenu(false);
                  router.push('/auth');
                }}
                activeOpacity={0.7}
              >
                <Wallet
                  size={ICON.size}
                  color={COLORS.text}
                  strokeWidth={ICON.strokeWidth}
                />
                <Text style={styles.menuItemLabel}>
                  {isSignedIn
                    ? `Wallet · ₹${userProfile?.walletBalance ?? 0}`
                    : 'Wallet'}
                </Text>
                <ChevronRight
                  size={ICON.size}
                  color={COLORS.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalListRow, styles.modalListRowDivider]}
                onPress={toggleDarkMode}
                activeOpacity={0.7}
              >
                {isDarkMode ? (
                  <Sun
                    size={ICON.size}
                    color={COLORS.text}
                    strokeWidth={ICON.strokeWidth}
                  />
                ) : (
                  <Moon
                    size={ICON.size}
                    color={COLORS.text}
                    strokeWidth={ICON.strokeWidth}
                  />
                )}
                <Text style={styles.menuItemLabel}>
                  {isDarkMode ? 'Light mode' : 'Dark mode'}
                </Text>
                <ChevronRight
                  size={ICON.size}
                  color={COLORS.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalListRow, styles.modalListRowDivider]}
                onPress={() => {
                  setShowProfileMenu(false);
                  setShowHelpSheet(true);
                }}
                activeOpacity={0.7}
              >
                <HelpCircle
                  size={ICON.size}
                  color={COLORS.text}
                  strokeWidth={ICON.strokeWidth}
                />
                <Text style={styles.menuItemLabel}>Help</Text>
                <ChevronRight
                  size={ICON.size}
                  color={COLORS.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalListRow, styles.modalListRowDivider]}
                onPress={() => {
                  setShowProfileMenu(false);
                  router.push('/legal');
                }}
                activeOpacity={0.7}
              >
                <FileText
                  size={ICON.size}
                  color={COLORS.text}
                  strokeWidth={ICON.strokeWidth}
                />
                <Text style={styles.menuItemLabel}>Terms & privacy</Text>
                <ChevronRight
                  size={ICON.size}
                  color={COLORS.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>

              {isSignedIn && (
                <TouchableOpacity
                  style={[styles.modalListRow, styles.modalListRowDivider]}
                  onPress={() => {
                    logoutUser();
                    setShowProfileMenu(false);
                  }}
                  activeOpacity={0.7}
                >
                  <LogOut
                    size={ICON.size}
                    color={COLORS.danger}
                    strokeWidth={ICON.strokeWidth}
                  />
                  <Text style={[styles.menuItemLabel, { color: COLORS.danger }]}>
                    Sign out
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Shopping with family (4-digit PIN flow) */}
      <Modal
        visible={showFamilySheet}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFamilySheet(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>Shopping with family</Text>
                <Text style={styles.modalSubtitle}>
                  Link a 2nd cart with a 4-digit PIN so two phones can scan into
                  one bill.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.iconTouch}
                onPress={() => setShowFamilySheet(false)}
              >
                <X
                  size={ICON.size}
                  color={COLORS.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>
            </View>

            {familySession?.isActive ? (
              <View style={styles.familyActiveBox}>
                <Text style={styles.familyPinCaption}>4-digit room PIN</Text>
                <Text style={styles.familyPinDisplay}>
                  {familySession.pinCode}
                </Text>
                <Text style={styles.familyMembersCaption}>
                  {familySession.hostName} · {familySession.memberName}
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    setShowFamilySheet(false);
                    handleStartShopping();
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={styles.primaryButtonLabel}>
                    {totalItemsInCart > 0 ? 'Resume cart' : 'Start shopping'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.unlinkFamilyTouch}
                  onPress={() => leaveFamilySession()}
                >
                  <Text style={styles.unlinkFamilyText}>Unlink 2nd cart</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.familyFormArea}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => startFamilySession('Family Cart #2')}
                  activeOpacity={0.88}
                >
                  <Text style={styles.primaryButtonLabel}>
                    Create 4-digit PIN
                  </Text>
                </TouchableOpacity>

                <View style={styles.orDividerRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or enter a PIN</Text>
                  <View style={styles.orLine} />
                </View>

                <View style={styles.pinInputRow}>
                  <TextInput
                    style={styles.pinInput}
                    value={joinCodeInput}
                    onChangeText={(t) =>
                      setJoinCodeInput(t.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="4-digit PIN"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  <TouchableOpacity
                    style={[
                      styles.pinJoinButton,
                      joinCodeInput.trim().length !== 4 &&
                        styles.primaryButtonDisabled,
                    ]}
                    disabled={joinCodeInput.trim().length !== 4}
                    onPress={() => {
                      if (joinCodeInput.trim().length === 4) {
                        joinFamilySession(joinCodeInput.trim());
                        setJoinCodeInput('');
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryButtonLabel}>Link</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Help Modal */}
      <Modal
        visible={showHelpSheet}
        animationType="fade"
        transparent
        onRequestClose={() => setShowHelpSheet(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>How it works</Text>
              <TouchableOpacity
                style={styles.iconTouch}
                onPress={() => setShowHelpSheet(false)}
              >
                <X
                  size={ICON.size}
                  color={COLORS.textSecondary}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.helpStepsList}>
              <View style={styles.helpStepTile}>
                <Text style={styles.helpStepHeading}>1. Scan items</Text>
                <Text style={styles.helpStepCopy}>
                  Scan barcodes as you place items in your cart. Store prices
                  and deals work even without mobile signal.
                </Text>
              </View>
              <View style={styles.helpStepTile}>
                <Text style={styles.helpStepHeading}>2. Pay with UPI</Text>
                <Text style={styles.helpStepCopy}>
                  Skip the checkout line and pay directly with UPI or your store
                  wallet.
                </Text>
              </View>
              <View style={styles.helpStepTile}>
                <Text style={styles.helpStepHeading}>3. Show exit pass</Text>
                <Text style={styles.helpStepCopy}>
                  Present your signed QR exit pass to the associate at the
                  express gate.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowHelpSheet(false)}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryButtonLabel}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    /* Level 0: page background */
    pageRoot: {
      flex: 1,
      backgroundColor: COLORS.pageBg,
      ...(Platform.OS === 'web'
        ? ({
            minHeight: '100dvh',
          } as object)
        : {}),
    },

    /* 1. Header strip (64px, Level 1 bg, bottom hairline, 16px side padding) */
    headerStrip: {
      height: TOUCH_TARGET.headerHeight,
      backgroundColor: COLORS.blockBg,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.divider,
      paddingHorizontal: SPACING.page,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerStoreButton: {
      flex: 1,
      minWidth: 0,
      minHeight: TOUCH_TARGET.min,
      justifyContent: 'center',
      paddingRight: SPACING.sm,
    },
    storeTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    storeNameText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightMedium,
      color: COLORS.text,
      flexShrink: 1,
    },
    storeSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: RADIUS.full,
      backgroundColor: COLORS.accent,
    },
    statusDotMuted: {
      backgroundColor: COLORS.textSecondary,
    },
    storeCaptionText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.captionText,
      flexShrink: 1,
    },
    headerRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    profileTouchTarget: {
      width: TOUCH_TARGET.min,
      height: TOUCH_TARGET.min,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    profileCircle: {
      width: TOUCH_TARGET.avatarSize,
      height: TOUCH_TARGET.avatarSize,
      borderRadius: RADIUS.full,
      backgroundColor: COLORS.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileInitial: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.accent,
    },

    /* Offline banner strip */
    offlineBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: COLORS.tagBg,
      paddingHorizontal: SPACING.page,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.divider,
    },
    offlineBannerText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightMedium,
      color: COLORS.tagText,
      flex: 1,
    },

    /* Scrollable Level-0 Canvas (12px side padding, 12px gap between blocks, bottom padding for sticky bar) */
    scrollView: {
      flex: 1,
      backgroundColor: COLORS.pageBg,
    },
    scrollContent: {
      paddingHorizontal: SPACING.pageSide,
      paddingTop: SPACING.blockGap,
      paddingBottom: 168,
      gap: SPACING.blockGap,
    },

    /* 2. Start block (Level 1 block, radius 16, padding 20px 16px) */
    startBlock: {
      backgroundColor: COLORS.blockBg,
      borderRadius: RADIUS.block,
      paddingVertical: SPACING.blockPadV,
      paddingHorizontal: SPACING.page,
    },
    startTitle: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.titleSize,
      lineHeight: TYPOGRAPHY.titleLineHeight,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.text,
      marginBottom: SPACING.sm,
    },
    startBody: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      lineHeight: TYPOGRAPHY.bodyLineHeight,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
      marginBottom: SPACING.blockPadV,
    },
    stepsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    stepItem: {
      flex: 1,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    stepIconCircle: {
      width: TOUCH_TARGET.stepCircleSize,
      height: TOUCH_TARGET.stepCircleSize,
      borderRadius: RADIUS.full,
      backgroundColor: COLORS.tagBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepLabel: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      lineHeight: TYPOGRAPHY.captionLineHeight,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.captionText,
      textAlign: 'center',
    },
    resumeCartTile: {
      minHeight: 56,
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.card,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    resumeCartLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      flex: 1,
      minWidth: 0,
    },
    resumeCartText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.text,
      flexShrink: 1,
    },

    /* 3. Offers block (Level 1 block, radius 16, padding 16) */
    offersBlock: {
      backgroundColor: COLORS.blockBg,
      borderRadius: RADIUS.block,
      padding: SPACING.page,
    },
    offersHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    sectionHeading: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.sectionHeadingSize,
      lineHeight: TYPOGRAPHY.sectionHeadingLineHeight,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.text,
    },
    seeAllHeaderTouch: {
      minHeight: TOUCH_TARGET.min,
      justifyContent: 'center',
      paddingLeft: SPACING.sm,
    },
    seeAllHeaderLink: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.accent,
    },

    /* 2-column grid, gap 12 */
    offersGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.blockGap,
    },
    offerCard: {
      flexGrow: 1,
      flexBasis: '46%',
      maxWidth: '48.5%',
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.sm,
    },
    monogramTile: {
      height: 84,
      backgroundColor: COLORS.tile,
      borderRadius: RADIUS.tile,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      marginBottom: SPACING.sm,
    },
    monogramLetters: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.monogramSize,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.accent,
    },
    discountTagPill: {
      position: 'absolute',
      top: 6,
      left: 6,
      backgroundColor: COLORS.tagBg,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: RADIUS.full,
    },
    discountTagText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightMedium,
      color: COLORS.tagText,
    },
    offerName: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      lineHeight: 20,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.text,
      minHeight: 40,
      marginBottom: 2,
    },
    offerWeight: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
      marginBottom: 4,
    },
    offerPriceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    offerPrice: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.text,
    },
    offerOldPrice: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
      textDecorationLine: 'line-through',
    },
    offerDealLine: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightMedium,
      color: COLORS.accent,
      marginTop: 4,
    },

    /* Last grid tile: bordered "See all offers >" link (the ONLY bordered element) */
    seeAllGridTile: {
      flexGrow: 1,
      flexBasis: '46%',
      maxWidth: '48.5%',
      minHeight: 176,
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: COLORS.divider,
      padding: SPACING.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    seeAllGridInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    seeAllGridText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.accent,
    },

    /* Skeleton loading placeholders */
    monogramTileSkeleton: {
      height: 84,
      backgroundColor: COLORS.tile,
      borderRadius: RADIUS.tile,
      marginBottom: SPACING.sm,
    },
    skeletonTextWide: {
      width: '85%',
      height: 14,
      borderRadius: 4,
      backgroundColor: COLORS.tile,
      marginBottom: 6,
    },
    skeletonTextShort: {
      width: '45%',
      height: 12,
      borderRadius: 4,
      backgroundColor: COLORS.tile,
      marginBottom: 8,
    },
    skeletonPrice: {
      width: '55%',
      height: 16,
      borderRadius: 4,
      backgroundColor: COLORS.tile,
    },

    /* 4. Bottom action bar (Level 1 bg, top hairline, padding 12px 16px, sticky bottom 0) */
    bottomActionBar: {
      backgroundColor: COLORS.blockBg,
      borderTopWidth: 1,
      borderTopColor: COLORS.divider,
      paddingTop: SPACING.md,
      paddingHorizontal: SPACING.page,
      paddingBottom: SPACING.page,
      ...(Platform.OS === 'web'
        ? ({
            position: 'sticky',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          } as object)
        : {}),
    },
    primaryButton: {
      height: TOUCH_TARGET.primaryButtonHeight,
      backgroundColor: COLORS.primaryButtonBg,
      borderRadius: RADIUS.button,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    primaryButtonDisabled: {
      opacity: 0.45,
    },
    primaryButtonLabel: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.white,
    },
    familyLinkRow: {
      height: TOUCH_TARGET.min,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    familyLinkText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.accent,
    },
    securityCaptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    securityCaptionText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.captionText,
    },

    /* Modals */
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(11, 15, 23, 0.55)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: COLORS.blockBg,
      borderTopLeftRadius: RADIUS.block,
      borderTopRightRadius: RADIUS.block,
      padding: SPACING.page,
      paddingBottom: SPACING.section,
      width: '100%',
      maxWidth: 480,
      alignSelf: 'center',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: SPACING.page,
      gap: SPACING.md,
    },
    modalTitle: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.titleSize,
      lineHeight: TYPOGRAPHY.titleLineHeight,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.text,
    },
    modalSubtitle: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      lineHeight: TYPOGRAPHY.bodyLineHeight,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
      marginTop: 4,
    },
    iconTouch: {
      width: TOUCH_TARGET.min,
      height: TOUCH_TARGET.min,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    locationDetectTile: {
      minHeight: TOUCH_TARGET.min,
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.card,
      paddingHorizontal: SPACING.page,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    locationDetectText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightMedium,
      color: COLORS.accent,
    },
    modalListGroup: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.card,
      paddingHorizontal: SPACING.page,
    },
    modalListRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.md,
      gap: SPACING.md,
    },
    modalListRowDivider: {
      borderTopWidth: 1,
      borderTopColor: COLORS.divider,
    },
    modalListRowTitle: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.text,
    },
    modalListRowTitleSelected: {
      color: COLORS.accent,
      fontWeight: TYPOGRAPHY.weightSemibold,
    },
    modalListRowSub: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
      marginTop: 2,
    },
    clearStoreTouch: {
      minHeight: TOUCH_TARGET.min,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.sm,
    },
    clearStoreText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
    },
    menuItemLabel: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.text,
      flex: 1,
    },
    familyActiveBox: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.page,
      alignItems: 'center',
    },
    familyPinCaption: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
      marginBottom: 4,
    },
    familyPinDisplay: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.titleSize,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.text,
      letterSpacing: 2,
      marginBottom: 4,
    },
    familyMembersCaption: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
      marginBottom: SPACING.page,
    },
    unlinkFamilyTouch: {
      minHeight: TOUCH_TARGET.min,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.sm,
    },
    unlinkFamilyText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.danger,
    },
    familyFormArea: {
      gap: SPACING.page,
    },
    orDividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    orLine: {
      flex: 1,
      height: 1,
      backgroundColor: COLORS.divider,
    },
    orText: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.captionSize,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
    },
    pinInputRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    pinInput: {
      flex: 1,
      height: TOUCH_TARGET.min,
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.card,
      paddingHorizontal: SPACING.page,
      fontFamily: FONTS.sans,
      fontSize: 16, // >= 16px to prevent iOS Safari zoom
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.text,
    },
    pinJoinButton: {
      height: TOUCH_TARGET.min,
      paddingHorizontal: SPACING.section,
      backgroundColor: COLORS.primaryButtonBg,
      borderRadius: RADIUS.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    helpStepsList: {
      gap: SPACING.md,
      marginBottom: SPACING.section,
    },
    helpStepTile: {
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.page,
    },
    helpStepHeading: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      fontWeight: TYPOGRAPHY.weightSemibold,
      color: COLORS.text,
      marginBottom: 4,
    },
    helpStepCopy: {
      fontFamily: FONTS.sans,
      fontSize: TYPOGRAPHY.bodySize,
      lineHeight: TYPOGRAPHY.bodyLineHeight,
      fontWeight: TYPOGRAPHY.weightRegular,
      color: COLORS.textSecondary,
    },
  });
