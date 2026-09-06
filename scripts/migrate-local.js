import fs from 'fs';

if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

import { execute } from '../lib/db.js';

const pid = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'hosbac-6ae23';

async function run() {
  console.log("🚀 Début de la migration des épreuves vers Turso...");
  
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/epreuves?pageSize=300`);
  if (!res.ok) {
    throw new Error(`Erreur Firestore: ${res.status} ${res.statusText}`);
  }
  
  const data = await res.json();
  const docs = data.documents || [];
  console.log(`📦 ${docs.length} épreuves trouvées dans Firestore.`);
  
  let count = 0;
  for (const doc of docs) {
    const id = doc.name.split('/').pop();
    const f = doc.fields || {};
    
    const matiere = f.matiere?.stringValue || 'Général';
    const classe = f.classe?.stringValue || 'Tle';
    const serie = f.serie?.stringValue || '';
    const nom_epreuve = f.nom_epreuve?.stringValue || 'Épreuve';
    const annee = String(f.annee?.integerValue || f.annee?.stringValue || '');
    const status = f.status?.stringValue || 'approved';
    const auteur_nom = f.auteur_nom?.stringValue || 'Anonyme';
    const created_at = f.created_at?.timestampValue || f.created_at?.stringValue || new Date().toISOString();
    const fichier_sujet = f.fichier_sujet?.stringValue || '';
    const fichier_corrige = f.fichier_corrige?.stringValue || '';
    const download_count = Number(f.download_count?.integerValue || 0);

    await execute({
      sql: `INSERT INTO epreuves (id, matiere, classe, serie, nom_epreuve, annee, status, auteur_nom, created_at, fichier_sujet, fichier_corrige, download_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
            nom_epreuve=excluded.nom_epreuve,
            status=excluded.status,
            fichier_sujet=excluded.fichier_sujet,
            fichier_corrige=excluded.fichier_corrige,
            download_count=excluded.download_count`,
      args: [id, matiere, classe, serie, nom_epreuve, annee, status, auteur_nom, created_at, fichier_sujet, fichier_corrige, download_count]
    });
    count++;
  }

  console.log(`✅ Migration réussie ! ${count} épreuves insérées dans Turso.`);
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Erreur critique :", err);
  process.exit(1);
});
