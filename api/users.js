import { executeQuery } from './_db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const ADMIN_EMAIL = 'mickaelpcs14@gmail.com';

    try {
        const query = req.query || {};
        const requesterEmail = String(query.requesterEmail || query.adminEmail || query.email || '').trim().toLowerCase();

        if (requesterEmail && requesterEmail !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Acces refuse. Reserve a l admin.' });
        }

        const result = await executeQuery('SELECT * FROM users ORDER BY rowid DESC', []);
        let users = (result && result.rows) ? result.rows : [];

        users = users.map(u => {
            const uEmail = String(u.email || '').trim().toLowerCase();
            return {
                ...u,
                role: (uEmail === ADMIN_EMAIL) ? 'admin' : 'user'
            };
        });

        return res.status(200).json(users);
    } catch(err) {
        console.error('Erreur API users:', err);
        return res.status(500).json({ error: err.message });
    }
}
