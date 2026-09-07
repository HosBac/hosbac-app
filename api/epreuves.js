import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // On récupère toutes les épreuves de la table
    const result = await executeQuery('SELECT * FROM epreuves');
    console.log("Contenu brut de la table epreuves dans Turso :", JSON.stringify(result.rows || []));
    
    return res.status(200).json(result.rows || []);
  } catch (err) {
    console.error("Erreur API epreuves:", err);
    // Essayons de lister les tables au cas où la table s'appelle "exams" ou autre
    try {
      const tables = await executeQuery("SELECT name FROM sqlite_master WHERE type='table'");
      console.log("Tables disponibles dans la base Turso :", JSON.stringify(tables.rows));
    } catch (e) {}
    
    return res.status(500).json({ error: err.message });
  }
}
