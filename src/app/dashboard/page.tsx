'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
    TrendingUp, TrendingDown, Users, ShoppingBag, CheckCircle, Link as LinkIcon,
    AlertTriangle, ArrowRight, BellRing, PackageSearch, ChefHat, Sparkles,
    Table2, ClipboardList, Check,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { TABLE_STATUS_COLORS } from '@/lib/table-status';
import { isWaiterRole } from '@/lib/roleRoutes';

type CostMethod = 'weighted_average_as_of_sale_date' | 'fifo' | 'lifo';

type DashboardData = {
    revenue: { today: number; month: number; averageTicket: number };
    finance: {
        costMethod: CostMethod;
        week: { netSales: number; ingredientSpend: number; cogs: number; grossProfit: number; grossMarginPct: number };
        month: { netSales: number; ingredientSpend: number; cogs: number; grossProfit: number; grossMarginPct: number };
    };
    orders: { today: number; active: number; ready: number; pending: number; servedToday: number };
    customers: number;
    tables: Record<string, number>;
    activeTablesCount: number;
    activeTablesList: Array<{ id: string; number: number; section?: string | null; capacity: number; status: string; displayStatus: string; orders?: Array<{ id: string; status: string }> }>;
    dailyRevenue: Array<{ date: string; netSales: number }>;
    recentOrders: Array<{ id: string; orderNumber: number; createdAt: string; status: string; total: number; table: { number?: number | null; section?: string | null; mergeGroupId?: string | null } | null }>;
    topItems: Array<{ name: string; quantity: number }>;
    lowInventory: Array<{ id: string; name: string; currentStock: number; unit: string }>;
};

const greetingFor = (hour: number) => {
    if (hour < 5) return 'Late service';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 22) return 'Good evening';
    return 'Late service';
};

const serviceWindow = (hour: number) => {
    if (hour < 6) return 'Closing out tonight';
    if (hour < 11) return 'Breakfast service';
    if (hour < 15) return 'Lunch service';
    if (hour < 17) return 'Quiet hours';
    if (hour < 22) return 'Dinner service';
    return 'Late dinner';
};

