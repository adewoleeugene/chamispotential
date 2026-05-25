import React, { useEffect, useState } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, X, SlidersHorizontal, Clock3, ShoppingBag, ChevronRight } from 'lucide-react';
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
    if (customization.removals.length > 0) lines.push(`Remove: ${customization.removals.map((item) => item.label).join(', ')}`);
    if (customization.additions.length > 0) lines.push(`Add: ${customization.additions.map((item) => item.label).join(', ')}`);
    if (customization.kitchenNote.trim()) lines.push(`Note: ${customization.kitchenNote.trim()}`);
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
    if (status === 'served' || status === 'completed' || status === 'cancelled') return null;
    const endTime = endedAt ? new Date(endedAt).getTime() : now;
    const minutes = Math.max(0, Math.floor((endTime - new Date(startedAt).getTime()) / 60000));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

function canEditKitchenOrder(status: string) {
    return ['draft', 'pending'].includes(status);
}

function canCancelKitchenOrder(status: string) {
    return ['draft', 'pending'].includes(status);
}

// Status badge color map
const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    draft:     { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: 'rgba(148,163,184,0.2)' },
    pending:   { bg: 'rgba(245,177,93,0.14)',  color: '#f5b15d', border: 'rgba(245,177,93,0.28)' },
    preparing: { bg: 'rgba(251,191,36,0.14)',  color: '#fbbf24', border: 'rgba(251,191,36,0.28)' },
    ready:     { bg: 'rgba(83,211,167,0.14)',  color: '#53d3a7', border: 'rgba(83,211,167,0.28)' },
    served:    { bg: 'rgba(112,174,231,0.14)', color: '#70aee7', border: 'rgba(112,174,231,0.28)' },
    completed: { bg: 'rgba(83,211,167,0.14)',  color: '#53d3a7', border: 'rgba(83,211,167,0.28)' },
    cancelled: { bg: 'rgba(240,107,100,0.12)', color: '#f06b64', border: 'rgba(240,107,100,0.22)' },
    payment_pending_confirmation: { bg: 'rgba(112,174,231,0.14)', color: '#70aee7', border: 'rgba(112,174,231,0.28)' },
};

function StatusBadge({ status }: { status: string }) {
    const s = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
    return (
        <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: 999,
            background: s.bg,
            color: s.color,
            border: `1px solid ${s.border}`,
        }}>
            {status.replace(/_/g, ' ')}
        </span>
    );
}

