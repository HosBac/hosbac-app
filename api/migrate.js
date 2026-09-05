import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Remplace si besoin par ton Project ID Firebase exact s'il diffère
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hosbac-app';

async function fetchFirestoreCollection(collectionName) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}?pageSize=300`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return data.documents || [];
}

function parseFirestoreFields(fields) {
  const parsed = {};
  if (!fields) return parsed;
  for (const [key, value] of Object.entries(fields)) {
    if (value.stringValue !== undefined) parsed[key] = value.stringValue;
    else if (value.integerValue !== undefined) parsed[key] = parseInt(value.integerValue, 10);
    else if (value.doubleValue !== undefined) parsed[key] = parseFloat(value.doubleValue);
    else if (value.booleanValue !== undefined) parsed[key] = value.booleanValue ? 1 : 0;
    else if (value.timestampValue !== undefined) parsed[key] = value.timestampValue;
    else parsed[key] = null;
  }
  return parsed;
}

export default async function handler(req, res) {
  try {
    let migratedEpreuves = 0;
    let migratedUsers = 0;

    // 1. Migration des Épreuves
    const rawEpreuves = await fetchFirestoreCollection('epreuves');
    for (const doc of rawEpreuves) {
      const docId = doc.name.split('/').pop();
      const data = parseFirestoreFields(doc.fields);

      await db.execute({
        sql: `INSERT INTO epreuves (
          id, matiere, classe, serie, nom_epreuve, annee, departement, session, type,
          fichier_sujet, fichier_corrige, auteur_id, auteur_nom, status, download_count, view_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status=excluded.status,
          download_count=excluded.download_count,
          view_count=excluded.view_count`,
        args: [
          docId,
          data.matiere || data.subject || 'Matière',
          data.classe || 'Terminale',
          data.serie || '',
          data.nom_epreuve || data.title || 'Épreuve sans titre',
          String(data.annee || data.year || ''),
          data.departement || '',
          data.session || '',
          data.type || 'examen',
          data.fichier_sujet || data.subjectUrl || '',
          data.fichier_corrige || data.correctionUrl || '',
          data.auteur_id || data.authorId || null,
          data.auteur_nom || data.authorName || 'Anonyme',
          data.status || 'approved',
          data.download_count || data.downloads || 0,
          data.view_count || data.views || 0,
          data.created_at || new Date().toISOString()
        ]
      });
      migratedEpreuves++;
    }

    // 2. Migration des Utilisateurs
    const rawUsers = await fetchFirestoreCollection('users');
    for (const doc of rawUsers) {
      const uid = doc.name.split('/').pop();
      const data = parseFirestoreFields(doc.fields);

      await db.execute({
        sql: `INSERT INTO users (
          uid, email, nom, prenom, ecole, region, classe, serie, role, status, points, total_xp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET
          role=excluded.role,
          points=excluded.points,
          total_xp=excluded.total_xp`,
        args: [
          uid,
          data.email || '',
          data.nom || data.lastName || '',
          data.prenom || data.firstName || '',
          data.ecole || data.school || '',
          data.region || '',
          data.classe || '',
          data.serie || '',
          data.role || 'student',
          data.status || 'active',
          data.points || 0,
          data.total_xp || data.xp || 0,
          data.created_at || new Date().toISOString()
        ]
      });
      migratedUsers++;
    }

    return res.status(200).json({
      success: true,
      message: 'Migration terminée avec succès !',
      stats: {
        epreuves: migratedEpreuves,
        users: migratedUsers
      }
    });
  } catch (error) {
    console.error('Erreur migration:', error);
    return res.status(500).json({ error: error.message });
  }
}
