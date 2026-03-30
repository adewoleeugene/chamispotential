'use client';
import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { ResponsiveContainer, BarChart as RevenueChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Search, Plus, Minus, Trash2, CreditCard, BarChart3, DollarSign, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { getDefaultRouteForRole } from '@/lib/roleRoutes';
import {
    getOrderPaymentConfig,
    isManualPaymentMethod,
    type BillingMode,
    type DeferredPaymentMethod,
    type PaymentMethod,
} from '@/lib/payment-flow';

type ManagerRange = 'day' | 'week' | 'month';
type CheckoutPromptState =
    | { kind: 'new_order_billing' }
    | { kind: 'new_order_payment_method' }
    | { kind: 'open_bill_payment_method'; orderId: string; totalAmount: number }
    | null;

export default function OrdersPage() {
    const { user, loading: authLoading } = useAuth();
    const { settings } = useSettings();
    const router = useRouter();
    const [categories, setCategories] = useState<any[]>([]);
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [tables, setTables] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [managerRange, setManagerRange] = useState<ManagerRange>('week');
    const [managerData, setManagerData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isFilterPending, startFilterTransition] = useTransition();
    const hasLoadedManagerViewRef = useRef(false);
    const toast = useToast();

    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [cart, setCart] = useState<{ id: string, name: string, price: number, quantity: number, notes: string }[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [orderType, setOrderType] = useState('dine-in');
    const [customerName, setCustomerName] = useState('');
    const [discount, setDiscount] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [confirmingPayment, setConfirmingPayment] = useState(false);
    const [checkoutPrompt, setCheckoutPrompt] = useState<CheckoutPromptState>(null);

    useEffect(() => {
        if (authLoading || !user) return;

        if (user.role !== 'manager') {
            router.replace(getDefaultRouteForRole(user.role));
            return;
        }

        if (hasLoadedManagerViewRef.current) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        fetch(`/api/reports?range=${managerRange}`)
            .then(r => r.json())
            .then((reportData) => {
                setManagerData(reportData);
                setLoading(false);
                setRefreshing(false);
                hasLoadedManagerViewRef.current = true;

                // Reset waiter-specific state when a manager lands here after a role switch.
                setCategories([]);
                setMenuItems([]);
                setTables([]);
                setOrders([]);
            })
            .catch(() => {
                setManagerData(null);
                setLoading(false);
                setRefreshing(false);
                toast('error', 'Failed to load manager order analytics');
            });
    }, [authLoading, managerRange, router, toast, user]);

    useEffect(() => {
        if (!authLoading && user && user.role !== 'manager') {
            router.replace(getDefaultRouteForRole(user.role));
        }
    }, [authLoading, router, user]);

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

    const resetOrderComposer = () => {
        setCart([]);
        setSelectedTable('');
        setCustomerName('');
        setDiscount(0);
        setOrderType('dine-in');
    };

    const startMonimeCheckout = async (payload: Record<string, unknown>) => {
        const res = await fetch('/api/payments/monime/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.redirectUrl) {
            throw new Error(data?.error || 'Failed to start Monime checkout');
        }

        toast('info', 'Redirecting to Monime checkout...');
        window.location.href = data.redirectUrl;
    };

    const confirmManualPayment = async (orderId: string, methodOverride?: string) => {
        let storedMethod = methodOverride as DeferredPaymentMethod | undefined;
        if (!storedMethod) {
            const orderObj = orders.find((o: any) => o.id === orderId);
            storedMethod = isManualPaymentMethod(orderObj?.paymentMethod) ? orderObj?.paymentMethod : 'cash';
        }

        setConfirmingPayment(true);
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'confirm_manual_payment', paymentMethod: storedMethod })
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(data?.error || 'Failed to confirm payment');
            }

            toast('success', 'Payment recorded successfully');
            setCheckoutPrompt(null);
            await refreshOrders();
            const tablesRes = await fetch('/api/tables');
            const tablesData = await tablesRes.json();
            setTables(tablesData.filter((t: any) => t.status !== 'cleaning'));
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to confirm payment');
        } finally {
            setConfirmingPayment(false);
        }
    };

    const submitOrder = async (decision: { billingMode: BillingMode; paymentMethod?: PaymentMethod }) => {
        if (cart.length === 0) return toast('error', 'Cart is empty');
        if (orderType === 'dine-in' && !selectedTable) return toast('error', 'Select a table for dine-in');
        setSubmitting(true);

        const paymentConfig = getOrderPaymentConfig(
            decision.billingMode === 'open_tab'
                ? { billingMode: 'open_tab' }
                : { billingMode: 'pay_now', paymentMethod: decision.paymentMethod || 'cash' }
        );

        const payload = {
            tableId: selectedTable || null,
            type: orderType,
            customerName: customerName || undefined,
            discount,
            ...paymentConfig,
            items: cart.map(i => ({ menuItemId: i.id, quantity: i.quantity, notes: i.notes }))
        };

        try {
            if (decision.billingMode === 'pay_now' && decision.paymentMethod === 'monime') {
                await startMonimeCheckout(payload);
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
            await res.json();

            toast(
                'success',
                decision.billingMode === 'open_tab'
                    ? 'Order sent to kitchen. The tab will stay open until the guest is ready to pay.'
                    : 'Payment recorded and order sent to kitchen.'
            );
            setCheckoutPrompt(null);
            resetOrderComposer();
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

    const settleOpenBillWithMonime = async (orderId: string) => {
        setSubmitting(true);
        try {
            await startMonimeCheckout({ orderId });
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to start Monime checkout');
            setSubmitting(false);
        }
    };

    const openPlaceOrderPrompt = () => {
        if (cart.length === 0) {
            toast('error', 'Cart is empty');
            return;
        }
        if (orderType === 'dine-in' && !selectedTable) {
            toast('error', 'Select a table for dine-in');
            return;
        }
        setCheckoutPrompt({ kind: 'new_order_billing' });
    };

    if (authLoading || !user || (loading && !managerData)) {
        return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;
    }

    if (user.role === 'manager') {
        const summaryCards = [
            {
                label: `${managerData?.label || 'Period'} Orders`,
                value: String(managerData?.summary?.totalOrders || 0),
                accent: '#f59e0b',
                icon: ShoppingCart,
            },
            {
                label: `${managerData?.label || 'Period'} Revenue`,
                value: formatCurrency(managerData?.summary?.totalRevenue || 0, settings.currencySymbol),
                accent: '#38bdf8',
                icon: DollarSign,
            },
            {
                label: 'Average Ticket',
                value: formatCurrency(managerData?.summary?.avgTicket || 0, settings.currencySymbol),
                accent: '#22c55e',
                icon: BarChart3,
            },
        ];

        return (
            <AppLayout>
                <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700 }} className="flex items-center gap-2">
                            <BarChart3 size={20} className="text-brand-500" /> Order Performance
                        </h2>
                        <p className="text-muted text-sm mt-1">Manager order analytics with filterable day, week, and month views.</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {(refreshing || isFilterPending) && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '6px 10px',
                                borderRadius: 999,
                                background: 'rgba(56,189,248,0.14)',
                                color: '#bae6fd',
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: 0.4,
                            }}>
                                Refreshing
                            </span>
                        )}
                        <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'rgba(15,23,42,0.82)', border: '1px solid rgba(148,163,184,0.18)' }}>
                            {(['day', 'week', 'month'] as ManagerRange[]).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => startFilterTransition(() => setManagerRange(item))}
                                    style={{
                                        border: 'none',
                                        borderRadius: 999,
                                        background: managerRange === item ? 'rgba(56,189,248,0.16)' : 'transparent',
                                        color: managerRange === item ? '#e0f2fe' : '#94a3b8',
                                        padding: '10px 16px',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {item.charAt(0).toUpperCase() + item.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid-3 gap-4 mb-4">
                    {summaryCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div key={card.label} className="card" style={{ padding: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                                    <div className="text-muted text-sm font-bold uppercase">{card.label}</div>
                                    <div style={{ width: 40, height: 40, borderRadius: 14, background: `${card.accent}20`, color: card.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Icon size={18} />
                                    </div>
                                </div>
                                <div style={{ fontSize: 28, fontWeight: 800, color: '#f8fafc' }}>{card.value}</div>
                            </div>
                        );
                    })}
                </div>

                <div className="grid-2 gap-4 mb-4">
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">Order Rhythm</h3>
                                <p className="card-subtitle">{managerData?.chartLabel || 'Order trend'} across {managerData?.label?.toLowerCase() || 'this range'}</p>
                            </div>
                        </div>
                        <div style={{ height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RevenueChart data={managerData?.trend || []}>
                                    <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                                    <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            background: '#0f172a',
                                            border: '1px solid rgba(148,163,184,0.2)',
                                            borderRadius: 14,
                                        }}
                                    />
                                    <Bar dataKey="orders" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                                </RevenueChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">Order Mix</h3>
                                <p className="card-subtitle">Service split for the selected manager window</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {(managerData?.orderTypeMix || []).map((entry: any) => (
                                <div key={entry.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                                    <div>
                                        <div className="font-bold" style={{ textTransform: 'capitalize' }}>{entry.type}</div>
                                        <div className="text-xs text-muted">{entry.count} orders</div>
                                    </div>
                                    <div className="font-bold">{formatCurrency(entry.revenue || 0, settings.currencySymbol)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid-2 gap-4">
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">Top Ordered Items</h3>
                                <p className="card-subtitle">Best-performing menu items in the selected period</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(managerData?.topItems || []).map((item: any) => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                                    <div>
                                        <div className="font-bold">{item.name}</div>
                                        <div className="text-xs text-muted">{item.quantity} orders</div>
                                    </div>
                                    <div className="font-bold">{formatCurrency(item.revenue || 0, settings.currencySymbol)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">Manager Notes</h3>
                                <p className="card-subtitle">Summary points from the current order window</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {(managerData?.insights || []).map((insight: string, index: number) => (
                                <div key={index} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
                                    <div className="text-sm text-muted">{insight}</div>
                                </div>
                            ))}
                            {(!managerData?.insights || managerData.insights.length === 0) && (
                                <div className="text-sm text-muted">No manager-facing order insights available yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (user.role !== 'waiter') {
        return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;
    }

    const pendingCheckoutOrders = orders.filter((order: any) =>
        order.status === 'payment_pending_confirmation'
        || (order.paymentMethod !== 'monime'
            && order.paymentStatus !== 'paid'
            && ['pending', 'preparing', 'ready', 'served', 'completed', 'draft'].includes(order.status))
    );

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
                            <input aria-label="Menu Search" type="text" placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
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
                            <select aria-label="Order Type" className="form-select text-sm" value={orderType} onChange={e => setOrderType(e.target.value)}>
                                <option value="dine-in">Dine-in</option>
                                <option value="takeout">Takeout</option>
                                <option value="delivery">Delivery</option>
                            </select>
                            {orderType === 'dine-in' ? (
                                <select aria-label="Service Table" className="form-select text-sm" value={selectedTable} onChange={e => setSelectedTable(e.target.value)}>
                                    <option value="">Select Table...</option>
                                    {tables.map(t => <option key={t.id} value={t.id}>{t.section || `Table ${t.number}`} {t.mergeGroupId ? '(MERGED)' : ''} ({t.capacity}pax)</option>)}
                                </select>
                            ) : (
                                <input aria-label="Customer Name" type="text" className="form-input text-sm" placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                            )}
                        </div>
                        <div className="grid-2 gap-2 mt-2">
                            <div style={{ gridColumn: '1 / -1', padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(56,189,248,0.18)', background: 'rgba(14,165,233,0.08)', color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>
                                Click place order first, then choose whether this guest is paying now or keeping the tab open until they are ready to leave.
                            </div>
                            <input
                                aria-label="Discount"
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-input text-sm"
                                placeholder="Discount"
                                value={discount || ''}
                                onChange={e => setDiscount(Number(e.target.value) || 0)}
                                style={{ gridColumn: '1 / -1' }}
                            />
                        </div>
                    </div>

                    <div className="cart-items">
                        {pendingCheckoutOrders.length > 0 && (
                            <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: 8 }}>Open Bills</div>
                                {pendingCheckoutOrders.slice(0, 5).map((order: any) => {
                                    return (
                                        <div key={order.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                                            <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                                                <strong>#{order.orderNumber}</strong>
                                                <span className={`badge ${order.paymentStatus}`}>{order.paymentStatus}</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                                {order.table?.number ? `Table ${order.table.number}` : order.customerName || order.type} • {formatCurrency(order.total, settings.currencySymbol)}
                                            </div>
                                            {order.paymentStatus !== 'processing' ? (
                                                <button className="btn btn-success w-full" onClick={() => setCheckoutPrompt({ kind: 'open_bill_payment_method', orderId: order.id, totalAmount: order.total })} style={{ justifyContent: 'center', padding: 10 }}>
                                                    Settle Bill
                                                </button>
                                            ) : (
                                                <div style={{ fontSize: 12, color: '#38bdf8' }}>Waiting for Monime confirmation</div>
                                            )}
                                        </div>
                                    );
                                })}
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

                        <button className="btn btn-primary w-full" onClick={openPlaceOrderPrompt} disabled={cart.length === 0 || submitting} style={{ padding: '12px', justifyContent: 'center', fontSize: 15 }}>
                            <CreditCard size={18} /> {submitting ? 'Processing...' : 'Place Order'}
                        </button>
                    </div>
                </div>
            </div>

            {checkoutPrompt && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 24 }}>
                    <div style={{ background: 'var(--bg-card)', padding: 32, borderRadius: 'var(--radius-lg)', width: 400, textAlign: 'center', border: '1px solid var(--border)' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(56,189,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#38bdf8' }}>
                            <CreditCard size={32} />
                        </div>
                        {checkoutPrompt.kind === 'new_order_billing' ? (
                            <>
                                <h3 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>How should this order be billed?</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                                    Choose whether to collect payment now or keep the tab open until the guest is ready to leave.
                                </p>
                                <div style={{ display: 'grid', gap: 12 }}>
                                    <button className="btn btn-primary w-full" type="button" disabled={submitting} onClick={() => setCheckoutPrompt({ kind: 'new_order_payment_method' })} style={{ padding: 12, justifyContent: 'center' }}>
                                        Pay Now
                                    </button>
                                    <button className="btn btn-secondary w-full" type="button" disabled={submitting} onClick={() => submitOrder({ billingMode: 'open_tab' })} style={{ padding: 12, justifyContent: 'center' }}>
                                        Open Tab
                                    </button>
                                    <button className="btn w-full" type="button" disabled={submitting} onClick={() => setCheckoutPrompt(null)} style={{ padding: 12, justifyContent: 'center', background: 'var(--surface-active)' }}>
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : checkoutPrompt.kind === 'new_order_payment_method' ? (
                            <>
                                <h3 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>How is the guest paying now?</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                                    Use cash if payment is already collected, or launch Monime checkout before sending the order to kitchen.
                                </p>
                                <div style={{ display: 'grid', gap: 12 }}>
                                    <button className="btn btn-primary w-full" type="button" disabled={submitting} onClick={() => submitOrder({ billingMode: 'pay_now', paymentMethod: 'cash' })} style={{ padding: 12, justifyContent: 'center' }}>
                                        Cash
                                    </button>
                                    <button className="btn btn-secondary w-full" type="button" disabled={submitting} onClick={() => submitOrder({ billingMode: 'pay_now', paymentMethod: 'monime' })} style={{ padding: 12, justifyContent: 'center' }}>
                                        Monime
                                    </button>
                                    <button className="btn w-full" type="button" disabled={submitting} onClick={() => setCheckoutPrompt({ kind: 'new_order_billing' })} style={{ padding: 12, justifyContent: 'center', background: 'var(--surface-active)' }}>
                                        Back
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Settle Open Bill</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                                    Choose how the guest is paying {formatCurrency(checkoutPrompt.totalAmount, settings.currencySymbol)} for this open tab.
                                </p>
                                <div style={{ display: 'grid', gap: 12 }}>
                                    <button className="btn btn-primary w-full" type="button" disabled={confirmingPayment || submitting} onClick={() => confirmManualPayment(checkoutPrompt.orderId, 'cash')} style={{ padding: 12, justifyContent: 'center' }}>
                                        {confirmingPayment ? 'Saving...' : 'Cash'}
                                    </button>
                                    <button className="btn btn-secondary w-full" type="button" disabled={confirmingPayment || submitting} onClick={() => settleOpenBillWithMonime(checkoutPrompt.orderId)} style={{ padding: 12, justifyContent: 'center' }}>
                                        {submitting ? 'Redirecting...' : 'Monime'}
                                    </button>
                                    <button className="btn w-full" type="button" disabled={confirmingPayment || submitting} onClick={() => setCheckoutPrompt(null)} style={{ padding: 12, justifyContent: 'center', background: 'var(--surface-active)' }}>
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
