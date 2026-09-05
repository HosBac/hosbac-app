import { execute } from '../lib/db.js';

const db = {
  execute: (stmt) => typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }),
  batch: async (stmts) => {
    for (const stmt of stmts) {
      await (typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }));
    }
  }
};

// HosBac - AI fallback API
// IMPORTANT: This route does NOT read/write Firestore for quota or cache.
// Firebase Admin is used only to verify the Firebase Auth ID token.

import crypto from 'crypto';

if (!null) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : '';
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    console.error('[AUTH] Firebase Admin environment variables are incomplete.');
  } else {
    null({
      credential: null({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey
      })
    });
  }
}

const PROVIDERS = [
  { name:'Gemini', baseURL:'https://generativelanguage.googleapis.com/v1beta/openai', apiKey:process.env.GEMINI_API_KEY, model:'gemini-1.5-flash' },
  { name:'Groq', baseURL:'https://api.groq.com/openai/v1', apiKey:process.env.GROQ_API_KEY, model:'llama-3.1-70b-versatile' },
  { name:'OpenRouter', baseURL:'https://openrouter.ai/api/v1', apiKey:process.env.OPENROUTER_API_KEY, model:'nvidia/nemotron-3.5-lightning:free' },
  { name:'Cerebras', baseURL:'https://api.cerebras.ai/v1', apiKey:process.env.CEREBRAS_API_KEY, model:'gemma-2-27b-it' },
  { name:'Mistral', baseURL:'https://api.mistral.ai/v1', apiKey:process.env.MISTRAL_API_KEY, model:'mistral-small-latest' },
  { name:'GitHub', baseURL:'https://models.inference.ai.azure.com', apiKey:process.env.GITHUB_API_KEY, model:'gpt-4o-mini' },
  { name:'SambaNova', baseURL:'https://api.sambanova.ai/v1', apiKey:process.env.SAMBANOVA_API_KEY, model:'DeepSeek-V3.2' },
  { name:'HuggingFace', baseURL:'https://api-inference.huggingface.co/v1', apiKey:process.env.HUGGINGFACE_API_KEY, model:'Qwen/Qwen3.8-27B-GGUF' },
  { name:'Cohere', baseURL:'https://api.cohere.ai/v1/chat', apiKey:process.env.COHERE_API_KEY, model:'command' },
  { name:'Cloudflare', baseURL:`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`, apiKey:process.env.CLOUDFLARE_API_KEY, model:'@cf/qwen/qwen3.8-27b' }
];

// Best-effort in-memory rate limiter. It deliberately avoids Firestore.
// Vercel/serverless instances do not share this Map, so it is an abuse-control layer,
// not a billing/security authority. Provider limits remain authoritative.
const rateStore = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 20;
function checkRateLimit(uid) {
  const now = Date.now();
  const existing = rateStore.get(uid);
  if (!existing || now >= existing.resetAt) {
    rateStore.set(uid, { count:1, resetAt:now + RATE_WINDOW_MS });
    return true;
  }
  if (existing.count >= RATE_LIMIT) return false;
  existing.count += 1;
  return true;
}

function verifyPayload(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.contents)) {
    throw new Error('INVALID_PAYLOAD');
  }
  if (JSON.stringify(payload).length > 220000) throw new Error('PAYLOAD_TOO_LARGE');
  if (payload.contents.length > 12) throw new Error('TOO_MANY_MESSAGES');
  for (const content of payload.contents) {
    if (!['user','model','assistant'].includes(content.role)) throw new Error('INVALID_ROLE');
    if (!Array.isArray(content.parts) || content.parts.length === 0) throw new Error('INVALID_PARTS');
    for (const part of content.parts) {
      if (typeof part.text === 'string' && part.text.length > 25000) throw new Error('MESSAGE_TOO_LONG');
      if (part.inline_data && typeof part.inline_data.data === 'string' && part.inline_data.data.length > 16000000) throw new Error('FILE_TOO_LARGE');
    }
  }
}

async function verifyToken(authHeader) {
  if (!null) throw new Error('AUTH_CONFIG');
  if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED');
  const token = authHeader.slice(7).trim();
  if (!token) throw new Error('AUTH_REQUIRED');
  try {
    return await null().verifyIdToken(token);
  } catch (err) {
    console.warn('[AUTH] ID token rejected:', err.message);
    throw new Error('AUTH_INVALID');
  }
}

