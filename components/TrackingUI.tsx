
import React from 'react';
import { Order, User, Message } from '../types';
import { TrackingMap } from './TrackingMap';
import { OrderChat } from './OrderChat';
import { useRealTimeETA } from '../services/etaService';
import { ConfirmationModal } from './ConfirmationModal';
import { triggerNativeHaptic } from '../utils/native';
import { StripeService } from '../services/StripeService';
import { IssueReport } from '../types';
import { i18n } from '../services/i18n';
import { parseDurationToMinutes } from '../utils/formatters';
import { ServicePackage, ServiceAddon } from '../types';
import { ETADisplay } from './ETA/ETADisplay';

interface TrackingUIProps {
    activeTrackingOrder: Order | null;
    user: User;
    setTrackingOrderId: (id: string | null) => void;
    setShowOrderChat: (show: boolean) => void;
    showOrderChat: boolean;
    messages: Message[];
    sendMessage: (senderId: string, receiverId: string, orderId: string, content: string, type?: 'text' | 'image') => Promise<void>;
    updateOrder: (orderId: string, data: Partial<Order>) => Promise<void>;
    showNativeToast: (msg: string, type?: 'success' | 'error') => void;
    submitOrderRating: (orderId: string, rating: any) => Promise<void>;
    navigate: (screen: string) => void;
    packages: any[];
    addons: any[];
    isGoogleMapsLoaded?: boolean;
    createIssue?: (issueData: Omit<IssueReport, 'id' | 'timestamp' | 'status'>) => void;
}

const generateReviewDiscount = async (userId: string) => {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `REVIEW10-${randomSuffix}`;
    const discountData = {
        code,
        type: 'fixed',
        value: 10,
        description: 'Google Review Discount ($10)',
        active: true,
        usageCount: 0,
        usageLimit: 1,
        applicableTo: 'total',
        clientId: userId,
        singleUsePerClient: true,
        createdBy: 'system_review_auto',
        createdDate: new Date().toISOString()
    };
    
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    const discountId = `review10_${userId}_${randomSuffix.toLowerCase()}`;
    await setDoc(doc(db, 'discounts', discountId), discountData as any);
    
    await setDoc(doc(db, 'users', userId), {
        claimedGoogleReviewDiscount: true,
        googleReviewDiscountCode: code
    }, { merge: true });

    return code;
};

