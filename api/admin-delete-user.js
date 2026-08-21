// HosBac - suppression complète d'un compte utilisateur par un administrateur.
// Les épreuves de /epreuves NE SONT PAS supprimées.
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : '';
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey
    })
  });
}

async function verifyAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED');
  const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
  const snap = await admin.firestore().collection('users').doc(decoded.uid).get();
  if (!snap.exists || snap.data().role !== 'admin') throw new Error('ADMIN_REQUIRED');
  return decoded;
}

async function deleteQueryDocs(query, batchSize=400) {
  while (true) {
    const snap = await query.limit(batchSize).get();
    if (snap.empty) break;
    const batch = admin.firestore().batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    if (snap.size < batchSize) break;
  }
}

async function deleteUserSubcollections(userRef) {
  const collections = await userRef.listCollections();
  for (const col of collections) {
    await deleteQueryDocs(col.orderBy('__name__'));
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Méthode non autorisée.'});
  try {
    const adminUser = await verifyAdmin(req.headers.authorization);
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({error:'userId manquant.'});
    if (userId === adminUser.uid) return res.status(400).json({error:'Suppression de son propre compte interdite.'});

    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);

    // Supprime d'abord le compte Firebase Auth. Les épreuves Firestore restent intactes.
    await admin.auth().deleteUser(userId);

    // Supprime les sous-collections du document utilisateur, puis le document lui-même.
    await deleteUserSubcollections(userRef);
    await userRef.delete().catch(() => {});

    // Nettoyage des anciennes collections top-level liées à l'utilisateur.
    await deleteQueryDocs(db.collection('favorites').where('userId','==',userId));
    await deleteQueryDocs(db.collection('notifications').where('userId','==',userId));
    await deleteQueryDocs(db.collection('reports').where('userId','==',userId));

    return res.status(200).json({ok:true, message:'Utilisateur supprimé. Les épreuves publiées ont été conservées.'});
  } catch (err) {
    console.error('[ADMIN DELETE USER]', err);
    if (err.message === 'AUTH_REQUIRED' || err.code === 'auth/id-token-expired' || err.code === 'auth/argument-error') return res.status(401).json({error:'Authentification requise.'});
    if (err.message === 'ADMIN_REQUIRED') return res.status(403).json({error:'Droits administrateur requis.'});
    if (err.code === 'auth/user-not-found') return res.status(404).json({error:'Utilisateur introuvable.'});
    return res.status(500).json({error:'Suppression impossible pour le moment.'});
  }
};
