import { execute } from '../lib/db.js';

const db = {
  execute: (stmt) => typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }),
  batch: async (stmts) => {
    for (const stmt of stmts) {
      await (typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }));
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const epreuvesRes = await execute('SELECT COUNT(*) as count FROM epreuves');
    const usersRes = await execute('SELECT COUNT(*) as count FROM users');
    const downloadsRes = await execute('SELECT SUM(download_count) as total FROM epreuves');

    return res.status(200).json({
      totalEpreuves: Number(epreuvesRes.rows[0]?.count || 0),
      totalUsers: Number(usersRes.rows[0]?.count || 0),
      totalDownloads: Number(downloadsRes.rows[0]?.total || 0),
    });
  } catch (error) {
    console.error('Erreur API /api/stats:', error);
    // Retourne un objet vide/par défaut pour éviter de bloquer l'UI si les tables sont vides
    return res.status(200).json({ totalEpreuves: 0, totalUsers: 0, totalDownloads: 0 });
  }
}