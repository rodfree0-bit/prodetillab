"use strict";
/**
 * Cloud Function: calculateRouteETA
 *
 * Calcula el ETA usando Google Maps Directions API
 * Con CORS habilitado para evitar errores de preflight
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRouteETA = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Inicializar Admin SDK si no está inicializado
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.calculateRouteETA = functions.https.onCall(async (data, context) => {
    var _a;
    try {
        console.log('🗺️ calculateRouteETA called:', data);
        // Validar datos de entrada
        if (!data.origin || !data.destination) {
            throw new functions.https.HttpsError('invalid-argument', 'Origin and destination are required');
        }
        const { origin, destination } = data;
        // Obtener Google Maps API Key desde configuración de Firebase
        const googleMapsApiKey = (_a = functions.config().google) === null || _a === void 0 ? void 0 : _a.maps_api_key;
        if (!googleMapsApiKey) {
            console.error('❌ Google Maps API Key not configured');
            throw new functions.https.HttpsError('failed-precondition', 'Google Maps API Key not configured');
        }
        // Construir URL de Directions API
        const url = `https://maps.googleapis.com/maps/api/directions/json?` +
            `origin=${origin.lat},${origin.lng}&` +
            `destination=${destination.lat},${destination.lng}&` +
            `mode=driving&` +
            `departure_time=now&` +
            `traffic_model=best_guess&` +
            `key=${googleMapsApiKey}`;
        console.log('📍 Calling Google Maps Directions API...');
        // Hacer request a Google Maps usando https module
        const https = await Promise.resolve().then(() => __importStar(require('https')));
        const apiResponse = await new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    }
                    catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
        const result = apiResponse;
        if (result.status !== 'OK') {
            console.error('❌ Google Maps API error:', result.status, result.error_message);
            throw new functions.https.HttpsError('internal', `Google Maps API error: ${result.status}`);
        }
        // Extraer información de la ruta
        const route = result.routes[0];
        const leg = route.legs[0];
        const durationInTraffic = leg.duration_in_traffic || leg.duration;
        const etaMinutes = Math.ceil(durationInTraffic.value / 60);
        console.log(`✅ ETA calculated: ${etaMinutes} minutes`);
        return {
            success: true,
            etaMinutes,
            distance: leg.distance.text,
            duration: durationInTraffic.text
        };
    }
    catch (error) {
        console.error('❌ Error calculating ETA:', error);
        // Si es un HttpsError, re-lanzarlo
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        // Para otros errores, devolver un error genérico
        throw new functions.https.HttpsError('internal', 'Failed to calculate ETA', error.message);
    }
});
//# sourceMappingURL=calculateRouteETA.js.map