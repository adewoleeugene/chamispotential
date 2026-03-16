'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { ResponsiveContainer, BarChart as RevenueChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Search, Plus, Minus, Trash2, CreditCard, BarChart3, DollarSign, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import PaymentFlowSelector from '@/components/PaymentFlowSelector';
import { getDefaultRouteForRole } from '@/lib/roleRoutes';
import {
    getManualPaymentMethodLabel,
    getOrderPaymentConfig,
    isManualPaymentMethod,
    type ManualPaymentFlow,
    type ManualPaymentMethod,
    type PaymentChannel,
} from '@/lib/payment-flow';

const ensureArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
type ManagerRange = 'day' | 'week' | 'month';

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
    const toast = useToast();

    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [cart, setCart] = useState<{ id: string, name: string, price: number, quantity: number, notes: string }[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [orderType, setOrderType] = useState('dine-in');
    const [customerName, setCustomerName] = useState('');
    const [discount, setDiscount] = useState(0);
    const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>('manual');
    const [manualPaymentMethod, setManualPaymentMethod] = useState<ManualPaymentMethod>('cash');
    const [manualPaymentFlow, setManualPaymentFlow] = useState<ManualPaymentFlow>('settle_now');
    const [submitting, setSubmitting] = useState(false);
    const [paymentConfirmData, setPaymentConfirmData] = useState<{ id: string, method: ManualPaymentMethod, totalAmount: number } | null>(null);

    useEffect(() => {
        if (authLoading || !user) return;

        if (user.role === 'manager') {
            setLoading(true);
            fetch(`/api/reports?range=${managerRange}`)
                .then(r => r.json())
                .then((reportData) => {
                    setManagerData(reportData);
                    setLoading(false);
                })
                .catch(() => {
                    setManagerData(null);
                    setLoading(false);
                    toast('error', 'Failed to load manager order analytics');
                });
            return;
        }

        if (user.role !== 'waiter') return;

        Promise.all([
            fetch('/api/categories').then(r => r.json()),
            fetch('/api/menu').then(r => r.json()),
            fetch('/api/tables').then(r => r.json()),
            fetch('/api/orders').then(r => r.json()),
        ]).then(([cats, items, tbls, orderData]) => {
            setCategories(ensureArray(cats));
            setMenuItems(ensureArray(items));
            setTables(ensureArray(tbls).filter((t: any) => t.status !== 'cleaning')); // Allow available, reserved, and occupied
            setOrders(ensureArray(orderData));
            setLoading(false);

            // Pre-select table if passed in URL
            if (typeof window !== 'undefined') {
                const urlParams = new URL(window.location.href).searchParams;
                const tableIdFromUrl = urlParams.get('tableId');
                if (tableIdFromUrl) {
                    setSelectedTable(tableIdFromUrl);
                }
            }
        }).catch(() => {
            setCategories([]);
            setMenuItems([]);
            setTables([]);
            setOrders([]);
            setLoading(false);
            toast('error', 'Failed to load order data');
        });
    }, [authLoading, managerRange, toast, user]);

    useEffect(() => {
        if (!authLoading && user && !['waiter', 'manager'].includes(user.role)) {
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

    const confirmManualPayment = async (orderId: string, methodOverride?: string) => {
        let storedMethod = methodOverride as ManualPaymentMethod | undefined;
        if (!storedMethod) {
            const orderObj = orders.find((o: any) => o.id === orderId);
            storedMethod = isManualPaymentMethod(orderObj?.paymentMethod) ? orderObj?.paymentMethod : 'cash';
        }

        const res = await fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'confirm_manual_payment', paymentMethod: storedMethod })
        });

        if (res.ok) {
            toast('success', `${getManualPaymentMethodLabel(storedMethod)} payment confirmed and order sent to kitchen`);
            setPaymentConfirmData(null);
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

        const paymentConfig = getOrderPaymentConfig({
            paymentChannel,
            manualPaymentMethod,
            manualPaymentFlow,
        });

        const payload = {
            tableId: selectedTable || null,
            type: orderType,
            customerName: customerName || undefined,
            discount,
            ...paymentConfig,
            items: cart.map(i => ({ menuItemId: i.id, quantity: i.quantity, notes: i.notes }))
        };

        try {
            if (paymentChannel === 'monime') {
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
            const createdOrder = await res.json();

            if (manualPaymentFlow === 'settle_now') {
                setPaymentConfirmData({ id: createdOrder.id, method: manualPaymentMethod, totalAmount: total });
                setCart([]);
                setSelectedTable('');
                setCustomerName('');
                setDiscount(0);
                setOrderType('dine-in');
                setPaymentChannel('manual');
                setManualPaymentMethod('cash');
                setManualPaymentFlow('settle_now');
                await refreshOrders();
                return;
            }

            toast(
                'success',
                'Open tab saved. Settle it later from Pending Checkout.'
            );
            setCart([]);
            setSelectedTable('');
            setCustomerName('');
            setDiscount(0);
            setOrderType('dine-in');
            setPaymentChannel('manual');
            setManualPaymentMethod('cash');
            setManualPaymentFlow('settle_now');
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

    if (authLoading || !user || loading) {
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
                    <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'rgba(15,23,42,0.82)', border: '1px solid rgba(148,163,184,0.18)' }}>
                        {(['day', 'week', 'month'] as ManagerRange[]).map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setManagerRange(item)}
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

    const pendingCheckoutOrders = orders.filter((order: any) => ['draft', 'payment_pending_confirmation'].includes(order.status));

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
                            <div style={{ gridColumn: '1 / -1' }}>
                                <PaymentFlowSelector
                                    paymentChannel={paymentChannel}
                                    onPaymentChannelChange={setPaymentChannel}
                                    manualPaymentMethod={manualPaymentMethod}
                                    onManualPaymentMethodChange={setManualPaymentMethod}
                                    manualPaymentFlow={manualPaymentFlow}
                                    onManualPaymentFlowChange={setManualPaymentFlow}
                                />
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
                                <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: 8 }}>Pending Checkout</div>
                                {pendingCheckoutOrders.slice(0, 5).map((order: any) => {
                                    const storedMethod = isManualPaymentMethod(order.paymentMethod) ? order.paymentMethod : 'cash';

                                    return (
                                        <div key={order.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                                            <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                                                <strong>#{order.orderNumber}</strong>
                                                <span className={`badge ${order.paymentStatus}`}>{order.paymentStatus}</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                                {order.table?.number ? `Table ${order.table.number}` : order.customerName || order.type} • {formatCurrency(order.total, settings.currencySymbol)}
                                            </div>
                                            {order.status === 'draft' ? (
                                                <button className="btn btn-success w-full" onClick={() => confirmManualPayment(order.id, storedMethod)} style={{ justifyContent: 'center', padding: 10 }}>
                                                    Settle {getManualPaymentMethodLabel(storedMethod)} & Send
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

                        <button className="btn btn-primary w-full" onClick={submitOrder} disabled={cart.length === 0 || submitting} style={{ padding: '12px', justifyContent: 'center', fontSize: 15 }}>
                            <CreditCard size={18} /> {submitting ? 'Processing...' : paymentChannel === 'monime' ? 'Pay with Monime' : manualPaymentFlow === 'settle_now' ? `Collect ${getManualPaymentMethodLabel(manualPaymentMethod)} & Send to Kitchen` : 'Save Open Tab'}
                        </button>
                    </div>
                </div>
            </div>

            {paymentConfirmData && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 24 }}>
                    <div style={{ background: 'var(--bg-card)', padding: 32, borderRadius: 'var(--radius-lg)', width: 400, textAlign: 'center', border: '1px solid var(--border)' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(56,189,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#38bdf8' }}>
                            <CreditCard size={32} />
                        </div>
                        <h3 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Confirm {getManualPaymentMethodLabel(paymentConfirmData.method)} Payment</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                            Has the {getManualPaymentMethodLabel(paymentConfirmData.method).toLowerCase()} payment of {formatCurrency(paymentConfirmData.totalAmount, settings.currencySymbol)} been received? Confirming will send the order to the kitchen.
                        </p>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn w-full" onClick={() => { setPaymentConfirmData(null); }} style={{ padding: 12, justifyContent: 'center', background: 'var(--surface-active)' }}>
                                Cancel & Keep in Draft
                            </button>
                            <button className="btn btn-primary w-full" onClick={() => confirmManualPayment(paymentConfirmData.id, paymentConfirmData.method)} style={{ padding: 12, justifyContent: 'center' }}>
                                Confirm Paid
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
