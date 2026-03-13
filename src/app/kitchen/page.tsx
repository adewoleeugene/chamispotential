'use client';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { ChefHat, Check, Clock, AlertTriangle, Link, ArrowRight } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

function KitchenPageContent() {
    const searchParams = useSearchParams();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [clockNow, setClockNow] = useState(() => Date.now());
    const toast = useToast();
    const incomingRef = useRef<HTMLDivElement | null>(null);
    const preparingRef = useRef<HTMLDivElement | null>(null);
    const readyRef = useRef<HTMLDivElement | null>(null);
    const servedRef = useRef<HTMLDivElement | null>(null);
    const focus = searchParams.get('focus');

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

    useEffect(() => {
        const timer = setInterval(() => setClockNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (loading || !focus) return;

        const columnMap: Record<string, React.RefObject<HTMLDivElement | null>> = {
            pending: incomingRef,
            preparing: preparingRef,
            ready: readyRef,
            served: servedRef,
        };

        columnMap[focus]?.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
        });
    }, [focus, loading]);

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
        const diff = Math.floor((clockNow - new Date(createdAt).getTime()) / 60000);
        return diff;
    };

    const focusConfig = focus === 'ready'
        ? {
            title: 'Orders ready for pickup',
            detail: 'You were sent directly to the orders waiting on the floor team.',
            accent: '#22c55e',
            background: 'rgba(34,197,94,0.12)',
            column: 'ready',
        }
        : focus === 'pending'
            ? {
                title: 'Incoming orders waiting to start',
                detail: 'These tickets need kitchen attention before the queue builds up.',
                accent: '#38bdf8',
                background: 'rgba(56,189,248,0.12)',
                column: 'pending',
            }
            : focus === 'preparing'
                ? {
                    title: 'Orders in preparation',
                    detail: 'You are focused on the active prep queue.',
                    accent: '#f59e0b',
                    background: 'rgba(245,158,11,0.12)',
                    column: 'preparing',
                }
                : null;

    const pendingOrders = orders.filter(o => o.status === 'pending');
    const preparingOrders = orders.filter(o => o.status === 'preparing');
    const readyOrders = orders.filter(o => o.status === 'ready');
    const servedOrders = orders.filter(o => o.status === 'served');

    const getColumnState = (column: 'pending' | 'preparing' | 'ready' | 'served') => {
        const isFocused = !focusConfig || focusConfig.column === column;

        return {
            opacity: isFocused ? 1 : 0.45,
            borderColor: focusConfig?.column === column ? focusConfig.accent : 'var(--border)',
            boxShadow: focusConfig?.column === column ? `0 0 0 1px ${focusConfig.accent}, 0 14px 28px ${focusConfig.background}` : 'none',
        };
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

            {focusConfig && (
                <div style={{ marginBottom: 18, padding: 16, borderRadius: 18, border: `1px solid ${focusConfig.accent}`, background: `linear-gradient(135deg, ${focusConfig.background}, rgba(15,23,42,0.9))`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase', color: focusConfig.accent, marginBottom: 8 }}>
                            <AlertTriangle size={14} />
                            Focused Kitchen View
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{focusConfig.title}</div>
                        <div style={{ fontSize: 13, color: '#cbd5e1' }}>{focusConfig.detail}</div>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: focusConfig.accent, fontWeight: 700, fontSize: 13 }}>
                        Scroll snapped to the active column <ArrowRight size={14} />
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(300px, 1fr))', gap: '24px', alignItems: 'start', overflowX: 'auto', paddingBottom: 24, minHeight: '70vh' }}>
                {/* PENDING COLUMN */}
                <div ref={incomingRef} style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%', border: `1px solid ${getColumnState('pending').borderColor}`, boxShadow: getColumnState('pending').boxShadow, opacity: getColumnState('pending').opacity, transition: 'opacity 0.2s, box-shadow 0.2s, border-color 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--border)', paddingBottom: '12px' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>Incoming</h3>
                        <span className="badge pending">{pendingOrders.length}</span>
                    </div>
                    {pendingOrders.map(order => renderOrderCard(order))}
                    {pendingOrders.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-active)', borderRadius: 'var(--radius-md)' }}>No active incoming orders.</div>
                    )}
                </div>

                {/* PREPARING COLUMN */}
                <div ref={preparingRef} style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%', border: `1px solid ${getColumnState('preparing').borderColor}`, boxShadow: getColumnState('preparing').boxShadow, opacity: getColumnState('preparing').opacity, transition: 'opacity 0.2s, box-shadow 0.2s, border-color 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--border)', paddingBottom: '12px' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>Preparing</h3>
                        <span className="badge preparing">{preparingOrders.length}</span>
                    </div>
                    {preparingOrders.map(order => renderOrderCard(order))}
                    {preparingOrders.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-active)', borderRadius: 'var(--radius-md)' }}>No orders currently being prepared.</div>
                    )}
                </div>

                {/* READY COLUMN */}
                <div ref={readyRef} style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%', border: `1px solid ${getColumnState('ready').borderColor}`, boxShadow: getColumnState('ready').boxShadow, opacity: getColumnState('ready').opacity, transition: 'opacity 0.2s, box-shadow 0.2s, border-color 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--border)', paddingBottom: '12px' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>Ready For Pickup</h3>
                        <span className="badge ready">{readyOrders.length}</span>
                    </div>
                    {readyOrders.map(order => renderOrderCard(order))}
                    {readyOrders.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-active)', borderRadius: 'var(--radius-md)' }}>No orders waiting for pickup.</div>
                    )}
                </div>

                {/* DELIVERED COLUMN */}
                <div ref={servedRef} style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%', border: `1px solid ${getColumnState('served').borderColor}`, boxShadow: getColumnState('served').boxShadow, opacity: focusConfig ? getColumnState('served').opacity : 0.8, transition: 'opacity 0.2s, box-shadow 0.2s, border-color 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--border)', paddingBottom: '12px' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>Delivered</h3>
                        <span className="badge" style={{ background: 'var(--success)', color: 'white' }}>{servedOrders.length}</span>
                    </div>
                    {servedOrders.map(order => renderOrderCard(order))}
                    {servedOrders.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-active)', borderRadius: 'var(--radius-md)' }}>No delivered orders yet.</div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

export default function KitchenPage() {
    return (
        <Suspense fallback={<AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>}>
            <KitchenPageContent />
        </Suspense>
    );
}
