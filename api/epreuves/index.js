import { execute } from '../../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-UID, X-UID, X-Firebase-UID');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { limit } = req.query || {};
    let sql = 'SELECT * FROM epreuves';
    const args = [];

    sql += ' ORDER BY id DESC';

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
