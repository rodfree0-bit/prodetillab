const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Paquetes de servicio
const packages = [
    {
        id: "package_wash_vacuum",
        name: "Basic Wash",
        description: "Complete interior and exterior refresh featuring vacuuming, window cleaning, door jambs detailing, tire shine, and compressed air interior blowout.",
        price: {
            "compact_car": 50,
            "midsize_sedan": 55,
            "suv": 70,
            "large_suv": 80,
            "compact_truck": 70,
            "fullsize_truck": 80,
            "heavy_duty_truck": 95,
            "minivan": 80,
            "cargo_van": 90,
            "class_b_rv": 160,
            "class_c_rv": 220,
            "class_a_rv": 300,
            "semi_truck_cab": 160,
            "semi_truck_trailer": 300,
            "sedan": 55,
            "SUV": 70,
            "Truck": 80,
            "Van": 80
        },
        duration: "1.5 hours",
        features: [
            "Thorough interior vacuuming",
            "Compressed air interior blowout (vents, cracks, crevices)",
            "Interior window & glass cleaning",
            "Door jambs detailing & cleanup",
            "Tire shine application & rim care",
            "Microfiber panel wipe-down of hard surfaces"
        ],
        sortOrder: 2,
    },
    {
        id: "package_diamond",
        name: "Deep Interior Detail",
        description: "Only interior deep cleaning. Deep seat, carpet, door panels, and dashboard scrub, floor mats wash, and premium leather/plastic conditioning. (No exterior wash included)",
        price: {
            "compact_car": 200,
            "midsize_sedan": 200,
            "suv": 225,
            "large_suv": 255,
            "compact_truck": 225,
            "fullsize_truck": 255,
            "heavy_duty_truck": 255,
            "minivan": 225,
            "cargo_van": 255,
            "class_b_rv": 400,
            "class_c_rv": 600,
            "class_a_rv": 750,
            "sedan": 200,
            "SUV": 225,
            "Truck": 255,
            "Van": 225
        },
        duration: "2.5 hours",
        features: [
            "Only interior deep cleaning",
            "Deep seat cleaning & hot-water steam extraction",
            "Door panels, dashboard & carpet scrub",
            "Floor mats deep wash & extraction",
            "Window & glass cleaning to crystal clarity",
            "Plastic restoration & leather conditioning (tailored to materials)",
            "No exterior wash included"
        ],
        sortOrder: 3,
    },
    {
        id: "package_onyx",
        name: "Showroom Full Detail",
        description: "Complete interior deep clean combined with exterior clay bar, premium 3-month ceramic paint sealant protection, tire and wheel detailing, and plastic trim restoration.",
        price: {
            "compact_car": 350,
            "midsize_sedan": 350,
            "suv": 400,
            "large_suv": 450,
            "compact_truck": 400,
            "fullsize_truck": 450,
            "heavy_duty_truck": 450,
            "minivan": 400,
            "cargo_van": 450,
            "class_b_rv": 1200,
            "class_c_rv": 1600,
            "class_a_rv": 2200,
            "sedan": 350,
            "SUV": 400,
            "Truck": 450,
            "Van": 400
        },
        duration: "5+ hours",
        features: [
            "Deep interior cleaning & trunk vacuum",
            "Deep seat cleaning & hot-water steam extraction",
            "Door panels, dashboard & carpet scrub",
            "Floor mats deep wash & extraction",
            "Interior & exterior window glass cleaning to crystal clarity",
            "Plastic restoration & leather conditioning (interior)",
            "Clay bar paint decontamination & prep",
            "Premium 3-month ceramic paint sealant protection (exterior)",
            "Deep wheel & rim detailing & tire shine gloss",
            "Exterior plastic trim restoration & hydration"
        ],
        sortOrder: 4,
    }
];

