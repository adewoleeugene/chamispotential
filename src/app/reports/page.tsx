'use client';
import React, { useEffect, useState, useTransition } from 'react';
import type { CSSProperties } from 'react';
import AppLayout from '@/components/AppLayout';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BarChart3, Download, TrendingUp, TrendingDown, Target, CalendarDays, DollarSign, ShoppingCart, Clock3, ChefHat, DoorOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency } from '@/lib/currency';

type ReportRange = 'day' | 'week' | 'month' | 'custom';
type CostMethod = 'weighted_average_as_of_sale_date' | 'fifo' | 'lifo';

type SummaryPayload = {
    recognizedRevenue: number;
    netSales: number;
    taxCollected: number;
    discountsGiven: number;
    ingredientSpend: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
    totalRevenue: number;
    totalOrders: number;
    avgTicket: number;
    bestSeller: string;
    lowInventoryCount: number;
};

type ServiceTimingRow = {
    id: string;
    orderNumber: number;
    tableLabel: string;
    status: string;
    createdAt: string;
    orderToKitchenMinutes: number | null;
    kitchenToExitMinutes: number | null;
    fullJourneyMinutes: number | null;
    total: number;
};

type ItemPerformanceRow = {
    id: string;
    name: string;
    category: string;
    quantity: number;
    revenue: number;
    estimatedCost: number;
    grossProfit: number;
    grossMarginPct: number;
};

type ReportPayload = {
    metadata: {
        costMethod: CostMethod;
        supportedCostMethods: CostMethod[];
    };
    selectedRange: {
        start: string;
        end: string;
    };
    label: string;
    chartLabel: string;
    summary: SummaryPayload;
    previousPeriodComparison: {
        currentLabel: string;
        previousLabel: string;
        metrics: {
            netSales: { current: number; previous: number; delta: number; deltaPct: number | null };
            ingredientSpend: { current: number; previous: number; delta: number; deltaPct: number | null };
            grossProfit: { current: number; previous: number; delta: number; deltaPct: number | null };
            grossMarginPct: { current: number; previous: number; delta: number; deltaPct: number | null };
            totalOrders: { current: number; previous: number; delta: number; deltaPct: number | null };
        };
    } | null;
    periodComparisons: Array<{
        range: 'day' | 'week' | 'month' | 'custom';
        label: string;
        shortLabel: string;
        netSales: number;
        ingredientSpend: number;
        grossProfit: number;
        grossMarginPct: number;
        totalOrders: number;
        topPurchasedIngredient: string;
        topPurchasedIngredientSpend: number;
        spendConcentrationPct: number;
    }>;
    purchaseAnalytics: {
        totalSpend: number;
        spendConcentrationPct: number;
        topPurchasedIngredients: Array<{
            inventoryId: string;
            name: string;
            category: string;
            unit: string;
            quantity: number;
            totalCost: number;
            purchaseCount: number;
            averageUnitCost: number;
            supplierCount: number;
            lastPurchasedAt: string | null;
            spendSharePct: number;
        }>;
        purchasesByIngredient: Array<{
            inventoryId: string;
            name: string;
            category: string;
            unit: string;
            quantity: number;
            totalCost: number;
            purchaseCount: number;
            averageUnitCost: number;
            supplierCount: number;
            lastPurchasedAt: string | null;
            spendSharePct: number;
        }>;
        supplierSpend: Array<{
            supplier: string;
            totalCost: number;
            purchaseCount: number;
            sharePct: number;
        }>;
        recentPurchases: Array<{
            inventoryId: string;
            inventoryName: string;
            category: string;
            unit: string;
            quantity: number;
            unitCost: number;
            totalCost: number;
            supplier: string | null;
            notes: string | null;
            purchasedAt: string;
        }>;
    };
    purchaseHistory: Array<{
        key: string;
        label: string;
        totalSpend: number;
        purchaseCount: number;
        topIngredient: string;
        topSupplier: string;
    }>;
    costAudit: Array<{
        orderId: string;
        orderNumber: number;
        soldAt: string;
        itemName: string;
        ingredientName: string;
        ingredientUnit: string;
        quantityUsed: number;
        saleDateUnitCost: number;
        currentUnitCost: number;
        saleDateExtendedCost: number;
        currentExtendedCost: number;
        variance: number;
    }>;
    serviceTiming: {
        avgOrderToKitchenMinutes: number;
        avgKitchenToExitMinutes: number;
        avgFullServiceMinutes: number;
        measuredOrderToKitchenCount: number;
        measuredKitchenToExitCount: number;
        measuredFullServiceCount: number;
    };
    serviceTimingRows: ServiceTimingRow[];
    trend: Array<{
        key: string;
        label: string;
        revenue: number;
        netSales: number;
        cogs: number;
        ingredientSpend: number;
        grossProfit: number;
        orders: number;
    }>;
    orderTypeMix: Array<{ type: string; count: number; revenue: number }>;
    topItems: ItemPerformanceRow[];
    slowMovingItems: ItemPerformanceRow[];
    highMarginItems: ItemPerformanceRow[];
    lowMarginItems: ItemPerformanceRow[];
    itemProfitability: ItemPerformanceRow[];
    salesVelocity: Array<ItemPerformanceRow & { unitsPerDay: number }>;
    lowInventory: Array<{ id: string; name: string; category: string; currentStock: number; minStock: number }>;
    insights: string[];
};

