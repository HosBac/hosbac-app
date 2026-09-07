import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await executeQuery('CREATE TABLE IF NOT EXISTS legal_texts (key TEXT PRIMARY KEY, content TEXT)');

    if (req.method === 'GET') {
      const result = await executeQuery('SELECT * FROM legal_texts');
      const data = {};
      (result.rows || []).forEach(row => {
        data[row.key] = row.content;
      });
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { cgu, privacy, about, faq } = req.body || {};
      const items = [
        { key: 'cgu', val: cgu },
        { key: 'privacy', val: privacy },
        { key: 'about', val: about },
        { key: 'faq', val: faq }
      ];

      for (const item of items) {
        if (item.val !== undefined) {
          const contentStr = typeof item.val === 'object' ? JSON.stringify(item.val) : String(item.val);
          await executeQuery(
            'INSERT INTO legal_texts (key, content) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET content = excluded.content',
            [item.key, contentStr]
          );
        }
      }

      return res.status(200).json({ success: true, message: 'Pages légales enregistrées' });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
