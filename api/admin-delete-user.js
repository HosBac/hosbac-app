import { executeQuery } from './_db.js';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      const { uid, email, targetUid, targetEmail } = req.body || {};
      const u = targetUid || uid;
      const e = targetEmail || email;

      if (!u && !e) return res.status(400).json({ error: 'ID ou Email requis' });

      await db.execute({
        sql: 'DELETE FROM users WHERE uid = ? OR email = ?',
        args: [u || '', e || '']
      });

      return res.status(200).json({ success: true, message: 'Utilisateur supprimé' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
