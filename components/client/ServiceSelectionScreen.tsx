import React, { useState, useRef, useEffect } from 'react';
import { Screen, ServicePackage, ServiceAddon, SavedVehicle, VehicleType, ToastType } from '../../types';

interface ServiceSelectionScreenProps {
    packages: ServicePackage[];
    packagesError: string | null;
    addons: ServiceAddon[];
    vehicles: SavedVehicle[];
    selectedVehicleIds: string[];
    currentVehicleIndex: number;
    vehicleConfigs: any[];
    setVehicleConfigs: (configs: any[]) => void;
    setCurrentVehicleIndex: (index: number) => void;
    navigate: (screen: Screen) => void;
    showToast: (message: string, type: ToastType) => void;
}

// Native-style Toast Component
const NativeToast: React.FC<{ message: string; type: ToastType; onClose: () => void }> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const isError = type === 'error';

    return (
        <div className="fixed top-12 left-0 right-0 z-[100] flex justify-center px-6 pointer-events-none animate-in fade-in slide-in-from-top-8 duration-500">
            <div className={`
                flex items-center gap-3 px-5 py-4 rounded-[2rem] shadow-2xl backdrop-blur-xl border pointer-events-auto
                ${isError
                    ? 'bg-red-500/90 border-red-400/50 text-white'
                    : 'bg-white/95 border-white text-black'}
                max-w-[90vw] transition-all active:scale-95
            `}>
                <span className={`material-symbols-outlined text-2xl ${isError ? 'text-white' : 'text-primary'}`}>
                    {isError ? 'error' : 'check_circle'}
                </span>
                <p className="text-sm font-bold leading-tight">{message}</p>
            </div>
        </div>
    );
};

