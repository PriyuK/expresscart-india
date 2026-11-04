import { dbGetFamilyRoom, dbUpsertFamilyRoom, BackendFamilyRoom } from '../db/database';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const pinCode = String(req.query?.pinCode || '').replace(/\D/g, '').slice(0, 4);
    const room = await dbGetFamilyRoom(pinCode);
    if (!room) {
      return res.status(404).json({ ok: false, error: 'Family session PIN not found' });
    }
    return res.status(200).json({ ok: true, room });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { action, pinCode, hostName, hostPhone, memberName, cart1Items, cart2Items } = body;

  if (action === 'create') {
    const cleanPin =
      String(pinCode || '').replace(/\D/g, '').slice(0, 4) ||
      String(Math.floor(1000 + Math.random() * 9000));
    const room: BackendFamilyRoom = {
      session: {
        sessionId: `FAM-${cleanPin}`,
        pinCode: cleanPin,
        hostName: hostName || 'Primary Shopper (Cart #1)',
        hostPhone: hostPhone || '9820411290',
        memberName: memberName || 'Family Member (Cart #2)',
        isActive: true,
        createdAt: new Date().toLocaleTimeString(),
      },
      cart1Items: Array.isArray(cart1Items) ? cart1Items : [],
      cart2Items: Array.isArray(cart2Items) ? cart2Items : [],
      updatedAt: new Date().toISOString(),
    };

    const saved = await dbUpsertFamilyRoom(cleanPin, room);
    return res.status(200).json({ ok: true, room: saved });
  }

  if (action === 'join') {
    const cleanPin = String(pinCode || '4829').replace(/\D/g, '').slice(0, 4);
    let room = await dbGetFamilyRoom(cleanPin);
    if (!room) {
      room = {
        session: {
          sessionId: `FAM-${cleanPin}`,
          pinCode: cleanPin,
          hostName: hostName || 'Primary Host (Cart #1)',
          hostPhone: hostPhone || '9820411290',
          memberName: memberName || 'Family Member (Cart #2)',
          isActive: true,
          createdAt: new Date().toLocaleTimeString(),
        },
        cart1Items: [],
        cart2Items: [],
        updatedAt: new Date().toISOString(),
      };
    } else if (memberName) {
      room.session.memberName = memberName;
      room.updatedAt = new Date().toISOString();
    }
    const saved = await dbUpsertFamilyRoom(cleanPin, room);
    return res.status(200).json({ ok: true, room: saved });
  }

  if (action === 'sync') {
    const cleanPin = String(pinCode || '').replace(/\D/g, '').slice(0, 4);
    const room = await dbGetFamilyRoom(cleanPin);
    if (!room) {
      return res.status(404).json({ ok: false, error: 'Family room not found' });
    }
    if (Array.isArray(cart1Items)) room.cart1Items = cart1Items;
    if (Array.isArray(cart2Items)) room.cart2Items = cart2Items;
    room.updatedAt = new Date().toISOString();
    const saved = await dbUpsertFamilyRoom(cleanPin, room);
    return res.status(200).json({ ok: true, room: saved });
  }

  return res.status(400).json({ ok: false, error: 'Unsupported family action' });
}

