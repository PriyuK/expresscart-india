import { dbGetUser, dbUpsertUser, BackendUserProfile, UserRole } from '../db/database';

const VALID_STORE_PASSCODES = ['1234', '2468', '9999'];

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const phone = String(req.query?.phone || '').replace(/\D/g, '').slice(-10);
    const user = await dbGetUser(phone);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Profile not found' });
    }
    return res.status(200).json({ ok: true, userProfile: user });
  }

  const body =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const {
    action,
    phone,
    name,
    otp,
    aadhaarLast4,
    amount,
    trustDelta,
    role,
    employeeId,
    storePasscode,
    assignedStore,
  } = body;
  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);

  if (action === 'send-otp') {
    if (cleanPhone.length !== 10) {
      return res
        .status(400)
        .json({ ok: false, error: 'Valid 10-digit Indian mobile number required' });
    }
    return res.status(200).json({
      ok: true,
      message: `OTP sent to +91 ${cleanPhone}`,
    });
  }

  if (action === 'verify-otp') {
    if (cleanPhone.length !== 10) {
      return res
        .status(400)
        .json({ ok: false, error: 'Valid 10-digit phone number required' });
    }
    const cleanOtp = String(otp || '').trim();
    if (cleanOtp.length !== 4) {
      return res.status(400).json({ ok: false, error: '4-digit OTP required' });
    }

    const requestedRole: UserRole =
      role === 'STORE_STAFF' ? 'STORE_STAFF' : 'SHOPPER';

    if (requestedRole === 'STORE_STAFF') {
      const cleanEmpId = String(employeeId || '').trim().toUpperCase();
      const cleanPasscode = String(storePasscode || '').trim();
      if (!cleanEmpId) {
        return res
          .status(400)
          .json({ ok: false, error: 'Employee ID is required for Store Staff login' });
      }
      if (!VALID_STORE_PASSCODES.includes(cleanPasscode)) {
        return res.status(401).json({
          ok: false,
          error: 'Invalid Store Authorization Passcode',
        });
      }
    }

    const existing = await dbGetUser(cleanPhone);
    const resolvedName = String(
      name ||
        existing?.name ||
        (requestedRole === 'STORE_STAFF' ? 'Store Staff Associate' : 'Express Shopper')
    ).trim();
    const resolvedKyc = aadhaarLast4 || existing?.aadhaarLast4 || undefined;

    const profile: BackendUserProfile = {
      name: resolvedName,
      phone: cleanPhone,
      role: requestedRole,
      employeeId:
        requestedRole === 'STORE_STAFF'
          ? String(employeeId || existing?.employeeId || 'EMP-101')
              .trim()
              .toUpperCase()
          : undefined,
      assignedStore:
        requestedRole === 'STORE_STAFF'
          ? assignedStore ||
            existing?.assignedStore ||
            'Reliance/DMart Express Pilot - Store #01'
          : undefined,
      isVerified: true,
      aadhaarLast4: resolvedKyc,
      trustScore:
        requestedRole === 'STORE_STAFF'
          ? 100
          : existing?.trustScore ?? (resolvedKyc ? 98 : 94),
      walletBalance: existing?.walletBalance ?? 1500,
      verifiedAt: new Date().toISOString(),
    };

    const saved = await dbUpsertUser(profile);
    return res.status(200).json({ ok: true, userProfile: saved });
  }

  if (action === 'topup-wallet') {
    const user = await dbGetUser(cleanPhone);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    user.walletBalance += Math.max(0, Number(amount) || 0);
    const saved = await dbUpsertUser(user);
    return res.status(200).json({ ok: true, userProfile: saved });
  }

  if (action === 'link-kyc') {
    const user = await dbGetUser(cleanPhone);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    user.aadhaarLast4 = String(aadhaarLast4 || '').replace(/\D/g, '').slice(-4);
    user.trustScore = Math.min(100, user.trustScore + 4);
    const saved = await dbUpsertUser(user);
    return res.status(200).json({ ok: true, userProfile: saved });
  }

  if (action === 'adjust-trust') {
    const user = await dbGetUser(cleanPhone);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    user.trustScore = Math.max(
      0,
      Math.min(100, user.trustScore + (Number(trustDelta) || 0))
    );
    const saved = await dbUpsertUser(user);
    return res.status(200).json({ ok: true, userProfile: saved });
  }

  return res.status(400).json({ ok: false, error: 'Unsupported auth action' });
}
