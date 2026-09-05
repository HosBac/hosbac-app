// HosBac - suppression complète d'un compte utilisateur par un administrateur.
// Les épreuves de /epreuves NE SONT PAS supprimées.
const admin = require('firebase-admin');
const { turso } = require('../db');

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : '';
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey
    })
  });
}

async function verifyAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED');
  const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
  
  // Vérification des droits administrateur dans Turso
  const userRes = await turso.execute({
    sql: "SELECT role FROM users WHERE uid = ?",
    args: [decoded.uid]
  });

  const user = userRes.rows[0];
  if (!user || user.role !== 'admin') throw new Error('ADMIN_REQUIRED');
  return decoded;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });

  try {
    const adminUser = await verifyAdmin(req.headers.authorization);
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId manquant.' });
    if (userId === adminUser.uid) return res.status(400).json({ error: 'Suppression de son propre compte interdite.' });

    // 1. Supprime le compte de Firebase Auth (les épreuves publiées sont conservées)
    await admin.auth().deleteUser(userId);

    // 2. Supprime l'utilisateur de la table `users` dans Turso
    await turso.execute({
      sql: "DELETE FROM users WHERE uid = ?",
      args: [userId]
    });

    // 3. Nettoyage optionnel des tables associées
    const tables = ['favorites', 'notifications', 'reports'];
    for (const table of tables) {
      try {
        await turso.execute({
          sql: `DELETE FROM ${table} WHERE user_id = ? OR userId = ?`,
          args: [userId, userId]
        });
      } catch (e) {
        // La table peut ne pas encore exister dans Turso
      }
    }

    return res.status(200).json({ ok: true, message: 'Utilisateur supprimé. Les épreuves publiées ont été conservées.' });
  } catch (err) {
    console.error('[ADMIN DELETE USER]', err);
    if (err.message === 'AUTH_REQUIRED' || err.code === 'auth/id-token-expired' || err.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    if (err.message === 'ADMIN_REQUIRED') return res.status(403).json({ error: 'Droits administrateur requis.' });
    if (err.code === 'auth/user-not-found') return res.status(404).json({ error: 'Utilisateur introuvable.' });
    return res.status(500).json({ error: 'Suppression impossible pour le moment.' });
  }
};
