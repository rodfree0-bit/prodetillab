const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const collectionsToDelete = [
  'orders',
  'payments',
  'bonuses',
  'deductions',
  'payroll_periods',
  'discounts'
];

async function deleteCollection(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve, reject);
  });
}

async function deleteQueryBatch(db, query, resolve, reject) {
  try {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
      resolve();
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Recurse on the next batch
    process.nextTick(() => {
      deleteQueryBatch(db, query, resolve, reject);
    });
  } catch (error) {
    reject(error);
  }
}

async function main() {
  console.log('🚀 Iniciando limpieza de base de datos...');
  for (const collectionName of collectionsToDelete) {
    try {
      console.log(`⏳ Eliminando documentos de la colección: ${collectionName}...`);
      await deleteCollection(collectionName);
      console.log(`✅ Colección ${collectionName} eliminada con éxito.`);
    } catch (error) {
      console.error(`❌ Error eliminando la colección ${collectionName}:`, error.message);
    }
  }

  // Opcional: restablecer puntos de lealtad en clientes
  try {
    console.log('⏳ Restableciendo puntos de lealtad de los clientes a 0...');
    const usersSnapshot = await db.collection('users').get();
    const batch = db.batch();
    let count = 0;

    usersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      // Solo resetear si es cliente y tiene puntos
      if (data.role === 'client' && (data.loyaltyPoints > 0 || (data.claimedMilestones && data.claimedMilestones.length > 0))) {
        batch.update(doc.ref, {
          loyaltyPoints: 0,
          claimedMilestones: []
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`✅ Se restablecieron los puntos de lealtad para ${count} clientes.`);
    } else {
      console.log('✅ No había clientes con puntos de lealtad para restablecer.');
    }
  } catch (error) {
    console.error('❌ Error restableciendo puntos de lealtad:', error.message);
  }

  console.log('🎉 Limpieza completada con éxito.');
  process.exit(0);
}

main();
