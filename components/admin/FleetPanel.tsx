
import React, { useState, useEffect } from 'react';
import { db, firebaseConfig } from '../../firebase';
import {
    collection, onSnapshot, query, orderBy, doc, updateDoc,
    deleteDoc, addDoc, serverTimestamp, getDoc, setDoc
} from 'firebase/firestore';
import { Screen } from '../../types';
import { ConfirmationModal } from '../ConfirmationModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Quote {
    id: string;
    fullName: string;
    phone: string;
    email?: string;
    address: string;
    category: 'fleet' | 'rv';
    vehicleType?: string;
    vehicleCount?: number;
    rvModel?: string;
    rvLength?: string;
    service: string;
    message?: string;
    status: 'new' | 'contacting' | 'contacted' | 'closed';
    createdAt: any;
    companyName?: string;
}

interface FleetVehicle {
    id: string;
    plate: string;
    type: string;
    model: string;
    year?: string;
    color?: string;
    notes?: string;
    active: boolean;
}

interface FleetCompany {
    id: string;
    name: string;
    contactName: string;
    phone: string;
    email?: string;
    address?: string;
    notes?: string;
    status: 'active' | 'inactive' | 'prospect';
    vehicles: FleetVehicle[];
    contractedService?: string;
    monthlyRate?: number;
    createdAt: any;
}

interface WashRecord {
    id: string;
    companyId: string;
    companyName: string;
    vehiclePlate: string;
    vehicleModel: string;
    service: string;
    washerName: string;
    completedAt: any;
    price?: number;
    notes?: string;
}

type FleetTab = 'quotes' | 'companies' | 'history';

// ─── Status helpers ───────────────────────────────────────────────────────────

