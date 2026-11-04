# ExpressCart India — Dedicated Backend & PostgreSQL Database

This `backend/` folder is a **100% self-contained Vercel Serverless & Node.js Backend** with **Cloud PostgreSQL (`@neondatabase/serverless`)** persistence.

## Folder Structure
- `api/health.ts` — `GET /api/health` (checks PostgreSQL connection & table counts)
- `api/catalog.ts` — `GET /api/catalog` (GPS Haversine store auto-detection + full catalog & BOGO/Combo offer sync)
- `api/auth.ts` — `GET/POST /api/auth` (Mobile OTP verification, Aadhaar Last-4 KYC, Trust Score & ExpressCart Wallet balance)
- `api/family.ts` — `GET/POST /api/family` (Cross-device 2-cart Family Mode sync under 1 single bill)
- `api/orders.ts` — `GET/POST /api/orders` (Checkout, HMAC-SHA256 QR signing & Guard Reverse Barcode Spot-Scanner)
- `db/schema.sql` — Full PostgreSQL schema (`stores`, `products`, `users`, `family_sessions`, `orders`)
- `db/database.ts` — Auto-migrating PostgreSQL repository (automatically creates tables & seeds all 18 products on first connection, with local fallback if `DATABASE_URL` is not yet set)
- `db/seedData.ts` — Initial store branches, SKUs, visual package signatures, and Mart Promo rules
- `server.mjs` — Standalone local Node HTTP server (`npm run start`)
- `vercel.json` & `package.json` — Ready for standalone Vercel deployment

## How to Deploy `backend/` to Vercel with a Dedicated PostgreSQL Database
1. Deploy this `backend/` folder to Vercel (or deploy from the project root):
   ```bash
   cd backend
   npx vercel --prod
   ```
2. Attach a free **Neon Serverless PostgreSQL** database in 1 click on Vercel:
   ```bash
   npx vercel integration add neon
   ```
   *(Or paste any PostgreSQL connection string as `DATABASE_URL` in your Vercel Project Settings -> Environment Variables).*
3. On the very first API request, `db/database.ts` automatically runs `CREATE TABLE IF NOT EXISTS` for all 5 tables (`stores`, `products`, `users`, `family_sessions`, `orders`) and seeds the catalog!

