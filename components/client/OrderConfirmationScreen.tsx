import React, { useState } from 'react';
import { Screen, ServicePackage, ServiceAddon, SavedVehicle, VehicleType, Discount } from '../../types';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { calculateLocationSurcharges } from '../../utils/location';

interface OrderConfirmationScreenProps {
    packages: ServicePackage[];
    addons: ServiceAddon[];
    vehicles: SavedVehicle[];
    vehicleConfigs: any[];
    selectedOption: 'asap' | 'scheduled';
    selectedDate: string;
    selectedTime: string;
    selectedAddress: string;
    navigate: (screen: Screen) => void;
    onConfirmOrder: (finalTotal: number, discount?: Discount | null) => void;
    globalFees: { name: string, percentage: number }[];
    discounts: Discount[];
    showFeesToClient?: boolean;
    selectedCard?: { id: string; brand: string; last4: string; expiry: string } | null;
    selectedPaymentType?: 'cash' | 'card';
    onAddCard?: () => void;
    userId?: string;
    userEmail?: string;
    isFirstOrder?: boolean;
    isProcessing?: boolean;
    i18n: any;
    selectedLocation: { lat: number; lng: number } | null;
    serviceArea: any;
}

export const OrderConfirmationScreen: React.FC<OrderConfirmationScreenProps> = ({
    packages,
    addons,
    vehicles,
    vehicleConfigs,
    selectedOption,
    selectedDate,
    selectedTime,
    selectedAddress,
    navigate,
    onConfirmOrder,
    globalFees,
    discounts,
    showFeesToClient = false,
    selectedCard = null,
    selectedPaymentType = 'cash',
    onAddCard = () => { },
    userId,
    userEmail,
    isFirstOrder = false,
    isProcessing = false,
    i18n,
    selectedLocation,
    serviceArea
}) => {
    const [discountCode, setDiscountCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
    const [discountError, setDiscountError] = useState('');
    const [showTipCustom, setShowTipCustom] = useState(false);

    // Prevent "ghost clicks" from previous screens by adding a small mount delay
    const [canClick, setCanClick] = React.useState(false);
    React.useEffect(() => {
        const timer = setTimeout(() => setCanClick(true), 500);
        return () => clearTimeout(timer);
    }, []);

    // Calculate subtotal (services only)
    const calculateSubtotal = () => {
        let subtotal = 0;
        (vehicleConfigs || []).forEach(config => {
            const pkg = (packages || []).find(p => p.id === config.packageId);
            const vehicle = (vehicles || []).find(v => v.id === config.vehicleId);
            if (pkg && vehicle) {
                const basePrice = pkg.price?.[vehicle.type as VehicleType] || 0;
                subtotal += basePrice;

                (config.addonIds || []).forEach((addonId: string) => {
                    const addon = (addons || []).find(a => a.id === addonId);
                    if (addon) {
                        subtotal += addon.price?.[vehicle.type as VehicleType] || 0;
                    }
                });
            }
        });
        return subtotal;
    };

    const handleApplyDiscount = async () => {
        if (!discountCode.trim()) {
            setDiscountError('Please enter a discount code');
            return;
        }

        console.log('🔍 Checking discount:', discountCode, 'Available:', discounts);

        let discount = (discounts || []).find(d =>
            d.code.toLowerCase() === discountCode.toLowerCase() &&
            d.active
        );

        if (!discount) {
            try {
                const q = query(
                    collection(db, 'discounts'),
                    where('code', '==', discountCode.toUpperCase()),
                    where('active', '==', true)
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    discount = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Discount;
                }
            } catch (err) {
                console.error("Error fetching discount from Firestore:", err);
            }
        }

        if (!discount) {
            setDiscountError('Invalid or expired discount code');
            setAppliedDiscount(null);
            return;
        }

        if (discount.clientId && discount.clientId !== userId) {
            setDiscountError('This code is exclusive to another user');
            setAppliedDiscount(null);
            return;
        }

        // Check email restriction
        if (discount.restrictedToEmail && discount.restrictedToEmail.toLowerCase() !== userEmail?.toLowerCase()) {
            setDiscountError('This code is exclusive to a specific email address');
            setAppliedDiscount(null);
            return;
        }

        // Check single use per client limit
        if (discount.singleUsePerClient && discount.usedBy?.includes(userId || '')) {
            setDiscountError('You have already used this discount code');
            setAppliedDiscount(null);
            return;
        }

        // Check usage limit
        if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
            setDiscountError('This code has reached its usage limit');
            setAppliedDiscount(null);
            return;
        }

        // Check first order only constraint
        if (discount.firstOrderOnly && !isFirstOrder) {
            setDiscountError('This code is only valid for your first wash');
            setAppliedDiscount(null);
            return;
        }

        // Check date validity
        const now = new Date();
        if (discount.validFrom && new Date(discount.validFrom) > now) {
            setDiscountError('This code is not valid yet');
            setAppliedDiscount(null);
            return;
        }
        if (discount.validUntil) {
            const expiryDate = new Date(discount.validUntil);
            // Validation is inclusive of the end date (valid until 23:59:59 of that day)
            expiryDate.setHours(23, 59, 59, 999);

            if (expiryDate < now) {
                setDiscountError('This code has expired');
                setAppliedDiscount(null);
                return;
            }
        }

        console.log('✅ Discount applied:', discount);
        setDiscountError('');
        setAppliedDiscount(discount);
    };

    const numVehicles = (vehicleConfigs || []).length;
    const { wealthyAreaPremium, distanceSurcharge, distanceMiles } = calculateLocationSurcharges(
        selectedAddress,
        selectedLocation,
        serviceArea,
        numVehicles
    );

    const subtotal = calculateSubtotal();
    const washNowFee = selectedOption === 'asap' ? 15 : 0;
    const subtotalWithWashNow = subtotal + washNowFee + wealthyAreaPremium + distanceSurcharge;

    // Calculate discount amount
    let discountAmount = 0;
    if (appliedDiscount) {
        if (appliedDiscount.type === 'percentage') {
            discountAmount = (subtotalWithWashNow * appliedDiscount.value) / 100;
        } else {
            discountAmount = appliedDiscount.value;
        }
        // Check minimum order amount
        if (appliedDiscount.minimumOrderAmount && subtotalWithWashNow < appliedDiscount.minimumOrderAmount) {
            discountAmount = 0;
        }
    }

    const subtotalAfterDiscount = subtotalWithWashNow - discountAmount;

    // Calculate global fees (for display/washer calculations only, NOT charged to client)
    const totalFeesAmount = (globalFees || []).reduce((acc, fee) => {
        return acc + (subtotalAfterDiscount * fee.percentage / 100);
    }, 0);

    // Client pays ONLY the subtotal after discount (NO FEES)
    const finalTotal = subtotalAfterDiscount;

    return (
        <div className="flex flex-col h-full bg-background-dark text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <header className="flex items-center px-4 py-4 border-b border-white/5">
                <button onClick={() => navigate(Screen.CLIENT_ADDRESS)}>
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
                <h1 className="flex-1 text-center font-bold text-lg mr-6">{i18n.t('confirm_order')}</h1>
            </header>

            <div className="flex-1 overflow-y-auto p-4 pb-96">
                <p className="text-slate-400 text-sm mb-6">{i18n.t('review_order_details')}</p>

                {/* Vehicles Section */}
                <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-sm text-slate-400 uppercase font-bold">{i18n.t('vehicles_services')}</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => navigate(Screen.CLIENT_VEHICLE)}
                                className="text-primary text-sm font-bold flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-lg">add</span>
                                {i18n.t('add')}
                            </button>
                            <button
                                onClick={() => navigate(Screen.CLIENT_VEHICLE)}
                                className="text-primary text-sm font-bold flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-lg">edit</span>
                                {i18n.t('edit')}
                            </button>
                        </div>
                    </div>

                    {(vehicleConfigs || []).map((config, index) => {
                        const vehicle = (vehicles || []).find(v => v.id === config.vehicleId);
                        const vehicleType = vehicle?.type || 'sedan';
                        const pkg = (packages || []).find(p => p.id === config.packageId);

                        return (
                            <div key={config.vehicleId} className="bg-surface-dark rounded-xl border border-white/10 overflow-hidden">
                                {/* Vehicle Header with Photo */}
                                <div className="flex items-center gap-4 p-4 bg-white/5">
                                    <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                                        {vehicle?.image ? (
                                            <img src={vehicle.image} alt={vehicle.model} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="material-symbols-outlined text-4xl text-primary">directions_car</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg">{vehicle?.model}</h3>
                                        <p className="text-sm text-slate-400">{vehicle?.color}</p>
                                        <p className="text-xs text-slate-500 mt-1">{vehicleType}</p>
                                    </div>
                                </div>

                                {/* Package and Addons */}
                                <div className="p-4 space-y-3">
                                    {/* Package */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <p className="text-xs text-slate-500 mb-1">{i18n.t('service')}</p>
                                            <p className="font-bold">{pkg?.name}</p>
                                            <p className="text-xs text-slate-400 mt-1">{pkg?.description}</p>
                                        </div>
                                        <p className="font-bold text-primary">${(pkg?.price && pkg.price[vehicleType as VehicleType]) || 0}</p>
                                    </div>

                                    {/* Addons */}
                                    {config.addonIds && config.addonIds.length > 0 && (
                                        <div className="border-t border-white/5 pt-3">
                                            <p className="text-xs text-slate-500 mb-2">{i18n.t('extras')}</p>
                                            {(config.addonIds || []).map((addonId: string) => {
                                                const addon = (addons || []).find(a => a.id === addonId);
                                                return (
                                                    <div key={addonId} className="flex justify-between text-sm text-slate-300 mb-1">
                                                        <span>+ {addon?.name}</span>
                                                        <span>${(addon?.price && addon.price[vehicleType as VehicleType]) || 0}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Date & Time */}
                <div className="space-y-4 mb-6">
                    <h2 className="text-sm text-slate-400 uppercase font-bold">Schedule</h2>
                    <div className="p-4 rounded-xl bg-surface-dark border border-white/10">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary">schedule</span>
                            <div>
                                {selectedOption === 'asap' ? (
                                    <>
                                        <p className="font-bold">{i18n.t('wash_now_service')}</p>
                                        <p className="text-sm text-slate-400">{i18n.t('arrival_range')}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-bold">{selectedDate}</p>
                                        <p className="text-sm text-slate-400">{selectedTime}</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Address */}
                <div className="space-y-4 mb-6">
                    <h2 className="text-sm text-slate-400 uppercase font-bold">{i18n.t('location')}</h2>
                    <div className="p-4 rounded-xl bg-surface-dark border border-white/10">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-primary">location_on</span>
                            <p className="text-sm flex-1">{selectedAddress}</p>
                        </div>
                    </div>
                </div>

                {/* Discount Code */}
                <div className="space-y-4 mb-6">
                    <h2 className="text-xs text-slate-400 uppercase font-bold">{i18n.t('discount_code')}</h2>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={discountCode}
                            onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                            placeholder={i18n.t('enter_code')}
                            className="flex-1 px-3 py-2 rounded-xl bg-surface-dark border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-primary"
                        />
                        <button
                            onClick={handleApplyDiscount}
                            style={{ backgroundColor: '#3b82f6' }}
                            className="px-4 py-2 rounded-xl text-white text-sm font-bold hover:brightness-110 transition-all shadow-blue whitespace-nowrap"
                        >
                            {i18n.t('apply')}
                        </button>
                    </div>
                    {discountError && (
                        <p className="text-red-400 text-sm">{discountError}</p>
                    )}
                    {appliedDiscount && (
                        <div className="flex items-center gap-2 text-green-400 text-sm">
                            <span className="material-symbols-outlined text-lg">check_circle</span>
                            <span>Discount "{appliedDiscount.code}" applied!</span>
                        </div>
                    )}
                </div>

                {/* Payment Method */}
                <div className="space-y-4 mb-6">
                    <h2 className="text-sm text-slate-400 uppercase font-bold">{i18n.t('payment_methods')}</h2>

                    <div className="p-4 rounded-xl bg-surface-dark border border-white/10">
                        {selectedPaymentType === 'cash' ? (
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-green-400 mt-0.5">payments</span>
                                <div className="flex-1">
                                    <p className="font-bold text-white">{i18n.t('pay_with_cash')}</p>
                                    <p className="text-xs text-slate-400 mt-1">{i18n.t('pay_washer_directly')}</p>
                                </div>
                                <button onClick={() => navigate(Screen.CLIENT_PAYMENT_METHODS)} className="text-primary text-xs font-bold">{i18n.t('change')}</button>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-primary mt-0.5">credit_card</span>
                                <div className="flex-1">
                                    {selectedCard ? (
                                        <>
                                            <p className="font-bold text-white">{selectedCard.brand.toUpperCase()} •••• {selectedCard.last4}</p>
                                            <p className="text-xs text-slate-400 mt-1">{i18n.t('exp')}: {selectedCard.expiry}</p>
                                        </>
                                    ) : (
                                        <p className="text-red-400 font-bold">{i18n.t('no_card_selected')}</p>
                                    )}
                                    <p className="text-xs text-slate-500 mt-1">{i18n.t('charged_after_service')}</p>
                                </div>
                                <button onClick={() => navigate(Screen.CLIENT_PAYMENT_METHODS)} className="text-primary text-xs font-bold">{i18n.t('change')}</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Professional Receipt "Ticket" */}
                <div className="relative mb-6">
                    {/* Top "Teeth" effect (optional but cool) */}
                    <div className="absolute -top-1 left-0 right-0 h-1 flex justify-between px-1 opacity-20">
                        {[...Array(20)].map((_, i) => (
                            <div key={i} className="w-1 h-1 bg-white rounded-full" />
                        ))}
                    </div>

                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
                        {/* Ticket Header */}
                        <div className="bg-primary/10 p-4 border-b border-dashed border-white/20">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{i18n.t('billing_summary')}</span>
                                <span className="text-[10px] font-mono text-slate-500">#{Math.random().toString(36).substring(7).toUpperCase()}</span>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Per-Vehicle Breakdown */}
                            <div className="space-y-3">
                                {(vehicleConfigs || []).map((config, index) => {
                                    const vehicle = (vehicles || []).find(v => v.id === config.vehicleId);
                                    const vehicleType = vehicle?.type || 'sedan';
                                    const pkg = (packages || []).find(p => p.id === config.packageId);
                                    const pkgPrice = pkg?.price?.[vehicleType as VehicleType] || 0;

                                    return (
                                        <div key={config.vehicleId} className="group">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-white">{vehicle?.model}</span>
                                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">{pkg?.name}</span>
                                                </div>
                                                <span className="font-mono text-sm">${pkgPrice.toFixed(2)}</span>
                                            </div>
                                            {config.addonIds && config.addonIds.length > 0 && (
                                                <div className="ml-2 mt-1.5 space-y-1 border-l border-white/10 pl-3">
                                                    {(config.addonIds || []).map((addonId: string) => {
                                                        const addon = (addons || []).find(a => a.id === addonId);
                                                        const addonPrice = addon?.price?.[vehicleType as VehicleType] || 0;
                                                        return (
                                                            <div key={addonId} className="flex justify-between text-[11px] text-slate-400">
                                                                <span>{addon?.name}</span>
                                                                <span className="font-mono">${addonPrice.toFixed(2)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Ticket Separator */}
                            <div className="border-t border-dashed border-white/10 my-2" />

                            {/* Totals Section */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs text-slate-400">
                                    <span>Subtotal</span>
                                    <span className="font-mono text-white">${subtotal.toFixed(2)}</span>
                                </div>
                                
                                {selectedOption === 'asap' && (
                                    <div className="flex justify-between items-center text-xs text-slate-400">
                                        <div className="flex items-center gap-1">
                                            <span>{i18n.t('wash_now_fee')}</span>
                                            <span className="material-symbols-outlined text-[10px] text-primary">bolt</span>
                                        </div>
                                        <span className="font-mono text-white">$15.00</span>
                                    </div>
                                )}

                                {wealthyAreaPremium > 0 && (
                                    <div className="flex justify-between items-center text-xs text-slate-400">
                                        <div className="flex items-center gap-1">
                                            <span>Premium Location Fee</span>
                                            <span className="material-symbols-outlined text-[10px] text-yellow-500">payments</span>
                                        </div>
                                        <span className="font-mono text-white">${wealthyAreaPremium.toFixed(2)}</span>
                                    </div>
                                )}

                                {distanceSurcharge > 0 && (
                                    <div className="flex justify-between items-center text-xs text-slate-400">
                                        <div className="flex items-center gap-1">
                                            <span>Long Distance Fee ({distanceMiles.toFixed(1)} mi)</span>
                                            <span className="material-symbols-outlined text-[10px] text-primary">distance</span>
                                        </div>
                                        <span className="font-mono text-white">${distanceSurcharge.toFixed(2)}</span>
                                    </div>
                                )}

                                {appliedDiscount && discountAmount > 0 && (
                                    <div className="flex justify-between items-center text-xs text-green-400 bg-green-500/5 p-2 rounded-lg border border-green-500/10">
                                        <div className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-xs">local_offer</span>
                                            <span>{appliedDiscount.code} ({appliedDiscount.type === 'percentage' ? `${appliedDiscount.value}%` : `$${appliedDiscount.value}`})</span>
                                        </div>
                                        <span className="font-mono">-${discountAmount.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom Barcode Aesthetic */}
                        <div className="bg-white/5 p-3 flex justify-center opacity-30 gap-1 border-t border-white/5">
                            {[2, 4, 1, 6, 2, 8, 3, 5, 2, 4].map((w, i) => (
                                <div key={i} className="bg-white h-4" style={{ width: `${w}px` }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-background-dark border-t border-white/10 p-4 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-xs text-slate-400 uppercase font-bold">{i18n.t('total_to_pay')}</p>
                        <p className="text-3xl font-black text-white">${finalTotal.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400">{(vehicleConfigs || []).length} {i18n.t((vehicleConfigs || []).length !== 1 ? 'vehicles' : 'vehicle')}</p>
                        <p className="text-xs text-primary font-bold">{selectedOption === 'asap' ? i18n.t('asap') : i18n.t('scheduled')}</p>
                    </div>
                </div>

                {/* Payment Notice */}
                <div className="mb-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-blue-400 text-sm mt-0.5">info</span>
                        <div className="flex-1">
                            <p className="text-xs text-blue-300">
                                {selectedPaymentType === 'cash'
                                    ? 'Cash Payment: Pay the washer directly. A card is required for a $10 cancellation fee (only charged if you cancel after a washer is assigned).'
                                    : i18n.t('card_payment_notice')
                                }
                            </p>
                            {selectedPaymentType === 'cash' && !selectedCard && (
                                <p className="text-xs text-red-400 font-bold mt-1">
                                    ⚠️ Please add a credit/debit card to proceed.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔘 "Confirm & Place Order" button CLICKED by USER interaction');
                        console.log('📊 Context: canClick=', canClick, 'isProcessing=', isProcessing, 'hasCard=', !!selectedCard);
                        
                        if (!canClick) {
                            console.warn('⚠️ Ignoring click: Component just mounted (ghost click protection active)');
                            return;
                        }

                        if (!isProcessing && selectedCard) {
                            onConfirmOrder(finalTotal, appliedDiscount);
                        } else if (!selectedCard) {
                            navigate(Screen.CLIENT_PAYMENT_METHODS);
                        }
                    }}
                    disabled={isProcessing || !selectedCard || !canClick}
                    style={{ backgroundColor: (isProcessing || !selectedCard || !canClick) ? '#1e293b' : '#3b82f6' }}
                    className={`w-full h-16 rounded-[2rem] font-black uppercase tracking-widest text-sm text-white shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 ${
                        isProcessing || !selectedCard || !canClick
                            ? 'cursor-not-allowed opacity-70' 
                            : 'hover:brightness-110'
                    }`}
                >
                    {isProcessing ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            {i18n.t('creating_order')}
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-xl">thumb_up</span>
                            <span>{i18n.t('confirm_place_order')}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
