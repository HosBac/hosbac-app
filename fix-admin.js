import fs from 'fs';
import { createClient } from '@libsql/client/web';

let url = process.env.TURSO_DATABASE_URL;
let token = process.env.TURSO_AUTH_TOKEN;

// Chercher dans tous les fichiers commençant par .env
const envFiles = fs.readdirSync('.').filter(f => f.startsWith('.env'));

for (const file of envFiles) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    content.split('\n').forEach(line => {
      const idx = line.indexOf('=');
      if (idx !== -1) {
        const key = line.substring(0, idx).trim();
        const val = line.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (key.includes('TURSO') && key.includes('URL')) url = val;
        if (key.includes('TURSO') && key.includes('TOKEN')) token = val;
        if (key === 'DATABASE_URL' && !url) url = val;
        if (key === 'DATABASE_AUTH_TOKEN' && !token) token = val;
      }
    });
  } catch (e) {}
}

console.log("Fichiers .env détectés :", envFiles.join(', ') || "Aucun");
console.log("URL Turso trouvée :", url ? "OUI" : "NON");
console.log("Token Turso trouvé :", token ? "OUI" : "NON");

if (!url || !token) {
  console.error("ERREUR : Impossible de trouver l'URL ou le Token Turso dans vos fichiers .env.");
  process.exit(1);
}

const db = createClient({ url, authToken: token });
const myEmail = "mickaelpcs14@gmail.com";

async function restoreAndClean() {
  await db.execute({
    sql: "DELETE FROM users WHERE email = ?",
    args: [myEmail]
  });

  await db.execute({
    sql: "INSERT INTO users (email, role, status, nom) VALUES (?, 'ADMIN', 'ACTIF', 'Admin')",
    args: [myEmail]
  });

  console.log("SUCCÈS : Compte Admin unique restauré pour " + myEmail);
  if (fs.existsSync('fix-admin.js')) fs.unlinkSync('fix-admin.js');
}

restoreAndClean().catch(console.error);
