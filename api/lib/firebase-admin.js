import admin from 'firebase-admin';

export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('FIREBASE_ADMIN_NOT_CONFIGURED');
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    });
  }
  return admin;
}

export function getBearerToken(req) {
  const value = req?.headers?.authorization || req?.headers?.Authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

export async function verifyBearer(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error('AUTH_REQUIRED');
    err.code = 'AUTH_REQUIRED';
    throw err;
  }
  return getFirebaseAdmin().auth().verifyIdToken(token);
}
