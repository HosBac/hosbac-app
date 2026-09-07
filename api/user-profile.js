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
    if (req.method === 'GET') {
      const email = req.query.email;
      const uid = req.query.uid || req.query.userId;

      let result;
      if (email) {
        result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
      } else if (uid) {
        result = await db.execute({ sql: 'SELECT * FROM users WHERE uid = ?', args: [uid] });
      } else {
        return res.status(400).json({ error: 'Email ou UID requis' });
      }

      const user = result.rows && result.rows.length > 0 ? result.rows[0] : {};
      return res.status(200).json(user);
    }

    if (req.method === 'POST') {
      const { email, uid, nom, classe, serie, role } = req.body || {};
      if (!email && !uid) return res.status(400).json({ error: 'Email ou UID requis' });

      await db.execute({
        sql: `UPDATE users SET 
                nom = COALESCE(?, nom), 
                classe = COALESCE(?, classe), 
                serie = COALESCE(?, serie),
                role = COALESCE(?, role)
              WHERE (email = ? AND email != '') OR (uid = ? AND uid != '')`,
        args: [nom || null, classe || null, serie || null, role || null, email || '', uid || '']
      });

      return res.status(200).json({ success: true, message: 'Profil mis à jour' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
