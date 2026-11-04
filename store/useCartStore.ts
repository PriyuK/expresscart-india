import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CATALOG_BY_BARCODE,
  CatalogItem,
  OfferType,
  STORE_CATALOG,
  calculateOfflinePromoDiscount,
} from '../data/mockStoreCatalog';
import { callBackendApi } from '../utils/apiClient';

export interface UserProfile {
  name: string;
  phone: string;
  isVerified: boolean;
  aadhaarLast4?: string;
  trustScore: number;
  walletBalance: number;
  verifiedAt?: string;
}

export interface SecurityFlag {
  id: string;
  type: 'BARCODE_SWAP_SUSPECTED' | 'UNSCANNED_DROP_DETECTED' | 'CAMERA_COVERED';
  timestamp: string;
  scannedBarcode?: string;
  scannedName?: string;
  scannedPrice?: number;
  suspectedActualBarcode?: string;
  suspectedActualName?: string;
  suspectedActualPrice?: number;
  expectedColor?: string;
  detectedColor?: string;
  resolved: boolean;
  note: string;
}

export interface FamilySession {
  sessionId: string;
  pinCode: string;
  hostName: string;
  hostPhone: string;
  memberName: string;
  isActive: boolean;
  createdAt: string;
}

export interface CartItem {
  barcode: string;
  name: string;
  brand?: string;
  unit?: string;
  mrp: number;
  storePrice: number;
  weightGrams: number;
  quantity: number;
  emoji?: string;
  bgColor?: string;
  accentColor?: string;
  aisle?: string;
  gstPercent?: number;
  offerType?: OfferType;
  offerTag?: string;
  packageColorHex?: string;
  packageColorName?: string;
  cartSlot?: 1 | 2;
  addedBy?: string;
  dropVerifiedAt?: string;
}

export interface ExitPassPayload {
  type: 'EXPRESSCART_EXIT_PASS';
  orderId: string;
  storeName: string;
  timestamp: string;
  upiRef: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  customerTrustScore?: number;
  signature: string;
  totalPrice: number;
  totalMrp: number;
  totalSavings: number;
  promoSavings?: number;
  totalItemCount: number;
  cartWeightGrams: number;
  isFamilyOrder?: boolean;
  familySessionCode?: string;
  cart1ItemCount?: number;
  cart1WeightGrams?: number;
  cart2ItemCount?: number;
  cart2WeightGrams?: number;
  auditItems: CartItem[];
  allPaidItems?: CartItem[];
  securityFlags?: SecurityFlag[];
  actualPhysicalItemsInCart?: string[];
}

interface CartState {
  // Backend Connectivity State
  backendConnected: boolean;

  // User Auth & Wallet State
  userProfile: UserProfile | null;
  loginWithOtp: (name: string, phone: string, aadhaarLast4?: string) => void;
  logoutUser: () => void;
  linkAadhaarKyc: (last4: string) => void;
  topUpWallet: (amount: number) => void;
  deductWallet: (amount: number) => boolean;
  adjustTrustScore: (delta: number) => void;

  // Store & Entrance Offline Sync State
  activeStore: string;
  isCheckedIn: boolean;
  catalogCache: CatalogItem[];
  lastCatalogSyncTime: string;
  isOfflineDeadZone: boolean;
  gpsAutoDetected: boolean;
  setActiveStore: (storeName: string, gpsAuto?: boolean) => void;
  setCheckedIn: (checkedIn: boolean) => void;
  syncStoreCatalogApi: (coords?: { lat: number; lng: number }) => void;
  toggleOfflineDeadZone: () => void;

  // Cart & Family Multi-Cart State
  items: CartItem[]; // Primary Cart #1
  familySecondaryItems: CartItem[]; // Family Cart #2
  activeCartSlot: 1 | 2;
  familySession: FamilySession | null;
  lastScannedItem: CartItem | null;
  duplicateFamilyAlert: string | null;
  setActiveCartSlot: (slot: 1 | 2) => void;
  startFamilySession: (memberName?: string) => FamilySession;
  joinFamilySession: (pinCode: string, memberName?: string) => FamilySession;
  syncFamilyRoomWithBackend: () => Promise<void>;
  leaveFamilySession: () => void;
  simulateFamilyMemberScan: (barcode?: string) => CartItem | null;
  clearDuplicateFamilyAlert: () => void;

