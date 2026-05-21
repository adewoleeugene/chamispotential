'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Toast {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
}

interface ToastContextType {
    toasts: Toast[];
    toast: (type: Toast['type'], message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const toast = useCallback((type: Toast['type'], message: string) => {
        const id = Math.random().toString(36).slice(2);
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const toastTree = (
        <div
            className="toast-container"
            style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 2147483647,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                pointerEvents: 'none',
            }}
        >
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`toast toast-${t.type}`}
                    style={{ pointerEvents: 'auto', position: 'relative', zIndex: 2147483647 }}
                >
                    <span style={{ fontSize: 18 }}>
                        {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}
                    </span>
                    <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{t.message}</span>
                </div>
            ))}
        </div>
    );

    return (
        <ToastContext.Provider value={{ toasts, toast }}>
            {children}
            {mounted && createPortal(toastTree, document.body)}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx.toast;
}
