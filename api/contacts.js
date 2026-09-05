import { execute } from './_db.js';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const result = await execute('SELECT * FROM contacts ORDER BY created_at DESC');
      return res.status(200).json(result.rows || []);
    }

    if (req.method === 'POST') {
      const { name, email, subject, message } = req.body || {};
      const result = await execute({
        sql: 'INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)',
        args: [name || '', email || '', subject || '', message || ''],
      });
      return res.status(200).json({ success: true, id: Number(result.lastInsertRowid) });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (error) {
    console.error('Erreur API /api/contacts:', error);
    return res.status(500).json({ error: error.message });
  }
}
