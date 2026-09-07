import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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

    const { id, action } = req.query;

    if (req.method === 'GET') {
      if (id) {
        const result = await executeQuery('SELECT * FROM epreuves WHERE id = ?', [id]);
        if (result.rows && result.rows.length > 0) return res.status(200).json(result.rows[0]);
        return res.status(404).json({ error: 'Épreuve introuvable' });
      }

      const result = await executeQuery('SELECT * FROM epreuves ORDER BY createdAt DESC');
      return res.status(200).json(result.rows || []);
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      const examId = id || req.body?.id;
      if (!examId) return res.status(400).json({ error: 'ID épreuve requis' });

      const type = action || req.body?.action;
      if (type === 'incrementDownload' || type === 'download') {
        await executeQuery('UPDATE epreuves SET downloadCount = downloadCount + 1 WHERE id = ?', [examId]);
      } else {
        await executeQuery('UPDATE epreuves SET viewsCount = viewsCount + 1 WHERE id = ?', [examId]);
      }
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST') {
      const { id: bodyId, title, description, matiere, classe, serie, annee, type, fileUrl, correctionUrl, userId } = req.body || {};
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
      `, [examId, title || '', description || '', matiere || '', classe || '', serie || '', annee || 2026, type || 'Epreuve', fileUrl || '', correctionUrl || '', userId || '']);

      return res.status(200).json({ success: true, id: examId });
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID requis' });
      await executeQuery('DELETE FROM epreuves WHERE id = ?', [id]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
