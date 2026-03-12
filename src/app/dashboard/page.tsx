'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, ShoppingBag, DollarSign, Clock, CheckCircle, Link } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

export default function Dashboard() {
    const { user } = useAuth();
    const { settings } = useSettings();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard')
            .then(res => res.json())
            .then(d => { setData(d); setLoading(false); });
    }, []);

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
            <div className="stat-grid">
                <div className="stat-card orange">
                    <div className="stat-icon-wrap orange"><DollarSign size={24} /></div>
                    <div className="stat-value">{formatCurrency(data?.revenue?.today || 0, settings.currencySymbol)}</div>
                    <div className="stat-label">Today's Revenue</div>
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
