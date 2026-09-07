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
      CREATE TABLE IF NOT EXISTS settings_legal (
        id TEXT PRIMARY KEY DEFAULT 'default',
        cgu TEXT DEFAULT '',
        privacy TEXT DEFAULT '',
        about TEXT DEFAULT '',
        faq TEXT DEFAULT '',
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (req.method === 'GET') {
      const result = await db.execute("SELECT * FROM settings_legal WHERE id = 'default'");
      const data = result.rows[0] || { cgu: '', privacy: '', about: '', faq: '[]' };
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { cgu, privacy, about, faq } = req.body || {};
      const faqStr = typeof faq === 'string' ? faq : JSON.stringify(faq || []);

      await db.execute({
        sql: `INSERT INTO settings_legal (id, cgu, privacy, about, faq, updatedAt)
              VALUES ('default', ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET
                cgu = excluded.cgu,
                privacy = excluded.privacy,
                about = excluded.about,
                faq = excluded.faq,
                updatedAt = CURRENT_TIMESTAMP`,
        args: [cgu || '', privacy || '', about || '', faqStr]
      });

      return res.status(200).json({ success: true, message: 'Pages légales enregistrées' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    console.error('[API Legal Error]', err);
    return res.status(500).json({ error: err.message });
  }
}
