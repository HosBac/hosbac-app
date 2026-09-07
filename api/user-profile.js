import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // S'assurer que la table contient toutes les colonnes, y compris favorites
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
        favorites TEXT,
        role TEXT,
        status TEXT
      )
    `);

    if (req.method === 'POST' || req.method === 'PATCH') {
      const bodyData = req.body || {};
      const source = bodyData.data || bodyData.updates || bodyData;
      
      const uid = bodyData.uid || bodyData.userId || bodyData.user_id || bodyData.id || source.uid || source.userId || source.user_id || source.id || bodyData.email || source.email;
      const email = bodyData.email || source.email || '';
      const nom = bodyData.nom || source.nom || '';
      const prenom = bodyData.prenom || source.prenom || '';
      const ecole = bodyData.ecole || source.ecole || '';
      const region = bodyData.region || source.region || '';
      const classe = bodyData.classe || source.classe || '';
      const serie = bodyData.serie || source.serie || '';
      
      const rawFavs = bodyData.favorites || source.favorites;
      let favoritesStr = '[]';
      if (Array.isArray(rawFavs)) {
        favoritesStr = JSON.stringify(rawFavs);
      } else if (typeof rawFavs === 'string') {
        favoritesStr = rawFavs;
      }

      if (!uid && !email) {
        return res.status(400).json({ error: 'UID ou Email requis' });
      }

      const primaryKey = uid || email;

      await executeQuery(`
        INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, favorites, role, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', 'active')
        ON CONFLICT(uid) DO UPDATE SET
          email = COALESCED(?, email),
          nom = COALESCED(?, nom),
          prenom = COALESCED(?, prenom),
          ecole = COALESCED(?, ecole),
          region = COALESCED(?, region),
          classe = COALESCED(?, classe),
          serie = COALESCED(?, serie),
          favorites = COALESCED(?, favorites)
      `, [primaryKey, email, nom, prenom, ecole, region, classe, serie, favoritesStr, email, nom, prenom, ecole, region, classe, serie, favoritesStr]);

      return res.status(200).json({ success: true, message: 'Profil et favoris enregistrés avec succès' });
    }

    if (req.method === 'GET') {
      const email = req.query.email || '';
      const uid = req.query.uid || req.query.userId || req.query.id || '';

      if (!email && !uid) return res.status(400).json({ error: 'Email ou UID requis' });

      const result = await executeQuery(
        'SELECT * FROM users WHERE uid = ? OR email = ? OR uid = ?',
        [uid, email, email]
      );

      let user = result.rows && result.rows.length > 0 ? result.rows[0] : null;

      if (user) {
        // Convertir la chaîne JSON des favoris en tableau pour le front-end
        try {
          user.favorites = JSON.parse(user.favorites || '[]');
        } catch (e) {
          user.favorites = [];
        }
      } else {
        user = {
          uid: uid || email || 'user_' + Date.now(),
          email: email || '',
          nom: '',
          prenom: '',
          ecole: '',
          region: '',
          classe: '',
          serie: '',
          favorites: [],
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