export const ServiceSelectionScreen: React.FC<ServiceSelectionScreenProps> = ({
    packages: propPackages,
    packagesError,
    addons: propAddons,
    vehicles: propVehicles,
    selectedVehicleIds: propSelectedVehicleIds,
    currentVehicleIndex,
    vehicleConfigs: propVehicleConfigs,
    setVehicleConfigs,
    setCurrentVehicleIndex,
    navigate,
    showToast: externalShowToast
}) => {
    const addonsSectionRef = useRef<HTMLDivElement>(null);
    const [localToast, setLocalToast] = useState<{ message: string; type: ToastType } | null>(null);

    const showToast = (message: string, type: ToastType) => {
        setLocalToast({ message, type });
        // Also call external showToast if needed for logging or global state
        externalShowToast(message, type);
    };

    // Stability Normalization
    const addons = Array.isArray(propAddons) ? propAddons : [];
    const vehicles = Array.isArray(propVehicles) ? propVehicles : [];
    const selectedVehicleIds = Array.isArray(propSelectedVehicleIds) ? propSelectedVehicleIds : [];
    const vehicleConfigs = Array.isArray(propVehicleConfigs) ? propVehicleConfigs : [];

    const currentVehicleId = selectedVehicleIds[currentVehicleIndex];
    const currentVehicle = vehicles.find(v => v.id === currentVehicleId);
    const currentConfig = vehicleConfigs[currentVehicleIndex];
    const currentVehicleType = currentVehicle?.type || 'sedan';
    const isLastVehicle = currentVehicleIndex === (selectedVehicleIds.length - 1);

    // Robust Price Lookup Helper (Extracted for use in sorting)
    const getPrice = (prices: Record<string, number>, type: string): number => {
        if (!prices) return 0;
        if (prices[type] !== undefined) return prices[type];
        const lowerType = type.toLowerCase();
        const caseKey = Object.keys(prices).find(k => k.toLowerCase() === lowerType);
        if (caseKey && prices[caseKey] !== undefined) return prices[caseKey];
        if (lowerType === 'sedan') {
            if (prices['midsize_sedan'] !== undefined) return prices['midsize_sedan'];
            if (prices['compact_car'] !== undefined) return prices['compact_car'];
            if (prices['Sedan'] !== undefined) return prices['Sedan'];
        }
        if (lowerType === 'suv') {
            if (prices['SUV'] !== undefined) return prices['SUV'];
        }
        if (lowerType === 'truck') {
            if (prices['compact_truck'] !== undefined) return prices['compact_truck'];
            if (prices['fullsize_truck'] !== undefined) return prices['fullsize_truck'];
        }
        return 0;
    };

    // Sorting by Price for the current vehicle type
    const packages = [...(Array.isArray(propPackages) ? propPackages : [])].sort((a, b) => {
        const priceA = getPrice(a.price, currentVehicleType);
        const priceB = getPrice(b.price, currentVehicleType);
        return priceA - priceB;
    });

    const INTERIOR_ADDONS = [
        'addon_headliner',
        'addon_leather_ceramic',
        'addon_shampoo',
        'addon_upholstery_conditioner'
    ];

    const isExteriorOnly = false;

    const handlePackageSelect = (packageId: string) => {
        const newConfigs = [...vehicleConfigs];
        const currentConfig = newConfigs[currentVehicleIndex];

        let newAddonIds = currentConfig?.addonIds || [];

        newConfigs[currentVehicleIndex] = {
            ...currentConfig,
            packageId,
            addonIds: newAddonIds
        };
        setVehicleConfigs(newConfigs);

        // Slow Custom Auto-scroll to Add-ons section
        setTimeout(() => {
            if (addonsSectionRef.current) {
                const element = addonsSectionRef.current;
                const container = element.closest('.overflow-y-auto');
                if (container) {
                    const elementRect = element.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    const targetScrollTop = container.scrollTop + (elementRect.top - containerRect.top) - 20; // 20px offset
                    const startScrollTop = container.scrollTop;
                    const distance = targetScrollTop - startScrollTop;
                    const duration = 1200; // Slower duration in ms
                    let startTimestamp: number | null = null;

                    const step = (timestamp: number) => {
                        if (!startTimestamp) startTimestamp = timestamp;
                        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                        const easeInOutQuart = progress < 0.5
                            ? 8 * progress * progress * progress * progress
                            : 1 - Math.pow(-2 * progress + 2, 4) / 2;

                        container.scrollTop = startScrollTop + distance * easeInOutQuart;
                        if (progress < 1) {
                            window.requestAnimationFrame(step);
                        }
                    };
                    window.requestAnimationFrame(step);
                }
            }
        }, 300);
    };

    const handleAddonToggle = (addonId: string) => {
        if (isExteriorOnly && INTERIOR_ADDONS.includes(addonId)) {
            showToast('Interior add-ons require a package with interior service', 'error');
            return;
        }

        const newConfigs = [...vehicleConfigs];
        const currentAddonIds = newConfigs[currentVehicleIndex]?.addonIds || [];

        if (currentAddonIds.includes(addonId)) {
            newConfigs[currentVehicleIndex].addonIds = currentAddonIds.filter((id: string) => id !== addonId);
        } else {
            newConfigs[currentVehicleIndex].addonIds = [...currentAddonIds, addonId];
        }

        setVehicleConfigs(newConfigs);
    };

    const handleNext = () => {
        if (!currentConfig?.packageId) {
            showToast('Please select a package', 'error');
            return;
        }



        if (isLastVehicle) {
            navigate(Screen.CLIENT_DATE_TIME);
        } else {
            setCurrentVehicleIndex(currentVehicleIndex + 1);
        }
    };

    const handlePrevious = () => {
        if (currentVehicleIndex > 0) {
            setCurrentVehicleIndex(currentVehicleIndex - 1);
        } else {
            navigate(Screen.CLIENT_VEHICLE);
        }
    };

    const canProceed = !!currentConfig?.packageId;

    return (
        <div className="flex flex-col h-full bg-background-dark text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Native Toast */}
            {localToast && (
                <NativeToast
                    message={localToast.message}
                    type={localToast.type}
                    onClose={() => setLocalToast(null)}
                />
            )}

            <header className="flex items-center px-4 py-4 border-b border-white/5">
                <button onClick={handlePrevious} className="p-2 -ml-2">
                    <span className="material-symbols-outlined text-slate-400">arrow_back_ios_new</span>
                </button>
                <h1 className="flex-1 text-center font-bold text-lg mr-8">Select Services</h1>
            </header>

            <div className="flex-1 overflow-y-auto p-4 pb-64">
                {/* Vehicle Progress */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-wider">
                            Vehicle {currentVehicleIndex + 1} of {selectedVehicleIds.length}
                        </p>
                        <p className="text-sm font-black text-primary">{currentVehicle?.model || 'Unknown'}</p>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-500 shadow-blue"
                            style={{ width: `${((currentVehicleIndex + 1) / (selectedVehicleIds.length || 1)) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Packages Section */}
                <div className="space-y-4 mb-8">
                    <h2 className="text-xs text-slate-500 uppercase font-black tracking-widest px-1">Select Wash Package</h2>

                    {packagesError ? (
                        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center animate-shake">
                            <span className="material-symbols-outlined text-4xl text-red-500 mb-2">error</span>
                            <p className="text-sm text-red-400">{packagesError}</p>
                        </div>
                    ) : packages.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <span className="material-symbols-outlined text-4xl text-slate-600 mb-2 animate-pulse">inventory_2</span>
                            <p className="text-slate-500 text-sm">Loading service packages...</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {packages.map((pkg) => {
                                const isSelected = currentConfig?.packageId === pkg.id;

                                // Use the extracted helper
                                const price = getPrice(pkg.price, currentVehicleType);

                                return (
                                    <button
                                        key={pkg.id}
                                        onClick={() => handlePackageSelect(pkg.id)}
                                        className={`w-full text-left p-5 rounded-[2rem] border-2 transition-all active:scale-[0.98] ${isSelected ? 'bg-primary border-primary shadow-blue-lg' : 'bg-surface-dark border-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-white bg-white/10' : 'border-slate-500'}`}>
                                                    {isSelected && <span className="material-symbols-outlined text-sm font-black">check</span>}
                                                </div>
                                                <h3 className={`font-black text-lg ${isSelected ? 'text-white' : 'text-slate-200'}`}>{pkg.name}</h3>
                                            </div>
                                            <p className={`font-black text-xl ${isSelected ? 'text-white' : 'text-primary'}`}>${price}</p>
                                        </div>
                                        <p className={`text-sm mb-4 line-clamp-2 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                            {pkg.description}
                                        </p>

                                        {Array.isArray(pkg.features) && pkg.features.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {pkg.features.slice(0, 3).map((f, i) => (
                                                    <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${isSelected ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-500'}`}>
                                                        {f}
                                                    </span>
                                                ))}
                                                {pkg.features.length > 3 && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${isSelected ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-500'}`}>
                                                        +{pkg.features.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Add-ons Section */}
                <div className="space-y-4" ref={addonsSectionRef}>
                    <h2 className="text-xs text-slate-500 uppercase font-black tracking-widest px-1">Extra Enhancements</h2>

                    {!currentConfig?.packageId ? (
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center opacity-50">
                            <p className="text-xs text-slate-600 italic">Please select a wash package first to enable add-ons.</p>
                        </div>
                    ) : addons.length === 0 ? (
                        <div className="p-4 rounded-xl text-center">
                            <p className="text-slate-500 text-xs italic">No additional enhancements available.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {addons.map((addon) => {
                                const isSelected = (currentConfig?.addonIds || []).includes(addon.id);
                                const isRestricted = isExteriorOnly && INTERIOR_ADDONS.includes(addon.id);

                                // Re-use the logic (simplified inline or we could hoist it, but inline is safe here for reading context)
                                const getPrice = (prices: Record<string, number>, type: string): number => {
                                    if (!prices) return 0;
                                    if (prices[type] !== undefined) return prices[type];
                                    const lowerType = type.toLowerCase();
                                    const caseKey = Object.keys(prices).find(k => k.toLowerCase() === lowerType);
                                    if (caseKey && prices[caseKey] !== undefined) return prices[caseKey];
                                    if (lowerType === 'sedan') {
                                        if (prices['midsize_sedan'] !== undefined) return prices['midsize_sedan'];
                                        if (prices['compact_car'] !== undefined) return prices['compact_car'];
                                        if (prices['Sedan'] !== undefined) return prices['Sedan'];
                                    }
                                    return 0;
                                };

                                const price = getPrice(addon.price, currentVehicleType);

                                return (
                                    <button
                                        key={addon.id}
                                        onClick={() => handleAddonToggle(addon.id)}
                                        disabled={isRestricted}
                                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${isSelected ? 'bg-primary/10 border-primary shadow-blue' : 'bg-surface-dark border-white/5'
                                            } ${isRestricted ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : isRestricted ? 'border-slate-700' : 'border-slate-500'}`}>
                                                {isSelected && <span className="material-symbols-outlined text-xs font-black text-white">check</span>}
                                                {isRestricted && <span className="material-symbols-outlined text-[12px] text-slate-600 font-bold">lock</span>}
                                            </div>
                                            <div className="text-left">
                                                <h4 className={`font-bold ${isRestricted ? 'text-slate-500' : 'text-slate-200'}`}>{addon.name}</h4>
                                                <p className="text-[10px] text-slate-500 line-clamp-1">
                                                    {isRestricted ? 'Requires interior service' : addon.description}
                                                </p>
                                            </div>
                                        </div>
                                        <p className={`font-black text-sm ${isRestricted ? 'text-slate-700' : 'text-primary'}`}>+${price}</p>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Button Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-dark via-background-dark/95 to-transparent backdrop-blur-sm" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
                <button
                    onClick={handleNext}
                    disabled={!canProceed}
                    className={`w-full h-14 rounded-2xl font-black text-lg transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2 ${canProceed ? 'bg-primary text-white shadow-blue-lg hover:brightness-110' : 'bg-white/5 text-slate-600 grayscale cursor-not-allowed'
                        }`}
                >
                    {isLastVehicle ? 'Schedule Wash' : 'Next: Service next vehicle'}
                    <span className="material-symbols-outlined">arrow_forward</span>
                </button>
            </div>
        </div>
    );
};
