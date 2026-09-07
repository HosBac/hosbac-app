import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const result = await executeQuery('SELECT * FROM users ORDER BY rowid DESC');
      return res.status(200).json(result.rows || []);
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const { uid, role, status } = req.body || {};
      if (!uid) return res.status(400).json({ error: 'UID requis' });

      await executeQuery(
        'UPDATE users SET role = COALESCE(?, role), status = COALESCE(?, status) WHERE uid = ?',
        [role || null, status || null, uid]
      );
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { uid } = req.query;
      if (!uid) return res.status(400).json({ error: 'UID requis' });
      await executeQuery('DELETE FROM users WHERE uid = ?', [uid]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
