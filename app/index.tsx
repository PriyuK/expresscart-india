import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShoppingBag,
  ShieldCheck,
  MapPin,
  Lock,
  ArrowRight,
  Check,
  QrCode,
  ScanLine,
  ChevronRight,
  UserCheck,
  WifiOff,
  RefreshCw,
  Users,
  Wallet,
  Navigation,
} from 'lucide-react-native';
import { useCartStore } from '../store/useCartStore';
import {
  STORE_CATALOG,
  QUICK_TEST_ITEMS,
  PILOT_STORE_BRANCHES,
} from '../data/mockStoreCatalog';

const GUARD_PIN = '1234';

export default function LandingScreen() {
  const router = useRouter();
  const {
    userProfile,
    activeStore,
    setActiveStore,
    isCheckedIn,
    setCheckedIn,
    lastCatalogSyncTime,
    gpsAutoDetected,
    syncStoreCatalogApi,
    familySession,
    startFamilySession,
    joinFamilySession,
    leaveFamilySession,
    getCombinedCartItems,
    lastExitPass,
  } = useCartStore();

  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSyncingGps, setIsSyncingGps] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);

  const combinedItems = getCombinedCartItems();
  const totalItemsInCart = combinedItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalCartValue = combinedItems.reduce(
    (sum, i) => sum + i.storePrice * i.quantity,
    0
  );

  const handleStartShopping = () => {
    setCheckedIn(true);
    if (!userProfile?.isVerified) {
      router.push('/auth');
      return;
    }
    router.push('/shop');
  };

  const handleGpsAutoDetectAndSync = () => {
    setIsSyncingGps(true);
    setTimeout(() => {
      syncStoreCatalogApi();
      setActiveStore(PILOT_STORE_BRANCHES[0].name, true);
      setIsSyncingGps(false);
    }, 350);
  };

  const handleGuardUnlock = () => {
    if (pinInput.trim() === GUARD_PIN) {
      setPinError(null);
      setPinInput('');
      setShowPinEntry(false);
      router.push('/guard');
    } else {
      setPinError('Incorrect PIN. Use 1234 for pilot access.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Minimal Brand Bar */}
        <View style={styles.topNav}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <ScanLine size={16} color="#FFFFFF" strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.brandName}>ExpressCart</Text>
              <Text style={styles.brandSub}>BYOD Cart-Mount Self-Checkout</Text>
            </View>
          </View>

          <View style={styles.topRightRow}>
            <TouchableOpacity
              style={[
                styles.authPill,
                userProfile?.isVerified ? styles.authPillVerified : styles.authPillUnverified,
              ]}
              onPress={() => router.push('/auth')}
              activeOpacity={0.75}
            >
              {userProfile?.isVerified ? (
                <>
                  <Wallet size={12} color="#059669" strokeWidth={2} />
                  <Text style={styles.authPillTextVerified}>
                    {userProfile.name.split(' ')[0]} · ₹{userProfile.walletBalance}
                  </Text>
                </>
              ) : (
                <>
                  <UserCheck size={12} color="#B45309" strokeWidth={2} />
                  <Text style={styles.authPillTextUnverified}>Verify Mobile (+91)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Clean Architectural Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <Text style={styles.eyebrow}>HANDLEBAR MOUNT · SCAN & DROP</Text>
            <View style={styles.offlineReadyPill}>
              <WifiOff size={10} color="#059669" strokeWidth={2.2} />
              <Text style={styles.offlineReadyText}>
                {STORE_CATALOG.length} SKUs + Offers Cached Offline
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>
            Mount phone on cart. Drop items in. Skip the counter line.
          </Text>
          <Text style={styles.heroSubtitle}>
            Designed for high-traffic Indian supermarkets like DMart & Reliance Smart Point. Auto-detects store via GPS, caches all Mart offers at the entrance for dead-zone aisles, and verifies exits in 8 seconds.
          </Text>

          {/* Primary Action */}
          <TouchableOpacity
            style={styles.primaryCta}
            activeOpacity={0.85}
            onPress={handleStartShopping}
          >
            <View style={styles.primaryCtaLeft}>
              <ShoppingBag size={18} color="#FFFFFF" strokeWidth={1.8} />
              <Text style={styles.primaryCtaText}>
                {!userProfile?.isVerified
                  ? 'Verify Mobile & Start Scanning'
                  : totalItemsInCart > 0
                  ? 'Resume Cart Scanner'
                  : 'Mount Phone & Start Scanning'}
              </Text>
            </View>
            <View style={styles.primaryCtaRight}>
              {totalItemsInCart > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>
                    {totalItemsInCart} {totalItemsInCart === 1 ? 'item' : 'items'} · ₹{totalCartValue}
                  </Text>
                </View>
              )}
              <ArrowRight size={17} color="#FFFFFF" strokeWidth={1.8} />
            </View>
          </TouchableOpacity>

          {/* Minimal 4-Pillar Strip */}
          <View style={styles.stepsGrid}>
            <View style={styles.stepItem}>
              <Text style={styles.stepIndex}>01</Text>
              <Text style={styles.stepTitle}>Entrance Sync</Text>
              <Text style={styles.stepDesc}>GPS + Offline Offers</Text>
            </View>
            <View style={styles.stepDivider} />
            <View style={styles.stepItem}>
              <Text style={styles.stepIndex}>02</Text>
              <Text style={styles.stepTitle}>Eco Cart Watch</Text>
              <Text style={styles.stepDesc}>5s Scan · OLED Sleep</Text>
            </View>
            <View style={styles.stepDivider} />
            <View style={styles.stepItem}>
              <Text style={styles.stepIndex}>03</Text>
              <Text style={styles.stepTitle}>Wallet / UPI</Text>
              <Text style={styles.stepDesc}>Family Multi-Cart Bill</Text>
            </View>
          </View>
        </View>

        {/* Active Exit Pass Banner (if present) */}
        {lastExitPass && (
          <TouchableOpacity
            style={styles.activePassCard}
            onPress={() => router.push('/guard')}
            activeOpacity={0.8}
          >
            <View style={styles.activePassIcon}>
              <QrCode size={18} color="#059669" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.activePassTitleRow}>
                <Text style={styles.activePassTitle}>Exit Pass Ready</Text>
                <Text style={styles.activePassCode}>{lastExitPass.orderId}</Text>
              </View>
              <Text style={styles.activePassSub}>
                ₹{lastExitPass.totalPrice} paid · {lastExitPass.totalItemCount} items · Tap for Guard Reverse-Scan Audit
              </Text>
            </View>
            <ChevronRight size={18} color="#71717A" />
          </TouchableOpacity>
        )}

        {/* GPS Store Auto-Detection & Entrance Offline Mart API Sync */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleGroup}>
              <MapPin size={15} color="#18181B" strokeWidth={1.8} />
              <Text style={styles.sectionTitle}>
                GPS Store Auto-Select & Entrance API Cache
              </Text>
            </View>
            <TouchableOpacity
              style={styles.gpsSyncBtn}
              onPress={handleGpsAutoDetectAndSync}
              activeOpacity={0.75}
            >
              <Navigation size={11} color="#059669" strokeWidth={2.2} />
              <Text style={styles.gpsSyncBtnText}>
                {isSyncingGps ? 'Syncing API...' : 'GPS Auto-Detect'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.apiSyncInfoBar}>
            <RefreshCw size={12} color="#065F46" strokeWidth={2} />
            <Text style={styles.apiSyncInfoText}>
              Mart API Synced at {lastCatalogSyncTime} · {STORE_CATALOG.length} SKUs & BOGO/Combo rules cached locally for 0-signal dead zones.
            </Text>
          </View>

          <View style={styles.storeList}>
            {PILOT_STORE_BRANCHES.map((storeObj) => {
              const selected = storeObj.name === activeStore;
              return (
                <TouchableOpacity
                  key={storeObj.id}
                  style={[styles.storeRow, selected && styles.storeRowSelected]}
                  activeOpacity={0.75}
                  onPress={() => {
                    setActiveStore(storeObj.name, false);
                    setCheckedIn(true);
                  }}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      selected && styles.radioCircleSelected,
                    ]}
                  >
                    {selected && <Check size={11} color="#FFFFFF" strokeWidth={2.5} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.storeTitleLine}>
                      <Text
                        style={[
                          styles.storeNameText,
                          selected && styles.storeNameTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {storeObj.shortName}
                      </Text>
                      {selected && gpsAutoDetected && (
                        <View style={styles.gpsTag}>
                          <Text style={styles.gpsTagText}>GPS Locked</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.storeCityText}>
                      {storeObj.city} · {storeObj.catalogSizeKb} KB Offline Pack
                    </Text>
                  </View>
                  <View style={styles.laneBadge}>
                    <Text style={styles.laneBadgeText}>{storeObj.lane}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Family / Multi-Cart Mode ("Buy Together" Under One Single Bill) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleGroup}>
              <Users size={15} color="#18181B" strokeWidth={1.8} />
              <Text style={styles.sectionTitle}>
                Family / Multi-Cart Mode (Buy Together)
              </Text>
            </View>
            <Text style={styles.sectionMeta}>2 Carts · 1 Single Bill</Text>
          </View>

          {familySession?.isActive ? (
            <View style={styles.familyActiveBox}>
              <View style={styles.familyActiveTop}>
                <View>
                  <Text style={styles.familyActiveTitle}>
                    Family Session Active · Code {familySession.pinCode}
                  </Text>
                  <Text style={styles.familyActiveSub}>
                    Cart #1 ({familySession.hostName}) + Cart #2 ({familySession.memberName}) linked under one GST bill.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.leaveFamilyBtn}
                  onPress={leaveFamilySession}
                >
                  <Text style={styles.leaveFamilyText}>End</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.familyDesc}>
                Shopping with family or need 2 carts for a monthly haul? Link multiple carts so everyone can scan items in different aisles and pay once under one name.
              </Text>
              <View style={styles.familyBtnRow}>
                <TouchableOpacity
                  style={styles.familyPrimaryBtn}
                  onPress={() => startFamilySession('Priya (Cart #2)')}
                  activeOpacity={0.8}
                >
                  <Users size={14} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.familyPrimaryBtnText}>
                    Create 2-Cart Family Session
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.familySecondaryBtn}
                  onPress={() => setShowJoinInput((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.familySecondaryBtnText}>Join via Code</Text>
                </TouchableOpacity>
              </View>

              {showJoinInput && (
                <View style={styles.joinRow}>
                  <TextInput
                    style={styles.joinInput}
                    value={joinCodeInput}
                    onChangeText={(t) => setJoinCodeInput(t.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Enter 4-digit Family PIN (e.g. 4829)"
                    placeholderTextColor="#A1A1AA"
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  <TouchableOpacity
                    style={styles.joinConfirmBtn}
                    onPress={() => {
                      joinFamilySession(joinCodeInput || '4829');
                      setShowJoinInput(false);
                    }}
                  >
                    <Text style={styles.joinConfirmBtnText}>Link Cart #2</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Catalog Preview Strip */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cached Store Offers & SKUs</Text>
            <TouchableOpacity onPress={handleStartShopping}>
              <Text style={styles.sectionActionLink}>
                Open Scanner ({STORE_CATALOG.length} SKUs)
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catalogPreviewScroll}
          >
            {QUICK_TEST_ITEMS.map((item) => {
              const save = item.mrp - item.storePrice;
              const code =
                item.brand
                  .replace(/[^a-zA-Z0-9]/g, '')
                  .slice(0, 2)
                  .toUpperCase() || 'SK';
              return (
                <TouchableOpacity
                  key={item.barcode}
                  style={styles.previewCard}
                  onPress={handleStartShopping}
                  activeOpacity={0.75}
                >
                  <View style={styles.previewCardTop}>
                    <View
                      style={[
                        styles.monogramBox,
                        { borderColor: item.packageColorHex || '#E4E4E7' },
                      ]}
                    >
                      <Text style={styles.monogramText}>{code}</Text>
                    </View>
                    {save > 0 && (
                      <View style={styles.savePill}>
                        <Text style={styles.savePillText}>Save ₹{save}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.previewBrand} numberOfLines={1}>
                    {item.brand}
                  </Text>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.previewUnit}>{item.unit}</Text>
                  <View style={styles.previewPriceRow}>
                    <Text style={styles.previewPrice}>₹{item.storePrice}</Text>
                    {item.mrp > item.storePrice && (
                      <Text style={styles.previewMrp}>₹{item.mrp}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Staff / Exit Verification Terminal */}
        <View style={styles.staffCard}>
          <TouchableOpacity
            style={styles.staffHeaderRow}
            activeOpacity={0.75}
            onPress={() => {
              setShowPinEntry((prev) => !prev);
              setPinError(null);
            }}
          >
            <View style={styles.staffIconBox}>
              <ShieldCheck size={17} color="#18181B" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.staffTitle}>Exit Gate Verification Terminal</Text>
              <Text style={styles.staffSub}>
                Reverse barcode spot-scanner, weight check & swap-fraud detector · PIN 1234
              </Text>
            </View>
            <Lock size={15} color="#71717A" strokeWidth={1.8} />
          </TouchableOpacity>

          {showPinEntry && (
            <View style={styles.pinDrawer}>
              <View style={styles.pinInputRow}>
                <TextInput
                  style={styles.pinInput}
                  value={pinInput}
                  onChangeText={(text) => {
                    setPinInput(text);
                    setPinError(null);
                  }}
                  placeholder="Staff PIN (1234)"
                  placeholderTextColor="#A1A1AA"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                />
                <TouchableOpacity
                  style={styles.pinUnlockBtn}
                  onPress={handleGuardUnlock}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pinUnlockText}>Open Terminal</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.quickAccessLink}
                onPress={() => {
                  setPinInput('1234');
                  setPinError(null);
                  router.push('/guard');
                }}
              >
                <Text style={styles.quickAccessLinkText}>
                  Quick launch with pilot PIN (1234) →
                </Text>
              </TouchableOpacity>

              {pinError && <Text style={styles.pinErrorText}>{pinError}</Text>}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 48,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    color: '#09090B',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  brandSub: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '400',
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  authPillVerified: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  authPillUnverified: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  authPillTextVerified: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '600',
  },
  authPillTextUnverified: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  eyebrow: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  offlineReadyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  offlineReadyText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '600',
  },
  heroTitle: {
    color: '#09090B',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 30,
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#52525B',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
  },
  primaryCta: {
    backgroundColor: '#09090B',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  primaryCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  primaryCtaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartBadge: {
    backgroundColor: '#27272A',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cartBadgeText: {
    color: '#FAFAFA',
    fontSize: 12,
    fontWeight: '500',
  },
  stepsGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
    paddingTop: 14,
  },
  stepItem: {
    flex: 1,
  },
  stepDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E4E4E7',
    marginHorizontal: 10,
    alignSelf: 'center',
  },
  stepIndex: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepTitle: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '600',
  },
  stepDesc: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 1,
  },
  activePassCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activePassIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePassTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activePassTitle: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '600',
  },
  activePassCode: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '500',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activePassSub: {
    color: '#52525B',
    fontSize: 12,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  sectionTitle: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionMeta: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  sectionActionLink: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '600',
  },
  gpsSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  gpsSyncBtnText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '600',
  },
  apiSyncInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  apiSyncInfoText: {
    flex: 1,
    color: '#065F46',
    fontSize: 11,
    lineHeight: 16,
  },
  storeList: {
    gap: 8,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    gap: 12,
  },
  storeRowSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#09090B',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#D4D4D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    backgroundColor: '#09090B',
    borderColor: '#09090B',
  },
  storeTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storeNameText: {
    color: '#27272A',
    fontSize: 13,
    fontWeight: '500',
  },
  storeNameTextSelected: {
    color: '#09090B',
    fontWeight: '600',
  },
  gpsTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  gpsTagText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '700',
  },
  storeCityText: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
  laneBadge: {
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  laneBadgeText: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '500',
  },
  // Family Mode Styles
  familyDesc: {
    color: '#52525B',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  familyBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  familyPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#09090B',
    borderRadius: 10,
    paddingVertical: 11,
  },
  familyPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  familySecondaryBtn: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#D4D4D8',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  familySecondaryBtnText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '600',
  },
  joinRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  joinInput: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: '#09090B',
  },
  joinConfirmBtn: {
    backgroundColor: '#059669',
    borderRadius: 9,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  joinConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  familyActiveBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
  },
  familyActiveTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  familyActiveTitle: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
  },
  familyActiveSub: {
    color: '#047857',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  leaveFamilyBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  leaveFamilyText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '600',
  },
  catalogPreviewScroll: {
    gap: 10,
  },
  previewCard: {
    width: 138,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  previewCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  monogramBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F4F4F5',
    borderWidth: 2,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    color: '#18181B',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  savePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savePillText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '600',
  },
  previewBrand: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  previewName: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  previewUnit: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 1,
    marginBottom: 8,
  },
  previewPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  previewPrice: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '600',
  },
  previewMrp: {
    color: '#A1A1AA',
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  staffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  staffHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  staffIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffTitle: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '600',
  },
  staffSub: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 1,
  },
  pinDrawer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
  },
  pinInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pinInput: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#09090B',
    fontSize: 13,
    fontWeight: '500',
  },
  pinUnlockBtn: {
    backgroundColor: '#09090B',
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinUnlockText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  quickAccessLink: {
    marginTop: 10,
    paddingVertical: 4,
  },
  quickAccessLinkText: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '500',
  },
  pinErrorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
});
