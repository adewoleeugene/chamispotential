'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/contexts/ToastContext';
import { Settings, Store, Receipt, Shield, Bell, Save, Upload, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/patterns/form-field';

type FormValues = {
    restaurantName: string;
    logoDataUrl: string;
    currencySymbol: string;
    taxRate: string;
    notifyNewOrders: string;
    notifyLowInventory: string;
    dailyEmailReport: string;
    requireManagerOverride: string;
    forcePasswordReset: string;
};

const MAX_LOGO_BYTES = 200 * 1024;

function Toggle({
    label,
    description,
    checked,
    onChange,
    disabled,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{description}</div>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => !disabled && onChange(!checked)}
                style={{
                    flexShrink: 0,
                    width: 44,
                    height: 24,
                    borderRadius: 999,
                    border: 'none',
                    background: checked ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s',
                    opacity: disabled ? 0.5 : 1,
                }}
            >
                <span style={{
                    position: 'absolute',
                    top: 3,
                    left: checked ? 23 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                }} />
            </button>
        </div>
    );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
    return (
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(180,104,51,0.12)', color: 'var(--brand-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={17} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>{title}</h3>
            </div>
            {children}
        </div>
    );
}

export default function SettingsPage() {
    const { user } = useAuth();
    const { settings, refresh } = useSettings();
    const toast = useToast();
    const [form, setForm] = useState<FormValues | null>(null);
    const [saving, setSaving] = useState(false);

    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        setForm({
            restaurantName: settings.restaurantName,
            logoDataUrl: settings.logoDataUrl,
            currencySymbol: settings.currencySymbol,
            taxRate: settings.taxRate,
            notifyNewOrders: settings.notifyNewOrders,
            notifyLowInventory: settings.notifyLowInventory,
            dailyEmailReport: settings.dailyEmailReport,
            requireManagerOverride: settings.requireManagerOverride,
            forcePasswordReset: settings.forcePasswordReset,
        });
    }, [settings]);

    const set = (key: keyof FormValues, value: string) =>
        setForm((prev) => prev ? { ...prev, [key]: value } : prev);

    const toggle = (key: keyof FormValues) =>
        setForm((prev) => {
            if (!prev) return prev;
            return { ...prev, [key]: prev[key] === 'true' ? 'false' : 'true' };
        });

    const handleLogoUpload = (file: File) => {
        if (!isAdmin) return;
        if (!file.type.startsWith('image/')) {
            toast('error', 'Logo must be an image file');
            return;
        }
        if (file.size > MAX_LOGO_BYTES) {
            toast('error', `Logo file too large (max ${Math.round(MAX_LOGO_BYTES / 1024)} KB)`);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            set('logoDataUrl', result);
        };
        reader.onerror = () => toast('error', 'Failed to read logo file');
        reader.readAsDataURL(file);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form || !isAdmin) return;

        const taxNum = Number(form.taxRate);
        if (!Number.isFinite(taxNum) || taxNum < 0 || taxNum > 100) {
            toast('error', 'Tax rate must be a number between 0 and 100');
            return;
        }
        if (!form.restaurantName.trim()) {
            toast('error', 'Restaurant name cannot be blank');
            return;
        }
        if (!form.currencySymbol.trim()) {
            toast('error', 'Currency symbol cannot be blank');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Failed to save settings');
            }
            await refresh();
            toast('success', 'Settings saved');
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (!form) {
        return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;
    }

    return (
        <AppLayout>
            <form onSubmit={handleSave}>
                <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700 }} className="flex items-center gap-2">
                            <Settings size={20} className="text-brand-500" /> System Settings
                        </h2>
                        <p className="text-muted text-sm mt-1">
                            {isAdmin
                                ? 'Configure restaurant-wide preferences and security policies.'
                                : 'View current system configuration. Contact an administrator to make changes.'}
                        </p>
                    </div>
                    {isAdmin && (
                        <Button type="submit" variant="primary" disabled={saving}>
                            <Save size={15} />
                            {saving ? 'Saving…' : 'Save Changes'}
                        </Button>
                    )}
                </div>

                <Section icon={Store} title="General">
                    <div className="grid-2 gap-4" style={{ marginBottom: 20 }}>
                        <FormField label="Restaurant Name" htmlFor="settings-name">
                            <Input
                                id="settings-name"
                                type="text"
                                value={form.restaurantName}
                                onChange={(e) => set('restaurantName', e.target.value)}
                                disabled={!isAdmin}
                                placeholder="Your restaurant name"
                            />
                        </FormField>
                        <FormField label="Currency Symbol" htmlFor="settings-currency">
                            <Input
                                id="settings-currency"
                                type="text"
                                value={form.currencySymbol}
                                onChange={(e) => set('currencySymbol', e.target.value)}
                                disabled={!isAdmin}
                                placeholder="e.g. Le, $, £"
                                maxLength={4}
                            />
                        </FormField>
                    </div>

                    <FormField label="Restaurant Logo">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <div
                                style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: 14,
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                }}
                            >
                                {form.logoDataUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={form.logoDataUrl}
                                        alt="Restaurant logo"
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                    />
                                ) : (
                                    <ImageOff size={28} style={{ color: 'var(--text-muted)' }} />
                                )}
                            </div>
                            {isAdmin && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <Button asChild variant="secondary" size="sm">
                                        <label style={{ cursor: 'pointer' }}>
                                            <Upload size={15} />
                                            {form.logoDataUrl ? 'Replace logo' : 'Upload logo'}
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                                style={{ display: 'none' }}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleLogoUpload(file);
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                    </Button>
                                    {form.logoDataUrl && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => set('logoDataUrl', '')}
                                        >
                                            Remove logo
                                        </Button>
                                    )}
                                    <p className="text-muted text-xs" style={{ margin: 0 }}>
                                        PNG, JPEG, WEBP or SVG. Max 200 KB.
                                    </p>
                                </div>
                            )}
                        </div>
                    </FormField>
                </Section>

                <Section icon={Receipt} title="Billing">
                    <div style={{ marginBottom: 0, maxWidth: 220 }}>
                        <FormField label="Tax Rate (%)" htmlFor="settings-tax">
                            <Input
                                id="settings-tax"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={form.taxRate}
                                onChange={(e) => set('taxRate', e.target.value)}
                                disabled={!isAdmin}
                            />
                        </FormField>
                        <p className="text-muted text-sm" style={{ marginTop: 8 }}>
                            Applied automatically to every new order. Changing this does not retroactively update existing orders.
                        </p>
                    </div>
                </Section>

                <Section icon={Bell} title="Notification Rules">
                    <p className="text-muted text-sm" style={{ marginBottom: 4, marginTop: -8 }}>
                        Toggle which system-wide alerts get pushed to subscribed devices. Each user enables push for their device on the Notifications page.
                    </p>
                    <Toggle
                        label="New order alerts"
                        description="Push a notification when a new order is placed."
                        checked={form.notifyNewOrders === 'true'}
                        onChange={() => toggle('notifyNewOrders')}
                        disabled={!isAdmin}
                    />
                    <Toggle
                        label="Low inventory alerts"
                        description="Push a notification when an item drops to or below its minimum stock level."
                        checked={form.notifyLowInventory === 'true'}
                        onChange={() => toggle('notifyLowInventory')}
                        disabled={!isAdmin}
                    />
                    <Toggle
                        label="Daily email report"
                        description="Receive a daily summary of orders, revenue, and inventory by email."
                        checked={form.dailyEmailReport === 'true'}
                        onChange={() => toggle('dailyEmailReport')}
                        disabled={!isAdmin}
                    />
                </Section>

                <Section icon={Shield} title="Security & Access">
                    <Toggle
                        label="Require manager override"
                        description="Discounts and order cancellations must be approved by a manager before taking effect."
                        checked={form.requireManagerOverride === 'true'}
                        onChange={() => toggle('requireManagerOverride')}
                        disabled={!isAdmin}
                    />
                    <Toggle
                        label="Force password reset on first login"
                        description="New staff accounts must change their password before they can use the system."
                        checked={form.forcePasswordReset === 'true'}
                        onChange={() => toggle('forcePasswordReset')}
                        disabled={!isAdmin}
                    />
                </Section>
            </form>
        </AppLayout>
    );
}
