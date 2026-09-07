import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    if (req.method === 'GET') {
      const result = await executeQuery('SELECT * FROM settings');
      const settingsObj = {};
      (result.rows || []).forEach(row => {
        settingsObj[row.key] = row.value;
      });
      return res.status(200).json(settingsObj);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const settings = req.body || {};
      for (const [key, value] of Object.entries(settings)) {
        await executeQuery(`
          INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `, [key, typeof value === 'object' ? JSON.stringify(value) : String(value)]);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
