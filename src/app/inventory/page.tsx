'use client';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { Plus, Edit2, Trash2, Search, AlertTriangle, ArrowRight, X, ShoppingBasket, TrendingUp, TrendingDown, AlarmClock, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/currency';
import { formatUtcCalendarDate, getLocalDateInputValue, toUtcDateInputValue } from '@/lib/date-only';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/patterns/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { IconHint } from '@/components/ui/tooltip';

type InventoryItem = {
    id: string;
    name: string;
    category: string;
    unit: string;
    currentStock: number;
    minStock: number;
    maxStock: number | null;
    cost: number | null;
    weightedAverageCost: number;
    latestUnitCost: number | null;
    supplier: string | null;
    location: string | null;
    lastRestocked: string | null;
    lastPurchaseAt: string | null;
    expiryDate: string | null;
    weeklyUsage: number;
    dailyUsage: number;
    daysRemaining: number | null;
    recommendedReorderQty: number;
    advice: 'reorder_now' | 'reorder_soon' | 'healthy';
    weeklyPurchaseSpend: number;
    monthlyPurchaseSpend: number;
    drivers?: Array<{ menuItemId: string; menuItemName: string; usage: number }>;
};

type InventoryPurchase = {
    id: string;
    inventoryId: string;
    inventoryName: string;
    unit: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    supplier: string | null;
    notes: string | null;
    purchasedAt: string;
};

type PurchaseSummary = {
    weekSpend: number;
    monthSpend: number;
    recentPurchases: InventoryPurchase[];
};

const EMPTY_PURCHASE_SUMMARY: PurchaseSummary = {
    weekSpend: 0,
    monthSpend: 0,
    recentPurchases: [],
};

function normalizeInventoryItems(input: unknown): InventoryItem[] {
    if (!Array.isArray(input)) return [];
    return input.filter((item): item is InventoryItem => Boolean(item && typeof item === 'object'));
}

function normalizeTopUsed(input: unknown) {
    if (!Array.isArray(input)) return [];
    return input.filter((item): item is { id: string; name: string; weeklyUsage: number; unit: string } => Boolean(item && typeof item === 'object'));
}

function normalizePurchaseSummary(input: unknown): PurchaseSummary {
    if (!input || typeof input !== 'object') return EMPTY_PURCHASE_SUMMARY;
    const candidate = input as Partial<PurchaseSummary>;
    return {
        weekSpend: typeof candidate.weekSpend === 'number' ? candidate.weekSpend : 0,
        monthSpend: typeof candidate.monthSpend === 'number' ? candidate.monthSpend : 0,
        recentPurchases: Array.isArray(candidate.recentPurchases) ? candidate.recentPurchases.filter((purchase): purchase is InventoryPurchase => Boolean(purchase && typeof purchase === 'object')) : [],
    };
}

function formatPurchaseDate(value: string | null | undefined) {
    if (!value) return 'No purchase history';
    const formatted = formatUtcCalendarDate(value);
    return formatted ? `Bought ${formatted}` : 'No purchase history';
}

type InventoryFormState = {
    id: string;
    name: string;
    category: string;
    unit: string;
    currentStock: string;
    minStock: string;
    maxStock: string;
    cost: string;
    supplier: string;
    location: string;
    lastRestocked: string;
    expiryDate: string;
};

const EMPTY_FORM: InventoryFormState = {
    id: '',
    name: '',
    category: '',
    unit: '',
    currentStock: '',
    minStock: '',
    maxStock: '',
    cost: '',
    supplier: '',
    location: '',
    lastRestocked: '',
    expiryDate: '',
};

function toDateInput(value: string | null) {
    return toUtcDateInputValue(value);
}

function InventoryPageContent() {
    const { settings } = useSettings();
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [adviceSummary, setAdviceSummary] = useState<{ reorderNow: number; reorderSoon: number; topUsed: Array<{ id: string; name: string; weeklyUsage: number; unit: string }> }>({ reorderNow: 0, reorderSoon: 0, topUsed: [] });
    const [purchaseSummary, setPurchaseSummary] = useState<PurchaseSummary>(EMPTY_PURCHASE_SUMMARY);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [form, setForm] = useState<InventoryFormState>(EMPTY_FORM);
    const [purchaseForm, setPurchaseForm] = useState({
        inventoryId: '',
        quantity: '',
        unitCost: '',
        loggedAt: getLocalDateInputValue(),
        actualPurchasedAt: '',
        supplier: '',
        notes: '',
    });
    const [saving, setSaving] = useState(false);
    const toast = useToast();
    const focus = searchParams.get('focus');
    const canManageInventory = user?.role === 'admin' || user?.role === 'manager';
    const currencySymbol = settings?.currencySymbol || 'Le';

    const loadInventory = useCallback(() => {
        setLoading(true);
        fetch('/api/inventory')
            .then(r => r.json())
            .then(d => {
                const nextItems = normalizeInventoryItems(d?.items);
                setItems(nextItems);
                setAdviceSummary({
                    reorderNow: typeof d?.adviceSummary?.reorderNow === 'number' ? d.adviceSummary.reorderNow : 0,
                    reorderSoon: typeof d?.adviceSummary?.reorderSoon === 'number' ? d.adviceSummary.reorderSoon : 0,
                    topUsed: normalizeTopUsed(d?.adviceSummary?.topUsed),
                });
                setPurchaseSummary(normalizePurchaseSummary(d?.purchaseSummary));
                setLoading(false);
            })
            .catch(() => {
                setItems([]);
                setAdviceSummary({ reorderNow: 0, reorderSoon: 0, topUsed: [] });
                setPurchaseSummary(EMPTY_PURCHASE_SUMMARY);
                setLoading(false);
                toast('error', 'Failed to load inventory data');
            });
    }, [toast]);

    useEffect(() => {
        void loadInventory();
    }, [loadInventory]);

    const focusConfig = focus === 'reorder_now'
        ? {
            title: 'Critical stock requiring immediate reorder',
            detail: 'You jumped into the inventory items that are already below safe cover or minimum stock.',
            accent: '#ef4444',
            background: 'rgba(239,68,68,0.12)',
        }
        : focus === 'reorder_soon'
            ? {
                title: 'Inventory projected to run low soon',
                detail: 'These items are trending toward low stock and should be handled before they become urgent.',
                accent: '#f59e0b',
                background: 'rgba(245,158,11,0.12)',
            }
            : null;

    const filtered = items.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.category.toLowerCase().includes(search.toLowerCase());
        const matchesFocus = focus === 'reorder_now'
            ? item.advice === 'reorder_now'
            : focus === 'reorder_soon'
                ? item.advice === 'reorder_soon'
                : true;

        return matchesSearch && matchesFocus;
    });

    const getStatus = (item: InventoryItem) => {
        if (item.currentStock <= item.minStock) return 'critical';
        if (item.currentStock <= item.minStock * 1.5) return 'warning';
        return 'good';
    };

    const getPercentage = (item: InventoryItem) => {
        if (!item.maxStock || item.maxStock <= 0) return 0;
        return Math.min(100, (item.currentStock / item.maxStock) * 100);
    };

    const formatDaysRemaining = (daysRemaining: number | null) => {
        if (daysRemaining == null) return 'No usage data yet';
        if (daysRemaining < 1) return 'Less than 1 day left';
        const rounded = Math.round(daysRemaining);
        return `${rounded} day${rounded === 1 ? '' : 's'} left`;
    };

    // Manager POV — what should I act on right now?
    const buyTodayItems = items.filter(i => i.advice === 'reorder_now').slice(0, 5);
    const goingLowItems = items.filter(i => i.advice === 'reorder_soon').slice(0, 5);
    const expiringSoon = items.filter(i => {
        if (!i.expiryDate) return false;
        const days = (new Date(i.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return days >= 0 && days <= 7;
    }).slice(0, 5);

    const startPurchaseFor = (inventoryId: string) => {
        setPurchaseForm({
            inventoryId,
            quantity: '',
            unitCost: '',
            loggedAt: getLocalDateInputValue(),
            actualPurchasedAt: '',
            supplier: '',
            notes: '',
        });
        setIsPurchaseModalOpen(true);
    };

    const openAddModal = () => {
        setForm(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const openPurchaseModal = () => {
        setPurchaseForm({
            inventoryId: items[0]?.id || '',
            quantity: '',
            unitCost: '',
            loggedAt: getLocalDateInputValue(),
            actualPurchasedAt: '',
            supplier: '',
            notes: '',
        });
        setIsPurchaseModalOpen(true);
    };

    const openEditModal = (item: InventoryItem) => {
        setForm({
            id: item.id,
            name: item.name,
            category: item.category,
            unit: item.unit,
            currentStock: String(item.currentStock ?? ''),
            minStock: String(item.minStock ?? ''),
            maxStock: item.maxStock == null ? '' : String(item.maxStock),
            cost: item.cost == null ? '' : String(item.cost),
            supplier: item.supplier || '',
            location: item.location || '',
            lastRestocked: toDateInput(item.lastRestocked),
            expiryDate: toDateInput(item.expiryDate),
        });
        setIsModalOpen(true);
    };

    const submitPurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManageInventory) {
            toast('error', 'Unauthorized');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/inventory/purchases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inventoryId: purchaseForm.inventoryId,
                    quantity: purchaseForm.quantity,
                    unitCost: purchaseForm.unitCost,
                    purchasedAt: purchaseForm.actualPurchasedAt || purchaseForm.loggedAt,
                    supplier: purchaseForm.supplier,
                    notes: purchaseForm.notes,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to record purchase');
            }

            toast('success', 'Ingredient purchase recorded');
            setIsPurchaseModalOpen(false);
            void loadInventory();
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to record purchase');
        } finally {
            setSaving(false);
        }
    };

    const submitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManageInventory) {
            toast('error', 'Unauthorized');
            return;
        }

        setSaving(true);
        try {
            const method = form.id ? 'PATCH' : 'POST';
            const url = form.id ? `/api/inventory/${form.id}` : '/api/inventory';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name,
                    category: form.category,
                    unit: form.unit,
                    currentStock: form.currentStock,
                    minStock: form.minStock,
                    maxStock: form.maxStock,
                    cost: form.cost,
                    supplier: form.supplier,
                    location: form.location,
                    lastRestocked: form.lastRestocked,
                    expiryDate: form.expiryDate,
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to save inventory item');
            }

            toast('success', form.id ? 'Inventory item updated' : 'Inventory item added');
            setIsModalOpen(false);
            setForm(EMPTY_FORM);
            void loadInventory();
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to save inventory item');
        } finally {
            setSaving(false);
        }
    };

    const deleteItem = async (item: InventoryItem) => {
        if (!canManageInventory) {
            toast('error', 'Unauthorized');
            return;
        }

        if (!confirm(`Delete ${item.name} from inventory?`)) return;

        const res = await fetch(`/api/inventory/${item.id}`, { method: 'DELETE' });
        if (res.ok) {
            toast('success', 'Inventory item deleted');
            void loadInventory();
        } else {
            const data = await res.json().catch(() => null);
            toast('error', data?.error || 'Failed to delete inventory item');
        }
    };

    if (loading) return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;

    return (
        <AppLayout>
            <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
                <div>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--text-accent)', marginBottom: 8 }}>
                        Stockroom
                    </span>
                    <h2 style={{ fontFamily: 'var(--font-display), serif', fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 4 }}>
                        What's on the shelves?
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 640 }}>
                        Track what's in stock, what needs reordering, and what you've spent on ingredients this week.
                    </p>
                </div>
                {canManageInventory && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Button variant="secondary" onClick={openPurchaseModal}><Plus size={16} /> Log a purchase</Button>
                        <Button variant="primary" onClick={openAddModal}><Plus size={16} /> Add new item</Button>
                    </div>
                )}
            </div>

            <div className="search-input mb-4" style={{ maxWidth: 480 }}>
                <Search size={16} />
                <input type="text" placeholder="Search by item name..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {focusConfig && (
                <div style={{ marginBottom: 16, padding: 16, borderRadius: 18, border: `1px solid ${focusConfig.accent}`, background: `linear-gradient(135deg, ${focusConfig.background}, rgba(15,23,42,0.88))`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.3, color: focusConfig.accent, marginBottom: 8 }}>
                            <AlertTriangle size={14} />
                            Focused Inventory View
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{focusConfig.title}</div>
                        <div style={{ fontSize: 13, color: '#cbd5e1', maxWidth: 700 }}>{focusConfig.detail}</div>
                    </div>
                    <button
                        onClick={() => router.push('/inventory')}
                        style={{ background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(148,163,184,0.2)', color: '#fff', borderRadius: 999, padding: '10px 14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    >
                        <X size={14} /> Clear focus
                    </button>
                </div>
            )}

            {/* ── HERO: Buy today (the manager's #1 question) ─────────────── */}
            <section
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 22,
                    border: `1px solid ${buyTodayItems.length > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.22)'}`,
                    background: buyTodayItems.length > 0
                        ? 'linear-gradient(135deg, rgba(239,68,68,0.10), rgba(15,23,42,0.92))'
                        : 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(15,23,42,0.92))',
                    padding: 24,
                    marginBottom: 20,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--text-accent)', marginBottom: 8 }}>
                            <ShoppingBasket size={14} /> Buy today
                        </div>
                        <h3 style={{ fontFamily: 'var(--font-display), serif', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                            {buyTodayItems.length > 0
                                ? `${buyTodayItems.length} ingredient${buyTodayItems.length === 1 ? '' : 's'} to restock`
                                : 'Nothing critical today'}
                        </h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 520 }}>
                            {buyTodayItems.length > 0
                                ? 'These ingredients are at or below the minimum stock level. Tap "Log purchase" after you buy.'
                                : 'Every ingredient is above its minimum stock. Check back tomorrow.'}
                        </p>
                    </div>
                    {buyTodayItems.length === 0 && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontSize: 12, fontWeight: 700 }}>
                            <CheckCircle2 size={14} /> All ingredients above minimum
                        </div>
                    )}
                </div>

                {buyTodayItems.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {buyTodayItems.map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 14,
                                    padding: '14px 16px',
                                    borderRadius: 14,
                                    border: '1px solid rgba(148,163,184,0.16)',
                                    background: 'rgba(15,23,42,0.62)',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                        Only <strong style={{ color: '#fca5a5' }}>{item.currentStock} {item.unit}</strong> left
                                        {item.supplier ? ` · from ${item.supplier}` : ''}
                                    </div>
                                </div>
                                {item.recommendedReorderQty > 0 && (
                                    <div
                                        style={{
                                            padding: '8px 14px',
                                            borderRadius: 12,
                                            background: 'rgba(180,104,51,0.16)',
                                            border: '1px solid rgba(180,104,51,0.3)',
                                            color: 'var(--text-accent)',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        Buy ~ {item.recommendedReorderQty.toFixed(1)} {item.unit}
                                    </div>
                                )}
                                {canManageInventory && (
                                    <Button size="sm" variant="primary" onClick={() => startPurchaseFor(item.id)}>
                                        Log purchase
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ── At-a-glance row: spend + going low + expiring ─────────── */}
            <div className="grid-3 gap-4 mb-6">
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
                            Spent this week
                        </span>
                        <div style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(56,189,248,0.14)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 32, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: 6 }}>
                        {formatCurrency(purchaseSummary.weekSpend || 0, currencySymbol)}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {formatCurrency(purchaseSummary.monthSpend || 0, currencySymbol)} this month
                    </div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
                            Running low soon
                        </span>
                        <div style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(245,158,11,0.14)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingDown size={16} />
                        </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 32, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: 6 }}>
                        {goingLowItems.length}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {goingLowItems.length > 0
                            ? goingLowItems.slice(0, 2).map(i => i.name).join(', ') + (goingLowItems.length > 2 ? '…' : '')
                            : 'Nothing trending low this week.'}
                    </div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
                            Expiring this week
                        </span>
                        <div style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(239,68,68,0.14)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlarmClock size={16} />
                        </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 32, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em', color: expiringSoon.length > 0 ? '#fca5a5' : 'var(--text-primary)', marginBottom: 6 }}>
                        {expiringSoon.length}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {expiringSoon.length > 0
                            ? expiringSoon.slice(0, 2).map(i => i.name).join(', ') + (expiringSoon.length > 2 ? '…' : '')
                            : 'Nothing expiring in the next 7 days.'}
                    </div>
                </div>
            </div>

            {/* ── Full list section title ─────────────────────────────── */}
            <div style={{ marginBottom: 14 }}>
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--text-accent)', marginBottom: 6 }}>
                    Full pantry
                </span>
                <h3 style={{ fontFamily: 'var(--font-display), serif', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                    Everything you track
                </h3>
            </div>

            <div
                style={{
                    borderRadius: 18,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    overflow: 'hidden',
                }}
            >
                {/* Header row */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: canManageInventory
                            ? 'minmax(180px, 1.4fr) 100px minmax(180px, 1.2fr) minmax(180px, 1.4fr) 110px minmax(140px, 1fr) 100px'
                            : 'minmax(180px, 1.4fr) 100px minmax(180px, 1.2fr) minmax(180px, 1.4fr) 110px minmax(140px, 1fr)',
                        gap: 16,
                        padding: '14px 20px',
                        borderBottom: '1px solid var(--border)',
                        background: 'rgba(255,255,255,0.02)',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.18em',
                        color: 'var(--text-muted)',
                    }}
                >
                    <span>Item</span>
                    <span>Category</span>
                    <span>Stock</span>
                    <span>Action</span>
                    <span>Avg cost</span>
                    <span>Supplier</span>
                    {canManageInventory && <span></span>}
                </div>

                {/* Rows */}
                <div>
                    {filtered.map((item, index) => {
                        const status = getStatus(item);
                        const pct = getPercentage(item);
                        const adviceLabel = item.advice === 'reorder_now' ? 'Buy now' : item.advice === 'reorder_soon' ? 'Buy soon' : 'OK';
                        const adviceColor = item.advice === 'reorder_now' ? '#ef4444' : item.advice === 'reorder_soon' ? '#f59e0b' : '#22c55e';
                        const stockColor = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#22c55e';

                        return (
                            <div
                                key={item.id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: canManageInventory
                                        ? 'minmax(180px, 1.4fr) 100px minmax(180px, 1.2fr) minmax(180px, 1.4fr) 110px minmax(140px, 1fr) 100px'
                                        : 'minmax(180px, 1.4fr) 100px minmax(180px, 1.2fr) minmax(180px, 1.4fr) 110px minmax(140px, 1fr)',
                                    gap: 16,
                                    padding: '18px 20px',
                                    alignItems: 'center',
                                    borderBottom: index < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                                    background: focusConfig && item.advice === focus ? focusConfig.background : 'transparent',
                                    transition: 'background 0.15s ease',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                    <div style={{ width: 6, height: 36, borderRadius: 3, background: stockColor, flexShrink: 0, opacity: 0.85 }} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                                            {item.name}
                                        </div>
                                        {item.location && (
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.location}</div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                                        {item.category}
                                    </span>
                                </div>

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                                        <span style={{ fontFamily: 'var(--font-display), serif', fontSize: 18, fontWeight: 700, color: stockColor, letterSpacing: '-0.02em' }}>
                                            {item.currentStock}
                                        </span>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            {item.unit}{item.maxStock ? ` · max ${item.maxStock}` : ''}
                                        </span>
                                    </div>
                                    <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, background: stockColor, borderRadius: 999 }} />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ display: 'inline-block', alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', padding: '4px 10px', borderRadius: 999, background: `${adviceColor}22`, color: adviceColor, border: `1px solid ${adviceColor}44` }}>
                                        {adviceLabel}
                                    </span>
                                    {item.recommendedReorderQty > 0 ? (
                                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                                            Buy ~ {item.recommendedReorderQty.toFixed(1)} {item.unit}
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDaysRemaining(item.daysRemaining)}</span>
                                    )}
                                </div>

                                <div>
                                    <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {formatCurrency(item.weightedAverageCost || 0, currencySymbol)}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        per {item.unit}
                                    </div>
                                </div>

                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 0 }}>
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {item.supplier || '—'}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                        {formatPurchaseDate(item.lastPurchaseAt)}
                                    </div>
                                </div>

                                {canManageInventory && (
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                        <IconHint label="Edit item">
                                            <Button size="icon" variant="secondary" onClick={() => openEditModal(item)}><Edit2 size={14} /></Button>
                                        </IconHint>
                                        <IconHint label="Remove item">
                                            <Button size="icon" variant="danger" onClick={() => deleteItem(item)}><Trash2 size={14} /></Button>
                                        </IconHint>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>
                                {search ? `No items match "${search}"` : 'No ingredients tracked yet'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {canManageInventory && !search ? 'Tap "Add new item" to start tracking ingredients.' : ''}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ marginTop: 32, marginBottom: 14 }}>
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--text-accent)', marginBottom: 6 }}>
                    Market activity
                </span>
                <h3 style={{ fontFamily: 'var(--font-display), serif', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                    Recent purchases
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    Every market run, logged. These entries drive the weekly spend numbers above.
                </p>
            </div>

            <div style={{ borderRadius: 18, border: '1px solid var(--border)', background: 'var(--bg-card)', overflow: 'hidden' }}>
                {purchaseSummary.recentPurchases.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>No purchases logged yet</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {canManageInventory ? 'After your next market run, tap "Log a purchase" to record it.' : ''}
                        </div>
                    </div>
                ) : (
                    purchaseSummary.recentPurchases.map((purchase, index, arr) => {
                        const dateObj = new Date(purchase.purchasedAt);
                        const day = dateObj.toLocaleDateString(undefined, { day: '2-digit' });
                        const month = dateObj.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
                        return (
                            <div
                                key={purchase.id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '64px 1fr auto',
                                    gap: 16,
                                    alignItems: 'center',
                                    padding: '18px 20px',
                                    borderBottom: index < arr.length - 1 ? '1px solid var(--border)' : 'none',
                                }}
                            >
                                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(180,104,51,0.08)', border: '1px solid rgba(180,104,51,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 20, fontWeight: 700, color: 'var(--text-accent)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                                        {day}
                                    </div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.14em', marginTop: 3 }}>
                                        {month}
                                    </div>
                                </div>

                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{purchase.inventoryName}</span>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            {purchase.quantity} {purchase.unit} · {formatCurrency(purchase.unitCost, currencySymbol)} per {purchase.unit}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        {purchase.supplier ? <>From <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{purchase.supplier}</span></> : 'No supplier noted'}
                                        {purchase.notes ? <> · {purchase.notes}</> : null}
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                                        {formatCurrency(purchase.totalCost, currencySymbol)}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 2 }}>
                                        Total
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent style={{ maxWidth: 600 }}>
                    <DialogHeader>
                        <DialogTitle>{form.id ? 'Edit item' : 'Add a new item'}</DialogTitle>
                        <DialogDescription>
                            {form.id ? 'Update details for this ingredient.' : 'Tell us what to track. You can log each purchase separately to keep costs accurate.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submitForm} className="flex flex-col gap-4">
                        <div className="grid-2 gap-4">
                            <FormField label="Item name" htmlFor="inv-name">
                                <Input id="inv-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Atlantic salmon" />
                            </FormField>
                            <FormField label="Category" htmlFor="inv-category">
                                <Input id="inv-category" required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Seafood" />
                            </FormField>
                        </div>

                        <div className="grid-2 gap-4">
                            <FormField label="Unit" htmlFor="inv-unit" description="kg, bottles, packs, litres…">
                                <Input id="inv-unit" required value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="kg" />
                            </FormField>
                            <FormField label="Unit cost" htmlFor="inv-cost">
                                <Input id="inv-cost" type="number" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
                            </FormField>
                        </div>

                        <div className="grid-3 gap-4">
                            <FormField label="Current stock" htmlFor="inv-current">
                                <Input id="inv-current" required type="number" step="0.01" value={form.currentStock} onChange={e => setForm({ ...form, currentStock: e.target.value })} />
                            </FormField>
                            <FormField label="Minimum stock" htmlFor="inv-min" description="When to flag for reorder">
                                <Input id="inv-min" required type="number" step="0.01" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} />
                            </FormField>
                            <FormField label="Maximum (optional)" htmlFor="inv-max">
                                <Input id="inv-max" type="number" step="0.01" value={form.maxStock} onChange={e => setForm({ ...form, maxStock: e.target.value })} />
                            </FormField>
                        </div>

                        <div className="grid-2 gap-4">
                            <FormField label="Supplier" htmlFor="inv-supplier">
                                <Input id="inv-supplier" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="e.g. Freetown Fresh Market" />
                            </FormField>
                            <FormField label="Storage location" htmlFor="inv-location">
                                <Input id="inv-location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Main freezer" />
                            </FormField>
                        </div>

                        <div className="grid-2 gap-4">
                            <FormField label="Last restocked" htmlFor="inv-restocked">
                                <Input id="inv-restocked" type="date" value={form.lastRestocked} onChange={e => setForm({ ...form, lastRestocked: e.target.value })} />
                            </FormField>
                            <FormField label="Expiry date" htmlFor="inv-expiry">
                                <Input id="inv-expiry" type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
                            </FormField>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button type="submit" variant="primary" disabled={saving}>
                                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add item'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isPurchaseModalOpen} onOpenChange={setIsPurchaseModalOpen}>
                <DialogContent style={{ maxWidth: 560 }}>
                    <DialogHeader>
                        <DialogTitle>Log a purchase</DialogTitle>
                        <DialogDescription>
                            Record what you bought from the market today. Stock and weighted-average cost update automatically.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submitPurchase} className="flex flex-col gap-4">
                        <FormField label="Ingredient" htmlFor="purchase-inv">
                            <Select
                                value={purchaseForm.inventoryId}
                                onValueChange={(value) => setPurchaseForm({ ...purchaseForm, inventoryId: value })}
                            >
                                <SelectTrigger id="purchase-inv">
                                    <SelectValue placeholder="Select an ingredient" />
                                </SelectTrigger>
                                <SelectContent>
                                    {items.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>

                        <div className="grid-2 gap-4">
                            <FormField label="Quantity bought" htmlFor="purchase-qty">
                                <Input id="purchase-qty" required type="number" step="0.01" value={purchaseForm.quantity} onChange={e => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })} />
                            </FormField>
                            <FormField label="Cost per unit" htmlFor="purchase-cost">
                                <Input id="purchase-cost" required type="number" step="0.01" value={purchaseForm.unitCost} onChange={e => setPurchaseForm({ ...purchaseForm, unitCost: e.target.value })} />
                            </FormField>
                        </div>

                        <div className="grid-2 gap-4">
                            <FormField label="Logged" htmlFor="purchase-logged">
                                <Input id="purchase-logged" type="date" value={purchaseForm.loggedAt} readOnly disabled />
                            </FormField>
                            <FormField label="Supplier" htmlFor="purchase-supplier">
                                <Input id="purchase-supplier" value={purchaseForm.supplier} onChange={e => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} placeholder="e.g. Freetown Fresh" />
                            </FormField>
                        </div>

                        <FormField label="Actual purchase date" htmlFor="purchase-actual" description="Leave blank to use today.">
                            <Input id="purchase-actual" type="date" value={purchaseForm.actualPurchasedAt} onChange={e => setPurchaseForm({ ...purchaseForm, actualPurchasedAt: e.target.value })} />
                        </FormField>

                        <FormField label="Notes (optional)" htmlFor="purchase-notes">
                            <textarea
                                id="purchase-notes"
                                value={purchaseForm.notes}
                                onChange={e => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                                rows={3}
                                style={{ width: '100%', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', padding: '12px 18px', fontSize: 14, resize: 'vertical' }}
                            />
                        </FormField>

                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setIsPurchaseModalOpen(false)}>Cancel</Button>
                            <Button type="submit" variant="primary" disabled={saving}>
                                {saving ? 'Saving…' : 'Log purchase'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

export default function InventoryPage() {
    return (
        <Suspense fallback={<AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>}>
            <InventoryPageContent />
        </Suspense>
    );
}
