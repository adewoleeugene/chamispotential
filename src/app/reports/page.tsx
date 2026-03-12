'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { BarChart3, ArrowUpRight, Download, TrendingUp, TrendingDown, Target, CalendarDays } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency } from '@/lib/currency';

export default function ReportsPage() {
    const { settings } = useSettings();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard')
            .then(res => res.json())
            .then(payload => {
                setData(payload);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;
    }

    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }} className="flex items-center gap-2">
                        <BarChart3 size={20} className="text-brand-500" /> Executive Reports
                    </h2>
                    <p className="text-muted text-sm mt-1">Decision-making signals from orders, revenue, and menu performance</p>
                </div>
                <button className="btn btn-secondary" onClick={() => window.print()}>
                    <Download size={16} /> Print / Save PDF
                </button>
            </div>

            <div className="grid-3 gap-4 mb-4">
                <div className="card text-center" style={{ padding: 24 }}>
                    <div className="text-muted text-sm font-bold uppercase mb-2">Average Ticket</div>
                    <div className="font-bold text-success mb-2" style={{ fontSize: 28 }}>
                        {formatCurrency(data?.revenue?.averageTicket || 0, settings.currencySymbol)}
                    </div>
                    <div className="text-xs text-muted flex items-center justify-center gap-1">
                        <ArrowUpRight size={14} className="text-success" /> Based on month-to-date orders
                    </div>
                </div>
                <div className="card text-center" style={{ padding: 24 }}>
                    <div className="text-muted text-sm font-bold uppercase mb-2">Peak Revenue Day</div>
                    <div className="font-bold mb-2" style={{ fontSize: 24, color: 'var(--brand-icon)' }}>
                        {data?.revenue?.peakDay?.date || 'N/A'}
                    </div>
                    <div className="text-xs text-muted">
                        {data?.revenue?.peakDay ? formatCurrency(data.revenue.peakDay.revenue || 0, settings.currencySymbol) : 'No peak day yet'}
                    </div>
                </div>
                <div className="card text-center" style={{ padding: 24 }}>
                    <div className="text-muted text-sm font-bold uppercase mb-2">Best Seller</div>
                    <div className="font-bold mb-2" style={{ fontSize: 24, color: '#f59e0b' }}>
                        {data?.mostOrderedItem?.name || 'N/A'}
                    </div>
                    <div className="text-xs text-muted">
                        {data?.mostOrderedItem ? `${data.mostOrderedItem.quantity} orders` : 'No order data yet'}
                    </div>
                </div>
            </div>

            <div className="grid-2 gap-4 mb-4">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Decision Signals</h3>
                            <p className="card-subtitle">Operational insights you can act on today</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(data?.decisionInsights || []).map((insight: any, index: number) => (
                            <div key={index} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
                                <div className="font-bold" style={{ marginBottom: 4 }}>{insight.title}</div>
                                <div className="text-sm text-muted">{insight.detail}</div>
                            </div>
                        ))}
                        {(!data?.decisionInsights || data.decisionInsights.length === 0) && (
                            <div className="empty-state">No decision insights available yet</div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Order Mix</h3>
                            <p className="card-subtitle">How revenue is split by service type this month</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(data?.orderTypeMix || []).map((entry: any) => (
                            <div key={entry.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                                <div>
                                    <div className="font-bold" style={{ textTransform: 'capitalize' }}>{entry.type}</div>
                                    <div className="text-xs text-muted">{entry._count} orders</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">{formatCurrency(entry._sum?.total || 0, settings.currencySymbol)}</div>
                                </div>
                            </div>
                        ))}
                        {(!data?.orderTypeMix || data.orderTypeMix.length === 0) && (
                            <div className="empty-state">No order mix data available</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid-2 gap-4">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title flex items-center gap-2"><TrendingUp size={16} /> Most Ordered</h3>
                            <p className="card-subtitle">Top-selling menu items by order quantity</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(data?.topItems || []).map((item: any, index: number) => (
                            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                                <div>
                                    <div className="font-bold">{item.name}</div>
                                    <div className="text-xs text-muted">{item.quantity} orders</div>
                                </div>
                                <span className="badge available">High demand</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title flex items-center gap-2"><TrendingDown size={16} /> Least Ordered</h3>
                            <p className="card-subtitle">Items to review for promotion, repricing, or removal</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(data?.slowMovingItems || []).map((item: any, index: number) => (
                            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                                <div>
                                    <div className="font-bold">{item.name}</div>
                                    <div className="text-xs text-muted">{item.category} • {item.quantity} orders</div>
                                </div>
                                <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Watch</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid-3 gap-4 mt-4">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title flex items-center gap-2"><Target size={16} /> Strategic Focus</h3>
                    </div>
                    <div className="text-sm text-muted">
                        Use best sellers to guide prep and purchasing. Use slow movers to decide what to bundle, promote, or remove.
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title flex items-center gap-2"><CalendarDays size={16} /> Peak Planning</h3>
                    </div>
                    <div className="text-sm text-muted">
                        Staff closer to {data?.revenue?.peakDay?.date || 'your busiest days'} and preload ingredients behind the strongest revenue periods.
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Inventory Tie-In</h3>
                    </div>
                    <div className="text-sm text-muted">
                        Compare slow-moving items here with the inventory advice screen to reduce waste and over-ordering.
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
