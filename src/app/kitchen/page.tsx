'use client';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { Check, Clock, AlertTriangle, Link, ArrowRight, Bell, X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

type NewOrderBanner = {
    id: string;
    orderNumber: string | number;
    label: string;
    arrivedAt: number;
};

function KitchenPageContent() {
    const searchParams = useSearchParams();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
    const [updatingNextStatus, setUpdatingNextStatus] = useState<string | null>(null);
    const [clockNow, setClockNow] = useState(() => Date.now());
    const [newOrderBanners, setNewOrderBanners] = useState<NewOrderBanner[]>([]);
    const seenOrderIds = useRef<Set<string>>(new Set());
    const isFirstLoad = useRef(true);
    const toast = useToast();
    const incomingRef = useRef<HTMLDivElement | null>(null);
    const preparingRef = useRef<HTMLDivElement | null>(null);
    const readyRef = useRef<HTMLDivElement | null>(null);
    const servedRef = useRef<HTMLDivElement | null>(null);
    const focus = searchParams.get('focus');

    const fetchOrders = () => {
        fetch('/api/orders?status=pending,preparing,ready,served')
            .then(r => r.json())
            .then((d: any[]) => {
                if (isFirstLoad.current) {
                    d.forEach(o => seenOrderIds.current.add(o.id));
                    isFirstLoad.current = false;
                } else {
                    const incoming = d.filter(
                        o => o.status === 'pending' && !seenOrderIds.current.has(o.id)
                    );
                    if (incoming.length > 0) {
                        const now = Date.now();
                        setNewOrderBanners(prev => [
                            ...prev,
                            ...incoming.map(o => ({
                                id: o.id,
                                orderNumber: o.orderNumber,
                                label: o.tableId && o.table?.number != null
                                    ? `Table ${o.table.number}`
                                    : (o.type === 'takeout' ? 'Takeaway' : 'Order'),
                                arrivedAt: now,
                            })),
                        ]);
                        incoming.forEach(o => seenOrderIds.current.add(o.id));
                    }
                    d.forEach(o => seenOrderIds.current.add(o.id));
                }
                setOrders(d);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchOrders();
        const int = setInterval(fetchOrders, 30000);
        return () => clearInterval(int);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setClockNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (newOrderBanners.length === 0) return;
        const timer = setTimeout(() => {
            const cutoff = Date.now() - 12000;
            setNewOrderBanners(prev => prev.filter(b => b.arrivedAt > cutoff));
        }, 12000);
        return () => clearTimeout(timer);
    }, [newOrderBanners]);

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
        const previousOrders = orders;
        setUpdatingOrderId(id);
        setUpdatingNextStatus(status);
        setOrders((currentOrders) => currentOrders.map((order) => (
            order.id === id ? { ...order, status, _optimistic: true } : order
        )));

        try {
            const res = await fetch(`/api/orders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });

            if (!res.ok) {
                setOrders(previousOrders);
                toast('error', 'Unable to update order status right now');
                return;
            }

            toast('success', `Order moved to ${status}`);
            fetchOrders();
        } catch {
            setOrders(previousOrders);
            toast('error', 'Unable to update order status right now');
        } finally {
            setUpdatingOrderId(null);
            setUpdatingNextStatus(null);
        }
    };

    const getElapsedTime = (startedAt?: string | null, endedAt?: string | null, status?: string | null) => {
        if (!startedAt) {
            return null;
        }

        if (status === 'served' || status === 'completed' || status === 'cancelled') {
            return null;
        }

        const endTime = endedAt ? new Date(endedAt).getTime() : clockNow;
        const diff = Math.floor((endTime - new Date(startedAt).getTime()) / 60000);
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

    const renderLane = ({
        title,
        count,
        orders,
        emptyCopy,
        badgeClassName,
        fallbackBadgeStyle,
        column,
        laneRef,
    }: {
        title: string;
        count: number;
        orders: any[];
        emptyCopy: string;
        badgeClassName?: string;
        fallbackBadgeStyle?: React.CSSProperties;
        column: 'pending' | 'preparing' | 'ready' | 'served';
        laneRef: React.RefObject<HTMLDivElement | null>;
    }) => {
        const columnState = getColumnState(column);

        return (
            <div
                ref={laneRef}
                style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)), var(--bg-card)',
                    padding: '14px',
                    borderRadius: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    minHeight: '100%',
                    border: `1px solid ${columnState.borderColor}`,
                    boxShadow: columnState.boxShadow,
                    opacity: columnState.opacity,
                    transition: 'opacity 0.2s, box-shadow 0.2s, border-color 0.2s',
                    backdropFilter: 'blur(14px)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                    <div>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', margin: 0 }}>{title}</h3>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1.1 }}>
                            {count === 0 ? 'Queue clear' : `${count} live ticket${count === 1 ? '' : 's'}`}
                        </div>
                    </div>
                    {badgeClassName ? (
                        <span className={`badge ${badgeClassName}`}>{count}</span>
                    ) : (
                        <span className="badge" style={fallbackBadgeStyle}>{count}</span>
                    )}
                </div>
                {orders.length > 0 ? orders.map(order => renderOrderCard(order)) : (
                    <div style={{
                        padding: '28px 24px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: 13,
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 18,
                        border: '1px dashed rgba(255,255,255,0.06)',
                    }}>
                        {emptyCopy}
                    </div>
                )}
            </div>
        );
    };

    const renderOrderCard = (order: any) => {
        const elapsed = getElapsedTime(order.serviceStartedAt, order.serviceEndedAt, order.status);
        const isUpdating = updatingOrderId === order.id;
        const timeColor = elapsed === null
            ? 'var(--text-muted)'
            : elapsed > 20
                ? 'var(--danger)'
                : elapsed > 10
                    ? 'var(--warning)'
                    : 'var(--success)';

        return (
            <div key={order.id} className="card" style={{ marginInline: 12, padding: 0, borderTop: `4px solid ${timeColor}`, flexShrink: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.018)) , var(--surface-active)', overflow: 'hidden' }}>
                <div
                    className="px-5 pt-3 pb-2 border-b border-[var(--border)]"
                    style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: 14,
                            padding: '10px 12px',
                            borderRadius: 20,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.05)',
                        }}
                    >
                        <div style={{ minWidth: 0, flex: '0 1 62%', maxWidth: 320 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                                <div className="font-bold" style={{ fontSize: 18, lineHeight: 1, color: '#f8fafc', letterSpacing: '-0.04em' }}>
                                    #{order.orderNumber}
                                </div>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '8px 12px',
                                    borderRadius: 999,
                                    background: 'rgba(15,23,42,0.52)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    color: '#cbd5e1',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: 0.4,
                                    textTransform: 'uppercase',
                                }}>
                                    {order.type === 'dine-in' ? `Table ${order.table?.number}` : order.type.toUpperCase()}
                                    {order.table?.mergeGroupId && <Link size={12} style={{ color: '#60a5fa' }} />}
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: timeColor, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>
                                    <Clock size={14} />
                                    {elapsed === null ? 'Not started' : `${elapsed} min on station`}
                                </div>
                            </div>
                        </div>
                        <div style={{ flexShrink: 0, paddingTop: 2 }}>
                            <span
                                className={`badge ${order.status}`}
                                style={{
                                    padding: '10px 14px',
                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                                }}
                            >
                                {order.status}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="px-5 pt-3 pb-5" style={{ minHeight: '156px' }}>
                    <div style={{ paddingInline: 14 }}>
                        {order.items.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between items-start mb-4 border-b border-[var(--border)] pb-4 last:border-0 last:pb-0 last:mb-0">
                                <div
                                    className="flex gap-4"
                                    style={{
                                        alignItems: 'flex-start',
                                        maxWidth: '78%',
                                        padding: '8px 10px',
                                        borderRadius: 16,
                                        background: 'rgba(255,255,255,0.018)',
                                    }}
                                >
                                    <div style={{
                                        minWidth: 38,
                                        height: 38,
                                        borderRadius: 12,
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 14,
                                        fontWeight: 800,
                                        color: '#f8fafc',
                                        flexShrink: 0,
                                    }}>
                                        {item.quantity}x
                                    </div>
                                    <div style={{ paddingTop: 2, width: '100%', maxWidth: 280 }}>
                                        <div className="font-bold" style={{ fontSize: 16, color: '#f8fafc', lineHeight: 1.3, marginBottom: 2 }}>{item.menuItem.name}</div>
                                        {Array.isArray(item.removals) && item.removals.length > 0 && (
                                            <div className="text-sm text-danger mt-2" style={{ lineHeight: 1.5 }}>
                                                Remove: {item.removals.map((removal: any) => removal.labelSnapshot).join(', ')}
                                            </div>
                                        )}
                                        {Array.isArray(item.additions) && item.additions.length > 0 && (
                                            <div className="text-sm text-success mt-2" style={{ lineHeight: 1.5 }}>
                                                Add: {item.additions.map((addition: any) => addition.labelSnapshot).join(', ')}
                                            </div>
                                        )}
                                        {item.kitchenNote && <div className="text-warning text-sm mt-2" style={{ lineHeight: 1.5 }}>Preference: {item.kitchenNote}</div>}
                                        {item.notes && <div className="text-warning text-sm mt-2" style={{ lineHeight: 1.5 }}>Note: {item.notes}</div>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {(order.status === 'pending' || order.status === 'preparing') && (
                    <div className="px-5 pt-3 pb-4 border-t border-[var(--border)]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        {order.status === 'pending' ? (
                            <button
                                className="btn btn-primary w-full justify-center"
                                style={{ borderRadius: 18, opacity: isUpdating ? 0.8 : 1 }}
                                onClick={() => updateStatus(order.id, 'preparing')}
                                disabled={isUpdating}
                            >
                                {isUpdating && updatingNextStatus === 'preparing' ? 'Starting...' : 'Start Preparing'}
                            </button>
                        ) : (
                            <button
                                className="btn btn-success w-full justify-center"
                                style={{ borderRadius: 18, opacity: isUpdating ? 0.8 : 1 }}
                                onClick={() => updateStatus(order.id, 'ready')}
                                disabled={isUpdating}
                            >
                                {isUpdating && updatingNextStatus === 'ready'
                                    ? 'Updating...'
                                    : <><Check size={16} /> Mark as Ready</>}
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const dismissBanner = (id: string) =>
        setNewOrderBanners(prev => prev.filter(b => b.id !== id));

    if (loading) return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;

    return (
        <AppLayout>
            <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
                <div>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--text-accent)', marginBottom: 8 }}>
                        Kitchen line
                    </span>
                    <h2 style={{ fontFamily: 'var(--font-display), serif', fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 4 }}>
                        What&apos;s on the pass?
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Tickets refresh every 30 seconds. Move them through the line as you cook.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, background: 'var(--success)', borderRadius: '50%' }} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Fresh</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, background: 'var(--warning)', borderRadius: '50%' }} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Waiting &gt; 10m</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, background: 'var(--danger)', borderRadius: '50%' }} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Late &gt; 20m</span>
                    </div>
                </div>
            </div>

            {newOrderBanners.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                    {newOrderBanners.map(banner => (
                        <div
                            key={banner.id}
                            style={{
                                padding: '14px 18px',
                                borderRadius: 16,
                                border: '1px solid rgba(56,189,248,0.45)',
                                background: 'linear-gradient(135deg, rgba(56,189,248,0.14), rgba(15,23,42,0.92))',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                animation: 'fadeSlideIn 0.25s ease',
                            }}
                        >
                            <div style={{
                                width: 36, height: 36, borderRadius: 12,
                                background: 'rgba(56,189,248,0.18)',
                                border: '1px solid rgba(56,189,248,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <Bell size={16} style={{ color: '#38bdf8' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: '#38bdf8', marginBottom: 2 }}>
                                    New order in
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>
                                    #{banner.orderNumber} &mdash; {banner.label}
                                </div>
                            </div>
                            <button
                                onClick={() => dismissBanner(banner.id)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    padding: 6, borderRadius: 8, color: 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                                aria-label="Dismiss"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(300px, 1fr))', gap: 20, alignItems: 'start', overflowX: 'auto', paddingBottom: 24 }}>
                    {renderLane({
                        title: 'New tickets',
                        count: pendingOrders.length,
                        orders: pendingOrders,
                        emptyCopy: 'Nothing waiting to start.',
                        badgeClassName: 'pending',
                        column: 'pending',
                        laneRef: incomingRef,
                    })}
                    {renderLane({
                        title: 'Cooking',
                        count: preparingOrders.length,
                        orders: preparingOrders,
                        emptyCopy: 'No tickets are being prepared right now.',
                        badgeClassName: 'preparing',
                        column: 'preparing',
                        laneRef: preparingRef,
                    })}
                    {renderLane({
                        title: 'Ready to serve',
                        count: readyOrders.length,
                        orders: readyOrders,
                        emptyCopy: 'Nothing sitting at the pass.',
                        badgeClassName: 'ready',
                        column: 'ready',
                        laneRef: readyRef,
                    })}
                    <div
                        ref={servedRef}
                        style={{
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)), var(--bg-card)',
                            padding: '16px',
                            borderRadius: 24,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            minHeight: '100%',
                            border: `1px solid ${getColumnState('served').borderColor}`,
                            boxShadow: getColumnState('served').boxShadow,
                            opacity: focusConfig ? getColumnState('served').opacity : 0.88,
                            transition: 'opacity 0.2s, box-shadow 0.2s, border-color 0.2s',
                            backdropFilter: 'blur(14px)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', margin: 0 }}>Done</h3>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1.1 }}>
                                    {servedOrders.length === 0 ? 'Queue clear' : `${servedOrders.length} served ticket${servedOrders.length === 1 ? '' : 's'}`}
                                </div>
                            </div>
                            <span className="badge" style={{ background: 'rgba(16,185,129,0.16)', color: '#6ee7b7' }}>{servedOrders.length}</span>
                        </div>
                        {servedOrders.length > 0 ? servedOrders.map(order => renderOrderCard(order)) : (
                            <div style={{
                                padding: '28px 24px',
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                fontSize: 13,
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: 18,
                                border: '1px dashed rgba(255,255,255,0.06)',
                            }}>
                                Nothing served yet today.
                            </div>
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
