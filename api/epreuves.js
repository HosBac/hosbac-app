import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const result = await db.execute('SELECT * FROM epreuves ORDER BY created_at DESC');
    
    // Normalisation des clés pour rendre le JSON compatible avec tous les scripts du HTML
    const formattedRows = (result.rows || []).map(row => ({
      ...row,
      title: row.nom_epreuve || row.title || row.nom || 'Épreuve sans titre',
      nom: row.nom_epreuve || row.title || row.nom || 'Épreuve sans titre',
      nom_epreuve: row.nom_epreuve || row.title || row.nom || 'Épreuve sans titre',
      authorName: row.auteur_nom || row.authorName || 'Anonyme',
      auteur: row.auteur_nom || row.authorName || 'Anonyme',
      status: row.status || 'approved',
      date: row.created_at || row.createdAt || '-',
      createdAt: row.created_at || row.createdAt || '-'
    }));

    return res.status(200).json(formattedRows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
