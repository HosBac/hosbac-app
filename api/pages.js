import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS pages_legales (
        slug TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (req.method === 'GET') {
      const { slug } = req.query;
      if (slug) {
        const result = await executeQuery('SELECT * FROM pages_legales WHERE slug = ?', [slug]);
        return res.status(200).json(result.rows?.[0] || { slug, title: '', content: '' });
      }
      const result = await executeQuery('SELECT * FROM pages_legales');
      return res.status(200).json(result.rows || []);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const { slug, title, content } = req.body || {};
      if (!slug) return res.status(400).json({ error: 'Slug requis' });

      await executeQuery(`
        INSERT INTO pages_legales (slug, title, content, updatedAt)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(slug) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          updatedAt = CURRENT_TIMESTAMP
      `, [slug, title || '', content || '']);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
