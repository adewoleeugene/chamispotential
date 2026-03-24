import { prisma } from '@/lib/prisma';
import { withRole } from '@/lib/api-middleware';
import { buildCsv, buildCsvResponse } from '@/lib/csv';
import { buildPdfBuffer, buildPdfResponse, createTableLines } from '@/lib/pdf';
import { buildPurchaseLedgerRows } from '@/lib/purchase-ledger';
import { getReportRange } from '@/lib/reporting';

export const GET = withRole(['admin'])(async (req) => {
  const url = new URL(req.url);
  const rangeParam = url.searchParams.get('range');
  const exportRange = rangeParam
    ? getReportRange(rangeParam, new Date(), url.searchParams.get('startDate'), url.searchParams.get('endDate'))
    : null;
  const format = url.searchParams.get('format');

  const purchases = await prisma.inventoryPurchase.findMany({
    where: exportRange ? { purchasedAt: { gte: exportRange.start, lte: exportRange.end } } : undefined,
    include: {
      inventory: {
        select: {
          id: true,
          name: true,
          category: true,
          unit: true,
        },
      },
    },
    orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
  });

  const rows = buildPurchaseLedgerRows(
    purchases.map((purchase) => ({
      id: purchase.id,
      inventoryId: purchase.inventoryId,
      inventoryName: purchase.inventory.name,
      category: purchase.inventory.category,
      unit: purchase.inventory.unit,
      quantity: purchase.quantity,
      unitCost: purchase.unitCost,
      totalCost: purchase.totalCost,
      supplier: purchase.supplier,
      notes: purchase.notes,
      purchasedAt: purchase.purchasedAt,
      createdAt: purchase.createdAt,
    }))
  );

  if (format === 'pdf') {
    const label = exportRange?.label ?? 'All Time';
    const totalSpend = rows.reduce((sum, row) => sum + Number(row[7] || 0), 0);
    const pdf = buildPdfBuffer({
      title: `Purchase Ledger - ${label}`,
      subject: `Purchase ledger for ${label}`,
      pageSize: 'landscape',
      lines: [
        { text: 'Purchase Ledger', font: 'bold', size: 20 },
        { text: `Range: ${label}`, color: [0.3, 0.36, 0.44], gapBefore: 4 },
        { text: `Entries: ${rows.length}  |  Total Spend: ${totalSpend.toFixed(2)}`, gapBefore: 10 },
        ...createTableLines(
          ['Ingredient', 'Category', 'Qty', 'Unit Cost', 'Total', 'Supplier', 'Purchased', 'Notes'],
          rows.map((row) => [
            String(row[2]),
            String(row[3]),
            String(row[5]),
            String(row[6]),
            String(row[7]),
            String(row[8]),
            String(row[10]).slice(0, 16).replace('T', ' '),
            String(row[9]),
          ]),
          [22, 14, 8, 10, 10, 16, 16, 28]
        ),
      ],
    });

    return buildPdfResponse(`purchase-ledger-${new Date().toISOString().slice(0, 10)}.pdf`, pdf);
  }

  const csv = buildCsv(
    [
      'Purchase ID',
      'Inventory ID',
      'Ingredient',
      'Category',
      'Unit',
      'Quantity',
      'Unit Cost',
      'Total Cost',
      'Supplier',
      'Notes',
      'Purchased At',
      'Logged At',
    ],
    rows
  );

  const filename = `purchase-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  return buildCsvResponse(filename, csv);
});
