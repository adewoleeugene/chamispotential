'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Plus, Edit2, Trash2, Search, AlertTriangle } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency } from '@/lib/currency';

export default function InventoryPage() {
    const { settings } = useSettings();
    const [items, setItems] = useState<any[]>([]);
    const [adviceSummary, setAdviceSummary] = useState<any>({ reorderNow: 0, reorderSoon: 0, topUsed: [] });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const toast = useToast();

    useEffect(() => {
        fetch('/api/inventory')
            .then(r => r.json())
            .then(d => {
                setItems(Array.isArray(d.items) ? d.items : []);
                setAdviceSummary(d.adviceSummary || { reorderNow: 0, reorderSoon: 0, topUsed: [] });
                setLoading(false);
            });
    }, []);

    const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()));

    const getStatus = (item: any) => {
        if (item.currentStock <= item.minStock) return 'critical';
        if (item.currentStock <= item.minStock * 1.5) return 'warning';
        return 'good';
    };

    const getPercentage = (item: any) => Math.min(100, (item.currentStock / item.maxStock) * 100);
    const formatDaysRemaining = (daysRemaining: number | null) => {
        if (daysRemaining == null) return 'No usage data yet';
        if (daysRemaining < 1) return 'Less than 1 day left';
        return `${daysRemaining.toFixed(1)} days left`;
    };

    if (loading) return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;

    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6">
                <div className="search-input" style={{ width: 300 }}>
                    <Search size={16} />
                    <input type="text" placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button className="btn btn-primary"><Plus size={16} /> Add Inventory</button>
            </div>

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
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(item => {
                            const status = getStatus(item);
                            const pct = getPercentage(item);
                            return (
                                <tr key={item.id}>
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
                                            <span className="text-muted">Max {item.maxStock}</span>
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
                                            {item.drivers?.length > 0 && (
                                                <div className="text-xs text-muted">
                                                    Driven by {item.drivers.map((driver: any) => driver.menuItemName).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="font-bold">{formatCurrency(item.cost, settings.currencySymbol)} /{item.unit}</td>
                                    <td className="text-muted text-sm">{item.supplier || '-'}</td>
                                    <td>
                                        <div className="flex gap-2">
                                            <button className="btn btn-icon btn-secondary" title="Edit"><Edit2 size={14} /></button>
                                            <button className="btn btn-icon btn-danger" title="Delete"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr><td colSpan={7} className="empty-state">No inventory items found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AppLayout>
    );
}
