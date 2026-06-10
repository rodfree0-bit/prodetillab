import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const posts = [
    {
        id: "gallery_tesla",
        photos: ["assets/gallery_tesla.jpg"],
        vehicle: "Tesla Model 3",
        service: "Onyx Showroom Detail",
        location: "Beverly Hills",
        caption: "Deep interior steam extraction combined with 3-month ceramic paint sealant. Glassy reflections in Beverly Hills sun.",
        publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
    },
    {
        id: "gallery_chevy",
        photos: ["assets/gallery_chevy.jpg"],
        vehicle: "Chevy Tahoe",
        service: "Showroom Full Detail",
        location: "Downey",
        caption: "Full exterior clay bar decontamination and plastic trim restoration. Restoring the deep black shine to this Tahoe.",
        publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    },
    {
        id: "gallery_jaguar",
        photos: ["assets/gallery_jaguar.jpg"],
        vehicle: "Jaguar F-Type",
        service: "Multi-Stage Paint Correction",
        location: "Santa Monica",
        caption: "Removing 85% of swirl marks and spiderweb scratches to bring back the original mirror reflection on this Jaguar.",
        publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    },
    {
        id: "gallery_jeep",
        photos: ["assets/gallery_jeep.jpg"],
        vehicle: "Jeep Wrangler",
        service: "Deep Interior Detail & Wash",
        location: "Culver City",
        caption: "Removing beach sand and mud from the carpets and conditioning the leather seats. Ready for the next adventure.",
        publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    },
    {
        id: "gallery_subaru",
        photos: ["assets/gallery_subaru.jpg"],
        vehicle: "Subaru WRX",
        service: "Basic Wash & Wax Protection",
        location: "Long Beach",
        caption: "Tire shine, rim care, and high gloss wax application. Clean wheels and deep blue reflections in Long Beach.",
        publishedAt: new Date()
    }
];

async function seed() {
    for (const post of posts) {
        await db.collection('published_posts').doc(post.id).set(post);
        console.log(`Added post: ${post.id}`);
    }
    console.log("Gallery seeded successfully!");
}

seed();
