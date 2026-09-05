const admin = require('firebase-admin');
const { turso } = require('../db');

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : '';
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
      throw new Error('FIREBASE_ENV_MISSING');
    }
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey
      })
    });
  }
  return admin;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function dayKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(date);
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function lastNDays(n) {
  const out = [];
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    out.push(d);
  }
  return out;
}

function lastNMonths(n) {
  const out = [];
  const now = new Date();
  now.setUTCDate(1);
  now.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCMonth(now.getUTCMonth() - i);
    out.push(d);
  }
  return out;
}

async function buildAdminStats() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);

  // Récupération des données depuis Turso
  const [userRes, examRes] = await Promise.all([
    turso.execute("SELECT * FROM users"),
    turso.execute("SELECT * FROM epreuves")
  ]);

  let reportDocs = [];
  try {
    const reportRes = await turso.execute("SELECT * FROM reports");
    reportDocs = reportRes.rows;
  } catch (e) {
    reportDocs = [];
  }

  const userDocs = userRes.rows;
  const examDocs = examRes.rows;

  let usersThisWeek = 0;
  const usersByMonthMap = new Map();
  for (const data of userDocs) {
    const createdAt = toDate(data.created_at || data.createdAt);
    if (createdAt && createdAt >= weekStart) usersThisWeek++;
    if (createdAt) {
      const key = monthKey(createdAt);
      usersByMonthMap.set(key, (usersByMonthMap.get(key) || 0) + 1);
    }
  }

  let examsThisWeek = 0;
  let pending = 0;
  let totalDownloads = 0;
  let totalViews = 0;
  const subjectsMap = new Map();
  const examsByDayMap = new Map();
  const downloadsByMonthMap = new Map();

  for (const data of examDocs) {
    const createdAt = toDate(data.created_at || data.createdAt);
    const status = String(data.status || 'approved');
    const downloads = Number(data.download_count || data.downloadCount || 0) || 0;
    const views = Number(data.view_count || data.viewCount || 0) || 0;

    if (createdAt && createdAt >= weekStart) examsThisWeek++;
    if (status === 'pending') pending++;
    totalDownloads += downloads;
    totalViews += views;

    if (status === 'approved') {
      const subject = String(data.matiere || data.subject || 'Non classée').trim() || 'Non classée';
      subjectsMap.set(subject, (subjectsMap.get(subject) || 0) + 1);
    }

    if (createdAt) {
      const dKey = dayKey(createdAt);
      examsByDayMap.set(dKey, (examsByDayMap.get(dKey) || 0) + 1);

      const mKey = monthKey(createdAt);
      downloadsByMonthMap.set(mKey, (downloadsByMonthMap.get(mKey) || 0) + downloads);
    }
  }

  let pendingReports = 0;
  for (const data of reportDocs) {
    if (data.status === 'pending') pendingReports++;
  }

  const examsByDay = lastNDays(7).map(d => ({
    label: new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(d),
    value: examsByDayMap.get(dayKey(d)) || 0
  }));

  const subjects = [...subjectsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([label, value]) => ({ label, value }));

  const downloadsByMonth = lastNMonths(12).map(d => ({
    label: new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(d),
    value: downloadsByMonthMap.get(monthKey(d)) || 0
  }));

  const usersByMonth = lastNMonths(12).map(d => ({
    label: new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(d),
    value: usersByMonthMap.get(monthKey(d)) || 0
  }));

  const result = {
    version: 2,
    generatedAt: new Date().toISOString(),
    stats: {
      users: usersThisWeek,
      exams: examsThisWeek,
      pending,
      reports: pendingReports,
      downloads: totalDownloads,
      views: totalViews
    },
    charts: {
      examsByDay,
      subjects,
      downloadsByMonth,
      usersByMonth
    },
    meta: {
      totalUsers: userDocs.length,
      totalExams: examDocs.length,
      totalReports: reportDocs.length,
      downloadsChartMode: 'exam_creation_month_cumulative',
      generatedBy: 'vercel'
    }
  };

  // Stockage du rapport compilé dans Turso
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS admin_stats (
      id TEXT PRIMARY KEY,
      data TEXT,
      updated_at TEXT
    );
  `);

  await turso.execute({
    sql: `INSERT OR REPLACE INTO admin_stats (id, data, updated_at) VALUES (?, ?, ?)`,
    args: ['overview', JSON.stringify(result), new Date().toISOString()]
  });

  return result;
}

async function verifyAdminToken(authHeader) {
  const sdk = getFirebaseAdmin();
  if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED');
  const decoded = await sdk.auth().verifyIdToken(authHeader.slice(7));
  
  const userRes = await turso.execute({
    sql: "SELECT role FROM users WHERE uid = ?",
    args: [decoded.uid]
  });

  const user = userRes.rows[0];
  if (!user || user.role !== 'admin') throw new Error('ADMIN_REQUIRED');
  
  return decoded;
}

module.exports = { getFirebaseAdmin, buildAdminStats, verifyAdminToken };
