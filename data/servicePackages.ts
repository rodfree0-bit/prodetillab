import { ServicePackage } from '../types';

export const package_wash_vacuum: ServicePackage = {
    id: "package_wash_vacuum",
    name: "Super Wash",
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
};

export const package_diamond: ServicePackage = {
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
};

export const package_onyx: ServicePackage = {
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
};

export const DEFAULT_SERVICE_PACKAGES: ServicePackage[] = [
    package_wash_vacuum,
    package_diamond,
    package_onyx
];
