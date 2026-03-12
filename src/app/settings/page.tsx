'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Settings, Save, Bell, Shield, Download } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

type SettingsForm = {
    restaurantName: string;
    currencySymbol: string;
    taxRate: string;
    notifyNewOrders: boolean;
    notifyLowInventory: boolean;
    dailyEmailReport: boolean;
    requireManagerOverride: boolean;
    forcePasswordReset: boolean;
};

const DEFAULTS: SettingsForm = {
    restaurantName: 'Things&Somethings',
    currencySymbol: 'Le',
    taxRate: '10',
    notifyNewOrders: true,
    notifyLowInventory: true,
    dailyEmailReport: false,
    requireManagerOverride: true,
    forcePasswordReset: true,
};

export default function SettingsPage() {
    const { user } = useAuth();
    const toast = useToast();
    const [form, setForm] = useState<SettingsForm>(DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user?.role !== 'admin') {
            setLoading(false);
            return;
        }

        fetch('/api/settings')
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to load settings');
                setForm({
                    restaurantName: data.restaurantName || DEFAULTS.restaurantName,
                    currencySymbol: data.currencySymbol || DEFAULTS.currencySymbol,
                    taxRate: data.taxRate || DEFAULTS.taxRate,
                    notifyNewOrders: data.notifyNewOrders === 'true',
                    notifyLowInventory: data.notifyLowInventory === 'true',
                    dailyEmailReport: data.dailyEmailReport === 'true',
                    requireManagerOverride: data.requireManagerOverride === 'true',
                    forcePasswordReset: data.forcePasswordReset === 'true',
                });
            })
            .catch((error) => toast('error', error.message || 'Failed to load settings'))
            .finally(() => setLoading(false));
    }, [toast, user?.role]);

    const updateField = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const payload = {
                restaurantName: form.restaurantName,
                currencySymbol: form.currencySymbol,
                taxRate: form.taxRate,
                notifyNewOrders: String(form.notifyNewOrders),
                notifyLowInventory: String(form.notifyLowInventory),
                dailyEmailReport: String(form.dailyEmailReport),
                requireManagerOverride: String(form.requireManagerOverride),
                forcePasswordReset: String(form.forcePasswordReset),
            };

            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save settings');

            toast('success', 'Settings saved');
        } catch (error: any) {
            toast('error', error.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;
    }

    if (user?.role !== 'admin') {
        return (
            <AppLayout>
                <div className="card">
                    <h3 className="card-title">Admin Only</h3>
                    <p className="text-muted text-sm mt-2">System settings can only be managed by an admin account.</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }} className="flex items-center gap-2">
                        <Settings size={20} className="text-brand-500" /> System Settings
                    </h2>
                    <p className="text-muted text-sm mt-1">Configure restaurant operations parameters</p>
                </div>
                <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
                    <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="grid-2 gap-4">
                <div className="card">
                    <h3 className="card-title mb-4 border-b border-[var(--border)] pb-2 flex items-center gap-2"><Settings size={16} /> General Settings</h3>
                    <form className="mt-4">
                        <div className="form-group">
                            <label className="form-label">Restaurant Name</label>
                            <input type="text" className="form-input" value={form.restaurantName} onChange={e => updateField('restaurantName', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Currency Symbol</label>
                            <input type="text" className="form-input" value={form.currencySymbol} onChange={e => updateField('currencySymbol', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tax Rate (%)</label>
                            <input type="number" className="form-input" value={form.taxRate} onChange={e => updateField('taxRate', e.target.value)} />
                        </div>
                    </form>
                </div>

                <div className="card">
                    <h3 className="card-title mb-4 border-b border-[var(--border)] pb-2 flex items-center gap-2"><Bell size={16} /> Notifications</h3>
                    <div className="mt-4 space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer py-2 border-b border-[var(--border)]">
                            <input type="checkbox" checked={form.notifyNewOrders} onChange={e => updateField('notifyNewOrders', e.target.checked)} />
                            <div className="flex-1">
                                <div className="font-bold">New Order Alerts</div>
                                <div className="text-sm text-muted">Play sound when new order arrives in KDS</div>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer py-2 border-b border-[var(--border)]">
                            <input type="checkbox" checked={form.notifyLowInventory} onChange={e => updateField('notifyLowInventory', e.target.checked)} />
                            <div className="flex-1">
                                <div className="font-bold">Low Inventory Warnings</div>
                                <div className="text-sm text-muted">Show banner when items drop below min stock</div>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer py-2">
                            <input type="checkbox" checked={form.dailyEmailReport} onChange={e => updateField('dailyEmailReport', e.target.checked)} />
                            <div className="flex-1">
                                <div className="font-bold">Daily Email Report</div>
                                <div className="text-sm text-muted">Send end-of-day summary to admin</div>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title mb-4 border-b border-[var(--border)] pb-2 flex items-center gap-2"><Shield size={16} /> Security & Access</h3>
                    <div className="mt-4">
                        <label className="flex items-center gap-3 cursor-pointer mb-4">
                            <input type="checkbox" checked={form.requireManagerOverride} onChange={e => updateField('requireManagerOverride', e.target.checked)} />
                            <div className="flex-1">
                                <div className="font-bold text-sm">Require Manager Override for Voiding orders</div>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer mb-4">
                            <input type="checkbox" checked={form.forcePasswordReset} onChange={e => updateField('forcePasswordReset', e.target.checked)} />
                            <div className="flex-1">
                                <div className="font-bold text-sm">Force Password Reset every 90 days</div>
                            </div>
                        </label>
                        <button type="button" className="btn btn-secondary mt-2 w-full justify-center" onClick={() => toast('info', 'Audit logs are coming next')}>
                            <Shield size={16} /> View Audit Logs
                        </button>
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title mb-4 border-b border-[var(--border)] pb-2 flex items-center gap-2"><Download size={16} /> Data Export</h3>
                    <div className="text-sm text-muted mb-4">Exports are not wired yet, but your core admin settings are now saved to the database.</div>
                    <div className="flex gap-2">
                        <button type="button" className="btn btn-secondary flex-1 justify-center" onClick={() => toast('info', 'Menu export is coming soon')}>Export Menu (CSV)</button>
                        <button type="button" className="btn btn-secondary flex-1 justify-center" onClick={() => toast('info', 'Sales export is coming soon')}>Export Sales (CSV)</button>
                    </div>
                    <button type="button" className="btn btn-primary w-full mt-2 justify-center" onClick={() => toast('info', 'Database backup is coming soon')}>Full Database Backup (JSON)</button>
                </div>
            </div>
        </AppLayout>
    );
}
