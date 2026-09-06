import { execute } from './db.js';

export async function buildAdminStats() {
  const [users, epreuves, downloads] = await Promise.all([
    execute('SELECT COUNT(*) AS count FROM users'),
    execute('SELECT COUNT(*) AS count FROM epreuves'),
    execute('SELECT COALESCE(SUM(download_count), 0) AS total FROM epreuves')
  ]);
  return {
    totalUsers: Number(users.rows?.[0]?.count || 0),
    totalEpreuves: Number(epreuves.rows?.[0]?.count || 0),
    totalDownloads: Number(downloads.rows?.[0]?.total || 0),
    generatedAt: new Date().toISOString()
  };
}
