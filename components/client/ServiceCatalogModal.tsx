import React from 'react';
import { ServicePackage, ServiceAddon } from '../../types';

interface ServiceCatalogModalProps {
    isOpen: boolean;
    onClose: () => void;
    packages: ServicePackage[];
    addons: ServiceAddon[];
}

export const ServiceCatalogModal: React.FC<ServiceCatalogModalProps> = ({
    isOpen,
    onClose,
    packages,
    addons
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-surface-dark w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div>
                        <h2 className="text-2xl font-black text-white">Service Catalog</h2>
                        <p className="text-xs text-primary font-bold uppercase tracking-widest mt-1">Premium Detailing Details</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-slate-400">close</span>
                    </button>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-12">

                    {/* Packages Section */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="material-symbols-outlined text-primary text-3xl">inventory_2</span>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Main Packages</h3>
                        </div>

                        <div className="grid gap-6">
                            {packages.map((pkg) => (
                                <div key={pkg.id} className="bg-white/5 rounded-3xl p-6 border border-white/5 hover:border-primary/30 transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="text-lg font-black text-white group-hover:text-primary transition-colors">{pkg.name}</h4>
                                        <div className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                                            Approx. {pkg.duration}
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-6 leading-relaxed bg-black/20 p-4 rounded-2xl italic">
                                        "{pkg.description}"
                                    </p>

                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">What's Included:</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {pkg.features?.map((feature, i) => (
                                                <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                                                    <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                                                    <span>{feature}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Add-ons Section */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="material-symbols-outlined text-primary text-3xl">add_circle</span>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Extra Enhancements</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {addons.map((addon) => (
                                <div key={addon.id} className="bg-white/5 rounded-3xl p-5 border border-white/5">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-black text-white text-sm">{addon.name}</h4>
                                        <span className="text-[9px] font-black text-slate-500 uppercase">{addon.duration}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-snug">
                                        {addon.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <footer className="p-6 border-t border-white/5 bg-black/20">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-black rounded-2xl shadow-blue transition-all active:scale-[0.98]"
                    >
                        Got it, thanks!
                    </button>
                </footer>
            </div>
        </div>
    );
};
