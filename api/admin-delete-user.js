import { executeQuery } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { userId, uid, email } = req.body || {};
    // On récupère n'importe quel identifiant valide transmis par le front
    const target = userId || uid || email;

    if (!target) {
      return res.status(400).json({ error: 'Aucun identifiant fourni pour la suppression' });
    }

    console.log("Suppression demandée pour la cible :", target);

    // Suppression stricte dans la table users de Turso
    const result = await executeQuery(
      'DELETE FROM users WHERE uid = ? OR email = ?',
      [target, target]
    );

    console.log("Lignes supprimées dans Turso :", result);

    return res.status(200).json({ success: true, message: 'Utilisateur supprimé de la base de données' });
  } catch (err) {
    console.error("Erreur lors de la suppression:", err);
    return res.status(500).json({ error: err.message });
  }
}
