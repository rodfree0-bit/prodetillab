import React from 'react';
import { Order, Screen } from '../../types';
import { i18n } from '../../services/i18n';

interface AvailableOrdersProps {
    orders: Order[];
    navigate: (screen: Screen, orderId?: string) => void;
    onGrabOrder: (orderId: string) => void;
    initialOrderId?: string | null;
    washerRating?: number;
}

export const AvailableOrders: React.FC<AvailableOrdersProps> = ({ orders, navigate, onGrabOrder, washerRating = 5.0 }) => {
    // Filter only "New" orders (not assigned to anyone)
    const availableOrders = orders.filter(o => o.status === 'Pending');

    return (
        <div className="flex flex-col h-full bg-black text-white">
            {/* Header - Solid Professional */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-slate-950 sticky top-0 z-20" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
                <button
                    onClick={() => navigate(Screen.WASHER_DASHBOARD)}
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all border border-white/5"
                >
                    <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
                </button>
                <div className="flex-1 text-center">
                    <h1 className="font-black text-xs uppercase tracking-[0.3em] text-slate-500">Marketplace</h1>
                    <p className="text-xl font-black mt-0.5">{availableOrders.length} {i18n.t('orders') || 'Orders'}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-xl filled">notifications</span>
                </div>
            </div>

            {/* Orders List */}
            <div
                className="flex-1 overflow-y-auto p-5 space-y-4"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}
            >
                {availableOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-10 opacity-50">
                        <div className="w-20 h-20 rounded-3xl bg-slate-900 flex items-center justify-center mb-6 border border-white/5">
                            <span className="material-symbols-outlined text-4xl text-slate-600">inventory_2</span>
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-widest">{i18n.t('no_orders') || 'No Orders'}</h3>
                        <p className="text-slate-500 text-xs mt-2 font-bold uppercase tracking-tighter">Everything is clear for now</p>
                    </div>
                ) : (
                    availableOrders.map(order => {
                        const price = order.price || 0;
                        let ratingRequired = 1.0;
                        if (price > 150) {
                            ratingRequired = 4.5;
                        } else if (price > 100) {
                            ratingRequired = 4.0;
                        } else if (price > 60) {
                            ratingRequired = 3.5;
                        }
                        const isRestricted = washerRating < ratingRequired;

                        return (
                            <div
                                key={order.id}
                                className={`bg-slate-900/50 rounded-[2rem] p-6 border transition-all relative overflow-hidden ${
                                    isRestricted 
                                    ? 'border-white/5 opacity-65 cursor-not-allowed' 
                                    : 'border-white/5 hover:border-primary/40 cursor-pointer group active:scale-[0.98] shadow-2xl'
                                }`}
                                onClick={() => {
                                    if (!isRestricted) {
                                        navigate(Screen.WASHER_JOB_DETAILS, order.id);
                                    }
                                }}
                            >
                                {/* Abstract Decor */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                                {/* Order Header */}
                                <div className="flex items-start justify-between mb-5 relative z-10">
                                    <div className="flex-1">
                                        <h3 className="text-2xl font-black text-white mb-1 group-hover:text-primary transition-colors">{typeof order.clientName === 'string' ? order.clientName : 'Client'}</h3>
                                        <div className="flex items-center gap-2 overflow-hidden mb-2">
                                            <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest border border-white/5 whitespace-nowrap">
                                                {typeof order.vehicle === 'string' ? order.vehicle : 'Vehicle'}
                                            </span>
                                            <span className="w-1 h-1 bg-slate-700 rounded-full shrink-0"></span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight truncate">
                                                {typeof order.service === 'string' ? order.service : 'Service'}
                                            </span>
                                        </div>
                                        {ratingRequired > 1.0 && (
                                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-1.5 ${
                                                isRestricted 
                                                ? 'bg-rose-950/20 text-rose-500 border-rose-900/30' 
                                                : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30'
                                            }`}>
                                                <span className="material-symbols-outlined text-xs">{isRestricted ? 'lock' : 'check'}</span>
                                                {ratingRequired.toFixed(1)}+ Rating {isRestricted ? 'Required' : 'Achieved'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Payout</p>
                                        <p className="text-3xl font-black text-white">${order.price}</p>
                                    </div>
                                </div>

                                {/* Address & Time Section */}
                                <div className="space-y-3 mb-6 relative z-10">
                                    <div className="flex items-center gap-3 p-4 bg-black/40 rounded-2xl border border-white/5">
                                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-primary text-xl">location_on</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-300 leading-snug line-clamp-2">
                                            {typeof order.address === 'string' ? order.address : 'Address not available'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 px-1">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            <span className="material-symbols-outlined text-sm text-slate-600">calendar_today</span>
                                            <span>{typeof order.date === 'string' ? order.date : 'TBD'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            <span className="material-symbols-outlined text-sm text-slate-600">schedule</span>
                                            <span>{typeof order.time === 'string' ? order.time : 'TBD'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Main Action */}
                                <button
                                    disabled={isRestricted}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onGrabOrder(order.id);
                                    }}
                                    className={`w-full py-5 font-black rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl uppercase tracking-widest text-xs ${
                                        isRestricted
                                        ? 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5 shadow-none'
                                        : 'bg-white text-black hover:bg-slate-200 active:scale-95'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-xl">{isRestricted ? 'lock' : 'add_task'}</span>
                                    {isRestricted ? `Requires ${ratingRequired.toFixed(1)}+ Rating` : 'Grab This Order'}
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