export const TrackingUI: React.FC<TrackingUIProps> = ({
    activeTrackingOrder,
    user,
    setTrackingOrderId,
    setShowOrderChat,
    showOrderChat,
    messages,
    sendMessage,
    updateOrder,
    showNativeToast,
    submitOrderRating,
    navigate,
    packages,
    addons,
    isGoogleMapsLoaded,
    createIssue
}) => {
    // Local state for rating (lifted from Client.tsx usage)
    const [currentRating, setCurrentRating] = React.useState(5);
    const [selectedTipPct, setSelectedTipPct] = React.useState(0);
    const [currentTip, setCurrentTip] = React.useState(0);
    const [clientReviewText, setClientReviewText] = React.useState('');
    const [timeLeft, setTimeLeft] = React.useState<string>('--:--');
    const [showReviewModal, setShowReviewModal] = React.useState(false);
    const [reviewClaimedCode, setReviewClaimedCode] = React.useState<string | null>(null);

    // Real-time countdown logic
    React.useEffect(() => {
        if (activeTrackingOrder?.status === 'In Progress' && activeTrackingOrder?.inProgressAt) {
            const tick = () => {
                const now = Date.now();
                const start = activeTrackingOrder.inProgressAt!;

                // 1. Precise Duration Calculation
                let durationMinutes = 15; // Default

                if (activeTrackingOrder.totalServiceDuration) {
                    durationMinutes = activeTrackingOrder.totalServiceDuration;
                } else if (activeTrackingOrder.vehicleConfigs && Array.isArray(activeTrackingOrder.vehicleConfigs)) {
                    // Fallback: calculate on the fly for legacy orders
                    let calcMinutes = 0;
                    activeTrackingOrder.vehicleConfigs.forEach(config => {
                        const pkg = (packages as ServicePackage[] || []).find(p => p.id === config.packageId);
                        if (pkg?.duration) calcMinutes += parseDurationToMinutes(pkg.duration);

                        if (config.addonIds && Array.isArray(config.addonIds)) {
                            config.addonIds.forEach(aId => {
                                const add = (addons as ServiceAddon[] || []).find(a => a.id === aId);
                                if (add?.duration) calcMinutes += parseDurationToMinutes(add.duration);
                            });
                        }
                    });
                    if (calcMinutes > 0) durationMinutes = calcMinutes;
                }

                const durationMs = durationMinutes * 60 * 1000;
                const target = start + durationMs;
                const diff = Math.max(0, target - now);

                if (diff === 0) {
                    setTimeLeft('00:00');
                } else {
                    const m = Math.floor(diff / 60000);
                    const s = Math.floor((diff % 60000) / 1000);
                    setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                }
            };

            tick();
            const timer = setInterval(tick, 1000);
            return () => clearInterval(timer);
        } else {
            setTimeLeft('--:--');
        }
    }, [activeTrackingOrder?.status, activeTrackingOrder?.inProgressAt, activeTrackingOrder?.totalServiceDuration, packages, addons]);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = React.useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type?: 'danger' | 'primary';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'primary'
    });

    const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'primary' = 'primary') => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            onConfirm: () => {
                onConfirm();
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            },
            type
        });
    };

    const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    // Real-time ETA hook (NEW)
    const { eta: liveEta, isLoading: etaLoading } = useRealTimeETA(
        activeTrackingOrder?.washerLocation || null,
        activeTrackingOrder?.location || null
    );

    // Update currentTip whenever selectedTipPct changes
    React.useEffect(() => {
        const basePrice = activeTrackingOrder?.financialBreakdown?.clientTotal || activeTrackingOrder?.price || 0;
        const tipVal = Number((basePrice * selectedTipPct / 100).toFixed(2));
        setCurrentTip(tipVal);
    }, [selectedTipPct, activeTrackingOrder]);

    if (!activeTrackingOrder) return null;

    console.log('💎 TrackingUI: Data Flow', {
        washerLocation: activeTrackingOrder.washerLocation,
        clientLocation: activeTrackingOrder.location,
        status: activeTrackingOrder.status,
        isGoogleMapsLoaded
    });

    if (!activeTrackingOrder.location) {
        console.error('🚨 TrackingUI: activeTrackingOrder.location is MISSING/NULL!', activeTrackingOrder);
    }
    if (!activeTrackingOrder.washerLocation) {
        console.error('🚨 TrackingUI: activeTrackingOrder.washerLocation is MISSING/NULL!', activeTrackingOrder);
    }

    const displayEta = liveEta?.duration || activeTrackingOrder.estimatedArrival || '...';

    const steps = [
        { id: 'assigned', label: 'Preparing', icon: 'inventory', statuses: ['Pending', 'Assigned'] },
        { id: 'en_route', label: 'En Route', icon: 'local_shipping', statuses: ['En Route'] },
        { id: 'arrived', label: 'Arrived', icon: 'location_on', statuses: ['Arrived'] },
        { id: 'in_progress', label: 'Washing', icon: 'local_car_wash', statuses: ['In Progress'] },
        { id: 'completed', label: 'Done', icon: 'check_circle', statuses: ['Completed'] }
    ];

    const currentStepIndex = steps.findIndex(s => s.statuses.includes(activeTrackingOrder.status));

    return (
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-black via-slate-950 to-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 20px)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-4 z-50 transition-all ${activeTrackingOrder.status === 'En Route' ? 'bg-black/40 backdrop-blur-md border-b border-white/10' : 'bg-black/40 backdrop-blur-md border-b border-white/10'}`}>
                <button onClick={() => setTrackingOrderId(null)} className="text-white p-2 hover:bg-white/10 rounded-full transition-colors active:scale-90">
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
                <div className="flex-1 px-4">
                    {/* Compact Stepper in Header for 'En Route' or regular header for others */}
                    {activeTrackingOrder.status !== 'En Route' && (
                        <h1 className="font-black uppercase tracking-[0.2em] text-sm text-center">Order Tracking</h1>
                    )}
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-[#3b82f6]/30 overflow-hidden bg-white/5 shadow-blue">
                    {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#3b82f6] to-blue-600 text-[10px] font-black text-white">
                            {user.name?.charAt(0)}
                        </div>
                    )}
                </div>
            </div>

            {/* Premium Stepper Bar */}
            <div className="px-6 py-4 bg-black/20 backdrop-blur-sm border-b border-white/5 overflow-x-auto no-scrollbar">
                <div className="flex items-center justify-between min-w-[320px] relative">
                    {/* Connecting Lines */}
                    <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/10 -translate-y-1/2 z-0"></div>
                    <div
                        className="absolute top-1/2 left-0 h-[2px] bg-primary -translate-y-1/2 z-0 transition-all duration-700"
                        style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                    ></div>

                    {steps.map((step, idx) => {
                        const isCompleted = idx < currentStepIndex;
                        const isActive = idx === currentStepIndex;

                        return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center gap-1.5">
                                <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500
                                    ${isCompleted ? 'bg-primary text-black' :
                                        isActive ? 'bg-primary shadow-[0_0_15px_rgba(59,130,246,0.5)] text-black scale-110' :
                                            'bg-slate-900 text-slate-500 border border-white/10'}
                                `}>
                                    <span className="material-symbols-outlined text-sm">
                                        {isCompleted ? 'check' : step.icon}
                                    </span>
                                </div>
                                <span className={`text-[8px] font-black uppercase tracking-tighter ${isActive ? 'text-primary' : 'text-slate-500'}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Status Views */}
            <div className="flex-1 flex flex-col relative overflow-hidden">

                {/* 1. PENDING (Searching) */}
                {activeTrackingOrder.status === 'Pending' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in bg-gradient-to-b from-black via-[#3b82f6]/10 to-black relative">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#3b82f620_0%,_transparent_70%)] pointer-events-none"></div>
                        {/* Animations... */}
                        <div className="relative w-48 h-48 mb-8 flex items-center justify-center">
                            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75"></div>
                            <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-[#3b82f6]/30 to-blue-400/30 flex items-center justify-center border-2 border-primary/50 shadow-blue-lg">
                                <span className="material-symbols-outlined text-4xl text-white">search</span>
                            </div>
                        </div>
                        <h2 className="text-4xl font-black mb-4 text-white drop-shadow-blue tracking-tight">Finding a Washer</h2>
                        <p className="text-slate-300 font-medium">We are contacting nearby washers...</p>
                    </div>
                )}

                {/* 2. ASSIGNED */}
                {(activeTrackingOrder.status === 'Assigned') && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in bg-gradient-to-b from-black via-slate-900 to-black w-full">
                        <h2 className="text-4xl font-black mb-4 text-primary shadow-blue animate-pulse tracking-tight">He's getting ready!</h2>
                        <p className="text-slate-300 mb-10 text-lg">
                            <span className="text-primary font-black">{activeTrackingOrder.washerName || 'Washer'}</span> is preparing.
                        </p>
                        <button onClick={() => setShowOrderChat(true)} className="w-full max-w-[300px] py-4 bg-[#1a1a1c] border border-white/10 rounded-2xl font-black text-white flex items-center justify-center gap-3">
                            <span className="material-symbols-outlined">chat</span> Message Washer
                        </button>
                    </div>
                )}

                {/* 3. EN ROUTE */}
                {activeTrackingOrder.status === 'En Route' && (
                    <div className="flex-1 relative bg-black overflow-hidden flex flex-col">
                        <TrackingMap
                            washerLocation={activeTrackingOrder.washerLocation}
                            clientLocation={activeTrackingOrder.location}
                            clientAddress={activeTrackingOrder.address}
                            status={activeTrackingOrder.status}
                            serviceRadius={20}
                            washerName={activeTrackingOrder.washerName || 'Your Washer'}
                            eta={displayEta}
                            isLoaded={isGoogleMapsLoaded}
                            routePolyline={liveEta?.polyline}
                        />
                        <div className="absolute top-6 left-0 right-0 z-40 px-4 animate-fade-in-down pointer-events-none">
                            <div className="pointer-events-auto">
                                <ETADisplay
                                    washerLocation={activeTrackingOrder.washerLocation || null}
                                    clientLocation={activeTrackingOrder.location}
                                    washerName={activeTrackingOrder.washerName}
                                    showRoute={false}
                                />
                            </div>
                        </div>

                        <div className="absolute inset-x-0 bottom-2 pointer-events-none flex flex-col items-center gap-3 p-4">
                            <div className="flex flex-col items-center gap-2 pointer-events-auto w-full">
                                {/* Small Live GPS Status */}
                                <div className="bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1.5 border border-white/5 shadow-sm mb-1">
                                    <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                                    <span className="text-[7px] font-black text-green-400/80 uppercase tracking-widest">LIVE GPS</span>
                                </div>

                                <button onClick={() => setShowOrderChat(true)} className="w-full py-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl font-black text-white flex items-center justify-center gap-3 shadow-xl uppercase tracking-[0.2em] text-[10px]">
                                    <span className="material-symbols-outlined text-lg text-primary">chat_bubble</span> Message Washer
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. ARRIVED */}
                {activeTrackingOrder.status === 'Arrived' && (
                    <div className="flex-1 flex flex-col bg-black overflow-hidden relative">
                        <TrackingMap
                            washerLocation={activeTrackingOrder.washerLocation}
                            clientLocation={activeTrackingOrder.location}
                            clientAddress={activeTrackingOrder.address}
                            status={activeTrackingOrder.status}
                            washerName={activeTrackingOrder.washerName || 'Your Washer'}
                            isLoaded={isGoogleMapsLoaded}
                        />
                        {/* Header Pill */}
                        <div className="absolute top-4 left-4 right-4 z-50 flex flex-col items-center">
                            <div className="bg-green-500/10 backdrop-blur-md border border-green-500/20 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                <p className="text-green-500 text-[10px] font-black uppercase tracking-widest">Washer Arrived</p>
                            </div>
                        </div>

                        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center relative z-10">
                            <div className="bg-black/60 backdrop-blur-md border border-white/10 p-8 rounded-[2rem] shadow-2xl w-full max-w-sm">
                                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 mb-6 mx-auto">
                                    <span className="material-symbols-outlined text-4xl">local_parking</span>
                                </div>
                                <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Washer has Arrived!</h2>
                                <p className="text-slate-400 text-sm mb-6 leading-relaxed">Please meet the washer or ensure the vehicle is accessible.</p>


                                <div className="space-y-3">
                                    <button
                                        onClick={async () => {
                                            triggerNativeHaptic(50);
                                            await updateOrder(activeTrackingOrder.id, { clientAuthorized: true });
                                        }}
                                        className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-blue text-sm uppercase tracking-widest active:scale-[0.98] transition-all"
                                    >
                                        Authorize Start
                                    </button>
                                    <button onClick={() => setShowOrderChat(true)} className="w-full bg-white/5 border border-white/10 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 text-xs">
                                        <span className="material-symbols-outlined text-primary text-lg">chat</span> Message Washer
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. IN PROGRESS (Native-Feel Branded Screen) */}
                {(activeTrackingOrder.status === 'In Progress') && (
                    <div className="flex-1 flex flex-col bg-black overflow-hidden relative">
                        {/* Dynamic Background Blur */}
                        <div className="absolute inset-0 z-0">
                            <div className="absolute top-[20%] left-[10%] w-72 h-72 bg-primary/20 rounded-full blur-[100px] animate-pulse"></div>
                            <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-blue-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-evenly py-6 px-5 relative z-10 w-full h-full safe-area-top safe-area-bottom">
                            {/* Top Section: Branding & Title */}
                            <div className="w-full flex flex-col items-center gap-3">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary/40 rounded-full blur-2xl animate-pulse"></div>
                                    <div className="relative w-24 h-24 p-1 bg-black rounded-full border border-white/10 shadow-[0_0_40px_rgba(59,130,246,0.25)] flex items-center justify-center">
                                        <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" />
                                    </div>
                                </div>

                                <div className="text-center">
                                    <h2 className="text-2xl font-black text-white italic tracking-tighter leading-tight uppercase">
                                        Washing<br />Your Car
                                    </h2>
                                    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                                        <div className="flex gap-1">
                                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                                        </div>
                                        <span className="text-primary text-[10px] font-black uppercase tracking-[0.2em]">In Progress</span>
                                    </div>
                                </div>
                            </div>

                            {/* Middle Section: Service Card */}
                            <div className="w-full max-w-sm bg-gradient-to-b from-white/10 to-transparent backdrop-blur-2xl border border-white/10 p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 pr-3">
                                            <p className="text-[9px] text-slate-500 uppercase tracking-[0.15em] font-black mb-1 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[12px]">local_car_wash</span>
                                                Active Service
                                            </p>
                                            <h3 className="text-white font-black text-xl leading-tight">
                                                {activeTrackingOrder.service}
                                            </h3>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[9px] text-slate-500 uppercase tracking-[0.15em] font-black mb-1 italic">Est. Finish</p>
                                            <div className="bg-primary/20 border border-primary/30 px-2 py-1 rounded-xl flex items-center gap-1.5 min-w-[70px] justify-center">
                                                <span className="material-symbols-outlined text-primary text-base animate-spin-slow">timer</span>
                                                <p className="text-base font-black text-white font-mono">{timeLeft}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {activeTrackingOrder.addons?.length > 0 && (
                                        <div className="pt-3 border-t border-white/5">
                                            <div className="flex flex-wrap gap-1.5">
                                                {activeTrackingOrder.addons.map((a: any, i: number) => (
                                                    <div key={i} className="px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                                                        <p className="text-[9px] text-slate-300 font-bold uppercase">{typeof a === 'string' ? a : a.name}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-4 flex items-center justify-between border-t border-white/10">
                                        <div className="flex flex-col">
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Total Amount</p>
                                            <p className="text-2xl font-black text-white tracking-tighter">${(activeTrackingOrder.price || 0).toFixed(2)}</p>
                                        </div>
                                        <button onClick={() => setShowOrderChat(true)} className="flex items-center gap-2 bg-primary/20 border border-primary/30 px-4 py-2 rounded-2xl active:scale-95 transition-all">
                                            <span className="material-symbols-outlined text-primary text-xl">chat_bubble</span>
                                            <p className="text-[10px] font-black text-white uppercase tracking-widest">Chat</p>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Removed Map and Bottom Message button as per request for cleaner UI */}
                        </div>
                    </div>
                )}

                {/* 6. COMPLETED */}
                {activeTrackingOrder.status === 'Completed' && (
                    <div className="flex-1 flex flex-col p-6 animate-fade-in bg-black overflow-y-auto pb-safe">
                        {activeTrackingOrder.paymentMethod === 'stripe' ? (
                            /* PREMIUM CARD VIEW */
                            <>
                                <div className="text-center mb-6">
                                    <span className="material-symbols-outlined text-6xl text-primary font-bold animate-bounce mb-2">check_circle</span>
                                    <h2 className="text-3xl font-black text-white mb-1 uppercase tracking-tighter">THANK YOU - Wash Completed!</h2>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Final Receipt & Payment</p>
                                </div>

                                {/* Tip Selection */}
                                <div className="mb-6">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 text-center">Add a Tip</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[10, 15, 25].map((pct) => (
                                            <button
                                                key={pct}
                                                onClick={() => {
                                                    setSelectedTipPct(pct);
                                                    const tipAmt = (activeTrackingOrder.price || 0) * (pct / 100);
                                                    setCurrentTip(tipAmt);
                                                    triggerNativeHaptic(50);

                                                    // PERSISTENCE: Save tip to Firestore
                                                    if (updateOrder) {
                                                        updateOrder(activeTrackingOrder.id, { tip: tipAmt }).catch(err => {
                                                            console.warn("⚠️ Persistence error: Failed to save tip to document:", err);
                                                        });
                                                    }
                                                }}
                                                className={`py-3 rounded-2xl font-black transition-all border ${selectedTipPct === pct ? 'bg-primary border-primary text-white shadow-blue' : 'bg-white/5 border-white/10 text-slate-400'}`}
                                            >
                                                {pct}%
                                                <p className="text-[9px] font-bold opacity-60">+${((activeTrackingOrder.price || 0) * (pct / 100)).toFixed(2)}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Receipt Breakdown */}
                                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 mb-8">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 border-b border-white/5 pb-2">Receipt Details</p>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm font-bold text-slate-300">Base Service</p>
                                            <p className="text-sm font-black text-white">${(activeTrackingOrder.price || 0).toFixed(2)}</p>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-white/5 pt-3">
                                            <p className="text-sm font-bold text-slate-300">Tip</p>
                                            <p className="text-sm font-black text-primary">+${currentTip.toFixed(2)}</p>
                                        </div>
                                        <div className="flex justify-between items-center pt-2">
                                            <p className="text-lg font-black text-white uppercase italic tracking-tighter">Total</p>
                                            <p className="text-2xl font-black text-primary tracking-tighter">${((activeTrackingOrder.price || 0) + currentTip).toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* SIMPLE CASH VIEW */
                            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center animate-fade-in">
                                <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined text-6xl text-primary font-bold">payments</span>
                                </div>
                                <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Service Finished!</h2>
                                <p className="text-slate-400 mb-8 max-w-[250px]">Please pay the washer directly in cash. Thank you for your business!</p>

                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full mb-8">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Amount Due</p>
                                    <p className="text-4xl font-black text-white">${(activeTrackingOrder.price || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={async () => {
                                try {
                                    triggerNativeHaptic(100);

                                    // Submit payment check/rating
                                    // AUTOMATIC 5 STARS as per user request
                                    await submitOrderRating(activeTrackingOrder.id, {
                                        clientRating: 5,
                                        clientReview: '(Auto-rated 5 stars)',
                                        tip: currentTip,
                                        washerId: activeTrackingOrder.washerId || ''
                                    });

                                     // If we reach here without error: Success!
                                     const reviewUrl = import.meta.env.VITE_GOOGLE_REVIEW_URL;
                                     const hasClaimed = (user as any).claimedGoogleReviewDiscount;

                                     if (reviewUrl && !reviewUrl.includes('YOUR_GOOGLE_PLACE_ID') && !hasClaimed) {
                                         setShowReviewModal(true);
                                     } else {
                                         setTrackingOrderId(null);
                                         navigate('CLIENT_HOME');
                                         showNativeToast(activeTrackingOrder.paymentMethod === 'stripe' ? 'Thank you! Payment processed.' : 'Thank you!', 'success');
                                     }
                                } catch (e: any) {
                                    console.error('Finalization error:', e);
                                    showNativeToast(e.message || 'Error finalizing service', 'error');
                                }
                            }}
                            className="w-full bg-primary text-white py-5 rounded-[2rem] font-black uppercase tracking-widest text-sm mb-4 shadow-blue active:scale-95 transition-all"
                        >
                            {activeTrackingOrder.paymentStatus === 'Failed'
                                ? 'Retry Payment'
                                : activeTrackingOrder.paymentMethod === 'stripe' ? 'Finish & Pay' : 'Done'}
                        </button>

                        {activeTrackingOrder.paymentStatus === 'Failed' && (
                            <div className="flex flex-col gap-3">
                                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3">
                                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shrink-0">
                                        <i className="fas fa-exclamation-triangle text-white"></i>
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold text-sm">Payment Failed</h4>
                                        <p className="text-white/60 text-xs mt-1">
                                            {activeTrackingOrder.paymentError || 'Your card was declined. Please try again or contact support.'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowOrderChat(true)}
                                    className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                >
                                    <i className="fas fa-headset"></i>
                                    Contact Support
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {
                activeTrackingOrder.washerId && (
                    <OrderChat
                        orderId={activeTrackingOrder.id}
                        currentUserId={user.id}
                        currentUserName={user.name}
                        otherUserId={activeTrackingOrder.washerId}
                        otherUserName={activeTrackingOrder.washerName || 'Washer'}
                        messages={messages}
                        sendMessage={sendMessage}
                        isOpen={showOrderChat}
                        onClose={() => setShowOrderChat(false)}
                    />
                )
            }

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirm}
                type={confirmModal.type}
            />
        </div >
    );
};
