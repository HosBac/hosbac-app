import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  try {
    const myEmail = "mickaelpcs14@gmail.com";

    await db.execute({
      sql: "DELETE FROM users WHERE email = ?",
      args: [myEmail]
    });

    await db.execute({
      sql: "INSERT INTO users (email, role, status, nom) VALUES (?, 'ADMIN', 'ACTIF', 'Admin')",
      args: [myEmail]
    });

    return res.status(200).json({ success: true, message: `Compte Admin unique restauré pour ${myEmail}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
