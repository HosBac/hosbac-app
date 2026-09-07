import { db } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const result = await db.execute("SELECT * FROM epreuves");
    const rows = result.rows || [];

    const formattedRows = rows.map(row => ({
      ...row,
      title: row.nom_epreuve || row.title || row.nom || 'Épreuve sans titre',
      nom: row.nom_epreuve || row.title || row.nom || 'Épreuve sans titre',
      nom_epreuve: row.nom_epreuve || row.title || row.nom || 'Épreuve sans titre',
      authorName: row.auteur_nom || row.authorName || 'Anonyme',
      status: row.status || 'approved',
      downloadCount: row.download_count || row.downloads || 0,
      viewCount: row.view_count || row.views || 0,
      date: row.created_at || row.createdAt || '-'
    }));

    return res.status(200).json(formattedRows);
  } catch (error) {
    return res.status(500).json({ 
      error: "Erreur lors de la récupération des épreuves", 
      details: error.message 
    });
  }
}
