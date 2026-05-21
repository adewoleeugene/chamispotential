'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Bell, BellRing, BellOff, ShoppingCart, ChefHat, Package, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function urlBase64ToBuffer(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = typeof window !== 'undefined' ? window.atob(base64) : '';
    const buffer = new ArrayBuffer(raw.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
    return buffer;
}

type AlertExample = {
    title: string;
    description: string;
    icon: React.ElementType;
    roles: string[];
};

const ALERT_EXAMPLES: AlertExample[] = [
    {
        title: 'New order placed',
        description: 'A waiter has sent a fresh ticket to the kitchen.',
        icon: ShoppingCart,
        roles: ['kitchen', 'manager', 'admin'],
    },
    {
        title: 'Order ready for pickup',
        description: 'The kitchen has marked your order ready to serve.',
        icon: ChefHat,
        roles: ['waiter', 'cashier'],
    },
    {
        title: 'Low inventory',
        description: 'An ingredient has dropped to or below its minimum stock.',
        icon: Package,
        roles: ['manager', 'admin'],
    },
];

export default function NotificationsPage() {
    const { user } = useAuth();
    const toast = useToast();

    const [pushSupported, setPushSupported] = useState(false);
    const [pushSubscribed, setPushSubscribed] = useState(false);
    const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
    const [pushBusy, setPushBusy] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
        setPushSupported(supported);
        if (!supported) {
            setChecking(false);
            return;
        }

        setPushPermission(Notification.permission);
        navigator.serviceWorker.ready
            .then((registration) => registration.pushManager.getSubscription())
            .then((sub) => setPushSubscribed(Boolean(sub)))
            .catch(() => { /* ignore */ })
            .finally(() => setChecking(false));
    }, []);

    const enablePush = async () => {
        setPushBusy(true);
        try {
            const permission = await Notification.requestPermission();
            setPushPermission(permission);
            if (permission !== 'granted') {
                toast('error', 'Notification permission was not granted');
                return;
            }

            const keyRes = await fetch('/api/notifications/vapid-public-key');
            const keyData = await keyRes.json();
            if (!keyRes.ok || !keyData.publicKey) {
                throw new Error(keyData.error || 'Push notifications are not configured on the server');
            }

            const registration = await navigator.serviceWorker.ready;
            const existing = await registration.pushManager.getSubscription();
            if (existing) await existing.unsubscribe();

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToBuffer(keyData.publicKey),
            });

            const res = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription.toJSON()),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Failed to register subscription');
            }

            setPushSubscribed(true);
            toast('success', 'Notifications enabled on this device');
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'Failed to enable notifications');
        } finally {
            setPushBusy(false);
        }
    };

    const disablePush = async () => {
        setPushBusy(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await fetch('/api/notifications/subscribe', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                });
                await subscription.unsubscribe();
            }
            setPushSubscribed(false);
            toast('success', 'Notifications disabled on this device');
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'Failed to disable notifications');
        } finally {
            setPushBusy(false);
        }
    };

    const role = user?.role || '';
    const relevantAlerts = ALERT_EXAMPLES.filter((alert) => alert.roles.includes(role));

    const statusCopy = !pushSupported
        ? { title: 'Not supported on this browser', detail: 'Push notifications require a modern browser with service worker support.' }
        : pushPermission === 'denied'
            ? { title: 'Notifications are blocked', detail: 'Open your browser settings for this site and allow notifications, then refresh this page.' }
            : pushSubscribed
                ? { title: 'Notifications are enabled on this device', detail: 'You will receive alerts even when the app is in the background or closed.' }
                : { title: 'Notifications are off on this device', detail: 'Enable to receive alerts when something needs your attention.' };

    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }} className="flex items-center gap-2">
                        <Bell size={20} className="text-brand-500" /> Notifications
                    </h2>
                    <p className="text-muted text-sm mt-1">
                        Manage push notifications on this device. Each device you sign in on can be enabled separately.
                    </p>
                </div>
            </div>

            <div className="card" style={{ padding: 28, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 240 }}>
                        <div style={{
                            width: 56,
                            height: 56,
                            borderRadius: 16,
                            background: pushSubscribed ? 'rgba(83,211,167,0.14)' : 'rgba(180,104,51,0.12)',
                            color: pushSubscribed ? 'var(--success)' : 'var(--brand-400)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            {pushSubscribed ? <CheckCircle size={26} /> : <Bell size={26} />}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{statusCopy.title}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{statusCopy.detail}</div>
                        </div>
                    </div>
                    {pushSupported && pushPermission !== 'denied' && !checking && (
                        pushSubscribed ? (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => void disablePush()}
                                disabled={pushBusy}
                            >
                                <BellOff size={15} /> {pushBusy ? 'Working…' : 'Disable'}
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() => void enablePush()}
                                disabled={pushBusy}
                            >
                                <BellRing size={15} /> {pushBusy ? 'Working…' : 'Enable'}
                            </Button>
                        )
                    )}
                </div>
            </div>

            <div className="card" style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>What you will be alerted about</h3>
                </div>
                {relevantAlerts.length === 0 ? (
                    <p className="text-muted text-sm">No alert types are currently routed to your role.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {relevantAlerts.map((alert) => {
                            const Icon = alert.icon;
                            return (
                                <div
                                    key={alert.title}
                                    style={{
                                        display: 'flex',
                                        gap: 14,
                                        padding: '12px 14px',
                                        borderRadius: 12,
                                        border: '1px solid var(--border)',
                                        background: 'rgba(255,255,255,0.02)',
                                    }}
                                >
                                    <div style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        background: 'rgba(180,104,51,0.12)',
                                        color: 'var(--brand-400)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Icon size={17} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{alert.title}</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{alert.description}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
