// api/gemini.js
// Vercel Serverless Function pour sécuriser l'appel à l'API Gemini pour HOSBAC

module.exports = async (req, res) => {
    // Autoriser les requêtes CORS (mis sur '*' pour éviter tout blocage depuis ton frontend)
    res.setHeader('Access-Control-Allow-Origin', '*');
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
        // Le serveur récupère la clé secrète configurée dans Vercel
        const apiKey = process.env.GEMINI_API_KEY;

        // Vérifier que la clé API est bien configurée côté serveur
        if (!apiKey) {
            console.error('Clé API Gemini manquante dans les variables d\'environnement');
            return res.status(500).json({ error: 'Configuration serveur manquante' });
        }

        // Construire la requête avec le BON modèle (gemini-1.5-flash)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        // Préparer le corps de la requête
        const requestBody = {
            system_instruction: payload.system_instruction,
            contents: payload.contents
        };

        // Appeler l'API Gemini (la ligne 50 est parfaite avec 'url')
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
            // Transmettre l'erreur au frontend
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
