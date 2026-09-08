import { executeQuery } from './_db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const SOLE_ADMIN_EMAIL = 'mickaelpcs14@gmail.com';

    try {
        const requesterEmail = String(req.query.requesterEmail || req.query.adminEmail || req.query.email || '').trim().toLowerCase();

        // BLOCAGE DE SÉCURITÉ : Seul mickaelpcs14@gmail.com peut accéder à cette API
        if (requesterEmail && requesterEmail !== SOLE_ADMIN_EMAIL) {
            return res.status(403).json({ error: "Accès refusé. Réservé à l'administrateur principal." });
        }

        const result = await executeQuery('SELECT * FROM users ORDER BY rowid DESC', []);
        let users = result.rows || [];

        // Sécurité : Rôle 'admin' attribué UNIQUEMENT à mickaelpcs14@gmail.com
        users = users.map(u => {
            const uEmail = String(u.email || '').trim().toLowerCase();
            return {
                ...u,
                role: (uEmail === SOLE_ADMIN_EMAIL) ? 'admin' : 'user'
            };
        });

        return res.status(200).json(users);
    } catch (err) {
        console.error("Erreur API users:", err);
        return res.status(500).json({ error: err.message });
    }
}
