const admin = require('firebase-admin');

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

async function getAllDocs(db, collectionName) {
  const snap = await db.collection(collectionName).get();
  return snap.docs;
}

async function buildAdminStats() {
  const sdk = getFirebaseAdmin();
  const db = sdk.firestore();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);

  // This is an intentional refresh operation, not a dashboard read.
  // It scans source collections once and stores a compact aggregate document.
  const [userDocs, examDocs, reportDocs] = await Promise.all([
    getAllDocs(db, 'users'),
    getAllDocs(db, 'epreuves'),
    getAllDocs(db, 'reports')
  ]);

  let usersThisWeek = 0;
  const usersByMonthMap = new Map();
  for (const doc of userDocs) {
    const data = doc.data() || {};
    const createdAt = toDate(data.createdAt);
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

  for (const doc of examDocs) {
    const data = doc.data() || {};
    const createdAt = toDate(data.createdAt);
    const status = String(data.status || '');
    const downloads = Number(data.downloadCount || 0) || 0;
    const views = Number(data.viewCount || 0) || 0;

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

      // Existing HosBac documents only contain cumulative downloadCount/viewCount,
      // not per-download timestamps. Therefore this chart is a cumulative total
      // grouped by the exam's creation month, not a historical event log.
      const mKey = monthKey(createdAt);
      downloadsByMonthMap.set(mKey, (downloadsByMonthMap.get(mKey) || 0) + downloads);
    }
  }

  let pendingReports = 0;
  for (const doc of reportDocs) {
    const data = doc.data() || {};
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
    generatedAt: sdk.firestore.Timestamp.now(),
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

  await db.collection('admin_stats').doc('overview').set(result, { merge: true });
  return result;
}

async function verifyAdminToken(authHeader) {
  const sdk = getFirebaseAdmin();
  if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED');
  const decoded = await sdk.auth().verifyIdToken(authHeader.slice(7));
  const snap = await sdk.firestore().collection('users').doc(decoded.uid).get();
  if (!snap.exists || snap.data()?.role !== 'admin') throw new Error('ADMIN_REQUIRED');
  return decoded;
}

module.exports = { getFirebaseAdmin, buildAdminStats, verifyAdminToken };
