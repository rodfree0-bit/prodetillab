// Service to lookup vehicles and suggest categories
// API: NHTSA (National Highway Traffic Safety Administration)

import { allVehiclesModels } from './allVehiclesModels';

export interface VehicleSelection {
    make: string;
    model: string;
    year: number;
    suggestedCategory: string; // ID of our vehicle_types
}

export class VehicleLookupService {
    private baseUrl = 'https://vpic.nhtsa.dot.gov/api/vehicles';

    // Get all makes (Expanded list including luxury, exotics, and rare brands)
    async getMakes(): Promise<string[]> {
        return [
            "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Bugatti", "Buick",
            "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Fisker", "Ford", "Genesis",
            "GMC", "Hennessey", "Honda", "Hummer", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Karma", "Kia",
            "Koenigsegg", "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lotus", "Lucid", "Maserati",
            "Maybach", "Mazda", "McLaren", "Mercedes-Benz", "Mercury", "Mini", "Mitsubishi", "Nissan",
            "Noble", "Oldsmobile", "Pagani", "Polestar", "Pontiac", "Porsche", "Ram", "Rimac", "Rivian", "Rolls-Royce",
            "Saab", "Saleen", "Saturn", "Scion", "Smart", "Spyker", "Subaru", "Suzuki", "Tesla", "Toyota",
            "VinFast", "Volkswagen", "Volvo", "Other Make / Custom"
        ];
    }