  // Security & Anti-Theft "Cart Watch" State
  securityFlags: SecurityFlag[];
  unscannedDropAlert: boolean;
  swappedUnpaidBarcodesInBasket: string[];
  triggerUnscannedDropAlert: () => void;
  resolveUnscannedDropAlert: (scanBarcode?: string) => void;
  simulateBarcodeSwapAttempt: (
    scannedBarcode: string,
    droppedBarcode: string
  ) => SecurityFlag | null;
  clearSecurityFlags: () => void;

  // Standard Cart Operations
  addItemByBarcode: (barcode: string, targetSlot?: 1 | 2) => boolean;
  incrementItem: (barcode: string, targetSlot?: 1 | 2) => void;
  decrementItem: (barcode: string, targetSlot?: 1 | 2) => void;
  removeItem: (barcode: string, targetSlot?: 1 | 2) => void;
  clearCart: () => void;

  // Exit Pass & Audit
  lastExitPass: ExitPassPayload | null;
  orderHistory: ExitPassPayload[];
  getAuditItems: () => CartItem[];
  getCombinedCartItems: () => CartItem[];
  generateExitPass: (paymentMethod?: string) => ExitPassPayload;
}

function buildCartItemFromCatalog(
  catalogItem: CatalogItem,
  quantity: number,
  cartSlot: 1 | 2,
  addedBy: string
): CartItem {
  return {
    barcode: catalogItem.barcode,
    name: catalogItem.name,
    brand: catalogItem.brand,
    unit: catalogItem.unit,
    mrp: catalogItem.mrp,
    storePrice: catalogItem.storePrice,
    weightGrams: catalogItem.weightGrams,
    emoji: catalogItem.emoji,
    bgColor: catalogItem.bgColor,
    accentColor: catalogItem.accentColor,
    aisle: catalogItem.aisle,
    gstPercent: catalogItem.gstPercent,
    offerType: catalogItem.offerType,
    offerTag: catalogItem.offerTag,
    packageColorHex: catalogItem.packageColorHex,
    packageColorName: catalogItem.packageColorName,
    cartSlot,
    addedBy,
    dropVerifiedAt: new Date().toLocaleTimeString(),
    quantity,
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      backendConnected: true,
      userProfile: null,

      loginWithOtp: (name: string, phone: string, aadhaarLast4?: string) => {
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        const optimisticProfile: UserProfile = {
          name: name.trim() || 'Express Shopper',
          phone: cleanPhone,
          isVerified: true,
          aadhaarLast4: aadhaarLast4
            ? aadhaarLast4.replace(/\D/g, '').slice(-4)
            : undefined,
          trustScore: aadhaarLast4 ? 98 : 94,
          walletBalance: 1500,
          verifiedAt: new Date().toISOString(),
        };
        set({ userProfile: optimisticProfile });

        // Sync with Backend Auth API
        callBackendApi('/api/auth', {
          method: 'POST',
          body: {
            action: 'verify-otp',
            name: optimisticProfile.name,
            phone: cleanPhone,
            otp: '4821',
            aadhaarLast4: optimisticProfile.aadhaarLast4,
          },
          isOfflineDeadZone: get().isOfflineDeadZone,
        }).then((res) => {
          if (res?.ok && res.userProfile) {
            set({ userProfile: res.userProfile, backendConnected: true });
          }
        });
      },

      logoutUser: () => {
        set({
          userProfile: null,
          familySession: null,
          activeCartSlot: 1,
        });
      },

      linkAadhaarKyc: (last4: string) => {
        const current = get().userProfile;
        if (!current) return;
        const cleanLast4 = last4.replace(/\D/g, '').slice(-4);
        set({
          userProfile: {
            ...current,
            aadhaarLast4: cleanLast4,
            trustScore: Math.min(100, current.trustScore + 4),
          },
        });
        callBackendApi('/api/auth', {
          method: 'POST',
          body: {
            action: 'link-kyc',
            phone: current.phone,
            aadhaarLast4: cleanLast4,
          },
          isOfflineDeadZone: get().isOfflineDeadZone,
        }).then((res) => {
          if (res?.ok && res.userProfile) {
            set({ userProfile: res.userProfile, backendConnected: true });
          }
        });
      },

      topUpWallet: (amount: number) => {
        const current = get().userProfile;
        if (!current || amount <= 0) return;
        set({
          userProfile: {
            ...current,
            walletBalance: current.walletBalance + amount,
          },
        });
        callBackendApi('/api/auth', {
          method: 'POST',
          body: {
            action: 'topup-wallet',
            phone: current.phone,
            amount,
          },
          isOfflineDeadZone: get().isOfflineDeadZone,
        }).then((res) => {
          if (res?.ok && res.userProfile) {
            set({ userProfile: res.userProfile, backendConnected: true });
          }
        });
      },

      deductWallet: (amount: number): boolean => {
        const current = get().userProfile;
        if (!current || current.walletBalance < amount) return false;
        set({
          userProfile: {
            ...current,
            walletBalance: current.walletBalance - amount,
          },
        });
        return true;
      },

      adjustTrustScore: (delta: number) => {
        const current = get().userProfile;
        if (!current) return;
        set({
          userProfile: {
            ...current,
            trustScore: Math.max(40, Math.min(100, current.trustScore + delta)),
          },
        });
        callBackendApi('/api/auth', {
          method: 'POST',
          body: {
            action: 'adjust-trust',
            phone: current.phone,
            trustDelta: delta,
          },
          isOfflineDeadZone: get().isOfflineDeadZone,
        });
      },

      activeStore: 'Reliance/DMart Express Pilot - Store #01',
      isCheckedIn: true,
      catalogCache: STORE_CATALOG,
      lastCatalogSyncTime: new Date().toLocaleTimeString(),
      isOfflineDeadZone: false,
      gpsAutoDetected: true,

      setActiveStore: (storeName: string, gpsAuto = false) => {
        set({
          activeStore: storeName,
          gpsAutoDetected: gpsAuto,
          lastCatalogSyncTime: new Date().toLocaleTimeString(),
        });
        callBackendApi('/api/catalog', {
          method: 'GET',
          query: { store: storeName },
          isOfflineDeadZone: get().isOfflineDeadZone,
        }).then((res) => {
          if (res?.ok && Array.isArray(res.catalog)) {
            set({
              catalogCache: res.catalog,
              backendConnected: true,
              lastCatalogSyncTime: new Date().toLocaleTimeString(),
            });
          }
        });
      },

      setCheckedIn: (checkedIn: boolean) => set({ isCheckedIn: checkedIn }),

      syncStoreCatalogApi: (coords?: { lat: number; lng: number }) => {
        set({
          catalogCache: STORE_CATALOG,
          isCheckedIn: true,
          lastCatalogSyncTime: new Date().toLocaleTimeString(),
        });
        callBackendApi('/api/catalog', {
          method: 'GET',
          query: coords ? { lat: coords.lat, lng: coords.lng } : { store: get().activeStore },
          isOfflineDeadZone: get().isOfflineDeadZone,
        }).then((res) => {
          if (res?.ok && Array.isArray(res.catalog)) {
            set({
              catalogCache: res.catalog,
              activeStore: res.store?.name || get().activeStore,
              gpsAutoDetected: true,
              backendConnected: true,
              lastCatalogSyncTime: new Date().toLocaleTimeString(),
            });
          }
        });
      },

      toggleOfflineDeadZone: () =>
        set((state) => ({ isOfflineDeadZone: !state.isOfflineDeadZone })),

      items: [],
      familySecondaryItems: [],
      activeCartSlot: 1,
      familySession: null,
      lastScannedItem: null,
      duplicateFamilyAlert: null,

      setActiveCartSlot: (slot: 1 | 2) => set({ activeCartSlot: slot }),

      startFamilySession: (memberName = 'Priya (Cart #2)'): FamilySession => {
        const state = get();
        const profile = state.userProfile;
        const pinCode = String(Math.floor(1000 + Math.random() * 9000));
        const session: FamilySession = {
          sessionId: `FAM-${pinCode}`,
          pinCode,
          hostName: profile?.name || 'Primary Shopper (Cart #1)',
          hostPhone: profile?.phone || '9820411290',
          memberName,
          isActive: true,
          createdAt: new Date().toLocaleTimeString(),
        };
        set({ familySession: session });

        callBackendApi('/api/family', {
          method: 'POST',
          body: {
            action: 'create',
            pinCode,
            hostName: session.hostName,
            hostPhone: session.hostPhone,
            memberName,
            cart1Items: state.items,
            cart2Items: state.familySecondaryItems,
          },
          isOfflineDeadZone: state.isOfflineDeadZone,
        }).then((res) => {
          if (res?.ok && res.room?.session) {
            set({ familySession: res.room.session, backendConnected: true });
          }
        });

        return session;
      },

      joinFamilySession: (
        pinCode: string,
        memberName = 'Family Member (Cart #2)'
      ): FamilySession => {
        const state = get();
        const profile = state.userProfile;
        const cleanPin = pinCode.replace(/\D/g, '').slice(0, 4) || '4829';
        const session: FamilySession = {
          sessionId: `FAM-${cleanPin}`,
          pinCode: cleanPin,
          hostName: profile?.name || 'Primary Host (Cart #1)',
          hostPhone: profile?.phone || '9820411290',
          memberName,
          isActive: true,
          createdAt: new Date().toLocaleTimeString(),
        };
        set({ familySession: session });

        callBackendApi('/api/family', {
          method: 'POST',
          body: {
            action: 'join',
            pinCode: cleanPin,
            hostName: session.hostName,
            hostPhone: session.hostPhone,
            memberName,
          },
          isOfflineDeadZone: state.isOfflineDeadZone,
        }).then((res) => {
          if (res?.ok && res.room) {
            set({
              familySession: res.room.session,
              items:
                Array.isArray(res.room.cart1Items) && res.room.cart1Items.length > 0
                  ? res.room.cart1Items
                  : get().items,
              familySecondaryItems:
                Array.isArray(res.room.cart2Items) && res.room.cart2Items.length > 0
                  ? res.room.cart2Items
                  : get().familySecondaryItems,
              backendConnected: true,
            });
          }
        });

        return session;
      },

      syncFamilyRoomWithBackend: async () => {
        const state = get();
        if (!state.familySession?.pinCode || state.isOfflineDeadZone) return;
        const res = await callBackendApi('/api/family', {
          method: 'POST',
          body: {
            action: 'sync',
            pinCode: state.familySession.pinCode,
            cart1Items: state.items,
            cart2Items: state.familySecondaryItems,
          },
          isOfflineDeadZone: state.isOfflineDeadZone,
        });
        if (res?.ok && res.room) {
          set({
            items: res.room.cart1Items || state.items,
            familySecondaryItems: res.room.cart2Items || state.familySecondaryItems,
            backendConnected: true,
          });
        }
      },

      leaveFamilySession: () =>
        set({
          familySession: null,
          activeCartSlot: 1,
          familySecondaryItems: [],
          duplicateFamilyAlert: null,
        }),

      clearDuplicateFamilyAlert: () => set({ duplicateFamilyAlert: null }),

      simulateFamilyMemberScan: (barcode?: string): CartItem | null => {
        const state = get();
        if (!state.familySession) {
          state.startFamilySession('Priya (Cart #2)');
        }
        const sampleBarcodes = [
          '8901052014019', // Tata Tea Gold
          '8901088062152', // Saffola Oil
          '8904004400236', // Haldiram's Bhujia
          '8901063014329', // Good Day
        ];
        const chosenBarcode =
          barcode || sampleBarcodes[Math.floor(Math.random() * sampleBarcodes.length)];
        get().addItemByBarcode(chosenBarcode, 2);
        return get().lastScannedItem;
      },

      securityFlags: [],
      unscannedDropAlert: false,
      swappedUnpaidBarcodesInBasket: [],

      triggerUnscannedDropAlert: () => {
        const flag: SecurityFlag = {
          id: `SEC-${Date.now().toString().slice(-5)}`,
          type: 'UNSCANNED_DROP_DETECTED',
          timestamp: new Date().toLocaleTimeString(),
          resolved: false,
          note: '1 FPS Basket-Watch detected an object entering the cart while rolling without a barcode scan.',
        };
        set((state) => ({
          unscannedDropAlert: true,
          securityFlags: [flag, ...state.securityFlags],
        }));
      },

      resolveUnscannedDropAlert: (scanBarcode?: string) => {
        if (scanBarcode) {
          get().addItemByBarcode(scanBarcode);
        }
        set((state) => ({
          unscannedDropAlert: false,
          securityFlags: state.securityFlags.map((f) =>
            f.type === 'UNSCANNED_DROP_DETECTED' ? { ...f, resolved: true } : f
          ),
        }));
      },

      simulateBarcodeSwapAttempt: (
        scannedBarcode: string,
        droppedBarcode: string
      ): SecurityFlag | null => {
        const scannedCat = CATALOG_BY_BARCODE[scannedBarcode];
        const droppedCat = CATALOG_BY_BARCODE[droppedBarcode];
        if (!scannedCat || !droppedCat) return null;

        get().addItemByBarcode(scannedBarcode);

        const flag: SecurityFlag = {
          id: `SWAP-${Date.now().toString().slice(-5)}`,
          type: 'BARCODE_SWAP_SUSPECTED',
          timestamp: new Date().toLocaleTimeString(),
          scannedBarcode: scannedCat.barcode,
          scannedName: scannedCat.name,
          scannedPrice: scannedCat.storePrice,
          suspectedActualBarcode: droppedCat.barcode,
          suspectedActualName: droppedCat.name,
          suspectedActualPrice: droppedCat.storePrice,
          expectedColor: `${scannedCat.packageColorName} (${scannedCat.packageColorHex})`,
          detectedColor: `${droppedCat.packageColorName} (${droppedCat.packageColorHex})`,
          resolved: false,
          note: `Scanned ${scannedCat.name} (₹${scannedCat.storePrice}, ${scannedCat.weightGrams}g) but camera drop-frame matched ${droppedCat.packageColorName} (${droppedCat.name}, ₹${droppedCat.storePrice}).`,
        };

        set((state) => ({
          securityFlags: [flag, ...state.securityFlags],
          swappedUnpaidBarcodesInBasket: [
            ...new Set([...state.swappedUnpaidBarcodesInBasket, droppedCat.barcode]),
          ],
        }));

        return flag;
      },

      clearSecurityFlags: () =>
        set({
          securityFlags: [],
          unscannedDropAlert: false,
          swappedUnpaidBarcodesInBasket: [],
        }),

      addItemByBarcode: (barcode: string, explicitSlot?: 1 | 2): boolean => {
        const cleanCode = barcode.trim();
        const catalogItem = CATALOG_BY_BARCODE[cleanCode];
        if (!catalogItem) {
          return false;
        }

        const state = get();
        const slot = explicitSlot || state.activeCartSlot || 1;
        const addedBy =
          slot === 2
            ? state.familySession?.memberName || 'Family Cart #2'
            : state.userProfile?.name || 'Cart #1 (You)';

        let duplicateMsg: string | null = null;
        if (state.familySession?.isActive) {
          const otherCart = slot === 1 ? state.familySecondaryItems : state.items;
          const matchInOther = otherCart.find((i) => i.barcode === cleanCode);
          if (matchInOther) {
            duplicateMsg = `Heads up: ${matchInOther.quantity}x ${catalogItem.name} is already in Cart #${
              slot === 1 ? '2' : '1'
            } (${matchInOther.addedBy || 'Family Member'}).`;
          }
        }

        const targetList = slot === 1 ? state.items : state.familySecondaryItems;
        const existingIndex = targetList.findIndex((i) => i.barcode === cleanCode);

        let updatedList: CartItem[];
        let updatedItem: CartItem;

        if (existingIndex > -1) {
          updatedList = targetList.map((item, idx) => {
            if (idx === existingIndex) {
              updatedItem = buildCartItemFromCatalog(
                catalogItem,
                item.quantity + 1,
                slot,
                addedBy
              );
              return updatedItem;
            }
            return item;
          });
        } else {
          updatedItem = buildCartItemFromCatalog(catalogItem, 1, slot, addedBy);
          updatedList = [updatedItem, ...targetList];
        }

        if (slot === 1) {
          set({
            items: updatedList,
            lastScannedItem: updatedItem!,
            duplicateFamilyAlert: duplicateMsg,
          });
        } else {
          set({
            familySecondaryItems: updatedList,
            lastScannedItem: updatedItem!,
            duplicateFamilyAlert: duplicateMsg,
          });
        }

        // Sync multi-cart room with backend if Family Mode active
        if (get().familySession?.isActive) {
          get().syncFamilyRoomWithBackend();
        }

        return true;
      },

      incrementItem: (barcode: string, explicitSlot?: 1 | 2) => {
        const slot = explicitSlot || get().activeCartSlot || 1;
        if (slot === 1) {
          set((state) => ({
            items: state.items.map((item) =>
              item.barcode === barcode ? { ...item, quantity: item.quantity + 1 } : item
            ),
          }));
        } else {
          set((state) => ({
            familySecondaryItems: state.familySecondaryItems.map((item) =>
              item.barcode === barcode ? { ...item, quantity: item.quantity + 1 } : item
            ),
          }));
        }
        if (get().familySession?.isActive) {
          get().syncFamilyRoomWithBackend();
        }
      },

      decrementItem: (barcode: string, explicitSlot?: 1 | 2) => {
        const slot = explicitSlot || get().activeCartSlot || 1;
        if (slot === 1) {
          set((state) => ({
            items: state.items
              .map((item) =>
                item.barcode === barcode ? { ...item, quantity: item.quantity - 1 } : item
              )
              .filter((item) => item.quantity > 0),
          }));
        } else {
          set((state) => ({
            familySecondaryItems: state.familySecondaryItems
              .map((item) =>
                item.barcode === barcode ? { ...item, quantity: item.quantity - 1 } : item
              )
              .filter((item) => item.quantity > 0),
          }));
        }
        if (get().familySession?.isActive) {
          get().syncFamilyRoomWithBackend();
        }
      },

      removeItem: (barcode: string, explicitSlot?: 1 | 2) => {
        const slot = explicitSlot || get().activeCartSlot || 1;
        if (slot === 1) {
          set((state) => ({
            items: state.items.filter((item) => item.barcode !== barcode),
          }));
        } else {
          set((state) => ({
            familySecondaryItems: state.familySecondaryItems.filter(
              (item) => item.barcode !== barcode
            ),
          }));
        }
        if (get().familySession?.isActive) {
          get().syncFamilyRoomWithBackend();
        }
      },

      clearCart: () => {
        set({
          items: [],
          familySecondaryItems: [],
          lastScannedItem: null,
          duplicateFamilyAlert: null,
          securityFlags: [],
          unscannedDropAlert: false,
          swappedUnpaidBarcodesInBasket: [],
        });
      },

      lastExitPass: null,
      orderHistory: [],

      getCombinedCartItems: (): CartItem[] => {
        const state = get();
        const combinedMap: Record<string, CartItem> = {};
        [...state.items, ...state.familySecondaryItems].forEach((item) => {
          if (combinedMap[item.barcode]) {
            combinedMap[item.barcode] = {
              ...combinedMap[item.barcode],
              quantity: combinedMap[item.barcode].quantity + item.quantity,
            };
          } else {
            combinedMap[item.barcode] = { ...item };
          }
        });
        return Object.values(combinedMap);
      },

      getAuditItems: (): CartItem[] => {
        const currentItems = get().getCombinedCartItems();
        if (currentItems.length === 0) return [];

        const sortedByPrice = [...currentItems].sort((a, b) => {
          if (b.storePrice !== a.storePrice) {
            return b.storePrice - a.storePrice;
          }
          return b.storePrice * b.quantity - a.storePrice * a.quantity;
        });

        if (sortedByPrice.length <= 3) {
          return sortedByPrice;
        }

        const topTwo = sortedByPrice.slice(0, 2);
        const remaining = sortedByPrice.slice(2);
        const randomIndex = Math.floor(Math.random() * remaining.length);
        const randomThird = remaining[randomIndex];

        return [...topTwo, randomThird];
      },

      generateExitPass: (paymentMethod = 'UPI Instant'): ExitPassPayload => {
        const state = get();
        const combinedItems = state.getCombinedCartItems();

        const cart1ItemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
        const cart1WeightGrams = state.items.reduce(
          (sum, i) => sum + i.weightGrams * i.quantity,
          0
        );
        const cart2ItemCount = state.familySecondaryItems.reduce(
          (sum, i) => sum + i.quantity,
          0
        );
        const cart2WeightGrams = state.familySecondaryItems.reduce(
          (sum, i) => sum + i.weightGrams * i.quantity,
          0
        );

        const totalItemCount = cart1ItemCount + cart2ItemCount;
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
        const cartWeightGrams = cart1WeightGrams + cart2WeightGrams;
        const auditItems = state.getAuditItems();

        const randomSuffix = Math.floor(100000 + Math.random() * 900000);
        const orderId = `EXP-IN-${randomSuffix}`;
        const upiRef = `${paymentMethod
          .replace(/\s+/g, '')
          .toUpperCase()}-${Date.now().toString().slice(-6)}`;
        const timestamp = new Date().toISOString();

        const signature = `SIG-${orderId}-${totalPrice}-${totalItemCount}-${cartWeightGrams}`;

        const actualPhysicalItemsInCart = [
          ...combinedItems.map((i) => i.barcode),
          ...state.swappedUnpaidBarcodesInBasket,
        ];

        const payload: ExitPassPayload = {
          type: 'EXPRESSCART_EXIT_PASS',
          orderId,
          storeName: state.activeStore,
          timestamp,
          upiRef,
          paymentMethod,
          customerName: state.userProfile?.name || 'Verified Shopper',
          customerPhone: state.userProfile?.phone || '9820411290',
          customerTrustScore: state.userProfile?.trustScore ?? 95,
          signature,
          totalPrice,
          totalMrp,
          totalSavings,
          promoSavings,
          totalItemCount,
          cartWeightGrams,
          isFamilyOrder: !!state.familySession?.isActive && cart2ItemCount > 0,
          familySessionCode: state.familySession?.sessionId,
          cart1ItemCount,
          cart1WeightGrams,
          cart2ItemCount,
          cart2WeightGrams,
          auditItems,
          allPaidItems: combinedItems,
          securityFlags: state.securityFlags,
          actualPhysicalItemsInCart,
        };

        set((prev) => ({
          lastExitPass: payload,
          orderHistory: [payload, ...(prev.orderHistory || []).slice(0, 9)],
        }));

        // Persist & sign with Backend HMAC-SHA256 Orders API
        callBackendApi('/api/orders', {
          method: 'POST',
          body: {
            action: 'checkout',
            storeName: state.activeStore,
            paymentMethod,
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            cart1Items: state.items,
            cart2Items: state.familySecondaryItems,
            isFamilyOrder: payload.isFamilyOrder,
            familySessionCode: payload.familySessionCode,
            securityFlags: state.securityFlags,
            swappedUnpaidBarcodesInBasket: state.swappedUnpaidBarcodesInBasket,
          },
          isOfflineDeadZone: state.isOfflineDeadZone,
        }).then((res) => {
          if (res?.ok && res.exitPass) {
            set((prev) => ({
              lastExitPass: res.exitPass,
              orderHistory: [
                res.exitPass,
                ...(prev.orderHistory || []).filter((o) => o.orderId !== payload.orderId),
              ].slice(0, 10),
              backendConnected: true,
            }));
          }
        });

        return payload;
      },
    }),
    {
      name: 'expresscart-india-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