// Add-ons
const addons = [
    {
        id: "addon_engine_bay",
        name: "Engine Bay Detailing",
        description: "Professional degreasing and cleaning of the engine compartment for a factory-fresh look.",
        duration: "30 min",
        price: {
            "compact_car": 70,
            "midsize_sedan": 70,
            "suv": 70,
            "large_suv": 70,
            "compact_truck": 70,
            "fullsize_truck": 70,
            "heavy_duty_truck": 70,
            "minivan": 70,
            "cargo_van": 70,
            "class_b_rv": 70,
            "class_c_rv": 70,
            "class_a_rv": 70,
            "semi_truck_cab": 70,
            "semi_truck_trailer": 70,
            "sedan": 70,
            "SUV": 70,
            "Truck": 70,
            "Van": 70
        }
    },
    {
        id: "addon_headlight",
        name: "Headlight Restoration",
        description: "Multi-step process to remove haze and oxidation, restoring factory clarity to your headlight lenses.",
        duration: "45 min",
        price: {
            "compact_car": 100,
            "midsize_sedan": 100,
            "suv": 100,
            "large_suv": 100,
            "compact_truck": 100,
            "fullsize_truck": 100,
            "heavy_duty_truck": 100,
            "minivan": 100,
            "cargo_van": 100,
            "class_b_rv": 100,
            "class_c_rv": 100,
            "class_a_rv": 100,
            "semi_truck_cab": 100,
            "semi_truck_trailer": 100,
            "sedan": 100,
            "SUV": 100,
            "Truck": 100,
            "Van": 100
        }
    },
    {
        id: "addon_ceramic_7yr",
        name: "Ceramic Coating (3-5 Yr)",
        description: "Elite nano-ceramic protection providing extreme hydrophobics, depth of gloss, and lasting defense for 3 to 5 years.",
        duration: "4-6 hours",
        price: {
            "compact_car": 400,
            "midsize_sedan": 400,
            "suv": 500,
            "large_suv": 600,
            "compact_truck": 500,
            "fullsize_truck": 600,
            "heavy_duty_truck": 750,
            "minivan": 600,
            "cargo_van": 700,
            "class_b_rv": 1000,
            "class_c_rv": 1500,
            "class_a_rv": 2000,
            "semi_truck_cab": 1000,
            "semi_truck_trailer": 2000,
            "sedan": 400,
            "SUV": 500,
            "Truck": 600,
            "Van": 600
        }
    },
    {
        id: "addon_water_spots",
        name: "Water Spot Removal",
        description: "Safely removes stubborn mineral deposits and acid rain spots from your paint and glass.",
        duration: "1 hour",
        price: {
            "compact_car": 70,
            "midsize_sedan": 70,
            "suv": 90,
            "large_suv": 110,
            "compact_truck": 90,
            "fullsize_truck": 110,
            "heavy_duty_truck": 130,
            "minivan": 110,
            "cargo_van": 110,
            "class_b_rv": 250,
            "class_c_rv": 350,
            "class_a_rv": 500,
            "semi_truck_cab": 200,
            "semi_truck_trailer": 500,
            "sedan": 70,
            "SUV": 90,
            "Truck": 110,
            "Van": 110
        }
    },
    {
        id: "addon_shampoo",
        name: "Seat Shampoo & Extraction",
        description: "Deep hot-water extraction for fabric seats to remove deep-seated stains and bacteria.",
        duration: "1 hour",
        price: {
            "compact_car": 50,
            "midsize_sedan": 50,
            "suv": 70,
            "large_suv": 90,
            "compact_truck": 70,
            "fullsize_truck": 90,
            "heavy_duty_truck": 110,
            "minivan": 90,
            "cargo_van": 90,
            "class_b_rv": 200,
            "class_c_rv": 300,
            "class_a_rv": 400,
            "semi_truck_cab": 100,
            "semi_truck_trailer": 150,
            "sedan": 50,
            "SUV": 70,
            "Truck": 90,
            "Van": 90
        }
    },
    {
        id: "addon_leather_ceramic",
        name: "Interior Leather Ceramic",
        description: "High-tech protection for leather to prevent UV damage, dye transfer from jeans, and cracking. Includes professional deep cleaning.",
        duration: "1.5 - 5 hours",
        price: {
            "compact_car": 200,
            "midsize_sedan": 350,
            "suv": 350,
            "large_suv": 550,
            "compact_truck": 350,
            "fullsize_truck": 550,
            "heavy_duty_truck": 550,
            "minivan": 550,
            "cargo_van": 550,
            "class_b_rv": 800,
            "class_c_rv": 1200,
            "class_a_rv": 1500,
            "semi_truck_cab": 600,
            "semi_truck_trailer": 800,
            "sedan": 200,
            "SUV": 350,
            "Truck": 550,
            "Van": 550
        }
    },
    {
        id: "addon_headliner",
        name: "Headliner Cleaning",
        description: "Delicate deep cleaning of the interior headliner to remove stains, smoke residue, and dust.",
        duration: "30 min",
        price: {
            "compact_car": 150,
            "midsize_sedan": 150,
            "suv": 150,
            "large_suv": 150,
            "compact_truck": 150,
            "fullsize_truck": 150,
            "heavy_duty_truck": 150,
            "minivan": 150,
            "cargo_van": 150,
            "class_b_rv": 150,
            "class_c_rv": 150,
            "class_a_rv": 150,
            "semi_truck_cab": 150,
            "semi_truck_trailer": 150,
            "sedan": 150,
            "SUV": 150,
            "Truck": 150,
            "Van": 150
        }
    },
    {
        id: "addon_ceramic_rims",
        name: "Ceramic Rims Coating",
        description: "Dedicated ceramic protection for wheels to repel brake dust, grime, and make cleaning effortless.",
        duration: "1 hour",
        price: {
            "compact_car": 200,
            "midsize_sedan": 200,
            "suv": 200,
            "large_suv": 200,
            "compact_truck": 200,
            "fullsize_truck": 200,
            "heavy_duty_truck": 200,
            "minivan": 200,
            "cargo_van": 200,
            "class_b_rv": 200,
            "class_c_rv": 200,
            "class_a_rv": 200,
            "semi_truck_cab": 200,
            "semi_truck_trailer": 200,
            "sedan": 200,
            "SUV": 200,
            "Truck": 200,
            "Van": 200
        }
    },
    {
        id: "addon_ceramic_windows",
        name: "Ceramic Windows Coating",
        description: "Professional glass coating for ultimate rain repellency, ice prevention, and crystal-clear visibility.",
        duration: "45 min",
        price: {
            "compact_car": 200,
            "midsize_sedan": 200,
            "suv": 200,
            "large_suv": 200,
            "compact_truck": 200,
            "fullsize_truck": 200,
            "heavy_duty_truck": 200,
            "minivan": 200,
            "cargo_van": 200,
            "class_b_rv": 200,
            "class_c_rv": 200,
            "class_a_rv": 200,
            "semi_truck_cab": 200,
            "semi_truck_trailer": 200,
            "sedan": 200,
            "SUV": 200,
            "Truck": 200,
            "Van": 200
        }
    },
    {
        id: "addon_polish_1step",
        name: "1-Step Polish (Gloss Enhancement)",
        description: "A single-stage machine polish to significantly enhance paint clarity, gloss, and reflection depth.",
        duration: "2-3 hours",
        price: {
            "compact_car": 200,
            "midsize_sedan": 200,
            "suv": 250,
            "large_suv": 300,
            "compact_truck": 250,
            "fullsize_truck": 300,
            "heavy_duty_truck": 350,
            "minivan": 300,
            "cargo_van": 300,
            "class_b_rv": 600,
            "class_c_rv": 900,
            "class_a_rv": 1200,
            "semi_truck_cab": 500,
            "semi_truck_trailer": 1000,
            "sedan": 200,
            "SUV": 250,
            "Truck": 300,
            "Van": 300
        }
    },
    {
        id: "addon_paint_correction",
        name: "Multi-Stage Paint Correction",
        description: "Intensive machine compounding and polishing to remove 80-90% of swirl marks and surface defects.",
        duration: "5-8 hours",
        price: {
            "compact_car": 500,
            "midsize_sedan": 500,
            "suv": 650,
            "large_suv": 800,
            "compact_truck": 650,
            "fullsize_truck": 800,
            "heavy_duty_truck": 1000,
            "minivan": 800,
            "cargo_van": 800,
            "class_b_rv": 1500,
            "class_c_rv": 2500,
            "class_a_rv": 4000,
            "semi_truck_cab": 1200,
            "semi_truck_trailer": 3000,
            "sedan": 500,
            "SUV": 650,
            "Truck": 800,
            "Van": 800
        }
    },
    {
        id: "addon_upholstery_conditioner",
        name: "Premium Upholstery Conditioner",
        description: "Specialized formula that conditions and protects interior surfaces for up to 2 weeks. Prevents cracking and maintains a factory-fresh look.",
        duration: "30-45 min",
        price: {
            "compact_car": 50,
            "midsize_sedan": 50,
            "suv": 65,
            "large_suv": 65,
            "compact_truck": 65,
            "fullsize_truck": 65,
            "heavy_duty_truck": 65,
            "minivan": 65,
            "cargo_van": 65,
            "class_b_rv": 100,
            "class_c_rv": 150,
            "class_a_rv": 200,
            "semi_truck_cab": 80,
            "semi_truck_trailer": 100,
            "sedan": 50,
            "SUV": 65,
            "Truck": 65,
            "Van": 65
        }
    },
    {
        id: "addon_clay_wax",
        name: "Paint Clay Bar & Wax Protection",
        description: "Professional paint decontamination using a clay bar to remove embedded contaminants, followed by a high-gloss wax providing 1 month of protection.",
        duration: "1 - 2 hours",
        price: {
            "compact_car": 80,
            "midsize_sedan": 80,
            "suv": 100,
            "large_suv": 120,
            "compact_truck": 100,
            "fullsize_truck": 120,
            "heavy_duty_truck": 120,
            "minivan": 120,
            "cargo_van": 120,
            "class_b_rv": 250,
            "class_c_rv": 350,
            "class_a_rv": 500,
            "semi_truck_cab": 200,
            "semi_truck_trailer": 400,
            "sedan": 80,
            "SUV": 100,
            "Truck": 120,
            "Van": 120
        }
    }
];

