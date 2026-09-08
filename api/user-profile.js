import { executeQuery } from './_db.js';

const cleanStr = (val) => {
    if (val === undefined || val === null) return '';
    const s = String(val).trim();
    return (s === 'undefined' || s === 'null') ? '' : s;
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const SOLE_ADMIN_EMAIL = 'mickaelpcs14@gmail.com';

    try {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch(e) { body = {}; }
        }
        const data = body.data || body.updates || body;

        const email = cleanStr(data.email || body.email || req.query.email || req.query.userEmail).toLowerCase();
        const uid = cleanStr(data.uid || data.userId || body.uid || body.userId || req.query.uid || req.query.userId);

        // --- ENREGISTREMENT / MISE À JOUR (POST / PATCH) ---
        if (req.method === 'POST' || req.method === 'PATCH') {
            if (!email && !uid) {
                return res.status(400).json({ success: false, error: 'Identifiant requis.' });
            }

            const nom = cleanStr(data.nom || data.lastName || data.name || body.nom);
            const prenom = cleanStr(data.prenom || data.firstName || body.prenom);
            const ecole = cleanStr(data.ecole || data.etablissement || body.ecole);
            const region = cleanStr(data.region || body.region);
            const classe = cleanStr(data.classe || body.classe);
            const serie = cleanStr(data.serie || body.serie);

            let favoritesStr = '[]';
            const favs = data.favorites || body.favorites;
            if (Array.isArray(favs)) favoritesStr = JSON.stringify(favs);
            else if (typeof favs === 'string' && favs) favoritesStr = favs;

            // Rôle : STRICTEMENT réservé à mickaelpcs14@gmail.com
            const role = (email === SOLE_ADMIN_EMAIL) ? 'admin' : 'user';

            let existingUser = null;
            try {
                let sqlSelect = '';
                let params = [];
                if (email && uid) {
                    sqlSelect = `SELECT * FROM users WHERE (email != "" AND lower(email) = ?) OR (uid != "" AND uid = ?)`;
                    params = [email, uid];
                } else if (email) {
                    sqlSelect = `SELECT * FROM users WHERE email != "" AND lower(email) = ?`;
                    params = [email];
                } else {
                    sqlSelect = `SELECT * FROM users WHERE uid != "" AND uid = ?`;
                    params = [uid];
                }

                const check = await executeQuery(sqlSelect, params);
                if (check && check.rows && check.rows.length > 0) {
                    existingUser = check.rows[0];
                }
            } catch (err) {
                console.error("Erreur recherche utilisateur:", err);
            }

            if (existingUser) {
                const finalEmail = email || cleanStr(existingUser.email);
                const finalUid = uid || cleanStr(existingUser.uid);
                const finalNom = nom || cleanStr(existingUser.nom);
                const finalPrenom = prenom || cleanStr(existingUser.prenom);
                const finalEcole = ecole || cleanStr(existingUser.ecole);
                const finalRegion = region || cleanStr(existingUser.region);
                const finalClasse = classe || cleanStr(existingUser.classe);
                const finalSerie = serie || cleanStr(existingUser.serie);
                const finalFavs = (favoritesStr !== '[]') ? favoritesStr : cleanStr(existingUser.favorites || '[]');
                const finalRole = (finalEmail.toLowerCase() === SOLE_ADMIN_EMAIL) ? 'admin' : 'user';

                await executeQuery(
                    `UPDATE users 
                     SET uid = ?, email = ?, nom = ?, prenom = ?, ecole = ?, region = ?, classe = ?, serie = ?, favorites = ?, role = ?
                     WHERE (email != "" AND lower(email) = ?) OR (uid != "" AND uid = ?)`,
                    [
                        finalUid,
                        finalEmail,
                        finalNom,
                        finalPrenom,
                        finalEcole,
                        finalRegion,
                        finalClasse,
                        finalSerie,
                        finalFavs,
                        finalRole,
                        finalEmail.toLowerCase(),
                        finalUid
                    ]
                );
            } else {
                await executeQuery(
                    `INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, favorites, role)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        uid || email,
                        email,
                        nom,
                        prenom,
                        ecole,
                        region,
                        classe,
                        serie,
                        favoritesStr,
                        role
                    ]
                );
            }

            return res.status(200).json({ success: true, message: 'Profil enregistré avec succès' });
        }

        // --- LECTURE DU PROFIL (GET) ---
        if (req.method === 'GET') {
            if (!email && !uid) {
                return res.status(400).json({ error: 'Identifiant requis.' });
            }

            let user = null;
            try {
                let sqlSelect = '';
                let params = [];
                if (email && uid) {
                    sqlSelect = `SELECT * FROM users WHERE (email != "" AND lower(email) = ?) OR (uid != "" AND uid = ?)`;
                    params = [email, uid];
                } else if (email) {
                    sqlSelect = `SELECT * FROM users WHERE email != "" AND lower(email) = ?`;
                    params = [email];
                } else {
                    sqlSelect = `SELECT * FROM users WHERE uid != "" AND uid = ?`;
                    params = [uid];
                }

                const result = await executeQuery(sqlSelect, params);
                if (result && result.rows && result.rows.length > 0) {
                    user = result.rows[0];
                }
            } catch (err) {
                console.error("Erreur GET utilisateur:", err);
            }

            if (user) {
                let favsArr = [];
                try { favsArr = JSON.parse(user.favorites || '[]'); } catch(e) { favsArr = []; }
                
                const userEmail = cleanStr(user.email).toLowerCase();
                const isAdmin = (userEmail === SOLE_ADMIN_EMAIL || email === SOLE_ADMIN_EMAIL);

                return res.status(200).json({
                    uid: cleanStr(user.uid) || uid || email,
                    email: cleanStr(user.email) || email,
                    nom: cleanStr(user.nom),
                    prenom: cleanStr(user.prenom),
                    ecole: cleanStr(user.ecole),
                    region: cleanStr(user.region),
                    classe: cleanStr(user.classe),
                    serie: cleanStr(user.serie),
                    favorites: favsArr,
                    role: isAdmin ? 'admin' : 'user'
                });
            }

            // Auto-insertion de l'admin principal s'il n'existe pas encore
            if (email === SOLE_ADMIN_EMAIL) {
                try {
                    await executeQuery(
                        `INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, favorites, role)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [uid || SOLE_ADMIN_EMAIL, SOLE_ADMIN_EMAIL, '', '', '', '', '', '', '[]', 'admin']
                    );
                } catch(e) {
                    console.error("Auto-creation admin error:", e);
                }

                return res.status(200).json({
                    uid: uid || SOLE_ADMIN_EMAIL,
                    email: SOLE_ADMIN_EMAIL,
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

        return res.status(405).json({ error: 'Méthode non autorisée' });

    } catch (err) {
        console.error('Erreur API user-profile:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
