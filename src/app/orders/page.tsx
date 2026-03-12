'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Search, Plus, Minus, Trash2, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

export default function OrdersPage() {
    const { user, loading: authLoading } = useAuth();
    const { settings } = useSettings();
    const router = useRouter();
    const [categories, setCategories] = useState<any[]>([]);
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [tables, setTables] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [cart, setCart] = useState<{ id: string, name: string, price: number, quantity: number, notes: string }[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [orderType, setOrderType] = useState('dine-in');
    const [customerName, setCustomerName] = useState('');
    const [discount, setDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'monime'>('cash');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (authLoading || user?.role === 'waiter') return;

        Promise.all([
            fetch('/api/categories').then(r => r.json()),
            fetch('/api/menu').then(r => r.json()),
            fetch('/api/tables').then(r => r.json()),
            fetch('/api/orders').then(r => r.json()),
        ]).then(([cats, items, tbls, orderData]) => {
            setCategories(cats);
            setMenuItems(items);
            setTables(tbls.filter((t: any) => t.status !== 'cleaning')); // Allow available, reserved, and occupied
            setOrders(Array.isArray(orderData) ? orderData : []);
            setLoading(false);

            // Pre-select table if passed in URL
            if (typeof window !== 'undefined') {
                const urlParams = new URL(window.location.href).searchParams;
                const tableIdFromUrl = urlParams.get('tableId');
                if (tableIdFromUrl) {
                    setSelectedTable(tableIdFromUrl);
                }
            }
        }).catch(() => setLoading(false));
    }, [authLoading, user?.role]);

    useEffect(() => {
        if (!authLoading && user?.role === 'waiter') {
            router.replace('/tables');
        }
    }, [authLoading, router, user?.role]);

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
    const tax = (subtotal - discount) * taxRate;
    const total = subtotal + tax - discount;

    const refreshOrders = async () => {
        const res = await fetch('/api/orders');
        const data = await res.json();
        if (Array.isArray(data)) setOrders(data);
    };

    const confirmManualPayment = async (orderId: string, method: 'cash' | 'card' | 'mobile' = 'cash') => {
        const res = await fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'confirm_manual_payment', paymentMethod: method })
        });

        if (res.ok) {
            toast('success', 'Payment confirmed and order sent to kitchen');
            await refreshOrders();
            const tablesRes = await fetch('/api/tables');
            const tablesData = await tablesRes.json();
            setTables(tablesData.filter((t: any) => t.status !== 'cleaning'));
        } else {
            toast('error', 'Failed to confirm payment');
        }
    };

    const submitOrder = async () => {
        if (cart.length === 0) return toast('error', 'Cart is empty');
        if (orderType === 'dine-in' && !selectedTable) return toast('error', 'Select a table for dine-in');
        setSubmitting(true);

        const payload = {
            tableId: selectedTable || null,
            type: orderType,
            customerName: customerName || undefined,
            discount,
            paymentMethod,
            paymentStatus: paymentMethod === 'monime' ? 'processing' : 'unpaid',
            status: paymentMethod === 'monime' ? 'payment_pending_confirmation' : 'draft',
            deferActivation: true,
            items: cart.map(i => ({ menuItemId: i.id, quantity: i.quantity, notes: i.notes }))
        };

        try {
            if (paymentMethod === 'monime') {
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

            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error('Failed to create order');
            }

            toast('success', 'Unpaid order saved. Confirm payment to send it to kitchen.');
            setCart([]);
            setSelectedTable('');
            setCustomerName('');
            setDiscount(0);
            setOrderType('dine-in');
            setPaymentMethod('cash');
            await refreshOrders();
            const tablesRes = await fetch('/api/tables');
            const tablesData = await tablesRes.json();
            setTables(tablesData.filter((t: any) => t.status !== 'cleaning'));
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to create order');
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading || user?.role === 'waiter' || loading) {
        return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;
    }

    return (
        <AppLayout>
            <div className="pos-layout">
                <div className="pos-menu">
                    <div className="flex justify-between items-center mb-4">
                        <div className="category-tabs">
                            <button className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>All Items</button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(cat.id)}
                                >
                                    {cat.icon} {cat.name}
                                </button>
                            ))}
                        </div>
                        <div className="search-input">
                            <Search size={16} />
                            <input type="text" placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                    </div>

                    <div className="menu-grid">
                        {filteredItems.map(item => (
                            <div key={item.id} className="menu-item-card" onClick={() => addToCart(item)} style={{ cursor: 'pointer' }}>
                                <div className="menu-item-image">
                                    {item.category?.icon || '🍽️'}
                                    {item.isPopular && <span className="popular-badge">Popular</span>}
                                </div>
                                <div className="menu-item-body">
                                    <div className="menu-item-name">{item.name}</div>
                                    <div className="menu-item-desc">{item.description}</div>
                                    <div className="menu-item-footer mt-2">
                                        <div className="menu-item-price">{formatCurrency(item.price, settings.currencySymbol)}</div>
                                        <div className="menu-item-cat">{item.category?.name}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {filteredItems.length === 0 && <div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-title">No items found</div></div>}
                </div>

                <div className="pos-cart">
                    <div className="pos-cart-header">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="pos-cart-title">Current Order</h2>
                            <span className="pos-cart-count">{cart.length} items</span>
                        </div>
                        <div className="grid-2 gap-2">
                            <select className="form-select text-sm" value={orderType} onChange={e => setOrderType(e.target.value)}>
                                <option value="dine-in">Dine-in</option>
                                <option value="takeout">Takeout</option>
                                <option value="delivery">Delivery</option>
                            </select>
                            {orderType === 'dine-in' ? (
                                <select className="form-select text-sm" value={selectedTable} onChange={e => setSelectedTable(e.target.value)}>
                                    <option value="">Select Table...</option>
                                    {tables.map(t => <option key={t.id} value={t.id}>{t.section || `Table ${t.number}`} {t.mergeGroupId ? '(MERGED)' : ''} ({t.capacity}pax)</option>)}
                                </select>
                            ) : (
                                <input type="text" className="form-input text-sm" placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                            )}
                        </div>
                        <div className="grid-2 gap-2 mt-2">
                            <select className="form-select text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as 'cash' | 'monime')}>
                                <option value="cash">Manual payment</option>
                                <option value="monime">Monime checkout</option>
                            </select>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-input text-sm"
                                placeholder="Discount"
                                value={discount || ''}
                                onChange={e => setDiscount(Number(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div className="cart-items">
                        {orders.filter((order: any) => ['draft', 'payment_pending_confirmation'].includes(order.status)).length > 0 && (
                            <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: 8 }}>Awaiting Payment</div>
                                {orders.filter((order: any) => ['draft', 'payment_pending_confirmation'].includes(order.status)).slice(0, 5).map((order: any) => (
                                    <div key={order.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                                        <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                                            <strong>#{order.orderNumber}</strong>
                                            <span className={`badge ${order.paymentStatus}`}>{order.paymentStatus}</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                            {order.table?.number ? `Table ${order.table.number}` : order.customerName || order.type} • {formatCurrency(order.total, settings.currencySymbol)}
                                        </div>
                                        {order.status === 'draft' ? (
                                            <button className="btn btn-success w-full" onClick={() => confirmManualPayment(order.id)} style={{ justifyContent: 'center', padding: 10 }}>
                                                Confirm Cash Payment
                                            </button>
                                        ) : (
                                            <div style={{ fontSize: 12, color: '#38bdf8' }}>Waiting for Monime confirmation</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {cart.map((item) => (
                            <div key={item.id} className="cart-item">
                                <div className="cart-item-info">
                                    <div className="cart-item-name">{item.name}</div>
                                    <div className="cart-item-price">{formatCurrency(item.price, settings.currencySymbol)}</div>
                                </div>
                                <div className="cart-qty-controls">
                                    <button className="qty-btn" onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></button>
                                    <span className="qty-val">{item.quantity}</span>
                                    <button className="qty-btn" onClick={() => updateQuantity(item.id, 1)}><Plus size={14} /></button>
                                    <button className="qty-btn" style={{ marginLeft: 6, borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }} onClick={() => removeFromCart(item.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {cart.length === 0 && <div className="empty-state" style={{ padding: '40px 20px' }}><div className="empty-state-icon">🛒</div><div className="empty-state-title">Cart is empty</div><div className="empty-state-text">Select items from the menu to add them to the order.</div></div>}
                    </div>

                    <div className="pos-cart-footer">
                        <div className="cart-totals">
                            <div className="cart-total-row"><span>Subtotal</span><span>{formatCurrency(subtotal, settings.currencySymbol)}</span></div>
                            <div className="cart-total-row"><span>Tax ({Number(settings.taxRate || '10')}%)</span><span>{formatCurrency(tax, settings.currencySymbol)}</span></div>
                            {discount > 0 && <div className="cart-total-row" style={{ color: 'var(--success)' }}><span>Discount</span><span>-{formatCurrency(discount, settings.currencySymbol)}</span></div>}
                            <div className="cart-total-row grand-total"><span>Total</span><span>{formatCurrency(total, settings.currencySymbol)}</span></div>
                        </div>

                        <button className="btn btn-primary w-full" onClick={submitOrder} disabled={cart.length === 0 || submitting} style={{ padding: '12px', justifyContent: 'center', fontSize: 15 }}>
                            <CreditCard size={18} /> {submitting ? 'Processing...' : paymentMethod === 'monime' ? 'Pay with Monime' : 'Save Unpaid Order'}
                        </button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