// Tipos de vehículos
const vehicleTypes = [
    { id: 'compact_car', name: 'Compact Car', icon: 'directions_car' },
    { id: 'sedan', name: 'Mid-Size Sedan', icon: 'directions_car' },
    { id: 'large_sedan', name: 'Large Sedan', icon: 'directions_car' },
    { id: 'suv', name: 'SUV / Compact SUV', icon: 'airport_shuttle' },
    { id: 'midsize_suv', name: 'Mid-Size SUV', icon: 'airport_shuttle' },
    { id: 'large_suv', name: 'Large SUV', icon: 'airport_shuttle' },
    { id: 'compact_truck', name: 'Compact Pickup', icon: 'local_shipping' },
    { id: 'fullsize_truck', name: 'Full-Size Pickup', icon: 'local_shipping' },
    { id: 'heavy_duty_truck', name: 'Heavy Duty Truck', icon: 'local_shipping' },
    { id: 'minivan', name: 'Minivan', icon: 'airport_shuttle' },
    { id: 'cargo_van', name: 'Cargo Van', icon: 'airport_shuttle' },
    { id: 'class_b_rv', name: 'Class B RV', icon: 'airport_shuttle' },
    { id: 'class_c_rv', name: 'Class C RV', icon: 'airport_shuttle' },
    { id: 'class_a_rv', name: 'Class A RV', icon: 'airport_shuttle' },
    { id: 'semi_truck_cab', name: 'Semi-Truck (Cab)', icon: 'local_shipping' },
    { id: 'semi_truck_trailer', name: 'Semi-Truck (Trailer)', icon: 'local_shipping' },
    { id: 'motorcycle', name: 'Motorcycle', icon: 'two_wheeler' },
    { id: 'luxury', name: 'Luxury/Sports', icon: 'sports_car' }
];

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seed...\n');

        // Seed packages
        console.log('📦 Creating service packages...');
        for (const pkg of packages) {
            await db.collection('packages').doc(pkg.id).set(pkg);
            console.log(`  ✅ ${pkg.name}`);
        }

        // Seed addons
        console.log('\n🔧 Creating add-ons...');
        for (const addon of addons) {
            await db.collection('addons').doc(addon.id).set(addon);
            console.log(`  ✅ ${addon.name}`);
        }

        // Seed vehicle types
        console.log('\n🚗 Creating vehicle types...');
        for (const type of vehicleTypes) {
            await db.collection('vehicleTypes').doc(type.id).set(type);
            console.log(`  ✅ ${type.name}`);
        }

        console.log('\n🎉 Database seeded successfully!');
        console.log('\n📊 Summary:');
        console.log(`  - ${packages.length} service packages`);
        console.log(`  - ${addons.length} add-ons`);
        console.log(`  - ${vehicleTypes.length} vehicle types`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
