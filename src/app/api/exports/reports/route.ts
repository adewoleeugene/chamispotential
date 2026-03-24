import { withRole } from '@/lib/api-middleware';
import { formatCurrency } from '@/lib/currency';
import { buildPdfBuffer, buildPdfResponse, createTableLines } from '@/lib/pdf';
import { buildReportPayload } from '@/lib/report-data';

function formatDuration(minutes: number) {
    if (!minutes || minutes <= 0) return '0m';
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    const remainingMinutes = rounded % 60;
    return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

function formatDateTime(value: string | null | undefined) {
    if (!value) return 'n/a';
    return value.slice(0, 16).replace('T', ' ');
}

function emptySection(message: string) {
    return [{ text: message, gapBefore: 6 }];
}

export const GET = withRole(['admin', 'manager'])(async (req, user) => {
    const url = new URL(req.url);
    const payload = await buildReportPayload({
        now: new Date(),
        range: url.searchParams.get('range'),
        startDate: url.searchParams.get('startDate'),
        endDate: url.searchParams.get('endDate'),
        requestedCostMethod: url.searchParams.get('costMethod'),
        isAdmin: user.role === 'admin',
    });
    const currencySymbol = url.searchParams.get('currencySymbol') || '$';

    const previousComparisonLines = payload.previousPeriodComparison
        ? createTableLines(
            ['Metric', 'Current', 'Previous', 'Delta', 'Delta %'],
            [
                ['Net Sales', formatCurrency(payload.previousPeriodComparison.metrics.netSales.current, currencySymbol), formatCurrency(payload.previousPeriodComparison.metrics.netSales.previous, currencySymbol), formatCurrency(payload.previousPeriodComparison.metrics.netSales.delta, currencySymbol), payload.previousPeriodComparison.metrics.netSales.deltaPct?.toFixed(1) ? `${payload.previousPeriodComparison.metrics.netSales.deltaPct.toFixed(1)}%` : 'new'],
                ['Ingredient Spend', formatCurrency(payload.previousPeriodComparison.metrics.ingredientSpend.current, currencySymbol), formatCurrency(payload.previousPeriodComparison.metrics.ingredientSpend.previous, currencySymbol), formatCurrency(payload.previousPeriodComparison.metrics.ingredientSpend.delta, currencySymbol), payload.previousPeriodComparison.metrics.ingredientSpend.deltaPct?.toFixed(1) ? `${payload.previousPeriodComparison.metrics.ingredientSpend.deltaPct.toFixed(1)}%` : 'new'],
                ['Gross Profit', formatCurrency(payload.previousPeriodComparison.metrics.grossProfit.current, currencySymbol), formatCurrency(payload.previousPeriodComparison.metrics.grossProfit.previous, currencySymbol), formatCurrency(payload.previousPeriodComparison.metrics.grossProfit.delta, currencySymbol), payload.previousPeriodComparison.metrics.grossProfit.deltaPct?.toFixed(1) ? `${payload.previousPeriodComparison.metrics.grossProfit.deltaPct.toFixed(1)}%` : 'new'],
                ['Gross Margin', `${payload.previousPeriodComparison.metrics.grossMarginPct.current.toFixed(1)}%`, `${payload.previousPeriodComparison.metrics.grossMarginPct.previous.toFixed(1)}%`, `${payload.previousPeriodComparison.metrics.grossMarginPct.delta.toFixed(1)} pts`, payload.previousPeriodComparison.metrics.grossMarginPct.deltaPct?.toFixed(1) ? `${payload.previousPeriodComparison.metrics.grossMarginPct.deltaPct.toFixed(1)}%` : 'new'],
                ['Total Orders', String(payload.previousPeriodComparison.metrics.totalOrders.current), String(payload.previousPeriodComparison.metrics.totalOrders.previous), String(payload.previousPeriodComparison.metrics.totalOrders.delta), payload.previousPeriodComparison.metrics.totalOrders.deltaPct?.toFixed(1) ? `${payload.previousPeriodComparison.metrics.totalOrders.deltaPct.toFixed(1)}%` : 'new'],
            ],
            [18, 12, 12, 12, 10]
        )
        : emptySection('Previous-period comparison is not available for this role.');

    const comparisonRangeLines = payload.periodComparisons.length > 0
        ? createTableLines(
            ['Range', 'Net Sales', 'Spend', 'Gross', 'Margin', 'Orders', 'Top Ingredient'],
            payload.periodComparisons.map((row) => [
                row.label,
                formatCurrency(row.netSales, currencySymbol),
                formatCurrency(row.ingredientSpend, currencySymbol),
                formatCurrency(row.grossProfit, currencySymbol),
                `${row.grossMarginPct.toFixed(1)}%`,
                String(row.totalOrders),
                row.topPurchasedIngredient || 'n/a',
            ]),
            [22, 12, 12, 12, 8, 8, 20]
        )
        : emptySection('Comparison cards are not available for this role.');

    const purchaseAnalyticsLines = payload.purchaseAnalytics.topPurchasedIngredients.length > 0
        ? createTableLines(
            ['Ingredient', 'Qty', 'Spend', 'Avg Unit', 'Suppliers', 'Last Purchase', 'Share'],
            payload.purchaseAnalytics.topPurchasedIngredients.slice(0, 10).map((item) => [
                item.name,
                `${item.quantity.toFixed(2)} ${item.unit}`,
                formatCurrency(item.totalCost, currencySymbol),
                formatCurrency(item.averageUnitCost, currencySymbol),
                String(item.supplierCount),
                formatDateTime(item.lastPurchasedAt),
                `${item.spendSharePct.toFixed(1)}%`,
            ]),
            [18, 14, 12, 12, 10, 16, 8]
        )
        : emptySection('No top purchased ingredients were found in this range.');

    const purchaseByIngredientLines = payload.purchaseAnalytics.purchasesByIngredient.length > 0
        ? createTableLines(
            ['Ingredient', 'Category', 'Qty', 'Spend', 'Count', 'Avg Unit'],
            payload.purchaseAnalytics.purchasesByIngredient.slice(0, 10).map((item) => [
                item.name,
                item.category,
                `${item.quantity.toFixed(2)} ${item.unit}`,
                formatCurrency(item.totalCost, currencySymbol),
                String(item.purchaseCount),
                formatCurrency(item.averageUnitCost, currencySymbol),
            ]),
            [18, 14, 14, 12, 8, 12]
        )
        : emptySection('No purchase-by-ingredient rows were found.');

    const supplierSpendLines = payload.purchaseAnalytics.supplierSpend.length > 0
        ? createTableLines(
            ['Supplier', 'Spend', 'Purchase Count', 'Share'],
            payload.purchaseAnalytics.supplierSpend.slice(0, 10).map((supplier) => [
                supplier.supplier,
                formatCurrency(supplier.totalCost, currencySymbol),
                String(supplier.purchaseCount),
                `${supplier.sharePct.toFixed(1)}%`,
            ]),
            [24, 12, 14, 8]
        )
        : emptySection('No supplier spend rows were found.');

    const recentPurchaseLines = payload.purchaseAnalytics.recentPurchases.length > 0
        ? createTableLines(
            ['Ingredient', 'Qty', 'Unit Cost', 'Total', 'Supplier', 'Purchased'],
            payload.purchaseAnalytics.recentPurchases.slice(0, 12).map((purchase) => [
                purchase.inventoryName,
                `${purchase.quantity.toFixed(2)} ${purchase.unit}`,
                formatCurrency(purchase.unitCost, currencySymbol),
                formatCurrency(purchase.totalCost, currencySymbol),
                purchase.supplier || 'n/a',
                formatDateTime(purchase.purchasedAt),
            ]),
            [20, 14, 12, 12, 18, 16]
        )
        : emptySection('No recent purchases were found.');

    const purchaseHistoryLines = payload.purchaseHistory.length > 0
        ? createTableLines(
            ['Bucket', 'Spend', 'Purchases', 'Top Ingredient', 'Top Supplier'],
            payload.purchaseHistory.map((row) => [
                row.label,
                formatCurrency(row.totalSpend, currencySymbol),
                String(row.purchaseCount),
                row.topIngredient,
                row.topSupplier,
            ]),
            [18, 12, 10, 20, 18]
        )
        : emptySection('No purchase history buckets are available.');

    const trendLines = payload.trend.length > 0
        ? createTableLines(
            ['Period', 'Revenue', 'Net Sales', 'COGS', 'Spend', 'Gross', 'Orders'],
            payload.trend.map((row) => [
                row.label,
                formatCurrency(row.revenue, currencySymbol),
                formatCurrency(row.netSales, currencySymbol),
                formatCurrency(row.cogs, currencySymbol),
                formatCurrency(row.ingredientSpend, currencySymbol),
                formatCurrency(row.grossProfit, currencySymbol),
                String(row.orders),
            ]),
            [18, 12, 12, 12, 12, 12, 8]
        )
        : emptySection('No trend rows are available.');

    const purchaseTrendLines = payload.trend.length > 0
        ? createTableLines(
            ['Period', 'Ingredient Spend'],
            payload.trend.map((row) => [
                row.label,
                formatCurrency(row.ingredientSpend, currencySymbol),
            ]),
            [22, 14]
        )
        : emptySection('No purchase spend trend rows are available.');

    const orderMixLines = payload.orderTypeMix.length > 0
        ? createTableLines(
            ['Order Type', 'Count', 'Revenue'],
            payload.orderTypeMix.map((row) => [row.type, String(row.count), formatCurrency(row.revenue, currencySymbol)]),
            [24, 10, 12]
        )
        : emptySection('No order mix rows are available.');

    const topItemsLines = payload.topItems.length > 0
        ? createTableLines(
            ['Item', 'Category', 'Qty', 'Revenue', 'Cost', 'Gross', 'Margin'],
            payload.topItems.slice(0, 12).map((item) => [
                item.name,
                item.category,
                String(item.quantity),
                formatCurrency(item.revenue, currencySymbol),
                formatCurrency(item.estimatedCost, currencySymbol),
                formatCurrency(item.grossProfit, currencySymbol),
                `${item.grossMarginPct.toFixed(1)}%`,
            ]),
            [22, 14, 6, 12, 12, 12, 8]
        )
        : emptySection('No top-performing items are available.');

    const slowItemsLines = payload.slowMovingItems.length > 0
        ? createTableLines(
            ['Item', 'Category', 'Qty', 'Revenue', 'Gross'],
            payload.slowMovingItems.slice(0, 12).map((item) => [
                item.name,
                item.category,
                String(item.quantity),
                formatCurrency(item.revenue, currencySymbol),
                formatCurrency(item.grossProfit, currencySymbol),
            ]),
            [22, 14, 6, 12, 12]
        )
        : emptySection('No slow-moving items are available.');

    const highMarginLines = payload.highMarginItems.length > 0
        ? createTableLines(
            ['Item', 'Category', 'Qty', 'Gross', 'Margin'],
            payload.highMarginItems.slice(0, 12).map((item) => [
                item.name,
                item.category,
                String(item.quantity),
                formatCurrency(item.grossProfit, currencySymbol),
                `${item.grossMarginPct.toFixed(1)}%`,
            ]),
            [22, 14, 6, 12, 8]
        )
        : emptySection('No high-margin items are available.');

    const lowMarginLines = payload.lowMarginItems.length > 0
        ? createTableLines(
            ['Item', 'Category', 'Qty', 'Gross', 'Margin'],
            payload.lowMarginItems.slice(0, 12).map((item) => [
                item.name,
                item.category,
                String(item.quantity),
                formatCurrency(item.grossProfit, currencySymbol),
                `${item.grossMarginPct.toFixed(1)}%`,
            ]),
            [22, 14, 6, 12, 8]
        )
        : emptySection('No low-margin items are available.');

    const salesVelocityLines = payload.salesVelocity.length > 0
        ? createTableLines(
            ['Item', 'Category', 'Qty', 'Units/Day', 'Revenue'],
            payload.salesVelocity.slice(0, 12).map((item) => [
                item.name,
                item.category,
                String(item.quantity),
                item.unitsPerDay.toFixed(2),
                formatCurrency(item.revenue, currencySymbol),
            ]),
            [22, 14, 6, 10, 12]
        )
        : emptySection('No sales velocity rows are available.');

    const serviceTimingLines = payload.serviceTimingRows.length > 0
        ? createTableLines(
            ['Order #', 'Table', 'Created', 'Order->Kitchen', 'Kitchen->Exit', 'Full Journey', 'Total'],
            payload.serviceTimingRows.map((row) => [
                String(row.orderNumber),
                row.tableLabel,
                formatDateTime(row.createdAt),
                formatDuration(row.orderToKitchenMinutes || 0),
                formatDuration(row.kitchenToExitMinutes || 0),
                formatDuration(row.fullJourneyMinutes || 0),
                formatCurrency(row.total, currencySymbol),
            ]),
            [8, 14, 16, 14, 14, 14, 10]
        )
        : emptySection('No tracked service journeys are available.');

    const lowInventoryLines = payload.lowInventory.length > 0
        ? createTableLines(
            ['Item', 'Category', 'Current', 'Minimum'],
            payload.lowInventory.map((item) => [
                item.name,
                item.category,
                item.currentStock.toFixed(2),
                item.minStock.toFixed(2),
            ]),
            [28, 18, 10, 10]
        )
        : emptySection('No low-stock items were flagged in this range.');

    const costAuditLines = payload.costAudit.length > 0
        ? createTableLines(
            ['Order #', 'Item', 'Ingredient', 'Qty Used', 'Sale Cost', 'Current Cost', 'Variance'],
            payload.costAudit.slice(0, 20).map((row) => [
                String(row.orderNumber),
                row.itemName,
                row.ingredientName,
                row.quantityUsed.toFixed(2),
                formatCurrency(row.saleDateExtendedCost, currencySymbol),
                formatCurrency(row.currentExtendedCost, currencySymbol),
                formatCurrency(row.variance, currencySymbol),
            ]),
            [8, 18, 16, 10, 12, 12, 12]
        )
        : emptySection('No cost audit rows are available for this range.');

    const pdf = buildPdfBuffer({
        title: `Executive Report - ${payload.label}`,
        subject: `Executive report for ${payload.label}`,
        lines: [
            { text: 'Executive Report Pack', font: 'bold', size: 22 },
            { text: `${payload.label} | Costing: ${payload.metadata.costMethod}`, color: [0.3, 0.36, 0.44], gapBefore: 4 },
            { text: `Net Sales: ${formatCurrency(payload.summary.netSales, currencySymbol)}  |  Purchase Spend: ${formatCurrency(payload.summary.ingredientSpend, currencySymbol)}  |  Gross Profit: ${formatCurrency(payload.summary.grossProfit, currencySymbol)}  |  Gross Margin: ${payload.summary.grossMarginPct.toFixed(1)}%`, gapBefore: 12 },
            { text: `Revenue: ${formatCurrency(payload.summary.totalRevenue, currencySymbol)}  |  Tax: ${formatCurrency(payload.summary.taxCollected, currencySymbol)}  |  Discounts: ${formatCurrency(payload.summary.discountsGiven, currencySymbol)}  |  COGS: ${formatCurrency(payload.summary.cogs, currencySymbol)}`, gapBefore: 4 },
            { text: `Orders: ${payload.summary.totalOrders}  |  Avg Ticket: ${formatCurrency(payload.summary.avgTicket, currencySymbol)}  |  Best Seller: ${payload.summary.bestSeller}  |  Low Stock Count: ${payload.summary.lowInventoryCount}`, gapBefore: 4 },
            { text: 'Previous Period Comparison', font: 'bold', size: 15, gapBefore: 18 },
            ...previousComparisonLines,

            { text: 'Service Timing Summary', font: 'bold', size: 15, gapBefore: 18 },
            { text: `Order to Kitchen: ${formatDuration(payload.serviceTiming.avgOrderToKitchenMinutes)} (${payload.serviceTiming.measuredOrderToKitchenCount} tracked)  |  Kitchen to Exit: ${formatDuration(payload.serviceTiming.avgKitchenToExitMinutes)} (${payload.serviceTiming.measuredKitchenToExitCount} tracked)  |  Full Journey: ${formatDuration(payload.serviceTiming.avgFullServiceMinutes)} (${payload.serviceTiming.measuredFullServiceCount} tracked)`, gapBefore: 6 },

            { text: 'Comparison Cards', font: 'bold', size: 15, gapBefore: 18 },
            ...comparisonRangeLines,

            { text: 'Revenue Rhythm', font: 'bold', size: 15, gapBefore: 18 },
            ...trendLines,

            { text: 'Decision Signals', font: 'bold', size: 15, gapBefore: 18 },
            ...(payload.insights.length > 0
                ? payload.insights.map((insight) => ({ text: `- ${insight}`, gapBefore: 4 }))
                : emptySection('No report insights are available for this range.')),

            { text: 'Purchase History Drilldown', font: 'bold', size: 15, gapBefore: 18 },
            ...purchaseHistoryLines,

            { text: 'Purchase Spend Trend', font: 'bold', size: 15, gapBefore: 18 },
            { text: `Total Spend: ${formatCurrency(payload.purchaseAnalytics.totalSpend, currencySymbol)}  |  Spend Concentration: ${payload.purchaseAnalytics.spendConcentrationPct.toFixed(1)}%`, gapBefore: 6 },
            ...purchaseTrendLines,

            { text: 'Purchase Focus', font: 'bold', size: 15, gapBefore: 18 },
            ...purchaseAnalyticsLines,

            { text: 'Service Timing Detail', font: 'bold', size: 15, gapBefore: 18 },
            ...serviceTimingLines,

            { text: 'Top Performers', font: 'bold', size: 15, gapBefore: 18 },
            ...topItemsLines,

            { text: 'Slow Movers', font: 'bold', size: 15, gapBefore: 18 },
            ...slowItemsLines,

            { text: 'High Margin Items', font: 'bold', size: 15, gapBefore: 18 },
            ...highMarginLines,

            { text: 'Low Margin Watchlist', font: 'bold', size: 15, gapBefore: 18 },
            ...lowMarginLines,

            { text: 'Revenue Mix', font: 'bold', size: 15, gapBefore: 18 },
            ...orderMixLines,

            { text: 'Purchases By Ingredient', font: 'bold', size: 15, gapBefore: 18 },
            ...purchaseByIngredientLines,

            { text: 'Supplier Spend', font: 'bold', size: 15, gapBefore: 18 },
            ...supplierSpendLines,

            { text: 'Recent Purchase Ledger', font: 'bold', size: 15, gapBefore: 18 },
            ...recentPurchaseLines,

            { text: 'Inventory Risk', font: 'bold', size: 15, gapBefore: 18 },
            ...lowInventoryLines,

            { text: 'Sales Velocity', font: 'bold', size: 15, gapBefore: 18 },
            ...salesVelocityLines,

            { text: 'Cost Audit', font: 'bold', size: 15, gapBefore: 18 },
            ...costAuditLines,
        ],
    });

    return buildPdfResponse(`executive-report-${new Date().toISOString().slice(0, 10)}.pdf`, pdf);
});
