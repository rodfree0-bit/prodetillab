import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ServiceArea } from '../types';
import { GoogleMap, useJsApiLoader, Circle, Marker } from '@react-google-maps/api';
import { getDistance } from '../utils/location';

interface ServiceAreaConfigProps {
    serviceArea: ServiceArea | null;
    onSave: (area: ServiceArea) => void;
}

const LA_CITIES = [
    { name: 'Downtown Los Angeles', lat: 34.0522, lng: -118.2437 },
    { name: 'Santa Monica', lat: 34.0194, lng: -118.4912 },
    { name: 'Beverly Hills', lat: 34.0736, lng: -118.4004 },
    { name: 'West Hollywood', lat: 34.0900, lng: -118.3617 },
    { name: 'Long Beach', lat: 33.7701, lng: -118.1937 },
    { name: 'Inglewood', lat: 33.9617, lng: -118.3531 },
    { name: 'Culver City', lat: 34.0211, lng: -118.3965 },
    { name: 'Torrance', lat: 33.8358, lng: -118.3406 },
    { name: 'Compton', lat: 33.8958, lng: -118.2201 },
    { name: 'Downey', lat: 33.9401, lng: -118.1332 },
    { name: 'Norwalk', lat: 33.9022, lng: -118.0817 },
    { name: 'San Pedro', lat: 33.7361, lng: -118.2922 },
    { name: 'Rancho Palos Verdes', lat: 33.7445, lng: -118.3870 },
    { name: 'Redondo Beach', lat: 33.8492, lng: -118.3884 },
    { name: 'Hermosa Beach', lat: 33.8622, lng: -118.3995 },
    { name: 'Manhattan Beach', lat: 33.8847, lng: -118.4109 },
    { name: 'El Segundo', lat: 33.9192, lng: -118.4165 },
    { name: 'Hawthorne', lat: 33.9189, lng: -118.3484 },
    { name: 'Gardena', lat: 33.8883, lng: -118.3090 },
    { name: 'Carson', lat: 33.8317, lng: -118.2817 },
    { name: 'Lakewood', lat: 33.8500, lng: -118.1333 }
];

const containerStyle = {
    width: '100%',
    height: '100%'
};

const GOOGLE_MAPS_LIBRARIES: ("places" | "geometry")[] = ['places', 'geometry'];

