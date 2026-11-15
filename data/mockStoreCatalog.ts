export type OfferType = 'NONE' | 'BOGO' | 'BUY_2_EXTRA_10_OFF' | 'BUY_3_GET_15_OFF';

export interface CatalogItem {
  barcode: string;
  name: string;
  brand: string;
  unit: string;
  category: string;
  mrp: number;
  storePrice: number;
  weightGrams: number;
  emoji: string;
  bgColor: string;
  accentColor: string;
  aisle: string;
  gstPercent: number;
  isQuickTest?: boolean;
  // Offline Mart Offer Engine fields
  offerType?: OfferType;
  offerTag?: string;
  // Scan-to-Drop Visual Signature fields for Anti-Swap detection
  packageColorHex: string;
  packageColorName: string;
  isHighValueAudit?: boolean;
}

export interface StoreBranch {
  id: string;
  name: string;
  shortName: string;
  chain: 'DMart' | 'Reliance Smart';
  city: string;
  lane: string;
  latitude: number;
  longitude: number;
  catalogVersion: string;
  catalogSizeKb: number;
}

export const PILOT_STORE_BRANCHES: StoreBranch[] = [
  {
    id: 'store-mumbai-01',
    name: 'Reliance/DMart Express Pilot - Store #01',
    shortName: 'DMart Express · Lower Parel',
    chain: 'DMart',
    city: 'Lower Parel, Mumbai',
    lane: 'Express Gate A',
    latitude: 18.9952,
    longitude: 72.8291,
    catalogVersion: 'v2026.11.04-LP',
    catalogSizeKb: 412,
  },
  {
    id: 'store-powai-04',
    name: 'DMart Ready Express - Powai #04',
    shortName: 'DMart Ready · Powai',
    chain: 'DMart',
    city: 'Hiranandani, Powai',
    lane: 'Express Gate B',
    latitude: 19.1176,
    longitude: 72.906,
    catalogVersion: 'v2026.11.04-PW',
    catalogSizeKb: 388,
  },
  {
    id: 'store-blr-09',
    name: 'Reliance Smart Point - Indiranagar #09',
    shortName: 'Reliance Smart · Indiranagar',
    chain: 'Reliance Smart',
    city: '100 Ft Rd, Bengaluru',
    lane: 'Express Gate A',
    latitude: 12.9784,
    longitude: 77.6408,
    catalogVersion: 'v2026.11.04-BLR',
    catalogSizeKb: 445,
  },
];

export const STORE_CATEGORIES = [
  'All',
  'Staples & Grains',
  'Dairy & Bakery',
  'Cooking Essentials',
  'Instant Food',
  'Biscuits & Snacks',
  'Beverages',
  'Household & Care',
];

