
export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d * 0.621371; // Convert to miles
};

const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
};

// Utility function to check if a location is within service area
export const isWithinServiceArea = (
    clientLat: number,
    clientLng: number,
    serviceArea: any
): boolean => {
    if (!serviceArea || !serviceArea.centerLat || !serviceArea.centerLng || !serviceArea.radiusMiles) return true; // Default to allow if no config
    const distance = getDistance(clientLat, clientLng, serviceArea.centerLat, serviceArea.centerLng);
    return distance <= serviceArea.radiusMiles;
};

export const mockGeocodeZip = (address: string): { lat: number, lng: number } | null => {
    if (!address) return null;
    // Mock database of ZIP codes for Los Angeles area (expanded with wealthy areas)
    const zipDb: { [key: string]: { lat: number, lng: number } } = {
        '90012': { lat: 34.0522, lng: -118.2437 }, // Downtown Los Angeles
        '90210': { lat: 34.0736, lng: -118.4004 }, // Beverly Hills
        '90211': { lat: 34.0664, lng: -118.3838 }, // Beverly Hills
        '90212': { lat: 34.0616, lng: -118.3995 }, // Beverly Hills
        '90401': { lat: 34.0194, lng: -118.4912 }, // Santa Monica
        '90402': { lat: 34.0322, lng: -118.5029 }, // Santa Monica
        '90403': { lat: 34.0320, lng: -118.4839 }, // Santa Monica
        '90404': { lat: 34.0256, lng: -118.4721 }, // Santa Monica
        '90405': { lat: 34.0084, lng: -118.4795 }, // Santa Monica
        '90028': { lat: 34.1016, lng: -118.3267 }, // Hollywood
        '90038': { lat: 34.0899, lng: -118.3267 }, // Hollywood
        '90046': { lat: 34.1018, lng: -118.3611 }, // Hollywood / West Hollywood
        '90068': { lat: 34.1205, lng: -118.3268 }, // Hollywood Hills
        '90069': { lat: 34.0908, lng: -118.3846 }, // West Hollywood / Hollywood
        '90077': { lat: 34.1147, lng: -118.4474 }, // Bel Air
        '90049': { lat: 34.0683, lng: -118.4741 }, // Brentwood
        '90272': { lat: 34.0475, lng: -118.5278 }, // Pacific Palisades
        '90024': { lat: 34.0637, lng: -118.4368 }, // Westwood
        '90025': { lat: 34.0456, lng: -118.4437 }, // Westwood
        '90291': { lat: 33.9922, lng: -118.4601 }, // Venice
        '90292': { lat: 33.9781, lng: -118.4485 }, // Marina del Rey
        '90263': { lat: 34.0322, lng: -118.6872 }, // Malibu
        '90264': { lat: 34.0250, lng: -118.7900 }, // Malibu
        '90265': { lat: 34.0350, lng: -118.6800 }, // Malibu
        '90266': { lat: 33.8847, lng: -118.4109 }, // Manhattan Beach
        '90254': { lat: 33.8622, lng: -118.3995 }, // Hermosa Beach
        '90274': { lat: 33.7865, lng: -118.3984 }, // Palos Verdes Estates / Rolling Hills
        '90275': { lat: 33.7444, lng: -118.3869 }, // Rancho Palos Verdes
        '90731': { lat: 33.7361, lng: -118.2922 }, // San Pedro
        '90650': { lat: 33.9022, lng: -118.0817 }, // Norwalk
        '90501': { lat: 33.8358, lng: -118.3406 }, // Torrance
        '90250': { lat: 33.9189, lng: -118.3484 }, // Hawthorne
        '10001': { lat: 40.7128, lng: -74.0060 }, // NYC
    };

    // Extract ZIP from address string
    const zipMatch = address.match(/\b\d{5}\b/);
    if (zipMatch) {
        return zipDb[zipMatch[0]] || null;
    }

    // Fallback: If "Los Angeles" is in address, return center (valid)
    if (address.toLowerCase().includes('los angeles') || address.toLowerCase().includes('la')) {
        return { lat: 34.0522, lng: -118.2437 };
    }

    return null; // Cannot geocode
};

// Regex for checking wealthy LA area keywords and ZIP codes
const WEALTHY_KEYWORDS_REGEX = /\b(beverly\s+hills|santa\s+monica|hollywood|bel\s+air|brentwood|pacific\s+palisades|century\s+city|westwood|marina\s+del\s+rey|venice|malibu|manhattan\s+beach|hermosa\s+beach|rancho\s+palos\s+verdes|palos\s+verdes\s+estates|rolling\s+hills|rolling\s+hills\s+estates)\b/i;
const WEALTHY_ZIPS_REGEX = /\b(90210|90211|90212|90401|90402|90403|90404|90405|90028|90038|90046|90068|90069|90077|90049|90272|90024|90025|90291|90292|90263|90264|90265|90266|90254|90274|90275)\b/;

export const calculateLocationSurcharges = (
    address: string,
    location: { lat: number; lng: number } | null,
    serviceArea: any,
    numVehicles: number
): { wealthyAreaPremium: number; distanceSurcharge: number; distanceMiles: number } => {
    if (!address) {
        return { wealthyAreaPremium: 0, distanceSurcharge: 0, distanceMiles: 0 };
    }

    // 1. Check if it's a wealthy area
    const isWealthy = WEALTHY_KEYWORDS_REGEX.test(address) || WEALTHY_ZIPS_REGEX.test(address);
    const vehiclesCount = numVehicles > 0 ? numVehicles : 1;
    const wealthyAreaPremium = isWealthy ? 10 * vehiclesCount : 0;

    // 2. Geocode if coordinates are missing
    let coords = location;
    if (!coords) {
        coords = mockGeocodeZip(address);
    }

    // 3. Determine distance
    let distanceMiles = 0;
    if (coords) {
        const centerLat = serviceArea?.centerLat ?? 34.0522; // Default LA Center
        const centerLng = serviceArea?.centerLng ?? -118.2437;
        distanceMiles = getDistance(coords.lat, coords.lng, centerLat, centerLng);
    }

    // 4. Calculate tiered distance surcharge
    let distanceSurcharge = 0;
    if (distanceMiles > 20) {
        distanceSurcharge = 30;
    } else if (distanceMiles > 15) {
        distanceSurcharge = 20;
    } else if (distanceMiles > 10) {
        distanceSurcharge = 10;
    }

    return { wealthyAreaPremium, distanceSurcharge, distanceMiles };
};
