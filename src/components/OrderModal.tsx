import React, { useEffect, useState } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, X, SlidersHorizontal, Clock3 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency } from '@/lib/currency';
import {
    getOrderPaymentConfig,
    isManualPaymentMethod,
    type BillingMode,
    type PaymentMethod,
} from '@/lib/payment-flow';
import type { CustomizationOptionResponse } from '@/lib/order-customization';

const ensureArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

type CartCustomization = {
    kitchenNote: string;
    removals: Array<{ recipeIngredientId: string; label: string }>;
    additions: Array<{ menuItemExtraOptionId: string; label: string }>;
};

type CartItem = {
    cartId: string;
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    notes: string;
    customization: CartCustomization;
};

type CustomizationMode = 'remove' | 'add' | 'note';
type CheckoutPromptState =
    | { kind: 'new_order_billing' }
    | { kind: 'new_order_payment_method' }
    | { kind: 'open_bill_payment_method'; orderId: string; totalAmount: number }
    | null;

function createCartId() {
    return Math.random().toString(36).slice(2, 11);
}

function createEmptyCustomization(): CartCustomization {
    return { kitchenNote: '', removals: [], additions: [] };
}

function summarizeCustomization(customization: CartCustomization) {
    const lines: string[] = [];

    if (customization.removals.length > 0) {
        lines.push(`Remove: ${customization.removals.map((item) => item.label).join(', ')}`);
    }

    if (customization.additions.length > 0) {
        lines.push(`Add: ${customization.additions.map((item) => item.label).join(', ')}`);
    }

    if (customization.kitchenNote.trim()) {
        lines.push(`Note: ${customization.kitchenNote.trim()}`);
    }

    return lines;
}

function getCustomizationCountLabel(customization: CartCustomization) {
    const total = customization.removals.length + customization.additions.length + (customization.kitchenNote.trim() ? 1 : 0);
    return total === 0 ? 'No changes yet' : `${total} customization ${total === 1 ? 'item' : 'items'}`;
}

function hasCustomization(customization: CartCustomization) {
    return summarizeCustomization(customization).length > 0;
}

