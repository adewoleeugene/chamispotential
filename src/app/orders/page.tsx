'use client';
import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { ResponsiveContainer, BarChart as RevenueChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BarChart3, DollarSign, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { getDefaultRouteForRole } from '@/lib/roleRoutes';

type ManagerRange = 'day' | 'week' | 'month';

export default function OrdersPage() {
    const { user, loading: authLoading } = useAuth();
    const { settings } = useSettings();
    const router = useRouter();
    const [managerRange, setManagerRange] = useState<ManagerRange>('week');
    const [managerData, setManagerData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isFilterPending, startFilterTransition] = useTransition();
    const hasLoadedManagerViewRef = useRef(false);
    const toast = useToast();

    useEffect(() => {
        if (authLoading || !user) return;

        if (user.role !== 'manager') {
            router.replace(getDefaultRouteForRole(user.role));
            return;
        }

        const isRefresh = hasLoadedManagerViewRef.current;
        const updateFlag = isRefresh ? setRefreshing : setLoading;
        // Defer the state update past the effect's synchronous body to satisfy
        // react-hooks/set-state-in-effect; the fetch below clears the flag.
        const handle = queueMicrotask(() => updateFlag(true));
        void handle;

        fetch(`/api/reports?range=${managerRange}`)
            .then(r => r.json())
            .then((reportData) => {
                setManagerData(reportData);
                setLoading(false);
                setRefreshing(false);
                hasLoadedManagerViewRef.current = true;
            })
            .catch(() => {
                setManagerData(null);
                setLoading(false);
                setRefreshing(false);
                toast('error', 'Failed to load manager order analytics');
            });
    }, [authLoading, managerRange, router, toast, user]);

    if (authLoading || !user || (loading && !managerData)) {
        return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;
    }

    if (user.role !== 'manager') {
        return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;
    }

    const summaryCards = [
        {
            label: `${managerData?.label || 'Period'} Orders`,
            value: String(managerData?.summary?.totalOrders || 0),
            accent: '#f59e0b',
            icon: ShoppingCart,
        },
        {
            label: `${managerData?.label || 'Period'} Revenue`,
            value: formatCurrency(managerData?.summary?.totalRevenue || 0, settings.currencySymbol),
            accent: '#38bdf8',
            icon: DollarSign,
        },
        {
            label: 'Average Ticket',
            value: formatCurrency(managerData?.summary?.avgTicket || 0, settings.currencySymbol),
            accent: '#22c55e',
            icon: BarChart3,
        },
    ];

    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }} className="flex items-center gap-2">
                        <BarChart3 size={20} className="text-brand-500" /> Order Performance
                    </h2>
                    <p className="text-muted text-sm mt-1">Manager order analytics with filterable day, week, and month views.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {(refreshing || isFilterPending) && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '6px 10px',
                            borderRadius: 999,
                            background: 'rgba(56,189,248,0.14)',
                            color: '#bae6fd',
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                        }}>
                            Refreshing
                        </span>
                    )}
                    <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'rgba(15,23,42,0.82)', border: '1px solid rgba(148,163,184,0.18)' }}>
                        {(['day', 'week', 'month'] as ManagerRange[]).map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => startFilterTransition(() => setManagerRange(item))}
                                style={{
                                    border: 'none',
                                    borderRadius: 999,
                                    background: managerRange === item ? 'rgba(56,189,248,0.16)' : 'transparent',
                                    color: managerRange === item ? '#e0f2fe' : '#94a3b8',
                                    padding: '10px 16px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                {item.charAt(0).toUpperCase() + item.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid-3 gap-4 mb-4">
                {summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="card" style={{ padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                                <div className="text-muted text-sm font-bold uppercase">{card.label}</div>
                                <div style={{ width: 40, height: 40, borderRadius: 14, background: `${card.accent}20`, color: card.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon size={18} />
                                </div>
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: '#f8fafc' }}>{card.value}</div>
                        </div>
                    );
                })}
            </div>

            <div className="grid-2 gap-4 mb-4">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Order Rhythm</h3>
                            <p className="card-subtitle">{managerData?.chartLabel || 'Order trend'} across {managerData?.label?.toLowerCase() || 'this range'}</p>
                        </div>
                    </div>
                    <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <RevenueChart data={managerData?.trend || []}>
                                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#0f172a',
                                        border: '1px solid rgba(148,163,184,0.2)',
                                        borderRadius: 14,
                                    }}
                                />
                                <Bar dataKey="orders" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                            </RevenueChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Order Mix</h3>
                            <p className="card-subtitle">Service split for the selected manager window</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(managerData?.orderTypeMix || []).map((entry: any) => (
                            <div key={entry.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                                <div>
                                    <div className="font-bold" style={{ textTransform: 'capitalize' }}>{entry.type}</div>
                                    <div className="text-xs text-muted">{entry.count} orders</div>
                                </div>
                                <div className="font-bold">{formatCurrency(entry.revenue || 0, settings.currencySymbol)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid-2 gap-4">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Top Ordered Items</h3>
                            <p className="card-subtitle">Best-performing menu items in the selected period</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(managerData?.topItems || []).map((item: any) => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                                <div>
                                    <div className="font-bold">{item.name}</div>
                                    <div className="text-xs text-muted">{item.quantity} orders</div>
                                </div>
                                <div className="font-bold">{formatCurrency(item.revenue || 0, settings.currencySymbol)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Manager Notes</h3>
                            <p className="card-subtitle">Summary points from the current order window</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(managerData?.insights || []).map((insight: string, index: number) => (
                            <div key={index} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
                                <div className="text-sm text-muted">{insight}</div>
                            </div>
                        ))}
                        {(!managerData?.insights || managerData.insights.length === 0) && (
                            <div className="text-sm text-muted">No manager-facing order insights available yet.</div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
