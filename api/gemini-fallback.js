// ============================================================
// FICHIER : api/gemini-fallback.js
// ============================================================

const admin = require('firebase-admin');

// Initialisation de Firebase Admin
if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY 
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
      : undefined;

    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
    } else {
      console.warn('[FIREBASE] Variables d\'environnement Firebase incomplètes. Le cache sera désactivé.');
    }
  } catch (err) {
    console.error('[FIREBASE] Erreur d\'initialisation:', err.message);
  }
}

const db = admin.apps.length ? admin.firestore() : null;

// ============================================================
// 1. CONFIGURATION DES FOURNISSEURS D'API
// ============================================================
const PROVIDERS = [
    {
    name: 'Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-0.6-flash', // Modèle stable et officiel de la famille 3.6
  },
  {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.1-8b-instant',
  },
  {
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: 'deepseek/deepseek-chat:free',
  },
    {
    name: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    apiKey: process.env.CEREBRAS_API_KEY,
    model: 'gemma-4-31b', // ✅ Modèle actuel affiché sur ton dashboard Cerebras
  },
  {
    name: 'Mistral',
    baseURL: 'https://api.mistral.ai/v1',
    apiKey: process.env.MISTRAL_API_KEY,
    model: 'mistral-small-latest',
  },
  {
    name: 'GitHub',
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: process.env.GITHUB_API_KEY,
    model: 'gpt-4o-mini',
  },
  {
    name: 'SambaNova',
    baseURL: 'https://api.sambanova.ai/v1',
    apiKey: process.env.SAMBANOVA_API_KEY,
    model: 'Meta-Llama-3.3-70B-Instruct',
  },
  {
    name: 'HuggingFace',
    baseURL: 'https://api-inference.huggingface.co/v1',
    apiKey: process.env.HUGGINGFACE_API_KEY,
    model: 'meta-llama/Llama-3.3-70B-Instruct',
  },
  {
    name: 'Cohere',
    baseURL: 'https://api.cohere.com/v2',
    apiKey: process.env.COHERE_API_KEY,
    model: 'command-r-plus',
  },
  {
    name: 'Cloudflare',
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
    apiKey: process.env.CLOUDFLARE_API_KEY,
    model: '@cf/meta/llama-3.3-70b-instruct',
  },
];

// ============================================================
// 2. GENERATION DE LA CLÉ DE CACHE
// ============================================================
function generateCacheKey(payload) {
  const contents = payload.contents || [];
  const userMessages = contents.filter(c => c.role === 'user');
  const lastUserMsg = userMessages[userMessages.length - 1];
  if (lastUserMsg && lastUserMsg.parts && lastUserMsg.parts.length > 0) {
    const text = lastUserMsg.parts[0].text || '';
    return `exam_${text.substring(0, 100).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }
  return null;
}

// ============================================================
// 3. VÉRIFICATION ET SAUVEGARDE DU CACHE
// ============================================================
async function checkCache(cacheKey) {
  if (!cacheKey || !db) return null;
  try {
    const doc = await db.collection('epreuves_cache').doc(cacheKey).get();
    if (doc.exists) {
      return doc.data().response;
    }
    return null;
  } catch (error) {
    console.warn('[CACHE] Erreur lecture:', error.message);
    return null;
  }
}

async function saveToCache(cacheKey, response) {
  if (!cacheKey || !db) return;
  try {
    await db.collection('epreuves_cache').doc(cacheKey).set({
      response: response,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('[CACHE] Sauvegardé avec succès:', cacheKey);
  } catch (error) {
    console.warn('[CACHE] Erreur sauvegarde:', error.message);
  }
}

// ============================================================
// 4. APPEL AUX PROVIDERS
// ============================================================
async function callProvider(provider, payload) {
  const { baseURL, apiKey, model, name } = provider;
  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;
  
  const body = {
    model: model,
    messages: [],
    temperature: 0.7,
    max_tokens: 2048,
  };

  if (payload.system_instruction && payload.system_instruction.parts) {
    const systemText = payload.system_instruction.parts.map(p => p.text).join('\n');
    body.messages.push({ role: 'system', content: systemText });
  }

  const contents = payload.contents || [];
  const recentContents = contents.slice(-10);
  for (const content of recentContents) {
    const role = content.role === 'user' ? 'user' : 'assistant';
    let contentText = '';
    if (content.parts) {
      const textParts = content.parts.filter(p => p.text);
      contentText = textParts.map(p => p.text).join('\n');
    }
    if (contentText) {
      body.messages.push({ role, content: contentText });
    }
  }

  if (body.messages.length === 0) {
    body.messages.push({ role: 'user', content: 'Bonjour' });
  }

  console.log(`[API] Appel vers ${name} (${model})`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${name} [HTTP ${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  return data;
}

// ============================================================
// 5. BOUCLE FALLBACK
// ============================================================
async function callWithFallback(payload) {
  const cacheKey = generateCacheKey(payload);
  if (cacheKey) {
    const cached = await checkCache(cacheKey);
    if (cached) {
      console.log('[CACHE] HIT - Réponse servie depuis le cache');
      return cached;
    }
  }

  let lastError = null;
  for (const provider of PROVIDERS) {
    if (!provider.apiKey) {
      console.warn(`[API] ${provider.name} ignoré : clé manquante`);
      continue;
    }

    try {
      const result = await callProvider(provider, payload);
      
      const formattedResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: result.choices?.[0]?.message?.content || 'Pas de réponse disponible.',
                },
              ],
            },
          },
        ],
      };

      if (cacheKey && formattedResponse.candidates?.[0]?.content?.parts?.[0]?.text) {
        await saveToCache(cacheKey, formattedResponse);
      }

      console.log(`[API] Succès avec ${provider.name}`);
      return formattedResponse;
    } catch (error) {
      console.warn(`[API] Échec avec ${provider.name}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw new Error(`Tous les fournisseurs d'API ont échoué. Dernier message: ${lastError?.message || 'Inconnu'}`);
}

// ============================================================
// 6. HANDLER VERCEL SERVERLESS
// ============================================================
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const payload = req.body;
    if (!payload || !payload.contents) {
      return res.status(400).json({ error: 'Payload invalide' });
    }

    const result = await callWithFallback(payload);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[API] Erreur serveur:', error.message);
    return res.status(500).json({ error: error.message || 'Erreur interne' });
  }
};
