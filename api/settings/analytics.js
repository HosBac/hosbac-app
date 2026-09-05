import { execute } from '../lib/db.js';

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
      const result = await execute('SELECT * FROM analytics_settings ORDER BY id DESC LIMIT 1');
      return res.status(200).json(result.rows[0] || {});
    }

    if (req.method === 'POST') {
      const { tracking_id, enabled } = req.body || {};
      const result = await execute({
        sql: 'INSERT INTO analytics_settings (tracking_id, enabled) VALUES (?, ?)',
        args: [tracking_id || '', enabled ? 1 : 0],
      });
      return res.status(200).json({ success: true, id: Number(result.lastInsertRowid) });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (error) {
    console.error('Erreur API /api/settings/analytics:', error);
    return res.status(200).json({});
  }
}
