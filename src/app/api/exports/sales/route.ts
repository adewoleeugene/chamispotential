import { prisma } from '@/lib/prisma';
import { withRole } from '@/lib/api-middleware';
import { buildCsv, buildCsvResponse } from '@/lib/csv';

function formatDate(value: Date | null | undefined) {
    return value ? value.toISOString() : '';
}

export const GET = withRole(['admin'])(async (req, user) => {
    void req;
    void user;

    const orders = await prisma.order.findMany({
        where: {
            status: { not: 'cancelled' },
        },
        include: {
            table: true,
            user: true,
            items: {
                include: {
                    menuItem: true,
                },
                orderBy: { createdAt: 'asc' },
            },
        },
        orderBy: [{ createdAt: 'desc' }, { orderNumber: 'desc' }],
    });

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
            'Tax',
            'Discount',
            'Tip',
            'Total',
            'Payment Status',
            'Payment Method',
            'Notes',
        ],
        orders.map((order) => {
            const itemSummary = order.items
                .map((item) => `${item.menuItem.name} x${item.quantity}`)
                .join('; ');
            const itemQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

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
                order.tax.toFixed(2),
                order.discount.toFixed(2),
                order.tip.toFixed(2),
                order.total.toFixed(2),
                order.paymentStatus,
                order.paymentMethod ?? '',
                order.notes ?? '',
            ];
        })
    );

    const filename = `sales-export-${new Date().toISOString().slice(0, 10)}.csv`;
    return buildCsvResponse(filename, csv);
});
