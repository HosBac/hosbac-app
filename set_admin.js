import fs from 'fs';
import { createClient } from '@libsql/client';

// Chargement automatique des variables d'environnement (.env ou .env.local)
const envFile = fs.existsSync('.env.local') ? '.env.local' : (fs.existsSync('.env') ? '.env' : null);
if (envFile) {
  const content = fs.readFileSync(envFile, 'utf8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

const url = process.env.TURSO_DATABASE_URL || process.env.VITE_TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_AUTH_TOKEN;

if (!url) {
  console.error("❌ Fichier .env introuvable ou URL Turso manquante.");
  process.exit(1);
}

const db = createClient({ url, authToken });

async function main() {
  try {
    console.log("=== UTILISATEURS DANS TURSO ===");
    const res = await db.execute("SELECT * FROM users");
    console.log(res.rows);

    console.log("\n=== PASSAGE EN ADMIN DE mickaelpcs14@gmail.com ===");
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
    console.log("✅ SUCCÈS : mickaelpcs14@gmail.com est désormais Administrateur !");
  } catch (err) {
    console.error("❌ Erreur :", err.message);
  }
}

main();
