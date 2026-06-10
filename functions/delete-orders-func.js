const functions = require("firebase-functions/v1");
const { getFirestore } = require("firebase-admin/firestore");

exports.deleteAllOrdersManual = functions.region('us-central1').https.onRequest(async (req, res) => {
    console.log("⚠️ INICIANDO BORRADO TOTAL DE ÓRDENES (HTTPS Request)...");

    const db = getFirestore();
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef.get();

    if (snapshot.empty) {
        return res.status(200).send({ message: "✅ No hay órdenes para borrar." });
    }

    console.log(`🔍 Se encontraron ${snapshot.size} órdenes para eliminar.`);

    const batchSize = 500;
    let batch = db.batch();
    let count = 0;
    let totalDeleted = 0;

    for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        count++;

        if (count >= batchSize) {
            await batch.commit();
            totalDeleted += count;
            console.log(`🗑️ Eliminadas ${totalDeleted} órdenes...`);
            batch = db.batch();
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
        totalDeleted += count;
    }

    console.log(`✅ BORRADO COMPLETADO: Se eliminaron un total de ${totalDeleted} órdenes.`);
    return res.status(200).send({
        success: true,
        deletedCount: totalDeleted,
        message: `Se eliminaron ${totalDeleted} órdenes exitosamente.`
    });
});
