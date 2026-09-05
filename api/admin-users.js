import { execute } from '../../lib/db.js';

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
    const result = await execute('SELECT * FROM users ORDER BY created_at DESC');

    const formattedRows = (result.rows || []).map(row => ({
      ...row,
      classe: row.classe || row.class || '-',
      ecole: row.ecole || row.school || '-',
      createdAt: row.created_at || row.createdAt || '-'
    }));

    return res.status(200).json(formattedRows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