function ActionBtn({ tone, onClick, disabled, children }: {
    tone: 'success' | 'brand' | 'danger' | 'neutral';
    onClick?: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    const styles = {
        success: { color: '#53d3a7', bg: 'rgba(83,211,167,0.1)', border: 'rgba(83,211,167,0.25)' },
        brand:   { color: '#70aee7', bg: 'rgba(112,174,231,0.1)', border: 'rgba(112,174,231,0.25)' },
        danger:  { color: '#f06b64', bg: 'rgba(240,107,100,0.1)', border: 'rgba(240,107,100,0.25)' },
        neutral: { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
    }[tone];
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '6px 14px',
                borderRadius: 999,
                border: `1px solid ${styles.border}`,
                background: styles.bg,
                color: styles.color,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
            }}
        >
            {children}
        </button>
    );
}

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
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);

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
        setCart(prev => [...prev, {
            cartId: createCartId(),
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            notes: '',
            customization: createEmptyCustomization(),
        }]);
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
            if (!res.ok) throw new Error(data.error || 'Failed to load customization options');
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
        setCart((prev) => prev.map((item) => item.cartId === customizingCartId ? { ...item, customization: draftCustomization } : item));
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
        if (!res.ok || !data?.redirectUrl) throw new Error(data?.details || data?.error || 'Failed to start Monime checkout');
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
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || (editingOrderId ? 'Failed to update order' : 'Failed to create order'));
            toast('success', editingOrderId
                ? 'Order updated successfully'
                : decision?.billingMode === 'pay_now'
                    ? 'Payment recorded and order sent to kitchen.'
                    : 'Order sent to kitchen. The tab will stay open until the guest is ready to pay.');
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
            if (!res.ok) throw new Error(data?.error || 'Failed to cancel order');
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
            storedMethod = isManualPaymentMethod(existingOrder?.paymentMethod) ? existingOrder.paymentMethod : 'cash';
        }
        setConfirmingPayment(true);
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'confirm_manual_payment', paymentMethod: storedMethod })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Failed to confirm payment');
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
        if (cart.length === 0) { toast('error', 'Cart is empty'); return; }
        if (editingOrderId) { void submitOrder(); return; }
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

    const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(4,6,9,0.88)',
                backdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20,
            }}
        >
            {/* Main modal shell */}
            <div
                style={{
                    width: '100%', maxWidth: 1100,
                    height: '92vh',
                    borderRadius: 24,
                    overflow: 'hidden',
                    display: 'grid',
                    gridTemplateColumns: '1fr 380px',
                    border: '1px solid rgba(240,229,213,0.1)',
                    boxShadow: '0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
                    animation: 'slideUp 0.28s cubic-bezier(0.22,1,0.36,1)',
                    position: 'relative',
                    background: '#08090d',
                }}
            >
                {/* ── LEFT PANEL: Menu ───────────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid rgba(240,229,213,0.08)' }}>

                    {/* Header */}
                    <div style={{
                        padding: '20px 24px 18px',
                        background: 'linear-gradient(180deg, rgba(14,18,24,0.98) 0%, rgba(10,13,18,0.95) 100%)',
                        borderBottom: '1px solid rgba(240,229,213,0.08)',
                        flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    background: 'linear-gradient(135deg, #f0bf83 0%, #b46833 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 8px 20px rgba(180,104,51,0.35)',
                                    flexShrink: 0,
                                }}>
                                    <ShoppingBag size={18} color="#fff9f0" />
                                </div>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#f5efe6', lineHeight: 1.1 }}>
                                        {table.section || `Table ${table.number}`}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#7c7368', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                                        New Order
                                    </div>
                                </div>
                                {table.mergeGroupId && (
                                    <span style={{ fontSize: 10, background: 'rgba(37,99,235,0.2)', color: '#93c5fd', padding: '3px 8px', borderRadius: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid rgba(59,130,246,0.25)' }}>
                                        Merged
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {table.mergeGroupId && (
                                    <button
                                        onClick={async () => {
                                            const res = await fetch('/api/tables/unmerge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableId: table.id }) });
                                            if (res.ok) { toast('success', 'Tables unmerged successfully'); onClose(); }
                                            else { toast('error', 'Failed to unmerge tables'); }
                                        }}
                                        style={{ fontSize: 12, background: 'rgba(240,107,100,0.1)', border: '1px solid rgba(240,107,100,0.25)', color: '#f06b64', padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontWeight: 700 }}
                                    >
                                        Unmerge
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Search + Categories row */}
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            {/* Search */}
                            <div style={{ position: 'relative', flexShrink: 0, width: 200 }}>
                                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7c7368', pointerEvents: 'none' }} />
                                <input
                                    type="text"
                                    placeholder="Search menu…"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '9px 12px 9px 34px',
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(240,229,213,0.1)',
                                        borderRadius: 12,
                                        color: '#f5efe6',
                                        fontSize: 13,
                                        outline: 'none',
                                    }}
                                />
                            </div>

                            {/* Category pills — horizontal scroll */}
                            <div style={{ flex: 1, overflowX: 'auto', display: 'flex', gap: 6, scrollbarWidth: 'none' }}>
                                {[{ id: 'all', name: 'All' }, ...categories].map(cat => {
                                    const active = activeCategory === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setActiveCategory(cat.id)}
                                            style={{
                                                flexShrink: 0,
                                                padding: '7px 16px',
                                                borderRadius: 999,
                                                fontSize: 12,
                                                fontWeight: active ? 700 : 600,
                                                cursor: 'pointer',
                                                border: active ? '1px solid rgba(240,191,131,0.3)' : '1px solid rgba(240,229,213,0.1)',
                                                background: active
                                                    ? 'linear-gradient(135deg, rgba(240,191,131,0.22), rgba(180,104,51,0.14))'
                                                    : 'rgba(255,255,255,0.03)',
                                                color: active ? '#f0bf83' : '#baaf9d',
                                                boxShadow: active ? '0 0 0 1px rgba(240,191,131,0.12)' : 'none',
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            {cat.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Menu grid */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                        {loading ? (
                            <div className="loading-spinner" style={{ margin: '80px auto' }} />
                        ) : filteredItems.length === 0 ? (
                            <div style={{ textAlign: 'center', paddingTop: 80, color: '#7c7368' }}>
                                <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>No items found</div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                                {filteredItems.map(item => {
                                    const hovered = hoveredItem === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => addToCart(item)}
                                            onMouseEnter={() => setHoveredItem(item.id)}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            style={{
                                                textAlign: 'left',
                                                padding: '16px',
                                                borderRadius: 16,
                                                border: hovered ? '1px solid rgba(240,191,131,0.3)' : '1px solid rgba(240,229,213,0.07)',
                                                background: hovered
                                                    ? 'linear-gradient(135deg, rgba(20,25,34,0.98), rgba(16,20,28,0.96))'
                                                    : 'rgba(14,18,24,0.9)',
                                                cursor: 'pointer',
                                                transition: 'all 0.18s ease',
                                                transform: hovered ? 'translateY(-2px)' : 'none',
                                                boxShadow: hovered ? '0 12px 28px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
                                                minHeight: 110,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between',
                                                position: 'relative',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {/* Warm top-right glow on hover */}
                                            {hovered && (
                                                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,191,131,0.18), transparent 70%)', pointerEvents: 'none' }} />
                                            )}
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#f5efe6', lineHeight: 1.3, marginBottom: 8 }}>
                                                {item.name}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ fontSize: 16, fontWeight: 800, color: '#c98541', letterSpacing: '-0.02em' }}>
                                                    {formatCurrency(item.price, settings.currencySymbol)}
                                                </div>
                                                <div style={{
                                                    width: 26, height: 26,
                                                    borderRadius: 8,
                                                    background: hovered ? 'rgba(240,191,131,0.2)' : 'rgba(255,255,255,0.06)',
                                                    border: hovered ? '1px solid rgba(240,191,131,0.3)' : '1px solid rgba(255,255,255,0.08)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: hovered ? '#f0bf83' : '#94a3b8',
                                                    transition: 'all 0.15s ease',
                                                    flexShrink: 0,
                                                }}>
                                                    <Plus size={13} />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT PANEL: Cart ──────────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(10,12,17,0.98)' }}>

                    {/* Cart header */}
                    <div style={{
                        padding: '20px 20px 16px',
                        borderBottom: '1px solid rgba(240,229,213,0.08)',
                        flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 16, fontWeight: 800, color: '#f5efe6', letterSpacing: '-0.02em' }}>Cart</span>
                                {cartCount > 0 && (
                                    <span style={{
                                        fontSize: 11, fontWeight: 700,
                                        background: 'linear-gradient(135deg, #f0bf83, #b46833)',
                                        color: '#fff9f0',
                                        padding: '3px 9px',
                                        borderRadius: 999,
                                        letterSpacing: '0.04em',
                                    }}>
                                        {cartCount}
                                    </span>
                                )}
                            </div>
                            <span style={{
                                fontSize: 11, fontWeight: 700,
                                background: 'rgba(255,255,255,0.06)',
                                color: '#baaf9d',
                                border: '1px solid rgba(240,229,213,0.1)',
                                padding: '4px 12px',
                                borderRadius: 999,
                            }}>
                                TABLE {table.number}
                            </span>
                        </div>

                        {!editingOrderId && (
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: 12,
                                background: 'rgba(112,174,231,0.07)',
                                border: '1px solid rgba(112,174,231,0.14)',
                                color: '#94a3b8',
                                fontSize: 12,
                                lineHeight: 1.5,
                            }}>
                                Add items, then tap <strong style={{ color: '#baaf9d' }}>Place Order</strong> to choose pay now or open tab.
                            </div>
                        )}
                        {editingOrderId && (
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: 12,
                                background: 'rgba(245,177,93,0.08)',
                                border: '1px solid rgba(245,177,93,0.2)',
                                color: '#f5b15d',
                                fontSize: 12,
                                fontWeight: 600,
                            }}>
                                ✏️ Editing order — save when done
                            </div>
                        )}
                    </div>

                    {/* Scrollable cart body */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

                        {/* Existing orders on table */}
                        {tableOrders.length > 0 && (
                            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid rgba(240,229,213,0.08)' }}>

                                {/* Awaiting payment orders */}
                                {awaitingPaymentOrders.length > 0 && (
                                    <div style={{ marginBottom: kitchenOrders.length > 0 ? 16 : 0 }}>
                                        <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.12em', color: '#70aee7', marginBottom: 10 }}>
                                            Awaiting Payment
                                        </div>
                                        {awaitingPaymentOrders.map((o: any) => (
                                            <div key={o.id} style={{
                                                marginBottom: 10,
                                                borderRadius: 14,
                                                border: '1px solid rgba(112,174,231,0.18)',
                                                background: 'linear-gradient(135deg, rgba(112,174,231,0.07), rgba(14,18,24,0.9))',
                                                overflow: 'hidden',
                                            }}>
                                                <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <StatusBadge status={o.status} />
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                        <ActionBtn tone="success" onClick={() => setCheckoutPrompt({ kind: 'open_bill_payment_method', orderId: o.id, totalAmount: o.total })}>Settle Bill</ActionBtn>
                                                        <ActionBtn tone="brand" onClick={() => loadOrderToEdit(o)}>Edit</ActionBtn>
                                                        <ActionBtn tone="danger" onClick={() => setConfirmCancelId(o.id)}>Cancel</ActionBtn>
                                                    </div>
                                                </div>
                                                <div style={{ padding: '0 14px 12px' }}>
                                                    <div style={{ fontSize: 11, color: '#7c7368', marginBottom: 8 }}>
                                                        Waiting for Monime confirmation — not yet in kitchen.
                                                    </div>
                                                    {o.items.map((item: any) => (
                                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#baaf9d', padding: '3px 0' }}>
                                                            <span>{item.quantity}× {item.menuItem?.name || 'Item'}</span>
                                                            <span>{formatCurrency(item.unitPrice * item.quantity, settings.currencySymbol)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Kitchen orders */}
                                {kitchenOrders.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.12em', color: '#7c7368', marginBottom: 10 }}>
                                            Already Sent
                                        </div>
                                        {kitchenOrders.map((o: any) => {
                                            const canEdit = canEditKitchenOrder(o.status);
                                            const canCancel = canCancelKitchenOrder(o.status);
                                            const canSettle = o.paymentStatus !== 'paid' && o.status !== 'cancelled' && o.status !== 'completed';
                                            const elapsed = formatElapsedMinutes(o.serviceStartedAt, o.serviceEndedAt, o.status, clockNow);
                                            return (
                                                <div key={o.id} style={{
                                                    marginBottom: 10,
                                                    borderRadius: 14,
                                                    border: '1px solid rgba(240,229,213,0.07)',
                                                    background: 'rgba(255,255,255,0.02)',
                                                    overflow: 'hidden',
                                                }}>
                                                    <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                            <StatusBadge status={o.status} />
                                                            {elapsed && (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#baaf9d', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '3px 8px' }}>
                                                                    <Clock3 size={11} />{elapsed}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {['draft', 'pending', 'preparing', 'ready', 'served'].includes(o.status) && (
                                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                                {confirmCancelId === o.id && canCancel ? (
                                                                    <>
                                                                        <ActionBtn tone="neutral" onClick={() => setConfirmCancelId(null)}>Keep</ActionBtn>
                                                                        <ActionBtn tone="danger" onClick={() => cancelSentOrder(o.id)} disabled={cancellingOrderId === o.id}>
                                                                            {cancellingOrderId === o.id ? 'Cancelling…' : 'Confirm'}
                                                                        </ActionBtn>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {canSettle && <ActionBtn tone="success" onClick={() => setCheckoutPrompt({ kind: 'open_bill_payment_method', orderId: o.id, totalAmount: o.total })}>Settle Bill</ActionBtn>}
                                                                        {canEdit && <ActionBtn tone="brand" onClick={() => loadOrderToEdit(o)}>Edit</ActionBtn>}
                                                                        {canCancel && <ActionBtn tone="danger" onClick={() => setConfirmCancelId(o.id)}>Cancel</ActionBtn>}
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!canEditKitchenOrder(o.status) && (
                                                        <div style={{ padding: '0 14px 6px', fontSize: 11, color: '#7c7368' }}>
                                                            Already in kitchen prep — editing is locked.
                                                        </div>
                                                    )}
                                                    <div style={{ padding: '0 14px 12px' }}>
                                                        {o.items.map((item: any) => (
                                                            <div key={item.id} style={{ padding: '3px 0' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#baaf9d' }}>
                                                                    <span>{item.quantity}× {item.menuItem?.name || 'Item'}</span>
                                                                    <span>{formatCurrency(item.unitPrice * item.quantity, settings.currencySymbol)}</span>
                                                                </div>
                                                                {summarizeCustomization({
                                                                    kitchenNote: item.kitchenNote || '',
                                                                    removals: ensureArray(item.removals).map((r: any) => ({ recipeIngredientId: r.recipeIngredientId, label: r.labelSnapshot })),
                                                                    additions: ensureArray(item.additions).map((a: any) => ({ menuItemExtraOptionId: a.menuItemExtraOptionId, label: a.labelSnapshot })),
                                                                }).map(line => (
                                                                    <div key={line} style={{ fontSize: 10, color: '#7c7368', marginTop: 2 }}>{line}</div>
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {kitchenOrders.length > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: '#c98541' }}>
                                                    Active Tab: {formatCurrency(activeTabTotal, settings.currencySymbol)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* New cart items */}
                        {cart.length > 0 && (
                            <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.12em', color: '#7c7368', marginBottom: 12 }}>
                                New Items
                            </div>
                        )}
                        {cart.map((item) => {
                            const customized = hasCustomization(item.customization);
                            return (
                                <div
                                    key={item.cartId}
                                    style={{
                                        marginBottom: 10,
                                        borderRadius: 14,
                                        border: customized ? '1px solid rgba(112,174,231,0.18)' : '1px solid rgba(240,229,213,0.08)',
                                        background: customized ? 'rgba(112,174,231,0.05)' : 'rgba(255,255,255,0.02)',
                                        padding: '12px 14px',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#f5efe6', lineHeight: 1.3, marginBottom: 4 }}>{item.name}</div>
                                            <div style={{ fontSize: 12, color: '#c98541', fontWeight: 700 }}>{formatCurrency(item.price, settings.currencySymbol)} ea.</div>
                                            {customized && (
                                                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {summarizeCustomization(item.customization).map(line => (
                                                        <span key={line} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.07)' }}>{line}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontSize: 11, color: '#7c7368', marginBottom: 2 }}>Total</div>
                                            <div style={{ fontSize: 14, fontWeight: 800, color: '#f5efe6' }}>{formatCurrency(item.price * item.quantity, settings.currencySymbol)}</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                        {/* Qty controls */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '5px 8px' }}>
                                            <button onClick={() => updateQuantity(item.cartId, -1)} style={{ width: 24, height: 24, borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#baaf9d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={11} /></button>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#f5efe6', minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.cartId, 1)} style={{ width: 24, height: 24, borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#baaf9d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={11} /></button>
                                            <button onClick={() => removeFromCart(item.cartId)} style={{ width: 24, height: 24, borderRadius: 7, border: '1px solid rgba(240,107,100,0.2)', background: 'rgba(240,107,100,0.07)', color: '#f06b64', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 2 }}><Trash2 size={11} /></button>
                                        </div>
                                        <button
                                            onClick={() => openCustomization(item)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#baaf9d', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer' }}
                                        >
                                            <SlidersHorizontal size={12} /> Customize
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {cart.length === 0 && tableOrders.length === 0 && (
                            <div style={{ textAlign: 'center', paddingTop: 60, color: '#7c7368' }}>
                                <div style={{ fontSize: 36, marginBottom: 10 }}>🛒</div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#baaf9d', marginBottom: 4 }}>Cart is empty</div>
                                <div style={{ fontSize: 12 }}>Tap menu items on the left to add them.</div>
                            </div>
                        )}
                    </div>

                    {/* Cart footer */}
                    <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(240,229,213,0.08)', background: 'rgba(8,9,13,0.98)', flexShrink: 0 }}>
                        {/* Totals */}
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7c7368', marginBottom: 5 }}>
                                <span>Subtotal</span><span style={{ color: '#baaf9d' }}>{formatCurrency(subtotal, settings.currencySymbol)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7c7368', marginBottom: 12 }}>
                                <span>Tax ({Number(settings.taxRate || '10')}%)</span><span style={{ color: '#baaf9d' }}>{formatCurrency(tax, settings.currencySymbol)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: '#f5efe6', paddingTop: 12, borderTop: '1px solid rgba(240,229,213,0.08)' }}>
                                <span>Total</span><span style={{ color: '#f0bf83' }}>{formatCurrency(total, settings.currencySymbol)}</span>
                            </div>
                        </div>

                        {/* CTA buttons */}
                        {editingOrderId ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <button
                                    onClick={() => { setEditingOrderId(null); setCart([]); }}
                                    style={{ padding: '13px 0', borderRadius: 14, border: '1px solid rgba(240,229,213,0.1)', background: 'rgba(255,255,255,0.04)', color: '#baaf9d', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Cancel Edit
                                </button>
                                <button
                                    onClick={() => { void submitOrder(); }}
                                    disabled={cart.length === 0 || submitting}
                                    style={{
                                        padding: '13px 0', borderRadius: 14,
                                        background: 'linear-gradient(135deg, #f0bf83 0%, #b46833 100%)',
                                        border: 'none', color: '#1a0e04', fontSize: 13, fontWeight: 800,
                                        cursor: cart.length === 0 || submitting ? 'not-allowed' : 'pointer',
                                        opacity: cart.length === 0 || submitting ? 0.5 : 1,
                                        boxShadow: '0 8px 20px rgba(180,104,51,0.35)',
                                    }}
                                >
                                    {submitting ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={openPlaceOrderPrompt}
                                disabled={cart.length === 0 || submitting}
                                style={{
                                    width: '100%',
                                    padding: '15px 0',
                                    borderRadius: 16,
                                    background: cart.length === 0
                                        ? 'rgba(255,255,255,0.05)'
                                        : 'linear-gradient(135deg, #f0bf83 0%, #b46833 60%, #6d351b 100%)',
                                    border: cart.length === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                    color: cart.length === 0 ? '#7c7368' : '#1a0e04',
                                    fontSize: 14,
                                    fontWeight: 800,
                                    cursor: cart.length === 0 || submitting ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    boxShadow: cart.length === 0 ? 'none' : '0 10px 28px rgba(180,104,51,0.4)',
                                    transition: 'all 0.2s ease',
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                <CreditCard size={16} />
                                {submitting ? 'Processing…' : 'Place Order'}
                                {cart.length > 0 && !submitting && <ChevronRight size={16} />}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── CUSTOMIZATION OVERLAY ──────────────────────────────────────── */}
            {customizingCartId && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: 24, backdropFilter: 'blur(8px)' }}>
                    <div style={{ background: '#0d1117', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '88vh', overflowY: 'auto', border: '1px solid rgba(240,229,213,0.1)', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
                        {/* Customize header */}
                        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(240,229,213,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#f5efe6', letterSpacing: '-0.02em', marginBottom: 4 }}>Customize Plate</div>
                                <div style={{ fontSize: 12, color: '#7c7368' }}>Use structured selections for stock-changing edits. Kitchen note is for prep preference only.</div>
                            </div>
                            <button onClick={() => { setCustomizingCartId(null); setCustomizationOptions(null); }} style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#7c7368', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                <X size={15} />
                            </button>
                        </div>

                        <div style={{ padding: '20px 24px' }}>
                            {customizationLoading ? (
                                <div className="loading-spinner" style={{ margin: '48px auto' }} />
                            ) : customizationOptions ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* Current plate summary */}
                                    <div style={{ padding: '16px 18px', borderRadius: 14, border: '1px solid rgba(240,191,131,0.18)', background: 'rgba(240,191,131,0.06)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                            <div>
                                                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#c98541', fontWeight: 700, marginBottom: 4 }}>Current Plate</div>
                                                <div style={{ fontSize: 16, fontWeight: 800, color: '#f5efe6' }}>{customizationOptions.name}</div>
                                            </div>
                                            <span style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#baaf9d', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                {getCustomizationCountLabel(draftCustomization)}
                                            </span>
                                        </div>
                                        {summarizeCustomization(draftCustomization).length > 0 && (
                                            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {summarizeCustomization(draftCustomization).map(line => (
                                                    <div key={line} style={{ fontSize: 12, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#e2e8f0' }}>{line}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Mode switcher */}
                                    <div style={{ display: 'flex', padding: 5, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', gap: 4 }}>
                                        {([{ id: 'remove', label: 'Remove', activeColor: 'rgba(240,107,100,0.15)', activeBorder: 'rgba(240,107,100,0.3)' }, { id: 'add', label: 'Add Extras', activeColor: 'rgba(83,211,167,0.15)', activeBorder: 'rgba(83,211,167,0.3)' }, { id: 'note', label: 'Kitchen Note', activeColor: 'rgba(112,174,231,0.15)', activeBorder: 'rgba(112,174,231,0.3)' }] as Array<{ id: CustomizationMode; label: string; activeColor: string; activeBorder: string }>).map(mode => {
                                            const active = customizationMode === mode.id;
                                            return (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => setCustomizationMode(mode.id)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '9px 0',
                                                        borderRadius: 10,
                                                        border: active ? `1px solid ${mode.activeBorder}` : '1px solid transparent',
                                                        background: active ? mode.activeColor : 'transparent',
                                                        color: active ? '#f5efe6' : '#7c7368',
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                >
                                                    {mode.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Remove mode */}
                                    {customizationMode === 'remove' && (
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#f5efe6', marginBottom: 4 }}>Remove From Base Plate</div>
                                            <div style={{ fontSize: 11, color: '#7c7368', marginBottom: 12 }}>Toggle off anything the guest does not want.</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {customizationOptions.removableParts.map((part) => {
                                                    const active = draftCustomization.removals.some((item) => item.recipeIngredientId === part.recipeIngredientId);
                                                    return (
                                                        <button key={part.recipeIngredientId} onClick={() => toggleRemoval(part.recipeIngredientId, part.label)} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center', padding: '13px 16px', borderRadius: 14, border: active ? '1px solid rgba(240,107,100,0.35)' : '1px solid rgba(255,255,255,0.07)', background: active ? 'rgba(240,107,100,0.1)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left' }}>
                                                            <div style={{ width: 40, height: 22, borderRadius: 999, background: active ? '#f06b64' : 'rgba(148,163,184,0.25)', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                                                                <span style={{ position: 'absolute', top: 3, left: active ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease' }} />
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: 13, color: '#f5efe6' }}>{part.label}</div>
                                                                <div style={{ fontSize: 11, color: '#7c7368' }}>Uses {part.quantityUsed} {part.unit}</div>
                                                            </div>
                                                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? '#f06b64' : '#7c7368' }}>{active ? 'Removed' : 'Keep'}</div>
                                                        </button>
                                                    );
                                                })}
                                                {customizationOptions.removableParts.length === 0 && <div style={{ fontSize: 13, color: '#7c7368' }}>No removable base items configured in the recipe.</div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Add mode */}
                                    {customizationMode === 'add' && (
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#f5efe6', marginBottom: 4 }}>Add To Plate</div>
                                            <div style={{ fontSize: 11, color: '#7c7368', marginBottom: 12 }}>Toggle on approved extras for this custom plate.</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {customizationOptions.addableExtras.map((extra) => {
                                                    const active = draftCustomization.additions.some((item) => item.menuItemExtraOptionId === extra.menuItemExtraOptionId);
                                                    return (
                                                        <button key={extra.menuItemExtraOptionId} onClick={() => toggleAddition(extra.menuItemExtraOptionId, extra.label)} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center', padding: '13px 16px', borderRadius: 14, border: active ? '1px solid rgba(83,211,167,0.3)' : '1px solid rgba(255,255,255,0.07)', background: active ? 'rgba(83,211,167,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left' }}>
                                                            <div style={{ width: 40, height: 22, borderRadius: 999, background: active ? '#53d3a7' : 'rgba(148,163,184,0.25)', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                                                                <span style={{ position: 'absolute', top: 3, left: active ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease' }} />
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: 13, color: '#f5efe6' }}>{extra.label}</div>
                                                                <div style={{ fontSize: 11, color: '#7c7368' }}>Adds {extra.quantityUsed} {extra.unit} to stock usage</div>
                                                            </div>
                                                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? '#53d3a7' : '#7c7368' }}>{active ? 'Added' : 'Optional'}</div>
                                                        </button>
                                                    );
                                                })}
                                                {customizationOptions.addableExtras.length === 0 && <div style={{ fontSize: 13, color: '#7c7368' }}>No extras configured for this item.</div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Note mode */}
                                    {customizationMode === 'note' && (
                                        <div>
                                            <label style={{ fontSize: 13, fontWeight: 700, color: '#f5efe6', display: 'block', marginBottom: 4 }}>Kitchen Note</label>
                                            <div style={{ fontSize: 11, color: '#7c7368', marginBottom: 10 }}>Preference only: no pepper, well cooked, sauce on the side. Does not change stock.</div>
                                            <textarea
                                                rows={5}
                                                value={draftCustomization.kitchenNote}
                                                onChange={(e) => setDraftCustomization((prev) => ({ ...prev, kitchenNote: e.target.value }))}
                                                placeholder="Example: no pepper, well cooked, serve hot"
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 14px',
                                                    borderRadius: 14,
                                                    background: 'rgba(255,255,255,0.04)',
                                                    border: '1px solid rgba(240,229,213,0.1)',
                                                    color: '#f5efe6',
                                                    fontSize: 13,
                                                    outline: 'none',
                                                    resize: 'vertical',
                                                    fontFamily: 'inherit',
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 4 }}>
                                        <button onClick={() => { setCustomizingCartId(null); setCustomizationOptions(null); }} style={{ padding: '12px 0', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#baaf9d', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Close</button>
                                        <button onClick={saveCustomization} style={{ padding: '12px 0', borderRadius: 14, background: 'linear-gradient(135deg, #f0bf83, #b46833)', border: 'none', color: '#1a0e04', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(180,104,51,0.3)' }}>Save To Order</button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* ── CHECKOUT PROMPT OVERLAY ───────────────────────────────────── */}
            {checkoutPrompt && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(8px)' }}>
                    <div style={{ background: '#0d1117', padding: '36px 32px', borderRadius: 22, width: 400, textAlign: 'center', border: '1px solid rgba(240,229,213,0.1)', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
                        {/* Icon */}
                        <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg, rgba(240,191,131,0.2), rgba(180,104,51,0.1))', border: '1px solid rgba(240,191,131,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#c98541' }}>
                            <CreditCard size={28} />
                        </div>

                        {checkoutPrompt.kind === 'new_order_billing' && (
                            <>
                                <div style={{ fontSize: 19, fontWeight: 800, color: '#f5efe6', marginBottom: 8, letterSpacing: '-0.02em' }}>How should this be billed?</div>
                                <div style={{ fontSize: 13, color: '#7c7368', marginBottom: 28, lineHeight: 1.6 }}>Collect payment now or keep the tab open until the guest is ready to leave.</div>
                                <div style={{ display: 'grid', gap: 10 }}>
                                    <button onClick={() => setCheckoutPrompt({ kind: 'new_order_payment_method' })} disabled={submitting} style={{ padding: '14px 0', borderRadius: 14, background: 'linear-gradient(135deg, #f0bf83, #b46833)', border: 'none', color: '#1a0e04', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(180,104,51,0.3)' }}>Pay Now</button>
                                    <button onClick={() => submitOrder({ billingMode: 'open_tab' })} disabled={submitting} style={{ padding: '14px 0', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f5efe6', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Open Tab</button>
                                    <button onClick={() => setCheckoutPrompt(null)} disabled={submitting} style={{ padding: '14px 0', borderRadius: 14, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#7c7368', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                </div>
                            </>
                        )}

                        {checkoutPrompt.kind === 'new_order_payment_method' && (
                            <>
                                <div style={{ fontSize: 19, fontWeight: 800, color: '#f5efe6', marginBottom: 8, letterSpacing: '-0.02em' }}>How is the guest paying?</div>
                                <div style={{ fontSize: 13, color: '#7c7368', marginBottom: 28, lineHeight: 1.6 }}>Use cash if already collected, or launch Monime before sending to kitchen.</div>
                                <div style={{ display: 'grid', gap: 10 }}>
                                    <button onClick={() => submitOrder({ billingMode: 'pay_now', paymentMethod: 'cash' })} disabled={submitting} style={{ padding: '14px 0', borderRadius: 14, background: 'linear-gradient(135deg, #f0bf83, #b46833)', border: 'none', color: '#1a0e04', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(180,104,51,0.3)' }}>Cash</button>
                                    <button onClick={() => submitOrder({ billingMode: 'pay_now', paymentMethod: 'monime' })} disabled={submitting} style={{ padding: '14px 0', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f5efe6', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Monime</button>
                                    <button onClick={() => setCheckoutPrompt({ kind: 'new_order_billing' })} disabled={submitting} style={{ padding: '14px 0', borderRadius: 14, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#7c7368', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
                                </div>
                            </>
                        )}

                        {checkoutPrompt.kind === 'open_bill_payment_method' && (
                            <>
                                <div style={{ fontSize: 19, fontWeight: 800, color: '#f5efe6', marginBottom: 8, letterSpacing: '-0.02em' }}>Settle Open Bill</div>
                                <div style={{ fontSize: 13, color: '#7c7368', marginBottom: 4, lineHeight: 1.6 }}>How is the guest paying</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#f0bf83', marginBottom: 24 }}>{formatCurrency(checkoutPrompt.totalAmount, settings.currencySymbol)}</div>
                                <div style={{ display: 'grid', gap: 10 }}>
                                    <button onClick={() => confirmManualPayment(checkoutPrompt.orderId, 'cash')} disabled={confirmingPayment || submitting} style={{ padding: '14px 0', borderRadius: 14, background: 'linear-gradient(135deg, #f0bf83, #b46833)', border: 'none', color: '#1a0e04', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(180,104,51,0.3)' }}>{confirmingPayment ? 'Saving…' : 'Cash'}</button>
                                    <button onClick={() => settleOpenBillWithMonime(checkoutPrompt.orderId)} disabled={confirmingPayment || submitting} style={{ padding: '14px 0', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f5efe6', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{submitting ? 'Redirecting…' : 'Monime'}</button>
                                    <button onClick={() => setCheckoutPrompt(null)} disabled={confirmingPayment || submitting} style={{ padding: '14px 0', borderRadius: 14, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#7c7368', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
