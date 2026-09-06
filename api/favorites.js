import { execute } from './lib/db.js';
import { setCors, handleOptions, bodyObject, jsonError } from './lib/http.js';
import { requireUid } from './lib/uid.js';

export default async function handler(req, res) {
  setCors(res, 'GET, POST, PUT, DELETE, OPTIONS');
  if (handleOptions(req, res)) return;

  try {
    const uid = requireUid(req);
    const body = bodyObject(req);
    const examId = String(body.exam_id ?? body.examId ?? req.query?.exam_id ?? req.query?.examId ?? '').trim();

    if (req.method === 'GET') {
      const result = await execute({
        sql: 'SELECT id, user_id, exam_id, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC',
        args: [uid]
      });
      return res.status(200).json({ success: true, favorites: result.rows || [] });
    }

    if (!examId) return jsonError(res, 400, 'Identifiant de l’épreuve requis');

    if (req.method === 'POST' || req.method === 'PUT') {
      await execute({
        sql: 'INSERT INTO favorites (user_id, exam_id, created_at) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM favorites WHERE user_id = ? AND exam_id = ?)',
        args: [uid, examId, new Date().toISOString(), uid, examId]
      });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      await execute({ sql: 'DELETE FROM favorites WHERE user_id = ? AND exam_id = ?', args: [uid, examId] });
      return res.status(200).json({ success: true });
    }

    return jsonError(res, 405, 'Méthode non autorisée');
  } catch (error) {
    console.error('[API favorites]', error);
    return jsonError(res, error?.code === 'UID_REQUIRED' ? 400 : 500, error?.message || 'Erreur serveur');
  }
}