function normalizeMessages(payload) {
  const messages = [];
  if (payload.system_instruction?.parts) {
    const systemText = payload.system_instruction.parts.map(p => p.text || '').join('\n').trim();
    if (systemText) messages.push({ role:'system', content:systemText });
  }
  const historyLimit = payload.mode === 'voice' ? 4 : 8;
  const perMessageLimit = payload.mode === 'voice' ? 3000 : 70000;
  for (const content of payload.contents.slice(-historyLimit)) {
    const role = content.role === 'user' ? 'user' : 'assistant';
    const text = content.parts.filter(p => typeof p.text === 'string').map(p => p.text).join('\n').slice(0, perMessageLimit).trim();
    if (text) messages.push({ role, content:text });
  }
  if (!messages.some(m => m.role === 'user')) messages.push({ role:'user', content:'Bonjour' });
  return messages;
}

async function callProvider(provider, payload, timeoutMs=30000) {
  if (!provider.apiKey) throw new Error(`${provider.name}: missing API key`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (provider.name === 'Cohere') {
      const contents = payload.contents || [];
      const last = contents[contents.length - 1];
      const message = last?.parts?.filter(p => p.text).map(p => p.text).join('\n') || 'Bonjour';
      const response = await fetch(provider.baseURL, {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${provider.apiKey}`},
        body:JSON.stringify({ model:provider.model, message, max_tokens:payload.mode === 'voice' ? 550 : 2048, temperature:payload.mode === 'voice' ? 0.35 : 0.7 }),
        signal:controller.signal
      });
      if (!response.ok) throw new Error(`${provider.name} HTTP ${response.status}: ${await response.text()}`);
      const data = await response.json();
      return { choices:[{ message:{ content:data.text || data.message || '' } }] };
    }

    const url = `${provider.baseURL.replace(/\/$/,'')}/chat/completions`;
    const isVoice = payload.mode === 'voice';
    const response = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${provider.apiKey}`},
      body:JSON.stringify({
        model:provider.model,
        messages:normalizeMessages(payload),
        temperature:isVoice ? 0.35 : 0.7,
        max_tokens:isVoice ? 550 : 2048
      }),
      signal:controller.signal
    });
    if (!response.ok) throw new Error(`${provider.name} HTTP ${response.status}: ${await response.text()}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function extractText(data) {
  return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
}

export default async (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    'https://hosbac-app.vercel.app',
    'https://hosbac-spec.github.io',
    'http://localhost:3000',
    'http://localhost:5173'
  ]);
  if (allowedOrigins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  res.setHeader('Cache-Control','no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error:'Méthode non autorisée.' });

  try {
    const decoded = await verifyToken(req.headers.authorization);
    if (!checkRateLimit(decoded.uid)) return res.status(429).json({ error:'Trop de requêtes. Veuillez patienter.' });
    verifyPayload(req.body);

    let lastError = null;
    for (const provider of PROVIDERS) {
      try {
        const result = await callProvider(provider, req.body, req.body?.mode === 'voice' ? 10000 : 20000);
        const text = extractText(result);
        if (!text) throw new Error(`${provider.name}: réponse vide`);
        return res.status(200).json({ candidates:[{ content:{ parts:[{ text }] } }] });
      } catch (err) {
        lastError = err;
        console.warn('[AI] Provider failed:', err.message);
      }
    }
    console.error('[AI] All providers failed:', lastError?.message);
    return res.status(503).json({ error:'Le service IA est temporairement indisponible.' });
  } catch (err) {
    if (err.message === 'AUTH_REQUIRED' || err.message === 'AUTH_INVALID') return res.status(401).json({ error:'Authentification requise.' });
    if (err.message === 'AUTH_CONFIG') return res.status(500).json({ error:'Configuration Firebase Admin manquante sur le serveur.' });
    if (['INVALID_PAYLOAD','INVALID_ROLE','INVALID_PARTS'].includes(err.message)) return res.status(400).json({ error:'Requête IA invalide.' });
    if (['PAYLOAD_TOO_LARGE','TOO_MANY_MESSAGES','MESSAGE_TOO_LONG','FILE_TOO_LARGE'].includes(err.message)) return res.status(413).json({ error:'Requête IA trop volumineuse.' });
    console.error('[AI] Unexpected error:', err);
    return res.status(500).json({ error:'Erreur interne du service IA.' });
  }
};