    private fallbackModels: Record<string, string[]> = {
        'Acura': ['ILX', 'Integra', 'MDX', 'NSX', 'RDX', 'RLX', 'TLX', 'ZDX'],
        'Alfa Romeo': ['4C', 'Giulia', 'Stelvio', 'Tonale'],
        'Aston Martin': ['DB11', 'DB12', 'DBS', 'DBX', 'Vantage', 'Vanquish', 'Valhalla'],
        'Audi': ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'e-tron', 'e-tron GT', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'R8', 'RS e-tron GT', 'RS3', 'RS5', 'RS6', 'RS7', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'SQ5', 'SQ7', 'SQ8', 'TT'],
        'Bentley': ['Bentayga', 'Continental GT', 'Flying Spur', 'Mulsanne'],
        'BMW': ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', '8 Series', 'i3', 'i4', 'i7', 'iX', 'M2', 'M3', 'M4', 'M5', 'M8', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'XM', 'Z4'],
        'Bugatti': ['Chiron', 'Veyron', 'Divo', 'Mistral'],
        'Buick': ['Enclave', 'Encore', 'Encore GX', 'Envision', 'Envista', 'LaCrosse', 'Regal'],
        'Cadillac': ['CT4', 'CT5', 'CTS', 'Escalade', 'Escalade ESV', 'Lyriq', 'XT4', 'XT5', 'XT6', 'XTS'],
        'Chevrolet': ['Blazer', 'Bolt EV', 'Bolt EUV', 'Camaro', 'Colorado', 'Corvette', 'Cruze', 'Equinox', 'Express', 'Impala', 'Malibu', 'Silverado 1500', 'Silverado 2500 HD', 'Silverado 3500 HD', 'Spark', 'Suburban', 'Tahoe', 'Trailblazer', 'Traverse', 'Trax', 'Volt'],
        'Chrysler': ['300', 'Pacifica', 'Voyager'],
        'Dodge': ['Challenger', 'Charger', 'Durango', 'Grand Caravan', 'Hornet', 'Journey'],
        'Ferrari': ['296', '458', '488', '812', 'California', 'F12', 'F8', 'GTC4Lusso', 'LaFerrari', 'Portofino', 'Purosangue', 'Roma', 'SF90', 'Stradale'],
        'Fiat': ['124 Spider', '500', '500e', '500L', '500X'],
        'Fisker': ['Ocean'],
        'Ford': ['Bronco', 'Bronco Sport', 'Bronco Raptor', 'EcoSport', 'Edge', 'Escape', 'Expedition', 'Expedition Max', 'Explorer', 'F-150', 'F-150 Lightning', 'F-150 Raptor', 'F-250 Super Duty', 'F-350 Super Duty', 'F-450 Super Duty', 'Fiesta', 'Flex', 'Focus', 'Fusion', 'Maverick', 'Mustang', 'Mustang Mach-E', 'Ranger', 'Ranger Raptor', 'Raptor', 'Shelby GT500', 'Taurus', 'Transit', 'Transit Connect'],
        'Genesis': ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
        'GMC': ['Acadia', 'Canyon', 'Hummer EV', 'Savana', 'Sierra 1500', 'Sierra 2500 HD', 'Sierra 3500 HD', 'Terrain', 'Yukon', 'Yukon XL'],
        'Honda': ['Accord', 'Civic', 'Clarity', 'CR-V', 'Fit', 'HR-V', 'Insight', 'Odyssey', 'Passport', 'Pilot', 'Prologue', 'Ridgeline'],
        'Hummer': ['H1', 'H2', 'H3'],
        'Hyundai': ['Accent', 'Elantra', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Palisade', 'Santa Cruz', 'Santa Fe', 'Sonata', 'Tucson', 'Veloster', 'Venue'],
        'Infiniti': ['Q50', 'Q60', 'Q70', 'QX30', 'QX50', 'QX55', 'QX60', 'QX80'],
        'Jaguar': ['E-PACE', 'F-PACE', 'F-TYPE', 'I-PACE', 'XE', 'XF', 'XJ'],
        'Jeep': ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Grand Cherokee L', 'Grand Wagoneer', 'Renegade', 'Wagoneer', 'Wrangler'],
        'Karma': ['Revero'],
        'Kia': ['Carnival', 'EV6', 'EV9', 'Forte', 'K5', 'Niro', 'Rio', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Telluride'],
        'Lamborghini': ['Aventador', 'Huracan', 'Revuelto', 'Urus'],
        'Land Rover': ['Defender', 'Defender 90', 'Defender 110', 'Defender 130', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
        'Lexus': ['ES', 'GX', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'RZ', 'TX', 'UX'],
        'Lincoln': ['Aviator', 'Corsair', 'MKC', 'MKS', 'MKT', 'MKX', 'MKZ', 'Nautilus', 'Navigator'],
        'Lotus': ['Elise', 'Emira', 'Evora', 'Exige'],
        'Lucid': ['Air', 'Gravity'],
        'Maserati': ['Ghibli', 'GranTurismo', 'Grecale', 'Levante', 'MC20', 'Quattroporte'],
        'Mazda': ['CX-3', 'CX-30', 'CX-5', 'CX-50', 'CX-70', 'CX-9', 'CX-90', 'Mazda3', 'Mazda6', 'MX-5 Miata'],
        'McLaren': ['570S', '600LT', '720S', '750S', '765LT', 'Artura', 'GT', 'P1'],
        'Mercedes-Benz': ['A-Class', 'AMG G63', 'C-Class', 'CLA', 'CLS', 'E-Class', 'EQB', 'EQE', 'EQE SUV', 'EQS', 'EQS SUV', 'G-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'Metris', 'S-Class', 'SL', 'Sprinter', 'Sprinter RV'],
        'Mercury': ['Grand Marquis', 'Mariner', 'Milan', 'Mountaineer'],
        'Mini': ['Clubman', 'Cooper', 'Cooper Countryman', 'Countryman', 'Hardtop'],
        'Mitsubishi': ['Eclipse Cross', 'Mirage', 'Mirage G4', 'Outlander', 'Outlander Sport'],
        'Nissan': ['Altima', 'Ariya', 'Armada', 'Frontier', 'GT-R', 'Kicks', 'Leaf', 'Maxima', 'Murano', 'Pathfinder', 'Rogue', 'Sentra', 'Titan', 'Versa', 'Z'],
        'Oldsmobile': ['Alero', 'Aurora', 'Bravada', 'Intrigue', 'Silhouette'],
        'Polestar': ['1', '2', '3', '4'],
        'Pontiac': ['G6', 'Grand Prix', 'Solstice', 'Vibe'],
        'Porsche': ['718 Boxster', '718 Cayman', '911', '911 GT3', '911 Turbo', 'Cayenne', 'Macan', 'Macan EV', 'Panamera', 'Taycan', 'Taycan Cross Turismo'],
        'Ram': ['1500', '2500', '3500', 'ProMaster', 'ProMaster City'],
        'Rivian': ['R1S', 'R1T'],
        'Rolls-Royce': ['Cullinan', 'Dawn', 'Ghost', 'Phantom', 'Spectre', 'Wraith'],
        'Saab': ['9-3', '9-5'],
        'Saturn': ['Aura', 'Outlook', 'Sky', 'Vue'],
        'Scion': ['FR-S', 'iA', 'iM', 'tC', 'xB', 'xD'],
        'Smart': ['EQ fortwo', 'fortwo'],
        'Subaru': ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'Solterra', 'WRX'],
        'Suzuki': ['Grand Vitara', 'Kizashi', 'SX4'],
        'Tesla': ['Cybertruck', 'Model 3', 'Model S', 'Model X', 'Model Y', 'Roadster'],
        'Toyota': ['4Runner', 'Avalon', 'bZ4X', 'Camry', 'Corolla', 'Corolla Cross', 'Crown', 'GR86', 'Grand Highlander', 'Highlander', 'Land Cruiser', 'Mirai', 'Prius', 'RAV4', 'Sequoia', 'Sienna', 'Supra', 'Tacoma', 'Tundra', 'Venza'],
        'VinFast': ['VF 8', 'VF 9'],
        'Volkswagen': ['Arteon', 'Atlas', 'Atlas Cross Sport', 'Golf', 'Golf GTI', 'Golf R', 'ID.4', 'ID.Buzz', 'Jetta', 'Passat', 'Taos', 'Tiguan'],
        'Volvo': ['C40 Recharge', 'S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90']
    };

    // Get models for a make
    async getModels(make: string): Promise<string[]> {
        if (!make || make === 'Unknown' || make === 'Other') {
            return [];
        }

        const localList = allVehiclesModels[make];
        if (localList && localList.length > 0) {
            return localList;
        }

        const url = `${this.baseUrl}/GetModelsForMake/${make}?format=json`;
        let apiData: string[] = [];
        let success = false;

        // Try API first (Direct)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                apiData = data.Results.map((item: any) => item.Model_Name && item.Model_Name.trim ? item.Model_Name.trim() : item.Model_Name);
                success = true;
            }
        } catch (error) {
            // Silently fail to fallback
        }

        // Try Proxy if Direct Failed
        if (!success) {
            try {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                const response = await fetch(proxyUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    apiData = data.Results.map((item: any) => item.Model_Name && item.Model_Name.trim ? item.Model_Name.trim() : item.Model_Name);
                    success = true;
                }
            } catch (error) {
                // console.warn('Proxy fetch failed');
            }
        }

        // If API succeeded, return sorted and deduped
        if (success && apiData.length > 0) {
            return Array.from(new Set(apiData)).sort();
        }

        // If API failed completely, fallback
        const fallbackList = this.fallbackModels[make] || [];
        if (fallbackList.length > 0) {
            return fallbackList.sort();
        }

        return ['Other', 'Model Unknown'];
    }

