import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { neon } from '@neondatabase/serverless';
import {
  SEED_STORES,
  SEED_PRODUCTS,
  SEED_PRODUCTS_BY_BARCODE,
  computeBackendPromoDiscount,
  BackendCatalogItem,
  BackendStoreBranch,
} from './seedData';

const HMAC_SECRET =
  process.env.EXPRESSCART_HMAC_SECRET || 'expresscart-india-hmac-secret-2026';

export interface BackendUserProfile {
  name: string;
  phone: string;
  isVerified: boolean;
  aadhaarLast4?: string;
  trustScore: number;
  walletBalance: number;
  verifiedAt?: string;
}

export interface BackendFamilySession {
  sessionId: string;
  pinCode: string;
  hostName: string;
  hostPhone: string;
  memberName: string;
  isActive: boolean;
  createdAt: string;
}

export interface BackendFamilyRoom {
  session: BackendFamilySession;
  cart1Items: any[];
  cart2Items: any[];
  updatedAt: string;
}

export interface BackendExitPass {
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
  auditItems: any[];
  allPaidItems?: any[];
  securityFlags?: any[];
  actualPhysicalItemsInCart?: string[];
}

// Lazy PostgreSQL connection (safe at build time when DATABASE_URL is not yet injected)
let _pgInitialized = false;

function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
}

function getSql() {
  const url = getDatabaseUrl();
  if (!url) return null;
  return neon(url);
}

/**
 * Automatically creates PostgreSQL tables and seeds the initial stores, 18 products,
 * and demo verified shopper on first connection.
 */
async function ensurePostgresSchemaAndSeed(): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  if (_pgInitialized) return true;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        short_name TEXT NOT NULL,
        chain TEXT NOT NULL,
        city TEXT NOT NULL,
        lane TEXT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        catalog_version TEXT NOT NULL,
        catalog_size_kb INTEGER NOT NULL DEFAULT 412,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS products (
        barcode TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        unit TEXT NOT NULL,
        category TEXT NOT NULL,
        mrp INTEGER NOT NULL,
        store_price INTEGER NOT NULL,
        weight_grams INTEGER NOT NULL,
        emoji TEXT NOT NULL,
        bg_color TEXT NOT NULL,
        accent_color TEXT NOT NULL,
        aisle TEXT NOT NULL,
        gst_percent INTEGER NOT NULL DEFAULT 12,
        offer_type TEXT NOT NULL DEFAULT 'NONE',
        offer_tag TEXT,
        package_color_hex TEXT NOT NULL,
        package_color_name TEXT NOT NULL,
        is_quick_test BOOLEAN NOT NULL DEFAULT FALSE,
        is_high_value_audit BOOLEAN NOT NULL DEFAULT FALSE
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        phone TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        is_verified BOOLEAN NOT NULL DEFAULT TRUE,
        aadhaar_last4 TEXT,
        trust_score INTEGER NOT NULL DEFAULT 95,
        wallet_balance INTEGER NOT NULL DEFAULT 1500,
        verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS family_sessions (
        pin_code TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        host_name TEXT NOT NULL,
        host_phone TEXT NOT NULL,
        member_name TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        cart1_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        cart2_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        store_name TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_trust_score INTEGER NOT NULL DEFAULT 95,
        payment_method TEXT NOT NULL,
        upi_ref TEXT NOT NULL,
        signature TEXT NOT NULL,
        total_price INTEGER NOT NULL,
        total_mrp INTEGER NOT NULL,
        total_savings INTEGER NOT NULL,
        promo_savings INTEGER NOT NULL DEFAULT 0,
        total_item_count INTEGER NOT NULL,
        cart_weight_grams INTEGER NOT NULL,
        is_family_order BOOLEAN NOT NULL DEFAULT FALSE,
        family_session_code TEXT,
        cart1_item_count INTEGER NOT NULL DEFAULT 0,
        cart1_weight_grams INTEGER NOT NULL DEFAULT 0,
        cart2_item_count INTEGER NOT NULL DEFAULT 0,
        cart2_weight_grams INTEGER NOT NULL DEFAULT 0,
        audit_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        all_paid_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        security_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
        actual_physical_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        exit_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Seed default verified user if not exists
    await sql`
      INSERT INTO users (phone, name, is_verified, aadhaar_last4, trust_score, wallet_balance)
      VALUES ('9820411290', 'Aarav Sharma', TRUE, '8492', 98, 1500)
      ON CONFLICT (phone) DO NOTHING
    `;

    // Seed stores if empty
    const existingStores = await sql`SELECT COUNT(*)::int AS cnt FROM stores`;
    if ((existingStores[0]?.cnt ?? 0) === 0) {
      for (const s of SEED_STORES) {
        await sql`
          INSERT INTO stores (id, name, short_name, chain, city, lane, latitude, longitude, catalog_version, catalog_size_kb)
          VALUES (${s.id}, ${s.name}, ${s.shortName}, ${s.chain}, ${s.city}, ${s.lane}, ${s.latitude}, ${s.longitude}, ${s.catalogVersion}, ${s.catalogSizeKb})
          ON CONFLICT (id) DO NOTHING
        `;
      }
    }

    // Seed products if empty
    const existingProducts = await sql`SELECT COUNT(*)::int AS cnt FROM products`;
    if ((existingProducts[0]?.cnt ?? 0) === 0) {
      for (const p of SEED_PRODUCTS) {
        await sql`
          INSERT INTO products (
            barcode, name, brand, unit, category, mrp, store_price, weight_grams,
            emoji, bg_color, accent_color, aisle, gst_percent, offer_type, offer_tag,
            package_color_hex, package_color_name, is_quick_test, is_high_value_audit
          ) VALUES (
            ${p.barcode}, ${p.name}, ${p.brand}, ${p.unit}, ${p.category}, ${p.mrp}, ${p.storePrice}, ${p.weightGrams},
            ${p.emoji}, ${p.bgColor}, ${p.accentColor}, ${p.aisle}, ${p.gstPercent}, ${p.offerType || 'NONE'}, ${p.offerTag || null},
            ${p.packageColorHex}, ${p.packageColorName}, ${Boolean(p.isQuickTest)}, ${Boolean(p.isHighValueAudit)}
          )
          ON CONFLICT (barcode) DO NOTHING
        `;
      }
    }

    _pgInitialized = true;
    return true;
  } catch {
    return false;
  }
}

