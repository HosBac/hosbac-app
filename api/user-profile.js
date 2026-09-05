import { execute } from '../lib/db.js';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { uid } = req.query;

  if (!uid) {
    return res.status(400).json({ error: 'Identifiant UID requis' });
  }

  try {
    if (req.method === 'GET') {
      const result = await execute({
        sql: 'SELECT * FROM users WHERE uid = ? LIMIT 1',
        args: [uid],
      });

      const user = result.rows[0] || null;
      return res.status(200).json(user);
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (error) {
    console.error('Erreur API /api/user-profile:', error);
    return res.status(500).json({ error: error.message });
  }
}
