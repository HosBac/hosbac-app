// api/gemini.js
// Vercel Serverless Function pour sécuriser l'appel à l'API Gemini

module.exports = async (req, res) => {
    // Autoriser les requêtes CORS pour votre domaine
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://votre-domaine.com';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Gérer les requêtes OPTIONS (preflight CORS)
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    // Vérifier que la méthode est POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
    }

    try {
        const payload = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // Vérifier que la clé API est configurée
        if (!apiKey) {
            console.error('Clé API Gemini manquante dans les variables d\'environnement');
            return res.status(500).json({ error: 'Configuration serveur manquante' });
        }

        // PHASE 1 : La clé API n'est plus envoyée depuis le client
        // Le backend utilise sa propre variable d'environnement

        // Construire la requête pour l'API Gemini
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

        // Préparer le corps de la requête
        const requestBody = {
            system_instruction: payload.system_instruction,
            contents: payload.contents
        };

        // Appeler l'API Gemini
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        // Lire la réponse
        const data = await response.json();

        // Vérifier si la réponse est valide
        if (!response.ok) {
            console.error('Erreur API Gemini:', data);
            return res.status(response.status).json({
                error: data.error || { message: 'Erreur de l\'API Gemini' }
            });
        }

        // Retourner la réponse au frontend
        return res.status(200).json(data);

    } catch (error) {
        console.error('Erreur interne du serveur:', error);
        return res.status(500).json({ error: { message: 'Erreur interne du serveur' } });
    }
};
