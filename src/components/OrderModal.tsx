import React, { useEffect, useState } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency } from '@/lib/currency';

export default function OrderModal({ table, onClose }: { table: any, onClose: () => void }) {
    const { settings } = useSettings();
    const [categories, setCategories] = useState<any[]>([]);
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<{ id: string, name: string, price: number, quantity: number, notes: string }[]>([]);
    const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'monime'>('cash');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch('/api/categories').then(r => r.json()),
            fetch('/api/menu').then(r => r.json()),
        ]).then(([cats, items]) => {
            setCategories(cats);
            setMenuItems(items);
            setLoading(false);
        });
    }, []);

    const filteredItems = menuItems.filter(item => {
        const matchesCat = activeCategory === 'all' || item.categoryId === activeCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
    });

    const addToCart = (item: any) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, notes: '' }];
        });
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(i => {
            if (i.id === id) {
                const newQ = i.quantity + delta;
                return newQ > 0 ? { ...i, quantity: newQ } : i;
            }
            return i;
        }).filter(i => i.quantity > 0));
    };

    const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = Number(settings.taxRate || '10') / 100;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    const submitOrder = async () => {
        if (cart.length === 0) return toast('error', 'Cart is empty');
        setSubmitting(true);

        const payload = {
            tableId: table.id,
            type: 'dine-in',
            paymentMethod,
            paymentStatus: paymentMethod === 'monime' ? 'processing' : 'unpaid',
            status: paymentMethod === 'monime' ? 'payment_pending_confirmation' : 'draft',
            deferActivation: true,
            items: cart.map(i => ({ menuItemId: i.id, quantity: i.quantity, notes: i.notes }))
        };

        try {
            if (!editingOrderId && paymentMethod === 'monime') {
                const res = await fetch('/api/payments/monime/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (!res.ok || !data.redirectUrl) {
                    throw new Error(data.error || 'Failed to start Monime checkout');
                }

                toast('info', 'Redirecting to Monime checkout...');
                window.location.href = data.redirectUrl;
                return;
            }

            const method = editingOrderId ? 'PATCH' : 'POST';
            const url = editingOrderId ? `/api/orders/${editingOrderId}` : '/api/orders';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error(editingOrderId ? 'Failed to update order' : 'Failed to create order');
            }

            toast('success', editingOrderId ? 'Order updated successfully' : paymentMethod === 'monime' ? 'Checkout created. Waiting for payment confirmation.' : 'Unpaid order saved. Confirm payment to send it to the kitchen.');
            setEditingOrderId(null);
            setPaymentMethod('cash');
            onClose();
        } catch (error) {
            toast('error', error instanceof Error ? error.message : editingOrderId ? 'Failed to update order' : 'Failed to create order');
        } finally {
            setSubmitting(false);
        }
    };

    const cancelSentOrder = async (orderId: string) => {
        const res = await fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
        });
        if (res.ok) {
            toast('success', 'Order cancelled successfully');
            onClose();
        } else {
            toast('error', 'Failed to cancel order');
        }
    };

    const confirmManualPayment = async (orderId: string) => {
        const res = await fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'confirm_manual_payment', paymentMethod: 'cash' })
        });

        if (res.ok) {
            toast('success', 'Payment confirmed and order sent to kitchen');
            onClose();
        } else {
            toast('error', 'Failed to confirm payment');
        }
    };

    const loadOrderToEdit = (order: any) => {
        setEditingOrderId(order.id);
        setCart(order.items.map((item: any) => ({
            id: item.menuItemId,
            name: item.menuItem?.name || 'Item',
            price: item.unitPrice,
            quantity: item.quantity,
            notes: item.notes || ''
        })));
    };

    return (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
            <div className="pos-layout" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 1200, height: '90vh', overflow: 'hidden', animation: 'slideUp 0.3s ease-out', border: '1px solid var(--border)', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={18} />
                </button>

                {loading ? (
                    <div className="loading-spinner" style={{ margin: 'auto', marginTop: '40vh' }} />
                ) : (
                    <>
                        <div className="pos-menu" style={{ overflowY: 'auto' }}>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <h2 className="card-title">Order for {table.section || `Table ${table.number}`}</h2>
                                    {table.mergeGroupId && (
                                        <span style={{ fontSize: 10, background: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>Merged</span>
                                    )}
                                </div>
                                {table.mergeGroupId && (
                                    <button
                                        onClick={async () => {
                                            const res = await fetch('/api/tables/unmerge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableId: table.id }) });
                                            if (res.ok) { toast('success', 'Tables unmerged successfully'); onClose(); }
                                            else { toast('error', 'Failed to unmerge tables'); }
                                        }}
                                        style={{ fontSize: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        Unmerge Tables
                                    </button>
                                )}
                            </div>
                            <div className="flex justify-between items-center mb-4">
                                <div className="category-tabs" style={{ flexWrap: 'wrap' }}>
                                    <button className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>All</button>
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
                                            onClick={() => setActiveCategory(cat.id)}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="search-input" style={{ width: 200 }}>
                                    <Search size={16} />
                                    <input type="text" placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                </div>
                            </div>

                            <div className="menu-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                                {filteredItems.map(item => (
                                    <div key={item.id} className="menu-item-card" onClick={() => addToCart(item)} style={{ cursor: 'pointer', padding: 12 }}>
                                        <div className="menu-item-body">
                                            <div className="menu-item-name" style={{ fontSize: 14 }}>{item.name}</div>
                                            <div className="menu-item-footer mt-2">
                                                <div className="menu-item-price">{formatCurrency(item.price, settings.currencySymbol)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {filteredItems.length === 0 && <div className="empty-state">No items found</div>}
                        </div>

                        <div className="pos-cart" style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>
                            <div className="pos-cart-header" style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                                <div className="flex justify-between items-center">
                                    <h2 className="pos-cart-title">Cart</h2>
                                    <span className="pos-cart-count">{cart.length} items</span>
                                </div>
                                <div className="badge mt-2" style={{ background: 'rgba(255,255,255,0.1)' }}>Table {table.number}</div>
                                {!editingOrderId && (
                                    <div className="mt-3">
                                        <select className="form-select text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as 'cash' | 'monime')}>
                                            <option value="cash">Manual payment</option>
                                            <option value="monime">Monime checkout</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="cart-items" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                                {table.orders && table.orders.length > 0 && (
                                    <div className="mb-4" style={{ borderBottom: '2px solid var(--border)', paddingBottom: 16 }}>
                                        <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: 8 }}>Already Sent</div>
                                        {table.orders.map((o: any) => (
                                            <div key={o.id} style={{ marginBottom: 12, border: '1px solid var(--border)', padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className={`badge ${o.status}`} style={{ fontSize: 9 }}>{o.status}</span>
                                                    {['draft', 'payment_pending_confirmation', 'pending'].includes(o.status) && (
                                                        <div className="flex gap-3 items-center">
                                                            {confirmCancelId === o.id ? (
                                                                <div className="flex gap-2 items-center">
                                                                    <button onClick={() => setConfirmCancelId(null)} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>Keep</button>
                                                                    <button onClick={() => cancelSentOrder(o.id)} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Confirm Cancel</button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {o.status === 'draft' && o.paymentStatus !== 'paid' && (
                                                                        <button
                                                                            onClick={() => confirmManualPayment(o.id)}
                                                                            style={{ fontSize: 11, color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                                                                        >
                                                                            Confirm Payment
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => loadOrderToEdit(o)}
                                                                        style={{ fontSize: 11, color: 'var(--brand-400)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setConfirmCancelId(o.id)}
                                                                        style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {o.items.map((item: any) => (
                                                    <div key={item.id} className="cart-item" style={{ padding: '4px 0', opacity: 0.8 }}>
                                                        <div className="flex justify-between w-full">
                                                            <div className="cart-item-name" style={{ fontSize: 13 }}>{item.quantity}x {item.menuItem?.name || 'Item'}</div>
                                                            <div className="cart-item-price" style={{ fontSize: 12 }}>{formatCurrency(item.unitPrice * item.quantity, settings.currencySymbol)}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                        <div className="mt-2 text-right">
                                            <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--brand-500)' }}>Active Tab: {formatCurrency(table.orders.reduce((sum: number, o: any) => sum + o.total, 0), settings.currencySymbol)}</span>
                                        </div>
                                    </div>
                                )}

                                {cart.length > 0 && <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: 8 }}>New Items</div>}
                                {cart.map((item) => (
                                    <div key={item.id} className="cart-item" style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                                        <div className="cart-item-info">
                                            <div className="cart-item-name" style={{ fontSize: 13 }}>{item.name}</div>
                                            <div className="cart-item-price" style={{ fontSize: 12 }}>{formatCurrency(item.price, settings.currencySymbol)}</div>
                                        </div>
                                        <div className="cart-qty-controls" style={{ gap: 8 }}>
                                            <button className="qty-btn" onClick={() => updateQuantity(item.id, -1)}><Minus size={12} /></button>
                                            <span className="qty-val" style={{ fontSize: 12 }}>{item.quantity}</span>
                                            <button className="qty-btn" onClick={() => updateQuantity(item.id, 1)}><Plus size={12} /></button>
                                            <button className="qty-btn" style={{ marginLeft: 4, borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }} onClick={() => removeFromCart(item.id)}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {cart.length === 0 && (!table.orders || table.orders.length === 0) && <div className="empty-state text-sm py-8"><div className="empty-state-title">Cart is empty</div></div>}
                            </div>

                            <div className="pos-cart-footer" style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
                                <div className="cart-totals">
                                    <div className="cart-total-row" style={{ fontSize: 13 }}><span>Subtotal</span><span>{formatCurrency(subtotal, settings.currencySymbol)}</span></div>
                                    <div className="cart-total-row" style={{ fontSize: 13 }}><span>Tax ({Number(settings.taxRate || '10')}%)</span><span>{formatCurrency(tax, settings.currencySymbol)}</span></div>
                                    <div className="cart-total-row grand-total" style={{ fontSize: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}><span>Total</span><span>{formatCurrency(total, settings.currencySymbol)}</span></div>
                                </div>

                                {editingOrderId ? (
                                    <div className="flex gap-2 mt-4">
                                        <button className="btn w-full" onClick={() => { setEditingOrderId(null); setCart([]); }} style={{ padding: 12, justifyContent: 'center', background: 'var(--surface-active)' }}>
                                            Cancel Edit
                                        </button>
                                        <button className="btn btn-primary w-full" onClick={submitOrder} disabled={cart.length === 0 || submitting} style={{ padding: 12, justifyContent: 'center' }}>
                                            Save Changes
                                        </button>
                                    </div>
                                ) : (
                                    <button className="btn btn-primary w-full mt-4" onClick={submitOrder} disabled={cart.length === 0 || submitting} style={{ padding: 12, justifyContent: 'center' }}>
                                        <CreditCard size={16} /> {submitting ? 'Processing...' : paymentMethod === 'monime' ? 'Pay with Monime' : 'Save Unpaid Order'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
