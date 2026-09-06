import { execute } from './lib/db.js';
import { setCors, handleOptions, jsonError } from './lib/http.js';
import { verifyAdmin } from './lib/admin-auth.js';

export default async function handler(req, res) {
  setCors(res, 'GET, OPTIONS');
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return jsonError(res, 405, 'Méthode non autorisée');

  try {
    await verifyAdmin(req);
    const [users, epreuves, downloads] = await Promise.all([
      execute('SELECT COUNT(*) AS count FROM users'),
      execute('SELECT COUNT(*) AS count FROM epreuves'),
      execute('SELECT COALESCE(SUM(download_count), 0) AS total FROM epreuves')
    ]);
    return res.status(200).json({
      success: true,
      totalUsers: Number(users.rows?.[0]?.count || 0),
      totalEpreuves: Number(epreuves.rows?.[0]?.count || 0),
      totalDownloads: Number(downloads.rows?.[0]?.total || 0),
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API admin-stats]', error);
    const status = ['AUTH_REQUIRED','ADMIN_REQUIRED'].includes(error?.code) ? 401 : 500;
    return jsonError(res, status, error?.message || 'Erreur serveur');
  }
}