// --- Local JSON Fallback when DATABASE_URL is not set yet ---
const LOCAL_DB_FILE = path.join(os.tmpdir(), 'expresscart-india-backend-db.json');

interface LocalFallbackDb {
  usersByPhone: Record<string, BackendUserProfile>;
  familyRoomsByPin: Record<string, BackendFamilyRoom>;
  ordersById: Record<string, BackendExitPass>;
}

function loadLocalDb(): LocalFallbackDb {
  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf-8'));
      if (parsed && parsed.usersByPhone) return parsed;
    }
  } catch {}
  const initial: LocalFallbackDb = {
    usersByPhone: {
      '9820411290': {
        name: 'Aarav Sharma',
        phone: '9820411290',
        isVerified: true,
        aadhaarLast4: '8492',
        trustScore: 98,
        walletBalance: 1500,
        verifiedAt: new Date().toISOString(),
      },
    },
    familyRoomsByPin: {},
    ordersById: {},
  };
  saveLocalDb(initial);
  return initial;
}

function saveLocalDb(db: LocalFallbackDb) {
  try {
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch {}
}

// --- Public Database Repository Functions (Postgres-First, Local-Fallback) ---

export async function getDatabaseHealth() {
  const pgReady = await ensurePostgresSchemaAndSeed();
  if (pgReady) {
    const sql = getSql()!;
    const [u, o, p] = await Promise.all([
      sql`SELECT COUNT(*)::int AS cnt FROM users`,
      sql`SELECT COUNT(*)::int AS cnt FROM orders`,
      sql`SELECT COUNT(*)::int AS cnt FROM products`,
    ]);
    return {
      mode: 'POSTGRESQL_CLOUD',
      connected: true,
      usersCount: u[0]?.cnt ?? 0,
      ordersCount: o[0]?.cnt ?? 0,
      productsCount: p[0]?.cnt ?? 0,
    };
  }
  const local = loadLocalDb();
  return {
    mode: 'LOCAL_JSON_FALLBACK (Set DATABASE_URL for Cloud Postgres)',
    connected: true,
    usersCount: Object.keys(local.usersByPhone).length,
    ordersCount: Object.keys(local.ordersById).length,
    productsCount: SEED_PRODUCTS.length,
  };
}

export async function dbGetCatalogAndStores(): Promise<{
  stores: BackendStoreBranch[];
  products: BackendCatalogItem[];
  source: 'POSTGRESQL' | 'SEED_CACHE';
}> {
  const pgReady = await ensurePostgresSchemaAndSeed();
  if (pgReady) {
    const sql = getSql()!;
    const rows = await sql`SELECT * FROM products ORDER BY category, name`;
    if (rows.length > 0) {
      const products: BackendCatalogItem[] = rows.map((r: any) => ({
        barcode: r.barcode,
        name: r.name,
        brand: r.brand,
        unit: r.unit,
        category: r.category,
        mrp: Number(r.mrp),
        storePrice: Number(r.store_price),
        weightGrams: Number(r.weight_grams),
        emoji: r.emoji,
        bgColor: r.bg_color,
        accentColor: r.accent_color,
        aisle: r.aisle,
        gstPercent: Number(r.gst_percent),
        offerType: r.offer_type,
        offerTag: r.offer_tag || undefined,
        packageColorHex: r.package_color_hex,
        packageColorName: r.package_color_name,
        isQuickTest: Boolean(r.is_quick_test),
        isHighValueAudit: Boolean(r.is_high_value_audit),
      }));
      return { stores: SEED_STORES, products, source: 'POSTGRESQL' };
    }
  }
  return { stores: SEED_STORES, products: SEED_PRODUCTS, source: 'SEED_CACHE' };
}

export async function dbGetUser(phone: string): Promise<BackendUserProfile | null> {
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const pgReady = await ensurePostgresSchemaAndSeed();
  if (pgReady) {
    const sql = getSql()!;
    const rows = await sql`SELECT * FROM users WHERE phone = ${cleanPhone} LIMIT 1`;
    if (rows.length > 0) {
      const r = rows[0];
      return {
        phone: r.phone,
        name: r.name,
        isVerified: Boolean(r.is_verified),
        aadhaarLast4: r.aadhaar_last4 || undefined,
        trustScore: Number(r.trust_score),
        walletBalance: Number(r.wallet_balance),
        verifiedAt: new Date(r.verified_at).toISOString(),
      };
    }
    return null;
  }
  const local = loadLocalDb();
  return local.usersByPhone[cleanPhone] || null;
}

export async function dbUpsertUser(user: BackendUserProfile): Promise<BackendUserProfile> {
  const cleanPhone = user.phone.replace(/\D/g, '').slice(-10);
  const pgReady = await ensurePostgresSchemaAndSeed();
  if (pgReady) {
    const sql = getSql()!;
    await sql`
      INSERT INTO users (phone, name, is_verified, aadhaar_last4, trust_score, wallet_balance, verified_at)
      VALUES (${cleanPhone}, ${user.name}, ${user.isVerified}, ${user.aadhaarLast4 || null}, ${user.trustScore}, ${user.walletBalance}, NOW())
      ON CONFLICT (phone) DO UPDATE SET
        name = EXCLUDED.name,
        is_verified = EXCLUDED.is_verified,
        aadhaar_last4 = COALESCE(EXCLUDED.aadhaar_last4, users.aadhaar_last4),
        trust_score = EXCLUDED.trust_score,
        wallet_balance = EXCLUDED.wallet_balance
    `;
  }
  const local = loadLocalDb();
  local.usersByPhone[cleanPhone] = user;
  saveLocalDb(local);
  return user;
}

export async function dbGetFamilyRoom(pinCode: string): Promise<BackendFamilyRoom | null> {
  const cleanPin = pinCode.replace(/\D/g, '').slice(0, 4);
  const pgReady = await ensurePostgresSchemaAndSeed();
  if (pgReady) {
    const sql = getSql()!;
    const rows = await sql`SELECT * FROM family_sessions WHERE pin_code = ${cleanPin} LIMIT 1`;
    if (rows.length > 0) {
      const r = rows[0];
      return {
        session: {
          sessionId: r.session_id,
          pinCode: r.pin_code,
          hostName: r.host_name,
          hostPhone: r.host_phone,
          memberName: r.member_name,
          isActive: Boolean(r.is_active),
          createdAt: new Date(r.updated_at).toLocaleTimeString(),
        },
        cart1Items: Array.isArray(r.cart1_items) ? r.cart1_items : [],
        cart2Items: Array.isArray(r.cart2_items) ? r.cart2_items : [],
        updatedAt: new Date(r.updated_at).toISOString(),
      };
    }
    return null;
  }
  const local = loadLocalDb();
  return local.familyRoomsByPin[cleanPin] || null;
}

export async function dbUpsertFamilyRoom(
  pinCode: string,
  room: BackendFamilyRoom
): Promise<BackendFamilyRoom> {
  const cleanPin = pinCode.replace(/\D/g, '').slice(0, 4);
  const pgReady = await ensurePostgresSchemaAndSeed();
  if (pgReady) {
    const sql = getSql()!;
    await sql`
      INSERT INTO family_sessions (pin_code, session_id, host_name, host_phone, member_name, is_active, cart1_items, cart2_items, updated_at)
      VALUES (
        ${cleanPin},
        ${room.session.sessionId},
        ${room.session.hostName},
        ${room.session.hostPhone},
        ${room.session.memberName},
        ${room.session.isActive},
        ${JSON.stringify(room.cart1Items)}::jsonb,
        ${JSON.stringify(room.cart2Items)}::jsonb,
        NOW()
      )
      ON CONFLICT (pin_code) DO UPDATE SET
        member_name = EXCLUDED.member_name,
        is_active = EXCLUDED.is_active,
        cart1_items = EXCLUDED.cart1_items,
        cart2_items = EXCLUDED.cart2_items,
        updated_at = NOW()
    `;
  }
  const local = loadLocalDb();
  local.familyRoomsByPin[cleanPin] = room;
  saveLocalDb(local);
  return room;
}

export async function dbSaveOrder(pass: BackendExitPass): Promise<BackendExitPass> {
  const pgReady = await ensurePostgresSchemaAndSeed();
  if (pgReady) {
    const sql = getSql()!;
    await sql`
      INSERT INTO orders (
        order_id, store_name, customer_name, customer_phone, customer_trust_score,
        payment_method, upi_ref, signature, total_price, total_mrp, total_savings, promo_savings,
        total_item_count, cart_weight_grams, is_family_order, family_session_code,
        cart1_item_count, cart1_weight_grams, cart2_item_count, cart2_weight_grams,
        audit_items, all_paid_items, security_flags, actual_physical_items
      ) VALUES (
        ${pass.orderId},
        ${pass.storeName},
        ${pass.customerName || 'Verified Shopper'},
        ${pass.customerPhone || '9820411290'},
        ${pass.customerTrustScore ?? 95},
        ${pass.paymentMethod || 'ExpressWallet'},
        ${pass.upiRef},
        ${pass.signature},
        ${pass.totalPrice},
        ${pass.totalMrp},
        ${pass.totalSavings},
        ${pass.promoSavings ?? 0},
        ${pass.totalItemCount},
        ${pass.cartWeightGrams},
        ${Boolean(pass.isFamilyOrder)},
        ${pass.familySessionCode || null},
        ${pass.cart1ItemCount ?? 0},
        ${pass.cart1WeightGrams ?? 0},
        ${pass.cart2ItemCount ?? 0},
        ${pass.cart2WeightGrams ?? 0},
        ${JSON.stringify(pass.auditItems)}::jsonb,
        ${JSON.stringify(pass.allPaidItems || [])}::jsonb,
        ${JSON.stringify(pass.securityFlags || [])}::jsonb,
        ${JSON.stringify(pass.actualPhysicalItemsInCart || [])}::jsonb
      )
      ON CONFLICT (order_id) DO NOTHING
    `;
  }
  const local = loadLocalDb();
  local.ordersById[pass.orderId] = pass;
  saveLocalDb(local);
  return pass;
}

export async function dbGetOrder(orderId: string): Promise<BackendExitPass | null> {
  const pgReady = await ensurePostgresSchemaAndSeed();
  if (pgReady) {
    const sql = getSql()!;
    const rows = await sql`SELECT * FROM orders WHERE order_id = ${orderId} LIMIT 1`;
    if (rows.length > 0) {
      const r = rows[0];
      return {
        type: 'EXPRESSCART_EXIT_PASS',
        orderId: r.order_id,
        storeName: r.store_name,
        timestamp: new Date(r.created_at).toISOString(),
        upiRef: r.upi_ref,
        paymentMethod: r.payment_method,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        customerTrustScore: Number(r.customer_trust_score),
        signature: r.signature,
        totalPrice: Number(r.total_price),
        totalMrp: Number(r.total_mrp),
        totalSavings: Number(r.total_savings),
        promoSavings: Number(r.promo_savings),
        totalItemCount: Number(r.total_item_count),
        cartWeightGrams: Number(r.cart_weight_grams),
        isFamilyOrder: Boolean(r.is_family_order),
        familySessionCode: r.family_session_code || undefined,
        cart1ItemCount: Number(r.cart1_item_count),
        cart1WeightGrams: Number(r.cart1_weight_grams),
        cart2ItemCount: Number(r.cart2_item_count),
        cart2WeightGrams: Number(r.cart2_weight_grams),
        auditItems: Array.isArray(r.audit_items) ? r.audit_items : [],
        allPaidItems: Array.isArray(r.all_paid_items) ? r.all_paid_items : [],
        securityFlags: Array.isArray(r.security_flags) ? r.security_flags : [],
        actualPhysicalItemsInCart: Array.isArray(r.actual_physical_items)
          ? r.actual_physical_items
          : [],
      };
    }
  }
  const local = loadLocalDb();
  return local.ordersById[orderId] || null;
}

export async function dbGetRecentOrders(): Promise<BackendExitPass[]> {
  const pgReady = await ensurePostgresSchemaAndSeed();
  if (pgReady) {
    const sql = getSql()!;
    const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 10`;
    return rows.map((r: any) => ({
      type: 'EXPRESSCART_EXIT_PASS',
      orderId: r.order_id,
      storeName: r.store_name,
      timestamp: new Date(r.created_at).toISOString(),
      upiRef: r.upi_ref,
      paymentMethod: r.payment_method,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      customerTrustScore: Number(r.customer_trust_score),
      signature: r.signature,
      totalPrice: Number(r.total_price),
      totalMrp: Number(r.total_mrp),
      totalSavings: Number(r.total_savings),
      promoSavings: Number(r.promo_savings),
      totalItemCount: Number(r.total_item_count),
      cartWeightGrams: Number(r.cart_weight_grams),
      isFamilyOrder: Boolean(r.is_family_order),
      auditItems: Array.isArray(r.audit_items) ? r.audit_items : [],
      allPaidItems: Array.isArray(r.all_paid_items) ? r.all_paid_items : [],
      securityFlags: Array.isArray(r.security_flags) ? r.security_flags : [],
    }));
  }
  const local = loadLocalDb();
  return Object.values(local.ordersById).slice(-10).reverse();
}

export function signExitPassPayload(params: {
  orderId: string;
  storeName: string;
  totalPrice: number;
  totalItemCount: number;
  cartWeightGrams: number;
  customerPhone: string;
}): string {
  const canonical = `${params.orderId}|${params.storeName}|${params.totalPrice}|${params.totalItemCount}|${params.cartWeightGrams}|${params.customerPhone}`;
  const digest = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(canonical)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
  return `HMAC-SHA256-${digest}`;
}

export function verifyExitPassSignature(pass: BackendExitPass): boolean {
  if (!pass.signature) return false;
  if (pass.signature.startsWith('HMAC-SHA256-')) {
    const expected = signExitPassPayload({
      orderId: pass.orderId,
      storeName: pass.storeName,
      totalPrice: pass.totalPrice,
      totalItemCount: pass.totalItemCount,
      cartWeightGrams: pass.cartWeightGrams,
      customerPhone: pass.customerPhone || '9820411290',
    });
    return pass.signature === expected;
  }
  return pass.signature.startsWith('SIG-');
}

export {
  SEED_STORES,
  SEED_PRODUCTS,
  SEED_PRODUCTS_BY_BARCODE,
  computeBackendPromoDiscount,
};