const RANGE_LABELS: Record<ReportRange, string> = {
    day: 'Day',
    week: 'Week',
    month: 'Month',
    custom: 'Custom',
};

function formatDuration(minutes: number) {
    if (!minutes || minutes <= 0) return '0m';
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    const remainingMinutes = rounded % 60;
    return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

function formatDurationCell(minutes: number | null | undefined) {
    if (minutes === null || minutes === undefined) return 'Not captured';
    return formatDuration(minutes);
}

function formatPercent(value: number) {
    return `${value.toFixed(1)}%`;
}

function formatDelta(value: number | null) {
    if (value === null || Number.isNaN(value)) return 'New vs previous period';
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function getDeltaTone(value: number | null) {
    if (value === null || Number.isNaN(value)) {
        return {
            color: '#cbd5e1',
            background: 'rgba(148,163,184,0.14)',
            border: '1px solid rgba(148,163,184,0.18)',
        };
    }

    return value >= 0
        ? {
            color: '#86efac',
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.22)',
        }
        : {
            color: '#fca5a5',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.22)',
        };
}

export default function ReportsPage() {
    const { user } = useAuth();
    const { settings } = useSettings();
    const [range, setRange] = useState<ReportRange>('week');
    const [costMethod, setCostMethod] = useState<CostMethod>('weighted_average_as_of_sale_date');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [data, setData] = useState<ReportPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFilterPending, startFilterTransition] = useTransition();
    const isAdmin = user?.role === 'admin';
    const reportReady = range !== 'custom' || Boolean(customStartDate && customEndDate);
    const isSyncing = refreshing || isFilterPending;

    useEffect(() => {
        if (range !== 'custom' || (customStartDate && customEndDate)) {
            return;
        }

        const today = new Date();
        const end = today.toISOString().slice(0, 10);
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        setCustomStartDate(start.toISOString().slice(0, 10));
        setCustomEndDate(end);
    }, [customEndDate, customStartDate, range]);

    useEffect(() => {
        if (!reportReady) {
            return;
        }

        let cancelled = false;
        const controller = new AbortController();

        const loadReports = async () => {
            if (data) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            try {
                const params = new URLSearchParams({ range });
                params.set('costMethod', isAdmin ? costMethod : 'weighted_average_as_of_sale_date');
                if (range === 'custom' && customStartDate && customEndDate) {
                    params.set('startDate', customStartDate);
                    params.set('endDate', customEndDate);
                }
                const res = await fetch(`/api/reports?${params.toString()}`, { signal: controller.signal });
                const payload = await res.json();
                if (!res.ok) {
                    throw new Error(payload?.error || 'Unable to load reports');
                }

                if (!cancelled) {
                    setData(payload);
                    setLoading(false);
                    setRefreshing(false);
                }
            } catch (err) {
                if (controller.signal.aborted || cancelled) {
                    return;
                }

                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Unable to load reports');
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        };

        void loadReports();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [costMethod, customEndDate, customStartDate, isAdmin, range, reportReady]);

    const downloadCsv = (path: string) => {
        window.location.href = path;
    };

    const buildExportQuery = () => {
        const params = new URLSearchParams({ range });
        params.set('costMethod', isAdmin ? costMethod : 'weighted_average_as_of_sale_date');
        params.set('currencySymbol', settings.currencySymbol || '$');
        if (range === 'custom' && customStartDate && customEndDate) {
            params.set('startDate', customStartDate);
            params.set('endDate', customEndDate);
        }
        return params.toString();
    };

    if (loading && !data) {
        return (
            <AppLayout>
                <div className="card" style={{ padding: 28, marginBottom: 16 }}>
                    <div className="text-muted text-sm font-bold uppercase">Preparing report pack</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#f8fafc', marginTop: 8 }}>Pulling sales, margin, and purchase data...</div>
                    <p className="text-sm text-muted" style={{ marginTop: 10 }}>This page combines paid orders, ingredient purchases, and service timing for managers.</p>
                </div>
                <div className="loading-spinner" style={{ margin: '80px auto' }} />
            </AppLayout>
        );
    }

    if (error && !data) {
        return (
            <AppLayout>
                <div className="card" style={{ padding: 28 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>Reports need attention</h2>
                    <p className="text-sm text-muted" style={{ marginTop: 10 }}>{error}</p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload Reports</button>
                    </div>
                </div>
            </AppLayout>
        );
    }

    const updateRange = (nextRange: ReportRange) => {
        startFilterTransition(() => {
            setRange(nextRange);
        });
    };

    const updateCostMethod = (nextMethod: CostMethod) => {
        startFilterTransition(() => {
            setCostMethod(nextMethod);
        });
    };

    const updateCustomStart = (value: string) => {
        startFilterTransition(() => {
            setCustomStartDate(value);
        });
    };

    const updateCustomEnd = (value: string) => {
        startFilterTransition(() => {
            setCustomEndDate(value);
        });
    };

    const purchaseAnalytics = data?.purchaseAnalytics;
    const comparisonCards = data?.periodComparisons || [];
    const previousComparison = data?.previousPeriodComparison;
    const purchaseTrend = (data?.trend || []).map((entry) => ({
        label: entry.label,
        ingredientSpend: entry.ingredientSpend,
    }));
    const costMethodLabel = data?.metadata?.costMethod === 'weighted_average_as_of_sale_date'
        ? 'Weighted-average cost as of each sale date'
        : data?.metadata?.costMethod === 'fifo'
            ? 'FIFO historical costing'
            : 'LIFO historical costing';
    const auditSubtitle = data?.metadata?.costMethod === 'weighted_average_as_of_sale_date'
        ? 'Weighted-average cost as of sale date versus current weighted-average cost for sold ingredients'
        : `Weighted-average reference audit for sold ingredients while ${data?.metadata?.costMethod?.toUpperCase()} drives report profitability`;
    const costingGuide = [
        {
            key: 'weighted_average_as_of_sale_date',
            label: 'Weighted Avg',
            accent: '#38bdf8',
            detail: 'Blends available purchase costs up to the sale date for a smoother margin view.',
        },
        {
            key: 'fifo',
            label: 'FIFO',
            accent: '#f59e0b',
            detail: 'Uses the oldest stock first, which often mirrors physical inventory rotation.',
        },
        {
            key: 'lifo',
            label: 'LIFO',
            accent: '#22c55e',
            detail: 'Uses the newest stock first, pushing recent purchase prices into COGS sooner.',
        },
    ] as const;
    const activeCostingGuide = costingGuide.find((item) => item.key === costMethod) || costingGuide[0];

    const summaryCards = [
        {
            label: `${data?.label || 'Period'} Net Sales`,
            value: formatCurrency(data?.summary?.netSales || 0, settings.currencySymbol),
            icon: DollarSign,
            accent: '#38bdf8',
            detail: 'Paid food and drink sales after discounts, before tax.',
            eyebrow: 'Sales',
        },
        {
            label: `${data?.label || 'Period'} Purchase Spend`,
            value: formatCurrency(data?.summary?.ingredientSpend || 0, settings.currencySymbol),
            icon: ShoppingCart,
            accent: '#f59e0b',
            detail: 'Inventory purchase entries logged inside the selected range.',
            eyebrow: 'Purchasing',
        },
        {
            label: 'Gross Profit',
            value: formatCurrency(data?.summary?.grossProfit || 0, settings.currencySymbol),
            icon: Target,
            accent: '#22c55e',
            detail: 'Net sales minus estimated cost of ingredients used in sold items.',
            eyebrow: 'Profit',
        },
        {
            label: 'Gross Margin Rate',
            value: formatPercent(data?.summary?.grossMarginPct || 0),
            icon: TrendingUp,
            accent: '#a78bfa',
            detail: costMethodLabel,
            eyebrow: 'Method',
        },
    ];

    const serviceStageCards = [
        {
            label: 'Order to Kitchen',
            value: formatDuration(data?.serviceTiming?.avgOrderToKitchenMinutes || 0),
            icon: ChefHat,
            accent: '#f59e0b',
            detail: `${data?.serviceTiming?.measuredOrderToKitchenCount || 0} tracked orders from placement to kitchen start.`,
        },
        {
            label: 'Kitchen to Exit',
            value: formatDuration(data?.serviceTiming?.avgKitchenToExitMinutes || 0),
            icon: DoorOpen,
            accent: '#22c55e',
            detail: `${data?.serviceTiming?.measuredKitchenToExitCount || 0} tracked orders from kitchen start to payment or departure.`,
        },
        {
            label: 'Full Service Journey',
            value: formatDuration(data?.serviceTiming?.avgFullServiceMinutes || 0),
            icon: Clock3,
            accent: '#38bdf8',
            detail: `${data?.serviceTiming?.measuredFullServiceCount || 0} fully completed order journeys.`,
        },
    ];

    return (
        <AppLayout>
            <div className="page-content reports-page">
                <section className="reports-hero">
                    <div className="reports-hero-glow" />
                    <div className="reports-hero-grid">
                        <div className="reports-hero-copy">
                            <div>
                                <div className="reports-kicker-pill">
                                    <BarChart3 size={16} />
                                    Reports
                                </div>
                                <h2 className="reports-hero-title">
                                    How is the restaurant actually doing?
                                </h2>
                                <p className="reports-hero-description">
                                    Sales, ingredient spend, profit, service timing and stock pressure — all in one place. Pick a period below to dig in.
                                </p>
                            </div>
                            <div className="reports-meta-grid">
                                <div className="reports-meta-card">
                                    <div className="reports-meta-label">Showing</div>
                                    <div className="reports-meta-value">{data?.label || 'This Week'}</div>
                                </div>
                                <div className="reports-meta-card">
                                    <div className="reports-meta-label">Cost method</div>
                                    <div className="reports-meta-value">{isAdmin ? activeCostingGuide.label : 'Weighted Avg'}</div>
                                </div>
                                <div className="reports-meta-card">
                                    <div className="reports-meta-label">Your view</div>
                                    <div className="reports-meta-value">{isAdmin ? 'Owner / Finance' : 'Manager'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="reports-control-panel">
                            <div className="reports-control-head">
                                <div>
                                    <div className="reports-control-title">Controls</div>
                                    <div className="reports-control-copy">Change the period or export the numbers below.</div>
                                </div>
                                <div className="reports-control-badges">
                                    {isSyncing && (
                                        <div className="reports-status-pill reports-status-pill--sync">
                                            Updating…
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="reports-range-switcher">
                            {(['day', 'week', 'month', 'custom'] as ReportRange[]).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => updateRange(item)}
                                    className={`reports-range-button${range === item ? ' is-active' : ''}`}
                                >
                                    {RANGE_LABELS[item]}
                                </button>
                            ))}
                            </div>

                        {range === 'custom' && (
                            <div className="reports-date-grid">
                                <label className="reports-date-field">
                                    Start Date
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(event) => updateCustomStart(event.target.value)}
                                        className="reports-date-input"
                                    />
                                </label>
                                <label className="reports-date-field">
                                    End Date
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(event) => updateCustomEnd(event.target.value)}
                                        className="reports-date-input"
                                    />
                                </label>
                            </div>
                        )}

                        {isAdmin ? (
                            <div className="reports-costing-card" style={{ '--report-accent': activeCostingGuide.accent } as CSSProperties}>
                                <div className="reports-costing-head">
                                    <div>
                                        <div className="reports-costing-label">Costing Method</div>
                                        <div className="reports-costing-title">{activeCostingGuide.label}</div>
                                    </div>
                                    <select
                                        aria-label="Costing"
                                        value={costMethod}
                                        onChange={(event) => updateCostMethod(event.target.value as CostMethod)}
                                        className="reports-costing-select"
                                    >
                                        <option value="weighted_average_as_of_sale_date">Weighted Avg</option>
                                        <option value="fifo">FIFO</option>
                                        <option value="lifo">LIFO</option>
                                    </select>
                                </div>
                                <div className="reports-costing-description">
                                    {activeCostingGuide.detail}
                                </div>
                                <div className="reports-costing-options">
                                    {costingGuide.map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => updateCostMethod(item.key)}
                                            aria-pressed={item.key === costMethod}
                                            className={`reports-costing-option${item.key === costMethod ? ' is-active' : ''}`}
                                            style={{ '--report-option-accent': item.accent } as CSSProperties}
                                        >
                                            <div className="reports-costing-option-title">{item.label}</div>
                                            <div className="reports-costing-option-copy">
                                                {item.key === 'weighted_average_as_of_sale_date' ? 'Blended cost view' : item.key === 'fifo' ? 'Oldest stock first' : 'Newest stock first'}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="reports-locked-card">
                                <div className="reports-locked-title">Advanced costing is available to admins</div>
                                <div className="reports-locked-copy">
                                    This view stays on weighted-average costing. Admins can switch to FIFO or LIFO when they need a different inventory-cost lens for margin review.
                                </div>
                            </div>
                        )}

                        <div className="reports-export-section">
                            <div className="reports-export-head">
                                <div>
                                    <div className="reports-export-label">Downloads</div>
                                    <div className="reports-export-copy">
                                        Export the current report view without leaving this control panel.
                                    </div>
                                </div>
                            </div>
                            <div className={`reports-export-grid${isAdmin ? ' reports-export-grid--admin' : ''}`}>
                                <button type="button" className="btn btn-secondary reports-export-button" onClick={() => downloadCsv(`/api/exports/reports?${buildExportQuery()}`)}>
                                    <Download size={16} /> Report PDF
                                </button>
                                {isAdmin && (
                                    <>
                                        <button type="button" className="btn btn-secondary reports-export-button" onClick={() => downloadCsv(`/api/exports/sales?${buildExportQuery()}&format=pdf`)}>
                                            <Download size={16} /> Sales PDF
                                        </button>
                                        <button type="button" className="btn btn-secondary reports-export-button" onClick={() => downloadCsv(`/api/exports/purchases?${buildExportQuery()}&format=pdf`)}>
                                            <Download size={16} /> Purchases PDF
                                        </button>
                                        <button type="button" className="btn btn-secondary reports-export-button" onClick={() => downloadCsv(`/api/exports/sales?${buildExportQuery()}`)}>
                                            <Download size={16} /> Sales CSV
                                        </button>
                                        <button type="button" className="btn btn-secondary reports-export-button" onClick={() => downloadCsv(`/api/exports/purchases?${buildExportQuery()}`)}>
                                            <Download size={16} /> Purchase Ledger CSV
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        </div>
                    </div>
                </section>

            {error && data && (
                <div className="card" style={{ padding: 16, marginBottom: 18, border: '1px solid rgba(248,113,113,0.22)', background: 'rgba(69,10,10,0.22)' }}>
                    <div style={{ color: '#fecaca', fontSize: 13, fontWeight: 700 }}>
                        We kept the last report on screen, but the latest refresh failed: {error}
                    </div>
                </div>
            )}

            <div className="reports-summary-grid">
                {summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.label}
                            className="card reports-summary-card"
                            style={{ '--report-accent': card.accent } as CSSProperties}
                        >
                            <div className="reports-summary-card-overlay" />
                            <div className="reports-summary-card-head">
                                <div>
                                    <div className="reports-summary-card-eyebrow">
                                        {card.eyebrow}
                                    </div>
                                    <div className="reports-summary-card-label">
                                        {card.label}
                                    </div>
                                </div>
                                <div className="reports-summary-card-icon">
                                    <Icon size={18} />
                                </div>
                            </div>
                            <div className="reports-summary-card-body">
                                <div className="reports-summary-card-value">
                                    {card.value}
                                </div>
                                <div className="reports-summary-card-detail">
                                    {card.detail}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {isAdmin && (
                <div
                    style={{
                        marginBottom: 18,
                        borderRadius: 24,
                        border: '1px solid rgba(148,163,184,0.14)',
                        background: 'linear-gradient(180deg, rgba(10,16,28,0.96), rgba(15,23,42,0.82))',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(148,163,184,0.12)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.3, textTransform: 'uppercase', color: '#7dd3fc', marginBottom: 6 }}>
                                Previous Period Read
                            </div>
                            <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: 20 }}>
                                How this range moved against {previousComparison?.previousLabel || 'the prior window'}
                            </div>
                        </div>
                        <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(125,211,252,0.12)', color: '#bae6fd', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Admin comparison
                        </div>
                    </div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 0,
                        }}
                    >
                        {[
                            {
                                title: 'Net Sales',
                                value: formatCurrency(previousComparison?.metrics.netSales.current || 0, settings.currencySymbol),
                                delta: previousComparison?.metrics.netSales.deltaPct ?? null,
                                detail: 'Revenue pace',
                            },
                            {
                                title: 'Purchase Spend',
                                value: formatCurrency(previousComparison?.metrics.ingredientSpend.current || 0, settings.currencySymbol),
                                delta: previousComparison?.metrics.ingredientSpend.deltaPct ?? null,
                                detail: 'Restock pressure',
                            },
                            {
                                title: 'Gross Profit',
                                value: formatCurrency(previousComparison?.metrics.grossProfit.current || 0, settings.currencySymbol),
                                delta: previousComparison?.metrics.grossProfit.deltaPct ?? null,
                                detail: 'Margin outcome',
                            },
                        ].map((card, index) => {
                            const tone = getDeltaTone(card.delta);
                            return (
                                <div
                                    key={card.title}
                                    style={{
                                        padding: 20,
                                        borderLeft: index === 0 ? 'none' : '1px solid rgba(148,163,184,0.1)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 14,
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: 16 }}>{card.title}</div>
                                            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{card.detail}</div>
                                        </div>
                                        <span style={{ padding: '7px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: 0.3, ...tone }}>
                                            {formatDelta(card.delta)}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 34, fontWeight: 900, color: '#f8fafc', letterSpacing: -1.1, lineHeight: 0.98 }}>
                                        {card.value}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#9fb0c1', lineHeight: 1.6 }}>
                                        Compared with {previousComparison?.previousLabel || 'the previous period'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {!isAdmin && previousComparison && (
                <div
                    style={{
                        marginBottom: 18,
                        borderRadius: 24,
                        border: '1px solid rgba(148,163,184,0.14)',
                        background: 'linear-gradient(180deg, rgba(10,16,28,0.96), rgba(15,23,42,0.82))',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(148,163,184,0.12)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.3, textTransform: 'uppercase', color: '#7dd3fc', marginBottom: 6 }}>
                                Period Comparison
                            </div>
                            <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: 20 }}>
                                {previousComparison.currentLabel} vs {previousComparison.previousLabel}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 0 }}>
                        {[
                            {
                                title: 'Net Sales',
                                value: formatCurrency(previousComparison.metrics.netSales.current, settings.currencySymbol),
                                delta: previousComparison.metrics.netSales.deltaPct ?? null,
                                detail: 'Revenue pace',
                            },
                            {
                                title: 'Orders',
                                value: String(previousComparison.metrics.totalOrders.current),
                                delta: previousComparison.metrics.totalOrders.deltaPct ?? null,
                                detail: 'Order count',
                            },
                            {
                                title: 'Gross Profit',
                                value: formatCurrency(previousComparison.metrics.grossProfit.current, settings.currencySymbol),
                                delta: previousComparison.metrics.grossProfit.deltaPct ?? null,
                                detail: 'Margin outcome',
                            },
                        ].map((card, index) => {
                            const tone = getDeltaTone(card.delta);
                            return (
                                <div
                                    key={card.title}
                                    style={{
                                        padding: 20,
                                        borderLeft: index === 0 ? 'none' : '1px solid rgba(148,163,184,0.1)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 14,
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: 16 }}>{card.title}</div>
                                            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{card.detail}</div>
                                        </div>
                                        <span style={{ padding: '7px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: 0.3, ...tone }}>
                                            {formatDelta(card.delta)}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 34, fontWeight: 900, color: '#f8fafc', letterSpacing: -1.1, lineHeight: 0.98 }}>
                                        {card.value}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#9fb0c1', lineHeight: 1.6 }}>
                                        vs {previousComparison.previousLabel}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="grid-3 gap-4 mb-4 reports-service-grid">
                {serviceStageCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="card reports-service-card" style={{ '--report-accent': card.accent } as CSSProperties}>
                            <div className="reports-service-card-head">
                                <div className="text-muted text-sm font-bold uppercase">{card.label}</div>
                                <div className="reports-service-card-icon">
                                    <Icon size={18} />
                                </div>
                            </div>
                            <div className="reports-service-card-value">
                                {card.value}
                            </div>
                            <div className="text-xs text-muted">{card.detail}</div>
                        </div>
                    );
                })}
            </div>

            {isAdmin && (
                <div className="grid-2 gap-4 mb-4">
                    {comparisonCards.map((card) => (
                    <div
                        key={card.shortLabel}
                        className="card"
                        style={{
                            padding: 24,
                            background: card.range === range
                                ? 'linear-gradient(180deg, rgba(56,189,248,0.12), rgba(15,23,42,0.9))'
                                : 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.78))',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                            <div>
                                <div className="text-muted text-sm font-bold uppercase">{card.label}</div>
                                <div style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc', marginTop: 8 }}>
                                    {formatCurrency(card.ingredientSpend || 0, settings.currencySymbol)}
                                </div>
                            </div>
                            <span className="badge" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', height: 'fit-content' }}>
                                {card.totalOrders} paid orders
                            </span>
                        </div>
                        <div className="grid-2 gap-4">
                            <div>
                                <div className="text-xs text-muted">Net sales</div>
                                <div className="font-bold">{formatCurrency(card.netSales || 0, settings.currencySymbol)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted">Gross margin</div>
                                <div className="font-bold">{formatPercent(card.grossMarginPct || 0)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted">Top purchased ingredient</div>
                                <div className="font-bold">{card.topPurchasedIngredient}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted">Spend concentration</div>
                                <div className="font-bold">{formatPercent(card.spendConcentrationPct || 0)}</div>
                            </div>
                        </div>
                    </div>
                    ))}
                </div>
            )}

            <div className="grid-2 gap-4 mb-4">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Revenue Rhythm</h3>
                            <p className="card-subtitle">{data?.chartLabel || 'Demand pattern'} across {data?.label?.toLowerCase() || 'this period'}</p>
                        </div>
                    </div>
                    <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data?.trend || []}>
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
                                <Bar dataKey="netSales" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Decision Signals</h3>
                            <p className="card-subtitle">Plain-language takeaways for the selected operating window</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(data?.insights || []).map((insight: string, index: number) => (
                            <div key={index} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
                                <div className="text-sm text-muted">{insight}</div>
                            </div>
                        ))}
                        {(!data?.insights || data.insights.length === 0) && (
                            <div className="empty-state">No report insights available yet</div>
                        )}
                    </div>
                </div>
            </div>

            {isAdmin && (
            <div className="card mb-4">
                <div className="card-header">
                    <div>
                        <h3 className="card-title flex items-center gap-2"><CalendarDays size={16} /> Purchase History Drilldown</h3>
                        <p className="card-subtitle">Bucketed purchase history with top ingredient and supplier context</p>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Period</th>
                                <th>Purchase Entries</th>
                                <th>Top Ingredient</th>
                                <th>Top Supplier</th>
                                <th>Total Spend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.purchaseHistory || []).map((row) => (
                                <tr key={row.key}>
                                    <td className="font-bold">{row.label}</td>
                                    <td>{row.purchaseCount}</td>
                                    <td>{row.topIngredient}</td>
                                    <td>{row.topSupplier}</td>
                                    <td>{formatCurrency(row.totalSpend, settings.currencySymbol)}</td>
                                </tr>
                            ))}
                            {(!data?.purchaseHistory || data.purchaseHistory.length === 0) && (
                                <tr><td colSpan={5} className="empty-state">No purchase history is available for this range yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            <div className="grid-2 gap-4 mb-4">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title flex items-center gap-2"><ShoppingCart size={16} /> Purchase Spend Trend</h3>
                            <p className="card-subtitle">Restock spend over time in the selected range</p>
                        </div>
                    </div>
                    <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={purchaseTrend}>
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
                                <Bar dataKey="ingredientSpend" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title flex items-center gap-2"><CalendarDays size={16} /> Purchase Focus</h3>
                            <p className="card-subtitle">This week and month spend concentration at a glance</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, background: 'rgba(255,255,255,0.02)' }}>
                            <div className="text-xs text-muted">Top purchased ingredients share</div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc', marginTop: 8 }}>
                                {formatPercent(purchaseAnalytics?.spendConcentrationPct || 0)}
                            </div>
                            <div className="text-sm text-muted" style={{ marginTop: 8 }}>Share of purchase spend driven by the top five ingredients in the selected range.</div>
                        </div>
                        {(purchaseAnalytics?.topPurchasedIngredients || []).slice(0, 3).map((item) => (
                            <div key={item.inventoryId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                                <div>
                                    <div className="font-bold">{item.name}</div>
                                    <div className="text-xs text-muted">{item.quantity.toFixed(2)} {item.unit} purchased • {item.purchaseCount} deliveries</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">{formatCurrency(item.totalCost, settings.currencySymbol)}</div>
                                    <div className="text-xs text-muted">{formatPercent(item.spendSharePct)} of spend</div>
                                </div>
                            </div>
                        ))}
                        {(!purchaseAnalytics?.topPurchasedIngredients || purchaseAnalytics.topPurchasedIngredients.length === 0) && (
                            <div className="empty-state">No purchase records were logged for this range yet.</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-header">
                    <div>
                        <h3 className="card-title flex items-center gap-2"><Clock3 size={16} /> Service Journey Detail</h3>
                        <p className="card-subtitle">Per-order timing from placement to kitchen, then kitchen to customer exit</p>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Table</th>
                                <th>Opened</th>
                                <th>Order to Kitchen</th>
                                <th>Kitchen to Exit</th>
                                <th>Full Journey</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.serviceTimingRows || []).map((row) => (
                                <tr key={row.id}>
                                    <td>
                                        <div className="font-bold">#{row.orderNumber}</div>
                                        <div className="text-muted text-sm">{row.status}</div>
                                    </td>
                                    <td>{row.tableLabel}</td>
                                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                                    <td>{formatDurationCell(row.orderToKitchenMinutes)}</td>
                                    <td>{formatDurationCell(row.kitchenToExitMinutes)}</td>
                                    <td>{formatDurationCell(row.fullJourneyMinutes)}</td>
                                    <td className="font-bold">{formatCurrency(row.total || 0, settings.currencySymbol)}</td>
                                </tr>
                            ))}
                            {(!data?.serviceTimingRows || data.serviceTimingRows.length === 0) && (
                                <tr><td colSpan={7} className="empty-state">No completed dine-in service journeys are available for this range yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid-2 gap-4 mb-4">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title flex items-center gap-2"><TrendingUp size={16} /> Top Performers</h3>
                            <p className="card-subtitle">Menu items leading order volume</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(data?.topItems || []).map((item) => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                                <div>
                                    <div className="font-bold">{item.name}</div>
                                    <div className="text-xs text-muted">{item.quantity} sold</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">{formatCurrency(item.grossProfit || 0, settings.currencySymbol)}</div>
                                    <span className="badge available">High velocity</span>
                                </div>
                            </div>
                        ))}
                        {(!data?.topItems || data.topItems.length === 0) && (
                            <div className="empty-state">No top-performing items for this range</div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title flex items-center gap-2"><TrendingDown size={16} /> Slow Movers</h3>
                            <p className="card-subtitle">Items to review for bundle, price, or placement changes</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(data?.slowMovingItems || []).map((item) => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                                <div>
                                    <div className="font-bold">{item.name}</div>
                                    <div className="text-xs text-muted">{item.category} • {item.quantity} sold</div>
                                </div>
                                <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Watch</span>
                            </div>
                        ))}
                        {(!data?.slowMovingItems || data.slowMovingItems.length === 0) && (
                            <div className="empty-state">No slow-moving items for this range</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid-2 gap-4 mb-4">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title flex items-center gap-2"><TrendingUp size={16} /> High-Margin Items</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Sold</th>
                                    <th>Revenue</th>
                                    <th>Profit</th>
                                    <th>Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.highMarginItems || []).map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="font-bold">{item.name}</div>
                                            <div className="text-xs text-muted">{item.category}</div>
                                        </td>
                                        <td>{item.quantity}</td>
                                        <td>{formatCurrency(item.revenue, settings.currencySymbol)}</td>
                                        <td>{formatCurrency(item.grossProfit, settings.currencySymbol)}</td>
                                        <td>{formatPercent(item.grossMarginPct)}</td>
                                    </tr>
                                ))}
                                {(!data?.highMarginItems || data.highMarginItems.length === 0) && (
                                    <tr><td colSpan={5} className="empty-state">No high-margin item data is available yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Low-Margin Watchlist</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Sold</th>
                                    <th>Revenue</th>
                                    <th>Estimated Cost</th>
                                    <th>Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.lowMarginItems || []).map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="font-bold">{item.name}</div>
                                            <div className="text-xs text-muted">{item.category}</div>
                                        </td>
                                        <td>{item.quantity}</td>
                                        <td>{formatCurrency(item.revenue, settings.currencySymbol)}</td>
                                        <td>{formatCurrency(item.estimatedCost, settings.currencySymbol)}</td>
                                        <td>{formatPercent(item.grossMarginPct)}</td>
                                    </tr>
                                ))}
                                {(!data?.lowMarginItems || data.lowMarginItems.length === 0) && (
                                    <tr><td colSpan={5} className="empty-state">No low-margin items in this range.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-header">
                    <h3 className="card-title flex items-center gap-2"><CalendarDays size={16} /> Revenue Mix</h3>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {(data?.orderTypeMix || []).map((entry) => (
                        <div key={entry.type} style={{ flex: '1 1 160px', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                            <div>
                                <div className="font-bold" style={{ textTransform: 'capitalize' }}>{entry.type}</div>
                                <div className="text-xs text-muted">{entry.count} orders</div>
                            </div>
                            <div className="font-bold">{formatCurrency(entry.revenue || 0, settings.currencySymbol)}</div>
                        </div>
                    ))}
                    {(!data?.orderTypeMix || data.orderTypeMix.length === 0) && (
                        <div className="empty-state">No order type data for this range</div>
                    )}
                </div>
            </div>

            {isAdmin && (
            <div className="grid-2 gap-4 mb-4">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title flex items-center gap-2"><ShoppingCart size={16} /> Purchases by Ingredient</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Ingredient</th>
                                    <th>Qty</th>
                                    <th>Purchase Count</th>
                                    <th>Avg Cost</th>
                                    <th>Total Spend</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(purchaseAnalytics?.purchasesByIngredient || []).slice(0, 8).map((item) => (
                                    <tr key={item.inventoryId}>
                                        <td>
                                            <div className="font-bold">{item.name}</div>
                                            <div className="text-xs text-muted">{item.category}</div>
                                        </td>
                                        <td>{item.quantity.toFixed(2)} {item.unit}</td>
                                        <td>{item.purchaseCount}</td>
                                        <td>{formatCurrency(item.averageUnitCost, settings.currencySymbol)}</td>
                                        <td>
                                            <div className="font-bold">{formatCurrency(item.totalCost, settings.currencySymbol)}</div>
                                            <div className="text-xs text-muted">{formatPercent(item.spendSharePct)} of spend</div>
                                        </td>
                                    </tr>
                                ))}
                                {(!purchaseAnalytics?.purchasesByIngredient || purchaseAnalytics.purchasesByIngredient.length === 0) && (
                                    <tr><td colSpan={5} className="empty-state">No purchases by ingredient are available for this range yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Supplier Spend</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Supplier</th>
                                    <th>Deliveries</th>
                                    <th>Share</th>
                                    <th>Total Spend</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(purchaseAnalytics?.supplierSpend || []).slice(0, 8).map((supplier) => (
                                    <tr key={supplier.supplier}>
                                        <td className="font-bold">{supplier.supplier}</td>
                                        <td>{supplier.purchaseCount}</td>
                                        <td>{formatPercent(supplier.sharePct)}</td>
                                        <td>{formatCurrency(supplier.totalCost, settings.currencySymbol)}</td>
                                    </tr>
                                ))}
                                {(!purchaseAnalytics?.supplierSpend || purchaseAnalytics.supplierSpend.length === 0) && (
                                    <tr><td colSpan={4} className="empty-state">No supplier spend is available for this range yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            )}

            {isAdmin && (
            <div className="card">
                <div className="card-header">
                    <div>
                        <h3 className="card-title flex items-center gap-2"><ShoppingCart size={16} /> Recent Purchase Ledger</h3>
                        <p className="card-subtitle">Latest inventory purchase entries in the selected range</p>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Purchased</th>
                                <th>Ingredient</th>
                                <th>Supplier</th>
                                <th>Quantity</th>
                                <th>Unit Cost</th>
                                <th>Total Spend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(purchaseAnalytics?.recentPurchases || []).map((purchase) => (
                                <tr key={`${purchase.inventoryId}-${purchase.purchasedAt}`}>
                                    <td>{new Date(purchase.purchasedAt).toLocaleString()}</td>
                                    <td>
                                        <div className="font-bold">{purchase.inventoryName}</div>
                                        <div className="text-xs text-muted">{purchase.category}</div>
                                    </td>
                                    <td>{purchase.supplier || 'Unspecified supplier'}</td>
                                    <td>{purchase.quantity.toFixed(2)} {purchase.unit}</td>
                                    <td>{formatCurrency(purchase.unitCost, settings.currencySymbol)}</td>
                                    <td>
                                        <div className="font-bold">{formatCurrency(purchase.totalCost, settings.currencySymbol)}</div>
                                        {purchase.notes && <div className="text-xs text-muted">{purchase.notes}</div>}
                                    </td>
                                </tr>
                            ))}
                            {(!purchaseAnalytics?.recentPurchases || purchaseAnalytics.recentPurchases.length === 0) && (
                                <tr><td colSpan={6} className="empty-state">No purchase ledger entries were logged during this range.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {isAdmin && (
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title flex items-center gap-2"><Target size={16} /> Cost Audit View</h3>
                        <p className="card-subtitle">{auditSubtitle}</p>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Sold</th>
                                <th>Order</th>
                                <th>Item</th>
                                <th>Ingredient</th>
                                <th>Qty Used</th>
                                <th>Sale-Date Cost</th>
                                <th>Current Cost</th>
                                <th>Variance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.costAudit || []).map((row) => (
                                <tr key={`${row.orderId}-${row.itemName}-${row.ingredientName}`}>
                                    <td>{new Date(row.soldAt).toLocaleString()}</td>
                                    <td>#{row.orderNumber}</td>
                                    <td>{row.itemName}</td>
                                    <td>{row.ingredientName}</td>
                                    <td>{row.quantityUsed.toFixed(2)} {row.ingredientUnit}</td>
                                    <td>{formatCurrency(row.saleDateExtendedCost, settings.currencySymbol)}</td>
                                    <td>{formatCurrency(row.currentExtendedCost, settings.currencySymbol)}</td>
                                    <td>{formatCurrency(row.variance, settings.currencySymbol)}</td>
                                </tr>
                            ))}
                            {(!data?.costAudit || data.costAudit.length === 0) && (
                                <tr><td colSpan={8} className="empty-state">No historical costing audit rows are available for this range yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="text-sm text-muted" style={{ padding: '0 24px 24px' }}>
                    This audit table is a weighted-average reference view. The selected costing mode above still drives report profitability, comparison cards, and sales export calculations.
                </div>
            </div>
            )}
            </div>
        </AppLayout>
    );
}
