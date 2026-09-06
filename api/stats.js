import { execute } from './lib/db.js';
import { setCors, handleOptions } from './lib/http.js';

export default async function handler(req, res) {
  setCors(res, 'GET, OPTIONS');
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const [epreuvesRes, usersRes, downloadsRes] = await Promise.all([
      execute('SELECT COUNT(*) AS count FROM epreuves'),
      execute('SELECT COUNT(*) AS count FROM users'),
      execute('SELECT COALESCE(SUM(download_count), 0) AS total FROM epreuves')
    ]);
    return res.status(200).json({
      totalEpreuves: Number(epreuvesRes.rows?.[0]?.count || 0),
      totalUsers: Number(usersRes.rows?.[0]?.count || 0),
      totalDownloads: Number(downloadsRes.rows?.[0]?.total || 0)
    });
  } catch (error) {
    console.error('[API stats]', error);
    return res.status(500).json({ success: false, error: error?.message || 'Erreur serveur' });
  }
}
