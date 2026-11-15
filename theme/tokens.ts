import { Platform } from 'react-native';

/**
 * ExpressCart India — Design System & Layer Tokens
 *
 * LAYER SYSTEM:
 * - Level 0: Page background grey (#F5F6F7)
 * - Level 1: White blocks (#FFFFFF), radius 16, no borders, no shadows
 * - Level 2: Grey tiles inside white blocks (#F5F6F7), radius 12
 * - Monogram tile inside offer card: #E9ECEF, radius 12, 84px high
 * - Header & bottom bar: White strips (#FFFFFF) with 1px #E5E7EB hairline
 */

export interface ThemeColors {
  accent: string;
  primaryButtonBg: string;
  text: string;
  textPrimary: string;
  textSecondary: string;
  captionText: string;
  pageBg: string;
  blockBg: string;
  background: string;
  surface: string;
  tile: string;
  divider: string;
  tagBg: string;
  tagText: string;
  discountBg: string;
  discountText: string;
  white: string;
  danger: string;
  dangerBg: string;
}

export const LIGHT_COLORS: ThemeColors = {
  accent: '#0B6B4F',
  primaryButtonBg: '#0B6B4F',
  text: '#111827',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  captionText: '#4B5563',
  pageBg: '#F5F6F7',
  blockBg: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#F5F6F7',
  tile: '#E9ECEF',
  divider: '#E5E7EB',
  tagBg: '#E7F4EE',
  tagText: '#0B6B4F',
  discountBg: '#E7F4EE',
  discountText: '#0B6B4F',
  white: '#FFFFFF',
  danger: '#B91C1C',
  dangerBg: '#FEF2F2',
};

export const DARK_COLORS: ThemeColors = {
  accent: '#10B981',
  primaryButtonBg: '#0D8A65',
  text: '#F9FAFB',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  captionText: '#D1D5DB',
  pageBg: '#0B0F17',
  blockBg: '#131A26',
  background: '#131A26',
  surface: '#1C2536',
  tile: '#253147',
  divider: '#263246',
  tagBg: '#113328',
  tagText: '#34D399',
  discountBg: '#113328',
  discountText: '#34D399',
  white: '#FFFFFF',
  danger: '#F87171',
  dangerBg: '#2D1619',
};

export const COLORS: ThemeColors = LIGHT_COLORS;

export function getThemeColors(isDarkMode?: boolean): ThemeColors {
  return isDarkMode ? DARK_COLORS : LIGHT_COLORS;
}

export const FONTS = {
  sans: Platform.select({
    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: undefined,
  }),
  mono: Platform.select({
    web: "'Inter', -apple-system, BlinkMacSystemFont, monospace",
    default: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  }),
} as const;

/**
 * Type scale:
 * - Title: 24/30 semibold (600)
 * - Section heading: 17 semibold (600)
 * - Body: 15/22 regular (400)
 * - Caption: 12 regular (400) / medium (500)
 * - Monogram: 26 semibold (600)
 */
export const TYPOGRAPHY = {
  titleSize: 24,
  titleLineHeight: 30,
  sectionHeadingSize: 17,
  sectionHeadingLineHeight: 22,
  bodySize: 15,
  bodyLineHeight: 22,
  captionSize: 12,
  captionLineHeight: 16,
  monogramSize: 26,
  weightRegular: '400' as const,
  weightMedium: '500' as const,
  weightSemibold: '600' as const,
} as const;

/**
 * 8px grid + mobile web layout constants:
 * - Gap between Level-1 blocks: 12px
 * - Page side padding: 12px
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  pageSide: 12,
  blockGap: 12,
  page: 16,
  blockPadV: 20,
  section: 24,
  xl: 32,
} as const;

export const RADIUS = {
  block: 16,
  card: 12,
  tile: 12,
  button: 16,
  full: 9999,
} as const;

export const ICON = {
  size: 20,
  lockSize: 14,
  strokeWidth: 1.5,
} as const;

export const TOUCH_TARGET = {
  min: 44,
  avatarSize: 40,
  stepCircleSize: 40,
  primaryButtonHeight: 52,
  headerHeight: 64,
} as const;

/**
 * Offline-first brand monogram generator (e.g. "24 Mantra" -> "24", "Amul" -> "AM", "Reliance" -> "RE")
 */
export function getBrandMonogram(brand?: string, fallbackName?: string): string {
  const raw = (brand || fallbackName || 'EC').trim();
  const alnum = raw.replace(/[^a-zA-Z0-9]/g, '');
  return (alnum.slice(0, 2) || 'EC').toUpperCase();
}

/**
 * Maps real catalog offerType rules to sentence-case deal lines.
 * Returns null if offerType is 'NONE' or undefined so the line is omitted.
 */
export function getOfferDealLine(offerType?: string): string | null {
  if (offerType === 'BOGO') {
    return 'Buy 1, get 1 free';
  }
  if (offerType === 'BUY_2_EXTRA_10_OFF') {
    return 'Buy 2, extra 10% off';
  }
  if (offerType === 'BUY_3_GET_15_OFF') {
    return 'Buy 3, get 15% off';
  }
  return null;
}

export function formatCleanStoreName(shortName?: string, fullName?: string): string {
  if (shortName) {
    return shortName
      .replace(/\s*#\d+/g, '')
      .replace(/\s*[—-]\s*/g, ' · ')
      .trim();
  }
  if (fullName) {
    return fullName
      .replace(/\s*#\d+/g, '')
      .replace(/\s*[—-]\s*/g, ' · ')
      .trim();
  }
  return 'DMart Express · Lower Parel';
}

export const PRODUCT_IMAGES: Record<string, string> = {};

export function getProductImage(barcode: string, explicitUrl?: string): string {
  return explicitUrl || PRODUCT_IMAGES[barcode] || '';
}

/**
 * Compact QR Exit Pass serializer (< 350 bytes for any cart size) so QR codes never overflow.
 * Intentionally excludes internal trust score and full line-item objects.
 */
export function buildCompactExitPassQrString(pass: {
  type?: string;
  orderId: string;
  storeName: string;
  timestamp?: string;
  upiRef?: string;
  signature: string;
  totalPrice: number;
  totalItemCount: number;
  cartWeightGrams: number;
  verificationMode?: string;
  counterStatus?: string;
  auditItems?: Array<{ barcode: string; quantity: number }>;
}): string {
  return JSON.stringify({
    v: 1,
    t: pass.type || 'EXPRESSCART_EXIT_PASS',
    id: pass.orderId,
    s: pass.storeName,
    ts: pass.timestamp,
    ref: pass.upiRef,
    sig: pass.signature,
    p: pass.totalPrice,
    c: pass.totalItemCount,
    w: pass.cartWeightGrams,
    ...(pass.verificationMode ? { m: pass.verificationMode } : {}),
    ...(pass.counterStatus ? { cs: pass.counterStatus } : {}),
    a: (pass.auditItems || []).slice(0, 5).map((i) => `${i.barcode}:${i.quantity}`),
  });
}
