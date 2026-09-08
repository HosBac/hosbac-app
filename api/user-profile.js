import { executeQuery } from './_db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const ADMIN_EMAIL = 'mickaelpcs14@gmail.com';

    try {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch(e) { body = {}; }
        }
        const data = body.data || body.updates || body;

        const email = String(body.email || data.email || '').trim().toLowerCase();
        const uid = String(body.uid || body.userId || data.uid || data.userId || '').trim();

        if (req.method === 'POST' || req.method === 'PATCH') {
            if (!email && !uid) {
                return res.status(400).json({ success: false, error: 'Email ou UID requis' });
            }

            const nom = String(data.nom || body.nom || '').trim();
            const prenom = String(data.prenom || body.prenom || '').trim();
            const ecole = String(data.ecole || body.ecole || '').trim();
            const region = String(data.region || body.region || '').trim();
            const classe = String(data.classe || body.classe || '').trim();
            const serie = String(data.serie || body.serie || '').trim();

            let favoritesStr = '[]';
            const favs = data.favorites || body.favorites;
            if (Array.isArray(favs)) favoritesStr = JSON.stringify(favs);
            else if (typeof favs === 'string' && favs) favoritesStr = favs;

            const role = (email === ADMIN_EMAIL) ? 'admin' : 'user';

            const check = await executeQuery(
                `SELECT rowid, * FROM users WHERE (email IS NOT NULL AND email != "" AND lower(email) = ?) OR (uid IS NOT NULL AND uid != "" AND uid = ?)`,
                [email, uid]
            );

            if (check.rows && check.rows.length > 0) {
                const targetRowid = check.rows[0].rowid;
                await executeQuery(
                    `UPDATE users SET email = ?, nom = ?, prenom = ?, ecole = ?, region = ?, classe = ?, serie = ?, favorites = ?, role = ? WHERE rowid = ?`,
                    [
                        email || check.rows[0].email, 
                        nom || check.rows[0].nom || '', 
                        prenom || check.rows[0].prenom || '', 
                        ecole || check.rows[0].ecole || '', 
                        region || check.rows[0].region || '', 
                        classe || check.rows[0].classe || '', 
                        serie || check.rows[0].serie || '', 
                        favoritesStr, 
                        (email === ADMIN_EMAIL || check.rows[0].email === ADMIN_EMAIL) ? 'admin' : (check.rows[0].role || 'user'), 
                        targetRowid
                    ]
                );
            } else {
                await executeQuery(
                    `INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, favorites, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [uid || email, email, nom, prenom, ecole, region, classe, serie, favoritesStr, role]
                );
            }

            return res.status(200).json({ success: true, message: 'Profil enregistré avec succès' });
        }

        if (req.method === 'GET') {
            const qEmail = String(req.query.email || '').trim().toLowerCase();
            const qUid = String(req.query.uid || req.query.userId || '').trim();

            if (!qEmail && !qUid) {
                return res.status(400).json({ error: 'Email ou UID requis' });
            }

            const result = await executeQuery(
                `SELECT * FROM users WHERE (email IS NOT NULL AND email != "" AND lower(email) = ?) OR (uid IS NOT NULL AND uid != "" AND uid = ?)`,
                [qEmail, qUid]
            );

            if (result.rows && result.rows.length > 0) {
                const user = result.rows[0];
                try { user.favorites = JSON.parse(user.favorites || '[]'); } catch (e) { user.favorites = []; }
                if (user.email === ADMIN_EMAIL) user.role = 'admin';
                return res.status(200).json(user);
            }

            return res.status(200).json({
                uid: qUid || qEmail,
                email: qEmail,
                nom: '',
                prenom: '',
                ecole: '',
                region: '',
                classe: '',
                serie: '',
                favorites: [],
                role: qEmail === ADMIN_EMAIL ? 'admin' : 'user'
            });
        }

        return res.status(405).json({ error: 'Méthode non autorisée' });
    } catch (err) {
        console.error('Erreur API user-profile:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