export const STORE_CATALOG: CatalogItem[] = [
  // --- 500g SWAP TEST ITEMS (Jaggery ₹100 vs Ghee ₹550 & Almonds ₹580) ---
  {
    barcode: '8904123405001',
    name: 'Organic Kolhapur Jaggery Block',
    brand: '24 Mantra',
    unit: '500 g',
    category: 'Staples & Grains',
    mrp: 120,
    storePrice: 100,
    weightGrams: 500,
    emoji: 'JG',
    bgColor: '#FEF3C7',
    accentColor: '#92400E',
    aisle: 'Aisle 01',
    gstPercent: 5,
    isQuickTest: true,
    offerType: 'BUY_2_EXTRA_10_OFF',
    offerTag: 'Buy 2+ get extra 10% off',
    packageColorHex: '#B45309',
    packageColorName: 'Golden Brown Pouch',
  },
  {
    barcode: '8901262050550',
    name: 'Amul Pure Cow Ghee Tin',
    brand: 'Amul',
    unit: '500 g',
    category: 'Cooking Essentials',
    mrp: 590,
    storePrice: 550,
    weightGrams: 500,
    emoji: 'AG',
    bgColor: '#FEE2E2',
    accentColor: '#991B1B',
    aisle: 'Aisle 01',
    gstPercent: 12,
    isQuickTest: true,
    offerType: 'NONE',
    packageColorHex: '#DC2626',
    packageColorName: 'Red & White Metal Tin',
    isHighValueAudit: true,
  },
  {
    barcode: '8904999905801',
    name: 'California Almonds Badam Select',
    brand: 'Reliance Good Life',
    unit: '500 g',
    category: 'Staples & Grains',
    mrp: 650,
    storePrice: 580,
    weightGrams: 500,
    emoji: 'AL',
    bgColor: '#FCE7F3',
    accentColor: '#831843',
    aisle: 'Aisle 01',
    gstPercent: 12,
    isQuickTest: true,
    offerType: 'BUY_2_EXTRA_10_OFF',
    offerTag: 'Buy 2+ get extra 10% off',
    packageColorHex: '#831843',
    packageColorName: 'Maroon Ziplock Pack',
    isHighValueAudit: true,
  },
  // --- STANDARD SUPERMARKET ITEMS ---
  {
    barcode: '8901058851298',
    name: 'Maggi 2-Minute Masala Noodles',
    brand: 'Nestlé',
    unit: '70 g',
    category: 'Instant Food',
    mrp: 15,
    storePrice: 14,
    weightGrams: 70,
    emoji: 'MG',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 02',
    gstPercent: 12,
    isQuickTest: true,
    offerType: 'BUY_3_GET_15_OFF',
    offerTag: 'Buy 3+ get 15% off',
    packageColorHex: '#EAB308',
    packageColorName: 'Bright Yellow Wrapper',
  },
  {
    barcode: '8901719101021',
    name: 'Parle-G Original Gluco Biscuits',
    brand: 'Parle',
    unit: '100 g',
    category: 'Biscuits & Snacks',
    mrp: 10,
    storePrice: 10,
    weightGrams: 100,
    emoji: 'PG',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 04',
    gstPercent: 18,
    isQuickTest: true,
    offerType: 'BOGO',
    offerTag: 'Buy 1 get 1 free',
    packageColorHex: '#F59E0B',
    packageColorName: 'Yellow & White Stripes',
  },
  {
    barcode: '8901262010023',
    name: 'Amul Pasteurised Table Butter',
    brand: 'Amul',
    unit: '500 g',
    category: 'Dairy & Bakery',
    mrp: 295,
    storePrice: 285,
    weightGrams: 500,
    emoji: 'AM',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Chiller 01',
    gstPercent: 12,
    isQuickTest: true,
    offerType: 'NONE',
    packageColorHex: '#FDE047',
    packageColorName: 'Butter Yellow Carton',
    isHighValueAudit: true,
  },
  {
    barcode: '8901088062152',
    name: 'Saffola Gold Blended Edible Oil',
    brand: 'Saffola',
    unit: '1 L Pouch',
    category: 'Cooking Essentials',
    mrp: 225,
    storePrice: 195,
    weightGrams: 910,
    emoji: 'SF',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 01',
    gstPercent: 5,
    isQuickTest: true,
    offerType: 'BUY_2_EXTRA_10_OFF',
    offerTag: 'Buy 2+ get extra 10% off',
    packageColorHex: '#D97706',
    packageColorName: 'Gold Standup Pouch',
  },
  {
    barcode: '8901030656217',
    name: 'Surf Excel Easy Wash Detergent',
    brand: 'HUL',
    unit: '1 kg',
    category: 'Household & Care',
    mrp: 150,
    storePrice: 130,
    weightGrams: 1000,
    emoji: 'SE',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 07',
    gstPercent: 18,
    isQuickTest: true,
    offerType: 'NONE',
    packageColorHex: '#2563EB',
    packageColorName: 'Ocean Blue Polybag',
  },
  {
    barcode: '8904004400236',
    name: "Haldiram's Nagpur Aloo Bhujia",
    brand: "Haldiram's",
    unit: '400 g',
    category: 'Biscuits & Snacks',
    mrp: 125,
    storePrice: 110,
    weightGrams: 400,
    emoji: 'HR',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 04',
    gstPercent: 12,
    isQuickTest: true,
    offerType: 'BOGO',
    offerTag: 'Buy 1 get 1 free',
    packageColorHex: '#EF4444',
    packageColorName: 'Crimson Foil Pack',
  },
  {
    barcode: '8901052014019',
    name: 'Tata Tea Gold Assam Leaf',
    brand: 'Tata Tea',
    unit: '500 g',
    category: 'Beverages',
    mrp: 300,
    storePrice: 270,
    weightGrams: 500,
    emoji: 'TT',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 03',
    gstPercent: 5,
    isQuickTest: true,
    offerType: 'NONE',
    packageColorHex: '#1E293B',
    packageColorName: 'Black & Gold Pack',
    isHighValueAudit: true,
  },
  {
    barcode: '8901725121143',
    name: 'Aashirvaad Shudh Chakki Atta',
    brand: 'ITC Aashirvaad',
    unit: '5 kg Bag',
    category: 'Staples & Grains',
    mrp: 275,
    storePrice: 245,
    weightGrams: 5000,
    emoji: 'AA',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 01',
    gstPercent: 5,
    offerType: 'NONE',
    packageColorHex: '#EA580C',
    packageColorName: 'Orange Heavy Sack',
  },
  {
    barcode: '8901063014329',
    name: 'Britannia Good Day Cashew Cookies',
    brand: 'Britannia',
    unit: '200 g',
    category: 'Biscuits & Snacks',
    mrp: 45,
    storePrice: 38,
    weightGrams: 200,
    emoji: 'GD',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 04',
    gstPercent: 18,
    offerType: 'BUY_3_GET_15_OFF',
    offerTag: 'Buy 3+ get 15% off',
    packageColorHex: '#F97316',
    packageColorName: 'Orange Cookie Roll',
  },
  {
    barcode: '8901052001057',
    name: 'Tata Salt Vacuum Evaporated Iodised',
    brand: 'Tata',
    unit: '1 kg',
    category: 'Staples & Grains',
    mrp: 28,
    storePrice: 25,
    weightGrams: 1000,
    emoji: 'TS',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 01',
    gstPercent: 0,
    offerType: 'NONE',
    packageColorHex: '#3B82F6',
    packageColorName: 'White & Blue Pouch',
  },
  {
    barcode: '8901207027512',
    name: 'Dabur Red Ayurvedic Paste',
    brand: 'Dabur',
    unit: '200 g',
    category: 'Household & Care',
    mrp: 135,
    storePrice: 115,
    weightGrams: 200,
    emoji: 'DR',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 06',
    gstPercent: 18,
    offerType: 'BUY_2_EXTRA_10_OFF',
    offerTag: 'Buy 2+ get extra 10% off',
    packageColorHex: '#DC2626',
    packageColorName: 'Red Rectangular Box',
  },
  {
    barcode: '8901030712449',
    name: 'Red Label Natural Care Tea',
    brand: 'Brooke Bond',
    unit: '500 g',
    category: 'Beverages',
    mrp: 310,
    storePrice: 275,
    weightGrams: 500,
    emoji: 'RL',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 03',
    gstPercent: 5,
    offerType: 'NONE',
    packageColorHex: '#B91C1C',
    packageColorName: 'Red Carton Pack',
  },
  {
    barcode: '8901526101122',
    name: 'India Gate Basmati Rice Classic',
    brand: 'India Gate',
    unit: '1 kg',
    category: 'Staples & Grains',
    mrp: 240,
    storePrice: 205,
    weightGrams: 1000,
    emoji: 'IG',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 01',
    gstPercent: 5,
    offerType: 'BUY_2_EXTRA_10_OFF',
    offerTag: 'Buy 2+ get extra 10% off',
    packageColorHex: '#7C2D12',
    packageColorName: 'Royal Purple & Gold Pouch',
  },
  {
    barcode: '8901058843149',
    name: 'Nescafé Classic Instant Coffee Jar',
    brand: 'Nestlé',
    unit: '90 g Glass',
    category: 'Beverages',
    mrp: 340,
    storePrice: 310,
    weightGrams: 260,
    emoji: 'NC',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 03',
    gstPercent: 18,
    offerType: 'NONE',
    packageColorHex: '#451A03',
    packageColorName: 'Dark Brown Glass Jar',
    isHighValueAudit: true,
  },
  {
    barcode: '8901396152200',
    name: 'Dettol Original Antiseptic Liquid',
    brand: 'Dettol',
    unit: '550 ml',
    category: 'Household & Care',
    mrp: 235,
    storePrice: 210,
    weightGrams: 590,
    emoji: 'DT',
    bgColor: '#F4F4F5',
    accentColor: '#18181B',
    aisle: 'Aisle 06',
    gstPercent: 18,
    offerType: 'NONE',
    packageColorHex: '#15803D',
    packageColorName: 'Emerald Green Bottle',
  },
];

