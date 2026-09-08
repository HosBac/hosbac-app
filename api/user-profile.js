import { executeQuery } from './_db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        let bodyData = req.body || {};
        if (typeof bodyData === 'string') {
            try { bodyData = JSON.parse(bodyData); } catch(e) { bodyData = {}; }
        }
        const source = bodyData.data || bodyData.updates || bodyData;

        if (req.method === 'POST' || req.method === 'PATCH') {
            const rawEmail = String(bodyData.email || source.email || '').trim().toLowerCase();
            const rawUid = String(bodyData.uid || bodyData.userId || bodyData.id || source.uid || source.userId || source.id || '').trim();
            
            const email = (rawEmail === 'undefined' || rawEmail === 'null') ? '' : rawEmail;
            const uid = (rawUid === 'undefined' || rawUid === 'null') ? '' : rawUid;

            if (!email && !uid) return res.status(200).json({ success: false, message: 'Aucun identifiant valide' });

            const nom = String(bodyData.nom || source.nom || '').trim();
            const prenom = String(bodyData.prenom || source.prenom || '').trim();
            const ecole = String(bodyData.ecole || source.ecole || '').trim();
            const region = String(bodyData.region || source.region || '').trim();
            const classe = String(bodyData.classe || source.classe || '').trim();
            const serie = String(bodyData.serie || source.serie || '').trim();

            const rawFavs = bodyData.favorites || source.favorites;
            let favoritesStr = '';
            if (Array.isArray(rawFavs)) {
                favoritesStr = JSON.stringify(rawFavs);
            } else if (typeof rawFavs === 'string' && rawFavs !== 'undefined') {
                favoritesStr = rawFavs;
            }

            // FORCER LE ROLE ADMIN POUR TON COMPTE
            let roleToSet = email === 'mickaelpos4@gmail.com' ? 'admin' : 'user';

            const check = await executeQuery('SELECT * FROM users WHERE (email != "" AND email = ?) OR (uid != "" AND uid = ?)', [email, uid]);
            const existing = check.rows && check.rows.length > 0 ? check.rows[0] : null;

            if (existing) {
                if (existing.role === 'admin') roleToSet = 'admin';

                await executeQuery(`
                    UPDATE users 
                    SET email = ?, nom = ?, prenom = ?, ecole = ?, region = ?, classe = ?, serie = ?, favorites = ?, role = ?
                    WHERE uid = ? OR email = ?
                `, [email || existing.email, nom !== '' ? nom : (existing.nom || ''), prenom !== '' ? prenom : (existing.prenom || ''), ecole !== '' ? ecole : (existing.ecole || ''), region !== '' ? region : (existing.region || ''), classe !== '' ? classe : (existing.classe || ''), serie !== '' ? serie : (existing.serie || ''), favoritesStr !== '' ? favoritesStr : (existing.favorites || '[]'), roleToSet, existing.uid, existing.email]);
            } else {
                await executeQuery(`
                    INSERT INTO users (uid, email, nom, prenom, ecole, region, classe, serie, favorites, role, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
                `, [uid || email, email, nom, prenom, ecole, region, classe, serie, favoritesStr || '[]', roleToSet]);
            }

            return res.status(200).json({ success: true, message: 'Profil enregistré avec succès' });
        }

        if (req.method === 'GET') {
            const rawEmail = String(req.query.email || '').trim().toLowerCase();
            const rawUid = String(req.query.uid || req.query.userId || req.query.id || '').trim();
            
            const email = (rawEmail === 'undefined' || rawEmail === 'null') ? '' : rawEmail;
            const uid = (rawUid === 'undefined' || rawUid === 'null') ? '' : rawUid;

            if (!email && !uid) return res.status(200).json(null);

            const result = await executeQuery('SELECT * FROM users WHERE (email != "" AND email = ?) OR (uid != "" AND uid = ?)', [email, uid]);

            let user = null;
            if (result.rows && result.rows.length > 0) {
                user = result.rows.sort((a, b) => ((b.nom || '').length + (b.prenom || '').length) - ((a.nom || '').length + (a.prenom || '').length))[0];
            }

            if (user) {
                try { user.favorites = JSON.parse(user.favorites || '[]'); } catch (e) { user.favorites = []; }
                if (user.email === 'mickaelpos4@gmail.com') user.role = 'admin'; 
            } else {
                user = { uid: uid || email, email: email, nom: '', prenom: '', ecole: '', region: '', classe: '', serie: '', favorites: [], role: email === 'mickaelpos4@gmail.com' ? 'admin' : 'user', status: 'active' };
            }
            return res.status(200).json(user);
        }

        return res.status(405).json({ error: 'Méthode non autorisée' });
    } catch (err) {
        console.error("Erreur API user-profile:", err);
        return res.status(500).json({ error: err.message });
    }
}
