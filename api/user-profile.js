import { executeQuery } from './_db.js';

// Nettoyage strict pour éviter tout bug "undefined" sur Turso
const clean = (v) => (v === undefined || v === null) ? '' : String(v).trim();

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

        let email = clean(data.email || body.email || req.query.email || req.query.userEmail).toLowerCase();
        let uid = clean(data.uid || data.userId || body.uid || req.query.uid || req.query.userId);

        // --- SAUVEGARDE DU PROFIL (POST / PATCH) ---
        if (req.method === 'POST' || req.method === 'PATCH') {
            if (!email && !uid) {
                return res.status(400).json({ success: false, error: 'Email ou UID manquant' });
            }

            const nom = clean(data.nom || data.lastName || data.name || body.nom);
            const prenom = clean(data.prenom || data.firstName || body.prenom);
            const ecole = clean(data.ecole || data.etablissement || body.ecole);
            const region = clean(data.region || body.region);
            const classe = clean(data.classe || body.classe);
            const serie = clean(data.serie || body.serie);

            let favoritesStr = '[]';
            const favs = data.favorites || body.favorites;
            if (Array.isArray(favs)) favoritesStr = JSON.stringify(favs);
            else if (typeof favs === 'string' && favs) favoritesStr = favs;

            const role = (email === ADMIN_EMAIL) ? 'admin' : 'user';

            let existing = null;
            try {
                const check = await executeQuery(
                    `SELECT * FROM users WHERE (email != "" AND lower(email) = ?) OR (uid != "" AND uid = ?)`,
                    [email, uid]
                );
                if (check && check.rows && check.rows.length > 0) {
                    existing = check.rows[0];
                }
            } catch(e) {
                console.error("Erreur vérification utilisateur:", e);
            }

            if (existing) {
                const updatedNom = nom || clean(existing.nom);
                const updatedPrenom = prenom || clean(existing.prenom);
                const updatedEcole = ecole || clean(existing.ecole);
                const updatedRegion = region || clean(existing.region);
                const updatedClasse = classe || clean(existing.classe);
                const updatedSerie = serie || clean(existing.serie);
                const updatedFavs = (favoritesStr !== '[]') ? favoritesStr : clean(existing.favorites || '[]');
                const updatedRole = (email === ADMIN_EMAIL || clean(existing.email).toLowerCase() === ADMIN_EMAIL) ? 'admin' : (clean(existing.role) || 'user');
                const targetEmail = clean(existing.email) || email;
                const targetUid = clean(existing.uid) || uid;

                await executeQuery(
                    `UPDATE users SET email = ?, nom = ?, prenom = ?, ecole = ?, region = ?, classe = ?, serie = ?, favorites = ?, role = ? WHERE (email != "" AND lower(email) = ?) OR (uid != "" AND uid = ?)`,
                    [
                        email || targetEmail,
                        updatedNom,
                        updatedPrenom,
                        updatedEcole,
                        updatedRegion,
                        updatedClasse,
                        updatedSerie,
                        updatedFavs,
                        updatedRole,
                        targetEmail.toLowerCase(),
                        targetUid
                    ]
                );
            } else {
                await executeQuery(
                    `INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, favorites, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                return res.status(400).json({ error: 'Email ou UID manquant' });
            }

            let user = null;
            try {
                const result = await executeQuery(
                    `SELECT * FROM users WHERE (email != "" AND lower(email) = ?) OR (uid != "" AND uid = ?)`,
                    [email, uid]
                );
                if (result && result.rows && result.rows.length > 0) {
                    user = result.rows[0];
                }
            } catch(e) {
                console.error("Erreur GET utilisateur:", e);
            }

            if (user) {
                let favsArr = [];
                try { favsArr = JSON.parse(user.favorites || '[]'); } catch(e) { favsArr = []; }
                
                return res.status(200).json({
                    uid: clean(user.uid) || uid || email,
                    email: clean(user.email) || email,
                    nom: clean(user.nom),
                    prenom: clean(user.prenom),
                    ecole: clean(user.ecole),
                    region: clean(user.region),
                    classe: clean(user.classe),
                    serie: clean(user.serie),
                    favorites: favsArr,
                    role: (clean(user.email).toLowerCase() === ADMIN_EMAIL || email === ADMIN_EMAIL) ? 'admin' : (clean(user.role) || 'user')
                });
            }

            // AUTO-INJECTION D'ADMIN : Si c'est ton email et qu'il n'existe pas encore en BDD
            if (email === ADMIN_EMAIL) {
                try {
                    await executeQuery(
                        `INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, favorites, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [uid || ADMIN_EMAIL, ADMIN_EMAIL, 'Admin', 'Mickael', 'HosBac', 'Cotonou', 'Terminale', 'CD', '[]', 'admin']
                    );
                } catch(e) {
                    console.error("Erreur auto-insert admin:", e);
                }
                return res.status(200).json({
                    uid: uid || ADMIN_EMAIL,
                    email: ADMIN_EMAIL,
                    nom: 'Admin',
                    prenom: 'Mickael',
                    ecole: 'HosBac',
                    region: 'Cotonou',
                    classe: 'Terminale',
                    serie: 'CD',
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