    suggestCategory(make: string, model: string): string {
        const lowerModel = model.toLowerCase();

        // 1. TRUCKS
        if (
            lowerModel.includes('f-150 raptor') ||
            lowerModel.includes('raptor') ||
            lowerModel.includes('f-150') ||
            lowerModel.includes('silverado 1500') ||
            lowerModel.includes('ram 1500') ||
            lowerModel.includes('tundra') ||
            lowerModel.includes('titan') ||
            lowerModel.includes('rivian r1t') ||
            lowerModel.includes('cybertruck') ||
            lowerModel.includes('hummer ev pickup')
        ) {
            return 'fullsize_truck';
        }

        if (
            lowerModel.includes('f-250') || lowerModel.includes('f-350') ||
            lowerModel.includes('silverado 2500') || lowerModel.includes('silverado 3500') ||
            lowerModel.includes('ram 2500') || lowerModel.includes('ram 3500')
        ) {
            return 'heavy_duty_truck';
        }

        if (
            lowerModel.includes('ranger raptor') ||
            lowerModel.includes('tacoma') ||
            lowerModel.includes('colorado') ||
            lowerModel.includes('ranger') ||
            lowerModel.includes('canyon') ||
            lowerModel.includes('frontier') ||
            lowerModel.includes('maverick') ||
            lowerModel.includes('ridgeline') ||
            lowerModel.includes('santa cruz')
        ) {
            return 'compact_truck';
        }

        // 2. VANS
        if (
            lowerModel.includes('odyssey') ||
            lowerModel.includes('sienna') ||
            lowerModel.includes('pacifica') ||
            lowerModel.includes('carnival') ||
            lowerModel.includes('caravan') ||
            lowerModel.includes('voyager') ||
            lowerModel.includes('quest')
        ) {
            return 'minivan';
        }

        if (
            lowerModel.includes('sprinter') ||
            lowerModel.includes('transit') ||
            lowerModel.includes('promaster') ||
            lowerModel.includes('express') ||
            lowerModel.includes('savana') ||
            lowerModel.includes('metris')
        ) {
            return 'cargo_van';
        }

        // 3. SUVS - Large (3 rows or very big)
        if (
            lowerModel.includes('bronco raptor') ||
            lowerModel.includes('tahoe') ||
            lowerModel.includes('suburban') ||
            lowerModel.includes('expedition') ||
            lowerModel.includes('sequoia') ||
            lowerModel.includes('yukon') ||
            lowerModel.includes('armada') ||
            lowerModel.includes('escalade') ||
            lowerModel.includes('navigator') ||
            lowerModel.includes('gls') ||
            lowerModel.includes('x7') ||
            lowerModel.includes('wagoneer') ||
            lowerModel.includes('land cruiser') ||
            lowerModel.includes('lx') ||
            lowerModel.includes('qx80') ||
            lowerModel.includes('telluride') ||
            lowerModel.includes('palisade') ||
            lowerModel.includes('atlas') ||
            lowerModel.includes('traverse') ||
            lowerModel.includes('q7') ||
            lowerModel.includes('xc90') ||
            lowerModel.includes('aviator') ||
            lowerModel.includes('cullinan') ||
            lowerModel.includes('bentayga') ||
            lowerModel.includes('urus') ||
            lowerModel.includes('dbx') ||
            lowerModel.includes('cayenne') ||
            lowerModel.includes('range rover') ||
            lowerModel.includes('g-class') ||
            lowerModel.includes('rivian r1s') ||
            lowerModel.includes('vf 9') ||
            lowerModel.includes('gravity') ||
            lowerModel.includes('eqs suv')
        ) {
            return 'large_suv';
        }

        // 4. SUVS - Mid/Compact
        if (
            lowerModel.includes('cr-v') ||
            lowerModel.includes('rav4') ||
            lowerModel.includes('rogue') ||
            lowerModel.includes('escape') ||
            lowerModel.includes('equinox') ||
            lowerModel.includes('cx-5') ||
            lowerModel.includes('tucson') ||
            lowerModel.includes('sportage') ||
            lowerModel.includes('forester') ||
            lowerModel.includes('outback') ||
            lowerModel.includes('grand cherokee') ||
            lowerModel.includes('explorer') ||
            lowerModel.includes('highlander') ||
            lowerModel.includes('pilot') ||
            lowerModel.includes('mdx') ||
            lowerModel.includes('rx') ||
            lowerModel.includes('gle') ||
            lowerModel.includes('x5') ||
            lowerModel.includes('q5') ||
            lowerModel.includes('macan') ||
            lowerModel.includes('stelvio') ||
            lowerModel.includes('f-pace') ||
            lowerModel.includes('gv70') ||
            lowerModel.includes('xc60') ||
            lowerModel.includes('model y') ||
            lowerModel.includes('id.4') ||
            lowerModel.includes('mach-e') ||
            lowerModel.includes('ioniq 5') ||
            lowerModel.includes('bronco') ||
            lowerModel.includes('wrangler') ||
            lowerModel.includes('blazer') ||
            lowerModel.includes('murano') ||
            lowerModel.includes('crosstrek') ||
            lowerModel.includes('hr-v') ||
            lowerModel.includes('ocean') ||
            lowerModel.includes('vf 8') ||
            lowerModel.includes('eqe suv')
        ) {
            return 'suv';
        }

        // 5. CARS - Compact
        if (
            lowerModel.includes('civic') ||
            lowerModel.includes('corolla') ||
            lowerModel.includes('mazda3') ||
            lowerModel.includes('sentra') ||
            lowerModel.includes('elantra') ||
            lowerModel.includes('forte') ||
            lowerModel.includes('focus') ||
            lowerModel.includes('cruze') ||
            lowerModel.includes('golf') ||
            lowerModel.includes('impreza') ||
            lowerModel.includes('a3') ||
            lowerModel.includes('2 series') ||
            lowerModel.includes('cla') ||
            lowerModel.includes('a-class') ||
            lowerModel.includes('mini') ||
            lowerModel.includes('spark') ||
            lowerModel.includes('mirage') ||
            lowerModel.includes('rio') ||
            lowerModel.includes('versa')
        ) {
            return 'compact_car';
        }

        // 6. EXOTICS / SPORTS as Midsize Sedan fallback or specific category if exists
        // Currently mapping to 'midsize_sedan' as safe default

        // Default to Mid-Size Sedan for everything else (Sedans, Coupes, Exotics)
        return 'midsize_sedan';
    }
}

export const vehicleLookupService = new VehicleLookupService();
