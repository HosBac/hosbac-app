import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'DELETE') {
      const { uid, email } = req.query;

      if (!uid && !email) {
        return res.status(400).json({ error: 'UID ou Email requis' });
      }

      await executeQuery(
        'DELETE FROM users WHERE (uid = ? AND uid != "") OR (lower(email) = lower(?) AND email != "")',
        [uid || '', email || '']
      );

      return res.status(200).json({ success: true, message: 'Utilisateur supprimé définitivement' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
