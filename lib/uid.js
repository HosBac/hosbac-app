import { bodyObject } from './http.js';

function clean(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

export function getUid(req) {
  const body = bodyObject(req);
  const query = req?.query || {};
  const headers = req?.headers || {};

  const candidates = [
    headers['x-user-uid'], headers['X-User-UID'],
    headers['x-uid'], headers['X-UID'],
    headers['x-firebase-uid'], headers['X-Firebase-UID'],
    body.uid, body.userId, body.user_id, body.firebase_uid, body.user_uid,
    query.uid, query.userId, query.user_id, query.firebase_uid, query.user_uid,
  ];

  for (const value of candidates) {
    const uid = clean(value);
    if (uid) return uid;
  }
  return '';
}

export function requireUid(req) {
  const uid = getUid(req);
  if (!uid) {
    const err = new Error('Identifiant UID requis');
    err.code = 'UID_REQUIRED';
    throw err;
  }
  return uid;
}
