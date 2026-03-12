'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { SETTINGS_DEFAULTS, type SettingsPayload } from '@/lib/settings';

type SettingsContextType = {
    settings: SettingsPayload;
    loading: boolean;
    refresh: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<SettingsPayload>(SETTINGS_DEFAULTS);
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (res.ok) {
                setSettings({
                    restaurantName: data.restaurantName || SETTINGS_DEFAULTS.restaurantName,
                    currencySymbol: data.currencySymbol || SETTINGS_DEFAULTS.currencySymbol,
                    taxRate: data.taxRate || SETTINGS_DEFAULTS.taxRate,
                    notifyNewOrders: data.notifyNewOrders || SETTINGS_DEFAULTS.notifyNewOrders,
                    notifyLowInventory: data.notifyLowInventory || SETTINGS_DEFAULTS.notifyLowInventory,
                    dailyEmailReport: data.dailyEmailReport || SETTINGS_DEFAULTS.dailyEmailReport,
                    requireManagerOverride: data.requireManagerOverride || SETTINGS_DEFAULTS.requireManagerOverride,
                    forcePasswordReset: data.forcePasswordReset || SETTINGS_DEFAULTS.forcePasswordReset,
                });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, loading, refresh }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
    return ctx;
}
