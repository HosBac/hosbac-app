import { db } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const result = await db.execute("SELECT * FROM users");
    return res.status(200).json(result.rows || []);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
