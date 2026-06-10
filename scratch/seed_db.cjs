// seed_db.cjs
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 59 local photos from blog.html
const localPhotos = [
    { src: "assets/gallery_processed/20240307_165135.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/20240308_173506.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/20260124_164651.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/E8B41AA1-D505-4ABE-926B-612F3634D9DE.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_0200.jpg", title: "Detailing Result", desc: "Exterior wash & detail · Los Angeles" },
    { src: "assets/gallery_processed/IMG_0201.jpg", title: "Detailing Result", desc: "Exterior wash & detail · Los Angeles" },
    { src: "assets/gallery_processed/IMG_0206.jpg", title: "Ceramic Sealant", desc: "SiO2 ceramic spray sealant applied" },
    { src: "assets/gallery_processed/IMG_0207.jpg", title: "Ceramic Sealant", desc: "SiO2 ceramic spray sealant applied" },
    { src: "assets/gallery_processed/IMG_0209.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_0259.jpg", title: "Interior Detail", desc: "Full interior deep clean" },
    { src: "assets/gallery_processed/IMG_0312.jpg", title: "Detailing Result", desc: "Exterior wash & detail" },
    { src: "assets/gallery_processed/IMG_0313.jpg", title: "Detailing Result", desc: "Exterior wash & detail" },
    { src: "assets/gallery_processed/IMG_0317.jpg", title: "Paint Correction", desc: "Single-stage paint correction" },
    { src: "assets/gallery_processed/IMG_0321.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_0322.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_0557.jpg", title: "Snow Foam Wash", desc: "Two-step touchless pre-soak foam" },
    { src: "assets/gallery_processed/IMG_0558.jpg", title: "Snow Foam Wash", desc: "Two-step touchless pre-soak foam" },
    { src: "assets/gallery_processed/IMG_0559.jpg", title: "Snow Foam Wash", desc: "Two-step touchless pre-soak foam" },
    { src: "assets/gallery_processed/IMG_0560.jpg", title: "Snow Foam Wash", desc: "Two-step touchless pre-soak foam" },
    { src: "assets/gallery_processed/IMG_0594.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_0627.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_0743.jpg", title: "Wheel Detail", desc: "Iron decontamination & wheel polish" },
    { src: "assets/gallery_processed/IMG_0744.jpg", title: "Wheel Detail", desc: "Iron decontamination & wheel polish" },
    { src: "assets/gallery_processed/IMG_0745.jpg", title: "Wheel Detail", desc: "Iron decontamination & wheel polish" },
    { src: "assets/gallery_processed/IMG_0746.jpg", title: "Wheel Detail", desc: "Iron decontamination & wheel polish" },
    { src: "assets/gallery_processed/IMG_0897.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_0899.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_0902.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_0904.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_1025.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_1436-EDIT.jpg", title: "Paint Correction", desc: "Multi-stage paint correction & polish" },
    { src: "assets/gallery_processed/IMG_1437.jpg", title: "Paint Correction", desc: "Multi-stage paint correction & polish" },
    { src: "assets/gallery_processed/IMG_1456.jpg", title: "Interior Detail", desc: "Full interior deep clean & steam" },
    { src: "assets/gallery_processed/IMG_1457.jpg", title: "Interior Detail", desc: "Full interior deep clean & steam" },
    { src: "assets/gallery_processed/IMG_1458.jpg", title: "Interior Detail", desc: "Full interior deep clean & steam" },
    { src: "assets/gallery_processed/IMG_3559.jpg", title: "Detailing Result", desc: "Premium mobile detailing · LA" },
    { src: "assets/gallery_processed/IMG_3565.jpg", title: "Detailing Result", desc: "Premium mobile detailing · LA" },
    { src: "assets/gallery_processed/IMG_3568.jpg", title: "Exterior Detail", desc: "Hand wash & clay bar treatment" },
    { src: "assets/gallery_processed/IMG_3569.jpg", title: "Exterior Detail", desc: "Hand wash & clay bar treatment" },
    { src: "assets/gallery_processed/IMG_3570.jpg", title: "Exterior Detail", desc: "Hand wash & clay bar treatment" },
    { src: "assets/gallery_processed/IMG_3572.jpg", title: "Detailing Result", desc: "Premium mobile detailing · LA" },
    { src: "assets/gallery_processed/IMG_3573.jpg", title: "Detailing Result", desc: "Premium mobile detailing · LA" },
    { src: "assets/gallery_processed/IMG_3576.jpg", title: "Ceramic Coating", desc: "Professional ceramic coating application" },
    { src: "assets/gallery_processed/IMG_3577.jpg", title: "Ceramic Coating", desc: "Professional ceramic coating application" },
    { src: "assets/gallery_processed/IMG_5069.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_5070.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_5087.jpg", title: "Snow Foam", desc: "Active foam pre-soak phase" },
    { src: "assets/gallery_processed/IMG_5088.jpg", title: "Snow Foam", desc: "Active foam pre-soak phase" },
    { src: "assets/gallery_processed/IMG_5089.jpg", title: "Snow Foam", desc: "Active foam pre-soak phase" },
    { src: "assets/gallery_processed/IMG_5090.jpg", title: "Snow Foam", desc: "Active foam pre-soak phase" },
    { src: "assets/gallery_processed/IMG_5179.jpg", title: "Detailing Result", desc: "Premium mobile detailing · LA" },
    { src: "assets/gallery_processed/IMG_5181.jpg", title: "Detailing Result", desc: "Premium mobile detailing · LA" },
    { src: "assets/gallery_processed/IMG_5203.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_5204.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" },
    { src: "assets/gallery_processed/IMG_5207.jpg", title: "Interior Detail", desc: "Premium interior cleaning" },
    { src: "assets/gallery_processed/IMG_5208.jpg", title: "Interior Detail", desc: "Premium interior cleaning" },
    { src: "assets/gallery_processed/IMG_5211.jpg", title: "Detailing Result", desc: "Premium mobile detailing · LA" },
    { src: "assets/gallery_processed/IMG_5212.jpg", title: "Detailing Result", desc: "Premium mobile detailing · LA" },
    { src: "assets/gallery_processed/IMG_5327.jpg", title: "Detailing Result", desc: "Premium mobile detailing · Los Angeles" }
];

async function seed() {
  const collectionRef = db.collection("published_posts");

  console.log("1. Deleting existing posts...");
  const snapshot = await collectionRef.get();
  const batchDelete = db.batch();
  snapshot.docs.forEach((doc) => {
    batchDelete.delete(doc.ref);
  });
  await batchDelete.commit();
  console.log("Deleted existing posts.");

  console.log("2. Seeding default gallery...");
  const baseTime = Date.now();
  // We want to add these so they show in sequential order (oldest first, i.e., localPhotos[0] at the end, localPhotos[last] at the top)
  for (let i = 0; i < localPhotos.length; i++) {
    const photo = localPhotos[i];
    // To preserve sequence, set publishedAt with incremental offsets
    const publishedAt = new Date(baseTime - (localPhotos.length - i) * 60000);
    
    await collectionRef.add({
      photos: [photo.src],
      vehicle: photo.title,
      service: photo.title,
      location: "Los Angeles",
      category: "General Detailing",
      caption: photo.desc,
      publishedAt: admin.firestore.Timestamp.fromDate(publishedAt)
    });
  }
  console.log("Seeding complete! 59 photos added to Firestore.");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
