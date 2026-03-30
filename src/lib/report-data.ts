import { prisma } from '@/lib/prisma';
import { isRecognizedRevenueOrder } from '@/lib/revenue';
import type { CostMethod } from '@/lib/profitability';
import {
    buildCostAuditRows,
    buildFinancialAnalytics,
    buildPeriodComparisonSummary,
    buildPreviousPeriodComparison,
    buildPurchaseHistoryRows,
} from '@/lib/restaurant-analytics';
import { getComparisonRangeConfigs, getPreviousPeriodRange, getPurchaseHistoryResolution, getReportQueryBounds, getReportRange } from '@/lib/reporting';

const MAX_REPORTABLE_STAGE_MINUTES = 12 * 60;

function getDurationMinutes(start?: Date | null, end?: Date | null) {
    if (!start || !end) return null;
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return null;
    const minutes = diffMs / 60000;
    if (minutes > MAX_REPORTABLE_STAGE_MINUTES) return null;
    return minutes;
}

function getAverage(values: number[]) {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDurationRow(order: {
    id: string;
    orderNumber: number;
    createdAt: Date;
    serviceEndedAt: Date | null;
    paymentStatus: string;
    table: { number: number | null } | null;
    type: string;
    status: string;
    total: number;
    kitchenStartedAt?: Date | null;
}) {
    const kitchenStartedAt = order.kitchenStartedAt ?? null;
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        tableLabel: order.table?.number ? `Table ${order.table.number}` : 'No table',
        type: order.type,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total || 0,
        createdAt: order.createdAt.toISOString(),
        serviceEndedAt: order.serviceEndedAt ? order.serviceEndedAt.toISOString() : null,
        orderToKitchenMinutes: getDurationMinutes(order.createdAt, kitchenStartedAt),
        kitchenToExitMinutes: getDurationMinutes(kitchenStartedAt, order.serviceEndedAt),
        fullJourneyMinutes: getDurationMinutes(order.createdAt, order.serviceEndedAt),
    };
}

