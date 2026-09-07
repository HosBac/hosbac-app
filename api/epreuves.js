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

    const { id, status, limit, sort, search, classe, matiere, serie } = req.query;

    if (req.method === 'GET') {
      // Si un ID spécifique est demandé (ex: /api/epreuves/0FKg1X...)
      if (id) {
        const result = await executeQuery('SELECT * FROM epreuves WHERE id = ?', [id]);
        if (result.rows && result.rows.length > 0) {
          return res.status(200).json(result.rows[0]);
        }
        return res.status(404).json({ error: 'Épreuve introuvable' });
      }

      // Requête de liste avec filtres
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
      const { id: bodyId, title, description, matiere, classe: c, serie: s, annee, type, fileUrl, correctionUrl, userId } = req.body || {};
      const examId = bodyId || 'exam_' + Date.now();

      await executeQuery(`
        INSERT INTO epreuves (id, title, description, matiere, classe, serie, annee, type, fileUrl, correctionUrl, userId, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          matiere = excluded.matiere,
          classe = excluded.classe,
          serie = excluded.serie,
          annee = excluded.annee,
          fileUrl = excluded.fileUrl,
          correctionUrl = excluded.correctionUrl
      `, [examId, title || '', description || '', matiere || '', c || '', s || '', annee || 2026, type || 'Epreuve', fileUrl || '', correctionUrl || '', userId || '']);

      return res.status(200).json({ success: true, id: examId });
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID requis' });
      await executeQuery('DELETE FROM epreuves WHERE id = ?', [id]);
      return res.status(200).json({ success: true, message: 'Épreuve supprimée' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
