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
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const toast = useToast();

    useEffect(() => {
        fetch('/api/inventory').then(r => r.json()).then(d => { setItems(d); setLoading(false); });
    }, []);

    const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()));

    const getStatus = (item: any) => {
        if (item.currentStock <= item.minStock) return 'critical';
        if (item.currentStock <= item.minStock * 1.5) return 'warning';
        return 'good';
    };

    const getPercentage = (item: any) => Math.min(100, (item.currentStock / item.maxStock) * 100);

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

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Category</th>
                            <th>Stock Level</th>
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
                            <tr><td colSpan={6} className="empty-state">No inventory items found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AppLayout>
    );
}
