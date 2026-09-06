import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN;

if (!url || !authToken) {
  console.warn('[TURSO] TURSO_DATABASE_URL/TURSO_AUTH_TOKEN manquant. Les routes DB échoueront proprement tant que les variables ne sont pas configurées.');
}

// Client singleton : adapté aux fonctions serverless Vercel et réutilisable entre invocations chaudes.
const client = (url && authToken) ? createClient({ url, authToken }) : null;

export function getDb() {
  if (!client) throw new Error('TURSO_NOT_CONFIGURED');
  return client;
}

export async function execute(statement) {
  const db = getDb();
  if (typeof statement === 'string') return db.execute(statement);
  return db.execute({ sql: statement.sql, args: statement.args || [] });
}

export async function batch(statements) {
  const db = getDb();
  return db.batch(statements.map((s) => typeof s === 'string' ? { sql: s, args: [] } : s));
}
