import { verifyBearer } from './firebase-admin.js';
import { execute } from './db.js';

export async function verifyAdmin(req) {
  const decoded = await verifyBearer(req);
  const uid = String(decoded.uid || '').trim();
  if (!uid) throw Object.assign(new Error('ADMIN_REQUIRED'), { code: 'ADMIN_REQUIRED' });

  const result = await execute({
    sql: 'SELECT uid, role, status FROM users WHERE uid = ? LIMIT 1',
    args: [uid]
  });
  const user = result.rows?.[0];
  const role = String(user?.role || '').toLowerCase();
  const status = String(user?.status || 'active').toLowerCase();

  if (!['admin', 'administrator', 'superadmin'].includes(role) || ['blocked', 'disabled', 'suspended'].includes(status)) {
    throw Object.assign(new Error('ADMIN_REQUIRED'), { code: 'ADMIN_REQUIRED' });
  }
  return { decoded, user };
}
