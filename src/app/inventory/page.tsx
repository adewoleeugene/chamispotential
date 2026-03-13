'use client';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { Plus, Edit2, Trash2, Search, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/currency';

type InventoryItem = {
    id: string;
    name: string;
    category: string;
    unit: string;
    currentStock: number;
    minStock: number;
    maxStock: number | null;
    cost: number | null;
    supplier: string | null;
    location: string | null;
    lastRestocked: string | null;
    expiryDate: string | null;
    weeklyUsage: number;
    dailyUsage: number;
    daysRemaining: number | null;
    recommendedReorderQty: number;
    advice: 'reorder_now' | 'reorder_soon' | 'healthy';
    drivers?: Array<{ menuItemId: string; menuItemName: string; usage: number }>;
};

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
    if (!value) return '';
    return new Date(value).toISOString().slice(0, 10);
}

function InventoryPageContent() {
    const { settings } = useSettings();
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [adviceSummary, setAdviceSummary] = useState<any>({ reorderNow: 0, reorderSoon: 0, topUsed: [] });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<InventoryFormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const toast = useToast();
    const focus = searchParams.get('focus');
    const canManageInventory = user?.role === 'admin' || user?.role === 'manager';

    const loadInventory = useCallback(() => {
        setLoading(true);
        fetch('/api/inventory')
            .then(r => r.json())
            .then(d => {
                setItems(Array.isArray(d.items) ? d.items : []);
                setAdviceSummary(d.adviceSummary || { reorderNow: 0, reorderSoon: 0, topUsed: [] });
                setLoading(false);
            })
            .catch(() => {
                setItems([]);
                setAdviceSummary({ reorderNow: 0, reorderSoon: 0, topUsed: [] });
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
        return `${daysRemaining.toFixed(1)} days left`;
    };

    const openAddModal = () => {
        setForm(EMPTY_FORM);
        setIsModalOpen(true);
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
            <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
                <div className="search-input" style={{ width: 300 }}>
                    <Search size={16} />
                    <input type="text" placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {canManageInventory && (
                    <button className="btn btn-primary" onClick={openAddModal}><Plus size={16} /> Add Inventory</button>
                )}
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

            <div className="grid-3 gap-4 mb-6">
                <div className="card">
                    <div className="text-sm text-muted mb-2">Reorder now</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>{adviceSummary.reorderNow || 0}</div>
                    <div className="text-sm text-muted mt-2">Items already below safe usage cover or min stock.</div>
                </div>
                <div className="card">
                    <div className="text-sm text-muted mb-2">Reorder soon</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{adviceSummary.reorderSoon || 0}</div>
                    <div className="text-sm text-muted mt-2">Items projected to run low within the next week.</div>
                </div>
                <div className="card">
                    <div className="text-sm text-muted mb-2">Top usage this week</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(adviceSummary.topUsed || []).slice(0, 3).map((item: any) => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                                <span className="font-bold">{item.name}</span>
                                <span className="text-muted">{item.weeklyUsage.toFixed(1)} {item.unit}</span>
                            </div>
                        ))}
                        {(!adviceSummary.topUsed || adviceSummary.topUsed.length === 0) && (
                            <div className="text-sm text-muted">No usage history yet.</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Category</th>
                            <th>Stock Level</th>
                            <th>Usage Advice</th>
                            <th>Unit Cost</th>
                            <th>Supplier</th>
                            {canManageInventory && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(item => {
                            const status = getStatus(item);
                            const pct = getPercentage(item);
                            return (
                                <tr key={item.id} style={focusConfig ? { background: item.advice === focus ? focusConfig.background : 'transparent' } : undefined}>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            {status === 'critical' && <AlertTriangle size={14} className="text-danger" />}
                                            <span className="font-bold">{item.name}</span>
                                        </div>
                                    </td>
                                    <td><span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>{item.category}</span></td>
                                    <td style={{ minWidth: 200 }}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-bold">{item.currentStock} {item.unit}</span>
                                            <span className="text-muted">Max {item.maxStock ?? '-'}</span>
                                        </div>
                                        <div className="stock-bar-wrap">
                                            <div className="stock-bar">
                                                <div className={`stock-fill ${status}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ minWidth: 220 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <span className="badge" style={{
                                                background: item.advice === 'reorder_now' ? 'rgba(239,68,68,0.12)' : item.advice === 'reorder_soon' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                                                color: item.advice === 'reorder_now' ? '#ef4444' : item.advice === 'reorder_soon' ? '#f59e0b' : '#22c55e',
                                            }}>
                                                {item.advice === 'reorder_now' ? 'Reorder now' : item.advice === 'reorder_soon' ? 'Reorder soon' : 'Healthy'}
                                            </span>
                                            <div className="text-sm text-muted">{formatDaysRemaining(item.daysRemaining)}</div>
                                            {item.recommendedReorderQty > 0 && (
                                                <div className="text-sm">
                                                    Buy about <span className="font-bold">{item.recommendedReorderQty.toFixed(1)} {item.unit}</span>
                                                </div>
                                            )}
                                            {item.drivers?.length ? (
                                                <div className="text-xs text-muted">
                                                    Driven by {item.drivers.map((driver) => driver.menuItemName).join(', ')}
                                                </div>
                                            ) : null}
                                            {focusConfig && (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: focusConfig.accent }}>
                                                    Opened from dashboard alert <ArrowRight size={12} />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="font-bold">{formatCurrency(item.cost || 0, settings.currencySymbol)} /{item.unit}</td>
                                    <td className="text-muted text-sm">{item.supplier || '-'}</td>
                                    {canManageInventory && (
                                        <td>
                                            <div className="flex gap-2">
                                                <button className="btn btn-icon btn-secondary" title="Edit" onClick={() => openEditModal(item)}><Edit2 size={14} /></button>
                                                <button className="btn btn-icon btn-danger" title="Delete" onClick={() => deleteItem(item)}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr><td colSpan={canManageInventory ? 7 : 6} className="empty-state">No inventory items found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 560, position: 'relative' }}>
                        <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <X size={18} />
                        </button>
                        <h3 className="card-title mb-4">{form.id ? 'Edit Inventory Item' : 'Add Inventory Item'}</h3>

                        <form onSubmit={submitForm} className="flex flex-col gap-4">
                            <div className="grid-2 gap-4">
                                <div>
                                    <label className="block text-sm text-muted mb-1" htmlFor="inventory-item-name">Item Name</label>
                                    <input id="inventory-item-name" required type="text" className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted mb-1" htmlFor="inventory-category">Category</label>
                                    <input id="inventory-category" required type="text" className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid-2 gap-4">
                                <div>
                                    <label className="block text-sm text-muted mb-1" htmlFor="inventory-unit">Unit</label>
                                    <input id="inventory-unit" required type="text" className="form-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="kg, bottles, packs" />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted mb-1" htmlFor="inventory-unit-cost">Unit Cost</label>
                                    <input id="inventory-unit-cost" type="number" step="0.01" className="form-input" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid-3 gap-4">
                                <div>
                                    <label className="block text-sm text-muted mb-1" htmlFor="inventory-current-stock">Current Stock</label>
                                    <input id="inventory-current-stock" required type="number" step="0.01" className="form-input" value={form.currentStock} onChange={e => setForm({ ...form, currentStock: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted mb-1" htmlFor="inventory-min-stock">Minimum Stock</label>
                                    <input id="inventory-min-stock" required type="number" step="0.01" className="form-input" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted mb-1" htmlFor="inventory-max-stock">Maximum Stock</label>
                                    <input id="inventory-max-stock" type="number" step="0.01" className="form-input" value={form.maxStock} onChange={e => setForm({ ...form, maxStock: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid-2 gap-4">
                                <div>
                                    <label className="block text-sm text-muted mb-1" htmlFor="inventory-supplier">Supplier</label>
                                    <input id="inventory-supplier" type="text" className="form-input" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted mb-1" htmlFor="inventory-storage-location">Storage Location</label>
                                    <input id="inventory-storage-location" type="text" className="form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid-2 gap-4">
                                <div>
                                    <label className="block text-sm text-muted mb-1" htmlFor="inventory-last-restocked">Last Restocked</label>
                                    <input id="inventory-last-restocked" type="date" className="form-input" value={form.lastRestocked} onChange={e => setForm({ ...form, lastRestocked: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted mb-1" htmlFor="inventory-expiry-date">Expiry Date</label>
                                    <input id="inventory-expiry-date" type="date" className="form-input" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary justify-center" style={{ padding: 12 }} disabled={saving}>
                                {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Create Inventory Item'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
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
