// HosBac - suppression complète d'un compte utilisateur par un administrateur.
// Les épreuves de /epreuves NE SONT PAS supprimées.
const admin = require('firebase-admin');
const { turso } = require('../db');

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : '';
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
      throw new Error('FIREBASE_ENV_MISSING');
    }
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey
      })
    });
  }
  return admin;
}

async function verifyAdmin(authHeader) {
  const sdk = getFirebaseAdmin();
  if (!authHeader?.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED');
  const decoded = await sdk.auth().verifyIdToken(authHeader.slice(7));
  
  // 1. Détection si l'utilisateur est admin via claim Firebase
  if (decoded.admin === true) {
    return decoded;
  }

  // 2. Sinon vérification dans la base Turso (champs uid ou id)
  const userRes = await turso.execute({
    sql: "SELECT role FROM users WHERE uid = ? OR id = ?",
    args: [decoded.uid, decoded.uid]
  });

  const user = userRes.rows[0];
  if (!user || String(user.role).toLowerCase() !== 'admin') {
    throw new Error('ADMIN_REQUIRED');
  }
  return decoded;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });

  try {
    const sdk = getFirebaseAdmin();
    const adminUser = await verifyAdmin(req.headers.authorization);

    // Récupération de l'ID via userId ou uid
    const userId = String(req.body?.userId || req.body?.uid || '').trim();
    if (!userId) return res.status(400).json({ error: 'ID utilisateur manquant (userId ou uid).' });
    if (userId === adminUser.uid) return res.status(400).json({ error: 'Suppression de son propre compte interdite.' });

    // 1. Supprime de Firebase Auth (tolérant si déjà supprimé)
    try {
      await sdk.auth().deleteUser(userId);
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') {
        throw authErr;
      }
      console.warn(`[ADMIN DELETE] L'utilisateur ${userId} n'existait plus dans Firebase Auth.`);
    }

    // 2. Supprime l'utilisateur de Turso SQL (compatible uid ou id)
    await turso.execute({
      sql: "DELETE FROM users WHERE uid = ? OR id = ?",
      args: [userId, userId]
    });

    // 3. Nettoyage des données secondaires
    const tables = ['favorites', 'notifications', 'reports'];
    for (const table of tables) {
      try {
        await turso.execute({
          sql: `DELETE FROM ${table} WHERE user_id = ? OR userId = ?`,
          args: [userId, userId]
        });
      } catch (e) {
        // La table peut ne pas encore exister
      }
    }

    return res.status(200).json({ ok: true, message: 'Utilisateur supprimé avec succès.' });
  } catch (err) {
    console.error('[ADMIN DELETE USER]', err);
    if (err.message === 'AUTH_REQUIRED' || err.code === 'auth/id-token-expired' || err.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    if (err.message === 'ADMIN_REQUIRED') return res.status(403).json({ error: 'Droits administrateur requis.' });
    if (err.message === 'FIREBASE_ENV_MISSING') return res.status(500).json({ error: 'Configuration Firebase serveur manquante.' });
    return res.status(500).json({ error: 'Suppression impossible pour le moment.' });
  }
};
