import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    if (req.method === 'GET') {
      const result = await db.execute('SELECT * FROM site_settings');
      const settings = {};
      (result.rows || []).forEach(row => { settings[row.key] = row.value; });
      return res.status(200).json(settings);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      for (const [key, value] of Object.entries(body)) {
        await db.execute({
          sql: 'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          args: [key, String(value)]
        });
      }
      return res.status(200).json({ success: true, message: 'Configuration enregistrée' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
