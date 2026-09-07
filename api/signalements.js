import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS signalements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT,
        target_id TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (req.method === 'GET') {
      const result = await executeQuery('SELECT * FROM signalements ORDER BY id DESC');
      return res.status(200).json(result.rows || []);
    }

    if (req.method === 'POST') {
      const { user_email, target_id, reason } = req.body || {};
      if (!reason) return res.status(400).json({ error: 'Raison requise' });

      await executeQuery(
        'INSERT INTO signalements (user_email, target_id, reason, status) VALUES (?, ?, ?, "pending")',
        [user_email || 'Anonyme', target_id || '', reason]
      );

      return res.status(200).json({ success: true, message: 'Signalement enregistré' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID requis' });

      await executeQuery('DELETE FROM signalements WHERE id = ?', [id]);
      return res.status(200).json({ success: true, message: 'Signalement supprimé' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
