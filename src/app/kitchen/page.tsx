'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { ChefHat, Check, Clock, AlertTriangle, Link } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

export default function KitchenPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const fetchOrders = () => {
        fetch('/api/orders?status=pending,preparing,ready,served')
            .then(r => r.json())
            .then(d => { setOrders(d); setLoading(false); });
    };

    useEffect(() => {
        fetchOrders();
        // Auto refresh every 30 seconds
        const int = setInterval(fetchOrders, 30000);
        return () => clearInterval(int);
    }, []);

    const updateStatus = async (id: string, status: string) => {
        const res = await fetch(`/api/orders/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            toast('success', `Order moved to ${status}`);
            fetchOrders();
        }
    };

    const getElapsedTime = (createdAt: string) => {
        const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
        return diff;
    };

    const renderOrderCard = (order: any) => {
        const elapsed = getElapsedTime(order.createdAt);
        const timeColor = elapsed > 20 ? 'var(--danger)' : elapsed > 10 ? 'var(--warning)' : 'var(--success)';

        return (
            <div key={order.id} className="card" style={{ padding: 0, borderTop: `4px solid ${timeColor}`, flexShrink: 0, background: 'var(--surface-active)' }}>
                <div className="px-4 py-3 border-b border-[var(--border)] flex justify-between items-center bg-opacity-50" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div>
                        <div className="font-bold border-b-2 border-transparent" style={{ fontSize: 18 }}>#{order.orderNumber}</div>
                        <div className="text-muted text-sm flex items-center gap-1 mt-1">
                            {order.type === 'dine-in' ? `Table ${order.table?.number}` : order.type.toUpperCase()}
                            {order.table?.mergeGroupId && <Link size={12} style={{ color: '#3b82f6' }} />}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-bold flex items-center gap-1 justify-end" style={{ color: timeColor }}>
                            <Clock size={14} /> {elapsed}m
                        </div>
                        <div className="text-sm mt-1">
                            <span className={`badge ${order.status}`}>{order.status}</span>
                        </div>
                    </div>
                </div>

                <div className="p-4" style={{ minHeight: '120px' }}>
                    {order.items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between items-start mb-3 border-b border-[var(--border)] pb-2 last:border-0 last:pb-0">
                            <div className="flex gap-2">
                                <div className="font-bold" style={{ width: 24 }}>{item.quantity}x</div>
                                <div>
                                    <div className="font-bold">{item.menuItem.name}</div>
                                    {item.notes && <div className="text-warning text-sm mt-1">📝 {item.notes}</div>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-[var(--border)]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {order.status === 'pending' ? (
                        <button className="btn btn-primary w-full justify-center" onClick={() => updateStatus(order.id, 'preparing')}>
                            Start Preparing
                        </button>
                    ) : order.status === 'preparing' ? (
                        <button className="btn btn-success w-full justify-center" onClick={() => updateStatus(order.id, 'ready')}>
                            <Check size={16} /> Mark as Ready
                        </button>
                    ) : order.status === 'ready' ? (
                        <div className="btn w-full justify-center" style={{ background: 'var(--surface-active)', color: 'var(--text-muted)', cursor: 'default' }}>
                            Waiting for Pickup
                        </div>
                    ) : (
                        <div className="btn w-full justify-center" style={{ background: 'var(--success)', color: 'white', cursor: 'default', opacity: 0.8 }}>
                            <Check size={16} /> Delivered
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;

    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }} className="flex items-center gap-2">
                        <ChefHat size={20} className="text-brand-500" /> Kitchen Display System (KDS)
                    </h2>
                    <p className="text-muted text-sm mt-1">Live order tracking and fulfillment</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2"><div style={{ width: 12, height: 12, background: 'var(--success)', borderRadius: '50%' }} /> <span className="text-sm">New (&lt;10m)</span></div>
                    <div className="flex items-center gap-2"><div style={{ width: 12, height: 12, background: 'var(--warning)', borderRadius: '50%' }} /> <span className="text-sm">Pending (&gt;10m)</span></div>
                    <div className="flex items-center gap-2"><div style={{ width: 12, height: 12, background: 'var(--danger)', borderRadius: '50%' }} /> <span className="text-sm">Late (&gt;20m)</span></div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(300px, 1fr))', gap: '24px', alignItems: 'start', overflowX: 'auto', paddingBottom: 24, minHeight: '70vh' }}>
                {/* PENDING COLUMN */}
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--border)', paddingBottom: '12px' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>Incoming</h3>
                        <span className="badge pending">{orders.filter(o => o.status === 'pending').length}</span>
                    </div>
                    {orders.filter(o => o.status === 'pending').map(order => renderOrderCard(order))}
                    {orders.filter(o => o.status === 'pending').length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-active)', borderRadius: 'var(--radius-md)' }}>No active incoming orders.</div>
                    )}
                </div>

                {/* PREPARING COLUMN */}
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--border)', paddingBottom: '12px' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>Preparing</h3>
                        <span className="badge preparing">{orders.filter(o => o.status === 'preparing').length}</span>
                    </div>
                    {orders.filter(o => o.status === 'preparing').map(order => renderOrderCard(order))}
                    {orders.filter(o => o.status === 'preparing').length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-active)', borderRadius: 'var(--radius-md)' }}>No orders currently being prepared.</div>
                    )}
                </div>

                {/* READY COLUMN */}
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--border)', paddingBottom: '12px' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>Ready For Pickup</h3>
                        <span className="badge ready">{orders.filter(o => o.status === 'ready').length}</span>
                    </div>
                    {orders.filter(o => o.status === 'ready').map(order => renderOrderCard(order))}
                    {orders.filter(o => o.status === 'ready').length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-active)', borderRadius: 'var(--radius-md)' }}>No orders waiting for pickup.</div>
                    )}
                </div>

                {/* DELIVERED COLUMN */}
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%', border: '1px solid var(--border)', opacity: 0.8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--border)', paddingBottom: '12px' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>Delivered</h3>
                        <span className="badge" style={{ background: 'var(--success)', color: 'white' }}>{orders.filter(o => o.status === 'served').length}</span>
                    </div>
                    {orders.filter(o => o.status === 'served').map(order => renderOrderCard(order))}
                    {orders.filter(o => o.status === 'served').length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-active)', borderRadius: 'var(--radius-md)' }}>No delivered orders yet.</div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
