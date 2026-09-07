import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS epreuves (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        matiere TEXT,
        classe TEXT,
        serie TEXT,
        annee INTEGER,
        type TEXT,
        fileUrl TEXT,
        correctionUrl TEXT,
        status TEXT DEFAULT 'approved',
        downloadCount INTEGER DEFAULT 0,
        viewsCount INTEGER DEFAULT 0,
        userId TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (req.method === 'GET') {
      const { status, limit, sort, search, classe, matiere, serie } = req.query;

      let sql = 'SELECT * FROM epreuves WHERE 1=1';
      const args = [];

      if (status) {
        sql += ' AND status = ?';
        args.push(status);
      }
      if (classe) {
        sql += ' AND classe = ?';
        args.push(classe);
      }
      if (matiere) {
        sql += ' AND matiere = ?';
        args.push(matiere);
      }
      if (serie) {
        sql += ' AND serie = ?';
        args.push(serie);
      }
      if (search) {
        sql += ' AND (title LIKE ? OR description LIKE ?)';
        args.push(`%${search}%`, `%${search}%`);
      }

      if (sort === 'downloadCount') {
        sql += ' ORDER BY downloadCount DESC';
      } else {
        sql += ' ORDER BY createdAt DESC';
      }

      if (limit) {
        sql += ' LIMIT ?';
        args.push(parseInt(limit, 10));
      }

      const result = await executeQuery(sql, args);
      return res.status(200).json(result.rows || []);
    }

    if (req.method === 'POST') {
      const { id, title, description, matiere, classe, serie, annee, type, fileUrl, correctionUrl, userId } = req.body || {};
      const examId = id || 'exam_' + Date.now();

      await executeQuery(`
        INSERT INTO epreuves (id, title, description, matiere, classe, serie, annee, type, fileUrl, correctionUrl, userId, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')
      `, [examId, title || '', description || '', matiere || '', classe || '', serie || '', annee || 2026, type || 'Epreuve', fileUrl || '', correctionUrl || '', userId || '']);

      return res.status(200).json({ success: true, id: examId });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
