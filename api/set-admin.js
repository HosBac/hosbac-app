import { db } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Liste des utilisateurs actuels dans Turso
    const usersRes = await db.execute("SELECT * FROM users");
    const users = usersRes.rows || [];

    // Passage du compte mickaelpcs14@gmail.com en admin
    try {
      await db.execute({
        sql: "UPDATE users SET role = 'admin', is_admin = 1 WHERE email = 'mickaelpcs14@gmail.com'",
        args: []
      });
    } catch {
      await db.execute({
        sql: "UPDATE users SET role = 'admin' WHERE email = 'mickaelpcs14@gmail.com'",
        args: []
      });
    }

    return res.status(200).json({
      success: true,
      message: "Succès : mickaelpcs14@gmail.com est désormais Administrateur !",
      nombre_utilisateurs: users.length,
      utilisateurs: users
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
