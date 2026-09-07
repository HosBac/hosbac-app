import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
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

    if (req.method === 'GET') {
      const email = req.query.email || '';
      const uid = req.query.uid || req.query.userId || '';

      if (!email && !uid) return res.status(400).json({ error: 'Email ou UID requis' });

      const result = await executeQuery(
        'SELECT * FROM users WHERE (uid = ? AND uid != "") OR (lower(email) = lower(?) AND email != "")',
        [uid, email]
      );

      let user = result.rows && result.rows.length > 0 ? result.rows[0] : null;

      // Définition automatique du rôle admin pour l'administrateur principal
      const isAdminEmail = email.toLowerCase() === 'mickaelpcs14@gmail.com';

      if (!user) {
        user = {
          uid: uid || 'admin_uid',
          email: email || 'mickaelpcs14@gmail.com',
          nom: 'PCS',
          prenom: 'Admin',
          ecole: 'HosBac Admin',
          region: 'Bénin',
          classe: 'Tle',
          serie: 'D',
          role: isAdminEmail ? 'admin' : 'student',
          status: 'active'
        };
      } else if (isAdminEmail && user.role !== 'admin') {
        user.role = 'admin';
        await executeQuery('UPDATE users SET role = "admin" WHERE lower(email) = lower(?)', [email]);
      }

      return res.status(200).json(user);
    }

    if (req.method === 'POST') {
      const { uid, email, nom, prenom, ecole, region, classe, serie, role } = req.body || {};
      const userRole = (email && email.toLowerCase() === 'mickaelpcs14@gmail.com') ? 'admin' : (role || 'student');

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
        [uid || '', email || '', nom || '', prenom || '', ecole || '', region || '', classe || '', serie || '', userRole]
      );

      return res.status(200).json({ success: true, message: 'Profil enregistré avec succès' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
