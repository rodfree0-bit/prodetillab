import React, { useState } from 'react';
import { i18n } from '../services/i18n';

interface DeleteAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [confirmText, setConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleDelete = async () => {
        if (confirmText.toLowerCase() !== 'delete') return;

        setIsDeleting(true);
        setError(null);
        try {
            await onConfirm();
        } catch (error: any) {
            console.error('Delete account failed', error);
            setError(error.message || 'Error al borrar la cuenta.');
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={!isDeleting ? onClose : undefined}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-sm bg-[#1a2431] border border-red-500/30 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-300">
                <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-3xl">warning</span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">Delete Account</h3>

                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 w-full mb-4">
                        <p className="text-red-200 text-sm font-medium">
                            Warning: This action cannot be undone.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3 w-full mb-4 animate-shake">
                            <p className="text-red-400 text-xs font-bold">
                                {error}
                            </p>
                        </div>
                    )}

                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                        This will permanently delete your account, saved vehicles, and order history from our servers.
                    </p>

                    <div className="w-full mb-6">
                        <label className="block text-xs uppercase text-slate-500 font-bold mb-2 text-left">
                            Type "delete" to confirm
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="delete"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors text-center font-bold tracking-widest"
                            autoFocus
                        />
                    </div>

                    <div className="flex flex-col w-full gap-3">
                        <button
                            onClick={handleDelete}
                            disabled={confirmText.toLowerCase() !== 'delete' || isDeleting}
                            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${confirmText.toLowerCase() === 'delete' && !isDeleting
                                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            {isDeleting ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    <span>Deleting...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">delete_forever</span>
                                    <span>Delete My Account</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            disabled={isDeleting}
                            className="w-full py-3.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
