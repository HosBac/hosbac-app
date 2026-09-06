import { execute } from './lib/db.js';
import { setCors, handleOptions, bodyObject, jsonError } from './lib/http.js';
import { getFirebaseAdmin } from './lib/firebase-admin.js';
import { verifyAdmin } from './lib/admin-auth.js';

export default async function handler(req, res) {
  setCors(res, 'DELETE, POST, OPTIONS');
  if (handleOptions(req, res)) return;
  if (!['DELETE','POST'].includes(req.method)) return jsonError(res, 405, 'Méthode non autorisée');

  try {
    await verifyAdmin(req);
    const body = bodyObject(req);
    const uid = String(req.query?.uid || req.query?.userId || req.query?.user_id || body.uid || body.userId || body.user_id || '').trim();
    if (!uid) return jsonError(res, 400, 'UID requis');

    // Supprimer les favoris avant l'utilisateur pour rester compatible avec une éventuelle FK.
    await execute({ sql: 'DELETE FROM favorites WHERE user_id = ?', args: [uid] });
    await execute({ sql: 'DELETE FROM users WHERE uid = ?', args: [uid] });

    try {
      await getFirebaseAdmin().auth().deleteUser(uid);
    } catch (firebaseError) {
      if (firebaseError?.code !== 'auth/user-not-found') throw firebaseError;
    }

    return res.status(200).json({ success: true, message: 'Utilisateur supprimé' });
  } catch (error) {
    console.error('[API admin-delete-user]', error);
    const status = ['AUTH_REQUIRED','ADMIN_REQUIRED'].includes(error?.code) ? 401 : error?.message === 'UID requis' ? 400 : 500;
    return jsonError(res, status, error?.message || 'Erreur serveur');
  }
}
