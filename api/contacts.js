import { execute } from '../lib/db.js';

const db = {
  execute: (stmt) => typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }),
  batch: async (stmts) => {
    for (const stmt of stmts) {
      await (typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }));
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-UID, X-UID, X-Firebase-UID');

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