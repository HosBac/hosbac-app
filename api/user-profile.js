import { execute, batch } from './lib/db.js';
import { setCors, handleOptions, bodyObject, jsonError } from './lib/http.js';
import { getUid, requireUid } from './lib/uid.js';
import { getBearerToken, getFirebaseAdmin } from './lib/firebase-admin.js';

const USER_COLUMNS = ['uid','nom','prenom','email','classe','serie','region','role','totalXp','quiz_xp','examsUploaded','examsDownloaded','badges','status','created_at'];
const WRITE_COLUMNS = ['nom','prenom','email','classe','serie','region','role','totalXp','quiz_xp','examsUploaded','examsDownloaded','badges','status'];

function normalizeUserInput(body, uid) {
  const out = {};
  for (const key of WRITE_COLUMNS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      if (key === 'badges') {
        out[key] = Array.isArray(body[key]) ? JSON.stringify(body[key]) : (body[key] ?? '[]');
      } else if (['totalXp','quiz_xp','examsUploaded','examsDownloaded'].includes(key)) {
        const n = Number(body[key]);
        out[key] = Number.isFinite(n) ? n : 0;
      } else {
        out[key] = body[key] == null ? '' : String(body[key]);
      }
    }
  }
  out.uid = uid;
  return out;
}

function outputUser(row) {
  if (!row) return null;
  let badges = row.badges;
  if (typeof badges === 'string') {
    try { badges = JSON.parse(badges); } catch { /* keep string */ }
  }
  return { ...row, badges: badges ?? [] };
}

async function readFavorites(uid) {
  const result = await execute({ sql: 'SELECT exam_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC', args: [uid] });
  return (result.rows || []).map(r => r.exam_id).filter(v => v !== null && v !== undefined).map(String);
}

async function replaceFavorites(uid, favorites) {
  if (!Array.isArray(favorites)) return;
  const ids = [...new Set(favorites.map(v => String(v ?? '').trim()).filter(Boolean))];
  const statements = [{ sql: 'DELETE FROM favorites WHERE user_id = ?', args: [uid] }];
  const now = new Date().toISOString();
  for (const examId of ids) {
    statements.push({ sql: 'INSERT INTO favorites (user_id, exam_id, created_at) VALUES (?, ?, ?)', args: [uid, examId, now] });
  }
  await batch(statements);
}

async function optionalVerify(req, uid) {
  const token = getBearerToken(req);
  if (!token) return null; // legacy clients may use X-User-UID/body UID.
  const decoded = await getFirebaseAdmin().auth().verifyIdToken(token);
  if (String(decoded.uid) !== String(uid)) {
    throw Object.assign(new Error('UID et jeton Firebase incompatibles'), { code: 'UID_MISMATCH' });
  }
  return decoded;
}

export default async function handler(req, res) {
  setCors(res, 'GET, POST, PATCH, PUT, OPTIONS');
  if (handleOptions(req, res)) return;

  try {
    const uid = requireUid(req);
    await optionalVerify(req, uid);

    if (req.method === 'GET') {
      const result = await execute({
        sql: `SELECT ${USER_COLUMNS.join(', ')} FROM users WHERE uid = ? LIMIT 1`,
        args: [uid]
      });
      const user = outputUser(result.rows?.[0] || null);
      if (user) {
        try { user.favorites = await readFavorites(uid); }
        catch (favoriteError) {
          console.error('[API user-profile] lecture favorites:', favoriteError);
          user.favorites = [];
        }
      }
      return res.status(200).json(user);
    }

    if (!['POST','PATCH','PUT'].includes(req.method)) {
      return jsonError(res, 405, 'Méthode non autorisée');
    }

    const body = bodyObject(req);
    // Un utilisateur ne peut pas s'attribuer le rôle admin ni désactiver son compte.
    // Les valeurs role/status fournies par le client sont acceptées uniquement pour la création initiale
    // avec leurs valeurs normales, puis ignorées lors d'une mise à jour existante.
    const data = normalizeUserInput(body, uid);
    if (Array.isArray(body.favorites)) await replaceFavorites(uid, body.favorites);
    const existing = await execute({ sql: 'SELECT uid FROM users WHERE uid = ? LIMIT 1', args: [uid] });

    if (!existing.rows?.length) {
      const createdAt = new Date().toISOString();
      await execute({
        sql: `INSERT INTO users (uid, nom, prenom, email, classe, serie, region, role, totalXp, quiz_xp, examsUploaded, examsDownloaded, badges, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          uid, data.nom || '', data.prenom || '', data.email || '', data.classe || '', data.serie || '', data.region || '',
          data.role || 'student', Number(data.totalXp || 0), Number(data.quiz_xp || 0), Number(data.examsUploaded || 0),
          Number(data.examsDownloaded || 0), data.badges ?? '[]', data.status || 'active', createdAt
        ]
      });
    } else {
      delete data.role;
      delete data.status;
      const fields = Object.keys(data).filter(k => k !== 'uid' && WRITE_COLUMNS.includes(k));
      if (fields.length) {
        const setSql = fields.map(k => `${k} = ?`).join(', ');
        await execute({
          sql: `UPDATE users SET ${setSql} WHERE uid = ?`,
          args: [...fields.map(k => data[k]), uid]
        });
      }
    }

    const result = await execute({ sql: `SELECT ${USER_COLUMNS.join(', ')} FROM users WHERE uid = ? LIMIT 1`, args: [uid] });
    const user = outputUser(result.rows?.[0] || null);
    if (user) user.favorites = await readFavorites(uid);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('[API user-profile]', error);
    const code = error?.code;
    const status = code === 'UID_REQUIRED' ? 400 : code === 'UID_MISMATCH' ? 403 : error?.message === 'FIREBASE_ADMIN_NOT_CONFIGURED' ? 500 : 500;
    return jsonError(res, status, error?.message || 'Erreur serveur');
  }
}
