import { execute } from '../lib/db.js';

const db = {
  execute: (stmt) => typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }),
  batch: async (stmts) => {
    for (const stmt of stmts) {
      await (typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] }));
    }
  }
};

import {  buildAdminStats  } from '../lib/admin-stats';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });

  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization || '';
  const expected = cronSecret ? `Bearer ${cronSecret}` : '';

  if (!cronSecret || authorization !== expected) {
    return res.status(401).json({ error: 'Non autorisé.' });
  }

  try {
    const data = await buildAdminStats();
    return res.status(200).json({ ok: true, generatedAt: data.generatedAt });
  } catch (err) {
    console.error('[REFRESH ADMIN STATS]', err);
    return res.status(500).json({ error: 'Actualisation des statistiques impossible.' });
  }
};