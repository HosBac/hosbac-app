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
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-UID, X-UID, X-Firebase-UID');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  try {
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = req.body || {};
      if (body.status) {
        await execute({ sql: 'UPDATE epreuves SET status = ? WHERE id = ?', args: [body.status, id] });
      } else {
        await execute({ sql: 'UPDATE epreuves SET view_count = view_count + 1 WHERE id = ?', args: [id] });
      }
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      await execute({ sql: 'DELETE FROM epreuves WHERE id = ?', args: [id] });
      return res.status(200).json({ success: true });
    }

    const result = await execute({ sql: 'SELECT * FROM epreuves WHERE id = ? LIMIT 1', args: [id] });
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Épreuve non trouvée' });
    }

    const row = result.rows[0];
    return res.status(200).json({
      ...row,
      title: row.nom_epreuve || row.title || row.nom || 'Épreuve sans titre',
      authorName: row.auteur_nom || row.authorName || 'Anonyme',
      createdAt: row.created_at || row.createdAt || '-'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}