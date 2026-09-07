import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS signalements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        epreuveId TEXT,
        raison TEXT,
        details TEXT,
        userEmail TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (req.method === 'GET') {
      const result = await db.execute('SELECT * FROM signalements ORDER BY createdAt DESC');
      return res.status(200).json(result.rows || []);
    }

    if (req.method === 'POST') {
      const { epreuveId, raison, details, userEmail } = req.body || {};
      await db.execute({
        sql: 'INSERT INTO signalements (epreuveId, raison, details, userEmail) VALUES (?, ?, ?, ?)',
        args: [epreuveId || '', raison || '', details || '', userEmail || '']
      });
      return res.status(200).json({ success: true, message: 'Signalement enregistré' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