export async function buildReportPayload(options: {
    now?: Date;
    range: string | null;
    startDate?: string | null;
    endDate?: string | null;
    requestedCostMethod?: string | null;
    isAdmin: boolean;
}) {
    const now = options.now ?? new Date();
    const costMethod: CostMethod = options.isAdmin && (options.requestedCostMethod === 'fifo' || options.requestedCostMethod === 'lifo')
        ? options.requestedCostMethod
        : 'weighted_average_as_of_sale_date';
    const config = getReportRange(options.range, now, options.startDate, options.endDate);
    const comparisonRanges = getComparisonRangeConfigs(now);
    const previousConfig = getPreviousPeriodRange(config);
    const queryBounds = getReportQueryBounds(now, config);

    const [orders, lowInventory, inventory, purchases] = await Promise.all([
        prisma.order.findMany({
            where: {
                createdAt: { gte: queryBounds.start, lte: queryBounds.end },
                status: { not: 'cancelled' },
            },
            include: {
                table: true,
                items: {
                    include: {
                        menuItem: {
                            include: {
                                category: true,
                                recipeIngredients: true,
                            },
                        },
                        removals: true,
                        additions: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.inventory.findMany({
            where: { currentStock: { lte: prisma.inventory.fields.minStock } },
            take: 5,
            orderBy: { currentStock: 'asc' },
        }),
        prisma.inventory.findMany({
            select: {
                id: true,
                cost: true,
                name: true,
                unit: true,
                category: true,
            },
        }),
        prisma.inventoryPurchase.findMany({
            where: { purchasedAt: { lte: queryBounds.end } },
            select: {
                inventoryId: true,
                quantity: true,
                unitCost: true,
                totalCost: true,
                purchasedAt: true,
                supplier: true,
                notes: true,
                inventory: {
                    select: {
                        id: true,
                        name: true,
                        unit: true,
                        category: true,
                    },
                },
            },
            orderBy: { purchasedAt: 'asc' },
        }),
    ]);

    const financials = buildFinancialAnalytics({
        range: config.range,
        start: config.start,
        end: config.end,
        orders,
        purchases,
        inventory,
        costMethod,
    });
    const weekComparison = buildPeriodComparisonSummary({
        range: comparisonRanges.week.range,
        label: comparisonRanges.week.label,
        shortLabel: 'Week',
        start: comparisonRanges.week.start,
        end: comparisonRanges.week.end,
        orders,
        purchases,
        inventory,
        costMethod,
    });
    const monthComparison = buildPeriodComparisonSummary({
        range: comparisonRanges.month.range,
        label: comparisonRanges.month.label,
        shortLabel: 'Month',
        start: comparisonRanges.month.start,
        end: comparisonRanges.month.end,
        orders,
        purchases,
        inventory,
        costMethod,
    });
    const previousFinancials = buildFinancialAnalytics({
        range: previousConfig.range,
        start: previousConfig.start,
        end: previousConfig.end,
        orders,
        purchases,
        inventory,
        costMethod,
    });
    const previousPeriodComparison = buildPreviousPeriodComparison({
        currentLabel: config.label,
        previousLabel: previousConfig.label,
        current: financials,
        previous: previousFinancials,
    });
    const ordersInRange = orders.filter((order) => order.createdAt >= config.start && order.createdAt <= config.end);
    const dineInOrders = ordersInRange.filter((order) => order.type === 'dine-in').length;
    const takeoutOrders = ordersInRange.length - dineInOrders;
    const completedDineInOrders = ordersInRange.filter((order) => order.type === 'dine-in' && order.status === 'completed' && order.paymentStatus === 'paid');
    const orderToKitchenDurations = completedDineInOrders
        .map((order) => getDurationMinutes(order.createdAt, (order as typeof order & { kitchenStartedAt: Date | null }).kitchenStartedAt))
        .filter((value): value is number => value !== null);
    const kitchenToExitDurations = completedDineInOrders
        .map((order) => getDurationMinutes((order as typeof order & { kitchenStartedAt: Date | null }).kitchenStartedAt, order.serviceEndedAt))
        .filter((value): value is number => value !== null);
    const fullServiceDurations = completedDineInOrders
        .map((order) => getDurationMinutes(order.createdAt, order.serviceEndedAt))
        .filter((value): value is number => value !== null);

    const serviceTiming = {
        avgOrderToKitchenMinutes: getAverage(orderToKitchenDurations),
        avgKitchenToExitMinutes: getAverage(kitchenToExitDurations),
        avgFullServiceMinutes: getAverage(fullServiceDurations),
        measuredOrderToKitchenCount: orderToKitchenDurations.length,
        measuredKitchenToExitCount: kitchenToExitDurations.length,
        measuredFullServiceCount: fullServiceDurations.length,
    };
    const serviceTimingRows = completedDineInOrders
        .map((order) => toDurationRow(order as typeof order & { kitchenStartedAt: Date | null }))
        .sort((left, right) => {
            const rightDuration = right.fullJourneyMinutes ?? -1;
            const leftDuration = left.fullJourneyMinutes ?? -1;
            return rightDuration - leftDuration;
        })
        .slice(0, 25);

    const peakBucket = [...financials.trend].sort((a, b) => b.netSales - a.netSales)[0] || null;
    const bestSeller = financials.topItems[0] || null;
    const weakestSeller = financials.slowMovingItems[0] || null;
    const purchaseHistory = buildPurchaseHistoryRows(
        purchases.filter((purchase) => purchase.purchasedAt >= config.start && purchase.purchasedAt <= config.end),
        inventory,
        getPurchaseHistoryResolution(config)
    );
    const costAudit = buildCostAuditRows({
        orders: ordersInRange,
        purchases,
        inventory,
    });

    const orderTypeMix = [
        { type: 'dine-in', count: dineInOrders, revenue: ordersInRange.filter((order) => order.type === 'dine-in' && isRecognizedRevenueOrder(order)).reduce((sum, order) => sum + ((order.subtotal || 0) - (order.discount || 0)), 0) },
        { type: 'takeout + delivery', count: takeoutOrders, revenue: ordersInRange.filter((order) => order.type !== 'dine-in' && isRecognizedRevenueOrder(order)).reduce((sum, order) => sum + ((order.subtotal || 0) - (order.discount || 0)), 0) },
    ].filter((entry) => entry.count > 0);

    const insights = [
        peakBucket && peakBucket.netSales > 0
            ? `Peak ${config.range === 'day' ? 'hour' : 'day'}: ${peakBucket.label} drove ${peakBucket.orders} paid orders and ${peakBucket.netSales.toFixed(2)} in net sales.`
            : null,
        bestSeller
            ? `${bestSeller.name} led the menu with ${bestSeller.quantity} sold and ${bestSeller.grossProfit.toFixed(2)} in gross profit.`
            : null,
        weakestSeller
            ? `${weakestSeller.name} remained soft at ${weakestSeller.quantity} sold and may need a pricing or placement review.`
            : null,
        financials.summary.grossProfit > 0
            ? `Estimated gross margin landed at ${financials.summary.grossMarginPct.toFixed(1)}% after ${financials.summary.cogs.toFixed(2)} in ingredient cost of goods sold.`
            : null,
        financials.summary.ingredientSpend > 0
            ? `Ingredient purchases totaled ${financials.summary.ingredientSpend.toFixed(2)} in ${config.label.toLowerCase()}.`
            : null,
        serviceTiming.measuredOrderToKitchenCount > 0
            ? `Average order-to-kitchen time was ${serviceTiming.avgOrderToKitchenMinutes.toFixed(1)} minutes across ${serviceTiming.measuredOrderToKitchenCount} tracked orders.`
            : null,
        serviceTiming.measuredKitchenToExitCount > 0
            ? `Average kitchen-to-customer-exit time was ${serviceTiming.avgKitchenToExitMinutes.toFixed(1)} minutes across ${serviceTiming.measuredKitchenToExitCount} completed service journeys.`
            : null,
        lowInventory.length > 0
            ? `${lowInventory.length} inventory items are already at or below minimum stock and should inform the next purchasing pass.`
            : null,
    ].filter((value): value is string => Boolean(value));

    return {
        range: config.range,
        label: config.label,
        chartLabel: config.chartLabel,
        summary: {
            recognizedRevenue: financials.summary.recognizedRevenue,
            netSales: financials.summary.netSales,
            taxCollected: financials.summary.taxCollected,
            discountsGiven: financials.summary.discountsGiven,
            ingredientSpend: financials.summary.ingredientSpend,
            cogs: financials.summary.cogs,
            grossProfit: financials.summary.grossProfit,
            grossMarginPct: financials.summary.grossMarginPct,
            totalRevenue: financials.summary.recognizedRevenue,
            totalOrders: ordersInRange.length,
            avgTicket: financials.summary.avgTicket,
            bestSeller: bestSeller?.name || 'No sales yet',
            lowInventoryCount: lowInventory.length,
        },
        serviceTiming,
        serviceTimingRows,
        trend: financials.trend,
        orderTypeMix,
        metadata: financials.metadata,
        selectedRange: {
            start: config.start.toISOString(),
            end: config.end.toISOString(),
        },
        previousPeriodComparison: options.isAdmin ? previousPeriodComparison : null,
        periodComparisons: options.isAdmin ? [weekComparison, monthComparison] : [],
        purchaseAnalytics: financials.purchaseAnalytics,
        purchaseHistory: options.isAdmin ? purchaseHistory : [],
        costAudit: options.isAdmin ? costAudit : [],
        topItems: financials.topItems,
        slowMovingItems: financials.slowMovingItems,
        highMarginItems: financials.highMarginItems,
        lowMarginItems: financials.lowMarginItems,
        itemProfitability: financials.itemProfitability,
        salesVelocity: financials.salesVelocity,
        lowInventory,
        insights,
    };
}

export type ReportPayload = Awaited<ReturnType<typeof buildReportPayload>>;
