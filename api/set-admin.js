import { db } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    await db.execute("UPDATE users SET role = 'admin', is_admin = 1 WHERE email IN ('mickaelpcs14@gmail.com', 'mickelpcs14@gmail.com')");
    const usersRes = await db.execute("SELECT email, role, nom, prenom FROM users");
    return res.status(200).json({ success: true, users: usersRes.rows });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
