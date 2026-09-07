import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const usersCount = await db.execute("SELECT COUNT(*) as total FROM users");
    const examsCount = await db.execute("SELECT COUNT(*) as total FROM epreuves");

    return res.status(200).json({
      totalUsers: usersCount.rows[0]?.total || 0,
      totalExams: examsCount.rows[0]?.total || 0,
      activeToday: 1
    });
  } catch (err) {
    return res.status(200).json({
      totalUsers: 0,
      totalExams: 0,
      activeToday: 0
    });
  }
}