export default function Dashboard() {
    const { user } = useAuth();
    const { settings } = useSettings();
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [inventorySummary, setInventorySummary] = useState({ reorderNow: 0, reorderSoon: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [now] = useState(() => new Date());
    const isOpsViewer = user?.role === 'admin' || user?.role === 'manager';

    useEffect(() => {
        const controller = new AbortController();
        queueMicrotask(() => setError(null));

        Promise.all([
            fetch('/api/dashboard', { signal: controller.signal }).then(res => res.json()),
            fetch('/api/inventory', { signal: controller.signal }).then(res => res.json()),
        ])
            .then(([dashboardData, inventoryData]) => {
                setData(dashboardData);
                setInventorySummary(inventoryData?.adviceSummary || { reorderNow: 0, reorderSoon: 0 });
                setLoading(false);
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                setError('Unable to refresh dashboard right now. Showing the latest available view.');
                setLoading(false);
            });

        return () => controller.abort();
    }, []);

    if (loading && !data) return (
        <AppLayout>
            <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
                <div className="loading-spinner" />
            </div>
        </AppLayout>
    );

    // ─── Waiter view ─────────────────────────────────────────────────────
    if (isWaiterRole(user?.role)) {
        const allTableOrders = data?.activeTablesList?.flatMap(t => t.orders ?? []) ?? [];
        const readyCount   = allTableOrders.filter(o => o.status === 'ready').length;
        const activeCount  = allTableOrders.length;
        const pendingCount = allTableOrders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
        const activeTables = data?.activeTablesList?.filter(t => t.displayStatus === 'occupied').length ?? 0;
        const hour = now.getHours();

        return (
            <AppLayout>
                {/* ─── Hero greeting ───────────────────────────────────── */}
                <section
                    style={{
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: 24,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01)), rgba(10,13,18,0.85)',
                        padding: '28px 32px',
                        marginBottom: 24,
                        boxShadow: 'var(--shadow-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 20,
                        flexWrap: 'wrap',
                    }}
                >
                    <div
                        aria-hidden
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'radial-gradient(circle at 6% 0%, rgba(180,104,51,0.2), transparent 40%), radial-gradient(circle at 94% 100%, rgba(34,197,94,0.12), transparent 44%)',
                            pointerEvents: 'none',
                        }}
                    />
                    <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '5px 10px',
                                    borderRadius: 999,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.04)',
                                    color: 'var(--text-accent)',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.18em',
                                }}
                            >
                                <Sparkles size={11} /> {serviceWindow(hour)}
                            </span>
                        </div>
                        <h1
                            style={{
                                fontFamily: 'var(--font-display), serif',
                                fontWeight: 700,
                                fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
                                lineHeight: 1.05,
                                letterSpacing: '-0.04em',
                                color: 'var(--text-primary)',
                                margin: 0,
                            }}
                        >
                            {greetingFor(hour)}, {user?.name?.split(' ')[0] || 'there'}.{' '}
                            <span style={{ color: 'var(--text-secondary)' }}>
                                {readyCount > 0
                                    ? `${readyCount} order${readyCount === 1 ? '' : 's'} waiting to be served.`
                                    : activeTables > 0
                                        ? `${activeTables} table${activeTables === 1 ? '' : 's'} in your care.`
                                        : 'Floor is quiet right now.'}
                            </span>
                        </h1>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', gap: 10, flexShrink: 0 }}>
                        <button
                            onClick={() => router.push('/tables')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 18px',
                                borderRadius: 12,
                                background: 'var(--brand-500)',
                                border: 'none',
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            <Table2 size={15} /> Manage Tables
                        </button>
                        <button
                            onClick={() => router.push('/orders')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 18px',
                                borderRadius: 12,
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'var(--text-primary)',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            <ClipboardList size={15} /> All Orders
                        </button>
                    </div>
                </section>

                {/* ─── Ready to serve — highest priority ───────────────── */}
                <section style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div>
                            <span
                                style={{
                                    display: 'inline-block',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.22em',
                                    color: '#22c55e',
                                    marginBottom: 4,
                                }}
                            >
                                Action needed
                            </span>
                            <h2
                                style={{
                                    fontFamily: 'var(--font-display), serif',
                                    fontSize: 20,
                                    fontWeight: 700,
                                    letterSpacing: '-0.03em',
                                    color: 'var(--text-primary)',
                                    margin: 0,
                                }}
                            >
                                {readyCount > 0 ? `${readyCount} order${readyCount === 1 ? '' : 's'} ready at the pass` : 'Nothing at the pass right now'}
                            </h2>
                        </div>
                        {readyCount > 0 && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 12px',
                                    borderRadius: 999,
                                    background: 'rgba(34,197,94,0.12)',
                                    border: '1px solid rgba(34,197,94,0.3)',
                                    color: '#22c55e',
                                    fontSize: 12,
                                    fontWeight: 700,
                                }}
                            >
                                <span
                                    style={{
                                        display: 'inline-block',
                                        width: 7,
                                        height: 7,
                                        borderRadius: '50%',
                                        background: '#22c55e',
                                        animation: 'pulse 1.5s infinite',
                                    }}
                                />
                                Live
                            </div>
                        )}
                    </div>

                    {readyCount === 0 ? (
                        <div
                            style={{
                                padding: 32,
                                borderRadius: 18,
                                border: '1px solid rgba(148,163,184,0.12)',
                                background: 'rgba(15,23,42,0.5)',
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                fontSize: 14,
                            }}
                        >
                            <CheckCircle size={32} style={{ color: '#22c55e', marginBottom: 10, opacity: 0.6 }} />
                            <div>Kitchen is working on orders. You&apos;ll be alerted here when they&apos;re ready.</div>
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                gap: 14,
                            }}
                        >
                            {data?.recentOrders
                                ?.filter(o => o.status === 'ready')
                                .slice(0, 6)
                                .map((order) => (
                                    <div
                                        key={order.id}
                                        style={{
                                            padding: 20,
                                            borderRadius: 18,
                                            border: '1px solid rgba(34,197,94,0.35)',
                                            background: 'linear-gradient(180deg, rgba(34,197,94,0.1), rgba(15,23,42,0.88))',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 14,
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#22c55e', marginBottom: 4 }}>
                                                    Ready to Serve
                                                </div>
                                                <div
                                                    style={{
                                                        fontFamily: 'var(--font-display), serif',
                                                        fontSize: 28,
                                                        fontWeight: 700,
                                                        letterSpacing: '-0.04em',
                                                        color: 'var(--text-primary)',
                                                        lineHeight: 1,
                                                    }}
                                                >
                                                    #{order.orderNumber}
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: 10,
                                                    background: 'rgba(34,197,94,0.15)',
                                                    border: '1px solid rgba(34,197,94,0.3)',
                                                    color: '#22c55e',
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {order.table ? (order.table.section || `Table ${order.table.number}`) : 'Takeaway'}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            Placed at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <button
                                            onClick={async () => {
                                                await fetch(`/api/orders/${order.id}`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ status: 'served' }),
                                                });
                                                setData(prev => prev ? {
                                                    ...prev,
                                                    orders: { ...prev.orders, ready: Math.max(0, prev.orders.ready - 1) },
                                                    recentOrders: prev.recentOrders.map(o => o.id === order.id ? { ...o, status: 'served' } : o),
                                                } : prev);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 8,
                                                padding: '11px 0',
                                                borderRadius: 12,
                                                background: '#22c55e',
                                                border: 'none',
                                                color: '#fff',
                                                fontSize: 13,
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                width: '100%',
                                            }}
                                        >
                                            <Check size={15} /> Mark as Served
                                        </button>
                                    </div>
                                ))}
                        </div>
                    )}
                </section>

                {/* ─── At a glance stats ───────────────────────────────── */}
                <section style={{ marginBottom: 28 }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 14,
                        }}
                    >
                        <WaiterStat
                            icon={<Users size={20} />}
                            value={activeTables}
                            label="Tables in service"
                            accent="#f59e0b"
                            onClick={() => router.push('/tables')}
                        />
                        <WaiterStat
                            icon={<ShoppingBag size={20} />}
                            value={activeCount}
                            label="Active orders"
                            accent="#38bdf8"
                            onClick={() => router.push('/orders')}
                        />
                        <WaiterStat
                            icon={<ChefHat size={20} />}
                            value={pendingCount}
                            label="In the kitchen"
                            accent="#a78bfa"
                        />
                        <WaiterStat
                            icon={<CheckCircle size={20} />}
                            value={data?.orders?.servedToday || 0}
                            label="Served today"
                            accent="#22c55e"
                        />
                    </div>
                </section>

                {/* ─── My active tables ────────────────────────────────── */}
                <section>
                    <div style={{ marginBottom: 14 }}>
                        <span
                            style={{
                                display: 'inline-block',
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.22em',
                                color: 'var(--text-accent)',
                                marginBottom: 4,
                            }}
                        >
                            Floor
                        </span>
                        <h2
                            style={{
                                fontFamily: 'var(--font-display), serif',
                                fontSize: 20,
                                fontWeight: 700,
                                letterSpacing: '-0.03em',
                                color: 'var(--text-primary)',
                                margin: 0,
                            }}
                        >
                            {activeTables > 0 ? 'Your active tables' : 'No occupied tables right now'}
                        </h2>
                    </div>

                    {!data?.activeTablesList?.length ? (
                        <div
                            style={{
                                padding: 40,
                                borderRadius: 18,
                                border: '1px solid rgba(148,163,184,0.12)',
                                background: 'rgba(15,23,42,0.5)',
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                fontSize: 14,
                            }}
                        >
                            <Table2 size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
                            <div>No tables are currently occupied. Head to the tables page to seat guests.</div>
                            <button
                                onClick={() => router.push('/tables')}
                                style={{
                                    marginTop: 16,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '10px 20px',
                                    borderRadius: 12,
                                    background: 'var(--brand-500)',
                                    border: 'none',
                                    color: '#fff',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                Go to Tables <ArrowRight size={14} />
                            </button>
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                gap: 14,
                            }}
                        >
                            {data.activeTablesList.map((table) => {
                                const orderCount = table.orders?.length || 0;
                                const ds = table.displayStatus;
                                const statusColor =
                                    ds === 'occupied' ? '#ef4444' :
                                    ds === 'reserved' ? '#94a3b8' : '#10b981';
                                const statusBg =
                                    ds === 'occupied' ? 'rgba(239,68,68,0.1)' :
                                    ds === 'reserved' ? 'rgba(148,163,184,0.1)' : 'rgba(16,185,129,0.1)';

                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => router.push('/tables')}
                                        style={{
                                            textAlign: 'left',
                                            padding: 20,
                                            borderRadius: 18,
                                            border: `1px solid ${statusColor}44`,
                                            background: `linear-gradient(180deg, ${statusBg}, rgba(15,23,42,0.88))`,
                                            cursor: 'pointer',
                                            color: 'var(--text-primary)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 12,
                                            transition: 'transform 0.15s ease',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                                        onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div
                                                style={{
                                                    fontFamily: 'var(--font-display), serif',
                                                    fontSize: table.section ? 20 : 32,
                                                    fontWeight: 700,
                                                    letterSpacing: '-0.02em',
                                                    lineHeight: 1.1,
                                                    color: statusColor,
                                                }}
                                            >
                                                {table.section || table.number}
                                            </div>
                                            <span
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: 8,
                                                    background: statusBg,
                                                    border: `1px solid ${statusColor}55`,
                                                    color: statusColor,
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    textTransform: 'capitalize',
                                                }}
                                            >
                                                {table.displayStatus}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                            <span style={{ color: 'var(--text-muted)' }}>{table.capacity} seats</span>
                                            <span style={{ fontWeight: 700, color: orderCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                {orderCount} {orderCount === 1 ? 'order' : 'orders'}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>
            </AppLayout>
        );
    }

    // ─── Manager / Admin view ──────────────────────────────────────────
    const totalTables = (data?.tables?.available || 0) + (data?.tables?.occupied || 0) + (data?.tables?.reserved || 0);
    const seatedTables = data?.tables?.occupied || 0;
    const seatedPct = totalTables > 0 ? Math.round((seatedTables / totalTables) * 100) : 0;

    const todayRevenue = data?.revenue?.today || 0;
    const last7 = data?.dailyRevenue || [];
    const yesterdayRevenue = last7.length >= 2 ? last7[last7.length - 2]?.netSales || 0 : 0;
    const revenueDelta = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : null;

    const attentionCards = [
        {
            id: 'ready-orders',
            title: 'Orders ready to serve',
            count: data?.orders?.ready || 0,
            cta: 'Open kitchen view',
            href: '/kitchen?focus=ready',
            icon: BellRing,
            accent: '#22c55e',
        },
        {
            id: 'pending-orders',
            title: 'Tickets waiting in kitchen',
            count: data?.orders?.pending || 0,
            cta: 'Open kitchen view',
            href: '/kitchen?focus=pending',
            icon: ChefHat,
            accent: '#38bdf8',
        },
        {
            id: 'reorder-now',
            title: 'Items to reorder now',
            count: inventorySummary.reorderNow,
            cta: 'Open inventory',
            href: '/inventory?focus=reorder_now',
            icon: AlertTriangle,
            accent: '#f97316',
        },
        {
            id: 'reorder-soon',
            title: 'Stock running low',
            count: inventorySummary.reorderSoon,
            cta: 'Open inventory',
            href: '/inventory?focus=reorder_soon',
            icon: PackageSearch,
            accent: '#f59e0b',
        },
    ];
    const actionable = attentionCards.filter(c => c.count > 0);
    const hour = now.getHours();
    const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const tableStatusColors = TABLE_STATUS_COLORS;

    return (
        <AppLayout>
            {/* ─── HERO — Right Now ──────────────────────────────────────── */}
            <section
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 24,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01)), rgba(10,13,18,0.85)',
                    padding: 32,
                    marginBottom: 24,
                    boxShadow: 'var(--shadow-lg)',
                }}
            >
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'radial-gradient(circle at 8% 0%, rgba(180,104,51,0.22), transparent 38%), radial-gradient(circle at 92% 100%, rgba(56,189,248,0.16), transparent 42%)',
                        pointerEvents: 'none',
                    }}
                />

                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 28 }}>
                    {/* Greeting line */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 12px',
                                borderRadius: 999,
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.04)',
                                color: 'var(--text-accent)',
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.18em',
                            }}
                        >
                            <Sparkles size={12} /> {serviceWindow(hour)}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{dateStr}</span>
                    </div>

                    {/* Big editorial headline */}
                    <h1
                        style={{
                            fontFamily: 'var(--font-display), serif',
                            fontWeight: 700,
                            fontSize: 'clamp(2.4rem, 4.4vw, 3.6rem)',
                            lineHeight: 1.02,
                            letterSpacing: '-0.04em',
                            color: 'var(--text-primary)',
                            margin: 0,
                            maxWidth: 24 + 'ch',
                        }}
                    >
                        {greetingFor(hour)}, {user?.name?.split(' ')[0] || 'there'}.{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>
                            {actionable.length > 0
                                ? `${actionable.length} thing${actionable.length === 1 ? '' : 's'} need${actionable.length === 1 ? 's' : ''} your attention.`
                                : `The floor is running smoothly.`}
                        </span>
                    </h1>

                    {/* Right Now bar — 3 big plain-English stats */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 16,
                        }}
                    >
                        <RightNowStat
                            label="Tables in service"
                            value={`${seatedTables}/${totalTables}`}
                            sub={totalTables > 0 ? `${seatedPct}% of dining room` : 'No tables set up yet'}
                            icon={<Users size={18} />}
                            accent="#f59e0b"
                        />
                        <RightNowStat
                            label="In the kitchen"
                            value={String((data?.orders?.pending || 0) + (data?.orders?.active || 0) - (data?.orders?.ready || 0))}
                            sub={`${data?.orders?.pending || 0} waiting · ${Math.max(0, (data?.orders?.active || 0) - (data?.orders?.ready || 0) - (data?.orders?.pending || 0))} cooking`}
                            icon={<ChefHat size={18} />}
                            accent="#38bdf8"
                        />
                        <RightNowStat
                            label="Ready to serve"
                            value={String(data?.orders?.ready || 0)}
                            sub={(data?.orders?.ready || 0) > 0 ? 'Sitting at the pass — go serve them' : 'Nothing waiting on the pass'}
                            icon={<BellRing size={18} />}
                            accent="#22c55e"
                            cta={(data?.orders?.ready || 0) > 0 ? { label: 'Serve now', onClick: () => router.push('/kitchen?focus=ready') } : undefined}
                        />
                    </div>
                </div>
            </section>

            {error && (
                <div
                    style={{
                        marginBottom: 20,
                        padding: '12px 16px',
                        borderRadius: 14,
                        border: '1px solid rgba(248,113,113,0.2)',
                        background: 'rgba(69,10,10,0.16)',
                        color: '#fecaca',
                        fontSize: 13,
                        fontWeight: 600,
                    }}
                >
                    {error}
                </div>
            )}

            {/* ─── Needs your attention ───────────────────────────────── */}
            {isOpsViewer && (
                <section style={{ marginBottom: 28 }}>
                    <SectionTitle
                        kicker="Needs your attention"
                        title={actionable.length > 0 ? 'Act on these now' : 'Everything is under control'}
                        subtitle={actionable.length > 0 ? 'Click a card to jump straight to where you can fix it.' : 'No urgent action items right now. We’ll surface them here as they come up.'}
                    />
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            gap: 14,
                        }}
                    >
                        {attentionCards.map((card) => {
                            const Icon = card.icon;
                            const isActive = card.count > 0;
                            return (
                                <button
                                    key={card.id}
                                    onClick={() => router.push(card.href)}
                                    style={{
                                        textAlign: 'left',
                                        padding: 20,
                                        borderRadius: 18,
                                        border: `1px solid ${isActive ? `${card.accent}55` : 'rgba(148,163,184,0.15)'}`,
                                        background: isActive
                                            ? `linear-gradient(180deg, ${card.accent}1a, rgba(15,23,42,0.86))`
                                            : 'rgba(15,23,42,0.62)',
                                        cursor: 'pointer',
                                        color: '#fff',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 14,
                                        minHeight: 160,
                                        transition: 'transform 0.18s ease, border-color 0.18s ease',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div
                                            style={{
                                                width: 42,
                                                height: 42,
                                                borderRadius: 14,
                                                background: isActive ? `${card.accent}22` : 'rgba(15,23,42,0.6)',
                                                border: `1px solid ${isActive ? card.accent : 'rgba(148,163,184,0.16)'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Icon size={18} style={{ color: isActive ? card.accent : '#94a3b8' }} />
                                        </div>
                                        <ArrowRight size={16} style={{ color: isActive ? card.accent : '#64748b' }} />
                                    </div>
                                    <div
                                        style={{
                                            fontFamily: 'var(--font-display), serif',
                                            fontSize: 44,
                                            fontWeight: 700,
                                            lineHeight: 1,
                                            letterSpacing: '-0.05em',
                                            color: isActive ? '#fff' : 'var(--text-secondary)',
                                        }}
                                    >
                                        {card.count}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                                            {card.title}
                                        </div>
                                        <div style={{ fontSize: 12, color: isActive ? card.accent : '#94a3b8', fontWeight: 700 }}>
                                            {card.cta} →
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ─── Today's pulse ─────────────────────────────────────── */}
            <section style={{ marginBottom: 28 }}>
                <SectionTitle
                    kicker="Today"
                    title="How are we doing?"
                    subtitle="At-a-glance picture of today's revenue, orders and the headline trend versus yesterday."
                />
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: 16,
                    }}
                >
                    <HeroStat
                        label="Revenue today"
                        value={formatCurrency(todayRevenue, settings.currencySymbol)}
                        delta={revenueDelta}
                        deltaSuffix="vs yesterday"
                        accent="#f59e0b"
                    />
                    <HeroStat
                        label="Orders today"
                        value={String(data?.orders?.today || 0)}
                        sub={`${data?.customers || 0} customers served`}
                        accent="#38bdf8"
                    />
                    <HeroStat
                        label="Average ticket"
                        value={formatCurrency(data?.revenue?.averageTicket || 0, settings.currencySymbol)}
                        sub="Per order, across all channels"
                        accent="#22c55e"
                    />
                </div>
            </section>

            {/* ─── This week ────────────────────────────────────────── */}
            <section style={{ marginBottom: 28 }}>
                <SectionTitle
                    kicker="This week"
                    title="Last 7 days of service"
                    subtitle="Revenue trend and what your guests are loving."
                />

                <div className="grid-2" style={{ gap: 16 }}>
                    <div className="card" style={{ padding: 24 }}>
                        <div style={{ marginBottom: 16 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Revenue · last 7 days</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Daily net sales after discounts</p>
                        </div>
                        <div style={{ height: 240 }}>
                            {last7.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={last7}>
                                        <XAxis
                                            dataKey="date"
                                            stroke="var(--text-muted)"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(v) => v.slice(5)}
                                        />
                                        <YAxis
                                            stroke="var(--text-muted)"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(v) => `${settings.currencySymbol} ${v}`}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                                            contentStyle={{
                                                background: 'var(--bg-card)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 12,
                                            }}
                                        />
                                        <Bar dataKey="netSales" fill="var(--brand-500)" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-state">No revenue data yet</div>
                            )}
                        </div>
                    </div>

                    <div className="card" style={{ padding: 24 }}>
                        <div style={{ marginBottom: 16 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Top sellers this week</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>What guests are ordering most</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {data?.topItems?.length ? (
                                data.topItems.slice(0, 6).map((item, i, arr) => (
                                    <div
                                        key={item.name}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px 0',
                                            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span
                                                style={{
                                                    fontFamily: 'var(--font-display), serif',
                                                    fontSize: 18,
                                                    fontWeight: 700,
                                                    color: 'var(--text-muted)',
                                                    minWidth: 24,
                                                }}
                                            >
                                                {String(i + 1).padStart(2, '0')}
                                            </span>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {item.name}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: 12, color: 'var(--text-accent)', fontWeight: 700 }}>
                                            {item.quantity} orders
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-muted" style={{ padding: '24px 0', textAlign: 'center' }}>
                                    No sales recorded yet this week.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Floor + Recent + Stock ──────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
                <SectionTitle
                    kicker="Floor & supply"
                    title="The room and the stockroom"
                    subtitle="Where guests are seated, what just happened, and what to restock."
                />

                <div className="grid-3 gap-4">
                    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Floor right now</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Live table status</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10, flex: 1, minHeight: 240 }}>
                            <FloorBlock
                                value={data?.tables?.available || 0}
                                label="Available"
                                color={tableStatusColors.available.solid}
                                bg={tableStatusColors.available.panel}
                            />
                            <FloorBlock
                                value={data?.tables?.occupied || 0}
                                label="Occupied"
                                color={tableStatusColors.occupied.solid}
                                bg={tableStatusColors.occupied.panel}
                            />
                            <FloorBlock
                                value={data?.tables?.reserved || 0}
                                label="Reserved"
                                color={tableStatusColors.reserved.solid}
                                bg={tableStatusColors.reserved.panel}
                            />
                            <FloorBlock
                                value={data?.tables?.cleaning || 0}
                                label="Cleaning"
                                color="#94a3b8"
                                bg="rgba(148,163,184,0.12)"
                            />
                        </div>
                    </div>

                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Recent orders</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Latest tickets across the floor</p>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {data?.recentOrders?.length ? (
                                data.recentOrders.slice(0, 5).map((order, i, arr) => (
                                    <div
                                        key={order.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '10px 0',
                                            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                                #{order.orderNumber}{' '}
                                                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                                                    · {order.table?.number ? `Table ${order.table.number}` : 'Takeaway'}
                                                    {order.table?.mergeGroupId && <LinkIcon size={10} style={{ display: 'inline-block', marginLeft: 4, color: '#3b82f6' }} />}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {' · '}
                                                <span className={`badge ${order.status}`} style={{ fontSize: 9, padding: '2px 6px' }}>{order.status}</span>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {formatCurrency(order.total, settings.currencySymbol)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-muted" style={{ padding: '16px 0', textAlign: 'center' }}>No orders yet today</div>
                            )}
                        </div>
                    </div>

                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Restock list</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Items below their minimum</p>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {data?.lowInventory?.length ? (
                                data.lowInventory.slice(0, 6).map((item, i, arr) => (
                                    <div
                                        key={item.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '10px 0',
                                            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                                        }}
                                    >
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>
                                            {item.currentStock} {item.unit} left
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
                                    Inventory looks healthy ✓
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </AppLayout>
    );
}

// ─── Local helpers ───────────────────────────────────────────────────────

function SectionTitle({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
    return (
        <div style={{ marginBottom: 18 }}>
            <span
                style={{
                    display: 'inline-block',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.22em',
                    color: 'var(--text-accent)',
                    marginBottom: 8,
                }}
            >
                {kicker}
            </span>
            <h2
                style={{
                    fontFamily: 'var(--font-display), serif',
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    color: 'var(--text-primary)',
                    marginBottom: subtitle ? 4 : 0,
                }}
            >
                {title}
            </h2>
            {subtitle && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 640 }}>{subtitle}</p>
            )}
        </div>
    );
}

function RightNowStat({
    label,
    value,
    sub,
    icon,
    accent,
    cta,
}: {
    label: string;
    value: string;
    sub: string;
    icon: React.ReactNode;
    accent: string;
    cta?: { label: string; onClick: () => void };
}) {
    return (
        <div
            style={{
                position: 'relative',
                padding: 20,
                borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 140,
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--text-muted)' }}>
                    {label}
                </span>
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: `${accent}1a`,
                        border: `1px solid ${accent}44`,
                        color: accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {icon}
                </div>
            </div>
            <div
                style={{
                    fontFamily: 'var(--font-display), serif',
                    fontSize: 40,
                    fontWeight: 700,
                    lineHeight: 1,
                    letterSpacing: '-0.05em',
                    color: 'var(--text-primary)',
                }}
            >
                {value}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{sub}</div>
            {cta && (
                <button
                    type="button"
                    onClick={cta.onClick}
                    style={{
                        marginTop: 4,
                        alignSelf: 'flex-start',
                        background: 'transparent',
                        border: 'none',
                        color: accent,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    {cta.label} <ArrowRight size={12} />
                </button>
            )}
        </div>
    );
}

function HeroStat({
    label,
    value,
    sub,
    delta,
    deltaSuffix,
    accent,
}: {
    label: string;
    value: string;
    sub?: string;
    delta?: number | null;
    deltaSuffix?: string;
    accent: string;
}) {
    const up = delta != null && delta >= 0;
    return (
        <div
            style={{
                padding: 24,
                borderRadius: 18,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
            }}
        >
            <span
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    color: 'var(--text-muted)',
                }}
            >
                {label}
            </span>
            <div
                style={{
                    fontFamily: 'var(--font-display), serif',
                    fontSize: 42,
                    fontWeight: 700,
                    lineHeight: 1,
                    letterSpacing: '-0.05em',
                    color: 'var(--text-primary)',
                }}
            >
                {value}
            </div>
            {delta != null ? (
                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: up ? '#22c55e' : '#f97316',
                    }}
                >
                    {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {up ? '+' : ''}{delta.toFixed(1)}% {deltaSuffix}
                </div>
            ) : sub ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{sub}</div>
            ) : null}
            <div
                aria-hidden
                style={{
                    height: 3,
                    width: 36,
                    borderRadius: 999,
                    background: accent,
                    marginTop: 4,
                }}
            />
        </div>
    );
}

function WaiterStat({
    icon,
    value,
    label,
    accent,
    onClick,
}: {
    icon: React.ReactNode;
    value: number;
    label: string;
    accent: string;
    onClick?: () => void;
}) {
    return (
        <div
            onClick={onClick}
            style={{
                padding: '20px 24px',
                borderRadius: 18,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                cursor: onClick ? 'pointer' : 'default',
                transition: 'transform 0.15s ease',
            }}
            onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)')}
            onMouseLeave={e => onClick && ((e.currentTarget as HTMLElement).style.transform = 'translateY(0)')}
        >
            <div
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: `${accent}1a`,
                    border: `1px solid ${accent}44`,
                    color: accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                {icon}
            </div>
            <div>
                <div
                    style={{
                        fontFamily: 'var(--font-display), serif',
                        fontSize: 32,
                        fontWeight: 700,
                        lineHeight: 1,
                        letterSpacing: '-0.04em',
                        color: 'var(--text-primary)',
                    }}
                >
                    {value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>{label}</div>
            </div>
        </div>
    );
}

function FloorBlock({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) {
    return (
        <div
            style={{
                padding: 14,
                borderRadius: 14,
                background: bg,
                textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.04)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
            }}
        >
            <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 36, fontWeight: 700, color, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {value}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {label}
            </div>
        </div>
    );
}
