
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Screen } from '../../types';
import { ConfirmationModal } from '../ConfirmationModal';

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
}

export const FleetQuotesScreen: React.FC<{ navigate: (s: Screen) => void }> = ({ navigate }) => {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        onConfirm: () => { },
        type: 'primary' as 'danger' | 'primary'
    });

    const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'primary' = 'primary') => {
        setConfirmState({ isOpen: true, title, message, confirmText: 'Confirmar', cancelText: 'Cancelar', onConfirm, type });
    };

    const closeConfirm = () => {
        setConfirmState({ ...confirmState, isOpen: false });
    };

    useEffect(() => {
        // Listening to consolidated 'quotes' collection
        const q = query(collection(db, 'quotes'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const quoteData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Quote[];
            setQuotes(quoteData);
            setLoading(false);
        }, (error) => {
            console.error('❌ Error loading quotes:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const updateStatus = async (quoteId: string, status: Quote['status']) => {
        try {
            await updateDoc(doc(db, 'quotes', quoteId), { status });
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const deleteQuote = async (quoteId: string) => {
        showConfirm(
            'Eliminar Presupuesto',
            '¿Estás seguro de que deseas eliminar esta solicitud?',
            async () => {
                try {
                    await deleteDoc(doc(db, 'quotes', quoteId));
                } catch (error) {
                    console.error('Error deleting quote:', error);
                }
            },
            'danger'
        );
    };

    const getStatusColor = (status: Quote['status']) => {
        switch (status) {
            case 'new': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'contacting': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'contacted': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'closed': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
            default: return 'bg-slate-500/20 text-slate-400';
        }
    };

    return (
        <div className="flex flex-col h-full bg-background-dark text-white">
            <header className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(Screen.ADMIN_DASHBOARD)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-bold">Presupuestos</h1>
                        <p className="text-xs text-slate-400">Solicitudes de Flotas, Semi-Trucks y RVs</p>
                    </div>
                </div>
                <div className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/30">
                    {quotes.filter(q => q.status === 'new').length} Nuevos
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : quotes.length === 0 ? (
                    <div className="text-center p-12 bg-surface-dark rounded-2xl border border-dashed border-white/10">
                        <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">assignment_late</span>
                        <p className="text-slate-400">No se encontraron solicitudes</p>
                    </div>
                ) : (
                    quotes.map(quote => (
                        <div key={quote.id} className="bg-surface-dark rounded-2xl border border-white/5 overflow-hidden">
                            <div className="p-4 border-b border-white/5 flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${quote.category === 'rv' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        <span className="material-symbols-outlined">
                                            {quote.category === 'rv' ? 'rv_hookup' : 'local_shipping'}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{quote.fullName}</h3>
                                        <p className="text-xs text-slate-400">
                                            {quote.createdAt?.toDate ? quote.createdAt.toDate().toLocaleString() : 'Recién enviado'}
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${getStatusColor(quote.status)}`}>
                                    {quote.status}
                                </span>
                            </div>

                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="material-symbols-outlined text-slate-500 text-sm">phone</span>
                                        <a href={`tel:${quote.phone}`} className="text-primary hover:underline">{quote.phone}</a>
                                    </div>
                                    {quote.email && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="material-symbols-outlined text-slate-500 text-sm">mail</span>
                                            <span className="text-slate-300">{quote.email}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="material-symbols-outlined text-slate-500 text-sm">location_on</span>
                                        <span className="text-slate-300">{quote.address}</span>
                                    </div>
                                    
                                    {quote.category === 'fleet' ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="material-symbols-outlined text-slate-500 text-sm">local_shipping</span>
                                            <span className="text-slate-300 font-bold capitalize">{quote.vehicleType}</span>
                                            <span className="bg-white/5 px-2 py-0.5 rounded text-xs ml-2">Cant: {quote.vehicleCount}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2 bg-purple-500/5 p-2 rounded-lg border border-purple-500/10">
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="material-symbols-outlined text-purple-400 text-sm">rv_hookup</span>
                                                <span className="text-slate-300 font-bold">Modelo: {quote.rvModel}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="material-symbols-outlined text-purple-400 text-sm">straighten</span>
                                                <span className="text-slate-300">Largo: {quote.rvLength} pies</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="material-symbols-outlined text-purple-400 text-sm">build</span>
                                                <span className="text-slate-300 font-semibold">{quote.service}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {quote.message && (
                                    <div className="bg-black/20 p-3 rounded-xl self-start">
                                        <p className="text-xs text-slate-500 mb-1 font-bold uppercase">Mensaje / Notas</p>
                                        <p className="text-sm text-slate-300 italic">"{quote.message}"</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-white/5 flex flex-wrap gap-2 justify-end">
                                <select
                                    className="bg-background-dark border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                                    value={quote.status}
                                    onChange={(e) => updateStatus(quote.id, e.target.value as any)}
                                >
                                    <option value="new">Nuevo</option>
                                    <option value="contacting">Contactando</option>
                                    <option value="contacted">Contactado</option>
                                    <option value="closed">Cerrado</option>
                                </select>
                                <button
                                    onClick={() => deleteQuote(quote.id)}
                                    className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ConfirmationModal
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.confirmText}
                cancelText={confirmState.cancelText}
                onConfirm={confirmState.onConfirm}
                onCancel={closeConfirm}
                type={confirmState.type}
            />
        </div>
    );
};
