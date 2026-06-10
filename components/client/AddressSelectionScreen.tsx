import React, { useState } from 'react';
import { Screen, ToastType } from '../../types';
import { isWithinServiceArea } from '../../utils/location';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { i18n } from '../../services/i18n';

interface AddressSelectionScreenProps {
    selectedAddress: string;
    setSelectedAddress: (address: string) => void;
    selectedLocation: { lat: number; lng: number } | null;
    setSelectedLocation: (location: { lat: number; lng: number } | null) => void;
    navigate: (screen: Screen) => void;
    showToast: (message: string, type: ToastType) => void;
    savedAddresses?: { id: string; address: string; label: string; icon?: string; lat?: number; lng?: number }[];
    userAddress?: string;
    onSaveAddress?: (data: { label: string; address: string; lat: number; lng: number }) => Promise<boolean>;
    onDeleteAddress?: (id: string) => Promise<void>;
    serviceArea?: any;
}

export const AddressSelectionScreen: React.FC<AddressSelectionScreenProps> = ({
    selectedAddress,
    setSelectedAddress,
    selectedLocation,
    setSelectedLocation,
    navigate,
    showToast,
    savedAddresses = [],
    userAddress,
    onSaveAddress,
    onDeleteAddress,
    serviceArea
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isOutsideArea, setIsOutsideArea] = useState(false);

    // New Address Form State
    const [formData, setFormData] = useState({
        street: '',
        city: '',
        zip: '',
        apt: '', // Optional
        label: ''
    });

    const [isGeocoding, setIsGeocoding] = useState(false);

    // Helpers to handle selecting an existing address
    const handleUseAddress = (addr: { address: string; lat?: number; lng?: number }) => {
        // If coordinates are already persisted, use them immediately!
        if (typeof addr.lat === 'number' && typeof addr.lng === 'number' && addr.lat !== 0) {
            console.log('📍 Using persisted coordinates for address:', addr.address, addr.lat, addr.lng);

            if (!isWithinServiceArea(addr.lat, addr.lng, serviceArea)) {
                showToast('Sorry, this address is outside our service area.', 'error');
                setIsOutsideArea(true);
            } else {
                setIsOutsideArea(false);
                showToast('Address selected', 'success');
            }

            setSelectedAddress(addr.address);
            setSelectedLocation({ lat: addr.lat, lng: addr.lng });
            return;
        }

        // Otherwise, geocode as fallback
        console.log('🔄 Geocoding address (no persisted coordinates):', addr.address);
        setIsGeocoding(true);
        if (!window.google || !window.google.maps) {
            setIsGeocoding(false);
            setSelectedAddress(addr.address);
            setSelectedLocation({ lat: 0, lng: 0 });
            showToast('Maps not loaded. Address selected blindly.', 'warning');
            return;
        }

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: addr.address }, (results, status) => {
            setIsGeocoding(false);
            if (status === 'OK' && results && results[0] && results[0].geometry.location) {
                const location = results[0].geometry.location;

                if (!isWithinServiceArea(location.lat(), location.lng(), serviceArea)) {
                    showToast('Sorry, this address is outside our service area.', 'error');
                    setIsOutsideArea(true);
                } else {
                    setIsOutsideArea(false);
                    showToast('Address validated successfully', 'success');
                }

                setSelectedAddress(addr.address);
                setSelectedLocation({
                    lat: location.lat(),
                    lng: location.lng()
                });
            } else {
                setSelectedAddress(addr.address);
                showToast('Could not verify exact location. Please try adding it again.', 'warning');
                setSelectedLocation({ lat: 0, lng: 0 });
            }
        });
    };

    const handleSaveNewAddress = async () => {
        // Validation
        if (!formData.street || !formData.city || !formData.zip) {
            showToast('Please fill in Street, City and Zip Code.', 'error');
            return;
        }

        const fullAddress = `${formData.street}${formData.apt ? ', Apt ' + formData.apt : ''}, ${formData.city}, ${formData.zip}`;

        setIsGeocoding(true);

        if (!window.google || !window.google.maps) {
            showToast('Maps service unavailable.', 'error');
            setIsGeocoding(false);
            return;
        }

        // 1. Geocode Validation
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: fullAddress }, async (results, status) => {
            setIsGeocoding(false);

            if (status === 'OK' && results && results[0] && results[0].geometry.location) {
                const location = results[0].geometry.location;

                // Validate Service Area
                if (!isWithinServiceArea(location.lat(), location.lng(), serviceArea)) {
                    showToast('Sorry, this address is outside our service area. Please contact us to see if we can reach your location.', 'error');
                    setIsOutsideArea(true);
                    // We still set it so they can see where they are, but blocked
                    setSelectedAddress(results[0].formatted_address || fullAddress);
                    setSelectedLocation({
                        lat: location.lat(),
                        lng: location.lng()
                    });
                    setIsEditing(false);
                    return;
                }

                setIsOutsideArea(false);

                // 2. Save to Profile
                if (onSaveAddress) {
                    const success = await onSaveAddress({
                        label: formData.label || 'Saved Address',
                        address: results[0].formatted_address || fullAddress,
                        lat: location.lat(),
                        lng: location.lng()
                    });

                    if (success) {
                        setSelectedAddress(results[0].formatted_address || fullAddress);
                        setSelectedLocation({
                            lat: location.lat(),
                            lng: location.lng()
                        });
                        setIsEditing(false);
                        // Reset form
                        setFormData({ street: '', city: '', zip: '', apt: '', label: '' });
                    }
                } else {
                    // Fallback local usage
                    setSelectedAddress(fullAddress);
                    setSelectedLocation({
                        lat: location.lat(),
                        lng: location.lng()
                    });
                    setIsEditing(false);
                }

            } else {
                showToast('Could not find location. Please check the address details.', 'error');
            }
        });
    };

    const handleContinue = () => {
        if (!selectedAddress || !selectedLocation) {
            showToast('Please select or enter a valid address', 'error');
            return;
        }

        // ✅ VALIDATE SERVICE AREA BEFORE CONTINUING
        if (selectedLocation.lat !== 0 && selectedLocation.lng !== 0) {
            if (!isWithinServiceArea(selectedLocation.lat, selectedLocation.lng, serviceArea)) {
                showToast('Sorry, this address is outside our service area. Please contact us to see if we can reach your location.', 'error');
                setIsOutsideArea(true);
                return;
            }
        }

        navigate(Screen.CLIENT_PAYMENT_METHODS);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (onDeleteAddress) {
            await onDeleteAddress(id);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background-dark text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <header className="flex items-center px-4 py-4 border-b border-white/5">
                <button onClick={() => navigate(Screen.CLIENT_DATE_TIME)}>
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
                <h1 className="flex-1 text-center font-bold text-lg mr-6">Service Address</h1>
            </header>

            <div className="flex-1 overflow-y-auto p-4 pb-64">
                {!isEditing ? (
                    <>
                        {isOutsideArea && (
                            <div className="mb-6 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-2xl animate-in fade-in zoom-in duration-300">
                                <div className="flex gap-3 mb-3">
                                    <span className="material-symbols-outlined text-red-500">error</span>
                                    <div>
                                        <p className="font-bold text-red-400 text-sm">Outside Service Area</p>
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            Sorry, this address is outside our service area. Please contact us to see if we can reach your location.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate(Screen.CLIENT_REPORT_ISSUE)}
                                    className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">chat</span>
                                    Contact Support
                                </button>
                            </div>
                        )}

                        <p className="text-slate-400 text-sm mb-6">Where should we wash your vehicle(s)?</p>

                        <div className="space-y-4">
                            {/* SAVED ADDRESSES LIST */}
                            {(savedAddresses || []).length > 0 ? (
                                (savedAddresses || []).map((addr, idx) => (
                                    <div
                                        key={addr.id || idx}
                                        className={`relative rounded-xl border-2 transition-all ${selectedAddress === addr.address ? 'bg-[#3b82f6]/10 border-[#3b82f6] shadow-blue' : 'bg-surface-dark border-white/10 hover:border-white/30'}`}
                                    >
                                        {/* Main select button — full width, with right padding to avoid delete button */}
                                        <button
                                            onClick={() => handleUseAddress(addr)}
                                            disabled={isGeocoding}
                                            className="w-full p-4 pr-14 text-left flex items-center gap-3"
                                        >
                                            {/* Icon */}
                                            <span className={`material-symbols-outlined shrink-0 ${selectedAddress === addr.address ? 'text-[#3b82f6]' : 'text-slate-400'}`}>
                                                {addr.icon || 'location_on'}
                                            </span>

                                            {/* Text */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-sm truncate ${selectedAddress === addr.address ? 'text-[#3b82f6]' : 'text-white'}`}>{addr.label}</p>
                                                <p className="text-xs text-slate-400 truncate">{addr.address}</p>
                                            </div>

                                            {/* Selection check — shown when selected */}
                                            {selectedAddress === addr.address && (
                                                <span className="material-symbols-outlined text-[#3b82f6] text-xl shrink-0 mr-8">check_circle</span>
                                            )}
                                        </button>

                                        {/* Delete Button — absolute, vertically centered, pinned to right edge */}
                                        <button
                                            onClick={(e) => handleDelete(e, addr.id)}
                                            className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors rounded-r-xl"
                                            title="Remove Address"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 italic text-center py-4">No saved addresses found.</p>
                            )}

                            {/* Add New Button */}
                            <button
                                onClick={() => setIsEditing(true)}
                                className="w-full p-4 rounded-xl border-2 border-dashed border-white/20 hover:border-primary/50 transition-colors flex items-center justify-center gap-2 text-slate-400 hover:text-primary mt-4"
                            >
                                <span className="material-symbols-outlined">add</span>
                                Add New Address
                            </button>
                        </div>
                    </>
                ) : (
                    // FORM VIEW
                    <div className="animate-in slide-in-from-right-10 duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-bold text-lg">Add New Address</h2>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                Cancel
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Label */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Label (e.g. Home, Office)</label>
                                <input
                                    type="text"
                                    value={formData.label}
                                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary outline-none text-white"
                                    placeholder="My Address"
                                />
                            </div>

                            {/* Street & Autocomplete */}
                            <div className="mb-4">
                                <AddressAutocomplete
                                    label="Search Address"
                                    value={formData.street}
                                    onChange={(val) => setFormData({ ...formData, street: val })}
                                    onAddressSelect={(fullAddr, lat, lng, meta) => {
                                        setFormData({
                                            ...formData,
                                            street: fullAddr,
                                            city: meta?.city || formData.city,
                                            zip: meta?.zip || formData.zip,
                                            label: formData.label || 'My Address'
                                        });
                                    }}
                                    placeholder="Start typing your address..."
                                />
                            </div>

                            {/* Apt / Suite */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Apt / Suite (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.apt}
                                    onChange={(e) => setFormData({ ...formData, apt: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary outline-none text-white"
                                    placeholder="Apt 4B"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* City */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">City</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full p-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary outline-none text-white"
                                        placeholder="Los Angeles"
                                    />
                                </div>

                                {/* Zip */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Zip Code</label>
                                    <input
                                        type="text"
                                        value={formData.zip}
                                        onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                                        className="w-full p-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary outline-none text-white"
                                        placeholder="90012"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveNewAddress}
                                disabled={isGeocoding}
                                className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all mt-4 flex items-center justify-center gap-2 shadow-blue"
                            >
                                {isGeocoding ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                        Validating...
                                    </>
                                ) : (
                                    'Save & Use Address'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Action */}
            {!isEditing && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-dark via-background-dark to-transparent z-10" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
                    <button
                        onClick={handleContinue}
                        disabled={!selectedAddress || !selectedLocation || isGeocoding || isOutsideArea}
                        style={selectedAddress && selectedLocation && !isOutsideArea ? { backgroundColor: '#3b82f6' } : {}}
                        className={`w-full h-14 rounded-xl font-bold text-lg transition-all ${selectedAddress && selectedLocation && !isOutsideArea
                            ? 'hover:brightness-90 text-white shadow-blue'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        {isGeocoding ? 'Validating Address...' : isOutsideArea ? 'Outside Coverage Range' : 'Continue to Summary'}
                    </button>
                </div>
            )}
        </div>
    );
};
