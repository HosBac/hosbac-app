import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await executeQuery(`CREATE TABLE IF NOT EXISTS epreuves (id TEXT PRIMARY KEY)`);
    await executeQuery(`CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY)`);

    const countEpreuves = await executeQuery('SELECT COUNT(*) as total FROM epreuves');
    const countCorriges = await executeQuery('SELECT COUNT(*) as total FROM epreuves WHERE correctionUrl IS NOT NULL AND correctionUrl != ""');
    const countUsers = await executeQuery('SELECT COUNT(*) as total FROM users');

    return res.status(200).json({
      epreuves: countEpreuves.rows?.[0]?.total || 0,
      corriges: countCorriges.rows?.[0]?.total || 0,
      matieres: 12,
      utilisateurs: countUsers.rows?.[0]?.total || 0
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
