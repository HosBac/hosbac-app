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
      CREATE TABLE IF NOT EXISTS settings_analytics (
        id TEXT PRIMARY KEY DEFAULT 'default',
        ga_id TEXT DEFAULT '',
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (req.method === 'GET') {
      const result = await db.execute("SELECT * FROM settings_analytics WHERE id = 'default'");
      return res.status(200).json(result.rows[0] || {});
    }

    if (req.method === 'POST') {
      const { ga_id, analyticsId } = req.body || {};
      const val = ga_id || analyticsId || '';
      await db.execute({
        sql: `INSERT INTO settings_analytics (id, ga_id, updatedAt)
              VALUES ('default', ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET ga_id = excluded.ga_id, updatedAt = CURRENT_TIMESTAMP`,
        args: [val]
      });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
