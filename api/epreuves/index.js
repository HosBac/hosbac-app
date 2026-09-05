import { execute } from '../_db.js';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { status, limit } = req.query || {};
    let sql = 'SELECT * FROM epreuves';
    const args = [];

    if (status) {
      sql += ' WHERE status = ?';
      args.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    if (limit) {
      sql += ' LIMIT ?';
      args.push(parseInt(limit, 10));
    }

    const result = await execute({ sql, args });

    const formattedRows = (result.rows || []).map(row => ({
      ...row,
      title: row.nom_epreuve || row.title || row.nom || 'Épreuve sans titre',
      nom: row.nom_epreuve || row.title || row.nom || 'Épreuve sans titre',
      nom_epreuve: row.nom_epreuve || row.title || row.nom || 'Épreuve sans titre',
      authorName: row.auteur_nom || row.authorName || 'Anonyme',
      auteur: row.auteur_nom || row.authorName || 'Anonyme',
      status: row.status || 'approved',
      downloadCount: row.download_count || 0,
      viewCount: row.view_count || 0,
      date: row.created_at || row.createdAt || '-',
      createdAt: row.created_at || row.createdAt || '-'
    }));

    return res.status(200).json(formattedRows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
