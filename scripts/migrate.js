import { execute } from '../lib/db.js';
const createClient = () => ({
  execute: (stmt) => typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }),
  batch: async (stmts) => {
    for (const stmt of stmts) {
      await (typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }));
    }
  }
});
const db = createClient();

  execute: (stmt) => typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }),
  batch: async (stmts) => {
    for (const stmt of stmts) {
      await (typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }));
    }
  }
});


  execute: (stmt) => typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }),
  batch: async (stmts) => {
    for (const stmt of stmts) {
      await (typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }));
    }
  }
});


  execute: (stmt) => typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }),
  batch: async (stmts) => {
    for (const stmt of stmts) {
      await (typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }));
    }
  }
});


  execute: (stmt) => typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }),
  batch: async (stmts) => {
    for (const stmt of stmts) {
      await (typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }));
    }
  }
});


  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'hosbac-app';

async function fetchFirestoreCollection(collectionName) {
  try {
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}?pageSize=300`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.documents || [];
  } catch (e) {
    return [];
  }
}

function parseFields(fields) {
  const parsed = {};
  if (!fields) return parsed;
  for (const [key, value] of Object.entries(fields)) {
    if (value.stringValue !== undefined) parsed[key] = value.stringValue;
    else if (value.integerValue !== undefined) parsed[key] = parseInt(value.integerValue, 10);
    else if (value.doubleValue !== undefined) parsed[key] = parseFloat(value.doubleValue);
    else if (value.booleanValue !== undefined) parsed[key] = value.booleanValue ? 1 : 0;
  }
  return parsed;
}

export default async function handler(req, res) {
  try {
    const rawEpreuves = await fetchFirestoreCollection('epreuves');
    for (const doc of rawEpreuves) {
      const id = doc.name.split('/').pop();
      const d = parseFields(doc.fields);
      await execute({
        sql: `INSERT INTO epreuves (id, matiere, classe, serie, nom_epreuve, annee, status, auteur_nom, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                nom_epreuve=excluded.nom_epreuve,
                status=excluded.status,
                auteur_nom=excluded.auteur_nom`,
        args: [
          id,
          d.matiere || d.subject || 'Général',
          d.classe || d.class || 'Tle',
          d.serie || '',
          d.nom_epreuve || d.title || d.nom || d.name || 'Épreuve',
          String(d.annee || d.year || ''),
          d.status || 'approved',
          d.auteur_nom || d.authorName || d.author || 'Anonyme',
          d.created_at || new Date().toISOString()
        ]
      });
    }

    const rawUsers = await fetchFirestoreCollection('users');
    for (const doc of rawUsers) {
      const uid = doc.name.split('/').pop();
      const d = parseFields(doc.fields);
      await execute({
        sql: `INSERT INTO users (uid, email, nom, prenom, ecole, classe, role, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(uid) DO UPDATE SET
                classe=excluded.classe,
                ecole=excluded.ecole`,
        args: [
          uid,
          d.email || '',
          d.nom || d.lastName || '',
          d.prenom || d.firstName || '',
          d.ecole || d.school || '',
          d.classe || d.class || '',
          d.role || 'student',
          d.status || 'active'
        ]
      });
    }

    return res.status(200).json({ success: true, message: 'Migration mise à jour !' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
