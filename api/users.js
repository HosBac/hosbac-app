import userProfile from './user-profile.js';
import { execute } from './lib/db.js';
import { setCors, handleOptions, jsonError } from './lib/http.js';
import { verifyAdmin } from './lib/admin-auth.js';

export default async function handler(req, res) {
  setCors(res, 'GET, POST, PATCH, PUT, OPTIONS');
  if (handleOptions(req, res)) return;

  // /api/users without an explicit UID is the admin listing route.
  const q = req.query || {};
  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const uid = String(q.uid || q.userId || q.user_id || body.uid || body.userId || body.user_id || '').trim();

  if (uid) return userProfile(req, res);
  if (req.method !== 'GET') return jsonError(res, 400, 'Identifiant UID requis');

  try {
    await verifyAdmin(req);
    const result = await execute({
      sql: `SELECT uid, nom, prenom, email, classe, serie, region, role, totalXp, quiz_xp, examsUploaded, examsDownloaded, badges, status, created_at
            FROM users ORDER BY created_at DESC`
    });
    return res.status(200).json({ success: true, users: result.rows || [] });
  } catch (error) {
    console.error('[API users]', error);
    const status = ['AUTH_REQUIRED','ADMIN_REQUIRED'].includes(error?.code) ? 401 : 500;
    return jsonError(res, status, error?.message || 'Erreur serveur');
  }
}
