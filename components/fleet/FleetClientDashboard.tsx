import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where, orderBy, doc } from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FleetVehicle {
    id: string;
    plate: string;
    type: string;
    model: string;
    year?: string;
    color?: string;
    active: boolean;
}

interface FleetCompany {
    id: string;
    name: string;
    contactName: string;
    phone: string;
    email?: string;
    address?: string;
    contractedService?: string;
    monthlyRate?: number;
    status: string;
    vehicles: FleetVehicle[];
}

interface WashRecord {
    id: string;
    vehiclePlate: string;
    vehicleModel: string;
    service: string;
    washerName: string;
    completedAt: any;
    price?: number;
    notes?: string;
}

interface FleetClientDashboardProps {
    companyId: string;
    userName: string;
    onLogout: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FleetClientDashboard: React.FC<FleetClientDashboardProps> = ({
    companyId,
    userName,
    onLogout,
}) => {
    const [company, setCompany] = useState<FleetCompany | null>(null);
    const [history, setHistory] = useState<WashRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'vehicles' | 'history'>('dashboard');

    useEffect(() => {
        if (!companyId) return;

        // Load company data
        const companyRef = doc(db, 'fleetCompanies', companyId);
        const unsubCompany = onSnapshot(companyRef, (snap) => {
            if (snap.exists()) {
                setCompany({ id: snap.id, ...snap.data() } as FleetCompany);
            }
            setLoading(false);
        }, (err) => {
            console.error('Fleet company load error:', err);
            setLoading(false);
        });

        // Load wash history
        const historyQuery = query(
            collection(db, 'fleetWashHistory'),
            where('companyId', '==', companyId),
            orderBy('completedAt', 'desc')
        );
        const unsubHistory = onSnapshot(historyQuery, (snap) => {
            setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as WashRecord)));
        });

        return () => { unsubCompany(); unsubHistory(); };
    }, [companyId]);

    const thisMonthWashes = history.filter(h => {
        if (!h.completedAt?.toDate) return false;
        const d = h.completedAt.toDate();
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const activeVehicles = (company?.vehicles || []).filter(v => v.active);
    const totalSpent = history.reduce((s, h) => s + (h.price || 0), 0);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-background-dark">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
            </div>
        );
    }

    if (!company) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-background-dark text-white p-8 text-center">
                <span className="material-symbols-outlined text-5xl text-slate-600 mb-4">business_center</span>
                <h2 className="text-xl font-bold mb-2">Company Not Found</h2>
                <p className="text-slate-400 text-sm mb-6">Your account is not linked to any company. Please contact support.</p>
                <button onClick={onLogout} className="px-6 py-2 rounded-xl text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors">
                    Log Out
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background-dark text-white">
            {/* Header */}
            <header
                className="flex-shrink-0 bg-gradient-to-r from-blue-900/40 to-cyan-900/30 border-b border-white/5 px-4 py-4"
                style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-400/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-blue-400">business</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-black leading-tight">{company.name}</h1>
                            <p className="text-xs text-slate-400">Fleet Portal · {userName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onLogout}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition-colors"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-black/30 p-1 rounded-xl">
                    {([
                        { key: 'dashboard', icon: 'dashboard', label: 'Summary' },
                        { key: 'vehicles', icon: 'local_shipping', label: 'Vehicles' },
                        { key: 'history', icon: 'history', label: 'History' },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.key
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{tab.icon}</span>
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'dashboard' && (
                    <DashboardTab
                        company={company}
                        thisMonthWashes={thisMonthWashes}
                        activeVehicles={activeVehicles}
                        totalSpent={totalSpent}
                        recentHistory={history.slice(0, 5)}
                        onGoHistory={() => setActiveTab('history')}
                        onGoVehicles={() => setActiveTab('vehicles')}
                    />
                )}
                {activeTab === 'vehicles' && <VehiclesTab vehicles={company.vehicles || []} />}
                {activeTab === 'history' && <HistoryTab history={history} />}
            </div>
        </div>
    );
};

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

