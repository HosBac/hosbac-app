import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  // Gestion CORS de base
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
    const { status, sort, order, limit } = req.query;

    let sql = 'SELECT * FROM epreuves';
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    // Sécurisation du tri (évite l'injection SQL)
    const allowedSorts = {
      createdAt: 'created_at',
      downloadCount: 'download_count',
      title: 'title',
      created_at: 'created_at',
      download_count: 'download_count'
    };
    
    const sortColumn = allowedSorts[sort] || 'created_at';
    const sortOrder = (order && order.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    sql += ` ORDER BY ${sortColumn} ${sortOrder}`;

    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit, 10));
    }

    const result = await db.execute({ sql, args: params });

    // Renvoie le tableau d'épreuves (ou tableau vide si aucun résultat)
    return res.status(200).json(result.rows || []);
  } catch (error) {
    console.error('Erreur API /api/epreuves:', error);
    return res.status(500).json({ error: error.message });
  }
}
