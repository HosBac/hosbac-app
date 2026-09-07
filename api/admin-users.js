import { executeQuery } from './_db.js';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const result = await db.execute('SELECT * FROM users ORDER BY rowid DESC');
      return res.status(200).json(result.rows || []);
    }

    if (req.method === 'PATCH') {
      const { uid, email, status, role, suspended } = req.body || {};
      const targetStatus = status || (suspended ? 'SUSPENDED' : 'ACTIF');
      
      await db.execute({
        sql: 'UPDATE users SET status = ?, role = COALESCE(?, role) WHERE uid = ? OR email = ?',
        args: [targetStatus, role || null, uid || '', email || '']
      });

      return res.status(200).json({ success: true, message: 'Utilisateur mis à jour' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
