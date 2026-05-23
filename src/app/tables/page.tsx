'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import OrderModal from '@/components/OrderModal';
import {
    GitMerge, UtensilsCrossed,
    CalendarDays, RefreshCw, ZoomIn, ZoomOut,
    Users, X, CheckCircle, ArrowRight, Link, Plus, Pencil, Trash2, LocateFixed, Clock3,
    BarChart3, DollarSign, ShoppingCart, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { getTableDisplayStatus, TABLE_STATUS_COLORS } from '@/lib/table-status';
import { isWaiterRole } from '@/lib/roleRoutes';

type AnalyticsRange = 'day' | 'week' | 'month';

type TableAnalytics = {
    revenue: number;
    ordersCount: number;
    avgTicket: number;
    lastOrderAt: string | null;
    dineInOrders: number;
    takeoutOrders: number;
    activeOrders: number;
    revenueDeltaPct: number;
};

const ANALYTICS_RANGE_LABELS: Record<AnalyticsRange, string> = {
    day: 'Day',
    week: 'Week',
    month: 'Month',
};

const EMPTY_ANALYTICS: TableAnalytics = {
    revenue: 0,
    ordersCount: 0,
    avgTicket: 0,
    lastOrderAt: null,
    dineInOrders: 0,
    takeoutOrders: 0,
    activeOrders: 0,
    revenueDeltaPct: 0,
};

/* ─── Table positions as % of canvas (matching Figma layout exactly) ──────── */
const TABLE_LAYOUT: Record<number, { x: number; y: number; shape: 'rect' | 'circle' }> = {
    1: { x: 3, y: 3, shape: 'rect' },  // Bo
    2: { x: 20, y: 1, shape: 'rect' },  // Kenema
    3: { x: 63, y: 1, shape: 'rect' },  // Waterloo
    4: { x: 3, y: 37, shape: 'rect' },  // Bonthe
    5: { x: 23, y: 41, shape: 'circle' },  // Freetown  (big circle)
    6: { x: 46, y: 16, shape: 'circle' },  // Makeni    (circle)
    7: { x: 61, y: 31, shape: 'rect' },  // Koidu
    8: { x: 78, y: 15, shape: 'rect' },  // Moyamba
    9: { x: 3, y: 68, shape: 'rect' },  // Lunsar
    10: { x: 21, y: 70, shape: 'circle' },  // Port Loko (circle)
    11: { x: 47, y: 60, shape: 'rect' },  // Kabala
    12: { x: 65, y: 63, shape: 'rect' },  // Mile 91
};

function getTableLayout(table: any) {
    if (typeof table.layoutX === 'number' && typeof table.layoutY === 'number') {
        return {
            x: table.layoutX,
            y: table.layoutY,
            shape: (table.shape === 'circle' ? 'circle' : 'rect') as 'rect' | 'circle',
        };
    }

    if (TABLE_LAYOUT[table.number]) return {
        ...TABLE_LAYOUT[table.number],
        shape: (table.shape === 'circle' ? 'circle' : TABLE_LAYOUT[table.number].shape) as 'rect' | 'circle',
    };

    const index = Math.max(0, table.number - Object.keys(TABLE_LAYOUT).length - 1);
    return {
        x: 4 + (index % 4) * 18,
        y: 78 + Math.floor(index / 4) * 16,
        shape: (table.shape === 'circle' ? 'circle' : 'rect') as 'rect' | 'circle',
    };
}

function formatShortMoney(amount: number, currencySymbol: string) {
    if (amount >= 1000) return `${currencySymbol}${(amount / 1000).toFixed(1)}k`;
    return formatCurrency(amount, currencySymbol);
}

function formatElapsedMinutes(startedAt?: string | null, endedAt?: string | null, status?: string | null, now = Date.now()) {
    if (!startedAt) return null;
    if (status === 'served' || status === 'completed' || status === 'cancelled') return null;
    const endTime = endedAt ? new Date(endedAt).getTime() : now;
    const minutes = Math.max(0, Math.floor((endTime - new Date(startedAt).getTime()) / 60000));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

/* ─── Status-based visual tokens ──────────────────────────────────────────── */
function getTokens(status: string, hasActiveOrders: boolean) {
    const displayStatus = getTableDisplayStatus({ status, activeOrderCount: hasActiveOrders ? 1 : 0 });

    if (displayStatus === 'occupied') {
        return { body: '#2a1215', border: TABLE_STATUS_COLORS.occupied.solid, seat: '#fca5a5', shadow: '0 0 18px rgba(239,68,68,0.22)' };
    }
    if (displayStatus === 'available') {
        return { body: '#12261d', border: TABLE_STATUS_COLORS.available.solid, seat: '#86efac', shadow: '0 0 18px rgba(16,185,129,0.2)' };
    }
    if (displayStatus === 'reserved') {
        return { body: '#1f2937', border: TABLE_STATUS_COLORS.reserved.solid, seat: '#cbd5e1', shadow: '0 0 18px rgba(148,163,184,0.18)' };
    }
    return { body: '#0f172a', border: '#64748b', seat: '#94a3b8', shadow: '0 0 18px rgba(100,116,139,0.18)' };
}

/* ─── Rectangular seat indicators ─────────────────────────────────────────── */
function RectSeats({ capacity, color }: { capacity: number; color: string }) {
    const perSide = Math.min(Math.ceil(capacity / 4), 3);
    const sides = ['top', 'bottom', 'left', 'right'] as const;
    return (
        <>
            {sides.map(side => {
                const isHoriz = side === 'top' || side === 'bottom';
                return Array.from({ length: perSide }).map((_, i) => {
                    const offset = `${20 + i * (60 / (perSide))}%`;
                    const style: React.CSSProperties = {
                        position: 'absolute',
                        background: color,
                        borderRadius: 4,
                        ...(isHoriz ? {
                            width: 18, height: 9,
                            left: offset,
                            [side]: -11,
                        } : {
                            width: 9, height: 18,
                            top: offset,
                            [side]: -11,
                        }),
                    };
                    return <div key={`${side}-${i}`} style={style} />;
                });
            })}
        </>
    );
}

/* ─── Circular seat indicators (radial dashes) ──────────────────────────────*/
function CircleSeats({ r, capacity, color }: { r: number; capacity: number; color: string }) {
    const count = Math.min(capacity * 2, 14);
    return (
        <>
            {Array.from({ length: count }).map((_, i) => {
                const angle = (i / count) * 360;
                const rad = (angle * Math.PI) / 180;
                const cx = r + Math.cos(rad) * (r + 5);
                const cy = r + Math.sin(rad) * (r + 5);
                return (
                    <div key={i} style={{
                        position: 'absolute',
                        width: 14, height: 8,
                        background: color,
                        borderRadius: 4,
                        left: cx - 7,
                        top: cy - 4,
                        transform: `rotate(${angle}deg)`,
                        transformOrigin: 'center',
                    }} />
                );
            })}
        </>
    );
}

/* ─── Single Table Pod ──────────────────────────────────────────────────────*/
type MergeHighlight = 'none' | 'source' | 'target' | 'dim';
type DragPreview = { x: number; y: number };
function TablePod({
    table,
    onClick,
    mergeHighlight = 'none',
    isAdmin = false,
    viewerRole = 'waiter',
    currencySymbol = '$',
    onEdit,
    onDelete,
    onDragStart,
    dragPreview,
    isDragging = false,
}: {
    table: any;
    onClick: () => void;
    mergeHighlight?: MergeHighlight;
    isAdmin?: boolean;
    viewerRole?: string;
    currencySymbol?: string;
    onEdit?: (table: any) => void;
    onDelete?: (table: any) => void;
    onDragStart?: (table: any, event: React.PointerEvent<HTMLButtonElement>) => void;
    dragPreview?: DragPreview;
    isDragging?: boolean;
}) {
    const baseLayout = getTableLayout(table);
    const layout = dragPreview || baseLayout;
    const hasActiveOrders = (table.orders?.length || 0) > 0;
    const tok = getTokens(table.status, hasActiveOrders);
    const total = table.orders?.reduce((s: number, o: any) => s + (o.total || 0), 0) || 0;
    const waiter = table.orders?.[0]?.user?.name;
    const startedOrder = table.orders?.find((order: any) => order.serviceStartedAt) || table.orders?.[0];
    const elapsedLabel = formatElapsedMinutes(startedOrder?.serviceStartedAt, startedOrder?.serviceEndedAt, startedOrder?.status);
    const analytics: TableAnalytics = table.analytics || EMPTY_ANALYTICS;
    const isManagerView = viewerRole === 'manager';
    const layoutShape = dragPreview ? (table.shape === 'circle' ? 'circle' : 'rect') : baseLayout.shape;

    const isBig = table.number === 5; // "Freetown" equivalent — largest circle
    const isCircle = layoutShape === 'circle';
    const r = isBig ? 68 : isCircle ? 52 : 0;
    const W = isCircle ? r * 2 : table.capacity >= 6 ? 148 : 130;
    const H = isCircle ? r * 2 : 100;

    // Merge highlight overrides
    const mergeBorder = mergeHighlight === 'source' ? '#f59e0b' : mergeHighlight === 'target' ? '#3b82f6' : tok.border;
    const mergeShadow = mergeHighlight === 'source' ? '0 0 0 3px #f59e0b, 0 0 24px rgba(245,158,11,0.5)'
        : mergeHighlight === 'target' ? '0 0 0 3px #3b82f6, 0 0 24px rgba(59,130,246,0.5)'
            : tok.shadow;
    const mergeOpacity = mergeHighlight === 'dim' ? 0.35 : 1;

    return (
        <div style={{
            position: 'absolute',
            left: `${layout.x}%`,
            top: `${layout.y}%`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: isDragging ? 'grabbing' : 'pointer',
            userSelect: 'none',
            opacity: mergeOpacity,
            transition: isDragging ? 'none' : 'opacity 0.2s',
            pointerEvents: 'auto',
            zIndex: isDragging ? 18 : 1,
        }}
            onClick={onClick}
        >
            {/* Table body */}
            <div style={{
                position: 'relative',
                width: W,
                height: H,
                background: tok.body,
                border: `2px solid ${mergeBorder}`,
                borderRadius: isCircle ? '50%' : 14,
                boxShadow: mergeShadow,
                outline: isDragging ? '2px solid rgba(56,189,248,0.92)' : 'none',
                outlineOffset: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.18s, box-shadow 0.18s',
                padding: 8,
            }}
                className="table-pod-body"
            >
                {isAdmin && (
                    <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6, zIndex: 3 }}>
                        <button
                            onPointerDown={(event) => {
                                event.stopPropagation();
                                event.preventDefault();
                                onDragStart?.(table, event);
                            }}
                            style={{ background: isDragging ? 'rgba(14,165,233,0.24)' : 'rgba(2,132,199,0.16)', border: '1px solid rgba(56,189,248,0.28)', color: '#7dd3fc', borderRadius: 8, padding: 6, display: 'flex', cursor: isDragging ? 'grabbing' : 'grab' }}
                            title="Drag to reposition table"
                        >
                            <LocateFixed size={12} />
                        </button>
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                onEdit?.(table);
                            }}
                            style={{ background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(148,163,184,0.25)', color: '#e2e8f0', borderRadius: 8, padding: 6, display: 'flex', cursor: 'pointer' }}
                            title="Edit table"
                        >
                            <Pencil size={12} />
                        </button>
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                onDelete?.(table);
                            }}
                            style={{ background: 'rgba(69,10,10,0.92)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5', borderRadius: 8, padding: 6, display: 'flex', cursor: 'pointer' }}
                            title="Delete table"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}

                {/* Seat indicators */}
                {isCircle
                    ? <CircleSeats r={r} capacity={table.capacity} color={tok.seat} />
                    : <RectSeats capacity={table.capacity} color={tok.seat} />
                }

                {/* Name — section only (number shown in badge below, matching Figma) */}
                <div style={{ fontWeight: 800, fontSize: isBig ? 22 : 16, color: '#f1f5f9', textAlign: 'center', lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                    {table.section || `Table ${table.number}`}
                    {table.mergeGroupId && <Link size={14} style={{ color: '#2563eb' }} />}
                </div>

                {isManagerView ? (
                    <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#f8fafc' }}>
                            {analytics.ordersCount > 0 ? `${analytics.ordersCount} orders` : 'No sales'}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                            {analytics.revenue > 0 ? formatShortMoney(analytics.revenue, currencySymbol) : 'No revenue'}
                        </div>
                    </div>
                ) : total > 0 && (
                    <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            ${total.toFixed(0)}
                        </div>
                        {elapsedLabel && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f8fafc', background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 999, padding: '3px 8px' }}>
                                <Clock3 size={12} />
                                {elapsedLabel}
                            </div>
                        )}
                    </div>
                )}

                {/* Available label */}
                {!hasActiveOrders && (
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Empty
                    </div>
                )}
            </div>

            {/* Waiter name below table */}
            {!isManagerView && waiter && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, maxWidth: W, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {waiter.split(' ')[0][0]}. {waiter.split(' ').slice(-1)[0]}
                </div>
            )}

            {/* Table number badge */}
            <div style={{
                width: 22, height: 22,
                borderRadius: '50%',
                background: '#f59e0b',
                color: '#000',
                fontSize: 10,
                fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: !isManagerView && waiter ? 2 : 6,
            }}>
                {table.number}
            </div>

            <style>{`
                .table-pod-body:hover {
                    transform: scale(1.06);
                    box-shadow: 0 0 28px rgba(255,255,255,0.12) !important;
                }
            `}</style>
        </div>
    );
}

