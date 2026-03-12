'use client';
import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import OrderModal from '@/components/OrderModal';
import {
    GitMerge, UtensilsCrossed, ShoppingBag, Truck,
    CalendarDays, Printer, RefreshCw, ZoomIn, ZoomOut,
    Users, X, CheckCircle, ArrowRight, Link, Plus, Pencil, Trash2
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

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

function getElapsedMinutes(orders: any[]): number | null {
    if (!orders || orders.length === 0) return null;
    return Math.floor((Date.now() - new Date(orders[0].createdAt).getTime()) / 60000);
}

function formatTimer(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:00`;
}

/* ─── Status-based visual tokens ──────────────────────────────────────────── */
function getTokens(status: string, elapsed: number | null) {
    const isAlert = elapsed !== null && elapsed >= 60;
    if (status === 'available') {
        return { body: '#1c2130', border: '#2a3044', seat: '#2e3548', timerBg: '', shadow: 'none' };
    }
    if (status === 'reserved') {
        return { body: '#0f1e35', border: '#2563eb', seat: '#3b82f6', timerBg: '#2563eb', shadow: '0 0 18px rgba(37,99,235,0.35)' };
    }
    if (status === 'cleaning') {
        return { body: '#1a1030', border: '#7c3aed', seat: '#7c3aed', timerBg: '#7c3aed', shadow: '0 0 18px rgba(124,58,237,0.3)' };
    }
    // occupied
    if (isAlert) {
        return { body: '#2a1515', border: '#dc2626', seat: '#dc2626', timerBg: '#dc2626', shadow: '0 0 22px rgba(220,38,38,0.4)' };
    }
    return { body: '#1a2510', border: '#2d4a1a', seat: '#c7923a', timerBg: '#0d7c5a', shadow: '0 0 18px rgba(34,197,94,0.2)' };
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
function TablePod({
    table,
    onClick,
    mergeHighlight = 'none',
    isAdmin = false,
    onEdit,
    onDelete,
}: {
    table: any;
    onClick: () => void;
    mergeHighlight?: MergeHighlight;
    isAdmin?: boolean;
    onEdit?: (table: any) => void;
    onDelete?: (table: any) => void;
}) {
    const layout = getTableLayout(table);
    const elapsed = getElapsedMinutes(table.orders);
    const tok = getTokens(table.status, elapsed);
    const total = table.orders?.reduce((s: number, o: any) => s + (o.total || 0), 0) || 0;
    const waiter = table.orders?.[0]?.user?.name;

    const isBig = table.number === 5; // "Freetown" equivalent — largest circle
    const isCircle = layout.shape === 'circle';
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
            cursor: 'pointer',
            userSelect: 'none',
            opacity: mergeOpacity,
            transition: 'opacity 0.2s',
            pointerEvents: 'auto',
        }}
            onClick={onClick}
        >
            {/* Timer badge — floats above */}
            {elapsed !== null && tok.timerBg && (
                <div style={{
                    background: tok.timerBg,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 20,
                    marginBottom: 4,
                    letterSpacing: 0.5,
                    zIndex: 2,
                }}>
                    {formatTimer(elapsed)}
                </div>
            )}

            {/* Table body */}
            <div style={{
                position: 'relative',
                width: W,
                height: H,
                background: tok.body,
                border: `2px solid ${mergeBorder}`,
                borderRadius: isCircle ? '50%' : 14,
                boxShadow: mergeShadow,
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

                {/* Bill */}
                {total > 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                        ${total.toFixed(0)}
                    </div>
                )}

                {/* Available label */}
                {table.status === 'available' && (
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Empty
                    </div>
                )}
            </div>

            {/* Waiter name below table */}
            {waiter && (
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
                marginTop: waiter ? 2 : 6,
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
    const [tables, setTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTable, setSelectedTable] = useState<any>(null);
    const [zoom, setZoom] = useState(100);
    const toast = useToast();
    const [isTableModalOpen, setIsTableModalOpen] = useState(false);
    const [tableModalMode, setTableModalMode] = useState<'add' | 'edit'>('add');
    const [editingTable, setEditingTable] = useState<any>(null);
    const [savingTable, setSavingTable] = useState(false);
    const [tableForm, setTableForm] = useState({ number: '', section: '', capacity: '4', status: 'available', shape: 'rect' });
    const [placingTable, setPlacingTable] = useState<any>(null);
    const [savingPlacement, setSavingPlacement] = useState(false);

    // ── Merge state ────────────────────────────────────────────────────────
    type MergeStep = 'idle' | 'selectSource' | 'selectTarget' | 'confirm';
    const [mergeStep, setMergeStep] = useState<MergeStep>('idle');
    const [mergeSource, setMergeSource] = useState<any>(null);
    const [mergeTarget, setMergeTarget] = useState<any>(null);
    const [merging, setMerging] = useState(false);

    const startMerge = () => { setMergeStep('selectSource'); setMergeSource(null); setMergeTarget(null); };
    const cancelMerge = () => { setMergeStep('idle'); setMergeSource(null); setMergeTarget(null); };

    const fetchTables = () => {
        return fetch('/api/tables')
            .then(res => res.json())
            .then(data => { setTables(data); setLoading(false); });
    };
    useEffect(() => { fetchTables(); const i = setInterval(fetchTables, 30000); return () => clearInterval(i); }, []);

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

    const beginTablePlacement = (table: any) => {
        setPlacingTable(table);
        toast('info', `Click a spot on the floor to place ${table.section || `Table ${table.number}`}`);
    };

    const placeTable = async (event: React.MouseEvent<HTMLDivElement>) => {
        if (!placingTable || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;

        setSavingPlacement(true);
        try {
            const res = await fetch(`/api/tables/${placingTable.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layoutX: Number(x.toFixed(2)), layoutY: Number(y.toFixed(2)) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Unable to place table');

            toast('success', `${placingTable.section || `Table ${placingTable.number}`} positioned`);
            setPlacingTable(null);
            await fetchTables();
        } catch (error: any) {
            toast('error', error.message || 'Unable to save table position');
        } finally {
            setSavingPlacement(false);
        }
    };

    // Canvas click handler — routes to merge selection or order modal
    const handleTableClick = (table: any) => {
        if (mergeStep === 'selectSource') {
            if (table.status !== 'available') {
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
            if (table.status !== 'available') {
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
        seated: tables.filter(t => t.status === 'occupied').length,
        ordered: tables.filter(t => t.orders?.length > 0).length,
        available: tables.filter(t => t.status === 'available').length,
        reserved: tables.filter(t => t.status === 'reserved').length,
        cleaning: tables.filter(t => t.status === 'cleaning').length,
    };
    const totalPax = tables.filter(t => t.status === 'occupied').reduce((s, t) => s + t.capacity, 0);
    const totalRevenu = tables.reduce((s, t) => s + (t.orders?.reduce((a: number, o: any) => a + (o.total || 0), 0) || 0), 0);

    if (loading) return <AppLayout><div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><div className="loading-spinner" /></div></AppLayout>;

    return (
        <AppLayout>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UtensilsCrossed size={17} style={{ color: 'var(--brand-500)' }} />
                    <span style={{ fontWeight: 700, fontSize: 15 }}>Floor Management</span>
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span><b style={{ color: '#fff' }}>{counts.seated}</b> Dine-in</span>
                    <span><b style={{ color: '#fff' }}>{counts.ordered}</b> Ordered</span>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>{formatCurrency(totalRevenu, settings.currencySymbol)} Revenue</span>
                </div>
            </div>

            {/* Main layout */}
            <div style={{ display: 'flex', gap: 14, height: 'calc(100vh - 200px)', minHeight: 500 }}>

                {/* ── Floor Plan Canvas ─────────────────────────────────────── */}
                <div style={{
                    flex: 1,
                    background: '#101520',
                    borderRadius: 16,
                    border: '1px solid #1e2433',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {placingTable && (
                        <div style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            zIndex: 20,
                            background: savingPlacement ? '#1d4ed8' : '#2563eb',
                            color: '#fff',
                            borderRadius: 12,
                            padding: '8px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}>
                            {savingPlacement ? 'Saving placement…' : `Placing ${placingTable.section || `Table ${placingTable.number}`}`}
                            <button onClick={() => setPlacingTable(null)} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={12} />
                            </button>
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
                        cursor: mergeStep !== 'idle' || placingTable ? 'crosshair' : 'default',
                    }}>
                        <div
                            ref={canvasRef}
                            onClick={placeTable}
                            style={{ position: 'absolute', inset: 0 }}
                        >
                            {tables.map((table) => {
                            const isSource = mergeSource?.id === table.id;
                            const isTarget = mergeTarget?.id === table.id;
                            return (
                                <TablePod
                                    key={table.id}
                                    table={table}
                                    onClick={() => {
                                        if (placingTable) {
                                            setPlacingTable(table);
                                            toast('info', `Click a new spot on the floor to place ${table.section || `Table ${table.number}`}`);
                                            return;
                                        }
                                        handleTableClick(table);
                                    }}
                                    isAdmin={user?.role === 'admin'}
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

                {/* ── Right Sidebar ─────────────────────────────────────────── */}
                <div style={{ width: 232, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>

                    {/* Quick Actions — only Merge Table (live) */}
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
                            /* Confirm card */
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
                            /* Active selection mode */
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

                    {/* New Order */}
                    <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-muted)', marginBottom: 10 }}>New Order</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <button onClick={() => toast('info', 'Click a table to start a Dine-in order')}
                                style={{ background: '#15803d', border: 'none', borderRadius: 10, padding: '13px 14px', color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'filter 0.15s' }}>
                                <UtensilsCrossed size={17} /> Dine-in
                            </button>
                            <button onClick={() => toast('info', 'Takeaway — coming soon')}
                                style={{ background: '#c2410c', border: 'none', borderRadius: 10, padding: '13px 14px', color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'filter 0.15s' }}>
                                <ShoppingBag size={17} /> Take Away
                            </button>
                            <button onClick={() => toast('info', 'Delivery — coming soon')}
                                style={{ background: '#0369a1', border: 'none', borderRadius: 10, padding: '13px 14px', color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'filter 0.15s' }}>
                                <Truck size={17} /> Delivery
                            </button>
                        </div>
                    </div>

                    {/* Other Actions */}
                    <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-muted)', marginBottom: 10 }}>Other Actions</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <button onClick={() => toast('info', 'Reservation Overview — coming soon')}
                                style={{ background: 'var(--surface-active)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                <CalendarDays size={16} /> Reservation Overview
                            </button>
                            <button onClick={() => toast('info', 'Print — coming soon')}
                                style={{ background: 'var(--surface-active)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                <Printer size={16} /> Print Reservation
                            </button>
                        </div>
                    </div>

                    {user?.role === 'admin' && (
                        <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-muted)' }}>Admin Table Control</div>
                                <button
                                    onClick={openAddTableModal}
                                    style={{ background: '#2563eb', border: 'none', borderRadius: 8, padding: '6px 8px', color: '#fff', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                >
                                    <Plus size={14} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                                {tables.map((table) => (
                                    <div key={table.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'var(--surface-active)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{table.section || `Table ${table.number}`}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>#{table.number} • {table.capacity} seats • {table.status}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    onClick={() => beginTablePlacement(table)}
                                                    style={{ background: 'none', border: '1px solid #2563eb', color: '#93c5fd', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}
                                                    title="Place table on floor"
                                                >
                                                    <Plus size={13} />
                                                </button>
                                                <button
                                                    onClick={() => openEditTableModal(table)}
                                                    style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}
                                                    title="Edit table"
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <button
                                                    onClick={() => deleteTable(table)}
                                                    style={{ background: 'none', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}
                                                    title="Delete table"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Bottom Status Bar ──────────────────────────────────────────── */}
            <div style={{
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
                    { label: 'Seated', n: counts.seated, color: '#a855f7' },
                    { label: 'Ordered', n: counts.ordered, color: '#22c55e' },
                    { label: 'Available', n: counts.available, color: '#4b5563' },
                    { label: 'Reserved', n: counts.reserved, color: '#3b82f6' },
                    { label: 'Cleaning', n: counts.cleaning, color: '#f59e0b' },
                ] as { label: string; n: number; color: string }[]).map(({ label, n, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                        <span style={{ fontWeight: 700, color }}>{n}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <Users size={13} />
                    PAX: <strong style={{ color: '#fff' }}>{totalPax}</strong>
                </div>
            </div>

            {/* Order modal (disabled during merge mode) */}
            {selectedTable && mergeStep === 'idle' && (
                <OrderModal
                    table={selectedTable}
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
                                <label className="block text-sm text-muted mb-1">Table Number</label>
                                <input
                                    required
                                    min={1}
                                    type="number"
                                    className="form-input"
                                    value={tableForm.number}
                                    onChange={e => setTableForm({ ...tableForm, number: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-muted mb-1">Section Name</label>
                                <input
                                    required
                                    type="text"
                                    className="form-input"
                                    value={tableForm.section}
                                    onChange={e => setTableForm({ ...tableForm, section: e.target.value })}
                                    placeholder="Bo, Kenema, Waterfront..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-muted mb-1">Capacity</label>
                                <input
                                    required
                                    min={1}
                                    type="number"
                                    className="form-input"
                                    value={tableForm.capacity}
                                    onChange={e => setTableForm({ ...tableForm, capacity: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-muted mb-1">Status</label>
                                <select className="form-select" value={tableForm.status} onChange={e => setTableForm({ ...tableForm, status: e.target.value })}>
                                    <option value="available">Available</option>
                                    <option value="reserved">Reserved</option>
                                    <option value="occupied">Occupied</option>
                                    <option value="cleaning">Cleaning</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-muted mb-1">Shape</label>
                                <select className="form-select" value={tableForm.shape} onChange={e => setTableForm({ ...tableForm, shape: e.target.value })}>
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

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse-ring { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
            `}</style>
        </AppLayout>
    );
}
