import React, { useEffect, useState, useRef } from 'react';

interface TrackingMapProps {
    washerLocation?: { lat: number; lng: number } | { latitude: number; longitude: number };
    clientLocation?: { lat: number; lng: number } | { latitude: number; longitude: number };
    clientAddress?: string; // NEW: Fallback for geocoding
    status: string;
    serviceRadius?: number; // in miles
    washerName?: string;
    eta?: number | string; // in minutes
    isLoaded?: boolean;
    hideControls?: boolean;
    routePolyline?: string; // NEW: Pre-calculated polyline from ETAService
}

// Dark theme Google Maps style (Very clean)
const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
];

const carIconSvg = `
<svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="30" y="20" width="40" height="60" rx="10" fill="#3b82f6" />
    <rect x="35" y="35" width="30" height="15" rx="2" fill="#1a1a2e" />
    <rect x="35" y="65" width="30" height="10" rx="2" fill="#1a1a2e" />
    <rect x="40" y="25" width="20" height="5" rx="1" fill="white" opacity="0.3" />
    <rect x="25" y="30" width="5" height="15" rx="2" fill="#333" />
    <rect x="70" y="30" width="5" height="15" rx="2" fill="#333" />
    <rect x="25" y="65" width="5" height="15" rx="2" fill="#333" />
    <rect x="70" y="65" width="5" height="15" rx="2" fill="#333" />
</svg>
`;