function formatElapsedMinutes(startedAt?: string | null, endedAt?: string | null, status?: string | null, now = Date.now()) {
    if (!startedAt) return null;
    if (status === 'served' || status === 'completed' || status === 'cancelled') {
        return null;
    }
    const endTime = endedAt ? new Date(endedAt).getTime() : now;
    const minutes = Math.max(0, Math.floor((endTime - new Date(startedAt).getTime()) / 60000));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

function getActionButtonStyle(tone: 'success' | 'brand' | 'danger' | 'neutral') {
    const tones = {
        success: {
            color: '#34d399',
            border: '1px solid rgba(52,211,153,0.35)',
            background: 'rgba(6,78,59,0.28)',
        },
        brand: {
            color: '#7dd3fc',
            border: '1px solid rgba(56,189,248,0.3)',
            background: 'rgba(12,74,110,0.28)',
        },
        danger: {
            color: '#fda4af',
            border: '1px solid rgba(244,63,94,0.35)',
            background: 'rgba(127,29,29,0.3)',
        },
        neutral: {
            color: '#cbd5e1',
            border: '1px solid rgba(148,163,184,0.25)',
            background: 'rgba(30,41,59,0.6)',
        },
    } as const;

    return {
        ...tones[tone],
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 999,
        padding: '7px 12px',
        cursor: 'pointer',
        lineHeight: 1,
        transition: 'transform 0.15s ease, opacity 0.15s ease',
        whiteSpace: 'nowrap' as const,
    };
}

function canEditKitchenOrder(status: string) {
    return ['draft', 'pending'].includes(status);
}

function canCancelKitchenOrder(status: string) {
    return ['draft', 'pending'].includes(status);
}

const modalNeutralButtonStyle: React.CSSProperties = {
    padding: 12,
    justifyContent: 'center',
    background: 'linear-gradient(180deg, rgba(30,41,59,0.92), rgba(15,23,42,0.96))',
    border: '1px solid rgba(148,163,184,0.24)',
    color: '#e2e8f0',
    fontWeight: 700,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};

export default function OrderModal({ table, onClose, onRefresh }: { table: any, onClose: () => void, onRefresh: () => Promise<unknown> | unknown }) {
    const { settings } = useSettings();
    const [categories, setCategories] = useState<any[]>([]);
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirmingPayment, setConfirmingPayment] = useState(false);
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
    const [checkoutPrompt, setCheckoutPrompt] = useState<CheckoutPromptState>(null);
    const [customizingCartId, setCustomizingCartId] = useState<string | null>(null);
    const [customizationOptions, setCustomizationOptions] = useState<CustomizationOptionResponse | null>(null);
    const [customizationLoading, setCustomizationLoading] = useState(false);
    const [draftCustomization, setDraftCustomization] = useState<CartCustomization>(createEmptyCustomization());
    const [customizationMode, setCustomizationMode] = useState<CustomizationMode>('remove');
    const [clockNow, setClockNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = setInterval(() => setClockNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        Promise.all([
            fetch('/api/categories').then(r => r.json()),
            fetch('/api/menu').then(r => r.json()),
        ]).then(([cats, items]) => {
            setCategories(ensureArray(cats));
            setMenuItems(ensureArray(items));
            setLoading(false);
        }).catch(() => {
            setCategories([]);
            setMenuItems([]);
            setLoading(false);
            toast('error', 'Failed to load menu data');
        });
    }, [toast]);

    const filteredItems = menuItems.filter(item => {
        const matchesCat = activeCategory === 'all' || item.categoryId === activeCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
    });
    const tableOrders = Array.isArray(table.orders) ? table.orders : [];
    const awaitingPaymentOrders = tableOrders.filter((order: any) => order.status === 'payment_pending_confirmation');
    const kitchenOrders = tableOrders.filter((order: any) => order.status !== 'payment_pending_confirmation');
    const activeTabTotal = kitchenOrders.reduce((sum: number, order: any) => sum + order.total, 0);

    const addToCart = (item: any) => {
        setCart(prev => [
            ...prev,
            {
                cartId: createCartId(),
                menuItemId: item.id,
                name: item.name,
                price: item.price,
                quantity: 1,
                notes: '',
                customization: createEmptyCustomization(),
            },
        ]);
    };

    const updateQuantity = (cartId: string, delta: number) => {
        setCart(prev => prev.map(i => {
            if (i.cartId === cartId) {
                const newQ = i.quantity + delta;
                return newQ > 0 ? { ...i, quantity: newQ } : i;
            }
            return i;
        }).filter(i => i.quantity > 0));
    };

    const removeFromCart = (cartId: string) => setCart(prev => prev.filter(i => i.cartId !== cartId));

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = Number(settings.taxRate || '10') / 100;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    const openCustomization = async (cartItem: CartItem) => {
        setCustomizingCartId(cartItem.cartId);
        setCustomizationMode('remove');
        setDraftCustomization({
            kitchenNote: cartItem.customization.kitchenNote,
            removals: [...cartItem.customization.removals],
            additions: [...cartItem.customization.additions],
        });
        setCustomizationLoading(true);

        try {
            const res = await fetch(`/api/menu/${cartItem.menuItemId}/customization-options`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to load customization options');
            }

            setCustomizationOptions(data);
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to load customization options');
            setCustomizingCartId(null);
        } finally {
            setCustomizationLoading(false);
        }
    };

    const toggleRemoval = (recipeIngredientId: string, label: string) => {
        setDraftCustomization((prev) => {
            const exists = prev.removals.some((item) => item.recipeIngredientId === recipeIngredientId);
            return {
                ...prev,
                removals: exists
                    ? prev.removals.filter((item) => item.recipeIngredientId !== recipeIngredientId)
                    : [...prev.removals, { recipeIngredientId, label }],
            };
        });
    };

    const toggleAddition = (menuItemExtraOptionId: string, label: string) => {
        setDraftCustomization((prev) => {
            const exists = prev.additions.some((item) => item.menuItemExtraOptionId === menuItemExtraOptionId);
            return {
                ...prev,
                additions: exists
                    ? prev.additions.filter((item) => item.menuItemExtraOptionId !== menuItemExtraOptionId)
                    : [...prev.additions, { menuItemExtraOptionId, label }],
            };
        });
    };

    const saveCustomization = () => {
        if (!customizingCartId) return;

        setCart((prev) => prev.map((item) => item.cartId === customizingCartId ? {
            ...item,
            customization: draftCustomization,
        } : item));
        setCustomizingCartId(null);
        setCustomizationOptions(null);
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

    const submitOrder = async (decision?: { billingMode: BillingMode; paymentMethod?: PaymentMethod }) => {
        if (cart.length === 0) return toast('error', 'Cart is empty');
        setSubmitting(true);

        const paymentConfig = getOrderPaymentConfig(
            decision?.billingMode === 'pay_now'
                ? { billingMode: 'pay_now', paymentMethod: decision.paymentMethod || 'cash' }
                : { billingMode: 'open_tab' }
        );

        const payload = {
            tableId: table.id,
            type: 'dine-in',
            ...paymentConfig,
            items: cart.map(i => ({
                menuItemId: i.menuItemId,
                quantity: i.quantity,
                notes: i.notes,
                kitchenNote: i.customization.kitchenNote,
                removals: i.customization.removals.map((item) => ({ recipeIngredientId: item.recipeIngredientId })),
                additions: i.customization.additions.map((item) => ({ menuItemExtraOptionId: item.menuItemExtraOptionId })),
            }))
        };

        try {
            if (!editingOrderId && decision?.billingMode === 'pay_now' && decision.paymentMethod === 'monime') {
                await startMonimeCheckout(payload);
                return;
            }

            const method = editingOrderId ? 'PATCH' : 'POST';
            const url = editingOrderId ? `/api/orders/${editingOrderId}` : '/api/orders';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(data?.error || (editingOrderId ? 'Failed to update order' : 'Failed to create order'));
            }

            toast(
                'success',
                editingOrderId
                    ? 'Order updated successfully'
                    : decision?.billingMode === 'pay_now'
                        ? 'Payment recorded and order sent to kitchen.'
                        : 'Order sent to kitchen. The tab will stay open until the guest is ready to pay.'
            );
            setEditingOrderId(null);
            setCart([]);
            setCheckoutPrompt(null);
            onClose();
        } catch (error) {
            toast('error', error instanceof Error ? error.message : editingOrderId ? 'Failed to update order' : 'Failed to create order');
        } finally {
            setSubmitting(false);
        }
    };

    const cancelSentOrder = async (orderId: string) => {
        setCancellingOrderId(orderId);
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'cancelled' })
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(data?.error || 'Failed to cancel order');
            }

            toast('success', 'Order cancelled successfully');
            setConfirmCancelId(null);
            await onRefresh();
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to cancel order');
        } finally {
            setCancellingOrderId(null);
        }
    };

    const confirmManualPayment = async (orderId: string, methodOverride?: string) => {
        const existingOrder = table.orders?.find((order: any) => order.id === orderId);
        let storedMethod = methodOverride;
        if (!storedMethod) {
            storedMethod = isManualPaymentMethod(existingOrder?.paymentMethod)
                ? existingOrder.paymentMethod
                : 'cash';
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
            onClose();
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to confirm payment');
        } finally {
            setConfirmingPayment(false);
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
        if (editingOrderId) {
            void submitOrder();
            return;
        }
        setCheckoutPrompt({ kind: 'new_order_billing' });
    };

    const loadOrderToEdit = (order: any) => {
        if (!canEditKitchenOrder(order.status)) {
            toast('error', 'Orders already in kitchen prep cannot be edited');
            return;
        }
        setEditingOrderId(order.id);
        setCart(order.items.map((item: any) => ({
            cartId: item.id,
            menuItemId: item.menuItemId,
            name: item.menuItem?.name || 'Item',
            price: item.unitPrice,
            quantity: item.quantity,
            notes: item.notes || '',
            customization: {
                kitchenNote: item.kitchenNote || '',
                removals: ensureArray(item.removals).map((removal: any) => ({
                    recipeIngredientId: removal.recipeIngredientId,
                    label: removal.labelSnapshot,
                })),
                additions: ensureArray(item.additions).map((addition: any) => ({
                    menuItemExtraOptionId: addition.menuItemExtraOptionId,
                    label: addition.labelSnapshot,
                })),
            },
        })));
    };

    return (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
            <div className="pos-layout" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 1060, height: '88vh', overflow: 'hidden', animation: 'slideUp 0.3s ease-out', border: '1px solid var(--border)', position: 'relative' }}>
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

                            <div className="menu-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                                {filteredItems.map(item => (
                                    <div key={item.id} className="menu-item-card" onClick={() => addToCart(item)} style={{ cursor: 'pointer', padding: 12, minHeight: 132 }}>
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
                                    <span className="pos-cart-count">{cart.length} lines</span>
                                </div>
                                <div className="badge mt-2" style={{ background: 'rgba(255,255,255,0.1)' }}>Table {table.number}</div>
                                {!editingOrderId && (
                                    <div className="mt-3" style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(56,189,248,0.18)', background: 'rgba(14,165,233,0.08)', color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>
                                        Click place order first, then choose whether this guest is paying now or keeping the tab open until they are ready to leave.
                                    </div>
                                )}
                            </div>

                            <div className="cart-items" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                                {tableOrders.length > 0 && (
                                    <div className="mb-4" style={{ borderBottom: '2px solid var(--border)', paddingBottom: 16 }}>
                                        {awaitingPaymentOrders.length > 0 && (
                                            <div style={{ marginBottom: kitchenOrders.length > 0 ? 16 : 0 }}>
                                                <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: 8 }}>Awaiting Payment</div>
                                                {awaitingPaymentOrders.map((o: any) => (
                                                    <div key={o.id} style={{ marginBottom: 12, border: '1px solid rgba(56,189,248,0.24)', padding: 12, borderRadius: 14, background: 'linear-gradient(180deg, rgba(14,165,233,0.1), rgba(15,23,42,0.42))' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                                                            <span className={`badge ${o.status}`} style={{ fontSize: 9, letterSpacing: 1 }}>{o.status.replaceAll('_', ' ')}</span>
                                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                <button
                                                                    onClick={() => setCheckoutPrompt({ kind: 'open_bill_payment_method', orderId: o.id, totalAmount: o.total })}
                                                                    style={getActionButtonStyle('success')}
                                                                >
                                                                    Settle Bill
                                                                </button>
                                                                <button
                                                                    onClick={() => loadOrderToEdit(o)}
                                                                    style={getActionButtonStyle('brand')}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => setConfirmCancelId(o.id)}
                                                                    style={getActionButtonStyle('danger')}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-muted" style={{ marginBottom: 8 }}>
                                                            This order is waiting for Monime confirmation and has not been sent to kitchen yet.
                                                        </div>
                                                        {o.items.map((item: any) => (
                                                            <div key={item.id} className="cart-item" style={{ padding: '6px 0', opacity: 0.85 }}>
                                                                <div className="flex justify-between w-full">
                                                                    <div className="cart-item-name" style={{ fontSize: 13 }}>{item.quantity}x {item.menuItem?.name || 'Item'}</div>
                                                                    <div className="cart-item-price" style={{ fontSize: 12 }}>{formatCurrency(item.unitPrice * item.quantity, settings.currencySymbol)}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {kitchenOrders.length > 0 && (
                                            <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: 8 }}>Already Sent</div>
                                        )}
                                        {kitchenOrders.map((o: any) => (
                                            <div key={o.id} style={{ marginBottom: 12, border: '1px solid rgba(148,163,184,0.14)', padding: 12, borderRadius: 14, background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(15,23,42,0.22))' }}>
                                                {(() => {
                                                    const canEdit = canEditKitchenOrder(o.status);
                                                    const canCancel = canCancelKitchenOrder(o.status);
                                                    const canSettle = o.paymentStatus !== 'paid' && o.status !== 'cancelled' && o.status !== 'completed';
                                                    return (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                                                        <span className={`badge ${o.status}`} style={{ fontSize: 9, letterSpacing: 1 }}>{o.status.replaceAll('_', ' ')}</span>
                                                        {formatElapsedMinutes(o.serviceStartedAt, o.serviceEndedAt, o.status, clockNow) && (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f8fafc', background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 999, padding: '3px 8px' }}>
                                                                <Clock3 size={12} />
                                                                {formatElapsedMinutes(o.serviceStartedAt, o.serviceEndedAt, o.status, clockNow)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {['draft', 'pending', 'preparing', 'ready', 'served'].includes(o.status) && (
                                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                            {confirmCancelId === o.id && canCancel ? (
                                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                                    <button onClick={() => setConfirmCancelId(null)} style={getActionButtonStyle('neutral')}>Keep</button>
                                                                    <button onClick={() => cancelSentOrder(o.id)} disabled={cancellingOrderId === o.id} style={{ ...getActionButtonStyle('danger'), cursor: cancellingOrderId === o.id ? 'wait' : 'pointer', opacity: cancellingOrderId === o.id ? 0.7 : 1 }}>{cancellingOrderId === o.id ? 'Cancelling...' : 'Confirm Cancel'}</button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {canSettle && (
                                                                        <button
                                                                            onClick={() => setCheckoutPrompt({ kind: 'open_bill_payment_method', orderId: o.id, totalAmount: o.total })}
                                                                            style={getActionButtonStyle('success')}
                                                                        >
                                                                            Settle Bill
                                                                        </button>
                                                                    )}
                                                                    {canEdit && (
                                                                        <button
                                                                            onClick={() => loadOrderToEdit(o)}
                                                                            style={getActionButtonStyle('brand')}
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                    )}
                                                                    {canCancel && (
                                                                        <button
                                                                            onClick={() => setConfirmCancelId(o.id)}
                                                                            style={getActionButtonStyle('danger')}
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                    );
                                                })()}
                                                {!canEditKitchenOrder(o.status) && (
                                                    <div className="text-xs text-muted" style={{ marginBottom: 8 }}>
                                                        This order is already in kitchen prep, so editing and cancelling are locked.
                                                    </div>
                                                )}
                                                {o.items.map((item: any) => (
                                                    <div key={item.id} className="cart-item" style={{ padding: '6px 0', opacity: 0.85 }}>
                                                        <div className="flex justify-between w-full">
                                                            <div className="cart-item-name" style={{ fontSize: 13 }}>{item.quantity}x {item.menuItem?.name || 'Item'}</div>
                                                            <div className="cart-item-price" style={{ fontSize: 12 }}>{formatCurrency(item.unitPrice * item.quantity, settings.currencySymbol)}</div>
                                                        </div>
                                                        {summarizeCustomization({
                                                            kitchenNote: item.kitchenNote || '',
                                                            removals: ensureArray(item.removals).map((removal: any) => ({ recipeIngredientId: removal.recipeIngredientId, label: removal.labelSnapshot })),
                                                            additions: ensureArray(item.additions).map((addition: any) => ({ menuItemExtraOptionId: addition.menuItemExtraOptionId, label: addition.labelSnapshot })),
                                                        }).map((line) => (
                                                            <div key={line} className="text-xs text-muted mt-1">{line}</div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                        {kitchenOrders.length > 0 && (
                                            <div className="mt-2 text-right">
                                                <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--brand-500)' }}>Active Tab: {formatCurrency(activeTabTotal, settings.currencySymbol)}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {cart.length > 0 && <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: 8 }}>New Items</div>}
                                {cart.map((item) => (
                                    <div
                                        key={item.cartId}
                                        className="cart-item"
                                        style={{
                                            padding: '14px',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 18,
                                            marginBottom: 12,
                                            background: hasCustomization(item.customization)
                                                ? 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(8,47,73,0.88))'
                                                : 'rgba(255,255,255,0.02)',
                                            boxShadow: hasCustomization(item.customization)
                                                ? '0 18px 38px rgba(8,47,73,0.22)'
                                                : 'none',
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'grid',
                                                gap: 12,
                                            }}
                                        >
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="cart-item-info" style={{ flex: 1, minWidth: 0 }}>
                                                    <div className="cart-item-name" style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{item.name}</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                                        <div className="cart-item-price" style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-400)' }}>
                                                            {formatCurrency(item.price, settings.currencySymbol)}
                                                        </div>
                                                        {hasCustomization(item.customization) && (
                                                            <span
                                                                style={{
                                                                    fontSize: 10,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: 0.9,
                                                                    padding: '5px 8px',
                                                                    borderRadius: 999,
                                                                    background: 'rgba(125,211,252,0.16)',
                                                                    color: '#7dd3fc',
                                                                    fontWeight: 800,
                                                                }}
                                                            >
                                                                Custom Plate
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div
                                                    style={{
                                                        minWidth: 72,
                                                        textAlign: 'right',
                                                        display: 'grid',
                                                        gap: 4,
                                                        justifyItems: 'end',
                                                    }}
                                                >
                                                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)', fontWeight: 700 }}>
                                                        Line Total
                                                    </div>
                                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
                                                        {formatCurrency(item.price * item.quantity, settings.currencySymbol)}
                                                    </div>
                                                </div>
                                            </div>

                                            {hasCustomization(item.customization) && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                    {summarizeCustomization(item.customization).map((line) => (
                                                        <div
                                                            key={line}
                                                            style={{
                                                                fontSize: 11,
                                                                padding: '7px 10px',
                                                                borderRadius: 999,
                                                                background: 'rgba(255,255,255,0.08)',
                                                                color: '#e2e8f0',
                                                                border: '1px solid rgba(255,255,255,0.08)',
                                                                maxWidth: '100%',
                                                            }}
                                                        >
                                                            {line}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 10,
                                                    paddingTop: 12,
                                                    borderTop: '1px solid rgba(255,255,255,0.08)',
                                                }}
                                            >
                                                <div
                                                    className="cart-qty-controls"
                                                    style={{
                                                        gap: 8,
                                                        padding: '8px 10px',
                                                        borderRadius: 999,
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        background: 'rgba(255,255,255,0.03)',
                                                    }}
                                                >
                                                    <button className="qty-btn" onClick={() => updateQuantity(item.cartId, -1)}><Minus size={12} /></button>
                                                    <span className="qty-val" style={{ fontSize: 12, minWidth: 18 }}>{item.quantity}</span>
                                                    <button className="qty-btn" onClick={() => updateQuantity(item.cartId, 1)}><Plus size={12} /></button>
                                                    <button className="qty-btn" style={{ marginLeft: 4, borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }} onClick={() => removeFromCart(item.cartId)}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                                <button
                                                    className="btn btn-secondary"
                                                    type="button"
                                                    onClick={() => openCustomization(item)}
                                                    style={{
                                                        justifyContent: 'center',
                                                        paddingInline: 16,
                                                        minWidth: 0,
                                                        whiteSpace: 'nowrap',
                                                        borderRadius: 999,
                                                    }}
                                                >
                                                    <SlidersHorizontal size={15} /> Customize
                                                </button>
                                            </div>
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
                                        <button className="btn btn-primary w-full" onClick={() => { void submitOrder(); }} disabled={cart.length === 0 || submitting} style={{ padding: 12, justifyContent: 'center' }}>
                                            Save Changes
                                        </button>
                                    </div>
                                ) : (
                                    <button className="btn btn-primary w-full mt-4" onClick={openPlaceOrderPrompt} disabled={cart.length === 0 || submitting} style={{ padding: 12, justifyContent: 'center' }}>
                                        <CreditCard size={16} /> {submitting ? 'Processing...' : 'Place Order'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {customizingCartId && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: 24 }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 620, maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--border)', padding: 24 }}>
                        <div className="flex justify-between items-start gap-3 mb-5">
                            <div>
                                <h3 style={{ fontSize: 20, fontWeight: 'bold' }}>Customize Plate</h3>
                                <p className="text-muted text-sm mt-1">Use structured selections for stock-changing edits. Kitchen note is for prep preference only.</p>
                            </div>
                            <button onClick={() => { setCustomizingCartId(null); setCustomizationOptions(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {customizationLoading ? (
                            <div className="loading-spinner" style={{ margin: '40px auto' }} />
                        ) : customizationOptions ? (
                            <div className="flex flex-col gap-5">
                                <div style={{ padding: 16, borderRadius: 14, border: '1px solid rgba(56,189,248,0.22)', background: 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(15,23,42,0.92))' }}>
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, color: '#7dd3fc', fontWeight: 800, marginBottom: 6 }}>
                                                Current Plate
                                            </div>
                                            <div style={{ fontSize: 18, fontWeight: 800 }}>{customizationOptions.name}</div>
                                        </div>
                                        <div style={{ fontSize: 12, padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', fontWeight: 700 }}>
                                            {getCustomizationCountLabel(draftCustomization)}
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted mt-3">
                                        Remove from the base plate, add approved extras, then leave any kitchen-only preference below.
                                    </div>
                                    {summarizeCustomization(draftCustomization).length > 0 && (
                                        <div className="mt-3 flex flex-col gap-2">
                                            {summarizeCustomization(draftCustomization).map((line) => (
                                                <div key={line} style={{ fontSize: 12, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#e5e7eb' }}>
                                                    {line}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'inline-flex', padding: 6, borderRadius: 999, background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(148,163,184,0.18)', gap: 6, flexWrap: 'wrap' }}>
                                    {([
                                        { id: 'remove', label: 'Remove' },
                                        { id: 'add', label: 'Add' },
                                        { id: 'note', label: 'Kitchen Note' },
                                    ] as Array<{ id: CustomizationMode; label: string }>).map((mode) => (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            onClick={() => setCustomizationMode(mode.id)}
                                            style={{
                                                border: 'none',
                                                borderRadius: 999,
                                                padding: '10px 16px',
                                                fontSize: 12,
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                background: customizationMode === mode.id
                                                    ? mode.id === 'remove'
                                                        ? 'rgba(248,113,113,0.16)'
                                                        : mode.id === 'add'
                                                            ? 'rgba(34,197,94,0.16)'
                                                            : 'rgba(56,189,248,0.16)'
                                                    : 'transparent',
                                                color: customizationMode === mode.id
                                                    ? '#f8fafc'
                                                    : '#94a3b8',
                                            }}
                                        >
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>

                                {customizationMode === 'remove' && (
                                    <div>
                                        <div className="font-bold mb-1">Remove From Base Plate</div>
                                        <div className="text-xs text-muted mb-2">Toggle off anything the guest does not want from the existing plate.</div>
                                        <div className="flex flex-col gap-2">
                                            {customizationOptions.removableParts.map((part) => {
                                                const active = draftCustomization.removals.some((item) => item.recipeIngredientId === part.recipeIngredientId);
                                                return (
                                                    <button
                                                        key={part.recipeIngredientId}
                                                        type="button"
                                                        onClick={() => toggleRemoval(part.recipeIngredientId, part.label)}
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: 'auto 1fr auto',
                                                            gap: 14,
                                                            alignItems: 'center',
                                                            padding: 14,
                                                            borderRadius: 16,
                                                            border: active ? '1px solid rgba(248,113,113,0.45)' : '1px solid rgba(255,255,255,0.08)',
                                                            background: active ? 'linear-gradient(135deg, rgba(127,29,29,0.52), rgba(68,12,12,0.92))' : 'rgba(255,255,255,0.02)',
                                                            cursor: 'pointer',
                                                            textAlign: 'left',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: 44,
                                                                height: 24,
                                                                borderRadius: 999,
                                                                background: active ? 'rgba(248,113,113,0.95)' : 'rgba(148,163,184,0.28)',
                                                                position: 'relative',
                                                                transition: 'all 0.2s ease',
                                                                boxShadow: active ? '0 0 18px rgba(248,113,113,0.35)' : 'none',
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: 3,
                                                                    left: active ? 23 : 3,
                                                                    width: 18,
                                                                    height: 18,
                                                                    borderRadius: '50%',
                                                                    background: '#fff',
                                                                    transition: 'left 0.2s ease',
                                                                }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 800, color: active ? '#fff5f5' : '#f8fafc' }}>{part.label}</div>
                                                            <div className="text-xs text-muted">Base recipe uses {part.quantityUsed} {part.unit}</div>
                                                        </div>
                                                        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: active ? '#fecaca' : '#94a3b8', fontWeight: 800 }}>
                                                            {active ? 'Removed' : 'Keep'}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                            {customizationOptions.removableParts.length === 0 && (
                                                <div className="text-sm text-muted">No removable base items were configured through the recipe.</div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {customizationMode === 'add' && (
                                    <div>
                                        <div className="font-bold mb-1">Add To Plate</div>
                                        <div className="text-xs text-muted mb-2">Toggle on approved extras that should go out with this custom plate.</div>
                                        <div className="grid" style={{ gap: 12 }}>
                                            {customizationOptions.addableExtras.map((extra) => {
                                                const active = draftCustomization.additions.some((item) => item.menuItemExtraOptionId === extra.menuItemExtraOptionId);
                                                return (
                                                    <button
                                                        key={extra.menuItemExtraOptionId}
                                                        type="button"
                                                        onClick={() => toggleAddition(extra.menuItemExtraOptionId, extra.label)}
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: 'auto 1fr auto',
                                                            gap: 14,
                                                            alignItems: 'center',
                                                            padding: 14,
                                                            borderRadius: 16,
                                                            border: active ? '1px solid rgba(34,197,94,0.42)' : '1px solid rgba(255,255,255,0.08)',
                                                            background: active ? 'linear-gradient(135deg, rgba(20,83,45,0.82), rgba(6,78,59,0.92))' : 'rgba(255,255,255,0.02)',
                                                            cursor: 'pointer',
                                                            textAlign: 'left',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: 44,
                                                                height: 24,
                                                                borderRadius: 999,
                                                                background: active ? 'rgba(34,197,94,0.92)' : 'rgba(148,163,184,0.28)',
                                                                position: 'relative',
                                                                transition: 'all 0.2s ease',
                                                                boxShadow: active ? '0 0 18px rgba(34,197,94,0.28)' : 'none',
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: 3,
                                                                    left: active ? 23 : 3,
                                                                    width: 18,
                                                                    height: 18,
                                                                    borderRadius: '50%',
                                                                    background: '#fff',
                                                                    transition: 'left 0.2s ease',
                                                                }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 800, color: active ? '#f0fdf4' : '#f8fafc' }}>{extra.label}</div>
                                                            <div className="text-xs text-muted">Adds {extra.quantityUsed} {extra.unit} to stock usage</div>
                                                        </div>
                                                        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: active ? '#bbf7d0' : '#94a3b8', fontWeight: 800 }}>
                                                            {active ? 'Added' : 'Optional'}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                            {customizationOptions.addableExtras.length === 0 && (
                                                <div className="text-sm text-muted">No extras are configured for this menu item yet.</div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {customizationMode === 'note' && (
                                    <div>
                                        <label className="font-bold mb-2 block">Kitchen Note</label>
                                        <div className="text-xs text-muted mb-2">Use this for preference only: no pepper, well cooked, extra hot, sauce on the side.</div>
                                        <textarea
                                            className="form-input"
                                            rows={5}
                                            value={draftCustomization.kitchenNote}
                                            onChange={(e) => setDraftCustomization((prev) => ({ ...prev, kitchenNote: e.target.value }))}
                                            placeholder="Example: no pepper, well cooked, serve hot"
                                            style={{
                                                background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
                                                border: '1px solid rgba(125,211,252,0.18)',
                                                borderRadius: 16,
                                                padding: '14px 16px',
                                                minHeight: 132,
                                            }}
                                        />
                                        <div className="text-xs text-muted mt-2">Kitchen note never changes inventory on its own.</div>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button type="button" className="btn btn-secondary flex-1" onClick={() => { setCustomizingCartId(null); setCustomizationOptions(null); }}>
                                        Close
                                    </button>
                                    <button type="button" className="btn btn-primary flex-1" onClick={saveCustomization}>
                                        Save To Order
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            {checkoutPrompt && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
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
                                    <button className="btn w-full" type="button" disabled={submitting} onClick={() => setCheckoutPrompt(null)} style={modalNeutralButtonStyle}>
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
                                    <button className="btn w-full" type="button" disabled={submitting} onClick={() => setCheckoutPrompt({ kind: 'new_order_billing' })} style={modalNeutralButtonStyle}>
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
                                    <button className="btn w-full" type="button" disabled={confirmingPayment || submitting} onClick={() => setCheckoutPrompt(null)} style={modalNeutralButtonStyle}>
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
