import { executeQuery } from './_db.js';

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
      CREATE TABLE IF NOT EXISTS legal_texts (
        key TEXT PRIMARY KEY,
        content TEXT
      )
    `);

    if (req.method === 'GET') {
      const result = await db.execute('SELECT * FROM legal_texts');
      const data = {};
      (result.rows || []).forEach(row => { data[row.key] = row.content; });
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { cgu, privacy, about, faq } = req.body || {};
      const updates = [
        { key: 'cgu', val: cgu },
        { key: 'privacy', val: privacy },
        { key: 'about', val: about },
        { key: 'faq', val: JSON.stringify(faq || []) }
      ];

      for (const item of updates) {
        if (item.val !== undefined) {
          await db.execute({
            sql: 'INSERT INTO legal_texts (key, content) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET content = excluded.content',
            args: [item.key, typeof item.val === 'string' ? item.val : JSON.stringify(item.val)]
          });
        }
      }
      return res.status(200).json({ success: true, message: 'Textes enregistrés' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
