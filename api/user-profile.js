import { executeQuery } from './_db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'POST' || req.method === 'PATCH') {
            const bodyData = req.body || {};
            const source = bodyData.data || bodyData.updates || bodyData;

            const uid = bodyData.uid || bodyData.userId || source.uid || source.userId || bodyData.email || source.email;
            const email = bodyData.email || source.email || '';
            const nom = bodyData.nom || source.nom || '';
            const prenom = bodyData.prenom || source.prenom || '';
            const ecole = bodyData.ecole || source.ecole || '';
            const region = bodyData.region || source.region || '';
            const classe = bodyData.classe || source.classe || '';
            const serie = bodyData.serie || source.serie || '';

            if (!uid && !email) {
                return res.status(400).json({ error: 'UID ou Email requis' });
            }

            const primaryKey = uid || email;

            await executeQuery(`
                INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, role, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'student', 'active')
                ON CONFLICT(uid) DO UPDATE SET
                    email = EXCLUDED.email,
                    nom = EXCLUDED.nom,
                    prenom = EXCLUDED.prenom,
                    ecole = EXCLUDED.ecole,
                    region = EXCLUDED.region,
                    classe = EXCLUDED.classe,
                    serie = EXCLUDED.serie
            `, [primaryKey, email, nom, prenom, ecole, region, classe, serie]);

            return res.status(200).json({ success: true, message: 'Profil enregistré avec succès' });
        }

        if (req.method === 'GET') {
            const email = req.query.email || '';
            const uid = req.query.uid || req.query.userId || req.query.id || '';

            if (!email && !uid) return res.status(400).json({ error: 'Email ou UID requis' });

            const result = await executeQuery('SELECT * FROM users WHERE uid = ? OR email = ? OR uid = ?', [uid, email, email]);
            let user = result.rows && result.rows.length > 0 ? result.rows[0] : null;

            if (user) {
                try { user.favorites = JSON.parse(user.favorites_json || '[]'); } catch (e) { user.favorites = []; }
            } else {
                user = { uid: uid || email, email: email, nom: '', prenom: '', ecole: '', region: '', classe: '', serie: '', favorites: [], role: 'student', status: 'active' };
            }
            return res.status(200).json(user);
        }
        return res.status(405).json({ error: 'Méthode non autorisée' });
    } catch (err) {
        console.error("Erreur API:", err);
        return res.status(500).json({ error: err.message });
    }
}
