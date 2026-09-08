import { executeQuery } from './_db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const ADMIN_EMAIL = 'mickaelpcs14@gmail.com';

    try {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch(e) { body = {}; }
        }
        const data = body.data || body.updates || body;
        const query = req.query || {};

        const rawEmail = data.email || body.email || query.email || query.userEmail || '';
        const rawUid = data.uid || data.userId || body.uid || body.userId || query.uid || query.userId || '';

        const email = String(rawEmail).trim().toLowerCase();
        const uid = String(rawUid).trim();

        if (req.method === 'POST' || req.method === 'PATCH') {
            if (!email && !uid) {
                return res.status(400).json({ success: false, error: 'Identifiant manquant' });
            }

            const nom = String(data.nom || data.lastName || data.name || body.nom || '').trim();
            const prenom = String(data.prenom || data.firstName || body.prenom || '').trim();
            const ecole = String(data.ecole || data.etablissement || body.ecole || '').trim();
            const region = String(data.region || body.region || '').trim();
            const classe = String(data.classe || body.classe || '').trim();
            const serie = String(data.serie || body.serie || '').trim();

            let favoritesStr = '[]';
            const favs = data.favorites || body.favorites;
            if (Array.isArray(favs)) {
                favoritesStr = JSON.stringify(favs);
            } else if (typeof favs === 'string' && favs) {
                favoritesStr = favs;
            }

            const role = (email === ADMIN_EMAIL) ? 'admin' : 'user';

            let existing = null;
            try {
                let checkRes;
                if (email && uid) {
                    checkRes = await executeQuery(
                        'SELECT * FROM users WHERE (email != "" AND lower(email) = ?) OR (uid != "" AND uid = ?)',
                        [email, uid]
                    );
                } else if (email) {
                    checkRes = await executeQuery(
                        'SELECT * FROM users WHERE email != "" AND lower(email) = ?',
                        [email]
                    );
                } else {
                    checkRes = await executeQuery(
                        'SELECT * FROM users WHERE uid != "" AND uid = ?',
                        [uid]
                    );
                }
                if (checkRes && checkRes.rows && checkRes.rows.length > 0) {
                    existing = checkRes.rows[0];
                }
            } catch(e) {
                console.error('Erreur recherche user:', e);
            }

            if (existing) {
                const uEmail = email || String(existing.email || '').trim().toLowerCase();
                const uUid = uid || String(existing.uid || '').trim();
                const uNom = nom || String(existing.nom || '').trim();
                const uPrenom = prenom || String(existing.prenom || '').trim();
                const uEcole = ecole || String(existing.ecole || '').trim();
                const uRegion = region || String(existing.region || '').trim();
                const uClasse = classe || String(existing.classe || '').trim();
                const uSerie = serie || String(existing.serie || '').trim();
                const uFavs = (favoritesStr !== '[]') ? favoritesStr : String(existing.favorites || '[]');
                const uRole = (uEmail === ADMIN_EMAIL) ? 'admin' : 'user';

                await executeQuery(
                    'UPDATE users SET uid = ?, email = ?, nom = ?, prenom = ?, ecole = ?, region = ?, classe = ?, serie = ?, favorites = ?, role = ? WHERE (email != "" AND lower(email) = ?) OR (uid != "" AND uid = ?)',
                    [uUid, uEmail, uNom, uPrenom, uEcole, uRegion, uClasse, uSerie, uFavs, uRole, uEmail, uUid]
                );
            } else {
                await executeQuery(
                    'INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, favorites, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [uid || email, email, nom, prenom, ecole, region, classe, serie, favoritesStr, role]
                );
            }

            return res.status(200).json({ success: true, message: 'Profil enregistre avec succes' });
        }

        if (req.method === 'GET') {
            if (!email && !uid) {
                return res.status(400).json({ error: 'Identifiant manquant' });
            }

            let user = null;
            try {
                let getRes;
                if (email && uid) {
                    getRes = await executeQuery(
                        'SELECT * FROM users WHERE (email != "" AND lower(email) = ?) OR (uid != "" AND uid = ?)',
                        [email, uid]
                    );
                } else if (email) {
                    getRes = await executeQuery(
                        'SELECT * FROM users WHERE email != "" AND lower(email) = ?',
                        [email]
                    );
                } else {
                    getRes = await executeQuery(
                        'SELECT * FROM users WHERE uid != "" AND uid = ?',
                        [uid]
                    );
                }
                if (getRes && getRes.rows && getRes.rows.length > 0) {
                    user = getRes.rows[0];
                }
            } catch(e) {
                console.error('Erreur GET user:', e);
            }

            if (user) {
                let favsArr = [];
                try { favsArr = JSON.parse(user.favorites || '[]'); } catch(e) { favsArr = []; }
                const userEmail = String(user.email || '').trim().toLowerCase();
                const isAdmin = (userEmail === ADMIN_EMAIL || email === ADMIN_EMAIL);

                return res.status(200).json({
                    uid: String(user.uid || uid || email).trim(),
                    email: userEmail || email,
                    nom: String(user.nom || '').trim(),
                    prenom: String(user.prenom || '').trim(),
                    ecole: String(user.ecole || '').trim(),
                    region: String(user.region || '').trim(),
                    classe: String(user.classe || '').trim(),
                    serie: String(user.serie || '').trim(),
                    favorites: favsArr,
                    role: isAdmin ? 'admin' : 'user'
                });
            }

            if (email === ADMIN_EMAIL) {
                try {
                    await executeQuery(
                        'INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, favorites, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [uid || ADMIN_EMAIL, ADMIN_EMAIL, '', '', '', '', '', '', '[]', 'admin']
                    );
                } catch(e) {
                    console.error('Auto-insert admin error:', e);
                }
                return res.status(200).json({
                    uid: uid || ADMIN_EMAIL,
                    email: ADMIN_EMAIL,
                    nom: '',
                    prenom: '',
                    ecole: '',
                    region: '',
                    classe: '',
                    serie: '',
                    favorites: [],
                    role: 'admin'
                });
            }

            return res.status(200).json({
                uid: uid || email,
                email: email,
                nom: '',
                prenom: '',
                ecole: '',
                region: '',
                classe: '',
                serie: '',
                favorites: [],
                role: 'user'
            });
        }

        return res.status(405).json({ error: 'Methode non autorisee' });
    } catch(err) {
        console.error('Erreur API user-profile:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