export const ServiceAreaConfig: React.FC<ServiceAreaConfigProps> = ({ serviceArea, onSave }) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyAJsxt6sbl2mwtXehLgB6cF1rjiOD8x2PU',
        libraries: GOOGLE_MAPS_LIBRARIES
    });

    const [centerLat, setCenterLat] = useState(serviceArea?.centerLat || 34.0522);
    const [centerLng, setCenterLng] = useState(serviceArea?.centerLng || -118.2437);
    const [radiusMiles, setRadiusMiles] = useState(serviceArea?.radiusMiles || 15);
    const [cityName, setCityName] = useState(serviceArea?.cityName || 'Los Angeles');
    const [searchQuery, setSearchQuery] = useState('');
    const [map, setMap] = useState<google.maps.Map | null>(null);

    // Desktop/Mobile detection
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (serviceArea) {
            setCenterLat(serviceArea.centerLat);
            setCenterLng(serviceArea.centerLng);
            setRadiusMiles(serviceArea.radiusMiles);
            setCityName(serviceArea.cityName || '');
        }
    }, [serviceArea]);

    const handleSave = () => {
        onSave({
            centerLat,
            centerLng,
            radiusMiles,
            cityName
        });
    };

    const handleSearch = () => {
        if (!searchQuery.trim()) return;
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: searchQuery }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                const loc = results[0].geometry.location;
                const lat = loc.lat();
                const lng = loc.lng();
                setCenterLat(lat);
                setCenterLng(lng);
                
                // Try to find city name
                let city = '';
                const addressComponents = results[0].address_components;
                for (const comp of addressComponents) {
                     if (comp.types.includes('locality')) {
                         city = comp.long_name;
                         break;
                     }
                }
                if (!city) {
                    city = results[0].formatted_address.split(',')[0];
                }
                setCityName(city);
                
                if (map) {
                    map.panTo({ lat, lng });
                    map.setZoom(10);
                }
            } else {
                alert('Location not found');
            }
        });
    };

    const coveredCities = useMemo(() => {
        return LA_CITIES.filter(city => {
            const dist = getDistance(city.lat, city.lng, centerLat, centerLng);
            return dist <= radiusMiles;
        });
    }, [centerLat, centerLng, radiusMiles]);

    const onLoad = useCallback((map: google.maps.Map) => {
        setMap(map);
    }, []);

    const onUnmount = useCallback((map: google.maps.Map) => {
        setMap(null);
    }, []);

    // Update map view when center changes
    useEffect(() => {
        if (map) {
            map.panTo({ lat: centerLat, lng: centerLng });
        }
    }, [centerLat, centerLng, map]);

    if (!isLoaded) return (
        <div className="w-full h-full bg-slate-900 animate-pulse flex flex-col items-center justify-center text-slate-400 gap-3">
            <span className="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span>
            <span className="text-sm font-semibold">Cargando Google Maps...</span>
        </div>
    );

    return (
        <div className="w-full h-full relative overflow-hidden bg-[#0e0e11] select-none flex flex-col">
            {/* Map Background */}
            <div className="absolute inset-0 z-0 w-full h-full">
                <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={{ lat: centerLat, lng: centerLng }}
                    zoom={10}
                    onLoad={onLoad}
                    onUnmount={onUnmount}
                    options={{
                        styles: [
                            { elementType: "geometry", stylers: [{ color: "#1f2229" }] },
                            { elementType: "labels.text.stroke", stylers: [{ color: "#1f2229" }] },
                            { elementType: "labels.text.fill", stylers: [{ color: "#8a94a6" }] },
                            {
                                featureType: "administrative.locality",
                                elementType: "labels.text.fill",
                                stylers: [{ color: "#e3975d" }],
                            },
                            {
                                featureType: "road",
                                elementType: "geometry",
                                stylers: [{ color: "#2d323f" }],
                            },
                            {
                                featureType: "road",
                                elementType: "geometry.stroke",
                                stylers: [{ color: "#1b1d24" }],
                            },
                            {
                                featureType: "water",
                                elementType: "geometry",
                                stylers: [{ color: "#13161c" }],
                            },
                        ],
                        disableDefaultUI: true,
                        zoomControl: true,
                    }}
                >
                    {/* Radius Circle */}
                    <Circle
                        center={{ lat: centerLat, lng: centerLng }}
                        radius={radiusMiles * 1609.34} // miles to meters
                        options={{
                            fillColor: "#00d2ff",
                            fillOpacity: 0.15,
                            strokeColor: "#00d2ff",
                            strokeOpacity: 0.8,
                            strokeWeight: 2,
                            clickable: false,
                            draggable: false,
                            editable: false
                        }}
                    />

                    {/* Center Marker */}
                    <Marker
                        position={{ lat: centerLat, lng: centerLng }}
                        draggable={true}
                        onDragEnd={(e: google.maps.MapMouseEvent) => {
                            if (e.latLng) {
                                setCenterLat(e.latLng.lat());
                                setCenterLng(e.latLng.lng());
                            }
                        }}
                    />

                    {/* City Markers */}
                    {LA_CITIES.map(city => {
                        const isCovered = coveredCities.some(c => c.name === city.name);
                        return (
                            <Marker
                                key={city.name}
                                position={{ lat: city.lat, lng: city.lng }}
                                opacity={isCovered ? 1 : 0.4}
                                icon={{
                                    path: google.maps.SymbolPath.CIRCLE,
                                    scale: 6,
                                    fillColor: isCovered ? "#22c55e" : "#ef4444",
                                    fillOpacity: 1,
                                    strokeWeight: 2,
                                    strokeColor: "#ffffff"
                                }}
                                title={city.name}
                            />
                        );
                    })}
                </GoogleMap>
            </div>

            {/* Controls Overlay Card */}
            <div className={
                isDesktop 
                    ? "absolute top-4 left-4 z-10 w-96 bg-[#16161a]/90 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[calc(100vh-180px)] flex flex-col"
                    : "absolute bottom-4 left-4 right-4 z-10 bg-[#16161a]/95 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-2xl max-h-[40%] flex flex-col overflow-y-auto"
            }>
                {/* Header */}
                <div className="flex items-center gap-2 mb-4 shrink-0">
                    <span className="material-symbols-outlined text-primary text-2xl animate-pulse">explore</span>
                    <div>
                        <h3 className="text-md font-black text-white">Configuración del Rango</h3>
                        <p className="text-[10px] text-slate-400">Define el radio y epicentro de cobertura</p>
                    </div>
                </div>

                {/* Location Search Bar */}
                <div className="mb-4 shrink-0">
                    <label className="block text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1.5">Buscar Ubicación</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Buscar dirección o ciudad..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSearch();
                            }}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-primary focus:outline-none focus:bg-white/10 transition-all"
                        />
                        <button
                            onClick={handleSearch}
                            className="bg-primary hover:bg-primary-dark text-black rounded-xl px-4 py-2.5 flex items-center justify-center transition-colors active:scale-95"
                        >
                            <span className="material-symbols-outlined text-md">search</span>
                        </button>
                    </div>
                </div>

                {/* Inputs */}
                <div className="space-y-4 mb-4 shrink-0">
                    <div>
                        <label className="block text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1.5">Epicentro / Ciudad</label>
                        <input
                            type="text"
                            value={cityName}
                            onChange={(e) => setCityName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary focus:outline-none focus:bg-white/10 transition-all"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest">Radio de Cobertura</label>
                            <span className="text-primary text-xs font-bold bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">{radiusMiles} millas</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="80"
                            value={radiusMiles}
                            onChange={(e) => setRadiusMiles(Number(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary focus:outline-none"
                        />
                    </div>
                </div>

                {/* Cities list (flex-1 to scroll if too long) */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-black/20 rounded-xl border border-white/5 mb-4 p-3">
                    <div className="flex justify-between items-center mb-2 pb-1 border-b border-white/5">
                        <span className="text-[10px] uppercase text-slate-400 font-black tracking-widest">Ciudades Cubiertas</span>
                        <span className="text-green-400 text-xs font-bold">{coveredCities.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                        {coveredCities.map(city => (
                            <div key={city.name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 text-green-400 border border-green-500/15 transition-all hover:bg-green-500/15">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                <span className="text-xs font-bold">{city.name}</span>
                            </div>
                        ))}
                        {coveredCities.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-4 text-slate-500">
                                <span className="material-symbols-outlined text-3xl opacity-30 mb-1">sentiment_dissatisfied</span>
                                <p className="text-[10px]">Fuera del rango de cobertura</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    className="w-full py-3 bg-gradient-to-r from-primary to-blue-600 rounded-xl font-bold text-black hover:opacity-90 transition-all flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-primary/20 active:scale-95"
                >
                    <span className="material-symbols-outlined text-sm font-bold">save</span>
                    Guardar Rango
                </button>
            </div>

            {/* Legend & Instructions Floating Info */}
            {isDesktop && (
                <>
                    <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 z-10 w-fit space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                            <span className="w-3.5 h-3.5 rounded-full bg-primary/20 border-2 border-primary"></span>
                            <span className="text-white">Área del Rango</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold">
                            <span className="w-3 h-3 rounded-full bg-green-500 border border-white"></span>
                            <span className="text-slate-300">Ciudad Cubierta</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold">
                            <span className="w-3 h-3 rounded-full bg-red-500/40 border border-red-500"></span>
                            <span className="text-slate-500">Ciudad Fuera de Rango</span>
                        </div>
                    </div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md px-5 py-2.5 rounded-full text-xs text-white border border-white/10 z-10 flex items-center gap-2 shadow-xl">
                        <span className="material-symbols-outlined text-primary text-sm animate-bounce">info</span>
                        <span>Arrastra el marcador azul para mover el centro del rango de servicio</span>
                    </div>
                </>
            )}
        </div>
    );
};