const DashboardTab: React.FC<{
    company: FleetCompany;
    thisMonthWashes: WashRecord[];
    activeVehicles: FleetVehicle[];
    totalSpent: number;
    recentHistory: WashRecord[];
    onGoHistory: () => void;
    onGoVehicles: () => void;
}> = ({ company, thisMonthWashes, activeVehicles, totalSpent, recentHistory, onGoHistory, onGoVehicles }) => (
    <div className="p-4 space-y-5">
        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3">
            <StatCard
                icon="local_car_wash"
                label="Washes this month"
                value={String(thisMonthWashes.length)}
                sub={`${recentHistory.length} in total`}
                color="from-blue-600/20 to-blue-500/10 border-blue-500/20 text-blue-400"
            />
            <StatCard
                icon="local_shipping"
                label="Active vehicles"
                value={String(activeVehicles.length)}
                sub={`${company.vehicles?.length || 0} registered`}
                color="from-cyan-600/20 to-cyan-500/10 border-cyan-500/20 text-cyan-400"
            />
            <StatCard
                icon="payments"
                label="Total invested"
                value={`$${totalSpent.toFixed(0)}`}
                sub="lifetime"
                color="from-emerald-600/20 to-emerald-500/10 border-emerald-500/20 text-emerald-400"
            />
            <StatCard
                icon="local_offer"
                label="Contracted service"
                value={company.contractedService || '—'}
                sub={company.monthlyRate ? `$${company.monthlyRate}/mo` : 'Variable'}
                color="from-violet-600/20 to-violet-500/10 border-violet-500/20 text-violet-400"
            />
        </div>

        {/* Company info card */}
        <div className="bg-white/3 rounded-2xl border border-white/8 p-4 space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Account Details</h3>
            {company.address && (
                <div className="flex items-start gap-2 text-sm">
                    <span className="material-symbols-outlined text-slate-500 flex-shrink-0" style={{ fontSize: '16px' }}>location_on</span>
                    <span className="text-slate-300">{company.address}</span>
                </div>
            )}
            {company.phone && (
                <div className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '16px' }}>phone</span>
                    <a href={`tel:${company.phone}`} className="text-blue-400 hover:underline">{company.phone}</a>
                </div>
            )}
            {company.email && (
                <div className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '16px' }}>mail</span>
                    <span className="text-slate-300">{company.email}</span>
                </div>
            )}
        </div>

        {/* Recent washes */}
        {recentHistory.length > 0 && (
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white">Recent Washes</h3>
                    <button onClick={onGoHistory} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                        View all
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                    </button>
                </div>
                <div className="space-y-2">
                    {recentHistory.map(record => (
                        <MiniWashCard key={record.id} record={record} />
                    ))}
                </div>
            </div>
        )}

        {recentHistory.length === 0 && (
            <div className="text-center py-10 bg-white/3 rounded-2xl border border-dashed border-white/10">
                <span className="material-symbols-outlined text-4xl text-slate-600 block mb-2">local_car_wash</span>
                <p className="text-slate-400 text-sm">No washes registered yet</p>
                <p className="text-xs text-slate-600 mt-1">Completed washes will appear here</p>
            </div>
        )}
    </div>
);

// ─── Vehicles Tab ─────────────────────────────────────────────────────────────

