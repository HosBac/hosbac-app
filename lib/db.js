import { createClient } from '@libsql/client/web';

const dbUrl = (process.env.TURSO_DATABASE_URL || '').replace('libsql://', 'https://');
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl || !authToken) {
  console.warn('[TURSO] Variables de base de données manquantes.');
}

export const db = createClient({
  url: dbUrl,
  authToken: authToken
});
