import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { userId, uid, email } = req.body || {};
    const targetId = userId || uid || email;

    if (!targetId) {
      return res.status(400).json({ error: 'ID ou email utilisateur requis' });
    }

    await executeQuery(
      'DELETE FROM users WHERE uid = ? OR id = ? OR email = ?',
      [targetId, targetId, targetId]
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
