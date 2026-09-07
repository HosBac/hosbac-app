import { db } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const epreuvesRes = await db.execute("SELECT COUNT(*) as count FROM epreuves");
    const usersRes = await db.execute("SELECT COUNT(*) as count FROM users");

    return res.status(200).json({
      epreuves: epreuvesRes.rows[0]?.count || 0,
      users: usersRes.rows[0]?.count || 0
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
