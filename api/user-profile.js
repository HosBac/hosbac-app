import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
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

    // Gérer la sauvegarde (POST)
    if (req.method === 'POST') {
      const { uid, email, nom, prenom, ecole, region, classe, serie } = req.body;
      
      if (!uid) {
        return res.status(400).json({ error: 'UID requis' });
      }

      await executeQuery(`
        INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, role, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', 'active')
        ON CONFLICT(uid) DO UPDATE SET
          nom = COALESCED(?, nom),
          prenom = COALESCED(?, prenom),
          ecole = COALESCED(?, ecole),
          region = COALESCED(?, region),
          classe = COALESCED(?, classe),
          serie = COALESCED(?, serie)
      `, [uid, email, nom, prenom, ecole, region, classe, serie, nom, prenom, ecole, region, classe, serie]);

      return res.status(200).json({ success: true, message: 'Profil enregistré avec succès' });
    }

    // Gérer la lecture (GET)
    if (req.method === 'GET') {
      const email = req.query.email || '';
      const uid = req.query.uid || req.query.userId || '';

      if (!email && !uid) return res.status(400).json({ error: 'Email ou UID requis' });

      const result = await executeQuery(
        'SELECT * FROM users WHERE uid = ? OR email = ?',
        [uid, email]
      );

      let user = result.rows && result.rows.length > 0 ? result.rows[0] : null;

      if (!user) {
        user = {
          uid: uid || 'user_' + Date.now(),
          email: email || '',
          nom: '',
          prenom: '',
          ecole: '',
          region: '',
          classe: '',
          serie: '',
          role: 'user',
          status: 'active'
        };
      }

      return res.status(200).json(user);
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });

  } catch (err) {
    console.error("Erreur API user-profile:", err);
    return res.status(500).json({ error: err.message });
  }
}
