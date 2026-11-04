import { getDatabaseHealth } from '../db/database';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const dbStatus = await getDatabaseHealth();
  return res.status(200).json({
    ok: true,
    service: 'ExpressCart India Backend API',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
}