// Pre-indexed O(1) lookup dictionary for <1ms offline barcode resolution
export const CATALOG_BY_BARCODE: Record<string, CatalogItem> = STORE_CATALOG.reduce(
  (acc, item) => {
    acc[item.barcode] = item;
    return acc;
  },
  {} as Record<string, CatalogItem>
);

export const QUICK_TEST_ITEMS: CatalogItem[] = STORE_CATALOG.filter(
  (item) => item.isQuickTest
);

/**
 * Computes additional Mart Promo discount (BOGO, Buy 2 Get 10% Off, Buy 3 Get 15% Off)
 * purely offline using the cached catalog rules.
 */
export function calculateOfflinePromoDiscount(
  item: { storePrice: number; offerType?: OfferType },
  quantity: number
): { promoDiscount: number; promoAppliedText: string | null; upsellHint: string | null } {
  const offer = item.offerType || 'NONE';
  if (offer === 'BOGO') {
    const freeUnits = Math.floor(quantity / 2);
    const promoDiscount = freeUnits * item.storePrice;
    const needsOneMore = quantity % 2 === 1;
    return {
      promoDiscount,
      promoAppliedText:
        freeUnits > 0 ? `Buy 1 get 1 free applied (-₹${promoDiscount})` : null,
      upsellHint: needsOneMore
        ? 'Add 1 more to get it free'
        : null,
    };
  }
  if (offer === 'BUY_2_EXTRA_10_OFF') {
    if (quantity >= 2) {
      const promoDiscount = Math.round(item.storePrice * quantity * 0.1);
      return {
        promoDiscount,
        promoAppliedText: `10% deal applied (-₹${promoDiscount})`,
        upsellHint: null,
      };
    }
    return {
      promoDiscount: 0,
      promoAppliedText: null,
      upsellHint:
        quantity === 1 ? 'Add 1 more to save 10%' : null,
    };
  }
  if (offer === 'BUY_3_GET_15_OFF') {
    if (quantity >= 3) {
      const promoDiscount = Math.round(item.storePrice * quantity * 0.15);
      return {
        promoDiscount,
        promoAppliedText: `15% deal applied (-₹${promoDiscount})`,
        upsellHint: null,
      };
    }
    return {
      promoDiscount: 0,
      promoAppliedText: null,
      upsellHint:
        quantity > 0 ? `Add ${3 - quantity} more to save 15%` : null,
    };
  }
  return { promoDiscount: 0, promoAppliedText: null, upsellHint: null };
}
