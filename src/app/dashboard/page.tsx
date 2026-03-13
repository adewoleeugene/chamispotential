'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, ShoppingBag, DollarSign, Clock, CheckCircle, Link, AlertTriangle, ArrowRight, BellRing, PackageSearch } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

export default function Dashboard() {
    const { user } = useAuth();
    const { settings } = useSettings();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [inventorySummary, setInventorySummary] = useState({ reorderNow: 0, reorderSoon: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/dashboard').then(res => res.json()),
            fetch('/api/inventory').then(res => res.json()),
        ])
            .then(([dashboardData, inventoryData]) => {
                setData(dashboardData);
                setInventorySummary(inventoryData?.adviceSummary || { reorderNow: 0, reorderSoon: 0 });
                setLoading(false);
            })
            .catch(() => {
                setData(null);
                setInventorySummary({ reorderNow: 0, reorderSoon: 0 });
                setLoading(false);
            });
    }, []);

    const isOpsViewer = user?.role === 'admin' || user?.role === 'manager';
    const attentionCards = [
        {
            id: 'reorder-now',
            title: 'Reorder Now',
            count: inventorySummary.reorderNow,
            detail: inventorySummary.reorderNow > 0 ? 'Critical stock is already at risk.' : 'No critical stock issues right now.',
            href: '/inventory?focus=reorder_now',
            icon: AlertTriangle,
            accent: inventorySummary.reorderNow > 0 ? '#f97316' : '#334155',
            glow: inventorySummary.reorderNow > 0 ? 'rgba(249,115,22,0.28)' : 'rgba(51,65,85,0.2)',
        },
        {
            id: 'reorder-soon',
            title: 'Going Low',
            count: inventorySummary.reorderSoon,
            detail: inventorySummary.reorderSoon > 0 ? 'Stock will need attention within days.' : 'Upcoming inventory demand looks stable.',
            href: '/inventory?focus=reorder_soon',
            icon: PackageSearch,
            accent: inventorySummary.reorderSoon > 0 ? '#f59e0b' : '#334155',
            glow: inventorySummary.reorderSoon > 0 ? 'rgba(245,158,11,0.24)' : 'rgba(51,65,85,0.2)',
        },
        {
            id: 'ready-orders',
            title: 'Ready For Pickup',
            count: data?.orders?.ready || 0,
            detail: (data?.orders?.ready || 0) > 0 ? 'Orders are waiting on the floor right now.' : 'No ready orders are waiting.',
            href: '/kitchen?focus=ready',
            icon: BellRing,
            accent: (data?.orders?.ready || 0) > 0 ? '#22c55e' : '#334155',
            glow: (data?.orders?.ready || 0) > 0 ? 'rgba(34,197,94,0.24)' : 'rgba(51,65,85,0.2)',
        },
        {
            id: 'pending-orders',
            title: 'Kitchen Queue',
            count: data?.orders?.pending || 0,
            detail: (data?.orders?.pending || 0) > 0 ? 'Incoming orders are waiting to be started.' : 'Kitchen queue is under control.',
            href: '/kitchen?focus=pending',
            icon: ShoppingBag,
            accent: (data?.orders?.pending || 0) > 0 ? '#38bdf8' : '#334155',
            glow: (data?.orders?.pending || 0) > 0 ? 'rgba(56,189,248,0.24)' : 'rgba(51,65,85,0.2)',
        },
    ];
    const activeAttentionCount = attentionCards.filter((card) => card.count > 0).length;

    if (loading) return (
        <AppLayout>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                <div className="loading-spinner" />
            </div>
        </AppLayout>
    );

    if (user?.role === 'waiter') {
        return (
            <AppLayout>
                <div className="mb-6">
                    <h2 className="text-xl font-bold">My Shift Summary</h2>
                    <p className="text-muted text-sm">Real-time status of your tables and service queue.</p>
                </div>
                <div className="stat-grid">
                    <div className="stat-card orange">
                        <div className="stat-icon-wrap orange"><Users size={24} /></div>
                        <div className="stat-value">{data?.activeTablesCount || 0}</div>
                        <div className="stat-label">Active Tables</div>
                        <div className="stat-trend"><Clock size={14} /> Currently seated</div>
                    </div>
                    <div className="stat-card blue">
                        <div className="stat-icon-wrap blue"><ShoppingBag size={24} /></div>
                        <div className="stat-value">{data?.orders?.active || 0}</div>
                        <div className="stat-label">Active Orders</div>
                        <div className="stat-trend"><TrendingUp size={14} style={{ color: 'var(--success)' }} /> Action needed on {Math.max(0, (data?.orders?.active || 0) - (data?.orders?.ready || 0))}</div>
                    </div>
                    <div className="stat-card green">
                        <div className="stat-icon-wrap green"><CheckCircle size={24} /></div>
                        <div className="stat-value">{data?.orders?.ready || 0}</div>
                        <div className="stat-label">Orders Ready for Pickup</div>
                        <div className="stat-trend"><TrendingUp size={14} style={{ color: 'var(--success)' }} /> From kitchen</div>
                    </div>
                </div>

                <div className="card mt-4">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">My Active Tables</h3>
                            <p className="card-subtitle">Tables you are currently serving</p>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Table</th>
                                    <th>Capacity</th>
                                    <th>Status</th>
                                    <th>Orders</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.activeTablesList?.map((table: any) => (
                                    <tr key={table.id}>
                                        <td className="font-bold">Table {table.number}</td>
                                        <td className="text-muted">{table.capacity} pax</td>
                                        <td><span className={`badge ${table.status}`}>{table.status}</span></td>
                                        <td className="font-bold">{table.orders?.length || 0} active</td>
                                    </tr>
                                ))}
                                {!data?.activeTablesList?.length && (
                                    <tr><td colSpan={4} className="empty-state">No active tables at the moment</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            {isOpsViewer && (
                <div
                    style={{
                        marginBottom: 20,
                        padding: 18,
                        borderRadius: 20,
                        border: '1px solid rgba(148,163,184,0.18)',
                        background: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(12,18,31,0.96))',
                        boxShadow: activeAttentionCount > 0 ? '0 18px 48px rgba(15,23,42,0.36)' : '0 10px 28px rgba(15,23,42,0.2)',
                        overflow: 'hidden',
                        position: 'relative',
                    }}
                >
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top right, rgba(59,130,246,0.18), transparent 36%), radial-gradient(circle at bottom left, rgba(249,115,22,0.1), transparent 30%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.4, color: activeAttentionCount > 0 ? '#f8fafc' : '#cbd5e1', marginBottom: 10 }}>
                                <AlertTriangle size={14} style={{ color: activeAttentionCount > 0 ? '#f97316' : '#94a3b8' }} />
                                Operations Pulse
                            </div>
                            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#f8fafc' }}>
                                {activeAttentionCount > 0 ? `${activeAttentionCount} areas need attention now` : 'No urgent operational issues right now'}
                            </h3>
                            <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 13, maxWidth: 680 }}>
                                Click any signal below to jump straight to the page where the team can act on it.
                            </p>
                        </div>
                        <div style={{ alignSelf: 'center', padding: '8px 12px', borderRadius: 999, background: activeAttentionCount > 0 ? 'rgba(249,115,22,0.14)' : 'rgba(51,65,85,0.35)', color: activeAttentionCount > 0 ? '#fdba74' : '#cbd5e1', fontSize: 12, fontWeight: 700 }}>
                            {activeAttentionCount > 0 ? 'Actionable alerts live' : 'Everything is stable'}
                        </div>
                    </div>

                    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                        {attentionCards.map((card) => {
                            const Icon = card.icon;
                            const isActive = card.count > 0;

                            return (
                                <button
                                    key={card.id}
                                    onClick={() => router.push(card.href)}
                                    style={{
                                        textAlign: 'left',
                                        padding: 16,
                                        borderRadius: 18,
                                        border: `1px solid ${isActive ? card.accent : 'rgba(148,163,184,0.16)'}`,
                                        background: isActive ? `linear-gradient(180deg, ${card.glow}, rgba(15,23,42,0.88))` : 'rgba(15,23,42,0.62)',
                                        boxShadow: isActive ? `0 14px 28px ${card.glow}` : 'none',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 14,
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                        <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(15,23,42,0.58)', border: `1px solid ${isActive ? card.accent : 'rgba(148,163,184,0.16)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Icon size={18} style={{ color: isActive ? card.accent : '#cbd5e1' }} />
                                        </div>
                                        <ArrowRight size={16} style={{ color: isActive ? card.accent : '#64748b', flexShrink: 0 }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: isActive ? '#e2e8f0' : '#94a3b8', marginBottom: 8 }}>
                                            {card.title}
                                        </div>
                                        <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: isActive ? '#fff' : '#cbd5e1', marginBottom: 10 }}>
                                            {card.count}
                                        </div>
                                        <div style={{ fontSize: 12.5, color: isActive ? '#e2e8f0' : '#94a3b8', lineHeight: 1.5 }}>
                                            {card.detail}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="stat-grid">
                <div className="stat-card orange">
                    <div className="stat-icon-wrap orange"><DollarSign size={24} /></div>
                    <div className="stat-value">{formatCurrency(data?.revenue?.today || 0, settings.currencySymbol)}</div>
                    <div className="stat-label">Today&apos;s Revenue</div>
                    <div className="stat-trend up"><TrendingUp size={14} /> +12% from yesterday</div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-icon-wrap blue"><ShoppingBag size={24} /></div>
                    <div className="stat-value">{data?.orders?.today || 0}</div>
                    <div className="stat-label">Orders Today</div>
                    <div className="stat-trend"><TrendingUp size={14} style={{ color: 'var(--success)' }} /> {data?.orders?.active || 0} active now</div>
                </div>
                <div className="stat-card green">
                    <div className="stat-icon-wrap green"><Users size={24} /></div>
                    <div className="stat-value">{data?.customers || 0}</div>
                    <div className="stat-label">Customers this Month</div>
                </div>
                <div className="stat-card purple">
                    <div className="stat-icon-wrap purple"><DollarSign size={24} /></div>
                    <div className="stat-value">{formatCurrency(data?.revenue?.month || 0, settings.currencySymbol)}</div>
                    <div className="stat-label">Monthly Revenue</div>
                </div>
            </div>

            <div className="grid-2">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Revenue (Last 7 Days)</h3>
                            <p className="card-subtitle">Daily earnings breakdown</p>
                        </div>
                    </div>
                    <div className="chart-wrap">
                        {data?.dailyRevenue && data.dailyRevenue.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.dailyRevenue}>
                                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} />
                                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `Le ${v}`} />
                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }} />
                                    <Bar dataKey="revenue" fill="var(--brand-500)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state">No revenue data available</div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Recent Orders</h3>
                            <p className="card-subtitle">Latest activity</p>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Table</th>
                                    <th>Status</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.recentOrders?.map((order: any) => (
                                    <tr key={order.id}>
                                        <td>
                                            <div className="font-bold">#{order.orderNumber}</div>
                                            <div className="text-muted text-sm">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td>
                                            {order.table?.number
                                                ? <span className="flex items-center gap-1">Table {order.table.number} {order.table.mergeGroupId && <Link size={12} style={{ color: '#3b82f6' }} />}</span>
                                                : 'Takeaway'}
                                        </td>
                                        <td><span className={`badge ${order.status}`}>{order.status}</span></td>
                                        <td className="font-bold">{formatCurrency(order.total, settings.currencySymbol)}</td>
                                    </tr>
                                ))}
                                {!data?.recentOrders?.length && (
                                    <tr><td colSpan={4} className="empty-state">No recent orders</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid-3 mt-4">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Top Items</h3>
                    </div>
                    <div>
                        {data?.topItems?.map((item: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i !== data.topItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <span className="font-bold" style={{ fontSize: 13.5 }}>{item.name}</span>
                                <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>{item.quantity} orders</span>
                            </div>
                        ))}
                        {!data?.topItems?.length && <div className="text-muted text-center py-4">No top items data</div>}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Low Inventory</h3>
                    </div>
                    <div>
                        {data?.lowInventory?.map((item: any) => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                                <span className="font-bold text-sm">{item.name}</span>
                                <span className="text-danger font-bold text-sm">{item.currentStock} {item.unit} left</span>
                            </div>
                        ))}
                        {!data?.lowInventory?.length && <div className="text-muted text-center py-4">Inventory is healthy</div>}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Table Status</h3>
                    </div>
                    <div className="grid-2 gap-2 mt-2">
                        <div style={{ background: 'rgba(16,185,129,0.1)', padding: '16px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{data?.tables?.available || 0}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Available</div>
                        </div>
                        <div style={{ background: 'rgba(249,115,22,0.1)', padding: '16px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand-500)' }}>{data?.tables?.occupied || 0}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Occupied</div>
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <div style={{ background: 'rgba(59,130,246,0.1)', padding: '8px', borderRadius: 'var(--radius-md)', flex: 1, textAlign: 'center' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>{data?.tables?.reserved || 0}</span> <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Reserved</span>
                        </div>
                    </div>
                </div>
            </div>

        </AppLayout>
    );
}
