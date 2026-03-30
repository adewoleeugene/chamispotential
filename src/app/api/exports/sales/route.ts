import { prisma } from '@/lib/prisma';
import { withRole } from '@/lib/api-middleware';
import { buildCsv, buildCsvResponse } from '@/lib/csv';
import { buildPdfBuffer, buildPdfResponse, createTableLines } from '@/lib/pdf';
import type { CostMethod } from '@/lib/profitability';
import { isRecognizedRevenueOrder } from '@/lib/revenue';
import { buildOrderFinancialSummaryMap } from '@/lib/restaurant-analytics';
import { getReportRange } from '@/lib/reporting';

function formatDate(value: Date | null | undefined) {
    return value ? value.toISOString() : '';
}

export const GET = withRole(['admin'])(async (req) => {
    const url = new URL(req.url);
    const requestedCostMethod = url.searchParams.get('costMethod');
    const costMethod: CostMethod = requestedCostMethod === 'fifo' || requestedCostMethod === 'lifo'
        ? requestedCostMethod
        : 'weighted_average_as_of_sale_date';
    const rangeParam = url.searchParams.get('range');
    const exportRange = rangeParam
        ? getReportRange(rangeParam, new Date(), url.searchParams.get('startDate'), url.searchParams.get('endDate'))
        : null;
    const format = url.searchParams.get('format');

    const [orders, inventory, purchases] = await Promise.all([
        prisma.order.findMany({
            where: {
                status: { not: 'cancelled' },
                ...(exportRange ? { createdAt: { gte: exportRange.start, lte: exportRange.end } } : {}),
            },
            include: {
                table: true,
                user: true,
                items: {
                    include: {
                        menuItem: {
                            include: {
                                recipeIngredients: true,
                            },
                        },
                        removals: true,
                        additions: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: [{ createdAt: 'desc' }, { orderNumber: 'desc' }],
        }),
        prisma.inventory.findMany({
            select: { id: true, cost: true },
        }),
        prisma.inventoryPurchase.findMany({
            select: {
                inventoryId: true,
                quantity: true,
                unitCost: true,
                totalCost: true,
                purchasedAt: true,
            },
            orderBy: { purchasedAt: 'asc' },
        }),
    ]);
    const orderFinancials = buildOrderFinancialSummaryMap({
        orders,
        purchases,
        inventory,
        costMethod,
    });

    const rows = orders.map((order) => {
        const itemSummary = order.items
            .map((item) => `${item.menuItem.name} x${item.quantity}`)
            .join('; ');
        const itemQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
        const orderFinancial = orderFinancials.get(order.id);
        const estimatedCogs = isRecognizedRevenueOrder(order) ? (orderFinancial?.cogs ?? 0) : 0;
        const netSales = isRecognizedRevenueOrder(order) ? (orderFinancial?.netSales ?? 0) : 0;
        const grossProfit = isRecognizedRevenueOrder(order) ? (orderFinancial?.grossProfit ?? 0) : 0;

        return [
            order.id,
            order.orderNumber,
            formatDate(order.createdAt),
            formatDate(order.updatedAt),
            order.status,
            order.type,
            order.table?.number ?? '',
            order.user.name,
            order.customerName ?? '',
            order.customerPhone ?? '',
            itemSummary,
            itemQuantity,
            order.subtotal.toFixed(2),
            netSales.toFixed(2),
            order.tax.toFixed(2),
            order.discount.toFixed(2),
            estimatedCogs.toFixed(2),
            grossProfit.toFixed(2),
            order.total.toFixed(2),
            order.paymentStatus,
            order.paymentMethod ?? '',
            order.notes ?? '',
        ];
    });

    if (format === 'pdf') {
        const label = exportRange?.label ?? 'All Time';
        const totalSales = rows.reduce((sum, row) => sum + Number(row[13] || 0), 0);
        const totalGrossProfit = rows.reduce((sum, row) => sum + Number(row[17] || 0), 0);
        const totalCogs = rows.reduce((sum, row) => sum + Number(row[16] || 0), 0);
        const pdf = buildPdfBuffer({
            title: `Sales Export - ${label}`,
            subject: `Sales export for ${label}`,
            pageSize: 'landscape',
            lines: [
                { text: 'Sales Export', font: 'bold', size: 20 },
                { text: `Range: ${label}`, color: [0.3, 0.36, 0.44], gapBefore: 4 },
                { text: `Costing Method: ${costMethod}`, color: [0.3, 0.36, 0.44] },
                { text: `Orders: ${rows.length}  |  Net Sales: ${totalSales.toFixed(2)}  |  Estimated COGS: ${totalCogs.toFixed(2)}  |  Gross Profit: ${totalGrossProfit.toFixed(2)}`, gapBefore: 10 },
                ...createTableLines(
                    ['Order #', 'Created', 'Type', 'Staff', 'Items', 'Net', 'COGS', 'Gross', 'Total', 'Payment'],
                    rows.map((row) => [
                        String(row[1]),
                        String(row[2]).slice(0, 16).replace('T', ' '),
                        String(row[5]),
                        String(row[7]),
                        String(row[10]),
                        String(row[13]),
                        String(row[16]),
                        String(row[17]),
                        String(row[18]),
                        String(row[19]),
                    ]),
                    [8, 16, 10, 14, 34, 10, 10, 10, 10, 12]
                ),
            ],
        });

        return buildPdfResponse(`sales-export-${costMethod}-${new Date().toISOString().slice(0, 10)}.pdf`, pdf);
    }

    const csv = buildCsv(
        [
            'Order ID',
            'Order Number',
            'Created At',
            'Updated At',
            'Status',
            'Order Type',
            'Table',
            'Staff',
            'Customer Name',
            'Customer Phone',
            'Items',
            'Item Quantity',
            'Subtotal',
            'Net Sales',
            'Tax',
            'Discount',
            'Estimated COGS',
            'Gross Profit',
            'Total',
            'Payment Status',
            'Payment Method',
            'Notes',
        ],
        rows
    );

    const filename = `sales-export-${costMethod}-${new Date().toISOString().slice(0, 10)}.csv`;
    return buildCsvResponse(filename, csv);
});
