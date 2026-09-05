const { verifyAdminToken, buildAdminStats } = require('../lib/admin-stats');
const { turso } = require('../db');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await verifyAdminToken(req.headers.authorization);

    if (req.method === 'POST') {
      const result = await buildAdminStats();
      return res.status(200).json({ ok: true, data: result, refreshed: true });
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée.' });

    // Lecture des statistiques stockées dans Turso
    const result = await turso.execute({
      sql: "SELECT data FROM admin_stats WHERE id = ?",
      args: ['overview']
    });

    if (result.rows.length === 0) {
      return res.status(200).json({ ok: true, configured: false, data: null });
    }

    const row = result.rows[0];
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

    return res.status(200).json({ ok: true, configured: true, data });
  } catch (err) {
    console.error('[ADMIN STATS]', err);
    if (err.message === 'AUTH_REQUIRED' || err.code === 'auth/id-token-expired' || err.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    if (err.message === 'ADMIN_REQUIRED') return res.status(403).json({ error: 'Droits administrateur requis.' });
    if (err.message === 'FIREBASE_ENV_MISSING') return res.status(500).json({ error: 'Configuration Firebase serveur manquante.' });
    return res.status(500).json({ error: 'Impossible de charger les statistiques.' });
  }
};
