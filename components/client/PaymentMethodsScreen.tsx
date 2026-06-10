import React, { useState } from 'react';
import { Screen } from '../../types';

interface PaymentMethodsScreenProps {
    savedCards: any[];
    selectedCardId: string;
    onSelectCard: (id: string) => void;
    onDeleteCard: (id: string) => void;
    onAddCard: () => void;
    navigate: (screen: Screen) => void;
    isFromProfile?: boolean;
    selectedPaymentType?: 'cash' | 'card';
    onSelectPaymentType?: (type: 'cash' | 'card') => void;
    i18n: any;
}

export const PaymentMethodsScreen: React.FC<PaymentMethodsScreenProps> = ({
    savedCards = [],
    selectedCardId,
    onSelectCard,
    onDeleteCard,
    onAddCard,
    navigate,
    isFromProfile = false,
    selectedPaymentType = 'card',
    onSelectPaymentType,
    i18n
}) => {
    const canContinue = selectedPaymentType === 'cash' || (selectedPaymentType === 'card' && selectedCardId !== '');

    return (
        <div className="flex flex-col h-full bg-background-dark text-white safe-area-inset">
            <header className="flex items-center px-4 border-b border-white/5" style={{ paddingTop: 'calc(1rem + var(--sat))', paddingBottom: '1rem' }}>
                <button onClick={() => navigate(isFromProfile ? Screen.CLIENT_PROFILE : Screen.CLIENT_ADDRESS)}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="flex-1 text-center font-bold text-lg mr-6">{isFromProfile ? i18n.t('cards') : i18n.t('payment_methods')}</h1>
            </header>

            <div className="flex-1 overflow-y-auto p-4 pb-32">
                <p className="text-slate-400 text-sm mb-6">
                    {isFromProfile ? i18n.t('manage_saved_cards') : i18n.t('choose_payment_method')}
                </p>

                {/* ===== BOOKING MODE: Select cash or card ===== */}
                {!isFromProfile && onSelectPaymentType && (
                    <div className="space-y-3 mb-6">
                        <button
                            onClick={() => onSelectPaymentType('cash')}
                            className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center gap-4 ${selectedPaymentType === 'cash'
                                ? 'border-green-500 bg-green-500/10'
                                : 'border-white/10 bg-white/5 hover:border-white/30'
                                }`}
                        >
                            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-green-400 text-2xl">payments</span>
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-base">{i18n.t('pay_with_cash')}</p>
                                <p className="text-xs text-slate-400">{i18n.t('pay_washer_directly')}</p>
                            </div>
                            {selectedPaymentType === 'cash' && (
                                <span className="material-symbols-outlined text-green-400">check_circle</span>
                            )}
                        </button>

                        <div className={`rounded-2xl border-2 transition-all overflow-hidden ${selectedPaymentType === 'card'
                            ? 'border-primary bg-primary/5'
                            : 'border-white/10 bg-white/5'
                            }`}>
                            <button
                                onClick={() => onSelectPaymentType('card')}
                                className="w-full p-4 text-left flex items-center gap-4"
                            >
                                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary text-2xl">credit_card</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-base">{i18n.t('pay_with_card')}</p>
                                    <p className="text-xs text-slate-400">{i18n.t('charged_after_service')}</p>
                                </div>
                                {selectedPaymentType === 'card' && (
                                    <span className="material-symbols-outlined text-primary">check_circle</span>
                                )}
                            </button>

                            {selectedPaymentType === 'card' && (
                                <div className="px-4 pb-4 space-y-2">
                                    {savedCards.length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-4">{i18n.t('no_cards_saved')}</p>
                                    ) : (
                                        savedCards.map(card => (
                                            <div
                                                key={card.id}
                                                onClick={() => onSelectCard(card.id)}
                                                className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${selectedCardId === card.id
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-white/10 bg-white/5'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold uppercase bg-white/10 px-2 py-1 rounded">{card.brand}</span>
                                                    <div>
                                                        <p className="font-semibold text-sm">•••• {card.last4}</p>
                                                        <p className="text-xs text-slate-400">{i18n.t('exp')} {card.expiry}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {selectedCardId === card.id && (
                                                        <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteCard(card.id);
                                                        }}
                                                        className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <button
                                        onClick={onAddCard}
                                        className="w-full py-3 rounded-xl border border-dashed border-white/20 text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 text-sm mt-2"
                                    >
                                        <span className="material-symbols-outlined text-sm">add_card</span>
                                        {i18n.t('add_new_card')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ===== PROFILE MODE: Pure list of cards ===== */}
                {isFromProfile && (
                    <div className="space-y-3">
                        {savedCards.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                <span className="material-symbols-outlined text-5xl mb-3 opacity-40">credit_card_off</span>
                                <p className="text-sm">{i18n.t('no_cards_saved_simple')}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {savedCards.map(card => (
                                    <div
                                        key={card.id}
                                        className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-primary text-xl">credit_card</span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">•••• {card.last4}</p>
                                                <p className="text-xs text-slate-400">{card.brand.toUpperCase()} · {i18n.t('exp')} {card.expiry}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onDeleteCard(card.id)}
                                            className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={onAddCard}
                            className="w-full mt-4 p-4 rounded-2xl border-2 border-dashed border-white/20 text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 font-semibold"
                        >
                            <span className="material-symbols-outlined">add_card</span>
                            {i18n.t('add_new_card')}
                        </button>
                    </div>
                )}

                <div className="flex items-center justify-center gap-2 pt-12 text-slate-500">
                    <span className="material-symbols-outlined text-sm">lock</span>
                    <span className="text-xs font-medium">{i18n.t('secured_by_stripe')}</span>
                </div>
            </div>

            {!isFromProfile && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-dark via-background-dark to-transparent z-10" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
                    <button
                        onClick={() => {
                            if (canContinue) navigate(Screen.CLIENT_CONFIRM);
                        }}
                        disabled={!canContinue}
                        style={canContinue ? { backgroundColor: '#3b82f6' } : {}}
                        className={`w-full h-14 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${canContinue
                            ? 'hover:brightness-90 text-white shadow-blue active:scale-[0.98]'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        {canContinue && <span className="material-symbols-outlined">arrow_forward</span>}
                        {i18n.t('continue_to_summary')}
                    </button>
                </div>
            )}
        </div>
    );
};
