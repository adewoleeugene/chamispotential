'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BarChart3, Download, TrendingUp, TrendingDown, Target, CalendarDays, AlertTriangle, DollarSign, ShoppingCart } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency } from '@/lib/currency';

type ReportRange = 'day' | 'week' | 'month';

const RANGE_LABELS: Record<ReportRange, string> = {
    day: 'Day',
    week: 'Week',
    month: 'Month',
};

export default function ReportsPage() {
    const { settings } = useSettings();
    const [range, setRange] = useState<ReportRange>('week');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const loadReports = async () => {
            setLoading(true);

            try {
                const res = await fetch(`/api/reports?range=${range}`);
                const payload = await res.json();

                if (!cancelled) {
                    setData(payload);
                    setLoading(false);
                }
            } catch {
                if (!cancelled) {
                    setData(null);
                    setLoading(false);
                }
            }
        };

        void loadReports();

        return () => {
            cancelled = true;
        };
    }, [range]);

    if (loading) {
        return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;
    }

    const summaryCards = [
        {
            label: `${data?.label || 'Period'} Revenue`,
            value: formatCurrency(data?.summary?.totalRevenue || 0, settings.currencySymbol),
            icon: DollarSign,
            accent: '#38bdf8',
            detail: 'Total realized revenue in the selected window.',
        },
        {
            label: `${data?.label || 'Period'} Orders`,
            value: String(data?.summary?.totalOrders || 0),
            icon: ShoppingCart,
            accent: '#f59e0b',
            detail: 'Completed service volume across the selected period.',
        },
        {
            label: 'Average Ticket',
            value: formatCurrency(data?.summary?.avgTicket || 0, settings.currencySymbol),
            icon: Target,
            accent: '#22c55e',
            detail: 'Average spend per order in the selected period.',
        },
    ];

    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }} className="flex items-center gap-2">
                        <BarChart3 size={20} className="text-brand-500" /> Executive Reports
                    </h2>
                    <p className="text-muted text-sm mt-1">Time-filtered performance across revenue, menu demand, and stock pressure.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'rgba(15,23,42,0.82)', border: '1px solid rgba(148,163,184,0.18)' }}>
                        {(['day', 'week', 'month'] as ReportRange[]).map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setRange(item)}
                                style={{
                                    border: 'none',
                                    borderRadius: 999,
                                    background: range === item ? 'rgba(56,189,248,0.16)' : 'transparent',
                                    color: range === item ? '#e0f2fe' : '#94a3b8',
                                    padding: '10px 16px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                {RANGE_LABELS[item]}
                            </button>
                        ))}
                    </div>
                    <button className="btn btn-secondary" onClick={() => window.print()}>
                        <Download size={16} /> Print / Save PDF
                    </button>
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
                            <div style={{ fontSize: 28, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>
                                {card.value}
                            </div>
                            <div className="text-xs text-muted">{card.detail}</div>
                        </div>
                    );
                })}
            </div>

            <div className="grid-2 gap-4 mb-4">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Revenue Rhythm</h3>
                            <p className="card-subtitle">{data?.chartLabel || 'Demand pattern'} across {data?.label?.toLowerCase() || 'this period'}</p>
                        </div>
                    </div>
                    <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.trend || []}>
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
                                <Bar dataKey="revenue" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Decision Signals</h3>
                            <p className="card-subtitle">High-level takeaways for the selected period</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(data?.insights || []).map((insight: string, index: number) => (
                            <div key={index} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
                                <div className="text-sm text-muted">{insight}</div>
                            </div>
                        ))}
                        {(!data?.insights || data.insights.length === 0) && (
                            <div className="empty-state">No report insights available yet</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid-2 gap-4 mb-4">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title flex items-center gap-2"><TrendingUp size={16} /> Top Performers</h3>
                            <p className="card-subtitle">Menu items leading order volume</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(data?.topItems || []).map((item: any) => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                                <div>
                                    <div className="font-bold">{item.name}</div>
                                    <div className="text-xs text-muted">{item.quantity} orders</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">{formatCurrency(item.revenue || 0, settings.currencySymbol)}</div>
                                    <span className="badge available">High demand</span>
                                </div>
                            </div>
                        ))}
                        {(!data?.topItems || data.topItems.length === 0) && (
                            <div className="empty-state">No top-performing items for this range</div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title flex items-center gap-2"><TrendingDown size={16} /> Slow Movers</h3>
                            <p className="card-subtitle">Items to review for bundle, price, or placement changes</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(data?.slowMovingItems || []).map((item: any) => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                                <div>
                                    <div className="font-bold">{item.name}</div>
                                    <div className="text-xs text-muted">{item.category} • {item.quantity} orders</div>
                                </div>
                                <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Watch</span>
                            </div>
                        ))}
                        {(!data?.slowMovingItems || data.slowMovingItems.length === 0) && (
                            <div className="empty-state">No slow-moving items for this range</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid-3 gap-4">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title flex items-center gap-2"><CalendarDays size={16} /> Service Mix</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(data?.orderTypeMix || []).map((entry: any) => (
                            <div key={entry.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div className="font-bold" style={{ textTransform: 'capitalize' }}>{entry.type}</div>
                                    <div className="text-xs text-muted">{entry.count} orders</div>
                                </div>
                                <div className="font-bold">{formatCurrency(entry.revenue || 0, settings.currencySymbol)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title flex items-center gap-2"><AlertTriangle size={16} /> Inventory Pressure</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(data?.lowInventory || []).map((item: any) => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div className="font-bold">{item.name}</div>
                                    <div className="text-xs text-muted">{item.category}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">{item.currentStock}</div>
                                    <div className="text-xs text-muted">min {item.minStock}</div>
                                </div>
                            </div>
                        ))}
                        {(!data?.lowInventory || data.lowInventory.length === 0) && (
                            <div className="text-sm text-muted">No low-stock pressure right now.</div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Operational Note</h3>
                    </div>
                    <div className="text-sm text-muted">
                        Use this filtered report with the inventory board and table analytics together: best sellers shape prep, slow movers shape menu decisions, and low-stock items shape purchasing.
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
