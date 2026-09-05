import { execute } from '../lib/db.js';

const db = {
  execute: (stmt) => typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }),
  batch: async (stmts) => {
    for (const stmt of stmts) {
      await (typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }));
    }
  }
};

// HosBac - suppression complète d'un compte utilisateur (Turso SQL + Firebase Auth)

import {  turso  } from '../lib/db.js';

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
  
  if (decoded.admin === true) {
    return decoded;
  }

  // Vérification administrative uniquement dans Turso SQL
  const userRes = await turso.execute({
    sql: "SELECT role FROM users WHERE uid = ?",
    args: [decoded.uid]
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

    const userId = String(req.body?.userId || req.body?.uid || '').trim();
    if (!userId) return res.status(400).json({ error: 'ID utilisateur manquant.' });
    if (userId === adminUser.uid) return res.status(400).json({ error: 'Suppression de son propre compte interdite.' });

    // 1. Suppression Firebase Auth (Révocation du login)
    try {
      await sdk.auth().deleteUser(userId);
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') {
        console.warn('[ADMIN DELETE] Auth warning:', authErr.message);
      }
    }

    // 2. Suppression définitive dans la table Turso SQL `users`
    await turso.execute({
      sql: "DELETE FROM users WHERE uid = ?",
      args: [userId]
    });

    // 3. Nettoyage des données liées dans Turso SQL
    const tables = ['favorites', 'notifications', 'reports'];
    for (const table of tables) {
      try {
        await turso.execute({
          sql: `DELETE FROM ${table} WHERE user_id = ? OR userId = ?`,
          args: [userId, userId]
        });
      } catch (e) {
        // Table secondaire potentiellement absente
      }
    }

    return res.status(200).json({ ok: true, message: 'Utilisateur supprimé définitivement de Turso.' });
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