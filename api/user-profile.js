import { executeQuery } from './_db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // Nettoyage automatique systématique des comptes fantômes
        await executeQuery(`
            DELETE FROM users 
            WHERE uid IS NULL 
               OR uid = '' 
               OR uid = 'undefined' 
               OR uid = 'null'
               OR email IS NULL 
               OR email = '' 
               OR email = 'undefined'
        `);

        // Fonction pour nettoyer et valider les chaînes de texte
        const cleanStr = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val).trim();
            if (str === 'undefined' || str === 'null' || str === '[object Object]') return '';
            return str;
        };

        if (req.method === 'POST' || req.method === 'PATCH') {
            const bodyData = req.body || {};
            const source = bodyData.data || bodyData.updates || bodyData;

            const rawEmail = cleanStr(bodyData.email || source.email);
            const rawUid = cleanStr(bodyData.uid || bodyData.userId || bodyData.id || source.uid || source.userId || source.id) || rawEmail;

            // SÉCURITÉ STRICTE : Si ni UID ni Email valide n'est fourni, on rejette la requête !
            if (!rawUid && !rawEmail) {
                return res.status(400).json({ error: 'UID ou Email valide requis' });
            }

            const email = rawEmail.toLowerCase();
            const uid = rawUid;

            const nom = cleanStr(bodyData.nom || source.nom);
            const prenom = cleanStr(bodyData.prenom || source.prenom);
            const ecole = cleanStr(bodyData.ecole || source.ecole);
            const region = cleanStr(bodyData.region || source.region);
            const classe = cleanStr(bodyData.classe || source.classe);
            const serie = cleanStr(bodyData.serie || source.serie);

            const rawFavs = bodyData.favorites || source.favorites;
            let favoritesStr = '';
            if (Array.isArray(rawFavs)) {
                favoritesStr = JSON.stringify(rawFavs);
            } else if (typeof rawFavs === 'string' && cleanStr(rawFavs) !== '') {
                favoritesStr = rawFavs;
            }

            // Vérifier si un compte existe déjà pour cet utilisateur
            const check = await executeQuery(
                'SELECT * FROM users WHERE (uid != "" AND uid = ?) OR (email != "" AND email = ?)',
                [uid, email]
            );
            const existing = check.rows && check.rows.length > 0 ? check.rows[0] : null;

            if (existing) {
                // PROTECTION ANTI-ÉCRASEMENT : Ne jamais remplacer une information existante par du vide !
                const updatedNom = nom !== '' ? nom : (existing.nom || '');
                const updatedPrenom = prenom !== '' ? prenom : (existing.prenom || '');
                const updatedEcole = ecole !== '' ? ecole : (existing.ecole || '');
                const updatedRegion = region !== '' ? region : (existing.region || '');
                const updatedClasse = classe !== '' ? classe : (existing.classe || '');
                const updatedSerie = serie !== '' ? serie : (existing.serie || '');
                const updatedFavs = (favoritesStr !== '' && favoritesStr !== '[]') ? favoritesStr : (existing.favorites || '[]');

                await executeQuery(`
                    UPDATE users 
                    SET email = ?, nom = ?, prenom = ?, ecole = ?, region = ?, classe = ?, serie = ?, favorites = ?
                    WHERE uid = ? OR email = ?
                `, [
                    email || existing.email,
                    updatedNom,
                    updatedPrenom,
                    updatedEcole,
                    updatedRegion,
                    updatedClasse,
                    updatedSerie,
                    updatedFavs,
                    existing.uid,
                    email
                ]);
            } else {
                await executeQuery(`
                    INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, favorites, role, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', 'active')
                `, [uid, email, nom, prenom, ecole, region, classe, serie, favoritesStr || '[]']);
            }

            return res.status(200).json({ success: true, message: 'Profil enregistré avec succès' });
        }

        if (req.method === 'GET') {
            const rawEmail = cleanStr(req.query.email);
            const rawUid = cleanStr(req.query.uid || req.query.userId || req.query.id);

            if (!rawEmail && !rawUid) {
                return res.status(400).json({ error: 'Email ou UID valide requis' });
            }

            const email = rawEmail.toLowerCase();
            const uid = rawUid;

            const result = await executeQuery(
                'SELECT * FROM users WHERE (uid != "" AND uid = ?) OR (email != "" AND email = ?)',
                [uid, email]
            );

            let user = null;
            if (result.rows && result.rows.length > 0) {
                // Sélectionner la ligne la plus remplie en cas de doublons
                user = result.rows.sort((a, b) => {
                    const lenA = (a.nom || '').length + (a.prenom || '').length + (a.classe || '').length;
                    const lenB = (b.nom || '').length + (b.prenom || '').length + (b.classe || '').length;
                    return lenB - lenA;
                })[0];
            }

            if (user) {
                try {
                    user.favorites = JSON.parse(user.favorites || '[]');
                } catch (e) {
                    user.favorites = [];
                }
            } else {
                user = {
                    uid: uid || email,
                    email: email,
                    nom: '',
                    prenom: '',
                    ecole: '',
                    region: '',
                    classe: '',
                    serie: '',
                    favorites: [],
                    role: 'user',
                    status: 'active'
                };
            }
            return res.status(200).json(user);
        }

        return res.status(405).json({ error: 'Méthode non autorisée' });
    } catch (err) {
        console.error("Erreur API user-profile:", err);
        return res.status(500).json({ error: err.message });
    }
}
