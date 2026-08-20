// ============================================================
// FICHIER : api/gemini-fallback.js
// SÉCURISÉ AVEC AUTH, RATE LIMIT, VALIDATION, TIMEOUT, CACHE
// ============================================================

const admin = require('firebase-admin');

// Initialisation Firebase Admin
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
const crypto = require('crypto');

// ============================================================
// CONFIGURATION DES FOURNISSEURS (modèles mis à jour)
// ============================================================
const PROVIDERS = [
  {
    name: 'Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-3.6-flash',
  },
  {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.1-70b-versatile',
  },
  {
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: 'nvidia/nemotron-3.5-lightning:free',
  },
  {
    name: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    apiKey: process.env.CEREBRAS_API_KEY,
    model: 'gemma-2-27b-it',
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
    model: 'DeepSeek-V3.2',
  },
  {
    name: 'HuggingFace',
    baseURL: 'https://api-inference.huggingface.co/v1',
    apiKey: process.env.HUGGINGFACE_API_KEY,
    model: 'Qwen/Qwen3.8-27B-GGUF',
  },
  {
    name: 'Cohere',
    baseURL: 'https://api.cohere.ai/v1/chat',
    apiKey: process.env.COHERE_API_KEY,
    model: 'command',
  },
  {
    name: 'Cloudflare',
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
    apiKey: process.env.CLOUDFLARE_API_KEY,
    model: '@cf/qwen/qwen3.8-27b',
  },
];

// ============================================================
// FONCTIONS DE SÉCURITÉ
// ============================================================

// Vérification du token Firebase
async function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token manquant ou invalide');
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded;
  } catch (error) {
    throw new Error('Token invalide ou expiré');
  }
}

// Rate limiting (20 requêtes par heure) – géré côté serveur
async function checkRateLimit(uid) {
  if (!db) return true;
  const ref = db.collection('rate_limits').doc(uid);
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const doc = await ref.get();
  if (doc.exists) {
    const data = doc.data();
    const resetTime = data.resetTime?.toMillis?.() || 0;
    if (now < resetTime) {
      if (data.count >= 20) {
        return false;
      }
      await ref.update({
        count: admin.firestore.FieldValue.increment(1)
      });
      return true;
    } else {
      await ref.set({
        count: 1,
        resetTime: admin.firestore.Timestamp.fromMillis(now + hour)
      });
      return true;
    }
  } else {
    await ref.set({
      count: 1,
      resetTime: admin.firestore.Timestamp.fromMillis(now + hour)
    });
    return true;
  }
}

// Validation du payload
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload invalide');
  }
  if (!payload.contents || !Array.isArray(payload.contents)) {
    throw new Error('Contents manquant');
  }
  const json = JSON.stringify(payload);
  if (json.length > 50000) {
    throw new Error('Payload trop volumineux');
  }
  if (payload.contents.length > 50) {
    throw new Error('Trop de messages');
  }
  for (const content of payload.contents) {
    if (!content.role || !['user', 'model', 'assistant'].includes(content.role)) {
      throw new Error('Rôle invalide');
    }
    if (!content.parts || !Array.isArray(content.parts) || content.parts.length === 0) {
      throw new Error('Parts manquant ou vide');
    }
    for (const part of content.parts) {
      if (part.text && part.text.length > 5000) {
        throw new Error('Message trop long');
      }
    }
  }
  return true;
}

// Cache avec hash SHA-256 et TTL (24h)
function generateCacheKey(payload) {
  const contents = payload.contents || [];
  const userMessages = contents.filter(c => c.role === 'user');
  const lastUserMsg = userMessages[userMessages.length - 1];
  if (lastUserMsg && lastUserMsg.parts && lastUserMsg.parts.length > 0) {
    const text = lastUserMsg.parts[0].text || '';
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    return `exam_${hash}`;
  }
  return null;
}

async function checkCache(cacheKey) {
  if (!cacheKey || !db) return null;
  try {
    const doc = await db.collection('epreuves_cache').doc(cacheKey).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.timestamp) {
        const age = Date.now() - data.timestamp.toMillis();
        if (age < 24 * 60 * 60 * 1000) {
          return data.response;
        }
      }
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
  } catch (error) {
    console.warn('[CACHE] Erreur sauvegarde:', error.message);
  }
}

// ============================================================
// APPEL AUX PROVIDERS AVEC TIMEOUT
// ============================================================
async function callProvider(provider, payload, timeoutMs = 30000) {
  const { baseURL, apiKey, model, name } = provider;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let url, body;

    if (name === 'Cohere') {
      url = 'https://api.cohere.ai/v1/chat';
      let userMessage = 'Bonjour';
      const contents = payload.contents || [];
      if (contents.length > 0) {
        const lastContent = contents[contents.length - 1];
        if (lastContent.parts) {
          const textParts = lastContent.parts.filter(p => p.text);
          userMessage = textParts.map(p => p.text).join('\n') || 'Bonjour';
        }
      }
      body = {
        model: model,
        message: userMessage,
        temperature: 0.7,
        max_tokens: 2048,
      };
    } else {
      url = `${baseURL.replace(/\/$/, '')}/chat/completions`;
      body = {
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
    }

    console.log(`[API] Appel vers ${name} (${model})`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${name} [HTTP ${response.status}]: ${errorText}`);
    }

    const data = await response.json();

    if (name === 'Cohere') {
      return {
        choices: [
          {
            message: {
              content: data.text || data.message || 'Pas de réponse disponible.',
            },
          },
        ],
      };
    }

    return data;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// ============================================================
// BOUCLE FALLBACK
// ============================================================
async function callWithFallback(payload) {
  const cacheKey = generateCacheKey(payload);
  if (cacheKey) {
    const cached = await checkCache(cacheKey);
    if (cached) {
      console.log('[CACHE] HIT');
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
// HANDLER VERCEL
// ============================================================
module.exports = async (req, res) => {
  // CORS restreint
  const allowedOrigins = ['https://hosbac-app.vercel.app', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://hosbac-app.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    // 1. Vérification du token
    const authHeader = req.headers.authorization;
    const decoded = await verifyToken(authHeader);
    const uid = decoded.uid;

    // 2. Rate limiting
    const allowed = await checkRateLimit(uid);
    if (!allowed) {
      return res.status(429).json({ error: 'Trop de requêtes, veuillez patienter.' });
    }

    // 3. Validation du payload
    const payload = req.body;
    validatePayload(payload);

    // 4. Appel IA avec fallback
    const result = await callWithFallback(payload);
    return res.status(200).json(result);

  } catch (error) {
    console.error('[API] Erreur:', error.message);
    // Messages génériques pour le client
    if (error.message === 'Token manquant ou invalide' || error.message === 'Token invalide ou expiré') {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    if (error.message.includes('Payload')) {
      return res.status(400).json({ error: 'Requête invalide.' });
    }
    if (error.message.includes('Trop de messages') || error.message.includes('Message trop long')) {
      return res.status(400).json({ error: 'Requête trop volumineuse.' });
    }
    return res.status(500).json({ error: 'Le service IA est temporairement indisponible.' });
  }
};
