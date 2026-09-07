import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const usersCount = await executeQuery('SELECT COUNT(*) as count FROM users');
    const epreuvesCount = await executeQuery('SELECT COUNT(*) as count FROM epreuves');
    const statsSum = await executeQuery('SELECT SUM(downloadCount) as totalDownloads, SUM(viewsCount) as totalViews FROM epreuves');
    const pendingCount = await executeQuery("SELECT COUNT(*) as count FROM epreuves WHERE status = 'pending'");

    return res.status(200).json({
      users: usersCount.rows?.[0]?.count || 0,
      epreuves: epreuvesCount.rows?.[0]?.count || 0,
      downloads: statsSum.rows?.[0]?.totalDownloads || 0,
      views: statsSum.rows?.[0]?.totalViews || 0,
      pending: pendingCount.rows?.[0]?.count || 0,
      reports: 0
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