/* ─── Page ──────────────────────────────────────────────────────────────────*/
export default function TablesPage() {
    const { user } = useAuth();
    const { settings } = useSettings();
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const pageScrollRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const panStateRef = useRef<{ pointerId: number | null; startX: number; startY: number; scrollLeft: number; scrollTop: number; moved: boolean; axis: 'x' | 'y' | null; } | null>(null);
    const dragStateRef = useRef<{
        tableId: string;
        pointerId: number;
        offsetX: number;
        offsetY: number;
        label: string;
        moved: boolean;
    } | null>(null);
    const layoutPreviewRef = useRef<Record<string, DragPreview>>({});
    const suppressTapRef = useRef(false);
    const hasLoadedTablesRef = useRef(false);
    const [tables, setTables] = useState<any[]>([]);
    const [tableAnalyticsRange, setTableAnalyticsRange] = useState<AnalyticsRange>('week');
    const [analyticsMeta, setAnalyticsMeta] = useState<{
        label: string;
        summary: {
            totalRevenue: number;
            totalOrders: number;
            avgTicket: number;
            occupiedTables: number;
            tablesWithSales: number;
        };
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedTable, setSelectedTable] = useState<any>(null);
    const [zoom, setZoom] = useState(100);
    const [isCompactViewport, setIsCompactViewport] = useState(false);
    const [dragPreviewById, setDragPreviewById] = useState<Record<string, DragPreview>>({});
    const [activeDragTableId, setActiveDragTableId] = useState<string | null>(null);
    const [activeDragLabel, setActiveDragLabel] = useState('');
    const [savingDragTableId, setSavingDragTableId] = useState<string | null>(null);
    const [, setClockNow] = useState(() => Date.now());
    const toast = useToast();
    const [isTableModalOpen, setIsTableModalOpen] = useState(false);
    const [tableModalMode, setTableModalMode] = useState<'add' | 'edit'>('add');
    const [editingTable, setEditingTable] = useState<any>(null);
    const [savingTable, setSavingTable] = useState(false);
    const [tableForm, setTableForm] = useState({ number: '', section: '', capacity: '4', status: 'available', shape: 'rect' });

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // ── Merge state ────────────────────────────────────────────────────────
    type MergeStep = 'idle' | 'selectSource' | 'selectTarget' | 'confirm';
    const [mergeStep, setMergeStep] = useState<MergeStep>('idle');
    const [mergeSource, setMergeSource] = useState<any>(null);
    const [mergeTarget, setMergeTarget] = useState<any>(null);
    const [merging, setMerging] = useState(false);

    const startMerge = () => { setMergeStep('selectSource'); setMergeSource(null); setMergeTarget(null); };
    const cancelMerge = () => { setMergeStep('idle'); setMergeSource(null); setMergeTarget(null); };

    const fetchTables = useCallback(() => {
        const isManagerView = user?.role === 'manager';

        const request = isManagerView
            ? Promise.all([
                fetch('/api/tables').then(res => res.json()),
                fetch(`/api/tables/analytics?range=${tableAnalyticsRange}`).then(res => res.json()),
            ]).then(([tableData, analyticsData]) => {
                const byTable = analyticsData?.byTable || {};
                const mergedTables = Array.isArray(tableData)
                    ? tableData.map((table: any) => ({
                        ...table,
                        analytics: byTable[table.id] || EMPTY_ANALYTICS,
                    }))
                    : [];

                setTables(mergedTables);
                setSelectedTable((prev: any) => prev ? mergedTables.find((table: any) => table.id === prev.id) || null : prev);
                setAnalyticsMeta({
                    label: analyticsData?.label || ANALYTICS_RANGE_LABELS[tableAnalyticsRange],
                    summary: analyticsData?.summary || {
                        totalRevenue: 0,
                        totalOrders: 0,
                        avgTicket: 0,
                        occupiedTables: 0,
                        tablesWithSales: 0,
                    },
                });
            })
            : fetch('/api/tables')
                .then(res => res.json())
                .then(data => {
                    setTables(Array.isArray(data) ? data : []);
                    setSelectedTable((prev: any) => prev && Array.isArray(data) ? data.find((table: any) => table.id === prev.id) || null : prev);
                    setAnalyticsMeta(null);
                });

        return request.finally(() => {
            setLoading(false);
            setRefreshing(false);
        });
    }, [tableAnalyticsRange, user?.role]);

    useEffect(() => {
        if (hasLoadedTablesRef.current) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        void fetchTables();
        const i = setInterval(fetchTables, 30000);
        return () => clearInterval(i);
    }, [fetchTables]);

    useEffect(() => {
        if (!loading) {
            hasLoadedTablesRef.current = true;
        }
    }, [loading]);

    useEffect(() => {
        const interval = setInterval(() => setClockNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const updateViewport = () => {
            setIsCompactViewport(window.innerWidth <= 1024);
        };

        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    const syncDragPreview = useCallback((tableId: string, preview: DragPreview | null) => {
        layoutPreviewRef.current = preview
            ? { ...layoutPreviewRef.current, [tableId]: preview }
            : Object.fromEntries(Object.entries(layoutPreviewRef.current).filter(([id]) => id !== tableId));

        setDragPreviewById(layoutPreviewRef.current);
    }, []);

    const readResponsePayload = useCallback(async (response: Response) => {
        const raw = await response.text();
        if (!raw) return null;

        try {
            return JSON.parse(raw);
        } catch {
            return { error: raw };
        }
    }, []);

    const persistTablePosition = useCallback(async (tableId: string, preview: DragPreview, label: string) => {
        setSavingDragTableId(tableId);

        try {
            const res = await fetch(`/api/tables/${tableId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layoutX: Number(preview.x.toFixed(2)), layoutY: Number(preview.y.toFixed(2)) }),
            });
            const data = await readResponsePayload(res);

            if (!res.ok) {
                throw new Error(data?.error || 'Unable to save table position');
            }

            toast('success', `${label} repositioned`);
            await fetchTables();
        } catch (error: any) {
            toast('error', error.message || 'Unable to save table position');
        } finally {
            syncDragPreview(tableId, null);
            setSavingDragTableId(null);
        }
    }, [fetchTables, readResponsePayload, syncDragPreview, toast]);

    const startTableDrag = useCallback((table: any, event: React.PointerEvent<HTMLButtonElement>) => {
        if (!canvasRef.current || mergeStep !== 'idle' || user?.role !== 'admin') return;

        const rect = canvasRef.current.getBoundingClientRect();
        const layout = getTableLayout(table);
        const startLeft = rect.left + (layout.x / 100) * rect.width;
        const startTop = rect.top + (layout.y / 100) * rect.height;

        dragStateRef.current = {
            tableId: table.id,
            pointerId: event.pointerId,
            offsetX: event.clientX - startLeft,
            offsetY: event.clientY - startTop,
            label: table.section || `Table ${table.number}`,
            moved: false,
        };

        syncDragPreview(table.id, { x: layout.x, y: layout.y });
        setActiveDragTableId(table.id);
        setActiveDragLabel(table.section || `Table ${table.number}`);
        suppressTapRef.current = true;
    }, [mergeStep, syncDragPreview, user?.role]);

    const openAddTableModal = () => {
        setTableModalMode('add');
        setEditingTable(null);
        setTableForm({ number: '', section: '', capacity: '4', status: 'available', shape: 'rect' });
        setIsTableModalOpen(true);
    };

    const openEditTableModal = (table: any) => {
        setTableModalMode('edit');
        setEditingTable(table);
        setTableForm({
            number: String(table.number),
            section: table.section || '',
            capacity: String(table.capacity || 4),
            status: table.status || 'available',
            shape: table.shape || 'rect',
        });
        setIsTableModalOpen(true);
    };

    const submitTableForm = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingTable(true);

        const payload = {
            number: Number(tableForm.number),
            section: tableForm.section.trim(),
            capacity: Number(tableForm.capacity),
            status: tableForm.status,
            shape: tableForm.shape,
        };

        try {
            const res = await fetch(tableModalMode === 'add' ? '/api/tables' : `/api/tables/${editingTable.id}`, {
                method: tableModalMode === 'add' ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Unable to ${tableModalMode} table`);

            toast('success', tableModalMode === 'add' ? 'Table created' : 'Table updated');
            setIsTableModalOpen(false);
            await fetchTables();
        } catch (error: any) {
            toast('error', error.message || 'Unable to save table');
        } finally {
            setSavingTable(false);
        }
    };

    const deleteTable = async (table: any) => {
        if (!window.confirm(`Delete ${table.section || `Table ${table.number}`}?`)) return;

        try {
            const res = await fetch(`/api/tables/${table.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Unable to delete table');

            toast('success', 'Table deleted');
            await fetchTables();
        } catch (error: any) {
            toast('error', error.message || 'Unable to delete table');
        }
    };

    useEffect(() => {
        const clamp = (value: number) => Math.min(100, Math.max(0, value));

        const handlePointerMove = (event: PointerEvent) => {
            const dragState = dragStateRef.current;
            if (!dragState || event.pointerId !== dragState.pointerId || !canvasRef.current) return;

            const rect = canvasRef.current.getBoundingClientRect();
            const nextX = clamp(((event.clientX - rect.left - dragState.offsetX) / rect.width) * 100);
            const nextY = clamp(((event.clientY - rect.top - dragState.offsetY) / rect.height) * 100);

            dragState.moved = true;
            syncDragPreview(dragState.tableId, { x: nextX, y: nextY });
        };

        const clearSuppressedTap = () => {
            window.setTimeout(() => {
                suppressTapRef.current = false;
            }, 120);
        };

        const handlePointerEnd = async (event: PointerEvent) => {
            const dragState = dragStateRef.current;
            if (!dragState || event.pointerId !== dragState.pointerId) return;

            dragStateRef.current = null;
            setActiveDragTableId(null);
            setActiveDragLabel('');

            const preview = layoutPreviewRef.current[dragState.tableId];

            if (!dragState.moved || !preview) {
                syncDragPreview(dragState.tableId, null);
                clearSuppressedTap();
                return;
            }

            await persistTablePosition(dragState.tableId, preview, dragState.label);
            clearSuppressedTap();
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerEnd);
        window.addEventListener('pointercancel', handlePointerEnd);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerEnd);
            window.removeEventListener('pointercancel', handlePointerEnd);
        };
    }, [persistTablePosition, syncDragPreview]);

    const isWaiterWorkspace = isWaiterRole(user?.role) && isCompactViewport;

    const getActiveScrollContainer = () => {
        if (isWaiterWorkspace && pageScrollRef.current) return pageScrollRef.current;
        return scrollRef.current;
    };

    const isInteractiveTarget = (target: HTMLElement | null) => (
        !!target?.closest('button, a, input, select, textarea, label, [role="button"]')
    );

    const startCanvasPan = (event: React.PointerEvent<HTMLDivElement>) => {
        const activeScrollContainer = getActiveScrollContainer();
        if (dragStateRef.current) return;
        if (!isCompactViewport || !activeScrollContainer) return;
        const target = event.target as HTMLElement;
        if (isInteractiveTarget(target)) return;

        panStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            scrollLeft: activeScrollContainer.scrollLeft,
            scrollTop: activeScrollContainer.scrollTop,
            moved: false,
            axis: null,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const moveCanvasPan = (event: React.PointerEvent<HTMLDivElement>) => {
        const activeScrollContainer = getActiveScrollContainer();
        if (dragStateRef.current) return;
        if (!activeScrollContainer) return;
        if (!panStateRef.current || panStateRef.current.pointerId !== event.pointerId) return;

        const deltaX = event.clientX - panStateRef.current.startX;
        const deltaY = event.clientY - panStateRef.current.startY;

        if (!panStateRef.current.axis && Math.abs(deltaX) + Math.abs(deltaY) > 8) {
            panStateRef.current.axis = Math.abs(deltaX) >= Math.abs(deltaY) ? 'x' : 'y';
        }

        if (panStateRef.current.axis !== 'x') return;

        if (!panStateRef.current.moved && Math.abs(deltaX) + Math.abs(deltaY) > 8) {
            panStateRef.current.moved = true;
            suppressTapRef.current = true;
        }

        if (!panStateRef.current.moved) return;

        activeScrollContainer.scrollLeft = panStateRef.current.scrollLeft - deltaX;
        activeScrollContainer.scrollTop = panStateRef.current.scrollTop - deltaY;
        event.preventDefault();
    };

    const endCanvasPan = (event: React.PointerEvent<HTMLDivElement>) => {
        if (dragStateRef.current) return;
        if (!panStateRef.current || panStateRef.current.pointerId !== event.pointerId) return;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        panStateRef.current = null;

        if (suppressTapRef.current) {
            window.setTimeout(() => {
                suppressTapRef.current = false;
            }, 120);
        }
    };

    // Canvas click handler — routes to merge selection or order modal
    const handleTableClick = (table: any) => {
        if (suppressTapRef.current) return;
        if (user?.role === 'manager') {
            setSelectedTable(table);
            return;
        }
        if (mergeStep === 'idle' && !isWaiterRole(user?.role)) {
            toast('info', 'Only waiters can take or edit orders.');
            return;
        }
        if (mergeStep === 'selectSource') {
            if (getTableDisplayStatus({ status: table.status, activeOrderCount: table.orders?.length || 0 }) !== 'available') {
                toast('error', `${table.section} is not available — only free tables can be merged`);
                return;
            }
            setMergeSource(table);
            setMergeStep('selectTarget');
            return;
        }
        if (mergeStep === 'selectTarget') {
            if (table.id === mergeSource?.id) {
                toast('error', 'Select a different table');
                return;
            }
            if (getTableDisplayStatus({ status: table.status, activeOrderCount: table.orders?.length || 0 }) !== 'available') {
                toast('error', `${table.section} is not available — only free tables can be merged`);
                return;
            }
            setMergeTarget(table);
            setMergeStep('confirm');
            return;
        }
        // Normal mode — open order modal
        setSelectedTable(table);
    };

    const executeMerge = async () => {
        if (!mergeSource || !mergeTarget) return;
        setMerging(true);
        try {
            const res = await fetch('/api/tables/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // mergeSource = first table selected (secondary), mergeTarget = second table selected (primary)
                body: JSON.stringify({ primaryTableId: mergeTarget.id, secondaryTableId: mergeSource.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Merge failed');
            toast('success', data.message);
            // Refresh tables, then open the order modal on the primary table so staff can take the group order
            await fetchTables();
            if (data.primaryTable) {
                setSelectedTable({ ...data.primaryTable, _mergedCapacity: data.combinedCapacity });
            }
            cancelMerge();
        } catch (err: any) {
            toast('error', err.message);
        } finally {
            setMerging(false);
        }
    };

    const counts = {
        available: tables.filter((t) => getTableDisplayStatus({ status: t.status, activeOrderCount: t.orders?.length || 0 }) === 'available').length,
        occupied: tables.filter((t) => getTableDisplayStatus({ status: t.status, activeOrderCount: t.orders?.length || 0 }) === 'occupied').length,
        reserved: tables.filter((t) => getTableDisplayStatus({ status: t.status, activeOrderCount: t.orders?.length || 0 }) === 'reserved').length,
        activeOrders: tables.filter(t => t.orders?.length > 0).length,
        emptyTables: tables.filter(t => !t.orders?.length).length,
    };
    const totalRevenu = tables.reduce((s, t) => s + (t.orders?.reduce((a: number, o: any) => a + (o.total || 0), 0) || 0), 0);
    const selectedTableAnalytics: TableAnalytics = selectedTable?.analytics || EMPTY_ANALYTICS;
    const managerSummaryCards = analyticsMeta ? [
        {
            label: `${analyticsMeta.label} Revenue`,
            value: formatCurrency(analyticsMeta.summary.totalRevenue || 0, settings.currencySymbol),
            tone: '#38bdf8',
            icon: DollarSign,
        },
        {
            label: `${analyticsMeta.label} Orders`,
            value: String(analyticsMeta.summary.totalOrders || 0),
            tone: '#f59e0b',
            icon: ShoppingCart,
        },
        {
            label: 'Average Ticket',
            value: formatCurrency(analyticsMeta.summary.avgTicket || 0, settings.currencySymbol),
            tone: '#22c55e',
            icon: BarChart3,
        },
        {
            label: 'Tables With Sales',
            value: String(analyticsMeta.summary.tablesWithSales || 0),
            tone: '#a78bfa',
            icon: Users,
        },
    ] : [];

    if (loading && tables.length === 0) return <AppLayout><div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><div className="loading-spinner" /></div></AppLayout>;

    return (
        <AppLayout>
            <div
                className={`floor-page ${isWaiterRole(user?.role) ? 'floor-page--waiter' : ''}`}
                onPointerDown={startCanvasPan}
                onPointerMove={moveCanvasPan}
                onPointerUp={endCanvasPan}
                onPointerCancel={endCanvasPan}
            >
            <div ref={pageScrollRef} className="floor-page-scroll">
            <div className="floor-page-content">
            {/* Header row */}
            <div className="floor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UtensilsCrossed size={17} style={{ color: 'var(--brand-500)' }} />
                    <span style={{ fontWeight: 700, fontSize: 15 }}>Floor Management</span>
                    {refreshing && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '5px 10px',
                            borderRadius: 999,
                            background: 'rgba(37,99,235,0.16)',
                            color: '#bfdbfe',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.4,
                            textTransform: 'uppercase',
                        }}>
                            Refreshing
                        </span>
                    )}
                </div>
                <div className="floor-header-metrics" style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--text-secondary)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span><b style={{ color: '#fff' }}>{counts.available}</b> Available</span>
                    <span><b style={{ color: '#fff' }}>{counts.activeOrders}</b> Active Orders</span>
                    <span><b style={{ color: '#fff' }}>{counts.emptyTables}</b> Empty Tables</span>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>{formatCurrency(totalRevenu, settings.currencySymbol)} Revenue</span>
                    {user?.role === 'admin' && (
                        <button
                            onClick={openAddTableModal}
                            style={{
                                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                border: '1px solid rgba(96,165,250,0.45)',
                                borderRadius: 999,
                                padding: '9px 14px',
                                color: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                fontWeight: 700,
                                boxShadow: '0 10px 24px rgba(37,99,235,0.22)',
                            }}
                        >
                            <Plus size={14} />
                            Create Table
                        </button>
                    )}
                </div>
            </div>

            {/* Main layout */}
            <div className="floor-layout" style={{ display: 'flex', gap: 14, height: 'calc(100vh - 200px)', minHeight: 500 }}>

                {/* ── Floor Plan Canvas ─────────────────────────────────────── */}
                <div className="floor-canvas-shell">
                <div
                    ref={scrollRef}
                    className="floor-canvas-scroll"
                >
                <div className="floor-canvas" style={{
                    flex: 1,
                    background: '#101520',
                    borderRadius: 16,
                    border: '1px solid #1e2433',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {(activeDragTableId || savingDragTableId) && (
                        <div style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            zIndex: 20,
                            background: savingDragTableId ? '#1d4ed8' : '#2563eb',
                            color: '#fff',
                            borderRadius: 12,
                            padding: '8px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}>
                            {savingDragTableId ? 'Saving table position…' : `Dragging ${activeDragLabel}`}
                            {activeDragTableId && (
                            <button onClick={() => {
                                dragStateRef.current = null;
                                syncDragPreview(activeDragTableId, null);
                                setActiveDragTableId(null);
                                setActiveDragLabel('');
                                window.setTimeout(() => {
                                    suppressTapRef.current = false;
                                }, 120);
                            }} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={12} />
                            </button>
                            )}
                        </div>
                    )}

                    {/* Dot grid */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: 'radial-gradient(circle, #1e2740 1px, transparent 1px)',
                        backgroundSize: '36px 36px',
                        pointerEvents: 'none',
                    }} />

                    {/* Merge mode banner */}
                    {mergeStep !== 'idle' && (
                        <div style={{
                            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                            zIndex: 20, background: mergeStep === 'selectSource' ? '#d97706' : '#2563eb',
                            color: '#fff', borderRadius: 24, padding: '8px 20px',
                            fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                        }}>
                            <GitMerge size={15} />
                            {mergeStep === 'selectSource' && 'Select the 1st table for this group'}
                            {mergeStep === 'selectTarget' && `1st table: ${mergeSource?.section} → Now select the 2nd table`}
                            {mergeStep === 'confirm' && 'Confirm merge below ↓'}
                            <button onClick={cancelMerge} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 4 }}>
                                <X size={12} />
                            </button>
                        </div>
                    )}

                    {/* Canvas content */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        transform: `scale(${zoom / 100})`,
                        transformOrigin: 'top left',
                        transition: 'transform 0.2s',
                        cursor: activeDragTableId ? 'grabbing' : mergeStep !== 'idle' ? 'crosshair' : 'default',
                    }}>
                        <div
                            ref={canvasRef}
                            style={{ position: 'absolute', inset: 0 }}
                        >
                            {tables.map((table) => {
                            const isSource = mergeSource?.id === table.id;
                            const isTarget = mergeTarget?.id === table.id;
                            return (
                                <TablePod
                                    key={table.id}
                                    table={table}
                                    onClick={() => handleTableClick(table)}
                                    viewerRole={user?.role}
                                    currencySymbol={settings.currencySymbol}
                                    isAdmin={user?.role === 'admin'}
                                    onDragStart={startTableDrag}
                                    dragPreview={dragPreviewById[table.id]}
                                    isDragging={activeDragTableId === table.id}
                                    onEdit={openEditTableModal}
                                    onDelete={deleteTable}
                                    mergeHighlight={
                                        isSource ? 'source'
                                            : isTarget ? 'target'
                                                : mergeStep !== 'idle' && table.status !== 'available' ? 'dim'
                                                    : mergeStep !== 'idle' ? 'none'  // available tables stay normal so they look selectable
                                                        : 'none'
                                    }
                                />
                            );
                            })}
                        </div>
                    </div>

                    {/* Zoom + refresh */}
                    <div style={{
                        position: 'absolute', bottom: 14, left: 14,
                        display: 'flex', gap: 6, alignItems: 'center',
                        background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '5px 12px',
                    }}>
                        <button onClick={() => setZoom(z => Math.max(50, z - 10))} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex' }}><ZoomOut size={14} /></button>
                        <span style={{ fontSize: 11, color: '#6b7280', minWidth: 34, textAlign: 'center' }}>{zoom}%</span>
                        <button onClick={() => setZoom(z => Math.min(160, z + 10))} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex' }}><ZoomIn size={14} /></button>
                        <div style={{ width: 1, height: 14, background: '#2e3548', margin: '0 4px' }} />
                        <button onClick={fetchTables} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex' }}><RefreshCw size={13} /></button>
                    </div>
                </div>
                </div>
                </div>

                {/* ── Right Sidebar ─────────────────────────────────────────── */}
                <div className="floor-sidebar" style={{ width: sidebarCollapsed ? 36 : 232, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, transition: 'width 0.2s ease', overflow: 'hidden', position: 'relative' }}>

                    {/* Collapse toggle */}
                    <button
                        onClick={() => setSidebarCollapsed(c => !c)}
                        title={sidebarCollapsed ? 'Expand panel' : 'Collapse panel'}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: sidebarCollapsed ? '50%' : 0,
                            transform: sidebarCollapsed ? 'translateX(-50%)' : 'none',
                            zIndex: 10,
                            background: 'rgba(15,23,42,0.9)',
                            border: '1px solid rgba(148,163,184,0.2)',
                            borderRadius: 8,
                            width: 28,
                            height: 28,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            flexShrink: 0,
                            transition: 'left 0.2s ease',
                        }}
                    >
                        {sidebarCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {/* Sidebar content — hidden when collapsed */}
                    <div style={{ display: sidebarCollapsed ? 'none' : 'flex', flexDirection: 'column', gap: 12, paddingTop: 36 }}>

                    {user?.role === 'manager' ? (
                        <>
                            <div style={{ background: 'linear-gradient(160deg, rgba(15,23,42,0.96), rgba(17,24,39,0.9))', borderRadius: 18, border: '1px solid rgba(148,163,184,0.14)', padding: 16, boxShadow: '0 18px 32px rgba(15,23,42,0.24)' }}>
                                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.3, color: '#94a3b8', marginBottom: 10 }}>Table Intelligence</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
                                    {(['day', 'week', 'month'] as AnalyticsRange[]).map((range) => (
                                        <button
                                            key={range}
                                            type="button"
                                            onClick={() => setTableAnalyticsRange(range)}
                                            style={{
                                                borderRadius: 999,
                                                border: `1px solid ${tableAnalyticsRange === range ? 'rgba(56,189,248,0.42)' : 'rgba(71,85,105,0.5)'}`,
                                                background: tableAnalyticsRange === range ? 'rgba(56,189,248,0.14)' : 'rgba(15,23,42,0.72)',
                                                color: tableAnalyticsRange === range ? '#e0f2fe' : '#94a3b8',
                                                padding: '10px 0',
                                                fontSize: 12,
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {ANALYTICS_RANGE_LABELS[range]}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ display: 'grid', gap: 10 }}>
                                    {managerSummaryCards.map((card) => {
                                        const Icon = card.icon;
                                        return (
                                            <div key={card.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, background: 'rgba(15,23,42,0.66)', border: '1px solid rgba(71,85,105,0.32)' }}>
                                                <div style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${card.tone}22`, color: card.tone }}>
                                                    <Icon size={16} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>{card.label}</div>
                                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>{card.value}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: 14 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-muted)', marginBottom: 10 }}>
                                    {selectedTable ? `${selectedTable.section || `Table ${selectedTable.number}`} Snapshot` : 'Table Snapshot'}
                                </div>
                                {selectedTable ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 10 }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Revenue</div>
                                                <div style={{ fontWeight: 800, color: '#fff', marginTop: 4 }}>{formatCurrency(selectedTableAnalytics.revenue, settings.currencySymbol)}</div>
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 10 }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Orders</div>
                                                <div style={{ fontWeight: 800, color: '#fff', marginTop: 4 }}>{selectedTableAnalytics.ordersCount}</div>
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 10 }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Average Ticket</div>
                                                <div style={{ fontWeight: 800, color: '#fff', marginTop: 4 }}>{formatCurrency(selectedTableAnalytics.avgTicket, settings.currencySymbol)}</div>
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 10 }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Live Orders</div>
                                                <div style={{ fontWeight: 800, color: '#fff', marginTop: 4 }}>{selectedTableAnalytics.activeOrders}</div>
                                            </div>
                                        </div>
                                        <div className="text-sm text-muted">
                                            Revenue change vs previous {tableAnalyticsRange}: <span style={{ color: selectedTableAnalytics.revenueDeltaPct >= 0 ? '#22c55e' : '#f97316', fontWeight: 700 }}>{selectedTableAnalytics.revenueDeltaPct >= 0 ? '+' : ''}{selectedTableAnalytics.revenueDeltaPct}%</span>
                                        </div>
                                        <div className="text-sm text-muted">
                                            Service mix: {selectedTableAnalytics.dineInOrders} dine-in, {selectedTableAnalytics.takeoutOrders} takeaway or delivery.
                                        </div>
                                        <div className="text-sm text-muted">
                                            Last sale: {selectedTableAnalytics.lastOrderAt ? new Date(selectedTableAnalytics.lastOrderAt).toLocaleString() : 'No completed sales in this range.'}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted">Select any table on the floor to inspect its revenue and order performance for the selected period.</div>
                                )}
                            </div>

                            <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: 14 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-muted)', marginBottom: 10 }}>Reservations</div>
                                <button
                                    type="button"
                                    onClick={() => toast('info', 'Reservations analytics is coming soon')}
                                    style={{ width: '100%', background: 'var(--surface-active)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                                >
                                    <CalendarDays size={16} /> Coming Soon
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: 14 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-muted)', marginBottom: 10 }}>Quick Action</div>

                                {mergeStep === 'idle' ? (
                                    <button
                                        onClick={startMerge}
                                        style={{ width: '100%', background: 'var(--surface-active)', border: '1px solid #d97706', borderRadius: 10, padding: '14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: '#d97706', fontSize: 13, fontWeight: 700 }}
                                    >
                                        <GitMerge size={18} /> Merge Table
                                    </button>
                                ) : mergeStep === 'confirm' ? (
                                    <div style={{ background: '#0f1e35', border: '1px solid #2563eb', borderRadius: 10, padding: 14 }}>
                                        <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 700, marginBottom: 10 }}>Confirm Merge</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13 }}>
                                            <span style={{ background: '#d97706', color: '#000', borderRadius: 8, padding: '4px 10px', fontWeight: 800 }}>{mergeSource?.section}</span>
                                            <ArrowRight size={14} style={{ color: '#6b7280' }} />
                                            <span style={{ background: '#2563eb', color: '#fff', borderRadius: 8, padding: '4px 10px', fontWeight: 800 }}>{mergeTarget?.section}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
                                            Both tables will be combined into one seating for a large group.
                                            <br /><strong style={{ color: '#d97706' }}>{mergeSource?.section}</strong> + <strong style={{ color: '#93c5fd' }}>{mergeTarget?.section}</strong> = <strong style={{ color: '#fff' }}>{(mergeSource?.capacity || 0) + (mergeTarget?.capacity || 0)} seats</strong>
                                            <br /><span style={{ color: '#4b5563' }}>An order can be placed immediately after confirming.</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button onClick={cancelMerge} style={{ flex: 1, background: 'var(--surface-active)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                                            <button onClick={executeMerge} disabled={merging} style={{ flex: 1, background: '#2563eb', border: 'none', borderRadius: 8, padding: '10px', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                {merging ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <CheckCircle size={14} />}
                                                {merging ? 'Merging…' : 'Confirm'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid #d97706', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                                        <GitMerge size={20} style={{ color: '#d97706', marginBottom: 8 }} />
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', marginBottom: 6 }}>
                                            {mergeStep === 'selectSource' ? 'Select Source Table' : 'Select Destination Table'}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#92400e' }}>
                                            {mergeStep === 'selectSource' ? 'Select the 1st available table on the floor plan' : `1st table: ${mergeSource?.section} — now select the 2nd table`}
                                        </div>
                                        {mergeSource && (
                                            <div style={{ marginTop: 10, background: '#d97706', color: '#000', borderRadius: 6, padding: '4px 10px', display: 'inline-block', fontWeight: 800, fontSize: 12 }}>{mergeSource.section}</div>
                                        )}
                                        <button onClick={cancelMerge} style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: '1px solid #92400e', borderRadius: 8, padding: '8px', color: '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                )}
                            </div>

                        </>
                    )}

                    </div>{/* end sidebar content wrapper */}
                </div>
            </div>

            {/* ── Bottom Status Bar ──────────────────────────────────────────── */}
            <div className="floor-status-bar" style={{
                marginTop: 10,
                background: 'var(--bg-card)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                padding: '9px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                fontSize: 12,
                flexWrap: 'wrap',
            }}>
                {([
                    { label: 'Available', n: counts.available, color: TABLE_STATUS_COLORS.available.solid },
                    { label: 'Occupied', n: counts.occupied, color: TABLE_STATUS_COLORS.occupied.solid },
                    { label: 'Reserved', n: counts.reserved, color: TABLE_STATUS_COLORS.reserved.solid },
                ] as { label: string; n: number; color: string }[]).map(({ label, n, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                        <span style={{ fontWeight: 700, color }}>{n}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                ))}
            </div>
            </div>
            </div>

            {/* Order modal (disabled during merge mode) */}
            {selectedTable && mergeStep === 'idle' && isWaiterRole(user?.role) && (
                <OrderModal
                    table={selectedTable}
                    onRefresh={fetchTables}
                    onClose={() => { setSelectedTable(null); fetchTables(); }}
                />
            )}

            {isTableModalOpen && (
                <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
                        <button onClick={() => setIsTableModalOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <X size={18} />
                        </button>

                        <h3 className="card-title mb-4">{tableModalMode === 'add' ? 'Create Table' : 'Edit Table'}</h3>

                        <form onSubmit={submitTableForm} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm text-muted mb-1" htmlFor="table-number">Table Number</label>
                                <input
                                    id="table-number"
                                    required
                                    min={1}
                                    type="number"
                                    className="form-input"
                                    value={tableForm.number}
                                    onChange={e => setTableForm({ ...tableForm, number: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-muted mb-1" htmlFor="table-section-name">Section Name</label>
                                <input
                                    id="table-section-name"
                                    required
                                    type="text"
                                    className="form-input"
                                    value={tableForm.section}
                                    onChange={e => setTableForm({ ...tableForm, section: e.target.value })}
                                    placeholder="Bo, Kenema, Waterfront..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-muted mb-1" htmlFor="table-capacity">Capacity</label>
                                <input
                                    id="table-capacity"
                                    required
                                    min={1}
                                    type="number"
                                    className="form-input"
                                    value={tableForm.capacity}
                                    onChange={e => setTableForm({ ...tableForm, capacity: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-muted mb-1" htmlFor="table-status">Status</label>
                                <select id="table-status" className="form-select" value={tableForm.status} onChange={e => setTableForm({ ...tableForm, status: e.target.value })}>
                                    <option value="available">Available</option>
                                    <option value="reserved">Reserved</option>
                                    <option value="occupied">Occupied</option>
                                    <option value="cleaning">Cleaning</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-muted mb-1" htmlFor="table-shape">Shape</label>
                                <select id="table-shape" className="form-select" value={tableForm.shape} onChange={e => setTableForm({ ...tableForm, shape: e.target.value })}>
                                    <option value="rect">Rectangle</option>
                                    <option value="circle">Circle</option>
                                </select>
                            </div>

                            <button type="submit" className="btn btn-primary mt-2 justify-center" style={{ padding: 12 }} disabled={savingTable}>
                                {savingTable ? 'Saving…' : tableModalMode === 'add' ? 'Create Table' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse-ring { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
            `}</style>
        </AppLayout>
    );
}