const VehiclesTab: React.FC<{ vehicles: FleetVehicle[] }> = ({ vehicles }) => (
    <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-slate-400">{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} registered</p>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                {vehicles.filter(v => v.active).length} active
            </span>
        </div>

        {vehicles.length === 0 ? (
            <div className="text-center py-16 bg-white/3 rounded-2xl border border-dashed border-white/10">
                <span className="material-symbols-outlined text-4xl text-slate-600 block mb-2">local_shipping</span>
                <p className="text-slate-400">No vehicles registered</p>
                <p className="text-xs text-slate-600 mt-1">Contact the administrator to register your vehicles</p>
            </div>
        ) : (
            vehicles.map(vehicle => (
                <div key={vehicle.id} className="bg-white/3 rounded-2xl border border-white/8 p-4 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${vehicle.active ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/15 text-slate-500'}`}>
                        <span className="material-symbols-outlined">local_shipping</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black font-mono text-lg">{vehicle.plate}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${vehicle.active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/15 text-slate-500 border-slate-500/20'}`}>
                                {vehicle.active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {vehicle.type}
                            {vehicle.model && ` · ${vehicle.model}`}
                            {vehicle.year && ` (${vehicle.year})`}
                        </p>
                        {vehicle.color && (
                            <p className="text-xs text-slate-500 mt-0.5">{vehicle.color}</p>
                        )}
                    </div>
                </div>
            ))
        )}
    </div>
);

// ─── History Tab ──────────────────────────────────────────────────────────────

const HistoryTab: React.FC<{ history: WashRecord[] }> = ({ history }) => {
    const [filter, setFilter] = useState('all');
    const plates = [...new Set(history.map(h => h.vehiclePlate))];
    const filtered = filter === 'all' ? history : history.filter(h => h.vehiclePlate === filter);

    return (
        <div className="p-4 space-y-4">
            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button onClick={() => setFilter('all')}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter === 'all' ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                    All ({history.length})
                </button>
                {plates.map(p => (
                    <button key={p} onClick={() => setFilter(p)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap font-mono ${filter === p ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                        {p}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white/3 rounded-2xl border border-dashed border-white/10">
                    <span className="material-symbols-outlined text-4xl text-slate-600 block mb-2">history</span>
                    <p className="text-slate-400">No wash records found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(record => (
                        <div key={record.id} className="bg-white/3 rounded-2xl border border-white/8 p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-emerald-400" style={{ fontSize: '20px' }}>local_car_wash</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-bold font-mono text-base">{record.vehiclePlate}</p>
                                        {record.price !== undefined && record.price > 0 && (
                                            <span className="text-emerald-400 font-bold text-sm flex-shrink-0">${record.price.toFixed(2)}</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-400">{record.vehicleModel || '—'}</p>
                                    <div className="flex flex-wrap gap-3 mt-2">
                                        <span className="flex items-center gap-1 text-xs text-slate-400">
                                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>local_car_wash</span>
                                            {record.service}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs text-slate-400">
                                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>person</span>
                                            {record.washerName}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs text-slate-500">
                                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>schedule</span>
                                            {record.completedAt?.toDate
                                                ? record.completedAt.toDate().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                                                : '—'}
                                        </span>
                                    </div>
                                    {record.notes && (
                                        <p className="mt-2 text-xs text-slate-500 italic bg-white/3 px-3 py-1.5 rounded-lg">"{record.notes}"</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Helper Components ────────────────────────────────────────────────────────

const StatCard: React.FC<{ icon: string; label: string; value: string; sub: string; color: string }> = ({ icon, label, value, sub, color }) => (
    <div className={`bg-gradient-to-br ${color} border rounded-2xl p-4`}>
        <span className="material-symbols-outlined mb-2 block" style={{ fontSize: '22px' }}>{icon}</span>
        <p className="text-2xl font-black leading-none">{value}</p>
        <p className="text-xs text-slate-300 mt-1 font-semibold">{label}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
);

const MiniWashCard: React.FC<{ record: WashRecord }> = ({ record }) => (
    <div className="flex items-center gap-3 bg-white/3 rounded-xl p-3 border border-white/5">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-emerald-400" style={{ fontSize: '16px' }}>local_car_wash</span>
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-bold font-mono">{record.vehiclePlate}</p>
            <p className="text-xs text-slate-500">{record.service}</p>
        </div>
        <div className="text-right flex-shrink-0">
            {record.price !== undefined && record.price > 0 && (
                <p className="text-xs font-bold text-emerald-400">${record.price.toFixed(2)}</p>
            )}
            <p className="text-[10px] text-slate-600">
                {record.completedAt?.toDate
                    ? record.completedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : '—'}
            </p>
        </div>
    </div>
);