export const TrackingMap: React.FC<TrackingMapProps> = ({
    washerLocation,
    clientLocation,
    clientAddress,
    status,
    washerName = 'Washer',
    eta,
    isLoaded,
    hideControls = false,
    routePolyline
}) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    
    // Refs for Map Objects (Prefer over state for Google Maps Objects)
    const washerMarkerRef = useRef<google.maps.Marker | null>(null);
    const clientMarkerRef = useRef<google.maps.Marker | null>(null);
    const routeLineRef = useRef<google.maps.Polyline | null>(null);
    const userMarkerRef = useRef<google.maps.Marker | null>(null);
    
    // State for derived/fallback values
    const [geocodedClientLocation, setGeocodedClientLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [currentUserLocation, setCurrentUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
    const routeUpdateCooldownRef = useRef<number>(0);

    // Normalize locations helper
    const getPos = (loc: any) => {
        if (!loc) return null;
        const latRaw = loc.lat ?? loc.latitude;
        const lngRaw = loc.lng ?? loc.longitude;
        const lat = typeof latRaw === 'string' ? parseFloat(latRaw) : latRaw;
        const lng = typeof lngRaw === 'string' ? parseFloat(lngRaw) : lngRaw;
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return null;
        if (lat === 0 && lng === 0) return null;
        return { lat, lng };
    };

    const normClient = React.useMemo(() => getPos(clientLocation) || geocodedClientLocation, [clientLocation, geocodedClientLocation]);
    const normWasher = React.useMemo(() => getPos(washerLocation), [washerLocation]);

    // 0. Geocoding Fallback
    useEffect(() => {
        if (isLoaded && clientAddress && !getPos(clientLocation) && typeof google !== 'undefined') {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: clientAddress }, (results, status) => {
                if (status === 'OK' && results?.[0]?.geometry?.location) {
                    setGeocodedClientLocation({
                        lat: results[0].geometry.location.lat(),
                        lng: results[0].geometry.location.lng()
                    });
                }
            });
        }
    }, [clientLocation, clientAddress, isLoaded]);

    // 1. Initialize Map
    useEffect(() => {
        if (!isLoaded || !mapRef.current || map) return;

        const center = normClient || normWasher || { lat: 34.0522, lng: -118.2437 };
        const googleMap = new google.maps.Map(mapRef.current, {
            center: center,
            zoom: 15,
            styles: darkMapStyle,
            disableDefaultUI: true,
            gestureHandling: 'greedy'
        });
        setMap(googleMap);
    }, [isLoaded, map]);

    // 2. Viewport Control
    useEffect(() => {
        if (!map) return;
        const bounds = new google.maps.LatLngBounds();
        let pointsCount = 0;
        if (normClient) { bounds.extend(normClient); pointsCount++; }
        if (normWasher) { bounds.extend(normWasher); pointsCount++; }
        
        if (pointsCount === 2) {
            map.fitBounds(bounds, { top: 120, bottom: 220, left: 60, right: 60 });
        } else if (pointsCount === 1) {
            map.panTo((normClient || normWasher)!);
            if (map.getZoom() < 14) map.setZoom(16);
        }
    }, [map, normClient, normWasher]);

    // 3. Markers Management (Washer & Client)
    useEffect(() => {
        if (!map) return;

        // Client Marker
        if (normClient) {
            if (!clientMarkerRef.current) {
                clientMarkerRef.current = new google.maps.Marker({
                    position: normClient,
                    map: map,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 12,
                        fillColor: '#3b82f6',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 4,
                    },
                    zIndex: 50
                });
            } else {
                clientMarkerRef.current.setPosition(normClient);
                if (!clientMarkerRef.current.getMap()) clientMarkerRef.current.setMap(map);
            }
        }

        // Washer Marker
        if (normWasher) {
            if (!washerMarkerRef.current) {
                washerMarkerRef.current = new google.maps.Marker({
                    position: normWasher,
                    map: map,
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(carIconSvg),
                        scaledSize: new google.maps.Size(50, 50),
                        anchor: new google.maps.Point(25, 25),
                    },
                    zIndex: 100
                });
            } else {
                washerMarkerRef.current.setPosition(normWasher);
                if (!washerMarkerRef.current.getMap()) washerMarkerRef.current.setMap(map);
            }
        }
    }, [map, normClient, normWasher]);

    // 4. Route Line & Smart Heading
    useEffect(() => {
        if (!map || !normWasher || !normClient) return;

        const drawRoute = (path: google.maps.LatLng[]) => {
            if (path.length === 0) return;

            if (!routeLineRef.current) {
                routeLineRef.current = new google.maps.Polyline({
                    path,
                    strokeColor: '#3b82f6',
                    strokeOpacity: 0.9,
                    strokeWeight: 8, // Thicker for visibility
                    map: map,
                    zIndex: 10
                });
            } else {
                routeLineRef.current.setPath(path);
                if (!routeLineRef.current.getMap()) routeLineRef.current.setMap(map);
            }

            // 🏎️ Rotation
            if (washerMarkerRef.current && path.length > 1) {
                const heading = google.maps.geometry.spherical.computeHeading(path[0], path[1]);
                const rotatedSvg = carIconSvg.replace('<svg', `<svg style="transform: rotate(${heading}deg); transform-origin: center center;"`)
                                            .replace('xmlns="http://www.w3.org/2000/svg">', 'xmlns="http://www.w3.org/2000/svg"><g transform="rotate(' + heading + ' 50 50)">')
                                            .replace('</svg>', '</g></svg>');
                
                washerMarkerRef.current.setIcon({
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(rotatedSvg),
                    scaledSize: new google.maps.Size(46, 46),
                    anchor: new google.maps.Point(23, 23),
                });
            }
        };

        // Priority 1: From Prop
        if (routePolyline && google.maps.geometry) {
            try {
                const path = google.maps.geometry.encoding.decodePath(routePolyline);
                if (path.length > 0) {
                    drawRoute(path);
                    return;
                }
            } catch (err) {
                console.error('❌ TrackingMap: Failed to decode polyline prop', err);
            }
        }

        // Priority 2: Directions Fallback (Road-based)
        if (!directionsServiceRef.current) directionsServiceRef.current = new google.maps.DirectionsService();
        
        const timeSince = Date.now() - routeUpdateCooldownRef.current;
        if (timeSince > 30000 || !routeLineRef.current) {
            directionsServiceRef.current.route(
                { origin: normWasher, destination: normClient, travelMode: google.maps.TravelMode.DRIVING },
                (result, status) => {
                    if (status === 'OK' && result?.routes[0]) {
                        drawRoute(result.routes[0].overview_path);
                        routeUpdateCooldownRef.current = Date.now();
                    } else {
                        console.error('❌ TrackingMap: Directions API Error:', status);
                        
                        // EMERGENCY FALLBACK: If API is disabled (REQUEST_DENIED), draw a simple line
                        // This prevents the map from looking "broken" while the user fixes their Cloud Console.
                        if (status === 'REQUEST_DENIED' || status === 'OVER_QUERY_LIMIT') {
                            console.warn('⚠️ TrackingMap: Drawing EMERGENCY straight line due to API restrictions.');
                            drawRoute([
                                new google.maps.LatLng(normWasher.lat, normWasher.lng),
                                new google.maps.LatLng(normClient.lat, normClient.lng)
                            ]);
                            
                            // Change style of fallback line to be dashed
                            if (routeLineRef.current) {
                                routeLineRef.current.setOptions({
                                    strokeColor: '#64748b', // Slate color for fallback
                                    strokeOpacity: 0.5,
                                    strokeWeight: 4,
                                    icons: [{
                                        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 },
                                        offset: '0',
                                        repeat: '20px'
                                    }]
                                });
                            }
                        }
                    }
                }
            );
        }
    }, [map, normWasher, normClient, routePolyline]);

    return (
        <div className="absolute inset-0 z-0 bg-[#0f172a] overflow-hidden">
            {!isLoaded && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0f172a]">
                    <div className="w-12 h-12 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-white font-black uppercase tracking-widest text-[10px]">Synchronizing Satellite...</p>
                </div>
            )}
            <div ref={mapRef} className="w-full h-full" />
        </div>
    );
};
