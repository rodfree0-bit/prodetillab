import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastType } from '../types';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType) => {
        // Try native toast first
        if (typeof window !== 'undefined' && window.Android?.showToast) {
            window.Android.showToast(message);
            return;
        }

        // Prevent duplicate messages
        setToasts(prev => {
            // Check if same message already exists
            const isDuplicate = prev.some(t => t.message === message && t.type === type);
            if (isDuplicate) {
                return prev;
            }

            const id = Date.now().toString();
            const newToast = { id, message, type };

            // Limit to max 3 toasts, remove oldest if needed
            const updatedToasts = prev.length >= 3 ? [...prev.slice(1), newToast] : [...prev, newToast];

            // Auto dismiss after 3 seconds
            setTimeout(() => {
                setToasts(current => current.filter(t => t.id !== id));
            }, 3000);

            return updatedToasts;
        });
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Notifications are globally hidden per user request */}
        </ToastContext.Provider>
    );
};