const quoteStatusMeta: Record<Quote['status'], { label: string; color: string }> = {
    new: { label: 'Nuevo', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    contacting: { label: 'Contactando', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    contacted: { label: 'Contactado', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    closed: { label: 'Cerrado', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

const companyStatusMeta: Record<FleetCompany['status'], { label: string; color: string; dot: string }> = {
    active: { label: 'Activo', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
    inactive: { label: 'Inactivo', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' },
    prospect: { label: 'Prospecto', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30', dot: 'bg-violet-400' },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const FleetPanel: React.FC<{ navigate: (s: Screen) => void }> = ({ navigate }) => {
    const [activeTab, setActiveTab] = useState<FleetTab>('quotes');
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [companies, setCompanies] = useState<FleetCompany[]>([]);
    const [washHistory, setWashHistory] = useState<WashRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCompany, setSelectedCompany] = useState<FleetCompany | null>(null);
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Partial<FleetCompany> | null>(null);
    const [editingVehicle, setEditingVehicle] = useState<Partial<FleetVehicle> | null>(null);
    const [historyFilter, setHistoryFilter] = useState<string>('all');
    const [savingCompany, setSavingCompany] = useState(false);
    const [savingVehicle, setSavingVehicle] = useState(false);
    const [confirmState, setConfirmState] = useState({
        isOpen: false, title: '', message: '', confirmText: 'Confirmar',
        cancelText: 'Cancelar', onConfirm: () => { }, type: 'primary' as 'danger' | 'primary'
    });

    const [showAccessModal, setShowAccessModal] = useState(false);
    const [accessEmail, setAccessEmail] = useState('');
    const [accessPassword, setAccessPassword] = useState('');
    const [creatingAccess, setCreatingAccess] = useState(false);
    const [accessCompany, setAccessCompany] = useState<FleetCompany | null>(null);

    const openAccessModal = (company: FleetCompany) => {
        setAccessCompany(company);
        setAccessEmail(company.email || '');
        setAccessPassword('');
        setShowAccessModal(true);
    };

    const handleCreateAccess = async () => {
        if (!accessCompany || !accessEmail || !accessPassword) return;
        setCreatingAccess(true);
        try {
            const { initializeApp: initApp } = await import('firebase/app');
            const { getAuth: getAuthTemp, createUserWithEmailAndPassword, signOut: signOutTemp } = await import('firebase/auth');

            const tempAppName = `TempApp_${Date.now()}`;
            const tempApp = initApp(firebaseConfig, tempAppName);
            const tempAuth = getAuthTemp(tempApp);

            const userCreds = await createUserWithEmailAndPassword(tempAuth, accessEmail, accessPassword);
            const uid = userCreds.user.uid;

            await setDoc(doc(db, 'users', uid), {
                id: uid,
                email: accessEmail,
                name: accessCompany.contactName || accessCompany.name,
                role: 'fleet',
                companyId: accessCompany.id,
                companyName: accessCompany.name,
                createdAt: new Date().toISOString(),
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(accessCompany.contactName || accessCompany.name)}&background=136dec&color=fff&size=200&bold=true`
            });

            await signOutTemp(tempAuth);

            alert(`Access created successfully for ${accessEmail}.`);
            setShowAccessModal(false);
            setAccessCompany(null);
            setAccessEmail('');
            setAccessPassword('');
        } catch (error: any) {
            console.error('Error creating access:', error);
            alert(`Error creating access: ${error.message}`);
        }
        setCreatingAccess(false);
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'primary' = 'primary') =>
        setConfirmState({ isOpen: true, title, message, confirmText: 'Confirmar', cancelText: 'Cancelar', onConfirm, type });

    // ── Firestore listeners ────────────────────────────────────────────────────

    useEffect(() => {
        const unsubQuotes = onSnapshot(
            query(collection(db, 'quotes'), orderBy('createdAt', 'desc')),
            snap => {
                setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote)));
                setLoading(false);
            },
            err => { console.error('Fleet quotes error:', err); setLoading(false); }
        );

        const unsubCompanies = onSnapshot(
            query(collection(db, 'fleetCompanies'), orderBy('createdAt', 'desc')),
            snap => setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as FleetCompany))),
            err => console.error('Fleet companies error:', err)
        );

        const unsubHistory = onSnapshot(
            query(collection(db, 'fleetWashHistory'), orderBy('completedAt', 'desc')),
            snap => setWashHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as WashRecord))),
            err => console.error('Fleet history error:', err)
        );

        return () => { unsubQuotes(); unsubCompanies(); unsubHistory(); };
    }, []);

    // ── Quote actions ──────────────────────────────────────────────────────────

    const updateQuoteStatus = async (id: string, status: Quote['status']) => {
        await updateDoc(doc(db, 'quotes', id), { status }).catch(console.error);
    };

    const deleteQuote = (id: string) => showConfirm(
        'Eliminar Solicitud', '¿Deseas eliminar esta solicitud permanentemente?',
        async () => { await deleteDoc(doc(db, 'quotes', id)).catch(console.error); },
        'danger'
    );

    // ── Company actions ────────────────────────────────────────────────────────

    const openNewCompany = () => {
        setEditingCompany({ name: '', contactName: '', phone: '', email: '', address: '', notes: '', status: 'prospect', contractedService: '', monthlyRate: 0, vehicles: [] });
        setShowCompanyModal(true);
    };

    const openEditCompany = (company: FleetCompany) => {
        setEditingCompany({ ...company });
        setShowCompanyModal(true);
    };

    const saveCompany = async () => {
        if (!editingCompany?.name || !editingCompany?.phone) return;
        setSavingCompany(true);
        try {
            if ((editingCompany as FleetCompany).id) {
                await updateDoc(doc(db, 'fleetCompanies', (editingCompany as FleetCompany).id), { ...editingCompany });
            } else {
                await addDoc(collection(db, 'fleetCompanies'), { ...editingCompany, vehicles: [], createdAt: serverTimestamp() });
            }
            setShowCompanyModal(false);
            setEditingCompany(null);
        } catch (e) { console.error(e); }
        setSavingCompany(false);
    };

    const deleteCompany = (id: string) => showConfirm(
        'Eliminar Empresa', 'Esta acción no se puede deshacer. ¿Continuar?',
        async () => { await deleteDoc(doc(db, 'fleetCompanies', id)).catch(console.error); },
        'danger'
    );

    // ── Vehicle actions ────────────────────────────────────────────────────────

    const openNewVehicle = (company: FleetCompany) => {
        setSelectedCompany(company);
        setEditingVehicle({ plate: '', type: 'Semi-Truck', model: '', year: '', color: '', notes: '', active: true });
        setShowVehicleModal(true);
    };

    const saveVehicle = async () => {
        if (!editingVehicle?.plate || !selectedCompany) return;
        setSavingVehicle(true);
        try {
            const companyRef = doc(db, 'fleetCompanies', selectedCompany.id);
            const companySnap = await getDoc(companyRef);
            if (companySnap.exists()) {
                const existing: FleetVehicle[] = companySnap.data().vehicles || [];
                const vehicleId = (editingVehicle as FleetVehicle).id || `v_${Date.now()}`;
                const newVehicle: FleetVehicle = { ...editingVehicle as FleetVehicle, id: vehicleId };

                const vehicleIndex = existing.findIndex(v => v.id === vehicleId);
                let updatedVehicles: FleetVehicle[];
                if (vehicleIndex >= 0) {
                    updatedVehicles = existing.map(v => v.id === vehicleId ? newVehicle : v);
                } else {
                    updatedVehicles = [...existing, newVehicle];
                }
                await updateDoc(companyRef, { vehicles: updatedVehicles });
            }
            setShowVehicleModal(false);
            setEditingVehicle(null);
            setSelectedCompany(null);
        } catch (e) { console.error(e); }
        setSavingVehicle(false);
    };

    const deleteVehicle = (company: FleetCompany, vehicleId: string) => showConfirm(
        'Eliminar Vehículo', '¿Deseas eliminar este vehículo del registro?',
        async () => {
            const updated = (company.vehicles || []).filter(v => v.id !== vehicleId);
            await updateDoc(doc(db, 'fleetCompanies', company.id), { vehicles: updated }).catch(console.error);
        },
        'danger'
    );

    const editVehicle = (company: FleetCompany, vehicle: FleetVehicle) => {
        setSelectedCompany(company);
        setEditingVehicle({ ...vehicle });
        setShowVehicleModal(true);
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    const newQuotes = quotes.filter(q => q.status === 'new').length;
    const filteredHistory = historyFilter === 'all' ? washHistory : washHistory.filter(h => h.companyId === historyFilter);

    return (
        <div className="flex flex-col h-full bg-background-dark text-white">
            {/* Header */}
            <header className="flex-shrink-0 px-4 pt-4 pb-0 border-b border-white/5"
                style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-500/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-blue-400">local_shipping</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Panel de Flotas</h1>
                            <p className="text-xs text-slate-400">Negocios · Empresas · Vehículos</p>
                        </div>
                    </div>
                    {newQuotes > 0 && (
                        <div className="flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-300 px-3 py-1.5 rounded-full text-xs font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                            {newQuotes} nueva{newQuotes !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl mb-0">
                    {([
                        { key: 'quotes', icon: 'assignment', label: 'Cuotas', badge: newQuotes },
                        { key: 'companies', icon: 'business', label: 'Empresas', badge: companies.filter(c => c.status === 'active').length },
                        { key: 'history', icon: 'history', label: 'Historial', badge: 0 },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as FleetTab)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 relative ${activeTab === tab.key
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/20'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{tab.icon}</span>
                            <span className="hidden sm:inline">{tab.label}</span>
                            {tab.badge > 0 && (
                                <span className={`absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-black ${activeTab === tab.key ? 'bg-white text-blue-600' : 'bg-blue-500 text-white'}`}>
                                    {tab.badge > 9 ? '9+' : tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
                    </div>
                ) : (
                    <>
                        {activeTab === 'quotes' && <QuotesTab quotes={quotes} onUpdateStatus={updateQuoteStatus} onDelete={deleteQuote} />}
                        {activeTab === 'companies' && (
                            <CompaniesTab
                                companies={companies}
                                onNew={openNewCompany}
                                onEdit={openEditCompany}
                                onDelete={deleteCompany}
                                onAddVehicle={openNewVehicle}
                                onEditVehicle={editVehicle}
                                onDeleteVehicle={deleteVehicle}
                                onCreateAccess={openAccessModal}
                            />
                        )}
                        {activeTab === 'history' && (
                            <HistoryTab
                                history={filteredHistory}
                                companies={companies}
                                filter={historyFilter}
                                onFilterChange={setHistoryFilter}
                            />
                        )}
                    </>
                )}
            </div>

            {/* Company Modal */}
            {showCompanyModal && editingCompany && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-surface-dark border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-5 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-lg font-bold">{(editingCompany as FleetCompany).id ? 'Editar Empresa' : 'Nueva Empresa'}</h2>
                            <button onClick={() => setShowCompanyModal(false)} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <FormField label="Nombre de la Empresa *" icon="business">
                                <input className="fleet-input" placeholder="Ej. Transportes Rápidos SA" value={editingCompany.name || ''} onChange={e => setEditingCompany({ ...editingCompany, name: e.target.value })} />
                            </FormField>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Contacto Principal *" icon="person">
                                    <input className="fleet-input" placeholder="Nombre del dueño" value={editingCompany.contactName || ''} onChange={e => setEditingCompany({ ...editingCompany, contactName: e.target.value })} />
                                </FormField>
                                <FormField label="Teléfono *" icon="phone">
                                    <input className="fleet-input" type="tel" placeholder="+1 (555)..." value={editingCompany.phone || ''} onChange={e => setEditingCompany({ ...editingCompany, phone: e.target.value })} />
                                </FormField>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Email" icon="mail">
                                    <input className="fleet-input" type="email" placeholder="empresa@mail.com" value={editingCompany.email || ''} onChange={e => setEditingCompany({ ...editingCompany, email: e.target.value })} />
                                </FormField>
                                <FormField label="Estado" icon="flag">
                                    <select className="fleet-input" value={editingCompany.status || 'prospect'} onChange={e => setEditingCompany({ ...editingCompany, status: e.target.value as FleetCompany['status'] })}>
                                        <option value="prospect">Prospecto</option>
                                        <option value="active">Activo</option>
                                        <option value="inactive">Inactivo</option>
                                    </select>
                                </FormField>
                            </div>
                            <FormField label="Dirección" icon="location_on">
                                <input className="fleet-input" placeholder="Dirección de la empresa" value={editingCompany.address || ''} onChange={e => setEditingCompany({ ...editingCompany, address: e.target.value })} />
                            </FormField>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Servicio Contratado" icon="local_car_wash">
                                    <input className="fleet-input" placeholder="Ej. Lavado Completo" value={editingCompany.contractedService || ''} onChange={e => setEditingCompany({ ...editingCompany, contractedService: e.target.value })} />
                                </FormField>
                                <FormField label="Tarifa Mensual ($)" icon="payments">
                                    <input className="fleet-input" type="number" placeholder="0.00" value={editingCompany.monthlyRate || ''} onChange={e => setEditingCompany({ ...editingCompany, monthlyRate: parseFloat(e.target.value) || 0 })} />
                                </FormField>
                            </div>
                            <FormField label="Notas internas" icon="notes">
                                <textarea className="fleet-input resize-none" rows={3} placeholder="Notas adicionales..." value={editingCompany.notes || ''} onChange={e => setEditingCompany({ ...editingCompany, notes: e.target.value })} />
                            </FormField>
                        </div>
                        <div className="p-5 border-t border-white/5 flex gap-3 justify-end">
                            <button onClick={() => setShowCompanyModal(false)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:bg-white/5 transition-colors">Cancelar</button>
                            <button onClick={saveCompany} disabled={savingCompany || !editingCompany.name || !editingCompany.phone}
                                className="px-6 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                {savingCompany ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">save</span>}
                                {(editingCompany as FleetCompany).id ? 'Guardar Cambios' : 'Crear Empresa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vehicle Modal */}
            {showVehicleModal && editingVehicle && selectedCompany && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-surface-dark border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="p-5 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold">{(editingVehicle as FleetVehicle).id ? 'Editar Vehículo' : 'Agregar Vehículo'}</h2>
                                <p className="text-xs text-slate-400">{selectedCompany.name}</p>
                            </div>
                            <button onClick={() => setShowVehicleModal(false)} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Placa / Número *" icon="pin">
                                    <input className="fleet-input uppercase" placeholder="ABC-1234" value={editingVehicle.plate || ''} onChange={e => setEditingVehicle({ ...editingVehicle, plate: e.target.value.toUpperCase() })} />
                                </FormField>
                                <FormField label="Tipo" icon="local_shipping">
                                    <select className="fleet-input" value={editingVehicle.type || 'Semi-Truck'} onChange={e => setEditingVehicle({ ...editingVehicle, type: e.target.value })}>
                                        <option>Semi-Truck</option>
                                        <option>Camión de Carga</option>
                                        <option>Van Comercial</option>
                                        <option>Pick-up</option>
                                        <option>Remolque</option>
                                        <option>Autobús</option>
                                        <option>Otro</option>
                                    </select>
                                </FormField>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Modelo / Marca" icon="directions_car">
                                    <input className="fleet-input" placeholder="Ej. Freightliner" value={editingVehicle.model || ''} onChange={e => setEditingVehicle({ ...editingVehicle, model: e.target.value })} />
                                </FormField>
                                <FormField label="Año" icon="calendar_month">
                                    <input className="fleet-input" placeholder="2020" type="number" value={editingVehicle.year || ''} onChange={e => setEditingVehicle({ ...editingVehicle, year: e.target.value })} />
                                </FormField>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Color" icon="palette">
                                    <input className="fleet-input" placeholder="Blanco" value={editingVehicle.color || ''} onChange={e => setEditingVehicle({ ...editingVehicle, color: e.target.value })} />
                                </FormField>
                                <FormField label="Estado" icon="toggle_on">
                                    <select className="fleet-input" value={editingVehicle.active ? 'active' : 'inactive'} onChange={e => setEditingVehicle({ ...editingVehicle, active: e.target.value === 'active' })}>
                                        <option value="active">Activo</option>
                                        <option value="inactive">Inactivo</option>
                                    </select>
                                </FormField>
                            </div>
                            <FormField label="Notas" icon="notes">
                                <input className="fleet-input" placeholder="Notas adicionales..." value={editingVehicle.notes || ''} onChange={e => setEditingVehicle({ ...editingVehicle, notes: e.target.value })} />
                            </FormField>
                        </div>
                        <div className="p-5 border-t border-white/5 flex gap-3 justify-end">
                            <button onClick={() => setShowVehicleModal(false)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:bg-white/5 transition-colors">Cancelar</button>
                            <button onClick={saveVehicle} disabled={savingVehicle || !editingVehicle.plate}
                                className="px-6 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
                                {savingVehicle ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">save</span>}
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Access Modal */}
            {showAccessModal && accessCompany && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-surface-dark border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="p-5 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold">Create Owner Access</h2>
                                <p className="text-xs text-slate-400">{accessCompany.name}</p>
                            </div>
                            <button onClick={() => setShowAccessModal(false)} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <FormField label="Email Address" icon="mail">
                                <input className="fleet-input" type="email" placeholder="owner@company.com" value={accessEmail} onChange={e => setAccessEmail(e.target.value)} />
                            </FormField>
                            <FormField label="Temporary Password" icon="lock">
                                <input className="fleet-input" type="password" placeholder="Minimum 6 characters" value={accessPassword} onChange={e => setAccessPassword(e.target.value)} />
                            </FormField>
                        </div>
                        <div className="p-5 border-t border-white/5 flex gap-3 justify-end">
                            <button onClick={() => setShowAccessModal(false)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:bg-white/5 transition-colors">Cancel</button>
                            <button onClick={handleCreateAccess} disabled={creatingAccess || !accessEmail || accessPassword.length < 6}
                                className="px-6 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
                                {creatingAccess ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">key</span>}
                                {creatingAccess ? 'Creating...' : 'Create Access'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.confirmText}
                cancelText={confirmState.cancelText}
                onConfirm={confirmState.onConfirm}
                onCancel={() => setConfirmState({ ...confirmState, isOpen: false })}
                type={confirmState.type}
            />

            <style>{`
                .fleet-input {
                    width: 100%;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 0.75rem;
                    padding: 0.5rem 0.75rem;
                    color: white;
                    font-size: 0.875rem;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .fleet-input:focus {
                    border-color: rgba(59,130,246,0.5);
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
                }
                .fleet-input option {
                    background: #1e293b;
                }
            `}</style>
        </div>
    );
};

// ─── FormField helper ─────────────────────────────────────────────────────────

const FormField: React.FC<{ label: string; icon: string; children: React.ReactNode }> = ({ label, icon, children }) => (
    <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wide">
            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '14px' }}>{icon}</span>
            {label}
        </label>
        {children}
    </div>
);

// ─── Quotes Tab ───────────────────────────────────────────────────────────────

const QuotesTab: React.FC<{
    quotes: Quote[];
    onUpdateStatus: (id: string, status: Quote['status']) => void;
    onDelete: (id: string) => void;
}> = ({ quotes, onUpdateStatus, onDelete }) => {
    const [filter, setFilter] = useState<Quote['status'] | 'all'>('all');
    const filtered = filter === 'all' ? quotes : quotes.filter(q => q.status === filter);

    return (
        <div className="p-4 space-y-4">
            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {(['all', 'new', 'contacting', 'contacted', 'closed'] as const).map(s => (
                    <button key={s} onClick={() => setFilter(s)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter === s ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
                        {s === 'all' ? 'Todos' : quoteStatusMeta[s].label}
                        {s !== 'all' && (
                            <span className="ml-1.5 bg-white/10 px-1.5 rounded-full">
                                {quotes.filter(q => q.status === s).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white/3 rounded-2xl border border-dashed border-white/10">
                    <span className="material-symbols-outlined text-4xl text-slate-600 block mb-2">assignment_late</span>
                    <p className="text-slate-400">No hay solicitudes en esta categoría</p>
                </div>
            ) : (
                filtered.map(quote => (
                    <div key={quote.id} className="bg-white/3 rounded-2xl border border-white/8 overflow-hidden hover:border-white/15 transition-colors">
                        {/* Card header */}
                        <div className="p-4 border-b border-white/5 flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${quote.category === 'rv' ? 'bg-violet-500/20 text-violet-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                    <span className="material-symbols-outlined">{quote.category === 'rv' ? 'rv_hookup' : 'local_shipping'}</span>
                                </div>
                                <div>
                                    <p className="font-bold text-base">{quote.fullName}</p>
                                    {quote.companyName && <p className="text-xs text-blue-400 font-medium">{quote.companyName}</p>}
                                    <p className="text-xs text-slate-500">
                                        {quote.createdAt?.toDate ? quote.createdAt.toDate().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'Recién enviado'}
                                    </p>
                                </div>
                            </div>
                            <span className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${quoteStatusMeta[quote.status].color}`}>
                                {quoteStatusMeta[quote.status].label}
                            </span>
                        </div>

                        {/* Card body */}
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <InfoRow icon="phone" href={`tel:${quote.phone}`}>{quote.phone}</InfoRow>
                                {quote.email && <InfoRow icon="mail">{quote.email}</InfoRow>}
                                <InfoRow icon="location_on">{quote.address}</InfoRow>
                                {quote.category === 'fleet' ? (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '16px' }}>local_shipping</span>
                                        <span className="text-slate-300 font-semibold capitalize">{quote.vehicleType}</span>
                                        {quote.vehicleCount && <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs text-slate-400">×{quote.vehicleCount}</span>}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <InfoRow icon="rv_hookup">Modelo: {quote.rvModel}</InfoRow>
                                        <InfoRow icon="straighten">Largo: {quote.rvLength} pies</InfoRow>
                                    </div>
                                )}
                                <InfoRow icon="local_car_wash">{quote.service}</InfoRow>
                            </div>
                            {quote.message && (
                                <div className="bg-black/20 p-3 rounded-xl">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Mensaje</p>
                                    <p className="text-sm text-slate-300 italic">"{quote.message}"</p>
                                </div>
                            )}
                        </div>

                        {/* Card actions */}
                        <div className="px-4 py-3 bg-white/3 border-t border-white/5 flex items-center justify-between gap-2">
                            <select
                                className="bg-background-dark border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white flex-1 max-w-xs"
                                value={quote.status}
                                onChange={e => onUpdateStatus(quote.id, e.target.value as Quote['status'])}
                            >
                                {Object.entries(quoteStatusMeta).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                            <div className="flex gap-1">
                                {quote.phone && (
                                    <a href={`tel:${quote.phone}`} className="w-8 h-8 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>phone</span>
                                    </a>
                                )}
                                <button onClick={() => onDelete(quote.id)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

// ─── InfoRow helper ───────────────────────────────────────────────────────────

const InfoRow: React.FC<{ icon: string; children: React.ReactNode; href?: string }> = ({ icon, children, href }) => (
    <div className="flex items-center gap-2 text-sm">
        <span className="material-symbols-outlined text-slate-500 flex-shrink-0" style={{ fontSize: '16px' }}>{icon}</span>
        {href ? (
            <a href={href} className="text-blue-400 hover:underline truncate">{children}</a>
        ) : (
            <span className="text-slate-300 truncate">{children}</span>
        )}
    </div>
);

// ─── Companies Tab ────────────────────────────────────────────────────────────

const CompaniesTab: React.FC<{
    companies: FleetCompany[];
    onNew: () => void;
    onEdit: (c: FleetCompany) => void;
    onDelete: (id: string) => void;
    onAddVehicle: (c: FleetCompany) => void;
    onEditVehicle: (c: FleetCompany, v: FleetVehicle) => void;
    onDeleteVehicle: (c: FleetCompany, vehicleId: string) => void;
    onCreateAccess: (c: FleetCompany) => void;
}> = ({ companies, onNew, onEdit, onDelete, onAddVehicle, onEditVehicle, onDeleteVehicle, onCreateAccess }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    return (
        <div className="p-4 space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-400">{companies.length} empresa{companies.length !== 1 ? 's' : ''} registrada{companies.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={onNew}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-blue-500/20">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                    Nueva Empresa
                </button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
                {([
                    { label: 'Activas', count: companies.filter(c => c.status === 'active').length, color: 'from-emerald-600/20 to-emerald-500/10 border-emerald-500/20 text-emerald-400' },
                    { label: 'Prospectos', count: companies.filter(c => c.status === 'prospect').length, color: 'from-violet-600/20 to-violet-500/10 border-violet-500/20 text-violet-400' },
                    { label: 'Vehículos', count: companies.reduce((s, c) => s + (c.vehicles?.length || 0), 0), color: 'from-blue-600/20 to-blue-500/10 border-blue-500/20 text-blue-400' },
                ] as const).map(stat => (
                    <div key={stat.label} className={`bg-gradient-to-br ${stat.color} border rounded-xl p-3 text-center`}>
                        <p className="text-2xl font-black">{stat.count}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
                    </div>
                ))}
            </div>

            {companies.length === 0 ? (
                <div className="text-center py-16 bg-white/3 rounded-2xl border border-dashed border-white/10">
                    <span className="material-symbols-outlined text-4xl text-slate-600 block mb-2">business</span>
                    <p className="text-slate-400 mb-4">Aún no hay empresas registradas</p>
                    <button onClick={onNew} className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                        Agregar Primera Empresa
                    </button>
                </div>
            ) : (
                companies.map(company => {
                    const isExpanded = expandedId === company.id;
                    const statusMeta = companyStatusMeta[company.status];
                    const vehicleCount = company.vehicles?.length || 0;

                    return (
                        <div key={company.id} className="bg-white/3 rounded-2xl border border-white/8 overflow-hidden hover:border-white/12 transition-colors">
                            {/* Company header */}
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-outlined text-blue-400">business</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-base truncate">{company.name}</h3>
                                                <span className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                                                    {statusMeta.label}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-400 mt-0.5">{company.contactName}</p>
                                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                <a href={`tel:${company.phone}`} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>phone</span>
                                                    {company.phone}
                                                </a>
                                                {company.contractedService && (
                                                    <span className="text-xs text-slate-500">· {company.contractedService}</span>
                                                )}
                                                {company.monthlyRate ? (
                                                    <span className="text-xs text-emerald-400 font-semibold">${company.monthlyRate.toLocaleString()}/mes</span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        <button onClick={() => onCreateAccess(company)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors" title="Create Owner Access">
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>key</span>
                                        </button>
                                        <button onClick={() => onEdit(company)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 transition-colors">
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                                        </button>
                                        <button onClick={() => onDelete(company.id)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Vehicles count + expand */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : company.id)}
                                    className="mt-3 w-full flex items-center justify-between px-3 py-2 bg-white/5 rounded-xl text-sm hover:bg-white/8 transition-colors group"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-blue-400" style={{ fontSize: '18px' }}>local_shipping</span>
                                        <span className="text-slate-300 font-medium">{vehicleCount} vehículo{vehicleCount !== 1 ? 's' : ''} registrado{vehicleCount !== 1 ? 's' : ''}</span>
                                    </div>
                                    <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} style={{ fontSize: '18px' }}>expand_more</span>
                                </button>
                            </div>

                            {/* Vehicles list */}
                            {isExpanded && (
                                <div className="border-t border-white/5 px-4 pb-4">
                                    <div className="pt-3 space-y-2">
                                        {(company.vehicles || []).length === 0 ? (
                                            <p className="text-center text-sm text-slate-500 py-4">No hay vehículos registrados</p>
                                        ) : (
                                            (company.vehicles || []).map(vehicle => (
                                                <div key={vehicle.id} className="flex items-center gap-3 bg-white/3 rounded-xl p-3 border border-white/5">
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${vehicle.active ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-500/15 text-slate-500'}`}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>local_shipping</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-sm font-mono">{vehicle.plate}</p>
                                                            {!vehicle.active && <span className="text-[10px] text-slate-500 bg-slate-500/10 px-1.5 py-0.5 rounded">Inactivo</span>}
                                                        </div>
                                                        <p className="text-xs text-slate-400">{vehicle.type} · {vehicle.model} {vehicle.year && `(${vehicle.year})`} {vehicle.color && `· ${vehicle.color}`}</p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => onEditVehicle(company, vehicle)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors">
                                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                                                        </button>
                                                        <button onClick={() => onDeleteVehicle(company, vehicle.id)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        <button onClick={() => onAddVehicle(company)}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm text-blue-400 border border-dashed border-blue-500/30 hover:bg-blue-500/10 transition-colors">
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                                            Agregar Vehículo
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
};

// ─── History Tab ──────────────────────────────────────────────────────────────

const HistoryTab: React.FC<{
    history: WashRecord[];
    companies: FleetCompany[];
    filter: string;
    onFilterChange: (id: string) => void;
}> = ({ history, companies, filter, onFilterChange }) => (
    <div className="p-4 space-y-4">
        {/* Company filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button onClick={() => onFilterChange('all')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter === 'all' ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
                Todas las empresas
            </button>
            {companies.filter(c => c.status === 'active').map(c => (
                <button key={c.id} onClick={() => onFilterChange(c.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${filter === c.id ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
                    {c.name}
                </button>
            ))}
        </div>

        {history.length === 0 ? (
            <div className="text-center py-16 bg-white/3 rounded-2xl border border-dashed border-white/10">
                <span className="material-symbols-outlined text-4xl text-slate-600 block mb-2">history</span>
                <p className="text-slate-400 mb-2">No hay registros de lavados</p>
                <p className="text-xs text-slate-600">Los lavados de flota completados aparecerán aquí</p>
            </div>
        ) : (
            <div className="space-y-3">
                {history.map(record => (
                    <div key={record.id} className="bg-white/3 rounded-2xl border border-white/8 overflow-hidden hover:border-white/12 transition-colors">
                        <div className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-emerald-400">local_car_wash</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <p className="font-bold font-mono text-base">{record.vehiclePlate}</p>
                                        {record.price && (
                                            <span className="text-emerald-400 font-bold text-sm">${record.price.toFixed(2)}</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-400">{record.companyName} · {record.vehicleModel}</p>
                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
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
                                                ? record.completedAt.toDate().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
                                                : '—'
                                            }
                                        </span>
                                    </div>
                                    {record.notes && (
                                        <p className="mt-2 text-xs text-slate-500 italic bg-white/3 px-3 py-1.5 rounded-lg">"{record.notes}"</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);
