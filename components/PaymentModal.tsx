import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';

// Load Stripe outside of component render
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// Shared Stripe element style for dark theme
const stripeStyle = {
    disableLink: true,
    style: {
        base: {
            fontSize: '16px',
            color: '#f1f5f9',
            fontFamily: 'Inter, system-ui, sans-serif',
            '::placeholder': { color: '#475569' },
            iconColor: '#3b82f6',
        },
        invalid: {
            color: '#f87171',
            iconColor: '#f87171',
        },
    },
};

const AddCardForm: React.FC<{ onSuccess: () => void, onClose: () => void }> = ({ onSuccess, onClose }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [step, setStep] = useState<'card' | 'success'>('card');
    // Prevent double-submit
    const isSubmitting = React.useRef(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (isSubmitting.current || !stripe || !elements) return;
        isSubmitting.current = true;
        setProcessing(true);
        setError(null);

        try {
            const cardNumberElement = elements.getElement(CardNumberElement);
            if (!cardNumberElement) {
                setError('Please enter your card details.');
                setProcessing(false);
                isSubmitting.current = false;
                return;
            }

            // STEP 1: Create a Stripe Token from the card elements
            // Tokens are server-accessible (unlike PaymentMethods created on the client)
            const { token, error: tokenError } = await stripe.createToken(cardNumberElement);

            if (tokenError || !token) {
                setError(tokenError?.message || 'Error processing card.');
                setProcessing(false);
                isSubmitting.current = false;
                return;
            }

            console.log('✅ Token created:', token.id);

            // STEP 2: Send token to backend — backend creates PM server-side and attaches to customer
            const { StripeService } = await import('../services/StripeService');
            await StripeService.saveCardWithToken(token.id);

            console.log('✅ Card saved successfully!');
            setProcessing(false);
            setStep('success');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);

        } catch (err: any) {
            console.error('Save Card Error:', err);
            const errorMessage = err.message || 'Error saving card.';

            // SELF-HEALING for stale customer
            if (errorMessage.includes('No such customer')) {
                try {
                    const { db, auth } = await import('../firebase');
                    const { doc, updateDoc } = await import('firebase/firestore');
                    if (auth.currentUser) {
                        await updateDoc(doc(db, 'users', auth.currentUser.uid), { stripeCustomerId: null });
                        setError('Account synced. Please try again.');
                        setProcessing(false);
                        isSubmitting.current = false;
                        return;
                    }
                } catch { }
            }

            setError(errorMessage);
            setProcessing(false);
            isSubmitting.current = false;
        }
    };

    if (step === 'success') {
        return (
            <div className="py-8 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4 ring-4 ring-green-500/30">
                    <span className="material-symbols-outlined text-5xl text-green-400">check_circle</span>
                </div>
                <h3 className="font-bold text-xl text-white mb-2">Card Saved!</h3>
                <p className="text-slate-400 text-sm">Verified and safely stored.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">

            {/* Row 1: Card Number — full width */}
            <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Card Number
                </label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 focus-within:border-blue-500 transition-all">
                    <CardNumberElement options={stripeStyle} />
                </div>
            </div>

            {/* Row 2: Expiry + CVC side by side */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                        Expiry
                    </label>
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 focus-within:border-blue-500 transition-all">
                        <CardExpiryElement options={stripeStyle} />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                        CVC
                    </label>
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 focus-within:border-blue-500 transition-all">
                        <CardCvcElement options={stripeStyle} />
                    </div>
                </div>
            </div>

            {/* Security note */}
            <div className="flex items-start gap-2 text-slate-500 text-xs pt-1">
                <span className="material-symbols-outlined text-sm text-blue-400 shrink-0">lock</span>
                <span>Encrypted data. We don't store your card number.</span>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2 text-red-400 text-sm">
                    <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
                    <span>{error}</span>
                </div>
            )}

            {/* Submit */}
            <button
                type="submit"
                disabled={!stripe || processing}
                className="w-full h-14 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
                {processing ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                    </>
                ) : (
                    <>
                        <span className="material-symbols-outlined">add_card</span>
                        Save Card
                    </>
                )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-slate-600 pb-1">
                <span className="material-symbols-outlined text-sm">verified_user</span>
                <span className="text-xs font-bold uppercase tracking-widest">Powered by Stripe</span>
            </div>
        </form>
    );
};

export const PaymentModal: React.FC<PaymentModalProps> = (props) => {
    if (!props.isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-sm"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
            onClick={props.onClose}
        >
            <div
                className="bg-[#0f172a] border border-white/10 w-full rounded-t-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-white/20 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-blue-400">credit_card</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg leading-none">New Card</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Secure payment with Stripe</p>
                        </div>
                    </div>
                    <button
                        onClick={props.onClose}
                        className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 pt-4 pb-2">
                    <Elements stripe={stripePromise}>
                        <AddCardForm {...props} />
                    </Elements>
                </div>
            </div>
        </div>
    );
};
