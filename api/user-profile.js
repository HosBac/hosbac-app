import { executeQuery } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const email = req.query.email;
      const uid = req.query.uid || req.query.userId;

      if (!email && !uid) return res.status(400).json({ error: 'Email ou UID requis' });

      const result = await executeQuery(
        'SELECT * FROM users WHERE (uid = ? AND uid != "") OR (lower(email) = lower(?) AND email != "")',
        [uid || '', email || '']
      );

      const user = result.rows && result.rows.length > 0 ? result.rows[0] : null;
      return res.status(200).json(user || {});
    }

    if (req.method === 'POST') {
      const { uid, email, nom, prenom, ecole, region, classe, serie, role } = req.body || {};

      await executeQuery(`
        CREATE TABLE IF NOT EXISTS users (
          uid TEXT PRIMARY KEY,
          email TEXT,
          nom TEXT,
          prenom TEXT,
          ecole TEXT,
          region TEXT,
          classe TEXT,
          serie TEXT,
          role TEXT,
          status TEXT
        )
      `);

      await executeQuery(
        `INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
         ON CONFLICT(uid) DO UPDATE SET
           nom = excluded.nom,
           prenom = excluded.prenom,
           ecole = excluded.ecole,
           region = excluded.region,
           classe = excluded.classe,
           serie = excluded.serie,
           role = excluded.role`,
        [uid || '', email || '', nom || '', prenom || '', ecole || '', region || '', classe || '', serie || '', role || 'student']
      );

      return res.status(200).json({ success: true, message: 'Profil enregistré avec succès' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
